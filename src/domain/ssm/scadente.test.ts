// src/domain/ssm/scadente.test.ts
import { describe, expect, it } from "vitest";
import { PRAG_SSM_AVERTIZARE_ZILE, esteDeAtentionat, stareScadentaSsm } from "./scadente";

describe("stareScadentaSsm", () => {
  it("este „niciodata” când nu există nicio înregistrare, indiferent de dată", () => {
    expect(stareScadentaSsm(false, null, "2026-06-01")).toBe("niciodata");
    expect(stareScadentaSsm(false, "2026-01-01", "2026-06-01")).toBe("niciodata");
  });

  it("este „ok” când există o înregistrare fără scadență (fără periodicitate legală)", () => {
    expect(stareScadentaSsm(true, null, "2026-06-01")).toBe("ok");
  });

  it("este „expirat” când data e în trecut", () => {
    expect(stareScadentaSsm(true, "2026-05-31", "2026-06-01")).toBe("expirat");
  });

  it("este „critic” în ultimele 7 zile", () => {
    expect(stareScadentaSsm(true, "2026-06-08", "2026-06-01")).toBe("critic");
    expect(stareScadentaSsm(true, "2026-06-01", "2026-06-01")).toBe("critic");
  });

  it("este „atentie” între 8 și 30 de zile", () => {
    expect(stareScadentaSsm(true, "2026-06-09", "2026-06-01")).toBe("atentie");
    expect(stareScadentaSsm(true, "2026-07-01", "2026-06-01")).toBe("atentie");
  });

  it("este „ok” peste pragul de avertizare", () => {
    expect(stareScadentaSsm(true, "2026-07-02", "2026-06-01")).toBe("ok");
  });

  it("respectă exact pragul de avertizare din constantă", () => {
    expect(PRAG_SSM_AVERTIZARE_ZILE).toBe(30);
  });

  it("nu se lasă indusă în eroare de fusul orar la trecerea peste lună", () => {
    // 2026-02-28 → 2026-03-01: exact o zi, deși e trecere de lună/an bisect.
    expect(stareScadentaSsm(true, "2026-03-01", "2026-02-28")).toBe("critic");
  });
});

describe("esteDeAtentionat", () => {
  it("marchează toate stările în afară de „ok”", () => {
    expect(esteDeAtentionat("niciodata")).toBe(true);
    expect(esteDeAtentionat("expirat")).toBe(true);
    expect(esteDeAtentionat("critic")).toBe(true);
    expect(esteDeAtentionat("atentie")).toBe(true);
    expect(esteDeAtentionat("ok")).toBe(false);
  });
});
