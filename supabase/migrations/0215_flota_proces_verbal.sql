-- supabase/migrations/0215_flota_proces_verbal.sql
--
-- FLOTA, EXTENSIA F12c: PROCESUL-VERBAL DE PREDARE-PRIMIRE A VEHICULULUI.
--
-- Specificația o numea `0212_flota_proces_verbal`; 0210–0212 le-a luat
-- mentenanța la integrare, iar traseele F12 s-au mutat cu +3, deci e 0215.
--
-- ── DE UNDE VINE ────────────────────────────────────────────────────────────
-- `vehicle_assignments` (0173) ține de ce are nevoie o predare: cine, ce mașină,
-- când, kilometrajul. Nimic însă nu producea hârtia pe care se semnează. Proba
-- la o pagubă (Codul muncii art. 254: salariatul nu răspunde pentru riscul
-- normal al serviciului) și răspunsul către poliție (OUG 195/2002 art. 39: cui
-- a încredințat firma vehiculul) cer o STARE consemnată la predare și la
-- restituire, cu număr și dată (OMFP 2634/2015, anexa 1 pct. 2).
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- A. `public.vehicle_handovers`: un rând = un proces-verbal. Un transfer
--    direct A → B e UN singur document care atinge DOUĂ alocări (cea care se
--    încheie și cea care începe). Pe coloanele alocării ar fi fost două PV-uri
--    pentru același moment, iar registrul (idempotent pe entitate) le-ar fi dat
--    tăcut ACELAȘI număr.
-- B. Părțile, momentul, vehiculul și tipul NU vin din client: triggerul le
--    derivă din alocări (`predare` = doar alocarea primită, `restituire` = doar
--    cea predată, `transfer` = amândouă, lipite, pe aceeași mașină). Un PV cu alt
--    șofer decât alocarea ar fi un document fals produs de aplicație.
-- C. Ciclul `ciorna` → `finalizat`. La finalizare: numărul `PVA-AAAA-NNNN` din
--    `document_sequences`, instantaneul (vehicul, părți, reprezentant,
--    documentele de bord valabile atunci), rândul din registrul general (tipul
--    `pv_predare_primire`, dosarul V.1 al inventarului, 10 ani), iar alocarea
--    fără kilometraj îl primește din PV. Finalizatul e IMUABIL: corectura e
--    anulare + PV nou (alegere de proiectare, compatibilă cu pct. 15 din anexa
--    1 a OMFP 2634/2015, nu impusă de el). Ciorna nu consumă număr.
-- D. Confirmarea din portal a fiecărei părți-angajat: o singură dată, scrisă de
--    bază (ora și autorul nu vin din payload). Completează semnătura de pe
--    hârtie, nu o înlocuiește (decizia I-c1, ⚠ jurist).
-- E. RLS pe PĂRȚILE PV-ului, nu pe șoferul curent al vehiculului: fostul șofer
--    își vede PV-ul și după restituire, managerul pe ale echipei.
-- F. Decizia 3 a lui Miro (B3, 12.10.2026): omul FĂRĂ `vehicles:read` (de regulă
--    `hr`) care conduce o mașină a firmei vede PV-urile la care e PARTE și
--    vehiculul alocat LUI („Mașina mea”), nimic din restul parcului. E o
--    abatere asumată de la decizia 3 din 7 oct („HR nu vede parcul”). Ramura
--    stă în `pv_vehicul_select` / `pv_vehicul_update` și, pentru vehicul, în
--    `vehicule_select` (rescrisă de la forma ultimă, 0199 §B). Documentele
--    vehiculului, alocările, foile, anomaliile și restul parcului rămân închise.
--    ATENȚIE la orice politică nouă care judecă după `exists (… from
--    public.vehicles …)` SUB RLS: ar moșteni ramura. Tabelele copil folosesc
--    `app.poate_vedea_vehicul_dupa_id` (0199 §B), care NU o are.
-- G. Scanul hârtiei semnate: poarta bucketului (`app.flota_poate_fisier`,
--    rescrisă de la 0202) îl lasă citit și de cine vede PV-ul, nu doar de
--    cine vede vehiculul acum (fostul șofer, managerul lui, partea fără
--    `vehicles:read`).
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu creează PV-uri din triggerul alocării: backfill-ul din 0173 și orice
--    corectură retroactivă ar produce ciorne false (decizia DL14).
--  · Nu rescrie harta `internal.registru_config_surse()`: se rescrie întreagă,
--    iar celelalte extensii F12 scriu în paralel. Trigger dedicat, ca
--    `hr_issued_documents_inregistreaza` (0120, 0184 §4).
--  · Nu atinge `alocari_inainte`, `stergeAlocarea` sau politicile din 0173.
--  · Nicio fotografie a daunelor. Scanul hârtiei semnate (`scan_path`) stă în
--    `org-flota`, în folderul vehiculului (0202), scris doar de cine
--    administrează parcul, doar pe PV-ul finalizat.
--
-- Aplicare: psql byte-exact (NOTES.md §1), după bancul local.

\set ON_ERROR_STOP on

begin;

-- ============================================================
-- 1. Tipuri
-- ============================================================
--
-- Anularea NU e o stare (e `anulat_la`), ca la `hr_issued_documents` și la
-- registru: un PV anulat rămâne finalizat, cu numărul consumat.

create type public.pv_vehicul_tip as enum ('predare', 'restituire', 'transfer');
create type public.pv_vehicul_stare as enum ('ciorna', 'finalizat');
create type public.pv_nivel_rezervor as enum ('rezerva', 'sfert', 'jumatate', 'trei_sferturi', 'plin');
create type public.pv_stare_generala as enum ('buna', 'uzura_normala', 'necesita_interventie');

