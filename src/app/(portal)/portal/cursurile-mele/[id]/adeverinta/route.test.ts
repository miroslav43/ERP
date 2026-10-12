// src/app/(portal)/portal/cursurile-mele/[id]/adeverinta/route.test.ts
//
// Adeverința de parcurgere: HTML din rândul imutabil `course_completion_records`.
// Aceeași clasă de defect ca `/documente/abc` — un id care nu e UUID cădea în
// ramura `error` ca 500.

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

const cere = (id: string) =>
  GET(new Request(`https://app.test/portal/cursurile-mele/${id}/adeverinta`), {
    params: Promise.resolve({ id }),
  });

describe("GET /portal/cursurile-mele/[id]/adeverinta", () => {
  it("fără sesiune: 401, fără nicio citire", async () => {
    const { server } = configureazaActiunea({ sesiune: "neautentificat" });
    const r = await cere(ID_1);
    expect(r.status).toBe(401);
    expect(server.apeluri).toHaveLength(0);
  });

  it("un id care nu e UUID: 404 cu textul rândului lipsă, FĂRĂ interogare (PRM-003)", async () => {
    const { server } = configureazaActiunea();
    const r = await cere("abc");
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Nu există încă o adeverință pentru acest curs.");
    expect(server.apeluri).toHaveLength(0);
  });

  it("fără dovadă de finalizare: 404 cu ACELAȘI text, filtrată pe organizație", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("course_completion_records", "select", { data: null });
    const r = await cere(ID_1);
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("Nu există încă o adeverință pentru acest curs.");
    const [apel] = server.apeluriPe("course_completion_records");
    expect(areFiltru(apel, "eq", "enrollment_id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
  });

  it("cu dovadă: HTML cu numele, cursul și amprenta, fără cache", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("course_completion_records", "select", {
      data: {
        ciclu: 1,
        finalizat_la: "2026-10-01T10:00:00Z",
        expira_la: null,
        total_materiale: 2,
        materiale_finalizate: 2,
        continut: {
          curs: { cod: "SSM-01", denumire: "Instruire SSM" },
          angajat: { nume: "Ion Popescu" },
          lectii: [{ ordine: 1, titlu: "Lecția 1", treapta: "bifa", finalizat_la: null }],
        },
        continut_checksum: "a".repeat(32),
      },
    });
    const r = await cere(ID_1);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const html = await r.text();
    expect(html).toContain("Ion Popescu");
    expect(html).toContain("Instruire SSM");
    expect(html).toContain("a".repeat(32));
  });
});
