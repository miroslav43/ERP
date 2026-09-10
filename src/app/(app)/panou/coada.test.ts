// src/app/(app)/panou/coada.test.ts
import { describe, expect, it } from "vitest";

import type { CoadaPanou, ContoarePanou } from "@/lib/queries/panou";

import { coadaDinContoare, numarulDinAntet } from "./coada";

/** Contori toți pe `1`, ca fiecare să producă exact un rând de un element. */
const TOTI_PE_UNU: CoadaPanou = {
  cereriConcediu: 1,
  pontaj: { zile: 1, fise: 0, luni: 1, an: 2026, luna: 9 },
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
      pontaj: null,
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

describe("rândul de pontaj", () => {
  const cu = (pontaj: CoadaPanou["pontaj"]) =>
    coadaDinContoare(contoare({ ...TOTI_PE_UNU, pontaj })).find((i) => i.cheie === "pontaj");

  /*
   * Contorul dinainte număra LUNI în starea `in_aprobare` — o stare în care luna
   * intră când aprobatorul aprobă primul lot, nu când o trimite cineva. Rândul
   * apărea deci după ce se lucrase, se golea doar prin blocarea lunii, și rata
   * restanțele reale, care stau în lunile `deschisa`.
   */
  it("numără zilele și fișele împreună, fiindcă se aprobă din același ecran", () => {
    expect(cu({ zile: 8, fise: 2, luni: 2, an: 2026, luna: 10 })?.numar).toBe(10);
  });

  /*
   * `/pontaj/aprobare` lucrează pe O lună și se deschide implicit pe cea curentă.
   * Fără luna în link, panoul ar fi numărat octombrie și ecranul ar fi arătat
   * septembrie — aceeași contrazicere, mutată cu un clic mai încolo.
   */
  it("duce în luna primei restanțe, nu în luna curentă", () => {
    expect(cu({ zile: 8, fise: 0, luni: 1, an: 2026, luna: 10 })?.href).toBe(
      "/pontaj/aprobare?an=2026&luna=10",
    );
  });

  it("spune despărțit ce anume așteaptă", () => {
    expect(cu({ zile: 3, fise: 1, luni: 1, an: 2026, luna: 9 })?.detaliu).toBe(
      "3 zile · o fișă săptămânală",
    );
    expect(cu({ zile: 1, fise: 0, luni: 1, an: 2026, luna: 9 })?.detaliu).toBe("o zi");
    expect(cu({ zile: 0, fise: 2, luni: 0, an: 2026, luna: 9 })?.detaliu).toBe(
      "2 fișe săptămânale",
    );
  });

  it("avertizează când restanțele sunt împrăștiate pe mai multe luni", () => {
    expect(cu({ zile: 10, fise: 0, luni: 2, an: 2026, luna: 9 })?.detaliu).toBe(
      "10 zile din 2 luni",
    );
  });

  it("nu apare deloc când nu e nimic de aprobat", () => {
    expect(cu(null)).toBeUndefined();
  });
});

describe("rândul de concedii", () => {
  /*
   * Ducea la `/concedii`, care e fixat pe `vizualizare="mele"`. Contorul număra
   * toată firma, ecranul arăta doar cererile proprii: panoul anunța o cerere de
   * decis, iar „Deschide" ducea la „Nicio cerere de concediu".
   */
  it("duce la echipă, singurul ecran unde se decid cererile altora", () => {
    const rand = coadaDinContoare(contoare(TOTI_PE_UNU)).find((i) => i.cheie === "concedii");
    expect(rand?.href).toBe("/concedii/echipa?status=trimisa,in_aprobare");
  });
});
