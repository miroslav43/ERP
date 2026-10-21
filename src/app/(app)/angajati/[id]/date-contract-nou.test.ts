// src/app/(app)/angajati/[id]/date-contract-nou.test.ts
//
// Caseta „Contract nou” de pe fișă: ce ajunge la `creeazaContractSchema` când
// omul golește câmpul de zile de concediu. Formularul are `noValidate`, deci
// atributul `required` nu oprește trimiterea — singura plasă e schema.
import { describe, expect, it } from "vitest";

import { creeazaContractSchema } from "@/schemas/employee";

import { dateContractNou } from "./date-contract-nou";

const ANGAJAT = "00000000-0000-4000-8000-000000000001";

function formular(zile: string): FormData {
  const date = new FormData();
  date.set("numar", "12");
  date.set("data_contract", "2026-10-01");
  date.set("valabil_de_la", "2026-10-01");
  date.set("salariu_baza", "4000");
  date.set("zile_concediu_anual", zile);
  return date;
}

describe("dateContractNou", () => {
  it("un câmp de zile golit înseamnă „lipsă” (implicitul firmei), nu 0 zile", () => {
    const rezultat = creeazaContractSchema.safeParse(dateContractNou(ANGAJAT, formular("")));
    expect(rezultat.success).toBe(true);
    if (!rezultat.success) return;
    expect(rezultat.data.zile_concediu_anual).toBeNull();
  });

  it("zilele scrise explicit trec ca număr", () => {
    const rezultat = creeazaContractSchema.safeParse(dateContractNou(ANGAJAT, formular("25")));
    expect(rezultat.success).toBe(true);
    if (!rezultat.success) return;
    expect(rezultat.data.zile_concediu_anual).toBe(25);
  });

  it("zero scris explicit rămâne zero — e o alegere, nu un gol", () => {
    const rezultat = creeazaContractSchema.safeParse(dateContractNou(ANGAJAT, formular("0")));
    expect(rezultat.success).toBe(true);
    if (!rezultat.success) return;
    expect(rezultat.data.zile_concediu_anual).toBe(0);
  });
});
