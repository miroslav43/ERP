-- supabase/migrations/0140_registru_data_si_numar_document.sql
--
-- REGISTRUL — „NUMĂRUL ȘI DATA DOCUMENTULUI DATE DE EMITENT", corect de data asta.
--
-- Ordin 217/1996 art. 9 cere în registru, ca rubrică DISTINCTĂ de numărul de
-- înregistrare, „numărul şi data documentului date de emitent". 0136 a completat-o
-- greșit pentru cererea de concediu, în două feluri.
--
-- ── 1. DATA ERA CÂND ÎNCEPE CONCEDIUL, NU CÂND S-A DEPUS CEREREA ────────────
-- Harta din 0136 lega `leave_requests` de `data_inceput`. Aia e data de la care
-- omul lipsește, nu data documentului. O cerere depusă azi pentru un concediu de
-- luna viitoare intra în registru cu data documentului în VIITOR — iar la un
-- control, o coloană „data documentului" ulterioară datei înregistrării lui e
-- exact felul de neconcordanță care se explică greu.
--
-- Coloana corectă există și se cheamă `trimisa_la`: momentul în care cererea a
-- fost depusă, adică data pe care ar purta-o hârtia.
--
-- ── 2. SERIA CERTIFICATULUI MEDICAL SE PIERDEA ──────────────────────────────
-- La concediul medical, `leave_requests` ține `serie_certificat` ȘI
-- `numar_certificat`; constrângerea din 0009 le cere pe amândouă odată cu
-- `medical_code_id`. Harta lua doar numărul. Un certificat medical se identifică
-- prin serie ȘI număr — „12345" singur nu identifică nimic.
--
-- De aici schimbarea din `registru_inreg_din_rand`: `col_numar` acceptă acum o
-- LISTĂ de coloane separate prin virgulă, concatenate cu spațiu în ordinea dată.
-- Mecanica e generică, nu un caz special pentru concedii: la fel se comportă
-- orice document identificat prin serie și număr.
--
-- ── ⚠️ DE CE NU E O SCĂPARE CĂ „NR. DOCUMENT" E GOL LA CONCEDIUL DE ODIHNĂ ──
-- Rămâne gol, și e corect. Emitentul unei cereri de concediu de odihnă e
-- SALARIATUL, iar o persoană fizică nu ține serii de numerotare. Rubrica se
-- completează doar când documentul primit chiar poartă un număr de la emitentul
-- lui: certificatul medical, adresa unei instituții, autorizația unui organism.
--
-- ── CE NU REPARĂ MIGRAREA ASTA ──────────────────────────────────────────────
-- Rândurile deja înregistrate primesc data și numărul corecte mai jos, prin UPDATE.
-- Garda din 0120 pinuiește `numar_afisat`, `data_inregistrare`, `sens` și legătura
-- cu entitatea, dar NU `data_document_emitent` și `numar_document_emitent` — exact
-- ca să se poată corecta ce a fost cules greșit, fără a atinge numerotarea.
--
-- Forward-only: 0135 și 0136 sunt aplicate pe producție și NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. `col_numar` acceptă o listă de coloane
-- =====================================================================================
--
-- Aceeași semnătură ca în 0135 — altfel `create or replace` ar face o
-- SUPRAÎNCĂRCARE, nu o înlocuire, iar apelurile cu argumente numite ar deveni
-- ambigue la execuție. Capcana 41.

