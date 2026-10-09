import { PDFPage } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ETICHETE_CATEGORIE as ETICHETE_FLOTA,
  ETICHETE_COMBUSTIBIL as COMBUSTIBIL_FLOTA,
} from "@/app/(app)/flota/etichete";
import { randeazaPdf } from "@/lib/unelte/pdf";
import { CATEGORII_VEHICUL, COMBUSTIBILI as COMBUSTIBILI_FLOTA } from "@/schemas/fleet";

import {
  avizeFoaieParcurs,
  CATEGORII,
  COLOANA,
  COMBUSTIBILI,
  construiesteFoaieParcurs,
  ETICHETA_NORMA,
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  foaieParcursDinParametri,
  normalizeazaKm,
  normalizeazaZecimal,
  parametriFoaieParcurs,
  RANDURI_ALIMENTARI,
  TITLU_ALIMENTARI,
  TITLU_REZUMAT,
  type ParametriFoaieParcurs,
} from "./model";

const GOL: ParametriFoaieParcurs = {
  an: 2026,
  luna: 2,
  nrAuto: "",
  marca: "",
  sofer: "",
  firma: "",
  cui: "",
  nrFoaie: "",
  categorie: null,
  combustibil: null,
  utilizare: null,
  norma: null,
  kmInitial: null,
  stocInitial: null,
  cursePeZi: 1,
};

const PLIN: ParametriFoaieParcurs = {
  ...GOL,
  an: 2026,
  luna: 10,
  nrAuto: "B-123-ABC",
  marca: "Dacia Logan",
  sofer: "Radu Andrei",
  firma: "Construct SRL",
  cui: "RO12345678",
  nrFoaie: "17",
  categorie: "autoturism",
  combustibil: "motorina",
  utilizare: "agent",
  norma: 6.5,
  kmInitial: 125_000,
  stocInitial: 20,
};

const camp = (d: ReturnType<typeof construiesteFoaieParcurs>, eticheta: string) =>
  d.campuri.find((c) => c.eticheta === eticheta)?.valoare;

describe("foaia de parcurs: elementele minime din norme", () => {
  /**
   * HG 1/2016, titlul II pct. 16 alin. (2) și titlul VII pct. 68 alin. (2):
   * „categoria de vehicul utilizat, scopul și locul deplasării, kilometrii
   * parcurși, norma proprie de consum carburant pe kilometru parcurs”.
   */
  it("are cele patru elemente, și necompletată", () => {
    const d = construiesteFoaieParcurs(GOL);
    const etichete = d.campuri.map((c) => c.eticheta);
    expect(etichete).toContain("Categoria vehiculului");
    expect(etichete).toContain(ETICHETA_NORMA);
    const coloane = d.coloane.map((c) => c.eticheta);
    expect(coloane[COLOANA.loc]).toBe("Locul deplasării\n(traseul: de la – la)");
    expect(coloane[COLOANA.scop]).toBe("Scopul deplasării");
    expect(coloane[COLOANA.km]).toBe("Km\nparcurși");
  });

  it("completată, scrie categoria, norma pe 100 km și pe km, utilizarea cu temeiul", () => {
    const d = construiesteFoaieParcurs(PLIN);
    expect(camp(d, "Categoria vehiculului")).toBe("Autoturism");
    expect(camp(d, ETICHETA_NORMA)).toBe("6,5 l/100 km (0,065 l/km)");
    // Pe km, norma nu se rotunjește: 6,25 l/100 km = 0,0625 l/km, nu 0,063.
    expect(camp(construiesteFoaieParcurs({ ...PLIN, norma: 6.25 }), ETICHETA_NORMA)).toBe(
      "6,25 l/100 km (0,0625 l/km)",
    );
    expect(camp(d, "Utilizarea vehiculului")).toBe(
      "Agent de vânzări sau de achiziții — art. 25 alin. (3) lit. l) pct. 2 și art. 298 alin. (3) lit. b) Cod fiscal",
    );
    expect(camp(d, "Combustibil")).toBe("Motorină");
  });

  it("antetul de document justificativ: unitatea, CUI, numărul, perioada, data întocmirii", () => {
    const d = construiesteFoaieParcurs(PLIN);
    expect(camp(d, "Unitatea")).toBe("Construct SRL");
    expect(camp(d, "CUI")).toBe("RO12345678");
    expect(camp(d, "Foaia nr.")).toBe("17");
    expect(camp(d, "Perioada")).toBe("01.10.2026 – 31.10.2026");
    expect(camp(d, "Data întocmirii")).toBe("");
    expect(d.campuriPeDouaColoane).toBe(true);
  });
});

