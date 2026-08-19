# Înrolarea companiei (pasul zero) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un administrator de platformă introduce CUI-ul unei firme, îl completează/corectează cu date de la ANAF, confirmă profilul fiscal complet și creează direct contul de owner (org_admin) al companiei — organizația iese din acest flux activă și utilizabilă, fără pași manuali suplimentari.

**Architecture:** Se evoluează in-place formularul existent de creare organizație (`super-admin/organizatii/nou`) într-un flux în doi pași (stare locală de client, aceeași rută). Server Action-ul existent `creeazaOrganizatie` se redenumește `inroleazaOrganizatie` și i se adaugă crearea directă a userului owner prin `service_role` (`admin.auth.admin.createUser`), urmând convenția deja documentată în `src/lib/supabase/admin.ts`. CNP-ul reprezentantului legal e criptat cu convenția AES-GCM deja folosită pentru angajați. Parola temporară e generată de sistem și afișată o singură dată, ca linkul de invitație existent.

**Tech Stack:** Next.js 16 (Server Actions), Supabase (Postgres + Auth admin API), Zod, react-hook-form, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-inrolare-companie-design.md`

## Global Constraints

- CUI unic în bază — deja garantat de `organizations_cui_normalizat_uq`; NU se modifică.
- Capitalul social NU se preia niciodată de la ANAF — rămâne mereu completare manuală, indiferent de răspunsul API-ului.
- Codul CAEN poate lipsi (frecvent la PFA/II) — câmp opțional, niciodată blocant.
- Organizația iese din acest flux cu `status: 'active'` — NU mai trece prin `pending` ca fluxul vechi.
- Parola temporară a owner-ului nu ajunge NICIODATĂ în `audit_logs` sau în `console.error`.
- CNP-ul reprezentantului legal urmează regula de aur deja stabilită pentru date sensibile: valoarea decriptată nu ajunge niciodată într-un Server Component; doar `last4` mascat se afișează.
- Parola minimă rămâne 12 caractere (`parolaSchema` existent, neschimbat).
- Niciun cod nou de eroare — se refolosesc `ActionErrorCode` și mesajele din `createPlatformAction`/`ActionDenied` existente.
- 2FA și wizard-ul post-login (bănci, avans/lichidare, tichete masă, puncte de lucru, politică concediu, furnizori SSM/PSI) sunt explicit în afara acestui plan.

---

## File Structure

```
supabase/migrations/0029_inrolare_companie.sql          [nou] schema

src/domain/organization/anaf.ts                          [nou] maparea pură a răspunsului ANAF
src/domain/organization/anaf.test.ts                      [nou]

src/lib/anaf/cauta-firma.ts                               [nou] apelul HTTP către ANAF (I/O)

src/lib/crypto/organization-sensitive-data.ts             [nou] criptare CNP reprezentant legal
src/lib/crypto/organization-sensitive-data.test.ts         [nou]

src/schemas/organization.ts                               [modificat] câmpuri noi + redenumire schemă

src/app/(platform)/super-admin/organizatii/actions.ts      [modificat] acțiune nouă cautaCuiAnaf +
                                                                        redenumire/extindere inroleazaOrganizatie
                                                                        + extindere fisaOrganizatiei

src/app/(platform)/super-admin/organizatii/_components/formular-cautare-cui.tsx   [nou] Ecranul 1
src/app/(platform)/super-admin/organizatii/_components/formular-organizatie-noua.tsx [modificat] Ecranul 2, câmpuri noi
src/app/(platform)/super-admin/organizatii/_components/inrolare-organizatie.tsx    [nou] orchestrare pași + ecran succes
src/app/(platform)/super-admin/organizatii/nou/page.tsx    [modificat] randează noul wizard

src/app/(platform)/super-admin/organizatii/[orgId]/page.tsx [modificat] afișează câmpurile noi

src/app/(app)/layout.tsx                                   [modificat] poartă must_change_password
src/app/(auth)/parola-noua/actions.ts                       [modificat] curăță flag-ul după schimbare
```

---

## Task 1: Migrația de schemă

**Files:**
- Create: `supabase/migrations/0029_inrolare_companie.sql`

**Interfaces:**
- Produces: coloanele `organizations.cod_caen`, `organizations.capital_social`, `organizations.strada`, `organizations.numar`, `organizations.sector`, `organizations.reprezentant_functie`; tabelul `public.organization_legal_representative` (coloane: `organization_id`, `nume`, `functie`, `cnp_ciphertext`, `cnp_iv`, `cnp_tag`, `cnp_key_version`, `cnp_last4`, `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`); coloana `profiles.must_change_password`.

- [ ] **Step 1: Scrie migrația**

```sql
-- supabase/migrations/0029_inrolare_companie.sql
-- Faza — Înrolarea companiei (pasul zero): profil fiscal extins, reprezentant
-- legal criptat, flag de parolă obligatorie la primul login al owner-ului.

\set ON_ERROR_STOP on

-- ============================================================
-- 1. organizations — profil fiscal extins
-- ============================================================

alter table public.organizations
  add column cod_caen             text,
  add column capital_social       numeric(14, 2),
  add column strada               text,
  add column numar                text,
  add column sector               text,
  add column reprezentant_functie text;

alter table public.organizations
  add constraint organizations_cod_caen_format_ck
    check (cod_caen is null or cod_caen ~ '^[0-9]{4}$'),
  add constraint organizations_capital_social_ck
    check (capital_social is null or capital_social >= 0);

comment on column public.organizations.cod_caen is
  'Cod CAEN principal, 4 cifre. Poate lipsi (frecvent la PFA/II) — motorul de salarizare tratează absența ca "fără facilitate fiscală".';
comment on column public.organizations.capital_social is
  'Mereu completare manuală: API-ul ANAF nu oferă capitalul social (vine din Registrul Comerțului).';

-- ============================================================
-- 2. organization_legal_representative — 1:1, date sensibile separate
-- ============================================================
-- Pe modelul employee_sensitive_data: separată de organizations (citită des),
-- EXCLUSĂ din internal.attach_audit (conține criptotext — vezi garda R9 din
-- 0002_authz.sql) și din grant-urile pentru `authenticated`: singurul drum de
-- scriere/citire e prin Server Actions cu clientul service_role, ca la CNP-ul
-- angajaților.

create table public.organization_legal_representative (
  organization_id  uuid primary key references public.organizations (id) on delete cascade,
  nume             text,
  functie          text,
  cnp_ciphertext   bytea,
  cnp_iv           bytea,
  cnp_tag          bytea,
  cnp_key_version  int,
  cnp_last4        text,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint org_legal_rep_cnp_complet check (
    (cnp_ciphertext is null and cnp_iv is null and cnp_tag is null and cnp_key_version is null)
    or (cnp_ciphertext is not null and cnp_iv is not null and cnp_tag is not null and cnp_key_version is not null)
  ),
  constraint org_legal_rep_cnp_iv_len check (cnp_iv is null or octet_length(cnp_iv) = 12),
  constraint org_legal_rep_cnp_tag_len check (cnp_tag is null or octet_length(cnp_tag) = 16),
  constraint org_legal_rep_cnp_last4_ck check (cnp_last4 is null or cnp_last4 ~ '^[0-9]{4}$')
);
comment on table public.organization_legal_representative is
  'Reprezentantul legal (administrator/director general) al companiei. CNP opțional, criptat AES-GCM ca la employee_sensitive_data. Fără RLS pentru `authenticated`: acces exclusiv prin Server Actions, client service_role.';

alter table public.organization_legal_representative enable row level security;
alter table public.organization_legal_representative force row level security;
revoke all on public.organization_legal_representative from authenticated, anon;

create trigger set_actor_organization_legal_representative
  before insert or update on public.organization_legal_representative
  for each row execute function internal.set_actor();

create trigger set_updated_at_organization_legal_representative
  before update on public.organization_legal_representative
  for each row execute function app.set_updated_at();

-- ============================================================
-- 3. profiles — parolă temporară obligatorie la primul login
-- ============================================================

alter table public.profiles
  add column must_change_password boolean not null default false;

comment on column public.profiles.must_change_password is
  'true când contul a fost creat de un administrator de platformă cu parolă temporară (înrolare companie); (app)/layout.tsx redirecționează la /parola-noua până se schimbă.';
```

- [ ] **Step 2: Verifică sintaxa local**

Run: `cd supabase && npx supabase db lint 2>&1 || true` (dacă CLI-ul Supabase nu e configurat local pentru acest proiect, verifică vizual sintaxa — nu există alt validator offline în acest repo).

- [ ] **Step 3: Aplică migrația pe proiectul de test/dev legat și regenerează tipurile**

Run: `pnpm db:push` (aplică migrațiile pe proiectul Supabase legat), apoi `pnpm db:types` (rescrie `src/types/database.ts`).

Acest pas necesită un proiect Supabase legat și `SUPABASE_ACCESS_TOKEN`/link configurat — dacă mediul de execuție nu are acces, marchează pasul ca manual și continuă cu restul task-urilor: codul TypeScript din task-urile următoare compilează contra tipurilor curente doar după ce acest pas rulează cu adevărat. Nu inventa un `Database` type manual — `db:types` e singura sursă de adevăr.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0029_inrolare_companie.sql src/types/database.ts
git commit -m "feat(db): profil fiscal extins, reprezentant legal criptat, flag parolă temporară"
```

