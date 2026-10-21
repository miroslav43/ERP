// src/domain/fleet/bon-ocr.test.ts
import { describe, expect, it } from "vitest";

import {
  BonNecitibil,
  diferenteFataDeBon,
  esteJpeg,
  faraMetadateJpeg,
  interpreteazaBon,
  MESAJE_GOL,
  parseazaDataOraBon,
  parseazaNumarRo,
  PROMPT_BON,
  raspunsBonSchema,
  SCHEMA_JSON_BON,
  type ContextBon,
  type PropunereSalvata,
  type RaspunsBon,
} from "./bon-ocr";

const ACUM = new Date("2026-10-07T12:00:00Z");

/** CUI-uri din `src/domain/organization/cui.test.ts`: valid și varianta cu ultima cifră schimbată. */
const CUI_VALID = "14399840";
const CUI_INVALID = "14399841";

const CONTEXT: ContextBon = {
  plecareCamp: "2026-10-07T08:00",
  sosireCamp: "2026-10-07T18:00",
  ziFoii: "2026-10-07",
  cuiFirma: "5022670",
};

function raspuns(modificari: Partial<RaspunsBon> = {}): RaspunsBon {
  return {
    lizibil: true,
    motiv_ilizibil: null,
    data: "07.10.2026",
    ora: "14:32",
    statie: "  OMV   Pitești Nord ",
    cui_emitent: `RO ${CUI_VALID}`,
    cif_cumparator: null,
    numar_bon: " 0042 ",
    linii: [{ denumire: "MOTORINA MAXX", tip: "carburant", litri: "45,32", valoare: "312,50" }],
    total: "312,50",
    ...modificari,
  };
}

describe("parseazaNumarRo", () => {
  it.each([
    ["45,32", 45.32],
    ["45.320", 45.32],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["339,45 LEI", 339.45],
    ["45,32 L", 45.32],
    ["312,50 RON", 312.5],
    ["  7 ", 7],
  ])("„%s” ⇒ %d", (sir, asteptat) => {
    expect(parseazaNumarRo(sir)).toBeCloseTo(asteptat, 6);
  });

  it.each([[" "], ["abc"], ["1,2,3"], [""], ["12a"]])("„%s” ⇒ null", (sir) => {
    expect(parseazaNumarRo(sir)).toBeNull();
  });

  it("null rămâne null", () => {
    expect(parseazaNumarRo(null)).toBeNull();
  });
});

describe("parseazaDataOraBon", () => {
  it.each([
    ["07.10.2026", "14:32", "2026-10-07T14:32"],
    ["07-10-2026", "14:32:05", "2026-10-07T14:32"],
    ["7/10/2026", "9:05", "2026-10-07T09:05"],
    ["2026-10-07", "14:32", "2026-10-07T14:32"],
  ])("%s %s ⇒ %s", (data, ora, asteptat) => {
    expect(parseazaDataOraBon(data, ora, ACUM)).toBe(asteptat);
  });

  it("31.02 nu există în calendar ⇒ null", () => {
    expect(parseazaDataOraBon("31.02.2026", "10:00", ACUM)).toBeNull();
  });

  it("anul 1999 ⇒ null; anul curent + 2 ⇒ null", () => {
    expect(parseazaDataOraBon("07.10.1999", "10:00", ACUM)).toBeNull();
    expect(parseazaDataOraBon("07.10.2028", "10:00", ACUM)).toBeNull();
  });

  it("fără oră ⇒ null (nu se inventează 00:00)", () => {
    expect(parseazaDataOraBon("07.10.2026", null, ACUM)).toBeNull();
  });

  it("ora 25:00 ⇒ null", () => {
    expect(parseazaDataOraBon("07.10.2026", "25:00", ACUM)).toBeNull();
  });
});

