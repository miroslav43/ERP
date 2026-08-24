-- supabase/migrations/0067_pontaj_aprobare_pe_zi.sql
--
-- Trei lipsuri ale aprobării de pontaj, din aceeași familie: decizia era mai
-- grosieră decât realitatea pe care o descrie.
--
-- (1) PONTAJUL ZILNIC SE APROBA DOAR ÎN BLOC, ȘI NU SE PUTEA RESPINGE DELOC.
--     Singura acțiune era `app.aproba_pontaj_bloc` (0013:519), pe toată luna ±
--     un filtru de departament. Nu exista NICIO cale de a aproba o zi anume și
--     niciuna, absolut niciuna, de a respinge ceva: `attendance_entries` avea
--     `approved_at`/`approved_by` (0013:148-149) și nimic pentru refuz.
--     Aprobatorul care găsea o zi greșită într-o lună de 200 de angajați avea
--     două opțiuni: aproba tot, inclusiv greșeala, sau nu aproba nimic.
--
--     Respingerea NU e „lipsa aprobării”. O zi neaprobată e o zi nedecisă
--     încă; una respinsă e o zi văzută și refuzată, cu motiv, pe care angajatul
--     trebuie s-o corecteze. Fără distincție, ecranul de aprobări nu poate
--     spune omului ce mai are de făcut.
--
-- (2) HR APROBA PONTAJUL, DEȘI CERINȚA E „MANAGERUL DIRECT SAU PATRONUL”.
--     Seed-ul din 0002:1197 dă `attendance:approve = all` și lui `hr`. Aceeași
--     reparație ca la concedii în 0056, cu aceeași motivație: `none` e REFUZ
--     EXPLICIT, nu absența rândului.
--
-- (3) INDEMNIZAȚIA DE CONCEDIU DE ODIHNĂ INTRA IMPLICIT SUB MINIMUL LEGAL.
--     `mod_calcul_indemnizatie_co` avea `default 'baza'` (0057:78-80),
--     deliberat, „ca activarea mediei să fie o decizie explicită”. Efectul
--     practic însă e că o firmă care nu atinge setarea plătește concediul la
--     rata zilnică a salariului de bază — sub ce cere Codul Muncii art. 150
--     alin. (2), care impune media zilnică a drepturilor salariale din ultimele
--     trei luni când e mai avantajoasă. Implicitul devine
--     `cea_mai_avantajoasa`: motorul compară oricum ambele variante și o alege
--     pe cea mai bună pentru angajat, deci nu e o alegere riscantă, e cea
--     legală. Rândurile existente NU se ating.
--
-- ⚠️ Valorile legale rămân DE CONFIRMAT de contabil/jurist.
--
-- Forward-only: 0002, 0013 și 0057 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Respingerea unei zile de pontaj
-- =====================================================================================

alter table public.attendance_entries
  add column if not exists respins_la       timestamptz,
  add column if not exists respins_de       uuid references auth.users (id) on delete set null,
  add column if not exists motiv_respingere text;

alter table public.attendance_entries
  add constraint attendance_entries_respingere_ck
  check (
    -- Ori nedecisă, ori respinsă cu motiv de cel puțin 5 caractere. Un refuz
    -- fără explicație e o sarcină pe care angajatul n-o poate duce la capăt.
    (respins_la is null and respins_de is null and motiv_respingere is null)
    or (respins_la is not null and char_length(btrim(coalesce(motiv_respingere, ''))) >= 5)
  );

alter table public.attendance_entries
  add constraint attendance_entries_decizie_ck
  check (approved_at is null or respins_la is null);

comment on column public.attendance_entries.respins_la is
  'Momentul respingerii zilei de către aprobator. Exclusiv cu approved_at: o zi '
  'e nedecisă, aprobată SAU respinsă, niciodată două deodată. Până la 0067 '
  'respingerea nu exista, iar aprobatorul care găsea o zi greșită putea doar să '
  'aprobe tot sau nimic.';

comment on column public.attendance_entries.motiv_respingere is
  'Obligatoriu la respingere, minimum 5 caractere. Angajatul îl vede în portal '
  'și pe baza lui corectează ziua.';

create index attendance_entries_respinse_idx
  on public.attendance_entries (organization_id, period_id)
  where respins_la is not null and deleted_at is null;

-- =====================================================================================
-- 2. Decizia pe o singură zi
-- =====================================================================================
-- SECURITY DEFINER, ca `aproba_pontaj_bloc`: verificarea de drept e explicită
-- la intrare, iar scrierea ocolește politica de UPDATE care ar bloca un rând
-- deja aprobat. Scope-ul `team` cere ca aprobatorul să fie manager al
-- angajatului — aceeași funcție folosită și de bloc.
--
-- ÎN SCHEMA `public`, NU `app`: PostgREST expune doar `public` și
-- `graphql_public` (supabase/config.toml), deci `.rpc()` nu ajunge niciodată la
-- schema `app` — o funcție pusă acolo are GRANT EXECUTE corect și e complet
-- inapelabilă din aplicație. E exact defectul pe care 0034 a trebuit să-l
-- repare pentru `urmatoarea_marca`. De aici și garda de tenant de la intrare,
-- copiată de acolo: o funcție expusă public nu se poate baza pe apelant.