---

## Task 2: Maparea pură a răspunsului ANAF

**Files:**
- Create: `src/domain/organization/anaf.ts`
- Test: `src/domain/organization/anaf.test.ts`

**Interfaces:**
- Produces: `mapeazaRaspunsAnaf(cuiNormalizat: string, raspuns: unknown): RezultatAnaf`, tipurile `RezultatAnaf`, `RezultatAnafGasit`, `AdresaAnaf`.
- Consumes: nimic (funcție pură, fără I/O — testabilă fără rețea).

**Notă de implementare:** forma exactă a JSON-ului public ANAF (`date_generale`, `inregistrare_scop_Tva.scpTVA`, `stare_inactiv.statusInactivi`, `adresa_sediu_social.sdenumire_Strada` etc.) nu are un contract oficial versionat — verifică-o împotriva unui apel real înainte de a considera task-ul închis (vezi Task 3, Step 4). Mapatorul e scris defensiv: orice câmp lipsă sau cu formă neașteptată devine `null`, niciodată eroare — degradarea la completare manuală e comportamentul dorit, nu un bug.

- [ ] **Step 1: Scrie testul (înainte de implementare)**

```typescript
// src/domain/organization/anaf.test.ts
import { describe, expect, it } from "vitest";
import { mapeazaRaspunsAnaf } from "./anaf";

const RASPUNS_VALID = {
  cod: 200,
  found: [
    {
      date_generale: {
        cui: 14399840,
        denumire: "FIRMA MEA SRL",
        nrRegCom: "J40/1234/2020",
        cod_CAEN: 6201,
        stare_inregistrare: "INREGISTRAT din data 01.01.2020",
      },
      inregistrare_scop_Tva: { scpTVA: true },
      stare_inactiv: { statusInactivi: false },
      adresa_sediu_social: {
        sdenumire_Strada: "STR. EXEMPLU",
        snumar_Strada: "10",
        sdenumire_Localitate: "SECTOR 1",
        sdenumire_Judet: "BUCURESTI",
        scod_Postal: "010101",
      },
    },
  ],
  notFound: [],
};

describe("mapeazaRaspunsAnaf", () => {
  it("extrage datele de bază dintr-un răspuns complet", () => {
    const rezultat = mapeazaRaspunsAnaf("14399840", RASPUNS_VALID);
    expect(rezultat.gasit).toBe(true);
    if (!rezultat.gasit) return;
    expect(rezultat.denumire).toBe("FIRMA MEA SRL");
    expect(rezultat.cui).toBe("14399840");
    expect(rezultat.platitorTva).toBe(true);
    expect(rezultat.regCom).toBe("J40/1234/2020");
    expect(rezultat.codCaen).toBe("6201");
    expect(rezultat.radiata).toBe(false);
    expect(rezultat.adresa.strada).toBe("STR. EXEMPLU");
    expect(rezultat.adresa.numar).toBe("10");
    expect(rezultat.adresa.judet).toBe("BUCURESTI");
    expect(rezultat.adresa.codPostal).toBe("010101");
  });

  it("întoarce negăsit când found e gol", () => {
    const rezultat = mapeazaRaspunsAnaf("14399840", { found: [], notFound: [{ cui: 14399840 }] });
    expect(rezultat.gasit).toBe(false);
  });

  it("tratează firma radiată ca găsită, cu radiata=true, nu ca eroare", () => {
    const raspuns = {
      found: [
        {
          date_generale: { denumire: "FIRMA RADIATA SRL" },
          stare_inactiv: { statusInactivi: true },
        },
      ],
    };
    const rezultat = mapeazaRaspunsAnaf("14399840", raspuns);
    expect(rezultat.gasit).toBe(true);
    if (!rezultat.gasit) return;
    expect(rezultat.radiata).toBe(true);
  });

  it("nu aruncă și întoarce negăsit pentru un răspuns cu formă complet neașteptată", () => {
    expect(mapeazaRaspunsAnaf("14399840", null).gasit).toBe(false);
    expect(mapeazaRaspunsAnaf("14399840", "text neașteptat").gasit).toBe(false);
    expect(mapeazaRaspunsAnaf("14399840", { altceva: true }).gasit).toBe(false);
  });

  it("lasă codCaen null când lipsește (PFA/II), fără să blocheze restul câmpurilor", () => {
    const raspuns = {
      found: [{ date_generale: { denumire: "PFA EXEMPLU" }, stare_inactiv: { statusInactivi: false } }],
    };
    const rezultat = mapeazaRaspunsAnaf("14399840", raspuns);
    expect(rezultat.gasit).toBe(true);
    if (!rezultat.gasit) return;
    expect(rezultat.codCaen).toBeNull();
    expect(rezultat.denumire).toBe("PFA EXEMPLU");
  });
});
```

- [ ] **Step 2: Rulează testul, confirmă că eșuează (modulul nu există încă)**

Run: `pnpm vitest run --project unit src/domain/organization/anaf.test.ts`
Expected: FAIL cu „Cannot find module './anaf'”.

- [ ] **Step 3: Implementează**

```typescript
// src/domain/organization/anaf.ts
// Maparea pură a răspunsului ANAF v9 (PlatitorTvaRest) — fără I/O, testabilă
// fără rețea. Orice câmp lipsă sau cu formă neașteptată devine `null`:
// degradarea la completare manuală e comportamentul dorit, nu o eroare.

function caText(valoare: unknown): string | null {
  if (typeof valoare === "string" && valoare.trim().length > 0) return valoare.trim();
  if (typeof valoare === "number" && Number.isFinite(valoare)) return String(valoare);
  return null;
}

function caObiect(valoare: unknown): Record<string, unknown> | null {
  return typeof valoare === "object" && valoare !== null && !Array.isArray(valoare)
    ? (valoare as Record<string, unknown>)
    : null;
}

function caCodCaen(valoare: unknown): string | null {
  const text = caText(valoare);
  if (text === null) return null;
  const cifre = text.replace(/\D+/g, "");
  return /^[0-9]{4}$/.test(cifre) ? cifre : null;
}

export interface AdresaAnaf {
  readonly judet: string | null;
  readonly localitate: string | null;
  readonly strada: string | null;
  readonly numar: string | null;
  readonly codPostal: string | null;
}

export interface RezultatAnafGasit {
  readonly gasit: true;
  readonly denumire: string;
  readonly cui: string;
  readonly platitorTva: boolean;
  readonly regCom: string | null;
  readonly codCaen: string | null;
  readonly radiata: boolean;
  readonly adresa: AdresaAnaf;
}

export interface RezultatAnafNegasit {
  readonly gasit: false;
}

export type RezultatAnaf = RezultatAnafGasit | RezultatAnafNegasit;

const NEGASIT: RezultatAnafNegasit = { gasit: false };

export function mapeazaRaspunsAnaf(cuiNormalizat: string, raspuns: unknown): RezultatAnaf {
  const radacina = caObiect(raspuns);
  const gasite = radacina?.["found"];
  if (!Array.isArray(gasite) || gasite.length === 0) return NEGASIT;

  const intrare = caObiect(gasite[0]);
  if (intrare === null) return NEGASIT;

  const dateGenerale = caObiect(intrare["date_generale"]);
  const denumire = caText(dateGenerale?.["denumire"]);
  if (denumire === null) return NEGASIT;

  const inregistrareTva = caObiect(intrare["inregistrare_scop_Tva"]);
  const stareInactiv = caObiect(intrare["stare_inactiv"]);
  const adresaSediu = caObiect(intrare["adresa_sediu_social"]);

  return {
    gasit: true,
    denumire,
    cui: cuiNormalizat,
    platitorTva: inregistrareTva?.["scpTVA"] === true,
    regCom: caText(dateGenerale?.["nrRegCom"]),
    codCaen: caCodCaen(dateGenerale?.["cod_CAEN"]),
    radiata: stareInactiv?.["statusInactivi"] === true,
    adresa: {
      judet: caText(adresaSediu?.["sdenumire_Judet"]),
      localitate: caText(adresaSediu?.["sdenumire_Localitate"]),
      strada: caText(adresaSediu?.["sdenumire_Strada"]),
      numar: caText(adresaSediu?.["snumar_Strada"]),
      codPostal: caText(adresaSediu?.["scod_Postal"]),
    },
  };
}
```

- [ ] **Step 4: Rulează testul, confirmă că trece**

Run: `pnpm vitest run --project unit src/domain/organization/anaf.test.ts`
Expected: PASS, toate cele 5 cazuri.