create or replace function internal.registru_inreg_din_rand(
  p_tabela            text,
  p_rand              jsonb,
  p_sens              text,
  p_tip               text,
  p_eticheta          text,
  p_col_ang           text default null,
  p_col_numar         text default null,
  p_col_data          text default null,
  p_col_punct         text default null,
  p_col_extra         text default null,
  p_col_emit          text default null,
  p_data_inregistrare date default null,
  p_retroactiv        boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sens    public.registru_sens := p_sens::public.registru_sens;
  v_org     uuid := (p_rand ->> 'organization_id')::uuid;
  v_angajat text;
  v_extra   text;
  v_numar   text;
begin
  if v_org is null then
    return null;
  end if;

  if p_col_ang is not null and (p_rand ->> p_col_ang) is not null then
    select e.full_name into v_angajat
    from public.employees e
    where e.id = (p_rand ->> p_col_ang)::uuid;
  end if;

  -- Unde nu există angajat, rezumatul ia un text din rândul sursă — titlul unui
  -- anunț, codul unei evaluări de riscuri — ca registrul să nu aibă patruzeci de
  -- rânduri cu aceeași descriere.
  if v_angajat is null and p_col_extra is not null then
    v_extra := nullif(btrim(coalesce(p_rand ->> p_col_extra, '')), '');
  end if;

  -- „Numărul documentului dat de emitent" poate veni din mai multe coloane: un
  -- certificat medical are SERIE și NUMĂR, iar numărul singur nu identifică nimic.
  -- `with ordinality` păstrează ordinea scrisă în hartă; coloanele goale cad, deci
  -- o cerere de concediu de odihnă rămâne cu rubrica goală, cum și trebuie.
  if p_col_numar is not null then
    select nullif(btrim(string_agg(x.v, ' ' order by c.ord)), '')
      into v_numar
    from unnest(string_to_array(p_col_numar, ',')) with ordinality as c(nume, ord)
    cross join lateral (
      select nullif(btrim(coalesce(p_rand ->> btrim(c.nume), '')), '') as v
    ) x
    where x.v is not null;
  end if;

  return internal.inregistreaza_document(
    p_organization_id        => v_org,
    p_sens                   => v_sens,
    p_tip_document           => p_tip,
    p_continut_rezumat       => left(p_eticheta
                                     || coalesce(' — ' || v_angajat, '')
                                     || coalesce(' — ' || v_extra, ''), 500),
    p_entitate_tip           => p_tabela,
    p_entitate_id            => (p_rand ->> 'id')::uuid,
    p_numar_document_emitent => v_numar,
    p_data_document_emitent  => case when p_col_data is not null
                                     then (p_rand ->> p_col_data)::date end,
    -- La documentele INTRATE emitentul e altcineva — medicul, inspectoratul,
    -- asigurătorul — și se ia din sursă acolo unde există. La ce emitem noi,
    -- emitentul e firma.
    p_emitent                => case when v_sens = 'intrare'::public.registru_sens
                                     then case when p_col_emit is not null
                                               then p_rand ->> p_col_emit end
                                     else internal.registru_denumire_org(v_org) end,
    p_destinatar             => case when v_sens = 'iesire'::public.registru_sens
                                     then v_angajat end,
    p_punct_lucru_id         => case when p_col_punct is not null
                                     then (p_rand ->> p_col_punct)::uuid end,
    p_data_inregistrare      => p_data_inregistrare,
    p_inregistrat_retroactiv => p_retroactiv
  );
end;
$$;

-- =====================================================================================
-- 2. Harta, cu cererea de concediu corectată
-- =====================================================================================
--
-- Se rescrie ÎNTREAGĂ, nu se peticește: harta e sursa unică din care se creează
-- triggerele și se face backfill-ul, iar o hartă cu două versiuni în două migrări
-- ar fi exact felul de divergență pe care 0136 a încercat s-o facă imposibilă.
--
-- Singura linie schimbată față de 0136 e `leave_requests`:
--   col_numar  'numar_certificat'  →  'serie_certificat,numar_certificat'
--   col_data   'data_inceput'      →  'trimisa_la'

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
    --
    -- La cererea de concediu, emitentul e SALARIATUL, iar o persoană fizică nu ține
    -- serii: rubrica rămâne goală, corect, la concediul de odihnă. Se completează la
    -- concediul medical, unde certificatul are serie ȘI număr — de aceea două coloane.
    ('leave_requests',            'intrare', 'cerere_concediu',     'Cerere de concediu',
       'employee_id', 'serie_certificat,numar_certificat', 'trimisa_la', '', '',        'status', 'trimisa,in_aprobare,aprobata',             '',                  '', true),
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

-- =====================================================================================
-- 3. Triggerul cererii de concediu se recreează
-- =====================================================================================
--
-- ⚠️ ARGUMENTELE UNUI TRIGGER SE ÎNGHEAȚĂ LA `create trigger`, nu se citesc din
-- hartă la fiecare declanșare. `TG_ARGV` vine din definiția triggerului, salvată
-- în catalog. Rescrierea hărții de mai sus NU schimbă nimic pentru triggerele deja
-- create — trebuie recreate, altfel corectura ar părea aplicată și n-ar fi.

do $$
declare
  v_cfg  record;
  v_cand text;
  v_when text;
begin
  select * into v_cfg
  from internal.registru_config_surse() c
  where c.tabela = 'leave_requests';

  execute 'drop trigger if exists zz_leave_requests_registru on public.leave_requests';

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
end;
$$;

-- =====================================================================================
-- 4. Rândurile deja înregistrate se corectează
-- =====================================================================================
--
-- Garda din 0120 pinuiește numerotarea și legătura cu entitatea, dar lasă scriibile
-- exact coloanele astea două — ca ce a fost cules greșit să se poată îndrepta fără
-- a atinge un număr de înregistrare. Pct. 58 lit. d) interzice modificarea
-- numerotării, nu corectarea unei rubrici descriptive.

