// src/lib/documents/inrolare.test.ts
import { describe, expect, it } from "vitest";

import { coduriEligibile } from "./inrolare";
import { CODURI_INROLARE } from "./variabile";

/**
 * Caseta de regenerare bifează exact ce spune funcția asta.
 *
 * Dacă ar oferi un document pe care emiterea îl sare (fișa postului fără rând în
 * `job_descriptions`, actul de telemuncă pentru cineva care lucrează la sediu),
 * utilizatorul ar bifa, ar apăsa, iar `genereazaDocumenteInrolare` n-ar emite
 * nimic — fără eroare, fără avertisment, fără document. Exact felul de refuz
 * tăcut de care e plin registrul de capcane al proiectului.
 */
describe("coduriEligibile", () => {
  it("la sediu, fără fișa postului: trei documente", () => {
    expect(coduriEligibile("birou", false)).toEqual([
      "contract_munca",
      "nda",
      "anexa_proprietate_intelectuala",
    ]);
  });

  it("la sediu, cu fișa postului: patru", () => {
    expect(coduriEligibile("birou", true)).toEqual([
      "contract_munca",
      "fisa_postului",
      "nda",
      "anexa_proprietate_intelectuala",
    ]);
  });

  it.each(["telemunca", "domiciliu", "mixt"])("`%s` adaugă actul adițional", (mod) => {
    expect(coduriEligibile(mod, true)).toEqual([...CODURI_INROLARE]);
  });

  it.each(["birou", "sediu", "", "necunoscut"])("`%s` NU cere act de telemuncă", (mod) => {
    expect(coduriEligibile(mod, true)).not.toContain("act_aditional_telemunca");
  });

  it("păstrează ordinea de emitere, oricare ar fi selecția", () => {
    // Ordinea e cea în care se consumă numerele din serii. Caseta afișează
    // documentele în ea, deci o inversare s-ar vedea direct pe ecran.
    for (const mod of ["birou", "telemunca"]) {
      for (const fisa of [true, false]) {
        const eligibile = coduriEligibile(mod, fisa);
        const pozitii = eligibile.map((cod) => CODURI_INROLARE.indexOf(cod));
        expect(pozitii).toEqual([...pozitii].sort((a, b) => a - b));
      }
    }
  });
});
