// src/lib/invitatii/potrivire.test.ts
import { describe, expect, it } from "vitest";

import { descrieAdresaInvitatiei, potrivesteInvitatia } from "./potrivire";

const FISA_A = "11111111-1111-4111-8111-111111111111";
const FISA_B = "22222222-2222-4222-8222-222222222222";

describe("potrivesteInvitatia", () => {
  it("creează când nu există nimic în așteptare", () => {
    expect(potrivesteInvitatia([], "ion@exemplu.ro", FISA_A)).toEqual({ fel: "creeaza" });
  });

  it("retrimite invitația aceleiași fișe, pe aceeași adresă", () => {
    const pendinte = [{ id: "inv-1", email: "ion@exemplu.ro", employee_id: FISA_A }];
    expect(potrivesteInvitatia(pendinte, "ion@exemplu.ro", FISA_A)).toEqual({
      fel: "retrimite",
      id: "inv-1",
    });
  });

  it("nu se lasă păcălită de majuscule sau spații în adresa din bază", () => {
    const pendinte = [{ id: "inv-1", email: "  IoN@Exemplu.RO ", employee_id: null }];
    expect(potrivesteInvitatia(pendinte, "ion@exemplu.ro", null)).toEqual({
      fel: "retrimite",
      id: "inv-1",
    });
  });

  /*
   * Cazul pentru care există `invitations_employee_pending_uq` (0099): angajatul
   * înrolat fără e-mail a primit o adresă sintetică, iar acum i s-a completat
   * adresa reală în fișă. Căutarea după adresă n-ar găsi nimic și ar insera a
   * DOUA invitație pentru același om — al doilea loc din `seats_limit`, două
   * linkuri valide în circulație.
   */
  it("retrimite pe adresa nouă invitația plecată pe o adresă sintetică", () => {
    const pendinte = [{ id: "inv-1", email: "marca-0042@firma.intern", employee_id: FISA_A }];
    expect(potrivesteInvitatia(pendinte, "ion@exemplu.ro", FISA_A)).toEqual({
      fel: "retrimite",
      id: "inv-1",
    });
  });

  /*
   * ADRESA DE FAMILIE — cazul pe care 0099 îl numește explicit ca motiv al celui
   * de-al doilea index. Fără regula asta, apăsarea de pe fișa soției ar fi
   * retrimis invitația SOȚULUI și i-ar fi mutat-o pe fișa ei: cont pornit pe fișa
   * greșită, fără nicio eroare pe drum.
   */
  it("refuză să atingă invitația altei fișe, chiar pe aceeași adresă", () => {
    const pendinte = [{ id: "inv-sot", email: "familie@exemplu.ro", employee_id: FISA_B }];
    expect(potrivesteInvitatia(pendinte, "familie@exemplu.ro", FISA_A)).toEqual({
      fel: "coliziune",
      adresa: "familie@exemplu.ro",
    });
  });

  it("refuză și când fișa are deja o invitație, iar adresa nouă e a altcuiva", () => {
    const pendinte = [
      { id: "inv-1", email: "marca-0042@firma.intern", employee_id: FISA_A },
      { id: "inv-sot", email: "familie@exemplu.ro", employee_id: FISA_B },
    ];
    expect(potrivesteInvitatia(pendinte, "familie@exemplu.ro", FISA_A)).toEqual({
      fel: "coliziune",
      adresa: "familie@exemplu.ro",
    });
  });

  it("preia invitația de membru pur de pe aceeași adresă și o leagă de fișă", () => {
    const pendinte = [{ id: "inv-membru", email: "ion@exemplu.ro", employee_id: null }];
    expect(potrivesteInvitatia(pendinte, "ion@exemplu.ro", FISA_A)).toEqual({
      fel: "retrimite",
      id: "inv-membru",
    });
  });

  it("din ecranul de membri, identitatea e adresa, nu fișa", () => {
    const pendinte = [{ id: "inv-1", email: "ion@exemplu.ro", employee_id: FISA_B }];
    expect(potrivesteInvitatia(pendinte, "ion@exemplu.ro", null)).toEqual({
      fel: "retrimite",
      id: "inv-1",
    });
    expect(potrivesteInvitatia(pendinte, "alta@exemplu.ro", null)).toEqual({ fel: "creeaza" });
  });

  it("ignoră invitațiile altor oameni pe alte adrese", () => {
    const pendinte = [
      { id: "inv-1", email: "maria@exemplu.ro", employee_id: FISA_B },
      { id: "inv-2", email: "vasile@exemplu.ro", employee_id: null },
    ];
    expect(potrivesteInvitatia(pendinte, "ion@exemplu.ro", FISA_A)).toEqual({ fel: "creeaza" });
  });
});

describe("descrieAdresaInvitatiei", () => {
  it("spune că adresa sintetică e un nume de utilizator, nu o adresă", () => {
    expect(descrieAdresaInvitatiei("marca-0042@hala-nord.intern")).toBe(
      "utilizatorul marca-0042@hala-nord.intern (fără e-mail)",
    );
  });

  it("lasă adresa reală așa cum e", () => {
    expect(descrieAdresaInvitatiei("ion@exemplu.ro")).toBe("ion@exemplu.ro");
  });
});
