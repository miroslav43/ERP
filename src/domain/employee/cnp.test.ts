// src/domain/employee/cnp.test.ts
import { describe, expect, it } from "vitest";

import { cifraControlCnp, valideazaCnp } from "./cnp";

/** Construiește un CNP valid algoritmic — niciun CNP real nu apare în teste. */
function construiesteCnp(primele12: string): string {
  const control = cifraControlCnp(primele12);
  if (control === null) {
    throw new Error(`Prefix invalid: ${primele12}`);
  }
  return `${primele12}${String(control)}`;
}

const PONDERI = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

function rest11(primele12: string): number {
  return PONDERI.reduce((acc, p, i) => acc + (primele12.charCodeAt(i) - 48) * p, 0) % 11;
}

describe("valideazaCnp — CNP-uri valide", () => {
  it("extrage data, genul și județul pentru un bărbat născut în 1999", () => {
    const rezultat = valideazaCnp(construiesteCnp("199010101234"));
    expect(rezultat.valid).toBe(true);
    if (!rezultat.valid) return;
    expect(rezultat.dataNasterii).toBe("1999-01-01");
    expect(rezultat.gen).toBe("masculin");
    expect(rezultat.judet).toBe("01");
    expect(rezultat.denumireJudet).toBe("Alba");
    expect(rezultat.rezidentStrain).toBe(false);
  });

  it("recunoaște genul feminin și secolul 1900 pentru cifra 2", () => {
    const rezultat = valideazaCnp(construiesteCnp("285121522111"));
    expect(rezultat.valid).toBe(true);
    if (!rezultat.valid) return;
    expect(rezultat.gen).toBe("feminin");
    expect(rezultat.dataNasterii).toBe("1985-12-15");
    expect(rezultat.denumireJudet).toBe("Iași");
  });

  it("recunoaște secolul 1800 pentru cifrele 3 și 4", () => {
    const rezultat = valideazaCnp(construiesteCnp("389070340123"));
    expect(rezultat.valid).toBe(true);
    if (!rezultat.valid) return;
    expect(rezultat.dataNasterii).toBe("1889-07-03");
    expect(rezultat.denumireJudet).toBe("București");
  });

  it("recunoaște secolul 2000 pentru cifrele 5 și 6", () => {
    const rezultat = valideazaCnp(construiesteCnp("600062951777"));
    expect(rezultat.valid).toBe(true);
    if (!rezultat.valid) return;
    expect(rezultat.dataNasterii).toBe("2000-06-29");
    expect(rezultat.gen).toBe("feminin");
    expect(rezultat.denumireJudet).toBe("Călărași");
  });

  it("acceptă 29 februarie într-un an bisect și o respinge într-unul obișnuit", () => {
    const bisect = valideazaCnp(construiesteCnp("500022912345"));
    expect(bisect.valid).toBe(true);
    const nebisect = valideazaCnp(construiesteCnp("100022912345"));
    expect(nebisect.valid).toBe(false);
    if (nebisect.valid) return;
    expect(nebisect.motiv).toBe("data_nasterii");
  });

  it("marchează secolul ca incert pentru rezidenții străini (cifrele 7 și 8)", () => {
    const rezultat = valideazaCnp(construiesteCnp("790010170456"));
    expect(rezultat.valid).toBe(true);
    if (!rezultat.valid) return;
    expect(rezultat.rezidentStrain).toBe(true);
    expect(rezultat.secolIncert).toBe(true);
    expect(rezultat.denumireJudet).toBe("Străinătate (persoane rezidente)");
  });

  it("transformă restul 10 în cifra de control 1", () => {
    const prefix = Array.from(
      { length: 999 },
      (_, i) => `199010101${String(i + 1).padStart(3, "0")}`,
    ).find((candidat) => rest11(candidat) === 10);
    expect(prefix).toBeDefined();
    if (prefix === undefined) return;
    expect(cifraControlCnp(prefix)).toBe(1);
    expect(valideazaCnp(`${prefix}1`).valid).toBe(true);
  });

  it("ignoră spațiile și liniuțele din valoarea introdusă", () => {
    const cnp = construiesteCnp("199010101234");
    expect(valideazaCnp(` ${cnp.slice(0, 6)} ${cnp.slice(6)} `).valid).toBe(true);
  });
});

describe("valideazaCnp — CNP-uri invalide", () => {
  it("respinge valoarea goală", () => {
    const rezultat = valideazaCnp("   ");
    expect(rezultat).toMatchObject({ valid: false, motiv: "lipsa" });
  });

  it("respinge caracterele care nu sunt cifre", () => {
    expect(valideazaCnp("19901O101234X")).toMatchObject({ valid: false, motiv: "caractere" });
  });

  it("respinge lungimea greșită", () => {
    const rezultat = valideazaCnp("19901010123");
    expect(rezultat).toMatchObject({ valid: false, motiv: "lungime" });
    if (rezultat.valid) return;
    expect(rezultat.mesaj).toContain("11 cifre");
  });

  it("respinge prima cifră 0 sau 9", () => {
    expect(valideazaCnp(construiesteCnp("099010101234"))).toMatchObject({
      valid: false,
      motiv: "cifra_sex",
    });
    expect(valideazaCnp(construiesteCnp("999010101234"))).toMatchObject({
      valid: false,
      motiv: "cifra_sex",
    });
  });

  it("respinge luna și ziua imposibile", () => {
    expect(valideazaCnp(construiesteCnp("199130101234"))).toMatchObject({
      valid: false,
      motiv: "data_nasterii",
    });
    expect(valideazaCnp(construiesteCnp("199013201234"))).toMatchObject({
      valid: false,
      motiv: "data_nasterii",
    });
  });

  it("respinge codurile de județ inexistente", () => {
    expect(valideazaCnp(construiesteCnp("199010147234"))).toMatchObject({
      valid: false,
      motiv: "judet",
    });
    expect(valideazaCnp(construiesteCnp("199010100234"))).toMatchObject({
      valid: false,
      motiv: "judet",
    });
    expect(valideazaCnp(construiesteCnp("199010153234"))).toMatchObject({
      valid: false,
      motiv: "judet",
    });
  });

  it("respinge numărul de ordine 000", () => {
    expect(valideazaCnp(construiesteCnp("199010101000"))).toMatchObject({
      valid: false,
      motiv: "numar_ordine",
    });
  });

  it("respinge cifra de control greșită", () => {
    const cnp = construiesteCnp("199010101234");
    const gresit = `${cnp.slice(0, 12)}${String((Number(cnp.slice(12)) + 1) % 10)}`;
    expect(valideazaCnp(gresit)).toMatchObject({ valid: false, motiv: "cifra_control" });
  });

  it("respinge o dată de naștere din viitor când primește data de referință", () => {
    // 5 = secolul XXI, 99 = anul 2099, 01-01 = 1 ianuarie. O dată reală, dar
    // viitoare. Varianta anterioară folosea „12-31" ca an-lună, adică luna 31 —
    // care nu există, deci testul trecea prin ramura `data_nasterii` și nu
    // atingea niciodată verificarea pe care pretindea că o acoperă.
    const rezultat = valideazaCnp(construiesteCnp("599010101234"), { astazi: "2026-08-17" });
    expect(rezultat).toMatchObject({ valid: false, motiv: "in_viitor" });
  });
});