-- ============================================================
-- 2. Tabela
-- ============================================================
--
-- Cheile străine spre alocări, vehicul și angajați sunt NO ACTION (implicitul),
-- nu RESTRICT: o ștergere fizică a firmei (seed-ul demo o face) ajunge la PV
-- prin cascada pe `organization_id` în aceeași comandă, iar RESTRICT ar fi
-- verificat imediat, înaintea cascadei. Rândurile însele se șterg doar logic.

create table public.vehicle_handovers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id),
  alocare_predata_id uuid references public.vehicle_assignments (id),
  alocare_primita_id uuid references public.vehicle_assignments (id),
  -- Derivate de trigger; clientul nu le trimite. Implicitele există DOAR ca
  -- tipul generat pentru `Insert` să nu le ceară (capcana 29, în sens invers):
  -- `pv_vehicul_inainte` le rescrie mereu din alocări, înaintea constrângerilor.
  tip public.pv_vehicul_tip not null default 'predare',
  moment timestamptz not null default now(),
  data_pv date not null default app.azi_local(),
  predator_employee_id uuid references public.employees (id),
  primitor_employee_id uuid references public.employees (id),
  -- Șoferul documentului: primitorul la predare și transfer, predătorul la
  -- restituire. GENERATED: trimis din client dă 428C9 (capcana 30).
  sofer_employee_id uuid generated always as (coalesce(primitor_employee_id, predator_employee_id)) stored,
  -- Constatările
  km_bord integer,
  nivel_rezervor public.pv_nivel_rezervor,
  numar_chei smallint,
  stare_generala public.pv_stare_generala,
  anvelope text,
  documente_bord text[] not null default '{}',
  dotari text[] not null default '{}',
  daune_constatate boolean,
  daune jsonb not null default '[]'::jsonb,
  observatii text,
  -- Documentul
  stare public.pv_vehicul_stare not null default 'ciorna',
  numar text not null default '',
  numar_registru text,
  snapshot jsonb,
  finalizat_la timestamptz,
  finalizat_de uuid references auth.users (id) on delete set null,
  confirmat_predator_la timestamptz,
  confirmat_predator_de uuid references auth.users (id) on delete set null,
  confirmat_primitor_la timestamptz,
  confirmat_primitor_de uuid references auth.users (id) on delete set null,
  anulat_la timestamptz,
  motiv_anulare text,
  scan_path text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,

  constraint pvv_alocare_ck check (alocare_predata_id is not null or alocare_primita_id is not null),
  constraint pvv_alocari_distincte_ck check (alocare_predata_id is distinct from alocare_primita_id),
  constraint pvv_parti_ck check (predator_employee_id is not null or primitor_employee_id is not null),
  constraint pvv_km_ck check (km_bord is null or km_bord between 0 and 5000000),
  constraint pvv_chei_ck check (numar_chei is null or numar_chei between 0 and 10),
  constraint pvv_anvelope_ck check (anvelope is null or anvelope in ('vara', 'iarna', 'all_season')),
  constraint pvv_documente_ck check (documente_bord <@ array[
    'certificat_inmatriculare', 'civ', 'polita_rca', 'carte_verde', 'polita_casco', 'copie_conforma',
    'licenta_transport', 'carte_service', 'manual_utilizare', 'constatare_amiabila']::text[]),
  constraint pvv_dotari_ck check (dotari <@ array[
    'trusa_medicala', 'triunghiuri', 'extinctor', 'vesta_reflectorizanta', 'roata_rezerva', 'kit_pana',
    'cric_cheie_roti', 'cablu_remorcare', 'lanturi_zapada', 'card_combustibil', 'dispozitiv_taxare',
    'suport_telefon']::text[]),
  constraint pvv_daune_ck check (jsonb_typeof(daune) = 'array' and jsonb_array_length(daune) <= 30),
  constraint pvv_daune_coerente_ck check (
    daune_constatate is null
    or (daune_constatate = false and jsonb_array_length(daune) = 0)
    or (daune_constatate = true and jsonb_array_length(daune) >= 1)),
  constraint pvv_observatii_len check (observatii is null or char_length(observatii) <= 2000),
  constraint pvv_motiv_len check (motiv_anulare is null or char_length(motiv_anulare) between 10 and 500),
  constraint pvv_anulare_ck check ((anulat_la is null) = (motiv_anulare is null)),
  constraint pvv_anulare_doar_finalizat_ck check (anulat_la is null or stare = 'finalizat'),
  constraint pvv_scan_len check (scan_path is null or char_length(scan_path) between 1 and 1024),
  constraint pvv_finalizat_complet_ck check (
    stare = 'ciorna'
    or (numar <> '' and finalizat_la is not null and km_bord is not null
        and nivel_rezervor is not null and stare_generala is not null
        and daune_constatate is not null and snapshot is not null))
);

comment on table public.vehicle_handovers is
  'Procesul-verbal de predare-primire a vehiculului (0215, F12c): un rând = un document, '
  'derivat din alocări. Ciornă → finalizat (număr PVA, instantaneu, registru); finalizatul e imuabil.';
comment on column public.vehicle_handovers.numar is
  '`PVA-AAAA-NNNN`, alocat de bază la finalizare. Șirul gol = încă ciornă (capcana 29 în sens invers).';
comment on column public.vehicle_handovers.snapshot is
  'Instantaneul de la finalizare: vehiculul, părțile, reprezentantul firmei, documentele de bord. '
  'Fostul șofer nu mai vede vehiculul după restituire; hârtia trebuie să spună același lucru peste un an.';

-- ============================================================
-- 3. Indexuri (toate parțiale)
-- ============================================================

create index pvv_vehicul_idx on public.vehicle_handovers (organization_id, vehicle_id, moment desc, id desc)
  where deleted_at is null;
-- „PV-urile mele” din portal: omul e predător SAU primitor (la transfer, ambii).
create index pvv_predator_idx on public.vehicle_handovers (organization_id, predator_employee_id, moment desc)
  where deleted_at is null and predator_employee_id is not null;
