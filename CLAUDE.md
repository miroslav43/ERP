@AGENTS.md

# Administrativo — regulile proiectului

ERP/HR multi-tenant românesc. Next.js 16.3 · React 19.2 · Zod 4 · Tailwind v4 ·
Supabase Postgres 17 · pnpm 10 · 43 migrări · 22 module · 118 Server Actions.
Izolarea între firme-client se face prin **RLS FORCED**, nu prin filtre de
aplicație. Cod, comentarii, mesaje și identificatori de domeniu: **în română**,
cu ș/ț cu virgulă dedesubt (U+0219/U+021B), nu cu sedilă.

## Verificarea

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm verify` = typecheck + lint + format:check + test. **NU include `build`.**
Build-ul e singurul care prinde granița server/client — de exemplu un fișier
`"use server"` care exportă o constantă (Next refuză build-ul, `tsc` tace).
Sunt 42 de fișiere `"use server"` în `src/`.

Nu declara nimic „gata” fără ieșirea comenzilor. În Faza 2, proiectul a fost
comis ca livrat în timp ce un `org_admin` nu putea insera un angajat: treceau
typecheck, lint, 175 de teste, cele trei bariere SQL și izolarea 11/11.
_„Verificam că nimeni nu vede ce nu are voie, dar nu și că cine are voie poate
lucra.”_

## Agenți

Memoria proiectului spune **fără agenți**: 6 agenți paraleli au produs 91 de
erori de compilare, aproape toate din căi de import inventate; în patru faze
agenții de construcție au murit la limita de sesiune cu zero cod livrat.
Implementarea e directă, cu `Write`/`Edit`.

Excepție: agenții din `.claude/skills/administrativo/agents/` sunt înguști și
opt-in — `erp-migrare-rls`, `erp-actiuni`, `erp-citiri`, `erp-ui` (scriu, maximum
4 fișiere fiecare) și `erp-santinela-tenant` (read-only, reviewer adversarial).
**Niciodată un fan-out de implementare.**

## Migrări

Se aplică prin **`psql`, byte-exact** (`NOTES.md` §1 dă comanda prin pooler).
NICI `supabase db push`, NICI `mcp__supabase__apply_migration`: ambele cer ca
SQL-ul să treacă prin model ca text, iar 104 KB de DDL retranscris e exact locul
erorii subtile. MCP-ul rămâne pentru inspecție (`execute_sql`, `list_migrations`,
`get_advisors`, `generate_typescript_types`).

Forward-only: nu se editează niciodată o migrare deja aplicată pe cloud.
Aplicarea pe producție cere confirmarea explicită a utilizatorului — un „da”
anterior nu acoperă o migrare nouă.

Banca locală: `bash .claude/skills/administrativo/scripts/banc-migrare.sh`
(container `postgres:17-alpine` efemer, identic cu CI).

## Cele 6 tipare mecanice — citește referința, nu reproduce din memorie

| Strat           | Referință canonică                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server Action   | `src/lib/actions/create-action.ts` — 8 straturi, Zod **după** authz; `revalidate:` se DECLARĂ, nu se cheamă `revalidatePath()` din handler                                                                          |
| Migrare + RLS   | `supabase/migrations/0013_attendance.sql` — 16 secțiuni, indexuri **parțiale** `where deleted_at is null`, trio `_select/_insert/_update`, **nicio politică DELETE**, `search_path = ''`, granturi în bucla `do $$` |
| Citiri          | `src/lib/queries/employees.ts` — funcții libere, `organizationId` primul argument, cursor keyset (nu `.range()`); `max_rows = 1000` TRUNCHIAZĂ TĂCUT                                                                |
| Pagină          | `src/app/(app)/anunturi/page.tsx` — `requireTenant` → `requireFeature` → `getPermissionMap` → `can()` → `AccesRestrictionat`                                                                                        |
| Formular client | `useTransition` + `FormData` + `useId`. **react-hook-form apare în 4 fișiere din 118** — nu e implicitul                                                                                                            |
| Permisiuni      | `src/config/permissions.ts` (uniune literală) + seed-ul din `0002_authz.sql` (sursa de adevăr)                                                                                                                      |

`createAdminSupabase()` e permis de ESLint doar în `actions.ts`,
`api/**/route.ts`, `rate-limit.ts`, `scripts/**`, `tests/**` — cu comentariu
care spune DE CE ocolești RLS și cu filtru explicit pe `organization_id`.

`.rpc()` nu ajunge la schema `app` — PostgREST expune doar `public`.

## Cele 5 roluri și ce refuză baza tăcut

`super_admin` (NICIODATĂ în `organization_members`; sursa e `platform_admins`) ·
`org_admin` · `manager` · `hr` · `employee`. Absența unei permisiuni = refuz.

- `employee` are `employees:read = none` — nu-și vede nici propria fișă.
- `manager` are `attendance:approve=team` dar **nu** `attendance:create`; are
  `per_diem:approve` dar **nu** `per_diem:update`; **niciun** `vehicles:*`.
- `hr` administrează SSM dar n-are `compliance:read` — `expirables` îi întoarce
  zero rânduri, fără eroare. N-are niciun `users:*`.

Un UPDATE respins de clauza `USING` afectează **zero rânduri, fără eroare** —
orice tranziție face `.select()` după `.update()` și tratează rezultatul gol
drept CONFLICT.

## Unde e restul

- `docs/design/ecrane/capcane.md` — **36 de capcane** verificate empiric.
  Caută în ele: `node .claude/skills/administrativo/scripts/capcana.mjs <cod|--tabela X|--rol Y|--tacute>`
- `tests/rls/izolare.sql` verificarea `(l)` — singura poartă POZITIVĂ din proiect
  („politicile nu blochează scrierile legitime”). Acoperă azi un singur rol.
- `NOTES.md` — decizii de arhitectură + valorile legale ⚠️ de confirmat de
  contabil/jurist înainte de calcul real.
- `PROGRESS.md` — istoricul defectelor (parțial învechit ca stare curentă).
- `docs/project-overview.md` §7 — rețeta de modul nou.

## Sesiuni concurente

Repo-ul a fost lucrat în paralel de mai multe sesiuni și persoane.
`git status --short` înainte de orice `git add` — niciodată `-A` sau `.` orb.
`git fetch origin main` înainte de push. La coliziune de nume de migrare îți
redenumești **propria** migrare. `git merge`, nu rebase.

## Datorie cunoscută (nu o redescoperi)

- Zero teste pe `src/lib/actions/`, `src/lib/queries/` și pagini — `PROGRESS.md`
  o numește blocajul #3: „fiecare defect real a scăpat exact de aici”.
- `plpgsql_check` n-a rulat niciodată pe migrările de după `0006`.
- `pnpm test:e2e` e declarat, dar nu există niciun `*.spec.ts` și niciun
  `playwright.config`.
- `employee_change_requests` nu a fost construit niciodată.
