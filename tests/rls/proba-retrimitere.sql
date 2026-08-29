-- tests/rls/proba-retrimitere.sql
--
-- POARTA POZITIVĂ a retrimiterii invitației (0105): nu „nimeni nu retrimite ce
-- n-are voie", ci „cine invită POATE retrimite" — plus cele două refuzuri care
-- trebuie să rămână refuzuri.
--
-- ── DE CE NU AJUNGE `found` ─────────────────────────────────────────────────
-- Defectul reparat de 0105 nu dădea eroare și nu atingea zero rânduri: triggerul
-- `internal.guard_invitations` repunea `token_hash := old.token_hash` și lăsa
-- UPDATE-ul să reușească. `found` era `true`, aplicația trimitea e-mailul cu
-- tokenul nou, iar în bază rămânea hash-ul vechi — un link mort, expediat cu
-- succes.
--
-- De aceea coloana „retrimite" de mai jos nu se citește din `found`, ci RECITEȘTE
-- `token_hash` după update și îl compară cu cel trimis. Verdictul `TĂCUT`
-- înseamnă exact defectul de dinainte: comandă reușită, efect zero.
--
-- ── CE MAI VERIFICĂ ─────────────────────────────────────────────────────────
-- (2) `hr` nu capătă revocarea odată cu retrimiterea — nota din 0104 rămâne în
--     picioare.
-- (3) `hr` nu poate retrimite o invitație de `org_admin`. Fără condiția
--     `role = 'employee'` din politică, ar fi putut să-i schimbe adresa cu a lui
--     și să reînnoiască tokenul: o escaladare de privilegii într-un singur
--     UPDATE.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh --pastreaza
--   PORT=$(docker ps --filter name=administrativo-banc --format '{{.Ports}}' \
--          | grep -oE '0.0.0.0:[0-9]+' | head -1 | cut -d: -f2)
--   psql "postgresql://postgres:banc@localhost:$PORT/postgres" -f tests/rls/proba-retrimitere.sql
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_org      uuid := gen_random_uuid();
  -- Sufix unic pe rulare: proba trebuie să poată fi repetată pe același banc
  -- fără să se lovească de propriile date de la rulajul anterior.
  v_sufix    text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_ang      uuid := gen_random_uuid();
  v_inv_ang  uuid;
  v_inv_rev  uuid;
  v_inv_adm  uuid;
  v_rol      text;
  v_uid      uuid;
  v_nou_ang  text;
  v_nou_adm  text;
  v_citit    text;
  v_esecuri  int := 0;
  -- rol → (retrimite invitația de angajat, revocă, retrimite invitația de org_admin)
  v_matrice  text[][] := array[
    array['org_admin','da','da','da'],
    array['hr',       'da','nu','nu'],
    array['manager',  'nu','nu','nu'],
    array['employee', 'nu','nu','nu']
  ];
  v_rand     text[];