- [ ] **Step 5: Commit**

```bash
git add src/domain/organization/anaf.ts src/domain/organization/anaf.test.ts
git commit -m "feat(organization): mapare pură a răspunsului ANAF (PlatitorTvaRest v9)"
```

---

## Task 3: Clientul HTTP pentru ANAF

**Files:**
- Create: `src/lib/anaf/cauta-firma.ts`

**Interfaces:**
- Consumes: `mapeazaRaspunsAnaf` din `@/domain/organization/anaf` (Task 2).
- Produces: `cautaFirmaAnaf(cuiNormalizat: string): Promise<RezultatCautareAnaf>`, tipul `RezultatCautareAnaf = { stare: "gasit"; rezultat: RezultatAnafGasit } | { stare: "negasit" } | { stare: "indisponibil" }`. Consumat de Task 6 (`cautaCuiAnaf` Server Action).

- [ ] **Step 1: Implementează**

```typescript
// src/lib/anaf/cauta-firma.ts
import "server-only";
import { mapeazaRaspunsAnaf, type RezultatAnafGasit } from "@/domain/organization/anaf";

const ANAF_URL = "https://webservicesp.anaf.ro/PlatitorTvaRest/api/v9/ws/tva";
const TIMEOUT_MS = 8000;

export type RezultatCautareAnaf =
  | Readonly<{ stare: "gasit"; rezultat: RezultatAnafGasit }>
  | Readonly<{ stare: "negasit" }>
  | Readonly<{ stare: "indisponibil" }>;

/**
 * Apelul public ANAF (fără cheie, fără autentificare). Orice eșec — timeout,
 * rețea, HTTP non-200, JSON invalid — degradează la „indisponibil”, niciodată
 * excepție: ecranul 1 trebuie să poată trece mereu la completare manuală.
 */
export async function cautaFirmaAnaf(cuiNormalizat: string): Promise<RezultatCautareAnaf> {
  const azi = new Date().toISOString().slice(0, 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const raspuns = await fetch(ANAF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ cui: Number(cuiNormalizat), data: azi }]),
      signal: controller.signal,
    });
    if (!raspuns.ok) return { stare: "indisponibil" };
    const json: unknown = await raspuns.json();
    const rezultat = mapeazaRaspunsAnaf(cuiNormalizat, json);
    return rezultat.gasit ? { stare: "gasit", rezultat } : { stare: "negasit" };
  } catch {
    return { stare: "indisponibil" };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: Verificare de tip**

Run: `pnpm typecheck`
Expected: fără erori noi în `src/lib/anaf/cauta-firma.ts`.

- [ ] **Step 3: Test manual împotriva API-ului real (o singură dată, ca să confirmi forma răspunsului)**

Run:
```bash
curl -s -X POST https://webservicesp.anaf.ro/PlatitorTvaRest/api/v9/ws/tva \
  -H "Content-Type: application/json" \
  -d '[{"cui":14399840,"data":"2026-08-19"}]'
```
Compară forma reală cu presupunerile din `mapeazaRaspunsAnaf` (Task 2). Dacă numele câmpurilor diferă, actualizează mapatorul și testele din Task 2 înainte de a continua — acesta e singurul punct din plan unde comportamentul depinde de un contract extern neverificat static.

- [ ] **Step 4: Commit**

```bash
git add src/lib/anaf/cauta-firma.ts
git commit -m "feat(anaf): client HTTP pentru API-ul public ANAF (căutare CUI)"
```

---

## Task 4: Criptarea CNP-ului reprezentantului legal

**Files:**
- Create: `src/lib/crypto/organization-sensitive-data.ts`
- Test: `src/lib/crypto/organization-sensitive-data.test.ts`

**Interfaces:**
- Consumes: `valideazaCnp` din `@/domain/employee/cnp`; `encrypt`, `catreBytea`, `versiuneCaNumar` din `@/lib/crypto/aes-gcm`.
- Produces: `pregatestePayloadCnp(cnpBrut: string | null): PayloadCnpReprezentant`, `EroareCnpReprezentant`. Consumat de Task 7 (`inroleazaOrganizatie`).

- [ ] **Step 1: Scrie testul**

```typescript
// src/lib/crypto/organization-sensitive-data.test.ts
import { describe, expect, it, vi } from "vitest";

