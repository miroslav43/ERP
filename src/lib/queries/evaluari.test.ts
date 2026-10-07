// src/lib/queries/evaluari.test.ts
//
// Citirile evaluării anuale: lista paginată keyset, rândul de editare,
// șabloanele (ale firmei + de platformă), indicatorii din capul paginii și
// istoricul unui angajat. Clientul e falsul strict din `@/lib/teste`.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";
import { decodificaCursor } from "./cursor";
import {
  citesteEvaluare,
  evaluariAngajat,
  FILTRE_EVALUARI_GOALE,
  indicatoriEvaluari,
  listeazaEvaluari,
  listeazaSabloane,
} from "./evaluari";

const CRITERII = [
  { cod: "calitate", denumire: "Calitate", tip: "scala", scala_max: 5 },
  { cod: "viteza", denumire: "Viteză", tip: "scala", scala_max: 5 },
];

const rand = (id: string, extra: object = {}) => ({
  id,
  employee_id: ID_2,
  data_evaluarii: "2026-06-30",
  status: "finalizat",
  concluzie: null,
  criterii_sablon: CRITERII,
  raspunsuri: [
    { criteriu_cod: "calitate", scor: 4 },
    { criteriu_cod: "viteza", scor: 3 },
  ],
  versiune_sablon: 2,
  employee: { id: ID_2, full_name: "Ana Pop", marca: "007" },
  template: { id: ID_3, denumire: "Anual" },
  ...extra,
});

