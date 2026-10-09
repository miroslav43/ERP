import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AN_MAX,
  AN_MIN,
  aziIso,
  citesteData,
  construiesteCerere,
  intervalImplicit,
  normalizeazaData,
  normalizeazaText,
  plusZile,
} from "./cerere";

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

describe("intrările din adresă, citite strict (auditul din 8 oct 2026)", () => {
  it("o dată lipsă nu e o greșeală: apelantul pune implicitul", () => {
    expect(citesteData(undefined, "De la")).toEqual({ data: null, problema: null });
    expect(citesteData("  ", "De la")).toEqual({ data: null, problema: null });
  });

  it("o dată bună trece neschimbată", () => {
    expect(citesteData("2026-11-16", "De la")).toEqual({ data: "2026-11-16", problema: null });
  });

  it("o dată prezentă dar greșită e refuzată cu motiv, nu înlocuită cu implicitul", () => {
    for (const brut of ["abc", "2026-02-30", "2026-13-01", "16.11.2026"]) {
      const citita = citesteData(brut, "De la");
      expect(citita.data, brut).toBeNull();
      expect(citita.problema, brut).toMatch(/^De la: .*nu e o dată reală\.$/u);
    }
  });

  it("anii din afara intervalului sunt refuzați, cu intervalul în mesaj", () => {
    expect(citesteData("2036-01-05", "Până la").problema).toBe(
      `Până la: anul 2036 e în afara intervalului ${String(AN_MIN)}–${String(AN_MAX)}.`,
    );
    expect(citesteData("2019-01-05", "De la").problema).toMatch(/2019/u);
  });

  it("anii 2020–2023 nu mai sunt acceptați: calendarul comun ar scădea 6 și 7 ianuarie", () => {
    expect(AN_MIN).toBe(2024);
    expect(citesteData("2023-01-06", "De la").problema).not.toBeNull();
  });
});

describe("cererea fără nicio zi lucrătoare", () => {
  it("un weekend singur nu e o cerere, dar numerele rămân pentru explicație", () => {
    const c = construiesteCerere("2026-11-14", "2026-11-15");
    expect(c.problema).toMatch(/nicio zi lucrătoare/u);
    expect(c.zileWeekend).toBe(2);
  });

  it("o sărbătoare singură nu e o cerere", () => {
    expect(construiesteCerere("2026-12-01", "2026-12-01").problema).toMatch(/nicio zi lucrătoare/u);
  });

  it("o zi lucrătoare lângă un weekend e o cerere", () => {
    expect(construiesteCerere("2026-11-13", "2026-11-15").problema).toBeNull();
  });
});

describe("textul din adresă", () => {
  it("sedila devine virgulă", () => {
    // Sedilele scrise ca escape-uri: `continut.test.ts` refuză sedila în stratul de marketing.
    expect(normalizeazaText("\u015Fef de \u0163ar\u0103, \u015ETEFAN \u0162EPE\u015E")).toBe(
      "șef de țară, ȘTEFAN ȚEPEȘ",
    );
  });

  it("caracterele de control devin un singur spațiu", () => {
    expect(normalizeazaText("Popa\u000BIon\u0001\u001FSRL")).toBe("Popa Ion SRL");
  });
});

describe("ziua de azi și intervalul implicit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("azi e ziua din România, nu din UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T22:30:00Z")); // 01:30 pe 9 octombrie, ora României
    expect(aziIso()).toBe("2026-10-09");
  });

  it("implicitul începe luni, la cel puțin 60 de zile, și se termină vineri", () => {
    // 08.10.2026 + 60 = 07.12.2026, o luni; 09.10.2026 + 60 = 08.12.2026, o marți.
    expect(intervalImplicit("2026-10-08")).toEqual({ deLa: "2026-12-07", panaLa: "2026-12-11" });
    expect(intervalImplicit("2026-10-09")).toEqual({ deLa: "2026-12-14", panaLa: "2026-12-18" });
    const implicit = intervalImplicit("2026-10-08");
    expect(construiesteCerere(implicit.deLa, implicit.panaLa).zileLucratoare).toBe(5);
  });
});

describe("salariatul de alt cult creștin — art. 139 alin. (2¹)", () => {
  it("în săptămâna Paștelui 2026 se scad datele cultului, nu cele ortodoxe", () => {
    // 30.03–10.04.2026: două săptămâni, luni–vineri, fără alte sărbători.
    const ortodox = construiesteCerere("2026-03-30", "2026-04-10");
    const gregorian = construiesteCerere("2026-03-30", "2026-04-10", "gregorian");
    expect(ortodox.zileLucratoare).toBe(9); // doar 10.04, Vinerea Mare ortodoxă
    expect(gregorian.zileLucratoare).toBe(8); // 03.04 și 06.04
    expect(gregorian.excluse.map((z) => z.data)).toEqual(["2026-04-03", "2026-04-06"]);
  });

  it("cazul din audit: 26.04–07.05.2027 are 8 zile ortodox și 10 gregorian", () => {
    expect(construiesteCerere("2027-04-26", "2027-05-07").zileLucratoare).toBe(8);
    expect(construiesteCerere("2027-04-26", "2027-05-07", "gregorian").zileLucratoare).toBe(10);
  });

  it("peste Anul Nou, fiecare an își ia Paștele din calendarul ales", () => {
    // 28.12.2026–02.04.2027: Paștele gregorian 2027 e pe 28 martie, cel ortodox pe 2 mai.
    const ortodox = construiesteCerere("2026-12-28", "2027-04-02");
    const gregorian = construiesteCerere("2026-12-28", "2027-04-02", "gregorian");
    expect(ortodox.zileLucratoare).toBe(67);
    expect(gregorian.zileLucratoare).toBe(65);
    expect(gregorian.excluse.map((z) => z.data)).toEqual([
      "2027-01-01",
      "2027-01-06",
      "2027-01-07",
      "2027-03-26",
      "2027-03-29",
    ]);
  });

  it("implicitul rămâne calendarul ortodox", () => {
    expect(construiesteCerere("2026-03-30", "2026-04-10")).toEqual(
      construiesteCerere("2026-03-30", "2026-04-10", "ortodox"),
    );
  });
});
