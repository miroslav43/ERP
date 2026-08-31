import { describe, expect, it } from "vitest";

import { CAMPURI_FISA } from "@/domain/inventory/fisa";
import { creeazaObiectSchema } from "@/schemas/inventory";

import { valoriObiect } from "./valori-obiect";

function formular(campuri: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(campuri)) date.append(cheie, valoare);
  return date;
}

const MINIM = { denumire: "Lenovo", numar_inventar: "1", stare: "nou" };

describe("valoriObiect", () => {
  it("acoperă exact câmpurile pe care le numără fișa", () => {
    // Cele două liste trebuie să rămână aceleași: `campuriCompletate` spune
    // „4 din 12”, iar dacă adaptorul ar citi 11 câmpuri, al doisprezecelea ar
    // fi pentru totdeauna necompletat, oricât l-ar completa omul.
    expect(Object.keys(valoriObiect(formular(MINIM))).toSorted()).toEqual(
      [...CAMPURI_FISA].toSorted(),
    );
  });

  it("trimite `null`, nu șirul gol, pentru câmpurile opționale nescrise", () => {
    const valori = valoriObiect(formular(MINIM));
    expect(valori.serie).toBeNull();
    expect(valori.category_id).toBeNull();
    expect(valori.data_achizitie).toBeNull();
    expect(valori.garantie_expira).toBeNull();
    expect(valori.observatii).toBeNull();
  });

  it("taie spațiile din jur, ca un câmp „curățat” să nu treacă drept completat", () => {
    const valori = valoriObiect(formular({ ...MINIM, locatie: "   " }));
    expect(valori.locatie).toBeNull();
  });

  it("lasă `valoare` ca TEXT — schema face conversia, inclusiv pe virgulă", () => {
    // `Number("140,50")` e `NaN`; `Number("")` e `0`. Ambele ar fi greșite.
    expect(valoriObiect(formular({ ...MINIM, valoare: "140,50" })).valoare).toBe("140,50");
    expect(valoriObiect(formular(MINIM)).valoare).toBeNull();
  });

  it("produce o încărcătură pe care schema o acceptă", () => {
    const rezultat = creeazaObiectSchema.safeParse(
      valoriObiect(
        formular({
          ...MINIM,
          serie: "5CG3210XYZ",
          model: "Latitude 5540",
          producator: "Dell",
          data_achizitie: "2025-03-01",
          valoare: "4500",
          garantie_expira: "2028-03-01",
          locatie: "Sediu · etaj 2",
          observatii: "Cu geantă și încărcător.",
        }),
      ),
    );
    expect(rezultat.success).toBe(true);
    if (rezultat.success) {
      expect(rezultat.data.valoare).toBe(4500);
      expect(rezultat.data.serie).toBe("5CG3210XYZ");
    }
  });

  it("convertește virgula zecimală prin schemă, nu prin adaptor", () => {
    const rezultat = creeazaObiectSchema.safeParse(
      valoriObiect(formular({ ...MINIM, valoare: "140,50" })),
    );
    expect(rezultat.success).toBe(true);
    if (rezultat.success) expect(rezultat.data.valoare).toBe(140.5);
  });

  it("duce mesajul de garanție pe CÂMPUL lui, nu într-o frază generală", () => {
    // Exact mesajul care se pierdea la adăugare, fiindcă formularul vechi nu
    // citea `fieldErrors`.
    const rezultat = creeazaObiectSchema.safeParse(
      valoriObiect(
        formular({ ...MINIM, data_achizitie: "2026-05-01", garantie_expira: "2026-01-01" }),
      ),
    );
    expect(rezultat.success).toBe(false);
    if (!rezultat.success) {
      expect(rezultat.error.issues[0]?.path).toEqual(["garantie_expira"]);
    }
  });
});
