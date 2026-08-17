# ARHITECTURA APP — Administrativo

## 1. STRUCTURA DE FOLDERE

```
administrativo/
├─ src/
│  ├─ middleware.ts                     # DOAR refresh sesiune + gating "e logat?"; NU e boundary de securitate
│  │
│  ├─ app/
│  │  ├─ layout.tsx                     # html lang="ro", fonts, Providers minimale
│  │  ├─ error.tsx  not-found.tsx  global-error.tsx
│  │  │
│  │  ├─ (marketing)/                   # administrativo.ro — public, static
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx                    # landing
│  │  │  ├─ cere-demo/page.tsx
│  │  │  ├─ cere-demo/actions.ts        # publicAction (rate-limit + captcha, fara tenant)
│  │  │  ├─ preturi/page.tsx
│  │  │  └─ legal/{termeni,confidentialitate}/page.tsx
│  │  │
│  │  ├─ (auth)/
│  │  │  ├─ layout.tsx
│  │  │  ├─ autentificare/{page.tsx,actions.ts}
│  │  │  ├─ invitatie/[token]/{page.tsx,actions.ts}
│  │  │  ├─ resetare-parola/{page.tsx,actions.ts}
│  │  │  ├─ parola-noua/{page.tsx,actions.ts}
│  │  │  ├─ alege-organizatia/page.tsx  # cand user are >1 org si nu exista hint valid
│  │  │  └─ auth/callback/route.ts      # exchangeCodeForSession
│  │  │
│  │  ├─ (platform)/super-admin/        # echipa Administrativo
│  │  │  ├─ layout.tsx                  # requirePlatformAdmin()
│  │  │  ├─ page.tsx
│  │  │  ├─ organizatii/{page.tsx,actions.ts,_components/}
│  │  │  ├─ organizatii/[orgId]/{page.tsx,module/page.tsx,membri/page.tsx,actions.ts}
│  │  │  ├─ cereri-demo/{page.tsx,actions.ts}
│  │  │  ├─ configurari-legale/{page.tsx,actions.ts}   # salariu minim, deduceri, diurna — cu istoric
│  │  │  ├─ permisiuni/{page.tsx,actions.ts}           # editor role_permissions
│  │  │  └─ audit/page.tsx
│  │  │
│  │  ├─ (app)/                         # app.administrativo.ro — aplicatia organizatiei
│  │  │  ├─ layout.tsx                  # requireTenant() -> Sidebar + Topbar + OrgSwitcher
│  │  │  ├─ page.tsx                    # dashboard
│  │  │  ├─ actions.ts                  # switchOrganization, dismissNotification
│  │  │  ├─ angajati/
│  │  │  │  ├─ page.tsx  loading.tsx
│  │  │  │  ├─ actions.ts
│  │  │  │  ├─ [id]/{page.tsx,editare/page.tsx,date-sensibile/page.tsx,actions.ts}
│  │  │  │  └─ _components/{employee-table.tsx,employee-form.tsx,sensitive-panel.tsx}
│  │  │  ├─ pontaj/            {page.tsx,actions.ts,_components/}
│  │  │  ├─ concedii/
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ actions.ts
│  │  │  │  ├─ cereri/[id]/page.tsx
│  │  │  │  ├─ sold/page.tsx
│  │  │  │  └─ _components/{leave-request-form.tsx,leave-calendar.tsx,approval-panel.tsx}
│  │  │  ├─ flota/             {page.tsx,[id]/page.tsx,actions.ts,_components/}
│  │  │  ├─ ssm/               {page.tsx,instruiri/page.tsx,actions.ts,_components/}
│  │  │  ├─ mentenanta/        {page.tsx,actions.ts,_components/}
│  │  │  ├─ inventar/          {page.tsx,actions.ts,_components/}
│  │  │  ├─ onboarding/        {page.tsx,actions.ts,_components/}
│  │  │  ├─ anunturi/          {page.tsx,actions.ts,_components/}
│  │  │  ├─ salarizare/        {page.tsx,actions.ts,_components/}
│  │  │  ├─ diurna/            {page.tsx,actions.ts,_components/}
│  │  │  ├─ rapoarte/          {page.tsx,actions.ts,_components/}
│  │  │  └─ setari/
│  │  │     ├─ organizatie/{page.tsx,actions.ts}
│  │  │     ├─ membri/{page.tsx,actions.ts}
│  │  │     ├─ roluri/{page.tsx,actions.ts}
│  │  │     └─ module/{page.tsx,actions.ts}
│  │  │
│  │  ├─ (portal)/portal/               # employee_portal — UI redus, mobile-first
│  │  │  ├─ layout.tsx                  # requireTenant({ portal: true })
│  │  │  ├─ page.tsx
│  │  │  ├─ concediile-mele/{page.tsx,actions.ts}
│  │  │  ├─ pontajul-meu/page.tsx
│  │  │  ├─ documentele-mele/page.tsx
│  │  │  └─ anunturi/page.tsx
│  │  │
│  │  └─ api/
│  │     ├─ health/route.ts
│  │     ├─ export/[entity]/route.ts    # exceljs streaming, re-verifica permisiunea
│  │     └─ webhooks/resend/route.ts    # verificare semnatura svix
│  │
│  ├─ components/
│  │  ├─ ui/                            # shadcn generat — NU se modifica manual
│  │  ├─ layout/{sidebar.tsx,sidebar-nav.tsx,topbar.tsx,org-switcher.tsx,user-menu.tsx,breadcrumbs.tsx}
│  │  ├─ data/{data-table.tsx,data-table-toolbar.tsx,pagination.tsx,empty-state.tsx}
│  │  ├─ forms/{form-field.tsx,date-picker-ro.tsx,money-input.tsx,submit-button.tsx,server-form.tsx}
│  │  └─ feedback/{action-toast.tsx,confirm-dialog.tsx,error-boundary.tsx}
│  │
│  ├─ lib/
│  │  ├─ supabase/
│  │  │  ├─ server.ts                   # import "server-only"
│  │  │  ├─ browser.ts
│  │  │  ├─ admin.ts                    # import "server-only" + service_role
│  │  │  └─ middleware.ts               # updateSession()
│  │  ├─ tenant/
│  │  │  ├─ resolve-tenant.ts           # UNICUL loc care decide organizatia activa
│  │  │  ├─ tenant-hint.ts              # cookie azi / subdomeniu maine — punct unic de schimbare
│  │  │  ├─ tenant-cookie.ts            # HMAC sign/verify
│  │  │  └─ types.ts
│  │  ├─ auth/
│  │  │  ├─ current-user.ts             # cache(getUser)
│  │  │  ├─ permissions.ts              # cache(role_permissions) + hasPermission
│  │  │  ├─ features.ts                 # cache(feature flags)
│  │  │  └─ platform.ts                 # requirePlatformAdmin
│  │  ├─ actions/
│  │  │  ├─ create-action.ts            # wrapper generic
│  │  │  ├─ public-action.ts            # variantă fara tenant (cere-demo)
│  │  │  ├─ errors.ts                   # ActionError, ActionDenied, mapPostgrestError
│  │  │  ├─ audit.ts                    # writeAuditLog
│  │  │  └─ types.ts                    # ActionResult, ActionContext
│  │  ├─ queries/                       # citiri RSC, per domeniu, NU in componente
│  │  │  ├─ employees.ts  leave.ts  attendance.ts  fleet.ts  ssm.ts  dashboard.ts
│  │  ├─ crypto/{aes-gcm.ts,sensitive-data.ts}   # server-only, AES-256-GCM
│  │  ├─ email/{resend.ts,send.ts,templates/}
│  │  ├─ format/{date.ts,money.ts,cnp.ts,iban.ts}   # pure, testabile
│  │  └─ utils/{cn.ts,result.ts,rate-limit.ts,logger.ts}
│  │
│  ├─ domain/                           # LOGICA PURA — zero I/O, tinta principala Vitest
│  │  ├─ leave/{balance.ts,working-days.ts,overlap.ts,rules.ts,*.test.ts}
│  │  ├─ attendance/{hours.ts,overtime.ts,night-shift.ts,*.test.ts}
│  │  ├─ payroll/{gross-to-net.ts,contributions.ts,*.test.ts}
│  │  ├─ per-diem/{calc.ts,*.test.ts}
│  │  ├─ fleet/{itp-expiry.ts,rca-expiry.ts,*.test.ts}
│  │  └─ shared/{holidays-ro.ts,date-range.ts,*.test.ts}
│  │
│  ├─ schemas/                          # Zod partajat client (RHF) <-> server (createAction)
│  │  ├─ common.ts                      # uuid, dateRo, money, cnp, iban, paginare
│  │  ├─ employee.ts  leave.ts  attendance.ts  fleet.ts  ssm.ts  organization.ts
│  │  └─ index.ts
│  │
│  ├─ config/
│  │  ├─ navigation.ts                  # SURSA UNICA sidebar
│  │  ├─ features.ts                    # FEATURE_KEYS + metadata
│  │  ├─ permissions.ts                 # PERMISSION_KEYS (tipuri; valorile stau in DB)
│  │  └─ env.ts                         # validare Zod la boot
│  │
│  └─ types/
│     ├─ database.ts                    # generat: supabase gen types
│     ├─ database-helpers.ts            # Tables<'employees'>, Enums<'app_role'>
│     └─ index.ts
│
├─ supabase/{migrations/,functions/,seed.sql,config.toml}
├─ tests/{e2e/,rls/,setup/}             # rls/ ruleaza pe proiectul de test resetabil
└─ {eslint.config.mjs,vitest.config.ts,playwright.config.ts,tsconfig.json}
```

