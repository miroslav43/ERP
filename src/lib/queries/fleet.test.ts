// src/lib/queries/fleet.test.ts
//
// Citirile flotei: listele cu paginare keyset și numărătoare separată, fișele,
// scadențele din `vehicle_documents` (nu din `expirables`), kilometrajul
// sugerat, agregarea combustibilului cu semnalul de trunchiere și gruparea
// anomaliilor pe foaie. Clientul vine din falsul strict din `@/lib/teste/actiune`.

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
import { codificaCursor, decodificaCursor } from "./cursor";
import {
  alimentarileFoii,
  angajatiDupaId,
  anomaliiNeconfirmate,
  anomaliiPeFoi,
  citesteFoaie,
  citesteVehicul,
  combustibilPeFoi,
  documenteleVehiculului,
  kmDePlecareSugerat,
  listeazaFoi,
  listeazaVehicule,
  PLAFON_ANOMALII,
  scadenteCurente,
  tipuriDocument,
  vehiculeDupaId,
  type FiltreFoiCitire,
  type FiltreVehiculeCitire,
} from "./fleet";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
});

const limita = (apel: ApelFals | undefined): unknown =>
  apel?.filtre.find((f) => f.metoda === "limit")?.argumente[0];

const predicatOr = (apel: ApelFals | undefined): string | undefined => {
  const f = apel?.filtre.find((x) => x.metoda === "or");
  return f === undefined ? undefined : String(f.argumente[0]);
};

const [lista, numarare] = [0, 1];

const filtreVehicule = (m: Partial<FiltreVehiculeCitire> = {}): FiltreVehiculeCitire => ({
  status: null,
  categorie: null,
  cauta: null,
  cursor: null,
  limita: 2,
  ...m,
});

const filtreFoi = (m: Partial<FiltreFoiCitire> = {}): FiltreFoiCitire => ({
  status: null,
  vehicul: null,
  cursor: null,
  limita: 2,
  ...m,
});

const vehicul = (id: string, nr: string, km: number) => ({
  id,
  nr_inmatriculare: nr,
  marca: "Dacia",
  model: "Logan",
  categorie: "autoturism",
  tip_combustibil: "motorina",
  an_fabricatie: 2020,
  km_curent: km,
  employee_id: null,
  department_id: null,
  status: "activ",
  prag_salt_km: null,
  data_iesire: null,
  consum_mediu_declarat: null,
});

const foaie = (id: string, plecare: string, status = "trimis") => ({
  id,
  vehicle_id: ID_1,
  employee_id: ID_2,
  numar: null,
  plecare_la: plecare,
  sosire_la: null,
  km_plecare: 100,
  km_sosire: null,
  km_parcursi: null,
  traseu: null,
  scop: null,
  status,
  trimis_la: null,
  aprobat_la: null,
});

