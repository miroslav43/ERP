-- =============================================================================
-- 0090_integrare_salvare_sablon.sql — Faza „Integrare ca la carte”, tranșa 3
--
-- Un șablon se salvează într-o SINGURĂ tranzacție: antet, etape și pași
-- deodată.
--
-- ── DE CE ────────────────────────────────────────────────────────────────
-- Azi construcția unui șablon de 12 pași costă ~13 drumuri PostgREST
-- neatomice: `creeazaSablon`, apoi `adaugaPas` de douăsprezece ori, fiecare cu
-- `router.refresh()`. Nimic nu le leagă. Fluxul se pierde pe la al șaptelea, iar
-- ce rămâne în bază e jumătate de șablon care arată ca unul întreg. Asta e, la
-- propriu, senzația de „făcut la mișto”.
--
-- Precedente pe disc pentru RPC-ul care înghite un jsonb și scrie atomic:
-- `public.payroll_scrie_rezultate` (0052:22), `public.trimite_saptamana_pontaj`
-- (0081), `public.decide_zi_pontaj` (0067).
--
-- ── REORDONAREA: PARCARE NEGATIVĂ, NU DANS ÎN TREI PAȘI ──────────────────
-- `checklist_template_items_ordine_uk (template_id, ordine)` NU e amânabil,
-- deci o rescriere a pozițiilor s-ar lovi de el la prima suprapunere. `mutaPas`
-- (actions.ts:452) rezolvă asta mutând un rând la `max+1` și înapoi — trei
-- UPDATE-uri pentru o singură mutare, neatomice, cu mesaje de eroare care spun
-- „reordonarea s-a oprit la jumătate”.
--
-- Aici toate pozițiile se rescriu deodată, deci e loc pentru ceva mai bun:
-- `set ordine = -ordine` pe tot șablonul. Negativele nu se pot ciocni de
-- pozitive, deci indexul tace, iar renumerotarea finală pleacă de pe teren gol.
-- Un singur UPDATE în loc de trei pe mutare, și nu consumă sloturi din 1..500.
--
-- Ca banda negativă să NU devină stare legală în repaus — un rând scris direct
-- prin PostgREST cu `ordine = -3` ar fi altfel acceptat și randat ca primul —
-- CK-ul se lărgește ȘI se adaugă un constraint trigger `deferrable initially
-- deferred` care refuză negativele la COMMIT. Înăuntrul funcției parcarea e
-- invizibilă; în afara ei e imposibilă.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Banda negativă devine legală în tranzacție, ilegală la commit
-- -----------------------------------------------------------------------------
alter table public.checklist_template_items
  drop constraint checklist_template_items_ordine_ck;

alter table public.checklist_template_items
  add constraint checklist_template_items_ordine_ck
  check (ordine between -500 and 500 and ordine <> 0);

alter table public.checklist_template_stages
  drop constraint checklist_template_stages_ordine_ck;

alter table public.checklist_template_stages
  add constraint checklist_template_stages_ordine_ck
  check (ordine between -100 and 100 and ordine <> 0);

create or replace function internal.checklist_ordine_pozitiva()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Rândurile șterse logic pot rămâne negative: ies oricum din indexul parțial
  -- și din orice listă. Ce contează e ce e VIU la commit.
  if new.deleted_at is null and new.ordine < 0 then
    raise exception using errcode = 'P0001',
      message = format(
        'Poziția %s este o parcare de reordonare, nu o stare validă. Salvarea nu s-a încheiat corect.',
        new.ordine);
  end if;
  return null;
end;
$$;

revoke all on function internal.checklist_ordine_pozitiva() from public, anon, authenticated;

create constraint trigger trg_checklist_template_items_90_ordine
  after insert or update on public.checklist_template_items
  deferrable initially deferred
  for each row execute function internal.checklist_ordine_pozitiva();

create constraint trigger trg_checklist_template_stages_90_ordine
  after insert or update on public.checklist_template_stages
  deferrable initially deferred
  for each row execute function internal.checklist_ordine_pozitiva();

