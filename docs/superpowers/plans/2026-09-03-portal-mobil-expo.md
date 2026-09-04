# Portalul de angajat ca aplicație publicată — plan de implementare

> **Pentru executanți agentici:** SUB-SKILL OBLIGATORIU: folosește
> `superpowers:subagent-driven-development` (recomandat) sau
> `superpowers:executing-plans` ca să implementezi planul sarcină cu sarcină.
> Pașii folosesc casete (`- [ ]`) pentru urmărire.

**Scop:** Portalul de angajat devine aplicație publicată în Play Store și App
Store, ca înveliș Expo peste portalul web existent, cu notificări push reale.

**Arhitectură:** O aplicație Expo minimă afișează `administrativo.ro/portal/*`
într-un WebView și adaugă nativ doar ce lipsește la nivel de platformă: push,
lacăt biometric, scanner QR, descărcări și tipărire. Push-ul pleacă dintr-un
declanșator pe `public.notifications` — punctul prin care trec deja toate cele 22
de module — într-o coadă golită de un timer systemd de pe VM.

**Stivă:** Expo SDK + EAS Build · `react-native-webview` · `expo-notifications` ·
`expo-local-authentication` · `expo-camera` · `expo-print` · `expo-sharing` ·
Postgres 17 · Next.js 16.3 Route Handlers · Vitest.

**Specificație:** `docs/superpowers/specs/2026-09-03-portal-mobil-expo-design.md`

---

## Corecție față de specificație — a se citi înainte de Task 1

Specificația, §5.5, propunea `pg_cron` + `pg_net` pentru golirea cozii.
**Nu se aplică.** `src/app/api/reges/reconciliere/route.ts:29` spune explicit, în
comentariu: _„`pg_net` nu e activat pe instanța noastră. Un job SQL n-are cum să
facă apelul."_

Tiparul din casă, care funcționează deja în producție, e un **timer systemd pe
VM** care cheamă ruta cu `Authorization: Bearer` — vezi
`deploy/reges-reconciliere.{service,timer}`. Planul îl urmează. Task 6 îl
construiește; secțiunea 5.5 din specificație rămâne istoric, nu instrucțiune.

---

## Constrângeri globale

Se aplică la fiecare sarcină, fără repetare:

- **Limba:** cod, comentarii, mesaje, identificatori de domeniu — în română, cu
  `ș`/`ț` cu **virgulă dedesubt** (U+0219 / U+021B), nu cu sedilă. Mesajele de
  eroare se termină cu punct.
- **Migrări:** se aplică prin `psql`, **byte-exact**. NICI `supabase db push`,
  NICI `mcp__supabase__apply_migration`. Forward-only: o migrare deja aplicată pe
  cloud nu se editează niciodată. Aplicarea pe producție cere confirmarea
  explicită a utilizatorului, de fiecare dată.
- **Numărul migrării:** `0122` e presupunerea de la scrierea planului. Se
  reconfirmă la implementare: `ls supabase/migrations/*.sql | tail -3`. La
  coliziune decide `internal.migrari_aplicate` — se mută migrarea **neaplicată**.
- **Lanțul de verificare:** `pnpm typecheck && pnpm lint && pnpm test`.
  **NU se rulează `pnpm build`** — cerință explicită și repetată a
  utilizatorului. La final se spune ce rămâne de prins de build (granița
  server/client în fișierele noi).
- **`createAdminSupabase()`** e permis de ESLint doar în `actions.ts`,
  `api/**/route.ts`, `rate-limit.ts`, `scripts/**`, `tests/**`. Fiecare folosire
  cere un comentariu care spune DE CE nu poate face treaba RLS și un filtru
  explicit.
  **`import type { AdminSupabase }` e însă permis oriunde** — regula are
  `allowTypeImports: true`, iar comentariul din `eslint.config.mjs:32` explică
  de ce: restricția e despre FABRICĂ, nu despre semnătura funcțiilor care
  primesc clientul ca argument. De aceea `src/lib/push/coada.ts` (Task 4) poate
  importa tipul, deși fabrica se cheamă doar din `route.ts`. Un hook de sesiune
  poate semnala fișierul ca fiind în capcană — e un fals pozitiv pe cuvântul
  „admin"; **nu muta logica în `actions.ts` din cauza lui.**
- **`.rpc()` nu ajunge la schema `app`** — PostgREST expune doar `public`.
- **Git:** repo-ul e lucrat de sesiuni concurente. `git status --short -- <căile
tale>` înainte de orice `git add`; niciodată `-A` sau `.`. `git commit --only
-- <căile tale>`. `git fetch origin main`, `git merge` (nu rebase), `git push
origin main` la finalul fiecărei sarcini.
- **Un UPDATE respins de `USING` afectează zero rânduri, fără eroare.** Orice
  tranziție face `.select()` după `.update()` și tratează rezultatul gol drept
  conflict.

---

## Harta fișierelor

| Fișier                                                                                            | Răspundere                                                           |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `supabase/migrations/0122_push_dispozitive.sql`                                                   | două tabele, un enum-pereche, coloana `push`, declanșatorul de coadă |
| `tests/rls/proba-push.sql`                                                                        | proba reală per rol: pozitivă și negativă                            |
| `src/lib/push/mesaj.ts`                                                                           | pur: `notification` → mesaj Expo. Fără I/O                           |
| `src/lib/push/mesaj.test.ts`                                                                      | testele lui                                                          |
| `src/lib/push/expo.ts`                                                                            | clientul HTTP către Expo Push API; interpretarea biletelor           |
| `src/lib/push/expo.test.ts`                                                                       | testele lui, cu `fetch` mock                                         |
| `src/app/api/push/livreaza/route.ts`                                                              | golește coada; secret partajat; `skip locked`                        |
| `src/app/api/dispozitive/route.ts`                                                                | `POST` înregistrează jetonul, `DELETE` îl retrage                    |
| `deploy/push-livrare.service` · `.timer`                                                          | timerul de pe VM                                                     |
| `src/config/env.ts`                                                                               | `PUSH_CRON_SECRET`                                                   |
| `mobil/`                                                                                          | aplicația Expo                                                       |
| `tsconfig.json` · `eslint.config.mjs` · `vitest.config.mts` · `.prettierignore` · `.dockerignore` | excluderea lui `mobil/`                                              |

---

## Task 0: Conturile de magazin (fără cod — se pornește PRIMUL)

**Nu are ciclu de test.** E în plan fiindcă e singura poziție cu timp de
așteptare extern, măsurat în zile-săptămâni, și blochează Task 11.

- [ ] **Pasul 1: Cere numărul D-U-N-S** pentru firmă (gratuit, prin formularul
      Dun & Bradstreet). Cerut de Apple pentru contul de organizație și de Google
      pentru verificarea contului de dezvoltator-organizație.
- [ ] **Pasul 2: Deschide Apple Developer Program** — 99 $/an, cont de
      organizație (nu individual: un cont individual publică sub numele
      persoanei).
- [ ] **Pasul 3: Deschide Google Play Console** — 25 $, o singură dată.
- [ ] **Pasul 4: Stabilește dacă e nevoie de ecran de ștergere a contului.**
      Politica Google Play cere cale de ștergere pentru aplicațiile care permit
      **crearea** de conturi. Portalul e strict prin invitație. Dacă politica se
      aplică totuși, se adaugă o sarcină separată — nu se strecoară aici.
- [ ] **Pasul 5: Pregătește politica de confidențialitate.** Există deja:
      `src/app/(marketing)/legal/confidentialitate/page.tsx`. Ambele magazine cer
      un URL public; se folosește acela.

---

## Task 1: Migrarea `0122` și proba reală

**Fișiere:**

- Creează: `supabase/migrations/0122_push_dispozitive.sql`
- Creează: `tests/rls/proba-push.sql`
- Modifică: `src/types/database.ts` (regenerat, nu editat de mână)

**Interfețe:**

- Produce: tabelele `public.dispozitive_push`, `public.push_livrari`; enum-urile
  `public.platforma_mobila` (`'ios' | 'android'`), `public.stare_livrare_push`
  (`'in_asteptare' | 'trimis' | 'esuat' | 'abandonat'`); coloana
  `public.notification_preferences.push boolean not null default true`;
  declanșatorul `trg_notifications_push`.

### De ce declanșatorul e `security definer` — și de ce asta e sigur aici

Funcția rulează implicit cu identitatea celui care a scris notificarea. Politica
de pe `dispozitive_push` limitează citirea la `user_id = auth.uid()`. Actorul
care scrie o notificare aproape niciodată nu e destinatarul ei — un `manager`
care aprobă un concediu, un job `pg_cron` fără `auth.uid()` deloc. Fără
`security definer`, selectul dinăuntru întoarce **zero dispozitive, fără nicio
eroare**, iar coada rămâne goală la nesfârșit.

Precedentul care dovedește că merge peste `force row level security`:
`internal.audit_trigger()` (`supabase/migrations/0002_authz.sql:440`) e
`security definer` și inserează în `public.audit_logs`, tabelă cu `force row
level security` din `0001_kernel.sql:633` — și funcționează azi la fiecare
scriere, sub fiecare rol.

- [ ] **Pasul 1: Scrie proba, ÎNAINTE de migrare**

Creează `tests/rls/proba-push.sql`:

