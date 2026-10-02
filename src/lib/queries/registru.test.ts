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

import {
  anulCurent,
  cheieFiltre,
  citesteExercitiu,
  codificaCursor,
  decodificaCursor,
  LIMITA_IMPLICITA,
  LIMITA_MAXIMA,
  listeazaAni,
  listeazaRegistru,
  listeazaTipuriDocument,
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
  cursor: null,
  limita: 2,
  ...peste,
});

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

describe("codificaCursor / decodificaCursor", () => {
  it.each([1, 10, 437, 999_999_999])("numărul %i face drumul dus-întors", (numar) => {
    expect(decodificaCursor(codificaCursor(numar))).toBe(numar);
  });

  it("cursorul e base64url, fără caractere care cer escape în URL", () => {
    expect(codificaCursor(437)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ["null", null],
    ["text care nu e număr", Buffer.from("abc").toString("base64url")],
    ["număr negativ", Buffer.from("-5").toString("base64url")],
    ["număr cu zece cifre", Buffer.from("1234567890").toString("base64url")],
    ["zecimal", Buffer.from("1.5").toString("base64url")],
    ["gunoi", "!!!"],
  ])("cursor invalid (%s) ⇒ null", (_e, brut) => {
    expect(decodificaCursor(brut)).toBeNull();
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
    expect(r.cursorUrmator).toBe(codificaCursor(29));
    expect(r.total).toBe(30);
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

    const r = await listeazaRegistru(ORG_ID, filtreDe({ cursor: codificaCursor(29) }));

    const [pagina, numarare] = server.apeluriPe("registru_documente");
    expect(areFiltru(pagina, "lt", "numar", 29)).toBe(true);
    expect(areFiltru(numarare, "lt", "numar")).toBe(false);
    expect(r.total).toBe(30);
  });

  it("un cursor stricat e ignorat: prima pagină, fără `lt`", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });
    await listeazaRegistru(ORG_ID, filtreDe({ cursor: "!!!" }));
    expect(areFiltru(server.apeluriPe("registru_documente")[0], "lt", "numar")).toBe(false);
  });

  it("căutarea scoate caracterele care ar rupe sintaxa `or=(...)`", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });

    await listeazaRegistru(ORG_ID, filtreDe({ cautare: "a,b(c)%d*" }));

    const or = server.apeluriPe("registru_documente")[0]?.filtre.find((f) => f.metoda === "or");
    const expresie = String(or?.argumente[0]);
    expect(expresie).toContain("continut_rezumat.ilike.*a b c  d*");
    expect(expresie.split(",")).toHaveLength(4);
    expect(expresie).not.toMatch(/[()%]/);
  });

  it("o căutare făcută doar din caractere interzise nu pune niciun `or`", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { count: 0 });
    await listeazaRegistru(ORG_ID, filtreDe({ cautare: "%,()" }));
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
    expect(r).toEqual({ randuri: [], cursorUrmator: null, total: 0 });
  });

  it("eroarea paginii sau a numărătorii se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { data: [] });
    server.raspunde("registru_documente", "select", { error: eroarePostgrest("57014") });
    await expect(listeazaRegistru(ORG_ID, filtreDe())).rejects.toMatchObject({ code: "57014" });
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

  // Interogarea aduce câte un rând PER DOCUMENT, ordonat descrescător pe an și
  // tăiat la 1000: o firmă cu peste 1000 de înregistrări în anul curent pierde
  // tăcut toți anii anteriori din selector (capcana #2).
  it.fails(
    "DEFECT: peste 1000 de documente în anul curent, anii vechi dispar din listă",
    async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-05-01T09:00:00Z"));
      const { server } = configureazaActiunea();
      server.raspunde("registru_documente", "select", {
        data: Array.from({ length: 1000 }, () => ({ an: 2026 })),
      });
      // Ce ar fi întors baza dincolo de plafon, dacă funcția ar mai fi cerut.
      server.raspunde("registru_documente", "select", { data: [{ an: 2025 }] });

      expect(await listeazaAni(ORG_ID)).toEqual([2026, 2025]);
    },
  );

  // Fixează forma de AZI a defectului: o reparație (de exemplu un RPC cu
  // DISTINCT) înroșește testul ăsta, deci `it.fails` de mai sus nu poate rămâne
  // verde doar fiindcă falsul n-are programată noua interogare.
  it("stare actuală (DEFECT de mai sus): o singură citire, anii vechi lipsesc", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-01T09:00:00Z"));
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: Array.from({ length: 1000 }, () => ({ an: 2026 })),
    });

    expect(await listeazaAni(ORG_ID)).toEqual([2026]);
    expect(server.apeluri).toHaveLength(1);
    expect(server.neconsumate()).toEqual([]);
  });

  it("eroarea se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { error: eroarePostgrest("57014") });
    await expect(listeazaAni(ORG_ID)).rejects.toMatchObject({ code: "57014" });
  });
});

describe("listeazaTipuriDocument", () => {
  it("tipurile distincte ale anului, sortate alfabetic", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: [{ tip_document: "nda" }, { tip_document: "demisie" }, { tip_document: "nda" }],
    });

    expect(await listeazaTipuriDocument(ORG_ID, 2026)).toEqual(["demisie", "nda"]);
    const [apel] = server.apeluriPe("registru_documente");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "eq", "an", 2026)).toBe(true);
  });

  // Același tipar ca la ani: 1000 de rânduri-document, fără ordonare, deci un
  // tip care apare doar dincolo de plafon lipsește tăcut din filtru.
  it.fails(
    "DEFECT: un tip aflat dincolo de primele 1000 de documente lipsește din filtru",
    async () => {
      const { server } = configureazaActiunea();
      server.raspunde("registru_documente", "select", {
        data: Array.from({ length: 1000 }, () => ({ tip_document: "fluturas" })),
      });
      server.raspunde("registru_documente", "select", { data: [{ tip_document: "demisie" }] });

      expect(await listeazaTipuriDocument(ORG_ID, 2026)).toEqual(["demisie", "fluturas"]);
    },
  );

  it("stare actuală (DEFECT de mai sus): o singură citire, tipul de dincolo de plafon lipsește", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", {
      data: Array.from({ length: 1000 }, () => ({ tip_document: "fluturas" })),
    });

    expect(await listeazaTipuriDocument(ORG_ID, 2026)).toEqual(["fluturas"]);
    expect(server.apeluri).toHaveLength(1);
    expect(server.neconsumate()).toEqual([]);
  });

  it("eroarea se propagă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("registru_documente", "select", { error: eroarePostgrest("42501") });
    await expect(listeazaTipuriDocument(ORG_ID, 2026)).rejects.toMatchObject({ code: "42501" });
  });
});
