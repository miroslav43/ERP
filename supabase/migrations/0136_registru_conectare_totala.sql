-- supabase/migrations/0136_registru_conectare_totala.sql
--
-- REGISTRUL DE DOCUMENTE — CONECTAREA TUTUROR SURSELOR.
--
-- Specificația: `docs/superpowers/specs/2026-09-10-registru-acoperire-totala-design.md`.
-- 0120 a conectat două surse. 0135 a pus fundația — nomenclator, indicativ, regula
-- răspunsului, închiderea exercițiului, miezul refolosibil. Aici se leagă restul.
--
-- ── DE CE O HARTĂ, NU PATRUZECI DE FUNCȚII ──────────────────────────────────
-- `internal.registru_config_surse()` e singura listă a ceea ce se înregistrează.
-- Din ea se creează triggerele ȘI se face backfill-ul, deci cele două nu pot
-- diverge. Memoria proiectului spune că fan-out-ul e felul în care s-a greșit
-- istoric aici: patruzeci de funcții aproape identice sunt patruzeci de locuri
-- unde o coloană se scrie greșit și nimeni nu observă.
--
-- Harta rămâne și ca documentație executabilă: `select * from
-- internal.registru_config_surse()` spune ce e conectat, fără să citești triggere.
--
-- ── PORTIȚA DE STATUS ───────────────────────────────────────────────────────
-- O cerere de concediu în CIORNĂ nu e un document — n-a fost depusă. O foaie de
-- parcurs în draft, o evaluare de riscuri neaprobată, la fel. Sursele cu status
-- se înregistrează la TRANZIȚIA către starea în care documentul există, nu la
-- inserare. Golurile în numerotare sunt permise; un registru în care jumătate din
-- numere sunt ciorne abandonate nu e un registru.
--
-- ── ⚠️ BACKFILL-UL NU POATE FI CRONOLOGIC FAȚĂ DE CE E DEJA ÎN REGISTRU ─────
-- Ordin 217/1996 art. 9 cere înregistrarea „cronologic, în ordinea primirii lor”.
-- Backfill-ul de aici respectă ordinea cronologică ÎNTRE rândurile pe care le
-- aduce, dar ele primesc numere mai mari decât cele alocate deja de 0120, 0124 și
-- de utilizarea reală — chiar dacă documentele sunt mai vechi.
--
-- Alternativa ar fi renumerotarea întregului registru, adică exact ce interzice
-- OMFP 2634/2015 pct. 58 lit. d): „interzicându-se inserări, intercalări”. Între
-- un registru cu ordine imperfectă și unul renumerotat, legea alege primul.
--
-- De aceea rândurile aduse acum poartă `inregistrat_retroactiv = true`: inspectorul
-- vede singur unde se termină hârtia și începe evidența. Steagul se scrie la
-- INSERT, prin `internal.inregistreaza_document`; garda din 0120 îl rescrie din
-- `old` la orice UPDATE, deci nu se poate corecta ulterior.
--
-- ── CE NU SE CONECTEAZĂ AICI ────────────────────────────────────────────────
-- · `prevention_plan_measures` — un rând e o MĂSURĂ, o linie din planul de
--   prevenire și protecție, nu un document. Planul se înregistrează prin evaluarea
--   de riscuri care îl generează. Tipul `plan_prevenire` rămâne în nomenclator
--   pentru ziua în care planul devine un document de sine stătător.
-- · `puncte_lucru`, `attendance_periods`, `payroll_periods` — documentele lor se
--   produc la cerere, fără INSERT pe care să pui trigger. Trec prin
--   `public.inregistreaza_document_generat`, chemată din rutele de export (0135 §11).
-- · Demisia — fluxul NU există în aplicație. Se înregistrează manual (0135 §12).
--
-- Forward-only: 0120, 0124 și 0135 NU se editează după aplicare.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Harta surselor
-- =====================================================================================
--
-- Coloanele, în ordine:
--   tabela          tabela sursă din `public`
--   sens            'intrare' | 'iesire' | 'intern' — Legea 16/1996 art. 7
--   tip             `tip_document`, cheia către nomenclator
--   eticheta        rezumatul de bază; art. 9 cere „conţinutul documentului în rezumat”
--   col_ang         coloana cu `employee_id`, pentru nume în rezumat și destinatar
--   col_numar       coloana cu numărul dat de emitent — art. 9, coloană DISTINCTĂ
--   col_data        coloana cu data documentului dată de emitent
--   col_punct       coloana cu `punct_lucru_id` — OMFP pct. 24
--   col_extra       text adăugat la rezumat unde nu există angajat
--   col_stare       coloana de status care decide când documentul există
--   statusuri       statusurile care declanșează, separate prin virgulă
--   col_emit        coloana cu emitentul, la documentele INTRATE
--   col_obligatoriu coloana care trebuie să fie completată ca documentul să existe
--   pe_update       trigger pe `insert or update`, nu doar pe `insert`

