-- tests/rls/proba-mentenanta-integritate.sql
--
-- INTEGRITATEA TRIGGERELOR DE MENTENANȚĂ, DUPĂ 0180.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Cinci defecte tăcute ale triggerelor din 0011 au trăit un an fără ca vreun
-- test să le vadă: niciunul nu dădea eroare, toate dădeau o CIFRĂ greșită —
-- o scadență pe contor întoarsă la zero, o autorizație ISCIR care cădea pe o
-- tabelă nepomenită de formular, un plan dezactivat care rămânea în alerte.
-- Testele de acțiuni rulează pe un client Supabase fals și nu văd triggerele;
-- izolare.sql verifică cine vede ce, nu ce calculează baza. Rămâne proba reală.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) autorizația ISCIR cu tip liber („PT R1") se salvează          [POZITIVĂ]
--     și are rândul ei de scadență, pe autorizație, cu `kind` fix;
-- (2) două autorizații pe același utilaj au două rânduri de scadență;
-- (3) suspendarea scoate autorizația din scadențe, reactivarea o aduce înapoi;
-- (4) planul pe contor pornește de la contorul REAL, nu de la zero  [POZITIVĂ];
-- (5) editarea planului nu-i atinge citirea de pornire; un `null` explicit o
--     reancorează la contor, nu la zero;
-- (6) planul dezactivat iese din scadențe; periodicitatea scoasă retrage rândul;
-- (7) intervenția pe planul altui echipament e refuzată;
-- (8) intervenția reușită mută `ultima_executie`; anularea ei o readuce;
-- (9) corecția unei citiri vechi nu poate sări peste citirea următoare;
--     anularea logică a unei citiri nu se mai validează;
-- (10) `updated_at` se mișcă la UPDATE pe tabelele de mentenanță.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_echip   uuid := gen_random_uuid();
  v_echip2  uuid := gen_random_uuid();
  v_aut1    uuid := gen_random_uuid();
  v_aut2    uuid := gen_random_uuid();
  v_plan_c  uuid := gen_random_uuid();
  v_plan_z  uuid := gen_random_uuid();
  v_int1    uuid := gen_random_uuid();
  v_int2    uuid := gen_random_uuid();
  v_cit1    uuid := gen_random_uuid();
  v_cit2    uuid := gen_random_uuid();
  v_cit3    uuid := gen_random_uuid();
  v_azi     date := app.azi_local();
  v_n       integer;
  v_num     numeric;
  v_data    date;
  v_bool    boolean;
  v_ts      timestamptz;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „INTEGRITATEA MENTENANȚEI" (0180)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-ment-' || v_sufix, 'Proba Mentenanță SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into public.equipment (id, organization_id, cod, denumire) values
    (v_echip,  v_org, 'PRS-' || v_sufix, 'Presă hidraulică'),
    (v_echip2, v_org, 'CMP-' || v_sufix, 'Compresor');

  -- Trei citiri de contor pe presă: 3000 (acum 30 de zile), 3200 (ieri), 3300 (azi).
  insert into public.equipment_meters (id, organization_id, equipment_id, tip, citire, data_citirii) values
    (v_cit1, v_org, v_echip, 'ore', 3000, v_azi - 30),
    (v_cit2, v_org, v_echip, 'ore', 3200, v_azi - 1),
    (v_cit3, v_org, v_echip, 'ore', 3300, v_azi);

  -- ═══ (1) ISCIR cu tip liber [POZITIVĂ] ═══════════════════════════════════
  begin
    insert into public.iscir_authorizations
      (id, organization_id, equipment_id, numar, tip, valabil_pana, scadenta_verificare_tehnica)
    values (v_aut1, v_org, v_echip, 'RSVTI-' || v_sufix || '-1', 'PT R1', v_azi + 400, v_azi + 100);

    select count(*) into v_n from public.expirables e
     where e.organization_id = v_org and e.entity_type = 'iscir_authorization'
       and e.entity_id = v_aut1 and e.deleted_at is null and e.is_active
       and e.kind in ('autorizatie', 'verificare_tehnica');
    if v_n = 2 then
      raise notice '  ✓ (1) autorizația „PT R1" se salvează și are două scadențe pe autorizație';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (1) autorizația are % rânduri de scadență, nu 2', v_n;
    end if;
  exception when others then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) autorizația cu tip liber a fost refuzată: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (2) Două autorizații, două rânduri ═══════════════════════════════════
  insert into public.iscir_authorizations (id, organization_id, equipment_id, numar, tip, valabil_pana)
  values (v_aut2, v_org, v_echip, 'RSVTI-' || v_sufix || '-2', 'PT R1', v_azi + 700);
  select count(*) into v_n from public.expirables e
   where e.organization_id = v_org and e.entity_type = 'iscir_authorization'
     and e.kind = 'autorizatie' and e.deleted_at is null
     and e.entity_id in (v_aut1, v_aut2);
  if v_n = 2 then
    raise notice '  ✓ (2) două autorizații pe același utilaj au două rânduri de scadență';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) două autorizații împart % rând(uri) de scadență', v_n;
  end if;

  -- ═══ (3) Suspendare / reactivare ═════════════════════════════════════════
  update public.iscir_authorizations set suspendata_la = v_azi where id = v_aut2;
  select e.is_active into v_bool from public.expirables e
   where e.entity_type = 'iscir_authorization' and e.entity_id = v_aut2
     and e.kind = 'autorizatie' and e.deleted_at is null;
  if v_bool = false then
    update public.iscir_authorizations set suspendata_la = null where id = v_aut2;
    select e.is_active into v_bool from public.expirables e
     where e.entity_type = 'iscir_authorization' and e.entity_id = v_aut2
       and e.kind = 'autorizatie' and e.deleted_at is null;
    if v_bool then
      raise notice '  ✓ (3) suspendarea scoate autorizația din scadențe, reactivarea o aduce înapoi';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (3) autorizația reactivată a rămas inactivă în scadențe';
    end if;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) autorizația suspendată a rămas activă în scadențe';
  end if;

  -- ═══ (4) Planul pe contor pornește de la contorul real [POZITIVĂ] ════════
  insert into public.maintenance_plans
    (id, organization_id, equipment_id, denumire, periodicitate_contor, tip_contor)
  values (v_plan_c, v_org, v_echip, 'Revizie la 500 h', 500, 'ore');
  select p.urmatoarea_scadenta_contor into v_num from public.maintenance_plans p where p.id = v_plan_c;
  if v_num = 3800 then
    raise notice '  ✓ (4) planul nou pornește de la ultima citire (3300): scadența pe contor e 3800';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) scadența pe contor a planului nou e %, nu 3800', v_num;
  end if;

  -- ═══ (5) Editarea nu atinge citirea de pornire ═══════════════════════════
  update public.maintenance_plans set denumire = 'Revizie la 500 de ore' where id = v_plan_c;
  select p.urmatoarea_scadenta_contor into v_num from public.maintenance_plans p where p.id = v_plan_c;
  if v_num = 3800 then
    update public.maintenance_plans set ultima_citire_contor = null where id = v_plan_c;
    select p.urmatoarea_scadenta_contor into v_num from public.maintenance_plans p where p.id = v_plan_c;
    if v_num = 3800 then
      raise notice '  ✓ (5) redenumirea nu mișcă scadența; un null explicit reancorează la contor, nu la zero';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5) după `ultima_citire_contor = null` scadența e %, nu 3800', v_num;
    end if;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) redenumirea planului a mutat scadența pe contor la %', v_num;
  end if;

  -- ═══ (6) Planul dezactivat iese din scadențe; periodicitatea scoasă retrage rândul ═
  insert into public.maintenance_plans
    (id, organization_id, equipment_id, denumire, periodicitate_zile, ultima_executie)
  values (v_plan_z, v_org, v_echip2, 'Verificare PRAM', 365, v_azi - 10);
  select e.is_active into v_bool from public.expirables e
   where e.entity_type = 'maintenance_plan' and e.entity_id = v_plan_z and e.deleted_at is null;
  if v_bool is distinct from true then
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) planul activ nu are rând activ în scadențe';
  else
    update public.maintenance_plans set activ = false where id = v_plan_z;
    select e.is_active into v_bool from public.expirables e
     where e.entity_type = 'maintenance_plan' and e.entity_id = v_plan_z and e.deleted_at is null;
    if v_bool is distinct from false then
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (6) planul dezactivat a rămas activ în scadențe';
    else
      update public.maintenance_plans
         set activ = true, periodicitate_zile = null, periodicitate_contor = 100, tip_contor = 'ore'
       where id = v_plan_z;
      select count(*) into v_n from public.expirables e
       where e.entity_type = 'maintenance_plan' and e.entity_id = v_plan_z and e.deleted_at is null;
      if v_n = 0 then
        raise notice '  ✓ (6) planul dezactivat iese din scadențe; fără periodicitate în zile, rândul se retrage';
      else
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (6) planul fără scadență calendaristică a rămas în scadențe (% rând)', v_n;
      end if;
    end if;
  end if;

  -- ═══ (7) Intervenția pe planul altui echipament ═══════════════════════════
  begin
    insert into public.maintenance_interventions
      (organization_id, equipment_id, plan_id, data, descriere)
    values (v_org, v_echip2, v_plan_c, v_azi, 'Revizie pe utilajul greșit');
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) intervenția pe planul altui echipament a trecut';
  exception when raise_exception then
    if sqlerrm like '%aparține altui echipament%' then
      raise notice '  ✓ (7) intervenția pe planul altui echipament e refuzată cu P0001';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (7) refuz cu alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ═══ (8) Aplicare și retragere ════════════════════════════════════════════
  insert into public.maintenance_interventions
    (id, organization_id, equipment_id, plan_id, data, descriere, citire_contor)
  values (v_int1, v_org, v_echip, v_plan_c, v_azi - 20, 'Prima revizie', 3100);
  insert into public.maintenance_interventions
    (id, organization_id, equipment_id, plan_id, data, descriere, citire_contor)
  values (v_int2, v_org, v_echip, v_plan_c, v_azi - 2, 'A doua revizie', 3250);
  select p.ultima_executie, p.urmatoarea_scadenta_contor into v_data, v_num
    from public.maintenance_plans p where p.id = v_plan_c;
  if v_data = v_azi - 2 and v_num = 3750 then
    update public.maintenance_interventions set deleted_at = now() where id = v_int2;
    select p.ultima_executie, p.urmatoarea_scadenta_contor into v_data, v_num
      from public.maintenance_plans p where p.id = v_plan_c;
    if v_data = v_azi - 20 and v_num = 3600 then
      raise notice '  ✓ (8) intervenția reușită mută planul; anularea ei îl readuce la cea anterioară';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (8) după anulare: ultima_executie=%, scadența pe contor=% (așteptat %, 3600)',
        v_data, v_num, v_azi - 20;
    end if;
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) după două intervenții: ultima_executie=%, scadența pe contor=% (așteptat %, 3750)',
      v_data, v_num, v_azi - 2;
  end if;

  -- ═══ (9) Corecția unei citiri vechi vs. citirea următoare ═════════════════
  begin
    update public.equipment_meters set citire = 3350 where id = v_cit2;  -- peste 3300 de azi
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) corecția peste citirea următoare a trecut';
  exception when raise_exception then
    if sqlerrm like '%mai mare decât citirea următoare%' then
      begin
        update public.equipment_meters set citire = 3250 where id = v_cit2;   -- între 3000 și 3300
        update public.equipment_meters set deleted_at = now() where id = v_cit1; -- anulare: nevalidată
        raise notice '  ✓ (9) corecția peste citirea următoare e refuzată; corecția validă și anularea trec';
      exception when others then
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (9) corecția validă sau anularea a fost refuzată: % (%)', sqlerrm, sqlstate;
      end;
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (9) refuz cu alt mesaj: %', sqlerrm;
    end if;
  end;

  -- ═══ (10) updated_at e scris de trigger ═══════════════════════════════════
  -- Toată proba e O tranzacție, deci `now()` e același la inserare și la
  -- modificare — „se mișcă" nu se poate observa. Se verifică în schimb că
  -- triggerul BATE o valoare trimisă explicit: un `updated_at` pus de mână în
  -- trecut trebuie să iasă `now()`.
  select e.updated_at into v_ts from public.equipment e where e.id = v_echip;
  update public.equipment
     set locatie = 'Hala 2', updated_at = v_ts - interval '1 day'
   where id = v_echip;
  select (e.updated_at = now()) into v_bool from public.equipment e where e.id = v_echip;
  if v_bool then
    raise notice '  ✓ (10) `updated_at` e scris de trigger la UPDATE, peste orice valoare trimisă';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) `updated_at` a păstrat valoarea trimisă din client';
  end if;

  -- Fixture-ul rămâne în bancul de unică folosință, ca la celelalte probe:
  -- organizația are rânduri însămânțate de triggere (parametrii SSM) care fac
  -- ștergerea ei mai scumpă decât merită într-o bază aruncată la final.

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'Proba integrității mentenanței: % verificări picate.', v_esecuri;
  end if;
  raise notice '  Toate verificările au trecut.';
end $$;