with corect as (
  select r.id,
         l.trimisa_la::date as data_emitent,
         nullif(btrim(concat_ws(' ', nullif(btrim(coalesce(l.serie_certificat, '')), ''),
                                     nullif(btrim(coalesce(l.numar_certificat, '')), ''))), '')
           as numar_emitent
  from public.registru_documente r
  join public.leave_requests l
    on l.id = r.entitate_id
   and l.organization_id = r.organization_id
  where r.entitate_tip = 'leave_requests'
)
update public.registru_documente r
   set data_document_emitent  = corect.data_emitent,
       numar_document_emitent = corect.numar_emitent
  from corect
 where corect.id = r.id
   and (r.data_document_emitent  is distinct from corect.data_emitent
     or r.numar_document_emitent is distinct from corect.numar_emitent);

-- =====================================================================================
-- 5. Coada REVOKE/GRANT
-- =====================================================================================

revoke all on function internal.registru_config_surse() from public, anon, authenticated;
revoke all on function internal.registru_inreg_din_rand(
  text, jsonb, text, text, text, text, text, text, text, text, text, date, boolean
) from public, anon, authenticated;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
--
-- 1. DE CE NU S-AU CORECTAT ȘI CELELALTE SURSE CU DATĂ ÎN VIITOR. `business_trips`
--    are `plecare_la`, `trip_sheets` la fel, `hot_work_permits` are `valabil_de_la`:
--    toate pot fi în viitor. Diferența față de concediu e că acolo data CHIAR e a
--    documentului — un ordin de deplasare e despre deplasarea aia, iar permisul de
--    lucru cu foc e valabil de la ora aia. La cererea de concediu, `data_inceput` nu
--    e a documentului, ci a absenței: două lucruri diferite, care se despart abia
--    când te uiți la ce scrie pe hârtie.
--
-- 2. DE CE UPDATE-UL ARE `is distinct from`. Fără el, fiecare rulare ar atinge toate
--    rândurile, ar declanșa `trg_registru_documente_updated` și ar rescrie
--    `updated_at` pe un registru care n-a fost modificat. Un registru al cărui
--    „ultima modificare" sare la fiecare migrare e mai greu de apărat la control
--    decât unul care stă.
--
-- 3. CE SE ÎNTÂMPLĂ CU CERERILE FĂRĂ `trimisa_la`. O cerere ajunsă direct în
--    `aprobata` fără să treacă prin `trimisa` poate avea coloana goală. Atunci
--    `data_document_emitent` rămâne `null` — corect: nu inventăm o dată pe care
--    documentul n-o are. Rubrica goală spune adevărul, o dată ghicită nu.