create or replace function internal.registru_config_surse()
returns table (
  tabela          text,
  sens            text,
  tip             text,
  eticheta        text,
  col_ang         text,
  col_numar       text,
  col_data        text,
  col_punct       text,
  col_extra       text,
  col_stare       text,
  statusuri       text,
  col_emit        text,
  col_obligatoriu text,
  pe_update       boolean
)
language sql
immutable
set search_path = ''
as $$
  select *
  from (values
    -- ── IEȘIRI ────────────────────────────────────────────────────────────────
    ('contract_suspendari',       'iesire', 'decizie_suspendare',   'Decizie de suspendare a contractului de muncă',
       'employee_id', '',                   'data_inceput',    '', 'temei_legal',       '',       '',                                         '',                  '', false),
    ('job_descriptions',          'iesire', 'fisa_postului',        'Fișa postului',
       'employee_id', '',                   'valabil_de_la',   '', 'titlu',             '',       '',                                         '',                  '', false),
    ('personnel_authorizations',  'iesire', 'autorizatie_personal', 'Autorizație de exercitare',
       'employee_id', 'numar',              'emis_la',         '', 'tip',               '',       '',                                         '',                  '', false),
    ('course_completion_records', 'iesire', 'adeverinta_curs',      'Adeverință de absolvire a cursului',
       'employee_id', '',                   'finalizat_la',    '', '',                  '',       '',                                         '',                  '', false),
    ('invitations',               'iesire', 'invitatie_inrolare',   'Invitație de înrolare',
       '',            '',                   '',                '', 'email',             '',       '',                                         '',                  '', false),
    ('work_accidents',            'iesire', 'comunicare_itm',       'Comunicare accident de muncă către inspectoratul teritorial de muncă',
       'employee_id', 'numar_intern',       'data_producerii', '', 'locul',             '',       '',                                         '',                  '', false),
    ('payroll_garnishments',      'iesire', 'adresa_poprire',       'Adresă privind poprirea',
       'employee_id', 'dosar',              'data_inceput',    '', 'executor',          '',       '',                                         '',                  '', false),
    ('reges_propuneri',           'iesire', 'transmitere_reges',    'Transmitere către registrul general de evidență a salariaților',
       '',            'reges_propunere_id', 'data_inceput',    '', 'salariat_nume',     'stare',  'asteapta_raspuns,reusit',                  '',                  '', true),

    -- ── UZ INTERN ─────────────────────────────────────────────────────────────
    ('holiday_compensation',      'intern', 'decizie_compensare_sarbatoare', 'Decizie de compensare pentru zi de sărbătoare legală',
       'employee_id', '',                   'data_sarbatorii', '', '',                  '',       '',                                         '',                  '', false),
    ('overtime_compensation',     'intern', 'decizie_compensare_ore',        'Decizie de compensare a orelor suplimentare',
       'employee_id', '',                   'data_generarii',  '', '',                  '',       '',                                         '',                  '', false),
    ('business_trips',            'intern', 'ordin_deplasare',      'Ordin de deplasare',
       'employee_id', 'numar_document',     'plecare_la',      '', 'scop',              'status', 'in_aprobare,aprobata,incheiata,decontata', '',                  '', true),
    ('per_diem_calculations',     'intern', 'decont_deplasare',     'Decont de deplasare',
       '',            '',                   'calculat_la',     '', '',                  '',       '',                                         '',                  '', false),
    ('inventory_allocations',     'intern', 'pv_predare_primire',   'Proces-verbal de predare-primire',
       'employee_id', '',                   'predat_la',       '', '',                  '',       '',                                         '',                  '', false),
    ('ppe_issuances',             'intern', 'fisa_eip',             'Fișă de evidență a echipamentului individual de protecție',
       'employee_id', '',                   'data_predarii',   '', 'articol',           '',       '',                                         '',                  '', false),
    ('ssm_trainings',             'intern', 'fisa_instruire',       'Fișă de instruire în domeniul securității și sănătății în muncă',
       'employee_id', '',                   'data_instruirii', '', '',                  '',       '',                                         '',                  '', false),
    ('risk_assessments',          'intern', 'evaluare_riscuri',     'Evaluare de riscuri',
       '',            'cod',                'data_evaluarii',  '', 'denumire',          'status', 'aprobat',                                  '',                  '', true),
    ('hot_work_permits',          'intern', 'permis_lucru_foc',     'Permis de lucru cu foc',
       'executant_employee_id', 'numar',    'valabil_de_la',   '', 'lucrare',           '',       '',                                         '',                  '', false),
    ('fire_extinguisher_checks',  'intern', 'pv_verificare_stingator', 'Proces-verbal de verificare a stingătoarelor',
       '',            '',                   'data',            '', 'executant',         '',       '',                                         '',                  '', false),
    ('evacuation_drills',         'intern', 'pv_exercitiu_evacuare', 'Proces-verbal de exercițiu de evacuare',
       'responsabil_employee_id', '',       'data',            '', 'scenariu',          '',       '',                                         '',                  '', false),
    ('safety_committee_meetings', 'intern', 'pv_sedinta_cssm',      'Proces-verbal de ședință a comitetului de securitate și sănătate în muncă',
       '',            'numar_proces_verbal', 'data',           '', 'tip',               '',       '',                                         '',                  '', false),
    ('dangerous_incidents',       'intern', 'pv_incident_periculos', 'Proces-verbal de cercetare a incidentului periculos',
       'employee_id', 'numar_intern',       'data_producerii', '', 'locul',             '',       '',                                         '',                  '', false),
    ('occupational_diseases',     'intern', 'fisa_semnalare_bp',    'Fișă de semnalare a bolii profesionale',
       'employee_id', 'numar_fisa_bp',      'data_semnalarii', '', 'denumire_boala',    '',       '',                                         '',                  '', false),
    ('employee_evaluations',      'intern', 'fisa_evaluare',        'Fișă de evaluare profesională',
       'employee_id', '',                   'data_evaluarii',  '', '',                  'status', 'finalizat',                                '',                  '', true),
    ('checklist_instances',       'intern', 'dovada_integrare',     'Dovadă de integrare',
       'employee_id', '',                   'data_referinta',  '', 'tip',               '',       '',                                         '',                  '', false),
    ('trip_sheets',               'intern', 'foaie_parcurs',        'Foaie de parcurs',
       'employee_id', 'numar',              'plecare_la',      '', 'traseu',            'status', 'trimis,aprobat',                           '',                  '', true),
    ('maintenance_interventions', 'intern', 'pv_interventie',       'Proces-verbal de intervenție',
       'executant_employee_id', '',         'data',            '', 'descriere',         '',       '',                                         '',                  '', false),
    ('fault_reports',             'intern', 'sesizare_defectiune',  'Sesizare de defecțiune',
       'raportat_de_employee_id', '',       'raportat_la',     '', 'descriere',         '',       '',                                         '',                  '', false),
    -- Un anunț nepublicat e o ciornă. `publicat_la` e portița, fiindcă tabela n-are status.
    ('announcements',             'intern', 'nota_interna',         'Notă internă',
       '',            '',                   'publicat_la',     '', 'titlu',             '',       '',                                         '',      'publicat_la', true),

    -- ── INTRĂRI ───────────────────────────────────────────────────────────────
    -- Poartă numărul emitentului. Art. 9 cere ambele coloane: al nostru și al lui.
    ('leave_requests',            'intrare', 'cerere_concediu',     'Cerere de concediu',
       'employee_id', 'numar_certificat',   'data_inceput',    '', '',                  'status', 'trimisa,in_aprobare,aprobata',             '',                  '', true),
    ('employee_documents',        'intrare', 'document_personal',   'Document depus la dosarul de personal',
       'employee_id', 'numar_document',     'data_document',   '', 'titlu',             '',       '',                                         '',                  '', false),
    ('work_permits',              'intrare', 'permis_munca',        'Permis de muncă',
       'employee_id', 'numar',              'emis_la',         '', 'tip_permis',        '',       '',                                         'emis_de',           '', false),
    ('occupational_health_exams', 'intrare', 'fisa_aptitudine',     'Fișă de aptitudine — medicina muncii',
       'employee_id', 'numar_fisa',         'data_examinarii', '', 'tip',               '',       '',                                         'unitate_medicala',  '', false),
    ('iscir_authorizations',      'intrare', 'autorizatie_iscir',   'Autorizație ISCIR',
       '',            'numar',              'emis_la',         '', 'tip',               '',       '',                                         'emitent',           '', false),
    ('environmental_permits',     'intrare', 'autorizatie_mediu',   'Autorizație de mediu',
       'responsabil_employee_id', 'numar',  'emis_la',         '', 'obiect',            '',       '',                                         'emitent',           '', false),
    ('vehicle_documents',         'intrare', 'document_vehicul',    'Document al vehiculului',
       '',            'numar',              'valabil_de_la',   '', '',                  '',       '',                                         'emitent',           '', false)
  ) as t(tabela, sens, tip, eticheta, col_ang, col_numar, col_data, col_punct,
         col_extra, col_stare, statusuri, col_emit, col_obligatoriu, pe_update);
