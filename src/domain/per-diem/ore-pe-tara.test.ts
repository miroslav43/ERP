// src/domain/per-diem/ore-pe-tara.test.ts
import { describe, expect, it } from "vitest";
import { orePeTara, type PunctTara } from "./ore-pe-tara";

const RO = "11111111-1111-1111-1111-111111111111";
const DE = "22222222-2222-2222-2222-222222222222";
const AT = "33333333-3333-3333-3333-333333333333";

describe("orePeTara", () => {
  it("întoarce toate orele țării implicite când nu există repere", () => {
    const plecare = new Date("2026-03-10T08:00:00Z");
    const sosire = new Date("2026-03-11T08:00:00Z");
    const rezultat = orePeTara([], plecare, sosire, plecare, sosire, RO);

    expect(rezultat).toEqual([
      { countryId: RO, ore: 24, primulMoment: plecare, ultimulMoment: sosire },
    ]);
  });

  it("împarte orele între două țări la o singură trecere de frontieră", () => {
    const plecare = new Date("2026-03-10T06:00:00Z");
    const sosire = new Date("2026-03-10T18:00:00Z");
    // Pleacă din RO, la 10:00 intră în DE.
    const etape: readonly PunctTara[] = [
      { deLa: plecare, countryId: RO },
      { deLa: new Date("2026-03-10T10:00:00Z"), countryId: DE },
    ];

    const rezultat = orePeTara(etape, plecare, sosire, plecare, sosire, RO);

    expect(rezultat).toHaveLength(2);
    const ro = rezultat.find((r) => r.countryId === RO);
    const de = rezultat.find((r) => r.countryId === DE);
    expect(ro?.ore).toBe(4);
    expect(de?.ore).toBe(8);
  });

  it("decupează intervalele la fereastra [deLa, panaLa) cerută", () => {
    const plecare = new Date("2026-03-10T00:00:00Z");
    const sosire = new Date("2026-03-13T00:00:00Z");
    const etape: readonly PunctTara[] = [
      { deLa: plecare, countryId: RO },
      { deLa: new Date("2026-03-11T12:00:00Z"), countryId: DE },
    ];

    // Cerem doar a doua fereastră de 24h (11.03 00:00 → 12.03 00:00).
    const fereastra2 = orePeTara(
      etape,
      plecare,
      sosire,
      new Date("2026-03-11T00:00:00Z"),
      new Date("2026-03-12T00:00:00Z"),
      RO,
    );

    expect(fereastra2).toHaveLength(2);
    expect(fereastra2.find((r) => r.countryId === RO)?.ore).toBe(12);
    expect(fereastra2.find((r) => r.countryId === DE)?.ore).toBe(12);
  });

  it("ignoră reperele ulterioare ferestrei cerute și pe cele de dinaintea plecării", () => {
    const plecare = new Date("2026-03-10T00:00:00Z");
    const sosire = new Date("2026-03-11T00:00:00Z");
    const etape: readonly PunctTara[] = [
      // Reper „din trecut” — nu ar trebui să apară niciodată real, dar
      // funcția tot trebuie să-l clampeze la plecare, nu să extindă intervalul.
      { deLa: new Date("2026-03-01T00:00:00Z"), countryId: RO },
      { deLa: new Date("2026-03-15T00:00:00Z"), countryId: AT },
    ];

    const rezultat = orePeTara(etape, plecare, sosire, plecare, sosire, RO);
    expect(rezultat).toEqual([
      { countryId: RO, ore: 24, primulMoment: plecare, ultimulMoment: sosire },
    ]);
  });

  it("întoarce o listă goală când fereastra cerută nu se suprapune cu nicio țară", () => {
    const plecare = new Date("2026-03-10T00:00:00Z");
    const sosire = new Date("2026-03-11T00:00:00Z");
    const rezultat = orePeTara(
      [],
      plecare,
      sosire,
      new Date("2026-03-12T00:00:00Z"),
      new Date("2026-03-13T00:00:00Z"),
      RO,
    );
    expect(rezultat).toEqual([]);
  });
});
