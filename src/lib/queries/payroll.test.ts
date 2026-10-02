// src/lib/queries/payroll.test.ts
//
// Citirile salarizării: filtrele de organizație și de ștergere logică,
// paginarea keyset și maparea rândurilor. Clientul e falsul STRICT din
// `@/lib/teste/supabase-fals`, servit prin `createServerSupabase`.
//
// Citirile care alimentează DOAR calculul perioadei (scutiri, componente,
// pontaj agregat, istoric de venit, certificate medicale, compensări, diurnă)
// sunt în `src/app/(app)/salarizare/citiri-calcul.test.ts`, lângă acțiunea
// care le consumă — fișierul ăsta ar fi trecut de 800 de linii.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import {
  angajatiActiviCuContract,
  citesteFluturasulPropriu,
  citesteInregistrare,
  citestePerioada,
  citesteSetariPeId,
  citesteSetariValabile,
  dosarePopriri,
  listeazaInregistrari,
  listeazaIstoricSetari,
  listeazaIstoricVenit,
  listeazaPerioade,
  marginileLunii,
  perioadaInregistrarii,
  popririActive,
  totiAngajatiiDeAles,
  zileLucratoareLuna,
} from "./payroll";

let server: ClientFals;

beforeEach(() => {
  server = configureazaActiunea().server;
});

const esteViuInOrg = (tabela: string, index = 0) => {
  const apel = server.apeluriPe(tabela)[index];
  return (
    areFiltru(apel, "eq", "organization_id", ORG_ID) && areFiltru(apel, "is", "deleted_at", null)
  );
};

// ── Setări ───────────────────────────────────────────────────────────────────

describe("setările de salarizare", () => {
  it("citesteSetariPeId: rândul exact al perioadei, cu pragurile lui în ordine", async () => {
    server.raspunde("payroll_settings", "select", { data: { id: ID_3, cota_cas: 0.25 } });
    const praguri = [{ id: "p1", valoare: 810 }];
    server.raspunde("payroll_personal_deduction_brackets", "select", { data: praguri });

    expect(await citesteSetariPeId(ORG_ID, ID_3)).toEqual({ id: ID_3, cota_cas: 0.25, praguri });
    expect(esteViuInOrg("payroll_settings")).toBe(true);
    expect(areFiltru(server.apeluriPe("payroll_settings")[0], "eq", "id", ID_3)).toBe(true);
    const [p] = server.apeluriPe("payroll_personal_deduction_brackets");
    expect(areFiltru(p, "eq", "settings_id", ID_3)).toBe(true);
    expect(areFiltru(p, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(p, "order", "ordine", { ascending: true })).toBe(true);
  });

  it("citesteSetariPeId: setări inexistente ⇒ null, fără citirea pragurilor", async () => {
    server.raspunde("payroll_settings", "select", { data: null });
    expect(await citesteSetariPeId(ORG_ID, ID_3)).toBeNull();
    expect(server.apeluriPe("payroll_personal_deduction_brackets")).toHaveLength(0);
  });

  it("citesteSetariValabile: cea mai recentă versiune cu `valabil_de_la` ≤ data", async () => {
    server.raspunde("payroll_settings", "select", { data: [{ id: ID_2 }] });
    server.raspunde("payroll_personal_deduction_brackets", "select", { data: null });

    expect(await citesteSetariValabile(ORG_ID, "2026-03-31")).toEqual({ id: ID_2, praguri: [] });
    const [apel] = server.apeluriPe("payroll_settings");
    expect(esteViuInOrg("payroll_settings")).toBe(true);
    expect(areFiltru(apel, "lte", "valabil_de_la", "2026-03-31")).toBe(true);
    expect(areFiltru(apel, "order", "valabil_de_la", { ascending: false })).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [1] });
  });

  it("citesteSetariValabile: nicio versiune ⇒ null", async () => {
    server.raspunde("payroll_settings", "select", { data: [] });
    expect(await citesteSetariValabile(ORG_ID, "2026-03-31")).toBeNull();
  });

  it("listeazaIstoricSetari: versiunile organizației, cea mai recentă prima", async () => {
    const versiuni = [{ id: ID_2, valabil_de_la: "2026-07-01", verificat_de_contabil: false }];
    server.raspunde("payroll_settings", "select", { data: versiuni });
    expect(await listeazaIstoricSetari(ORG_ID)).toEqual(versiuni);
    expect(esteViuInOrg("payroll_settings")).toBe(true);
    const [apel] = server.apeluriPe("payroll_settings");
    expect(areFiltru(apel, "order", "valabil_de_la", { ascending: false })).toBe(true);
  });
});

