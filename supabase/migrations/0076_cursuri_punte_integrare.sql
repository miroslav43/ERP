-- supabase/migrations/0076_cursuri_punte_integrare.sql
-- Puntea dintre cursuri și lista de integrare: un pas de checklist se bifează
-- SINGUR când angajatul termină cursul legat de el.
--
-- ── DE CE AȘA, ȘI NU CU ÎNCĂ UN PAS MANUAL ───────────────────────────────
-- Mecanismul există deja în 0014: `verificare_automata` plus triggerul
-- `sync_itemi_returnare_inventar`, care bifează pasul „Predare echipament" când
-- ultimul bun e returnat. Aici e exact același tipar, cu altă condiție. A
-- inventa un al doilea mecanism ar fi însemnat două locuri unde se decide
-- „pasul e gata".
--
-- ── DOUĂ BLOCURI `begin/commit`, OBLIGATORIU ─────────────────────────────
-- Postgres refuză folosirea unei valori de enum în aceeași tranzacție în care a
-- fost adăugată (55P04). Precedentul e 0064:50-58. `if not exists` face
-- reluarea idempotentă — necesar, nu precaut: blocul doi nu e atomic față de
-- primul, deci o migrare întreruptă la mijloc trebuie să poată fi reluată.
--
-- ── POLITICA `checklist_instance_items_update` NU SE ATINGE ──────────────
-- Triggerul de sincronizare e `security definer` și rulează ca `postgres`, care
-- are `rolbypassrls`. Nu are nevoie de nicio ramură nouă în politică, deci nu
-- lărgim tăcut drepturile nimănui. (0014:856 are deja o ramură largă pe
-- `verificare_automata is not null` + `inventory:update`; o lăsăm exact cum e.)

begin;

alter type public.checklist_verificare add value if not exists 'curs_finalizat';

commit;

begin;

---------------------------------------------------------------------------
-- 1. Legătura pas ↔ curs
---------------------------------------------------------------------------

alter table public.checklist_template_items
  add column if not exists curs_id uuid;

alter table public.checklist_instance_items
  add column if not exists curs_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'checklist_template_items_curs_fk'
      and conrelid = 'public.checklist_template_items'::regclass
  ) then
    alter table public.checklist_template_items
      add constraint checklist_template_items_curs_fk
      foreign key (curs_id, organization_id)
      references public.courses (id, organization_id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'checklist_instance_items_curs_fk'
      and conrelid = 'public.checklist_instance_items'::regclass
  ) then
    alter table public.checklist_instance_items
      add constraint checklist_instance_items_curs_fk
      foreign key (curs_id, organization_id)
      references public.courses (id, organization_id) on delete restrict;
  end if;
end;
$$;

-- `coalesce` OBLIGATORIU: un CHECK care întoarce NULL este SATISFĂCUT. Fără el,
-- un rând cu `verificare_automata is null` ar trece cu `curs_id` completat,
-- adică o legătură care nu declanșează nimic — exact felul de defect tăcut pe
-- care constrângerea există ca să-l prindă.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint where conname = 'checklist_template_items_curs_ck'
  ) then
    alter table public.checklist_template_items
      add constraint checklist_template_items_curs_ck
      check (coalesce(verificare_automata = 'curs_finalizat', false) = (curs_id is not null));
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint where conname = 'checklist_instance_items_curs_ck'
  ) then
    alter table public.checklist_instance_items
      add constraint checklist_instance_items_curs_ck
      check (coalesce(verificare_automata = 'curs_finalizat', false) = (curs_id is not null));
  end if;
end;
$$;

create index if not exists checklist_instance_items_curs_idx
  on public.checklist_instance_items (organization_id, curs_id, employee_id)
  where deleted_at is null and curs_id is not null;

comment on column public.checklist_template_items.curs_id is
  'Cursul care bifează acest pas când e parcurs. Se completează exact când `verificare_automata = ''curs_finalizat''`, impus de CHECK.';

---------------------------------------------------------------------------
-- 2. Materializarea copiază și legătura
---------------------------------------------------------------------------
-- Corpul e cel din 0014, cu `curs_id` adăugat în ambele liste. Se rescrie
-- integral, nu prin petic: o funcție `create or replace` parțială ar pierde
-- restul logicii (bunurile nereturnate).

create or replace function internal.checklist_copiaza_pasii()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_lipsa text[];
  v_liber boolean;
