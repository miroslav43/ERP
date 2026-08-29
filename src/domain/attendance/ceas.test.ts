// src/domain/attendance/ceas.test.ts

import { describe, expect, it } from "vitest";

import { formatDurata, minuteScurse, stareaCeasului } from "./ceas";

describe("minuteScurse", () => {
  it("numără minutele dintre intrare și ora curentă", () => {
    expect(minuteScurse("07:32", "11:44")).toBe(252);
  });

  it("întoarce zero fix la momentul intrării", () => {
    expect(minuteScurse("07:32", "07:32")).toBe(0);
  });

  /*
   * Ziua deschisă aseară la 22:00 și rămasă neînchisă, privită azi la 09:00.
   * O scădere naivă ar da −780 de minute; una „inteligentă" cu adunarea a 24 de
   * ore ar da 11 h și ar minți convingător. Ambele sunt greșite: modelul are un
   * rând pe zi și ore fără dată, deci durata aia nu se poate ști de aici.
   */
  it("întoarce null când ora curentă e înaintea intrării", () => {
    expect(minuteScurse("22:00", "09:00")).toBeNull();
  });

  it("întoarce null pentru ore invalide", () => {
    expect(minuteScurse("24:00", "09:00")).toBeNull();
    expect(minuteScurse("07:32", "")).toBeNull();
  });
});

describe("formatDurata", () => {
  it("scrie ore și minute", () => {
    expect(formatDurata(252)).toBe("4 h 12 min");
  });

  it("omite orele sub o oră", () => {
    expect(formatDurata(45)).toBe("45 min");
    expect(formatDurata(0)).toBe("0 min");
  });

  it("omite minutele la oră fixă — niciodată „8 h 0 min”", () => {
    expect(formatDurata(480)).toBe("8 h");
  });

  it("nu produce niciodată o cifră pentru o valoare imposibilă", () => {
    expect(formatDurata(-1)).toBe("—");
    expect(formatDurata(Number.NaN)).toBe("—");
  });
});

describe("stareaCeasului", () => {
  const ZI_GOALA = {
    ora_inceput: null,
    ora_sfarsit: null,
    ore_lucrate: 0,
    leave_request_id: null,
    tip_zi: "lucratoare",
  };

  it("fără rând, ziua se poate deschide", () => {
    expect(stareaCeasului(null, "09:00")).toEqual({ fel: "neinceputa" });
  });

  it("rând gol, fără interval și fără ore: tot deschidere", () => {
    expect(stareaCeasului(ZI_GOALA, "09:00")).toEqual({ fel: "neinceputa" });
  });

  it("început fără sfârșit: zi în curs, cu durata scursă", () => {
    expect(stareaCeasului({ ...ZI_GOALA, ora_inceput: "07:32:00" }, "11:44")).toEqual({
      fel: "in_curs",
      oraInceput: "07:32",
      minute: 252,
    });
  });

  it("interval complet: zi încheiată", () => {
    expect(
      stareaCeasului(
        { ...ZI_GOALA, ora_inceput: "08:00:00", ora_sfarsit: "16:30:00", ore_lucrate: 8 },
        "18:00",
      ),
    ).toEqual({ fel: "incheiata", oraInceput: "08:00", oraSfarsit: "16:30" });
  });

  it("ziua venită din concediu nu e a ceasului", () => {
    expect(
      stareaCeasului({ ...ZI_GOALA, leave_request_id: "abc", tip_zi: "concediu" }, "09:00"),
    ).toEqual({ fel: "alta_sursa" });
  });

  it("ziua scrisă din foaia colectivă, fără interval dar cu ore, nu e a ceasului", () => {
    expect(stareaCeasului({ ...ZI_GOALA, ore_lucrate: 8 }, "09:00")).toEqual({
      fel: "alta_sursa",
    });
  });

  it("absența nemotivată nu e a ceasului", () => {
    expect(stareaCeasului({ ...ZI_GOALA, tip_zi: "absenta_nemotivata" }, "09:00")).toEqual({
      fel: "alta_sursa",
    });
  });

  /*
   * Se muncește sâmbăta și de sărbători — cu spor, tocmai de aceea. O zi
   * deschisă cu ceasul într-o astfel de zi TREBUIE să se poată închide.
   */
  it("sâmbăta și sărbătoarea rămân ale ceasului", () => {
    for (const tip of ["weekend", "sarbatoare", "delegatie"]) {
      expect(
        stareaCeasului({ ...ZI_GOALA, tip_zi: tip, ora_inceput: "08:00:00" }, "12:00"),
      ).toEqual({ fel: "in_curs", oraInceput: "08:00", minute: 240 });
    }
  });
});
