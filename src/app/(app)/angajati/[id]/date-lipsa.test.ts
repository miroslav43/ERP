// src/app/(app)/angajati/[id]/date-lipsa.test.ts
import { describe, expect, it } from "vitest";

import { campuriLipsa, type FisaIncompleta } from "./date-lipsa";

/**
 * Ce lipsește din fișă pentru contract și pentru REGES.
 *
 * Regula strictă din 0097 se aplică DOAR la înrolare: ecranul de editare și
 * importul rămân permisive, ca o corecție de telefon pe un angajat vechi să nu
 * ceară găsirea buletinului. Semnalul e singurul lucru care mai spune adevărul
 * despre fișele vechi — toate cele 11 din baza reală n-au niciun câmp de act.
 */
const COMPLETA: FisaIncompleta = {
  serie_act: "CJ",
  numar_act: "123456",
  act_eliberat_de: "SPCLEP Cluj-Napoca",
  act_eliberat_la: "2020-03-15",
  adresa_strada: "Str. Exemplu 1",
  adresa_oras: "Cluj-Napoca",
  adresa_judet: "Cluj",
  cnpUltimele4: "0011",
  cetatenie: "RO",
};

describe("campuriLipsa", () => {
  it("tace pe o fișă completă", () => {
    expect(campuriLipsa(COMPLETA)).toEqual([]);
  });

  it("le numește pe toate, pe o fișă goală", () => {
    const goala: FisaIncompleta = {
      serie_act: null,
      numar_act: null,
      act_eliberat_de: null,
      act_eliberat_la: null,
      adresa_strada: null,
      adresa_oras: null,
      adresa_judet: null,
      cnpUltimele4: null,
      cetatenie: "RO",
    };
    expect(campuriLipsa(goala)).toEqual([
      "seria actului de identitate",
      "numărul actului de identitate",
      "emitentul actului",
      "data eliberării actului",
      "CNP-ul",
      "adresa de domiciliu",
    ]);
  });

  it("NU cere seria unui cetățean străin — un pașaport n-are serie", () => {
    // O restanță pe care nimeni n-o poate închide e mai rea decât niciuna:
    // omul o vede la fiecare deschidere a fișei și învață să ignore semnalul.
    const strain: FisaIncompleta = { ...COMPLETA, serie_act: null, cetatenie: "DE" };
    expect(campuriLipsa(strain)).toEqual([]);
  });

  it("cere seria unui cetățean român", () => {
    expect(campuriLipsa({ ...COMPLETA, serie_act: null })).toEqual(["seria actului de identitate"]);
  });

  it("tratează șirul din spații ca pe o absență", () => {
    // `textOptional` normalizează la `null` la scriere, dar fișele vechi au
    // trecut prin alte drumuri — importul în masă, un UPDATE manual.
    expect(campuriLipsa({ ...COMPLETA, act_eliberat_de: "   " })).toEqual(["emitentul actului"]);
  });

  it("o adresă incompletă e o adresă lipsă, nu trei restanțe", () => {
    expect(campuriLipsa({ ...COMPLETA, adresa_judet: null })).toEqual(["adresa de domiciliu"]);
  });

  it("nu inventează o restanță de CNP când actorul n-are dreptul să-l vadă", () => {
    // Pagina trimite „—" când `citesteRezumatDateSensibile` n-a fost chemat:
    // fără dreptul de a citi datele sensibile nu se poate ști dacă CNP-ul
    // lipsește, iar o restanță inventată trimite omul într-un formular unde
    // n-are ce corecta.
    expect(campuriLipsa({ ...COMPLETA, cnpUltimele4: "—" })).toEqual([]);
  });
});