create index pvv_primitor_idx on public.vehicle_handovers (organization_id, primitor_employee_id, moment desc)
  where deleted_at is null and primitor_employee_id is not null;
-- Un singur PV viu pe fiecare capăt de alocare. Un PV anulat eliberează locul.
create unique index pvv_primita_uq on public.vehicle_handovers (alocare_primita_id)
  where alocare_primita_id is not null and deleted_at is null and anulat_la is null;
create unique index pvv_predata_uq on public.vehicle_handovers (alocare_predata_id)
  where alocare_predata_id is not null and deleted_at is null and anulat_la is null;
-- NU parțial pe `deleted_at`: un număr consumat nu se refolosește nici după
-- ștergere (iar ștergerea e oricum doar pe ciornă, care n-are număr).
create unique index pvv_numar_uq on public.vehicle_handovers (organization_id, numar)
  where numar <> '';

-- ============================================================
-- 4. Funcții
-- ============================================================

-- 4.1 Numerotarea `PVA-2026-0001`, copia lui `internal.aloca_numar_pv_interventie`
-- (0210 §3) și a lui `internal.aloca_numar_sesizare` (0181 §4). Secvența se
-- incrementează în ACEEAȘI tranzacție cu finalizarea: un eșec (an de registru
-- închis, kilometraj greșit) derulează și numărul, deci nu arde nimic.
create or replace function internal.aloca_numar_pv_vehicul(p_org uuid, p_an integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numar   integer;
  v_prefix  text;
  v_padding smallint;
begin
  insert into public.document_sequences (organization_id, document_type, year, prefix, next_number, padding)
  values (p_org, 'pv_vehicul', p_an, 'PVA', 2, 4)
  on conflict (organization_id, document_type, year) do update
    set next_number = public.document_sequences.next_number + 1,
        updated_at  = now()
  returning next_number - 1, prefix, padding
       into v_numar, v_prefix, v_padding;
  return coalesce(nullif(v_prefix, ''), 'PVA') || '-' || p_an::text || '-' || pg_catalog.lpad(v_numar::text, v_padding, '0');
end;
$$;

comment on function internal.aloca_numar_pv_vehicul(uuid, integer) is
  'Următorul număr de proces-verbal auto („PVA-2026-0001”), pe an. Goluri permise, repetiții nu (0215).';

-- 4.2 Instantaneul de la finalizare. NU conține CNP-ul, adresa sau alt câmp
-- sensibil al salariatului: doar numele, marca și funcția.
create or replace function internal.pv_vehicul_instantaneu(
  p_org uuid, p_vehicle uuid, p_predator uuid, p_primitor uuid, p_moment timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_firma   text;
  v_vehicul jsonb;
  v_parte   jsonb;
  v_pred    jsonb;
  v_prim    jsonb;
  v_repr    jsonb;
  v_docs    jsonb;
  v_eu      uuid := app.current_employee_id(p_org);
  v_zi      date := (p_moment at time zone 'Europe/Bucharest')::date;
begin
  select coalesce(nullif(btrim(o.legal_name), ''), o.name) into v_firma
    from public.organizations o where o.id = p_org;

  select jsonb_build_object(
           'nr_inmatriculare', v.nr_inmatriculare,
           'marca', v.marca,
           'model', v.model,
           'vin', v.vin,
           'categorie', v.categorie,
           'tip_combustibil', v.tip_combustibil,
           'an_fabricatie', v.an_fabricatie)
    into v_vehicul
    from public.vehicles v
   where v.id = p_vehicle and v.organization_id = p_org;

  v_parte := jsonb_build_object('tip', 'firma', 'nume', v_firma, 'marca', null, 'functie', null);

  select jsonb_build_object('tip', 'angajat', 'nume', e.full_name, 'marca', e.marca, 'functie', e.functie)
    into v_pred
    from public.employees e where e.id = p_predator and e.organization_id = p_org;
  select jsonb_build_object('tip', 'angajat', 'nume', e.full_name, 'marca', e.marca, 'functie', e.functie)
    into v_prim
    from public.employees e where e.id = p_primitor and e.organization_id = p_org;

  -- Reprezentantul: fișa PRINCIPALĂ a celui care finalizează (aceeași pe care o
  -- folosește RLS-ul), altfel numele din profil, altfel adresa de e-mail.
  if v_eu is not null then
    select jsonb_build_object('nume', e.full_name, 'functie', e.functie)
      into v_repr from public.employees e where e.id = v_eu;
  end if;
  if v_repr is null and auth.uid() is not null then
    select jsonb_build_object('nume', coalesce(nullif(btrim(p.full_name), ''), p.email::text), 'functie', null)
      into v_repr from public.profiles p where p.id = auth.uid();
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
             'cod', t.cod,
             'denumire', t.denumire,
             'numar', d.numar,
             'expira_la', d.expira_la,
             'valabil', (d.expira_la is null or d.expira_la >= v_zi))
           order by t.ordine, t.denumire), '[]'::jsonb)
    into v_docs
    from public.vehicle_documents d
    join public.vehicle_document_types t on t.id = d.document_type_id
   where d.vehicle_id = p_vehicle
     and d.organization_id = p_org
     and d.este_curent
     and d.deleted_at is null;

  return jsonb_build_object(
    'vehicul', v_vehicul,
    'predator', coalesce(case when p_predator is null then v_parte end, v_pred, v_parte),
    'primitor', coalesce(case when p_primitor is null then v_parte end, v_prim, v_parte),
    'reprezentant', coalesce(v_repr, jsonb_build_object('nume', null, 'functie', null)),
    'firma', jsonb_build_object('denumire', v_firma),
    'documente', v_docs
  );
end;
$$;

