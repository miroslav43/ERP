// src/lib/queries/reges.test.ts
//
// Citirile REGES: lista de evenimente cu statisticile numărate în bază pe TOT
// registrul (nu pe pagina tăiată), coada de mesaje cu „transmisibil" calculat
// din dependență, propunerile, jurnalul apelurilor, contractele eligibile,
// nomenclatoarele și detaliul unui mesaj.
//
// Funcțiile primesc clientul ca argument, deci falsul se pasează direct.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { areFiltru, clientFals, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  citesteDetaliuMesaj,
  contracteEligibilePropunere,
  FILTRE_IMPLICITE,
  idOrganizatie,
  interogheazaApeluriReges,
  interogheazaEvenimenteReges,
  interogheazaMesajeReges,
  interogheazaPropuneriReges,
  optiuniNomenclator,
  propuneriDeRaspuns,
  type RandPropunere,
} from "./reges";

const ORG = "11111111-1111-4111-8111-111111111111";
const A1 = "66666666-6666-4666-8666-666666666666";
const C1 = "77777777-7777-4777-8777-777777777777";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-15T07:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("idOrganizatie", () => {
  it("ia organizația din tenant", () => {
    expect(
      idOrganizatie({
        organizationId: ORG,
        slug: "s",
        name: "n",
        legalName: null,
        role: "hr",
        memberId: "m",
        timezone: "Europe/Bucharest",
      }),
    ).toBe(ORG);
  });
});

/* ------------------------------- evenimente ------------------------------ */