// ── Perioade și fluturași ────────────────────────────────────────────────────

describe("perioade și înregistrări", () => {
  it("listeazaPerioade: cele mai recente primele; listă goală la `null`", async () => {
    server.raspunde("payroll_periods", "select", { data: null });
    expect(await listeazaPerioade(ORG_ID)).toEqual([]);
    const [apel] = server.apeluriPe("payroll_periods");
    expect(esteViuInOrg("payroll_periods")).toBe(true);
    expect(apel?.filtre.filter((f) => f.metoda === "order").map((f) => f.argumente)).toEqual([
      ["an", { ascending: false }],
      ["luna", { ascending: false }],
    ]);
  });

  it.each([
    ["perioadaInregistrarii", () => perioadaInregistrarii(ORG_ID, ID_1), "payroll_periods"],
    ["citestePerioada", () => citestePerioada(ORG_ID, ID_1), "payroll_periods"],
    ["citesteInregistrare", () => citesteInregistrare(ORG_ID, ID_1), "payroll_entries"],
  ] as const)("%s: rândul cu id-ul cerut, din organizație, neșters", async (_n, f, tabela) => {
    server.raspunde(tabela, "select", { data: { an: 2026, luna: 4 } });
    expect(await f()).toEqual({ an: 2026, luna: 4 });
    expect(esteViuInOrg(tabela)).toBe(true);
    expect(areFiltru(server.apeluriPe(tabela)[0], "eq", "id", ID_1)).toBe(true);
  });

  it.each([
    ["citestePerioada", () => citestePerioada(ORG_ID, ID_1), "payroll_periods"],
    ["citesteInregistrare", () => citesteInregistrare(ORG_ID, ID_1), "payroll_entries"],
  ] as const)("%s: eroarea bazei se propagă", async (_n, f, tabela) => {
    const eroare = eroarePostgrest("42501");
    server.raspunde(tabela, "select", { error: eroare });
    await expect(f()).rejects.toBe(eroare);
  });

  it("citesteFluturasulPropriu: filtrează pe organizație și ignoră rândurile șterse", async () => {
    server.raspunde("payroll_entries", "select", { data: { an: 2026, luna: 4 } });
    expect(await citesteFluturasulPropriu(ORG_ID, ID_2)).toEqual({ an: 2026, luna: 4 });
    expect(esteViuInOrg("payroll_entries")).toBe(true);
  });

  it("citesteFluturasulPropriu: doar fluturașul angajatului, cel mai recent calculat", async () => {
    server.raspunde("payroll_entries", "select", { data: null });
    expect(await citesteFluturasulPropriu(ORG_ID, ID_2)).toBeNull();
    const [apel] = server.apeluriPe("payroll_entries");
    expect(areFiltru(apel, "eq", "employee_id", ID_2)).toBe(true);
    expect(areFiltru(apel, "order", "calculat_la", { ascending: false, nullsFirst: false })).toBe(
      true,
    );
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [1] });
  });

  it("listeazaInregistrari: paginează keyset la 500 și ordonează după nume, cu marca drept rezervă", async () => {
    const pagina = Array.from({ length: 500 }, (_, i) => ({
      id: `r${String(i).padStart(3, "0")}`,
      angajat: { full_name: `Zeta ${String(i).padStart(3, "0")}`, marca: "m" },
    }));
    server.raspunde("payroll_entries", "select", { data: pagina });
    server.raspunde("payroll_entries", "select", {
      data: [
        { id: "s1", angajat: { full_name: "Ștefan", marca: "2" } },
        { id: "s2", angajat: { full_name: "", marca: "Alfa" } },
        { id: "s3", angajat: null },
      ],
    });

    const r = await listeazaInregistrari(ID_1);

    expect(r.trunchiat).toBe(false);
    expect(r.randuri).toHaveLength(503);
    expect(r.randuri.slice(0, 3).map((x) => x.id)).toEqual(["s3", "s2", "s1"]);
    const [prima, aDoua] = server.apeluriPe("payroll_entries");
    expect(areFiltru(prima, "eq", "period_id", ID_1)).toBe(true);
    expect(areFiltru(prima, "is", "deleted_at", null)).toBe(true);
    expect(prima?.filtre).toContainEqual({ metoda: "limit", argumente: [500] });
    // Fără ordonare stabilă după cheia cursorului, keyset-ul sare sau dublează
    // rânduri tăcut (capcana 2): fiecare pagină trebuie ordonată după `id`.
    expect(areFiltru(prima, "order", "id", { ascending: true })).toBe(true);
    expect(areFiltru(aDoua, "order", "id", { ascending: true })).toBe(true);
    expect(areFiltru(prima, "gt", "id")).toBe(false);
    expect(areFiltru(aDoua, "gt", "id", "r499")).toBe(true);
  });

  it("listeazaInregistrari: plafonul de 100 de pagini pline ⇒ `trunchiat`, fără a 101-a cerere", async () => {
    for (let p = 0; p < 100; p += 1) {
      server.raspunde("payroll_entries", "select", {
        data: Array.from({ length: 500 }, (_, i) => ({
          id: `p${String(p).padStart(3, "0")}-${String(i).padStart(3, "0")}`,
          angajat: { full_name: "X", marca: "1" },
        })),
      });
    }

    const r = await listeazaInregistrari(ID_1);

    expect(r.trunchiat).toBe(true);
    expect(r.randuri).toHaveLength(50_000);
    expect(server.apeluriPe("payroll_entries")).toHaveLength(100);
    expect(server.neconsumate()).toEqual([]);
  });
});

