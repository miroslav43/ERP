-- supabase/migrations/0053_concedii_aprobare_intr_o_treapta.sql
-- Redenumită din 0049: între timp, în amonte, migrările de salarizare au fost
-- renumerotate pe 0049-0052. Convenția din CLAUDE.md la coliziune de nume e să
-- îți redenumești PROPRIA migrare. Conținutul e neschimbat și a fost deja rulat
-- pe baza de dezvoltare sub numele vechi — efectul în bază e identic.
-- Cererea de concediu cerea DOUĂ aprobări, nu una.
--
-- Fluxul seed-uit avea două trepte: `ordine 1` = manager_direct (obligatorie) și
-- `ordine 2` = permisiune `leave:approve` (opțională). Ambele produceau sarcini
-- deschise, iar cererea nu se aproba până nu decideau amândouă treptele. Cerința
-- e alta: managerul direct SAU patronul, prima decizie contează.
--
-- Efect secundar, la fel de vizibil: cine e și manager direct, și deținător de
-- `leave:approve` primea DOUĂ sarcini pentru aceeași cerere și o vedea de două
-- ori în ecranul de aprobări.
--
-- Reparația e de configurație, nu de mecanism — mecanismul era deja corect:
--   • `internal.rezolva_aprobatori` cu tip='permisiune' și 'leave:approve'
--     întoarce EXACT mulțimea cerută: cei cu scope='all' (patronul) plus cei cu
--     scope='team' care sunt ancestori ai angajatului în `manager_path` (deci
--     managerul direct și șefii lui);
--   • `internal.approval_tasks_anuleaza_surori` anulează sarcinile rămase de la
--     ACEEAȘI `ordine` la prima decizie.
-- Puse împreună, o singură treaptă dă „oricare dintre ei, primul decide”. Nu se
-- atinge nicio funcție.

begin;

-- ============================================================
-- 1. SEED-UL, pentru organizațiile viitoare
-- ============================================================

create or replace function internal.seed_leave_defaults(p_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_flow uuid;
  v_zile_odihna smallint;
begin
  select o.zile_concediu_anual_implicit into v_zile_odihna
  from public.organizations o
  where o.id = p_organization_id;

  insert into public.leave_types (organization_id, key, denumire, zile_implicite, scade_din_sold,
    necesita_document, se_reporteaza, termen_reportare, intrerupe_alte_concedii,
    mod_rotunjire_acumulare, plafon_reportare_zile, culoare, temei_legal, reglementat)
  select p_organization_id, t.key, t.denumire,
         case when t.key = 'odihna' then coalesce(v_zile_odihna, t.zile) else t.zile end,
         t.scade, t.doc, t.rep, t.termen, t.intrerupe,
         t.rotunjire::public.leave_rounding_mode, t.plafon, t.culoare, t.temei, t.reglementat
  from (values
    ('odihna',        'Concediu de odihnă',                          20, true,  false, true,  18,   false, 'jumatate_in_sus', 20, '#2563EB', 'Codul Muncii art. 145 (DE VERIFICAT)', false),
    ('medical',       'Concediu medical',                           183, false, true,  false, null, true,  'fara_rotunjire', null, '#DC2626', 'OUG 158/2005 (DE VERIFICAT)', true),
    ('maternitate',   'Concediu de maternitate',                    126, false, true,  false, null, true,  'fara_rotunjire', null, '#DB2777', 'OUG 158/2005 (DE VERIFICAT)', true),
    ('paternal',      'Concediu paternal (la nașterea copilului)',   10, false, true,  false, null, false, 'fara_rotunjire', null, '#0891B2', 'Legea 210/1999 (DE VERIFICAT)', true),
    ('crestere_copil','Concediu creștere copil',                    730, false, true,  false, null, true,  'fara_rotunjire', null, '#7C3AED', 'OUG 111/2010 (DE VERIFICAT)', true),
    ('casatorie',     'Concediu pentru căsătorie',                    5, false, true,  false, null, false, 'fara_rotunjire', null, '#F59E0B', 'CCM / regulament intern (DE VERIFICAT)', false),
    ('deces_ruda',    'Concediu pentru deces în familie',             3, false, true,  false, null, false, 'fara_rotunjire', null, '#475569', 'CCM / regulament intern (DE VERIFICAT)', false),
    ('donator_sange', 'Zi liberă donator de sânge',                   1, false, true,  false, null, false, 'fara_rotunjire', null, '#B91C1C', 'Legea 282/2005 (DE VERIFICAT)', true),
    ('ingrijitor',    'Concediu de îngrijitor',                       5, false, true,  false, null, false, 'fara_rotunjire', null, '#0D9488', 'Codul Muncii art. 152^1 (DE VERIFICAT)', true),
    ('fara_plata',    'Concediu fără plată',                         90, false, false, false, null, false, 'fara_rotunjire', null, '#94A3B8', 'Regulament intern (DE VERIFICAT)', false)
  ) as t(key, denumire, zile, scade, doc, rep, termen, intrerupe, rotunjire, plafon, culoare, temei, reglementat)
  on conflict do nothing;

  insert into public.approval_flows (organization_id, entity_type, denumire)
  values (p_organization_id, 'leave_request', 'Aprobare cerere de concediu')
  on conflict do nothing;

  select id into v_flow from public.approval_flows
   where organization_id = p_organization_id and entity_type = 'leave_request'
     and activ and deleted_at is null;

  if v_flow is not null then
    -- O SINGURĂ treaptă. `permisiune` acoperă și managerul direct (scope 'team'
    -- + ancestor în `manager_path`), și patronul (scope 'all'), deci treapta
    -- separată `manager_direct` era redundantă și, fiind obligatorie,
    -- transforma alegerea în secvență.
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, permission_key, optional, sla_ore)
    values (p_organization_id, v_flow, 1, 'permisiune', 'leave:approve', false, 72)
    on conflict do nothing;
  end if;
