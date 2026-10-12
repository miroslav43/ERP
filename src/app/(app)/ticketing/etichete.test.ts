// src/app/(app)/ticketing/etichete.test.ts
//
// Etichetele și tonurile tichetelor. O stare nouă în `STATUSURI_TICHET` fără
// eticheta ei ar ajunge pe ecran ca cheie brută sau ca `undefined`.

import { describe, expect, it } from "vitest";

import { PRIORITATI } from "@/domain/ticketing/prioritate";
import { STATUSURI_TICHET, TIPURI_TICHET } from "@/domain/ticketing/stari";

import {
  DESCRIERI_TIP,
  ETICHETE_ACTIUNE_SOLICITANT,
  ETICHETE_CAMP,
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
  responsabilulTichetului,
  TONURI_PRIORITATE,
  TONURI_STATUS,
} from "./etichete";

const TONURI = ["succes", "atentie", "pericol", "neutru", "ciorna"];

describe("acoperirea enum-urilor", () => {
  it.each([
    ["ETICHETE_TIP", ETICHETE_TIP, TIPURI_TICHET],
    ["DESCRIERI_TIP", DESCRIERI_TIP, TIPURI_TICHET],
    ["ETICHETE_STATUS", ETICHETE_STATUS, STATUSURI_TICHET],
    ["TONURI_STATUS", TONURI_STATUS, STATUSURI_TICHET],
    ["ETICHETE_PRIORITATE", ETICHETE_PRIORITATE, PRIORITATI],
    ["TONURI_PRIORITATE", TONURI_PRIORITATE, PRIORITATI],
  ] as const)("%s are exact cheile enum-ului", (_nume, harta, chei) => {
    expect(Object.keys(harta).sort()).toEqual([...chei].sort());
  });
});

describe("etichetele", () => {
  it.each([
    ...Object.entries(ETICHETE_TIP),
    ...Object.entries(ETICHETE_STATUS),
    ...Object.entries(ETICHETE_PRIORITATE),
    ...Object.entries(ETICHETE_CAMP),
  ])("`%s` are text omenesc, fără sedilă", (cheie, eticheta) => {
    expect(eticheta.trim().length).toBeGreaterThan(0);
    expect(eticheta).not.toBe(cheie);
    expect(eticheta).not.toMatch(/_/u);
    expect(eticheta).not.toMatch(/[şţŞŢ]/u);
  });

  it("stările au etichete distincte", () => {
    const valori = Object.values(ETICHETE_STATUS);
    expect(new Set(valori).size).toBe(valori.length);
  });

  it("`in_asteptare` spune că mingea e la solicitant", () => {
    expect(ETICHETE_STATUS.in_asteptare).toBe("Așteaptă răspunsul tău");
  });

  it("istoricul are etichete pentru câmpurile scrise de trigger și de suprascriere", () => {
    expect(ETICHETE_CAMP).toMatchObject({ status: "Stare", prioritate: "Prioritate" });
  });
});

describe("verbele solicitantului", () => {
  // Eticheta BUTONULUI, nu a stării: „Confirm rezolvarea”, nu „Închis”. Harta
  // e parțială — solicitantul nu are verb pentru fiecare stare.
  it("cheile sunt stări cunoscute", () => {
    const cunoscute = new Set<string>(STATUSURI_TICHET);
    for (const cheie of Object.keys(ETICHETE_ACTIUNE_SOLICITANT)) {
      expect(cunoscute.has(cheie), cheie).toBe(true);
    }
  });

  it.each(Object.entries(ETICHETE_ACTIUNE_SOLICITANT))(
    "`%s` are text omenesc, fără sedilă",
    (cheie, eticheta) => {
      expect(eticheta).toBeDefined();
      expect(eticheta?.trim().length).toBeGreaterThan(0);
      expect(eticheta).not.toBe(cheie);
      expect(eticheta).not.toMatch(/_/u);
      expect(eticheta).not.toMatch(/[şţŞŢ]/u);
    },
  );

  it("verbul diferă de numele stării — un buton spune ce FACI, nu unde ajungi", () => {
    for (const [cheie, eticheta] of Object.entries(ETICHETE_ACTIUNE_SOLICITANT)) {
      expect(eticheta, cheie).not.toBe(ETICHETE_STATUS[cheie as keyof typeof ETICHETE_STATUS]);
    }
    expect(ETICHETE_ACTIUNE_SOLICITANT.inchis).toBe("Confirm rezolvarea");
    expect(ETICHETE_ACTIUNE_SOLICITANT.redeschis).toBe("Redeschide tichetul");
  });
});

describe("responsabilul tichetului, văzut de solicitant", () => {
  it("fără asignat: neatribuit", () => {
    expect(responsabilulTichetului(null, null)).toBe("Neatribuit încă");
  });

  // Angajatul are `employees:read = own`: coloana `asignat_employee_id` o vede,
  // dar rândul operatorului din `employees` nu — embed-ul vine NULL. Asta nu
  // înseamnă „nerepartizat”; pagina spunea exact asta (FLX-004).
  it("asignat fără nume vizibil: preluat de echipă, nu „neatribuit”", () => {
    expect(responsabilulTichetului("11111111-1111-4111-8111-111111111111", null)).toBe(
      "Preluat de echipa de suport",
    );
  });

  it("asignat cu nume: numele", () => {
    const text = responsabilulTichetului("11111111-1111-4111-8111-111111111111", "Pop Ana");
    expect(text).toContain("Pop Ana");
    expect(text).not.toMatch(/[şţŞŢ]/u);
  });
});

describe("tonurile", () => {
  it.each([...Object.entries(TONURI_STATUS), ...Object.entries(TONURI_PRIORITATE)])(
    "`%s` are un ton din paleta pastilei",
    (_cheie, ton) => {
      expect(TONURI).toContain(ton);
    },
  );

  it.each([
    ["nou", "ciorna"],
    ["respins", "pericol"],
    ["rezolvat", "succes"],
    ["inchis", "neutru"],
    ["anulat", "neutru"],
    ["in_lucru", "atentie"],
    ["redeschis", "atentie"],
  ] as const)("starea `%s` are tonul `%s`", (status, ton) => {
    expect(TONURI_STATUS[status]).toBe(ton);
  });

  it("prioritatea critică iese în evidență mai tare decât cea ridicată", () => {
    expect(TONURI_PRIORITATE.critica).toBe("pericol");
    expect(TONURI_PRIORITATE.ridicata).toBe("atentie");
    expect(TONURI_PRIORITATE.normala).toBe("neutru");
  });
});