// ── Calendarul lunii ─────────────────────────────────────────────────────────

describe("calendarul lunii", () => {
  it.each([
    [2026, 2, "2026-02-01", "2026-02-28"],
    [2024, 2, "2024-02-01", "2024-02-29"],
    [2026, 4, "2026-04-01", "2026-04-30"],
    [2026, 12, "2026-12-01", "2026-12-31"],
  ])("marginileLunii(%i, %i) ⇒ %s … %s", (an, luna, prima, ultima) => {
    expect(marginileLunii(an, luna)).toEqual({ prima, ultima });
  });

  it("zileLucratoareLuna scade sărbătorile și zilele libere, adună zilele de recuperare", async () => {
    // Mai 2026: 21 de zile de luni–vineri. 1 Mai (vineri) e sărbătoare, 4 mai
    // (luni) e liberă la firmă, iar sâmbăta de 9 mai se recuperează.
    server.raspunde("public_holidays", "select", { data: [{ data: "2026-05-01" }] });
    server.raspunde("organization_holidays", "select", {
      data: [
        { data: "2026-05-04", tip: "liber_suplimentar" },
        { data: "2026-05-09", tip: "zi_recuperare" },
      ],
    });

    expect(await zileLucratoareLuna(ORG_ID, 2026, 5)).toBe(20);
    const [org] = server.apeluriPe("organization_holidays");
    expect(areFiltru(org, "eq", "organization_id", ORG_ID)).toBe(true);
  });
});

// ── Angajați ─────────────────────────────────────────────────────────────────

const contract = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  este_act_aditional: false,
  parent_contract_id: null,
  status: "activ",
  valabil_de_la: "2025-01-01",
  valabil_pana: null,
  data_contract: "2024-12-20",
  salariu_baza: 4000,
  norma_ore_zi: 8,
  norma_ore_saptamana: 40,
  ...extra,
});

