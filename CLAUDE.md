@AGENTS.md

# Administrativo — regulile proiectului

ERP/HR multi-tenant românesc. Next.js 16.3 · React 19.2 · Zod 4 · Tailwind v4 ·
Supabase Postgres 17 · pnpm 10 · 22 module.
Izolarea între firme-client se face prin **RLS FORCED**, nu prin filtre de
aplicație. Cod, comentarii, mesaje și identificatori de domeniu: **în română**,
cu ș/ț cu virgulă dedesubt (U+0219/U+021B), nu cu sedilă.

> Numărul de migrări, de Server Actions și de capcane NU se scrie aici: se
> schimbă la fiecare livrare și îmbătrânește tăcut — antetul ăsta a stat pe „43
> migrări" cât timp pe disc erau 47. Cifrele vin calculate la fiecare sesiune,
> din hook-ul `SessionStart` al plugin-ului
> (`.claude/skills/administrativo/hooks/digest.mjs`). Pentru o numărătoare pe
> loc: `ls supabase/migrations/*.sql | wc -l`.

## Înainte de orice sarcină pe un modul

Citește `.claude/docs/modul/<numele directorului din src/app/(app)/>.md` — **în locul**
sweep-ului prin cod, nu pe lângă el. Pagina spune ce refuză baza tăcut, ce permisiune
păzește fiecare rută și ce se mișcă împreună. Plafon: **12 KB de vault per sarcină**,
adică două pagini, nu cinci.

Dacă pagina lipsește sau e marcată învechită, **spune asta explicit înainte de a scrie
cod**, și citește diff-ul enumerat de hook (`git diff <scris_pe> -- <fișierele numite>`),
niciodată tot modulul. Convențiile vault-ului: `.claude/docs/meta/conventii.md`.

## Verificarea

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm verify` = typecheck + **check:server** + lint + format:check + test.
**NU include `build`.**

Build-ul rămâne singurul care prinde granița server/client în general — dar
cazul care a costat cel mai mult, un fișier `"use server"` care exportă o
constantă, are de la 5 sept 2026 poartă proprie: `pnpm check:server`
(`scripts/checks/use-server-exports.mjs`). O prinde în două secunde, cu fișier
și linie, în loc de trei minute și un jurnal de „Collecting page data" —
fiindcă `tsc`, `eslint` ȘI `vitest` tac toate trei. Vezi capcana 39.
Numărătoarea pe loc: `grep -rl '^"use server"' src/ | wc -l`.

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

- `employee` are `employees:read = own` — își vede propria fișă, dar numai pe a
  lui (mutat de `0023_portal_angajat.sql:51`, de la `none`; CNP/IBAN rămân
  închise, `hr_read_sensitive` cere `= all` exact).
- `manager` are `attendance:approve=team` dar **nu** `attendance:create`; are
  `per_diem:approve` dar **nu** `per_diem:update`; **niciun** `vehicles:*`.
- `hr` administrează SSM dar n-are `compliance:read` — `expirables` îi întoarce
  zero rânduri, fără eroare. N-are niciun `users:*`.

Un UPDATE respins de clauza `USING` afectează **zero rânduri, fără eroare** —
orice tranziție face `.select()` după `.update()` și tratează rezultatul gol
drept CONFLICT.

## Unde e restul

- `docs/design/ecrane/capcane.md` — capcane verificate empiric (numărul se
  schimbă; `grep -cE '^[0-9]+\. ' docs/design/ecrane/capcane.md`).
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

**Munca se termină cu push, nu cu „gata".** La finalul oricărei sarcini, comite și
împinge ce ai făcut — altfel rămâne doar pe discul unei mașini pe care lucrează și
altcineva, iar următoarea sesiune o pierde sau o calcă. Ritualul, în ordine:

```bash
git status --short -- <căile tale>      # doar ale tale, niciodată tot
git fetch origin main
git diff --name-only HEAD origin/main   # se suprapune cu ce ai atins?
git commit --only -- <căile tale>       # `--only`, fiindcă indexul e partajat
git merge origin/main                   # merge, nu rebase
git push origin main
```

Excepții, singurele: utilizatorul a cerut explicit să nu comiți, sau lanțul de
verificare e roșu **din cauza ta** (o roșeață preexistentă, în fișiere pe care nu
le-ai atins, nu te oprește — spui că e acolo și mergi mai departe).

## Datorie cunoscută (nu o redescoperi)

- Zero teste pe `src/lib/actions/`, `src/lib/queries/` și pagini — `PROGRESS.md`
  o numește blocajul #3: „fiecare defect real a scăpat exact de aici”.
- `plpgsql_check` n-a rulat niciodată pe migrările de după `0006`.
- `pnpm test:e2e` e declarat, dar nu există niciun `*.spec.ts` și niciun
  `playwright.config`.
- `employee_change_requests` nu a fost construit niciodată.