**Reguli de plasare:** componentele `_components/` sunt private rutei si nu se importa cross-feature (daca sunt necesare in 2 module → urca in `components/`). `lib/queries/` returneaza tipuri din `types/database.ts`; paginile nu apeleaza niciodata `supabase` direct. `domain/` nu importa nimic din `lib/supabase` — asta e invariantul care il face 100% testabil cu Vitest fara mock-uri.

---

## 2. TENANCY

### 2.1 Evaluarea celor trei optiuni

| | Cookie semnat | Custom claim in JWT (Auth Hook) | Lookup DB + `cache()` |
|---|---|---|---|
| Latenta | 0 query | 0 query | 1 query / request (cache-uit) |
| Comutare organizatie | instant | necesita refresh token | instant |
| Revocare membership | efect imediat la validare | **stale pana la 1h** | efect imediat |
| Falsificare | posibila fara semnatura | imposibila (semnat de GoTrue) | imposibila |
| Cuplare cu RLS | zero | RLS ar putea citi claim-ul | zero |

**Argumentul decisiv:** politicile RLS nu trebuie sa depinda de „organizatia activa”. Ele se scriu ca `EXISTS (SELECT 1 FROM organization_members m WHERE m.user_id = auth.uid() AND m.organization_id = t.organization_id AND m.deleted_at IS NULL)`. Organizatia activa este **doar un filtru de prezentare**, nu un mecanism de securitate. Consecinta: daca cineva falsifica cookie-ul si pune `organization_id` al altei firme, RLS returneaza **zero randuri** la SELECT si `42501` la INSERT/UPDATE. Nu exista scurgere de date nici in cel mai rau caz.

Claim-ul in JWT este activ **periculos** aici: daca RLS ar citi `active_org` din JWT, atunci un membru exclus din organizatie ar pastra acces pana la expirarea token-ului, iar comutatorul din topbar ar cere refresh de sesiune. Respins ca autoritate.

**RECOMANDARE FERMA:** cookie `httpOnly` + `SameSite=Lax` + `Secure`, semnat HMAC-SHA256, tratat exclusiv ca **hint neincrezut**; adevarul se stabileste printr-un lookup validat in `organization_members`, memoizat per request cu `React.cache()`. Semnatura HMAC nu e stratul de securitate — e detectorul de tampering care ne lasa sa scriem in `audit_logs` incercarea. Costul de 1 query/request este ~2 ms si oricum il faci ca sa afli rolul.

