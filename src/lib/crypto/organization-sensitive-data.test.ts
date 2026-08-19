// src/lib/crypto/organization-sensitive-data.test.ts
import { describe, expect, it, vi } from "vitest";

const chei = vi.hoisted(() => ({
  v1: Buffer.alloc(32, 0x11).toString("base64"),
  hmac: Buffer.alloc(32, 0x33).toString("base64"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  serverEnv: {
    HR_ENCRYPTION_KEYS: { "1": chei.v1 },
    HR_ENCRYPTION_ACTIVE_KEY: "1",
    HR_HASH_KEY: chei.hmac,
  },
}));

const { EroareCnpReprezentant, pregatestePayloadCnp } = await import(
  "./organization-sensitive-data"
);

// CNP valid, verificat programatic cu algoritmul oficial (cifră de control 5).
const CNP_VALID = "1960101221115";

describe("pregatestePayloadCnp", () => {
  it("întoarce toate câmpurile null pentru CNP absent", () => {
    expect(pregatestePayloadCnp(null)).toEqual({
      cnp_ciphertext: null,
      cnp_iv: null,
      cnp_tag: null,
      cnp_key_version: null,
      cnp_last4: null,
    });
    expect(pregatestePayloadCnp("")).toEqual({
      cnp_ciphertext: null,
      cnp_iv: null,
      cnp_tag: null,
      cnp_key_version: null,
      cnp_last4: null,
    });
  });

  it("criptează un CNP valid și expune ultimele 4 cifre necriptat", () => {
    const payload = pregatestePayloadCnp(CNP_VALID);
    expect(payload.cnp_last4).toBe(CNP_VALID.slice(-4));
    expect(payload.cnp_key_version).toBe(1);
    expect(payload.cnp_ciphertext).toMatch(/^\\x[0-9a-f]+$/);
    expect(payload.cnp_ciphertext).not.toContain(CNP_VALID);
  });

  it("aruncă EroareCnpReprezentant pentru un CNP invalid", () => {
    expect(() => pregatestePayloadCnp("123")).toThrowError(EroareCnpReprezentant);
  });
});
