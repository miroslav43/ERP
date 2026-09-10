// src/app/(app)/panou/coada.test.ts
import { describe, expect, it } from "vitest";

import type { CoadaPanou, ContoarePanou } from "@/lib/queries/panou";

import { coadaDinContoare, numarulDinAntet } from "./coada";

/** Contori toți pe `1`, ca fiecare să producă exact un rând de un element. */
const TOTI_PE_UNU: CoadaPanou = {
  cereriConcediu: 1,
  saptamaniPontaj: 1,
  deplasari: 1,
  foiParcurs: 1,
  tichete: 1,
  anomaliiKm: 1,
  regesDeTransmis: 1,
};

function contoare(coada: CoadaPanou): ContoarePanou {
  return {
    coada,
    scadente: {
      ssm: null,
      mentenanta: null,
      documenteFlota: null,
      vehiculeFaraDocumente: null,
      contracteDeterminate: null,
    },
    firma: { angajatiActivi: 8, inConcediu: 0, departamente: 2 },
  };
}

describe("coadaDinContoare", () => {
  /*
   * TESTUL CARE CONTEAZĂ. Fără el, un contor adăugat în `CoadaPanou` fără rândul
   * lui trece de typecheck, de lint și de restul suitei — și ajunge pe ecran ca
   * o cifră în antet care nu corespunde niciunui rând. S-a întâmplat cu
   * `regesDeTransmis`: antetul anunța „5" peste o listă de două rânduri.
   *
   * Se sprijină pe `Object.keys` al tipului, nu pe o listă scrisă de mână:
   * o listă scrisă de mână ar fi trebuit ținută la zi de aceeași persoană care
   * uită să adauge rândul.
   */
  it("produce un rând pentru FIECARE contor din coadă", () => {
    const intrari = coadaDinContoare(contoare(TOTI_PE_UNU));
    expect(intrari).toHaveLength(Object.keys(TOTI_PE_UNU).length);
  });

  it("cifra din antet e suma rândurilor, nu a contorilor", () => {
    const intrari = coadaDinContoare(contoare(TOTI_PE_UNU));
    expect(numarulDinAntet(intrari)).toBe(Object.keys(TOTI_PE_UNU).length);
  });

  /* `null` = modulul e stins sau rolul n-are permisiunea: nu se vede, nu se numără. */
  it("sare peste contorii `null` și peste cei pe zero", () => {
    const intrari = coadaDinContoare(
      contoare({ ...TOTI_PE_UNU, deplasari: null, foiParcurs: 0, tichete: null }),
    );
    expect(intrari.map((i) => i.cheie)).toEqual(["concedii", "pontaj", "anomalii", "reges"]);
    expect(numarulDinAntet(intrari)).toBe(4);
  });

  it("coada goală dă zero, nu un rând gol", () => {
    const goala: CoadaPanou = {
      cereriConcediu: 0,
      saptamaniPontaj: 0,
      deplasari: 0,
      foiParcurs: 0,
      tichete: 0,
      anomaliiKm: 0,
      regesDeTransmis: 0,
    };
    expect(coadaDinContoare(contoare(goala))).toHaveLength(0);
    expect(numarulDinAntet([])).toBe(0);
  });

  /*
   * REGES e singurul rând cu termen legal — netransmiterea la timp e
   * contravenție, separat pentru fiecare salariat. `urgent` e ce-l face să se
   * vadă ca atare în `RandCoada`.
   */
  it("marchează REGES ca urgent, restul nu", () => {
    const intrari = coadaDinContoare(contoare(TOTI_PE_UNU));
    const urgente = intrari.filter((i) => i.urgent === true).map((i) => i.cheie);
    expect(urgente).toEqual(["reges"]);
  });

  it("acordă singularul cu pluralul", () => {
    const unul = coadaDinContoare(contoare({ ...TOTI_PE_UNU, regesDeTransmis: 1 }));
    expect(unul.find((i) => i.cheie === "reges")?.detaliu).toBe("eveniment");
    const trei = coadaDinContoare(contoare({ ...TOTI_PE_UNU, regesDeTransmis: 3 }));
    expect(trei.find((i) => i.cheie === "reges")?.detaliu).toBe("evenimente");
  });
});