**Unde se apeleaza:** NU in middleware. Middleware-ul ruleaza pe Edge, nu are context de rendering (deci `cache()` nu se partajeaza cu RSC) si — post CVE-2025-29927 — nu este un boundary de autorizare. Middleware face doar refresh de cookie-uri Supabase si redirect grosier al vizitatorilor nelogati. `resolveTenant()` se apeleaza in **layout-ul `(app)`/`(portal)`** si, independent, in **fiecare Server Action** prin `createAction`. Un layout nu protejeaza o Server Action.

### 2.2 `lib/tenant/types.ts`

```ts
import type { Enums } from "@/types/database";

export type AppRole = Enums<"app_role">;

export type Tenant = Readonly<{
  organizationId: string;
  slug: string;
  name: string;
  role: AppRole;
  memberId: string;
  employeeId: string | null;
  timezone: string;
  planFeatures: ReadonlySet<string>;
}>;

export type AuthUser = Readonly<{ id: string; email: string; fullName: string | null }>;

export type OrgSummary = Readonly<{ id: string; slug: string; name: string; role: AppRole }>;

export type TenantResolution =
  | Readonly<{ status: "ok"; user: AuthUser; tenant: Tenant }>
  | Readonly<{ status: "neautentificat" }>
  | Readonly<{ status: "fara_organizatie"; user: AuthUser }>
  | Readonly<{ status: "alegere_necesara"; user: AuthUser; organizations: readonly OrgSummary[] }>;
```

### 2.3 `lib/tenant/tenant-hint.ts` — punctul unic de mutare pe subdomenii

```ts
import "server-only";
import { cookies, headers } from "next/headers";
import { verifyTenantCookie } from "./tenant-cookie";

export const TENANT_COOKIE = "adm_org";

export type TenantHint = Readonly<{
  source: "subdomain" | "cookie" | "none";
  slugOrId: string | null;
  tampered: boolean;
}>;

const RESERVED = new Set(["app", "www", "api", "admin", "administrativo"]);

/**
 * SINGURUL loc care stie DE UNDE vine organizatia.
 * Migrarea la firma.administrativo.ro = se activeaza ramura de subdomeniu. Restul codului nu se atinge.
 */
export async function readTenantHint(): Promise<TenantHint> {
  if (process.env.NEXT_PUBLIC_TENANT_STRATEGY === "subdomain") {
    const host = (await headers()).get("host") ?? "";
    const sub = host.split(":")[0]?.split(".")[0] ?? "";
    if (sub && !RESERVED.has(sub)) return { source: "subdomain", slugOrId: sub, tampered: false };
  }
  const raw = (await cookies()).get(TENANT_COOKIE)?.value ?? null;
  if (!raw) return { source: "none", slugOrId: null, tampered: false };

  const verified = verifyTenantCookie(raw);
  return verified === null
    ? { source: "cookie", slugOrId: null, tampered: true }
    : { source: "cookie", slugOrId: verified, tampered: false };
}
```

### 2.4 `lib/tenant/tenant-cookie.ts`

```ts
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/config/env";

export function signTenantCookie(orgId: string): string {
  const mac = createHmac("sha256", serverEnv.APP_COOKIE_SECRET).update(orgId).digest("base64url");
  return `${orgId}.${mac}`;
}

export function verifyTenantCookie(raw: string): string | null {
  const idx = raw.lastIndexOf(".");
  if (idx <= 0) return null;
  const value = raw.slice(0, idx);
  const given = Buffer.from(raw.slice(idx + 1), "base64url");
  const want = createHmac("sha256", serverEnv.APP_COOKIE_SECRET).update(value).digest();
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return value;
}
```

### 2.5 `lib/tenant/resolve-tenant.ts`

```ts
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { readTenantHint } from "./tenant-hint";
import type { AuthUser, OrgSummary, Tenant, TenantResolution } from "./types";

/**
 * Memoizat per request (React cache). Apelabil de N ori in acelasi render: un singur query.
 * NU accepta niciodata organization_id de la client.
 */
export const resolveTenant = cache(async (): Promise<TenantResolution> => {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "neautentificat" };

  const user: AuthUser = {
    id: auth.user.id,
    email: auth.user.email ?? "",
    fullName: (auth.user.user_metadata?.full_name as string | undefined) ?? null,
  };

  // RLS: randurile vizibile sunt EXCLUSIV membershipurile lui auth.uid().
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "id, role, employee_id, organization:organizations!inner(id, slug, name, timezone, plan, subscription_status)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const orgs: readonly OrgSummary[] = (data ?? []).map((m) => ({
    id: m.organization.id,
    slug: m.organization.slug,
    name: m.organization.name,
    role: m.role,
  }));
  if (orgs.length === 0) return { status: "fara_organizatie", user };

  const hint = await readTenantHint();
  const match =
    hint.slugOrId === null
      ? null
      : ((data ?? []).find(
          (m) => m.organization.id === hint.slugOrId || m.organization.slug === hint.slugOrId,
        ) ?? null);

  // Hint prezent dar fara membership => cookie falsificat / membership revocat. Nu ghicim.
  if (hint.slugOrId !== null && match === null) {
    return orgs.length === 1
      ? buildOk(user, data![0]!)
      : { status: "alegere_necesara", user, organizations: orgs };
  }
  const chosen = match ?? (orgs.length === 1 ? data![0]! : null);
  if (chosen === null) return { status: "alegere_necesara", user, organizations: orgs };

  return buildOk(user, chosen);
});

type MemberRow = NonNullable<Awaited<ReturnType<typeof loadShape>>>;
declare function loadShape(): Promise<{
  id: string;
  role: Tenant["role"];
  employee_id: string | null;
  organization: { id: string; slug: string; name: string; timezone: string | null };
}>;

function buildOk(user: AuthUser, m: MemberRow): TenantResolution {
  const tenant: Tenant = {
    organizationId: m.organization.id,
    slug: m.organization.slug,
    name: m.organization.name,
    role: m.role,
    memberId: m.id,
    employeeId: m.employee_id,
    timezone: m.organization.timezone ?? "Europe/Bucharest",
    planFeatures: new Set(),
  };
  return { status: "ok", user, tenant };
}

/** Pentru layouturi/pagini RSC. Redirectioneaza; nu se foloseste in Server Actions. */
export async function requireTenant(): Promise<{ user: AuthUser; tenant: Tenant }> {
  const r = await resolveTenant();
  switch (r.status) {
    case "ok":
      return { user: r.user, tenant: r.tenant };
    case "neautentificat":
      redirect("/autentificare");
    case "fara_organizatie":
      redirect("/fara-acces");
    case "alegere_necesara":
      redirect("/alege-organizatia");
  }
}
```