describe("angajații de calculat", () => {
  it("contractul efectiv al lunii vine din lanț, cu actul adițional și semnalul de schimbare", async () => {
    server.raspunde("employees", "select", {
      data: [
        {
          id: ID_1,
          full_name: "Ana Dan",
          marca: "1",
          nr_persoane_intretinere: 2,
          contracts: [
            contract("baza"),
            contract("act", {
              este_act_aditional: true,
              parent_contract_id: "baza",
              valabil_de_la: "2026-03-15",
              data_contract: "2026-03-10",
              salariu_baza: 4500,
            }),
          ],
        },
        {
          id: ID_2,
          full_name: "Fără Contract",
          marca: "2",
          nr_persoane_intretinere: 0,
          contracts: [],
        },
        {
          id: ID_3,
          full_name: "Încetat",
          marca: "3",
          nr_persoane_intretinere: 0,
          contracts: [contract("vechi", { status: "incetat" })],
        },
      ],
    });

    const r = await angajatiActiviCuContract(ORG_ID, 2026, 3);

    expect(r.trunchiat).toBe(false);
    expect(r.angajati).toEqual([
      {
        employee_id: ID_1,
        contract_id: "act",
        contract_de_baza_id: "baza",
        full_name: "Ana Dan",
        marca: "1",
        salariu_baza: 4500,
        norma_ore_zi: 8,
        norma_ore_saptamana: 40,
        nr_persoane_intretinere: 2,
        contract_schimbat_in_luna: true,
      },
    ]);
    // Cei fără contract nu se sar tăcut: se întorc nominal.
    expect(r.faraContract.map((a) => a.employee_id)).toEqual([ID_2, ID_3]);
    const [apel] = server.apeluriPe("employees");
    expect(esteViuInOrg("employees")).toBe(true);
    expect(areFiltru(apel, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(apel, "order", "id", { ascending: true })).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [500] });
  });

  /** O pagină de angajați activi cu contract valid în martie 2026, id-uri crescătoare. */
  const paginaAngajati = (prefix: string, cati: number) =>
    Array.from({ length: cati }, (_, i) => ({
      id: `${prefix}-${String(i).padStart(3, "0")}`,
      full_name: `Angajat ${prefix}${String(i)}`,
      marca: `${prefix}${String(i)}`,
      nr_persoane_intretinere: 0,
      contracts: [contract(`c-${prefix}-${String(i)}`)],
    }));

  it("angajatiActiviCuContract: pagina plină cere pagina următoare după ultimul `id`; cea scurtă încheie", async () => {
    server.raspunde("employees", "select", { data: paginaAngajati("a", 500) });
    server.raspunde("employees", "select", { data: paginaAngajati("b", 1) });

    const r = await angajatiActiviCuContract(ORG_ID, 2026, 3);

    expect(r.trunchiat).toBe(false);
    expect(r.angajati).toHaveLength(501);
    expect(r.faraContract).toEqual([]);
    expect(r.angajati[500]?.employee_id).toBe("b-000");
    const apeluri = server.apeluriPe("employees");
    expect(apeluri).toHaveLength(2);
    expect(areFiltru(apeluri[0], "gt", "id")).toBe(false);
    expect(areFiltru(apeluri[1], "gt", "id", "a-499")).toBe(true);
    // Fiecare pagină păstrează filtrele, nu doar prima.
    expect(esteViuInOrg("employees", 1)).toBe(true);
    expect(areFiltru(apeluri[1], "eq", "status", "activ")).toBe(true);
    expect(areFiltru(apeluri[1], "order", "id", { ascending: true })).toBe(true);
  });

  it("angajatiActiviCuContract: plafonul de 100 de pagini pline ⇒ `trunchiat` — poarta statului incomplet", async () => {
    for (let p = 0; p < 100; p += 1) {
      server.raspunde("employees", "select", {
        data: Array.from({ length: 500 }, (_, i) => ({
          id: `p${String(p).padStart(3, "0")}-${String(i).padStart(3, "0")}`,
          full_name: "X",
          marca: "1",
          nr_persoane_intretinere: 0,
          contracts: [],
        })),
      });
    }

    const r = await angajatiActiviCuContract(ORG_ID, 2026, 3);

    expect(r.trunchiat).toBe(true);
    expect(r.faraContract).toHaveLength(50_000);
    expect(server.apeluriPe("employees")).toHaveLength(100);
    expect(server.neconsumate()).toEqual([]);
  });

  it("totiAngajatiiDeAles: și inactivii, ordonați alfabetic, cu marca drept rezervă", async () => {
    server.raspunde("employees", "select", {
      data: [
        { id: "a", full_name: "Zamfir", marca: "1", status: "activ" },
        { id: "b", full_name: "", marca: "Bravo", status: "inactiv" },
        { id: "c", full_name: "Ălina", marca: "3", status: "activ" },
      ],
    });

    const r = await totiAngajatiiDeAles(ORG_ID);

    expect(r.angajati.map((a) => a.employee_id)).toEqual(["c", "b", "a"]);
    expect(r.angajati[1]).toEqual({
      employee_id: "b",
      full_name: "",
      marca: "Bravo",
      status: "inactiv",
    });
    expect(esteViuInOrg("employees")).toBe(true);
    expect(areFiltru(server.apeluriPe("employees")[0], "eq", "status")).toBe(false);
  });
});

