// src/lib/queries/profile.test.ts
//
// Profilul propriu (un rând, pe `id`), avatarele pe o listă de conturi (fără
// null și duplicate) și avatarele unei organizații — în doi pași, cu filtru
// EXPLICIT pe organizație, fiindcă `app.shares_org` vede toate firmele
// autorului, nu doar pe cea din sesiune.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import { configureazaActiunea, ID_1, ID_2, ID_3, ORG_ID, USER_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import { avataturiPeUtilizatori, citesteProfilPropriu, toateAvatarurile } from "./profile";

describe("citesteProfilPropriu", () => {
  it("rândul viu al contului, pe `id`", async () => {
    const { server } = configureazaActiunea();
    const profil = {
      id: USER_ID,
      email: "ana@firma.ro",
      full_name: "Ana Pop",
      phone: null,
      avatar_path: "avatars/a.png",
      last_seen_at: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    server.raspunde("profiles", "select", { data: profil });

    expect(await citesteProfilPropriu(USER_ID)).toEqual(profil);
    const [apel] = server.apeluri;
    expect(areFiltru(apel, "eq", "id", USER_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
    expect(apel?.terminal).toBe("maybeSingle");
    // Profilul e al contului, nu al firmei: fără filtru de organizație.
    expect(areFiltru(apel, "eq", "organization_id")).toBe(false);
  });

  it("profil absent ⇒ null; eroare ⇒ se aruncă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("profiles", "select", { data: null });
    expect(await citesteProfilPropriu(USER_ID)).toBeNull();
    const eroare = eroarePostgrest("42501");
    server.raspunde("profiles", "select", { error: eroare });
    await expect(citesteProfilPropriu(USER_ID)).rejects.toBe(eroare);
  });
});

describe("avataturiPeUtilizatori", () => {
  it("o singură interogare, pe id-uri unice, fără null", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("profiles", "select", {
      data: [
        { id: ID_1, avatar_path: "a.png" },
        { id: ID_2, avatar_path: null },
      ],
    });

    const r = await avataturiPeUtilizatori([ID_1, null, ID_2, ID_1, null]);

    expect(r).toEqual(
      new Map([
        [ID_1, "a.png"],
        [ID_2, null],
      ]),
    );
    expect(server.apeluri).toHaveLength(1);
    expect(areFiltru(server.apeluri[0], "in", "id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(server.apeluri[0], "is", "deleted_at", null)).toBe(true);
  });

  it.each([[[]], [[null, null]]])(
    "lista fără conturi (%j): hartă goală, nicio interogare",
    async (ids) => {
      const { server } = configureazaActiunea();
      expect(await avataturiPeUtilizatori(ids)).toEqual(new Map());
      expect(server.apeluri).toHaveLength(0);
    },
  );

  it("eroarea se aruncă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("profiles", "select", { error: eroarePostgrest("57014") });
    await expect(avataturiPeUtilizatori([ID_1])).rejects.toMatchObject({ code: "57014" });
  });
});

describe("toateAvatarurile", () => {
  it("întâi membrii ACTIVI ai organizației, apoi avatarele exact ale lor", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("organization_members", "select", {
      data: [{ user_id: ID_1 }, { user_id: ID_2 }],
    });
    server.raspunde("profiles", "select", {
      data: [
        { id: ID_1, avatar_path: "a.png" },
        { id: ID_2, avatar_path: null },
      ],
    });

    const r = await toateAvatarurile(ORG_ID);

    expect(r).toEqual(
      new Map([
        [ID_1, "a.png"],
        [ID_2, null],
      ]),
    );
    const [membri] = server.apeluriPe("organization_members");
    expect(areFiltru(membri, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(membri, "eq", "status", "active")).toBe(true);
    expect(areFiltru(membri, "is", "deleted_at", null)).toBe(true);
    expect(membri?.filtre).toContainEqual({
      metoda: "order",
      argumente: ["user_id", { ascending: true }],
    });
    const [profiluri] = server.apeluriPe("profiles");
    expect(areFiltru(profiluri, "in", "id", [ID_1, ID_2])).toBe(true);
    expect(areFiltru(profiluri, "is", "deleted_at", null)).toBe(true);
  });

  it("organizație fără membri: hartă goală, profilurile nu se citesc", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("organization_members", "select", { data: [] });
    expect(await toateAvatarurile(ORG_ID)).toEqual(new Map());
    expect(server.apeluriPe("profiles")).toHaveLength(0);
  });

  it("peste o pagină plină de membri, citirea continuă cu keyset (`gt`), nu trunchiază", async () => {
    const { server } = configureazaActiunea();
    const plina = Array.from({ length: 1000 }, (_x, i) => ({
      user_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    }));
    server.raspunde("organization_members", "select", { data: plina });
    server.raspunde("organization_members", "select", { data: [{ user_id: ID_3 }] });
    server.raspunde("profiles", "select", { data: [] });

    await toateAvatarurile(ORG_ID);

    const [, aDoua] = server.apeluriPe("organization_members");
    expect(areFiltru(aDoua, "gt", "user_id", plina.at(-1)?.user_id)).toBe(true);
    const [profiluri] = server.apeluriPe("profiles");
    expect(
      (profiluri?.filtre.find((f) => f.metoda === "in")?.argumente[1] as string[]).length,
    ).toBe(1001);
  });

  it("eroarea primului pas se aruncă", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("organization_members", "select", { error: eroarePostgrest("42501") });
    await expect(toateAvatarurile(ORG_ID)).rejects.toMatchObject({ code: "42501" });
  });
});
