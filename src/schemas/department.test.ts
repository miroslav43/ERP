// src/schemas/department.test.ts
import { describe, expect, it } from "vitest";

import { actualizeazaDepartamentSchema, creeazaDepartamentSchema } from "./department";

/**
 * Un singur câmp e testat aici, și e cel care poate muta un om dintr-un
 * departament în altul: `muta_managerul_in_departament`.
 *
 * Bifa dintr-un `<form>` NU ajunge la server ca boolean. Trimisă, e `"on"`;
 * nebifată, lipsește cu totul din `FormData`. Un `z.boolean()` simplu ar fi
 * respins `"on"` ca eroare de validare — deci exact consimțământul DAT ar fi
 * fost singurul care nu trecea, iar formularul ar fi arătat o eroare pe un câmp
 * pe care omul nici nu-l vede ca pe un câmp.
 */

const MINIM = {
  cod: "PROD",
  denumire: "Producție",
} as const;

describe("consimțământul de mutare a managerului", () => {
  it("citește bifa trimisă de browser („on”) ca `true`", () => {
    const rezultat = creeazaDepartamentSchema.parse({
      ...MINIM,
      muta_managerul_in_departament: "on",
    });
    expect(rezultat.muta_managerul_in_departament).toBe(true);
  });

  it("citește bifa lipsă (șirul gol) ca `false`", () => {
    const rezultat = creeazaDepartamentSchema.parse({
      ...MINIM,
      muta_managerul_in_departament: "",
    });
    expect(rezultat.muta_managerul_in_departament).toBe(false);
  });

  it("implicitul e `false`: un apelant care omite câmpul nu mută pe nimeni", () => {
    // Poarta contra unui POST direct către Server Action, fără formular.
    const rezultat = creeazaDepartamentSchema.parse(MINIM);
    expect(rezultat.muta_managerul_in_departament).toBe(false);
  });

  it("acceptă și booleanul, pentru apelurile din cod", () => {
    expect(
      creeazaDepartamentSchema.parse({ ...MINIM, muta_managerul_in_departament: true })
        .muta_managerul_in_departament,
    ).toBe(true);
  });

  it("ajunge și în schema de actualizare, derivată din cea de creare", () => {
    const rezultat = actualizeazaDepartamentSchema.parse({
      id: "0d4d3d1e-1f2b-4c3a-9e5f-6a7b8c9d0e1f",
      denumire: "Producție",
      muta_managerul_in_departament: "on",
    });
    expect(rezultat.muta_managerul_in_departament).toBe(true);
  });
});
