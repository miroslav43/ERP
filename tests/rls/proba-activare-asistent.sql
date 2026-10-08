-- tests/rls/proba-activare-asistent.sql
--
-- ADMINISTRATORUL FIRMEI ÎȘI ACTIVEAZĂ SINGUR FIRMA LA FINALUL ASISTENTULUI (0186).
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1) un `org_admin` trece propria firmă din `pending` în `active`, cu
--     `activated_at` scris                                          [POZITIVĂ];
-- (2) dar NU poate schimba, pe același UPDATE, coloanele platformei (`plan`,
--     `seats_limit`, `cui`): garda le readuce la valoarea veche;
-- (3) și NU poate face nicio altă tranziție de stare: `active` → `suspended`
--     rămâne `active`;
-- (4) iar un `hr` (fără `organizations:update`) nu activează nimic.
--
-- Până la 0186, (1) pica TĂCUT: UPDATE-ul reușea, rândul se întorcea, dar
-- `status` rămânea `pending`. Nicio firmă înregistrată public nu putea termina
-- asistentul (QA 8 oct 2026, ONB-011).
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_u_adm   uuid := gen_random_uuid();
  v_u_hr    uuid := gen_random_uuid();
  v_status  text;
  v_plan    text;
  v_locuri  int;
  v_cui     text;
  v_activat timestamptz;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „ACTIVAREA FIRMEI DIN ASISTENT" (0186)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui, status, plan, seats_limit) values
    (v_org, 'proba-activare-' || v_sufix, 'Proba Activare SRL',
     'RO' || (87000000 + (random() * 900000)::int)::text, 'pending', 'trial', 10);

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm, 'act-adm-' || v_sufix || '@proba.test', now()),
    (v_u_hr,  'act-hr-'  || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_adm, 'org_admin'),
    (v_org, v_u_hr,  'hr');

  -- (4) HR, înaintea activării: nu are `organizations:update`, deci nimic nu se schimbă
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    update public.organizations
       set status = 'active', activated_at = now()
     where id = v_org and status = 'pending';
    reset role;
  exception when others then
    reset role;
  end;
  select status into v_status from public.organizations where id = v_org;
  if v_status = 'pending' then
    raise notice '  ✓ (4) hr nu poate activa firma';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) hr a dus firma în %', v_status;
  end if;

  -- (1) + (2) administratorul: activare, cu încercare de a-și ridica plafonul pe același rând
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.organizations
       set status = 'active', activated_at = now(),
           plan = 'enterprise', seats_limit = 999, cui = 'RO1',
           legal_name = 'Proba Activare S.R.L.'
     where id = v_org and status = 'pending';
    reset role;
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) UPDATE-ul administratorului a picat: % (%)', sqlerrm, sqlstate;
  end;
  select status, plan, seats_limit, cui, activated_at
    into v_status, v_plan, v_locuri, v_cui, v_activat
    from public.organizations where id = v_org;
  if v_status = 'active' and v_activat is not null then
    raise notice '  ✓ (1) org_admin și-a activat firma (activated_at scris)';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) firma a rămas % (activated_at %)', v_status, v_activat;
  end if;
  if v_plan = 'trial' and v_locuri = 10 and v_cui <> 'RO1' then
    raise notice '  ✓ (2) plan, locuri și CUI au rămas ale platformei';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) coloanele platformei s-au schimbat: plan=% locuri=% cui=%', v_plan, v_locuri, v_cui;
  end if;

  -- (3) orice altă tranziție rămâne a platformei
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  begin
    update public.organizations set status = 'suspended' where id = v_org;
    reset role;
  exception when others then
    reset role;
  end;
  select status into v_status from public.organizations where id = v_org;
  if v_status = 'active' then
    raise notice '  ✓ (3) org_admin nu poate suspenda sau readuce firma în așteptare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) org_admin a dus firma în %', v_status;
  end if;

  -- Fără curățenie: seed-urile din trigger (SSM, nomenclator) țin firma prin
  -- chei străine, iar bancul e oricum un container efemer, ca la celelalte probe.

  if v_esecuri > 0 then
    raise exception 'proba-activare-asistent: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOT VERDE';
end $$;