$$;

comment on function internal.registru_config_surse() is
  'Harta a ceea ce se înregistrează în registrul de documente. Din ea se creează '
  'triggerele ȘI se face backfill-ul, deci cele două nu pot diverge. '
  '`select * from internal.registru_config_surse()` spune ce e conectat.';

-- =====================================================================================
-- 2. Triggerele de înregistrare
-- =====================================================================================
--
-- `zz_*` ca să ruleze după celelalte triggere de pe aceeași tabelă — după actor,
-- după `set_updated_at`, după orice validare care ar putea încă respinge rândul.

do $$
declare
  v_cfg   record;
  v_cand  text;
  v_when  text;
begin
  for v_cfg in select * from internal.registru_config_surse()
  loop
    -- Tabelele lipsă opresc migrarea aici, nu tăcut la prima utilizare.
    if to_regclass('public.' || quote_ident(v_cfg.tabela)) is null then
      raise exception using errcode = 'P0001',
        message = 'Harta registrului trimite la tabela inexistentă „' || v_cfg.tabela || '”.';
    end if;

    v_cand := case when v_cfg.pe_update then 'insert or update' else 'insert' end;

    v_when := case
                when v_cfg.col_obligatoriu <> ''
                  then format('when (new.%I is not null)', v_cfg.col_obligatoriu)
                else ''
              end;

    execute format(
      'create trigger zz_%1$s_registru after %2$s on public.%1$I '
      || 'for each row %3$s execute function internal.registru_inreg_generic('
      || '%4$L, %5$L, %6$L, %7$L, %8$L, %9$L, %10$L, %11$L, %12$L, %13$L, %14$L)',
      v_cfg.tabela, v_cand, v_when,
      v_cfg.sens, v_cfg.tip, v_cfg.eticheta,
      v_cfg.col_ang, v_cfg.col_numar, v_cfg.col_data, v_cfg.col_punct,
      v_cfg.col_extra, v_cfg.col_stare, v_cfg.statusuri, v_cfg.col_emit);
  end loop;