**Comutatorul de organizatie** (`(app)/actions.ts`) valideaza membership-ul si abia apoi seteaza cookie-ul:

```ts
"use server";
export async function switchOrganization(organizationId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)   // filtru, nu autorizare: RLS decide
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) throw new Error("Nu aveți acces la această organizație.");
  (await cookies()).set(TENANT_COOKIE, signTenantCookie(organizationId), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
}
```

---

## 3. CLIENTII SUPABASE

`lib/supabase/server.ts`
```ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { publicEnv } from "@/config/env";

export type ServerSupabase = ReturnType<typeof createServerClient<Database>>;

export async function createServerSupabase(): Promise<ServerSupabase> {
  const store = await cookies();
  return createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* apelat dintr-un Server Component: refresh-ul e facut de middleware */ }
      },
    },
    global: { headers: { "x-application-name": "administrativo" } },
  });
}
```

`lib/supabase/browser.ts`
```ts
"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserSupabase() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
```

`lib/supabase/admin.ts`
```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { serverEnv, publicEnv } from "@/config/env";

/**
 * OCOLESTE RLS. Utilizari permise: Super-Admin (creare organizatii, invitatii),
 * Edge Functions/cron, migrari de date. Orice alt apel e bug de securitate.
 * Fiecare apel scrie obligatoriu in audit_logs cu actor_id explicit.
 */
export function createAdminSupabase() {
  if (typeof window !== "undefined") throw new Error("admin client interzis in browser");
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInChange: false },
    db: { schema: "public" },
  });
}
```

**Trei bariere tehnice cumulative:**
1. `import "server-only"` → build error daca fisierul ajunge intr-un graph client (`"use client"`).
2. Conventie: orice modul cu privilegii se numeste `admin.ts` sau `*.admin.ts` si sta doar in `lib/supabase/`, `lib/crypto/`, `app/(platform)/**`.
3. ESLint — `eslint.config.mjs`:

```js
import tseslint from "typescript-eslint";

const FORBIDDEN_IN_CLIENT = [
  { name: "@/lib/supabase/admin", message: "service_role nu are voie in cod de client. Foloseste o Server Action." },
  { name: "@supabase/supabase-js", importNames: ["createClient"], message: "Foloseste @/lib/supabase/browser sau /server." },
  { name: "@/lib/crypto/sensitive-data", message: "Decriptarea CNP/IBAN se face doar in Server Actions." },
  { name: "@/lib/actions/create-action", message: "Wrapperul de actiuni este server-only." },
];

export default tseslint.config(
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": ["error", { paths: FORBIDDEN_IN_CLIENT, patterns: [
        { group: ["**/*.admin", "**/*.admin.ts"], message: "Modul privilegiat: server-only." },
      ] }],
    },
  },
  {
    // Componente client + tot ce e importabil din ele
    files: ["src/components/**", "src/**/_components/**", "src/app/**/*.client.tsx", "src/hooks/**"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [...FORBIDDEN_IN_CLIENT, { name: "@/lib/supabase/server", message: "Server client doar in RSC/Actions." }],
        patterns: [{ group: ["@/lib/queries/*"], message: "Query-urile se apeleaza in RSC si se paseaza ca props." },
                   { group: ["server-only"], message: "Fisier marcat server-only importat din cod client." }],
      }],
    },
  },
  {
    // Interzice folosirea admin clientului oriunde in afara zonelor permise
    files: ["src/app/(app)/**", "src/app/(portal)/**", "src/app/(marketing)/**"],
    rules: { "no-restricted-imports": ["error", { paths: [
      { name: "@/lib/supabase/admin", message: "admin client permis doar in (platform)/ si lib/jobs/." }] }] },
  },
);
```

---

## 4. TIPARUL DE SERVER ACTION

### 4.1 `lib/actions/types.ts`

```ts
import "server-only";
import type { z } from "zod";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { AuthUser, Tenant } from "@/lib/tenant/types";
import type { FeatureKey } from "@/config/features";
import type { PermissionKey } from "@/config/permissions";
import type { Enums } from "@/types/database";

export type PermissionScope = Enums<"permission_scope">; // 'own' | 'team' | 'organization'

export type ActionErrorCode =
  | "NEAUTENTIFICAT" | "FARA_ORGANIZATIE" | "MODUL_DEZACTIVAT" | "INTERZIS"
  | "VALIDARE" | "NEGASIT" | "CONFLICT" | "REGULA_BUSINESS" | "LIMITA" | "EROARE_INTERNA";

export type ActionError = Readonly<{
  code: ActionErrorCode;
  message: string;                                  // romana, afisabil direct
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  requestId: string;
}>;

export type ActionResult<TData> =
  | Readonly<{ ok: true; data: TData }>
  | Readonly<{ ok: false; error: ActionError }>;

export type ActionContext = Readonly<{
  supabase: ServerSupabase;
  user: AuthUser;
  tenant: Tenant;
  scope: PermissionScope;              // scope-ul acordat pentru permisiunea ceruta
  features: ReadonlySet<FeatureKey>;
  requestId: string;
  now: Date;
}>;

export type AuditVerb = "create" | "update" | "delete" | "restore" | "approve" | "reject" | "read" | "export";

export type ActionDefinition<TSchema extends z.ZodTypeAny, TData> = Readonly<{
  name: string;                                    // "leave.request.create"
  input: TSchema;
  permission: PermissionKey;
  feature?: FeatureKey;
  audit: Readonly<{
    verb: AuditVerb;
    entity: string;
    entityId?: (input: z.output<TSchema>, data: TData) => string | null;
    redact?: readonly string[];                    // campuri excluse din payload-ul auditat
  }>;
  revalidate?: readonly string[] | ((input: z.output<TSchema>, data: TData) => readonly string[]);
  handler: (ctx: ActionContext, input: z.output<TSchema>) => Promise<TData>;
}>;
```

