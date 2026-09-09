// src/domain/attendance/plan-si-fapt.test.ts
import { describe, expect, it } from "vitest";

import { ziuaInitialaPlan, TIP_PREZENTA_IMPLICIT } from "./plan-si-fapt";

const PLAN = {
  tip_prezenta: "birou",
  ora_inceput: "09:00:00",
  ora_sfarsit: "17:00:00",
  observatii: "Ședință de planificare",
} as const;

describe("ziuaInitialaPlan", () => {
  it("întoarce o zi goală când nu există nici plan, nici pontaj", () => {
    expect(ziuaInitialaPlan("2026-09-05", null, null)).toEqual({
      data: "2026-09-05",
      tip_prezenta: TIP_PREZENTA_IMPLICIT,
      ora_inceput: "",
      ora_sfarsit: "",
      observatii: "",
      blocata: false,
      motivBlocare: null,
    });
  });

  it("arată planul, netăiat, când ziua n-a fost pontată", () => {
    expect(ziuaInitialaPlan("2026-09-01", PLAN, null)).toEqual({
      data: "2026-09-01",
      tip_prezenta: "birou",
      ora_inceput: "09:00",
      ora_sfarsit: "17:00",
      observatii: "Ședință de planificare",
      blocata: false,
      motivBlocare: null,
    });
  });

  it("faptul bate planul: ziua pontată de acasă se vede în plan ca homeoffice", () => {
    const zi = ziuaInitialaPlan("2026-09-01", PLAN, {
      tip_prezenta: "homeoffice",
      ora_inceput: "08:30:00",
      ora_sfarsit: "16:30:00",
    });
    expect(zi.tip_prezenta).toBe("homeoffice");
    expect(zi.ora_inceput).toBe("08:30");
    expect(zi.ora_sfarsit).toBe("16:30");
  });

  it("umple o săptămână care n-a fost niciodată planificată, direct din pontaj", () => {
    expect(
      ziuaInitialaPlan("2026-09-02", null, {
        tip_prezenta: "delegatie",
        ora_inceput: "07:00:00",
        ora_sfarsit: "19:00:00",
      }),
    ).toEqual({
      data: "2026-09-02",
      tip_prezenta: "delegatie",
      ora_inceput: "07:00",
      ora_sfarsit: "19:00",
      observatii: "",
      blocata: false,
      motivBlocare: null,
    });
  });

  /*
   * Cazul purtător al modulului. O zi deschisă cu „Am intrat" și încă
   * neînchisă are `ora_sfarsit` null. Dacă precedența s-ar aplica pe RÂND, ora
   * de sfârșit planificată ar dispărea de pe ecran — iar
   * `trimite_saptamana_pontaj` face `delete` + reinserare (0084), deci
   * următoarea trimitere ar șterge-o și din bază, fără nicio eroare.
   */
  it("NU golește intervalul planificat pentru o zi încă deschisă", () => {
    const zi = ziuaInitialaPlan("2026-09-01", PLAN, {
      tip_prezenta: "homeoffice",
      ora_inceput: "08:30:00",
      ora_sfarsit: null,
    });
    expect(zi.ora_inceput).toBe("09:00");
    expect(zi.ora_sfarsit).toBe("17:00");
    // Locul de muncă e declarat, deci el trece — doar intervalul rămâne al planului.
    expect(zi.tip_prezenta).toBe("homeoffice");
  });

  it("o zi pontată fără loc declarat păstrează ce spunea planul", () => {
    const zi = ziuaInitialaPlan(
      "2026-09-01",
      { ...PLAN, tip_prezenta: "delegatie" },
      {
        tip_prezenta: null,
        ora_inceput: "09:00:00",
        ora_sfarsit: "17:00:00",
      },
    );
    expect(zi.tip_prezenta).toBe("delegatie");
  });

  it("nu preia observația zilei pontate în nota planului", () => {
    const zi = ziuaInitialaPlan("2026-09-01", PLAN, {
      tip_prezenta: "birou",
      ora_inceput: "09:00:00",
      ora_sfarsit: "17:00:00",
    });
    expect(zi.observatii).toBe("Ședință de planificare");
  });
});

describe("ziuaInitialaPlan — blocarea zilei cu concediu aprobat", () => {
  const CU_CONCEDIU = {
    tip_prezenta: null,
    ora_inceput: null,
    ora_sfarsit: null,
    leave_request_id: "c4aab7eb-4b35-4697-898f-34a79258da18",
    tip_zi: "concediu",
  };

  it("blochează ziua pe care aprobarea a scris-o deja în pontaj", () => {
    const zi = ziuaInitialaPlan("2026-10-12", null, CU_CONCEDIU);
    expect(zi.blocata).toBe(true);
    expect(zi.motivBlocare).toContain("Concediu aprobat");
  });

  it("NU blochează o zi pontată obișnuit", () => {
    const zi = ziuaInitialaPlan("2026-10-12", null, {
      tip_prezenta: "birou",
      ora_inceput: "09:00:00",
      ora_sfarsit: "17:00:00",
      leave_request_id: null,
      tip_zi: "lucratoare",
    });
    expect(zi.blocata).toBe(false);
    expect(zi.motivBlocare).toBeNull();
  });

  it("NU blochează o zi fără pontaj — cererea nu e încă aprobată", () => {
    // Concediul CERUT, dar neaprobat, n-a produs niciun rând în pontaj. Ziua
    // trebuie să rămână editabilă: cererea poate fi respinsă.
    expect(ziuaInitialaPlan("2026-10-12", null, null).blocata).toBe(false);
  });

  it("trimite fiecare fel de concediu în locul unde se corectează", () => {
    const medical = ziuaInitialaPlan("2026-10-12", null, {
      ...CU_CONCEDIU,
      tip_zi: "medical",
    });
    expect(medical.motivBlocare).toContain("medical");

    const faraPlata = ziuaInitialaPlan("2026-10-12", null, {
      ...CU_CONCEDIU,
      tip_zi: "fara_plata",
    });
    expect(faraPlata.motivBlocare).toContain("fără plată");
  });

  it("rezistă la un `tip_zi` necunoscut — mesajul generic, nu o excepție", () => {
    const zi = ziuaInitialaPlan("2026-10-12", null, { ...CU_CONCEDIU, tip_zi: "inventat" });
    expect(zi.blocata).toBe(true);
    expect(zi.motivBlocare).toContain("Concedii");
  });

  it("citirile vechi, fără câmpurile noi, nu blochează nimic", () => {
    // `leave_request_id` și `tip_zi` sunt opționale: un apelant care nu le
    // trimite (o citire mai veche) nu are voie să blocheze din greșeală ziua.
    const zi = ziuaInitialaPlan("2026-10-12", null, {
      tip_prezenta: "birou",
      ora_inceput: null,
      ora_sfarsit: null,
    });
    expect(zi.blocata).toBe(false);
  });
});
