// src/lib/queries/fleet-rapoarte.test.ts
//
// Citirile rapoartelor flotei (F8), pe clientul fals: firma explicită, doar foile
// APROBATE, luna pe coloana ei de dată, paginarea keyset care nu taie tăcut și
// compunerea raportului. NU prind o politică RLS greșită — aceea e pe
// `tests/rls/proba-flota-rapoarte.sql`.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";

import {
  COLOANE_FOAIE_DETALIATA,
  COLOANE_FOAIE_RAPORT,
  foiAprobateDetaliate,
  foiAprobateLuna,
  foiNeaprobateLuna,
  incarcaPachetLunar,
  incarcaRaportLunar,
  numarFoiAprobateLuna,
  PLAFON_FOI_PACHET,
  surseDeCostLuna,
} from "./fleet-rapoarte";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const INTERVAL = { deLa: "2026-09-01", panaLa: "2026-09-30" } as const;
const SOFER = "88888888-8888-4888-8888-888888888888";

const foaie = (id: string, m: Record<string, unknown> = {}) => ({
  id,
  vehicle_id: ID_1,
  employee_id: SOFER,
  numar: "FP-2026-0001",
  data: "2026-09-02",
  km_parcursi: 100,
  vehicul_nr: "B100ABC",
  vehicul_combustibil: "motorina",
  norma_l_100km: 7,
  alimentari: [{ litri: 8, cost: 56 }],
  ...m,
});

