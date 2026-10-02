// src/lib/queries/organizations.test.ts
//
// Organizațiile contului curent, pentru comutatorul din topbar. Identitatea
// vine din sesiune (`getCurrentUser`), clientul din falsul strict al
// `@/lib/teste/actiune`.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

const { utilizatorFals } = vi.hoisted(() => ({ utilizatorFals: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: utilizatorFals }));

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID, USER_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest, type ClientFals } from "@/lib/teste/supabase-fals";
import { listUserOrganizations } from "./organizations";

let db: ClientFals;
beforeEach(() => {
  db = configureazaActiunea().server;
  utilizatorFals.mockReset();
  utilizatorFals.mockResolvedValue({ id: USER_ID, email: "a@b.ro", fullName: null });
});

function membru(
  id: string,
  name: string,
  rol: string,
  extra: Partial<{ status: string; deleted_at: string | null }> = {},
) {
  return {
    role: rol,
    organizations: { id, slug: id.slice(0, 4), name, status: "active", deleted_at: null, ...extra },
  };
}

describe("listUserOrganizations", () => {
  it("fără sesiune: listă goală, fără nicio interogare", async () => {
    utilizatorFals.mockResolvedValue(null);
    expect(await listUserOrganizations()).toEqual([]);
    expect(db.apeluri).toHaveLength(0);
  });

  it("doar apartenențele PROPRII (nu ale colegilor), active și neșterse", async () => {
    db.raspunde("organization_members", "select", { data: [] });
    await listUserOrganizations();
    const [apel] = db.apeluri;
    expect(areFiltru(apel, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(areFiltru(apel, "eq", "status", "active")).toBe(true);
    expect(apel?.coloane).toContain("organizations!inner");
  });

  it("scoate organizațiile suspendate sau șterse; păstrează `active` și `pending`, cu rolul propriu", async () => {
    db.raspunde("organization_members", "select", {
      data: [
        membru(ORG_ID, "Activă SRL", "org_admin"),
        membru(ID_1, "Nouă SRL", "employee", { status: "pending" }),
        membru(ID_2, "Suspendată SRL", "hr", { status: "suspended" }),
        membru(ID_3, "Ștearsă SRL", "hr", { deleted_at: "2026-01-01T00:00:00Z" }),
        { role: "manager", organizations: null },
      ],
    });

    const r = await listUserOrganizations();

    expect(r).toEqual([
      { id: ORG_ID, slug: ORG_ID.slice(0, 4), name: "Activă SRL", role: "org_admin" },
      { id: ID_1, slug: ID_1.slice(0, 4), name: "Nouă SRL", role: "employee" },
    ]);
  });

  it("ordonează după nume cu regulile limbii române (Ș între S și T, nu după Z)", async () => {
    db.raspunde("organization_members", "select", {
      data: [
        membru(ID_1, "Zeta SRL", "hr"),
        membru(ID_2, "Șantier SRL", "hr"),
        membru(ID_3, "Tâmplărie SRL", "hr"),
        membru(ORG_ID, "Alfa SRL", "hr"),
      ],
    });
    const r = await listUserOrganizations();
    expect(r.map((o) => o.name)).toEqual(["Alfa SRL", "Șantier SRL", "Tâmplărie SRL", "Zeta SRL"]);
  });

  it("eroare a bazei: listă goală (comutatorul nu cade), cu urmă în jurnal", async () => {
    const eroare = vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.raspunde("organization_members", "select", { error: eroarePostgrest("57014") });
    expect(await listUserOrganizations()).toEqual([]);
    expect(eroare).toHaveBeenCalled();
  });
});
