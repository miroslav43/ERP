-- =============================================================================
-- 0095_integrare_notificari.sql — Faza „Integrare ca la carte”, tranșa 6
--
-- Numărul e 0095, nu 0094: a doua coliziune cu sesiunea care livrează
-- invitațiile (`0094_invitatie_acceptarea_trece_de_gardian.sql`). Convenția e
-- să-ți redenumești PROPRIA migrare.
--
-- Un pas atribuit cuiva trebuie să AJUNGĂ la el. Până acum, modulul de
-- integrare nu producea nicio notificare — verificat prin grep peste toate
-- migrările: zero apariții de `checklist` în fișierele care scriu în
-- `public.notifications`. Un pas cu responsabil era o bifă pe care cineva
-- trebuia să se nimerească s-o caute.
--
-- ── FĂRĂ TABELĂ NOUĂ DE SARCINI ─────────────────────────────────────────
-- `public.checklist_instance_items` ESTE tabela de sarcini: are responsabil
-- (materializat în persoană de 0089), `termen date`, `status` cu stare
-- intermediară `in_lucru`, și `bifat_de`/`bifat_la` ca dovadă. Lipseau exact
-- notificările și un ecran.
--
-- `approval_tasks` a fost respinsă din același motiv pentru care a respins-o
-- ticketingul, scris la 0045:15-22: `approval_tasks_select` are resursa
-- HARDCODATĂ pe `leave`. O tabelă `checklist_tasks` ar fi dublat 1:1 responsabil
-- + termen + status, ar fi cerut un trigger de oglindire și ar fi ocolit
-- `trg_checklist_instance_items_10_pas` — singurul loc unde dovada e impusă.
-- Memoria proiectului numește exact defectul ăsta: „approval_tasks nu urmează
-- starea cererii”.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. La pornirea parcursului, fiecare responsabil află ce are de făcut
-- -----------------------------------------------------------------------------
-- Un singur mesaj per persoană, cu NUMĂRUL de pași — nu câte o notificare pe
-- pas. Un onboarding de 12 pași ar fi produs altfel 12 notificări pentru HR,
-- dintr-un singur gest.
--
-- Rulează DUPĂ `trg_checklist_instances_30_copiaza` (ordinea e alfabetică pe
-- numele triggerului) și ÎNAINTE de `40_dovada`. `security definer`: citește
-- `employees.user_id` și scrie în `notifications`, două tabele pe care cel care
-- pornește parcursul nu le are neapărat deschise.
create or replace function internal.checklist_notifica_responsabilii()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_nume text;
begin
  v_nume := coalesce(app.checklist_nume_angajat(new.organization_id, new.employee_id), 'un coleg');

  insert into public.notifications (
    user_id, organization_id, kind, title, body, link, entity_type, entity_id
  )
  select
    e.user_id,
    new.organization_id,
    'task',
    format('Aveți %s de făcut în integrarea lui %s',
           case when count(*) = 1 then 'un pas' else count(*)::text || ' pași' end,
           v_nume),
    case when min(ii.termen) is null then null
         else 'Primul termen: ' || to_char(min(ii.termen), 'DD.MM.YYYY') || '.' end,
    -- Calea din `(app)`. Pentru rolul `employee`, portalul o traduce la afișare
    -- (`portal/notificarile-mele/legaturi.ts`); CHECK-ul din 0001 cere oricum o
    -- cale internă, deci nu se poate scrie un URL absolut aici.
    '/onboarding/' || new.id::text,
    'checklist_instances',
    new.id
  from public.checklist_instance_items ii
  join public.employees e
    on e.id = ii.responsabil_employee_id
   and e.organization_id = ii.organization_id
   and e.deleted_at is null
  where ii.instance_id = new.id
    and ii.deleted_at is null
    and ii.status <> 'bifat'
    -- Fără cont nu există cui să-i trimiți: fișa există, omul nu s-a
    -- autentificat niciodată. Nu e o eroare, e o firmă în curs de populare —
    -- 4 din 10 angajați sunt în situația asta azi.
    and e.user_id is not null
  group by e.user_id;

  return null;
end;
$$;

revoke all on function internal.checklist_notifica_responsabilii() from public, anon, authenticated;

create trigger trg_checklist_instances_35_notifica
  after insert on public.checklist_instances
  for each row execute function internal.checklist_notifica_responsabilii();

