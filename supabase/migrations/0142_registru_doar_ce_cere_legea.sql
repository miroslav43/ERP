-- supabase/migrations/0142_registru_doar_ce_cere_legea.sql
--
-- REGISTRUL SCAPĂ DE CE NU E DOCUMENT.
--
-- ── GREȘEALA CARE SE REPARĂ AICI ────────────────────────────────────────────
-- 0136 a citit „orice document primește număr" prea larg și a conectat lucruri
-- care nu sunt documente. Cel mai limpede: INVITAȚIA DE ÎNROLARE — un e-mail cu
-- un token, care expiră, nu se tipărește, nu se semnează și pe care niciun organ
-- de control nu-l va cere vreodată. Nomenclatorul îi dădea termen de păstrare
-- zece ani, ceea ce spune singur cât de greșită era clasarea.
--
-- Criteriul aplicat acum, pe toată harta: **intră ce e numit de un act normativ
-- sau ce poate fi cerut într-un control.** Restul iese.
--
-- ── CE IESE ȘI DE CE ────────────────────────────────────────────────────────
-- · `invitations` → `invitatie_inrolare`
--     Un mesaj de sistem cu token și termen de expirare. Niciun act nu-l numește.
-- · `announcements` → `nota_interna`
--     Un anunț de pe avizierul aplicației e o COMUNICARE, nu o decizie. Ce cere
--     inspectorul e decizia sau contractul, nu postarea. Deciziile conducerii
--     rămân în nomenclator la I.1 și se pot înregistra manual.
-- · `fault_reports` → `sesizare_defectiune`
--     Seamănă cu un tichet intern. Rezultatele verificărilor echipamentelor de
--     muncă rămân înregistrate prin `maintenance_interventions`, care e ce cere
--     HG 1146/2006 — sesizarea care le precede, nu.
-- · `checklist_instances` → `dovada_integrare`
--     Instrument de management. Ce cere legea din integrare e instruirea SSM
--     (HG 1425/2006 art. 81) și informarea salariatului (Codul muncii art. 17),
--     iar amândouă au documentele lor, deja în registru.
-- · `afis_punct_lucru`
--     Afișul cu codul QR de pontare. Nu e unul dintre afișajele obligatorii;
--     e o unealtă a aplicației.
-- · `listare_audit`
--     Jurnalul tehnic al aplicației. OMFP 2634/2015 pct. 56 cere listarea
--     DOCUMENTELOR FINANCIAR-CONTABILE la cererea organelor de control — jurnalul
--     de audit nu e unul dintre ele.
--
-- ── DE CE RÂNDURILE EXISTENTE SE ANULEAZĂ, NU SE ȘTERG ──────────────────────
-- OMFP 2634/2015 pct. 58 lit. d) interzice „orice eliminări", fără excepție pentru
-- „am greșit noi". Cele 18 rânduri deja scrise se ANULEAZĂ, cu motivul scris în
-- clar, și rămân vizibile tăiate în arhivă. Numerele lor rămân consumate: golurile
-- în numerotare sunt permise, repetările nu — aceeași regulă ca la marcă (0033),
-- tichete (0047) și contracte (0098).
--
-- Un inspector care întreabă „de ce lipsește numărul 41?" primește răspunsul din
-- registru: scrie acolo, pe rândul anulat, de ce.
--
-- Forward-only: 0120, 0124, 0135, 0136, 0140 și 0141 sunt aplicate și NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Harta, fără cele patru surse
-- =====================================================================================
--
-- Se rescrie întreagă, ca în 0140: harta e sursa unică din care se creează
-- triggerele, iar o versiune peticită în două migrări e exact divergența pe care
-- 0136 a încercat s-o facă imposibilă.

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
    ('trip_sheets',               'intern', 'foaie_parcurs',        'Foaie de parcurs',
       'employee_id', 'numar',              'plecare_la',      '', 'traseu',            'status', 'trimis,aprobat',                           '',                  '', true),
    ('maintenance_interventions', 'intern', 'pv_interventie',       'Proces-verbal de intervenție',
       'executant_employee_id', '',         'data',            '', 'descriere',         '',       '',                                         '',                  '', false),

    -- ── INTRĂRI ───────────────────────────────────────────────────────────────
    -- Poartă numărul emitentului. Art. 9 cere ambele coloane: al nostru și al lui.
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
-- 2. Triggerele celor patru surse se retrag
-- =====================================================================================
--
-- Argumentele unui trigger se îngheață la `create trigger` — capcana 41 — deci
-- rescrierea hărții de mai sus nu oprește nimic singură. Triggerele se scot explicit.

drop trigger if exists zz_invitations_registru        on public.invitations;
drop trigger if exists zz_announcements_registru      on public.announcements;
drop trigger if exists zz_fault_reports_registru      on public.fault_reports;
drop trigger if exists zz_checklist_instances_registru on public.checklist_instances;

drop trigger if exists zz_fault_reports_rezolvare      on public.fault_reports;
drop trigger if exists zz_checklist_instances_rezolvare on public.checklist_instances;

-- =====================================================================================
-- 3. Afișul și listarea de audit ies din al doilea drum
-- =====================================================================================
--
-- Aceeași semnătură ca în 0135. Un tip scos de aici nu mai poate fi înregistrat
-- din TypeScript: `case`-ul ridică P0001, iar ruta care încă l-ar cere ar cădea
-- zgomotos, nu tăcut.

