import { describe, expect, it } from "vitest";
import { z } from "zod";

import { setariPontajSchema, setariPontareRapidaSchema } from "./attendance";

/**
 * Ce se întâmplă când cineva lasă o casetă goală în „Pontaj → Setări".
 *
 * ── DEFECTUL PE CARE ÎL ȚIN ÎNCHIS TESTELE ASTEA ────────────────────────────
 * `z.coerce.number()` pe șirul gol dă `Number("") === 0`. Șapte dintre
 * parametrii juridici ai ecranului au plafonul de jos chiar 0, deci o casetă
 * golită trecea validarea și se SALVA ca zero, fără niciun mesaj: „repaus
 * zilnic minim 0 ore" e o afirmație pe care n-a făcut-o nimeni, dar pe care
 * `app.verifica_pontaj` o folosește apoi ca să nu mai avertizeze niciodată.
 *
 * Pentru celelalte, mesajul exista dar era al lui zod, în engleză („Too small:
 * expected number to be >0"), și ajungea într-un `fieldErrors` pe care
 * formularul nu-l citea — omul vedea „Datele introduse nu sunt valide.".
 *
 * Ajutorul `numarObligatoriu` din `comun.ts` a fost scris exact pentru asta, cu
 * un comentariu care descrie același defect pe salariul de bază. Ecranul de
 * pontaj nu apucase să treacă pe el.
 */

const BAZA = {
  valabil_de_la: "2026-09-01",
  ore_pe_zi: 8,
  ore_pe_saptamana: 40,
  ore_maxime_saptamanale: 48,
  perioada_referinta_luni: 4,
  repaus_zilnic_minim_ore: 12,
  repaus_saptamanal_minim_ore: 48,
  noapte_start: "22:00",
  noapte_sfarsit: "06:00",
  prag_ore_noapte: 3,
  termen_compensare_suplimentare_zile: 60,
  termen_compensare_sarbatoare_zile: 30,
  pauza_masa_minute: 30,
  pauza_masa_inclusa_in_program: false,
  pauza_obligatorie_peste_ore: 6,
  observatii_juridice: null,
} as const;

/** Toate câmpurile numerice ale ecranului, cu eticheta lor de pe formular. */
const CAMPURI_NUMERICE = [
  "ore_pe_zi",
  "ore_pe_saptamana",
  "ore_maxime_saptamanale",
  "perioada_referinta_luni",
  "repaus_zilnic_minim_ore",
  "repaus_saptamanal_minim_ore",
  "prag_ore_noapte",
  "termen_compensare_suplimentare_zile",
  "termen_compensare_sarbatoare_zile",
  "pauza_masa_minute",
  "pauza_obligatorie_peste_ore",
] as const;

function erorileCampului(camp: string, valoare: unknown): readonly string[] {
  const rezultat = setariPontajSchema.safeParse({ ...BAZA, [camp]: valoare });
  if (rezultat.success) return [];
  const campuri = z.flattenError(rezultat.error).fieldErrors as Record<
    string,
    readonly string[] | undefined
  >;
  return campuri[camp] ?? [];
}

describe("setariPontajSchema — caseta goală", () => {
  it.each(CAMPURI_NUMERICE)("„%s" + " golit e REFUZAT, nu salvat ca 0", (camp) => {
    const rezultat = setariPontajSchema.safeParse({ ...BAZA, [camp]: "" });
    expect(rezultat.success).toBe(false);
  });

  it.each(CAMPURI_NUMERICE)("„%s" + " golit spune ce lipsește, în română", (camp) => {
    const erori = erorileCampului(camp, "");
    expect(erori.length).toBeGreaterThan(0);
    // Mesajul lui zod începe invariabil cu „Too small"/„Too big"/„Invalid".
    // Al nostru se termină cu punct, ca toate mesajele proiectului.
    expect(erori[0]).not.toMatch(/^(Too |Invalid|Expected)/u);
    expect(erori[0]).toMatch(/\.$/u);
  });

  it("mesajul ajunge pe CÂMP, nu pe formular — altfel ecranul n-are unde să-l pună", () => {
    const rezultat = setariPontajSchema.safeParse({ ...BAZA, ore_pe_saptamana: "" });
    expect(rezultat.success).toBe(false);
    if (rezultat.success) return;
    const flat = z.flattenError(rezultat.error);
    expect(flat.fieldErrors["ore_pe_saptamana"]).toBeDefined();
  });

  it("`null` se poartă la fel cu golul: tot un câmp necompletat e", () => {
    expect(setariPontajSchema.safeParse({ ...BAZA, pauza_masa_minute: null }).success).toBe(false);
  });

  it("valorile bune trec neatinse, inclusiv zero scris DELIBERAT", () => {
    const rezultat = setariPontajSchema.safeParse({ ...BAZA, pauza_masa_minute: 0 });
    expect(rezultat.success).toBe(true);
    if (!rezultat.success) return;
    expect(rezultat.data.pauza_masa_minute).toBe(0);
    expect(rezultat.data.ore_pe_zi).toBe(8);
  });

  it("„8,5" + " scris cu virgulă nu devine tăcut altceva", () => {
    // `Number("8,5")` e `NaN`, nu 8.5. Trebuie să iasă mesaj, nu o cifră inventată.
    expect(setariPontajSchema.safeParse({ ...BAZA, ore_pe_zi: "8,5" }).success).toBe(false);
  });

  it("data de intrare în vigoare lipsă are mesaj propriu", () => {
    const erori = erorileCampului("valabil_de_la", "");
    expect(erori.length).toBeGreaterThan(0);
    expect(erori[0]).toMatch(/\.$/u);
  });

  it("ora ferestrei de noapte lipsă are mesaj propriu", () => {
    const erori = erorileCampului("noapte_start", "");
    expect(erori.length).toBeGreaterThan(0);
    expect(erori[0]).toMatch(/\.$/u);
  });
});

describe("setariPontareRapidaSchema — ora de început", () => {
  it("modul „confirmare" + " fără oră cade PE CÂMPUL orei", () => {
    const rezultat = setariPontareRapidaSchema.safeParse({
      mod_pontare_rapida: "confirmare",
      verificare_pontare: "fara",
      program_start: null,
      necesita_aprobare: true,
    });
    expect(rezultat.success).toBe(false);
    if (rezultat.success) return;
    const flat = z.flattenError(rezultat.error);
    expect(flat.fieldErrors["program_start"]?.[0]).toContain("Completați ora de început");
  });

  it("modul „ceas" + " nu cere ora: nu propune niciun interval", () => {
    const rezultat = setariPontareRapidaSchema.safeParse({
      mod_pontare_rapida: "ceas",
      verificare_pontare: "fara",
      program_start: null,
      necesita_aprobare: true,
    });
    expect(rezultat.success).toBe(true);
  });
});
