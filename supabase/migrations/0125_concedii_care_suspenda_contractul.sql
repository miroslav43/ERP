-- supabase/migrations/0125_concedii_care_suspenda_contractul.sql
-- Concediile care SUSPENDĂ contractul individual de muncă devin vizibile ca
-- atare în bază: un flag propriu pe tip, tipul lipsă (acomodare) și termenele
-- REGES corectate. Migrarea NU construiește încă legătura aprobare → suspendare
-- → eveniment; pregătește doar datele pe care legătura le va citi.
--
-- ┌ De ce un flag NOU, și nu `tip_zi_pontaj = 'fara_plata'` ──────────────────
-- │ Scurtătura pare gratuită: azi exact tipurile marcate `fara_plata` în
-- │ pontaj sunt cele care suspendă contractul. Nu ține, din cauza
-- │ PATERNALULUI: suspendă CIM (Codul Muncii art. 51) și se declară în REGES,
-- │ dar e PLĂTIT de firmă, deci rămâne `tip_zi_pontaj = 'concediu'`.
-- │
-- │ Cele două mulțimi diferă și în sens invers, la D112: câmpul `A_7` („ore
-- │ suspendate") numără strict orele fără acoperire — fără plată, absențe
-- │ nemotivate, creștere copil, acomodare — și NU include paternalul, tocmai
-- │ fiindcă e plătit. Medicalul și maternitatea nu intră nici ele: au rubrica
-- │ lor separată în declarație.
-- │
-- │   REGES  (suspenda_contract) : fara_plata, crestere_copil, paternal, acomodare
-- │   D112 A_7 (tip_zi_pontaj)   : fara_plata, crestere_copil,            acomodare
-- │
-- │ Două criterii, două coloane. Derivarea uneia din cealaltă ar fi produs
-- │ fie o declarație de suspendare lipsă, fie ore suspendate raportate în plus.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce medicalul și maternitatea NU primesc flagul ────────────────────────
-- │ Suspendă contractul de drept (Codul Muncii art. 50), dar HG 905/2017 nu le
-- │ cere ca suspendări în registru: se operează în pontaj și în stat, iar
-- │ indemnizația merge la CNAS prin D112. `suspenda_contract` numește
-- │ obligația de RAPORTARE în REGES, nu efectul juridic asupra contractului —
-- │ de-aia se cheamă așa și nu `suspenda_cim`.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce termenul se CORECTEAZĂ în loc să se versioneze ─────────────────────
-- │ `reges_termene` are `valabil_de_la`/`valabil_pana` tocmai ca o schimbare
-- │ de lege să nu rescrie trecutul. Aici nu e o schimbare de lege: `+20 zile
-- │ lucrătoare` a fost greșit din 0004, o confuzie cu termenul modificărilor
-- │ de contract. HG 905/2017 cere transmiterea cel târziu în ziua anterioară
-- │ începerii suspendării, respectiv a reluării activității — la fel ca la
-- │ angajare, care era configurată corect chiar deasupra, pe `-1`.
-- │ Un rând nou cu `valabil_de_la = azi` ar fi lăsat evenimentele deja
-- │ înregistrate să se creadă în termen încă patru săptămâni. Se corectează
-- │ rândul, iar `calculeazaTermen` recalculează tot istoricul pe valoarea bună.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce `zile_lucratoare = true` pentru un termen pe care legea îl dă în ────
-- │ zile calendaristice
-- │ Textul spune sec „ziua anterioară", iar în dreptul român un termen care nu
-- │ e declarat lucrător e calendaristic: pentru o suspendare care începe luni,
-- │ limita strictă e duminică. Configurarea alege VINERI, adică ziua
-- │ lucrătoare anterioară — mai devreme decât cere legea, deci înăuntrul lui
-- │ „cel târziu", și fără să oblige pe cineva să lucreze în weekend.
-- │ E o marjă de siguranță deliberată, nu o lectură a textului. O firmă care
-- │ vrea litera legii își pune un rând propriu în `reges_termene` cu
-- │ `zile_lucratoare = false`, fără deploy.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ Ce NU face migrarea, deliberat ───────────────────────────────────────────
-- │ (a) Nu scrie în `contract_suspendari` și nu generează evenimente REGES.
-- │     Legătura pleacă din `decideCerere` și e cod, nu SQL.
-- │ (b) Nu tratează absențele nemotivate. Sunt a doua sursă de suspendări, dar
-- │     vin din pontaj, nu dintr-o cerere de concediu, și au termen propriu:
-- │     3 zile lucrătoare DUPĂ suspendare, nu ziua anterioară. Cer un rând
-- │     separat în `reges_termene` și o regulă de interval (o serie continuă
-- │     de absențe = o singură suspendare), plus excepția de la „ziua
-- │     anterioară" la reluare, care acolo e imposibil de respectat.
-- │ (c) Nu atinge `A_7` din D112. Sursa lui e `tip_zi_pontaj`, care există
-- │     deja și e corectă; ce lipsește e agregarea din ruta de export.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Corpul lui `internal.seed_leave_defaults` de la secțiunea 6 e cel din 0112,
-- cu două schimbări: coloana `suspenda_contract` în lista de inserare și rândul
-- `acomodare` în lista de valori. Restul e neschimbat.

begin;

-- =====================================================================================
-- 1. Coloana
-- =====================================================================================
-- `default false` și `not null`: absența declarației e „nu suspendă", la fel ca
-- absența unei permisiuni, care e refuz. Un tip nou introdus de o firmă nu
-- devine tăcut obligație de raportare.

alter table public.leave_types
  add column if not exists suspenda_contract boolean not null default false;

comment on column public.leave_types.suspenda_contract is
  'Suspendarea trebuie DECLARATĂ în REGES (HG 905/2017), cel târziu în ziua '
  'anterioară începerii. Nu descrie efectul juridic asupra contractului: '
  'medicalul și maternitatea suspendă de drept (Codul Muncii art. 50) dar nu se '
  'declară, deci rămân pe false.';

-- =====================================================================================
-- 2. Backfill pe tipurile existente
-- =====================================================================================
-- Rulează ÎNAINTE de secțiunea 3: din clipa în care coloana intră sub protecția
-- tipurilor reglementate, un UPDATE pe `crestere_copil` sau `paternal` ar fi
-- respins cu P0001. Ordinea nu e stilistică.

update public.leave_types
   set suspenda_contract = true,
       updated_at        = now()
 where key in ('crestere_copil', 'fara_plata', 'paternal')
   and deleted_at is null
   and suspenda_contract is distinct from true;

-- =====================================================================================
-- 3. Coloana intră sub protecția tipurilor reglementate
-- =====================================================================================
-- Aceeași logică prin care 0064 a apărat `tip_zi_pontaj` și `plafon_anual_zile`:
-- o firmă nu poate stinge din interfață obligația de a declara suspendarea unui
-- concediu reglementat legal. `fara_plata` are `reglementat = false`, deci
-- rămâne editabil — și e corect: durata lui chiar ține de regulamentul intern.
-- Redefinire integrală, cu un singur rând adăugat față de 0064.

create or replace function internal.leave_types_protejeaza_reglementat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.reglementat and (
    new.key                        is distinct from old.key
    or new.zile_implicite          is distinct from old.zile_implicite
    or new.scade_din_sold          is distinct from old.scade_din_sold
    or new.necesita_document       is distinct from old.necesita_document
    or new.se_reporteaza           is distinct from old.se_reporteaza
    or new.termen_reportare        is distinct from old.termen_reportare
    or new.plafon_reportare_zile   is distinct from old.plafon_reportare_zile
    or new.mod_rotunjire_acumulare is distinct from old.mod_rotunjire_acumulare
    or new.intrerupe_alte_concedii is distinct from old.intrerupe_alte_concedii
    or new.reglementat             is distinct from old.reglementat
    -- Adăugate în 0064: amândouă decid bani, deci intră sub aceeași protecție.
    or new.tip_zi_pontaj           is distinct from old.tip_zi_pontaj
    or new.plafon_anual_zile       is distinct from old.plafon_anual_zile
    -- Adăugată în 0125: decide o obligație legală de raportare, nu bani.
    -- Stinsă din greșeală, firma nu vede nicio eroare — vede doar amenda.
    or new.suspenda_contract       is distinct from old.suspenda_contract
  ) then
    raise exception using errcode = 'P0001', message = format(
      '„%s" este un concediu reglementat legal (%s) — durata și regulile lui nu pot fi '
      'modificate din aplicație, doar activat/dezactivat.',
      old.denumire, coalesce(old.temei_legal, 'temei legal neprecizat')
    );
  end if;
  return new;
end;
$$;

revoke all on function internal.leave_types_protejeaza_reglementat() from public, anon, authenticated;

-- =====================================================================================
-- 4. Tipul lipsă: concediul de acomodare
-- =====================================================================================
-- Reglementat pentru adopție: maximum un an, doi pentru un copil cu handicap
-- (varianta din secțiunea 5). Suspendă contractul și se declară în REGES, ca și
-- creșterea copilului, cu care seamănă în toate privințele care contează aici.
-- `tip_zi_pontaj = 'fara_plata'` îl duce și în `A_7` din D112, unde îi e locul.
--
-- Se inserează per organizație existentă, fiindcă `leave_types.organization_id`
-- e `not null` — tipurile sunt date ale firmei, nu ale platformei. `not exists`
-- în loc de `on conflict`: indexul unic e PARȚIAL (`where deleted_at is null`),
-- iar PostgREST și Postgres nu pot infera un `ON CONFLICT` pe el (capcana 7).

insert into public.leave_types (
  organization_id, key, denumire, zile_implicite, scade_din_sold,
  necesita_document, se_reporteaza, termen_reportare, intrerupe_alte_concedii,
  mod_rotunjire_acumulare, plafon_reportare_zile, culoare, temei_legal,
  reglementat, tip_zi_pontaj, plafon_anual_zile, suspenda_contract
)
select o.id, 'acomodare', 'Concediu de acomodare (adopție)', 365, false,
       true, false, null, true,
       'fara_rotunjire', null, '#C2410C', 'Legea 273/2004 (DE VERIFICAT)',
       true, 'fara_plata', 365, true
  from public.organizations o
 where o.deleted_at is null
   and not exists (
     select 1 from public.leave_types lt
      where lt.organization_id = o.id
        and lt.key = 'acomodare'
        and lt.deleted_at is null
   );

-- =====================================================================================
-- 5. Varianta pentru copilul cu handicap
-- =====================================================================================
-- `organization_id = null` — variantă de platformă, vizibilă tuturor și
-- needitabilă, aceeași convenție ca `cic_handicap` din 0070. Zilele sunt
-- ABSOLUTE, nu un adaos: 730 e totalul, nu 365 + 730.

insert into public.leave_type_variants
  (organization_id, leave_type_key, cod, denumire, zile, conditie_tip, conditie_descriere,
   necesita_document, temei_legal, ordine)
select null, 'acomodare', 'acomodare_handicap',
       'Acomodare pentru copil cu handicap, până la 2 ani',
       730, 'grad_handicap',
       'Copilul adoptat are certificat de încadrare în grad de handicap.',
       true, 'Legea 273/2004 (DE VERIFICAT)', 10
 where not exists (
   select 1 from public.leave_type_variants v
    where v.organization_id is null
      and v.cod = 'acomodare_handicap'
      and v.deleted_at is null
 );

-- =====================================================================================
-- 6. Seed-ul, pentru organizațiile viitoare
-- =====================================================================================
-- Fără asta, prima firmă creată după migrare ar porni fără `acomodare` și cu
-- `suspenda_contract` stins peste tot — adică exact starea pe care migrarea o
-- repară pentru firmele existente.

CREATE OR REPLACE FUNCTION internal.seed_leave_defaults(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_flow uuid;
  v_zile_odihna smallint;
begin
  select o.zile_concediu_anual_implicit into v_zile_odihna
  from public.organizations o
  where o.id = p_organization_id;

  insert into public.leave_types (organization_id, key, denumire, zile_implicite, scade_din_sold,
    necesita_document, se_reporteaza, termen_reportare, intrerupe_alte_concedii,
    mod_rotunjire_acumulare, plafon_reportare_zile, culoare, temei_legal, reglementat,
    tip_zi_pontaj, plafon_anual_zile, suspenda_contract)
  select p_organization_id, t.key, t.denumire,
         case when t.key = 'odihna' then coalesce(v_zile_odihna, t.zile) else t.zile end,
         t.scade, t.doc, t.rep, t.termen, t.intrerupe,
         t.rotunjire::public.leave_rounding_mode, t.plafon, t.culoare, t.temei, t.reglementat,
         t.tip_zi::public.attendance_day_type,
         case when t.key in ('medical', 'fara_plata') then null
              when t.key = 'odihna' then coalesce(v_zile_odihna, t.zile)::numeric
              else t.zile::numeric end,
         t.suspenda
  from (values
    ('odihna',        'Concediu de odihnă',                          20, true,  false, true,  18,   false, 'zi_in_sus', 20, '#2563EB', 'Codul Muncii art. 145 (DE VERIFICAT)', false, 'concediu', false),
    ('medical',       'Concediu medical',                           183, false, true,  false, null, true,  'fara_rotunjire', null, '#DC2626', 'OUG 158/2005 (DE VERIFICAT)', true, 'medical', false),
    ('maternitate',   'Concediu de maternitate',                    126, false, true,  false, null, true,  'fara_rotunjire', null, '#DB2777', 'OUG 158/2005 (DE VERIFICAT)', true, 'medical', false),
    ('paternal',      'Concediu paternal (la nașterea copilului)',   10, false, true,  false, null, false, 'fara_rotunjire', null, '#0891B2', 'Legea 210/1999 (DE VERIFICAT)', true, 'concediu', true),
    ('crestere_copil','Concediu creștere copil',                    730, false, true,  false, null, true,  'fara_rotunjire', null, '#7C3AED', 'OUG 111/2010 (DE VERIFICAT)', true, 'fara_plata', true),
    ('casatorie',     'Concediu pentru căsătorie',                    5, false, true,  false, null, false, 'fara_rotunjire', null, '#F59E0B', 'CCM / regulament intern (DE VERIFICAT)', false, 'concediu', false),
    ('deces_ruda',    'Concediu pentru deces în familie',             3, false, true,  false, null, false, 'fara_rotunjire', null, '#475569', 'CCM / regulament intern (DE VERIFICAT)', false, 'concediu', false),
    ('donator_sange', 'Zi liberă donator de sânge',                   1, false, true,  false, null, false, 'fara_rotunjire', null, '#B91C1C', 'Legea 282/2005 (DE VERIFICAT)', true, 'concediu', false),
    ('ingrijitor',    'Concediu de îngrijitor',                       5, false, true,  false, null, false, 'fara_rotunjire', null, '#0D9488', 'Codul Muncii art. 152^1 (DE VERIFICAT)', true, 'concediu', false),
    ('fara_plata',    'Concediu fără plată',                         90, false, false, false, null, false, 'fara_rotunjire', null, '#94A3B8', 'Regulament intern (DE VERIFICAT)', false, 'fara_plata', true),
    -- Adăugate în 0070. Amândouă ADAPTABILE: legea dă un minim, firma poate mai mult.
    ('studii',        'Concediu pentru formare profesională',        10, false, true,  false, null, false, 'fara_rotunjire', null, '#6366F1', 'Codul Muncii art. 155-158 (DE VERIFICAT)', false, 'concediu', false),
    ('eveniment',     'Concediu pentru evenimente speciale',           1, false, false, false, null, false, 'fara_rotunjire', null, '#A855F7', 'CCM / regulament intern (DE VERIFICAT)', false, 'concediu', false),
    -- Adăugat în 0125. Suspendă contractul și se declară în REGES, ca CIC.
    ('acomodare',     'Concediu de acomodare (adopție)',            365, false, true,  false, null, true,  'fara_rotunjire', null, '#C2410C', 'Legea 273/2004 (DE VERIFICAT)', true, 'fara_plata', true)
  ) as t(key, denumire, zile, scade, doc, rep, termen, intrerupe, rotunjire, plafon, culoare, temei, reglementat, tip_zi, suspenda)
  on conflict do nothing;

  insert into public.approval_flows (organization_id, entity_type, denumire)
  values (p_organization_id, 'leave_request', 'Aprobare cerere de concediu')
  on conflict do nothing;

  select id into v_flow from public.approval_flows
   where organization_id = p_organization_id and entity_type = 'leave_request'
     and activ and deleted_at is null;

  if v_flow is not null then
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, permission_key, optional, sla_ore)
    values (p_organization_id, v_flow, 1, 'permisiune', 'leave:approve', false, 72)
    on conflict do nothing;
  end if;
end; $function$
;

revoke all on function internal.seed_leave_defaults(uuid) from public, anon, authenticated;

-- =====================================================================================
-- 7. Termenele REGES pentru suspendare și reluare
-- =====================================================================================
-- Vezi antetul pentru de ce se corectează rândul în loc să se versioneze, și
-- pentru de ce marja rămâne în zile lucrătoare. Se ating exclusiv rândurile de
-- platformă (`organization_id is null`); o suprascriere a unei firme rămâne a
-- ei. La data scrierii nu există niciuna.

update public.reges_termene
   set termen_zile     = -1,
       reper           = 'data_eveniment',
       zile_lucratoare = true,
       descriere       = 'Cel târziu în ziua lucrătoare anterioară datei de la care începe '
                         'suspendarea contractului (HG 905/2017)',
       updated_at      = now()
 where organization_id is null
   and event_type = 'suspendare'
   and deleted_at is null;

update public.reges_termene
   set termen_zile     = -1,
       reper           = 'data_eveniment',
       zile_lucratoare = true,
       descriere       = 'Cel târziu în ziua lucrătoare anterioară datei reluării activității '
                         '(HG 905/2017)',
       updated_at      = now()
 where organization_id is null
   and event_type = 'reluare_activitate'
   and deleted_at is null;

-- =====================================================================================
-- 8. Note de proiectare
-- =====================================================================================
--
-- (A) DE CE `acomodare` E `intrerupe_alte_concedii = true`
--     Aceeași alegere ca la `crestere_copil` și la medical: un concediu care
--     suspendă contractul pe termen lung nu poate coexista cu o cerere de
--     odihnă suprapusă. Regula e verificată în `internal.leave_requests_*`, nu
--     aici — coloana doar o declară.
--
-- (B) DE CE 365 ȘI NU 366
--     „Maximum un an" e o durată legală, nu un număr de zile; 365 e convenția
--     deja folosită pentru CIC (730 pentru doi ani, nu 731). Anul bisect nu
--     schimbă dreptul, iar `plafon_anual_zile` e o plasă de siguranță pentru
--     formular, nu o regulă de calcul.
--
-- (C) CE RĂMÂNE FALS DUPĂ MIGRARE
--     Coloana e populată corect, dar nimeni nu o CITEȘTE încă. Până când
--     `decideCerere` scrie în `contract_suspendari`, aprobarea unui concediu de
--     creștere copil rămâne fără urmă în REGES — exact ca înainte. Migrarea
--     mută problema din „nu se poate ști" în „nu se face", ceea ce e o
--     schimbare de natură, nu de rezultat.
--
-- (D) ABSENȚELE NEMOTIVATE AU NEVOIE DE UN TERMEN PROPRIU
--     Sunt tot o suspendare, dar cu termen de 3 zile lucrătoare DUPĂ, nu ziua
--     anterioară. `reges_termene` are un rând per `event_type`, iar
--     `absenta_nemotivata` nu e o valoare din `reges_tip_eveniment` — deci
--     varianta cea mai probabilă e un discriminant pe eveniment, nu un tip nou
--     de eveniment REGES, fiindcă protocolul REGES nu cunoaște distincția.
--     Decizia se ia la construirea drumului din pontaj, nu aici.

commit;