create or replace function public.inregistreaza_document_generat(
  p_organization_id  uuid,
  p_tip_document     text,
  p_continut_rezumat text,
  p_entitate_tip     text,
  p_entitate_id      uuid default null,
  p_punct_lucru_id   uuid default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_resursa text;
  v_actiune text;
  v_id      uuid;
  v_afisat  text;
begin
  case p_tip_document
    when 'fluturas', 'stat_plata', 'd112', 'nota_contabila', 'ordin_bancar'
      then v_resursa := 'payroll';    v_actiune := 'export';
    when 'foaie_colectiva_prezenta'
      then v_resursa := 'attendance'; v_actiune := 'read';
    else
      raise exception using errcode = 'P0001',
        message = 'Tipul de document „' || p_tip_document
               || '” nu are o poartă declarată pentru înregistrarea în registru.';
  end case;

  if not (
    p_organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(p_organization_id, v_resursa, v_actiune, 'all')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Nu aveți dreptul de a genera acest document în această organizație.';
  end if;

  v_id := internal.inregistreaza_document(
    p_organization_id  => p_organization_id,
    p_sens             => 'intern'::public.registru_sens,
    p_tip_document     => p_tip_document,
    p_continut_rezumat => p_continut_rezumat,
    p_entitate_tip     => p_entitate_tip,
    p_entitate_id      => p_entitate_id,
    p_emitent          => internal.registru_denumire_org(p_organization_id),
    p_punct_lucru_id   => p_punct_lucru_id
  );

  select r.numar_afisat into v_afisat
  from public.registru_documente r where r.id = v_id;

  return v_afisat;
end;
$$;

-- =====================================================================================
-- 4. Nomenclatorul scapă de clasările rămase fără obiect
-- =====================================================================================
--
-- Ștergere LOGICĂ, nu fizică: nomenclatorul e un document al firmei, iar o firmă
-- care și-a adaptat între timp dosarele trebuie să vadă ce s-a schimbat.

update public.nomenclator_tipuri
   set deleted_at = now()
 where deleted_at is null
   and tip_document in ('invitatie_inrolare', 'nota_interna', 'sesizare_defectiune',
                        'dovada_integrare', 'afis_punct_lucru', 'listare_audit');

-- Dosarele rămase fără niciun tip clasat în ele. `II.4` NU intră aici: pierde
-- invitația, dar păstrează adeverințele și celelalte documente eliberate.
update public.nomenclator_dosare d
   set deleted_at = now()
 where d.deleted_at is null
   and not exists (
     select 1 from public.nomenclator_tipuri t
     where t.dosar_id = d.id and t.deleted_at is null
   );

-- =====================================================================================
-- 5. Rândurile deja scrise se anulează
-- =====================================================================================
--
-- Pct. 58 lit. d) interzice eliminările, inclusiv pe ale noastre. Rândurile rămân,
-- tăiate, cu motivul în clar — iar numerele rămân consumate.
--
-- Exercițiile închise se ocolesc: un registru listat la control nu se mai atinge.

update public.registru_documente r
   set anulat_la    = now(),
       motiv_anulare = 'Anulat la corectarea registrului: tipul acesta nu este un '
                    || 'document cerut de lege și nu ar fi trebuit înregistrat.'
 where r.anulat_la is null
   and r.tip_document in ('invitatie_inrolare', 'nota_interna', 'sesizare_defectiune',
                          'dovada_integrare', 'afis_punct_lucru', 'listare_audit')
   and not exists (
     select 1
     from public.registru_exercitii e
     where e.organization_id = r.organization_id
       and e.an              = r.an
       and e.stare           = 'inchis'
   );

-- =====================================================================================
-- 6. Coada REVOKE/GRANT
-- =====================================================================================

revoke all on function internal.registru_config_surse() from public, anon, authenticated;

revoke all on function public.inregistreaza_document_generat(uuid, text, text, text, uuid, uuid)
  from public, anon;
grant execute on function public.inregistreaza_document_generat(uuid, text, text, text, uuid, uuid)
  to authenticated;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
--
-- 1. DE CE NU S-AU SCOS ȘI EVALUĂRILE PROFESIONALE. Par la fel de „interne" ca un
--    anunț, dar nu sunt: Codul muncii art. 242 lit. i) obligă regulamentul intern să
--    conțină criteriile și procedurile de evaluare, iar art. 61 lit. d) face din
--    evaluarea prealabilă condiția concedierii pentru necorespundere profesională.
--    Fișa de evaluare e proba aceleia.
--
-- 2. DE CE RĂMÂN PROCESELE-VERBALE DE INTERVENȚIE, DAR IES SESIZĂRILE. HG 1146/2006
--    cere ca rezultatele verificărilor echipamentelor de muncă să fie înregistrate:
--    asta e intervenția. Sesizarea care o precede e o cerere internă, pe care niciun
--    act n-o numește.
--
-- 3. CE SE ÎNTÂMPLĂ CU DECIZIILE INTERNE. Dosarul I.1 „Decizii și note interne ale
--    conducerii" rămâne în nomenclator, cu `decizie` și `decizie_interna`. O decizie
--    reală a administratorului se înregistrează manual, din `/registru`. Ce s-a scos
--    e postarea de pe avizier, nu decizia.