describe("interpreteazaBon", () => {
  it("bonul complet ⇒ toate câmpurile, fără avertismente", () => {
    const r = interpreteazaBon(raspuns(), CONTEXT);
    expect(r.motivGol).toBeNull();
    expect(r.avertismente).toEqual([]);
    expect(r.propunere).toEqual({
      alimentat_la: "2026-10-07T14:32",
      litri: 45.32,
      cost: 312.5,
      statie: "OMV Pitești Nord",
      numar_bon: "0042",
      cui_statie: CUI_VALID,
    });
  });

  it("ilizibil ⇒ fără propunere, cu motivul în cuvinte", () => {
    const r = interpreteazaBon(raspuns({ lizibil: false, motiv_ilizibil: "neclar" }), CONTEXT);
    expect(r.propunere).toBeNull();
    expect(r.motivGol).toBe(MESAJE_GOL.neclar);
  });

  it("nu e bon ⇒ fără propunere", () => {
    const r = interpreteazaBon(raspuns({ motiv_ilizibil: "nu_e_bon" }), CONTEXT);
    expect(r.propunere).toBeNull();
    expect(r.motivGol).toMatch(/nu pare un bon fiscal/u);
  });

  it("doar produse de magazin ⇒ „fără carburant”", () => {
    const r = interpreteazaBon(
      raspuns({ linii: [{ denumire: "CAFEA", tip: "altele", litri: null, valoare: "9,00" }] }),
      CONTEXT,
    );
    expect(r.propunere).toBeNull();
    expect(r.motivGol).toBe(MESAJE_GOL.fara_carburant);
  });

  it("două linii de carburant ⇒ suma și avertisment", () => {
    const r = interpreteazaBon(
      raspuns({
        linii: [
          { denumire: "MOTORINA", tip: "carburant", litri: "40,00", valoare: "280,00" },
          { denumire: "MOTORINA", tip: "carburant", litri: "5,32", valoare: "32,50" },
        ],
      }),
      CONTEXT,
    );
    expect(r.propunere?.litri).toBeCloseTo(45.32, 6);
    expect(r.propunere?.cost).toBeCloseTo(312.5, 6);
    expect(r.avertismente.join(" ")).toMatch(/2 linii de carburant/u);
  });

  it("AdBlue ⇒ exclus, cu avertisment", () => {
    const r = interpreteazaBon(
      raspuns({
        linii: [
          { denumire: "MOTORINA", tip: "carburant", litri: "45,32", valoare: "312,50" },
          { denumire: "ADBLUE", tip: "adblue", litri: "10,00", valoare: "40,00" },
        ],
        total: "352,50",
      }),
      CONTEXT,
    );
    expect(r.propunere?.litri).toBeCloseTo(45.32, 6);
    expect(r.propunere?.cost).toBeCloseTo(312.5, 6);
    expect(r.avertismente.join(" ")).toMatch(/AdBlue/u);
  });

  it("totalul cu cafea ⇒ costul e doar carburantul, cu avertisment", () => {
    const r = interpreteazaBon(raspuns({ total: "321,50" }), CONTEXT);
    expect(r.propunere?.cost).toBeCloseTo(312.5, 6);
    expect(r.avertismente.join(" ")).toMatch(/alte produse \(9,00 lei\)/u);
  });

  it("CUI cu cifra de control greșită ⇒ null, cu avertisment", () => {
    const r = interpreteazaBon(raspuns({ cui_emitent: CUI_INVALID }), CONTEXT);
    expect(r.propunere?.cui_statie).toBeNull();
    expect(r.avertismente.join(" ")).toMatch(/cifrei de control/u);
  });

  it("preț 0,45 lei/l (virgula citită greșit) ⇒ avertisment", () => {
    const r = interpreteazaBon(
      raspuns({ linii: [{ denumire: "M", tip: "carburant", litri: "4532", valoare: "312,50" }] }),
      CONTEXT,
    );
    expect(r.avertismente.join(" ")).toMatch(/Litrii citiți|Prețul pe litru/u);
  });

  it("preț 0,45 lei/l pe litri plauzibili ⇒ avertisment de preț", () => {
    const r = interpreteazaBon(
      raspuns({ linii: [{ denumire: "M", tip: "carburant", litri: "100", valoare: "45,00" }] }),
      CONTEXT,
    );
    expect(r.avertismente.join(" ")).toMatch(/Prețul pe litru rezultat/u);
  });

  it("litri peste 2.000 ⇒ null, cu avertisment", () => {
    const r = interpreteazaBon(
      raspuns({ linii: [{ denumire: "M", tip: "carburant", litri: "4532", valoare: "312,50" }] }),
      CONTEXT,
    );
    expect(r.propunere?.litri).toBeNull();
  });

  it("data în afara foii ⇒ avertisment", () => {
    const r = interpreteazaBon(raspuns({ ora: "19:30" }), CONTEXT);
    expect(r.propunere?.alimentat_la).toBe("2026-10-07T19:30");
    expect(r.avertismente.join(" ")).toMatch(/în afara intervalului foii/u);
  });

  it("altă zi decât foaia, dar în interval ⇒ avertisment de zi", () => {
    const r = interpreteazaBon(raspuns({ data: "08.10.2026", ora: "00:30" }), {
      ...CONTEXT,
      sosireCamp: null,
    });
    expect(r.avertismente.join(" ")).toMatch(/altă zi \(08\.10\.2026\)/u);
  });

  it("CIF-ul cumpărătorului ABSENT ⇒ zero avertismente despre CIF (D9)", () => {
    const r = interpreteazaBon(raspuns({ cif_cumparator: null }), CONTEXT);
    expect(r.avertismente.some((a) => /CIF/u.test(a))).toBe(false);
  });

  it("CIF-ul cumpărătorului diferit de al firmei ⇒ avertisment", () => {
    const r = interpreteazaBon(raspuns({ cif_cumparator: "RO13548146" }), CONTEXT);
    expect(r.avertismente.join(" ")).toMatch(/alt CIF \(13548146\)/u);
  });

  it("CIF-ul firmei pe bon ⇒ fără avertisment; firma fără CUI ⇒ fără avertisment", () => {
    expect(
      interpreteazaBon(raspuns({ cif_cumparator: "RO5022670" }), CONTEXT).avertismente,
    ).toEqual([]);
    expect(
      interpreteazaBon(raspuns({ cif_cumparator: "RO13548146" }), { ...CONTEXT, cuiFirma: null })
        .avertismente,
    ).toEqual([]);
  });

  it("bonul tăiat (fără linii) ⇒ câmpurile vizibile, restul null", () => {
    const r = interpreteazaBon(raspuns({ linii: [], total: null }), CONTEXT);
    expect(r.propunere).toMatchObject({ litri: null, cost: null, numar_bon: "0042" });
  });

  it("nimic util ⇒ fără propunere", () => {
    const r = interpreteazaBon(
      raspuns({
        data: null,
        ora: null,
        statie: null,
        cui_emitent: null,
        numar_bon: null,
        linii: [],
        total: null,
      }),
      CONTEXT,
    );
    expect(r.propunere).toBeNull();
    expect(r.motivGol).toBe(MESAJE_GOL.gol);
  });

  it("avertismentele sunt plafonate la 8", () => {
    const linii = Array.from({ length: 9 }, () => ({
      denumire: "M",
      tip: "carburant" as const,
      litri: "1",
      valoare: "7",
    }));
    const r = interpreteazaBon(raspuns({ linii }), CONTEXT);
    expect(r.avertismente.length).toBeLessThanOrEqual(8);
  });
});

