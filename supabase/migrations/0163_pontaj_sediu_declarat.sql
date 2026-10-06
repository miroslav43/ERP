-- supabase/migrations/0163_pontaj_sediu_declarat.sql
--
-- SEDIUL ZILEI, DECLARAT — ALĂTURI DE CEL SCANAT, NU ÎN LOCUL LUI.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Până acum ziua de pontaj știa sediul într-un singur fel:
-- `attendance_entries.punct_lucru_id` (0096), scris NUMAI din scanarea codului
-- QR, ca DOVADĂ — „cineva a fost lângă afișul de la sediul X". Fără scanare,
-- ziua rămânea fără sediu și se presupunea cel din contract
-- (`employment_contracts.punct_lucru_id`, 0097). La o firmă cu două sedii, cine
-- lucra azi la unul și mâine la celălalt nu avea unde să spună asta. Cerut pe
-- 6 oct 2026.
--
-- ── DE CE O COLOANĂ NOUĂ ȘI NU `punct_lucru_id` ─────────────────────────────
-- Dacă sediul s-ar putea alege din listă în aceeași coloană, ea n-ar mai dovedi
-- nimic: o zi scanată și una aleasă de mână ar arăta identic în rapoarte.
-- Deci două coloane, cu sensuri diferite:
--   · `punct_lucru_id`          — SCANAT, dovadă (neatins de migrarea asta);
--   · `punct_lucru_declarat_id` — DECLARAT de om în formularul zilei.
-- Sediul efectiv al zilei = scanat ?? declarat ?? cel din contract.
-- NULL pe declarat înseamnă „sediul din contract", nu „necunoscut".
--
-- ── CITIREA LISTEI: `public.sedii_pentru_pontaj` ────────────────────────────
-- `puncte_lucru_select` (0030) cere `departments:read`, pe care `employee` nu-l
-- are — deci angajatul n-ar putea vedea lista din care alege. Funcția întoarce
-- strict ce trebuie formularului: id, denumire și care e sediul din contractul
-- celui conectat. Fără adresă, fără `cod_pontaj` — codul e SECRETUL afișului.

begin;

-- =====================================================================================
-- 1. Coloana
-- =====================================================================================

alter table public.attendance_entries
  add column if not exists punct_lucru_declarat_id uuid;

-- Compus pe (id, organization_id), ca la contracte (0097): un sediu al ALTEI
-- firme nu poate fi declarat nici de un client care trimite id-uri fabricate.
-- `set null (punct_lucru_declarat_id)` — doar coloana asta; `organization_id`
-- e NOT NULL și nu se atinge. Sediile se șterg logic, deci practic nu se
-- declanșează niciodată.
alter table public.attendance_entries
  drop constraint if exists attendance_entries_punct_declarat_fk;
alter table public.attendance_entries
  add constraint attendance_entries_punct_declarat_fk
  foreign key (punct_lucru_declarat_id, organization_id)
  references public.puncte_lucru (id, organization_id)
  on delete set null (punct_lucru_declarat_id);

-- Un sediu se declară doar pentru munca LA SEDIU. „Homeoffice cu sediul Cluj"
-- e o contradicție pe care formularul n-o produce, iar baza n-o primește.
alter table public.attendance_entries
  drop constraint if exists attendance_entries_punct_declarat_ck;
alter table public.attendance_entries
  add constraint attendance_entries_punct_declarat_ck
  check (
    punct_lucru_declarat_id is null
    or tip_prezenta is null
    or tip_prezenta = 'birou'
  );

-- PARȚIAL: majoritatea zilelor nu declară nimic.
create index if not exists attendance_entries_punct_declarat_idx
  on public.attendance_entries (organization_id, punct_lucru_declarat_id)
  where punct_lucru_declarat_id is not null and deleted_at is null;

comment on column public.attendance_entries.punct_lucru_declarat_id is
  'Sediul DECLARAT de om pentru zi, din formular. NU e dovadă — dovada e '
  '`punct_lucru_id`, scris doar din scanarea QR. NULL = sediul din contract. '
  'Sediul efectiv: punct_lucru_id ?? punct_lucru_declarat_id ?? contractul.';

-- =====================================================================================
-- 2. Lista sediilor, pentru formularul zilei
-- =====================================================================================

create or replace function public.sedii_pentru_pontaj(p_organization_id uuid)
returns table (
  id           uuid,
  denumire     text,
  din_contract boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with contractul as (
    -- Contractul în vigoare al celui conectat. `app.current_employee_id` cere
    -- fișa PRINCIPALĂ — aceeași prin care trec toate ramurile `own` din RLS.
    select c.punct_lucru_id
      from public.employment_contracts c
     where c.organization_id = p_organization_id
       and c.employee_id = app.current_employee_id(p_organization_id)
       and c.status in ('activ', 'suspendat')
       and c.valabil_de_la <= app.azi_local()
       and c.deleted_at is null
     order by c.valabil_de_la desc, c.created_at desc
     limit 1
  )
  select p.id, p.denumire, p.id = (select punct_lucru_id from contractul) as din_contract
    from public.puncte_lucru p
   where p.organization_id = p_organization_id
     and p_organization_id = any ((select app.current_org_ids())::uuid[])
     and app.feature_on(p_organization_id, 'attendance')
     and (
       app.can(p_organization_id, 'attendance', 'read', 'own')
       or app.can(p_organization_id, 'attendance', 'create', 'own')
     )
     and p.activ
     and p.deleted_at is null
   order by p.sediu_principal desc, p.denumire;
$$;

comment on function public.sedii_pentru_pontaj(uuid) is
  'Sediile active ale firmei, pentru alegerea sediului în formularul zilei de '
  'pontaj. Ocolește `puncte_lucru_select` (care cere departments:read) doar cu '
  'id + denumire; `din_contract` marchează sediul contractului celui conectat.';

revoke all on function public.sedii_pentru_pontaj(uuid) from public, anon;
grant execute on function public.sedii_pentru_pontaj(uuid) to authenticated;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · Nicio politică nouă: INSERT/UPDATE pe `attendance_entries` nu enumeră
--   coloane, iar FK-ul compus + CHECK-ul de mai sus sunt toată paza coloanei.
-- · Sediul INACTIV (`activ = false`) nu apare în listă, dar o zi veche care îl
--   declară rămâne validă — FK-ul nu privește `activ`. Acțiunea refuză însă
--   declararea unui sediu inactiv sau șters.
-- · Pontarea rapidă nu scrie coloana: butonul „Am intrat" nu întreabă unde.
--   Ziua rămâne pe sediul din contract, sau pe cel scanat.
