// src/lib/actions/profile.test.ts
//
// `salveazaAvatarulPropriu`: pasul 2/2 al pozei de profil. Acțiunea NU trece
// prin `createAction` (nu are organizație, modul sau permisiune — dreptul e
// „ești tu”), deci harness-ul din `@/lib/teste/actiune` se folosește doar
// pentru clientul fals și spionii de `next/cache`; `requireUser` se falsifică
// direct, ca în `notificari/actions.test.ts`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", async (orig) =>
  (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()),
);
vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);
const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser }));

import { caiRevalidate, configureazaActiunea, USER_ID } from "@/lib/teste/actiune";
import { OCTETI_PNG, OCTETI_ZEROURI, octetiUrcati } from "@/lib/teste/octeti";
import { areFiltru, type ClientFals } from "@/lib/teste/supabase-fals";

import { salveazaAvatarulPropriu } from "./profile";

const BUCKET = "avatars";
const cale = `${USER_ID}/abc-poza.png`;

/** Obiectul măsurat, apoi capul lui citit printr-un URL semnat sub sesiunea proprie. */
function programeaza(server: ClientFals, octeti: Uint8Array = OCTETI_PNG) {
  server.raspundeStocare(BUCKET, "info", { data: { size: 1000, contentType: "image/png" } });
  server.raspundeStocare(BUCKET, "createSignedUrl", { data: { signedUrl: "https://semnat/obj" } });
  octetiUrcati(octeti);
}

beforeEach(() => {
  requireUser.mockReset();
  requireUser.mockResolvedValue({ id: USER_ID, email: "test@exemplu.ro", fullName: "Test" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("salveazaAvatarulPropriu", () => {
  it("succes: scrie calea pe profilul PROPRIU, după ce a verificat obiectul și capul lui", async () => {
    const { server } = configureazaActiunea();
    programeaza(server);
    server.raspunde("profiles", "update", { data: null });

    const r = await salveazaAvatarulPropriu({ cale });

    expect(r).toEqual({ ok: true, data: null });
    const [scriere] = server.apeluriPe("profiles", "update");
    expect(scriere?.payload).toEqual({ avatar_path: cale });
    expect(areFiltru(scriere, "eq", "id", USER_ID)).toBe(true);
    expect(server.apeluriStocare).toEqual([
      { bucket: BUCKET, metoda: "info", argumente: [cale] },
      { bucket: BUCKET, metoda: "createSignedUrl", argumente: [cale, 60] },
    ]);
    expect(caiRevalidate()).toEqual(["/profil", "/portal/profilul-meu"]);
  });

  it("calea sub contul altcuiva: VALIDARE, fără Storage și fără scriere", async () => {
    const { server } = configureazaActiunea();
    const r = await salveazaAvatarulPropriu({ cale: "altcineva/abc-poza.png" });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriStocare).toHaveLength(0);
    expect(server.apeluri).toHaveLength(0);
  });

  it("obiectul nu mai există: VALIDARE „Reluați încărcarea”, fără scriere", async () => {
    const { server } = configureazaActiunea();
    server.raspundeStocare(BUCKET, "info", { error: { message: "nu există" } });
    const r = await salveazaAvatarulPropriu({ cale });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", message: expect.stringContaining("Reluați încărcarea") },
    });
    expect(server.apeluri).toHaveLength(0);
  });

  it("un PDF urcat sub nume de poză: VALIDARE pe tipul măsurat, fără citirea capului", async () => {
    const { server } = configureazaActiunea();
    server.raspundeStocare(BUCKET, "info", {
      data: { size: 1000, contentType: "application/pdf" },
    });
    const r = await salveazaAvatarulPropriu({ cale });
    expect(r).toMatchObject({ ok: false, error: { code: "VALIDARE" } });
    expect(server.apeluriStocare).toHaveLength(1);
    expect(server.apeluri).toHaveLength(0);
  });

  it("zerouri urcate cu antet `image/png`: VALIDARE după conținut, fără scriere", async () => {
    const { server } = configureazaActiunea();
    programeaza(server, OCTETI_ZEROURI);
    const r = await salveazaAvatarulPropriu({ cale });
    expect(r).toMatchObject({
      ok: false,
      error: { code: "VALIDARE", message: expect.stringContaining("conținutul tipului declarat") },
    });
    expect(server.apeluri).toHaveLength(0);
    expect(caiRevalidate()).toEqual([]);
  });
});