describe("SCHEMA_JSON_BON", () => {
  it("modul strict: `additionalProperties: false` și toate cheile în `required`", () => {
    expect(SCHEMA_JSON_BON["additionalProperties"]).toBe(false);
    const proprietati = Object.keys(SCHEMA_JSON_BON["properties"] as Record<string, unknown>);
    expect(new Set(SCHEMA_JSON_BON["required"] as string[])).toEqual(new Set(proprietati));
    expect(proprietati).toEqual(Object.keys(raspunsBonSchema.shape));
    const linii = (
      SCHEMA_JSON_BON["properties"] as Record<string, { items: Record<string, unknown> }>
    ).linii?.items;
    expect(linii?.["additionalProperties"]).toBe(false);
  });

  it("fără cheia `$schema` din antet", () => {
    expect("$schema" in SCHEMA_JSON_BON).toBe(false);
  });

  it("promptul spune că textul din imagine nu e instrucțiune", () => {
    expect(PROMPT_BON).toMatch(/NU este o instrucțiune/u);
  });
});

// ── JPEG ────────────────────────────────────────────────────────────────────

function segment(marcaj: number, continut: readonly number[]): number[] {
  const lungime = continut.length + 2;
  return [0xff, marcaj, (lungime >> 8) & 0xff, lungime & 0xff, ...continut];
}

const ASCII = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