// ── Popriri și istoric ───────────────────────────────────────────────────────

describe("popriri și istoric introdus manual", () => {
  it("popririActive: dosarele active ale lunii, pe angajat; soldul lipsă e zero", async () => {
    server.raspunde("payroll_garnishments", "select", {
      data: [
        {
          id: "g1",
          employee_id: "a",
          suma_lunara: 500,
          sold_ramas: null,
          tip_creanta: "intretinere",
          prioritate: 1,
          dosar: "1/2026",
        },
        {
          id: "g2",
          employee_id: "a",
          suma_lunara: 300,
          sold_ramas: 900,
          tip_creanta: "alta",
          prioritate: 2,
          dosar: "2/2026",
        },
      ],
    });

    const r = await popririActive(ORG_ID, 2026, 3);

    expect(r.get("a")).toEqual([
      {
        id: "g1",
        sumaLunara: 500,
        soldRamas: 0,
        esteIntretinere: true,
        prioritate: 1,
        dosar: "1/2026",
      },
      {
        id: "g2",
        sumaLunara: 300,
        soldRamas: 900,
        esteIntretinere: false,
        prioritate: 2,
        dosar: "2/2026",
      },
    ]);
    const [apel] = server.apeluriPe("payroll_garnishments");
    expect(esteViuInOrg("payroll_garnishments")).toBe(true);
    expect(areFiltru(apel, "eq", "activa", true)).toBe(true);
    expect(areFiltru(apel, "lte", "data_inceput", "2026-03-31")).toBe(true);
    expect(apel?.filtre).toContainEqual({
      metoda: "or",
      argumente: ["data_sfarsit.is.null,data_sfarsit.gte.2026-03-01"],
    });
  });

  it("dosarePopriri: și dosarele stinse, activele primele", async () => {
    server.raspunde("payroll_garnishments", "select", { data: null });
    expect(await dosarePopriri(ORG_ID)).toEqual([]);
    const [apel] = server.apeluriPe("payroll_garnishments");
    expect(esteViuInOrg("payroll_garnishments")).toBe(true);
    expect(areFiltru(apel, "eq", "activa")).toBe(false);
    expect(areFiltru(apel, "order", "activa", { ascending: false })).toBe(true);
  });

  it("listeazaIstoricVenit: numele și marca vin din angajat, gol când embed-ul lipsește", async () => {
    server.raspunde("payroll_prior_income", "select", {
      data: [
        {
          id: "i1",
          employee_id: "a",
          an: 2025,
          luna: 12,
          angajat: { full_name: "Ana", marca: "1" },
        },
        { id: "i2", employee_id: "b", an: 2025, luna: 11, angajat: null },
      ],
    });

    const r = await listeazaIstoricVenit(ORG_ID);

    expect(r).toEqual([
      { id: "i1", employee_id: "a", an: 2025, luna: 12, nume: "Ana", marca: "1" },
      { id: "i2", employee_id: "b", an: 2025, luna: 11, nume: "", marca: "" },
    ]);
    expect(esteViuInOrg("payroll_prior_income")).toBe(true);
    expect(server.apeluriPe("payroll_prior_income")[0]?.filtre).toContainEqual({
      metoda: "limit",
      argumente: [500],
    });
  });
});
