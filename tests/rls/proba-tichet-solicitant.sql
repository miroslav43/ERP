-- tests/rls/proba-tichet-solicitant.sql
--
-- SOLICITANTUL PE PROPRIUL TICHET: ÎNCHIDE, REDESCHIDE, VEDE CINE L-A PRELUAT.
--
-- Lucrarea W2-02 (FLX-003, FLX-004) e o schimbare de ECRAN, nu de bază: portalul
-- nu oferea butoanele, iar pagina confunda „embed NULL” cu „nerepartizat”.
-- Proba de aici dovedește premisa pe care stă ecranul — că baza chiar permite
-- angajatului ce îi oferă acum portalul — și cauza lui FLX-004. Ce poate scrie
-- un rol se AFLĂ rulând, nu deducând.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) angajatul mută propriul tichet `rezolvat → inchis` (1 rând)   [POZITIVĂ];
-- (2) angajatul mută al doilea tichet `rezolvat → redeschis`         [POZITIVĂ]
--     și `ticket_history` consemnează `status rezolvat→redeschis`;
-- (3) angajatul NU poate `in_lucru → rezolvat` (P0001, „Nu aveți dreptul de a
--     prelucra acest tichet.”) — rezolvarea e a echipei            [NEGATIVĂ];
-- (4) angajatul vede `asignat_employee_id` NENUL pe tichetul lui, dar rândul
--     operatorului din `employees` îi e ascuns (zero rânduri) — cauza FLX-004:
--     coloana se vede, embed-ul nu                                  [POZITIVĂ].
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org      uuid := gen_random_uuid();
  v_u_patron uuid := gen_random_uuid();
  v_u_ang    uuid := gen_random_uuid();
  v_e_patron uuid;
  v_e_ang    uuid := gen_random_uuid();
  v_t_inchis uuid := gen_random_uuid();
  v_t_redesc uuid := gen_random_uuid();
  v_t_lucru  uuid := gen_random_uuid();
  v_asignat  uuid;
  v_n        int;
  v_atinse   int;
  v_mesaj    text;
  v_esecuri  int := 0;