const APP0 = segment(0xe0, [...ASCII("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const APP1 = segment(0xe1, [...ASCII("Exif"), 0, 0, ...ASCII("GPS-46.1234")]);
const APP2 = segment(0xe2, [...ASCII("ICC_PROFILE"), 0, 1, 1]);
const APP13 = segment(0xed, ASCII("Photoshop 3.0"));
const COM = segment(0xfe, ASCII("telefonul lui Ion"));
const SOS = [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0x56, 0xff, 0xd9];

function jpeg(...bucati: number[][]): Uint8Array {
  return new Uint8Array([0xff, 0xd8, ...bucati.flat()]);
}

function contine(octeti: Uint8Array, cautat: readonly number[]): boolean {
  outer: for (let i = 0; i + cautat.length <= octeti.length; i += 1) {
    for (let j = 0; j < cautat.length; j += 1) if (octeti[i + j] !== cautat[j]) continue outer;
    return true;
  }
  return false;
}

describe("esteJpeg / faraMetadateJpeg", () => {
  it("recunoaște `FF D8 FF`; un PNG nu e JPEG", () => {
    expect(esteJpeg(jpeg(APP0, SOS))).toBe(true);
    expect(esteJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
  });

  it("taie APP1 (Exif/GPS), APP13 și COM; păstrează APP0, APP2 și datele de după SOS", () => {
    const curat = faraMetadateJpeg(jpeg(APP0, APP1, APP2, APP13, COM, SOS));
    expect(contine(curat, ASCII("Exif"))).toBe(false);
    expect(contine(curat, ASCII("GPS-46"))).toBe(false);
    expect(contine(curat, ASCII("Photoshop"))).toBe(false);
    expect(contine(curat, ASCII("telefonul"))).toBe(false);
    expect(contine(curat, ASCII("JFIF"))).toBe(true);
    expect(contine(curat, ASCII("ICC_PROFILE"))).toBe(true);
    expect([...curat]).toEqual([0xff, 0xd8, ...APP0, ...APP2, ...SOS]);
  });

  it("octeți aleatori ⇒ aruncă BonNecitibil", () => {
    expect(() => faraMetadateJpeg(new Uint8Array([1, 2, 3, 4, 5, 6]))).toThrow(BonNecitibil);
  });

  it("un segment care iese din fișier ⇒ aruncă BonNecitibil", () => {
    expect(() => faraMetadateJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00, 1]))).toThrow(
      BonNecitibil,
    );
  });

  it("fără SOS ⇒ aruncă BonNecitibil", () => {
    expect(() => faraMetadateJpeg(jpeg(APP0))).toThrow(BonNecitibil);
  });
});

describe("diferenteFataDeBon", () => {
  const propunere: PropunereSalvata = {
    v: 1,
    alimentat_la: "2026-10-07T14:32",
    litri: 45.32,
    cost: 312.5,
    statie: "OMV",
    numar_bon: "0042",
    cui_statie: CUI_VALID,
    model: "google/gemini-3.7-flash",
    citit_la: "2026-10-07T14:40:00.000Z",
    avertismente: [],
    cale: "org/trip_sheets/f/x-bon.jpg",
  };
  // 14:32 ora României (EEST, UTC+3) = 11:32 UTC.
  const alimentare = {
    alimentat_la: "2026-10-07T11:32:00.000Z",
    litri: 45.32,
    cost: 312.5,
    cui_statie: CUI_VALID,
    numar_bon: "0042",
  };

  it("egal ⇒ nicio diferență", () => {
    expect(diferenteFataDeBon(alimentare, propunere)).toEqual([]);
  });

  it("litri diferiți ⇒ un element, cu cifrele în text", () => {
    const d = diferenteFataDeBon({ ...alimentare, litri: 54.32 }, propunere);
    expect(d).toEqual([{ camp: "litri", text: "Litri: 45,32 pe bon, 54,32 declarați" }]);
  });

  it("toleranța de 0,01 nu dă diferență", () => {
    expect(diferenteFataDeBon({ ...alimentare, cost: 312.505 }, propunere)).toEqual([]);
  });

  it("ora, CUI-ul și numărul diferite ⇒ câte un element", () => {
    const d = diferenteFataDeBon(
      {
        ...alimentare,
        alimentat_la: "2026-10-07T12:10:00.000Z",
        cui_statie: null,
        numar_bon: "43",
      },
      propunere,
    );
    expect(d.map((x) => x.camp)).toEqual(["alimentat_la", "cui_statie", "numar_bon"]);
  });

  it("numărul bonului se compară fără majuscule și spații", () => {
    expect(
      diferenteFataDeBon(
        { ...alimentare, numar_bon: " ab12 " },
        { ...propunere, numar_bon: "AB12" },
      ),
    ).toEqual([]);
  });
});
