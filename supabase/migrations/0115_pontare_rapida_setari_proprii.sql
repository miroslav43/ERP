-- supabase/migrations/0115_pontare_rapida_setari_proprii.sql
--
-- Pontarea rapidă își primește tabela proprie, nevesionată, și codul QR capătă
-- o a treia stare — `optional`.
--
-- ── DE CE NU MERGEA NIMIC, DE FAPT ──────────────────────────────────────────
-- Starea reală a bazei, citită înainte de a scrie migrarea asta:
--
--   Administrativo Demo SRL   2 rânduri de setări, ambele mod='oprit'
--   Beta Demo SRL             0 rânduri   (feature attendance stins)
--   Wiselearning S.R.L.       0 rânduri   ← firma care ARE afiș QR tipăribil
--                                          („Sediu Mare", cod_pontaj generat)
--
-- Wiselearning are modulul pornit, are punct de lucru cu cod, deci are afiș —
-- și n-are niciun rând de setări. Toate cele trei ecrane de pontare citesc
-- `setari?.mod_pontare_rapida ?? 'oprit'`, deci omul scanează afișul, ajunge pe
-- `/portal/ponteaza/<cod>` și citește „Pontarea prin cod nu e activată. Afișul
-- pe care l-ați scanat e probabil vechi."
--
-- S-a încercat întâi mutarea implicitului pe coloană (o migrare `0114`, scrisă
-- și ștearsă în aceeași zi, de aici golul din numerotare). NU repară nimic:
-- `alter column … set default` nu atinge rânduri existente și nu creează rânduri
-- lipsă, iar `update … where mod_pontare_rapida = 'oprit'` n-are ce actualiza
-- într-o firmă cu zero rânduri. Pentru Wiselearning ar fi fost un no-op complet.
--
-- Ce decide comportamentul e implicitul din APLICAȚIE, nu cel al coloanei — de
-- aceea migrarea asta nu seedează nimic: lipsa rândului devine o stare validă,
-- cu implicite utile, exact ca `configZiDin` pentru orele de lucru.
--
-- ── DE CE O TABELĂ NOUĂ ȘI NU ÎNCĂ O COLOANĂ ────────────────────────────────
-- `attendance_settings` e versionată prin `valabil_de_la`, și pe bună dreptate:
-- o lună deja calculată trebuie să rămână explicabilă cu parametrii de atunci.
-- Dar cele trei coloane de pontare rapidă n-au ce căuta într-un istoric —
-- nimeni nu recalculează martie din „era codul QR obligatoriu atunci".
--
-- Consecința pe ecran era zidul: ca să pornești butonul de pontare trebuia să
-- reconfirmi optsprezece cifre de dreptul muncii ȘI să alegi o dată de intrare
-- în vigoare. Un patron cu doi angajați nu trece de acolo.
--
-- Deci: un rând per firmă, fără `valabil_de_la`, cu propriul ecran care se
-- salvează dintr-o apăsare.
--
-- ── DE CE `optional` ────────────────────────────────────────────────────────
-- `verificare_pontare` avea două valori, iar a doua înseamnă OBLIGATORIU: cu
-- `cod_qr` pornit, butonul „Am intrat" de pe ecranul de start nu se mai
-- desenează deloc (`portal/pontare-rapida.tsx`, ramura `cereCod`). Cine n-are
-- afișul lângă el nu mai poate ponta.
--
-- Nu exista deci nicio stare care să însemne „afișul funcționează pentru cine
-- îl scanează, butonul rămâne pentru restul" — adică fix ce vrea o firmă care
-- tocmai a tipărit primul afiș. `optional` e starea aia, și e implicitul: o
-- firmă fără niciun punct de lucru cu cod nu simte nimic (n-are ce scana), iar
-- una cu afiș îl poate folosi din prima, fără să configureze nimic.
--
-- ── CE NU SE ATINGE ─────────────────────────────────────────────────────────
-- Cele trei coloane rămân pe `attendance_settings`, cu un comentariu care spune
-- că nu se mai citesc — tiparul lui 0082 cu `spor_*_procent`. Un `drop column`
-- ar deschide o fereastră de 42703 între aplicarea migrării și deploy-ul
-- codului, pe o bază care e și de dezvoltare, și de producție.
--
-- Niciun parametru juridic nu se schimbă. Forward-only: 0013 și 0096 nu se
-- editează.

\set ON_ERROR_STOP on

-- =====================================================================================
-- 1. Valoarea de enum, în tranzacția ei
-- =====================================================================================
-- `alter type ... add value` nu poate fi FOLOSIT în aceeași tranzacție în care e
-- adăugat (Postgres 17 permite comanda într-o tranzacție, dar nu și referirea
-- valorii noi înainte de commit). Secțiunea 2 o folosește ca `default`, deci
-- commit aici. Aceeași structură ca 0064_concedii_tip_zi_si_plafon.sql §1.

begin;

alter type public.verificare_pontare add value if not exists 'optional';

commit;

begin;

comment on type public.verificare_pontare is
  'Ce dovadă de prezență cere firma la pontarea rapidă. `fara` — pe încredere, '
  'ca formularul cu ore. `optional` (0115) — afișul de la punctul de lucru '
  'ponteaza și înregistrează punctul, dar butonul obișnuit rămâne disponibil; '
  'e implicitul, fiindcă nu blochează pe nimeni și pornește QR-ul acolo unde '
  'există afiș. `cod_qr` — OBLIGATORIU: butonul de pe ecranul de start dispare '
  'și se ponteaza exclusiv prin scanare. Codul dovedește că cineva a fost lângă '
  'afiș, nu că angajatul era acolo — e o frână, nu o probă.';

-- =====================================================================================
-- 2. setari_pontare_rapida — un rând per firmă, fără istoric
-- =====================================================================================

create table public.setari_pontare_rapida (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  mod_pontare_rapida public.mod_pontare_rapida not null default 'ceas',
  verificare_pontare public.verificare_pontare not null default 'optional',
  program_start      time,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users (id) on delete set null,
  updated_by         uuid references auth.users (id) on delete set null,
  deleted_at         timestamptz,
  constraint setari_pontare_rapida_program_ck
    check (mod_pontare_rapida not in ('confirmare', 'ambele') or program_start is not null)
);

comment on table public.setari_pontare_rapida is
  'Cum se pontează angajatul de pe telefon: un rând per organizație, FĂRĂ '
  'valabil_de_la. Deliberat nevesionată — spre deosebire de attendance_settings, '
  'de unde vin cele trei coloane, aici nu există nimic de reconstituit pentru o '
  'lună trecută. Lipsa rândului e o stare normală: aplicația cade pe implicitele '
  'din src/domain/attendance/pontare-rapida.ts, aceleași cu `default`-urile de '
  'mai sus.';

comment on column public.setari_pontare_rapida.mod_pontare_rapida is
  'Ce butoane vede angajatul. `ceas` e implicitul fiindcă e singurul mod care '
  'funcționează într-o firmă neconfigurată: `confirmare` și `ambele` propun un '
  'interval derivat din program_start, iar fără el butonul nici nu s-ar desena.';

comment on column public.setari_pontare_rapida.program_start is
  'Ora de început a programului standard. Ora de SFÂRȘIT nu se stochează: se '
  'derivă din normă și pauză (intervalulPropus), ca să nu existe două cifre '
  'care se pot contrazice. NULL e valid — o firmă fără program fix nu trebuie '
  'să inventeze unul; constrângerea de mai sus îl cere doar pentru modurile '
  'care chiar propun un interval.';

-- Index unic PARȚIAL, ca peste tot în proiect. Consecința obligatorie în cod:
-- NICIUN `.upsert()` pe tabela asta — PostgREST nu emite predicatul în
-- `ON CONFLICT`, iar Postgres respinge inferența la planificare, deci ar cădea
-- cu 42P10 la fiecare apel, nu doar la conflict (capcana 7). Acțiunea face
-- citire-apoi-INSERT-sau-UPDATE.
create unique index setari_pontare_rapida_org_uq
  on public.setari_pontare_rapida (organization_id) where deleted_at is null;

create index setari_pontare_rapida_created_by_idx on public.setari_pontare_rapida (created_by);
create index setari_pontare_rapida_updated_by_idx on public.setari_pontare_rapida (updated_by);

-- =====================================================================================
-- 3. Coloanele vechi rămân, dar nu se mai citesc
-- =====================================================================================
-- Tiparul lui 0082, care a lăsat `spor_*_procent` pe loc după ce sporurile au
-- trecut în payroll_settings. Un `drop column` aici ar rupe orice instanță care
-- rulează încă versiunea veche a codului, iar baza asta e și dev, și producție.

comment on column public.attendance_settings.mod_pontare_rapida is
  'ÎNLOCUITĂ de public.setari_pontare_rapida (0115). Nu se mai citește din '
  'aplicație. Rămâne pe loc ca să nu existe o fereastră de 42703 între migrare '
  'și deploy; valorile ei nu s-au migrat deliberat, fiindcă ''oprit'' era '
  'backfill din 0096, nu alegerea vreunui administrator.';

comment on column public.attendance_settings.verificare_pontare is
  'ÎNLOCUITĂ de public.setari_pontare_rapida (0115). Nu se mai citește din '
  'aplicație.';

comment on column public.attendance_settings.program_start is
  'ÎNLOCUITĂ de public.setari_pontare_rapida (0115). Nu se mai citește din '
  'aplicație.';

-- =====================================================================================
-- 4. RLS
-- =====================================================================================

alter table public.setari_pontare_rapida enable row level security;
alter table public.setari_pontare_rapida force  row level security;

-- SELECT copiază pragul lui `attendance_settings_select` (0013:732): `read own`.
-- Trebuie să fie exact ăsta — ecranele portalului îl citesc sub identitatea
-- angajatului, iar un prag mai strâns ar întoarce zero rânduri FĂRĂ EROARE, deci
-- butonul de pontare ar dispărea din nou, tăcut. Exact defectul reparat aici.
create policy setari_pontare_rapida_select on public.setari_pontare_rapida for select to authenticated
using (
  app.is_platform_admin()
  or (organization_id = any ((select app.current_org_ids())::uuid[])
      and deleted_at is null
      and app.feature_on(organization_id, 'attendance')
      and app.can(organization_id, 'attendance', 'read', 'own'))
);

-- `update`, nu `create`: e o CONFIGURARE, iar acțiunea care scrie declară
-- `attendance:update` / `all`. Poarta acoperă super_admin, org_admin și hr;
-- `manager` n-are `attendance:update` deloc, iar `employee` îl are `own`, deci
-- pragul `all` îi refuză pe amândoi.
create policy setari_pontare_rapida_insert on public.setari_pontare_rapida for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'attendance')
  and app.can(organization_id, 'attendance', 'update', 'all')
  and deleted_at is null
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy setari_pontare_rapida_update on public.setari_pontare_rapida for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
  and app.feature_on(organization_id, 'attendance')
  and app.can(organization_id, 'attendance', 'update', 'all')
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'attendance')
  and app.can(organization_id, 'attendance', 'update', 'all')
  and updated_by = (select auth.uid())
);