describe("interogheazaEvenimenteReges", () => {
  const eveniment = (id: string, peste: Record<string, unknown> = {}) => ({
    id,
    event_type: "angajare",
    data_evenimentului: "2026-09-10",
    termen_transmitere: "2026-09-14",
    status: "pregatit",
    transmis_la: null,
    numar_inregistrare: null,
    eroare: null,
    employee_id: A1,
    contract_id: C1,
    ...peste,
  });

  /**
   * Cele patru numărători pleacă în paralel cu lista și se rezolvă ÎNAINTEA ei
   * (`numaraStatistici` își face `Promise.all` primul), deci în coada falsului
   * vin întâi cele patru `count`, apoi lista.
   */
  function programeaza(
    db: ReturnType<typeof clientFals>,
    lista: unknown[],
    numere: readonly [number, number, number, number] = [0, 0, 0, 0],
  ) {
    for (const n of numere) db.raspunde("reges_evenimente", "select", { count: n });
    db.raspunde("reges_evenimente", "select", { data: lista });
  }

  it("lista firmei, vie, ordonată după termen, cu limita filtrului", async () => {
    const db = clientFals();
    programeaza(db, []);

    const r = await interogheazaEvenimenteReges(db.client, ORG, FILTRE_IMPLICITE);

    expect(r.randuri).toEqual([]);
    expect(r.azi).toBe("2026-09-15");
    const lista = db.apeluriPe("reges_evenimente").find((a) => a.optiuni === undefined);
    expect(areFiltru(lista, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(lista, "is", "deleted_at", null)).toBe(true);
    expect(lista?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["termen_transmitere", { ascending: true }] },
        { metoda: "limit", argumente: [100] },
      ]),
    );
    // Fără evenimente: nici angajați, nici contracte.
    expect(db.apeluriPe("employees")).toHaveLength(0);
  });

  it("statisticile se numără în bază, pe tot registrul, fiecare cu predicatul ei", async () => {
    const db = clientFals();
    programeaza(db, [], [3, 1, 7, 12]);

    const r = await interogheazaEvenimenteReges(db.client, ORG, {
      ...FILTRE_IMPLICITE,
      stare: "transmise",
    });

    expect(r.statistici).toEqual({ intarziate: 3, astazi: 1, inTermen: 7, transmise: 12 });
    const numarari = db.apeluriPe("reges_evenimente").filter((a) => a.optiuni !== undefined);
    expect(numarari).toHaveLength(4);
    const netransmise = ["de_pregatit", "pregatit", "respins"];
    for (const n of numarari) {
      expect(n.optiuni).toEqual({ count: "exact", head: true });
      expect(areFiltru(n, "eq", "organization_id", ORG)).toBe(true);
      expect(areFiltru(n, "is", "deleted_at", null)).toBe(true);
    }
    const [intarziate, astazi, inTermen, transmise] = numarari;
    expect(areFiltru(intarziate, "in", "status", netransmise)).toBe(true);
    expect(areFiltru(intarziate, "lt", "termen_transmitere", "2026-09-15")).toBe(true);
    expect(areFiltru(astazi, "eq", "termen_transmitere", "2026-09-15")).toBe(true);
    expect(areFiltru(inTermen, "gt", "termen_transmitere", "2026-09-15")).toBe(true);
    expect(areFiltru(transmise, "in", "status", ["transmis", "confirmat"])).toBe(true);
    // Filtrul listei NU atinge numărătorile.
    expect(areFiltru(intarziate, "in", "status", ["transmis", "confirmat"])).toBe(false);
  });

  it.each([
    ["transmise", [["in", "status", ["transmis", "confirmat"]]], []],
    [
      "de_transmis",
      [["in", "status", ["de_pregatit", "pregatit", "respins"]]],
      [["lt", "termen_transmitere"]],
    ],
    [
      "intarziate",
      [
        ["in", "status", ["de_pregatit", "pregatit", "respins"]],
        ["lt", "termen_transmitere", "2026-09-15"],
      ],
      [],
    ],
    ["toate", [], [["in", "status"]]],
  ] as const)(
    "filtrul de stare `%s` pune exact predicatele lui pe listă",
    async (stare, are, nuAre) => {
      const db = clientFals();
      programeaza(db, []);
      await interogheazaEvenimenteReges(db.client, ORG, { ...FILTRE_IMPLICITE, stare });
      const lista = db.apeluriPe("reges_evenimente").find((a) => a.optiuni === undefined);
      for (const [metoda, col, val] of are) expect(areFiltru(lista, metoda, col, val)).toBe(true);
      for (const [metoda, col] of nuAre) expect(areFiltru(lista, metoda, col)).toBe(false);
    },
  );

  it("filtrul de tip se aplică doar când nu e „toate”", async () => {
    const db = clientFals();
    programeaza(db, []);
    await interogheazaEvenimenteReges(db.client, ORG, { ...FILTRE_IMPLICITE, tip: "incetare" });
    const lista = db.apeluriPe("reges_evenimente").find((a) => a.optiuni === undefined);
    expect(areFiltru(lista, "eq", "event_type", "incetare")).toBe(true);
  });

  it("rândurile se îmbogățesc cu angajatul și contractul, iar termenul se evaluează față de azi", async () => {
    const db = clientFals();
    programeaza(db, [
      eveniment("e1"),
      eveniment("e2", { status: "transmis", contract_id: null, termen_transmitere: "2026-09-01" }),
      eveniment("e3", { employee_id: "sters", termen_transmitere: "2026-09-20" }),
    ]);
    db.raspunde("employees", "select", { data: [{ id: A1, full_name: "Ion Pop", marca: "0042" }] });
    db.raspunde("employment_contracts", "select", { data: [{ id: C1, numar: "12" }] });

    const r = await interogheazaEvenimenteReges(db.client, ORG, FILTRE_IMPLICITE);

    expect(r.randuri[0]).toMatchObject({
      id: "e1",
      angajatNume: "Ion Pop",
      angajatMarca: "0042",
      contractNumar: "12",
      stare: "intarziat",
      zileIntarziere: 1,
    });
    expect(r.randuri[1]).toMatchObject({ id: "e2", stare: "transmis", contractNumar: null });
    expect(r.randuri[2]).toMatchObject({
      id: "e3",
      angajatNume: "Angajat șters",
      angajatMarca: "—",
      stare: "in_termen",
      zileRamase: 5,
    });
    expect(areFiltru(db.apeluriPe("employees")[0], "in", "id", [A1, "sters"])).toBe(true);
    expect(areFiltru(db.apeluriPe("employment_contracts")[0], "in", "id", [C1])).toBe(true);
  });

  it("eroarea listei se aruncă tradusă", async () => {
    const db = clientFals();
    for (let i = 0; i < 4; i += 1) db.raspunde("reges_evenimente", "select", { count: 0 });
    db.raspunde("reges_evenimente", "select", { error: eroarePostgrest("42501") });
    await expect(
      interogheazaEvenimenteReges(db.client, ORG, FILTRE_IMPLICITE),
    ).rejects.toMatchObject({
      code: "INTERZIS",
    });
  });

  it("eroarea unei numărători se aruncă (cifra mică e mai rea decât lipsa cifrei)", async () => {
    const db = clientFals();
    db.raspunde("reges_evenimente", "select", { error: eroarePostgrest("57014") });
    for (let i = 0; i < 3; i += 1) db.raspunde("reges_evenimente", "select", { count: 0 });
    db.raspunde("reges_evenimente", "select", { data: [] });
    await expect(
      interogheazaEvenimenteReges(db.client, ORG, FILTRE_IMPLICITE),
    ).rejects.toBeDefined();
  });
});

