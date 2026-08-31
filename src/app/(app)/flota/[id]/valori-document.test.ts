import { describe, expect, it } from "vitest";

import { documentVehiculSchema } from "@/schemas/fleet";

import { valoriDocument } from "./valori-document";

const TIP = "33333333-3333-4333-8333-333333333333";
const VEHICUL = "44444444-4444-4444-8444-444444444444";

function formular(campuri: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(campuri)) date.append(cheie, valoare);
  return date;
}

describe("valoriDocument", () => {
  it("trece prin valorile completate", () => {
    const valori = valoriDocument(
      formular({
        document_type_id: TIP,
        emitent: "Allianz-Țiriac",
        valabil_de_la: "2026-10-24",
        expira_la: "2027-10-24",
        cost: "1240.50",
        observatii: "Plătit în două rate.",
      }),
    );

    expect(valori).toStrictEqual({
      document_type_id: TIP,
      emitent: "Allianz-Țiriac",
      valabil_de_la: "2026-10-24",
      expira_la: "2027-10-24",
      cost: 1240.5,
      observatii: "Plătit în două rate.",
    });
  });

  /**
   * Regresie: `Number("")` e `0`, nu `NaN`. Un cost necompletat salvat ca `0`
   * arată în raport ca o poliță gratuită — indistingibil de una necompletată,
   * și fără nicio eroare pe drum.
   */
  it("traduce câmpul de cost gol în null, nu în zero", () => {
    const valori = valoriDocument(formular({ document_type_id: TIP, cost: "" }));

    expect(valori.cost).toBeNull();
  });

  it("traduce restul câmpurilor goale sau albe în null", () => {
    const valori = valoriDocument(
      formular({
        document_type_id: TIP,
        emitent: "   ",
        valabil_de_la: "",
        expira_la: "",
        observatii: "  ",
      }),
    );

    expect(valori.emitent).toBeNull();
    expect(valori.valabil_de_la).toBeNull();
    expect(valori.expira_la).toBeNull();
    expect(valori.observatii).toBeNull();
  });

  it("produce o încărcătură pe care schema o acceptă", () => {
    const valori = valoriDocument(
      formular({ document_type_id: TIP, emitent: "RAR Cluj", expira_la: "2027-08-30" }),
    );

    const rezultat = documentVehiculSchema.safeParse({ vehicle_id: VEHICUL, ...valori });

    expect(rezultat.success).toBe(true);
  });

  /**
   * `numar` a ieșit din schemă. Un formular vechi care l-ar mai trimite nu
   * trebuie să pice — Zod ignoră cheile în plus — dar nici să-l strecoare mai
   * departe.
   */
  it("nu mai produce `numar`", () => {
    const valori = valoriDocument(formular({ document_type_id: TIP, numar: "01" }));

    expect(valori).not.toHaveProperty("numar");
  });
});
