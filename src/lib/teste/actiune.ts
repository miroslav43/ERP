// src/lib/teste/actiune.ts
//
// Harness-ul testelor de Server Actions construite cu `createAction()`
// (`src/lib/actions/create-action.ts`). Folosit DOAR din `*.test.ts`.
//
// `createAction` are șapte cusături spre lumea din afară; testul le înlocuiește
// pe toate, ca acțiunea să ruleze CAP-COADĂ — autentificare, modul, permisiune,
// Zod, handler, audit, revalidare — fără Next și fără bază:
//
//   next/headers                 → `headers()` gol (IP și user-agent null)
//   next/server                  → `after(fn)` rulează imediat; promisiunea se
//                                  poate aștepta cu `asteaptaDupa()`
//   next/cache                   → `revalidatePath` & co. devin spioni `vi.fn`
//   @/lib/tenant/resolve-tenant  → `resolveTenant()` întoarce `stare.rezolvare`
//   @/lib/supabase/server        → `createServerSupabase()` → `stare.server.client`
//   @/lib/supabase/admin         → `createAdminSupabase()`  → `stare.admin.client`
//   @/lib/auth/features          → `getEnabledFeatures()`   → `stare.functii`
//   @/lib/auth/permissions       → `getPermissionMap()`     → `stare.permisiuni`
//
// `vi.mock` trebuie scris ÎN fișierul de test (Vitest îl ridică deasupra
// importurilor), deci blocul de mai jos se COPIAZĂ ca atare în capul fiecărui
// `actions.test.ts`. Fabricile stau aici, într-un singur loc:
//
//   vi.mock("next/headers", async () => (await import("@/lib/teste/actiune")).falsuri.nextHeaders());
//   vi.mock("next/server", async (orig) => (await import("@/lib/teste/actiune")).falsuri.nextServer(await orig()));
//   vi.mock("next/cache", async (orig) => (await import("@/lib/teste/actiune")).falsuri.nextCache(await orig()));
//   vi.mock("@/lib/tenant/resolve-tenant", async (orig) => (await import("@/lib/teste/actiune")).falsuri.resolveTenant(await orig()));
//   vi.mock("@/lib/supabase/server", async () => (await import("@/lib/teste/actiune")).falsuri.supabaseServer());
//   vi.mock("@/lib/supabase/admin", async () => (await import("@/lib/teste/actiune")).falsuri.supabaseAdmin());
//   vi.mock("@/lib/auth/features", async (orig) => (await import("@/lib/teste/actiune")).falsuri.features(await orig()));
//   vi.mock("@/lib/auth/permissions", async (orig) => (await import("@/lib/teste/actiune")).falsuri.permissions(await orig()));
//
// Exemplul canonic, cu toate cele opt straturi: `src/app/(app)/salarizare/actions.test.ts`.
//
// IMPORTANT: fișierul ăsta NU are voie să importe (cu valoare) niciunul dintre
// modulele de mai sus — s-ar încărca originalul înaintea mock-ului. Singurul
// import cu valoare din `@/` e `@/config/features`, un catalog pur.

import { vi } from "vitest";
import { FEATURE_KEYS, type FeatureKey } from "@/config/features";
import type { PermissionScope } from "@/config/permissions";
import type { AppRole, TenantResolution } from "@/lib/tenant/types";
import { clientFals, type ClientFals } from "./supabase-fals";

/** UUID-uri valide RFC 4122 (v4) — `z.uuid()` le respinge pe cele „rotunde”. */
export const ORG_ID = "11111111-1111-4111-8111-111111111111";
export const ALTA_ORG_ID = "22222222-2222-4222-8222-222222222222";
export const USER_ID = "33333333-3333-4333-8333-333333333333";
export const MEMBER_ID = "44444444-4444-4444-8444-444444444444";
/** Un id oarecare de entitate, pentru intrările acțiunilor. */
export const ID_1 = "55555555-5555-4555-8555-555555555555";
export const ID_2 = "66666666-6666-4666-8666-666666666666";
export const ID_3 = "77777777-7777-4777-8777-777777777777";

type Stare = {
  rezolvare: TenantResolution;
  functii: Set<FeatureKey>;
  permisiuni: Map<string, PermissionScope>;
  server: ClientFals;
  admin: ClientFals;
  dupa: Promise<unknown>[];
};

export const stare: Stare = {
  rezolvare: { status: "neautentificat" },
  functii: new Set(),
  permisiuni: new Map(),
  server: clientFals(),
  admin: clientFals(),
  dupa: [],
};

