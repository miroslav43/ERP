# Administrativo — context de sesiune (încărcat automat)

ERP/HR multi-tenant românesc. Next.js 16.3 · React 19.2 · Zod 4 · Supabase
Postgres 17 · {{migrari}} migrări · 22 module · {{actiuni}} Server Actions · RLS FORCED peste tot.
Cod, comentarii, mesaje și identificatori de domeniu: **în română**, cu ș/ț cu
virgulă dedesubt (U+0219/U+021B), nu cu sedilă. Mesajele de eroare se termină cu punct.

## Verificarea reală

`pnpm verify` = typecheck + lint + format:check + test. **NU include build.**
Numai `pnpm build` prinde un fișier `"use server"` care exportă o constantă.
Lanțul complet: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
Migrările se aplică prin **`psql`**, byte-exact (NOTES.md §1) — NICI prin
`supabase db push`, NICI prin `apply_migration`. MCP-ul e pentru inspecție.

## Cele 5 roluri și ce refuză baza tăcut

`super_admin` (NICIODATĂ în `organization_members` — sursa e `platform_admins`) ·
`org_admin` · `manager` · `hr` · `employee`.

- `employee` are `employees:read = none` — nu-și vede nici propria fișă.
- `manager` are `attendance:approve=team` dar **nu** `attendance:create`; are
  `per_diem:approve` dar **nu** `per_diem:update`; **niciun** `vehicles:*`.
- `hr` administrează SSM dar **nu** are `compliance:read` — `expirables` îi
  întoarce zero rânduri, fără eroare. N-are niciun `users:*`.
  Absența unei permisiuni = refuz explicit. Un UPDATE respins de `USING` afectează
  **zero rânduri, fără eroare** — orice tranziție face `.select()` după `.update()`.

## Tipare mecanice (copiază din vecin, nu din memorie)

- Acțiune: `createAction`, 8 straturi, Zod **după** authz; `revalidate:` se
  DECLARĂ, nu se cheamă `revalidatePath()` din handler.
  Referință: `src/lib/actions/create-action.ts`.
- Migrare: scheletul e `supabase/migrations/0013_attendance.sql`; indexuri
  **parțiale** `where deleted_at is null`; trio `_select/_insert/_update`;
  **nicio politică DELETE**; `search_path = ''`; granturi în bucla `do $$`.
- Citiri: `src/lib/queries/*.ts`, funcții libere, `organizationId` primul
  argument, cursor keyset base64url (nu `.range()`); `max_rows = 1000`
  TRUNCHIAZĂ TĂCUT. Referință: `src/lib/queries/employees.ts`.
- Formular client: `useTransition` + `FormData` + `useId`. **react-hook-form
  apare în doar 4 fișiere din 118** — nu e implicit.
- `createAdminSupabase()`: doar `actions.ts`, `api/**/route.ts`,
  `rate-limit.ts`, `scripts/**`, `tests/**` (ESLint `no-restricted-imports`).
- `.rpc()` nu ajunge la schema `app` — PostgREST expune doar `public`.

## Unde e restul

`docs/design/ecrane/capcane.md` — **{{capcane}}** de capcane · `NOTES.md` (decizii +
valori legale ⚠ de confirmat de contabil) · `docs/claude-setup.md` ·
`PROGRESS.md` (istoricul defectelor) · `tests/rls/izolare.sql` verificarea `(l)`.
Căutare rapidă: `node .claude/skills/administrativo/scripts/capcana.mjs <cod|--tabela X|--rol Y>`.

## Politica de agenți

Istoricul acestui repo: 6 agenți paraleli au produs 91 de erori de compilare din
căi de import inventate; agenții de construcție au murit la limita de sesiune pe
4 faze, cu zero cod livrat. Agenții din `administrativo` sunt înguști și
**opt-in**. Nu porni un fan-out de implementare.
