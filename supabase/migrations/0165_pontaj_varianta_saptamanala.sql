-- supabase/migrations/0165_pontaj_varianta_saptamanala.sql
--
-- VARIANTA DE PONTAJ SĂPTĂMÂNALĂ: OMUL SE PONTEAZĂ DOAR PE FIȘA SĂPTĂMÂNII.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Cerut pe 6 oct 2026: o firmă poate alege ca pontajul să se facă pe toată
-- săptămâna, ca într-un timesheet — formularul „Planul săptămânii" devine
-- foaia de pontaj, iar butoanele de pontare pe zi („Am intrat", „Pontează-te
-- acum", formularul zilei, tragerea pe grila orară) dispar. Celelalte moduri
-- rămân neatinse: varianta e o alegere a firmei, implicit `zilnic`.
--
-- ── DE CE ȘI ÎN BAZĂ, NU DOAR PE ECRAN ─────────────────────────────────────
-- Politicile din 0013 lasă `employee` să scrie direct prin PostgREST orice zi
-- pe propria fișă, cu orice `sursa` în afară de `sincronizare_concedii`. Un
-- ecran fără butoane n-ar închide nimic: zilele s-ar putea scrie mai departe,
-- iar foaia săptămânii n-ar mai fi singura sursă. Triggerul de mai jos e plasa.
--
-- ── CE LASĂ SĂ TREACĂ ──────────────────────────────────────────────────────
-- · contextul de serviciu — scrierile cu clientul admin: săptămâna care devine
--   pontaj (`scriePontajulSaptamanii`), concediile, aprobarea în bloc;
-- · cine are `attendance:create = all` — responsabilul de pontaj corectează
--   foaia colectivă; varianta privește cum se pontează OMUL, nu corecturile;
-- · UPDATE-urile care ating doar DECIZIA (aprobare, respingere, lot) —
--   `decide_zi_pontaj` rulează cu `auth.uid()` al managerului, nu ca serviciu;
-- · rândurile de concediu — `internal.leave_requests_retrage_pontajul` le
--   șterge logic din triggerul de pe `leave_requests`, sub identitatea celui
--   care retrage cererea.

begin;

-- =====================================================================================
-- 1. Enumul și coloana
-- =====================================================================================

create type public.varianta_pontaj as enum ('zilnic', 'saptamanal');

comment on type public.varianta_pontaj is
  'Cum se pontează angajatul. `zilnic` = pe zi (ceas, confirmare, formularul '
  'zilei); `saptamanal` = doar pe fișa săptămânii, care devine pontaj la '
  'aprobare sau, fără aprobare, la trimitere.';

-- În `setari_pontare_rapida`, tabela setărilor OPERAȚIONALE (0115/0118): un rând
-- per firmă, fără istoric. NOT NULL cu implicit `zilnic`, deci toate firmele
-- existente rămân exact cum erau.
alter table public.setari_pontare_rapida
  add column if not exists varianta_pontaj public.varianta_pontaj not null default 'zilnic';

comment on column public.setari_pontare_rapida.varianta_pontaj is
  'Varianta de pontaj a firmei (0165). Lipsa rândului = `zilnic`, ca în '
  '`internal.pontaj_varianta` și în `configPontareRapida` din TypeScript.';

-- =====================================================================================
-- 2. Citirea variantei, pentru SQL
-- =====================================================================================

-- Perechea lui `internal.pontaj_necesita_aprobare` (0118): același rând, același
-- `coalesce` cu implicitul din TypeScript (`IMPLICIT_PONTARE_RAPIDA`).
create or replace function internal.pontaj_varianta(p_organization_id uuid)
returns public.varianta_pontaj
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.varianta_pontaj
       from public.setari_pontare_rapida s
      where s.organization_id = p_organization_id and s.deleted_at is null
      limit 1),
    'zilnic'::public.varianta_pontaj);
$$;

comment on function internal.pontaj_varianta(uuid) is
  'Varianta de pontaj a firmei; `zilnic` când nu există rând de setări.';

revoke all on function internal.pontaj_varianta(uuid) from public, anon, authenticated;

-- =====================================================================================
-- 3. Plasa: în varianta săptămânală, ziua nu se scrie de mână
-- =====================================================================================

create or replace function internal.pontaj_doar_pe_saptamana()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then
    return new;
  end if;

  if internal.pontaj_varianta(new.organization_id) <> 'saptamanal' then
    return new;
  end if;

  if app.can(new.organization_id, 'attendance', 'create', 'all') then
    return new;
  end if;

  -- Rândurile de concediu sunt ale sistemului, nu ale omului.
  if new.sursa = 'sincronizare_concedii' or new.leave_request_id is not null then
    return new;
  end if;

  -- Doar decizia s-a schimbat: aprobare, respingere, lot. Lista e a CONȚINUTULUI
  -- zilei; `approved_*`, `respins_*`, `motiv_respingere`, `batch_id` și
  -- `updated_*` lipsesc din ea intenționat.
  if tg_op = 'UPDATE'
     and (old.employee_id, old.data, old.ora_inceput, old.ora_sfarsit, old.ore_lucrate,
          old.ore_suplimentare, old.ore_noapte, old.tip_zi, old.tip_prezenta, old.observatii,
          old.sursa, old.punct_lucru_id, old.punct_lucru_declarat_id, old.deleted_at)
         is not distinct from
         (new.employee_id, new.data, new.ora_inceput, new.ora_sfarsit, new.ore_lucrate,
          new.ore_suplimentare, new.ore_noapte, new.tip_zi, new.tip_prezenta, new.observatii,
          new.sursa, new.punct_lucru_id, new.punct_lucru_declarat_id, new.deleted_at)
  then
    return new;
  end if;

  -- P0001, nu 42501: `traduEroare` îl duce pe ecran ca mesaj, iar omul află ce
  -- are de făcut, nu doar că n-are voie.
  raise exception 'Firma se pontează pe săptămână: completați fișa săptămânii, nu ziua.'
    using errcode = 'P0001';
end;
$$;

comment on function internal.pontaj_doar_pe_saptamana() is
  'În varianta `saptamanal` (0165), refuză scrierea de mână a unei zile de '
  'pontaj. Lasă să treacă serviciul, `attendance:create = all`, concediile și '
  'UPDATE-urile care ating doar decizia.';

revoke all on function internal.pontaj_doar_pe_saptamana() from public, anon;

drop trigger if exists trg_attendance_entries_varianta on public.attendance_entries;
create trigger trg_attendance_entries_varianta
  before insert or update on public.attendance_entries
  for each row execute function internal.pontaj_doar_pe_saptamana();

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · Fără politică nouă: un `with check` nu poate compara OLD cu NEW, iar refuzul
--   trebuie să lase deciziile managerului să treacă. Triggerul BEFORE poate.
-- · Foaia săptămânii (`trimite_saptamana_pontaj`) nu scrie în
--   `attendance_entries`, deci nu e atinsă. Pontajul îl scrie acțiunea, cu
--   clientul admin — la aprobare (`decideSaptamanaPontaj`) sau, fără aprobare,
--   la trimitere (`trimiteSaptamanaPontaj`).
-- · `zilnic` → `saptamanal` nu atinge zilele deja scrise. Rămân, iar foaia
--   săptămânii le respectă: `scriePontajulSaptamanii` nu calcă o zi cu rând din
--   altă sursă.
