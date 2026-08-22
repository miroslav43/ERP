// Traducerea erorilor bazei în erori de acțiune.
//
// `PROGRESS.md` numește zona asta blocajul #3: „zero teste pe `src/lib/actions/`
// […] fiecare defect real a scăpat exact de aici". Fișierul e pur — nicio
// interogare, niciun mock — deci se testează direct, fără să încalce regula
// proiectului `unit` din `vitest.config.mts` („logică pură, fără I/O").

import { describe, expect, it } from "vitest";

import { isPostgrestError, mapPostgrestError } from "./errors";

const REQ = "req-0000-1111";

/** Un `PostgrestError` minimal, cu forma pe care o verifică `isPostgrestError`. */
const eroare = (code: string, message = "mesaj din bază") =>
  ({ code, message, details: "", hint: "", name: "PostgrestError" }) as never;

describe("mapPostgrestError — codurile bazei devin coduri de acțiune", () => {
  // Tabelul e scris explicit, nu derivat din `PG_ERRORS`: un test care importă
  // aceeași sursă pe care o verifică trece și după ce cineva schimbă maparea
  // din greșeală. Aici, o schimbare de intenție trebuie să atingă și testul.
  const asteptari: ReadonlyArray<readonly [string, string]> = [
    ["42501", "INTERZIS"],
    ["23505", "CONFLICT"],
    ["23503", "NEGASIT"],
    ["23514", "VALIDARE"],
    ["23502", "VALIDARE"],
    ["22001", "VALIDARE"],
    ["22P02", "VALIDARE"],
    ["P0001", "CONFLICT"],
    ["40001", "CONFLICT"],
    ["40P01", "CONFLICT"],
    ["57014", "EROARE_INTERNA"],
    ["PGRST116", "NEGASIT"],
    ["PGRST301", "NEAUTENTIFICAT"],
  ];

  it.each(asteptari)("%s → %s", (cod, asteptat) => {
    expect(mapPostgrestError(eroare(cod), REQ).code).toBe(asteptat);
  });

  it("un cod necunoscut devine EROARE_INTERNA, cu cod de referință", () => {
    const rezultat = mapPostgrestError(eroare("XX999"), REQ);
    expect(rezultat.code).toBe("EROARE_INTERNA");
    expect(rezultat.message).toContain(REQ);
  });

  it("PGRST116 NU devine INTERZIS — nu confirmăm existența datelor altei firme", () => {
    // La SELECT, RLS nu aruncă: filtrează rânduri. Un `.single()` pe un rând
    // invizibil dă PGRST116. Mapat la INTERZIS, ar spune „există, dar n-ai
    // voie" — exact informația pe care izolarea între tenanți o refuză.
    const rezultat = mapPostgrestError(eroare("PGRST116"), REQ);
    expect(rezultat.code).toBe("NEGASIT");
    expect(rezultat.message).not.toMatch(/dreptul/i);
  });

  it("mesajul din bază NU se propagă către utilizator", () => {
    // Mesajele triggerelor sunt scrise în bază cu SEDILĂ (capcana 24) și pot
    // conține nume de coloane. Rămân în `audit_logs` și în logul serverului.
    const rezultat = mapPostgrestError(
      eroare("P0001", "Luna 01.2099 este blocată de utilizatorul X"),
      REQ,
    );
    expect(rezultat.message).not.toContain("2099");
    expect(rezultat.message).not.toContain("utilizatorul X");
  });
});

describe("codurile neacționabile primesc un cod de referință", () => {
  // „Datele nu respectă regulile de validare" e adevărat și inutil: omul nu
  // știe ce să corecteze. Codul îi dă ceva de citat, iar nouă linia din log.
  const neactionabile = ["23514", "23502", "22001", "22P02"];
  const actionabile = ["42501", "23505", "23503", "P0001", "PGRST116"];

  it.each(neactionabile)("%s conține requestId", (cod) => {
    expect(mapPostgrestError(eroare(cod), REQ).message).toContain(REQ);
  });

  it.each(actionabile)("%s NU conține requestId — mesajul spune deja ce s-a întâmplat", (cod) => {
    expect(mapPostgrestError(eroare(cod), REQ).message).not.toContain(REQ);
  });
});

describe("forma rezultatului", () => {
  it("requestId se propagă mereu, iar fieldErrors e null", () => {
    for (const cod of ["42501", "XX999", "23514"]) {
      const r = mapPostgrestError(eroare(cod), REQ);
      expect(r.requestId, `cod ${cod}`).toBe(REQ);
      expect(r.fieldErrors, `cod ${cod}`).toBeNull();
    }
  });
});

describe("isPostgrestError — gardă de tip", () => {
  it("acceptă doar obiecte cu code+message string și cheia details", () => {
    expect(isPostgrestError({ code: "42501", message: "x", details: "" })).toBe(true);
    expect(isPostgrestError({ code: "42501", message: "x" }), "fără `details`").toBe(false);
    expect(isPostgrestError({ code: 42501, message: "x", details: "" }), "code numeric").toBe(
      false,
    );
    expect(isPostgrestError(new Error("oarecare")), "Error simplu").toBe(false);
    expect(isPostgrestError(null)).toBe(false);
    expect(isPostgrestError("42501")).toBe(false);
  });
});
