// src/app/(app)/onboarding/etichete.test.ts
//
// Etichetele modulului acoperă fiecare valoare din enumurile schemei — o
// valoare nouă în enum fără etichetă ar ajunge pe ecran ca text brut sau
// `undefined` — și spun adevărul despre ce nu e implementat.

import { describe, expect, it } from "vitest";

import {
  CHECKLIST_FEL_PAS,
  CHECKLIST_INSTANTA_STATUS,
  CHECKLIST_ITEM_STATUS,
  CHECKLIST_RESPONSABIL_TIP,
  CHECKLIST_TIP,
  CHECKLIST_TIP_DOVADA,
  CHECKLIST_VERIFICARE,
  CHECKLIST_VERIFICARE_IMPLEMENTATE,
  ROLURI_RESPONSABIL,
} from "@/schemas/checklist";

import {
  ETICHETE_FEL_PAS,
  ETICHETE_RESPONSABIL_TIP,
  ETICHETE_ROL,
  ETICHETE_STATUS_INSTANTA,
  ETICHETE_STATUS_ITEM,
  ETICHETE_TIP,
  ETICHETE_TIP_DOVADA,
  ETICHETE_VERIFICARE,
  TONURI_STATUS_INSTANTA,
  TONURI_STATUS_ITEM,
  VERIFICARI_IMPLEMENTATE,
} from "./etichete";

/** Tonurile pe care le desenează `<Badge>` (`TonStare` din `@/components/ui/badge`). */
const TONURI_PERMISE = ["succes", "atentie", "pericol", "neutru", "ciorna"];

describe("etichetele acoperă exact enumurile", () => {
  it.each([
    ["ETICHETE_TIP", ETICHETE_TIP, CHECKLIST_TIP],
    ["ETICHETE_STATUS_INSTANTA", ETICHETE_STATUS_INSTANTA, CHECKLIST_INSTANTA_STATUS],
    ["ETICHETE_STATUS_ITEM", ETICHETE_STATUS_ITEM, CHECKLIST_ITEM_STATUS],
    ["ETICHETE_TIP_DOVADA", ETICHETE_TIP_DOVADA, CHECKLIST_TIP_DOVADA],
    ["ETICHETE_VERIFICARE", ETICHETE_VERIFICARE, CHECKLIST_VERIFICARE],
    ["ETICHETE_RESPONSABIL_TIP", ETICHETE_RESPONSABIL_TIP, CHECKLIST_RESPONSABIL_TIP],
    ["ETICHETE_FEL_PAS", ETICHETE_FEL_PAS, CHECKLIST_FEL_PAS],
    ["ETICHETE_ROL", ETICHETE_ROL, ROLURI_RESPONSABIL],
  ] as const)(
    "%s: o etichetă nevidă pentru fiecare valoare, nimic în plus",
    (_n, harta, enumul) => {
      expect(Object.keys(harta).sort()).toEqual([...enumul].sort());
      for (const eticheta of Object.values(harta)) {
        expect(eticheta.trim().length).toBeGreaterThan(0);
      }
    },
  );

  it("nicio etichetă nu repetă valoarea brută din bază (cu `_`)", () => {
    for (const harta of [ETICHETE_VERIFICARE, ETICHETE_STATUS_ITEM, ETICHETE_RESPONSABIL_TIP]) {
      for (const eticheta of Object.values(harta)) expect(eticheta).not.toContain("_");
    }
  });
});

describe("tonurile stărilor", () => {
  it.each([
    ["instanță", TONURI_STATUS_INSTANTA, CHECKLIST_INSTANTA_STATUS],
    ["pas", TONURI_STATUS_ITEM, CHECKLIST_ITEM_STATUS],
  ] as const)("fiecare stare de %s are un ton", (_n, harta, enumul) => {
    expect(Object.keys(harta).sort()).toEqual([...enumul].sort());
    for (const ton of Object.values(harta)) expect(TONURI_PERMISE).toContain(ton);
  });

  it.each([
    ["finalizata", "succes"],
    ["in_curs", "atentie"],
    ["anulata", "neutru"],
  ] as const)("instanța `%s` are tonul `%s` (în curs cere atenție, nu e reușită)", (s, ton) => {
    expect(TONURI_STATUS_INSTANTA[s]).toBe(ton);
  });

  it("doar `bifat` e reușită la pași; `de_facut` e ciornă, nu neutru", () => {
    expect(TONURI_STATUS_ITEM.bifat).toBe("succes");
    expect(TONURI_STATUS_ITEM.de_facut).toBe("ciorna");
    expect(TONURI_STATUS_ITEM.in_lucru).toBe("atentie");
  });
});

describe("verificările automate", () => {
  it("lista oferită de ecran e ACEEAȘI cu cea a schemei, nu o copie", () => {
    expect(VERIFICARI_IMPLEMENTATE).toBe(CHECKLIST_VERIFICARE_IMPLEMENTATE);
  });

  it("verificările fără mecanism (D4) sunt numite ca neimplementate și nu sunt oferite", () => {
    const neimplementate = CHECKLIST_VERIFICARE.filter((v) => !VERIFICARI_IMPLEMENTATE.includes(v));
    expect(neimplementate.sort()).toEqual(["acces_revocat", "documente_semnate"]);
    for (const v of neimplementate) expect(ETICHETE_VERIFICARE[v]).toContain("neimplementat");
    for (const v of VERIFICARI_IMPLEMENTATE) {
      expect(ETICHETE_VERIFICARE[v]).not.toContain("neimplementat");
    }
  });
});
