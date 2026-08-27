-- supabase/migrations/0084_pontaj_saptamana_pentru_alt_angajat.sql
--
-- PATRONUL POATE DESCHIDE ȘI MODIFICA PLANUL SĂPTĂMÂNII ORICUI.
--
-- `/pontaj/saptamana` era personal prin construcție: citea și scria EXCLUSIV
-- săptămâna apelantului, fiindcă `trimite_saptamana_pontaj` își deriva singură
-- fișa din `app.current_employee_id()`. Cine avea `attendance:create = all` —
-- patronul — vedea orele tuturor în foaia colectivă, dar nu putea deschide
-- planul nimănui, nici măcar ca să-l corecteze.
--
-- ── AUTORIZAREA NU SE SCHIMBĂ, ȘI ĂSTA E ROSTUL ─────────────────────────────
-- `app.poate_scrie_pontaj(org, employee)` (0041) implementa deja exact regula
-- corectă, doar că era chemată mereu cu fișa apelantului:
--     `all`  → orice angajat
--     `team` → propria fișă sau un subaltern (`app.is_manager_of`)
--     `own`  → doar propria fișă
-- Singura schimbare reală e CE fișă i se dă. Un angajat care ar fabrica o
-- cerere cu `p_employee_id` străin cade în aceeași verificare, cu 42501.
--
-- ── DE CE `drop` ȘI NU `create or replace` ──────────────────────────────────
-- Parametrul nou schimbă aritatea. `create or replace` cu altă semnătură NU
-- înlocuiește nimic — creează o SUPRAÎNCĂRCARE, iar `.rpc()` ar deveni ambiguu
-- („could not choose a best candidate function"). Aceeași capcană pe care o
-- descrie 0017 în dreptul lui `recalc_sold`. Se șterge explicit semnătura veche.
--
-- Corpul de mai jos e cel VIU, citit din bază cu `pg_get_functiondef` și nu
-- rescris din memorie: 0075 (cealaltă sesiune) tocmai adăugase
-- `p_lucreaza_weekend` și intervalul orar, iar o retranscriere din 0041 le-ar fi
-- pierdut tăcut. Trei locuri sunt modificate, restul e byte cu byte ce era.

begin;

drop function if exists public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean);

CREATE OR REPLACE FUNCTION public.trimite_saptamana_pontaj(p_organization_id uuid, p_saptamana_start date, p_status attendance_week_status, p_zile jsonb, p_lucreaza_weekend boolean DEFAULT false, p_employee_id uuid DEFAULT null)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Fișa ȚINTĂ, nu neapărat a apelantului. `p_employee_id` null păstrează
  -- comportamentul de dinainte: propria săptămână. Autorizarea NU se schimbă —
  -- `app.poate_scrie_pontaj` de mai jos decide deja corect pentru toate cele
  -- trei scope-uri: `all` scrie oricui, `team` doar propriei fișe și
  -- subalternilor, `own` doar propriei fișe. Un angajat care ar trimite un
  -- `p_employee_id` străin cade acolo, cu 42501.
  v_employee_id := coalesce(p_employee_id, app.current_employee_id(p_organization_id));

  -- Ținta trebuie să existe în ACEASTĂ organizație: altfel un id dintr-o altă
  -- firmă ar trece de `poate_scrie_pontaj` pe ramura `all` (care nu se uită la
  -- organizația fișei) și ar scrie peste tenant.
  if p_employee_id is not null and not exists (
    select 1 from public.employees e
     where e.id = p_employee_id
       and e.organization_id = p_organization_id
       and e.deleted_at is null
  ) then
    raise exception 'Angajatul selectat nu aparține acestei organizații.' using errcode = 'P0001';
  end if;
  if v_employee_id is null then
    raise exception 'Nu s-a putut stabili pentru cine se completează săptămâna: contul dvs. nu are fișă de angajat principală în această organizație și nu ați ales un angajat.'
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
$function$;

revoke all on function public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean, uuid) from public, anon;
grant execute on function public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean, uuid) to authenticated;

comment on function public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean, uuid) is
'Salvează sau trimite spre aprobare planul unei săptămâni. `p_employee_id` null '
'înseamnă propria fișă (comportamentul de dinainte de 0078); cu o fișă dată, '
'scrie pentru ea, dacă `app.poate_scrie_pontaj` o permite — `all` oricui, '
'`team` doar subalternilor, `own` niciodată altcuiva.';

commit;