-- -----------------------------------------------------------------------------
-- 2. Un singur pas — scris sau rescris
-- -----------------------------------------------------------------------------
-- Extras din funcția mare fiindcă e chemat din două bucle (pași în etapă și
-- pași fără etapă) și pentru că lista de coloane e lungă: două copii ar diverge.
-- `fel` NU apare — e coloană generată din 0089.
create or replace function app.checklist_scrie_pasul(
  p_org      uuid,
  p_template uuid,
  p_etapa    uuid,
  p_ordine   smallint,
  p_pas      jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_pas_id uuid := nullif(p_pas->>'id', '')::uuid;
begin
  if v_pas_id is null then
    insert into public.checklist_template_items (
      organization_id, template_id, etapa_id, ordine, titlu, descriere,
      responsabil_tip, responsabil_rol, responsabil_employee_id,
      termen_zile_relativ, obligatoriu, tip_dovada, verificare_automata, curs_id
    ) values (
      p_org, p_template, p_etapa, p_ordine,
      p_pas->>'titlu',
      nullif(p_pas->>'descriere', ''),
      coalesce((p_pas->>'responsabil_tip')::public.checklist_responsabil_tip, 'subiect'),
      nullif(p_pas->>'responsabil_rol', '')::public.app_role,
      nullif(p_pas->>'responsabil_employee_id', '')::uuid,
      coalesce((p_pas->>'termen_zile_relativ')::smallint, 0),
      coalesce((p_pas->>'obligatoriu')::boolean, true),
      coalesce((p_pas->>'tip_dovada')::public.checklist_tip_dovada, 'bifa'),
      nullif(p_pas->>'verificare_automata', '')::public.checklist_verificare,
      nullif(p_pas->>'curs_id', '')::uuid
    );
  else
    update public.checklist_template_items ti
       set etapa_id                = p_etapa,
           ordine                  = p_ordine,
           titlu                   = p_pas->>'titlu',
           descriere               = nullif(p_pas->>'descriere', ''),
           responsabil_tip         = coalesce((p_pas->>'responsabil_tip')::public.checklist_responsabil_tip, 'subiect'),
           responsabil_rol         = nullif(p_pas->>'responsabil_rol', '')::public.app_role,
           responsabil_employee_id = nullif(p_pas->>'responsabil_employee_id', '')::uuid,
           termen_zile_relativ     = coalesce((p_pas->>'termen_zile_relativ')::smallint, 0),
           obligatoriu             = coalesce((p_pas->>'obligatoriu')::boolean, true),
           tip_dovada              = coalesce((p_pas->>'tip_dovada')::public.checklist_tip_dovada, 'bifa'),
           verificare_automata     = nullif(p_pas->>'verificare_automata', '')::public.checklist_verificare,
           curs_id                 = nullif(p_pas->>'curs_id', '')::uuid,
           deleted_at              = null,
           updated_at              = now()
     where ti.id = v_pas_id
       and ti.organization_id = p_org
       and ti.template_id = p_template;

    if not found then
      raise exception using errcode = 'P0001',
        message = 'Un pas trimis nu aparține acestui șablon.';
    end if;
  end if;
end;
$fn$;

revoke all on function app.checklist_scrie_pasul(uuid, uuid, uuid, smallint, jsonb) from public, anon;
-- În `app`, nu în `internal`: funcția-părinte e `security invoker`, deci rulează
-- ca `authenticated`, care nu are USAGE pe `internal`. `security definer` pe
-- ajutor ar fi rezolvat eroarea și ar fi ocolit RLS-ul la scrierea pașilor —
-- adică exact poarta pentru care funcția e invoker. `app` nu e expusă de
-- PostgREST (`.rpc()` vede doar `public`), deci nu se deschide nimic.
grant execute on function app.checklist_scrie_pasul(uuid, uuid, uuid, smallint, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Salvarea completă a unui șablon
-- -----------------------------------------------------------------------------
-- `security invoker`: RLS decide. Insertul pe `checklist_templates` cere
-- `checklists:create = all`, updatele cer `checklists:update = all` — exact ca
-- înainte, doar că într-o singură tranzacție.
--
-- Forma așteptată a lui `p_sablon`:
--   { id, denumire, tip, descriere, department_id, job_position_id, activ,
--     valabil_de_la, valabil_pana_la,
--     etape: [ { id, titlu, descriere, termen_zile_relativ,
--                pasi: [ { id, titlu, descriere, responsabil_tip, responsabil_rol,
--                          responsabil_employee_id, termen_zile_relativ,
--                          obligatoriu, tip_dovada, verificare_automata, curs_id } ] } ] }
--
-- `id` lipsă sau null ⇒ rând nou. Ce nu apare în încărcătură se șterge LOGIC:
-- un pas dispărut din asistent nu trebuie să rămână în șablon, dar nici să
-- dispară din instanțele deja pornite (care au copia lui).
create or replace function public.checklist_salveaza_sablon(p_sablon jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_org      uuid;
  v_id       uuid;
  v_etapa    jsonb;
  v_pas      jsonb;
  v_etapa_id uuid;
  v_nr_etapa smallint := 0;
  v_nr_pas   smallint := 0;
begin
  if p_sablon is null or jsonb_typeof(p_sablon) <> 'object' then
    raise exception using errcode = 'P0001', message = 'Șablonul trimis nu are forma așteptată.';
  end if;

  v_id := nullif(p_sablon->>'id', '')::uuid;

  ---------------------------------------------------------------------------
  -- Antetul
  ---------------------------------------------------------------------------
  if v_id is null then
    -- Organizația NU vine din încărcătură: se ia de la sesiune. Altfel
    -- clientul ar putea numi altă firmă, iar `WITH CHECK` ar fi ultima poartă.
    select o.id into v_org
      from public.organizations o
     where o.id = any ((select app.current_org_ids())::uuid[])
     limit 1;

    if v_org is null then
      raise exception using errcode = 'P0001', message = 'Nicio organizație activă în sesiune.';
    end if;

    insert into public.checklist_templates (
      organization_id, denumire, tip, descriere, department_id, job_position_id,
      activ, valabil_de_la, valabil_pana_la
    ) values (
      v_org,
      p_sablon->>'denumire',
      (p_sablon->>'tip')::public.checklist_tip,
      nullif(p_sablon->>'descriere', ''),
      nullif(p_sablon->>'department_id', '')::uuid,
      nullif(p_sablon->>'job_position_id', '')::uuid,
      coalesce((p_sablon->>'activ')::boolean, true),
      coalesce(nullif(p_sablon->>'valabil_de_la', '')::date, current_date),
      nullif(p_sablon->>'valabil_pana_la', '')::date
    )
    returning id, organization_id into v_id, v_org;
  else
    update public.checklist_templates t
       set denumire        = p_sablon->>'denumire',
           tip             = (p_sablon->>'tip')::public.checklist_tip,
           descriere       = nullif(p_sablon->>'descriere', ''),
           department_id   = nullif(p_sablon->>'department_id', '')::uuid,
           job_position_id = nullif(p_sablon->>'job_position_id', '')::uuid,
           activ           = coalesce((p_sablon->>'activ')::boolean, true),
           valabil_de_la   = coalesce(nullif(p_sablon->>'valabil_de_la', '')::date, t.valabil_de_la),
           valabil_pana_la = nullif(p_sablon->>'valabil_pana_la', '')::date,
           updated_at      = now()
     where t.id = v_id
       and t.deleted_at is null
    returning t.organization_id into v_org;

    -- Un UPDATE respins de clauza `USING` a politicii atinge ZERO RÂNDURI,
    -- FĂRĂ EROARE. Fără verificarea asta, funcția ar merge mai departe și ar
    -- părea că a salvat.
    if v_org is null then
      raise exception using errcode = 'P0001',
        message = 'Șablonul nu există sau nu aveți dreptul să-l modificați.';
    end if;
  end if;

  ---------------------------------------------------------------------------
  -- Parcarea: tot ce e viu trece pe banda negativă
  ---------------------------------------------------------------------------
  update public.checklist_template_items
     set ordine = -ordine
   where template_id = v_id and organization_id = v_org and deleted_at is null and ordine > 0;

  update public.checklist_template_stages
     set ordine = -ordine
   where template_id = v_id and organization_id = v_org and deleted_at is null and ordine > 0;

  ---------------------------------------------------------------------------
  -- Etapele și pașii, în ordinea din încărcătură
  ---------------------------------------------------------------------------
  for v_etapa in
    select value from jsonb_array_elements(coalesce(p_sablon->'etape', '[]'::jsonb))
  loop
    v_nr_etapa := v_nr_etapa + 1;
    v_etapa_id := nullif(v_etapa->>'id', '')::uuid;

    if v_etapa_id is null then
      insert into public.checklist_template_stages (
        organization_id, template_id, ordine, titlu, descriere, termen_zile_relativ
      ) values (
        v_org, v_id, v_nr_etapa,
        v_etapa->>'titlu',
        nullif(v_etapa->>'descriere', ''),
        coalesce((v_etapa->>'termen_zile_relativ')::smallint, 0)
      )
      returning id into v_etapa_id;
    else
      update public.checklist_template_stages st
         set ordine              = v_nr_etapa,
             titlu               = v_etapa->>'titlu',
             descriere           = nullif(v_etapa->>'descriere', ''),
             termen_zile_relativ = coalesce((v_etapa->>'termen_zile_relativ')::smallint, 0),
             deleted_at          = null,
             updated_at          = now()
       where st.id = v_etapa_id and st.organization_id = v_org and st.template_id = v_id;

      if not found then
        raise exception using errcode = 'P0001',
          message = 'O etapă trimisă nu aparține acestui șablon.';
      end if;
    end if;

    for v_pas in
      select value from jsonb_array_elements(coalesce(v_etapa->'pasi', '[]'::jsonb))
    loop
      v_nr_pas := v_nr_pas + 1;
      perform app.checklist_scrie_pasul(v_org, v_id, v_etapa_id, v_nr_pas, v_pas);
    end loop;
  end loop;

  -- Pașii fără etapă, dacă asistentul îi trimite (șabloane vechi, migrate).
  for v_pas in
    select value from jsonb_array_elements(coalesce(p_sablon->'pasi_fara_etapa', '[]'::jsonb))
  loop
    v_nr_pas := v_nr_pas + 1;
    perform app.checklist_scrie_pasul(v_org, v_id, null, v_nr_pas, v_pas);
  end loop;

  ---------------------------------------------------------------------------
  -- Ce a rămas pe banda negativă nu mai există în asistent: ștergere logică.
  -- Poziția se readuce pozitivă, ca triggerul amânat să nu se plângă și ca un
  -- eventual „undelete” să găsească o valoare cu sens.
  ---------------------------------------------------------------------------
  update public.checklist_template_items
     set ordine = -ordine, deleted_at = now(), updated_at = now()
   where template_id = v_id and organization_id = v_org and deleted_at is null and ordine < 0;

  update public.checklist_template_stages
     set ordine = -ordine, deleted_at = now(), updated_at = now()
   where template_id = v_id and organization_id = v_org and deleted_at is null and ordine < 0;

  return v_id;
end;
$fn$;

revoke all on function public.checklist_salveaza_sablon(jsonb) from public, anon;
grant execute on function public.checklist_salveaza_sablon(jsonb) to authenticated;

comment on function public.checklist_salveaza_sablon(jsonb) is
  'Salvează antetul, etapele și pașii unui șablon într-o singură tranzacție. Reordonarea folosește parcare negativă, nu dansul în trei UPDATE-uri.';

commit;

-- -----------------------------------------------------------------------------
-- 4. Verificarea migrării
-- -----------------------------------------------------------------------------
do $$
declare
  v_lipsa text[] := '{}';
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'checklist_salveaza_sablon'
  ) then
    v_lipsa := v_lipsa || 'functia de salvare';
  end if;

  -- Triggerul TREBUIE să fie amânat: unul imediat ar respinge chiar parcarea
  -- pe care funcția o folosește, deci salvarea ar cădea la primul pas.
  if not exists (
    select 1 from pg_catalog.pg_trigger
     where tgname = 'trg_checklist_template_items_90_ordine'
       and tgdeferrable and tginitdeferred
  ) then
    v_lipsa := v_lipsa || 'triggerul de ordine nu e DEFERRABLE INITIALLY DEFERRED';
  end if;

  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0090 nu s-a aplicat complet: %', array_to_string(v_lipsa, ', ');
  end if;
end;
$$;
