// src/lib/queries/per-diem.test.ts
//
// Citirile modulului de diurnă: filtrul de organizație, ștergerea logică,
// paginarea keyset cu numărătoarea separată, nomenclatoarele globale (fără
// organizație) și adaptorul spre motorul pur de calcul. Clientul vine din
// `createServerSupabase()`, înlocuit cu falsul strict din `@/lib/teste/actiune`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import {
  areFiltru,
  eroarePostgrest,
  type ApelFals,
  type ClientFals,
} from "@/lib/teste/supabase-fals";
import type { FiltreDeplasari } from "@/schemas/per-diem";
import { codificaCursor, decodificaCursor } from "./cursor";
import {
  angajatiDupaId,
  baremeleTarilor,
  baremTara,
  calculeazaDiurnaDeplasare,
  calculeSalvate,
  cheltuielile,
  citesteDeplasare,
  deplasarileMele,
  etapele,
  listeazaDeplasari,
  politicaLaData,
  politiciOrganizatie,
  puncteDinDeplasare,
  tari,
  valoriLegaleDiurna,
  type PoliticaRand,
} from "./per-diem";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const areLimita = (apel: ApelFals | undefined, n: number) =>
  apel?.filtre.some((f) => f.metoda === "limit" && f.argumente[0] === n) ?? false;

/** Predicatul keyset, dacă lista l-a primit (`.or(...)`); altfel `undefined`. */
const predicatOr = (apel: ApelFals | undefined): string | undefined => {
  const f = apel?.filtre.find((x) => x.metoda === "or");
  return f === undefined ? undefined : String(f.argumente[0]);
};

const filtre = (modificari: Partial<FiltreDeplasari> = {}): FiltreDeplasari => ({
  status: null,
  angajat: null,
  cursor: null,
  limita: 2,
  ...modificari,
});

const deplasare = (id: string, plecare: string, scop = "Audit") => ({
  id,
  employee_id: ID_3,
  numar_document: null,
  scop,
  country_id: null,
  localitate: null,
  plecare_la: plecare,
  sosire_la: plecare,
  plecare_efectiva_la: null,
  sosire_efectiva_la: null,
  mijloc_transport: "tren",
  vehicle_id: null,
  km_parcursi: null,
  avans_acordat: 0,
  moneda_avans: null,
  curs_diurna: null,
  status: "ciorna",
  detasare_transnationala: false,
});

describe("deplasarileMele", () => {
  it("filtrează explicit pe fișa angajatului, nu doar pe RLS", async () => {
    db.raspunde("business_trips", "select", { data: [deplasare(ID_1, "2026-09-01T05:00:00Z")] });

    const r = await deplasarileMele(ORG_ID, ID_3);

    expect(r).toHaveLength(1);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", ID_3)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "plecare_la", { ascending: false })).toBe(true);
    expect(areLimita(apel, 50)).toBe(true);
  });

  it("limita se poate cere; zero rânduri ⇒ listă goală; eroarea se propagă", async () => {
    db.raspunde("business_trips", "select", { data: null });
    expect(await deplasarileMele(ORG_ID, ID_3, 5)).toEqual([]);
    expect(areLimita(db.apeluri[0], 5)).toBe(true);

    const eroare = eroarePostgrest("42501");
    db.raspunde("business_trips", "select", { error: eroare });
    await expect(deplasarileMele(ORG_ID, ID_3)).rejects.toBe(eroare);
  });
});

