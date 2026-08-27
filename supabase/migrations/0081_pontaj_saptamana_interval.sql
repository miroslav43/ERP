-- supabase/migrations/0081_pontaj_saptamana_interval.sql
--
-- PLANUL SĂPTĂMÂNII SE DECLARĂ CA INTERVAL, NU CA NUMĂR DE ORE — și săptămâna
-- poate spune dacă include weekendul.
--
-- ── DE CE ────────────────────────────────────────────────────────────────────
-- Ziua individuală (`/portal/pontajul-meu/zi/…`) cere de acum ora de intrare și
-- ora de ieșire, iar orele se derivă din ele, cu pauza de masă scăzută. Planul
-- săptămânal rămăsese pe „câte ore", deci același om declara timpul în două
-- feluri diferite, în două ecrane vecine, iar cifra din plan nu se putea compara
-- cu intervalul din zi.
--
-- ── UNDE SE CALCULEAZĂ ───────────────────────────────────────────────────────
-- `ore_planificate` NU se calculează aici. Rămâne o coloană scrisă, dar valoarea
-- vine din `src/domain/attendance/calcul-ore.ts` (`oreleZilei`), recalculată pe
-- server în `trimiteSaptamanaPontaj` înainte de acest apel. A repeta aritmetica
-- pauzei în plpgsql ar însemna două surse de adevăr pentru aceeași cifră, care
-- diverg tăcut — exact ce a produs sporul de weekend cu `default 0` din 0026.
-- Funcția de aici doar STOCHEAZĂ ce a calculat stratul de domeniu.
--
-- ── DE CE `drop` + `create`, NU `create or replace` ─────────────────────────
-- Funcția primește un parametru nou (`p_lucreaza_weekend`). `create or replace`
-- nu poate schimba lista de argumente — ar crea o A DOUA funcție, cu patru
-- parametri, iar apelul vechi ar continua să scrie fără comutator. Același
-- motiv, și aceeași soluție, ca la `pontaj_agregat_salarizare` în 0064.
--
-- ── COLOANELE DE INTERVAL SUNT NULLABLE, DELIBERAT ──────────────────────────
-- Săptămânile deja trimise nu au interval, iar zilele nelucrate (weekend,
-- sărbătoare) n-au ce interval să poarte. `not null` ar fi cerut o valoare
-- inventată pentru amândouă.
--
-- Forward-only: 0041 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Intervalul pe ziua din plan
-- =====================================================================================

alter table public.attendance_week_submission_days
  add column if not exists ora_inceput time,
  add column if not exists ora_sfarsit time;

alter table public.attendance_week_submission_days
  drop constraint if exists attendance_week_submission_days_interval_ck;

-- Ori amândouă, ori niciuna: o zi cu început fără sfârșit n-ar putea produce
-- nicio cifră, iar `ore_planificate` ar rămâne o valoare fără acoperire.
alter table public.attendance_week_submission_days
  add constraint attendance_week_submission_days_interval_ck
  check ((ora_inceput is null) = (ora_sfarsit is null));

comment on column public.attendance_week_submission_days.ora_inceput is
  'Ora de intrare planificată. Nul pe zilele nelucrate și pe săptămânile '
  'trimise înainte de 0075. `ore_planificate` se derivă din interval în '
  'src/domain/attendance/calcul-ore.ts, nu aici.';

comment on column public.attendance_week_submission_days.ora_sfarsit is
  'Ora de ieșire planificată. Vezi `ora_inceput`.';

-- =====================================================================================
-- 2. Săptămâna declară dacă include weekendul
-- =====================================================================================

alter table public.attendance_week_submissions
  add column if not exists lucreaza_weekend boolean not null default false;

comment on column public.attendance_week_submissions.lucreaza_weekend is
  'Săptămâna aceasta include sâmbăta și duminica. Implicitul ecranului vine din '
  '`attendance_settings.lucreaza_weekend` (0074) pentru o săptămână nouă, dar se '
  'salvează PE SĂPTĂMÂNĂ: un angajat chemat excepțional sâmbăta o poate declara '
  'fără să schimbe setarea firmei. `false` la nivel de coloană, ca rândurile '
  'existente să nu capete retroactiv un weekend pe care nu l-au avut.';

-- =====================================================================================
-- 3. Drumul unic de scriere, cu interval și comutator
-- =====================================================================================

drop function if exists public.trimite_saptamana_pontaj(uuid, date, public.attendance_week_status, jsonb);

