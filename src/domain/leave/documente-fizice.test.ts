// src/domain/leave/documente-fizice.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  TIPURI_CU_ORIGINAL_FIZIC,
  cereOriginalFizic,
  explicatieOriginalFizic,
  modDocument,
} from "./documente-fizice";

const MIGRARE = join(
  __dirname,
  "..",
  "..",
  "..",
  "supabase",
  "migrations",
  "0106_concediu_document_original.sql",
);

describe("TIPURI_CU_ORIGINAL_FIZIC", () => {
  /**
   * Poarta care ține lista într-un singur înțeles, deși trăiește în două
   * limbaje.
   *
   * `internal.leave_requests_pregateste` decide dacă trimiterea trece fără
   * atașament; interfața decide ce mesaj arată. Dacă cele două liste se
   * despart, rezultatul e cea mai rea combinație posibilă: ecranul spune
   * „aduceți originalul, fișierul e opțional", iar baza respinge trimiterea cu
   * un P0001 care cere exact fișierul declarat opțional. Omul n-are ieșire, iar
   * mesajul îl trimite în direcția greșită.
   */
  it("e aceeași listă ca în triggerul din 0106", () => {
    const sql = readFileSync(MIGRARE, "utf8");
    const potrivire = /v_tip\.key not in \(([^)]*)\)/u.exec(sql);
    expect(potrivire, "condiția `v_tip.key not in (…)` a dispărut din migrare").not.toBeNull();

    const dinSql = (potrivire?.[1] ?? "")
      .split(",")
      .map((bucata) => bucata.trim().replace(/^'|'$/gu, ""))
      .filter((cheie) => cheie.length > 0);

    expect(dinSql).toEqual([...TIPURI_CU_ORIGINAL_FIZIC]);
  });

  it("acoperă exact cele trei acte care pleacă mai departe pe hârtie", () => {
    expect([...TIPURI_CU_ORIGINAL_FIZIC]).toEqual(["medical", "maternitate", "donator_sange"]);
  });
});

describe("cereOriginalFizic", () => {
  it("recunoaște cele trei tipuri", () => {
    expect(cereOriginalFizic("medical")).toBe(true);
    expect(cereOriginalFizic("maternitate")).toBe(true);
    expect(cereOriginalFizic("donator_sange")).toBe(true);
  });

  it("lasă restul tipurilor pe încărcare", () => {
    for (const cheie of ["casatorie", "studii", "paternal", "odihna", "deces_ruda"]) {
      expect(cereOriginalFizic(cheie)).toBe(false);
    }
  });

  it("tratează lipsa cheii ca „nu”, nu ca eroare", () => {
    // Tipul poate lipsi cât timp nimic nu e încă selectat în formular.
    expect(cereOriginalFizic(null)).toBe(false);
    expect(cereOriginalFizic(undefined)).toBe(false);
    expect(cereOriginalFizic("")).toBe(false);
  });
});

describe("explicatieOriginalFizic", () => {
  it("spune DE CE e nevoie de original, nu doar că e", () => {
    // „Aduceți originalul" fără motiv sună a birocrație inventată de firmă.
    expect(explicatieOriginalFizic("medical")).toContain("FNUASS");
    expect(explicatieOriginalFizic("maternitate")).toContain("cod 08");
    expect(explicatieOriginalFizic("donator_sange")).toContain("centrul de transfuzii");
  });

  it("tace pentru tipurile care se rezolvă prin încărcare", () => {
    expect(explicatieOriginalFizic("casatorie")).toBeNull();
    expect(explicatieOriginalFizic(null)).toBeNull();
  });
});

describe("modDocument", () => {
  it("originalul fizic bate steagul din setări", () => {
    // Chiar dacă o firmă ar debifa `necesita_document` pe concediul medical,
    // certificatul tot trebuie adus — legea nu se configurează.
    expect(modDocument("medical", true)).toBe("original_fizic");
    expect(modDocument("medical", false)).toBe("original_fizic");
  });

  it("restul urmează steagul firmei", () => {
    expect(modDocument("casatorie", true)).toBe("incarcare");
    expect(modDocument("casatorie", false)).toBe("nu");
    expect(modDocument("odihna", false)).toBe("nu");
  });
});