```sql
-- tests/rls/proba-push.sql
--
-- Proba reală pentru push (0122). Verifică ÎNTÂI că merge ce trebuie să meargă.
--
-- (1) POZITIVĂ — un `employee` își poate înregistra jetonul
-- (2) NEGATIVĂ — nu vede jetonul altcuiva
-- (3) POZITIVĂ — un `manager` care scrie o notificare pentru `employee` umple coada
-- (4) POZITIVĂ — un actor NUL (ca joburile pg_cron) umple coada la fel
-- (5) NEGATIVĂ — preferința `push = false` oprește punerea în coadă
-- (6) NEGATIVĂ — `push_livrari` e închisă pentru `authenticated`
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   psql "$BANC_URL" -f tests/rls/proba-push.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_mgr    uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_u_alt    uuid := gen_random_uuid();
  v_disp     uuid;
  v_notif    uuid;
  v_vazute   int;
  v_in_coada int;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA PUSH (0122)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-push-' || v_sufix, 'Proba Push SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);

  insert into auth.users (id, email) values
    (v_u_mgr, 'mgr-' || v_sufix || '@exemplu.ro'),
    (v_u_ang, 'ang-' || v_sufix || '@exemplu.ro'),
    (v_u_alt, 'alt-' || v_sufix || '@exemplu.ro');

  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_mgr, 'manager'),
    (v_org, v_u_ang, 'employee'),
    (v_org, v_u_alt, 'employee');

  -- ── (1) POZITIVĂ: angajatul își înregistrează jetonul ──────────────────
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    insert into public.dispozitive_push (organization_id, user_id, jeton, platforma)
    values (v_org, v_u_ang, 'ExponentPushToken[proba-ang-' || v_sufix || ']', 'android')
    returning id into v_disp;
    raise notice '  (1) OK      employee își înregistrează jetonul';
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise notice '  (1) EȘEC    employee NU-și poate înregistra jetonul: %', sqlerrm;
  end;
  reset role;

  -- ── (2) NEGATIVĂ: alt angajat nu-l vede ────────────────────────────────
  perform set_config('request.jwt.claim.sub', v_u_alt::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.dispozitive_push where user_id = v_u_ang;
  reset role;
  if v_vazute = 0 then
    raise notice '  (2) OK      alt employee nu vede jetonul (0 rânduri)';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (2) EȘEC    alt employee VEDE % jetoane străine', v_vazute;
  end if;

  -- ── (3) POZITIVĂ: managerul scrie o notificare, coada se umple ─────────
  perform set_config('request.jwt.claim.sub', v_u_mgr::text, true);
  set local role authenticated;
  insert into public.notifications (organization_id, user_id, kind, title, link)
  values (v_org, v_u_ang, 'approval', 'Concediu aprobat.', '/portal/concediile-mele')
  returning id into v_notif;
  reset role;

  select count(*) into v_in_coada from public.push_livrari where notification_id = v_notif;
  if v_in_coada = 1 then
    raise notice '  (3) OK      manager → coadă: 1 rând';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (3) EȘEC    manager → coadă: % rânduri (așteptat 1) — declanșatorul nu e security definer?', v_in_coada;
  end if;

  -- ── (4) POZITIVĂ: actor nul, ca joburile pg_cron ───────────────────────
  perform set_config('request.jwt.claim.sub', '', true);
  insert into public.notifications (organization_id, user_id, kind, title)
  values (v_org, v_u_ang, 'reminder', 'Nu ai pontat ziua de ieri.')
  returning id into v_notif;
  select count(*) into v_in_coada from public.push_livrari where notification_id = v_notif;
  if v_in_coada = 1 then
    raise notice '  (4) OK      actor nul → coadă: 1 rând';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (4) EȘEC    actor nul → coadă: % rânduri (așteptat 1)', v_in_coada;
  end if;

  -- ── (5) NEGATIVĂ: preferința oprită taie punerea în coadă ──────────────
  insert into public.notification_preferences (organization_id, user_id, kind, push)
  values (v_org, v_u_ang, 'announcement', false);
  insert into public.notifications (organization_id, user_id, kind, title)
  values (v_org, v_u_ang, 'announcement', 'Anunț de probă.')
  returning id into v_notif;
  select count(*) into v_in_coada from public.push_livrari where notification_id = v_notif;
  if v_in_coada = 0 then
    raise notice '  (5) OK      preferință oprită → coadă goală';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (5) EȘEC    preferință oprită, dar % rânduri în coadă', v_in_coada;
  end if;

  -- ── (6) NEGATIVĂ: coada e închisă pentru utilizatori ───────────────────
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  select count(*) into v_vazute from public.push_livrari;
  reset role;
  if v_vazute = 0 then
    raise notice '  (6) OK      push_livrari închisă pentru authenticated';
  else
    v_esecuri := v_esecuri + 1;
    raise notice '  (6) EȘEC    authenticated vede % rânduri din coadă', v_vazute;
  end if;

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA PUSH: % verificări căzute.', v_esecuri;
  end if;
  raise notice '  PROBA PUSH: 6/6.';
end;
$$;

rollback;
```

Notă: fișierul se termină cu `rollback;`, ca celelalte probe — nu lasă rânduri în
urmă.

- [ ] **Pasul 2: Ridică bancul local și rulează proba — trebuie să CADĂ**

```bash
bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
       | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-push.sql
```

Așteptat: **EȘEC**, cu `relation "public.dispozitive_push" does not exist`.

- [ ] **Pasul 3: Scrie migrarea**

Creează `supabase/migrations/0122_push_dispozitive.sql`. Scheletul e cel din
`0013_attendance.sql`: secțiuni numerotate, indexuri **parțiale**, trio de
politici, **nicio politică DELETE**, `search_path = ''`, granturi în bucla
`do $$`, coadă REVOKE/GRANT pe funcții.

```sql
-- supabase/migrations/0122_push_dispozitive.sql
-- Notificări push pentru aplicația mobilă.
--
-- Se agață de `public.notifications` — punctul prin care trec deja toate cele 22
-- de module — și NU de Server Actions: o parte din notificări sunt scrise de
-- joburi pg_cron dinăuntrul bazei (0103_pontaj_mementouri, 0008_expirables,
-- 0095_integrare_notificari), care nu trec niciodată prin aplicație. Un
-- expeditor legat de aplicație ar rata exact memento-urile.
--
-- Livrarea propriu-zisă NU se face din bază: `pg_net` nu e activat pe instanța
-- noastră (vezi comentariul din src/app/api/reges/reconciliere/route.ts). Coada
-- de aici e golită de un timer systemd de pe VM, prin /api/push/livreaza.

---------------------------------------------------------------------------
-- 1. Tipuri
---------------------------------------------------------------------------

create type public.platforma_mobila as enum ('ios', 'android');

-- `in_lucru` NU e decor. Fără ea, ruta ia rândurile, le lasă pe 'in_asteptare'
-- cât timp trimite, iar timerul următor — la un minut — le poate lua din nou:
-- aceeași notificare, de două ori pe telefon. Blocarea din `for update skip
-- locked` ține doar până la commit, adică mult mai puțin decât trimiterea.
create type public.stare_livrare_push as enum (
  'in_asteptare', 'in_lucru', 'trimis', 'esuat', 'abandonat'
);

---------------------------------------------------------------------------
-- 2. dispozitive_push — un rând per instalare a aplicației.
---------------------------------------------------------------------------

create table public.dispozitive_push (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- Forma jetonului Expo. Verificată aici ca să nu ajungă în coadă un șir care
  -- va fi refuzat oricum de exp.host, după ce a consumat o încercare.
  jeton           text not null check (jeton ~ '^ExponentPushToken\[[^]]{1,200}\]$'),
  platforma       public.platforma_mobila not null,
  -- Ultima confirmare din aplicație. Un jeton nevăzut de luni de zile e un
  -- telefon schimbat; curățarea lui e o decizie de mai târziu, nu una de acum.
  vazut_la        timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz
);

-- Un jeton aparține unei singure instalări. Parțial: un jeton retras poate
-- reapărea pe alt telefon, iar unicitatea totală ar bloca reînregistrarea.
create unique index dispozitive_push_jeton_uq
  on public.dispozitive_push (jeton) where deleted_at is null;
create index dispozitive_push_user_idx
  on public.dispozitive_push (user_id, organization_id) where deleted_at is null;
create index dispozitive_push_org_idx on public.dispozitive_push (organization_id);
create index dispozitive_push_created_by_idx on public.dispozitive_push (created_by);
create index dispozitive_push_updated_by_idx on public.dispozitive_push (updated_by);

---------------------------------------------------------------------------
-- 3. push_livrari — coada. Tabelă de SISTEM: fără politici, deci închisă.
---------------------------------------------------------------------------

create table public.push_livrari (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  dispozitiv_id   uuid not null references public.dispozitive_push (id) on delete cascade,
  stare           public.stare_livrare_push not null default 'in_asteptare',
  incercari       int not null default 0 check (incercari >= 0),
  trimis_la       timestamptz,
  eroare          text,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz
);

-- Indexul pe care se sprijină `for update skip locked` din rută.
create index push_livrari_de_trimis_idx
  on public.push_livrari (created_at)
  where stare in ('in_asteptare', 'in_lucru') and deleted_at is null;
create index push_livrari_notificare_idx on public.push_livrari (notification_id);
create index push_livrari_dispozitiv_idx on public.push_livrari (dispozitiv_id);
create index push_livrari_created_by_idx on public.push_livrari (created_by);
create index push_livrari_updated_by_idx on public.push_livrari (updated_by);

---------------------------------------------------------------------------
-- 4. Preferința. O coloană, nu o tabelă: `notification_preferences` are deja
--    `in_app` și `email` per fiecare din cele opt valori ale enum-ului.
---------------------------------------------------------------------------

alter table public.notification_preferences
  add column push boolean not null default true;

---------------------------------------------------------------------------
-- 5. Punerea în coadă
--
-- `security definer` NU e opțional: funcția rulează altfel cu identitatea celui
-- care a scris notificarea, iar politica de pe `dispozitive_push` l-ar limita la
-- rândurile proprii. Cum actorul aproape niciodată nu e destinatarul — un
-- manager care aprobă, un job pg_cron fără auth.uid() deloc — selectul ar
-- întoarce zero dispozitive, FĂRĂ NICIO EROARE, iar coada ar rămâne goală la
-- nesfârșit. Precedentul care dovedește că merge peste `force row level
-- security`: internal.audit_trigger() din 0002, care scrie în audit_logs.
--
-- Preferința absentă înseamnă TRIMITE. Baza colapsează „absent" în „fals" doar
-- dacă i se cere; aici `coalesce` o cere explicit.
---------------------------------------------------------------------------

create or replace function internal.push_pune_in_coada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_livrari (notification_id, dispozitiv_id)
  select new.id, d.id
  from public.dispozitive_push d
  where d.user_id = new.user_id
    and d.organization_id = new.organization_id
    and d.deleted_at is null
    and coalesce(
          (select p.push
             from public.notification_preferences p
            where p.user_id = new.user_id
              and p.organization_id = new.organization_id
              and p.kind = new.kind
              and p.deleted_at is null),
          true);
  return null;
end;
$$;

create trigger trg_notifications_push
  after insert on public.notifications
  for each row execute function internal.push_pune_in_coada();

---------------------------------------------------------------------------
-- 6. RLS
---------------------------------------------------------------------------

alter table public.dispozitive_push enable row level security;
alter table public.dispozitive_push force row level security;
alter table public.push_livrari     enable row level security;
alter table public.push_livrari     force row level security;

-- dispozitive_push — strict rândurile proprii. Fără cheie de permisiune: nu
-- există resursă „dispozitivul meu" în role_permissions, iar una inventată ar
-- întoarce `none`, adică refuz tăcut pentru toată lumea. Aceeași alegere ca la
-- notifications (0002, secțiunea 6.11).
create policy dispozitive_push_select on public.dispozitive_push for select to authenticated
using (user_id = (select auth.uid()) and deleted_at is null);

create policy dispozitive_push_insert on public.dispozitive_push for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and user_id = (select auth.uid())
  and deleted_at is null
);

create policy dispozitive_push_update on public.dispozitive_push for update to authenticated
using (user_id = (select auth.uid()) and deleted_at is null)
with check (user_id = (select auth.uid()));

-- push_livrari — NICIO politică. RLS activat și forțat înseamnă că e inaccesibilă
-- oricărui rol de aplicație; o citește doar ruta, prin service_role (bypassrls,
-- 0001_kernel.sql:25). Nu se lasă fără RLS: regula proiectului e RLS peste tot,
-- iar o excepție „pentru că oricum n-o citește nimeni" e felul în care apare a
-- doua excepție.

---------------------------------------------------------------------------
-- 7. Actor, audit, drepturi
---------------------------------------------------------------------------

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['dispozitive_push', 'push_livrari']
  loop
    execute format(
      'create trigger trg_%1$s_actor before insert or update on public.%1$I for each row execute function internal.set_actor()',
      v_tabela);
    execute format('select internal.attach_audit(%L)', v_tabela);
    execute format('revoke all on table public.%I from public, anon', v_tabela);
    execute format('revoke delete on table public.%I from authenticated', v_tabela);
  end loop;
end;
$$;

-- Granturi diferite per tabelă: coada nu se atinge din sesiunea unui utilizator.
grant select, insert, update on table public.dispozitive_push to authenticated;
revoke all on table public.push_livrari from authenticated;

revoke all on function internal.push_pune_in_coada() from public, anon;

---------------------------------------------------------------------------
-- 8. Note de proiectare
--
-- DE CE NU EXISTĂ POLITICĂ DELETE, nici aici
--   Retragerea unui jeton e `deleted_at = now()`, nu DELETE. Jurnalul de audit
--   trebuie să poată răspunde „de ce a încetat omul ăsta să primească
--   notificări", iar un rând șters nu răspunde la nimic.
--
-- DE CE `vazut_la` ȘI NU UN JOB DE CURĂȚENIE
--   Expo întoarce `DeviceNotRegistered` pentru un jeton mort, iar ruta îl
--   marchează atunci. Curățarea pe vechime ar șterge și telefoane care pur și
--   simplu n-au fost deschise o lună.
---------------------------------------------------------------------------
```