end;
$$;

-- =====================================================================================
-- 3. Triggerele de rezolvare — art. 9, un rând per caz
-- =====================================================================================
--
-- „În cazul documentelor expediate ca răspuns, acestea vor primi numărul de
-- înregistrare al documentului la care se răspunde.” Decizia care aprobă o cerere
-- NU ia număr nou: închide rândul cererii.
--
-- Ordinea contează și e garantată de nume: pe aceeași tabelă și același eveniment,
-- PostgreSQL execută triggerele alfabetic, iar `zz_..._registru` vine înaintea lui
-- `zz_..._rezolvare` — deci rândul de registru există înainte să fie închis.

do $$
declare
  v_cfg record;
begin
  for v_cfg in
    select *
    from (values
      ('leave_requests',      'status', 'aprobata,respinsa,anulata',      'employee_id'),
      ('business_trips',      'status', 'decontata,respinsa,anulata',     'employee_id'),
      ('trip_sheets',         'status', 'aprobat,respins',                'employee_id'),
      ('checklist_instances', 'status', 'finalizata,anulata',             'employee_id'),
      ('fault_reports',       'status', 'rezolvat,respins',               'raportat_de_employee_id')
    ) as t(tabela, col_stare, statusuri, col_ang)
  loop
    execute format(
      'create trigger zz_%1$s_rezolvare after update on public.%1$I '
      || 'for each row execute function internal.registru_rezolva_generic(%2$L, %3$L, %4$L)',
      v_cfg.tabela, v_cfg.col_stare, v_cfg.statusuri, v_cfg.col_ang);
  end loop;
