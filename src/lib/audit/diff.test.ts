// src/lib/audit/diff.test.ts
import { describe, expect, it } from "vitest";

import { VALOARE_MASCATA, comparaPayload, esteCheieSensibila, formateazaValoare } from "./diff";

describe("comparaPayload", () => {
  it("nu raportează nimic pentru payload-uri identice", () => {
    expect(
      comparaPayload({ name: "Acme", plan: "trial" }, { name: "Acme", plan: "trial" }),
    ).toEqual([]);
  });

  it("ignoră ordinea cheilor", () => {
    expect(comparaPayload({ a: 1, b: 2 }, { b: 2, a: 1 })).toEqual([]);
  });

  it("detectează un câmp modificat", () => {
    const modificari = comparaPayload({ plan: "trial" }, { plan: "starter" });
    expect(modificari).toHaveLength(1);
    expect(modificari[0]).toEqual({
      cale: ["plan"],
      tip: "modificat",
      inainte: "trial",
      dupa: "starter",
      mascat: false,
    });
  });

  it("detectează câmpuri adăugate și șterse", () => {
    const modificari = comparaPayload({ vechi: 1 }, { nou: 2 });
    expect(modificari.map((m) => [m.cale.join("."), m.tip])).toEqual([
      ["nou", "adaugat"],
      ["vechi", "sters"],
    ]);
  });

  it("tratează crearea (before = null) ca listă de câmpuri adăugate", () => {
    const modificari = comparaPayload(null, { name: "Acme", seats_limit: 5 });
    expect(modificari.every((m) => m.tip === "adaugat")).toBe(true);
    expect(modificari.map((m) => m.cale.join("."))).toEqual(["name", "seats_limit"]);
    expect(modificari[0]?.inainte).toBeUndefined();
  });

  it("tratează ștergerea (after = null) ca listă de câmpuri șterse", () => {
    const modificari = comparaPayload({ name: "Acme" }, null);
    expect(modificari).toHaveLength(1);
    expect(modificari[0]?.tip).toBe("sters");
    expect(modificari[0]?.dupa).toBeUndefined();
  });

  it("distinge null (gol) de câmp lipsă", () => {
    const modificari = comparaPayload({ suspended_reason: "abuz" }, { suspended_reason: null });
    expect(modificari[0]).toMatchObject({ tip: "modificat", inainte: "abuz", dupa: null });
  });

  it("intră în obiecte imbricate și construiește calea completă", () => {
    const modificari = comparaPayload(
      { settings: { limita: 10, culoare: "albastru" } },
      { settings: { limita: 25, culoare: "albastru" } },
    );
    expect(modificari).toHaveLength(1);
    expect(modificari[0]?.cale).toEqual(["settings", "limita"]);
    expect(modificari[0]?.dupa).toBe(25);
  });

  it("se oprește la adâncimea maximă și raportează obiectul întreg", () => {
    const modificari = comparaPayload(
      { a: { b: { c: 1 } } },
      { a: { b: { c: 2 } } },
      {
        adancimeMaxima: 1,
      },
    );
    expect(modificari).toHaveLength(1);
    expect(modificari[0]?.cale).toEqual(["a", "b"]);
    expect(modificari[0]?.dupa).toEqual({ c: 2 });
  });

  it("compară listele ca valoare unică", () => {
    const modificari = comparaPayload({ roluri: ["hr"] }, { roluri: ["hr", "manager"] });
    expect(modificari).toHaveLength(1);
    expect(modificari[0]?.dupa).toEqual(["hr", "manager"]);
  });

  it("nu raportează liste identice", () => {
    expect(comparaPayload({ roluri: ["hr", "manager"] }, { roluri: ["hr", "manager"] })).toEqual(
      [],
    );
  });

  it("maschează valorile din chei sensibile, oriunde în cale", () => {
    const modificari = comparaPayload(
      { token_hash: "abc", profil: { cnp: "1900101070011" } },
      { token_hash: "def", profil: { cnp: "1900101070022" } },
    );
    expect(modificari.every((m) => m.mascat)).toBe(true);
    expect(modificari.map((m) => m.dupa)).toEqual([VALOARE_MASCATA, VALOARE_MASCATA]);
    expect(JSON.stringify(modificari)).not.toContain("1900101070022");
  });

  it("nu maschează valorile null (nu există ce ascunde)", () => {
    const modificari = comparaPayload({ iban: "RO49AAAA1B31007593840000" }, { iban: null });
    expect(modificari[0]?.inainte).toBe(VALOARE_MASCATA);
    expect(modificari[0]?.dupa).toBeNull();
  });

  it("acceptă payload-uri scalare", () => {
    const modificari = comparaPayload("activ", "suspendat");
    expect(modificari).toEqual([
      { cale: ["valoare"], tip: "modificat", inainte: "activ", dupa: "suspendat", mascat: false },
    ]);
  });

  it("nu modifică argumentele primite", () => {
    const inainte = { plan: "trial" };
    const dupa = { plan: "starter" };
    comparaPayload(inainte, dupa);
    expect(inainte).toEqual({ plan: "trial" });
    expect(dupa).toEqual({ plan: "starter" });
  });
});

describe("esteCheieSensibila", () => {
  it("recunoaște tiparele uzuale", () => {
    for (const cheie of ["token", "token_hash", "client_secret", "parola", "CNP", "iban"]) {
      expect(esteCheieSensibila(cheie)).toBe(true);
    }
  });

  it("lasă cheile obișnuite nemodificate", () => {
    for (const cheie of ["plan", "name", "seats_limit"]) {
      expect(esteCheieSensibila(cheie)).toBe(false);
    }
  });
});

describe("formateazaValoare", () => {
  it("traduce absența, golul și booleanele", () => {
    expect(formateazaValoare(undefined)).toBe("—");
    expect(formateazaValoare(null)).toBe("(gol)");
    expect(formateazaValoare(true)).toBe("Da");
    expect(formateazaValoare(false)).toBe("Nu");
    expect(formateazaValoare("")).toBe("(gol)");
  });

  it("serializează obiectele compact", () => {
    expect(formateazaValoare({ a: 1 })).toBe('{"a":1}');
  });
});
