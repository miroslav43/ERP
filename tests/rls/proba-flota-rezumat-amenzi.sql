-- tests/rls/proba-flota-rezumat-amenzi.sql
--
-- FLOTA, 0206 §G: TERMENUL DE RĂSPUNS AL AMENZII ÎN REZUMATUL ZILNIC.
--
-- Decizia din 21 oct 2026: termenul amenzii (`expirables`, `vehicle_fine`)
-- intră în alertele zilnice ale responsabilului de flotă, prin lista albă din
-- `internal.flota_rezumat`. Destinatarul e DOAR responsabilul care citește
-- amenzile la `all` (sau administratorul, când niciun responsabil nu le
-- citește), niciodată șoferul.
--
-- ── CE VERIFICĂ ─────────────────────────────────────────────────────────────
-- (1)  responsabila cu cheie primește amenda în rezumat, alături de documentul
--      mașinii, iar titlul le numără pe amândouă                     [POZITIVĂ];
-- (2)  managerul responsabil (vede mașina, n-are cheia amenzilor) primește
--      documentul, NU amenda;
-- (3)  șoferul alocat primește documentul mașinii lui, NU amenda;
-- (4)  administratorul care nu e responsabil nu primește nimic (există
--      responsabil cu cheie);
-- (5)  a doua rulare din aceeași zi nu scrie nimic: aceleași rânduri în
--      `notifications` și în `alert_notifications`;
-- (6)  alertele amenzii sunt marcate DOAR pe responsabila cu cheie;
-- (7)  firmă fără responsabili, doar o amendă: administratorul primește o
--      notificare cu legătura spre amendă (`entity_type = vehicle_fine`); mai
--      multe amenzi → lista „De răspuns”; șoferul nimic               [POZITIVĂ];
-- (8)  după „răspuns trimis”, termenul iese din rezumat: o rulare nouă (pe
--      alerte noi) nu-l mai trimite.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   psql … -f tests/rls/proba-flota-rezumat-amenzi.sql
\set ON_ERROR_STOP on
\pset pager off

begin;

create function pg_temp.la(zi date, ora text) returns timestamptz
language sql immutable as $$ select (zi::timestamp + ora::interval) at time zone 'Europe/Bucharest' $$;

create function pg_temp.verifica(p_nr text, p_ok boolean, p_mesaj text, p_detaliu text default '') returns int
language plpgsql as $f$
begin
  if coalesce(p_ok, false) then
    raise notice '  ✓ (%) %', p_nr, p_mesaj;
    return 0;
  end if;
  raise warning '  ✗ (%) % [%]', p_nr, p_mesaj, p_detaliu;
  return 1;