describe("foiAprobateLuna", () => {
  it("firma, doar foile aprobate și vii, luna pe coloana `data`, alimentările șterse excluse", async () => {
    db.raspunde("trip_sheets", "select", { data: [foaie(ID_1)] });
    const foi = await foiAprobateLuna(ORG_ID, INTERVAL, null);

    expect(foi).toHaveLength(1);
    const apel = db.apeluriPe("trip_sheets")[0];
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "aprobat")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "alimentari.deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "gte", "data", "2026-09-01")).toBe(true);
    expect(areFiltru(apel, "lte", "data", "2026-09-30")).toBe(true);
    // Fără vehicul ales, nicio restrângere pe vehicul.
    expect(areFiltru(apel, "eq", "vehicle_id")).toBe(false);
  });

  it("cu vehicul ales, foile lui și numai ale lui", async () => {
    db.raspunde("trip_sheets", "select", { data: [] });
    await foiAprobateLuna(ORG_ID, INTERVAL, ID_2);
    expect(areFiltru(db.apeluriPe("trip_sheets")[0], "eq", "vehicle_id", ID_2)).toBe(true);
  });

  it("peste 1000 de foi nu se taie tăcut: a doua pagină pornește de la ultimul id", async () => {
    const plina = Array.from({ length: 1000 }, (_, i) =>
      foaie(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`),
    );
    db.raspunde("trip_sheets", "select", { data: plina });
    db.raspunde("trip_sheets", "select", { data: [foaie("ffffffff-ffff-4fff-8fff-ffffffffffff")] });

    const foi = await foiAprobateLuna(ORG_ID, INTERVAL, null);
    expect(foi).toHaveLength(1001);
    const [prima, a_doua] = db.apeluriPe("trip_sheets");
    expect(areFiltru(prima, "gt", "id")).toBe(false);
    expect(areFiltru(a_doua, "gt", "id", "00000000-0000-4000-8000-000000000999")).toBe(true);
  });

  it("o eroare a bazei se aruncă, nu devine o listă goală", async () => {
    db.raspunde("trip_sheets", "select", { error: { code: "42501", message: "refuz" } });
    await expect(foiAprobateLuna(ORG_ID, INTERVAL, null)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("foiAprobateDetaliate", () => {
  it("aduce curse și alimentări în același răspuns, fără rânduri șterse", async () => {
    db.raspunde("trip_sheets", "select", {
      data: [
        {
          ...foaie(ID_1),
          km_plecare: 1000,
          km_sosire: 1100,
          observatii: null,
          trimis_la: "2026-09-02T15:00:00Z",
          aprobat_de: SOFER,
          aprobat_la: "2026-09-03T08:00:00Z",
          vehicul_categorie: "autoturism",
          curse: [],
          alimentari: [],
        },
      ],
    });
    const foi = await foiAprobateDetaliate(ORG_ID, INTERVAL, null);
    expect(foi).toHaveLength(1);
    const apel = db.apeluriPe("trip_sheets")[0];
    expect(apel?.coloane).toContain("curse:trip_sheet_curse!trip_sheet_id");
    expect(apel?.coloane).toContain("alimentari:fuel_entries!trip_sheet_id");
    expect(areFiltru(apel, "is", "curse.deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "alimentari.deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "aprobat")).toBe(true);
  });

});

describe("numarFoiAprobateLuna", () => {
  it("numără, fără să aducă rândurile: pachetul se refuză înainte să genereze un PDF", async () => {
    db.raspunde("trip_sheets", "select", { data: null, count: 412 });
    expect(await numarFoiAprobateLuna(ORG_ID, INTERVAL, ID_2)).toBe(412);
    const apel = db.apeluriPe("trip_sheets")[0];
    expect(apel?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "aprobat")).toBe(true);
    expect(areFiltru(apel, "eq", "vehicle_id", ID_2)).toBe(true);
    expect(areFiltru(apel, "gte", "data", "2026-09-01")).toBe(true);
    expect(areFiltru(apel, "lte", "data", "2026-09-30")).toBe(true);
  });

  it("fără număr întors de bază, 0 — nu o eroare și nu NaN", async () => {
    db.raspunde("trip_sheets", "select", { data: null, count: null });
    expect(await numarFoiAprobateLuna(ORG_ID, INTERVAL, null)).toBe(0);
  });

  it("plafonul pachetului e un număr, nu o presupunere", () => {
    expect(PLAFON_FOI_PACHET).toBeGreaterThanOrEqual(100);
    expect(PLAFON_FOI_PACHET).toBeLessThanOrEqual(1000);
  });
});

describe("foiNeaprobateLuna", () => {
  it("numără ciornele, cele trimise și cele respinse; aprobatele nu intră", async () => {
    db.raspunde("trip_sheets", "select", {
      data: [
        { id: ID_1, status: "draft" },
        { id: ID_2, status: "trimis" },
        { id: "77777777-7777-4777-8777-777777777777", status: "trimis" },
        { id: "88888888-8888-4888-8888-888888888880", status: "respins" },
      ],
    });
    const r = await foiNeaprobateLuna(ORG_ID, INTERVAL, null);
    expect(r).toEqual({ ciorne: 1, trimise: 2, respinse: 1 });
    const apel = db.apeluriPe("trip_sheets")[0];
    expect(areFiltru(apel, "in", "status", ["draft", "trimis", "respins"])).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "gte", "data", "2026-09-01")).toBe(true);
  });
});

describe("surseDeCostLuna", () => {
  it("fiecare sursă are firma, rândurile vii, luna pe coloana ei de dată și vehiculul când e ales", async () => {
    db.raspunde("vehicle_service_entries", "select", {
      data: [{ id: ID_1, vehicle_id: ID_1, cost_total: 750 }],
    });
    db.raspunde("vehicle_expenses", "select", {
      data: [{ id: ID_1, vehicle_id: ID_1, suma: 15 }],
    });
    db.raspunde("vehicle_documents", "select", {
      data: [{ id: ID_1, vehicle_id: ID_1, cost: 1800 }],
    });

    const surse = await surseDeCostLuna(ORG_ID, INTERVAL, ID_1);
    expect(surse.servicii).toEqual([{ id: ID_1, vehicle_id: ID_1, cost_total: 750 }]);
    expect(surse.cheltuieli).toHaveLength(1);
    expect(surse.documente).toHaveLength(1);

    const surseSiColoane: readonly (readonly [string, string])[] = [
      ["vehicle_service_entries", "data_interventiei"],
      ["vehicle_expenses", "data_cheltuielii"],
      ["vehicle_documents", "valabil_de_la"],
    ];
    for (const [tabela, data] of surseSiColoane) {
      const apel = db.apeluriPe(tabela)[0];
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID), `${tabela}: firma`).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null), `${tabela}: vii`).toBe(true);
      expect(areFiltru(apel, "gte", data, "2026-09-01"), `${tabela}: de la`).toBe(true);
      expect(areFiltru(apel, "lte", data, "2026-09-30"), `${tabela}: până la`).toBe(true);
      expect(areFiltru(apel, "eq", "vehicle_id", ID_1), `${tabela}: vehicul`).toBe(true);
    }
    // Documentele fără cost nu intră în adunare.
    expect(areFiltru(db.apeluriPe("vehicle_documents")[0], "not", "cost")).toBe(true);
  });
});

describe("incarcaRaportLunar", () => {
  function programeaza(): void {
    db.raspunde("trip_sheets", "select", {
      data: [
        foaie(ID_1, { km_parcursi: 400, alimentari: [{ litri: 30, cost: 220 }] }),
        foaie(ID_2, {
          numar: "FP-2026-0002",
          data: "2026-09-03",
          employee_id: null,
          km_parcursi: 600,
          alimentari: [{ litri: 60, cost: 440.4 }],
        }),
      ],
    });
    // Neaprobatele, a doua citire din `trip_sheets`.
    db.raspunde("trip_sheets", "select", { data: [{ id: ID_3, status: "trimis" }] });
    db.raspunde("vehicle_service_entries", "select", {
      data: [{ id: ID_1, vehicle_id: ID_1, cost_total: 750 }],
    });
    db.raspunde("vehicle_expenses", "select", { data: [] });
    db.raspunde("vehicle_documents", "select", { data: [] });
    db.raspunde("vehicles", "select", {
      data: [{ id: ID_1, nr_inmatriculare: "B100ABC" }],
    });
    db.raspunde("employees", "select", {
      data: [{ id: SOFER, full_name: "Popescu Ion", marca: "M1", deleted_at: null }],
    });
  }
  const ID_3 = "99999999-9999-4999-8999-999999999999";

  it("compune consumul, kilometrii pe șofer, costul și registrul lunii", async () => {
    programeaza();
    const r = await incarcaRaportLunar(ORG_ID, "2026-09", null);

    expect(r.luna).toBe("2026-09");
    expect(r.interval).toEqual(INTERVAL);
    expect(r.totaluri).toEqual({ foi: 2, km: 1000, litri: 90, costCombustibil: 660.4 });
    expect(r.foiNeaprobate).toEqual({ ciorne: 0, trimise: 1, respinse: 0 });

    expect(r.consum).toHaveLength(1);
    expect(r.consum[0]).toMatchObject({ vehicul: "B100ABC", km: 1000, litri: 90, normaMedie: 7 });
    expect(r.consum[0]?.consumReal).toBeCloseTo(9, 5);

    expect(r.soferi.map((s) => [s.sofer, s.km])).toEqual([
      ["Fără șofer", 600],
      ["Popescu Ion", 400],
    ]);

    expect(r.costuri).toHaveLength(1);
    expect(r.costuri[0]).toMatchObject({ vehicul: "B100ABC", service: 750, total: 1410.4 });
    expect(r.totalCost).toMatchObject({ total: 1410.4, km: 1000 });

    expect(r.registru.map((x) => x.numar)).toEqual(["FP-2026-0001", "FP-2026-0002"]);
    expect(r.registru[0]?.sofer).toBe("Popescu Ion");
  });

  it("etichetele se citesc cu firma explicită, doar pentru id-urile din lună", async () => {
    programeaza();
    await incarcaRaportLunar(ORG_ID, "2026-09", null);

    const vehicule = db.apeluriPe("vehicles")[0];
    expect(areFiltru(vehicule, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(vehicule, "in", "id", [ID_1])).toBe(true);
    const angajati = db.apeluriPe("employees")[0];
    expect(areFiltru(angajati, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(angajati, "in", "id", [SOFER])).toBe(true);
  });

  it("o lună fără nicio foaie dă un raport gol, nu o eroare și nu cifre inventate", async () => {
    db.raspunde("trip_sheets", "select", { data: [] });
    db.raspunde("trip_sheets", "select", { data: [] });
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    db.raspunde("vehicle_expenses", "select", { data: [] });
    db.raspunde("vehicle_documents", "select", { data: [] });
    const r = await incarcaRaportLunar(ORG_ID, "2026-09", null);
    expect(r.totaluri).toEqual({ foi: 0, km: 0, litri: 0, costCombustibil: 0 });
    expect(r.consum).toEqual([]);
    expect(r.costuri).toEqual([]);
    expect(r.totalCost.costPeKm).toBeNull();
    // Fără id-uri de căutat, nicio interogare de etichete.
    expect(db.apeluriPe("vehicles")).toHaveLength(0);
    expect(db.apeluriPe("employees")).toHaveLength(0);
  });

  it("foile deja citite (pachetul) nu se mai citesc a doua oară, iar raportul le folosește pe ele", async () => {
    db.raspunde("trip_sheets", "select", { data: [{ id: ID_3, status: "draft" }] });
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    db.raspunde("vehicle_expenses", "select", { data: [] });
    db.raspunde("vehicle_documents", "select", { data: [] });
    db.raspunde("vehicles", "select", { data: [{ id: ID_1, nr_inmatriculare: "B100ABC" }] });
    db.raspunde("employees", "select", {
      data: [{ id: SOFER, full_name: "Popescu Ion", marca: "M1", deleted_at: null }],
    });
    const r = await incarcaRaportLunar(ORG_ID, "2026-09", null, [foaie(ID_1)]);
    expect(r.totaluri.foi).toBe(1);
    // Doar citirea neaprobatelor a atins `trip_sheets`.
    expect(db.apeluriPe("trip_sheets")).toHaveLength(1);
  });

  it("etichetele peste 100 de id-uri se cer în felii, ca adresa să nu crească fără limită", async () => {
    const multe = Array.from({ length: 150 }, (_, i) =>
      foaie(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, {
        vehicle_id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      }),
    );
    db.raspunde("trip_sheets", "select", { data: [] });
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    db.raspunde("vehicle_expenses", "select", { data: [] });
    db.raspunde("vehicle_documents", "select", { data: [] });
    db.raspunde("vehicles", "select", { data: [] });
    db.raspunde("vehicles", "select", { data: [] });
    db.raspunde("employees", "select", { data: [] });
    await incarcaRaportLunar(ORG_ID, "2026-09", null, multe);
    expect(db.apeluriPe("vehicles")).toHaveLength(2);
    const feliiIn = db
      .apeluriPe("vehicles")
      .map((a) => (a.filtre.find((f) => f.metoda === "in")?.argumente[1] as string[]).length);
    expect(feliiIn.sort((a, b) => b - a)).toEqual([100, 50]);
  });
});

describe("incarcaPachetLunar", () => {
  const APROBATOR = "99999999-9999-4999-8999-999999999990";

  it("foile întregi, raportul pe ele și numele de care au nevoie PDF-urile", async () => {
    const detaliata = {
      ...foaie(ID_1),
      km_plecare: 1000,
      km_sosire: 1100,
      observatii: null,
      trimis_la: "2026-09-02T15:00:00Z",
      aprobat_de: APROBATOR,
      aprobat_la: "2026-09-03T08:00:00Z",
      vehicul_categorie: "autoturism",
      curse: [],
    };
    db.raspunde("trip_sheets", "select", { data: [detaliata] });
    db.raspunde("trip_sheets", "select", { data: [] });
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    db.raspunde("vehicle_expenses", "select", { data: [] });
    db.raspunde("vehicle_documents", "select", { data: [] });
    // Etichetele raportului și datele PDF-urilor sunt două citiri ale acelorași tabele.
    const vehicul = {
      id: ID_1,
      nr_inmatriculare: "B100ABC",
      categorie: "autoturism",
      tip_combustibil: "motorina",
      consum_mediu_declarat: 7,
    };
    db.raspunde("vehicles", "select", { data: [vehicul] });
    db.raspunde("vehicles", "select", { data: [vehicul] });
    const angajat = { id: SOFER, full_name: "Popescu Ion", marca: "M1", deleted_at: null };
    db.raspunde("employees", "select", { data: [angajat] });
    db.raspunde("employees", "select", { data: [angajat] });
    db.raspunde("profiles", "select", { data: { full_name: "Ionescu Maria", email: "m@x.ro" } });

    const p = await incarcaPachetLunar(ORG_ID, "2026-09", null);

    expect(p.foi).toHaveLength(1);
    // Raportul se calculează pe EXACT foile din pachet: o a doua citire a foilor n-are loc.
    expect(db.apeluriPe("trip_sheets").filter((a) => a.coloane?.includes("curse:"))).toHaveLength(1);
    expect(p.raport.totaluri.foi).toBe(1);
    expect(p.vehicule.get(ID_1)?.nr_inmatriculare).toBe("B100ABC");
    expect(p.soferi.get(SOFER)).toBe("Popescu Ion");
    expect(p.aprobatori.get(APROBATOR)).toBe("Ionescu Maria");
    const profil = db.apeluriPe("profiles")[0];
    expect(areFiltru(profil, "eq", "id", APROBATOR)).toBe(true);
  });

  it("fără foi nu se cer nume: nicio interogare de profiluri", async () => {
    db.raspunde("trip_sheets", "select", { data: [] });
    db.raspunde("trip_sheets", "select", { data: [] });
    db.raspunde("vehicle_service_entries", "select", { data: [] });
    db.raspunde("vehicle_expenses", "select", { data: [] });
    db.raspunde("vehicle_documents", "select", { data: [] });
    const p = await incarcaPachetLunar(ORG_ID, "2026-09", null);
    expect(p.foi).toEqual([]);
    expect(db.apeluriPe("profiles")).toHaveLength(0);
  });
});

/**
 * `coloane.test.ts` verifică doar `.select("literal")`; aici selecturile stau în
 * constante, deci le lipesc EU de `database.ts`. O coloană inventată n-ar face
 * nicio eroare de compilare (genericul explicit înlocuiește tipul generat) și
 * n-ar fi prinsă de clientul fals: ar da 42703 abia în producție.
 */
describe("coloanele cerute există în schema generată", () => {
  const tipuri = readFileSync(join(process.cwd(), "src/types/database.ts"), "utf8").split("\n");

  function coloaneTabela(tabela: string): ReadonlySet<string> {
    const start = tipuri.findIndex(
      (linie, i) => linie === `      ${tabela}: {` && tipuri[i + 1] === "        Row: {",
    );
    expect(start, `tabela ${tabela} în database.ts`).toBeGreaterThanOrEqual(0);
    const coloane = new Set<string>();
    for (let j = start + 2; j < tipuri.length && tipuri[j] !== "        }"; j += 1) {
      const c = /^ {10}(\w+)\??:/u.exec(tipuri[j] ?? "");
      if (c?.[1] !== undefined) coloane.add(c[1]);
    }
    return coloane;
  }

  /** Împarte la virgulele de nivel zero: virgulele din `(...)` aparțin embed-ului. */
  function parti(select: string): string[] {
    const rezultat: string[] = [];
    let adancime = 0;
    let curent = "";
    for (const ch of select) {
      if (ch === "(") adancime += 1;
      if (ch === ")") adancime -= 1;
      if (ch === "," && adancime === 0) {
        rezultat.push(curent.trim());
        curent = "";
      } else curent += ch;
    }
    if (curent.trim() !== "") rezultat.push(curent.trim());
    return rezultat;
  }

  function verifica(tabela: string, select: string): void {
    const proprii = coloaneTabela(tabela);
    for (const parte of parti(select)) {
      const embed = /^\w+:(\w+)!\w+\((.*)\)$/u.exec(parte);
      if (embed !== null) {
        const copil = coloaneTabela(embed[1] ?? "");
        for (const c of parti(embed[2] ?? "")) {
          expect(copil.has(c), `${embed[1] ?? ""}.${c}`).toBe(true);
        }
      } else {
        expect(proprii.has(parte), `${tabela}.${parte}`).toBe(true);
      }
    }
  }

  it("foaia de raport", () => {
    verifica("trip_sheets", COLOANE_FOAIE_RAPORT);
  });

  it("foaia detaliată, cu curse și alimentări", () => {
    verifica("trip_sheets", COLOANE_FOAIE_DETALIATA);
  });

  it("sonda de control: o coloană inventată ar fi prinsă", () => {
    expect(() => verifica("trip_sheets", "id, coloana_inventata")).toThrow();
  });
});
