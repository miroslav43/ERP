-- supabase/migrations/0131_inrolare_ciorna.sql
-- Înrolarea neterminată se păstrează, ca omul să se poată întoarce la ea.
--
-- ┌ Ce problemă rezolvă, dincolo de departament ──────────────────────────────
-- │ 0130 a rezolvat cazul îngust — departamentul lipsă se creează acum în pas.
-- │ Dar întreruperea are mai multe cauze decât una: sună telefonul, începe o
-- │ ședință, lipsește buletinul angajatului, se termină ziua. Asistentul are
-- │ șase pași și cere paisprezece câmpuri obligatorii; tot ce s-a completat se
-- │ pierdea la orice navigare, fiindcă starea trăia exclusiv în `react-hook-form`.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce O TABELĂ, și nu `localStorage` ─────────────────────────────────────
-- │ Ciorna conține CNP, serie și număr de act, adresă de domiciliu, IBAN și
-- │ salariu. `localStorage` le-ar fi lăsat în clar pe discul stației, în afara
-- │ oricărei politici RLS, a oricărui audit și a oricărei ștergeri la plecarea
-- │ omului din firmă. Aceleași date, în baza noastră, stau sub aceleași reguli
-- │ ca fișa pe care urmează s-o devină.
-- │
-- │ Corolarul: ciorna e vizibilă DOAR autorului. Nu e o fișă de personal, e
-- │ notița cuiva — iar `employees:read` nu dă dreptul de a citi notițele
-- │ colegilor. De aceea politicile compară cu `auth.uid()`, nu cu o permisiune.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce `jsonb` și nu coloane ──────────────────────────────────────────────
-- │ O ciornă e, prin definiție, INCOMPLETĂ: jumătate din câmpurile obligatorii
-- │ lipsesc. Coloane tipate ar fi cerut ca fiecare să fie nullable, adică o
-- │ oglindă a lui `employees` în care nimic nu e garantat — două scheme de
-- │ ținut sincronizate, iar cea de-a doua fără nicio constrângere utilă.
-- │ Forma o validează `inroleazaAngajatSchema` la RELUARE, nu baza. Ce apără
-- │ baza e mărimea și faptul că e un obiect, nu un tablou sau un șir.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce expiră ─────────────────────────────────────────────────────────────
-- │ O ciornă de acum trei luni nu mai e utilă nimănui, dar CNP-ul din ea e la
-- │ fel de personal ca în ziua întâi. `expira_la` are implicit 30 de zile;
-- │ curățarea o face `internal.sterge_ciorne_inrolare()`, chemată din pg_cron
-- │ ca celelalte trei joburi ale proiectului. Ștergerea e FIZICĂ, nu logică:
-- │ o ciornă „ștearsă" care păstrează CNP-ul la nesfârșit ar fi exact ce
-- │ încerca migrarea să evite.
-- └───────────────────────────────────────────────────────────────────────────

begin;

-- =====================================================================================
-- 1. Tabela
-- =====================================================================================

create table public.inrolare_ciorne (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Autorul. NU `employees.id`: ciorna aparține CONTULUI care o scrie, iar un
  -- `org_admin` care înrolează poate să n-aibă deloc fișă de angajat.
  autor_id        uuid not null references auth.users (id) on delete cascade,
  -- Numele, doar ca să se poată recunoaște ciorna în listă fără s-o deschizi.
  -- Se derivă din date la salvare; gol când n-a apucat nimeni să-l scrie.
  eticheta        text check (eticheta is null or length(btrim(eticheta)) between 1 and 200),
  -- Pasul la care s-a oprit, ca reluarea să nu înceapă de la 1.
  pas             smallint not null default 1 check (pas between 1 and 6),
  date            jsonb not null default '{}'::jsonb check (jsonb_typeof(date) = 'object'),
  expira_la       timestamptz not null default now() + interval '30 days',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  updated_by      uuid references auth.users (id) on delete set null,
  deleted_at      timestamptz,
  -- 256 KB de JSON e cu două ordine de mărime peste orice înrolare reală.
  -- Plafonul nu apără spațiul, ci apără de o cerere fabricată care ar umple
  -- tabela cu un singur rând.
  constraint inrolare_ciorne_marime_ck check (pg_column_size(date) <= 262144)
);

-- O singură ciornă activă per autor și organizație. A doua ar fi însemnat o
-- listă de notițe pe care nimeni n-o triază — iar întrebarea „la care mă
-- întorc?" e mai costisitoare decât cea pe care o rezolvă ciorna.
create unique index inrolare_ciorne_autor_uq
  on public.inrolare_ciorne (organization_id, autor_id)
  where deleted_at is null;

create index inrolare_ciorne_expirare_idx
  on public.inrolare_ciorne (expira_la)
  where deleted_at is null;