const chei = vi.hoisted(() => ({
  v1: Buffer.alloc(32, 0x11).toString("base64"),
  hmac: Buffer.alloc(32, 0x33).toString("base64"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  serverEnv: {
    HR_ENCRYPTION_KEYS: { "1": chei.v1 },
    HR_ENCRYPTION_ACTIVE_KEY: "1",
    HR_HASH_KEY: chei.hmac,
  },
}));

const { EroareCnpReprezentant, pregatestePayloadCnp } = await import(
  "./organization-sensitive-data"
);

// CNP valid, verificat manual cu algoritmul oficial (cifră de control 9).
const CNP_VALID = "1960101221119";

describe("pregatestePayloadCnp", () => {
  it("întoarce toate câmpurile null pentru CNP absent", () => {
    expect(pregatestePayloadCnp(null)).toEqual({
      cnp_ciphertext: null,
      cnp_iv: null,
      cnp_tag: null,
      cnp_key_version: null,
      cnp_last4: null,
    });
    expect(pregatestePayloadCnp("")).toEqual({
      cnp_ciphertext: null,
      cnp_iv: null,
      cnp_tag: null,
      cnp_key_version: null,
      cnp_last4: null,
    });
  });

  it("criptează un CNP valid și expune ultimele 4 cifre necriptat", () => {
    const payload = pregatestePayloadCnp(CNP_VALID);
    expect(payload.cnp_last4).toBe(CNP_VALID.slice(-4));
    expect(payload.cnp_key_version).toBe(1);
    expect(payload.cnp_ciphertext).toMatch(/^\\x[0-9a-f]+$/);
    expect(payload.cnp_ciphertext).not.toContain(CNP_VALID);
  });

  it("aruncă EroareCnpReprezentant pentru un CNP invalid", () => {
    expect(() => pregatestePayloadCnp("123")).toThrowError(EroareCnpReprezentant);
  });
});
```

- [ ] **Step 2: Rulează testul, confirmă că eșuează**

Run: `pnpm vitest run --project unit src/lib/crypto/organization-sensitive-data.test.ts`
Expected: FAIL cu „Cannot find module './organization-sensitive-data'”.

- [ ] **Step 3: Implementează**

```typescript
// src/lib/crypto/organization-sensitive-data.ts
import "server-only";

import { valideazaCnp } from "@/domain/employee/cnp";
import { catreBytea, encrypt, versiuneCaNumar } from "@/lib/crypto/aes-gcm";

/**
 * Doar scriere + citire mascată. Spre deosebire de `sensitive-data.ts`
 * (angajați), acest plan nu are UI care decriptează CNP-ul reprezentantului
 * legal — dacă apare nevoia, se adaugă atunci o funcție de citire completă,
 * cu jurnalizare explicită, ca la angajați.
 */
export class EroareCnpReprezentant extends Error {
  constructor(mesaj: string) {
    super(mesaj);
    this.name = "EroareCnpReprezentant";
  }
}

export interface PayloadCnpReprezentant {
  readonly cnp_ciphertext: string | null;
  readonly cnp_iv: string | null;
  readonly cnp_tag: string | null;
  readonly cnp_key_version: number | null;
  readonly cnp_last4: string | null;
}

export function pregatestePayloadCnp(cnpBrut: string | null): PayloadCnpReprezentant {
  if (cnpBrut === null || cnpBrut.trim().length === 0) {
    return {
      cnp_ciphertext: null,
      cnp_iv: null,
      cnp_tag: null,
      cnp_key_version: null,
      cnp_last4: null,
    };
  }
  const rezultat = valideazaCnp(cnpBrut);
  if (!rezultat.valid) {
    throw new EroareCnpReprezentant(rezultat.mesaj);
  }
  const criptat = encrypt(rezultat.cnp);
  return {
    cnp_ciphertext: catreBytea(criptat.ciphertext),
    cnp_iv: catreBytea(criptat.iv),
    cnp_tag: catreBytea(criptat.tag),
    cnp_key_version: versiuneCaNumar(criptat.keyVersion),
    cnp_last4: rezultat.cnp.slice(-4),
  };
}

/** Mascare pentru afișare — niciodată ciphertext-ul, doar ultimele 4 cifre. */
export function cnpMascatReprezentant(ultimele4: string | null): string | null {
  if (ultimele4 === null) return null;
  return `${"*".repeat(9)}${ultimele4}`;
}
```

- [ ] **Step 4: Rulează testul, confirmă că trece**

Run: `pnpm vitest run --project unit src/lib/crypto/organization-sensitive-data.test.ts`
Expected: PASS, toate cele 3 cazuri.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto/organization-sensitive-data.ts src/lib/crypto/organization-sensitive-data.test.ts
git commit -m "feat(crypto): criptare CNP pentru reprezentantul legal al companiei"
```

---

## Task 5: Extinderea schemelor Zod

**Files:**
- Modify: `src/schemas/organization.ts`

**Interfaces:**
- Consumes: `valideazaCnp` din `@/domain/employee/cnp` (import nou).
- Produces: `inroleazaOrganizatieSchema` (redenumire din `creeazaOrganizatieSchema`, cu câmpuri noi), `InroleazaOrganizatieInput`/`InroleazaOrganizatieOutput` (redenumire din `CreeazaOrganizatieInput`/`CreeazaOrganizatieOutput`), `cautaCuiAnafSchema`. Consumat de Task 6, Task 7, Task 8, Task 9.

- [ ] **Step 1: Adaugă importul `valideazaCnp`**

```typescript
// în src/schemas/organization.ts, lângă importurile existente
import { valideazaCnp } from "@/domain/employee/cnp";
```

- [ ] **Step 2: Adaugă schemele noi de câmp, imediat după `telefonSchema`**

```typescript
export const codCaenSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{4}$/, "Codul CAEN are exact 4 cifre (ex. 6201).")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const capitalSocialSchema = z.coerce
  .number("Capitalul social trebuie să fie o sumă.")
  .min(0, "Capitalul social nu poate fi negativ.")
  .max(999_999_999.99, "Valoarea depășește limita acceptată.");

export const cnpReprezentantSchema = z
  .string()
  .trim()
  .optional()
  // La fel ca `textOptional`: golul devine `undefined` DUPĂ parsare, nu prin
  // `.or(z.literal(""))` — acel combinator nu s-ar atinge niciodată aici,
  // pentru că un `z.string().optional()` fără altă constrângere acceptă deja
  // "" ca șir valid, deci a doua ramură a uniunii n-ar mai fi încercată.
  .transform((v) => (v === undefined || v === "" ? undefined : v))
  .refine((v) => v === undefined || valideazaCnp(v).valid, {
    error: "CNP-ul reprezentantului nu este valid.",
  });
```

- [ ] **Step 3: Redenumește `creeazaOrganizatieSchema` → `inroleazaOrganizatieSchema` și adaugă câmpurile noi**

```typescript
export const inroleazaOrganizatieSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.")
      .max(120, "Denumirea este prea lungă."),
    legal_name: textOptional(160),
    forma_juridica: z.enum(FORME_JURIDICE, "Alegeți forma juridică."),
    cui: cuiSchema,
    platitor_tva: z.boolean().default(false),
    reg_com: textOptional(40),
    cod_caen: codCaenSchema,
    capital_social: capitalSocialSchema,
    slug: slugSchema,
    email_contact: emailSchema,
    telefon_contact: telefonSchema,
    judet: judetSchema,
    oras: z.string().trim().min(2, "Introduceți localitatea.").max(80, "Localitatea este prea lungă."),
    strada: z.string().trim().min(2, "Introduceți strada.").max(160, "Numele străzii este prea lung."),
    numar: z.string().trim().min(1, "Introduceți numărul.").max(20, "Numărul este prea lung."),
    sector: textOptional(20),
    adresa: textOptional(240),
    cod_postal: textOptional(10),
    website: z
      .url("Introduceți o adresă web validă (ex. https://firma.ro).")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    reprezentant_legal: textOptional(120),
    reprezentant_functie: z
      .string()
      .trim()
      .min(2, "Introduceți funcția reprezentantului.")
      .max(80, "Funcția este prea lungă."),
    reprezentant_cnp: cnpReprezentantSchema,
    plan: planSchema,
    seats_limit: seatsLimitSchema,
    owner_nume: z
      .string()
      .trim()
      .min(2, "Introduceți numele complet al proprietarului.")
      .max(160, "Numele este prea lung."),
    owner_email: emailSchema,
    owner_telefon: telefonSchema,
  })
  .superRefine((valori, ctx) => {
    if (valori.judet === "București" && (valori.sector === undefined || valori.sector.trim() === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["sector"],
        message: "Sectorul este obligatoriu pentru sediile din București.",
      });
    }
  });

export type InroleazaOrganizatieInput = z.input<typeof inroleazaOrganizatieSchema>;
export type InroleazaOrganizatieOutput = z.output<typeof inroleazaOrganizatieSchema>;

export const cautaCuiAnafSchema = z.object({ cui: cuiSchema });
export type CautaCuiAnafInput = z.input<typeof cautaCuiAnafSchema>;
```

Șterge definiția veche a lui `creeazaOrganizatieSchema` (inclusiv `CreeazaOrganizatieInput`/`CreeazaOrganizatieOutput`) — a fost înlocuită complet de blocul de mai sus, nu coexistă cu ea.

- [ ] **Step 4: Verificare de tip (va eșua temporar pe fișierele care încă importă numele vechi — se rezolvă în Task 6/8/9)**

Run: `pnpm typecheck`
Expected: erori în `organizatii/actions.ts` și `formular-organizatie-noua.tsx` (importuri ale numelor vechi) — se rezolvă în task-urile următoare, nu acum.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/organization.ts
git commit -m "feat(schemas): câmpuri noi de înrolare + redenumire inroleazaOrganizatieSchema"
```

---

## Task 6: Acțiunea `cautaCuiAnaf`

**Files:**
- Modify: `src/app/(platform)/super-admin/organizatii/actions.ts`

**Interfaces:**
- Consumes: `cautaFirmaAnaf` din `@/lib/anaf/cauta-firma` (Task 3), `cautaCuiAnafSchema` din `@/schemas/organization` (Task 5), `createPlatformAction`, `businessRule`.
- Produces: `cautaCuiAnaf(raw: unknown): Promise<ActionResult<RezultatCautareCui>>`, tip `RezultatCautareCui`. Consumat de Task 8 (`formular-cautare-cui.tsx`).

- [ ] **Step 1: Adaugă importurile și tipul de rezultat, la începutul fișierului**

```typescript
import { cautaFirmaAnaf } from "@/lib/anaf/cauta-firma";
import { cautaCuiAnafSchema } from "@/schemas/organization";
import type { RezultatAnafGasit } from "@/domain/organization/anaf";
```

- [ ] **Step 2: Adaugă acțiunea, înainte de `creeazaOrganizatie`**

```typescript
export type RezultatCautareCui = Readonly<{
  cui: string;
  anaf: RezultatAnafGasit | null;
}>;

/**
 * Verifică unicitatea CUI ÎNAINTE de a apela ANAF: dacă organizația există
 * deja, nu are rost să interogăm un API extern. Rezultatul e mereu "ok" din
 * perspectiva Ecranului 1 — un CUI negăsit sau un ANAF indisponibil întorc
 * `anaf: null`, nu eroare, pentru ca formularul să treacă la completare manuală.
 */
export const cautaCuiAnaf = createPlatformAction<typeof cautaCuiAnafSchema, RezultatCautareCui>({
  name: "platforma.org.cauta_cui",
  input: cautaCuiAnafSchema,
  rateLimit: { max: 30, windowSeconds: 3600 },
  audit: {
    action: "view",
    entityType: "organizations",
    allow: ["cui"],
  },
  handler: async (_ctx, input) => {
    const admin = createAdminSupabase();
    const { data: existent, error } = await admin
      .from("organizations")
      .select("id, name")
      .eq("cui_normalizat", input.cui)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (existent) {
      throw businessRule(`Există deja o organizație cu CUI-ul ${input.cui}: „${existent.name}”.`);
    }

    const cautare = await cautaFirmaAnaf(input.cui);
    return {
      cui: input.cui,
      anaf: cautare.stare === "gasit" ? cautare.rezultat : null,
    };
  },
});
```

- [ ] **Step 3: Verificare de tip**

Run: `pnpm typecheck`
Expected: fără erori noi legate de `cautaCuiAnaf` (erorile despre `creeazaOrganizatie`/`creeazaOrganizatieSchema` rămân până la Task 7).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(platform)/super-admin/organizatii/actions.ts"
git commit -m "feat(organizatii): acțiunea cautaCuiAnaf pentru Ecranul 1 de înrolare"
```

---

## Task 7: `inroleazaOrganizatie` — organizație + reprezentant legal + owner

**Files:**
- Modify: `src/app/(platform)/super-admin/organizatii/actions.ts`

**Interfaces:**
- Consumes: `inroleazaOrganizatieSchema` (Task 5), `pregatestePayloadCnp`/`EroareCnpReprezentant` din `@/lib/crypto/organization-sensitive-data` (Task 4).
- Produces: `inroleazaOrganizatie(raw: unknown): Promise<ActionResult<OrganizatieInrolata>>`, tip `OrganizatieInrolata = { id: string; name: string; slug: string; ownerEmail: string; parolaTemporara: string }`. Consumat de Task 9/10 (formularul de Ecran 2).

- [ ] **Step 1: Adaugă importurile**

```typescript
import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { inroleazaOrganizatieSchema } from "@/schemas/organization";
import { pregatestePayloadCnp, EroareCnpReprezentant } from "@/lib/crypto/organization-sensitive-data";
```

(`inroleazaOrganizatieSchema` înlocuiește importul vechi `creeazaOrganizatieSchema` din blocul de importuri existent — actualizează-l acolo, nu adăuga un al doilea import.)

Actualizează și importul existent din `@/lib/actions/errors` ca să includă `invalidInput` (folosit la Step 2 pentru CNP invalid):

```typescript
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
```

- [ ] **Step 2: Înlocuiește `creeazaOrganizatie` cu `inroleazaOrganizatie`**

Șterge complet blocul `export const creeazaOrganizatie = createPlatformAction<...>({...})` (liniile care definesc acțiunea, tipul `OrganizatieCreata` inclus) și înlocuiește-l cu:

```typescript
export type OrganizatieInrolata = Readonly<{
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  /** Afișată o singură dată în UI (Task 10) — NU se loghează, NU intră în audit. */
  parolaTemporara: string;
}>;

function genereazaParolaTemporara(): string {
  // 18 octeți -> 24 caractere base64url; peste minimul de 12 din parolaSchema.
  return randomBytes(18).toString("base64url");
}

export const inroleazaOrganizatie = createPlatformAction<
  typeof inroleazaOrganizatieSchema,
  OrganizatieInrolata
>({
  name: "platforma.org.inroleaza",
  input: inroleazaOrganizatieSchema,
  rateLimit: { max: 20, windowSeconds: 3600 },
  audit: {
    action: "org_created",
    entityType: "organizations",
    entityId: (_input, data) => data.id,
    organizationId: (_input, data) => data.id,
    allow: [
      "id",
      "name",
      "slug",
      "cui",
      "plan",
      "seats_limit",
      "judet",
      "oras",
      "forma_juridica",
      "cod_caen",
      "ownerEmail",
    ],
  },
  revalidate: CAI_REVALIDATE,
  handler: async (ctx, input) => {
    const admin = createAdminSupabase();

    const { data: existent, error: eroareCautare } = await admin
      .from("organizations")
      .select("id, name, cui, slug")
      .or(`cui_normalizat.eq.${input.cui},slug.eq.${input.slug}`)
      .limit(1)
      .maybeSingle();
    if (eroareCautare) throw eroareCautare;
    if (existent) {
      throw businessRule(
        existent.cui === input.cui
          ? `Există deja o organizație cu CUI-ul ${input.cui}: „${existent.name}”.`
          : `Identificatorul „${input.slug}” este deja folosit de organizația „${existent.name}”.`,
      );
    }

    // Validăm CNP-ul reprezentantului ÎNAINTE de orice scriere: un CNP greșit
    // nu trebuie să lase în urmă o organizație pe jumătate creată.
    let payloadCnp: ReturnType<typeof pregatestePayloadCnp>;
    try {
      payloadCnp = pregatestePayloadCnp(input.reprezentant_cnp ?? null);
    } catch (eroare) {
      if (eroare instanceof EroareCnpReprezentant) {
        throw invalidInput(eroare.message, { reprezentant_cnp: [eroare.message] });
      }
      throw eroare;
    }

    const { data: organizatie, error } = await admin
      .from("organizations")
      .insert({
        name: input.name,
        ...(input.legal_name === undefined ? {} : { legal_name: input.legal_name }),
        forma_juridica: input.forma_juridica,
        cui: input.cui,
        platitor_tva: input.platitor_tva,
        ...(input.reg_com === undefined ? {} : { reg_com: input.reg_com }),
        ...(input.cod_caen === undefined ? {} : { cod_caen: input.cod_caen }),
        capital_social: input.capital_social,
        slug: input.slug,
        email_contact: input.email_contact,
        telefon_contact: input.telefon_contact,
        judet: input.judet,
        oras: input.oras,
        strada: input.strada,
        numar: input.numar,
        ...(input.sector === undefined ? {} : { sector: input.sector }),
        ...(input.adresa === undefined ? {} : { adresa: input.adresa }),
        ...(input.cod_postal === undefined ? {} : { cod_postal: input.cod_postal }),
        ...(input.website === undefined ? {} : { website: input.website }),
        ...(input.reprezentant_legal === undefined
          ? {}
          : { reprezentant_legal: input.reprezentant_legal }),
        reprezentant_functie: input.reprezentant_functie,
        plan: input.plan,
        seats_limit: input.seats_limit,
        // Spre deosebire de fluxul vechi: înrolarea e completă, nu un lead —
        // organizația iese din acest flux activă, nu "pending".
        status: "active",
        activated_at: ctx.now.toISOString(),
        subscription_status: input.plan === "trial" ? "trialing" : "active",
        timezone: "Europe/Bucharest",
        locale: "ro-RO",
        moneda: "RON",
        // NU seta `tara: "România"` (bug preexistent copiat din handler-ul
        // vechi): coloana are `check (tara ~ '^[A-Z]{2}$')` — "România" ar
        // respinge inserarea. Se omite complet, rămâne pe default-ul 'RO'.
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, name, slug")
      .single();
    if (error) throw error;

    // Modulele de bază se activează automat; restul se comută din fișa organizației.
    const { data: moduleDeBaza, error: eroareModule } = await admin
      .from("features")
      .select("feature_key")
      .eq("is_core", true);
    if (eroareModule) throw eroareModule;
    if (moduleDeBaza && moduleDeBaza.length > 0) {
      const { error: eroareActivare } = await admin.from("organization_features").insert(
        moduleDeBaza.map((modul) => ({
          organization_id: organizatie.id,
          feature_key: modul.feature_key,
          enabled: true,
          activated_at: ctx.now.toISOString(),
          activated_by: ctx.user.id,
        })),
      );
      if (eroareActivare) throw eroareActivare;
    }

    if (payloadCnp.cnp_ciphertext !== null || input.reprezentant_legal !== undefined) {
      const { error: eroareReprezentant } = await admin
        .from("organization_legal_representative")
        .insert({
          organization_id: organizatie.id,
          nume: input.reprezentant_legal ?? null,
          functie: input.reprezentant_functie,
          ...payloadCnp,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        });
      if (eroareReprezentant) throw eroareReprezentant;
    }

    const parolaTemporara = genereazaParolaTemporara();
    const { data: userNou, error: eroareUser } = await admin.auth.admin.createUser({
      email: input.owner_email,
      password: parolaTemporara,
      email_confirm: true,
      phone: input.owner_telefon,
      user_metadata: { full_name: input.owner_nume },
    });

    if (eroareUser || !userNou.user) {
      // Compensare: CUI-ul/slug-ul nu rămân blocate de o înrolare eșuată pe
      // jumătate. `organization_legal_representative` cade automat prin
      // `on delete cascade`.
      await admin.from("organizations").delete().eq("id", organizatie.id);
      throw businessRule(
        `Organizația nu a putut fi înrolată: contul proprietarului nu a putut fi creat (${eroareUser?.message ?? "motiv necunoscut"}). Reîncearcă.`,
      );
    }

    const { error: eroareMembru } = await admin.from("organization_members").insert({
      organization_id: organizatie.id,
      user_id: userNou.user.id,
      role: "org_admin",
      status: "active",
      created_by: ctx.user.id,
      updated_by: ctx.user.id,
    });
    if (eroareMembru) throw eroareMembru;

    const { error: eroareProfil } = await admin
      .from("profiles")
      .update({ phone: input.owner_telefon, must_change_password: true })
      .eq("id", userNou.user.id);
    if (eroareProfil) throw eroareProfil;

    // Audit separat pentru crearea membrului — allow-list exclude parola.
    const antete = await headers();
    await ctx.supabase.rpc("log_audit_event", {
      p_action: "member_added",
      p_status: "success",
      p_organization_id: organizatie.id,
      p_entity_type: "organization_members",
      p_entity_id: userNou.user.id,
      p_before: null,
      p_after: { email: input.owner_email, role: "org_admin" },
      p_ip: antete.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      p_user_agent: antete.get("user-agent"),
      p_request_id: ctx.requestId,
      p_error_code: null,
    });

    return {
      id: organizatie.id,
      name: organizatie.name,
      slug: organizatie.slug,
      ownerEmail: input.owner_email,
      parolaTemporara,
    };
  },
});
```

- [ ] **Step 3: Verificare de tip**

Run: `pnpm typecheck`
Expected: fără erori în `organizatii/actions.ts` (rămân erori doar în `formular-organizatie-noua.tsx`, rezolvate în Task 9).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(platform)/super-admin/organizatii/actions.ts"
git commit -m "feat(organizatii): inroleazaOrganizatie creează organizația activă + reprezentant legal + owner"
```

---

## Task 8: Ecranul 1 — formularul de căutare CUI

**Files:**
- Create: `src/app/(platform)/super-admin/organizatii/_components/formular-cautare-cui.tsx`

**Interfaces:**
- Consumes: `cautaCuiAnaf` (Task 6), `cautaCuiAnafSchema` (Task 5), `RezultatCautareCui` (Task 6).
- Produces: componenta `FormularCautareCui`, props `{ onGasit: (rezultat: RezultatCautareCui) => void }`. Consumat de Task 10.

- [ ] **Step 1: Implementează**

```typescript
// src/app/(platform)/super-admin/organizatii/_components/formular-cautare-cui.tsx
"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { cautaCuiAnafSchema, type CautaCuiAnafInput } from "@/schemas/organization";
import { cautaCuiAnaf, type RezultatCautareCui } from "./../actions";

interface Proprietati {
  readonly onGasit: (rezultat: RezultatCautareCui) => void;
}

export function FormularCautareCui({ onGasit }: Proprietati) {
  const idFormular = useId();
  const [eroareServer, setEroareServer] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CautaCuiAnafInput>({ resolver: zodResolver(cautaCuiAnafSchema) });

  const trimite = handleSubmit(async (valori) => {
    setEroareServer(null);
    const rezultat = await cautaCuiAnaf(valori);
    if (!rezultat.ok) {
      setEroareServer(rezultat.error.message);
      return;
    }
    onGasit(rezultat.data);
  });

  return (
    <form onSubmit={trimite} noValidate className="max-w-md space-y-4">
      <div aria-live="assertive">
        {eroareServer && (
          <p role="alert" className="border-border bg-surface text-danger rounded-md border p-3 text-sm">
            {eroareServer}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${idFormular}-cui`} className="text-foreground block text-sm font-medium">
          CUI-ul companiei *
        </label>
        <input
          id={`${idFormular}-cui`}
          {...register("cui")}
          inputMode="text"
          placeholder="RO 14399840"
          autoFocus
          aria-invalid={Boolean(errors.cui)}
          aria-describedby={`${idFormular}-cui-ajutor`}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <p id={`${idFormular}-cui-ajutor`} className="text-muted-foreground mt-1 text-xs">
          Căutăm datele companiei la ANAF. Dacă nu sunt găsite, le completezi manual la pasul următor.
        </p>
        {errors.cui?.message && <p className="text-danger mt-1 text-sm">{errors.cui.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
      >
        {isSubmitting ? "Se caută…" : "Continuă"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verificare de tip**

Run: `pnpm typecheck`
Expected: fără erori în acest fișier.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(platform)/super-admin/organizatii/_components/formular-cautare-cui.tsx"
git commit -m "feat(organizatii): Ecranul 1 de înrolare — căutare CUI"
```

---

## Task 9: Ecranul 2 — extinde formularul de confirmare + cont owner

**Files:**
- Modify: `src/app/(platform)/super-admin/organizatii/_components/formular-organizatie-noua.tsx`

**Interfaces:**
- Consumes: `inroleazaOrganizatieSchema`, `InroleazaOrganizatieInput` (Task 5), `inroleazaOrganizatie`, `OrganizatieInrolata` (Task 7).
- Produces: componenta `FormularOrganizatieNoua` cu props extinse `{ valoriInitiale?: ValoriInitialeOrganizatie; onInrolata: (rezultat: OrganizatieInrolata) => void }` (înlocuiește navigarea internă cu `router.push`). Consumat de Task 10.

- [ ] **Step 1: Actualizează importurile din capul fișierului**

```typescript
import {
  inroleazaOrganizatieSchema,
  FORME_JURIDICE,
  JUDETE,
  PLANURI,
  type InroleazaOrganizatieInput,
} from "@/schemas/organization";
import { inroleazaOrganizatie, type OrganizatieInrolata } from "./../actions";
```

(Elimină `useRouter` din import — navigarea acum se face în componenta părinte din Task 10, prin `onInrolata`.)

- [ ] **Step 2: Actualizează semnătura componentei și trimiterea formularului**

```typescript
interface ProprietatiFormular {
  readonly valoriInitiale?: ValoriInitialeOrganizatie;
  readonly onInrolata: (rezultat: OrganizatieInrolata) => void;
}

export function FormularOrganizatieNoua({ valoriInitiale, onInrolata }: ProprietatiFormular) {
  const idFormular = useId();
  const [eroareServer, setEroareServer] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InroleazaOrganizatieInput>({
    resolver: zodResolver(inroleazaOrganizatieSchema),
    defaultValues: {
      plan: "trial",
      seats_limit: 10,
      platitor_tva: false,
      forma_juridica: "SRL",
      judet: "București",
      name: valoriInitiale?.name ?? "",
      slug: valoriInitiale?.slug ?? "",
      email_contact: valoriInitiale?.email_contact ?? "",
      telefon_contact: valoriInitiale?.telefon_contact ?? "",
      owner_email: valoriInitiale?.email_contact ?? "",
      owner_telefon: valoriInitiale?.telefon_contact ?? "",
    },
  });

  const trimite = handleSubmit(async (valori) => {
    setEroareServer(null);
    const rezultat = await inroleazaOrganizatie(valori);
    if (!rezultat.ok) {
      for (const [camp, mesaje] of Object.entries(rezultat.error.fieldErrors ?? {})) {
        const primul = mesaje[0];
        if (primul) setError(camp as keyof InroleazaOrganizatieInput, { type: "server", message: primul });
      }
      setEroareServer(rezultat.error.message);
      return;
    }
    onInrolata(rezultat.data);
  });
```

(Restul componentei — `areIdOrganizatie`, `Eroare`, `ValoriInitialeOrganizatie`, `claseCamp` — rămân neschimbate; `areIdOrganizatie` nu mai e folosit după eliminarea `router.push`, șterge-l.)

- [ ] **Step 3: Adaugă câmpurile fiscale noi în primul `fieldset` ("Date de identificare"), imediat după câmpul „Nr. registrul comerțului”**

```tsx
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-caen`} className="text-foreground block text-sm font-medium">
              Cod CAEN principal
            </label>
            <input
              id={`${idFormular}-caen`}
              {...register("cod_caen")}
              inputMode="numeric"
              placeholder="6201"
              aria-invalid={Boolean(errors.cod_caen)}
              aria-describedby={`${idFormular}-caen-ajutor`}
              className={claseCamp}
            />
            <p id={`${idFormular}-caen-ajutor`} className="text-muted-foreground mt-1 text-xs">
              Poate lipsi pentru PFA/II — lasă gol dacă nu-l ai la îndemână.
            </p>
            <Eroare id={`${idFormular}-caen-eroare`} mesaj={errors.cod_caen?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-capital`} className="text-foreground block text-sm font-medium">
              Capital social (RON) *
            </label>
            <input
              id={`${idFormular}-capital`}
              type="number"
              min={0}
              step="0.01"
              {...register("capital_social")}
              aria-invalid={Boolean(errors.capital_social)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-capital-eroare`} mesaj={errors.capital_social?.message} />
          </div>
        </div>
```

- [ ] **Step 4: Înlocuiește câmpul „Adresă” din fieldset-ul „Contact și sediu” cu stradă/număr/sector**

```tsx
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${idFormular}-strada`} className="text-foreground block text-sm font-medium">
              Stradă *
            </label>
            <input
              id={`${idFormular}-strada`}
              {...register("strada")}
              aria-invalid={Boolean(errors.strada)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-strada-eroare`} mesaj={errors.strada?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-numar`} className="text-foreground block text-sm font-medium">
              Număr *
            </label>
            <input
              id={`${idFormular}-numar`}
              {...register("numar")}
              aria-invalid={Boolean(errors.numar)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-numar-eroare`} mesaj={errors.numar?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-sector`} className="text-foreground block text-sm font-medium">
              Sector (doar București)
            </label>
            <input
              id={`${idFormular}-sector`}
              {...register("sector")}
              placeholder="Sector 1"
              aria-invalid={Boolean(errors.sector)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-sector-eroare`} mesaj={errors.sector?.message} />
          </div>
        </div>
        <div>
          <label htmlFor={`${idFormular}-adresa`} className="text-foreground block text-sm font-medium">
            Detalii adresă (bloc, etaj, birou)
          </label>
          <input id={`${idFormular}-adresa`} {...register("adresa")} className={claseCamp} />
        </div>
```

(Elimină vechiul câmp unic „Adresă” care exista aici înainte.)

- [ ] **Step 5: Adaugă funcția + CNP-ul reprezentantului, imediat sub câmpul „Reprezentant legal” existent — dacă acel câmp nu există încă în fieldset-ul „Contact și sediu”, adaugă-l pe amândouă acolo**

```tsx
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-reprezentant`} className="text-foreground block text-sm font-medium">
              Reprezentant legal
            </label>
            <input
              id={`${idFormular}-reprezentant`}
              {...register("reprezentant_legal")}
              placeholder="Ion Popescu"
              className={claseCamp}
            />
          </div>
          <div>
            <label htmlFor={`${idFormular}-functie`} className="text-foreground block text-sm font-medium">
              Funcție *
            </label>
            <input
              id={`${idFormular}-functie`}
              {...register("reprezentant_functie")}
              list={`${idFormular}-functii`}
              placeholder="Administrator"
              aria-invalid={Boolean(errors.reprezentant_functie)}
              className={claseCamp}
            />
            <datalist id={`${idFormular}-functii`}>
              <option value="Administrator" />
              <option value="Director General" />
              <option value="Președinte" />
            </datalist>
            <Eroare id={`${idFormular}-functie-eroare`} mesaj={errors.reprezentant_functie?.message} />
          </div>
        </div>
        <div>
          <label htmlFor={`${idFormular}-cnp`} className="text-foreground block text-sm font-medium">
            CNP reprezentant (opțional)
          </label>
          <input
            id={`${idFormular}-cnp`}
            {...register("reprezentant_cnp")}
            inputMode="numeric"
            aria-invalid={Boolean(errors.reprezentant_cnp)}
            aria-describedby={`${idFormular}-cnp-ajutor`}
            className={claseCamp}
          />
          <p id={`${idFormular}-cnp-ajutor`} className="text-muted-foreground mt-1 text-xs">
            Poate fi completat oricând ulterior din fișa organizației. Se stochează criptat.
          </p>
          <Eroare id={`${idFormular}-cnp-eroare`} mesaj={errors.reprezentant_cnp?.message} />
        </div>
```

- [ ] **Step 6: Adaugă un `fieldset` nou „Cont proprietar”, între „Contact și sediu” și „Abonament”**

```tsx
      <fieldset className="border-border space-y-4 rounded-lg border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Cont proprietar</legend>
        <p className="text-muted-foreground text-xs">
          Persoana de mai jos devine automat administratorul (owner) organizației, cu o parolă
          temporară afișată o singură dată după creare.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idFormular}-owner-nume`} className="text-foreground block text-sm font-medium">
              Nume complet *
            </label>
            <input
              id={`${idFormular}-owner-nume`}
              {...register("owner_nume")}
              aria-invalid={Boolean(errors.owner_nume)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-owner-nume-eroare`} mesaj={errors.owner_nume?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-owner-email`} className="text-foreground block text-sm font-medium">
              Email de business *
            </label>
            <input
              id={`${idFormular}-owner-email`}
              type="email"
              {...register("owner_email")}
              aria-invalid={Boolean(errors.owner_email)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-owner-email-eroare`} mesaj={errors.owner_email?.message} />
          </div>
          <div>
            <label htmlFor={`${idFormular}-owner-telefon`} className="text-foreground block text-sm font-medium">
              Telefon *
            </label>
            <input
              id={`${idFormular}-owner-telefon`}
              type="tel"
              {...register("owner_telefon")}
              placeholder="0721 234 567"
              aria-invalid={Boolean(errors.owner_telefon)}
              className={claseCamp}
            />
            <Eroare id={`${idFormular}-owner-telefon-eroare`} mesaj={errors.owner_telefon?.message} />
          </div>
        </div>
      </fieldset>
```

- [ ] **Step 7: Actualizează textul butonului de trimitere**

```tsx
          {isSubmitting ? "Se înrolează…" : "Înrolează organizația"}
```

- [ ] **Step 8: Verificare de tip**

Run: `pnpm typecheck`
Expected: fără erori în `formular-organizatie-noua.tsx`.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(platform)/super-admin/organizatii/_components/formular-organizatie-noua.tsx"
git commit -m "feat(organizatii): Ecranul 2 — CAEN, capital social, adresă structurată, reprezentant, cont owner"
```

---

## Task 10: Orchestrarea pașilor + ecranul de succes cu parola temporară

**Files:**
- Create: `src/app/(platform)/super-admin/organizatii/_components/inrolare-organizatie.tsx`
- Modify: `src/app/(platform)/super-admin/organizatii/nou/page.tsx`

**Interfaces:**
- Consumes: `FormularCautareCui` (Task 8), `FormularOrganizatieNoua` (Task 9), `RezultatCautareCui` (Task 6), `OrganizatieInrolata` (Task 7).
- Produces: componenta `InrolareOrganizatie`, props `{ valoriInitiale?: ValoriInitialeOrganizatie }`.

- [ ] **Step 1: Implementează wrapper-ul de pași**

```typescript
// src/app/(platform)/super-admin/organizatii/_components/inrolare-organizatie.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormularCautareCui } from "./formular-cautare-cui";
import {
  FormularOrganizatieNoua,
  type ValoriInitialeOrganizatie,
} from "./formular-organizatie-noua";
import type { RezultatCautareCui, OrganizatieInrolata } from "./../actions";

type Pas =
  | Readonly<{ nume: "cui" }>
  | Readonly<{ nume: "confirmare"; cautare: RezultatCautareCui }>
  | Readonly<{ nume: "succes"; rezultat: OrganizatieInrolata }>;

interface Proprietati {
  readonly valoriInitiale?: ValoriInitialeOrganizatie;
}

export function InrolareOrganizatie({ valoriInitiale }: Proprietati) {
  const router = useRouter();
  const [pas, setPas] = useState<Pas>({ nume: "cui" });

  if (pas.nume === "cui") {
    return <FormularCautareCui onGasit={(cautare) => setPas({ nume: "confirmare", cautare })} />;
  }

  if (pas.nume === "confirmare") {
    const { anaf } = pas.cautare;
    const valoriDinAnaf: ValoriInitialeOrganizatie = {
      name: anaf?.denumire ?? valoriInitiale?.name ?? "",
      slug: valoriInitiale?.slug ?? "",
      email_contact: valoriInitiale?.email_contact ?? "",
      telefon_contact: valoriInitiale?.telefon_contact ?? "",
    };
    return (
      <FormularOrganizatieNoua
        valoriInitiale={valoriDinAnaf}
        onInrolata={(rezultat) => setPas({ nume: "succes", rezultat })}
      />
    );
  }

  const { rezultat } = pas;
  return (
    <div className="border-border bg-surface max-w-md space-y-4 rounded-lg border p-6">
      <h2 className="text-foreground text-lg font-semibold">
        Organizația „{rezultat.name}” a fost înrolată
      </h2>
      <p className="text-muted-foreground text-sm">
        Comunică parola temporară de mai jos proprietarului ({rezultat.ownerEmail}). Va fi obligat
        să și-o schimbe la primul login — nu mai poate fi afișată din nou după ce părăsești
        această pagină.
      </p>
      <p className="border-border bg-background rounded-md border p-3 font-mono text-sm break-all">
        {rezultat.parolaTemporara}
      </p>
      <button
        type="button"
        onClick={() => router.push(`/super-admin/organizatii/${rezultat.id}`)}
        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium"
      >
        Am notat parola, continuă
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Actualizează `nou/page.tsx` să randeze wrapper-ul nou**

Înlocuiește în `src/app/(platform)/super-admin/organizatii/nou/page.tsx`:

```typescript
import { FormularOrganizatieNoua } from "../_components/formular-organizatie-noua";
```

cu:

```typescript
import { InrolareOrganizatie } from "../_components/inrolare-organizatie";
```

și înlocuiește blocul final:

```tsx
      {valoriInitiale === undefined ? (
        <FormularOrganizatieNoua />
      ) : (
        <FormularOrganizatieNoua valoriInitiale={valoriInitiale} />
      )}
```

cu:

```tsx
      <InrolareOrganizatie {...(valoriInitiale === undefined ? {} : { valoriInitiale })} />
```

Actualizează și paragraful din `<header>` (textul „Organizația se creează în starea «În așteptare»...”) — nu mai e adevărat:

```tsx
        <p className="text-muted-foreground mt-1 text-sm">
          Căutăm CUI-ul la ANAF, apoi confirmi datele și creezi contul proprietarului. Organizația
          devine activă imediat, cu modulele de bază pornite.
        </p>
```

- [ ] **Step 3: Verificare de tip**

Run: `pnpm typecheck`
Expected: fără erori.

- [ ] **Step 4: Test manual — parcurge fluxul complet în browser**

Run: `pnpm dev`, apoi în browser: `/super-admin/organizatii/nou` (autentificat ca platform admin).
- Introdu un CUI valid (ex. `14399840`) → verifică trecerea la Ecranul 2 (cu sau fără date pre-completate, funcție de disponibilitatea ANAF în mediul de test).
- Completează câmpurile obligatorii noi (capital social, stradă, număr, funcție reprezentant, cont owner) → trimite.
- Confirmă ecranul de succes cu parola afișată o singură dată, apoi navigarea la fișa organizației.
- Repetă cu un CUI deja existent în bază → confirmă mesajul de conflict la Ecranul 1, înainte de a ajunge la Ecranul 2.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(platform)/super-admin/organizatii/_components/inrolare-organizatie.tsx" \
        "src/app/(platform)/super-admin/organizatii/nou/page.tsx"
git commit -m "feat(organizatii): orchestrare Ecran 1 -> Ecran 2 -> succes, cu parolă temporară afișată o singură dată"
```

---

## Task 11: Poarta „schimbă parola la primul login”

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(auth)/parola-noua/actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase` din `@/lib/supabase/server` (Task 11 adaugă acest import în `layout.tsx`).

- [ ] **Step 1: Scrie testul manual de regresie înainte de a modifica (document, nu cod automat — nu există infrastructură de test pentru Server Components în acest repo)**

Notează comportamentul actual: un utilizator normal (fără `must_change_password`) trebuie să ajungă direct pe `/panou` după login, neschimbat de acest task.

- [ ] **Step 2: Adaugă poarta în `(app)/layout.tsx`**

```typescript
// adaugă lângă celelalte importuri din src/app/(app)/layout.tsx
import { createServerSupabase } from "@/lib/supabase/server";
```

```typescript
async function requireTenant(): Promise<{ user: AuthUser; tenant: Tenant }> {
  const rezolvare = await resolveTenant();
  switch (rezolvare.status) {
    case "ok": {
      const supabase = await createServerSupabase();
      const { data: profil } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", rezolvare.user.id)
        .maybeSingle();
      if (profil?.must_change_password) {
        redirect("/parola-noua");
      }
      return { user: rezolvare.user, tenant: rezolvare.tenant };
    }
    case "neautentificat":
      redirect("/autentificare");
    case "fara_organizatie":
    case "alegere_necesara":
      redirect("/alege-organizatia");
  }
}
```

- [ ] **Step 3: Curăță flag-ul după schimbarea parolei, în `parola-noua/actions.ts`**

```typescript
export async function seteazaParolaNoua(formData: FormData): Promise<void> {
  const validat = parolaNouaSchema.safeParse({
    parola: formData.get("parola"),
    confirmare: formData.get("confirmare"),
  });
  if (!validat.success) {
    const primul = validat.error.issues[0];
    const cod = primul?.path[0] === "confirmare" ? "confirmare" : "parola";
    redirect(`/parola-noua?eroare=${cod}`);
  }

  const supabase = await createServerSupabase();

  const { data: sesiune } = await supabase.auth.getUser();
  if (!sesiune.user) redirect("/autentificare?eroare=sesiune");

  const { error } = await supabase.auth.updateUser({ password: validat.data.parola });
  if (error) redirect("/parola-noua?eroare=refuzata");

  const { error: eroareProfil } = await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", sesiune.user.id);
  if (eroareProfil) {
    console.error("[parola-noua] nu s-a putut curăța must_change_password", eroareProfil.message);
  }

  redirect(RUTA_DUPA_AUTENTIFICARE);
}
```

- [ ] **Step 4: Verificare de tip**

Run: `pnpm typecheck`
Expected: fără erori.

- [ ] **Step 5: Test manual — creează o organizație prin fluxul din Task 10, apoi autentifică-te cu owner-ul și parola temporară**

Run: `pnpm dev`.
- Autentifică-te la `/autentificare` cu email-ul owner-ului și parola temporară afișată la Task 10.
- Confirmă redirecționarea automată la `/parola-noua`, NU la `/panou`.
- Setează o parolă nouă → confirmă redirecționarea la `/panou` de data asta.
- Delogează-te, reautentifică-te cu parola nouă → confirmă că NU mai apare gate-ul `/parola-noua`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/layout.tsx" "src/app/(auth)/parola-noua/actions.ts"
git commit -m "feat(auth): blochează accesul până la schimbarea parolei temporare de înrolare"
```

---

## Task 12: Fișa organizației — afișează câmpurile noi

**Files:**
- Modify: `src/app/(platform)/super-admin/organizatii/actions.ts` (funcția `fisaOrganizatiei`)
- Modify: `src/app/(platform)/super-admin/organizatii/[orgId]/page.tsx`

**Interfaces:**
- Consumes: `cnpMascatReprezentant` din `@/lib/crypto/organization-sensitive-data` (Task 4).

- [ ] **Step 1: Extinde selecția de coloane și adaugă citirea reprezentantului legal în `fisaOrganizatiei`**

În `src/app/(platform)/super-admin/organizatii/actions.ts`, adaugă `cod_caen, capital_social, strada, numar, sector, reprezentant_functie` la lista de coloane selectate din `organizations` (constanta lungă din `fisaOrganizatiei`), și adaugă o interogare nouă pentru reprezentant:

```typescript
import { cnpMascatReprezentant } from "@/lib/crypto/organization-sensitive-data";
```

```typescript
  const [
    { data: membri },
    { data: module },
    { data: catalogModule },
    { count: invitatiiInAsteptare },
    { data: reprezentant },
  ] = await Promise.all([
    // ...cele patru interogări existente, neschimbate...
    admin
      .from("organization_legal_representative")
      .select("nume, functie, cnp_last4")
      .eq("organization_id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
```

Adaugă în obiectul returnat de `fisaOrganizatiei`:

```typescript
    reprezentant: reprezentant
      ? {
          nume: reprezentant.nume,
          functie: reprezentant.functie,
          cnpMascat: cnpMascatReprezentant(reprezentant.cnp_last4),
        }
      : null,
```

- [ ] **Step 2: Afișează câmpurile noi în `[orgId]/page.tsx`**

Înlocuiește rândul `Sediu` existent și adaugă rânduri noi în secțiunea „Date de identificare”:

```tsx
            <Rand
              eticheta="Sediu"
              valoare={[
                [organizatie.strada, organizatie.numar].filter(Boolean).join(" nr. "),
                organizatie.sector,
                organizatie.oras,
                organizatie.judet,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <Rand eticheta="Cod CAEN" valoare={organizatie.cod_caen} />
            <Rand
              eticheta="Capital social"
              valoare={
                organizatie.capital_social !== null
                  ? `${organizatie.capital_social.toLocaleString("ro-RO")} RON`
                  : null
              }
            />
```

Adaugă o secțiune nouă „Reprezentant legal”, lângă secțiunea „Membri”:

```tsx
        <section aria-labelledby="titlu-reprezentant" className="border-border rounded-lg border p-4">
          <h2
            id="titlu-reprezentant"
            className="text-muted-foreground mb-2 text-sm font-medium tracking-wide uppercase"
          >
            Reprezentant legal
          </h2>
          <dl>
            <Rand eticheta="Nume" valoare={fisa.reprezentant?.nume ?? null} />
            <Rand eticheta="Funcție" valoare={fisa.reprezentant?.functie ?? null} />
            <Rand eticheta="CNP" valoare={fisa.reprezentant?.cnpMascat ?? null} />
          </dl>
        </section>
```

(Destructurează `reprezentant` din `fisa` lângă `organizatie, membri, module, membriActivi, invitatiiInAsteptare` la începutul componentei.)

- [ ] **Step 3: Verificare de tip**

Run: `pnpm typecheck`
Expected: fără erori.

- [ ] **Step 4: Test manual**

Run: `pnpm dev`, deschide fișa organizației create la Task 10 → confirmă că CAEN, capital social, adresa structurată și reprezentantul legal (cu CNP mascat, dacă a fost introdus) apar corect.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(platform)/super-admin/organizatii/actions.ts" \
        "src/app/(platform)/super-admin/organizatii/[orgId]/page.tsx"
git commit -m "feat(organizatii): afișează CAEN, capital social, adresă structurată și reprezentant legal în fișa organizației"
```

---

## Task 13: Suită completă + verificare finală

**Files:** niciunul nou — rulează verificarea de capăt asupra întregii lucrări.

- [ ] **Step 1: Rulează suita unitară completă**

Run: `pnpm test`
Expected: PASS pentru toate testele, inclusiv cele noi din Task 2 și Task 4.

- [ ] **Step 2: Rulează typecheck, lint și format pe tot proiectul**

Run: `pnpm typecheck && pnpm lint && pnpm format:check`
Expected: fără erori.

- [ ] **Step 3: Rulează suita RLS (necesită proiectul Supabase de test dedicat, cu migrația din Task 1 deja aplicată)**

Run: `pnpm test:rls`
Expected: PASS. Dacă mediul de execuție nu are acces la proiectul de test, marchează explicit acest pas ca neexecutat și cere-i utilizatorului să-l ruleze înainte de merge — nu presupune că trece.

- [ ] **Step 4: Verificare manuală finală de capăt la capăt (dacă nu a fost deja făcută în Task 10/11/12)**

Parcurge din nou fluxul complet: CUI → confirmare → cont owner → parolă temporară → login owner → schimbare parolă obligatorie → fișa organizației cu toate câmpurile noi vizibile.

- [ ] **Step 5: Commit final (dacă a mai rămas ceva nesalvat)**

```bash
git status --short
```

Dacă apare ceva neașteptat, investighează înainte de a-l adăuga — nu rula `git add -A` orb.