describe("foaia de parcurs: curse, alimentări, rezumat", () => {
  it("un rând pe zi în mod implicit; februarie 2028 (bisect) are 29", () => {
    const d = construiesteFoaieParcurs({ ...GOL, an: 2028 });
    expect(d.randuri).toHaveLength(29);
    expect(d.randuri[0]?.[COLOANA.data]).toBe("01.02.2028");
    expect(d.randuri[28]?.[COLOANA.data]).toBe("29.02.2028");
  });

  it("mai multe curse pe zi: fiecare zi apare de atâtea ori, la rând", () => {
    const d = construiesteFoaieParcurs({ ...PLIN, cursePeZi: 3 });
    expect(d.randuri).toHaveLength(31 * 3);
    expect(d.randuri.slice(0, 4).map((r) => r[COLOANA.data])).toEqual([
      "01.10.2026",
      "01.10.2026",
      "01.10.2026",
      "02.10.2026",
    ]);
  });

  it("coloana Ziua deosebește weekendul: 3 și 4 octombrie 2026 sunt Sâ și Du", () => {
    const d = construiesteFoaieParcurs(PLIN);
    expect(d.randuri.slice(0, 5).map((r) => r[COLOANA.ziua])).toEqual([
      "Jo",
      "Vi",
      "Sâ",
      "Du",
      "Lu",
    ]);
  });

  it("kilometrajul inițial intră doar pe primul rând, la plecare", () => {
    const d = construiesteFoaieParcurs(PLIN);
    expect(d.randuri[0]?.[COLOANA.kmPlecare]).toBe("125.000");
    expect(d.randuri.slice(1).every((r) => r[COLOANA.kmPlecare] === "")).toBe(true);
  });

  it("are tabelul de alimentări și rezumatul lunii, cu valorile cunoscute", () => {
    const d = construiesteFoaieParcurs(PLIN);
    const [alimentari, rezumat] = d.tabeleSuplimentare ?? [];
    expect(alimentari?.titlu).toBe(TITLU_ALIMENTARI);
    expect(alimentari?.randuri).toHaveLength(RANDURI_ALIMENTARI);
    expect(alimentari?.coloane.map((c) => c.eticheta)).toContain("Nr. bon fiscal / factură");
    expect(rezumat?.titlu).toBe(TITLU_REZUMAT);
    const valoare = (e: string) => rezumat?.randuri.find((r) => r[0] === e)?.[1];
    expect(valoare("Km la bord la începutul lunii")).toBe("125.000");
    expect(valoare("Norma proprie de consum (l/100 km)")).toBe("6,5");
    expect(valoare("Stoc la începutul lunii (l)")).toBe("20");
    expect(valoare("Total km parcurși în lună")).toBe("");
  });

  it("la electric unitatea e kWh, la GNC kg, în antet, coloane și rezumat", () => {
    const electric = construiesteFoaieParcurs({
      ...PLIN,
      combustibil: "electric",
      norma: 16,
    });
    expect(camp(electric, ETICHETA_NORMA)).toBe("16 kWh/100 km (0,16 kWh/km)");
    expect(electric.coloane[COLOANA.consum]?.eticheta).toBe("Consum\nnormat (kWh)");
    expect(electric.tabeleSuplimentare?.[1]?.randuri[3]?.[0]).toBe(
      "Norma proprie de consum (kWh/100 km)",
    );
    const gnc = construiesteFoaieParcurs({ ...PLIN, combustibil: "gnc" });
    expect(gnc.coloane[COLOANA.consum]?.eticheta).toBe("Consum\nnormat (kg)");
  });

  it("numele fișierului poartă numărul mașinii, ca două foi ale aceleiași luni să nu se calce", () => {
    expect(construiesteFoaieParcurs(PLIN).numeFisier).toBe("foaie-de-parcurs-B-123-ABC-2026-10");
    expect(construiesteFoaieParcurs(GOL).numeFisier).toBe("foaie-de-parcurs-2026-02");
  });
});

