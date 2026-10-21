// src/lib/rute/parametri.test.ts
//
// Contractul helper-elor care tratează bara de adrese ca intrare de la un
// străin. `server-only` e aliasat la `tests/stub/server-only.ts` în proiectul
// `unit`, altfel importul ar arunca.

import { describe, expect, it } from "vitest";

import { anDinUrl, esteIdDeRuta, idDinRuta, ziDinRuta } from "./parametri";

const UUID = "55555555-5555-4555-8555-555555555555";
/**
 * Nu e RFC 4122 (versiunea 0), dar Postgres îl castează fără să clipească.
 * QA l-a folosit ca „id inexistent" și a primit 404 corect — 404-ul lui vine
 * din rândul lipsă, nu din format. `z.uuid()` l-ar fi respins și ar fi
 * transformat rânduri reale cu astfel de id-uri (seed, demo) în 404.
 */
const UUID_ROTUND = "00000000-0000-0000-0000-000000000000";

describe("esteIdDeRuta", () => {
  it("acceptă UUID-ul canonic, cum îl emite gen_random_uuid()", () => {
    expect(esteIdDeRuta(UUID)).toBe(true);
  });

  it("acceptă UUID-ul „rotund” — Postgres îl castează, deci nu e o adresă imposibilă", () => {
    expect(esteIdDeRuta(UUID_ROTUND)).toBe(true);
  });

  it("acceptă literele mari — Postgres castează și așa", () => {
    expect(esteIdDeRuta(UUID.toUpperCase())).toBe(true);
  });

  it.each(["abc", "1", "IT-2026-00004", "", `${UUID}x`, UUID.replaceAll("-", "")])(
    "respinge %j: nu poate desemna niciun rând",
    (valoare) => {
      expect(esteIdDeRuta(valoare)).toBe(false);
    },
  );
});

describe("idDinRuta", () => {
  it("întoarce UUID-ul neschimbat", () => {
    expect(idDinRuta(UUID)).toBe(UUID);
    expect(idDinRuta(UUID_ROTUND)).toBe(UUID_ROTUND);
  });

  it("un segment care nu e UUID cheamă notFound() — eroarea cu digest-ul 404 al lui Next", () => {
    expect(() => idDinRuta("abc")).toThrowError(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(() => idDinRuta("IT-2026-00004")).toThrowError(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});

describe("ziDinRuta", () => {
  it("o zi care există trece neschimbată", () => {
    expect(ziDinRuta("2026-02-28")).toBe("2026-02-28");
    expect(ziDinRuta("2024-02-29")).toBe("2024-02-29");
  });

  it("31 februarie are formatul corect și nu există → notFound(), nu 22P02", () => {
    expect(() => ziDinRuta("2026-02-31")).toThrowError(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(() => ziDinRuta("2026-13-01")).toThrowError(/NEXT_HTTP_ERROR_FALLBACK;404/);
    expect(() => ziDinRuta("azi")).toThrowError(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});

describe("anDinUrl", () => {
  it("lipsă → valoarea implicită", () => {
    expect(anDinUrl(undefined, 2026)).toBe(2026);
  });

  it("un an care ar da 22003 pe coloana integer → valoarea implicită, nu eroare", () => {
    expect(anDinUrl("99999999999", 2026)).toBe(2026);
    expect(anDinUrl("-5", 2026)).toBe(2026);
    expect(anDinUrl("abc", 2026)).toBe(2026);
  });

  it("un an din interval trece; dintr-o listă se ia primul", () => {
    expect(anDinUrl("2030", 2026)).toBe(2030);
    expect(anDinUrl(["2031", "2032"], 2026)).toBe(2031);
  });
});