/* ------------------------------- mesajele -------------------------------- */

describe("interogheazaMesajeReges", () => {
  const mesaj = (id: string, peste: Record<string, unknown> = {}) => ({
    id,
    tip: "contract",
    operatie: "AdaugareContract",
    stare: "de_transmis",
    ordine: 0,
    depinde_de: null,
    message_id: `msg-${id}`,
    response_id: null,
    referinta_id: null,
    rezultat_cod: null,
    rezultat_mesaj: null,
    eroare: null,
    incercari: 0,
    trimis_la: null,
    raspuns_la: null,
    created_at: "2026-09-10T10:00:00Z",
    employee_id: A1,
    contract_id: C1,
    ...peste,
  });

  it("coada firmei, vie, cu `transmisibil` după dependență și statistici pe stări", async () => {
    const db = clientFals();
    db.raspunde("reges_mesaje", "select", {
      data: [
        mesaj("s", { tip: "salariat", stare: "reusit", referinta_id: "ref", contract_id: null }),
        mesaj("c1", { depinde_de: "s" }),
        mesaj("c2", { depinde_de: "lipsa" }),
        mesaj("c3", { stare: "asteapta_raspuns" }),
        mesaj("c4", { stare: "esuat", employee_id: null, contract_id: null }),
      ],
    });
    db.raspunde("employees", "select", { data: [{ id: A1, full_name: "Ion Pop" }] });
    db.raspunde("employment_contracts", "select", { data: [{ id: C1, numar: "12" }] });

    const r = await interogheazaMesajeReges(db.client, ORG);

    expect(r.randuri.map((m) => [m.id, m.transmisibil])).toEqual([
      ["s", false],
      ["c1", true],
      ["c2", false],
      ["c3", false],
      ["c4", false],
    ]);
    expect(r.randuri[1]).toMatchObject({
      angajatNume: "Ion Pop",
      contractNumar: "12",
      messageId: "msg-c1",
    });
    expect(r.randuri[4]).toMatchObject({ angajatNume: null, contractNumar: null });
    expect(r.statistici).toEqual({ deTransmis: 2, asteapta: 1, esuate: 1, reusite: 1 });
    const [apel] = db.apeluriPe("reges_mesaje");
    expect(areFiltru(apel, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [200] });
  });

  it("coadă goală: fără citiri de angajați sau contracte", async () => {
    const db = clientFals();
    db.raspunde("reges_mesaje", "select", { data: [] });
    const r = await interogheazaMesajeReges(db.client, ORG);
    expect(r.statistici).toEqual({ deTransmis: 0, asteapta: 0, esuate: 0, reusite: 0 });
    expect(db.apeluri).toHaveLength(1);
  });

  // Fișierul însuși a reparat exact asta pentru evenimente (`numaraStatistici`):
  // cifrele numărate peste pagina tăiată la `limita` sunt mai mici decât
  // realitatea, fără nicio eroare. La mesaje, statisticile vin încă din pagină.
  it.fails(
    "DEFECT: statisticile cozii se numără din pagina tăiată la `limita`, nu din bază",
    async () => {
      const db = clientFals();
      db.raspunde("reges_mesaje", "select", { data: [mesaj("a"), mesaj("b")] });
      db.raspunde("employees", "select", { data: [] });
      db.raspunde("employment_contracts", "select", { data: [] });
      // Ce ar fi numărat baza pe toată coada, dacă funcția ar fi întrebat.
      for (let i = 0; i < 4; i += 1)
        db.raspunde("reges_mesaje", "select", { count: 9, data: null });

      const r = await interogheazaMesajeReges(db.client, ORG, 2);

      expect(r.statistici.deTransmis).toBe(9);
    },
  );

  // Fixează forma de AZI a defectului: o reparație (oricum ar arăta interogarea)
  // înroșește testul ăsta, deci marcajul `it.fails` de mai sus nu poate rămâne
  // verde din greșeală.
  it("stare actuală (DEFECT de mai sus): statisticile = rândurile din pagină", async () => {
    const db = clientFals();
    db.raspunde("reges_mesaje", "select", { data: [mesaj("a"), mesaj("b")] });
    db.raspunde("employees", "select", { data: [] });
    db.raspunde("employment_contracts", "select", { data: [] });

    const r = await interogheazaMesajeReges(db.client, ORG, 2);

    expect(r.statistici.deTransmis).toBe(2);
    expect(db.apeluriPe("reges_mesaje")).toHaveLength(1);
    expect(db.neconsumate()).toEqual([]);
  });

  it("eroarea se propagă", async () => {
    const db = clientFals();
    const eroare = eroarePostgrest("42501");
    db.raspunde("reges_mesaje", "select", { error: eroare });
    await expect(interogheazaMesajeReges(db.client, ORG)).rejects.toBe(eroare);
  });
});

