import { describe, expect, it } from "vitest";

import { detecteazaFormatData, parseazaMoment, parseazaOra } from "./date";

describe("parseazaMoment", () => {
  it.each([
    ["05.10.2026 14:02", null, "auto", "2026-10-05T11:02:00.000Z"],
    ["05.10.2026 14:02:30", null, "auto", "2026-10-05T11:02:30.000Z"],
    ["5.10.26 14:02", null, "auto", "2026-10-05T11:02:00.000Z"],
    ["2026-10-05T14:02:00", null, "auto", "2026-10-05T11:02:00.000Z"],
    ["2026-10-05 14:02", null, "auto", "2026-10-05T11:02:00.000Z"],
    ["05/10/2026", "14:02", "zz/ll/aaaa", "2026-10-05T11:02:00.000Z"],
    ["10/05/2026", "14:02", "ll/zz/aaaa", "2026-10-05T11:02:00.000Z"],
    ["2026-01-15", "08:30", "auto", "2026-01-15T06:30:00.000Z"],
  ] as const)("„%s” + „%s” (%s) → %s", (data, ora, format, asteptat) => {
    expect(parseazaMoment(data, ora, format)?.moment).toBe(asteptat);
  });

  it("31.02 nu există în calendar", () => {
    expect(parseazaMoment("31.02.2026 10:00", null, "auto")).toBeNull();
  });

  it("serialul Excel 46300,5 e la amiază (ora României)", () => {
    // 46300 = 2026-10-05; ,5 = 12:00 ora de perete.
    const m = parseazaMoment("46300.5", null, "auto");
    expect(m?.moment).toBe("2026-10-05T09:00:00.000Z");
    expect(m?.dataRo).toBe("2026-10-05");
    expect(m?.areOra).toBe(true);
  });

  it("fără oră: ziua rămâne cea din extras, iar `areOra` e fals", () => {
    const m = parseazaMoment("24.10.2026", null, "auto");
    expect(m?.dataRo).toBe("2026-10-24");
    expect(m?.areOra).toBe(false);
  });

  it("23:30 pe 24 octombrie rămâne ziua de 24 (nu se mută în UTC)", () => {
    expect(parseazaMoment("24.10.2026 23:30", null, "auto")?.dataRo).toBe("2026-10-24");
  });

  it("noaptea schimbării orei: 25.10.2026 03:30 e după întoarcerea ceasului (EET)", () => {
    // 04:00 EEST devine 03:00 EET; 03:30 există o singură dată după schimbare… sau de
    // două ori, după convenție. `momentDinOraRomaniei` alege decalajul de la moment.
    const m = parseazaMoment("25.10.2026 03:30", null, "auto");
    expect(m).not.toBeNull();
    expect(m?.dataRo).toBe("2026-10-25");
    expect(["2026-10-25T00:30:00.000Z", "2026-10-25T01:30:00.000Z"]).toContain(m?.moment);
  });

  it("bara oblică ambiguă la `auto` → null; decisă de o parte peste 12", () => {
    expect(parseazaMoment("03/04/2026", null, "auto")).toBeNull();
    expect(parseazaMoment("13/04/2026", null, "auto")?.dataRo).toBe("2026-04-13");
    expect(parseazaMoment("04/13/2026", null, "auto")?.dataRo).toBe("2026-04-13");
  });

  it("coloana de oră separată bate ora 00:00 dintr-o celulă de dată", () => {
    expect(parseazaMoment("2026-10-05T00:00:00", "14:02", "auto")?.moment).toBe(
      "2026-10-05T11:02:00.000Z",
    );
  });

  it("o oră invalidă invalidează tot rândul", () => {
    expect(parseazaMoment("05.10.2026", "25:00", "auto")).toBeNull();
    expect(parseazaMoment("05.10.2026 25:00", null, "auto")).toBeNull();
  });

  it("anul în afara 2000–2100 e respins", () => {
    expect(parseazaMoment("05.10.1999", null, "auto")).toBeNull();
  });
});

describe("parseazaOra", () => {
  it("citește ora din forma Excel pe ziua zero și din fracție", () => {
    expect(parseazaOra("1899-12-30T14:02:00")).toEqual({ ora: 14, minut: 2, secunda: 0 });
    expect(parseazaOra("0,5")).toEqual({ ora: 12, minut: 0, secunda: 0 });
    expect(parseazaOra("14:02")).toEqual({ ora: 14, minut: 2, secunda: 0 });
    expect(parseazaOra("x")).toBeNull();
  });
});

describe("detecteazaFormatData", () => {
  it("prima parte peste 12 ⇒ zi/lună", () => {
    expect(detecteazaFormatData(["03/04/2026", "13/04/2026"])).toBe("zz/ll/aaaa");
  });
  it("a doua parte peste 12 ⇒ lună/zi", () => {
    expect(detecteazaFormatData(["04/03/2026", "04/13/2026"])).toBe("ll/zz/aaaa");
  });
  it("nimic decisiv ⇒ null (profil)", () => {
    expect(detecteazaFormatData(["03/04/2026", "05/06/2026"])).toBeNull();
  });
  it("ambele semne ⇒ null", () => {
    expect(detecteazaFormatData(["13/04/2026", "04/13/2026"])).toBeNull();
  });
  it("punctul și ISO nu sunt ambigue ⇒ auto", () => {
    expect(detecteazaFormatData(["05.10.2026", "2026-10-05 14:00"])).toBe("auto");
  });
});