describe("listeazaVehicule", () => {
  it("prima pagină: organizație + vii pe ambele interogări, cursor pe numărul ultimului rând", async () => {
    db.raspunde("vehicles", "select", {
      data: [vehicul(ID_1, "B01AAA", 10), vehicul(ID_2, "B02BBB", 20), vehicul(ID_3, "B03CCC", 30)],
    });
    db.raspunde("vehicles", "select", { count: 9 });

    const r = await listeazaVehicule(ORG_ID, filtreVehicule());

    expect(r.randuri.map((v) => v.id)).toEqual([ID_1, ID_2]);
    expect(r.total).toBe(9);
    expect(r.sortare).toEqual({ cheie: "numar", directie: "asc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "B02BBB", id: ID_2 });
    for (const i of [lista, numarare]) {
      expect(areFiltru(db.apeluri[i], "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(db.apeluri[i], "is", "deleted_at", null)).toBe(true);
    }
    expect(limita(db.apeluri[lista])).toBe(3);
    expect(db.apeluri[numarare]?.optiuni).toEqual({ count: "exact", head: true });
  });

  it("filtrele mulțimii pe amândouă interogările, cursorul doar pe listă", async () => {
    db.raspunde("vehicles", "select", { data: [vehicul(ID_3, "B03CCC", 30)] });
    db.raspunde("vehicles", "select", { count: 3 });
    const cursor = codificaCursor({ valoare: "B02BBB", id: ID_2 });

    const r = await listeazaVehicule(
      ORG_ID,
      filtreVehicule({ status: "activ", categorie: "camion", cauta: "B0", cursor }),
    );

    expect(r.urmatorulCursor).toBeNull();
    for (const i of [lista, numarare]) {
      expect(areFiltru(db.apeluri[i], "eq", "status", "activ")).toBe(true);
      expect(areFiltru(db.apeluri[i], "eq", "categorie", "camion")).toBe(true);
      expect(areFiltru(db.apeluri[i], "ilike", "nr_inmatriculare", "%B0%")).toBe(true);
    }
    expect(predicatOr(db.apeluri[lista])).toBe(
      `nr_inmatriculare.gt."B02BBB",and(nr_inmatriculare.eq."B02BBB",id.gt."${ID_2}")`,
    );
    expect(predicatOr(db.apeluri[numarare])).toBeUndefined();
  });

  it("sortarea după km, descrescător: cursorul poartă kilometrajul ca text", async () => {
    db.raspunde("vehicles", "select", {
      data: [vehicul(ID_1, "A", 300), vehicul(ID_2, "B", 200), vehicul(ID_3, "C", 100)],
    });
    db.raspunde("vehicles", "select", { count: 3 });

    const r = await listeazaVehicule(ORG_ID, filtreVehicule({ sort: "-km" }));

    expect(r.sortare).toEqual({ cheie: "km", directie: "desc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "200", id: ID_2 });
    expect(
      areFiltru(db.apeluri[lista], "order", "km_curent", { ascending: false, nullsFirst: false }),
    ).toBe(true);
  });

  it("eroarea listei se propagă", async () => {
    const eroare = eroarePostgrest("42501");
    db.raspunde("vehicles", "select", { error: eroare });
    db.raspunde("vehicles", "select", { count: 0 });
    await expect(listeazaVehicule(ORG_ID, filtreVehicule())).rejects.toBe(eroare);
  });
});

describe("citesteVehicul / citesteFoaie", () => {
  it("vehiculul: pe id + organizație, viu, cu coloanele fișei", async () => {
    db.raspunde("vehicles", "select", { data: null });
    expect(await citesteVehicul(ORG_ID, ID_1)).toBeNull();
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.coloane).toContain("motiv_iesire");
  });

  it("foaia: citită întreagă, cu motivul respingerii", async () => {
    db.raspunde("trip_sheets", "select", { data: { id: ID_1, motiv_respingere: "Lipsă bon" } });
    expect(await citesteFoaie(ORG_ID, ID_1)).toMatchObject({ motiv_respingere: "Lipsă bon" });
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.coloane).toContain("motiv_respingere");
  });
});

describe("documentele vehiculelor", () => {
  it("scadențele curente se citesc din `vehicle_documents`, doar documentul curent și viu", async () => {
    db.raspunde("vehicle_documents", "select", {
      data: [{ vehicle_id: ID_1, document_type_id: ID_2, expira_la: "2026-12-01" }],
    });
    expect(await scadenteCurente([ID_1, ID_3])).toHaveLength(1);
    const [apel] = db.apeluri;
    expect(apel?.tabela).toBe("vehicle_documents");
    expect(areFiltru(apel, "in", "vehicle_id", [ID_1, ID_3])).toBe(true);
    expect(areFiltru(apel, "eq", "este_curent", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("fără vehicule, scadențele nu ating baza", async () => {
    expect(await scadenteCurente([])).toEqual([]);
    expect(db.apeluri).toHaveLength(0);
  });

  it("documentele unui vehicul: vii, cele care expiră cel mai târziu primele", async () => {
    db.raspunde("vehicle_documents", "select", { data: null });
    expect(await documenteleVehiculului(ID_1)).toEqual([]);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "vehicle_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "expira_la", { ascending: false, nullsFirst: false })).toBe(
      true,
    );
  });

  it("tipurile de document NU se filtrează pe organizație (cele de platformă au NULL)", async () => {
    db.raspunde("vehicle_document_types", "select", { data: [{ id: ID_1, cod: "ITP" }] });
    expect(await tipuriDocument()).toHaveLength(1);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id")).toBe(false);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });
});

describe("listeazaFoi", () => {
  it("prima pagină: cele mai recente primele, cursor pe plecarea ultimului rând", async () => {
    db.raspunde("trip_sheets", "select", {
      data: [
        foaie(ID_1, "2026-09-03T05:00:00Z"),
        foaie(ID_2, "2026-09-02T05:00:00Z"),
        foaie(ID_3, "2026-09-01T05:00:00Z"),
      ],
    });
    db.raspunde("trip_sheets", "select", { count: 4 });

    const r = await listeazaFoi(ORG_ID, filtreFoi({ vehicul: ID_1, status: "trimis" }));

    expect(r.randuri).toHaveLength(2);
    expect(r.total).toBe(4);
    expect(r.sortare).toEqual({ cheie: "plecare", directie: "desc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({
      valoare: "2026-09-02T05:00:00Z",
      id: ID_2,
    });
    for (const i of [lista, numarare]) {
      expect(areFiltru(db.apeluri[i], "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(db.apeluri[i], "is", "deleted_at", null)).toBe(true);
      expect(areFiltru(db.apeluri[i], "eq", "vehicle_id", ID_1)).toBe(true);
      expect(areFiltru(db.apeluri[i], "eq", "status", "trimis")).toBe(true);
    }
  });

  it("sortarea după stare: cursorul poartă starea, cursorul stricat e ignorat", async () => {
    db.raspunde("trip_sheets", "select", {
      data: [
        foaie(ID_1, "2026-09-03T05:00:00Z", "aprobat"),
        foaie(ID_2, "2026-09-02T05:00:00Z", "draft"),
        foaie(ID_3, "2026-09-01T05:00:00Z", "trimis"),
      ],
    });
    db.raspunde("trip_sheets", "select", { count: 3 });

    const r = await listeazaFoi(ORG_ID, filtreFoi({ sort: "stare", cursor: "!!!" }));

    expect(r.sortare).toEqual({ cheie: "stare", directie: "asc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "draft", id: ID_2 });
    expect(predicatOr(db.apeluri[lista])).toBeUndefined();
  });
});

describe("kmDePlecareSugerat", () => {
  const raspunde = (dinFoaie: number | null | undefined, dinVehicul: number | undefined) => {
    db.raspunde("trip_sheets", "select", {
      data: dinFoaie === undefined ? null : { km_sosire: dinFoaie },
    });
    db.raspunde("vehicles", "select", {
      data: dinVehicul === undefined ? null : { km_curent: dinVehicul },
    });
  };

  it.each([
    [12000, 11000, 12000],
    [11000, 12500, 12500],
    [undefined, 8000, 8000],
    [9000, undefined, 9000],
    [undefined, undefined, null],
  ])("foaie %s, vehicul %s ⇒ %s", async (foaieKm, vehiculKm, asteptat) => {
    raspunde(foaieKm, vehiculKm);
    expect(await kmDePlecareSugerat(ORG_ID, ID_1)).toBe(asteptat);
  });

  it("caută ultima foaie APROBATĂ cu km de sosire, a vehiculului, în organizație", async () => {
    raspunde(100, 50);
    await kmDePlecareSugerat(ORG_ID, ID_1);
    const [foi] = db.apeluriPe("trip_sheets");
    expect(areFiltru(foi, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(foi, "eq", "vehicle_id", ID_1)).toBe(true);
    expect(areFiltru(foi, "eq", "status", "aprobat")).toBe(true);
    expect(areFiltru(foi, "not", "km_sosire")).toBe(true);
    expect(areFiltru(foi, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(foi, "order", "km_sosire", { ascending: false })).toBe(true);
    const [vehicule] = db.apeluriPe("vehicles");
    expect(areFiltru(vehicule, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(vehicule, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(vehicule, "is", "deleted_at", null)).toBe(true);
  });

  it("eroarea oricăreia dintre citiri se propagă", async () => {
    const eroare = eroarePostgrest("42501");
    db.raspunde("trip_sheets", "select", { data: null });
    db.raspunde("vehicles", "select", { error: eroare });
    await expect(kmDePlecareSugerat(ORG_ID, ID_1)).rejects.toBe(eroare);
  });
});

describe("combustibilPeFoi", () => {
  it("adună litrii, costul și numărul de alimentări pe fiecare foaie", async () => {
    db.raspunde("fuel_entries", "select", {
      data: [
        { trip_sheet_id: ID_1, litri: 20, cost: 150 },
        { trip_sheet_id: ID_1, litri: 15.5, cost: 110.25 },
        { trip_sheet_id: ID_2, litri: 40, cost: 300 },
      ],
    });

    const r = await combustibilPeFoi([ID_1, ID_2, ID_1]);

    expect(r.trunchiat).toBe(false);
    expect(r.perFoaie.get(ID_1)).toEqual({ litri: 35.5, cost: 260.25, alimentari: 2 });
    expect(r.perFoaie.get(ID_2)).toEqual({ litri: 40, cost: 300, alimentari: 1 });
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "in", "trip_sheet_id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    // 20 pe foaie, pe foi deduplicate.
    expect(limita(apel)).toBe(40);
  });

  it("o citire care atinge plafonul e marcată trunchiată", async () => {
    db.raspunde("fuel_entries", "select", {
      data: Array.from({ length: 20 }, () => ({ trip_sheet_id: ID_1, litri: 1, cost: 1 })),
    });
    const r = await combustibilPeFoi([ID_1]);
    expect(r.trunchiat).toBe(true);
  });

  it("plafonul nu depășește `max_rows` (1000), oricâte foi", async () => {
    db.raspunde("fuel_entries", "select", { data: [] });
    const ids = Array.from({ length: 60 }, (_, i) => `id-${String(i)}`);
    await combustibilPeFoi(ids);
    expect(limita(db.apeluri[0])).toBe(1000);
  });

  it("fără foi nu atinge baza", async () => {
    const r = await combustibilPeFoi([]);
    expect(r).toEqual({ perFoaie: new Map(), trunchiat: false });
    expect(db.apeluri).toHaveLength(0);
  });
});

describe("alimentări și anomalii", () => {
  it("alimentările unei foi, vii, în ordine cronologică", async () => {
    db.raspunde("fuel_entries", "select", { data: null });
    expect(await alimentarileFoii(ID_1)).toEqual([]);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "trip_sheet_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "order", "alimentat_la", { ascending: true })).toBe(true);
  });

  it("anomaliile neconfirmate: ale organizației, vii, neconfirmate, plafonate", async () => {
    db.raspunde("odometer_anomalies", "select", { data: [{ id: ID_1 }] });
    expect(await anomaliiNeconfirmate(ORG_ID)).toHaveLength(1);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "is", "confirmat_la", null)).toBe(true);
    expect(limita(apel)).toBe(PLAFON_ANOMALII);
  });

  it("anomaliile pe foi: grupate pe foaie, inclusiv cele confirmate, fără cele fără foaie", async () => {
    db.raspunde("odometer_anomalies", "select", {
      data: [
        { id: "a1", trip_sheet_id: ID_1, confirmat_la: null },
        { id: "a2", trip_sheet_id: ID_2, confirmat_la: "2026-09-01T00:00:00Z" },
        { id: "a3", trip_sheet_id: ID_1, confirmat_la: null },
        { id: "a4", trip_sheet_id: null, confirmat_la: null },
      ],
    });

    const r = await anomaliiPeFoi(ORG_ID, [ID_1, ID_2, ID_2]);

    expect(r.get(ID_1)?.map((a) => a.id)).toEqual(["a1", "a3"]);
    expect(r.get(ID_2)?.map((a) => a.id)).toEqual(["a2"]);
    expect(r.size).toBe(2);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "in", "trip_sheet_id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(apel, "is", "confirmat_la")).toBe(false);
    expect(limita(apel)).toBe(10);
  });

  it("fără foi, anomaliile nu ating baza", async () => {
    expect((await anomaliiPeFoi(ORG_ID, [])).size).toBe(0);
    expect(db.apeluri).toHaveLength(0);
  });
});

describe("rezolvarea id-urilor", () => {
  it("angajații: pe organizație, id-uri deduplicate", async () => {
    db.raspunde("employees", "select", { data: [{ id: ID_2, full_name: "Ion", marca: "1" }] });
    const r = await angajatiDupaId(ORG_ID, [ID_2, ID_2]);
    expect(r.get(ID_2)?.full_name).toBe("Ion");
    expect(areFiltru(db.apeluri[0], "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(db.apeluri[0], "in", "id", [ID_2])).toBe(true);
  });

  it("vehiculele: pe organizație, doar cele vii; listă goală fără bază", async () => {
    expect((await vehiculeDupaId(ORG_ID, [])).size).toBe(0);
    expect(db.apeluri).toHaveLength(0);

    db.raspunde("vehicles", "select", { data: [vehicul(ID_1, "B01AAA", 10)] });
    const r = await vehiculeDupaId(ORG_ID, [ID_1]);
    expect(r.get(ID_1)?.nr_inmatriculare).toBe("B01AAA");
    expect(areFiltru(db.apeluri[0], "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(db.apeluri[0], "is", "deleted_at", null)).toBe(true);
  });
});