/** Spionii pe care testele îi verifică direct: `expect(spioni.revalidatePath).toHaveBeenCalledWith(...)`. */
export const spioni = {
  revalidatePath: vi.fn<(cale: string, tip?: string) => void>(),
  revalidateTag: vi.fn<(tag: string, profil?: unknown) => void>(),
  updateTag: vi.fn<(tag: string) => void>(),
  refresh: vi.fn<() => void>(),
  after: vi.fn<(fn: unknown) => void>(),
};

export type ConfigurareActiune = Readonly<{
  /** Rolul din `organization_members`. Implicit `org_admin`. */
  rol?: AppRole;
  /** Harta de permisiuni. Ce nu e aici e `none` — exact ca în `createAction`. */
  permisiuni?: Readonly<Record<string, PermissionScope>>;
  /** Modulele active. Implicit: TOATE (testele de refuz de modul le restrâng). */
  functii?: readonly FeatureKey[] | "toate";
  /** Starea sesiunii. Implicit `ok`. */
  sesiune?: "ok" | "neautentificat" | "fara_organizatie";
}>;

/**
 * Resetează starea și întoarce falsurile proaspete. Se cheamă în `beforeEach`
 * sau la începutul fiecărui test:
 *
 *   const { server, admin } = configureazaActiunea({
 *     rol: "hr",
 *     permisiuni: { "payroll:approve": "all" },
 *   });
 */
export function configureazaActiunea(config: ConfigurareActiune = {}): {
  server: ClientFals;
  admin: ClientFals;
} {
  const rol = config.rol ?? "org_admin";
  const user = { id: USER_ID, email: "test@exemplu.ro", fullName: "Utilizator Test" };
  const sesiune = config.sesiune ?? "ok";
  stare.rezolvare =
    sesiune === "neautentificat"
      ? { status: "neautentificat" }
      : sesiune === "fara_organizatie"
        ? { status: "fara_organizatie", user }
        : {
            status: "ok",
            user,
            tenant: {
              organizationId: ORG_ID,
              slug: "firma-test",
              name: "Firma Test",
              legalName: "Firma Test SRL",
              role: rol,
              memberId: MEMBER_ID,
              timezone: "Europe/Bucharest",
            },
          };
  stare.functii = new Set(
    config.functii === undefined || config.functii === "toate" ? FEATURE_KEYS : config.functii,
  );
  stare.permisiuni = new Map(Object.entries(config.permisiuni ?? {}));
  stare.server = clientFals();
  stare.admin = clientFals();
  stare.dupa = [];
  for (const spion of Object.values(spioni)) spion.mockClear();
  return { server: stare.server, admin: stare.admin };
}

/** Așteaptă callback-urile programate prin `after()` (auditul de succes). */
export async function asteaptaDupa(): Promise<void> {
  await Promise.all(stare.dupa);
}

/** Căile revalidate, în ordine. */
export function caiRevalidate(): string[] {
  return spioni.revalidatePath.mock.calls.map((c) => c[0]);
}

/**
 * Fabricile modulelor false. Fiecare primește, unde e cazul, modulul ORIGINAL
 * (`importOriginal`) și îl întinde, ca exporturile neatinse (`requireTenant`,
 * `can`, `scopeFor`, `NextResponse`...) să rămână reale.
 */
export const falsuri = {
  nextHeaders() {
    const gol = new Headers();
    return {
      headers: async () => gol,
      cookies: async () => ({
        get: () => undefined,
        getAll: () => [],
        has: () => false,
        set: () => undefined,
        delete: () => undefined,
      }),
      draftMode: async () => ({
        isEnabled: false,
        enable: () => undefined,
        disable: () => undefined,
      }),
    };
  },

  nextServer(original: object) {
    return {
      ...original,
      after: (fn: unknown) => {
        spioni.after(fn);
        const p =
          typeof fn === "function" ? Promise.resolve().then(() => fn()) : Promise.resolve(fn);
        stare.dupa.push(p);
      },
    };
  },

  nextCache(original: object) {
    return {
      ...original,
      revalidatePath: spioni.revalidatePath,
      revalidateTag: spioni.revalidateTag,
      updateTag: spioni.updateTag,
      refresh: spioni.refresh,
    };
  },

  resolveTenant(original: object) {
    return { ...original, resolveTenant: async () => stare.rezolvare };
  },

  supabaseServer() {
    return { createServerSupabase: async () => stare.server.client };
  },

  supabaseAdmin() {
    return { createAdminSupabase: () => stare.admin.client };
  },

  features(original: object & { [k: string]: unknown }) {
    return { ...original, getEnabledFeatures: async () => stare.functii };
  },

  permissions(original: object) {
    return { ...original, getPermissionMap: async () => stare.permisiuni };
  },
};
