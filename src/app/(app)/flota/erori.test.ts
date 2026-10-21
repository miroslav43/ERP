// src/app/(app)/flota/erori.test.ts
import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";
import { cuVirgula } from "@/lib/text/diacritice";

import { traduEroare, traduEroareAlocare } from "./erori";

function p0001(message: string) {
  return { code: "P0001", message, details: "", hint: "", name: "PostgrestError" };
}

function prinde(error: unknown): ActionDenied {
  try {
    traduEroare(error);
  } catch (e) {
    if (e instanceof ActionDenied) return e;
    throw e;
  }
  throw new Error("traduEroare n-a aruncat");
}

describe("traduEroare — refuzurile bazei ajung pe câmpul vinovat", () => {
  it.each([
    ["Kilometrajul de sosire trebuie să fie mai mare decât cel de plecare.", ["km_sosire"]],
    ["Ora de sosire trebuie să fie după ora de plecare.", ["sosire_la"]],
    ["Data alimentării este în afara intervalului foii de parcurs.", ["alimentat_la"]],
    [
      "Completaţi ora şi kilometrajul de sosire înainte de a trimite foaia spre aprobare.",
      ["sosire_la", "km_sosire"],
    ],
    ["Şoferul selectat nu aparţine organizaţiei dumneavoastră.", ["employee_id"]],
  ])("%s", (mesaj, campuri) => {
    const eroare = prinde(p0001(mesaj));
    expect(Object.keys(eroare.fieldErrors ?? {})).toEqual(campuri);
    // Mesajele vechi din bază (0018) au ş/ţ cu sedilă; ajung la om cu virgulă.
    expect(eroare.fieldErrors?.[campuri[0] ?? ""]).toEqual([cuVirgula(mesaj)]);
  });

  it("un refuz fără câmp rămâne mesaj general, doar cu diacriticele corectate", () => {
    const mesaj =
      "Foaia de parcurs este aprobată. Pentru corecţii, stornaţi-o şi întocmiţi una nouă.";
    const eroare = prinde(p0001(mesaj));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(cuVirgula(mesaj));
  });

  it("kilometrajul în regres (0018): cifrele rămân, sedila devine virgulă (QA ADM-021)", () => {
    const mesaj =
      "Kilometrajul de plecare (9000 km) este mai mic decât ultimul kilometraj cunoscut al vehiculului (10000 km). Un odometru nu poate da înapoi: verificaţi cifra introdusă sau corectaţi foaia de parcurs anterioară.";
    const eroare = prinde(p0001(mesaj));
    const pecamp = eroare.fieldErrors?.km_plecare?.[0] ?? "";
    expect(pecamp).toContain("verificați");
    expect(pecamp).toContain("(9000 km)");
    expect(pecamp).not.toMatch(/[şţŞŢ]/u);
    expect(eroare.message).not.toMatch(/[şţŞŢ]/u);
  });
});

describe("traduEroareAlocare — P0001 ajunge cu virgulă dedesubt", () => {
  it("un refuz general din alocări nu păstrează sedila", () => {
    const mesaj = "Vehiculul selectat nu aparţine organizaţiei.";
    let prinsa: unknown;
    try {
      traduEroareAlocare(p0001(mesaj));
    } catch (e) {
      prinsa = e;
    }
    expect(prinsa).toBeInstanceOf(ActionDenied);
    expect((prinsa as ActionDenied).message).toBe("Vehiculul selectat nu aparține organizației.");
  });
});
