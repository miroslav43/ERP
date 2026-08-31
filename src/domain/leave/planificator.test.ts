// src/domain/leave/planificator.test.ts
import { describe, expect, it } from "vitest";

import { numaraZileCerere } from "./zile-cerere";
import {
  alegeAbsenta,
  cheieCelula,
  descriereCelula,
  legendaPlanificatorului,
  numarZileLuna,
  numeZiSaptamana,
  stareDinStatus,
  zilelePlanificatorului,
  type AbsentaCelula,
} from "./planificator";

const ODIHNA: AbsentaCelula = {
  tipId: "t1",
  tipDenumire: "Concediu de odihnă",
  tipCuloare: "#2563EB",
  stare: "aprobata",
};
const MEDICAL: AbsentaCelula = {
  tipId: "t2",
  tipDenumire: "Concediu medical",
  tipCuloare: "#DC2626",
  stare: "in_aprobare",
};

describe("numarZileLuna", () => {
  it("dă lungimea corectă pentru lunile de 30 și 31 de zile", () => {
    expect(numarZileLuna(2026, 1)).toBe(31);
    expect(numarZileLuna(2026, 4)).toBe(30);
  });

  it("distinge februarie bisect de februarie normal", () => {
    expect(numarZileLuna(2026, 2)).toBe(28);
    expect(numarZileLuna(2028, 2)).toBe(29);
  });
});

describe("zilelePlanificatorului", () => {
  it("întoarce o coloană pentru fiecare zi a lunii, în ordine", () => {
    const zile = zilelePlanificatorului(2026, 2, [], [], []);
    expect(zile).toHaveLength(28);
    expect(zile[0]?.iso).toBe("2026-02-01");
    expect(zile.at(-1)?.iso).toBe("2026-02-28");
  });

  it("numerotează ziua săptămânii ISO — luni = 1, duminică = 7", () => {
    // 1 martie 2026 e duminică, 2 martie e luni.
    const zile = zilelePlanificatorului(2026, 3, [], [], []);
    expect(zile[0]?.dowIso).toBe(7);
    expect(zile[1]?.dowIso).toBe(1);
  });

  it("umbrește weekendul", () => {
    const zile = zilelePlanificatorului(2026, 3, [], [], []);
    expect(zile[0]?.nelucratoare).toBe(true); // duminică, 1 martie
    expect(zile[1]?.nelucratoare).toBe(false); // luni, 2 martie
  });

  it("umbrește sărbătoarea națională și liberul suplimentar al firmei", () => {
    const zile = zilelePlanificatorului(2026, 3, ["2026-03-03"], ["2026-03-04"], []);
    expect(zile[2]?.nelucratoare).toBe(true);
    expect(zile[3]?.nelucratoare).toBe(true);
  });

  it("NU umbrește o sâmbătă declarată zi de recuperare", () => {
    // Ordinea din `app.este_zi_lucratoare`: recuperarea bate weekendul.
    const zile = zilelePlanificatorului(2026, 3, [], [], ["2026-03-07"]);
    const sambata = zile.find((z) => z.iso === "2026-03-07");
    expect(sambata?.dowIso).toBe(6);
    expect(sambata?.nelucratoare).toBe(false);
  });

  it("umbrește EXACT zilele pe care `numaraZileCerere` nu le numără", () => {
    // Poarta care contează: o divergență între cele două ar arăta o zi liberă
    // pe ecran din care baza scade totuși o zi din sold.
    const sarbatori = ["2026-03-03"];
    const liber = ["2026-03-04"];
    const recuperare = ["2026-03-07"];
    const zile = zilelePlanificatorului(2026, 3, sarbatori, liber, recuperare);
    const lucratoareDinPlanificator = zile.filter((z) => !z.nelucratoare).length;

    const { zileLucratoare } = numaraZileCerere(
      "2026-03-01",
      "2026-03-31",
      sarbatori,
      liber,
      recuperare,
    );
    expect(lucratoareDinPlanificator).toBe(zileLucratoare);
  });
});

describe("stareDinStatus", () => {
  it("tratează doar `aprobata` drept decisă", () => {
    expect(stareDinStatus("aprobata")).toBe("aprobata");
    expect(stareDinStatus("trimisa")).toBe("in_aprobare");
    expect(stareDinStatus("in_aprobare")).toBe("in_aprobare");
  });
});

describe("alegeAbsenta", () => {
  it("întoarce null pe celulă goală", () => {
    expect(alegeAbsenta([])).toBeNull();
  });

  it("preferă cererea decisă celei în aprobare, indiferent de ordine", () => {
    // Cazul real: un concediu medical nedecis peste un concediu de odihnă deja
    // aprobat. Pe ecran trebuie să apară ce s-a hotărât.
    expect(alegeAbsenta([MEDICAL, ODIHNA])).toBe(ODIHNA);
    expect(alegeAbsenta([ODIHNA, MEDICAL])).toBe(ODIHNA);
  });

  it("păstrează prima când niciuna nu e decisă", () => {
    const alta: AbsentaCelula = { ...ODIHNA, stare: "in_aprobare" };
    expect(alegeAbsenta([MEDICAL, alta])).toBe(MEDICAL);
  });
});

describe("cheieCelula", () => {
  it("nu confundă doi angajați pe aceeași zi", () => {
    expect(cheieCelula("a", "2026-03-09")).not.toBe(cheieCelula("b", "2026-03-09"));
  });
});

describe("legendaPlanificatorului", () => {
  it("listează doar tipurile prezente pe ecran, o singură dată, alfabetic", () => {
    const legenda = legendaPlanificatorului({
      "a|2026-03-09": [MEDICAL],
      "a|2026-03-10": [MEDICAL],
      "b|2026-03-09": [ODIHNA],
    });
    expect(legenda.map((l) => l.tipDenumire)).toEqual(["Concediu de odihnă", "Concediu medical"]);
  });

  it("întoarce o legendă goală pentru o lună fără absențe", () => {
    expect(legendaPlanificatorului({})).toEqual([]);
  });
});

describe("descriereCelula", () => {
  it("spune cine, când, ce fel și dacă s-a aprobat", () => {
    expect(descriereCelula("Ionescu Ana", "2026-03-09", ODIHNA, 0)).toBe(
      "Ionescu Ana · 09.03.2026 · Concediu de odihnă · aprobată",
    );
  });

  it("marchează starea nedecisă", () => {
    expect(descriereCelula("Popa Ion", "2026-03-09", MEDICAL, 0)).toContain("în aprobare");
  });

  it("anunță a doua cerere de pe aceeași zi, ca să nu dispară tăcut", () => {
    expect(descriereCelula("Popa Ion", "2026-03-09", ODIHNA, 1)).toContain("+1");
  });
});

describe("numeZiSaptamana", () => {
  it("traduce ISO-dow în numele românesc", () => {
    expect(numeZiSaptamana(1)).toBe("luni");
    expect(numeZiSaptamana(7)).toBe("duminică");
  });
});