-- =====================================================================================
-- 2. RLS
-- =====================================================================================
-- Toate cele trei politici compară cu `auth.uid()`, NU cu o permisiune: ciorna
-- e notița unui om, nu un document al firmei. Nici `org_admin`, nici
-- `super_admin` n-au ce căuta în ea — iar dacă cineva chiar are nevoie de
-- datele dinăuntru, calea e ca autorul să termine înrolarea.

alter table public.inrolare_ciorne enable row level security;
alter table public.inrolare_ciorne force  row level security;

create policy inrolare_ciorne_select on public.inrolare_ciorne
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and autor_id = (select auth.uid())
    and deleted_at is null
  );

create policy inrolare_ciorne_insert on public.inrolare_ciorne
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and autor_id = (select auth.uid())
    -- Coloanele de stare inițială, pinuite: nimeni nu inserează o ciornă deja
    -- ștearsă sau cu o expirare împinsă în viitor.
    and deleted_at is null
    and expira_la <= now() + interval '31 days'
    -- Cine nu poate înrola nu are de ce să scrie ciorne de înrolare.
    and app.can(organization_id, 'employees', 'create', 'all')
  );

create policy inrolare_ciorne_update on public.inrolare_ciorne
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and autor_id = (select auth.uid())
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and autor_id = (select auth.uid())
    and expira_la <= now() + interval '31 days'
  );

-- Nicio politică DELETE: ștergerea din interfață e `update { deleted_at }`.
-- Ștergerea FIZICĂ o face doar funcția de curățare de mai jos, care rulează cu
-- drepturile ei, nu ale unui utilizator.

-- =====================================================================================
-- 3. Actor, audit, granturi
-- =====================================================================================
-- `attach_audit` NU se pune aici, deliberat: jurnalul de audit ar fi ajuns să
-- conțină CNP-uri și IBAN-uri la fiecare salvare automată — adică exact datele
-- pe care restul proiectului se străduiește să le țină în afara lui
-- (`audit.allow` e o listă albă tocmai pentru asta). Ce merită auditat e
-- ÎNROLAREA, care are deja rândul ei.

do $$ declare v_tabela text; begin
  foreach v_tabela in array array['inrolare_ciorne'] loop
    execute format('create trigger trg_%1$s_actor before insert or update on public.%1$I
                    for each row execute function internal.set_actor()', v_tabela);
    execute format('revoke all on table public.%I from public, anon', v_tabela);
    execute format('grant select, insert, update on table public.%I to authenticated', v_tabela);
    execute format('revoke delete on table public.%I from authenticated', v_tabela);
  end loop;
end $$;

-- =====================================================================================
-- 4. Curățarea
-- =====================================================================================

create or replace function internal.sterge_ciorne_inrolare()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sterse integer;
begin
  -- FIZIC, nu logic. O ciornă expirată care păstrează CNP-ul într-un rând
  -- „șters" ar fi exact riscul pe care expirarea îl elimină.
  delete from public.inrolare_ciorne
   where expira_la < now()
      or deleted_at is not null;
  get diagnostics v_sterse = row_count;
  return v_sterse;
end;
$$;

comment on function internal.sterge_ciorne_inrolare() is
  'Șterge FIZIC ciornele de înrolare expirate sau marcate șterse. Datele dinăuntru '
  '(CNP, act de identitate, IBAN) sunt la fel de personale ca într-o fișă, dar fără '
  'utilitatea ei — de aceea nu se păstrează. Se cheamă din pg_cron.';

revoke all on function internal.sterge_ciorne_inrolare() from public, anon, authenticated;

-- =====================================================================================
-- 5. Note de proiectare
-- =====================================================================================
--
-- (A) DE CE O SINGURĂ CIORNĂ PER OM
--     Indexul unic parțial o impune. Alternativa — o listă — mută pe om
--     întrebarea „la care dintre ele mă întorc?", care e mai scumpă decât cea
--     pe care ciorna o rezolvă. Cine chiar începe o a doua înrolare o suprascrie
--     pe prima, iar interfața spune asta înainte.
--
-- (B) CONSECINȚA INDEXULUI PARȚIAL: NICIUN `.upsert()`
--     Unicitatea e `where deleted_at is null`, iar PostgREST nu emite
--     predicatul în `ON CONFLICT` — un `.upsert()` ar cădea cu 42P10 la fiecare
--     apel, nu doar la conflict (capcana 7). Salvarea citește-apoi-scrie.
--
-- (C) `date` NU E VALIDAT DE BAZĂ
--     Nici nu poate fi: o ciornă e incompletă prin definiție. Forma se
--     validează la RELUARE, cu `inroleazaAngajatSchema`, iar câmpurile care nu
--     mai trec (un departament șters între timp, un punct de lucru dezactivat)
--     se golesc atunci, cu un mesaj. Ce apără baza e mărimea și tipul.

commit;