end; $$;

-- ============================================================
-- 2. FLUXURILE EXISTENTE
-- ============================================================
-- Treapta 1 devine `permisiune`; treapta 2 se șterge logic. Ordinea contează:
-- indexul unic e pe (flow_id, ordine) where deleted_at is null, iar dacă am
-- fi mutat treapta 2 pe poziția 1 înainte s-o eliberăm, ar fi ciocnit.

update public.approval_steps s
   set tip = 'permisiune',
       permission_key = 'leave:approve',
       rol = null,
       approver_user_id = null,
       optional = false,
       updated_at = now()
  from public.approval_flows f
 where f.id = s.flow_id
   and f.entity_type = 'leave_request'
   and s.ordine = 1
   and s.tip = 'manager_direct'
   and s.deleted_at is null;

update public.approval_steps s
   set deleted_at = now(), updated_at = now()
  from public.approval_flows f
 where f.id = s.flow_id
   and f.entity_type = 'leave_request'
   and s.ordine >= 2
   and s.deleted_at is null;

-- ============================================================
-- 3. CERERILE AFLATE ÎN CURS
-- ============================================================
-- Cererile deja trimise au sarcini pe două trepte. Fără reparație aici, ele ar
-- rămâne pe regula veche: aprobarea treptei 1 nu ar închide cererea, iar
-- utilizatorul ar vedea că „nu s-a schimbat nimic”.
--
-- Se aduc toate sarcinile deschise pe `ordine = 1`, ca să devină surori — de
-- acolo, prima decizie le anulează pe restul, prin trigger-ul existent.
--
-- `ordine` NU e în lista albă a lui `internal.approval_tasks_imutabile`, care
-- lasă modificabile doar status/comentariu/decis_la/deleted_at/updated_at.
-- Trece pentru că `app.is_service_context()` iese pe prima linie când GUC-ul
-- `role` nu e 'authenticated'/'anon' — adevărat pentru o migrare rulată ca
-- `postgres`. Rulat din aplicație, ar fi refuzat zgomotos, nu tăcut.

update public.approval_tasks t
   set ordine = 1, updated_at = now()
 where t.entity_type = 'leave_request'
   and t.status = 'in_asteptare'
   and t.deleted_at is null
   and t.ordine <> 1;

-- Aceeași persoană putea avea două sarcini pe aceeași cerere (manager direct ȘI
-- deținător de `leave:approve`) — de aici cererea dublată în listă. Se păstrează
-- cea mai veche. `ctid` departajează rândurile altfel identice, iar `min(id)`
-- ar fi ales arbitrar după uuid, nu după vechime.
--
-- Se ȘTERG LOGIC, nu se anulează prin status: `anuleaza_surori` se declanșează
-- la orice ieșire din 'in_asteptare' și ar fi anulat toate surorile de la
-- aceeași ordine — inclusiv sarcina pe care tocmai o păstram. Cu `deleted_at`
-- trigger-ul nu pornește, iar rândul dispare oricum din liste și din
-- numărătoarea sarcinilor rămase, care filtrează peste tot `deleted_at is null`.
with duplicate as (
  select t.id,
         row_number() over (
           partition by t.entity_id, t.approver_user_id
           order by t.created_at, t.ctid
         ) as rang
    from public.approval_tasks t
   where t.entity_type = 'leave_request'
     and t.status = 'in_asteptare'
     and t.deleted_at is null
     and t.approver_user_id is not null
)
update public.approval_tasks t
   set deleted_at = now(), updated_at = now()
  from duplicate d
 where d.id = t.id and d.rang > 1;

commit;
