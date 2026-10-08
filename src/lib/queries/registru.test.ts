// src/lib/queries/registru.test.ts
//
// Citirile registrului: filtrele din URL (validate la graniță), cursorul pe o
// singură coloană (`numar`, unic cu anul fixat), pagina + numărătoarea pe
// interogări SEPARATE cu aceleași filtre, anii și tipurile pentru filtre.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { codificaCursor, VALOARE_NULA } from "./cursor";
import {
  anulCurent,
  cheieFiltre,
  citesteDocumentRegistru,
  citesteExercitiu,
  citesteSumarAn,
  LIMITA_IMPLICITA,
  LIMITA_MAXIMA,
  listeazaAni,
  listeazaRegistru,
  listeazaRegistruComplet,
  MAX_RANDURI_EXPORT,
  parseazaFiltre,
  serializeazaFiltre,
  type FiltreRegistru,
} from "./registru";

afterEach(() => {
  vi.useRealTimers();
});

const filtreDe = (peste: Partial<FiltreRegistru> = {}): FiltreRegistru => ({
  an: 2026,
  sens: null,
  tipDocument: null,
  deLa: null,
  panaLa: null,
  cautare: null,
  angajatId: null,
  dosar: null,
  stare: null,
  sursa: null,
  sort: null,
  grup: null,
  cursor: null,
  limita: 2,
  ...peste,
});

/** Cursorul implicit, pe `numar`: valoarea ȘI departajatorul sunt numărul. */
const cursorNumar = (numar: number): string =>
  codificaCursor({ valoare: String(numar), id: String(numar) });

const randBrut = (id: string, numar: number) => ({
  id,
  numar,
  numar_afisat: `${String(numar)}/02.09.2026`,
  data_inregistrare: "2026-09-02",
  sens: "intrare",
  tip_document: "demisie",
  continut_rezumat: "Demisie",
  numar_document_emitent: null,
  data_document_emitent: null,
  emitent: "Ion",
  destinatar: null,
  compartiment: null,
  data_expedierii: null,
  mod_rezolvare: null,
  numar_file: 1,
  numar_anexe: null,
  conexat_la: null,
  entitate_tip: "manual",
  entitate_id: null,
  inregistrat_retroactiv: false,
  anulat_la: null,
  motiv_anulare: null,
  indicativ_dosar: "I-A-3",
  rezolvat_la: null,
  angajat_id: null,
});

/* ------------------------------ funcții pure ----------------------------- */

describe("anulCurent", () => {
  it.each([
    // 31 dec 22:30 UTC e deja 1 ianuarie la București (UTC+2).
    ["2025-12-31T22:30:00Z", 2026],
    ["2025-12-31T21:59:59Z", 2025],
    ["2026-06-30T12:00:00Z", 2026],
  ])("la %s anul din fusul Europe/Bucharest e %i", (moment, an) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(moment));
    expect(anulCurent()).toBe(an);
  });
});