create or replace function public.decide_zi_pontaj(
  p_organization_id uuid,
  p_entry_id        uuid,
  p_aproba          boolean,
  p_motiv           text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intrare public.attendance_entries%rowtype;
  v_status  public.attendance_period_status;
begin
  if not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Organizația nu îți este accesibilă.' using errcode = '42501';
  end if;

  select e.* into v_intrare
    from public.attendance_entries e
   where e.id = p_entry_id
     and e.organization_id = p_organization_id
     and e.deleted_at is null;
  if not found then
    raise exception 'Ziua de pontaj nu a fost găsită.' using errcode = 'P0001';
  end if;

  if not (
    app.can(p_organization_id, 'attendance', 'approve', 'all')
    or (app.has_permission(p_organization_id, 'attendance', 'approve') = 'team'
        and app.is_manager_of(p_organization_id, v_intrare.employee_id))
  ) then
    raise exception 'Nu ai dreptul să decizi asupra acestei zile de pontaj.' using errcode = '42501';
  end if;

  select p.status into v_status
    from public.attendance_periods p
   where p.id = v_intrare.period_id;
  if v_status = 'blocata' then
    raise exception 'Perioada de pontaj este blocată și nu mai poate fi modificată.'
      using errcode = 'P0001';
  end if;

  if p_aproba then
    update public.attendance_entries
       set approved_at = now(), approved_by = auth.uid(),
           respins_la = null, respins_de = null, motiv_respingere = null,
           updated_at = now()
     where id = p_entry_id;
  else
    if char_length(btrim(coalesce(p_motiv, ''))) < 5 then
      raise exception 'Respingerea unei zile de pontaj cere un motiv de cel puțin 5 caractere.'
        using errcode = 'P0001';
    end if;
    update public.attendance_entries
       set respins_la = now(), respins_de = auth.uid(), motiv_respingere = btrim(p_motiv),
           approved_at = null, approved_by = null, batch_id = null,
           updated_at = now()
     where id = p_entry_id;
  end if;

  return p_entry_id;
end;
$$;

comment on function public.decide_zi_pontaj(uuid, uuid, boolean, text) is
  'Aprobă sau respinge O SINGURĂ zi de pontaj, cu motiv obligatoriu la '
  'respingere. Completează aproba_pontaj_bloc, care decide pe toată luna.';

revoke all on function public.decide_zi_pontaj(uuid, uuid, boolean, text) from public, anon;
grant execute on function public.decide_zi_pontaj(uuid, uuid, boolean, text) to authenticated;

-- =====================================================================================
-- 3. HR nu mai aprobă pontajul
-- =====================================================================================
-- `none` = REFUZ EXPLICIT, nu absența rândului — vezi comentariul din 0056.
-- HR păstrează `attendance:read/create/update`: administrează pontajul, nu-l
-- decide.

update public.role_permissions
   set scope = 'none', updated_at = now()
 where organization_id is null
   and role = 'hr'
   and resource = 'attendance'
   and action = 'approve'
   and deleted_at is null;

-- =====================================================================================
-- 4. Indemnizația de concediu de odihnă, implicit pe varianta legală
-- =====================================================================================

alter table public.payroll_settings
  alter column mod_calcul_indemnizatie_co set default 'cea_mai_avantajoasa';

comment on column public.payroll_settings.mod_calcul_indemnizatie_co is
  '⚠️ DE CONFIRMAT de jurist. Cum se calculează indemnizația de concediu de '
  'odihnă: baza = rata zilnică a salariului; media_3_luni = art. 150 alin. (2); '
  'cea_mai_avantajoasa = maximul dintre ele, care e regula legală. Implicitul a '
  'fost ''baza'' până la 0067 — sub minimul legal, cu un simplu avertisment.';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce respingerea ȘTERGE `batch_id`: lotul de aprobare în bloc numără
--   liniile pe care le-a atins (`linii_aprobate`, 0013:115). O linie respinsă
--   ulterior nu mai face parte din lot; lăsând legătura, raportul lotului ar
--   pretinde că a aprobat ceva ce e acum refuzat.
--
-- · De ce nu există o politică DELETE pentru zilele respinse: proiectul nu are
--   nicio politică DELETE. Ziua respinsă rămâne, cu motivul ei, ca angajatul
--   să vadă ce are de corectat — ștergerea ar face refuzul invizibil.
--
-- · De ce implicitele existente NU se rescriu (secțiunea 4): `payroll_settings`
--   e versionată pe `valabil_de_la` și fotografiată în `settings_snapshot` la
--   fiecare calcul. Rescrierea retroactivă ar face ca o perioadă închisă să nu
--   mai poată fi explicată din datele ei.
