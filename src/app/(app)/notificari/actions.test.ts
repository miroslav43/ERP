// src/app/(app)/notificari/actions.test.ts
//
// Notificările NU trec prin `createAction`: poarta e „e a ta", ținută de RLS
// (`notifications_update using (user_id = auth.uid())`). Acțiunile adaugă
// autentificarea, validarea și filtrul explicit pe utilizator; zero rânduri
// înseamnă idempotență (al doilea clic), nu eroare. Revalidarea atinge AMBELE
// cutii poștale — aplicația și portalul.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser }));

import { caiRevalidate, configureazaActiunea, ID_1, USER_ID } from "@/lib/teste/actiune";
import { areFiltru, eroarePostgrest } from "@/lib/teste/supabase-fals";

import {
  marcheazaNotificareaCitita,
  marcheazaToateNotificarileCitite,
  trimiteMarcheazaToateCitite,
} from "./actions";

const CAI = ["/notificari", "/portal/notificarile-mele", "/portal"];

beforeEach(() => {
  requireUser.mockReset();
  requireUser.mockResolvedValue({ id: USER_ID, email: "test@exemplu.ro", fullName: null });
});

describe("marcheazaNotificareaCitita", () => {
  it("fără sesiune: `requireUser` redirecționează și nimic nu se scrie", async () => {
    const { server } = configureazaActiunea();
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(marcheazaNotificareaCitita({ id: ID_1 })).rejects.toThrow("NEXT_REDIRECT");
    expect(server.apeluri).toHaveLength(0);
  });

  it("marchează doar notificarea PROPRIE, încă necitită", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "update", { data: null });

    const r = await marcheazaNotificareaCitita({ id: ID_1 });

    expect(r).toEqual({ ok: true, data: null });
    const [apel] = server.apeluriPe("notifications");
    expect(apel?.operatie).toBe("update");
    expect(Object.keys(apel?.payload as object)).toEqual(["read_at"]);
    expect(Number.isNaN(Date.parse(String((apel?.payload as { read_at: string }).read_at)))).toBe(
      false,
    );
    expect(areFiltru(apel, "eq", "id", ID_1)).toBe(true);
    expect(areFiltru(apel, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(apel, "is", "read_at", null)).toBe(true);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("al doilea clic (zero rânduri) e tot succes: idempotență, fără `.select()`", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "update", { data: null });
    const r = await marcheazaNotificareaCitita({ id: ID_1 });
    expect(r.ok).toBe(true);
    expect(server.apeluriPe("notifications")[0]?.selectDupaScriere).toBeUndefined();
  });

  it("id invalid: VALIDARE cu eroare pe câmp, fără scriere", async () => {
    const { server } = configureazaActiunea();
    const r = await marcheazaNotificareaCitita({ id: "nu-e-uuid" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDARE");
    expect(r.error.fieldErrors).toHaveProperty("id");
    expect(server.apeluri).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });

  it("eroarea PostgREST se traduce (42501 ⇒ INTERZIS), fără revalidare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "update", { error: eroarePostgrest("42501") });
    const r = await marcheazaNotificareaCitita({ id: ID_1 });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("o eroare nerecunoscută devine EROARE_INTERNA cu cod de referință", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "update", { error: { mesaj: "altceva" } });
    const r = await marcheazaNotificareaCitita({ id: ID_1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("EROARE_INTERNA");
    expect(r.error.message).toContain(r.error.requestId ?? "—");
  });
});

describe("marcheazaToateNotificarileCitite", () => {
  it("toate necititele utilizatorului, fără filtru de id", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "update", { data: null });

    const r = await marcheazaToateNotificarileCitite();

    expect(r).toEqual({ ok: true, data: null });
    const [apel] = server.apeluriPe("notifications");
    expect(areFiltru(apel, "eq", "user_id", USER_ID)).toBe(true);
    expect(areFiltru(apel, "is", "read_at", null)).toBe(true);
    expect(areFiltru(apel, "eq", "id")).toBe(false);
    expect(caiRevalidate()).toEqual(CAI);
  });

  it("eroarea bazei se traduce după cod (42501 ⇒ INTERZIS), fără revalidare", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "update", { error: eroarePostgrest("42501") });
    const r = await marcheazaToateNotificarileCitite();
    expect(r).toMatchObject({ ok: false, error: { code: "INTERZIS" } });
    expect(caiRevalidate()).toEqual([]);
  });

  it("varianta de formular face aceeași scriere și nu întoarce nimic", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("notifications", "update", { data: null });
    await expect(trimiteMarcheazaToateCitite()).resolves.toBeUndefined();
    expect(server.apeluriPe("notifications")).toHaveLength(1);
    expect(caiRevalidate()).toEqual(CAI);
  });
});