/* ------------------------------ propunerile ------------------------------ */

describe("interogheazaPropuneriReges / propuneriDeRaspuns", () => {
  it("propunerile firmei, vii, cele mai noi întâi, mapate", async () => {
    const db = clientFals();
    db.raspunde("reges_propuneri", "select", {
      data: [
        {
          id: "p1",
          directie: "primita",
          fel: "detasare",
          stare: "noua",
          angajator_partener_nume: "Sursa",
          angajator_partener_cui: "RO1",
          salariat_nume: "Ion",
          salariat_cnp_last4: "3456",
          data_inceput: "2026-10-01",
          data_sfarsit: null,
          temei_legal: "Art45",
          primita_la: "2026-09-14T10:00:00Z",
          raspuns_la: null,
          observatii: null,
        },
      ],
    });

    const r = await interogheazaPropuneriReges(db.client, ORG, 10);

    expect(r[0]).toEqual({
      id: "p1",
      directie: "primita",
      fel: "detasare",
      stare: "noua",
      partenerNume: "Sursa",
      partenerCui: "RO1",
      salariatNume: "Ion",
      salariatCnpUltimele4: "3456",
      dataInceput: "2026-10-01",
      dataSfarsit: null,
      temeiLegal: "Art45",
      primitaLa: "2026-09-14T10:00:00Z",
      raspunsLa: null,
      observatii: null,
    });
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [10] });
  });

  it("pastila numără doar propunerile PRIMITE încă NOI", () => {
    const p = (directie: string, stare: string) => ({ directie, stare }) as RandPropunere;
    expect(
      propuneriDeRaspuns([
        p("primita", "noua"),
        p("primita", "noua"),
        p("primita", "acceptata"),
        p("trimisa", "noua"),
      ]),
    ).toBe(2);
    expect(propuneriDeRaspuns([])).toBe(0);
  });
});

/* ------------------------------ restul citirilor ------------------------- */

