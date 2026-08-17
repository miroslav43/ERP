// src/lib/crypto/aes-gcm.test.ts
import { describe, expect, it, vi } from "vitest";

const chei = vi.hoisted(() => ({
  v1: Buffer.alloc(32, 0x11).toString("base64"),
  v2: Buffer.alloc(32, 0x22).toString("base64"),
  hmac: Buffer.alloc(32, 0x33).toString("base64"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  serverEnv: {
    HR_ENCRYPTION_KEYS: { "1": chei.v1, "2": chei.v2 },
    HR_ENCRYPTION_ACTIVE_KEY: "2",
    HR_HASH_KEY: chei.hmac,
  },
}));

const { amprentaSensibila, decrypt, encrypt, versiuneaActiva, versiuniDisponibile } =
  await import("./aes-gcm");

describe("aes-gcm", () => {
  it("face dus-întors pe un text cu diacritice", () => {
    const valoare = "Ștefănescu Ioan — 1960101010101";
    expect(decrypt(encrypt(valoare))).toBe(valoare);
  });

  it("folosește implicit cheia activă", () => {
    expect(encrypt("1960101010101").keyVersion).toBe("2");
    expect(versiuneaActiva()).toBe("2");
    expect(versiuniDisponibile()).toEqual(["1", "2"]);
  });

  it("generează un IV nou la fiecare criptare a aceluiași text", () => {
    const a = encrypt("1960101010101");
    const b = encrypt("1960101010101");
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.tag.equals(b.tag)).toBe(false);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("citește un rând scris cu o cheie veche", () => {
    const vechi = encrypt("RO49AAAA1B31007593840000", "1");
    expect(vechi.keyVersion).toBe("1");
    expect(decrypt(vechi)).toBe("RO49AAAA1B31007593840000");
  });

  it("refuză decriptarea când eticheta de autentificare a fost modificată", () => {
    const criptat = encrypt("1960101010101");
    const tagStricat = Buffer.from(criptat.tag);
    tagStricat[0] = (tagStricat[0] ?? 0) ^ 0xff;
    expect(() => decrypt({ ...criptat, tag: tagStricat })).toThrowError(/modificate după salvare/);
  });

  it("refuză decriptarea când textul criptat a fost modificat", () => {
    const criptat = encrypt("1960101010101");
    const stricat = Buffer.from(criptat.ciphertext);
    stricat[0] = (stricat[0] ?? 0) ^ 0x01;
    expect(() => decrypt({ ...criptat, ciphertext: stricat })).toThrowError(
      /modificate după salvare/,
    );
  });

  it("refuză decriptarea cu altă cheie decât cea folosită la scriere", () => {
    const criptat = encrypt("1960101010101", "1");
    expect(() => decrypt({ ...criptat, keyVersion: "2" })).toThrowError(/nu este cea corectă/);
  });

  it("dă o eroare clară pentru o versiune de cheie neconfigurată", () => {
    const criptat = encrypt("1960101010101");
    expect(() => decrypt({ ...criptat, keyVersion: "7" })).toThrowError(
      /versiunea „7” nu mai este configurată/,
    );
    expect(() => encrypt("1960101010101", "7")).toThrowError(/versiunea „7”/);
  });

  it("respinge un IV sau o etichetă de lungime greșită", () => {
    const criptat = encrypt("1960101010101");
    expect(() => decrypt({ ...criptat, iv: Buffer.alloc(8) })).toThrowError(/octeți în loc de 12/);
    expect(() => decrypt({ ...criptat, tag: Buffer.alloc(8) })).toThrowError(/octeți în loc de 16/);
  });

  it("respinge criptarea unei valori goale", () => {
    expect(() => encrypt("")).toThrowError(/valoare goală/);
  });

  it("produce amprente deterministe și diferite pentru valori diferite", () => {
    const a = amprentaSensibila("1960101010101");
    expect(a).toBe(amprentaSensibila("1960101010101"));
    expect(a).not.toBe(amprentaSensibila("1960101010102"));
    expect(a).not.toContain("1960101010101");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("respinge o cheie care nu are 32 de octeți", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/config/env", () => ({
      serverEnv: {
        HR_ENCRYPTION_KEYS: { "1": Buffer.alloc(16, 0x44).toString("base64") },
        HR_ENCRYPTION_ACTIVE_KEY: "1",
        HR_HASH_KEY: chei.hmac,
      },
    }));
    const modul = await import("./aes-gcm");
    expect(() => modul.encrypt("1960101010101")).toThrowError(/32 de octeți/);
    vi.doUnmock("@/config/env");
    vi.resetModules();
  });
});