-- 4.3 Textul din registru (≤ 500, tăiat de apelant).
create or replace function internal.pv_vehicul_rezumat(p_pv public.vehicle_handovers, p_nr text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'Proces-verbal de predare-primire a vehiculului ' || coalesce(p_nr, '') || ' — '
         || case p_pv.tip
              when 'predare' then 'predare către '
                || coalesce((select e.full_name from public.employees e where e.id = p_pv.primitor_employee_id), 'salariat')
              when 'restituire' then 'restituire de la '
                || coalesce((select e.full_name from public.employees e where e.id = p_pv.predator_employee_id), 'salariat')
              else 'transfer de la '
                || coalesce((select e.full_name from public.employees e where e.id = p_pv.predator_employee_id), 'salariat')
                || ' către '
                || coalesce((select e.full_name from public.employees e where e.id = p_pv.primitor_employee_id), 'salariat')
            end;
$$;

-- 4.4 Garda: derivarea, ciclul și imuabilitatea. Ordinea pașilor contează.
create or replace function internal.pv_vehicul_inainte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pred        public.vehicle_assignments%rowtype;
  v_prim        public.vehicle_assignments%rowtype;
  v_veh         public.vehicles%rowtype;
  v_km_alocare  integer;
  v_e           jsonb;
  v_id_registru uuid;
  v_an          integer;
  v_serviciu    boolean := app.is_service_context();
  v_eu          uuid := app.current_employee_id(new.organization_id);
  -- `sofer_employee_id` e GENERATĂ: în BEFORE, NEW o are NULL, deci iese din
  -- orice comparație de rând întreg (altfel orice UPDATE ar părea schimbare).
  -- `updated_at` o scrie triggerul de după, `updated_by` o cere politica.
  v_mereu_libere text[] := array['sofer_employee_id', 'updated_at', 'updated_by'];
begin
  -- Cheia și data creării nu se schimbă, pe nicio stare: registrul,
  -- notificarea, legătura din registru spre PDF și urma de audit se leagă de
  -- `id`. Un `id` rescris de partea la PV (ramura ei din `pv_vehicul_update`)
  -- ar fi lăsat anularea de mai târziu fără rândul din registru.
  if tg_op = 'UPDATE' and (new.id, new.created_at) is distinct from (old.id, old.created_at) then
    raise exception using errcode = 'P0001',
      message = 'Identificatorul și data creării procesului-verbal nu se schimbă.';
  end if;

  -- ── A. UPDATE pe un PV finalizat: doar anulare, confirmări, scan ─────────
  -- Comparația e pe TOT rândul, minus coloanele permise: o coloană adăugată
  -- mai târziu e imuabilă din oficiu, în loc să scape dintr-o listă scrisă de
  -- mână (cum scăpaseră `id` și `created_at`).
  if tg_op = 'UPDATE' and old.stare = 'finalizat' then
    if (to_jsonb(new) - (v_mereu_libere || array['anulat_la', 'motiv_anulare', 'scan_path',
                                                 'confirmat_predator_la', 'confirmat_predator_de',
                                                 'confirmat_primitor_la', 'confirmat_primitor_de']))
       is distinct from
       (to_jsonb(old) - (v_mereu_libere || array['anulat_la', 'motiv_anulare', 'scan_path',
                                                 'confirmat_predator_la', 'confirmat_predator_de',
                                                 'confirmat_primitor_la', 'confirmat_primitor_de'])) then
      raise exception using errcode = 'P0001',
        message = 'Procesul-verbal este finalizat și nu se mai modifică. Dacă a fost întocmit greșit, anulați-l și întocmiți altul.';
    end if;

    -- Anularea: o singură dată, cu ora bazei.
    if old.anulat_la is not null
       and (new.anulat_la, new.motiv_anulare) is distinct from (old.anulat_la, old.motiv_anulare) then
      raise exception using errcode = 'P0001', message = 'Procesul-verbal este deja anulat.';
    end if;
    if old.anulat_la is null and new.anulat_la is not null then
      new.anulat_la := now();
    end if;

    -- Confirmările: o singură dată fiecare; doar partea respectivă; ora și
    -- autorul le scrie baza, nu payload-ul. Un PV anulat nu se mai confirmă.
    if new.confirmat_primitor_la is distinct from old.confirmat_primitor_la then
      if old.confirmat_primitor_la is not null or old.anulat_la is not null
         or new.anulat_la is not null or old.primitor_employee_id is null
         or (not v_serviciu and old.primitor_employee_id is distinct from v_eu) then
        raise exception using errcode = 'P0001',
          message = 'Doar angajatul care primește vehiculul poate confirma primirea, o singură dată.';
      end if;
      new.confirmat_primitor_la := now();
      new.confirmat_primitor_de := auth.uid();
    elsif new.confirmat_primitor_de is distinct from old.confirmat_primitor_de then
      raise exception using errcode = 'P0001', message = 'Autorul confirmării îl scrie aplicația.';
    end if;

    if new.confirmat_predator_la is distinct from old.confirmat_predator_la then
      if old.confirmat_predator_la is not null or old.anulat_la is not null
         or new.anulat_la is not null or old.predator_employee_id is null
         or (not v_serviciu and old.predator_employee_id is distinct from v_eu) then
        raise exception using errcode = 'P0001',
          message = 'Doar angajatul care predă vehiculul poate confirma predarea, o singură dată.';
      end if;
      new.confirmat_predator_la := now();
      new.confirmat_predator_de := auth.uid();
    elsif new.confirmat_predator_de is distinct from old.confirmat_predator_de then
      raise exception using errcode = 'P0001', message = 'Autorul confirmării îl scrie aplicația.';
    end if;

    -- Scanul hârtiei semnate stă în folderul VEHICULULUI din `org-flota`
    -- (0202: `{org}/vehicles/{vehicul}/{uuid}-{fișier}`), cu aceeași regulă de
    -- cale ca scanarea documentelor (`internal.flota_cale_valida`).
    if new.scan_path is distinct from old.scan_path and new.scan_path is not null
       and not internal.flota_cale_valida(new.scan_path, new.organization_id, 'vehicles', new.vehicle_id) then
      raise exception using errcode = 'P0001',
        message = 'Calea scanului nu corespunde vehiculului procesului-verbal.';
    end if;

    -- Cine NU administrează parcul poate schimba DOAR coloana lui de
    -- confirmare. Anularea și scanul cer `vehicles:update = all`.
    if not v_serviciu and not app.can(new.organization_id, 'vehicles', 'update', 'all') then
      if (new.anulat_la, new.motiv_anulare, new.scan_path)
         is distinct from (old.anulat_la, old.motiv_anulare, old.scan_path) then
        raise exception using errcode = 'P0001',
          message = 'Puteți doar confirma procesul-verbal. Anularea o face cine administrează parcul auto.';
      end if;
    end if;
    return new;
  end if;

  -- ── B. INSERT sau UPDATE pe ciornă ─────────────────────────────────────
  if tg_op = 'UPDATE' and (new.alocare_predata_id, new.alocare_primita_id, new.organization_id)
                         is distinct from (old.alocare_predata_id, old.alocare_primita_id, old.organization_id) then
    raise exception using errcode = 'P0001',
      message = 'Alocările unui proces-verbal nu se schimbă. Ștergeți ciorna și întocmiți alta.';
  end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  if new.confirmat_predator_la is not null or new.confirmat_primitor_la is not null
     or new.confirmat_predator_de is not null or new.confirmat_primitor_de is not null
     or new.anulat_la is not null or new.motiv_anulare is not null then
    raise exception using errcode = 'P0001',
      message = 'O ciornă nu se confirmă și nu se anulează; se finalizează sau se șterge.';
  end if;
  if new.scan_path is not null then
    raise exception using errcode = 'P0001',
      message = 'Scanul semnat se atașează după finalizarea procesului-verbal.';
  end if;
  -- Ștergerea logică a ciornei: fără derivare. Altfel o ciornă a cărei alocare
  -- a fost ștearsă între timp n-ar mai putea fi ștearsă („nu aparține…”).
  -- Tocmai fiindcă sare peste derivare, ștergerea NU poartă nicio altă
  -- schimbare: un `numar` pus pe rândul șters ar ocupa `pvv_numar_uq` pentru
  -- totdeauna (fiecare finalizare de după ar cădea pe 23505), o parte
  -- schimbată ar deschide ciorna ștearsă altui angajat (`pv_vehicul_select`
  -- nu filtrează `deleted_at`), iar `stare = 'finalizat'` în aceeași scriere
  -- ar lăsa în registru un PV pe care nu-l mai vede nimeni.
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    if (to_jsonb(new) - (v_mereu_libere || array['deleted_at']))
       is distinct from (to_jsonb(old) - (v_mereu_libere || array['deleted_at'])) then
      raise exception using errcode = 'P0001',
        message = 'Ștergerea ciornei nu poate modifica alte câmpuri ale procesului-verbal.';
    end if;
    return new;
  end if;

  if new.alocare_predata_id is not null then
    select * into v_pred from public.vehicle_assignments a
     where a.id = new.alocare_predata_id and a.deleted_at is null;
    if not found or v_pred.organization_id <> new.organization_id then
      raise exception using errcode = 'P0001',
        message = 'Alocarea predată nu aparține organizației dumneavoastră.';
    end if;
    if v_pred.pana_la is null then
      raise exception using errcode = 'P0001',
        message = 'Alocarea nu este încheiată. Restituirea vehiculului se consemnează după încheierea alocării.';
    end if;
  end if;
  if new.alocare_primita_id is not null then
    select * into v_prim from public.vehicle_assignments a
     where a.id = new.alocare_primita_id and a.deleted_at is null;
    if not found or v_prim.organization_id <> new.organization_id then
      raise exception using errcode = 'P0001',
        message = 'Alocarea primită nu aparține organizației dumneavoastră.';
    end if;
  end if;
  if new.alocare_predata_id is not null and new.alocare_primita_id is not null then
    if v_pred.vehicle_id <> v_prim.vehicle_id or v_pred.pana_la <> v_prim.de_la then
      raise exception using errcode = 'P0001',
        message = 'Transferul se consemnează doar între alocarea încheiată și cea care începe în același moment, pe același vehicul.';
    end if;
    -- Două alocări lipite ale aceluiași om nu sunt o predare. EXCLUDE-ul din
    -- 0173 oprește suprapunerea, nu și asta: regula 2 închide alocarea
    -- deschisă indiferent de șofer.
    if v_pred.employee_id = v_prim.employee_id then
      raise exception using errcode = 'P0001',
        message = 'Vehiculul rămâne la același șofer. Nu este o predare care să ceară proces-verbal.';
    end if;
  end if;

  new.vehicle_id := coalesce(v_prim.vehicle_id, v_pred.vehicle_id);
  new.tip := case
    when new.alocare_predata_id is not null and new.alocare_primita_id is not null then 'transfer'
    when new.alocare_primita_id is not null then 'predare'
    else 'restituire' end::public.pv_vehicul_tip;
  new.moment := coalesce(v_prim.de_la, v_pred.pana_la);
  new.data_pv := (new.moment at time zone 'Europe/Bucharest')::date;
  new.predator_employee_id := v_pred.employee_id;    -- null la predare = firma
  new.primitor_employee_id := v_prim.employee_id;    -- null la restituire = firma
  v_km_alocare := coalesce(v_prim.km_predare, v_pred.km_restituire);
  if new.km_bord is null then new.km_bord := v_km_alocare; end if;
  -- Ce scrie baza la finalizare nu vine din client nici pe ciornă.
  new.numar_registru := null;
  new.snapshot := null;
  new.finalizat_la := null;
  new.finalizat_de := null;

  -- Forma fiecărei daune (CHECK-ul tabelei verifică doar lista și lungimea ei).
  if jsonb_typeof(new.daune) = 'array' then
    for v_e in select * from jsonb_array_elements(new.daune) loop
      if jsonb_typeof(v_e) <> 'object'
         or coalesce(v_e ->> 'zona', '') not in ('fata', 'spate', 'lateral_stanga', 'lateral_dreapta', 'plafon',
              'parbriz', 'geamuri', 'oglinzi', 'faruri_stopuri', 'jante_anvelope', 'interior', 'altele')
         or char_length(btrim(coalesce(v_e ->> 'descriere', ''))) not between 1 and 300 then
        raise exception using errcode = 'P0001',
          message = 'Fiecare daună are o zonă din listă și o descriere de cel mult 300 de caractere.';
      end if;
    end loop;
  end if;

  if tg_op = 'INSERT' then
    if new.stare <> 'ciorna' then
      raise exception using errcode = 'P0001', message = 'Procesul-verbal se întocmește întâi ca ciornă.';
    end if;
    new.numar := '';  -- clientul nu-și alege numărul
    return new;
  end if;

  -- ── C. Finalizarea: ciorna → finalizat ─────────────────────────────────
  if new.stare = 'finalizat' and old.stare = 'ciorna' then
    if new.km_bord is null or new.nivel_rezervor is null or new.stare_generala is null
       or new.daune_constatate is null then
      raise exception using errcode = 'P0001',
        message = 'Completați kilometrajul, nivelul din rezervor, starea generală și dacă s-au constatat daune înainte de finalizare.';
    end if;
    if v_km_alocare is not null and v_km_alocare <> new.km_bord then
      raise exception using errcode = 'P0001',
        message = format('Kilometrajul din procesul-verbal (%s km) diferă de cel al alocării (%s km).',
                         new.km_bord, v_km_alocare);
    end if;
    -- `va_km_ck` din 0173: completarea nu are voie să lase alocarea cu
    -- restituirea sub predare (altfel 23514 brut, pe o tabelă pe care omul
    -- nici nu o editează).
    if new.alocare_predata_id is not null and v_pred.km_predare is not null
       and new.km_bord < v_pred.km_predare then
      raise exception using errcode = 'P0001',
        message = format('Kilometrajul din procesul-verbal (%s km) este mai mic decât cel de la predarea vehiculului către acest șofer (%s km).',
                         new.km_bord, v_pred.km_predare);
    end if;
    if new.alocare_primita_id is not null and v_prim.km_restituire is not null
       and new.km_bord > v_prim.km_restituire then
      raise exception using errcode = 'P0001',
        message = format('Kilometrajul din procesul-verbal (%s km) este mai mare decât cel de la restituirea ulterioară (%s km).',
                         new.km_bord, v_prim.km_restituire);
    end if;

    select * into v_veh from public.vehicles v
     where v.id = new.vehicle_id and v.organization_id = new.organization_id;
    if not found or v_veh.deleted_at is not null then
      raise exception using errcode = 'P0001',
        message = 'Vehiculul a fost șters din evidență. Procesul-verbal nu se mai poate finaliza.';
    end if;

    -- Alocarea fără kilometraj îl primește din PV: două valori diferite pentru
    -- același moment ar fi o contradicție permanentă. `alocari_inainte` lasă
    -- coloanele de km libere (blochează doar cine, ce, de când și mutarea lui
    -- `pana_la`).
    if v_km_alocare is null then
      if new.alocare_primita_id is not null then
        update public.vehicle_assignments
           set km_predare = new.km_bord, updated_at = now(), updated_by = auth.uid()
         where id = new.alocare_primita_id and km_predare is null;
      end if;
      if new.alocare_predata_id is not null then
        update public.vehicle_assignments
           set km_restituire = new.km_bord, updated_at = now(), updated_by = auth.uid()
         where id = new.alocare_predata_id and km_restituire is null;
      end if;
    end if;

    new.snapshot := internal.pv_vehicul_instantaneu(new.organization_id, new.vehicle_id,
                      new.predator_employee_id, new.primitor_employee_id, new.moment);
    -- Anul numărului e anul predării (ora României). `document_sequences` cere
    -- 2000–2200; o alocare preluată din `data_achizitie` (backfill 0173) poate
    -- începe mai devreme, iar atunci se ia anul de azi (ca `an_pv_interventie`).
    v_an := extract(year from new.data_pv)::integer;
    if v_an not between 2000 and 2200 then
      v_an := extract(year from app.azi_local())::integer;
    end if;
    new.numar := internal.aloca_numar_pv_vehicul(new.organization_id, v_an);
    new.finalizat_la := now();
    new.finalizat_de := auth.uid();
    v_id_registru := internal.inregistreaza_document(
      p_organization_id        => new.organization_id,
      p_sens                   => 'intern'::public.registru_sens,
      p_tip_document           => 'pv_predare_primire',
      p_continut_rezumat       => left(internal.pv_vehicul_rezumat(new, v_veh.nr_inmatriculare), 500),
      p_entitate_tip           => 'vehicle_handovers',
      p_entitate_id            => new.id,
      p_numar_document_emitent => new.numar,
      p_data_document_emitent  => new.data_pv,
      p_emitent                => internal.registru_denumire_org(new.organization_id),
      -- NU `new.sofer_employee_id`: coloana GENERATĂ e încă NULL în BEFORE.
      p_angajat_id             => coalesce(new.primitor_employee_id, new.predator_employee_id)
    );
    select r.numar_afisat into new.numar_registru
      from public.registru_documente r where r.id = v_id_registru;
    return new;
  end if;

  if new.stare = 'ciorna' and old.stare = 'ciorna' then
    new.numar := old.numar;
    return new;
  end if;
  raise exception using errcode = 'P0001', message = 'Tranziție nepermisă a procesului-verbal.';
end;
$$;

-- 4.5 După: notificarea părților la finalizare, anularea în registru.
create or replace function internal.pv_vehicul_dupa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_nr   text := coalesce(new.snapshot #>> '{vehicul,nr_inmatriculare}', '');
begin
  if old.stare = 'ciorna' and new.stare = 'finalizat' then
    -- Fiecare parte-angajat cu cont, în afară de cel care finalizează. Linkul
    -- duce în portal, unde confirmă; ramura „parte la PV” (decizia 3) îl lasă
    -- și pe omul fără `vehicles:read`.
    for v_user in
      select distinct e.user_id
        from public.employees e
       where e.id in (new.predator_employee_id, new.primitor_employee_id)
         and e.organization_id = new.organization_id
         and e.user_id is not null
         and e.deleted_at is null
    loop
      if auth.uid() is null or v_user <> auth.uid() then
        insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
        values (v_user, new.organization_id, 'task',
                left('Proces-verbal ' || new.numar || ' de confirmat', 200),
                left('Confirmați în portal procesul-verbal de predare-primire a vehiculului '
                     || v_nr || '. Confirmarea completează semnătura de pe hârtie, nu o înlocuiește.', 4000),
                '/portal/masina-mea?pv=' || new.id::text,
                'vehicle_handover', new.id);
      end if;
    end loop;
  end if;

  -- Copia lui `internal.hr_issued_documents_anuleaza_in_registru` (0158). Nu
  -- ocolește garda exercițiului închis: pe un an închis, anularea e respinsă.
  if old.anulat_la is null and new.anulat_la is not null then
    update public.registru_documente r
       set anulat_la     = new.anulat_la,
           motiv_anulare = 'Procesul-verbal ' || new.numar || ' a fost anulat'
                        || coalesce(': ' || nullif(btrim(new.motiv_anulare), ''), '.')
     where r.organization_id = new.organization_id
       and r.entitate_tip    = 'vehicle_handovers'
       and r.entitate_id     = new.id
       and r.anulat_la is null;
  end if;
  return null;
end;
$$;

-- 4.6 Poarta bucketului `org-flota`, rescrisă de la forma ultimă (0202 §7;
-- verificat cu grep: nicio altă migrare n-o rescrie). Un singur caz nou, pe
-- ramura de CITIRE a folderului `vehicles`: scanul PV-ului semnat (calea egală
-- EXACT cu `scan_path`) îl citește cine vede PV-ul, după regula lui
-- `pv_vehicul_select`, nu doar cine vede vehiculul ACUM. Fără el, fostul șofer
-- și managerul lui își vedeau PV-ul (E), dar nu hârtia semnată: după
-- restituire, `vehicles.employee_id` nu mai e al lor. Restul folderului
-- vehiculului (documentele de bord) rămâne pe vizibilitatea vehiculului.
create or replace function app.flota_poate_fisier(p_name text, p_actiune text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org     uuid := app.path_org(p_name);
  v_tip     text := app.path_segment(p_name, 2);
  v_id_text text := app.path_segment(p_name, 3);
  v_id      uuid;
  v_vehicul public.vehicles%rowtype;
  v_foaie   public.trip_sheets%rowtype;
begin
  if v_org is null or v_tip is null or v_id_text is null
     or app.path_segment(p_name, 4) is null
     or app.path_segment(p_name, 5) is not null then
    return false;
  end if;
  if v_tip not in ('vehicles', 'trip_sheets') then
    return false;
  end if;
  if v_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  v_id := v_id_text::uuid;

  -- Administratorul de platformă citește (ca `vdoc_select`), nu scrie.
  if p_actiune = 'read' and app.is_platform_admin() then
    return true;
  end if;

  if not (v_org = any (app.current_org_ids())) then return false; end if;
  if not app.feature_on(v_org, 'fleet') then return false; end if;

  if v_tip = 'vehicles' then
    select * into v_vehicul from public.vehicles v
     where v.id = v_id and v.organization_id = v_org;
    if not found then return false; end if;
    if p_actiune = 'read' then
      return app.poate_vedea_vehicul(v_org, v_vehicul.employee_id, v_vehicul.pool)
          or exists (
               select 1 from public.vehicle_handovers h
                where h.organization_id = v_org
                  and h.vehicle_id = v_id
                  and h.scan_path = p_name
                  and h.deleted_at is null
                  and (app.poate_vedea_vehicul(v_org, h.predator_employee_id)
                       or app.poate_vedea_vehicul(v_org, h.primitor_employee_id)
                       or app.current_employee_id(v_org) in (h.predator_employee_id, h.primitor_employee_id)));
    end if;
    return v_vehicul.deleted_at is null
       and app.has_permission(v_org, 'vehicles', 'update') = 'all';
  end if;

  select * into v_foaie from public.trip_sheets t
   where t.id = v_id and t.organization_id = v_org;
  if not found then return false; end if;
  if p_actiune = 'read' then
    return app.poate_vedea_foaie(v_org, v_foaie.employee_id);
  end if;
  -- Bonul urmează alimentarea: se atașează doar cât foaia e ciornă (0200 §D1).
  return v_foaie.deleted_at is null
     and v_foaie.status = 'draft'
     and app.poate_scrie_foaie(v_org, v_foaie.employee_id);
end;
$$;

comment on function app.flota_poate_fisier(text, text) is
  'Poarta bucketului org-flota (0202, 0215): {org}/vehicles/{vehicul}/… după vizibilitatea vehiculului și vehicles:update = all, '
  'iar scanul unui PV de predare (scan_path) și după vizibilitatea PV-ului; {org}/trip_sheets/{foaie}/… după foaie, scriere doar pe ciornă. Fără app.can_path.';

-- ============================================================
-- 5. Triggere
-- ============================================================
--
-- `pv_vehicul_inainte` < `vehicle_handovers_set_updated_at` alfabetic: garda
-- rulează prima, apoi `updated_at`, fără interferență.

create trigger pv_vehicul_inainte before insert or update on public.vehicle_handovers
  for each row execute function internal.pv_vehicul_inainte();
create trigger pv_vehicul_dupa after update on public.vehicle_handovers
  for each row execute function internal.pv_vehicul_dupa();

-- ============================================================
-- 6. RLS
-- ============================================================

alter table public.vehicle_handovers enable row level security;
alter table public.vehicle_handovers force row level security;

-- FĂRĂ `deleted_at is null` aici: cu el, ștergerea logică a ciornei ar da
-- 42501 mereu (defectul din 0164, Postgres verifică rândul NOU contra
-- politicii SELECT). Precedent: `alocari_select` (0173). Citirile filtrează
-- explicit.
--
-- `app.poate_vedea_vehicul(org, angajat)` cu DOUĂ argumente (0012; 0199 a
-- lăsat-o neschimbată pentru alocări): pool-ul nu contează pe un document al
-- unei predări nominale. Ultima ramură e decizia 3: partea la PV îl vede și
-- fără `vehicles:read`.
create policy pv_vehicul_select on public.vehicle_handovers
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and (
        app.poate_vedea_vehicul(organization_id, predator_employee_id)
        or app.poate_vedea_vehicul(organization_id, primitor_employee_id)
        or app.current_employee_id(organization_id) in (predator_employee_id, primitor_employee_id)
      )
    )
  );

create policy pv_vehicul_insert on public.vehicle_handovers
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and app.has_permission(organization_id, 'vehicles', 'update') = 'all'
    and stare = 'ciorna'
    and deleted_at is null
    and anulat_la is null
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

-- A doua ramură: partea la PV (predător sau primitor) pe un PV finalizat și
-- neanulat, ca să-l confirme. Triggerul îi limitează scrierea la coloana LUI
-- de confirmare. `x in (a, b)` cu un `b` NULL dă NULL când nu se potrivește cu
-- `a`: în USING asta înseamnă „rândul nu trece”, deci e corect (nu-l
-- transforma în `not in`).
create policy pv_vehicul_update on public.vehicle_handovers
  for update to authenticated
  using (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and (
      app.has_permission(organization_id, 'vehicles', 'update') = 'all'
      or (stare = 'finalizat' and anulat_la is null
          and app.current_employee_id(organization_id) in (predator_employee_id, primitor_employee_id))
    )
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'fleet')
    and updated_by = (select auth.uid())
  );

