import { describe, expect, it } from "vitest";

import { intervalulLunii, stareaLunii } from "./luna";

describe("intervalulLunii", () => {
  it("dă prima și ultima zi, cu două cifre", () => {
    expect(intervalulLunii(2026, 9)).toEqual({ inceput: "2026-09-01", sfarsit: "2026-09-30" });
  });

  it("nu se încurcă în februarie bisect", () => {
    expect(intervalulLunii(2028, 2).sfarsit).toBe("2028-02-29");
    expect(intervalulLunii(2026, 2).sfarsit).toBe("2026-02-28");
  });

  it("închide decembrie pe 31, nu pe 1 ianuarie", () => {
    expect(intervalulLunii(2026, 12)).toEqual({ inceput: "2026-12-01", sfarsit: "2026-12-31" });
  });
});

describe("stareaLunii", () => {
  const rand = (status: "deschisa" | "in_aprobare" | "blocata", blocataLa: string | null = null) =>
    ({
      data_inceput: "2026-10-01",
      data_sfarsit: "2026-10-31",
      status,
      blocata_la: blocataLa,
    }) as const;

  it("citește luna FĂRĂ rând ca deschisă — regula lui 0132", () => {
    const stare = stareaLunii(null, 2026, 10);
    expect(stare.deschisa).toBe(true);
    expect(stare.status).toBe("deschisa");
    expect(stare.inceputa).toBe(false);
    // Intervalul se calculează, nu se împrumută dintr-un rând care lipsește:
    // ecranele îl folosesc ca să deseneze coloanele zilelor.
    expect(stare.dataInceput).toBe("2026-10-01");
    expect(stare.dataSfarsit).toBe("2026-10-31");
  });

  it("marchează drept închisă DOAR luna blocată", () => {
    expect(stareaLunii(rand("blocata", "2026-11-02T09:00:00Z"), 2026, 10).deschisa).toBe(false);
  });

  it("lasă `in_aprobare` deschisă — baza n-o refuză (0013:293)", () => {
    expect(stareaLunii(rand("in_aprobare"), 2026, 10).deschisa).toBe(true);
  });

  it("păstrează intervalul din rând când rândul există", () => {
    // Rândul e sursa de adevăr când există: o perioadă cu interval neobișnuit
    // (corectată de cineva în bază) nu trebuie rescrisă de calculul nostru.
    const stare = stareaLunii(
      {
        data_inceput: "2026-10-05",
        data_sfarsit: "2026-10-28",
        status: "deschisa",
        blocata_la: null,
      },
      2026,
      10,
    );
    expect(stare.dataInceput).toBe("2026-10-05");
    expect(stare.dataSfarsit).toBe("2026-10-28");
    expect(stare.inceputa).toBe(true);
  });

  it("duce mai departe momentul blocării, pentru mesajul din ecran", () => {
    expect(stareaLunii(rand("blocata", "2026-11-02T09:00:00Z"), 2026, 10).blocataLa).toBe(
      "2026-11-02T09:00:00Z",
    );
  });
});