describe("parseazaFiltre", () => {
  it("fără parametri: anul curent, limita implicită, restul null", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-10T10:00:00Z"));
    expect(parseazaFiltre({})).toEqual({
      an: 2026,
      sens: null,
      tipDocument: null,
      deLa: null,
      panaLa: null,
      cautare: null,
      angajatId: null,
      dosar: null,
      stare: null,
      sursa: null,
      sort: null,
      grup: null,
      cursor: null,
      limita: LIMITA_IMPLICITA,
    });
  });

  it("citește numele scurte din URL și ia prima valoare dintr-o listă", () => {
    const f = parseazaFiltre({
      an: ["2025", "2024"],
      sens: "iesire",
      tip: "contract_munca",
      de_la: "2025-01-01",
      pana_la: "2025-03-31",
      q: "  demisie  ",
      angajat: ID_1,
      dosar: "II.5",
      stare: "in_lucru",
      sursa: "manual",
      sort: "-data",
      grup: "tip",
      cursor: "MTA",
      limita: "100",
    });
    expect(f).toEqual({
      an: 2025,
      sens: "iesire",
      tipDocument: "contract_munca",
      deLa: "2025-01-01",
      panaLa: "2025-03-31",
      cautare: "demisie",
      angajatId: ID_1,
      dosar: "II.5",
      stare: "in_lucru",
      sursa: "manual",
      sort: "-data",
      grup: "tip",
      cursor: "MTA",
      limita: 100,
    });
  });

  it.each([
    ["sens", { sens: "primit" }, "sens", null],
    ["tip cu majuscule", { tip: "Contract" }, "tipDocument", null],
    ["de_la în format românesc", { de_la: "01.01.2025" }, "deLa", null],
    ["pana_la incomplet", { pana_la: "2025-1-1" }, "panaLa", null],
    ["limita peste maxim", { limita: String(LIMITA_MAXIMA + 1) }, "limita", LIMITA_IMPLICITA],
    ["limita zero", { limita: "0" }, "limita", LIMITA_IMPLICITA],
    ["limita text", { limita: "multe" }, "limita", LIMITA_IMPLICITA],
    ["căutare prea lungă", { q: "x".repeat(121) }, "cautare", null],
    ["cursor prea lung", { cursor: "c".repeat(65) }, "cursor", null],
    ["angajat care nu e uuid", { angajat: "popescu" }, "angajatId", null],
    ["dosar cu sintaxă străină", { dosar: "II.5; drop" }, "dosar", null],
    ["stare necunoscută", { stare: "pierdute" }, "stare", null],
    ["sursă necunoscută", { sursa: "fax" }, "sursa", null],
    ["sortare cu caractere străine", { sort: "numar; drop" }, "sort", null],
    ["grupare necunoscută", { grup: "culoare" }, "grup", null],
  ])("valoare invalidă (%s) cade pe implicit, nu aruncă", (_e, brute, cheie, asteptat) => {
    const f = parseazaFiltre({ an: "2026", ...brute });
    expect(f[cheie as keyof FiltreRegistru]).toBe(asteptat);
  });

  it("anul e obligatoriu valid: un an absurd aruncă, nu se ghicește", () => {
    expect(() => parseazaFiltre({ an: "1999" })).toThrow();
    expect(() => parseazaFiltre({ an: "abc" })).toThrow();
  });

  it("limita maximă e acceptată exact la prag", () => {
    expect(parseazaFiltre({ an: "2026", limita: String(LIMITA_MAXIMA) }).limita).toBe(
      LIMITA_MAXIMA,
    );
  });
});

describe("serializeazaFiltre / cheieFiltre", () => {
  it("scrie anul mereu și doar filtrele completate, cu numele scurte din URL", () => {
    const s = serializeazaFiltre(
      filtreDe({ sens: "intern", tipDocument: "nda", deLa: "2026-01-01", cautare: "x y" }),
    );
    expect(s).toBe("an=2026&sens=intern&tip=nda&de_la=2026-01-01&q=x+y");
  });

  // `Paginare` construiește „pagina următoare" din serializare: fără cheile
  // astea, sortarea și gruparea s-ar pierde la primul „mai departe".
  it("scrie și angajatul, dosarul, starea, sursa, sortarea și gruparea", () => {
    const s = serializeazaFiltre(
      filtreDe({
        angajatId: ID_1,
        dosar: "II.5",
        stare: "anulate",
        sursa: "automat",
        sort: "-data",
        grup: "luna",
      }),
    );
    expect(s).toBe(
      `an=2026&angajat=${ID_1}&dosar=II.5&stare=anulate&sursa=automat&sort=-data&grup=luna`,
    );
  });

  it("cursorul și limita NU intră în serializare; suplimentarul da, fără valori goale", () => {
    const s = serializeazaFiltre(filtreDe({ cursor: "MTA", limita: 100 }), {
      limita: "100",
      gol: "",
    });
    expect(s).toBe("an=2026&limita=100");
  });

  it("serializarea și parsarea fac un drum dus-întors fără pierderi", () => {
    const f = filtreDe({
      sens: "iesire",
      tipDocument: "contract_munca",
      deLa: "2026-02-01",
      panaLa: "2026-02-28",
      cautare: "Popescu",
      angajatId: ID_2,
      dosar: "IV.A.3",
      stare: "rezolvate",
      sursa: "manual",
      sort: "tip",
      grup: "dosar",
      limita: LIMITA_IMPLICITA,
    });
    const inapoi = parseazaFiltre(Object.fromEntries(new URLSearchParams(serializeazaFiltre(f))));
    expect(inapoi).toEqual(f);
  });

  it("cheia diferă când diferă doar cursorul", () => {
    expect(cheieFiltre(filtreDe({ cursor: null }))).not.toBe(
      cheieFiltre(filtreDe({ cursor: "MTA" })),
    );
    expect(cheieFiltre(filtreDe({ cursor: null }))).toBe("an=2026|");
  });
});