end;
$$;

-- =====================================================================================
-- 4. Backfill — anul curent, cronologic între sursele noi
-- =====================================================================================
--
-- Art. 9: „Înregistrarea documentelor se efectuează cronologic, în ordinea primirii
-- lor.” Se adună întâi TOATE rândurile din toate sursele noi, se sortează după data
-- documentului, abia apoi se alocă numere — altfel registrul ar avea toate fișele de
-- instruire la rând, apoi toate cererile de concediu, ceea ce nu e un registru.
--
-- Limitele, asumate: doar anul curent (un registru pe 2026 care începe în septembrie
-- nu e un registru, dar unul care începe în 2019 e o rescriere a istoriei), și doar
-- rândurile care ar trece azi portița de status.
--
-- `deleted_at` se citește prin `to_jsonb(t) ->> 'deleted_at'`: tabelele SSM îl au
-- din șablonul `internal.tmpl_ssm`, `per_diem_calculations` nu-l are deloc, iar
-- expresia întoarce `null` — deci rândul intră — exact acolo unde coloana lipsește.

create temporary table _registru_backfill (
  tabela        text not null,
  rand          jsonb not null,
  cand          timestamptz not null,
  data_suspecta boolean not null default false
) on commit drop;

do $$
declare
  v_cfg       record;
  v_an_inceput date := date_trunc('year', now())::date;
  v_data_expr text;
  v_suspect   text;
  v_filtru    text := '';
