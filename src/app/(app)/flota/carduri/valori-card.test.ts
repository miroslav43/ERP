import { describe, expect, it } from "vitest";

import { tintaDinValoare, valoareTinta, valoriCardNou, valoriCorecturaCard } from "./valori-card";

function formular(campuri: Readonly<Record<string, string>>): FormData {
  const date = new FormData();
  for (const [cheie, valoare] of Object.entries(campuri)) date.set(cheie, valoare);
  return date;
}

describe("valori-card", () => {
  it("cardul nou: emitentul, numărul și ținta pe vehicul", () => {
    const v = valoriCardNou(
      formular({
        emitent: "omv_petrom",
        numar: "7002 5100 0000 1234",
        tinta: "vehicul:66666666-6666-4666-8666-666666666666",
        valabil_luna: "9",
        valabil_an: "2027",
        denumire: "  Dubă livrări ",
        observatii: "",
      }),
    );
    expect(v).toEqual({
      emitent: "omv_petrom",
      numar: "7002 5100 0000 1234",
      denumire: "Dubă livrări",
      vehicle_id: "66666666-6666-4666-8666-666666666666",
      employee_id: null,
      valabil_luna: 9,
      valabil_an: 2027,
      observatii: null,
    });
  });

  it('`Number("")` e 0: luna și anul goale rămân null, nu luna zero', () => {
    const v = valoriCardNou(
      formular({
        emitent: "mol",
        numar: "1234",
        valabil_luna: "",
        valabil_an: "",
      }),
    );
    expect(v.valabil_luna).toBeNull();
    expect(v.valabil_an).toBeNull();
  });

  it("câmpurile lipsă din FormData (casete neranate) sunt null, nu text gol", () => {
    const v = valoriCorecturaCard(
      "55555555-5555-4555-8555-555555555555",
      formular({ status: "blocat" }),
    );
    expect(v).toEqual({
      id: "55555555-5555-4555-8555-555555555555",
      status: "blocat",
      denumire: null,
      vehicle_id: null,
      employee_id: null,
      valabil_luna: null,
      valabil_an: null,
      observatii: null,
    });
  });

  it("ținta: vehicul, șofer, rezervă — și nimic ghicit dintr-o valoare străină", () => {
    expect(tintaDinValoare("sofer:abc")).toEqual({
      vehicle_id: null,
      employee_id: "abc",
    });
    expect(tintaDinValoare("")).toEqual({
      vehicle_id: null,
      employee_id: null,
    });
    expect(tintaDinValoare("altceva:abc")).toEqual({
      vehicle_id: null,
      employee_id: null,
    });
    expect(tintaDinValoare("vehicul:")).toEqual({
      vehicle_id: null,
      employee_id: null,
    });
  });

  it("valoarea selectorului pentru un card existent face drumul invers", () => {
    expect(valoareTinta({ vehicle_id: "v1", employee_id: null })).toBe("vehicul:v1");
    expect(valoareTinta({ vehicle_id: null, employee_id: "s1" })).toBe("sofer:s1");
    expect(valoareTinta({ vehicle_id: null, employee_id: null })).toBe("");
    expect(tintaDinValoare(valoareTinta({ vehicle_id: null, employee_id: "s1" }))).toEqual({
      vehicle_id: null,
      employee_id: "s1",
    });
  });
});
