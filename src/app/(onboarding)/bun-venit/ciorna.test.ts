// src/app/(onboarding)/bun-venit/ciorna.test.ts
//
// Ciorna asistentului trăiește în `sessionStorage`, per filă. Ce apără
// fișierul: CNP-ul reprezentantului legal nu ajunge NICIODATĂ în depozit
// (prin construcție, nu prin ștergere ulterioară), lista câmpurilor salvate
// nu derivează tăcut de la pașii reali, iar pasul citit din URL e întotdeauna
// un pas care există.
import { describe, expect, it } from "vitest";

import { CAMPURI_PAS_1 } from "@/components/onboarding/pas-1-identitate";
import { CAMPURI_PAS_2 } from "@/components/onboarding/pas-2-reprezentant";
import { CAMPURI_PAS_3 } from "@/components/onboarding/pas-3-financiar";
import { CAMPURI_PAS_4 } from "@/components/onboarding/pas-4-structura";
import { CAMPURI_PAS_5 } from "@/components/onboarding/pas-5-ssm";

import {
  CAMPURI_CIORNA,
  VERSIUNE_CIORNA,
  cheiaCiornei,
  curataPentruCiorna,
  esteCiornaValida,
  pasDinUrl,
} from "./ciorna";

describe("CAMPURI_CIORNA", () => {
  it("e exact reuniunea pașilor 1–5, minus CNP-ul reprezentantului", () => {
    // Egalitate de MULȚIMI, în ambele sensuri: un câmp nou într-un pas care nu
    // ajunge în ciornă s-ar pierde la reîncărcare; un câmp din ciornă care nu
    // mai există în niciun pas ar fi o rămășiță. `ciorna.ts` e un modul neutru
    // (importat și de `page.tsx`, Server Component), deci nu poate importa
    // listele din componentele `"use client"` — le copiază, iar testul ăsta e
    // poarta împotriva driftului.
    const reuniune = new Set<string>([
      ...CAMPURI_PAS_1,
      ...CAMPURI_PAS_2,
      ...CAMPURI_PAS_3,
      ...CAMPURI_PAS_4,
      ...CAMPURI_PAS_5,
    ]);
    reuniune.delete("reprezentant_cnp");
    expect(new Set(CAMPURI_CIORNA)).toEqual(reuniune);
  });

  it("nu conține CNP-ul și nici câmpurile proprietarului sau ale planului", () => {
    for (const camp of [
      "reprezentant_cnp",
      "owner_nume",
      "owner_prenume",
      "owner_email",
      "owner_telefon",
      "plan",
      "seats_limit",
    ]) {
      expect(CAMPURI_CIORNA).not.toContain(camp);
    }
  });
});

describe("curataPentruCiorna", () => {
  it("păstrează datele firmei și elimină CNP-ul, proprietarul și planul", () => {
    const curat = curataPentruCiorna({
      cui: "14399840",
      email_contact: "contact@firma.ro",
      adresa: "Str. Lungă 1",
      banca_iban: "RO49AAAA1B31007593840000",
      cod_caen_secundare: ["6202"],
      reprezentant_legal: "Popescu Ion",
      reprezentant_cnp: "1800101221144",
      owner_nume: "Popescu",
      owner_prenume: "Ion",
      owner_email: "ion@firma.ro",
      owner_telefon: "0731234567",
      plan: "trial",
      seats_limit: 10,
    });
    expect(curat).toEqual({
      cui: "14399840",
      email_contact: "contact@firma.ro",
      adresa: "Str. Lungă 1",
      banca_iban: "RO49AAAA1B31007593840000",
      cod_caen_secundare: ["6202"],
      reprezentant_legal: "Popescu Ion",
    });
    expect(Object.keys(curat)).not.toContain("reprezentant_cnp");
  });

  it("nu scrie chei cu `undefined` — un câmp necompletat lipsește, nu e `null`", () => {
    // La rulare, `getValues()` din react-hook-form conține `undefined` pentru
    // câmpurile neatinse; tipul (cu `exactOptionalPropertyTypes`) nu-l admite,
    // de aceea trecerea prin `unknown`.
    const valori = { name: "Proba SRL", oras: undefined } as unknown as Parameters<
      typeof curataPentruCiorna
    >[0];
    const curat = curataPentruCiorna(valori);
    expect(Object.keys(curat)).toEqual(["name"]);
  });
});

describe("cheiaCiornei", () => {
  it("depinde de utilizator ȘI de firmă", () => {
    const cheie = cheiaCiornei("u1", "o1");
    expect(cheie).toBe("bun-venit.ciorna.u1.o1");
    expect(cheiaCiornei("u2", "o1")).not.toBe(cheie);
    expect(cheiaCiornei("u1", "o2")).not.toBe(cheie);
  });
});

describe("esteCiornaValida", () => {
  it("acceptă forma curentă", () => {
    expect(esteCiornaValida({ v: VERSIUNE_CIORNA, pas: 3, date: { name: "X" } })).toBe(true);
    expect(esteCiornaValida({ v: VERSIUNE_CIORNA, pas: 1, date: {} })).toBe(true);
  });

  it.each([
    ["obiect gol", {}],
    ["tablou", []],
    ["null", null],
    ["șir", "ciorna"],
    ["altă versiune", { v: 2, pas: 1, date: {} }],
    ["pas ca text", { v: 1, pas: "3", date: {} }],
    ["pas în afara intervalului", { v: 1, pas: 9, date: {} }],
    ["date ca tablou", { v: 1, pas: 3, date: [] }],
    ["date null", { v: 1, pas: 3, date: null }],
    ["fără date", { v: 1, pas: 3 }],
  ])("respinge: %s", (_, valoare) => {
    expect(esteCiornaValida(valoare)).toBe(false);
  });
});

describe("pasDinUrl", () => {
  it.each([
    [null, 1],
    ["1", 1],
    ["3", 3],
    ["5", 5],
    ["7", 7],
    // Pasul 6 („Cont proprietar") e ascuns în `/bun-venit`: cine îl cere ajunge
    // la confirmare, nu pe un ecran gol.
    ["6", 7],
    ["0", 1],
    ["9", 1],
    ["-2", 1],
    ["abc", 1],
    ["2.5", 1],
    ["", 1],
    [" 3", 1],
  ])("%j → %i", (brut, asteptat) => {
    expect(pasDinUrl(brut)).toBe(asteptat);
  });
});
