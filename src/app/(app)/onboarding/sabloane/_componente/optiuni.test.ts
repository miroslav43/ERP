// src/app/(app)/onboarding/sabloane/_componente/optiuni.test.ts
//
// Listele din care alege asistentul de șablon. Cursurile și materialele se
// cer DOAR când modulul de cursuri e activ — altfel cardurile apar dezactivate,
// nu pagina întreagă cade pe 404.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
vi.mock("@/lib/auth/features", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.features(await orig()),
);
vi.mock("@/lib/queries/cursuri", () => ({ listeazaCursuri: vi.fn() }));

import { listeazaCursuri } from "@/lib/queries/cursuri";
import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru } from "@/lib/teste/supabase-fals";

import { optiuniAsistent } from "./optiuni";

const cursuriFalse = vi.mocked(listeazaCursuri);

beforeEach(() => {
  cursuriFalse.mockReset();
});

describe("optiuniAsistent", () => {
  it("modulul de cursuri stins: nu cere nici cursuri, nici materiale", async () => {
    const { server } = configureazaActiunea({ functii: ["onboarding"] });
    server.raspunde("departments", "select", { data: [{ id: ID_1, denumire: "IT" }] });
    server.raspunde("employees", "select", { data: [] });

    const r = await optiuniAsistent(ORG_ID);

    expect(r).toEqual({
      departamente: [{ id: ID_1, denumire: "IT" }],
      cursuri: [],
      materiale: [],
      angajati: [],
    });
    expect(cursuriFalse).not.toHaveBeenCalled();
    expect(server.apeluriPe("course_materials")).toHaveLength(0);
  });

  it("modulul activ: cursurile publicate și materialele cu versiune, în forma {id, denumire}", async () => {
    const { server } = configureazaActiunea({ functii: ["onboarding", "courses"] });
    server.raspunde("departments", "select", { data: null });
    server.raspunde("course_materials", "select", { data: [{ id: ID_2, titlu: "Regulament" }] });
    server.raspunde("employees", "select", {
      data: [
        { id: ID_3, full_name: "Ana Pop", marca: "001" },
        { id: ID_1, full_name: null, marca: "002" },
      ],
    });
    cursuriFalse.mockResolvedValue({
      randuri: [{ id: ID_1, denumire: "Protecția muncii" }],
    } as unknown as Awaited<ReturnType<typeof listeazaCursuri>>);

    const r = await optiuniAsistent(ORG_ID);

    expect(r.cursuri).toEqual([{ id: ID_1, denumire: "Protecția muncii" }]);
    expect(r.materiale).toEqual([{ id: ID_2, denumire: "Regulament" }]);
    // Fără nume complet, angajatul apare după marcă — nu ca rând gol.
    expect(r.angajati).toEqual([
      { id: ID_3, nume: "Ana Pop" },
      { id: ID_1, nume: "002" },
    ]);
    expect(r.departamente).toEqual([]);
    expect(cursuriFalse).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ doar_publicate: "da", cursor: null }),
    );

    const [materiale] = server.apeluriPe("course_materials");
    expect(areFiltru(materiale, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(materiale, "not", "versiune_curenta_id", "is")).toBe(true);
    expect(areFiltru(materiale, "is", "deleted_at", null)).toBe(true);

    const [departamente] = server.apeluriPe("departments");
    expect(areFiltru(departamente, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(departamente, "eq", "activ", true)).toBe(true);
  });

  it("departamentele șterse logic nu apar printre opțiunile asistentului", async () => {
    // `departments_select` (0005_hr_rls.sql) nu filtrează `deleted_at`, deci
    // filtrul trebuie pus de citire — cum îl pun toate celelalte citiri pe
    // `departments` (`src/lib/queries/departments.ts`). Aici lipsește: un
    // departament șters, dar rămas `activ`, poate fi ales ca țintă de șablon.
    const { server } = configureazaActiunea({ functii: ["onboarding"] });
    server.raspunde("departments", "select", { data: [] });
    server.raspunde("employees", "select", { data: [] });

    await optiuniAsistent(ORG_ID);

    const [departamente] = server.apeluriPe("departments");
    expect(areFiltru(departamente, "is", "deleted_at", null)).toBe(true);
  });
});