/* -------------------------------- citiri --------------------------------- */

describe("listeazaRegistru", () => {
  it("pagina și numărătoarea poartă ACELEAȘI filtre de mulțime", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });

    await listeazaRegistru(
      ORG_ID,
      filtreDe({
        sens: "intrare",
        tipDocument: "demisie",
        deLa: "2026-01-01",
        panaLa: "2026-06-30",
        cautare: "Ion",
      }),
    );

    const [pagina, numarare] = server.apeluriPe("registru_documente");
    for (const apel of [pagina, numarare]) {
      expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
      expect(areFiltru(apel, "eq", "an", 2026)).toBe(true);
      expect(areFiltru(apel, "eq", "sens", "intrare")).toBe(true);
      expect(areFiltru(apel, "eq", "tip_document", "demisie")).toBe(true);
      expect(areFiltru(apel, "gte", "data_inregistrare", "2026-01-01")).toBe(true);
      expect(areFiltru(apel, "lte", "data_inregistrare", "2026-06-30")).toBe(true);
      expect(apel?.filtre.some((f) => f.metoda === "or")).toBe(true);
    }
    expect(numarare?.optiuni).toEqual({ count: "exact", head: true });
  });

  it("limita+1 rânduri ⇒ se arată limita, iar cursorul urmează ultimul rând vizibil", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: [randBrut(ID_1, 30), randBrut(ID_2, 29), randBrut(ID_3, 28)],
    });
    server.raspunde("registru_documente", "select", { count: 30 });

    const r = await listeazaRegistru(ORG_ID, filtreDe({ limita: 2 }));

    expect(r.randuri.map((x) => x.numar)).toEqual([30, 29]);
    expect(r.cursorUrmator).toBe(cursorNumar(29));
    expect(r.total).toBe(30);
    expect(r.sortare).toEqual({ cheie: "numar", directie: "desc" });
    const [pagina] = server.apeluriPe("registru_documente");
    expect(pagina?.filtre).toEqual(
      expect.arrayContaining([
        { metoda: "order", argumente: ["numar", { ascending: false }] },
        { metoda: "limit", argumente: [3] },
      ]),
    );
  });

  it("exact limita rânduri ⇒ ultima pagină, fără cursor", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: [randBrut(ID_1, 2), randBrut(ID_2, 1)],
    });
    server.raspunde("registru_documente", "select", { count: 2 });
    const r = await listeazaRegistru(ORG_ID, filtreDe({ limita: 2 }));
    expect(r.randuri).toHaveLength(2);
    expect(r.cursorUrmator).toBeNull();
  });

  it("cursorul se aplică DOAR paginii, nu și numărătorii (totalul nu scade pe pagina 2)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 30 });

    const r = await listeazaRegistru(ORG_ID, filtreDe({ cursor: cursorNumar(29) }));

    const [pagina, numarare] = server.apeluriPe("registru_documente");
    expect(areFiltru(pagina, "lt", "numar", 29)).toBe(true);
    expect(areFiltru(numarare, "lt", "numar")).toBe(false);
    expect(r.total).toBe(30);
  });

  it("filtrele noi ajung în interogare: angajat, dosar, stare, sursă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });

    await listeazaRegistru(
      ORG_ID,
      filtreDe({ angajatId: ID_2, dosar: "II.5", stare: "in_lucru", sursa: "manual" }),
    );

    for (const apel of server.apeluriPe("registru_documente")) {
      expect(areFiltru(apel, "eq", "angajat_id", ID_2)).toBe(true);
      expect(areFiltru(apel, "eq", "indicativ_dosar", "II.5")).toBe(true);
      expect(areFiltru(apel, "is", "anulat_la", null)).toBe(true);
      expect(areFiltru(apel, "is", "rezolvat_la", null)).toBe(true);
      expect(areFiltru(apel, "eq", "entitate_tip", "manual")).toBe(true);
    }
  });

  it.each([
    ["active", "is", "anulat_la", "not"],
    ["anulate", "not", "anulat_la", "is"],
    ["rezolvate", "not", "rezolvat_la", "is"],
  ] as const)(
    "starea „%s” pune `%s` pe `%s`, nu `%s`",
    async (stare, metoda, coloana, metodaAbsenta) => {
      const { server } = configureazaActiunea();
      server.raspunde("registru_documente", "select", { data: [] });
      server.raspunde("registru_documente", "select", { count: 0 });
      await listeazaRegistru(ORG_ID, filtreDe({ stare }));
      const [pagina] = server.apeluriPe("registru_documente");
      const pe = (m: string): boolean =>
        pagina?.filtre.some((f) => f.metoda === m && f.argumente[0] === coloana) ?? false;
      expect(pe(metoda)).toBe(true);
      expect(pe(metodaAbsenta)).toBe(false);
    },
  );

  it("sursa „automat” exclude rândurile manuale", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });
    await listeazaRegistru(ORG_ID, filtreDe({ sursa: "automat" }));
    expect(
      areFiltru(server.apeluriPe("registru_documente")[0], "neq", "entitate_tip", "manual"),
    ).toBe(true);
  });

  it("sortarea pe dată: ordine pe coloană cu NULL-urile la coadă, apoi pe numar, în aceeași direcție", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: [
        { ...randBrut(ID_1, 5), data_inregistrare: "2026-03-01" },
        { ...randBrut(ID_2, 9), data_inregistrare: "2026-02-01" },
        { ...randBrut(ID_3, 2), data_inregistrare: "2026-02-01" },
      ],
    });
    server.raspunde("registru_documente", "select", { count: 3 });

    const r = await listeazaRegistru(ORG_ID, filtreDe({ sort: "-data", limita: 2 }));

    const [pagina, numarare] = server.apeluriPe("registru_documente");
    expect(pagina?.filtre).toEqual(
      expect.arrayContaining([
        {
          metoda: "order",
          argumente: ["data_inregistrare", { ascending: false, nullsFirst: false }],
        },
        { metoda: "order", argumente: ["numar", { ascending: false }] },
      ]),
    );
    expect(numarare?.filtre.some((f) => f.metoda === "order")).toBe(false);
    expect(r.sortare).toEqual({ cheie: "data", directie: "desc" });
    // Cursorul poartă VALOAREA coloanei de sortare și numărul ultimului rând vizibil.
    expect(r.cursorUrmator).toBe(codificaCursor({ valoare: "2026-02-01", id: "9" }));
  });

  it("continuarea unei sortări pe dată e un predicat `or` cu `numar` ca departajator", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });

    await listeazaRegistru(
      ORG_ID,
      filtreDe({ sort: "data", cursor: codificaCursor({ valoare: "2026-02-01", id: "9" }) }),
    );

    const [pagina] = server.apeluriPe("registru_documente");
    const or = pagina?.filtre.find((f) => f.metoda === "or");
    expect(String(or?.argumente[0])).toBe(
      'data_inregistrare.gt."2026-02-01",and(data_inregistrare.eq."2026-02-01",numar.gt."9")',
    );
    expect(areFiltru(pagina, "lt", "numar")).toBe(false);
    expect(areFiltru(pagina, "gt", "numar")).toBe(false);
  });

  it("sortarea pe dosar (nulabil): după un NULL urmează doar NULL-urile, după numar", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: [{ ...randBrut(ID_1, 5), indicativ_dosar: null }],
    });
    server.raspunde("registru_documente", "select", { count: 1 });

    const r = await listeazaRegistru(
      ORG_ID,
      filtreDe({
        sort: "dosar",
        limita: 2,
        cursor: codificaCursor({ valoare: VALOARE_NULA, id: "3" }),
      }),
    );

    const [pagina] = server.apeluriPe("registru_documente");
    const or = pagina?.filtre.find((f) => f.metoda === "or");
    expect(String(or?.argumente[0])).toBe('and(indicativ_dosar.is.null,numar.gt."3")');
    expect(r.cursorUrmator).toBeNull();
  });

  it("o sortare nepermisă cade pe implicit, tăcut", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });
    const r = await listeazaRegistru(ORG_ID, filtreDe({ sort: "-emitent" }));
    expect(r.sortare).toEqual({ cheie: "numar", directie: "desc" });
    expect(areFiltru(server.apeluriPe("registru_documente")[0], "order", "numar")).toBe(true);
  });

  it("un cursor stricat e ignorat: prima pagină, fără `lt`", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });
    await listeazaRegistru(ORG_ID, filtreDe({ cursor: "!!!" }));
    expect(areFiltru(server.apeluriPe("registru_documente")[0], "lt", "numar")).toBe(false);
  });

  it("căutarea ghilimelează termenul și scapă metacaracterele, pe cinci coloane", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });

    await listeazaRegistru(ORG_ID, filtreDe({ cautare: "a,b(c)%d*" }));

    const or = server.apeluriPe("registru_documente")[0]?.filtre.find((f) => f.metoda === "or");
    const expresie = String(or?.argumente[0]);
    // Virgula și parantezele rămân — ghilimelele le fac inofensive; `%` e scăpat,
    // `*` (pe care PostgREST l-ar traduce în `%`) devine spațiu.
    expect(expresie).toContain('continut_rezumat.ilike."%a,b(c)\\\\%d %"');
    expect(expresie.match(/\.ilike\./gu)).toHaveLength(5);
    expect(expresie).toContain("emitent.ilike.");
  });

  it("o căutare din spații nu pune niciun `or`", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });
    await listeazaRegistru(ORG_ID, filtreDe({ cautare: "**" }));
    for (const apel of server.apeluriPe("registru_documente")) {
      expect(apel.filtre.some((f) => f.metoda === "or")).toBe(false);
    }
  });

  it("mapează rândul brut pe forma de ecran", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [randBrut(ID_1, 7)] });
    server.raspunde("registru_documente", "select", { count: 1 });

    const r = await listeazaRegistru(ORG_ID, filtreDe());

    expect(r.randuri[0]).toMatchObject({
      id: ID_1,
      numar: 7,
      numarAfisat: "7/02.09.2026",
      dataInregistrare: "2026-09-02",
      tipDocument: "demisie",
      continutRezumat: "Demisie",
      numarFile: 1,
      indicativDosar: "I-A-3",
      entitateTip: "manual",
      inregistratRetroactiv: false,
    });
  });

  it("numărătoarea nulă înseamnă zero, nu NaN", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: null });
    const r = await listeazaRegistru(ORG_ID, filtreDe());
    expect(r).toEqual({
      randuri: [],
      cursorUrmator: null,
      total: 0,
      sortare: { cheie: "numar", directie: "desc" },
    });
  });

  it("eroarea paginii sau a numărătorii se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { error: eroarePostgrest("57014") });
    await expect(listeazaRegistru(ORG_ID, filtreDe())).rejects.toMatchObject({ code: "57014" });
  });
});