-- Nicio politică DELETE. Rândul de configurare nu se șterge niciodată — o firmă
-- care nu mai vrea pontare rapidă alege `oprit`, iar alegerea aia se vede în
-- audit. `revoke delete` de mai jos e a doua încuietoare.

-- =====================================================================================
-- 5. Actor, audit, granturi
-- =====================================================================================

do $$
declare v_tabela text;
begin
  foreach v_tabela in array array['setari_pontare_rapida']
  loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function internal.set_actor()',
      'trg_' || v_tabela || '_00_actor', v_tabela);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.tg_set_updated_at()',
      v_tabela || '_set_updated_at', v_tabela);
    execute format('select internal.attach_audit(%L)', v_tabela);
    execute format('revoke all on table public.%I from public, anon', v_tabela);
    execute format('grant select, insert, update on table public.%I to authenticated', v_tabela);
    execute format('revoke delete on table public.%I from authenticated', v_tabela);
  end loop;
end;
$$;

commit;

-- =====================================================================================
-- 6. Note de proiectare
-- =====================================================================================
--
-- · DE CE NU SE SEEDEAZĂ NICIUN RÂND. Un seed ar fi trebuit să decidă, pentru
--   fiecare firmă, dacă „oprit"-ul din attendance_settings e o alegere sau un
--   backfill — și pentru firmele fără niciun rând n-ar fi avut de unde ști ce
--   să scrie. Lipsa rândului e mai onestă: înseamnă „nimeni n-a ales încă", iar
--   implicitul e o singură constantă, în cod, cu teste. Primul rând apare când
--   cineva chiar apasă „Salvează" pe /pontaj/setari.
--
-- · DE CE CONSTRÂNGEREA `_program_ck` DUBLEAZĂ REFINEMENT-UL ZOD. Schema Zod
--   respinge deja `confirmare` fără `program_start`. Constrângerea e plasa de
--   SUB filtru: fără ea, un rând scris pe altă cale (script, import, o acțiune
--   viitoare care uită verificarea) ar produce un mod care nu poate desena
--   niciun buton — adică pontarea rapidă „pornită" și invizibilă, exact felul
--   de defect tăcut pe care ecranul ăsta îl repară.
--
-- · CE RĂMÂNE ÎN SARCINA APLICAȚIEI. Refuzul lui `cod_qr` când firma n-are
--   niciun punct de lucru cu `cod_pontaj` NU se poate exprima ca `check`: ar
--   cere un subselect peste altă tabelă. Stă în acțiune, ca regulă de business.
--   Fără el, o firmă își poate bloca tăcut toată pontarea, cerând scanarea unui
--   afiș care nu există.
--
-- · GOLUL DIN NUMEROTARE, la 0114. Numărul a fost ocupat câteva ore de o
--   încercare de a muta implicitul pe `attendance_settings.mod_pontare_rapida` —
--   coloana pe care migrarea asta o scoate din uz. N-a fost aplicată nicăieri și
--   a fost ștearsă. Golul se lasă așa: renumerotarea unei migrări deja împinse ar
--   fi mai scumpă decât un număr lipsă.
