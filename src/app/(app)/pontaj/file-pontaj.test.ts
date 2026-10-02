// src/app/(app)/pontaj/file-pontaj.test.ts
//
// Ce file se desenează în banda pontajului. `poateAproba` compune permisiunea
// cu alegerea firmei; celelalte trei porți sunt independente una de alta.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", async () =>
  (await import("@/lib/teste/actiune")).falsuri.supabaseServer(),
);

import type { PermissionMap } from "@/lib/auth/permissions";
import { configureazaActiunea, ORG_ID } from "@/lib/teste/actiune";
import { areFiltru } from "@/lib/teste/supabase-fals";
import { fileDePontaj } from "./file-pontaj";

const harta = (intrari: Record<string, "own" | "team" | "all">): PermissionMap =>
  new Map(Object.entries(intrari));

const RAND = {
  mod_pontare_rapida: "ceas",
  verificare_pontare: "optional",
  program_start: null,
  necesita_aprobare: true,
};

describe("fileDePontaj", () => {
  it("citește setările pontării rapide ale organizației cerute", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("setari_pontare_rapida", "select", { data: RAND });
    await fileDePontaj(ORG_ID, harta({}));
    const [apel] = server.apeluriPe("setari_pontare_rapida");
    expect(areFiltru(apel, "eq", "organization_id", ORG_ID)).toBe(true);
    expect(areFiltru(apel, "is", "deleted_at", null)).toBe(true);
  });

  it("firma fără setări salvate cere aprobare (implicitul)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("setari_pontare_rapida", "select", { data: null });
    const f = await fileDePontaj(ORG_ID, harta({ "attendance:approve": "team" }));
    expect(f).toMatchObject({ poateAproba: true, necesitaAprobare: true });
  });

  it.each([
    [true, "team", true],
    [true, "all", true],
    [true, "own", false],
    [false, "all", false],
  ] as const)(
    "necesită aprobare=%s, `attendance:approve`=%s ⇒ poateAproba=%s",
    async (necesita, scope, asteptat) => {
      const { server } = configureazaActiunea();
      server.raspunde("setari_pontare_rapida", "select", {
        data: { ...RAND, necesita_aprobare: necesita },
      });
      const f = await fileDePontaj(ORG_ID, harta({ "attendance:approve": scope }));
      expect(f.poateAproba).toBe(asteptat);
      // Regula firmei iese și separat, neamestecată cu permisiunea.
      expect(f.necesitaAprobare).toBe(necesita);
    },
  );

  it.each([
    ["attendance:update", "all", "poateConfigura", true],
    ["attendance:update", "team", "poateConfigura", false],
    ["departments:update", "all", "poateVedeaCoduriQr", true],
    ["departments:update", "team", "poateVedeaCoduriQr", false],
    ["attendance:export", "all", "poateVedeaArhiva", true],
    ["attendance:export", "team", "poateVedeaArhiva", false],
  ] as const)("%s=%s ⇒ %s=%s", async (cheie, scope, camp, asteptat) => {
    const { server } = configureazaActiunea();
    server.raspunde("setari_pontare_rapida", "select", { data: RAND });
    const f = await fileDePontaj(ORG_ID, harta({ [cheie]: scope }));
    expect(f[camp]).toBe(asteptat);
  });

  it("dreptul de a configura pontajul NU deschide codurile QR (cheia secretului e alta)", async () => {
    const { server } = configureazaActiunea();
    server.raspunde("setari_pontare_rapida", "select", { data: RAND });
    const f = await fileDePontaj(ORG_ID, harta({ "attendance:update": "all" }));
    expect(f).toMatchObject({
      poateConfigura: true,
      poateVedeaCoduriQr: false,
      poateVedeaArhiva: false,
    });
  });
});