begin
  for v_cfg in select * from internal.registru_config_surse()
  loop
    -- Data documentului dacă sursa o are ȘI e plauzibilă, altfel momentul creării
    -- rândului.
    --
    -- ⚠️ Filtrul de plauzibilitate NU e paranoia. La prima aplicare pe producție,
    -- 10 sept 2026, backfill-ul a picat pe `document_sequences_year_check` cu
    -- `year = 6`: un document real avea data în ANUL 6, tastată greșit de cineva
    -- într-un câmp de dată („06” în loc de „2026”). Data aia ajungea în
    -- `extract(year from …)`, deci în cheia contorului, care cere 2000-2200.
    --
    -- Fără filtru, UN rând greșit dintr-o singură firmă oprea backfill-ul pentru
    -- TOATE. Cu el, rândul intră totuși în registru, dar cu data creării lui —
    -- singura dată despre care baza garantează că e reală.
    v_data_expr := case
                     when v_cfg.col_data <> ''
                       then format(
                         'case when t.%1$I::timestamptz '
                         || 'between ''2000-01-01''::timestamptz and now() + interval ''1 day'' '
                         || 'then t.%1$I::timestamptz else t.created_at end',
                         v_cfg.col_data)
                     else 't.created_at'
                   end;

    v_filtru := '';

    if v_cfg.col_stare <> '' then
      v_filtru := v_filtru || format(
        ' and t.%I::text = any (string_to_array(%L, %L))',
        v_cfg.col_stare, v_cfg.statusuri, ',');
    end if;

    if v_cfg.col_obligatoriu <> '' then
      v_filtru := v_filtru || format(' and t.%I is not null', v_cfg.col_obligatoriu);
    end if;

    -- Același prag, ca steag: migrarea trebuie să poată SPUNE câte rânduri a
    -- salvat filtrul, nu doar să le salveze tăcut.
    v_suspect := case
                   when v_cfg.col_data <> ''
                     then format(
                       '(t.%1$I is not null and t.%1$I::timestamptz not between '
                       || '''2000-01-01''::timestamptz and now() + interval ''1 day'')',
                       v_cfg.col_data)
                   else 'false'
                 end;

    execute format(
      'insert into _registru_backfill (tabela, rand, cand, data_suspecta) '
      || 'select %1$L, to_jsonb(t), %2$s, %6$s from public.%3$I t '
      || 'where t.created_at >= %4$L::date '
      || '  and (to_jsonb(t) ->> ''deleted_at'') is null '
      || '  and t.organization_id is not null %5$s',
      v_cfg.tabela, v_data_expr, v_cfg.tabela, v_an_inceput, v_filtru, v_suspect);
  end loop;
end;
$$;

do $$
declare
  v_rand  record;
  v_cfg   record;
  v_total integer := 0;
begin
  for v_rand in
    select b.tabela, b.rand, b.cand
    from _registru_backfill b
    -- Determinist: o re-rulare pe bancul local dă exact același registru.
    order by b.cand, b.tabela, (b.rand ->> 'id')
  loop
    select * into v_cfg
    from internal.registru_config_surse() c
    where c.tabela = v_rand.tabela;

    perform internal.registru_inreg_din_rand(
      p_tabela            => v_rand.tabela,
      p_rand              => v_rand.rand,
      p_sens              => v_cfg.sens,
      p_tip               => v_cfg.tip,
      p_eticheta          => v_cfg.eticheta,
      p_col_ang           => nullif(v_cfg.col_ang, ''),
      p_col_numar         => nullif(v_cfg.col_numar, ''),
      p_col_data          => nullif(v_cfg.col_data, ''),
      p_col_punct         => nullif(v_cfg.col_punct, ''),
      p_col_extra         => nullif(v_cfg.col_extra, ''),
      p_col_emit          => nullif(v_cfg.col_emit, ''),
      p_data_inregistrare => v_rand.cand::date,
      p_retroactiv        => true
    );

    v_total := v_total + 1;
  end loop;

  raise notice 'Registru: % documente aduse retroactiv din sursele nou conectate.', v_total;

  for v_rand in
    select b.tabela as tabela, count(*) as cate
    from _registru_backfill b
    where b.data_suspecta
    group by b.tabela
    order by b.tabela
  loop
    raise warning 'Registru: % rânduri din „%” au data documentului în afara intervalului 2000-azi și au fost înregistrate cu data creării lor. Verificați-le în sursă: sunt date tastate greșit.',
                  v_rand.cate, v_rand.tabela;
  end loop;
end;
$$;

-- =====================================================================================
-- 5. Coada REVOKE/GRANT pe funcții
-- =====================================================================================
--
-- Harta e o listă de configurare, nu o citire de date de firmă. Rămâne totuși
-- închisă: n-are consumator în TypeScript, iar ce n-are consumator nu primește grant.

revoke all on function internal.registru_config_surse() from public, anon, authenticated;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
--
-- 1. DE CE `insert or update` ȘI NU `insert or update of <coloana>`. Restrângerea la
--    o coloană pare mai curată, dar `update of` se declanșează când coloana e
--    MENȚIONATĂ în UPDATE, nu când valoarea ei se schimbă efectiv. Un `update ... set
--    status = status` ar trece. Filtrul real e în funcție, unde se compară `old` cu
--    `new`; declarația triggerului rămâne largă în mod deliberat.
--
-- 2. DE CE BACKFILL-UL FILTREAZĂ `organization_id is not null`. Toate tabelele din
--    hartă o au NOT NULL azi, dar filtrul e ieftin și oprește o scriere fără firmă
--    dacă vreo migrare viitoare o slăbește. `registru_inreg_din_rand` iese oricum
--    tăcut pe `null`, iar un rând tăcut pierdut e mai greu de găsit decât unul filtrat.
--
-- 3. DE CE NU SE REPOZIȚIONEAZĂ `document_sequences` DUPĂ BACKFILL. Alocatorul a
--    consumat numerele pe măsură ce a mers, deci contorul e deja pe `max + 1`.
--    0124 a trebuit s-o facă fiindcă scria direct în tabelă; aici nu.
--
-- 4. CE SE ÎNTÂMPLĂ LA A DOUA RULARE. Idempotența din `internal.inregistreaza_document`
--    e pe (firmă, tip_document, entitate_tip, entitate_id). Backfill-ul rulat de două
--    ori nu dublează nimic și nu arde numere — proprietate verificată pe bancul local,
--    unde migrările se re-rulează de la zero la fiecare pornire.