### 4.2 `lib/actions/errors.ts`

```ts
import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ActionError, ActionErrorCode } from "./types";

/** Eroare de domeniu aruncata din handler; singura care ajunge tradusa la utilizator. */
export class ActionDenied extends Error {
  constructor(
    readonly code: ActionErrorCode,
    message: string,
    readonly fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) { super(message); this.name = "ActionDenied"; }
}

export const notFound = (m = "Înregistrarea nu a fost găsită.") => new ActionDenied("NEGASIT", m);
export const businessRule = (m: string) => new ActionDenied("REGULA_BUSINESS", m);

const PG: Record<string, { code: ActionErrorCode; message: string }> = {
  // RLS respinge INSERT/UPDATE prin WITH CHECK / USING
  "42501": { code: "INTERZIS", message: "Nu aveți dreptul să efectuați această operațiune." },
  "23505": { code: "CONFLICT", message: "Există deja o înregistrare cu aceste date." },
  "23503": { code: "CONFLICT", message: "Operațiunea încalcă o legătură cu alte date." },
  "23514": { code: "REGULA_BUSINESS", message: "Datele nu respectă regulile de validare." },
  "23502": { code: "VALIDARE", message: "Un câmp obligatoriu lipsește." },
  "P0001": { code: "REGULA_BUSINESS", message: "Operațiunea a fost respinsă de o regulă a sistemului." },
  "40001": { code: "CONFLICT", message: "Datele au fost modificate între timp. Reîncercați." },
  "PGRST116": { code: "NEGASIT", message: "Înregistrarea nu există sau nu aveți acces la ea." },
};

export function mapPostgrestError(e: PostgrestError, requestId: string): ActionError {
  const hit = PG[e.code];
  // Mesajul din P0001 (RAISE EXCEPTION in trigger) e scris in romana in migrari -> il propagam.
  if (e.code === "P0001" && e.message) return { code: "REGULA_BUSINESS", message: e.message, requestId };
  if (hit) return { ...hit, requestId };
  return { code: "EROARE_INTERNA", message: "A apărut o eroare neașteptată. Cod: " + requestId, requestId };
}

export function isPostgrestError(e: unknown): e is PostgrestError {
  return typeof e === "object" && e !== null && "code" in e && "message" in e && "details" in e;
}
```

> **Nuanta RLS pe SELECT:** RLS *nu* arunca eroare la citire — filtreaza randurile. Un `.single()` pe un rand invizibil returneaza `PGRST116`, pe care il mapam la `NEGASIT`, nu la `INTERZIS`: nu confirmam existenta datelor altei organizatii. Doar scrierile respinse produc `42501` → `INTERZIS`.

### 4.3 `lib/actions/audit.ts`

```ts
import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export type AuditEntry = Readonly<{
  organizationId: string; actorId: string; action: string; entity: string;
  entityId: string | null; status: "success" | "denied" | "error";
  payload: Record<string, unknown> | null; errorCode: string | null; requestId: string;
}>;

/** RPC SECURITY DEFINER: audit_logs nu accepta INSERT direct nici pentru org_admin. */
export async function writeAuditLog(supabase: ServerSupabase, e: AuditEntry): Promise<void> {
  const { error } = await supabase.rpc("log_audit_event", {
    p_organization_id: e.organizationId, p_action: e.action, p_entity: e.entity,
    p_entity_id: e.entityId, p_status: e.status, p_payload: e.payload,
    p_error_code: e.errorCode, p_request_id: e.requestId,
  });
  if (error) console.error("[audit] scriere esuata", { requestId: e.requestId, code: error.code });
}

export function redactPayload(
  input: unknown, redact: readonly string[] = [],
): Record<string, unknown> | null {
  if (typeof input !== "object" || input === null) return null;
  const hidden = new Set([...redact, "cnp", "iban", "password", "token", "salary", "salariu"]);
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, hidden.has(k) ? "«redactat»" : v]),
  );
}
```

### 4.4 `lib/actions/create-action.ts` — wrapperul

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { redactPayload, writeAuditLog } from "./audit";
import { ActionDenied, isPostgrestError, mapPostgrestError } from "./errors";
import type { ActionContext, ActionDefinition, ActionError, ActionResult } from "./types";

const fail = (e: ActionError): ActionResult<never> => ({ ok: false, error: e });