- [ ] **Pasul 4: Reconstruiește bancul și rulează proba — trebuie să TREACĂ**

```bash
docker rm -f administrativo-banc 2>/dev/null
bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
       | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-push.sql
```

Așteptat: `PROBA PUSH: 6/6.`

Dacă (3) sau (4) cad cu `0 rânduri`, cauza e `security definer` — nu jetonul, nu
preferința. Verificarea (5) trebuie să cadă cu `1 rând` dacă `coalesce` lipsește.

- [ ] **Pasul 5: Regenerează tipurile din bancul LOCAL, nu din cloud**

```bash
PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
       | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
pnpm exec supabase gen types typescript \
  --db-url "postgresql://postgres:banc@localhost:$PORT/postgres" \
  | python3 scripts/altoieste-tipuri.py > src/types/database.ts
```

`--linked` (adică `pnpm db:types`) ar citi cloud-ul, care poate avea drift.
Scriptul `altoieste-tipuri.py` reaplică mecanic cele două patch-uri; nu se editează
fișierul de mână.

- [ ] **Pasul 6: Verifică**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Așteptat: verde. Diff-ul din `src/types/database.ts` trebuie să conțină **doar**
cele două tabele noi, cele două enum-uri și coloana `push`.

- [ ] **Pasul 7: Comite**

```bash
git status --short -- supabase/migrations/0122_push_dispozitive.sql tests/rls/proba-push.sql src/types/database.ts
git fetch origin main
git commit --only -m "feat(push): tabelele de dispozitive și coada de livrare (0122)" -- \
  supabase/migrations/0122_push_dispozitive.sql tests/rls/proba-push.sql src/types/database.ts
git merge origin/main --no-edit && git push origin main
```

- [ ] **Pasul 8: Cere confirmarea pentru aplicarea pe producție**

Migrarea NU se aplică pe cloud fără un „da" explicit al utilizatorului, cerut
acum, pentru migrarea asta. Un „da" anterior nu acoperă o migrare nouă. Comanda e
în `NOTES.md` §1 (prin pooler), iar după aplicare se înregistrează în
`internal.migrari_aplicate`.

---

## Task 2: Traducerea notificare → mesaj push

**Fișiere:**

- Creează: `src/lib/push/mesaj.ts`
- Test: `src/lib/push/mesaj.test.ts`

**Interfețe:**

- Consumă: tipul `Tables<"notifications">` din `@/types/database` (Task 1).
- Produce:
  ```ts
  export type MesajPush = {
    readonly to: string;
    readonly title: string;
    readonly body: string;
    readonly data: { readonly cale: string };
    readonly sound: "default";
    readonly channelId: "implicit";
  };
  export function construiesteMesaj(
    args: Readonly<{
      jeton: string;
      titlu: string;
      corp: string | null;
      link: string | null;
    }>,
  ): MesajPush;
  ```

Funcție pură, fără I/O — intră în proiectul `unit` al Vitest, care include
`src/**/*.test.ts`.

- [ ] **Pasul 1: Scrie testul care cade**

```ts
// src/lib/push/mesaj.test.ts
import { describe, expect, it } from "vitest";

import { construiesteMesaj } from "./mesaj";

const JETON = "ExponentPushToken[abcdef]";

describe("construiesteMesaj", () => {
  it("duce titlul și corpul mai departe", () => {
    const mesaj = construiesteMesaj({
      jeton: JETON,
      titlu: "Concediu aprobat.",
      corp: "Cererea din 12 septembrie a fost aprobată.",
      link: "/portal/concediile-mele",
    });
    expect(mesaj.to).toBe(JETON);
    expect(mesaj.title).toBe("Concediu aprobat.");
    expect(mesaj.body).toBe("Cererea din 12 septembrie a fost aprobată.");
    expect(mesaj.data.cale).toBe("/portal/concediile-mele");
  });

  it("cade pe portal când notificarea n-are link", () => {
    const mesaj = construiesteMesaj({ jeton: JETON, titlu: "Ceva.", corp: null, link: null });
    expect(mesaj.data.cale).toBe("/portal");
  });

  it("corpul gol devine șir gol, nu 'null'", () => {
    const mesaj = construiesteMesaj({ jeton: JETON, titlu: "Ceva.", corp: null, link: null });
    expect(mesaj.body).toBe("");
  });

  it("refuză o cale care nu e internă", () => {
    // Constrângerea din bază oprește asta la scriere; aici e centura peste
    // bretele, pentru rândurile scrise înainte de 0001 sau prin service_role.
    for (const ostil of ["//evil.com", "https://evil.com", "/\\evil.com"]) {
      const mesaj = construiesteMesaj({ jeton: JETON, titlu: "X.", corp: null, link: ostil });
      expect(mesaj.data.cale).toBe("/portal");
    }
  });

  it("taie titlul la 100 și corpul la 240 de caractere", () => {
    const mesaj = construiesteMesaj({
      jeton: JETON,
      titlu: "a".repeat(200),
      corp: "b".repeat(500),
      link: null,
    });
    expect(mesaj.title).toHaveLength(100);
    expect(mesaj.body).toHaveLength(240);
  });
});
```

- [ ] **Pasul 2: Rulează testul ca să confirmi că pică**

```bash
pnpm exec vitest run --project unit src/lib/push/mesaj.test.ts
```

Așteptat: FAIL cu `Failed to resolve import "./mesaj"`.

- [ ] **Pasul 3: Scrie implementarea minimă**

```ts
// src/lib/push/mesaj.ts

/**
 * Traducerea unui rând din `notifications` în mesajul pe care îl înghite Expo.
 *
 * Pur, fără I/O: se poate testa fără bază și fără rețea, iar defectele lui —
 * o cale ostilă, un titlu care depășește ce afișează sistemul — se prind aici,
 * nu în producție, pe telefonul cuiva.
 */

/** Ce afișează efectiv iOS și Android înainte de a tăia singure. */
const MAX_TITLU = 100;
const MAX_CORP = 240;

/** Unde ajunge o notificare fără link, sau cu unul în care nu avem încredere. */
const CALE_IMPLICITA = "/portal";

export type MesajPush = {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data: { readonly cale: string };
  readonly sound: "default";
  readonly channelId: "implicit";
};

/**
 * Aceeași formă ca `check (link ~ '^/[^/\\]')` de pe `notifications.link`, din
 * `0001_kernel.sql`. Constrângerea din bază e prima barieră și e suficientă
 * pentru scrierile prin RLS; asta o dublează pentru rândurile scrise cu
 * `service_role`, care o ocolesc. Un `//evil.com` e URL absolut
 * protocol-relativ: deschis într-un WebView semnat cu numele firmei, ar fi
 * exact scenariul pe care constrângerea îl oprea pe web.
 */
function caleInterna(link: string | null): string {
  if (link === null) return CALE_IMPLICITA;
  return /^\/[^/\\]/.test(link) ? link : CALE_IMPLICITA;
}

export function construiesteMesaj(
  args: Readonly<{
    jeton: string;
    titlu: string;
    corp: string | null;
    link: string | null;
  }>,
): MesajPush {
  return {
    to: args.jeton,
    title: args.titlu.slice(0, MAX_TITLU),
    body: (args.corp ?? "").slice(0, MAX_CORP),
    data: { cale: caleInterna(args.link) },
    sound: "default",
    // Canalul se creează în aplicație, la pornire. Android ignoră notificările
    // trimise pe un canal inexistent, fără nicio eroare la expeditor.
    channelId: "implicit",
  };
}
```

- [ ] **Pasul 4: Rulează testele — trebuie să treacă**

```bash
pnpm exec vitest run --project unit src/lib/push/mesaj.test.ts
```

Așteptat: 5 teste verzi.

- [ ] **Pasul 5: Comite**

```bash
git status --short -- src/lib/push/
git fetch origin main
git commit --only -m "feat(push): traducerea notificare → mesaj Expo" -- src/lib/push/mesaj.ts src/lib/push/mesaj.test.ts
git merge origin/main --no-edit && git push origin main
```

---

## Task 3: Clientul Expo Push

**Fișiere:**

- Creează: `src/lib/push/expo.ts`
- Test: `src/lib/push/expo.test.ts`

**Interfețe:**

- Consumă: `MesajPush` din `./mesaj` (Task 2).
- Produce:

  ```ts
  export type RezultatBilet =
    | { readonly fel: "ok" }
    | { readonly fel: "jeton-mort" }
    | { readonly fel: "eroare"; readonly mesaj: string };
  export const MAX_PE_LOT = 100;
  export async function trimiteLot(mesaje: readonly MesajPush[]): Promise<readonly RezultatBilet[]>;
  ```

  `trimiteLot` întoarce **exact un rezultat per mesaj, în aceeași ordine** —
  ruta din Task 4 se bazează pe potrivirea pozițională.

- [ ] **Pasul 1: Scrie testul care cade**

```ts
// src/lib/push/expo.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_PE_LOT, trimiteLot } from "./expo";
import type { MesajPush } from "./mesaj";

function mesaj(jeton: string): MesajPush {
  return {
    to: jeton,
    title: "T",
    body: "B",
    data: { cale: "/portal" },
    sound: "default",
    channelId: "implicit",
  };
}

let apeluri: { url: string; init: RequestInit }[] = [];

function mockFetch(corpuri: unknown[]): void {
  let i = 0;
  apeluri = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    apeluri.push({ url: String(url), init });
    const corp = corpuri[Math.min(i, corpuri.length - 1)];
    i += 1;
    return Promise.resolve(
      new Response(JSON.stringify(corp), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trimiteLot", () => {
  it("nu cheamă rețeaua pentru un lot gol", async () => {
    mockFetch([{ data: [] }]);
    const rezultate = await trimiteLot([]);
    expect(rezultate).toEqual([]);
    expect(apeluri).toHaveLength(0);
  });

  it("traduce biletele ok", async () => {
    mockFetch([{ data: [{ status: "ok", id: "x" }] }]);
    const rezultate = await trimiteLot([mesaj("ExponentPushToken[a]")]);
    expect(rezultate).toEqual([{ fel: "ok" }]);
  });

  it("recunoaște jetonul mort după DeviceNotRegistered", async () => {
    mockFetch([
      {
        data: [{ status: "error", message: "…", details: { error: "DeviceNotRegistered" } }],
      },
    ]);
    const rezultate = await trimiteLot([mesaj("ExponentPushToken[a]")]);
    expect(rezultate).toEqual([{ fel: "jeton-mort" }]);
  });

  it("orice altă eroare rămâne reîncercabilă", async () => {
    mockFetch([
      {
        data: [{ status: "error", message: "MessageTooBig", details: { error: "MessageTooBig" } }],
      },
    ]);
    const rezultate = await trimiteLot([mesaj("ExponentPushToken[a]")]);
    expect(rezultate[0]?.fel).toBe("eroare");
  });

  it("sparge loturile mai mari de 100 și păstrează ordinea", async () => {
    const mesaje = Array.from({ length: 150 }, (_, i) => mesaj(`ExponentPushToken[${i}]`));
    mockFetch([
      { data: Array.from({ length: MAX_PE_LOT }, () => ({ status: "ok", id: "x" })) },
      { data: Array.from({ length: 50 }, () => ({ status: "ok", id: "x" })) },
    ]);
    const rezultate = await trimiteLot(mesaje);
    expect(apeluri).toHaveLength(2);
    expect(rezultate).toHaveLength(150);
    expect(rezultate.every((r) => r.fel === "ok")).toBe(true);
  });

  it("un răspuns scurt nu lasă mesaje fără rezultat", async () => {
    // Expo a răspuns cu mai puține bilete decât mesaje trimise. Fără plasa asta,
    // ruta ar potrivi pozițional greșit și ar marca un mesaj netrimis ca trimis.
    mockFetch([{ data: [{ status: "ok", id: "x" }] }]);
    const rezultate = await trimiteLot([
      mesaj("ExponentPushToken[a]"),
      mesaj("ExponentPushToken[b]"),
    ]);
    expect(rezultate).toHaveLength(2);
    expect(rezultate[1]?.fel).toBe("eroare");
  });

  it("un HTTP nereușit face tot lotul reîncercabil", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("nope", { status: 502 })));
    const rezultate = await trimiteLot([mesaj("ExponentPushToken[a]")]);
    expect(rezultate[0]?.fel).toBe("eroare");
  });
});
```

- [ ] **Pasul 2: Rulează testul ca să confirmi că pică**

```bash
pnpm exec vitest run --project unit src/lib/push/expo.test.ts
```

Așteptat: FAIL cu `Failed to resolve import "./expo"`.

- [ ] **Pasul 3: Scrie implementarea**

```ts
// src/lib/push/expo.ts
import type { MesajPush } from "./mesaj";

