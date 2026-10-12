// src/app/(app)/registru/etichete.test.ts
//
// Etichetele registrului: sensurile cu cuvintele Legii 16/1996 art. 7, tipurile
// de document (unde un cod necunoscut cade pe forma lui curățată, niciodată pe
// un gol), rezolvarea și sursa.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ETICHETE_SENS,
  eticheteazaRezolvare,
  eticheteazaSursa,
  eticheteazaTipDocument,
} from "./etichete";

describe("ETICHETE_SENS", () => {
  it("folosește cuvintele legii: intrare, ieșire, uz intern", () => {
    expect(ETICHETE_SENS).toEqual({ intrare: "Intrare", iesire: "Ieșire", intern: "Uz intern" });
  });
});

describe("eticheteazaTipDocument", () => {
  it.each([
    ["contract_munca", "Contract individual de muncă"],
    ["act_aditional", "Act adițional la contract"],
    ["fisa_postului", "Fișa postului"],
    ["nda", "Acord de confidențialitate"],
    ["anexa_proprietate_intelectuala", "Anexă de proprietate intelectuală"],
    ["act_aditional_telemunca", "Act adițional de telemuncă"],
    ["document_personal", "Document de personal"],
    // Harta surselor (0142): codurile care ieșeau ca „Fisa eip", „Pv verificare stingator".
    ["fisa_eip", "Fișă de evidență a echipamentului individual de protecție"],
    ["pv_verificare_stingator", "Proces-verbal de verificare a stingătoarelor"],
    ["fisa_instruire", "Fișă de instruire SSM"],
    ["cerere_concediu", "Cerere de concediu"],
    ["document_vehicul", "Document al vehiculului"],
    // Documentele generate la cerere (`inregistreaza_document_generat`).
    ["stat_plata", "Stat de plată"],
    ["fluturas", "Fluturaș de salariu"],
    ["d112", "Declarația D112"],
    ["foaie_colectiva_prezenta", "Foaie colectivă de prezență"],
    // Scoase de 0142 din hartă, dar rămase ca rânduri anulate.
    ["invitatie_inrolare", "Invitație de înrolare"],
    ["nota_interna", "Notă internă"],
  ])("codul cunoscut %s are denumirea proprie", (cod, asteptat) => {
    expect(eticheteazaTipDocument(cod)).toBe(asteptat);
  });

  it.each([
    ["proces_verbal_oarecare", "Proces verbal oarecare"],
    ["demisie", "Demisie"],
    ["_x_", "X"],
  ])("codul fără denumire %s cade pe forma curățată %s", (cod, asteptat) => {
    expect(eticheteazaTipDocument(cod)).toBe(asteptat);
  });

  it("șirul gol rămâne gol, fără să arunce", () => {
    expect(eticheteazaTipDocument("")).toBe("");
  });

  // `constructor` trece de regex-ul din `inregistrareManualaSchema`
  // (`^[a-z][a-z0-9_]{1,63}$`), deci poate ajunge în `tip_document`.
  it("codul „constructor” întoarce un text, nu funcția din prototip", () => {
    const eticheta: unknown = eticheteazaTipDocument("constructor");
    expect(typeof eticheta).toBe("string");
    expect(eticheta).toBe("Constructor");
  });

  /**
   * Poarta de drift: harta SQL a surselor (`internal.registru_config_surse`,
   * rescrisă întreagă în 0142) e sursa de adevăr pentru codurile pe care le
   * scrie triggerul. Fiecare cod de acolo TREBUIE să aibă denumire aici —
   * altfel ecranul arată din nou „Pv sedinta cssm".
   */
  it("fiecare tip din harta SQL a surselor are denumire proprie", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/0142_registru_doar_ce_cere_legea.sql"),
      "utf8",
    );
    const coduri = [
      ...sql.matchAll(/\(\s*'[a-z_]+',\s*'(?:intrare|iesire|intern)',\s*'([a-z0-9_]+)',\s*'/gu),
    ].map((m) => m[1]);
    expect(coduri.length).toBeGreaterThanOrEqual(30);
    const faraDenumire = coduri.filter((cod) => {
      const eticheta = eticheteazaTipDocument(cod ?? "");
      // Forma curățată începe cu majusculă și păstrează restul codului fără `_`.
      return eticheta === (cod ?? "").replace(/_/g, " ").replace(/^./u, (c) => c.toUpperCase());
    });
    expect(faraDenumire).toEqual([]);
  });
});

describe("eticheteazaRezolvare", () => {
  it.each([
    ["aprobata", "Aprobată"],
    ["respinsa", "Respinsă"],
    ["anulata", "Anulată"],
    ["decontata", "Decontată"],
    ["finalizata", "Finalizată"],
    ["aprobat", "Aprobat"],
    ["respins", "Respins"],
    ["Răspuns expediat prin poștă", "Răspuns expediat prin poștă"],
  ])("%s → %s", (cod, asteptat) => {
    expect(eticheteazaRezolvare(cod)).toBe(asteptat);
  });

  it("lipsa rezolvării se spune cu cuvinte, nu cu „—”", () => {
    expect(eticheteazaRezolvare(null)).toBe("În lucru");
  });

  it("„constructor” nu scoate funcția din prototip", () => {
    expect(eticheteazaRezolvare("constructor")).toBe("Constructor");
  });
});

describe("eticheteazaSursa", () => {
  it.each([
    ["leave_requests", "Concedii"],
    ["hr_issued_documents", "Documente emise"],
    ["employment_contracts", "Contracte de muncă"],
    ["ssm_trainings", "SSM și PSI"],
    ["vehicle_documents", "Parc auto"],
    ["payroll_periods", "Salarizare"],
    ["manual", "Înregistrat manual"],
  ])("%s → %s", (tip, asteptat) => {
    expect(eticheteazaSursa(tip)).toBe(asteptat);
  });

  it("o sursă necunoscută cade pe forma curățată a codului", () => {
    expect(eticheteazaSursa("tabela_noua")).toBe("Tabela noua");
  });
});
