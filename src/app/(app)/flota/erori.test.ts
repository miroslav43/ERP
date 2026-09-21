// src/app/(app)/flota/erori.test.ts
import { describe, expect, it } from "vitest";

import { ActionDenied } from "@/lib/actions/errors";

import { traduEroare } from "./erori";

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
    expect(eroare.fieldErrors?.[campuri[0] ?? ""]).toEqual([mesaj]);
  });

  it("un refuz fără câmp rămâne mesaj general, neschimbat", () => {
    const mesaj =
      "Foaia de parcurs este aprobată. Pentru corecţii, stornaţi-o şi întocmiţi una nouă.";
    const eroare = prinde(p0001(mesaj));
    expect(eroare.fieldErrors).toBeNull();
    expect(eroare.message).toBe(mesaj);
  });
});