end
$f$;

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_zi       date := app.azi_local();
  v_org      uuid := gen_random_uuid();
  v_org_b    uuid := gen_random_uuid();
  v_u_adm    uuid := gen_random_uuid();
  v_u_resp   uuid := gen_random_uuid();  -- a doua administratoare, responsabilă de flotă
  v_u_mgr    uuid := gen_random_uuid();  -- manager, și el responsabil
  v_u_sofer  uuid := gen_random_uuid();
  v_u_adm_b  uuid := gen_random_uuid();
  v_u_sof_b  uuid := gen_random_uuid();
  v_e_adm    uuid := gen_random_uuid();
  v_e_resp   uuid := gen_random_uuid();
  v_e_mgr    uuid := gen_random_uuid();
  v_e_sofer  uuid := gen_random_uuid();
  v_e_adm_b  uuid := gen_random_uuid();
  v_e_sof_b  uuid := gen_random_uuid();
  v_veh      uuid := gen_random_uuid();
  v_veh_b    uuid := gen_random_uuid();
  v_t_rca    uuid;
  v_am       uuid;
  v_am_b1    uuid;
  v_am_b2    uuid;
  v_n1       bigint;
  v_n2       bigint;
  v_a1       bigint;
  v_a2       bigint;
  v_titlu    text;
  v_corp     text;
  v_link     text;
  v_tip      text;
  v_ent      uuid;
  v_n        bigint;
  v_m        bigint;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „FLOTA — AMENZILE ÎN REZUMATUL ZILNIC” (0206 §G)';
  raise notice '  ─────────────────────────────────────────────────────────';

  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-rzam-' || v_sufix, 'Proba Rezumat Amenzi SRL',
     'RO' || (82000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-rzam-b-' || v_sufix, 'Proba Fără Responsabili SRL',
     'RO' || (81000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select o, f.feature_key, true, now() from public.features f, unnest(array[v_org, v_org_b]) o;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_adm,   'rz-adm-'  || v_sufix || '@proba.test', now()),
    (v_u_resp,  'rz-rsp-'  || v_sufix || '@proba.test', now()),
    (v_u_mgr,   'rz-mgr-'  || v_sufix || '@proba.test', now()),
    (v_u_sofer, 'rz-sof-'  || v_sufix || '@proba.test', now()),
    (v_u_adm_b, 'rz-admb-' || v_sufix || '@proba.test', now()),
    (v_u_sof_b, 'rz-sofb-' || v_sufix || '@proba.test', now());
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_adm,   v_org,   'RZ-A', 'Adrian', 'Admin',       v_zi - 900, 'activ', v_u_adm,   null),
    (v_e_resp,  v_org,   'RZ-R', 'Rodica', 'Responsabil', v_zi - 900, 'activ', v_u_resp,  null),
    (v_e_mgr,   v_org,   'RZ-M', 'Mihai',  'Manager',     v_zi - 800, 'activ', v_u_mgr,   null),
    (v_e_adm_b, v_org_b, 'RZ-B', 'Bianca', 'Admin',       v_zi - 900, 'activ', v_u_adm_b, null);
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_sofer, v_org,   'RZ-S', 'Sandu',  'Șofer',       v_zi - 400, 'activ', v_u_sofer, v_e_mgr),
    (v_e_sof_b, v_org_b, 'RZ-T', 'Toma',   'Șofer',       v_zi - 400, 'activ', v_u_sof_b, null);
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org,   v_u_adm,   'org_admin'),
    (v_org,   v_u_resp,  'org_admin'),
    (v_org,   v_u_mgr,   'manager'),
    (v_org,   v_u_sofer, 'employee'),
    (v_org_b, v_u_adm_b, 'org_admin'),
    (v_org_b, v_u_sof_b, 'employee');

  insert into public.vehicles (id, organization_id, nr_inmatriculare, marca, model, km_curent,
                               created_by, updated_by) values
    (v_veh,   v_org,   'B' || (100 + (random() * 800)::int)::text || 'RZA', 'Dacia', 'Logan', 10000, v_u_adm, v_u_adm),
    (v_veh_b, v_org_b, 'B' || (100 + (random() * 800)::int)::text || 'RZB', 'Dacia', 'Duster', 9000, v_u_adm_b, v_u_adm_b);
  insert into public.vehicle_assignments (organization_id, vehicle_id, employee_id, de_la, km_predare,
                                          created_by, updated_by) values
    (v_org,   v_veh,   v_e_sofer, pg_temp.la(v_zi - 30, '08:00'), 10000, v_u_adm, v_u_adm),
    (v_org_b, v_veh_b, v_e_sof_b, pg_temp.la(v_zi - 30, '08:00'), 9000, v_u_adm_b, v_u_adm_b);
  insert into public.fleet_settings (organization_id, responsabili, created_by, updated_by)
  values (v_org, array[v_e_mgr, v_e_resp], v_u_adm, v_u_adm);

  select id into v_t_rca from public.vehicle_document_types where cod = 'rca' and organization_id is null;
  insert into public.vehicle_documents (organization_id, vehicle_id, document_type_id, valabil_de_la, expira_la,
                                        created_by, updated_by)
  values (v_org, v_veh, v_t_rca, v_zi - 360, v_zi + 10, v_u_adm, v_u_adm);

  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta, primita_la,
                                    termen_raspuns, created_by, updated_by)
  values (v_org, v_veh, 'PV-RZ-1', pg_temp.la(v_zi - 4, '09:30'), 'Depășirea vitezei legale', v_zi - 1,
          v_zi + 5, v_u_adm, v_u_adm)
  returning id into v_am;
  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta, primita_la,
                                    termen_raspuns, created_by, updated_by)
  values (v_org_b, v_veh_b, 'PV-RZ-B1', pg_temp.la(v_zi - 4, '09:30'), 'Parcare neregulamentară', v_zi - 1,
          v_zi + 6, v_u_adm_b, v_u_adm_b)
  returning id into v_am_b1;

  -- ═══ Prima rulare ═════════════════════════════════════════════════════════
  perform internal.genereaza_alerte(v_org);
  perform internal.flota_rezumat(v_org);

  -- (1) responsabila cu cheie
  select n.title, n.body into v_titlu, v_corp from public.notifications n
   where n.organization_id = v_org and n.user_id = v_u_resp and n.kind = 'reminder';
  select count(*) into v_n from public.notifications n
   where n.organization_id = v_org and n.user_id = v_u_resp and n.kind = 'reminder';
  v_esecuri := v_esecuri + pg_temp.verifica('1',
    v_n = 1 and v_corp like '%Răspuns la amenda PV-RZ-1%termen de răspuns pe%' and v_titlu like '%amendă de răspuns în curând%'
      and v_titlu like '%document care expiră curând%',
    'responsabila cu cheie primește amenda și documentul într-un singur rezumat, numărate în titlu',
    format('%s × „%s” / „%s”', v_n, v_titlu, v_corp));

  -- (2) managerul responsabil, fără cheia amenzilor
  select count(*), max(n.body) into v_n, v_corp from public.notifications n
   where n.organization_id = v_org and n.user_id = v_u_mgr and n.kind = 'reminder';
  v_esecuri := v_esecuri + pg_temp.verifica('2', v_n = 1 and v_corp not like '%amenda%',
    'managerul responsabil primește documentul, nu amenda', format('%s × „%s”', v_n, v_corp));

  -- (3) șoferul
  select count(*), max(n.body) into v_n, v_corp from public.notifications n
   where n.organization_id = v_org and n.user_id = v_u_sofer and n.kind = 'reminder';
  v_esecuri := v_esecuri + pg_temp.verifica('3', v_n = 1 and v_corp not like '%amenda%',
    'șoferul primește documentul mașinii lui, nu amenda', format('%s × „%s”', v_n, v_corp));

  -- (4) administratorul care nu e responsabil
  select count(*) into v_n from public.notifications n
   where n.organization_id = v_org and n.user_id = v_u_adm and n.kind = 'reminder';
  v_esecuri := v_esecuri + pg_temp.verifica('4', v_n = 0,
    'administratorul care nu e responsabil nu primește nimic', format('%s', v_n));

  -- (5) a doua rulare
  select count(*) into v_n1 from public.notifications where organization_id = v_org and kind = 'reminder';
  select count(*) into v_a1 from public.alert_notifications where organization_id = v_org;
  perform internal.genereaza_alerte(v_org);
  perform internal.flota_rezumat(v_org);
  select count(*) into v_n2 from public.notifications where organization_id = v_org and kind = 'reminder';
  select count(*) into v_a2 from public.alert_notifications where organization_id = v_org;
  v_esecuri := v_esecuri + pg_temp.verifica('5', v_n1 = v_n2 and v_a1 = v_a2 and v_n1 = 3,
    'a doua rulare din aceeași zi nu scrie nimic: aceleași rânduri',
    format('notificări %s → %s, marcaje %s → %s', v_n1, v_n2, v_a1, v_a2));

  -- (6) alertele amenzii, marcate doar pe responsabilă
  select count(*) filter (where an.recipient_user_id = v_u_resp),
         count(*) filter (where an.recipient_user_id <> v_u_resp)
    into v_n, v_m
    from public.alert_notifications an
    join public.compliance_alerts a on a.id = an.alert_id
    join public.expirables x on x.id = a.expirable_id
   where x.entity_type = 'vehicle_fine' and x.entity_id = v_am;
  v_esecuri := v_esecuri + pg_temp.verifica('6', v_n >= 1 and v_m = 0,
    'alertele termenului de răspuns sunt marcate doar pe responsabila cu cheie',
    format('ale ei %s, ale altora %s', v_n, v_m));

  -- (7) firmă fără responsabili
  perform internal.genereaza_alerte(v_org_b);
  perform internal.flota_rezumat(v_org_b);
  select count(*), max(n.link), max(n.entity_type), max(n.entity_id::text)::uuid
    into v_n, v_link, v_tip, v_ent
    from public.notifications n
   where n.organization_id = v_org_b and n.user_id = v_u_adm_b and n.kind = 'reminder';
  select count(*) into v_m from public.notifications n
   where n.organization_id = v_org_b and n.user_id = v_u_sof_b;
  v_esecuri := v_esecuri + pg_temp.verifica('7',
    v_n = 1 and v_link = '/flota/amenzi/' || v_am_b1::text and v_tip = 'vehicle_fine' and v_ent = v_am_b1 and v_m = 0,
    'fără responsabili, administratorul primește amenda cu legătura spre ea; șoferul nimic',
    format('%s, %s, %s, șofer %s', v_n, v_link, v_tip, v_m));
  -- O a doua amendă, încă netrimisă: legătura devine lista „De răspuns”.
  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta, primita_la,
                                    termen_raspuns, created_by, updated_by)
  values (v_org_b, v_veh_b, 'PV-RZ-B2', pg_temp.la(v_zi - 2, '11:00'), 'Semafor roșu', v_zi,
          v_zi + 3, v_u_adm_b, v_u_adm_b)
  returning id into v_am_b2;
  insert into public.vehicle_fines (organization_id, vehicle_id, numar_pv, constatata_la, fapta, primita_la,
                                    termen_raspuns, created_by, updated_by)
  values (v_org_b, v_veh_b, 'PV-RZ-B3', pg_temp.la(v_zi - 2, '12:00'), 'Centura', v_zi,
          v_zi + 4, v_u_adm_b, v_u_adm_b);
  perform internal.genereaza_alerte(v_org_b);
  perform internal.flota_rezumat(v_org_b);
  select n.link into v_link from public.notifications n
   where n.organization_id = v_org_b and n.user_id = v_u_adm_b and n.kind = 'reminder'
   order by n.created_at desc, n.id desc limit 1;
  select count(*) into v_n from public.notifications n
   where n.organization_id = v_org_b and n.user_id = v_u_adm_b and n.kind = 'reminder';
  v_esecuri := v_esecuri + pg_temp.verifica('7b', v_n = 2 and v_link = '/flota/amenzi?stadiu=de_raspuns',
    'două amenzi noi: o notificare nouă, cu legătura spre lista „De răspuns”', format('%s, %s', v_n, v_link));

  -- (8) după „răspuns trimis”, termenul iese din rezumat
  update public.vehicle_fines set stadiu = 'sofer_desemnat', sofer_desemnat_id = v_e_sofer where id = v_am;
  update public.vehicle_fines set stadiu = 'raspuns_trimis', raspuns_trimis_la = v_zi where id = v_am;
  -- Alertele vechi ale amenzii se șterg, ca o rulare nouă să le poată reface.
  delete from public.alert_notifications an using public.compliance_alerts a, public.expirables x
   where an.alert_id = a.id and a.expirable_id = x.id and x.entity_id = v_am;
  select count(*) into v_n1 from public.notifications where organization_id = v_org;
  perform internal.genereaza_alerte(v_org);
  perform internal.flota_rezumat(v_org);
  select count(*) into v_n2 from public.notifications where organization_id = v_org;
  v_esecuri := v_esecuri + pg_temp.verifica('8', v_n2 = v_n1,
    'după „răspuns trimis”, termenul nu mai pleacă în rezumat', format('%s → %s', v_n1, v_n2));

  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA REZUMAT AMENZI: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE verificările au trecut.';
  raise notice '';
end;
$$;

rollback;