begin
  insert into public.organizations (id, slug, name, cui)
  values (v_org, 'proba-retrim-' || v_sufix, 'Proba Retrimitere SRL',
          'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled)
  values (v_org, 'nucleu', true)
  on conflict (organization_id, feature_key) where deleted_at is null do nothing;

  -- Un utilizator per rol.
  foreach v_rand slice 1 in array v_matrice loop
    v_rol := v_rand[1];
    v_uid := gen_random_uuid();
    insert into auth.users (id, email) values (v_uid, v_rol || '-' || v_sufix || '@proba.test');
    insert into public.organization_members (organization_id, user_id, role)
      values (v_org, v_uid, v_rol::public.app_role);
    execute format('create temporary table if not exists t_uid_retrim (rol text primary key, uid uuid)');
    insert into t_uid_retrim values (v_rol, v_uid) on conflict (rol) do update set uid = excluded.uid;
  end loop;

  -- Fișa patronului o creează triggerul din 0083; o scoatem, ca proba să
  -- controleze singură graful.
  delete from public.employees where organization_id = v_org;
  insert into public.employees (id, organization_id, marca, first_name, last_name, status, hired_on)
    values (v_ang, v_org, '0001', 'Ion', 'Popescu', 'activ', current_date - 100);

  raise notice '';
  raise notice '  rol         | retrimite | revocă | retrimite org_admin';
  raise notice '  ------------+-----------+--------+--------------------';

  foreach v_rand slice 1 in array v_matrice loop
    v_rol := v_rand[1];
    select uid into v_uid from t_uid_retrim where rol = v_rol;

    -- Trei rânduri proaspete la fiecare rol: unul de retrimis, unul de revocat,
    -- unul de `org_admin` pe care nimeni sub `users:update` n-are voie să-l
    -- atingă. Inserate din contextul de serviciu, ca la înrolare.
    delete from public.invitations where organization_id = v_org;
    insert into public.invitations (organization_id, email, role, token_hash, expires_at, employee_id)
    values (v_org, 'ang-' || v_sufix || '@proba.test', 'employee',
            repeat(md5(random()::text), 2), now() + interval '7 days', v_ang)
    returning id into v_inv_ang;
    -- Fără `employee_id`: `invitations_employee_pending_uq` (0099) dă o singură
    -- invitație în așteptare per fișă, iar aici sunt două deodată pe aceeași
    -- probă. Politica nu se uită la fișă, ci la stare și rol.
    insert into public.invitations (organization_id, email, role, token_hash, expires_at)
    values (v_org, 'rev-' || v_sufix || '@proba.test', 'employee',
            repeat(md5(random()::text), 2), now() + interval '7 days')
    returning id into v_inv_rev;
    insert into public.invitations (organization_id, email, role, token_hash, expires_at)
    values (v_org, 'adm-' || v_sufix || '@proba.test', 'org_admin',
            repeat(md5(random()::text), 2), now() + interval '7 days')
    returning id into v_inv_adm;

    v_nou_ang := repeat(md5(random()::text), 2);
    v_nou_adm := repeat(md5(random()::text), 2);

    perform set_config('request.jwt.claim.sub', v_uid::text, true);
    set local role authenticated;

    declare
      v_a text := '?'; v_b text := '?'; v_c text := '?';
    begin
      -- (1) retrimite invitația angajatului: token nou, termen nou, adresă nouă
      begin
        update public.invitations
           set token_hash = v_nou_ang,
               expires_at = now() + interval '7 days',
               email      = 'reang-' || v_sufix || '@proba.test'
         where id = v_inv_ang;
        v_a := case when found then 'DA' else 'nu' end;
      exception when others then v_a := 'nu'; end;

      -- (2) revocă
      begin
        update public.invitations set status = 'revoked' where id = v_inv_rev;
        v_b := case when found then 'DA' else 'nu' end;
      exception when others then v_b := 'nu'; end;

      -- (3) retrimite invitația de `org_admin`, cu adresa mutată pe a lui
      begin
        update public.invitations
           set token_hash = v_nou_adm,
               expires_at = now() + interval '7 days',
               email      = v_rol || '-' || v_sufix || '@proba.test'
         where id = v_inv_adm;
        v_c := case when found then 'DA' else 'nu' end;
      exception when others then v_c := 'nu'; end;

      reset role;

      -- Recitirea care deosebește reușita de refuzul TĂCUT.
      if v_a = 'DA' then
        select token_hash into v_citit from public.invitations where id = v_inv_ang;
        if v_citit is distinct from v_nou_ang then v_a := 'TĂCUT'; end if;
      end if;
      if v_c = 'DA' then
        select token_hash into v_citit from public.invitations where id = v_inv_adm;
        if v_citit is distinct from v_nou_adm then v_c := 'TĂCUT'; end if;
      end if;
      if v_b = 'DA' then
        select status into v_citit from public.invitations where id = v_inv_rev;
        if v_citit <> 'revoked' then v_b := 'TĂCUT'; end if;
      end if;

      raise notice '  %| %| %| %',
        rpad(v_rol, 12), rpad(v_a, 10), rpad(v_b, 7), v_c;

      if (v_rand[2] = 'da') <> (v_a = 'DA') then v_esecuri := v_esecuri + 1;
        raise warning '  ✗ %: retrimitere așteptat %, obținut %', v_rol, v_rand[2], v_a; end if;
      if (v_rand[3] = 'da') <> (v_b = 'DA') then v_esecuri := v_esecuri + 1;
        raise warning '  ✗ %: revocare așteptat %, obținut %', v_rol, v_rand[3], v_b; end if;
      if (v_rand[4] = 'da') <> (v_c = 'DA') then v_esecuri := v_esecuri + 1;
        raise warning '  ✗ %: retrimitere org_admin așteptat %, obținut %', v_rol, v_rand[4], v_c; end if;
    end;
  end loop;

  raise notice '';
  if v_esecuri > 0 then
    raise exception 'PROBA A EȘUAT: % nepotriviri față de matricea de roluri.', v_esecuri;
  end if;
  raise notice '  PROBA A TRECUT: cine invită poate retrimite, și numai atât.';
end
$$;
