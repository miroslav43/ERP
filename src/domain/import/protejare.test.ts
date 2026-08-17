import { describe, expect, it } from "vitest";

import { schemaLotImport, schemaAngajatProtejat } from "./validare";

/**
 * Lotul de import ajunge într-un fișier în Storage, ca să supraviețuiască între
 * previzualizare și aplicare. Prima versiune serializa rândurile exact cum
 * veniseau din Excel — adică urca CNP-urile și IBAN-urile a sute de angajați în
 * text simplu. Un fișier de import uitat acolo ar fi fost o breșă completă,
 * fără să atingă nicio politică RLS și fără să apară în niciun audit.
 *
 * Testul de față nu verifică criptografia, ci FORMA lotului: dacă cineva
 * reintroduce câmpul în clar, schema îl respinge. Verificarea trăiește lângă
 * schemă tocmai pentru că e o regulă despre ce are voie să existe pe disc, nu
 * despre cum se cifrează.
 */

const VALOARE_PROTEJATA = {
  ciphertext: "\\xdeadbeef",
  iv: "\\x0011223344556677889900aa",
  tag: "\\xaabbccddeeff00112233445566778899",
  keyVersion: 1,
  last4: "1234",
  hash: "amprenta-hmac",
} as const;

const ANGAJAT_MINIM = {
  rand: 2,
  marca: "001",
  first_name: "Ana",
  last_name: "Popescu",
  hired_on: "2026-01-15",
} as const;

describe("lotul de import nu poate conține date sensibile în clar", () => {
  it("acceptă un rând fără date sensibile", () => {
    expect(schemaAngajatProtejat.safeParse(ANGAJAT_MINIM).success).toBe(true);
  });

  it("acceptă valorile criptate", () => {
    const rezultat = schemaAngajatProtejat.safeParse({
      ...ANGAJAT_MINIM,
      cnpProtejat: VALOARE_PROTEJATA,
      ibanProtejat: VALOARE_PROTEJATA,
    });
    expect(rezultat.success).toBe(true);
  });

  it("RESPINGE un CNP în clar strecurat în lot", () => {
    const rezultat = schemaAngajatProtejat.safeParse({
      ...ANGAJAT_MINIM,
      cnp: "1990101123456",
    });
    // Zod în mod `strip` ignoră cheile necunoscute, deci nu eșuează — dar le
    // ELIMINĂ. Verificăm exact asta: valoarea nu supraviețuiește serializării.
    expect(rezultat.success).toBe(true);
    if (rezultat.success) {
      expect(rezultat.data).not.toHaveProperty("cnp");
      expect(JSON.stringify(rezultat.data)).not.toContain("1990101123456");
    }
  });

  it("RESPINGE un IBAN în clar strecurat în lot", () => {
    const rezultat = schemaAngajatProtejat.safeParse({
      ...ANGAJAT_MINIM,
      iban: "RO49AAAA1B31007593840000",
    });
    expect(rezultat.success).toBe(true);
    if (rezultat.success) {
      expect(JSON.stringify(rezultat.data)).not.toContain("RO49AAAA1B31007593840000");
    }
  });

  it("respinge criptotext care nu are forma bytea a PostgREST", () => {
    const rezultat = schemaAngajatProtejat.safeParse({
      ...ANGAJAT_MINIM,
      cnpProtejat: { ...VALOARE_PROTEJATA, ciphertext: "1990101123456" },
    });
    expect(rezultat.success).toBe(false);
  });

  it("respinge o versiune de cheie care nu e întreg pozitiv", () => {
    for (const keyVersion of [0, -1, 1.5]) {
      const rezultat = schemaAngajatProtejat.safeParse({
        ...ANGAJAT_MINIM,
        cnpProtejat: { ...VALOARE_PROTEJATA, keyVersion },
      });
      expect(rezultat.success, `keyVersion=${keyVersion} ar trebui respins`).toBe(false);
    }
  });

  it("limitează lotul, ca un fișier ostil să nu epuizeze memoria", () => {
    const prea_multe = Array.from({ length: 1001 }, (_, i) => ({
      ...ANGAJAT_MINIM,
      rand: i + 2,
      marca: String(i),
    }));
    expect(schemaLotImport.safeParse(prea_multe).success).toBe(false);
  });

  it("un lot întreg serializat nu conține niciun CNP recognoscibil", () => {
    const lot = [
      {
        ...ANGAJAT_MINIM,
        rand: 2,
        marca: "001",
        cnp: "1990101123456",
        cnpProtejat: VALOARE_PROTEJATA,
      },
      {
        ...ANGAJAT_MINIM,
        rand: 3,
        marca: "002",
        cnp: "2990101123456",
        cnpProtejat: VALOARE_PROTEJATA,
      },
    ];
    const rezultat = schemaLotImport.safeParse(lot);
    expect(rezultat.success).toBe(true);
    if (rezultat.success) {
      const serializat = JSON.stringify(rezultat.data);
      // Verificăm valorile CONCRETE, nu un tipar de 13 cifre: criptotextul
      // hexazecimal conține el însuși șiruri lungi de cifre, iar un test care
      // pică pe ele ar fi zgomot, nu semnal.
      expect(serializat).not.toContain("1990101123456");
      expect(serializat).not.toContain("2990101123456");
      expect(serializat).toContain("cnpProtejat");
    }
  });
});
