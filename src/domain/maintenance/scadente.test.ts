// src/domain/maintenance/scadente.test.ts
import { describe, expect, it } from "vitest";
import {
  COTA_AVERTIZARE_CONTOR,
  PRAG_AVERTIZARE_CONTOR_IMPLICIT,
  PRAG_MENTENANTA_AVERTIZARE_ZILE,
  maiGravaDintre,
  stareScadentaContor,
  stareScadentaData,
  stareScadentaPlan,
} from "./scadente";

describe("stareScadentaData", () => {
  const azi = "2026-06-15";

  it("este „fara_scadenta” când nu există dată", () => {
    expect(stareScadentaData(null, azi)).toBe("fara_scadenta");
  });

  it("este „in_intarziere” pentru o dată din trecut", () => {
    expect(stareScadentaData("2026-06-14", azi)).toBe("in_intarziere");
  });

  it("este „in_intarziere” chiar dacă data e azi minus o zi, nu doar cu mult în urmă", () => {
    expect(stareScadentaData("2020-01-01", azi)).toBe("in_intarziere");
  });

  it("este „scadenta_apropiata” exact la pragul de zile", () => {
    expect(stareScadentaData("2026-06-30", azi, 15)).toBe("scadenta_apropiata");
  });

  it("este „in_regula” imediat peste pragul de zile", () => {
    expect(stareScadentaData("2026-07-01", azi, 15)).toBe("in_regula");
  });

  it("cu prag 0, ziua de azi e „scadenta_apropiata” — scadentă, dar nu trecută", () => {
    expect(stareScadentaData(azi, azi, 0)).toBe("scadenta_apropiata");
  });

  it("folosește pragul implicit de 15 zile când nu se specifică altul", () => {
    expect(PRAG_MENTENANTA_AVERTIZARE_ZILE).toBe(15);
    expect(stareScadentaData("2026-06-29", azi)).toBe("scadenta_apropiata");
    expect(stareScadentaData("2026-07-02", azi)).toBe("in_regula");
  });
});

describe("stareScadentaContor", () => {
  it("este „fara_scadenta” fără scadență de contor", () => {
    expect(
      stareScadentaContor({
        urmatoareaScadentaContor: null,
        periodicitateContor: 500,
        ultimaCitireContor: 100,
      }),
    ).toBe("fara_scadenta");
  });

  it("este „fara_scadenta” fără nicio citire încă — nu se poate calcula ce a mai rămas", () => {
    expect(
      stareScadentaContor({
        urmatoareaScadentaContor: 1000,
        periodicitateContor: 500,
        ultimaCitireContor: null,
      }),
    ).toBe("fara_scadenta");
  });

  it("este „in_intarziere” când citirea a depășit deja scadența", () => {
    expect(
      stareScadentaContor({
        urmatoareaScadentaContor: 1000,
        periodicitateContor: 500,
        ultimaCitireContor: 1000,
      }),
    ).toBe("in_intarziere");
    expect(
      stareScadentaContor({
        urmatoareaScadentaContor: 1000,
        periodicitateContor: 500,
        ultimaCitireContor: 1050,
      }),
    ).toBe("in_intarziere");
  });

  it("este „scadenta_apropiata” sub cota de 10% din periodicitate", () => {
    // periodicitate 500 ⇒ prag de avertizare 50; rămân 40.
    expect(COTA_AVERTIZARE_CONTOR).toBe(0.1);
    expect(
      stareScadentaContor({
        urmatoareaScadentaContor: 1000,
        periodicitateContor: 500,
        ultimaCitireContor: 960,
      }),
    ).toBe("scadenta_apropiata");
  });

  it("este „in_regula” peste cota de avertizare", () => {
    expect(
      stareScadentaContor({
        urmatoareaScadentaContor: 1000,
        periodicitateContor: 500,
        ultimaCitireContor: 900,
      }),
    ).toBe("in_regula");
  });

  it("folosește pragul absolut implicit când periodicitatea nu e cunoscută", () => {
    expect(PRAG_AVERTIZARE_CONTOR_IMPLICIT).toBe(50);
    expect(
      stareScadentaContor({
        urmatoareaScadentaContor: 1000,
        periodicitateContor: null,
        ultimaCitireContor: 960,
      }),
    ).toBe("scadenta_apropiata");
    expect(
      stareScadentaContor({
        urmatoareaScadentaContor: 1000,
        periodicitateContor: null,
        ultimaCitireContor: 900,
      }),
    ).toBe("in_regula");
  });
});

describe("maiGravaDintre", () => {
  it("respectă ordinea in_regula < scadenta_apropiata < in_intarziere", () => {
    expect(maiGravaDintre("in_regula", "scadenta_apropiata")).toBe("scadenta_apropiata");
    expect(maiGravaDintre("scadenta_apropiata", "in_intarziere")).toBe("in_intarziere");
    expect(maiGravaDintre("in_intarziere", "fara_scadenta")).toBe("in_intarziere");
  });

  it("„fara_scadenta” este cea mai puțin gravă", () => {
    expect(maiGravaDintre("fara_scadenta", "in_regula")).toBe("in_regula");
  });
});

describe("stareScadentaPlan", () => {
  const azi = "2026-06-15";

  it("combină zilele și contorul, câștigă cea mai gravă", () => {
    // Pe zile: în regulă (peste prag). Pe contor: în întârziere.
    expect(
      stareScadentaPlan(
        {
          urmatoareaScadenta: "2026-12-01",
          urmatoareaScadentaContor: 1000,
          periodicitateContor: 500,
          ultimaCitireContor: 1200,
        },
        azi,
      ),
    ).toBe("in_intarziere");
  });

  it("e „fara_scadenta” doar dacă ambele componente lipsesc", () => {
    expect(
      stareScadentaPlan(
        {
          urmatoareaScadenta: null,
          urmatoareaScadentaContor: null,
          periodicitateContor: null,
          ultimaCitireContor: null,
        },
        azi,
      ),
    ).toBe("fara_scadenta");
  });

  it("un plan doar pe zile ignoră componenta de contor lipsă", () => {
    expect(
      stareScadentaPlan(
        {
          urmatoareaScadenta: "2026-06-10",
          urmatoareaScadentaContor: null,
          periodicitateContor: null,
          ultimaCitireContor: null,
        },
        azi,
      ),
    ).toBe("in_intarziere");
  });
});