describe("listeazaEvaluari", () => {
  it("ambele interogări (rânduri și număr) filtrează pe organizație și pe rândurile vii", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", { data: [] });
    server.raspunde("employee_evaluations", "select", { count: 0 });

    await listeazaEvaluari(ORG_ID, FILTRE_EVALUARI_GOALE);

    const apeluri = server.apeluriPe("employee_evaluations");
    expect(apeluri).toHaveLength(2);
    for (const apel of apeluri) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(apel.filtre.filter((f) => f.metoda === "eq")).toHaveLength(1);
    }
    const [lista, numar] = apeluri;
    expect(numar?.optiuni).toEqual({ count: "exact", head: true });
    // Implicit: cele mai recente întâi, departajate pe id; limita + 1 pentru „mai departe”.
    expect(lista?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["data_evaluarii", { ascending: false, nullsFirst: false }] },
        { metoda: "order", argumente: ["id", { ascending: false }] },
        { metoda: "limit", argumente: [26] },
      ]),
    );
  });

  it("filtrele din URL se aplică pe AMÂNDOUĂ interogările, ca totalul să corespundă listei", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", { data: [] });
    server.raspunde("employee_evaluations", "select", { count: 0 });

    await listeazaEvaluari(ORG_ID, {
      ...FILTRE_EVALUARI_GOALE,
      status: "draft",
      template_id: ID_3,
      de_la: "2026-01-01",
      pana_la: "2026-06-30",
    });

    for (const apel of server.apeluriPe("employee_evaluations")) {
      expect(areFiltru(apel, "eq", "status", "draft")).toBe(true);
      expect(areFiltru(apel, "eq", "template_id", ID_3)).toBe(true);
      expect(areFiltru(apel, "gte", "data_evaluarii", "2026-01-01")).toBe(true);
      expect(areFiltru(apel, "lte", "data_evaluarii", "2026-06-30")).toBe(true);
    }
  });

  it("maparea: numele din embed, punctajul calculat din instantaneu, embed NULL ⇒ null", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", {
      data: [rand(ID_1), rand(ID_2, { employee: null, template: null, raspunsuri: "stricat" })],
    });
    server.raspunde("employee_evaluations", "select", { count: 2 });

    const r = await listeazaEvaluari(ORG_ID, FILTRE_EVALUARI_GOALE);

    expect(r.total).toBe(2);
    expect(r.urmatorulCursor).toBeNull();
    expect(r.randuri[0]).toMatchObject({
      id: ID_1,
      angajat: "Ana Pop",
      marca: "007",
      sablon: "Anual",
      nrCriterii: 2,
      punctaj: { procent: 70, completate: 2, necompletate: 0 },
    });
    expect(r.randuri[1]).toMatchObject({
      angajat: null,
      marca: null,
      sablon: null,
      punctaj: { procent: null, completate: 0, necompletate: 2 },
    });
  });

  it("pagină plină: se taie la limită, iar cursorul poartă valoarea și id-ul ULTIMULUI rând afișat", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", {
      data: [
        rand(ID_1, { data_evaluarii: "2026-09-01" }),
        rand(ID_2, { data_evaluarii: "2026-08-01" }),
        rand(ID_3, { data_evaluarii: "2026-07-01" }),
      ],
    });
    server.raspunde("employee_evaluations", "select", { count: 3 });

    const r = await listeazaEvaluari(ORG_ID, { ...FILTRE_EVALUARI_GOALE, limita: 2 });

    expect(r.randuri.map((x) => x.id)).toEqual([ID_1, ID_2]);
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: "2026-08-01", id: ID_2 });
  });

  it("cursorul primit devine predicat keyset doar pe interogarea paginată, nu pe numărătoare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", { data: [] });
    server.raspunde("employee_evaluations", "select", { count: 9 });
    const cursor = Buffer.from(`2026-08-01\u0000${ID_2}`, "utf8").toString("base64url");

    const r = await listeazaEvaluari(ORG_ID, { ...FILTRE_EVALUARI_GOALE, cursor });

    const [lista, numar] = server.apeluriPe("employee_evaluations");
    expect(lista?.filtre).toContainEqual({
      metoda: "or",
      argumente: [
        `data_evaluarii.lt."2026-08-01",and(data_evaluarii.eq."2026-08-01",id.lt."${ID_2}")`,
      ],
    });
    expect(numar?.filtre.some((f) => f.metoda === "or")).toBe(false);
    expect(r.total).toBe(9);
  });

  it("sortarea după angajat, crescător: ordinea și cursorul folosesc `employee_id`", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", {
      data: [rand(ID_1, { employee_id: ID_2 }), rand(ID_3, { employee_id: ID_3 })],
    });
    server.raspunde("employee_evaluations", "select", { count: 5 });

    const r = await listeazaEvaluari(ORG_ID, {
      ...FILTRE_EVALUARI_GOALE,
      sort: "angajat",
      limita: 1,
    });

    const [lista] = server.apeluriPe("employee_evaluations");
    expect(lista?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["employee_id", { ascending: true, nullsFirst: false }],
    });
    expect(r.sortare).toEqual({ cheie: "angajat", directie: "asc" });
    expect(decodificaCursor(r.urmatorulCursor ?? "")).toEqual({ valoare: ID_2, id: ID_1 });
  });

  it("o sortare necunoscută din URL cade tăcut pe implicit", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", { data: [] });
    server.raspunde("employee_evaluations", "select", { count: null });
    const r = await listeazaEvaluari(ORG_ID, { ...FILTRE_EVALUARI_GOALE, sort: "-parola" });
    expect(r.sortare).toEqual({ cheie: "data", directie: "desc" });
    expect(r.total).toBe(0);
  });

  it("eroarea bazei se propagă, nu devine o listă goală", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", { error: eroarePostgrest("42501") });
    server.raspunde("employee_evaluations", "select", { count: 0 });
    await expect(listeazaEvaluari(ORG_ID, FILTRE_EVALUARI_GOALE)).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("citesteEvaluare", () => {
  it("caută pe organizație + id, doar rânduri vii; absent ⇒ null", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", { data: null });
    expect(await citesteEvaluare(ORG_ID, ID_1)).toBeNull();
    const [apel] = server.apeluriPe("employee_evaluations");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("răspunsurile din jsonb se curăță defensiv: intrări fără cod sau non-obiecte dispar", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", {
      data: rand(ID_1, {
        template_id: ID_3,
        status: "draft",
        raspunsuri: [
          { criteriu_cod: "calitate", scor: 5, comentariu: "Excelent" },
          { criteriu_cod: "", scor: 1 },
          { scor: 2 },
          "text",
          null,
          [1],
          { criteriu_cod: "viteza", scor: "4", raspuns_text: 7 },
        ],
      }),
    });

    const r = await citesteEvaluare(ORG_ID, ID_1);

    expect(r?.raspunsuri).toEqual([
      { criteriu_cod: "calitate", scor: 5, raspuns_text: null, comentariu: "Excelent" },
      // Scor ca text nu e notă: rămâne necompletat, nu devine 4.
      { criteriu_cod: "viteza", scor: null, raspuns_text: null, comentariu: null },
    ]);
    expect(r).toMatchObject({
      template_id: ID_3,
      angajat: "Ana Pop",
      sablon: "Anual",
      status: "draft",
      versiune_sablon: 2,
      punctaj: { procent: 100, completate: 1, necompletate: 1 },
    });
    expect(r?.criterii.map((c) => c.cod)).toEqual(["calitate", "viteza"]);
  });
});