describe("parametrii din adresă", () => {
  it("citește toate câmpurile noi", () => {
    const p = parametriFoaieParcurs(
      new URLSearchParams({
        an: "2026",
        luna: "10",
        cui: "RO12345678",
        nr: "17",
        categorie: "autoutilitara",
        combustibil: "electric",
        utilizare: "urgenta",
        norma: "16,5",
        km: "125.000",
        stoc: "40",
        curse: "2",
      }),
    );
    expect(p).toMatchObject({
      cui: "RO12345678",
      nrFoaie: "17",
      categorie: "autoutilitara",
      combustibil: "electric",
      utilizare: "urgenta",
      norma: 16.5,
      kmInitial: 125_000,
      stocInitial: 40,
      cursePeZi: 2,
    });
  });

  it("valorile necunoscute devin rubrici de completat, nu ghicite", () => {
    const p = parametriFoaieParcurs(
      new URLSearchParams({
        categorie: "tanc",
        combustibil: "abur",
        utilizare: "x",
        curse: "9",
      }),
    );
    expect([p.categorie, p.combustibil, p.utilizare, p.cursePeZi]).toEqual([null, null, null, 1]);
  });

  it("norma: virgulă sau punct, cel mult trei zecimale, peste 0 și cel mult 99,9", () => {
    expect(normalizeazaZecimal("6,5", 99.9)).toBe(6.5);
    expect(normalizeazaZecimal("6.25", 99.9)).toBe(6.25);
    expect(normalizeazaZecimal("0", 99.9)).toBeNull();
    expect(normalizeazaZecimal("100", 99.9)).toBeNull();
    expect(normalizeazaZecimal("6,5 l", 99.9)).toBeNull();
    expect(normalizeazaZecimal("1e1", 99.9)).toBeNull();
  });

  it("kilometrajul: grupare cu punct sau spațiu, fără zecimale, cel mult 5.000.000", () => {
    expect(normalizeazaKm("125.000")).toBe(125_000);
    expect(normalizeazaKm("125 000")).toBe(125_000);
    expect(normalizeazaKm("0")).toBe(0);
    expect(normalizeazaKm("125,5")).toBeNull();
    expect(normalizeazaKm("6000000")).toBeNull();
    expect(normalizeazaKm("-5")).toBeNull();
  });

  it("taie câmpurile de text la 120 de caractere, CUI și numărul la 20", () => {
    const p = parametriFoaieParcurs(
      new URLSearchParams({
        sofer: "x".repeat(500),
        cui: "1".repeat(50),
        nr: "2".repeat(50),
      }),
    );
    expect(p.sofer).toHaveLength(120);
    expect(p.cui).toHaveLength(20);
    expect(p.nrFoaie).toHaveLength(20);
    const d = foaieParcursDinParametri(new URLSearchParams({ sofer: "x".repeat(500) }));
    expect(d.campuri.find((c) => c.eticheta === "Conducător auto")?.valoare).toHaveLength(120);
  });

  it("avizele spun ce valori au fost lăsate deoparte", () => {
    const q = new URLSearchParams({
      norma: "6,5 l",
      km: "125,5",
      stoc: "-3",
      curse: "7",
    });
    expect(avizeFoaieParcurs(q, parametriFoaieParcurs(q))).toEqual([
      "Norma de consum „6,5 l” nu e un număr între 0 și 99,9 l/100 km; am lăsat rubrica de completat.",
      "Kilometrajul „125,5” nu e un număr întreg de km între 0 și 5.000.000; am lăsat rubrica de completat.",
      "Stocul de la începutul lunii „-3” nu e un număr între 0 și 999 l; am lăsat rubrica de completat.",
      "Numărul de curse pe zi „7” nu e între 1 și 4; am folosit 1.",
    ]);
    const bun = new URLSearchParams({
      norma: "6,5",
      km: "125.000",
      stoc: "20",
      curse: "2",
    });
    expect(avizeFoaieParcurs(bun, parametriFoaieParcurs(bun))).toEqual([]);
  });
});

/**
 * Termenii uneltei sunt ai modulului Flotă: cine trece din foaia gratuită în
 * aplicație găsește aceleași categorii și aceiași combustibili, cu aceleași
 * etichete. Unealta nu importă din aplicație (paginile publice nu depind de
 * `(app)`), deci testul e cel care ține cele două liste împreună.
 */
describe("alinierea cu modulul Flotă", () => {
  it("categoriile sunt o submulțime a `CATEGORII_VEHICUL`, cu aceleași etichete", () => {
    for (const c of CATEGORII) {
      expect(CATEGORII_VEHICUL).toContain(c);
      expect(ETICHETE_CATEGORIE[c]).toBe(ETICHETE_FLOTA[c]);
    }
  });

  it("combustibilii sunt exact cei din Flotă, cu aceleași etichete", () => {
    expect([...COMBUSTIBILI]).toEqual([...COMBUSTIBILI_FLOTA]);
    for (const c of COMBUSTIBILI) expect(ETICHETE_COMBUSTIBIL[c]).toBe(COMBUSTIBIL_FLOTA[c]);
  });
});

/**
 * Prima randare a foii noi (8 oct 2026) tăia „Consum normat (l)” și „Semnătura
 * conducătorului” cu „…”: coloanele erau mai înguste decât etichetele lor.
 */
describe("foaia de parcurs în PDF", { timeout: 30_000 }, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["motorina", "electric"] as const)(
    "%s: nicio etichetă de coloană nu se taie cu „…”",
    async (combustibil) => {
      const texte: string[] = [];
      vi.spyOn(PDFPage.prototype, "drawText").mockImplementation((text: string) => {
        texte.push(text);
      });
      const d = construiesteFoaieParcurs({ ...PLIN, combustibil });
      await randeazaPdf(d);
      const etichete = [d.coloane, ...(d.tabeleSuplimentare ?? []).map((t) => t.coloane)]
        .flat()
        .flatMap((c) => c.eticheta.split("\n"));
      for (const e of etichete) expect(texte, e).toContain(e);
    },
  );
});
