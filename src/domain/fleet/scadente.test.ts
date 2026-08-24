import { describe, expect, it } from "vitest";

// Import DOAR de tip, către primitiva `Scadenta`: se șterge la compilare, deci
// domeniul rămâne fără nicio dependență de React. Rostul lui e o singură
// verificare, de mai jos — vocabularul flotei trebuie să fie o submulțime a
// celor șase trepte unificate, altfel pastila ar primi o stare pe care n-o
// cunoaște și ar cădea la randare, nu la compilare.
import type { TreaptaScadenta } from "@/domain/scadente";

import {
  PRAG_FLOTA_AVERTIZARE_ZILE,
  stareScadentaFlota,
  stareScadentaVehicul,
  type StareScadentaFlota,
} from "./scadente";

const AZI = "2026-06-15";

describe("stareScadentaFlota", () => {
  it("respectă pragul de 30 de zile din constantă", () => {
    expect(PRAG_FLOTA_AVERTIZARE_ZILE).toBe(30);
  });

  it("este „lipsa” când nu există niciun document, nu „in_regula”", () => {
    // Aici se desparte flota de SSM și de mentenanță: același `null` înseamnă
    // „nu expiră niciodată” la SSM și „fără scadență” la mentenanță.
    expect(stareScadentaFlota(null, AZI)).toBe("lipsa");
  });

  it("este „expirat” pentru o dată din trecut", () => {
    expect(stareScadentaFlota("2026-06-14", AZI)).toBe("expirat");
    expect(stareScadentaFlota("2020-01-01", AZI)).toBe("expirat");
  });

  it("un document care expiră AZI nu e încă expirat", () => {
    // Capcana de fus orar: `new Date("2026-06-15")` e miezul nopții UTC, adică
    // 03:00 în București — o comparație pe `Date` ar fi declarat documentul
    // expirat de ieri. Comparația lexicografică pe ISO nu are fus orar.
    expect(stareScadentaFlota(AZI, AZI)).toBe("curand");
  });

  it("este „curand” exact la 30 de zile și „in_regula” la 31", () => {
    expect(stareScadentaFlota("2026-07-15", AZI)).toBe("curand");
    expect(stareScadentaFlota("2026-07-16", AZI)).toBe("in_regula");
  });

  it("nu se lasă indusă în eroare de trecerea peste lună sau peste an", () => {
    expect(stareScadentaFlota("2027-01-05", "2026-12-31")).toBe("curand");
    expect(stareScadentaFlota("2026-03-01", "2026-02-28")).toBe("curand");
    expect(stareScadentaFlota("2026-02-28", "2026-03-01")).toBe("expirat");
  });
});

describe("stareScadentaVehicul", () => {
  it("un vehicul FĂRĂ niciun document e „lipsa”, nu „in_regula”", () => {
    // Cazul e real în baza de producție, nu ipotetic: există vehicule cu zero
    // rânduri în `vehicle_documents`. O listă goală trecută printr-un
    // `.some(expirat)` ar fi întors `false`, adică verde, la nesfârșit.
    expect(stareScadentaVehicul([], AZI)).toBe("lipsa");
  });

  it("vehiculul fără documente NU se aprinde niciodată singur, oricât ar trece", () => {
    // Nu are dată de la care să numere. Peste zece ani e tot „lipsa”, nu
    // „expirat” — de aceea „lipsa” trebuie să fie treapta cea mai gravă, altfel
    // vehiculul rămâne pe ultima pagină a listei sortate după gravitate.
    for (const azi of ["2026-06-15", "2027-06-15", "2036-06-15"]) {
      expect(stareScadentaVehicul([], azi)).toBe("lipsa");
    }
  });

  it("„lipsa” bate „expirat”: un RCA absent e mai grav decât un ITP expirat ieri", () => {
    expect(stareScadentaVehicul(["2026-06-14", null], AZI)).toBe("lipsa");
    expect(stareScadentaVehicul([null, "2026-06-14"], AZI)).toBe("lipsa");
  });

  it("„lipsa” bate și un document perfect valabil", () => {
    expect(stareScadentaVehicul(["2027-01-01", null], AZI)).toBe("lipsa");
  });

  it("întoarce cea mai gravă treaptă când toate documentele există", () => {
    expect(stareScadentaVehicul(["2026-06-14", "2026-07-15", "2027-01-01"], AZI)).toBe("expirat");
    expect(stareScadentaVehicul(["2026-07-15", "2027-01-01"], AZI)).toBe("curand");
    expect(stareScadentaVehicul(["2027-01-01", "2028-01-01"], AZI)).toBe("in_regula");
  });

  it("un singur document se comportă identic cu `stareScadentaFlota`", () => {
    for (const data of ["2026-06-14", "2026-06-15", "2026-07-15", "2027-01-01"]) {
      expect(stareScadentaVehicul([data], AZI)).toBe(stareScadentaFlota(data, AZI));
    }
  });
});

describe("vocabularul flotei", () => {
  it("e o submulțime a celor șase trepte unificate", () => {
    // Verificarea e a compilatorului, nu a lui `expect`: dacă o stare a flotei
    // n-ar mai exista în `TreaptaScadenta`, atribuirea de mai jos nu compilează.
    const toate: readonly StareScadentaFlota[] = ["expirat", "curand", "in_regula", "lipsa"];
    const caTrepte: readonly TreaptaScadenta[] = toate;
    // `toHaveLength(4)` peste un tablou literal scris cu două rânduri mai sus
    // n-ar apăra nimic la execuție: ar trece identic și dacă `Scadenta` ar fi
    // ștearsă. Se verifică în schimb că funcția chiar PRODUCE fiecare dintre
    // cele patru trepte — adică vocabularul e complet, nu doar tipabil.
    const produse = new Set([
      stareScadentaVehicul([], AZI),
      stareScadentaFlota("2020-01-01", AZI),
      stareScadentaFlota("2026-07-01", AZI),
      stareScadentaFlota("2036-01-01", AZI),
    ]);
    expect([...produse].sort()).toEqual([...caTrepte].sort());
  });

  it("nu produce niciodată „critic” sau „neaplicabil”", () => {
    // Flota n-are al doilea prag, iar orice document de vehicul are termen. O
    // treaptă neatinsă nu strică nimic; una lipsă ar fi obligat modulul să mintă.
    const intrari = ["2026-06-14", "2026-06-15", "2026-07-15", "2027-01-01", null];
    const rezultate = new Set(intrari.map((d) => stareScadentaFlota(d, AZI)));
    expect([...rezultate].sort()).toEqual(["curand", "expirat", "in_regula", "lipsa"]);
  });
});
