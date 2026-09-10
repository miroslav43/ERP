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

/**
 * Codul e opțional din `0139_cod_departament_optional.sql`, iar forma pe care o
 * ia câmpul gol NU e un detaliu de stil: indexul unic `departments_org_cod_uniq`
 * e pe `lower(cod)`, iar Postgres consideră fiecare NULL distinct. Două șiruri
 * vide, în schimb, s-ar ciocni — a doua firmă care creează un al doilea
 * departament fără cod ar primi un conflict de unicitate pe un câmp pe care l-a
 * lăsat gol intenționat.
 */
describe("codul opțional al departamentului", () => {
  it("citește câmpul gol trimis de formular ca `null`, nu ca șir vid", () => {
    const rezultat = creeazaDepartamentSchema.parse({ denumire: "Producție", cod: "" });
    expect(rezultat.cod).toBeNull();
  });

  it("implicitul e `null`: un apelant care omite câmpul creează un departament fără cod", () => {
    const rezultat = creeazaDepartamentSchema.parse({ denumire: "Producție" });
    expect(rezultat.cod).toBeNull();
  });

  it("taie spațiile din jur, ca să nu treacă drept cod un câmp atins din greșeală", () => {
    expect(creeazaDepartamentSchema.parse({ denumire: "Producție", cod: "  " }).cod).toBeNull();
    expect(creeazaDepartamentSchema.parse({ denumire: "Producție", cod: " PROD " }).cod).toBe(
      "PROD",
    );
  });

  it("respinge un cod peste 32 de caractere, cât ține `departments_cod_len`", () => {
    const rezultat = creeazaDepartamentSchema.safeParse({
      denumire: "Producție",
      cod: "P".repeat(33),
    });
    expect(rezultat.success).toBe(false);
  });

  it("se poate completa mai târziu: schema de actualizare îl acceptă", () => {
    const rezultat = actualizeazaDepartamentSchema.parse({
      id: "0d4d3d1e-1f2b-4c3a-9e5f-6a7b8c9d0e1f",
      denumire: "Producție",
      cod: "PROD",
    });
    expect(rezultat.cod).toBe("PROD");
  });

  it("se poate și șterge: codul golit la editare devine `null`", () => {
    const rezultat = actualizeazaDepartamentSchema.parse({
      id: "0d4d3d1e-1f2b-4c3a-9e5f-6a7b8c9d0e1f",
      denumire: "Producție",
      cod: "",
    });
    expect(rezultat.cod).toBeNull();
  });
});

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