export function createAction<TSchema extends z.ZodTypeAny, TData>(
  def: ActionDefinition<TSchema, TData>,
): (rawInput: unknown) => Promise<ActionResult<TData>> {
  return async (rawInput: unknown): Promise<ActionResult<TData>> => {
    const requestId = randomUUID();

    // 1. AUTENTIFICARE + 2. REZOLVARE ORGANIZATIE (server-side, clientul nu trimite nimic)
    const resolution = await resolveTenant();
    if (resolution.status === "neautentificat")
      return fail({ code: "NEAUTENTIFICAT", message: "Sesiune expirată. Autentificați-vă din nou.", requestId });
    if (resolution.status !== "ok")
      return fail({ code: "FARA_ORGANIZATIE", message: "Selectați o organizație activă.", requestId });

    const { user, tenant } = resolution;
    const supabase = await createServerSupabase();

    const deny = async (code: ActionError["code"], message: string): Promise<ActionResult<never>> => {
      await writeAuditLog(supabase, {
        organizationId: tenant.organizationId, actorId: user.id, action: def.name,
        entity: def.audit.entity, entityId: null, status: "denied",
        payload: redactPayload(rawInput, def.audit.redact), errorCode: code, requestId,
      });
      return fail({ code, message, requestId });
    };

    // 3. FEATURE FLAG (server-side, nu doar in UI)
    const features = await getEnabledFeatures(tenant.organizationId);
    if (def.feature && !features.has(def.feature))
      return deny("MODUL_DEZACTIVAT", "Modulul necesar acestei operațiuni nu este activ pentru organizația dvs.");

    // 4. PERMISIUNE din role_permissions (matrice in DB, nu if-uri)
    const permissions = await getPermissionMap(tenant.organizationId, user.id);
    const scope = permissions.get(def.permission);
    if (scope === undefined)
      return deny("INTERZIS", "Nu aveți permisiunea necesară pentru această acțiune.");

    // 5. VALIDARE ZOD
    const parsed = def.input.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      return fail({
        code: "VALIDARE", message: "Datele introduse nu sunt valide.",
        fieldErrors: flat.fieldErrors as Record<string, readonly string[]>, requestId,
      });
    }
    const input = parsed.data as z.output<TSchema>;
    const ctx: ActionContext = { supabase, user, tenant, scope, features, requestId, now: new Date() };

    // 6. EXECUTIE
    let data: TData;
    try {
      data = await def.handler(ctx, input);
    } catch (err) {
      const error: ActionError =
        err instanceof ActionDenied
          ? { code: err.code, message: err.message, fieldErrors: err.fieldErrors, requestId }
          : isPostgrestError(err)
            ? mapPostgrestError(err, requestId)
            : { code: "EROARE_INTERNA", message: `A apărut o eroare neașteptată. Cod: ${requestId}`, requestId };

      if (error.code === "EROARE_INTERNA")
        console.error("[action]", def.name, requestId, err); // stack doar pe server

      await writeAuditLog(supabase, {
        organizationId: tenant.organizationId, actorId: user.id, action: def.name,
        entity: def.audit.entity, entityId: null,
        status: error.code === "INTERZIS" ? "denied" : "error",
        payload: redactPayload(input, def.audit.redact), errorCode: error.code, requestId,
      });
      return fail(error);
    }

    // 7. AUDIT SUCCES
    await writeAuditLog(supabase, {
      organizationId: tenant.organizationId, actorId: user.id, action: def.name,
      entity: def.audit.entity, entityId: def.audit.entityId?.(input, data) ?? null,
      status: "success", payload: redactPayload(input, def.audit.redact), errorCode: null, requestId,
    });

    // 8. REVALIDATE
    const paths = typeof def.revalidate === "function" ? def.revalidate(input, data) : (def.revalidate ?? []);
    for (const p of paths) revalidatePath(p);

    return { ok: true, data };
  };
}
```

### 4.5 Exemplu real — cerere de concediu

`schemas/leave.ts` (partajat client + server):
```ts
import { z } from "zod";

export const leaveRequestCreateSchema = z
  .object({
    leaveTypeId: z.uuid("Tip de concediu invalid."),
    startDate: z.iso.date("Data de început este obligatorie."),
    endDate: z.iso.date("Data de sfârșit este obligatorie."),
    substituteEmployeeId: z.uuid().nullable().default(null),
    reason: z.string().trim().max(500, "Motivul poate avea maximum 500 de caractere.").default(""),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "Data de sfârșit nu poate fi înaintea datei de început.", path: ["endDate"],
  });

export type LeaveRequestCreateInput = z.input<typeof leaveRequestCreateSchema>;
```

`app/(app)/concedii/actions.ts`:
```ts
"use server";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { leaveRequestCreateSchema } from "@/schemas/leave";
import { countWorkingDays } from "@/domain/leave/working-days";   // pur, testat cu Vitest
import { hasOverlap } from "@/domain/leave/overlap";
import { sendLeaveRequestEmail } from "@/lib/email/send";

