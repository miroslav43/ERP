// src/app/api/materiale/[versiuneId]/route.test.ts
//
// Proxy-ul de conținut de curs. Aici doar ce se poate verifica pe clientul
// fals: sesiunea, organizația activă, forma id-ului și rândul lipsă. Fluxul
// `Range` către Supabase Storage rămâne pe staging.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant/resolve-tenant", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru } from "@/lib/teste/supabase-fals";

import { GET } from "./route";

const cere = (versiuneId: string) =>
  GET(new Request(`https://app.test/api/materiale/${versiuneId}`), {
    params: Promise.resolve({ versiuneId }),
  });

describe("GET /api/materiale/[versiuneId]", () => {
  it("fără sesiune: 401, fără nicio citire", async () => {
    const { server } = configureazaActiunea({ sesiune: "neautentificat" });
    const r = await cere(ID_1);
    expect(r.status).toBe(401);
    expect(r.headers.get("content-type")).toContain("text/plain");
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără organizație activă: 403", async () => {
    const { server } = configureazaActiunea({ sesiune: "fara_organizatie" });
    const r = await cere(ID_1);
    expect(r.status).toBe(403);
    expect(server.apeluri).toHaveLength(0);
  });

  it("un id care nu e UUID: 404 cu textul rândului lipsă, FĂRĂ interogare (PRM-003)", async () => {
    // Azi `abc` ajungea la Postgres, 22P02 cădea în ramura `error` și ruta
    // răspundea 500 „Materialul nu a putut fi citit.".
    const { server } = configureazaActiunea();
    const r = await cere("abc");
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Materialul nu a fost găsit.");
    expect(server.apeluri).toHaveLength(0);
  });

  it("versiunea inexistentă sau ascunsă de RLS: 404 cu ACELAȘI text, filtrată pe organizație", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("course_material_versions", "select", { data: null });
    const r = await cere(ID_1);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Materialul nu a fost găsit.");
    const [apel] = server.apeluriPe("course_material_versions");
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });
});