/**
 * Clientul serviciului de push al Expo.
 *
 * Fără cheie: `exp.host` acceptă mesajele pe baza jetonului destinatarului.
 * Credențialele de platformă (contul de serviciu FCM V1 și cheia APNs) stau la
 * EAS, nu aici — de-aia fișierul ăsta n-are nimic secret și nu citește `env`.
 */

const ENDPOINT = "https://exp.host/--/api/v2/push/send";

/** Plafonul documentat de Expo pentru un singur apel. */
export const MAX_PE_LOT = 100;

export type RezultatBilet =
  | { readonly fel: "ok" }
  /** Jetonul nu mai există: aplicația a fost dezinstalată sau reinstalată. */
  | { readonly fel: "jeton-mort" }
  /** Orice altceva. Rămâne reîncercabil până la plafonul de încercări. */
  | { readonly fel: "eroare"; readonly mesaj: string };

type Bilet = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

function citesteBilet(bilet: Bilet | undefined): RezultatBilet {
  if (bilet === undefined) {
    // Expo a răspuns cu mai puține bilete decât mesaje. Fără ramura asta,
    // apelantul ar potrivi pozițional greșit și ar marca drept trimis un mesaj
    // despre care nu știe nimic.
    return { fel: "eroare", mesaj: "Răspuns fără bilet pentru acest mesaj." };
  }
  if (bilet.status === "ok") return { fel: "ok" };
  if (bilet.details?.error === "DeviceNotRegistered") return { fel: "jeton-mort" };
  return { fel: "eroare", mesaj: bilet.message ?? "Eroare necunoscută de la Expo." };
}

async function trimiteUnLot(lot: readonly MesajPush[]): Promise<readonly RezultatBilet[]> {
  let raspuns: Response;
  try {
    raspuns = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(lot),
    });
  } catch (eroare) {
    const mesaj = eroare instanceof Error ? eroare.message : "Rețea indisponibilă.";
    return lot.map(() => ({ fel: "eroare", mesaj }) as const);
  }

  if (!raspuns.ok) {
    // Nu se citește corpul: un 5xx de la exp.host e reîncercabil pentru tot
    // lotul, indiferent ce scrie în el.
    return lot.map(() => ({ fel: "eroare", mesaj: `HTTP ${raspuns.status}.` }) as const);
  }

  const corp = (await raspuns.json()) as { data?: Bilet[] };
  const bilete = corp.data ?? [];
  return lot.map((_, i) => citesteBilet(bilete[i]));
}

/**
 * Trimite mesajele, spărgându-le în loturi de cel mult `MAX_PE_LOT`.
 *
 * Întoarce EXACT un rezultat per mesaj, în aceeași ordine. Apelantul se bazează
 * pe potrivirea pozițională ca să știe ce rând din coadă a plecat.
 */
export async function trimiteLot(mesaje: readonly MesajPush[]): Promise<readonly RezultatBilet[]> {
  const rezultate: RezultatBilet[] = [];
  for (let i = 0; i < mesaje.length; i += MAX_PE_LOT) {
    // Serial, nu în paralel: loturile sunt puține, iar Expo limitează debitul.
    rezultate.push(...(await trimiteUnLot(mesaje.slice(i, i + MAX_PE_LOT))));
  }
  return rezultate;
}
```

- [ ] **Pasul 4: Rulează testele — trebuie să treacă**

```bash
pnpm exec vitest run --project unit src/lib/push/expo.test.ts
```

Așteptat: 7 teste verzi.

> Nu adăuga `eslint-disable-next-line no-await-in-loop`: regula **nu e
> configurată** în `eslint.config.mjs`, iar o directivă de dezactivare pentru o
> regulă inactivă e ea însăși raportată. Verificat pe 2026-09-03.

- [ ] **Pasul 5: Verifică lanțul și comite**

```bash
pnpm typecheck && pnpm lint && pnpm exec vitest run --project unit src/lib/push/
git status --short -- src/lib/push/
git fetch origin main
git commit --only -m "feat(push): clientul Expo Push, cu bilete și loturi de 100" -- src/lib/push/expo.ts src/lib/push/expo.test.ts
git merge origin/main --no-edit && git push origin main
```

---

## Task 4: Ruta care golește coada

**Fișiere:**

- Creează: `src/app/api/push/livreaza/route.ts`
- Creează: `src/lib/push/coada.ts`
- Test: `src/lib/push/coada.test.ts`
- Modifică: `src/config/env.ts` (adaugă `PUSH_CRON_SECRET`)

**Interfețe:**

- Consumă: `trimiteLot`, `RezultatBilet` (Task 3); `construiesteMesaj` (Task 2);
  tabelele din Task 1.
- Produce:
  ```ts
  export const MAX_INCERCARI = 5;
  export type RaportLivrare = {
    readonly luate: number;
    readonly trimise: number;
    readonly esuate: number;
    readonly abandonate: number;
    readonly jetoaneRetrase: number;
  };
  export async function golesteCoada(db: AdminSupabase, plafon?: number): Promise<RaportLivrare>;
  ```

Logica stă în `src/lib/push/coada.ts`, nu în `route.ts`, ca să fie testabilă cu
un client fals. Ruta rămâne poarta: secret, metodă, cod de răspuns.

- [ ] **Pasul 1: Adaugă secretul în `src/config/env.ts`**

În obiectul de server, lângă `REGES_CRON_SECRET`, cu aceeași motivație:

```ts
    /**
     * Secretul cu care timerul de pe gazdă cheamă `/api/push/livreaza`.
     *
     * `default("")` e comutatorul de pornire, ca la `REGES_CRON_SECRET`: ruta
     * refuză orice cerere cât timp secretul e gol, deci o instalare care n-a
     * apucat să-l pună are livrarea oprită, nu deschisă. Variabilă obligatorie
     * ar fi oprit la boot fiecare mediu fără push — CI-ul inclusiv.
     */
    PUSH_CRON_SECRET: z.string().default(""),
```

- [ ] **Pasul 2: Scrie testul care cade**

```ts
// src/lib/push/coada.test.ts
import { describe, expect, it, vi, afterEach } from "vitest";

import type { AdminSupabase } from "@/lib/supabase/admin";

import { golesteCoada, MAX_INCERCARI } from "./coada";

type Rand = {
  id: string;
  incercari: number;
  jeton: string;
  dispozitiv_id: string;
  titlu: string;
  corp: string | null;
  link: string | null;
};

/**
 * Client fals: expune doar ce folosește `golesteCoada`. Un mock al întregului
 * `SupabaseClient` ar fi de zece ori mai lung și ar testa biblioteca, nu codul.
 */
