// src/lib/auth/current-user.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ce apără fișierul: maparea claim-urilor din JWT în `AuthUser`, și mai ales
 * garda de la intrare.
 *
 * `getClaims()` are TREI variante de retur, nu două: succes,
 * `{ data: null, error: AuthError }`, și `{ data: null, error: null }` pentru
 * un vizitator fără sesiune. Un port mecanic al gărzii vechi (scrisă pentru
 * `getUser()`, unde `data` era mereu un obiect) ar trece de a treia variantă și
 * ar da TypeError pe `data.claims`.
 */
const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => Promise.resolve({ auth: { getClaims } }),
}));

const { getCurrentUser } = await import("./current-user");

describe("getCurrentUser", () => {
  beforeEach(() => {
    getClaims.mockReset();
  });

  it("mapează claim-urile complete în AuthUser", async () => {
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "11111111-1111-4111-8111-111111111111",
          email: "ana@exemplu.ro",
          user_metadata: { full_name: "  Ionescu Ana  " },
        },
      },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      email: "ana@exemplu.ro",
      fullName: "Ionescu Ana",
    });
  });

  it("întoarce null când nu există sesiune (data null, error null)", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("întoarce null la eroare de verificare", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("semnătură invalidă") });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("acceptă un cont fără e-mail și fără nume", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "22222222-2222-4222-8222-222222222222" } },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      email: "",
      fullName: null,
    });
  });

  it("tratează un nume format doar din spații ca lipsă", async () => {
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "33333333-3333-4333-8333-333333333333",
          email: "x@y.ro",
          user_metadata: { full_name: "   " },
        },
      },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toMatchObject({ fullName: null });
  });
});
