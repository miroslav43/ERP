// src/lib/auth/platform.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ce apără fișierul: titlul paginilor din consola de platformă (PRM-007).
 *
 * `notFound()` aruncat de `requirePlatformAdmin()` în layout-ul consolei NU
 * oprește rezolvarea `metadata` STATICE a paginii: un `org_admin` care deschidea
 * `/super-admin` primea corpul de 404, dar fila spunea „Panou de platformă ·
 * Administrativo” — adică trăda existența consolei. `metadataPlatforma` dă
 * titlul doar unui administrator de platformă activ și cade pe titlul implicit
 * în rest, inclusiv la eroare de citire (fail closed).
 */
const getCurrentUser = vi.fn();
const maybeSingle = vi.fn();

vi.mock("./current-user", () => ({ getCurrentUser }));

vi.mock("@/lib/supabase/server", () => {
  const lant = {
    select: () => lant,
    eq: () => lant,
    is: () => lant,
    maybeSingle,
  };
  return { createServerSupabase: () => Promise.resolve({ from: () => lant }) };
});

const { metadataPlatforma } = await import("./platform");

const UTILIZATOR = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ana@exemplu.ro",
  fullName: "Ionescu Ana",
};

describe("metadataPlatforma", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    maybeSingle.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("dă titlul unui administrator de platformă activ", async () => {
    getCurrentUser.mockResolvedValue(UTILIZATOR);
    maybeSingle.mockResolvedValue({ data: { id: "pa-1" }, error: null });

    await expect(metadataPlatforma("Panou de platformă")()).resolves.toEqual({
      title: "Panou de platformă",
    });
  });

  it("nu dă niciun titlu cuiva care nu e în `platform_admins`", async () => {
    getCurrentUser.mockResolvedValue(UTILIZATOR);
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(metadataPlatforma("Panou de platformă")()).resolves.toEqual({});
  });

  it("nu dă niciun titlu unui vizitator fără sesiune", async () => {
    getCurrentUser.mockResolvedValue(null);

    await expect(metadataPlatforma("Panou de platformă")()).resolves.toEqual({});
    expect(maybeSingle).not.toHaveBeenCalled();
  });

  it("nu dă niciun titlu la eroare de citire (fail closed)", async () => {
    getCurrentUser.mockResolvedValue(UTILIZATOR);
    maybeSingle.mockResolvedValue({ data: null, error: { code: "PGRST000" } });

    await expect(metadataPlatforma("Panou de platformă")()).resolves.toEqual({});
  });
});