describe("listeazaDeplasari", () => {
  const [lista, numarare] = [0, 1];

  it("prima pagină: limita+1 rânduri ⇒ cursor spre următoarea, totalul din numărătoarea separată", async () => {
    db.raspunde("business_trips", "select", {
      data: [
        deplasare(ID_1, "2026-09-03T05:00:00Z"),
        deplasare(ID_2, "2026-09-02T05:00:00Z"),
        deplasare(ID_3, "2026-09-01T05:00:00Z"),
      ],
    });
    db.raspunde("business_trips", "select", { count: 7 });

    const r = await listeazaDeplasari(ORG_ID, filtre());

    expect(r.randuri.map((d) => d.id)).toEqual([ID_1, ID_2]);
    expect(r.total).toBe(7);
    expect(r.sortare).toEqual({ cheie: "plecare", directie: "desc" });
    expect(r.urmatorulCursor).not.toBeNull();
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({
      valoare: "2026-09-02T05:00:00Z",
      id: ID_2,
    });

    for (const i of [lista, numarare]) {
      expect(areFiltru(db.apeluri[i], "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(db.apeluri[i], "is", "deleted_at", null)).toBe(true);
    }
    expect(areLimita(db.apeluri[lista], 3)).toBe(true);
    expect(areFiltru(db.apeluri[lista], "order", "id", { ascending: false })).toBe(true);
    expect(db.apeluri[numarare]?.optiuni).toEqual({ count: "exact", head: true });
  });

  it("cursorul se aplică DOAR listei, nu și numărătorii; statusul pe amândouă", async () => {
    db.raspunde("business_trips", "select", { data: [deplasare(ID_3, "2026-08-01T05:00:00Z")] });
    db.raspunde("business_trips", "select", { count: 5 });
    const cursor = codificaCursor({ valoare: "2026-09-02T05:00:00Z", id: ID_2 });

    const r = await listeazaDeplasari(ORG_ID, filtre({ cursor, status: "aprobata" }));

    expect(r.urmatorulCursor).toBeNull();
    expect(r.total).toBe(5);
    expect(predicatOr(db.apeluri[lista])).toBe(
      `plecare_la.lt."2026-09-02T05:00:00Z",and(plecare_la.eq."2026-09-02T05:00:00Z",id.lt."${ID_2}")`,
    );
    expect(predicatOr(db.apeluri[numarare])).toBeUndefined();
    expect(areFiltru(db.apeluri[lista], "eq", "status", "aprobata")).toBe(true);
    expect(areFiltru(db.apeluri[numarare], "eq", "status", "aprobata")).toBe(true);
  });

  it("un cursor stricat înseamnă prima pagină, nu eroare", async () => {
    db.raspunde("business_trips", "select", { data: [] });
    db.raspunde("business_trips", "select", { count: 0 });
    const r = await listeazaDeplasari(ORG_ID, filtre({ cursor: "%%%" }));
    expect(r.randuri).toEqual([]);
    expect(predicatOr(db.apeluri[lista])).toBeUndefined();
  });

  it("sortarea după scop: cursorul poartă scopul, ordinea e crescătoare", async () => {
    db.raspunde("business_trips", "select", {
      data: [
        deplasare(ID_1, "2026-09-03T05:00:00Z", "A"),
        deplasare(ID_2, "2026-09-02T05:00:00Z", "B"),
        deplasare(ID_3, "2026-09-01T05:00:00Z", "C"),
      ],
    });
    db.raspunde("business_trips", "select", { count: 3 });

    const r = await listeazaDeplasari(ORG_ID, filtre({ sort: "scop" }));

    expect(r.sortare).toEqual({ cheie: "scop", directie: "asc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "B", id: ID_2 });
    expect(
      areFiltru(db.apeluri[lista], "order", "scop", { ascending: true, nullsFirst: false }),
    ).toBe(true);
  });

  it("o coloană de sortare nepermisă cade pe implicit", async () => {
    db.raspunde("business_trips", "select", { data: [] });
    db.raspunde("business_trips", "select", { count: null });
    const r = await listeazaDeplasari(ORG_ID, filtre({ sort: "-employee_id" }));
    expect(r.sortare).toEqual({ cheie: "plecare", directie: "desc" });
    // Fără numărătoare, totalul cade pe rândurile primite.
    expect(r.total).toBe(0);
  });

  it("eroarea numărătorii se propagă", async () => {
    db.raspunde("business_trips", "select", { data: [] });
    const eroare = eroarePostgrest("57014");
    db.raspunde("business_trips", "select", { error: eroare });
    await expect(listeazaDeplasari(ORG_ID, filtre())).rejects.toBe(eroare);
  });
});

describe("citesteDeplasare", () => {
  it("pe id + organizație, nestearsă; absentă ⇒ null", async () => {
    db.raspunde("business_trips", "select", { data: null });
    expect(await citesteDeplasare(ORG_ID, ID_1)).toBeNull();
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.coloane).toContain("observatii");
    expect(apel?.terminal).toBe("maybeSingle");
  });
});

describe("nomenclatoarele globale", () => {
  it("țările: fără filtru de organizație, doar cele vii, după denumire", async () => {
    db.raspunde("countries", "select", { data: [{ id: ID_1, denumire: "România" }] });
    expect(await tari()).toHaveLength(1);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id")).toBe(false);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "denumire")).toBe(true);
  });

  it("valorile legale: fără organizație, cele mai noi primele", async () => {
    db.raspunde("per_diem_valori_legale", "select", { data: null });
    expect(await valoriLegaleDiurna()).toEqual([]);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id")).toBe(false);
    expect(areFiltru(apel, "order", "valabil_de_la", { ascending: false })).toBe(true);
  });

  it("baremele țărilor: id-uri deduplicate, rânduri mapate în camelCase", async () => {
    db.raspunde("per_diem_country_rates", "select", {
      data: [
        {
          country_id: ID_1,
          categorie: "II",
          valoare: 35,
          moneda: "EUR",
          valabil_de_la: "2020-01-01",
          valabil_pana: null,
        },
      ],
    });

    const r = await baremeleTarilor([ID_1, ID_1, ID_2]);

    expect(r).toEqual([
      {
        countryId: ID_1,
        categorie: "II",
        valoare: 35,
        moneda: "EUR",
        valabilDeLa: "2020-01-01",
        valabilPana: null,
      },
    ]);
    expect(areFiltru(db.apeluri[0], "in", "country_id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(db.apeluri[0], "is", "deleted_at", null)).toBe(true);
  });

  it("baremele unei liste goale nu ating baza", async () => {
    expect(await baremeleTarilor([])).toEqual([]);
    expect(db.apeluri).toHaveLength(0);
  });

  it("baremul unei țări la o dată: valabil la acea dată, cel mai recent", async () => {
    db.raspunde("per_diem_country_rates", "select", { data: { valoare: 35, moneda: "EUR" } });
    expect(await baremTara(ID_1, "II", "2026-09-10")).toEqual({ valoare: 35, moneda: "EUR" });
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "country_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "categorie", "II")).toBe(true);
    expect(areFiltru(apel, "lte", "valabil_de_la", "2026-09-10")).toBe(true);
    expect(areFiltru(apel, "or", "valabil_pana.is.null,valabil_pana.gte.2026-09-10")).toBe(true);
    expect(areFiltru(apel, "order", "valabil_de_la", { ascending: false })).toBe(true);
  });
});

describe("politica firmei", () => {
  it("politicaLaData: versiunea valabilă la data cerută, în organizație", async () => {
    db.raspunde("per_diem_policies", "select", { data: null });
    expect(await politicaLaData(ORG_ID, "2026-03-15")).toBeNull();
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "lte", "valabil_de_la", "2026-03-15")).toBe(true);
    expect(areFiltru(apel, "or", "valabil_pana.is.null,valabil_pana.gte.2026-03-15")).toBe(true);
    expect(areFiltru(apel, "order", "valabil_de_la", { ascending: false })).toBe(true);
    expect(areLimita(apel, 1)).toBe(true);
  });

  it("politiciOrganizatie: toate versiunile vii ale organizației", async () => {
    db.raspunde("per_diem_policies", "select", { data: [{ id: ID_1 }, { id: ID_2 }] });
    expect(await politiciOrganizatie(ORG_ID)).toHaveLength(2);
    expect(areFiltru(db.apeluri[0], "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(db.apeluri[0], "is", "deleted_at", null)).toBe(true);
  });
});

describe("rândurile unei deplasări", () => {
  it("calculele salvate: deduplicate și indexate după deplasare; listă goală fără bază", async () => {
    expect((await calculeSalvate([])).size).toBe(0);
    expect(db.apeluri).toHaveLength(0);

    db.raspunde("per_diem_calculations", "select", {
      data: [{ business_trip_id: ID_1, zile_total: 2 }],
    });
    const r = await calculeSalvate([ID_1, ID_1]);
    expect(r.get(ID_1)).toMatchObject({ zile_total: 2 });
    expect(areFiltru(db.apeluri[0], "in", "business_trip_id", [ID_1])).toBe(true);
  });

  it("etapele: ale deplasării, vii, în ordinea traseului", async () => {
    db.raspunde("business_trip_legs", "select", { data: [{ id: ID_2, ordine: 1 }] });
    expect(await etapele(ID_1)).toHaveLength(1);
    expect(areFiltru(db.apeluri[0], "eq", "business_trip_id", ID_1)).toBe(true);
    expect(areFiltru(db.apeluri[0], "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(db.apeluri[0], "order", "ordine")).toBe(true);
  });

  it("cheltuielile: ale deplasării, vii, în ordinea datei", async () => {
    db.raspunde("trip_expenses", "select", { data: null });
    expect(await cheltuielile(ID_1)).toEqual([]);
    expect(areFiltru(db.apeluri[0], "eq", "business_trip_id", ID_1)).toBe(true);
    expect(areFiltru(db.apeluri[0], "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(db.apeluri[0], "order", "data_cheltuielii")).toBe(true);
  });

  it("angajații: o singură citire, pe organizație, id-uri deduplicate", async () => {
    expect((await angajatiDupaId(ORG_ID, [])).size).toBe(0);
    expect(db.apeluri).toHaveLength(0);

    db.raspunde("employees", "select", { data: [{ id: ID_3, full_name: "Ana", marca: "7" }] });
    const r = await angajatiDupaId(ORG_ID, [ID_3, ID_3]);
    expect(r.get(ID_3)?.full_name).toBe("Ana");
    expect(areFiltru(db.apeluri[0], "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(db.apeluri[0], "in", "id", [ID_3])).toBe(true);
  });
});

// ── Adaptorul spre motorul pur ─────────────────────────────────────────────

const RO = "ro-id";
const HU = "hu-id";
const AT = "at-id";

const politicaRand = (modificari: Partial<PoliticaRand> = {}): PoliticaRand => ({
  id: ID_1,
  denumire: "Politica",
  country_id_intern: RO,
  moneda_interna: "RON",
  diurna_interna_zi: 50,
  diurna_baza_legala_interna: 23,
  multiplu_plafon_neimpozabil: 2.5,
  multiplu_diurna_externa: 1,
  categorie_barem: "II",
  prag_ore_minim: 12,
  prag_ore_zi_intreaga: 12,
  fractiune_zi_partiala: 1,
  acorda_diurna_ziua_trecerii: true,
  regula_tara_trecere: "tara_sosire",
  tarif_km_auto_personal: 0,
  moneda_tarif_km: "RON",
  plafon_salarii_baza_luna: 3,
  diurna_externa_zi: null,
  moneda_diurna_externa: null,
  mod_calcul_zile: "ferestre_24h",
  valabil_de_la: "2020-01-01",
  valabil_pana: null,
  ...modificari,
});

describe("puncteDinDeplasare", () => {
  const trip = {
    countryId: AT,
    plecareLa: "2026-09-10T05:00:00Z",
    sosireLa: "2026-09-12T15:00:00Z",
    plecareEfectivaLa: null,
    sosireEfectivaLa: null,
    cursDiurna: null,
  };

  it("primul reper e țara primei etape, apoi câte unul la fiecare sosire, în ordinea `ordine`", () => {
    const puncte = puncteDinDeplasare(
      trip,
      [
        { ordine: 2, fromCountryId: HU, toCountryId: AT, sosireLa: "2026-09-10T15:00:00Z" },
        { ordine: 1, fromCountryId: RO, toCountryId: HU, sosireLa: "2026-09-10T10:00:00Z" },
      ],
      RO,
    );
    expect(puncte.map((p) => [p.deLa.toISOString(), p.countryId])).toEqual([
      ["2026-09-10T05:00:00.000Z", RO],
      ["2026-09-10T10:00:00.000Z", HU],
      ["2026-09-10T15:00:00.000Z", AT],
    ]);
  });

  it.each([
    [AT, AT],
    [null, RO],
  ])("fără etape, primul reper e țara deplasării (%s), altfel țara implicită", (tara, asteptat) => {
    const puncte = puncteDinDeplasare({ ...trip, countryId: tara }, [], RO);
    expect(puncte).toEqual([{ deLa: new Date(trip.plecareLa), countryId: asteptat }]);
  });
});

describe("calculeazaDiurnaDeplasare", () => {
  const intern = {
    countryId: null,
    plecareLa: "2026-09-10T05:00:00Z",
    sosireLa: "2026-09-12T05:00:00Z",
    plecareEfectivaLa: null,
    sosireEfectivaLa: null,
    cursDiurna: null,
  };

  it("durata vine din momentele efective, când există", () => {
    const { durataOre } = calculeazaDiurnaDeplasare(
      { ...intern, sosireEfectivaLa: "2026-09-11T05:00:00Z" },
      [],
      politicaRand(),
      [],
    );
    expect(durataOre).toBe(24);
  });

  it("o sosire înaintea plecării dă durată zero, nu negativă", () => {
    const { durataOre } = calculeazaDiurnaDeplasare(
      { ...intern, sosireLa: "2026-09-09T05:00:00Z" },
      [],
      politicaRand(),
      [],
    );
    expect(durataOre).toBe(0);
  });

  it("o deplasare internă de 48 de ore: două ferestre în țara internă", () => {
    const { ferestre, durataOre } = calculeazaDiurnaDeplasare(intern, [], politicaRand(), []);
    expect(durataOre).toBe(48);
    expect(ferestre).toHaveLength(2);
    expect(ferestre.every((f) => f.taraId === RO)).toBe(true);
  });

  it("baremul extern se caută pe categoria POLITICII: un barem din altă categorie lipsește", () => {
    const extern = { ...intern, countryId: AT, cursDiurna: 5 };
    const barem = (categorie: string) => ({
      countryId: AT,
      categorie,
      valoare: 35,
      moneda: "EUR",
      valabilDeLa: "2020-01-01",
      valabilPana: null,
    });

    const cuCategoriaPoliticii = calculeazaDiurnaDeplasare(extern, [], politicaRand(), [
      barem("II"),
    ]);
    const cuAltaCategorie = calculeazaDiurnaDeplasare(extern, [], politicaRand(), [barem("I")]);

    expect(cuCategoriaPoliticii.rezultat.baremLipsa).toBe(false);
    expect(cuAltaCategorie.rezultat.baremLipsa).toBe(true);
  });

  it("un barem expirat înaintea ferestrei nu se folosește", () => {
    const extern = { ...intern, countryId: AT, cursDiurna: 5 };
    const { rezultat } = calculeazaDiurnaDeplasare(extern, [], politicaRand(), [
      {
        countryId: AT,
        categorie: "II",
        valoare: 35,
        moneda: "EUR",
        valabilDeLa: "2020-01-01",
        valabilPana: "2025-12-31",
      },
    ]);
    expect(rezultat.baremLipsa).toBe(true);
  });
});