create function public.trimite_saptamana_pontaj(
  p_organization_id uuid,
  p_saptamana_start date,
  p_status public.attendance_week_status,
  p_zile jsonb,
  p_lucreaza_weekend boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id   uuid;
  v_submission_id uuid;
  v_zi            jsonb;
begin
  if p_status not in ('ciorna', 'trimisa') then
    raise exception 'Statusul trimis nu este permis la salvare.' using errcode = '22023';
  end if;
  if extract(isodow from p_saptamana_start) <> 1 then
    raise exception 'Săptămâna trebuie să înceapă luni.' using errcode = '22023';
  end if;
  if not app.feature_on(p_organization_id, 'attendance') then
    raise exception 'Modulul de pontaj nu este activ pentru această organizație.' using errcode = 'P0001';
  end if;

  v_employee_id := app.current_employee_id(p_organization_id);
  if v_employee_id is null then
    raise exception 'Contul dvs. nu este legat de o fișă de angajat principală în această organizație.'
      using errcode = 'P0001';
  end if;
  if not app.poate_scrie_pontaj(p_organization_id, v_employee_id) then
    raise exception 'Nu aveți dreptul de a completa pontajul.' using errcode = '42501';
  end if;

  insert into public.attendance_week_submissions
    (organization_id, employee_id, saptamana_start, status, lucreaza_weekend, trimisa_la)
  values (
    p_organization_id, v_employee_id, p_saptamana_start, p_status,
    coalesce(p_lucreaza_weekend, false),
    case when p_status = 'trimisa' then now() else null end
  )
  on conflict (organization_id, employee_id, saptamana_start) where deleted_at is null
  do update set
    status = excluded.status,
    lucreaza_weekend = excluded.lucreaza_weekend,
    trimisa_la = excluded.trimisa_la,
    decis_de = null,
    decis_la = null,
    motiv_respingere = null,
    updated_at = now()
  where public.attendance_week_submissions.status in ('ciorna', 'trimisa', 'respinsa')
  returning id into v_submission_id;

  if v_submission_id is null then
    raise exception 'Săptămâna a fost deja aprobată și nu mai poate fi modificată.' using errcode = 'P0001';
  end if;

  delete from public.attendance_week_submission_days where submission_id = v_submission_id;

  for v_zi in select * from jsonb_array_elements(coalesce(p_zile, '[]'::jsonb))
  loop
    insert into public.attendance_week_submission_days
      (organization_id, submission_id, data, tip_prezenta,
       ora_inceput, ora_sfarsit, ore_planificate, observatii)
    values (
      p_organization_id,
      v_submission_id,
      (v_zi ->> 'data')::date,
      (v_zi ->> 'tip_prezenta')::public.attendance_presence_kind,
      -- `nullif` înaintea castului: PostgREST trimite `null` ca absență a
      -- cheii SAU ca `null` JSON, iar `''::time` ar ridica 22007.
      nullif(v_zi ->> 'ora_inceput', '')::time,
      nullif(v_zi ->> 'ora_sfarsit', '')::time,
      coalesce((v_zi ->> 'ore_planificate')::numeric, 0),
      nullif(v_zi ->> 'observatii', '')
    );
  end loop;

  return v_submission_id;
end;
$$;

revoke all on function public.trimite_saptamana_pontaj(uuid, date, public.attendance_week_status, jsonb, boolean) from public, anon;
grant execute on function public.trimite_saptamana_pontaj(uuid, date, public.attendance_week_status, jsonb, boolean) to authenticated;

comment on function public.trimite_saptamana_pontaj(uuid, date, public.attendance_week_status, jsonb, boolean) is
  'Singurul drum de scriere pentru planul săptămânal. Validează, face upsert pe '
  'săptămână și regenerează complet zilele. `ore_planificate` se primește DEJA '
  'CALCULATĂ din stratul de domeniu (oreleZilei) — funcția nu face aritmetica '
  'pauzei de masă, ca să nu existe o a doua sursă de adevăr.';

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce implicitul lui `ore_planificate` în funcție a trecut de la 8 la 0:
--   cu intervalul ca sursă, o zi fără interval e o zi NELUCRATĂ. Vechiul `8`
--   însemna „nu știu, presupun norma" — exact presupunerea care umplea sâmbăta
--   și duminica din portal cu 8 ore (`(portal)/…/saptamana/page.tsx:67`,
--   reparat în aceeași livrare).
--
-- · De ce `lucreaza_weekend` NU se derivă la citire din `attendance_settings`:
--   setarea firmei se poate schimba după ce săptămâna a fost trimisă, iar
--   aprobatorul care deschide o săptămână veche trebuie să vadă ce a declarat
--   omul ATUNCI, nu ce e configurat azi. Aceeași regulă ca `settings_snapshot`
--   din salarizare.