describe("listeazaSabloane", () => {
  const sablon = (id: string, extra: object = {}) => ({
    id,
    denumire: `Șablon ${id.slice(0, 4)}`,
    descriere: null,
    criterii: CRITERII,
    versiune: 1,
    activ: true,
    organization_id: ORG_ID,
    derivat_din: null,
    ...extra,
  });

  it("șablonul de platformă personalizat de firmă dispare: varianta îi ține locul (0168)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("evaluation_templates", "select", {
      data: [sablon(ID_1, { derivat_din: ID_2 })],
    });
    server.raspunde("evaluation_templates", "select", {
      data: [sablon(ID_2, { organization_id: null }), sablon(ID_3, { organization_id: null })],
    });
    server.raspunde("employee_evaluations", "select", { count: 0 });
    server.raspunde("employee_evaluations", "select", { count: 0 });

    const r = await listeazaSabloane(ORG_ID);

    // ID_2 e ascuns de varianta ID_1; ID_3, nepersonalizat, rămâne.
    expect(r.map((s) => [s.id, s.dePlatforma, s.personalizat])).toEqual([
      [ID_1, false, true],
      [ID_3, true, false],
    ]);
  });

  it("varianta ARHIVATĂ ascunde în continuare șablonul de platformă — revenirea e „Șterge”", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("evaluation_templates", "select", {
      data: [sablon(ID_1, { derivat_din: ID_2, activ: false })],
    });
    server.raspunde("evaluation_templates", "select", {
      data: [sablon(ID_2, { organization_id: null })],
    });

    const r = await listeazaSabloane(ORG_ID, { includeArhivate: false });

    expect(r).toEqual([]);
  });

  it("ale firmei întâi, apoi cele de platformă; utilizarea se numără pe toate evaluările firmei", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("evaluation_templates", "select", { data: [sablon(ID_1)] });
    server.raspunde("evaluation_templates", "select", {
      data: [sablon(ID_2, { organization_id: null })],
    });
    // O numărătoare `count` per șablon, în ordinea listei.
    server.raspunde("employee_evaluations", "select", { count: 2 });
    server.raspunde("employee_evaluations", "select", { count: 1 });

    const r = await listeazaSabloane(ORG_ID);

    expect(r.map((s) => [s.id, s.dePlatforma, s.nrEvaluari])).toEqual([
      [ID_1, false, 2],
      [ID_2, true, 1],
    ]);
    expect(r[0]?.criterii).toHaveLength(2);

    const [aleFirmei, alePlatformei] = server.apeluriPe("evaluation_templates");
    expect(areFiltru(aleFirmei, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(aleFirmei, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(alePlatformei, "is", "organization_id", null)).toBe(true);
    expect(areFiltru(alePlatformei, "is", "deleted_at", null)).toBe(true);
    // Fără `.or()` cu identificatorul interpolat în gramatica PostgREST.
    for (const apel of [aleFirmei, alePlatformei]) {
      expect(apel?.filtre.some((f) => f.metoda === "or")).toBe(false);
    }
    const folosire = server.apeluriPe("employee_evaluations");
    expect(
      folosire.map((a) => a.filtre.find((f) => f.argumente[0] === "template_id")?.argumente[1]),
    ).toEqual([ID_1, ID_2]);
    for (const apel of folosire) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
      expect(apel.optiuni).toEqual({ count: "exact", head: true });
    }
  });

  it("fără arhivate, la cerere: șabloanele inactive dispar; un șablon nefolosit are zero evaluări", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("evaluation_templates", "select", {
      data: [sablon(ID_1), sablon(ID_3, { activ: false })],
    });
    server.raspunde("evaluation_templates", "select", { data: [] });
    // Doar șablonul activ rămâne în listă, deci doar el se numără.
    server.raspunde("employee_evaluations", "select", { count: 0 });

    const r = await listeazaSabloane(ORG_ID, { includeArhivate: false });

    expect(r.map((s) => s.id)).toEqual([ID_1]);
    expect(r[0]?.nrEvaluari).toBe(0);
  });

  // Utilizarea se număra citind TOATE rândurile `employee_evaluations` ale
  // firmei, fără limită și fără `count`: peste `max_rows = 1000`, PostgREST tăia
  // tăcut, iar `nrEvaluari` scădea fără nicio eroare. Acum: `count` per șablon.
  it("numărarea utilizării nu e o citire nelimitată de rânduri", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("evaluation_templates", "select", { data: [sablon(ID_1)] });
    server.raspunde("evaluation_templates", "select", { data: [] });
    server.raspunde("employee_evaluations", "select", { count: 1500 });

    await listeazaSabloane(ORG_ID);

    for (const apel of server.apeluriPe("employee_evaluations")) {
      const cuNumarare =
        typeof apel.optiuni === "object" && apel.optiuni !== null && "count" in apel.optiuni;
      const cuLimita = apel.filtre.some((f) => f.metoda === "limit");
      expect(cuNumarare || cuLimita).toBe(true);
    }
  });
});

