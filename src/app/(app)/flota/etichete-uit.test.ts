// src/app/(app)/flota/etichete-uit.test.ts
//
// Textele e-Transport (0217, F12f): pastila codului în ziua foii, avertismentele
// și rezumatul de deasupra curselor. Fără „conform e-Transport” nicăieri.
import { describe, expect, it } from "vitest";

import {
  AJUTOR_E_TRANSPORT,
  etichetaStareUit,
  ETICHETE_E_TRANSPORT,
  rezumatETransport,
  textAvertismentETransport,
} from "./etichete";

describe("etichetaStareUit — pastila codului în ziua foii", () => {
  const u = { data_inceput: "2024-06-24", valabilitate_zile: 5 };
  it.each([
    ["2024-06-24", "Valabil"],
    ["2024-06-28", "Valabil"],
    ["2024-06-29", "Expirat din 29.06.2024"],
    ["2024-06-23", "Începe pe 24.06.2024"],
  ])("în ziua %s: %s", (zi, text) => {
    expect(etichetaStareUit(u, zi)).toBe(text);
  });
});

describe("textAvertismentETransport", () => {
  it("fiecare avertisment are un text românesc, cu codul grupat și data românească", () => {
    expect(textAvertismentETransport({ tip: "lipsa_uit" })).toBe(
      "Cursa e marcată e-Transport, dar n-are cod UIT.",
    );
    expect(
      textAvertismentETransport({
        tip: "uit_expirat",
        uit: "3V0P0L0P0T3JUW46",
        primaZiExpirata: "2024-06-29",
      }),
    ).toBe("Codul 3V0P 0L0P 0T3J UW46 e expirat din 29.06.2024, deci nu mai acoperă ziua foii.");
    expect(
      textAvertismentETransport({
        tip: "uit_neinceput",
        uit: "3V0P0L0P0T3JUW46",
        dataInceput: "2024-06-24",
      }),
    ).toBe("Codul 3V0P 0L0P 0T3J UW46 începe pe 24.06.2024, după ziua foii.");
    expect(textAvertismentETransport({ tip: "vehicul_sub_prag", masaKg: 1800 })).toMatch(
      /^Vehiculul are 1\.800 kg masă maximă/u,
    );
  });
});

describe("rezumatETransport", () => {
  it("numără cursele fără cod și codurile nevalabile, cu acordul numeralului", () => {
    expect(
      rezumatETransport([
        [{ tip: "lipsa_uit" }],
        [{ tip: "lipsa_uit" }, { tip: "vehicul_sub_prag", masaKg: 1800 }],
        [{ tip: "uit_expirat", uit: "3V0P0L0P0T3JUW46", primaZiExpirata: "2024-06-29" }],
        [],
      ]),
    ).toEqual([
      "2 curse marcate e-Transport n-au cod UIT.",
      "Un cod UIT nu e valabil în ziua foii.",
    ]);
  });

  it("doar nota de prag nu cere o acțiune: niciun rezumat", () => {
    expect(rezumatETransport([[{ tip: "vehicul_sub_prag", masaKg: 1800 }]])).toEqual([]);
  });
});

describe("textele nu promit conformitatea (decizia I-f5)", () => {
  it("niciun text nu spune „conform”", () => {
    for (const text of [AJUTOR_E_TRANSPORT, ...Object.values(ETICHETE_E_TRANSPORT)]) {
      expect(text).not.toMatch(/conform/iu);
    }
    expect(AJUTOR_E_TRANSPORT).toMatch(/nu declară nimic la ANAF/u);
  });
});