export const createLeaveRequest = createAction({
  name: "leave.request.create",
  input: leaveRequestCreateSchema,
  feature: "leave",
  permission: "leave_requests:create",
  audit: { verb: "create", entity: "leave_requests", entityId: (_i, d) => d.id },
  revalidate: ["/concedii", "/portal/concediile-mele"],
  handler: async (ctx, input) => {
    // scope 'own' => doar pentru sine; 'team'/'organization' => si pentru altii (aici: mereu pentru sine)
    const employeeId = ctx.tenant.employeeId;
    if (!employeeId) throw businessRule("Contul dvs. nu este asociat unei fișe de angajat.");

    const { data: type } = await ctx.supabase
      .from("leave_types").select("id, code, deducts_balance, max_consecutive_days")
      .eq("id", input.leaveTypeId).is("deleted_at", null).maybeSingle();
    if (!type) throw notFound("Tipul de concediu selectat nu este disponibil.");

    const { data: holidays } = await ctx.supabase
      .from("public_holidays").select("holiday_date")
      .gte("holiday_date", input.startDate).lte("holiday_date", input.endDate);

    const days = countWorkingDays({
      start: input.startDate, end: input.endDate,
      holidays: (holidays ?? []).map((h) => h.holiday_date),
    });
    if (days === 0) throw businessRule("Intervalul selectat nu conține nicio zi lucrătoare.");
    if (type.max_consecutive_days !== null && days > type.max_consecutive_days)
      throw businessRule(`Acest tip de concediu permite maximum ${type.max_consecutive_days} zile consecutive.`);

    const { data: existing } = await ctx.supabase
      .from("leave_requests").select("start_date, end_date")
      .eq("employee_id", employeeId).in("status", ["pending", "approved"])
      .is("deleted_at", null).lte("start_date", input.endDate).gte("end_date", input.startDate);
    if (hasOverlap(input, existing ?? []))
      throw businessRule("Există deja o cerere de concediu care se suprapune cu acest interval.");

    if (type.deducts_balance) {
      const { data: balance } = await ctx.supabase
        .from("leave_balances").select("remaining_days")
        .eq("employee_id", employeeId).eq("leave_type_id", type.id)
        .eq("year", new Date(input.startDate).getUTCFullYear()).maybeSingle();
      if (!balance || balance.remaining_days < days)
        throw businessRule(`Sold insuficient: aveți ${balance?.remaining_days ?? 0} zile disponibile, sunt necesare ${days}.`);
    }

    // organization_id NU vine din input; se ia din tenantul rezolvat server-side.
    const { data, error } = await ctx.supabase
      .from("leave_requests")
      .insert({
        organization_id: ctx.tenant.organizationId, employee_id: employeeId,
        leave_type_id: type.id, start_date: input.startDate, end_date: input.endDate,
        working_days: days, reason: input.reason || null,
        substitute_employee_id: input.substituteEmployeeId, status: "pending",
        created_by: ctx.user.id,
      })
      .select("id, working_days, status").single();
    if (error) throw error;   // 42501 => INTERZIS, restul mapate in mapPostgrestError

    await sendLeaveRequestEmail({ organizationId: ctx.tenant.organizationId, requestId: data.id });
    return data;
  },
});
```

Consum in client (`_components/leave-request-form.tsx`, `"use client"`):
```tsx
const onSubmit = form.handleSubmit(async (values) => {
  const res = await createLeaveRequest(values);
  if (res.ok) { toast.success("Cererea a fost trimisă spre aprobare."); form.reset(); return; }
  if (res.error.fieldErrors)
    for (const [field, msgs] of Object.entries(res.error.fieldErrors))
      form.setError(field as keyof LeaveRequestCreateInput, { message: msgs[0] });
  toast.error(res.error.message);
});
```

---

## 5. FEATURE FLAGS SI PERMISIUNI

`config/features.ts`
```ts
export const FEATURE_KEYS = [
  "attendance", "leave", "fleet", "ssm", "maintenance", "inventory",
  "onboarding", "announcements", "payroll", "per_diem", "employee_portal",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Readonly<Record<FeatureKey, string>> = {
  attendance: "Pontaj", leave: "Concedii", fleet: "Flotă auto", ssm: "SSM",
  maintenance: "Mentenanță", inventory: "Inventar", onboarding: "Onboarding",
  announcements: "Anunțuri", payroll: "Salarizare", per_diem: "Diurnă",
  employee_portal: "Portal angajat",
};
```

`lib/auth/features.ts`
```ts
import "server-only";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import { FEATURE_KEYS, type FeatureKey } from "@/config/features";

const isFeatureKey = (v: string): v is FeatureKey => (FEATURE_KEYS as readonly string[]).includes(v);

/** Un singur query per request, indiferent de cate componente il cer. */
export const getEnabledFeatures = cache(
  async (organizationId: string): Promise<ReadonlySet<FeatureKey>> => {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("organization_features").select("feature_key")
      .eq("organization_id", organizationId).eq("enabled", true);
    if (error) throw error;
    return new Set((data ?? []).map((r) => r.feature_key).filter(isFeatureKey));
  },
);

/** Guard pentru pagini RSC: modulul dezactivat => 404, nu 403 (nu divulgam ce module exista). */
export async function requireFeature(organizationId: string, key: FeatureKey): Promise<void> {
  const features = await getEnabledFeatures(organizationId);
  if (!features.has(key)) (await import("next/navigation")).notFound();
}
```

`lib/auth/permissions.ts`
```ts
import "server-only";
import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import type { PermissionKey } from "@/config/permissions";
import type { PermissionScope } from "@/lib/actions/types";

export type PermissionMap = ReadonlyMap<PermissionKey, PermissionScope>;

const RANK: Record<PermissionScope, number> = { own: 1, team: 2, organization: 3 };

/**
 * Matricea traieste in role_permissions (+ suprascrieri per organizatie).
 * Cache-uit per (org, user) pe durata requestului.
 */
export const getPermissionMap = cache(
  async (organizationId: string, userId: string): Promise<PermissionMap> => {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("get_effective_permissions", {
      p_organization_id: organizationId, p_user_id: userId,
    });
    if (error) throw error;

    const map = new Map<PermissionKey, PermissionScope>();
    for (const row of data ?? []) {
      const key = `${row.resource}:${row.action}` as PermissionKey;
      const current = map.get(key);
      if (!current || RANK[row.scope] > RANK[current]) map.set(key, row.scope);
    }
    return map;
  },
);

export function can(map: PermissionMap, key: PermissionKey, min: PermissionScope = "own"): boolean {
  const scope = map.get(key);
  return scope !== undefined && RANK[scope] >= RANK[min];
}
```

`config/permissions.ts`
```ts
export const PERMISSION_KEYS = [
  "employees:read", "employees:create", "employees:update", "employees:delete",
  "employee_sensitive:read",
  "attendance:read", "attendance:create", "attendance:approve",
  "leave_requests:read", "leave_requests:create", "leave_requests:approve",
  "leave_balances:read", "leave_balances:update",
  "vehicles:read", "vehicles:update", "ssm_trainings:read", "ssm_trainings:create",
  "maintenance:read", "maintenance:update", "inventory:read", "inventory:update",
  "onboarding:read", "onboarding:update", "announcements:read", "announcements:create",
  "payroll:read", "payroll:update", "per_diem:read", "per_diem:create",
  "reports:read", "organization:update", "members:manage", "roles:manage", "features:manage",
  "audit:read",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
```

---

## 6. NAVIGATIE DECLARATIVA

`config/navigation.ts` — **unica sursa de adevar**
```ts
import {
  LayoutDashboard, Users, Clock, CalendarDays, Car, HardHat, Wrench, Package,
  ClipboardList, Megaphone, Wallet, Receipt, BarChart3, Settings, type LucideIcon,
} from "lucide-react";
import type { FeatureKey } from "./features";
import type { PermissionKey } from "./permissions";

export type NavGroupId = "operatiuni" | "personal" | "resurse" | "financiar" | "administrare";

export const NAV_GROUPS: readonly { id: NavGroupId; label: string }[] = [
  { id: "operatiuni", label: "Operațiuni" },
  { id: "personal", label: "Personal" },
  { id: "resurse", label: "Resurse" },
  { id: "financiar", label: "Financiar" },
  { id: "administrare", label: "Administrare" },
];

export type BadgeSource = "leave_pending" | "ssm_expiring" | "fleet_expiring" | "maintenance_due";

export type NavItem = Readonly<{
  id: string;
  label: string;                       // romana cu diacritice
  href: string;
  icon: LucideIcon;
  group: NavGroupId;
  feature: FeatureKey | null;          // null = nucleu, mereu activ
  permission: PermissionKey;
  badge?: BadgeSource;
  order: number;
  children?: readonly Omit<NavItem, "group" | "icon" | "order">[];
}>;

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "dashboard", label: "Panou de control", href: "/", icon: LayoutDashboard,
    group: "operatiuni", feature: null, permission: "reports:read", order: 10 },
  { id: "pontaj", label: "Pontaj", href: "/pontaj", icon: Clock,
    group: "operatiuni", feature: "attendance", permission: "attendance:read", order: 20 },
  { id: "concedii", label: "Concedii", href: "/concedii", icon: CalendarDays,
    group: "operatiuni", feature: "leave", permission: "leave_requests:read",
    badge: "leave_pending", order: 30,
    children: [
      { id: "concedii-cereri", label: "Cereri", href: "/concedii", feature: "leave", permission: "leave_requests:read" },
      { id: "concedii-sold", label: "Soldul zilelor", href: "/concedii/sold", feature: "leave", permission: "leave_balances:read" },
    ] },
  { id: "angajati", label: "Angajați", href: "/angajati", icon: Users,
    group: "personal", feature: null, permission: "employees:read", order: 40 },
  { id: "onboarding", label: "Onboarding", href: "/onboarding", icon: ClipboardList,
    group: "personal", feature: "onboarding", permission: "onboarding:read", order: 50 },
  { id: "ssm", label: "SSM", href: "/ssm", icon: HardHat,
    group: "personal", feature: "ssm", permission: "ssm_trainings:read", badge: "ssm_expiring", order: 60 },
  { id: "flota", label: "Flotă auto", href: "/flota", icon: Car,
    group: "resurse", feature: "fleet", permission: "vehicles:read", badge: "fleet_expiring", order: 70 },
  { id: "mentenanta", label: "Mentenanță", href: "/mentenanta", icon: Wrench,
    group: "resurse", feature: "maintenance", permission: "maintenance:read", badge: "maintenance_due", order: 80 },
  { id: "inventar", label: "Inventar", href: "/inventar", icon: Package,
    group: "resurse", feature: "inventory", permission: "inventory:read", order: 90 },
  { id: "anunturi", label: "Anunțuri", href: "/anunturi", icon: Megaphone,
    group: "resurse", feature: "announcements", permission: "announcements:read", order: 100 },
  { id: "salarizare", label: "Salarizare", href: "/salarizare", icon: Wallet,
    group: "financiar", feature: "payroll", permission: "payroll:read", order: 110 },
  { id: "diurna", label: "Diurnă", href: "/diurna", icon: Receipt,
    group: "financiar", feature: "per_diem", permission: "per_diem:read", order: 120 },
  { id: "rapoarte", label: "Rapoarte", href: "/rapoarte", icon: BarChart3,
    group: "financiar", feature: null, permission: "reports:read", order: 130 },
  { id: "setari", label: "Setări", href: "/setari/organizatie", icon: Settings,
    group: "administrare", feature: null, permission: "organization:update", order: 140,
    children: [
      { id: "setari-org", label: "Organizație", href: "/setari/organizatie", feature: null, permission: "organization:update" },
      { id: "setari-membri", label: "Membri și invitații", href: "/setari/membri", feature: null, permission: "members:manage" },
      { id: "setari-roluri", label: "Roluri și permisiuni", href: "/setari/roluri", feature: null, permission: "roles:manage" },
      { id: "setari-module", label: "Module active", href: "/setari/module", feature: null, permission: "features:manage" },
    ] },
];
```

`lib/navigation/build-navigation.ts` (pur → testabil cu Vitest, fara DB)
```ts
import { NAV_GROUPS, NAV_ITEMS, type BadgeSource, type NavItem } from "@/config/navigation";
import type { FeatureKey } from "@/config/features";
import type { PermissionKey } from "@/config/permissions";

