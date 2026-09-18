import { describe, expect, it } from "vitest";

import { construiesteCerere, normalizeazaData, normalizeazaText, plusZile } from "./cerere";

/**
 * Ce apără fișierul: singura afirmație pe care unealta o face și pe care un
 * model descărcat n-o poate face — numărul de zile de concediu, cu weekendurile
 * și sărbătorile legale scoase.
 *
 * Numărul ăsta ajunge scris într-o cerere semnată și scade dintr-un sold. Dacă
 * e greșit, nu e o pagină urâtă, e o zi de concediu pierdută sau plătită în
 * plus — și nimeni n-o verifică, fiindcă vine dintr-o unealtă.
 *
 * Zilele săptămânii folosite în teste sunt verificate, nu deduse: 25.12.2026 e
 * vineri, 26.12.2026 sâmbătă, 01.01.2027 vineri, 01.12.2026 marți.
 */
describe("cererea de concediu de odihnă", () => {
  it("o săptămână obișnuită are cinci zile lucrătoare", () => {
    // 5-11 octombrie 2026: luni până duminică, fără sărbători.
    const c = construiesteCerere("2026-10-05", "2026-10-11");
    expect(c.problema).toBeNull();
    expect(c.zileCalendaristice).toBe(7);
    expect(c.zileLucratoare).toBe(5);
    expect(c.zileWeekend).toBe(2);
    expect(c.excluse).toEqual([]);
  });

  it("sărbătorile legale din interval nu se numără, și se spune care sunt", () => {
    /*
     * 30 noiembrie – 4 decembrie 2026, luni până vineri, fără niciun weekend.
     * Pe calendar sunt cinci zile; din sold se scad TREI.
     *
     * Cazul e chiar cel care justifică unealta, și a fost prins de ea: scrisesem
     * aici „patru lucrătoare", numărând doar 1 Decembrie. 30 noiembrie e Sfântul
     * Andrei, tot zi liberă legală, iar în 2026 cade luni. Cine completează un
     * model descărcat scrie cinci zile și pierde două.
     */
    const c = construiesteCerere("2026-11-30", "2026-12-04");
    expect(c.problema).toBeNull();
    expect(c.zileCalendaristice).toBe(5);
    expect(c.zileWeekend).toBe(0);

    const zile = c.excluse.map((z) => z.data);
    expect(zile).toContain("2026-11-30");
    expect(zile).toContain("2026-12-01");
    for (const zi of c.excluse) expect(zi.motiv.length, zi.data).toBeGreaterThan(3);

    expect(c.zileLucratoare).toBe(3);
  });

  it("intervalul care trece în anul următor ia sărbătorile din ambii ani", () => {
    /*
     * Capcana pe care o repară: sărbătorile se cer PE AN, iar un calcul care
     * presupune anul de început ar fi numărat 1 ianuarie ca zi lucrătoare — o zi
     * de concediu consumată degeaba, exact la cea mai populară perioadă de
     * concediu din an.
     */
    const c = construiesteCerere("2026-12-23", "2027-01-05");
    expect(c.problema).toBeNull();
    const zile = c.excluse.map((z) => z.data);
    expect(zile).toContain("2026-12-25"); // vineri
    expect(zile).toContain("2027-01-01"); // vineri
    // 26.12 și 02.01 cad sâmbăta: sunt weekend, nu sărbători excluse separat.
    expect(zile).not.toContain("2026-12-26");
    expect(zile).not.toContain("2027-01-02");
  });

  it("socoteala se închide: calendaristice = lucrătoare + weekend + excluse", () => {
    // Invariantul care prinde orice zi numărată de două ori sau deloc.
    for (const [de, pana] of [
      ["2026-01-01", "2026-01-31"],
      ["2026-04-01", "2026-04-30"],
      ["2026-12-20", "2027-01-10"],
      ["2026-06-15", "2026-06-15"],
    ] as const) {
      const c = construiesteCerere(de, pana);
      expect(c.problema, `${de} → ${pana}`).toBeNull();
      expect(c.zileLucratoare + c.zileWeekend + c.excluse.length, `${de} → ${pana}`).toBe(
        c.zileCalendaristice,
      );
    }
  });

  it("nicio zi exclusă nu e de weekend", () => {
    // Weekendurile se numără separat; dacă ar ajunge și în listă, ar fi scăzute
    // de două ori și numărul din cerere ar ieși mai mic decât realitatea.
    const c = construiesteCerere("2026-01-01", "2026-12-31");
    for (const zi of c.excluse) {
      const dow = new Date(`${zi.data}T00:00:00Z`).getUTCDay();
      expect(dow, `${zi.data} (${zi.motiv})`).not.toBe(0);
      expect(dow, `${zi.data} (${zi.motiv})`).not.toBe(6);
    }
  });

  it("o singură zi lucrătoare e un interval valid", () => {
    const c = construiesteCerere("2026-10-07", "2026-10-07");
    expect(c.problema).toBeNull();
    expect(c.zileCalendaristice).toBe(1);
    expect(c.zileLucratoare).toBe(1);
  });

  it("intervalele imposibile se resping cu un motiv, nu cu un număr greșit", () => {
    expect(construiesteCerere("2026-10-10", "2026-10-01").problema).not.toBeNull();
    // 31 februarie: `Date.UTC` l-ar muta tăcut pe 3 martie.
    expect(construiesteCerere("2026-02-31", "2026-03-05").problema).not.toBeNull();
    expect(construiesteCerere("azi", "2026-03-05").problema).not.toBeNull();
    expect(construiesteCerere("2026-01-01", "2027-06-01").problema).not.toBeNull();
  });

  it("parametrii din adresă se normalizează, nu se cred pe cuvânt", () => {
    expect(normalizeazaData("2026-07-15", "2026-01-01")).toBe("2026-07-15");
    expect(normalizeazaData("1999-07-15", "2026-01-01")).toBe("2026-01-01");
    expect(normalizeazaData("2026-02-31", "2026-01-01")).toBe("2026-01-01");
    expect(normalizeazaData(undefined, "2026-01-01")).toBe("2026-01-01");

    // Un rând nou strecurat prin adresă ar rupe documentul tipărit.
    expect(normalizeazaText("  Firma\nSRL  ")).toBe("Firma SRL");
    expect(normalizeazaText("x".repeat(500)).length).toBe(120);

    expect(plusZile("2026-12-30", 3)).toBe("2027-01-02");
  });
});
