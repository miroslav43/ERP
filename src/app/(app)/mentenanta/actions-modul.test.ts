// src/app/(app)/mentenanta/actions-modul.test.ts
//
// Cheia `feature` a fiecărei acțiuni din modul. `configureazaActiunea`
// pornește implicit TOATE modulele, așa că o acțiune legată din greșeală de
// alt modul trece toate celelalte teste. Aici modulul `maintenance` e singurul
// oprit (refuz așteptat) sau singurul pornit (fără refuz de modul).
// Lista se ia din exporturile lui `./actions`: o acțiune nouă intră singură.

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

import { FEATURE_KEYS } from "@/config/features";
import { configureazaActiunea } from "@/lib/teste/actiune";
import * as modul from "./actions";

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

/** Toate permisiunile modulului pe `all`: refuzul nu poate veni din autorizare. */
const TOATE = {
  "maintenance:read": "all",
  "maintenance:create": "all",
  "maintenance:update": "all",
} as const;

type Actiune = (intrare: unknown) => Promise<unknown>;
const ACTIUNI = Object.entries(modul as unknown as Record<string, Actiune>);

describe("cheia de modul a acțiunilor", () => {
  it("lista acțiunilor nu e goală (exporturile lui ./actions)", () => {
    expect(ACTIUNI).toHaveLength(12);
  });

  it.each(ACTIUNI)(
    "%s: modulul `maintenance` oprit ⇒ MODUL_DEZACTIVAT, nicio interogare",
    async (_n, actiune) => {
      const { server, admin } = configureazaActiunea({
        functii: FEATURE_KEYS.filter((f) => f !== "maintenance"),
        permisiuni: TOATE,
      });
      const r = await actiune({});
      expect(r).toMatchObject({ ok: false, error: { code: "MODUL_DEZACTIVAT" } });
      expect(server.apeluri).toHaveLength(0);
      expect(admin.apeluri).toHaveLength(0);
    },
  );

  it.each(ACTIUNI)(
    "%s: doar modulul `maintenance` pornit ⇒ nu e refuzată pentru modul",
    async (_n, actiune) => {
      configureazaActiunea({ functii: ["maintenance"], permisiuni: TOATE });
      const r = await actiune({});
      expect(r).not.toMatchObject({ error: { code: "MODUL_DEZACTIVAT" } });
    },
  );
});