function dbFals(randuri: Rand[]) {
  const actualizari: { id: string; date: Record<string, unknown> }[] = [];
  const retrase: string[] = [];
  return {
    actualizari,
    retrase,
    rpc: (_nume: string, _args: unknown) => Promise.resolve({ data: randuri, error: null }),
    from(tabela: string) {
      return {
        update(date: Record<string, unknown>) {
          return {
            eq(_coloana: string, valoare: string) {
              if (tabela === "push_livrari") actualizari.push({ id: valoare, date });
              else retrase.push(valoare);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

function rand(peste: Partial<Rand> = {}): Rand {
  return {
    id: "l1",
    incercari: 0,
    jeton: "ExponentPushToken[a]",
    dispozitiv_id: "d1",
    titlu: "Concediu aprobat.",
    corp: null,
    link: "/portal/concediile-mele",
    ...peste,
  };
}

afterEach(() => vi.unstubAllGlobals());

function mockExpo(bilete: unknown[]): void {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      new Response(JSON.stringify({ data: bilete }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("golesteCoada", () => {
  it("coada goală nu cheamă rețeaua", async () => {
    const apeluri: unknown[] = [];
    vi.stubGlobal("fetch", (...a: unknown[]) => {
      apeluri.push(a);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const db = dbFals([]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport).toEqual({ luate: 0, trimise: 0, esuate: 0, abandonate: 0, jetoaneRetrase: 0 });
    expect(apeluri).toHaveLength(0);
  });

  it("marchează trimis rândul livrat", async () => {
    mockExpo([{ status: "ok", id: "x" }]);
    const db = dbFals([rand()]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.trimise).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("trimis");
    expect(db.actualizari[0]?.date.trimis_la).toEqual(expect.any(String));
  });

  it("un jeton mort retrage dispozitivul și abandonează rândul", async () => {
    mockExpo([{ status: "error", details: { error: "DeviceNotRegistered" } }]);
    const db = dbFals([rand()]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.jetoaneRetrase).toBe(1);
    expect(raport.abandonate).toBe(1);
    expect(db.retrase).toEqual(["d1"]);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
  });

  it("o eroare obișnuită lasă rândul reîncercabil și incrementează", async () => {
    mockExpo([{ status: "error", message: "boom", details: { error: "MessageTooBig" } }]);
    const db = dbFals([rand({ incercari: 1 })]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.esuate).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("in_asteptare");
    expect(db.actualizari[0]?.date.incercari).toBe(2);
    expect(db.actualizari[0]?.date.eroare).toBe("boom");
  });

  it("abandonează după MAX_INCERCARI", async () => {
    mockExpo([{ status: "error", message: "boom", details: { error: "MessageTooBig" } }]);
    const db = dbFals([rand({ incercari: MAX_INCERCARI - 1 })]);
    const raport = await golesteCoada(db as unknown as AdminSupabase);
    expect(raport.abandonate).toBe(1);
    expect(db.actualizari[0]?.date.stare).toBe("abandonat");
  });
});
```

- [ ] **Pasul 3: Rulează testul ca să confirmi că pică**

```bash
pnpm exec vitest run --project unit src/lib/push/coada.test.ts
```

Așteptat: FAIL cu `Failed to resolve import "./coada"`.

- [ ] **Pasul 4: Adaugă funcția SQL de preluare, în migrarea `0122`**

Migrarea nu e încă pe cloud (Task 1, pasul 8 cere confirmare separată). Dacă a
fost deja aplicată, **nu se editează**: se scrie `0123`. Verifică întâi:

```bash
psql "$DATABASE_URL" -c "select nume from internal.migrari_aplicate order by nume desc limit 3"
```

Funcția, în secțiunea 5 a migrării, după declanșator:

```sql
-- `for update skip locked` în loc de un simplu select: aplicația rulează cu DOUĂ
-- replici Swarm, iar timerul poate suprapune două rulări. Fără `skip locked`,
-- amândouă ar lua aceleași rânduri și ar trimite fiecare aceeași notificare.
-- Aceeași grijă ca la închirierea REGES, altă unealtă pentru aceeași problemă.
create or replace function app.push_ia_din_coada(p_plafon int default 100)
returns table (
  id            uuid,
  incercari     int,
  jeton         text,
  dispozitiv_id uuid,
  titlu         text,
  corp          text,
  link          text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with luate as (
    select l.id
    from public.push_livrari l
    where l.deleted_at is null
      and (
        l.stare = 'in_asteptare'
        -- Recuperare: o rută căzută la jumătate lasă rânduri pe 'in_lucru'.
        -- Fără clauza asta ar rămâne acolo pentru totdeauna, tăcut.
        or (l.stare = 'in_lucru' and l.updated_at < now() - interval '10 minutes')
      )
    order by l.created_at
    limit p_plafon
    for update skip locked
  )
  update public.push_livrari l
     set stare = 'in_lucru', updated_at = now()
    from luate, public.dispozitive_push d, public.notifications n
   where l.id = luate.id
     and d.id = l.dispozitiv_id
     and n.id = l.notification_id
  returning l.id, l.incercari, d.jeton, d.id, n.title, n.body, n.link;
end;
$$;

revoke all on function app.push_ia_din_coada(int) from public, anon, authenticated;
```

> `.rpc()` nu ajunge la schema `app` — PostgREST expune doar `public`. Funcția
> se cheamă deci **prin `public`**: mută-o în `public.push_ia_din_coada` sau
> adaugă un înveliș `public` care o cheamă. Alege învelișul: păstrează convenția
> ca logica să stea în `app`.

```sql
create or replace function public.push_ia_din_coada(p_plafon int default 100)
returns table (
  id uuid, incercari int, jeton text, dispozitiv_id uuid,
  titlu text, corp text, link text
)
language sql
security definer
set search_path = ''
as $$ select * from app.push_ia_din_coada(p_plafon) $$;

revoke all on function public.push_ia_din_coada(int) from public, anon, authenticated;
grant execute on function public.push_ia_din_coada(int) to service_role;
```

- [ ] **Pasul 5: Scrie `src/lib/push/coada.ts`**

```ts
// src/lib/push/coada.ts
import type { AdminSupabase } from "@/lib/supabase/admin";

import { trimiteLot } from "./expo";
import { construiesteMesaj } from "./mesaj";

/**
 * Golirea cozii de push.
 *
 * Trăiește aici, nu în `route.ts`, ca să se poată testa cu un client fals.
 * Ruta rămâne doar poarta: secretul, metoda, codul de răspuns.
 */

/** După atâtea încercări, rândul se abandonează. */
export const MAX_INCERCARI = 5;

const PLAFON_IMPLICIT = 100;

export type RaportLivrare = {
  readonly luate: number;
  readonly trimise: number;
  readonly esuate: number;
  readonly abandonate: number;
  readonly jetoaneRetrase: number;
};

type RandCoada = {
  readonly id: string;
  readonly incercari: number;
  readonly jeton: string;
  readonly dispozitiv_id: string;
  readonly titlu: string;
  readonly corp: string | null;
  readonly link: string | null;
};

export async function golesteCoada(
  db: AdminSupabase,
  plafon: number = PLAFON_IMPLICIT,
): Promise<RaportLivrare> {
  // ⚠ service_role: OCOLEȘTE RLS. E necesar aici fiindcă livrarea nu are
  // utilizator — rulează pentru toți destinatarii deodată, dintr-un timer.
  // `push_livrari` n-are oricum nicio politică: e închisă și pentru
  // `authenticated`. Filtrarea o face funcția SQL, nu o clauză din TypeScript.
  const { data, error } = await db.rpc("push_ia_din_coada", { p_plafon: plafon });
  if (error !== null) throw new Error(`Preluarea din coadă a eșuat: ${error.message}`);

  const randuri = (data ?? []) as readonly RandCoada[];
  if (randuri.length === 0) {
    return { luate: 0, trimise: 0, esuate: 0, abandonate: 0, jetoaneRetrase: 0 };
  }

  const rezultate = await trimiteLot(
    randuri.map((r) =>
      construiesteMesaj({ jeton: r.jeton, titlu: r.titlu, corp: r.corp, link: r.link }),
    ),
  );

  let trimise = 0;
  let esuate = 0;
  let abandonate = 0;
  let jetoaneRetrase = 0;

  for (const [i, rand] of randuri.entries()) {
    const rezultat = rezultate[i];
    const acum = new Date().toISOString();

    if (rezultat === undefined || rezultat.fel === "eroare") {
      const incercari = rand.incercari + 1;
      const renunta = incercari >= MAX_INCERCARI;
      if (renunta) abandonate += 1;
      else esuate += 1;
      await db
        .from("push_livrari")
        .update({
          stare: renunta ? "abandonat" : "in_asteptare",
          incercari,
          eroare: rezultat?.mesaj ?? "Fără bilet.",
        })
        .eq("id", rand.id);
      continue;
    }

    if (rezultat.fel === "jeton-mort") {
      jetoaneRetrase += 1;
      abandonate += 1;
      // Retragerea e `deleted_at`, nu DELETE: jurnalul trebuie să poată spune de
      // ce a încetat omul să primească notificări.
      await db.from("dispozitive_push").update({ deleted_at: acum }).eq("id", rand.dispozitiv_id);
      await db
        .from("push_livrari")
        .update({ stare: "abandonat", eroare: "Jeton neînregistrat." })
        .eq("id", rand.id);
      continue;
    }

    trimise += 1;
    // eslint-disable-next-line no-await-in-loop
    await db.from("push_livrari").update({ stare: "trimis", trimis_la: acum }).eq("id", rand.id);
  }

  return { luate: randuri.length, trimise, esuate, abandonate, jetoaneRetrase };
}
```

- [ ] **Pasul 6: Rulează testele — trebuie să treacă**

```bash
pnpm exec vitest run --project unit src/lib/push/coada.test.ts
```

Așteptat: 5 teste verzi.

- [ ] **Pasul 7: Scrie ruta**

```ts
// src/app/api/push/livreaza/route.ts
import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/config/env";
import { golesteCoada } from "@/lib/push/coada";
// ⚠ OCOLEȘTE COMPLET RLS. Livrarea rulează fără niciun utilizator autentificat,
// pentru toți destinatarii deodată: nu există sesiune din care RLS să deducă
// ceva. `push_livrari` n-are nicio politică — e închisă și pentru
// `authenticated` — iar selecția o face `public.push_ia_din_coada`, cu
// `for update skip locked`.
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Golește coada de notificări push.
 *
 * CINE O CHEAMĂ
 * Un systemd timer de pe VM, la un minut — `deploy/push-livrare.{service,timer}`.
 *
 * DE CE NU pg_cron + pg_net
 * `pg_net` nu e activat pe instanța noastră; vezi comentariul din
 * `api/reges/reconciliere/route.ts`. Un job SQL n-are cum să iasă pe HTTP.
 *
 * DE CE E SIGUR CU DOUĂ REPLICI
 * Nu ruta decide, ci baza: `push_ia_din_coada` ia rândurile cu
 * `for update skip locked`. A doua replică primește alt lot, sau niciunul.
 */
function secretPotrivit(antet: string | null): boolean {
  const asteptat = serverEnv.PUSH_CRON_SECRET;
  // Secret gol = ruta e OPRITĂ. O instalare fără secret nu livrează.
  if (asteptat === "") return false;
  if (antet === null) return false;

  const primit = antet.startsWith("Bearer ") ? antet.slice(7) : antet;
  const a = Buffer.from(primit);
  const b = Buffer.from(asteptat);
  // Lungimile întâi: `timingSafeEqual` ARUNCĂ pe buffere inegale, iar excepția
  // ar fi ea însăși un canal lateral (și un 500 în loc de 404).
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(cerere: Request): Promise<Response> {
  if (!secretPotrivit(cerere.headers.get("authorization"))) {
    // 404, nu 401: o rută de serviciu nu-și confirmă existența unui apelant fără
    // secret. Tiparul e cel din `api/reges/reconciliere`.
    return new Response("Not found", { status: 404 });
  }

  const db = createAdminSupabase();
  try {
    const raport = await golesteCoada(db);
    return Response.json(raport, { status: 200 });
  } catch (eroare) {
    const mesaj = eroare instanceof Error ? eroare.message : "Eroare necunoscută.";
    console.error("[push-livreaza]", mesaj);
    return Response.json({ ok: false, error: mesaj }, { status: 500 });
  }
}
```

- [ ] **Pasul 8: Verifică lanțul și comite**

```bash
pnpm typecheck && pnpm lint && pnpm test
git status --short -- src/lib/push/ src/app/api/push/ src/config/env.ts supabase/migrations/
git fetch origin main
git commit --only -m "feat(push): golirea cozii, cu skip locked și retragerea jetoanelor moarte" -- \
  src/lib/push/coada.ts src/lib/push/coada.test.ts src/app/api/push/livreaza/route.ts src/config/env.ts \
  supabase/migrations/0122_push_dispozitive.sql
git merge origin/main --no-edit && git push origin main
```

---

## Task 5: Înregistrarea jetonului

**Fișiere:**

- Creează: `src/app/api/dispozitive/route.ts`
- Test: `src/lib/push/jeton.test.ts`
- Creează: `src/lib/push/jeton.ts`

**Interfețe:**

- Produce:
  ```ts
  export const jetonSchema: z.ZodObject<{
    jeton: z.ZodString;
    platforma: z.ZodEnum<["ios", "android"]>;
  }>;
  ```

Ruta citește sesiunea din cookie-uri, deci **nu are nevoie de niciun cod de
autentificare nativ**: partea nativă injectează jetonul în WebView, iar pagina
face un `fetch` obișnuit care poartă cookie-urile.

Scrierea trece prin clientul de SERVER (`createServerSupabase`), nu prin cel de
admin: RLS face exact filtrarea corectă — `user_id = auth.uid()` — iar un ocol
ar fi o slăbire fără câștig.

- [ ] **Pasul 1: Scrie testul schemei**

```ts
// src/lib/push/jeton.test.ts
import { describe, expect, it } from "vitest";

import { jetonSchema } from "./jeton";

describe("jetonSchema", () => {
  it("acceptă un jeton Expo valid", () => {
    const r = jetonSchema.safeParse({
      jeton: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      platforma: "android",
    });
    expect(r.success).toBe(true);
  });

  it("respinge un jeton de altă formă", () => {
    for (const rau of ["", "abc", "FCMToken[x]", "ExponentPushToken[]"]) {
      expect(jetonSchema.safeParse({ jeton: rau, platforma: "ios" }).success).toBe(false);
    }
  });

  it("respinge o platformă necunoscută", () => {
    const r = jetonSchema.safeParse({
      jeton: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
      platforma: "windows",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Pasul 2: Rulează ca să confirmi că pică**

```bash
pnpm exec vitest run --project unit src/lib/push/jeton.test.ts
```

Așteptat: FAIL cu `Failed to resolve import "./jeton"`.

- [ ] **Pasul 3: Scrie schema**

```ts
// src/lib/push/jeton.ts
import { z } from "zod";

/**
 * Aceeași formă ca `check` de pe `dispozitive_push.jeton` (0122). Dublarea e
 * deliberată: baza e bariera adevărată, dar un refuz de la ea ajunge la om ca
 * eroare de constrângere, nu ca mesaj. Aici se oprește devreme și cu explicație.
 */
export const jetonSchema = z.object({
  jeton: z.string().regex(/^ExponentPushToken\[[^\]]{1,200}\]$/, "Jeton de push nevalid."),
  platforma: z.enum(["ios", "android"]),
});
```

- [ ] **Pasul 4: Rulează testele — trebuie să treacă**

```bash
pnpm exec vitest run --project unit src/lib/push/jeton.test.ts
```

Așteptat: 3 teste verzi.

- [ ] **Pasul 5: Scrie ruta**

Citește întâi cum obține o rută existentă sesiunea și organizația curentă —
`src/app/api/export/salarizare/fluturas/route.ts` e cel mai apropiat model. Nu
inventa numele: `requireTenant` sau echivalentul lui pentru Route Handlers e
definit în `src/lib/auth/`; deschide fișierul înainte de a scrie.

```ts
// src/app/api/dispozitive/route.ts
import { jetonSchema } from "@/lib/push/jeton";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Înregistrarea jetonului de push al aplicației mobile.
 *
 * DE CE NU E NEVOIE DE COD DE AUTENTIFICARE NATIV
 * Partea nativă obține jetonul de la Expo și îl injectează în WebView. Pagina
 * face de acolo un `fetch` obișnuit, care poartă cookie-urile sesiunii. Ruta
 * știe deci cine e omul fără ca aplicația să vadă vreodată un token de sesiune.
 *
 * DE CE CLIENTUL DE SERVER, NU CEL DE ADMIN
 * RLS face exact filtrarea corectă (`user_id = auth.uid()`), iar politica de
 * INSERT cere și apartenența la organizație. Un ocol prin `service_role` ar fi
 * o slăbire fără niciun câștig.
 */
export async function POST(cerere: Request): Promise<Response> {
  const db = await createServerSupabase();
  const { data: sesiune } = await db.auth.getClaims();
  const userId = sesiune?.claims.sub;
  if (userId === undefined) return new Response("Not found", { status: 404 });

  const parsat = jetonSchema.safeParse(await cerere.json().catch(() => null));
  if (!parsat.success) {
    return Response.json({ ok: false, error: "Jeton de push nevalid." }, { status: 400 });
  }

  const { data: organizatie } = await db
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (organizatie === null) {
    return Response.json({ ok: false, error: "Fără organizație activă." }, { status: 409 });
  }

  // Upsert pe indexul PARȚIAL `dispozitive_push_jeton_uq`: `on conflict` cere ca
  // predicatul indexului să fie repetat, altfel Postgres răspunde 42P10.
  const { data, error } = await db
    .from("dispozitive_push")
    .upsert(
      {
        organization_id: organizatie.organization_id,
        user_id: userId,
        jeton: parsat.data.jeton,
        platforma: parsat.data.platforma,
        vazut_la: new Date().toISOString(),
        deleted_at: null,
      },
      { onConflict: "jeton" },
    )
    .select("id")
    .maybeSingle();

  // Un upsert respins de politică afectează ZERO rânduri, fără eroare. Rezultatul
  // gol e deci un refuz, nu un succes tăcut.
  if (error !== null || data === null) {
    return Response.json({ ok: false, error: "Înregistrarea a fost refuzată." }, { status: 403 });
  }
  return Response.json({ ok: true }, { status: 200 });
}

export async function DELETE(cerere: Request): Promise<Response> {
  const db = await createServerSupabase();
  const parsat = jetonSchema.pick({ jeton: true }).safeParse(await cerere.json().catch(() => null));
  if (!parsat.success) {
    return Response.json({ ok: false, error: "Jeton de push nevalid." }, { status: 400 });
  }

  // Retragerea e `deleted_at`, nu DELETE — nu există politică DELETE, prin
  // proiectare, iar jurnalul trebuie să păstreze de ce s-a oprit livrarea.
  const { data } = await db
    .from("dispozitive_push")
    .update({ deleted_at: new Date().toISOString() })
    .eq("jeton", parsat.data.jeton)
    .is("deleted_at", null)
    .select("id");

  return Response.json({ ok: true, retrase: data?.length ?? 0 }, { status: 200 });
}
```

> **Verifică înainte de a scrie:** numele exact al clientului de server
> (`createServerSupabase`) și forma lui `getClaims()` — proiectul a trecut recent
> de la `getUser()` la `getClaims()` (commit `a32e04a`). Deschide
> `src/lib/auth/current-user.ts` și copiază de acolo, nu din planul ăsta.

- [ ] **Pasul 6: Verifică lanțul și comite**

```bash
pnpm typecheck && pnpm lint && pnpm test
git status --short -- src/lib/push/ src/app/api/dispozitive/
git fetch origin main
git commit --only -m "feat(push): înregistrarea și retragerea jetonului de dispozitiv" -- \
  src/lib/push/jeton.ts src/lib/push/jeton.test.ts src/app/api/dispozitive/route.ts
git merge origin/main --no-edit && git push origin main
```

---

## Task 6: Timerul de pe VM

**Fișiere:**

- Creează: `deploy/push-livrare.service`
- Creează: `deploy/push-livrare.timer`
- Modifică: `DEPLOY.md` (sau documentul de operare echivalent — verifică ce există)

Copiază structura din `deploy/reges-reconciliere.{service,timer}` — inclusiv
motivația scrisă în comentarii, adaptată.

- [ ] **Pasul 1: Scrie unitatea de serviciu**

```ini
# deploy/push-livrare.service
#
# Golește coada de notificări push.
#
# Instalare pe VM:
#   sudo cp deploy/push-livrare.{service,timer} /etc/systemd/system/
#   sudo systemctl daemon-reload
#   sudo systemctl enable --now push-livrare.timer
#   systemctl list-timers push-livrare
#
# Secretul se citește din /etc/administrativo/push.env, o singură linie:
#   PUSH_CRON_SECRET=<aceeași valoare ca în .env.production>
# Fișierul are 0600 și aparține lui root: dat pe linia de comandă, `curl` l-ar
# expune în `ps`.
#
# DE CE UN TIMER, ȘI NU pg_cron
# `pg_net` nu e activat pe instanța noastră de Supabase, deci un job SQL n-are
# cum să iasă pe HTTP către exp.host. Aceeași constrângere ca la REGES.
#
# DE CE E SIGUR CU DOUĂ REPLICI
# Decide baza, nu timerul: `public.push_ia_din_coada` ia rândurile cu
# `for update skip locked`, deci a doua replică primește alt lot sau niciunul.

[Unit]
Description=Livrarea notificărilor push (Administrativo)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/administrativo/push.env
ExecStart=/bin/sh -c '\
  cod=$(curl -sS -m 60 -o /tmp/push-raspuns.json -w "%{http_code}" \
        -X POST -H "Authorization: Bearer $PUSH_CRON_SECRET" \
        http://127.0.0.1:3000/api/push/livreaza); \
  echo "push: HTTP $cod $(cat /tmp/push-raspuns.json)"; \
  case "$cod" in 200) exit 0 ;; *) exit 1 ;; esac'
TimeoutStartSec=90

[Install]
WantedBy=multi-user.target
```

- [ ] **Pasul 2: Scrie timerul**

```ini
# deploy/push-livrare.timer
#
# La un minut. O notificare care ajunge pe telefon la trei minute după aprobare
# nu mai e o notificare, e un raport. Costul e o cerere HTTP locală pe minut,
# care nu atinge baza dacă nu are ce lua: `push_ia_din_coada` întoarce zero
# rânduri și ruta răspunde imediat.
#
# `Persistent=false`, spre deosebire de REGES: o coadă rămasă în urmă cât VM-ul
# a fost oprit se golește oricum la prima rulare, iar o notificare veche de
# câteva ore nu merită trimisă de două ori la pornire.

[Unit]
Description=Programează livrarea notificărilor push

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
Persistent=false
RandomizedDelaySec=10
Unit=push-livrare.service

[Install]
WantedBy=timers.target
```

- [ ] **Pasul 3: Adaugă secretul în `.env.production` pe VM**

Nu în repo. `PUSH_CRON_SECRET=<valoare generată>`, aceeași valoare și în
`/etc/administrativo/push.env`. Generare:

```bash
openssl rand -base64 32
```

- [ ] **Pasul 4: Verifică pe VM, după deploy**

```bash
sudo systemctl start push-livrare.service
journalctl -u push-livrare -n 20 --no-pager
```

Așteptat: `push: HTTP 200 {"luate":0,...}`. Un `404` înseamnă secret nepotrivit
sau gol — nu rută lipsă.

- [ ] **Pasul 5: Comite**

```bash
git status --short -- deploy/
git fetch origin main
git commit --only -m "feat(push): timer systemd pentru golirea cozii" -- deploy/push-livrare.service deploy/push-livrare.timer
git merge origin/main --no-edit && git push origin main
```

---

## Task 7: Scheletul aplicației Expo

**Fișiere:**

- Creează: `mobil/package.json`, `mobil/pnpm-workspace.yaml`, `mobil/app.config.ts`,
  `mobil/App.tsx`, `mobil/tsconfig.json`, `mobil/.gitignore`, `mobil/README.md`
- Modifică: `tsconfig.json`, `eslint.config.mjs`, `vitest.config.mts`,
  `.prettierignore`, `.dockerignore`

### Capcana care trebuie evitată din prima

`pnpm-workspace.yaml` de la rădăcină conține doar `ignoredBuiltDependencies`,
fără câmp `packages:`. Sub o astfel de rădăcină, **`pnpm install` într-un
subdirector raportează „Done" cu cod de ieșire 0 și nu instalează nimic** — nici
`node_modules/`, nici lockfile. Verificat empiric pe 2026-09-03, reprodus de trei
ori, inclusiv cu `--dir` explicit.

Leacul e `mobil/pnpm-workspace.yaml` propriu. **NU** se adaugă `packages:` la
rădăcină: ar schimba semantica instalării pentru toate sesiunile concurente și
pentru CI.

- [ ] **Pasul 1: Creează directorul cu granița de workspace**

```bash
mkdir -p mobil
printf 'packages:\n  - "."\n' > mobil/pnpm-workspace.yaml
```

- [ ] **Pasul 2: Verifică imediat că instalarea chiar face ceva**

```bash
cd mobil
pnpm init
pnpm add ms@2.1.3
ls node_modules/ms && echo "IZOLAREA FUNCȚIONEAZĂ"
pnpm remove ms
cd ..
```

Așteptat: `IZOLAREA FUNCȚIONEAZĂ`. Dacă `node_modules/ms` lipsește, granița n-a
prins — nu continua, reia pasul 1.

- [ ] **Pasul 3: Creează proiectul Expo**

```bash
cd mobil
pnpm create expo-app@latest . --template blank-typescript
pnpm add react-native-webview expo-notifications expo-local-authentication \
        expo-camera expo-print expo-sharing expo-linking expo-constants
cd ..
```

- [ ] **Pasul 4: Exclude `mobil/` din uneltele de la rădăcină**

În `tsconfig.json`, câmpul `exclude` (azi: `["node_modules"]`):

```json
  "exclude": ["node_modules", "mobil"]
```

În `eslint.config.mjs`, la apelul `globalIgnores([...])` de la finalul fișierului
(azi: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`, `docs/design/**`,
`.remember/**`), adaugă o intrare:

```js
    // Aplicația mobilă are propriul lanț de unelte, propriul tsconfig și
    // propriul lockfile. Regulile de aici — granița server/client, restricția pe
    // clientul admin — n-au niciun înțeles în React Native.
    "mobil/**",
```

În `vitest.config.mts`, niciun proiect nu ridică `mobil/`: `unit` include
`src/**/*.test.ts`, `ui` include `src/**/*.test.tsx`, `rls` include
`tests/rls/**`. **Nu e nevoie de modificare** — verifică și mergi mai departe.

În `.prettierignore`, adaugă pe o linie nouă:

```
mobil/
```

În `.dockerignore`, lângă `docs/` și `supabase/`:

```
# Aplicația mobilă nu intră în imaginea serverului: se construiește la EAS.
mobil/
```

- [ ] **Pasul 5: Scrie învelișul minim**

```tsx
// mobil/App.tsx
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useRef } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Portalul de angajat, într-un WebView.
 *
 * Aplicația NU rescrie niciun ecran: conținutul e `administrativo.ro/portal`,
 * deci fiecare livrare web apare instantaneu și în aplicație, fără review de
 * magazin. Ce se adaugă aici e strict ce browserul de pe telefon nu poate da.
 */
const URL_PORTAL =
  (Constants.expoConfig?.extra?.urlPortal as string) ?? "https://administrativo.ro/portal";

export default function App() {
  const webview = useRef<WebView>(null);
  return (
    <SafeAreaView style={stiluri.ecran}>
      <StatusBar style="light" />
      <WebView
        ref={webview}
        source={{ uri: URL_PORTAL }}
        // Sesiunea trăiește în cookie jar-ul propriu al aplicației, separat de
        // Safari și Chrome. De aceea login-ul de aici e o sesiune NOUĂ, nu o
        // copie — iar rotația refresh token-ului Supabase o tratează normal.
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        // Fără asta, un `history.back()` din portal închide aplicația.
        allowsBackForwardNavigationGestures
      />
    </SafeAreaView>
  );
}

const stiluri = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: "#0f1e3d" },
});
```

`#0f1e3d` e `theme_color` din `src/app/manifest.ts` — aceeași valoare, ca bara de
stare să nu bată cu antetul portalului.

- [ ] **Pasul 6: Configurația aplicației**

```ts
// mobil/app.config.ts
import type { ExpoConfig } from "expo/config";

/**
 * URL-ul portalului e singura valoare care se schimbă între medii. Nu se scrie
 * literal în App.tsx: la trecerea pe subdomenii per firmă, aici e locul unde se
 * schimbă, o dată.
 */
const URL_PORTAL = process.env.URL_PORTAL ?? "https://administrativo.ro/portal";

const config: ExpoConfig = {
  name: "Administrativo",
  slug: "administrativo",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "administrativo",
  userInterfaceStyle: "automatic",
  backgroundColor: "#faf7f0",
  ios: {
    bundleIdentifier: "ro.administrativo.portal",
    supportsTablet: false,
    infoPlist: {
      // Textele apar în dialogul de permisiune. Formulate pentru un angajat,
      // nu pentru un dezvoltator — magazinele resping textele generice.
      NSCameraUsageDescription:
        "Camera se folosește doar pentru scanarea codului de pontare afișat la punctul de lucru.",
      NSFaceIDUsageDescription:
        "Face ID deblochează aplicația, ca datele dumneavoastră de salariu și pontaj să nu fie vizibile dacă telefonul ajunge în altă mână.",
    },
  },
  android: {
    package: "ro.administrativo.portal",
    adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: "#0f1e3d" },
    permissions: ["CAMERA", "USE_BIOMETRIC", "POST_NOTIFICATIONS"],
  },
  plugins: ["expo-notifications", "expo-camera", "expo-local-authentication"],
  extra: { urlPortal: URL_PORTAL, eas: { projectId: "" } },
};

export default config;
```

`eas.projectId` se completează de `eas init` la Task 11 — se lasă gol acum, nu se
inventează.

- [ ] **Pasul 7: Verifică lanțul de la rădăcină, neschimbat**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Așteptat: verde, cu **același număr de teste ca înainte**. Dacă `tsc` începe să
se plângă de fișiere din `mobil/`, excluderea de la pasul 4 n-a prins.

- [ ] **Pasul 8: Comite**

```bash
git status --short -- mobil/ tsconfig.json eslint.config.mjs .prettierignore .dockerignore
git fetch origin main
git commit --only -m "feat(mobil): schelet Expo cu WebView peste portal, izolat de lanțul de verificare" -- \
  mobil/ tsconfig.json eslint.config.mjs .prettierignore .dockerignore
git merge origin/main --no-edit && git push origin main
```

---

## Task 8: Push nativ, capăt la capăt

**Fișiere:**

- Creează: `mobil/push.ts`
- Modifică: `mobil/App.tsx`

**Interfețe:**

- Consumă: `POST /api/dispozitive` (Task 5).
- Produce:

  ```ts
  export async function cereJeton(): Promise<string | null>;
  export function scriptDeInregistrare(jeton: string, platforma: "ios" | "android"): string;
  ```

- [ ] **Pasul 1: Scrie modulul de push**

```ts
// mobil/push.ts
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Obținerea jetonului de push și injectarea lui în WebView.
 *
 * DE CE INJECTARE ȘI NU UN APEL NATIV
 * Un `fetch` din partea nativă n-ar purta cookie-urile sesiunii — acelea trăiesc
 * în cookie jar-ul WebView-ului. Injectat, apelul pleacă DIN pagină, deci e
 * autentificat fără ca aplicația să atingă vreodată un token.
 */

/** Canalul e obligatoriu pe Android 8+; fără el, notificarea nu se afișează. */
const CANAL = "implicit";

export async function cereJeton(): Promise<string | null> {
  // Emulatoarele nu primesc jetoane. Fără ramura asta, dezvoltarea locală pare
  // ruptă când de fapt e doar un emulator.
  if (!Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: "Notificări",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existent } = await Notifications.getPermissionsAsync();
  let status = existent;
  if (status !== "granted") {
    // Android 13+ cere POST_NOTIFICATIONS la execuție; iOS cere întotdeauna.
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return null;

  const { data } = await Notifications.getExpoPushTokenAsync();
  return data;
}

/**
 * Scriptul rulat ÎN pagină. Se termină cu `true;` pentru că altfel
 * `injectJavaScript` avertizează pe iOS despre o valoare de retur nesincronizată.
 */
export function scriptDeInregistrare(jeton: string, platforma: "ios" | "android"): string {
  const corp = JSON.stringify({ jeton, platforma });
  return `
    fetch("/api/dispozitive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: ${JSON.stringify(corp)},
      credentials: "same-origin"
    }).catch(function () {});
    true;
  `;
}
```

- [ ] **Pasul 2: Leagă-l în `App.tsx`**

Adaugă în `App.tsx`, peste ce există:

```tsx
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { cereJeton, scriptDeInregistrare } from "./push";

// Notificarea primită cu aplicația deschisă se afișează oricum: altfel un om
// care stă în aplicație nu vede că i s-a aprobat cererea decât dacă navighează.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});
```

Și în componentă:

```tsx
// Jetonul se înregistrează DUPĂ ce pagina s-a încărcat: înainte, `fetch` din
// pagină n-ar avea încă cookie-urile sesiunii.
const inregistreaza = async () => {
  const jeton = await cereJeton();
  if (jeton === null) return;
  const platforma = Platform.OS === "ios" ? "ios" : "android";
  webview.current?.injectJavaScript(scriptDeInregistrare(jeton, platforma));
};

useEffect(() => {
  const abonament = Notifications.addNotificationResponseReceivedListener((raspuns) => {
    const cale = raspuns.notification.request.content.data?.cale;
    // Calea vine deja validată de bază (`check (link ~ '^/[^/\\]')` pe
    // notifications.link) ȘI de `construiesteMesaj`. A treia verificare e aici
    // pentru că asta e singura care rulează în procesul care chiar navighează.
    if (typeof cale === "string" && /^\/[^/\\]/.test(cale)) {
      webview.current?.injectJavaScript(`location.assign(${JSON.stringify(cale)}); true;`);
    }
  });
  return () => abonament.remove();
}, []);
```

Și pe `<WebView>`: `onLoadEnd={inregistreaza}`.

- [ ] **Pasul 3: Probează pe telefon real**

```bash
cd mobil && pnpm expo start
```

Scanează cu Expo Go, autentifică-te în portal, apoi verifică în bază:

```sql
select platforma, left(jeton, 30), vazut_la from public.dispozitive_push order by created_at desc limit 3;
```

Așteptat: un rând. Zero rânduri înseamnă că `onLoadEnd` a rulat înainte de login
— pune înregistrarea și pe `onNavigationStateChange`, când URL-ul intră pe
`/portal`.

- [ ] **Pasul 4: Probează livrarea, capăt la capăt**

Scrie o notificare de mână și golește coada:

```sql
insert into public.notifications (organization_id, user_id, kind, title, body, link)
values ('<org>', '<user>', 'approval', 'Probă de push.', 'Dacă vezi asta, merge.', '/portal');
```

```bash
curl -sS -X POST -H "Authorization: Bearer $PUSH_CRON_SECRET" \
     https://administrativo.ro/api/push/livreaza
```

Așteptat: `{"luate":1,"trimise":1,...}` și notificarea pe telefon. O atingere pe
ea trebuie să deschidă `/portal`.

- [ ] **Pasul 5: Comite**

```bash
git status --short -- mobil/
git fetch origin main
git commit --only -m "feat(mobil): jeton de push injectat din pagină și deep link la atingere" -- mobil/push.ts mobil/App.tsx
git merge origin/main --no-edit && git push origin main
```

---

## Task 9: Descărcări și tipărire

**Fișiere:**

- Creează: `mobil/fisiere.ts`
- Modifică: `mobil/App.tsx`

Fără asta, aplicația e **mai proastă decât site-ul**: fluturașul
(`/api/export/salarizare/fluturas`, PDF cu `content-disposition: attachment`) și
adeverința (`/portal/cursurile-mele/[id]/adeverinta`, HTML de tipărit) eșuează în
tăcere într-un WebView netratat.

- [ ] **Pasul 1: Scrie modulul**

```ts
// mobil/fisiere.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

/**
 * Cele două căi care se rup tăcut într-un WebView.
 *
 * Descărcarea și tipărirea nu sunt funcții „în plus": fără ele, un angajat care
 * nu-și poate scoate fluturașul din aplicație — dar poate din Chrome — șterge
 * iconița.
 */

/** Rutele de export întorc PDF cu `content-disposition: attachment`. */
export function eDescarcare(url: string): boolean {
  return url.includes("/api/export/");
}

/** Adeverința de curs întoarce HTML destinat tipăririi. */
export function eTiparire(url: string): boolean {
  return /\/portal\/cursurile-mele\/[^/]+\/adeverinta$/.test(url);
}

/**
 * Scriptul care aduce fișierul DIN pagină — deci cu cookie-urile sesiunii — și
 * îl trimite nativ. `httpOnly: false` din `optiuni-cookie.ts` nu e nici măcar
 * necesar aici: `fetch` cu `credentials: "same-origin"` trimite cookie-ul
 * indiferent.
 */
export function scriptDeAducere(url: string, fel: "pdf" | "html"): string {
  return `
    (function () {
      fetch(${JSON.stringify(url)}, { credentials: "same-origin" })
        .then(function (r) { return ${fel === "pdf" ? "r.blob()" : "r.text()"}; })
        .then(function (continut) {
          ${
            fel === "pdf"
              ? `var citire = new FileReader();
                 citire.onloadend = function () {
                   window.ReactNativeWebView.postMessage(JSON.stringify({
                     fel: "pdf", nume: ${JSON.stringify(numeDinUrl(url))}, date: citire.result
                   }));
                 };
                 citire.readAsDataURL(continut);`
              : `window.ReactNativeWebView.postMessage(JSON.stringify({ fel: "html", date: continut }));`
          }
        })
        .catch(function () {});
    })();
    true;
  `;
}

function numeDinUrl(url: string): string {
  const fara = url.split("?")[0] ?? "";
  const ultim = fara.split("/").pop() ?? "document";
  return ultim.endsWith(".pdf") ? ultim : `${ultim}.pdf`;
}

export async function salveazaPdf(nume: string, dataUri: string): Promise<void> {
  const base64 = dataUri.split(",")[1] ?? "";
  const cale = `${FileSystem.cacheDirectory}${nume}`;
  await FileSystem.writeAsStringAsync(cale, base64, { encoding: "base64" });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(cale, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
  }
}

export async function tipareste(html: string): Promise<void> {
  await Print.printAsync({ html });
}
```

- [ ] **Pasul 2: Leagă interceptarea în `App.tsx`**

Pe `<WebView>`:

```tsx
        onShouldStartLoadWithRequest={(cerere) => {
          if (eDescarcare(cerere.url)) {
            webview.current?.injectJavaScript(scriptDeAducere(cerere.url, "pdf"));
            return false;
          }
          if (eTiparire(cerere.url)) {
            webview.current?.injectJavaScript(scriptDeAducere(cerere.url, "html"));
            return false;
          }
          return true;
        }}
        onMessage={async (eveniment) => {
          const mesaj = JSON.parse(eveniment.nativeEvent.data) as
            | { fel: "pdf"; nume: string; date: string }
            | { fel: "html"; date: string };
          if (mesaj.fel === "pdf") await salveazaPdf(mesaj.nume, mesaj.date);
          else await tipareste(mesaj.date);
        }}
```

- [ ] **Pasul 3: Probează pe telefon real**

Deschide `/portal/salariul-meu` → butonul de fluturaș → trebuie să apară foaia de
partajare a sistemului cu un PDF care se deschide.
Deschide un curs terminat → adeverința → trebuie să apară dialogul de tipărire.

Așteptat, în ambele cazuri: **ceva se întâmplă**. Comportamentul de dinaintea
acestei sarcini e „nu se întâmplă nimic, fără niciun mesaj" — dacă îl mai vezi,
verifică întâi că `onShouldStartLoadWithRequest` chiar prinde URL-ul (loghează-l).

- [ ] **Pasul 4: Comite**

```bash
git status --short -- mobil/
git fetch origin main
git commit --only -m "feat(mobil): descărcarea fluturașului și tipărirea adeverinței" -- mobil/fisiere.ts mobil/App.tsx
git merge origin/main --no-edit && git push origin main
```

---

## Task 10: Lacăt biometric și scanner QR

**Fișiere:**

- Creează: `mobil/lacat.tsx`, `mobil/scanner.tsx`
- Modifică: `mobil/App.tsx`

- [ ] **Pasul 1: Scrie lacătul**

```tsx
// mobil/lacat.tsx
import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Ecran opac peste WebView, deblocat cu Face ID sau amprentă.
 *
 * NU atinge sesiunea. Biometrie eșuată înseamnă ecran acoperit, nu deconectare —
 * un lacăt care ar șterge sesiunea ar transforma un deget umed într-o
 * reautentificare cu parolă, pe un telefon de șantier.
 *
 * Dacă telefonul n-are biometrie înregistrată, lacătul nu se aplică deloc:
 * altfel aplicația ar deveni imposibil de deschis pe un telefon fără PIN.
 */
export function Lacat({ copil }: { readonly copil: React.ReactNode }) {
  const [blocat, setBlocat] = useState(false);
  const [disponibil, setDisponibil] = useState(false);

  useEffect(() => {
    void (async () => {
      const are = await LocalAuthentication.hasHardwareAsync();
      const inregistrat = await LocalAuthentication.isEnrolledAsync();
      setDisponibil(are && inregistrat);
    })();
  }, []);

  useEffect(() => {
    if (!disponibil) return;
    const abonament = AppState.addEventListener("change", (stare) => {
      if (stare === "background") setBlocat(true);
    });
    return () => abonament.remove();
  }, [disponibil]);

  const deblocheaza = async () => {
    const rezultat = await LocalAuthentication.authenticateAsync({
      promptMessage: "Deblocați Administrativo",
      cancelLabel: "Anulează",
    });
    if (rezultat.success) setBlocat(false);
  };

  return (
    <View style={stiluri.plin}>
      {copil}
      {blocat ? (
        <Pressable style={stiluri.valul} onPress={deblocheaza}>
          <Text style={stiluri.text}>Atingeți pentru a debloca</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const stiluri = StyleSheet.create({
  plin: { flex: 1 },
  valul: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f1e3d",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: "#faf7f0", fontSize: 16 },
});
```

- [ ] **Pasul 2: Scrie scannerul**

```tsx
// mobil/scanner.tsx
import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Scanner de coduri QR pentru pontarea la punctul de lucru.
 *
 * Afișul poartă un URL `https://administrativo.ro/portal/ponteaza/<cod>`. Codul
 * NU e o dovadă în sine — acțiunea îl rezolvă din nou pe server, cu filtru pe
 * organizație. Aici doar se transportă, exact ca pe web.
 */
export function Scanner({
  deschis,
  inchide,
  mergiLa,
}: {
  readonly deschis: boolean;
  readonly inchide: () => void;
  readonly mergiLa: (cale: string) => void;
}) {
  const [permisiune, cerePermisiune] = useCameraPermissions();
  const [prins, setPrins] = useState(false);

  return (
    <Modal visible={deschis} animationType="slide" onRequestClose={inchide}>
      <View style={stiluri.plin}>
        {permisiune?.granted !== true ? (
          <Pressable style={stiluri.centru} onPress={() => void cerePermisiune()}>
            <Text style={stiluri.text}>Atingeți pentru a permite accesul la cameră</Text>
          </Pressable>
        ) : (
          <CameraView
            style={stiluri.plin}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (prins) return;
              // Se acceptă DOAR calea de pontare de pe domeniul nostru. Un cod QR
              // e text scris de oricine: fără filtrul ăsta, un afiș lipit peste
              // al nostru ar duce aplicația semnată pe orice site.
              const potrivire =
                /^https:\/\/administrativo\.ro(\/portal\/ponteaza\/[A-Za-z0-9_-]+)$/.exec(data);
              if (potrivire?.[1] === undefined) return;
              setPrins(true);
              mergiLa(potrivire[1]);
              inchide();
              setTimeout(() => setPrins(false), 1000);
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const stiluri = StyleSheet.create({
  plin: { flex: 1, backgroundColor: "#0f1e3d" },
  centru: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  text: { color: "#faf7f0", fontSize: 16, textAlign: "center" },
});
```

- [ ] **Pasul 3: Leagă-le în `App.tsx`**

```tsx
// în App.tsx, peste ce există
import { useState } from "react";           // adaugă-l la importul existent din "react"
import { Pressable, Text } from "react-native";  // idem, la cel din "react-native"

import { Lacat } from "./lacat";
import { Scanner } from "./scanner";

// …în componentă:
  const [scannerDeschis, setScannerDeschis] = useState(false);

  const mergiLa = (cale: string) => {
    webview.current?.injectJavaScript(`location.assign(${JSON.stringify(cale)}); true;`);
  };

// …și în JSX, învelișul complet:
  return (
    <Lacat copil={
      <SafeAreaView style={stiluri.ecran}>
        <StatusBar style="light" />
        <WebView ref={webview} source={{ uri: URL_PORTAL }} {/* …restul propietăților */} />
        <Pressable style={stiluri.butonScanner} onPress={() => setScannerDeschis(true)}>
          <Text style={stiluri.butonText}>Scanează codul</Text>
        </Pressable>
        <Scanner
          deschis={scannerDeschis}
          inchide={() => setScannerDeschis(false)}
          mergiLa={mergiLa}
        />
      </SafeAreaView>
    } />
  );
```

Și în `stiluri`:

```ts
  butonScanner: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#0f1e3d",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  butonText: { color: "#faf7f0", fontSize: 15 },
```

Butonul stă deasupra WebView-ului, nu în portal: pe web nu are ce căuta, fiindcă
acolo scanarea o face aplicația de cameră a telefonului.

- [ ] **Pasul 4: Probează pe telefon real**

- Trimite aplicația în fundal și readu-o: trebuie să apară vălul.
- Scanează un afiș de pontare: trebuie să aterizeze pe `/portal/ponteaza/<cod>`.
- Scanează un QR oarecare (de exemplu un link către alt site): **nu trebuie să se
  întâmple nimic**.

- [ ] **Pasul 5: Comite**

```bash
git status --short -- mobil/
git fetch origin main
git commit --only -m "feat(mobil): lacăt biometric și scanner QR pentru pontare" -- mobil/lacat.tsx mobil/scanner.tsx mobil/App.tsx
git merge origin/main --no-edit && git push origin main
```

---

## Task 11: Build EAS și publicare

**Fișiere:**

- Creează: `mobil/eas.json`
- Modifică: `mobil/app.config.ts` (completează `eas.projectId`)

Depinde de Task 0. Nu se începe fără conturile de magazin.

- [ ] **Pasul 1: Leagă proiectul de EAS**

```bash
cd mobil
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest init
```

`eas init` scrie `projectId` — copiază-l în `app.config.ts`, la `extra.eas`.

- [ ] **Pasul 2: Scrie `eas.json`**

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "intern": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "URL_PORTAL": "https://administrativo.ro/portal" }
    },
    "productie": {
      "autoIncrement": true,
      "env": { "URL_PORTAL": "https://administrativo.ro/portal" }
    }
  },
  "submit": { "productie": {} }
}
```

- [ ] **Pasul 3: Build intern și probă pe telefon**

```bash
pnpm dlx eas-cli@latest build --profile intern --platform android
```

Instalează APK-ul și reia probele din Task 8 pasul 4, Task 9 pasul 3 și Task 10
pasul 4 — **pe build-ul standalone, nu pe Expo Go**. Diferența contează: Expo Go
partajează credențiale de push cu Expo, build-ul standalone folosește cheile
tale.

- [ ] **Pasul 4: Încarcă credențialele de platformă**

```bash
pnpm dlx eas-cli@latest credentials
```

Android: contul de serviciu FCM V1 (fișier JSON din Firebase Console).
iOS: EAS generează cheia APNs singur, dacă are contul Apple.

- [ ] **Pasul 5: Build de producție și trimitere**

```bash
pnpm dlx eas-cli@latest build --profile productie --platform all
pnpm dlx eas-cli@latest submit --profile productie --platform all
```

- [ ] **Pasul 6: Pregătește dosarul de magazin**

Capturi de ecran, descriere în română, URL-ul politicii de confidențialitate
(`https://administrativo.ro/legal/confidentialitate`), formularele de
confidențialitate (App Privacy la Apple, Data Safety la Google).

**Declară onest ce se colectează:** identificatori de utilizator, date de
angajare, jetonul de push. O declarație greșită se descoperă la review și costă
un ciclu.

- [ ] **Pasul 7: Dacă Apple respinge pe 4.2**

Nu e o surpriză, e riscul numit în specificație §11.1. Răspunsul în nota de
review enumeră ce face aplicația și browserul nu: notificări push, deblocare
biometrică, scanner QR nativ, tipărire nativă. Dacă tot nu trece, sarcina
următoare e ecranul nativ de pontare din varianta C a discuției de design — nu o
rescriere.

- [ ] **Pasul 8: Comite**

```bash
git status --short -- mobil/
git fetch origin main
git commit --only -m "feat(mobil): configurație EAS Build pentru cele două magazine" -- mobil/eas.json mobil/app.config.ts
git merge origin/main --no-edit && git push origin main
```

---

## Ce rămâne de prins de `pnpm build`

Planul nu rulează `pnpm build`, la cererea explicită a utilizatorului. Lucrurile
pe care **numai** build-ul le-ar prinde, în ce s-a scris aici:

- Granița server/client în cele două rute noi (`api/push/livreaza`,
  `api/dispozitive`) — un import care trage `server-only` într-un bundle de
  client sparge build-ul, iar `tsc` tace.
- `src/lib/push/coada.ts` importă `AdminSupabase`, care e `server-only`. Testele
  trec prin aliasul din `vitest.config.mts`; build-ul nu are aliasul.

Ambele se verifică cu `pnpm build` de către utilizator, sau în CI.
