-- supabase/migrations/0133_saptamana_sare_peste_concediu.sql
-- Planul săptămânal nu mai poate planifica muncă într-o zi cu concediu aprobat.
--
-- ┌ Gaura, exact ───────────────────────────────────────────────────────────
-- │ Pontajul se scrie pe DOUĂ drumuri, iar până acum doar unul se uita la
-- │ concedii:
-- │
-- │   · ziua individuală — `salveazaZiPontaj` refuză, de la 0013 încoace, cu
-- │     „Ziua este completată automat din concediul aprobat";
-- │   · săptămâna — `trimite_saptamana_pontaj` nu verifica NIMIC. Verifica
-- │     luna deschisă, ziua de luni, modulul activ, angajatul din organizație
-- │     — dar nu și dacă ziua e deja concediu.
-- │
-- │ Cine își făcea planul săptămânal peste propriul concediu aprobat trecea
-- │ fără niciun semn. Comentariul din `salveazaZiPontaj` promitea de mult
-- │ refuzul „zi din concediu" ca pe o regulă a modulului; era a unei singure
-- │ funcții.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce SE SARE, și nu se refuză toată săptămâna ───────────────────────────
-- │ Un refuz total ar fi pedepsit pe cineva care planifică cinci zile și are
-- │ concediu într-una: ar fi trebuit să ghicească ce zi deranjează, s-o scoată
-- │ și să retrimită. Zilele cu concediu se sar, restul se salvează, iar
-- │ funcția ÎNTOARCE zilele sărite ca să poată fi spuse pe ecran.
-- │
-- │ Tăcerea ar fi fost mai rea decât refuzul: omul ar fi crezut că a planificat
-- │ cinci zile, iar în plan ar fi fost trei.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce dovada e `attendance_entries`, nu `leave_requests` ─────────────────
-- │ Acolo ajunge concediul aprobat, prin `sincronizeazaZileleDeConcediu`, cu
-- │ `leave_request_id` completat — și e exact coloana pe care o citește garda
-- │ din `salveazaZiPontaj`. Două verificări pe ACEEAȘI dovadă, nu pe două
-- │ surse care pot diverge: sincronizarea e best-effort, iar o cerere aprobată
-- │ a cărei sincronizare a căzut nu are rând de pontaj, deci nici garda de zi
-- │ n-ar opri-o. Consecvența contează mai mult decât acoperirea aici — două
-- │ răspunsuri diferite la aceeași întrebare ar fi mai greu de explicat decât
-- │ o gaură pe care ecranul de concedii o semnalează deja.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce DROP, nu `create or replace` ───────────────────────────────────────
-- │ Se schimbă TIPUL de retur, din `uuid` în `jsonb` — Postgres nu îl poate
-- │ schimba printr-un `create or replace`. Funcția are un singur apelant
-- │ (`src/app/(app)/pontaj/saptamana/actions.ts`), actualizat în același
-- │ commit.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Corpul de mai jos e EXTRAS din bază cu `pg_get_functiondef` și peticit
-- programatic: tipul de retur, două variabile, blocul care sare peste zi și
-- linia de retur. Restul e neatins.

begin;

drop function if exists public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean, uuid);