-- -----------------------------------------------------------------------------
-- 2. Reamintirea, pe termen
-- -----------------------------------------------------------------------------
-- Tiparul e `internal.cursuri_reaminteste` (0075:970). Întoarce numărul de
-- mesaje scrise, ca jobul să poată fi rulat și manual, cu rezultat vizibil.
--
-- `on conflict` nu există pe `notifications`, deci deduplicarea se face prin
-- `not exists`: fără ea, cronul ar scrie același mesaj în fiecare zi până la
-- termen. Fereastra e „ziua în care mai sunt exact N zile”, nu „mai puțin de N”.
create or replace function internal.checklist_reaminteste()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scrise integer := 0;
begin
  with tinta as (
    select ii.id, ii.organization_id, ii.instance_id, ii.titlu, ii.termen,
           e.user_id, (ii.termen - current_date) as zile
      from public.checklist_instance_items ii
      join public.employees e
        on e.id = ii.responsabil_employee_id
       and e.organization_id = ii.organization_id
       and e.deleted_at is null
      join public.checklist_instances ci
        on ci.id = ii.instance_id
       and ci.deleted_at is null
       and ci.status = 'in_curs'
     where ii.deleted_at is null
       and ii.status not in ('bifat', 'neaplicabil')
       and ii.termen is not null
       and e.user_id is not null
       and app.feature_on(ii.organization_id, 'onboarding')
       -- Cu trei zile înainte, în ziua termenului, și o dată după.
       and (ii.termen - current_date) in (3, 0, -1)
  ), scrise as (
    insert into public.notifications (
      user_id, organization_id, kind, title, body, link, entity_type, entity_id
    )
    select t.user_id, t.organization_id,
           case when t.zile < 0 then 'warning' else 'task' end::public.notification_kind,
           case
             when t.zile > 0 then format('Mai aveți %s zile pentru „%s”', t.zile, t.titlu)
             when t.zile = 0 then format('Astăzi e termenul pentru „%s”', t.titlu)
             else format('Termenul pentru „%s” a trecut', t.titlu)
           end,
           'Termen: ' || to_char(t.termen, 'DD.MM.YYYY') || '.',
           '/onboarding/' || t.instance_id::text,
           'checklist_instance_items', t.id
      from tinta t
     where not exists (
       select 1 from public.notifications n
        where n.entity_type = 'checklist_instance_items'
          and n.entity_id = t.id
          and n.user_id = t.user_id
          and n.deleted_at is null
          and n.created_at >= current_date
     )
    returning 1
  )
  select count(*)::integer into v_scrise from scrise;

  return v_scrise;
end;
$$;

revoke all on function internal.checklist_reaminteste() from public, anon, authenticated;

commit;

-- -----------------------------------------------------------------------------
-- 3. Jobul zilnic
-- -----------------------------------------------------------------------------
-- Garda de disponibilitate, aceeași convenție ca în 0008, 0042 și 0075:
-- migrarea rulează și pe un Postgres 17 gol, în CI, unde `pg_cron` nu există.
-- Fără gardă, `create extension` ar opri AICI tot lanțul de migrări.
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema cron;

    perform cron.unschedule('integrare-reamintiri')
     where exists (select 1 from cron.job where jobname = 'integrare-reamintiri');

    perform cron.schedule(
      'integrare-reamintiri',
      '25 4 * * *',
      $job$select internal.checklist_reaminteste()$job$
    );
  else
    raise notice 'pg_cron indisponibil: reamintirile de integrare nu au fost programate.';
  end if;
end;
$do$;

-- -----------------------------------------------------------------------------
-- 4. Verificarea migrării
-- -----------------------------------------------------------------------------
do $$
declare
  v_lipsa text[] := '{}';
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
     where tgname = 'trg_checklist_instances_35_notifica'
       and tgrelid = 'public.checklist_instances'::regclass
  ) then
    v_lipsa := v_lipsa || 'triggerul de notificare';
  end if;

  -- Ordinea contează: notificarea numără pașii, deci trebuie să ruleze DUPĂ
  -- copierea lor. Triggerele AFTER se execută alfabetic pe nume.
  if 'trg_checklist_instances_35_notifica' <= 'trg_checklist_instances_30_copiaza' then
    v_lipsa := v_lipsa || 'notificarea ar rula înaintea copierii pașilor';
  end if;

  -- Indexul pe responsabil vine din 0088; fără el, „ce am eu de făcut” ar
  -- scana toată tabela.
  if not exists (
    select 1 from pg_catalog.pg_indexes
     where schemaname = 'public' and indexname = 'checklist_instance_items_responsabil_idx'
  ) then
    v_lipsa := v_lipsa || 'indexul parțial pe responsabil';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0095 nu s-a aplicat complet: %', array_to_string(v_lipsa, ', ');
  end if;
end;
$$;