begin
  v_lipsa := app.checklist_bunuri_nereturnate(new.organization_id, new.employee_id);
  v_liber := coalesce(array_length(v_lipsa, 1), 0) = 0;

  insert into public.checklist_instance_items (
    organization_id, instance_id, employee_id, template_item_id, ordine, titlu, descriere,
    responsabil_tip, responsabil_rol, responsabil_employee_id, termen, obligatoriu,
    tip_dovada, verificare_automata, curs_id, status, bifat_automat, bifat_la, observatii
  )
  select
    new.organization_id, new.id, new.employee_id, ti.id, ti.ordine, ti.titlu, ti.descriere,
    ti.responsabil_tip, ti.responsabil_rol, ti.responsabil_employee_id,
    new.data_referinta + ti.termen_zile_relativ::integer, ti.obligatoriu,
    ti.tip_dovada, ti.verificare_automata, ti.curs_id,
    case
      when ti.verificare_automata = 'inventar_returnat' and v_liber then 'bifat'
      -- Cursul deja parcurs bifează pasul din prima: un om care a făcut
      -- instructajul luna trecută n-are de ce să-l refacă la reangajare.
      when ti.verificare_automata = 'curs_finalizat'
           and exists (
             select 1 from public.course_enrollments e
             where e.organization_id = new.organization_id
               and e.course_id = ti.curs_id
               and e.employee_id = new.employee_id
               and e.deleted_at is null
               and e.status = 'finalizat'
           )
        then 'bifat'
      else 'de_facut'
    end::public.checklist_item_status,
    coalesce(ti.verificare_automata in ('inventar_returnat', 'curs_finalizat'), false)
      and (ti.verificare_automata <> 'inventar_returnat' or v_liber),
    case
      when ti.verificare_automata = 'inventar_returnat' and v_liber then now()
      when ti.verificare_automata = 'curs_finalizat'
           and exists (
             select 1 from public.course_enrollments e
             where e.organization_id = new.organization_id
               and e.course_id = ti.curs_id
               and e.employee_id = new.employee_id
               and e.deleted_at is null
               and e.status = 'finalizat'
           )
        then now()
    end,
    case
      when ti.verificare_automata = 'inventar_returnat' and not v_liber
        then 'Bunuri nereturnate: ' || array_to_string(v_lipsa, ', ')
    end
  from public.checklist_template_items ti
  where ti.template_id = new.template_id
    and ti.organization_id = new.organization_id
    and ti.deleted_at is null
  order by ti.ordine;

  return null;
end;
$$;

---------------------------------------------------------------------------
-- 3. Sincronizarea: cursul terminat bifează pasul
---------------------------------------------------------------------------
-- `security definer`: rulează în sesiunea ANGAJATULUI, care n-are — și nu
-- trebuie să aibă — drept de scriere pe pașii altcuiva. Sub INVOKER, UPDATE-ul
-- ar fi afectat ZERO RÂNDURI, FĂRĂ EROARE, iar cursul s-ar fi închis cu pasul
-- de integrare rămas nebifat, tăcut.
--
-- Nu ridică niciodată excepție: dacă modulul de integrare e stins, dacă nu
-- există niciun pas legat sau dacă instanța e deja închisă, se întoarce fără
-- să scrie. O eroare aici ar ANULA finalizarea cursului — puntea n-are voie să
-- fie mai importantă decât lucrul pe care îl leagă.

create or replace function internal.cursuri_sincronizeaza_checklist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.feature_on(new.organization_id, 'onboarding') then
    return null;
  end if;

  update public.checklist_instance_items ii
     set status = 'bifat',
         bifat_automat = true,
         bifat_la = now(),
         updated_at = now()
    from public.checklist_instances ci
   where ci.id = ii.instance_id
     and ci.deleted_at is null
     and ci.status = 'in_curs'
     and ii.organization_id = new.organization_id
     and ii.employee_id = new.employee_id
     and ii.curs_id = new.course_id
     and ii.verificare_automata = 'curs_finalizat'
     and ii.deleted_at is null
     and ii.status <> 'bifat';

  return null;
end;
$$;

revoke all on function internal.cursuri_sincronizeaza_checklist() from public, anon, authenticated;

-- Clauza `when` e cea care exprimă „s-a schimbat"; `of status` doar restrânge
-- declanșarea. Numerotat 50, după dovada de la 40: pasul se bifează abia după
-- ce dovada cursului există.
create trigger trg_course_enrollments_50_checklist
  after update of status on public.course_enrollments
  for each row
  when (new.status = 'finalizat' and old.status is distinct from 'finalizat')
  execute function internal.cursuri_sincronizeaza_checklist();

commit;