-- Decizia 3, partea a doua: vehiculul alocat omului îi e vizibil și fără
-- `vehicles:read` („Mașina mea”). Forma ultimă e 0199 §B (verificat cu grep:
-- nicio migrare 0200–0212 n-o mai rescrie); doar ramura de la coadă e nouă.
-- `vehicles.employee_id` e derivatul alocării DESCHISE (0173), deci după
-- restituire mașina dispare din nou. Documentele (`vdoc_select`), alocările,
-- foile și anomaliile NU urmează ramura: „nimic din restul parcului”.
drop policy if exists vehicule_select on public.vehicles;
create policy vehicule_select on public.vehicles
  for select to authenticated
  using (
    (select app.is_platform_admin())
    or (
      organization_id = any ((select app.current_org_ids())::uuid[])
      and app.feature_on(organization_id, 'fleet')
      and (
        app.poate_vedea_vehicul(organization_id, employee_id, pool)
        or (employee_id is not null and employee_id = app.current_employee_id(organization_id))
      )
    )
  );

-- ============================================================
-- 7. Actor, audit, granturi
-- ============================================================
--
-- Flota NU are `internal.set_actor`: `created_by`/`updated_by` se trimit
-- explicit din acțiuni (capcana 23), iar politicile le cer.

do $$
declare t text;
begin
  foreach t in array array['vehicle_handovers'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function internal.seteaza_updated_at()',
      t || '_set_updated_at', t);
    perform internal.attach_audit(t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end
$$;

revoke all on function internal.aloca_numar_pv_vehicul(uuid, integer) from public, anon, authenticated;
revoke all on function internal.pv_vehicul_instantaneu(uuid, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function internal.pv_vehicul_rezumat(public.vehicle_handovers, text) from public, anon, authenticated;
revoke all on function internal.pv_vehicul_inainte() from public, anon, authenticated;
revoke all on function internal.pv_vehicul_dupa() from public, anon, authenticated;
-- Ca în 0202: poarta e chemată din politicile de Storage, sub `authenticated`.
revoke all on function app.flota_poate_fisier(text, text) from public, anon;
grant execute on function app.flota_poate_fisier(text, text) to authenticated, service_role;

-- ============================================================
-- 8. Verificarea de la final
-- ============================================================

do $$
begin
  if not exists (
    select 1 from public.nomenclator_tipuri where tip_document = 'pv_predare_primire'
  ) and exists (select 1 from public.nomenclator_tipuri) then
    raise warning '0215: tipul de registru pv_predare_primire lipsește din nomenclatorul firmelor; PV-ul se înregistrează fără dosar.';
  end if;
end
$$;

commit;

-- ============================================================
-- Note de proiectare
-- ============================================================
--
-- * Backfill: NICIUNUL. Un PV fără constatări reale ar fi un document fals.
-- * Kilometrajul nu se compară cu `vehicles.km_curent`: predarea se poate
--   înregistra retroactiv (coada lui 0173). Abaterea o spune ecranul.
-- * Registrul înregistrează PV-ul cu data FINALIZĂRII (`app.azi_local()`), iar
--   `data_pv` e ziua predării. Un PV întocmit după predare poartă ambele date pe
--   hârtie (decizia I-c7, ⚠ contabil).
-- * Ștergerea logică e permisă doar pe ciornă (pasul A o refuză pe finalizat,
--   fiindcă `deleted_at` intră în comparația rândului întreg) și nu poartă nicio
--   altă schimbare (pasul B).