describe("citesteDocumentRegistru", () => {
  const ANG = "88888888-8888-4888-8888-888888888888";
  const PARINTE = "99999999-9999-4999-8999-999999999999";
  const brutDetaliu = (peste: Record<string, unknown> = {}) => ({
    ...randBrut(ID_1, 46),
    entitate_tip: "leave_requests",
    entitate_id: ID_2,
    conexat_la: ID_3,
    angajat_id: ANG,
    punct_lucru_id: null,
    created_at: "2026-09-02T08:00:00Z",
    angajat: { full_name: "Georgescu Ioana" },
    ...peste,
  });

  it("rândul lipsă sau ascuns de RLS ⇒ null, fără alte citiri", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: null });
    expect(await citesteDocumentRegistru(ORG_ID, ID_1)).toBeNull();
    expect(server.apeluriPe("registru_documente")).toHaveLength(1);
    const [apel] = server.apeluriPe("registru_documente");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
    expect(apel?.coloane).toContain(
      "angajat:employees!registru_documente_angajat_id_fkey(full_name)",
    );
  });

  it("aduce rândul, angajatul, dosarul, conexarea în ambele sensuri — fără părinte la un tip cu pagină proprie", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: brutDetaliu() });
    server.raspunde("nomenclator_dosare", "select", {
      data: { indicativ: "I-A-3", continut: "Cereri de concediu", termen_pastrare: "5" },
    });
    server.raspunde("registru_documente", "select", {
      data: { id: ID_3, numar_afisat: "12/03.02.2026" },
    });
    server.raspunde("registru_documente", "select", {
      data: [
        {
          id: ID_2,
          numar_afisat: "50/09.10.2026",
          tip_document: "document_personal",
          continut_rezumat: "Răspuns",
        },
      ],
    });

    const d = await citesteDocumentRegistru(ORG_ID, ID_1);

    expect(d).not.toBeNull();
    expect(d?.document).toMatchObject({
      id: ID_1,
      numar: 46,
      entitateTip: "leave_requests",
      entitateId: ID_2,
      angajatId: ANG,
      punctLucruId: null,
      createdAt: "2026-09-02T08:00:00Z",
    });
    expect(d?.angajat).toEqual({ id: ANG, nume: "Georgescu Ioana" });
    expect(d?.dosar).toEqual({
      indicativ: "I-A-3",
      continut: "Cereri de concediu",
      termenPastrare: "5",
    });
    expect(d?.conexatLa).toEqual({ id: ID_3, numarAfisat: "12/03.02.2026" });
    expect(d?.conexate).toEqual([
      {
        id: ID_2,
        numarAfisat: "50/09.10.2026",
        tipDocument: "document_personal",
        continutRezumat: "Răspuns",
      },
    ]);
    expect(d?.parinteId).toBeNull();
    expect(server.apeluriPe("leave_requests")).toHaveLength(0);

    // Fiecare citire e pe organizație; dosarul e nesters și pe indicativ.
    const [dosar] = server.apeluriPe("nomenclator_dosare");
    expect(areFiltru(dosar, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(dosar, "eq", "indicativ", "I-A-3")).toBe(true);
    expect(areFiltru(dosar, "is", "deleted_at", null)).toBe(true);
    const [, conexatLa, conexate] = server.apeluriPe("registru_documente");
    expect(areFiltru(conexatLa, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(conexatLa, "eq", "id", ID_3)).toBe(true);
    expect(areFiltru(conexate, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(conexate, "eq", "conexat_la", ID_1)).toBe(true);
  });

  it("fără angajat, dosar sau conexare, nu face citirile aferente și întoarce null-uri", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: brutDetaliu({
        angajat_id: null,
        angajat: null,
        indicativ_dosar: null,
        conexat_la: null,
      }),
    });
    server.raspunde("registru_documente", "select", { data: [] });

    const d = await citesteDocumentRegistru(ORG_ID, ID_1);

    expect(d?.angajat).toBeNull();
    expect(d?.dosar).toBeNull();
    expect(d?.conexatLa).toBeNull();
    expect(d?.conexate).toEqual([]);
    expect(server.apeluriPe("nomenclator_dosare")).toHaveLength(0);
    expect(server.apeluriPe("registru_documente")).toHaveLength(2);
  });

  it.each([
    ["vehicle_documents", "vehicle_id"],
    ["fire_extinguisher_checks", "extinguisher_id"],
    ["iscir_authorizations", "equipment_id"],
    ["inventory_allocations", "item_id"],
    ["payroll_entries", "period_id"],
    ["per_diem_calculations", "business_trip_id"],
  ])("pentru %s citește părintele din `%s`, pe organizație", async (tip, coloana) => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: brutDetaliu({
        entitate_tip: tip,
        angajat_id: null,
        angajat: null,
        indicativ_dosar: null,
        conexat_la: null,
      }),
    });
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde(tip, "select", { data: { [coloana]: PARINTE } });

    const d = await citesteDocumentRegistru(ORG_ID, ID_1);

    expect(d?.parinteId).toBe(PARINTE);
    const [parinte] = server.apeluriPe(tip);
    expect(parinte?.coloane).toBe(coloana);
    expect(areFiltru(parinte, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(parinte, "eq", "id", ID_2)).toBe(true);
    expect(parinte?.terminal).toBe("maybeSingle");
  });

  it("părintele ascuns de RLS ⇒ `parinteId` null, nu eroare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: brutDetaliu({
        entitate_tip: "payroll_entries",
        angajat_id: null,
        angajat: null,
        indicativ_dosar: null,
        conexat_la: null,
      }),
    });
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("payroll_entries", "select", { data: null });

    expect((await citesteDocumentRegistru(ORG_ID, ID_1))?.parinteId).toBeNull();
  });

  it("eroarea rândului se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { error: eroarePostgrest("57014") });
    await expect(citesteDocumentRegistru(ORG_ID, ID_1)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("citesteExercitiu", () => {
  it("citește anul firmei și îl mapează", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_exercitii", "select", {
      data: {
        an: 2025,
        stare: "inchis",
        numar_de_pornire: 1,
        inchis_la: "2026-01-05T10:00:00Z",
        total_inregistrari: 412,
        amprenta: "abc",
        redeschis_la: null,
        motiv_redeschidere: null,
      },
    });

    const r = await citesteExercitiu(ORG_ID, 2025);

    expect(r).toEqual({
      an: 2025,
      stare: "inchis",
      numarDePornire: 1,
      inchisLa: "2026-01-05T10:00:00Z",
      totalInregistrari: 412,
      amprenta: "abc",
      redeschisLa: null,
      motivRedeschidere: null,
    });
    const [apel] = server.apeluriPe("registru_exercitii");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "an", 2025)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
  });

  it("anul fără rând ⇒ null", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_exercitii", "select", { data: null });
    expect(await citesteExercitiu(ORG_ID, 2024)).toBeNull();
  });

  it("eroarea se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_exercitii", "select", { error: eroarePostgrest("42501") });
    await expect(citesteExercitiu(ORG_ID, 2024)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("listeazaAni", () => {
  it("anii distincți, descrescător, cu anul curent adăugat chiar gol", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-01T09:00:00Z"));
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: [{ an: 2025 }, { an: 2025 }, { an: 2023 }],
    });

    expect(await listeazaAni(ORG_ID)).toEqual([2026, 2025, 2023]);
    expect(
      areFiltru(server.apeluriPe("registru_documente")[0], "eq", "organization_id", ORG_ID),
    ).toBe(true);
  });

  it("firmă nouă: doar anul curent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-01T09:00:00Z"));
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    expect(await listeazaAni(ORG_ID)).toEqual([2026]);
  });

  // Interogarea aduce câte un rând PER DOCUMENT: tăiată la 1000, o firmă cu
  // peste 1000 de înregistrări în anul curent pierdea tăcut toți anii anteriori
  // (capcana #2). A doua pagină sare peste anul deja văzut (`lt`).
  it("peste 1000 de documente în anul curent: a doua pagină sare la anii vechi", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-01T09:00:00Z"));
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: Array.from({ length: 1000 }, () => ({ an: 2026 })),
    });
    server.raspunde("registru_documente", "select", { data: [{ an: 2025 }] });

    expect(await listeazaAni(ORG_ID)).toEqual([2026, 2025]);
    const apeluri = server.apeluriPe("registru_documente");
    expect(apeluri).toHaveLength(2);
    expect(areFiltru(apeluri[0], "lt", "an")).toBe(false);
    expect(areFiltru(apeluri[1], "lt", "an", 2026)).toBe(true);
    for (const apel of apeluri) expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("eroarea se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { error: eroarePostgrest("57014") });
    await expect(listeazaAni(ORG_ID)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("citesteSumarAn", () => {
  const rand = (numar: number, peste: Record<string, unknown> = {}) => ({
    numar,
    sens: "intrare",
    tip_document: "cerere_concediu",
    indicativ_dosar: "II.5",
    angajat_id: ID_1,
    anulat_la: null,
    rezolvat_la: null,
    ...peste,
  });

  it("numără totalul, sensurile, anulatele, cele în lucru și cele rezolvate; adună tipurile și dosarele", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: [
        rand(1, { rezolvat_la: "2026-03-01T10:00:00Z" }),
        rand(2, { sens: "iesire", tip_document: "contract_munca", indicativ_dosar: "II.1" }),
        rand(3, {
          sens: "intern",
          tip_document: "fisa_instruire",
          indicativ_dosar: null,
          angajat_id: null,
          anulat_la: "2026-03-02T10:00:00Z",
        }),
      ],
    });

    const s = await citesteSumarAn(ORG_ID, 2026);

    expect(s).toEqual({
      total: 3,
      peSens: { intrare: 1, iesire: 1, intern: 1 },
      anulate: 1,
      inLucru: 1,
      rezolvate: 1,
      tipuri: ["cerere_concediu", "contract_munca", "fisa_instruire"],
      dosare: ["II.1", "II.5"],
      peDosar: { "II.1": 1, "II.5": 1 },
    });
    const [apel] = server.apeluriPe("registru_documente");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "an", 2026)).toBe(true);
    expect(areFiltru(apel, "order", "numar")).toBe(true);
    expect(apel?.filtre).toEqual(expect.arrayContaining([{ metoda: "limit", argumente: [1000] }]));
  });

  // Capcana #2: `max_rows = 1000` trunchiază tăcut. Un an cu peste 1000 de
  // rânduri se citește în pagini, cu salt peste ultimul număr văzut.
  it("peste 1000 de rânduri continuă cu `gt` pe numar și numără tot", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: Array.from({ length: 1000 }, (_, i) => rand(i + 1)),
    });
    server.raspunde("registru_documente", "select", {
      data: [rand(1001, { tip_document: "fluturas", indicativ_dosar: "III.2" })],
    });

    const s = await citesteSumarAn(ORG_ID, 2026);

    expect(s.total).toBe(1001);
    expect(s.tipuri).toEqual(["cerere_concediu", "fluturas"]);
    const apeluri = server.apeluriPe("registru_documente");
    expect(apeluri).toHaveLength(2);
    expect(areFiltru(apeluri[1], "gt", "numar", 1000)).toBe(true);
  });

  it("anul gol: totul zero și liste goale", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    expect(await citesteSumarAn(ORG_ID, 2026)).toEqual({
      total: 0,
      peSens: { intrare: 0, iesire: 0, intern: 0 },
      anulate: 0,
      inLucru: 0,
      rezolvate: 0,
      tipuri: [],
      dosare: [],
      peDosar: {},
    });
  });

  it("eroarea se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { error: eroarePostgrest("42501") });
    await expect(citesteSumarAn(ORG_ID, 2026)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("listeazaRegistruComplet", () => {
  it("ia tot anul filtrat în pagini de 1000, cu salt pe numar, fără cursor și fără limită", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: Array.from({ length: 1000 }, (_, i) => randBrut(ID_1, i + 1)),
    });
    server.raspunde("registru_documente", "select", { data: [randBrut(ID_2, 1001)] });

    const r = await listeazaRegistruComplet(
      ORG_ID,
      filtreDe({ sens: "intrare", cursor: cursorNumar(5), limita: 2 }),
    );

    expect(r.randuri).toHaveLength(1001);
    expect(r.trunchiat).toBe(false);
    const apeluri = server.apeluriPe("registru_documente");
    expect(apeluri).toHaveLength(2);
    expect(areFiltru(apeluri[0], "eq", "sens", "intrare")).toBe(true);
    expect(areFiltru(apeluri[0], "lt", "numar")).toBe(false);
    expect(apeluri[0]?.filtre).toEqual(
      expect.arrayContaining([{ metoda: "limit", argumente: [1000] }]),
    );
    expect(areFiltru(apeluri[1], "gt", "numar", 1000)).toBe(true);
  });

  it("se oprește la plafon și spune că a tăiat", async () => {
    const { server } = configureazaActiunea();
    const pagini = MAX_RANDURI_EXPORT / 1000;
    for (let p = 0; p < pagini; p += 1) {
      server.raspunde("registru_documente", "select", {
        data: Array.from({ length: 1000 }, (_, i) => randBrut(ID_1, p * 1000 + i + 1)),
      });
    }

    const r = await listeazaRegistruComplet(ORG_ID, filtreDe());

    expect(r.randuri).toHaveLength(MAX_RANDURI_EXPORT);
    expect(r.trunchiat).toBe(true);
    expect(server.apeluriPe("registru_documente")).toHaveLength(pagini);
  });

  it("eroarea se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { error: eroarePostgrest("57014") });
    await expect(listeazaRegistruComplet(ORG_ID, filtreDe())).rejects.toMatchObject({
      code: "57014",
    });
  });
});