CREATE OR REPLACE FUNCTION public.trimite_saptamana_pontaj(p_organization_id uuid, p_saptamana_start date, p_status attendance_week_status, p_zile jsonb, p_lucreaza_weekend boolean DEFAULT false, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee_id   uuid;
  v_submission_id uuid;
  v_zi            jsonb;
  v_data          date;
  v_sarite        jsonb := '[]'::jsonb;
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

  v_employee_id := coalesce(p_employee_id, app.current_employee_id(p_organization_id));

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
  -- SINGURA schimbare față de 0084: a doua ramură. Într-o firmă fără aprobare,
  -- `aprobata` înseamnă „gata", nu „decis de cineva" — deci nu blochează nimic.
  where public.attendance_week_submissions.status in ('ciorna', 'trimisa', 'respinsa')
     or not internal.pontaj_necesita_aprobare(p_organization_id)
  returning id into v_submission_id;

  if v_submission_id is null then
    raise exception 'Săptămâna a fost deja aprobată și nu mai poate fi modificată.' using errcode = 'P0001';
  end if;

  delete from public.attendance_week_submission_days where submission_id = v_submission_id;

  for v_zi in select * from jsonb_array_elements(coalesce(p_zile, '[]'::jsonb))
  loop
    v_data := (v_zi ->> 'data')::date;

    /*
     * Ziua cu CONCEDIU APROBAT nu se planifică: e o contradicție, nu o
     * preferință. Se SARE peste ea și se spune care — un refuz al săptămânii
     * întregi ar fi pedepsit pe cineva care planifică cinci zile și are
     * concediu într-una.
     *
     * Sursa e `attendance_entries`, nu `leave_requests`: acolo ajunge concediul
     * aprobat prin `sincronizeazaZileleDeConcediu`, cu `leave_request_id`
     * completat — aceeași coloană pe care o citește garda din
     * `salveazaZiPontaj`. Două verificări pe aceeași dovadă, nu pe două surse
     * care pot diverge.
     */
    if exists (
      select 1 from public.attendance_entries ae
       where ae.organization_id = p_organization_id
         and ae.employee_id = v_employee_id
         and ae.data = v_data
         and ae.leave_request_id is not null
         and ae.deleted_at is null
    ) then
      v_sarite := v_sarite || to_jsonb(v_data);
      continue;
    end if;

    insert into public.attendance_week_submission_days
      (organization_id, submission_id, data, tip_prezenta,
       ora_inceput, ora_sfarsit, ore_planificate, observatii)
    values (
      p_organization_id,
      v_submission_id,
      v_data,
      (v_zi ->> 'tip_prezenta')::public.attendance_presence_kind,
      -- `nullif` înaintea castului: PostgREST trimite `null` ca absență a
      -- cheii SAU ca `null` JSON, iar `''::time` ar ridica 22007.
      nullif(v_zi ->> 'ora_inceput', '')::time,
      nullif(v_zi ->> 'ora_sfarsit', '')::time,
      coalesce((v_zi ->> 'ore_planificate')::numeric, 0),
      nullif(v_zi ->> 'observatii', '')
    );
  end loop;

  return jsonb_build_object('submission_id', v_submission_id, 'zile_sarite', v_sarite);
end;
$function$;


revoke all on function public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean, uuid) from public, anon;
grant execute on function public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean, uuid) to authenticated;

comment on function public.trimite_saptamana_pontaj(
  uuid, date, public.attendance_week_status, jsonb, boolean, uuid) is
  'Salvează planul săptămânal, SĂRIND peste zilele cu concediu aprobat. Întoarce '
  '`{submission_id, zile_sarite}` — zilele sărite se spun pe ecran, fiindcă tăcerea '
  'ar lăsa omul să creadă că a planificat mai mult decât s-a scris.';

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
--
-- (A) DE CE NU SE ATINGE ZIUA DE CONCEDIU
--     Rândul din `attendance_entries` poartă `leave_request_id` și
--     `sursa = 'sincronizare_concedii'`. Suprascris cu ore planificate, ziua ar
--     fi rămas și scăzută din soldul de concediu, și numărată ca muncă — exact
--     dubla plată pe care modulul o semnalează în altă parte.
--
-- (B) CE NU REZOLVĂ MIGRAREA
--     O cerere aprobată a cărei sincronizare cu pontajul a căzut (luna fără
--     perioadă deschisă) n-are rând în `attendance_entries`, deci nici garda
--     asta, nici cea din `salveazaZiPontaj` n-o văd. Recuperarea rămâne
--     `sincronizeazaConcediile`, din pontaj — iar aprobarea o semnalează deja
--     prin `zilePastrate`.

commit;