export type ResolvedNavItem = Readonly<{
  id: string; label: string; href: string; icon: NavItem["icon"]; badgeCount: number;
  children: readonly Readonly<{ id: string; label: string; href: string }>[];
}>;
export type ResolvedNavGroup = Readonly<{ id: string; label: string; items: readonly ResolvedNavItem[] }>;

export function buildNavigation(args: Readonly<{
  features: ReadonlySet<FeatureKey>;
  permissions: ReadonlySet<PermissionKey>;
  badges: Readonly<Partial<Record<BadgeSource, number>>>;
}>): readonly ResolvedNavGroup[] {
  const visible = (feature: FeatureKey | null, permission: PermissionKey): boolean =>
    (feature === null || args.features.has(feature)) && args.permissions.has(permission);

  return NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: NAV_ITEMS.filter((i) => i.group === group.id && visible(i.feature, i.permission))
      .sort((a, b) => a.order - b.order)
      .map((i) => ({
        id: i.id, label: i.label, href: i.href, icon: i.icon,
        badgeCount: i.badge ? (args.badges[i.badge] ?? 0) : 0,
        children: (i.children ?? [])
          .filter((c) => visible(c.feature, c.permission))
          .map((c) => ({ id: c.id, label: c.label, href: c.href })),
      })),
  })).filter((g) => g.items.length > 0);
}
```

`app/(app)/layout.tsx`
```tsx
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { getSidebarBadges } from "@/lib/queries/dashboard";
import { buildNavigation } from "@/lib/navigation/build-navigation";
import { listUserOrganizations } from "@/lib/queries/organizations";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = await requireTenant();
  const [features, permissions, badges, organizations] = await Promise.all([
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, user.id),
    getSidebarBadges(tenant.organizationId),
    listUserOrganizations(),
  ]);
  const nav = buildNavigation({ features, permissions: new Set(permissions.keys()), badges });

  return (
    <div className="flex min-h-dvh">
      <Sidebar groups={nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} tenant={tenant} organizations={organizations} />
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

**Impunerea la trei niveluri pentru acelasi modul** — sidebarul ascunde intrarea (`buildNavigation`), pagina o refuza (`await requireFeature(tenant.organizationId, "leave")` + `can(permissions, "leave_requests:read")` in `page.tsx`), actiunea o refuza (`feature` + `permission` in `createAction`), iar RLS respinge randul chiar daca primele trei sunt ocolite. Ascunderea din UI nu este niciodata singura bariera.