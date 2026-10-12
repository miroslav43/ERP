// src/app/(app)/actions.test.ts
//
// Căutarea de angajați din paleta Ctrl+K (`cautaAngajatiPaleta`). E o acțiune
// de CITIRE, fără `createAction`: straturile ei sunt sesiunea, organizația din
// tenant, `employees:read` la orice scope și clientul sub RLS. Testul verifică
// exact porțile astea și forma interogării — nu politica RLS (aia rămâne pe
// `tests/rls/izolare.sql`).

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
vi.mock("next/server", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextServer(await orig()),
);
vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/supabase/admin", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseAdmin(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/auth/permissions", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()),
);

import { configureazaActiunea, ID_1, ID_2, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru } from "@/lib/teste/supabase-fals";
import { cautaAngajatiPaleta } from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("cautaAngajatiPaleta", () => {
  it("sub două caractere nu întreabă baza: „a” ar potrivi pe toată lumea", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:read": "all" } });
    expect(await cautaAngajatiPaleta("a")).toEqual([]);
    expect(await cautaAngajatiPaleta("   ")).toEqual([]);
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără sesiune sau fără firmă aleasă: listă goală, nicio interogare", async () => {
    const { server } = configureazaActiunea({ sesiune: "neautentificat" });
    expect(await cautaAngajatiPaleta("pop")).toEqual([]);
    const { server: server2 } = configureazaActiunea({ sesiune: "fara_organizatie" });
    expect(await cautaAngajatiPaleta("pop")).toEqual([]);
    expect(server.apeluri).toHaveLength(0);
    expect(server2.apeluri).toHaveLength(0);
  });

  it("fără employees:read (absent sau none): listă goală, nicio interogare", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "leave:read": "all" } });
    expect(await cautaAngajatiPaleta("pop")).toEqual([]);
    const { server: server2 } = configureazaActiunea({ permisiuni: { "employees:read": "none" } });
    expect(await cautaAngajatiPaleta("pop")).toEqual([]);
    expect(server.apeluri).toHaveLength(0);
    expect(server2.apeluri).toHaveLength(0);
  });

  it("cu employees:read (și la `own`): filtrează pe organizație, nesteasă, nume sau marcă, plafon 8", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:read": "own" } });
    server.raspunde("employees", "select", {
      data: [
        { id: ID_1, full_name: "Ana Popescu", marca: "0007", functie: "Contabil" },
        { id: ID_2, full_name: "Ion Pop", marca: "0008", functie: null },
      ],
    });
    const r = await cautaAngajatiPaleta("  Pop ");
    expect(r).toEqual([
      { id: ID_1, eticheta: "Ana Popescu · Contabil", href: `/angajati/${ID_1}` },
      { id: ID_2, eticheta: "Ion Pop", href: `/angajati/${ID_2}` },
    ]);
    const [apel] = server.apeluri;
    expect(apel?.tabela).toBe("employees");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(
      apel?.filtre.some((f) => f.metoda === "or" && String(f.argumente[0]).includes("%Pop%")),
    ).toBe(true);
    expect(apel?.filtre.some((f) => f.metoda === "limit" && f.argumente[0] === 8)).toBe(true);
  });

  it("curăță metacaracterele LIKE și taie termenul la 60 de caractere", async () => {
    const { server } = configureazaActiunea({ permisiuni: { "employees:read": "all" } });
    server.raspunde("employees", "select", { data: [] });
    await cautaAngajatiPaleta("%_po\\" + "x".repeat(100));
    const [apel] = server.apeluri;
    const or = apel?.filtre.find((f) => f.metoda === "or");
    const text = String(or?.argumente[0]);
    expect(text).not.toContain("%_");
    expect(text).not.toContain("\\");
    // „%" + termen + „%": termenul curățat are cel mult 60 de caractere.
    const termen = text.split("full_name.ilike.")[1]?.split(",")[0] ?? "";
    expect(termen.length).toBeLessThanOrEqual(62);
  });
});