begin
  raise notice '';
  raise notice '  PROBA „SOLICITANTUL PE PROPRIUL TICHET" (W2-02: FLX-003, FLX-004)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org, 'proba-tsol-' || v_sufix, 'Proba Tichet Solicitant SRL',
     'RO' || (88000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_patron, 'ts-pat-' || v_sufix || '@proba.test', now()),
    (v_u_ang,    'ts-ang-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_patron, 'org_admin'), (v_org, v_u_ang, 'employee');

  -- Patronul își primește fișa AUTOMAT la înrolarea ca org_admin (0083).
  select e.id into v_e_patron
    from public.employees e
   where e.organization_id = v_org and e.user_id = v_u_patron and e.deleted_at is null
   limit 1;
  update public.employees set status = 'activ', functie = 'Director' where id = v_e_patron;
  insert into public.employees (id, organization_id, marca, first_name, last_name, functie,
                                hired_on, status, user_id, manager_employee_id) values
    (v_e_ang, v_org, 'TS-A', 'Ana', 'Angajat', 'Operator', app.azi_local() - 400, 'activ',
     v_u_ang, v_e_patron);

  -- Trei bug-uri ale angajatului: `bug_erp` nu trece prin aprobare, deci se
  -- nasc în `nou` și patronul le mută direct. Două ajung `rezolvat`, unul
  -- rămâne `in_lucru`; toate trei le ia patronul asupra lui.
  insert into public.tickets (id, organization_id, numar_afisat, tip, titlu, descriere,
                              modul, pasi_efectuati, rezultat_asteptat, rezultat_obtinut,
                              solicitant_employee_id, created_by, updated_by) values
    (v_t_inchis, v_org, 'IT-2026-920001', 'bug_erp', 'Butonul nu salvează', 'Descriere.',
     'Pontaj', 'Am apăsat.', 'Se salvează.', 'Nu se salvează.', v_e_ang, v_u_ang, v_u_ang),
    (v_t_redesc, v_org, 'IT-2026-920002', 'bug_erp', 'Lista e goală', 'Descriere.',
     'Pontaj', 'Am deschis.', 'Văd lista.', 'Nu văd nimic.', v_e_ang, v_u_ang, v_u_ang),
    (v_t_lucru,  v_org, 'IT-2026-920003', 'bug_erp', 'Data e greșită', 'Descriere.',
     'Pontaj', 'Am verificat.', 'Data de azi.', 'Data de ieri.', v_e_ang, v_u_ang, v_u_ang);

  -- Prelucrarea se face ca patronul (`tickets:update = all`): repartizarea
  -- trece de `tickets_pazeste_campurile`, iar `rezolvat` de `v_pot_opera`.
  perform set_config('request.jwt.claim.sub', v_u_patron::text, true);
  set local role authenticated;
  update public.tickets set asignat_employee_id = v_e_patron
   where id in (v_t_inchis, v_t_redesc, v_t_lucru);
  update public.tickets set status = 'in_lucru' where id in (v_t_inchis, v_t_redesc, v_t_lucru);
  update public.tickets set status = 'rezolvat' where id in (v_t_inchis, v_t_redesc);
  reset role;

  -- De aici încolo, angajatul.
  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;

  -- ═══ (1) rezolvat → inchis [POZITIVĂ] ══════════════════════════════════════
  update public.tickets set status = 'inchis' where id = v_t_inchis;
  get diagnostics v_atinse = row_count;
  if v_atinse = 1 then
    raise notice '  ✓ (1) angajatul își confirmă rezolvarea: rezolvat → inchis, 1 rând';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) rezolvat → inchis a atins % rânduri (refuz tăcut al politicii)', v_atinse;
  end if;

  -- ═══ (2) rezolvat → redeschis, cu istoric [POZITIVĂ] ═══════════════════════
  update public.tickets set status = 'redeschis' where id = v_t_redesc;
  get diagnostics v_atinse = row_count;
  if v_atinse = 1 then
    raise notice '  ✓ (2) angajatul redeschide: rezolvat → redeschis, 1 rând';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) rezolvat → redeschis a atins % rânduri', v_atinse;
  end if;

  -- ═══ (3) in_lucru → rezolvat [NEGATIVĂ, P0001] ═════════════════════════════
  -- Nu zero rânduri: politica îl lasă pe solicitant la UPDATE, triggerul îl
  -- refuză cu mesaj. Dacă ar deveni refuz tăcut, `schimbaStatusul` ar raporta
  -- CONFLICT în loc de motivul real.
  begin
    update public.tickets set status = 'rezolvat' where id = v_t_lucru;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) angajatul și-a marcat singur tichetul ca rezolvat';
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_mesaj = message_text;
      if v_mesaj = 'Nu aveți dreptul de a prelucra acest tichet.' then
        raise notice '  ✓ (3) in_lucru → rezolvat e refuzat angajatului: %', v_mesaj;
      else
        v_esecuri := v_esecuri + 1;
        raise warning '  ✗ (3) P0001, dar cu alt mesaj: %', v_mesaj;
      end if;
  end;

  -- ═══ (4) coloana se vede, embed-ul nu — cauza FLX-004 [POZITIVĂ] ═══════════
  select t.asignat_employee_id into v_asignat from public.tickets t where t.id = v_t_lucru;
  select count(*) into v_n from public.employees e where e.id = v_e_patron;
  if v_asignat = v_e_patron and v_n = 0 then
    raise notice '  ✓ (4) angajatul vede `asignat_employee_id` nenul, dar nu și rândul operatorului';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) asignat_employee_id = % (așteptat %), rânduri din employees = % (așteptat 0)',
      v_asignat, v_e_patron, v_n;
  end if;
  reset role;

  -- Istoricul lui (2), citit ca superutilizator: triggerul scrie rândul chiar
  -- când tranziția o face solicitantul.
  select count(*) into v_n
    from public.ticket_history h
   where h.ticket_id = v_t_redesc and h.camp = 'status'
     and h.valoare_veche = 'rezolvat' and h.valoare_noua = 'redeschis'
     and h.actor_user_id = v_u_ang;
  if v_n = 1 then
    raise notice '  ✓ (2b) `ticket_history` are rândul status rezolvat→redeschis, cu angajatul ca actor';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2b) istoricul redeschiderii lipsește sau e dublat (%)', v_n;
  end if;

  if v_esecuri > 0 then
    raise exception 'proba-tichet-solicitant: % verificări picate', v_esecuri;
  end if;
  raise notice '  toate verificările au trecut';
end $$;
