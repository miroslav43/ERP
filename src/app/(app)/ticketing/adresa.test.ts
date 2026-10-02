// src/app/(app)/ticketing/adresa.test.ts
//
// `adresaCu` pornește din parametrii existenți și aplică o singură schimbare:
// un control nou nu are voie să le șteargă pe celelalte.

import { describe, expect, it } from "vitest";

import { adresaCu } from "./adresa";

describe("adresaCu", () => {
  it("fără parametri și fără schimbare: doar calea, fără `?` atârnat", () => {
    expect(adresaCu("/ticketing", {}, () => undefined)).toBe("/ticketing");
  });

  it("păstrează filtrele existente când se schimbă mărimea paginii", () => {
    const url = adresaCu("/ticketing/coada", { status: "nou", tip: "hardware" }, (p) =>
      p.set("limita", "50"),
    );
    expect(url).toBe("/ticketing/coada?status=nou&tip=hardware&limita=50");
  });

  it("suprascrie o cheie existentă fără s-o dubleze", () => {
    const url = adresaCu("/ticketing", { status: "nou", limita: "25" }, (p) =>
      p.set("status", "rezolvat"),
    );
    expect(url).toBe("/ticketing?status=rezolvat&limita=25");
  });

  it("schimbarea poate șterge o cheie (de pildă cursorul, la un filtru nou)", () => {
    const url = adresaCu("/ticketing", { status: "nou", cursor: "abc" }, (p) => p.delete("cursor"));
    expect(url).toBe("/ticketing?status=nou");
  });

  it("dacă schimbarea golește tot, rămâne calea simplă", () => {
    expect(adresaCu("/ticketing", { cauta: "x" }, (p) => p.delete("cauta"))).toBe("/ticketing");
  });

  it.each([
    ["valoare goală", { status: "" }],
    ["valoare lipsă", { status: undefined }],
    ["valoare repetată (tablou)", { status: ["nou", "rezolvat"] }],
  ])("%s nu se poartă mai departe", (_caz, parametri) => {
    expect(adresaCu("/ticketing", parametri, () => undefined)).toBe("/ticketing");
  });

  it("codifică textul liber: spațiu, virgulă, ampersand, diacritice", () => {
    const url = adresaCu("/ticketing", { cauta: "imprimantă, etaj 2 & 3" }, () => undefined);
    expect(url).toBe("/ticketing?cauta=imprimant%C4%83%2C+etaj+2+%26+3");
    expect(new URL(url, "https://exemplu.ro").searchParams.get("cauta")).toBe(
      "imprimantă, etaj 2 & 3",
    );
  });

  it("nu modifică obiectul primit de la pagină", () => {
    const parametri = { status: "nou" };
    adresaCu("/ticketing", parametri, (p) => p.set("status", "inchis"));
    expect(parametri).toEqual({ status: "nou" });
  });
});