describe("interogheazaApeluriReges", () => {
  it("jurnalul firmei, opțional doar al unui mesaj", async () => {
    const db = clientFals();
    db.raspunde("reges_apeluri", "select", {
      data: [
        {
          id: "a1",
          metoda: "POST",
          cale: "/api/Salariat",
          http_status: 202,
          durata_ms: 40,
          eroare: null,
          created_at: "2026-09-14T10:00:00Z",
        },
      ],
    });
    db.raspunde("reges_apeluri", "select", { data: [] });

    const r = await interogheazaApeluriReges(db.client, ORG, "m1", 5);
    await interogheazaApeluriReges(db.client, ORG);

    expect(r).toEqual([
      {
        id: "a1",
        metoda: "POST",
        cale: "/api/Salariat",
        httpStatus: 202,
        durataMs: 40,
        eroare: null,
        creatLa: "2026-09-14T10:00:00Z",
      },
    ]);
    const [cuMesaj, faraMesaj] = db.apeluri;
    expect(areFiltru(cuMesaj, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(cuMesaj, "eq", "mesaj_id", "m1")).toBe(true);
    expect(cuMesaj?.filtre).toContainEqual({ metoda: "limit", argumente: [5] });
    expect(areFiltru(faraMesaj, "eq", "mesaj_id")).toBe(false);
    expect(faraMesaj?.filtre).toContainEqual({ metoda: "limit", argumente: [50] });
  });
});

describe("contracteEligibilePropunere", () => {
  it("doar contracte de bază active, deja transmise la ITM, cu numele angajatului", async () => {
    const db = clientFals();
    db.raspunde("employment_contracts", "select", {
      data: [
        { id: C1, numar: "12", employee_id: A1 },
        { id: "c2", numar: "13", employee_id: "fara-nume" },
      ],
    });
    db.raspunde("employees", "select", { data: [{ id: A1, full_name: "Ion Pop" }] });

    const r = await contracteEligibilePropunere(db.client, ORG);

    expect(r).toEqual([
      { id: C1, numar: "12", angajatNume: "Ion Pop" },
      { id: "c2", numar: "13", angajatNume: null },
    ]);
    const [apel] = db.apeluriPe("employment_contracts");
    expect(areFiltru(apel, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "activ")).toBe(true);
    expect(areFiltru(apel, "eq", "este_act_aditional", false)).toBe(true);
    expect(areFiltru(apel, "not", "reges_contract_id", "is")).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("niciun contract eligibil: listă goală, fără citirea angajaților", async () => {
    const db = clientFals();
    db.raspunde("employment_contracts", "select", { data: [] });
    expect(await contracteEligibilePropunere(db.client, ORG)).toEqual([]);
    expect(db.apeluriPe("employees")).toHaveLength(0);
  });
});

describe("optiuniNomenclator", () => {
  it("pozițiile naționale active ale unui tip, alfabetic, sub plafonul tăcut", async () => {
    const db = clientFals();
    db.raspunde("reges_nomenclatoare", "select", {
      data: [
        { cod: "1", nume: "Art. 45" },
        { cod: null, nume: "Fără cod" },
      ],
    });

    expect(await optiuniNomenclator(db.client, "TemeiDetasare")).toEqual([
      { cod: "1", nume: "Art. 45" },
    ]);
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "tip", "TemeiDetasare")).toBe(true);
    expect(areFiltru(apel, "eq", "activ", true)).toBe(true);
    // Doar nomenclatorul național, nu sporurile proprii ale altor firme.
    expect(areFiltru(apel, "is", "organization_id", null)).toBe(true);
    expect(apel?.filtre).toContainEqual({ metoda: "limit", argumente: [300] });
  });
});

describe("eroarea citirii se propagă, nu devine listă goală", () => {
  it.each([
    [
      "interogheazaPropuneriReges",
      "reges_propuneri",
      (c: never) => interogheazaPropuneriReges(c, ORG),
    ],
    ["interogheazaApeluriReges", "reges_apeluri", (c: never) => interogheazaApeluriReges(c, ORG)],
    [
      "contracteEligibilePropunere",
      "employment_contracts",
      (c: never) => contracteEligibilePropunere(c, ORG),
    ],
    [
      "optiuniNomenclator",
      "reges_nomenclatoare",
      (c: never) => optiuniNomenclator(c, "TemeiDetasare"),
    ],
  ] as const)("%s", async (_nume, tabela, citeste) => {
    const db = clientFals();
    const eroare = eroarePostgrest("42501");
    db.raspunde(tabela, "select", { error: eroare });
    await expect(citeste(db.client)).rejects.toBe(eroare);
  });
});

describe("citesteDetaliuMesaj", () => {
  const rand = {
    id: "m1",
    tip: "contract",
    operatie: "AdaugareContract",
    stare: "de_transmis",
    ordine: 1,
    depinde_de: "m0",
    message_id: "msg",
    response_id: null,
    referinta_id: null,
    rezultat_cod: null,
    rezultat_mesaj: null,
    eroare: null,
    incercari: 0,
    trimis_la: null,
    raspuns_la: null,
    created_at: "2026-09-10T10:00:00Z",
    employee_id: A1,
    contract_id: C1,
  };

  it("mesajul firmei cu angajatul, clasificarea contractului, jurnalul și dependența", async () => {
    const db = clientFals();
    db.raspunde("reges_mesaje", "select", { data: rand });
    db.raspunde("employees", "select", { data: { full_name: "Ion Pop" } });
    db.raspunde("employment_contracts", "select", {
      data: {
        id: C1,
        numar: "12",
        contract_duration: "determinat",
        norma_ore_saptamana: 40,
        norma_ore_zi: 8,
        work_mode: "sediu",
        special_regime: null,
        reges_contract_id: null,
        reges_tip_contract: "RaportDeServiciu",
        reges_tip_norma: null,
        reges_norma_timp: null,
        reges_repartizare: null,
        reges_temei_incetare: null,
        functie: "Contabil",
        cod_cor: "241103",
      },
    });
    db.raspunde("reges_apeluri", "select", { data: [] });
    db.raspunde("reges_mesaje", "select", { data: { stare: "reusit", referinta_id: "ref" } });

    const r = await citesteDetaliuMesaj(db.client, ORG, "m1");

    expect(r?.mesaj).toMatchObject({
      id: "m1",
      angajatNume: "Ion Pop",
      contractNumar: "12",
      transmisibil: true,
    });
    expect(r?.clasificare).toMatchObject({
      contractId: C1,
      durataDeterminata: true,
      tipContract: "RaportDeServiciu",
      tipNorma: null,
      codCor: "241103",
    });
    expect(r?.apeluri).toEqual([]);
    const [citire] = db.apeluriPe("reges_mesaje");
    expect(areFiltru(citire, "eq", "id", "m1")).toBe(true);
    expect(areFiltru(citire, "eq", "organization_id", ORG)).toBe(true);
    expect(areFiltru(citire, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(db.apeluriPe("reges_apeluri")[0], "eq", "mesaj_id", "m1")).toBe(true);
    const [ctr] = db.apeluriPe("employment_contracts");
    expect(areFiltru(ctr, "eq", "id", C1)).toBe(true);
    expect(areFiltru(ctr, "eq", "organization_id", ORG)).toBe(true);
  });

  it("mesaj de salariat fără contract și fără dependență: fără clasificare, transmisibil", async () => {
    const db = clientFals();
    db.raspunde("reges_mesaje", "select", {
      data: { ...rand, tip: "salariat", depinde_de: null, contract_id: null },
    });
    db.raspunde("employees", "select", { data: { full_name: "Ion Pop" } });
    db.raspunde("reges_apeluri", "select", { data: [] });

    const r = await citesteDetaliuMesaj(db.client, ORG, "m1");

    expect(r?.clasificare).toBeNull();
    expect(r?.mesaj.transmisibil).toBe(true);
    expect(db.apeluriPe("employment_contracts")).toHaveLength(0);
  });

  it("dependența neconfirmată face mesajul netransmisibil", async () => {
    const db = clientFals();
    db.raspunde("reges_mesaje", "select", { data: { ...rand, contract_id: null } });
    db.raspunde("employees", "select", { data: null });
    db.raspunde("reges_apeluri", "select", { data: [] });
    db.raspunde("reges_mesaje", "select", { data: { stare: "reusit", referinta_id: null } });
    const r = await citesteDetaliuMesaj(db.client, ORG, "m1");
    expect(r?.mesaj.transmisibil).toBe(false);
    expect(r?.mesaj.angajatNume).toBeNull();
  });

  it("mesaj inexistent ⇒ null; eroare ⇒ se aruncă", async () => {
    const db = clientFals();
    db.raspunde("reges_mesaje", "select", { data: null });
    expect(await citesteDetaliuMesaj(db.client, ORG, "m1")).toBeNull();
    const eroare = eroarePostgrest("42501");
    db.raspunde("reges_mesaje", "select", { error: eroare });
    await expect(citesteDetaliuMesaj(db.client, ORG, "m1")).rejects.toBe(eroare);
  });
});