describe("indicatoriEvaluari", () => {
  const programeaza = (
    server: ReturnType<typeof configureazaActiunea>["server"],
    esantion: unknown[],
  ) => {
    server.raspunde("employee_evaluations", "select", { count: 12 });
    server.raspunde("employee_evaluations", "select", { count: 4 });
    server.raspunde("employee_evaluations", "select", { count: 5 });
    server.raspunde("employee_evaluations", "select", { data: esantion });
    server.raspunde("employees", "select", { count: 8 });
  };

  it("contoarele vin din `count`, media și angajații evaluați din eșantionul finalizat", async () => {
    const { server } = configureazaActiunea();
    programeaza(server, [
      rand(ID_1), // 70 %
      rand(ID_2, { raspunsuri: [{ criteriu_cod: "calitate", scor: 5 }] }), // 100 %
      rand(ID_3, { employee_id: ID_3, raspunsuri: [] }), // fără procent: nu intră în medie
    ]);

    const r = await indicatoriEvaluari(ORG_ID, 2026);

    expect(r).toEqual({
      total: 12,
      ciorne: 4,
      finalizateAnulAcesta: 5,
      angajatiEvaluati: 2,
      angajatiActivi: 8,
      mediaProcent: 85,
      esantionTrunchiat: false,
    });

    const [total, ciorne, anul, esantion] = server.apeluriPe("employee_evaluations");
    for (const apel of [total, ciorne, anul, esantion]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    }
    expect(total?.optiuni).toEqual({ count: "exact", head: true });
    expect(areFiltru(ciorne, "eq", "status", "draft")).toBe(true);
    expect(areFiltru(anul, "eq", "status", "finalizat")).toBe(true);
    expect(areFiltru(anul, "gte", "data_evaluarii", "2026-01-01")).toBe(true);
    expect(areFiltru(anul, "lte", "data_evaluarii", "2026-12-31")).toBe(true);
    expect(areFiltru(esantion, "eq", "status", "finalizat")).toBe(true);
    // 200 + 1: rândul în plus deosebește „exact 200” de „mai multe”.
    expect(esantion?.filtre).toContainEqual({ metoda: "limit", argumente: [201] });
    // Eșantionul e „cele mai recente 200”, cu departajare stabilă pe id.
    expect(esantion?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["data_evaluarii", { ascending: false }],
    });
    expect(esantion?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["id", { ascending: false }],
    });

    const [angajati] = server.apeluriPe("employees");
    expect(areFiltru(angajati, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(angajati, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(angajati, "is", "deleted_at", null)).toBe(true);
  });

  it("firmă goală: zero peste tot și media `null`, nu „0 %”", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", { count: null });
    server.raspunde("employee_evaluations", "select", { count: null });
    server.raspunde("employee_evaluations", "select", { count: null });
    server.raspunde("employee_evaluations", "select", { data: null });
    server.raspunde("employees", "select", { count: null });

    const r = await indicatoriEvaluari(ORG_ID, 2026);

    expect(r).toEqual({
      total: 0,
      ciorne: 0,
      finalizateAnulAcesta: 0,
      angajatiEvaluati: 0,
      angajatiActivi: 0,
      mediaProcent: null,
      esantionTrunchiat: false,
    });
  });

  // `esantion.length === 200` nu deosebea „exact 200 de finalizate” de „mai
  // multe decât 200”. Acum se cere un rând în plus (`limit(201)`).
  it("exact 200 de evaluări finalizate nu e un eșantion trunchiat", async () => {
    const { server } = configureazaActiunea();
    programeaza(
      server,
      Array.from({ length: 200 }, () => rand(ID_1)),
    );
    const r = await indicatoriEvaluari(ORG_ID, 2026);
    expect(r.mediaProcent).toBe(70);
    expect(r.esantionTrunchiat).toBe(false);
  });

  it("201 de evaluări finalizate: eșantion trunchiat, media pe primele 200", async () => {
    const { server } = configureazaActiunea();
    programeaza(server, [
      ...Array.from({ length: 200 }, () => rand(ID_1)), // 70 %
      rand(ID_2, { raspunsuri: [{ criteriu_cod: "calitate", scor: 5 }] }), // 100 %, tăiat
    ]);
    const r = await indicatoriEvaluari(ORG_ID, 2026);
    expect(r.esantionTrunchiat).toBe(true);
    expect(r.mediaProcent).toBe(70);
  });

  it("o eroare pe oricare interogare se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", { count: 1 });
    server.raspunde("employee_evaluations", "select", { count: 1 });
    server.raspunde("employee_evaluations", "select", { count: 1 });
    server.raspunde("employee_evaluations", "select", { data: [] });
    server.raspunde("employees", "select", { error: eroarePostgrest("57014") });
    await expect(indicatoriEvaluari(ORG_ID, 2026)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("evaluariAngajat", () => {
  it("doar evaluările angajatului cerut, din organizație, cele mai recente întâi", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", {
      data: [rand(ID_1, { concluzie: "Promovare" })],
    });

    const r = await evaluariAngajat(ORG_ID, ID_2);

    const [apel] = server.apeluriPe("employee_evaluations");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "employee_id", ID_2)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["data_evaluarii", { ascending: false }],
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      id: ID_1,
      concluzie: "Promovare",
      sablon: "Anual",
      versiune_sablon: 2,
      punctaj: { procent: 70 },
    });
    // Criteriile vin din instantaneu, nu din șablonul curent.
    expect(r[0]?.criterii.map((c) => c.denumire)).toEqual(["Calitate", "Viteză"]);
  });

  it("fără evaluări: listă goală", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("employee_evaluations", "select", { data: null });
    expect(await evaluariAngajat(ORG_ID, ID_2)).toEqual([]);
  });
});
