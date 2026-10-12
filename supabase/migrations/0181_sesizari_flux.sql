-- supabase/migrations/0181_sesizari_flux.sql
--
-- MENTENANȚĂ, LOTUL 3 (M3): SESIZAREA CA FLUX COMPLET — TEHNICIAN, OPRIRI, PORTAL.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
-- Până aici o sesizare avea cinci stări, un singur gest de triaj și NICIO urmă
-- a drumului ei: cine a preluat-o, când, ce s-a discutat, ce poză s-a făcut.
-- Doar `org_admin` putea atinge una (`maintenance:update`), deci mecanicul care
-- chiar o repară trebuia să-i ceară administratorului să apese butoanele.
--
-- 1. Numerotare `SZ-2026-0001` prin `public.document_sequences` (același
--    mecanism ca tichetele IT, `app.aloca_numar_tichet` 0045:305 — un al treilea
--    contor ar fi fost „a treia mecanică pentru aceeași nevoie", 0098:16).
-- 2. Atribuire nominală: `atribuit_employee_id`. Tehnicianul atribuit — ORICE
--    rol — vede sesizarea lui (politica SELECT), o trece în lucru / în
--    așteptare, înregistrează intervenția și o marchează rezolvată. Triajul,
--    atribuirea, respingerea și închiderea rămân la `maintenance:update ≥ team`.
--    Cine poate schimba CE se decide în `internal.fault_reports_garda`, nu în
--    ecran — politica de UPDATE deschide ușa raportorului și tehnicianului, iar
--    garda le dă fiecăruia exact câmpurile lui.
-- 3. Stări noi: `in_asteptare` (piese, furnizor), `inchis` (raportorul confirmă
--    sau se închide automat după N zile), `retrasa` (raportorul renunță).
--    Redeschiderea `rezolvat → in_lucru` cere motiv și golește intervenția.
-- 4. Comentarii (cu note interne invizibile raportorului, prin RLS), istoric
--    imutabil al tranzițiilor, atașamente generice (poze pe sesizare, documente
--    pe echipament, PV pe intervenție, scan pe autorizație) într-o singură
--    tabelă, cu bucket propriu și politici proprii pe `storage.objects`.
-- 5. Jurnalul de opriri (`equipment_opriri`): o sesizare cu „oprește
--    funcționarea" deschide o oprire la raportare și o închide la rezolvare;
--    din el se calculează disponibilitatea și MTTR, nu din `oprire_minute`.
--    `equipment.status` NU se schimbă automat: garda ISCIR rulează la orice
--    UPDATE pe `equipment` și ar fi putut refuza o sesizare legitimă din cauza
--    unui responsabil cu autorizația expirată. „Oprit" se DERIVĂ din jurnal.
-- 6. Notificări în aplicație, din triggere (tiparul 0046): sesizare nouă →
--    responsabilii de mentenanță (setări, altfel toți `org_admin`) și
--    responsabilul echipamentului; atribuire → tehnicianul; schimbare de stare →
--    raportorul; comentariu → cealaltă parte.
-- 7. `maintenance_settings`: responsabilii, RSVTI, pragurile, închiderea
--    automată, programul de funcționare (pentru disponibilitate).
--
-- ── REGULI RESPECTATE ───────────────────────────────────────────────────────
-- Politicile existente se recreează INTEGRAL (USING și WITH CHECK), nu se
-- „extind": un WITH CHECK rămas vechi ar face UPDATE-ul raportorului să întoarcă
-- zero rânduri, fără eroare (capcana #17). Gărzile încep cu
-- `app.is_service_context()` (0150:313): jobul `pg_cron` și clientul admin nu
-- sunt „raportor" și nici „tehnician". Valorile noi de enum stau în PRIMA
-- tranzacție (precedentul 0064/0115/0128): în aceeași tranzacție cu folosirea
-- lor, Postgres le refuză.

-- ============================================================
-- 0. Valorile noi de enum — tranzacție proprie
-- ============================================================
begin;
alter type public.fault_status add value if not exists 'in_asteptare' after 'in_lucru';
alter type public.fault_status add value if not exists 'inchis' after 'rezolvat';
alter type public.fault_status add value if not exists 'retrasa';
alter type public.maintenance_kind add value if not exists 'verificare_legala';
commit;

begin;

-- ============================================================
-- 1. Coloane noi pe tabelele existente
-- ============================================================
alter table public.fault_reports
  add column if not exists numar                 text,
  add column if not exists atribuit_employee_id  uuid references public.employees (id) on delete set null,
  add column if not exists atribuit_la           timestamptz,
  add column if not exists inchis_la             timestamptz,
  add column if not exists redeschisa_de_ori     integer not null default 0,
  add column if not exists motiv_redeschidere    text,
  add column if not exists duplicat_al_id        uuid references public.fault_reports (id) on delete set null,
  add column if not exists motiv_respingere_tip  text,
  -- Cine a raportat, când n-are fișă de angajat (patronul, contabilul extern cu
  -- rol de administrator). Fără FK, ca `created_by`: urmă de audit, nu referință.
  add column if not exists raportat_de_user_id   uuid,
  add column if not exists nota_rezolvare        text;

alter table public.fault_reports
  drop constraint if exists fault_reports_redeschisa_ck,
  add constraint fault_reports_redeschisa_ck check (redeschisa_de_ori >= 0),
  drop constraint if exists fault_reports_motiv_respingere_tip_ck,
  add constraint fault_reports_motiv_respingere_tip_ck check (
    motiv_respingere_tip is null or motiv_respingere_tip in (
      'informatii_insuficiente', 'nu_tine_de_mentenanta', 'duplicat', 'prioritate_scazuta', 'altul')),
  drop constraint if exists fault_reports_duplicat_ck,
  add constraint fault_reports_duplicat_ck check (duplicat_al_id is null or duplicat_al_id <> id),
  drop constraint if exists fault_reports_nota_rezolvare_ck,
  add constraint fault_reports_nota_rezolvare_ck check (nota_rezolvare is null or char_length(nota_rezolvare) <= 2000);

create index if not exists fault_reports_atribuit_idx
  on public.fault_reports (organization_id, atribuit_employee_id, status) where deleted_at is null;

-- O sesizare poate avea mai multe intervenții (una parțială, apoi cea reușită);
-- `fault_reports.intervention_id` rămâne „cea care a rezolvat-o".
alter table public.maintenance_interventions
  add column if not exists fault_report_id uuid references public.fault_reports (id) on delete set null;
create index if not exists maintenance_interventions_sesizare_idx
  on public.maintenance_interventions (organization_id, fault_report_id) where deleted_at is null;

-- ============================================================
-- 2. Tabele noi
-- ============================================================
create table if not exists public.fault_report_comments (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete restrict,
  fault_report_id    uuid not null references public.fault_reports (id) on delete restrict,
  autor_employee_id  uuid references public.employees (id) on delete set null,
  -- Autorul fără fișă de angajat (administrator), ca la `raportat_de_user_id`.
  autor_user_id      uuid,
  continut           text not null,
  -- `true` = notă internă, invizibilă raportorului. Separarea e la nivel de
  -- rând și e aplicată în RLS, nu doar în interfață.
  intern             boolean not null default false,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  deleted_at         timestamptz,
  constraint fault_report_comments_continut_ck check (char_length(btrim(continut)) between 1 and 4000)
);
create index if not exists fault_report_comments_sesizare_idx
  on public.fault_report_comments (fault_report_id, created_at) where deleted_at is null;
create index if not exists fault_report_comments_org_idx
  on public.fault_report_comments (organization_id) where deleted_at is null;

-- Istoric imutabil: fără UPDATE, fără DELETE, fără `deleted_at`. Auditul generic
-- din `audit_logs` rămâne; acesta e cel AFIȘAT pe sesizare, scris de gardă.
create table if not exists public.fault_report_history (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  fault_report_id  uuid not null references public.fault_reports (id) on delete restrict,
  actor_user_id    uuid,
  camp             text not null,
  valoare_veche    text,
  valoare_noua     text,
  motiv            text,
  created_at       timestamptz not null default now(),
  constraint fault_report_history_camp_ck check (camp ~ '^[a-z][a-z0-9_]{1,40}$')
);
create index if not exists fault_report_history_sesizare_idx
  on public.fault_report_history (fault_report_id, created_at);
create index if not exists fault_report_history_org_idx
  on public.fault_report_history (organization_id);

-- Atașamente GENERICE: o singură tabelă pentru poze pe sesizare, documente pe
-- echipament, PV/buletin pe intervenție, scan pe autorizație. Fișierul stă în
-- bucketul privat `org-mentenanta`, pe calea `{org}/{entity_type}/{entity_id}/…`;
-- în tabel se ține doar calea, niciodată conținutul.
create table if not exists public.maintenance_attachments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  entity_type      text not null,
  entity_id        uuid not null,
  storage_path     text not null,
  denumire         text not null,
  tip              text not null default 'altele',
  mime             text,
  marime_bytes     bigint,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  deleted_at       timestamptz,
  constraint maintenance_attachments_entity_ck check (
    entity_type in ('fault_report', 'equipment', 'intervention', 'iscir_authorization')),
  constraint maintenance_attachments_tip_ck check (tip in (
    'foto', 'carte_tehnica', 'certificat_ce', 'manual', 'contract', 'autorizatie', 'pv',
    'buletin', 'factura', 'altele')),
  constraint maintenance_attachments_path_ck check (char_length(storage_path) between 3 and 400),
  constraint maintenance_attachments_denumire_ck check (char_length(btrim(denumire)) between 1 and 200),
  constraint maintenance_attachments_marime_ck check (marime_bytes is null or marime_bytes > 0)
);
create unique index if not exists maintenance_attachments_path_uq
  on public.maintenance_attachments (storage_path) where deleted_at is null;
create index if not exists maintenance_attachments_entitate_idx
  on public.maintenance_attachments (organization_id, entity_type, entity_id) where deleted_at is null;

-- Jurnalul de opriri: sursa disponibilității. `tip` spune DE CE a stat utilajul:
-- neplanificat (defecțiune), planificat (revizie), legal (autorizație expirată,
-- PV respins). O oprire deschisă are `sfarsit` null.
create table if not exists public.equipment_opriri (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  equipment_id     uuid not null references public.equipment (id) on delete restrict,
  inceput          timestamptz not null,
  sfarsit          timestamptz,
  tip              text not null default 'neplanificata',
  motiv            text,
  fault_report_id  uuid references public.fault_reports (id) on delete set null,
  intervention_id  uuid references public.maintenance_interventions (id) on delete set null,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  deleted_at       timestamptz,
  constraint equipment_opriri_tip_ck check (tip in ('neplanificata', 'planificata', 'legala')),
  constraint equipment_opriri_interval_ck check (sfarsit is null or sfarsit >= inceput),
  constraint equipment_opriri_motiv_ck check (motiv is null or char_length(motiv) <= 500)
);
create index if not exists equipment_opriri_echipament_idx
  on public.equipment_opriri (organization_id, equipment_id, inceput desc) where deleted_at is null;
create index if not exists equipment_opriri_deschise_idx
  on public.equipment_opriri (organization_id, equipment_id) where deleted_at is null and sfarsit is null;
create index if not exists equipment_opriri_sesizare_idx
  on public.equipment_opriri (fault_report_id) where deleted_at is null;

-- Setările modulului, un rând per organizație. Lipsa rândului = implicitele
-- scrise aici în `default`; codul le citește cu `coalesce` prin `setariMentenanta`.
create table if not exists public.maintenance_settings (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references public.organizations (id) on delete restrict,
  -- Fișele de angajat care primesc sesizările noi și alertele. Gol = toți org_admin.
  responsabili              uuid[] not null default '{}',
  rsvti_employee_id         uuid references public.employees (id) on delete set null,
  inchidere_automata_zile   integer not null default 5,
  prag_avertizare_zile      integer not null default 15,
  prag_contor_necitit_zile  integer not null default 30,
  ore_functionare_pe_zi     numeric(4,1) not null default 8,
  zile_pe_saptamana         smallint not null default 5,
  cost_ora_oprire           numeric(12,2),
  created_at                timestamptz not null default now(),
  created_by                uuid,
  updated_at                timestamptz not null default now(),
  updated_by                uuid,
  deleted_at                timestamptz,
  constraint maintenance_settings_inchidere_ck check (inchidere_automata_zile between 1 and 90),
  constraint maintenance_settings_prag_zile_ck check (prag_avertizare_zile between 1 and 365),
  constraint maintenance_settings_prag_contor_ck check (prag_contor_necitit_zile between 1 and 365),
  constraint maintenance_settings_ore_ck check (ore_functionare_pe_zi > 0 and ore_functionare_pe_zi <= 24),
  constraint maintenance_settings_zile_ck check (zile_pe_saptamana between 1 and 7),
  constraint maintenance_settings_cost_ck check (cost_ora_oprire is null or cost_ora_oprire >= 0)
);
create unique index if not exists maintenance_settings_org_uq
  on public.maintenance_settings (organization_id) where deleted_at is null;

-- ============================================================
-- 3. Funcții de vizibilitate (oglinda politicilor, pentru tabelele-copil)
-- ============================================================
-- SECURITY DEFINER fiindcă citesc `fault_reports`, care e sub RLS: sub invoker
-- ar întoarce fals exact pentru cine are dreptul prin ramura verificată.
-- Condiția e ACEEAȘI cu `fault_reports_select` de mai jos; dacă una se schimbă,
-- se schimbă amândouă.
create or replace function app.mentenanta_vede_sesizarea(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.fault_reports fr
     where fr.id = p_id
       and fr.deleted_at is null
       and (
         app.is_platform_admin()
         or (
           fr.organization_id = any ((select app.current_org_ids())::uuid[])
           and app.feature_on(fr.organization_id, 'maintenance')
           and (
             app.ssm_acces(fr.organization_id, 'maintenance', 'read', fr.raportat_de_employee_id)
             or fr.atribuit_employee_id = app.fisa_mea(fr.organization_id)
           )
         )
       )
  );
$$;

-- Cine poate CITI sau SCRIE un atașament, după părinte. `p_actiune` ∈ read|update.
create or replace function app.mentenanta_poate_atasament(
  p_org uuid, p_tip text, p_id uuid, p_actiune text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eu uuid;
begin
  if p_org is null or p_id is null then return false; end if;
  if not (app.is_platform_admin() or p_org = any ((select app.current_org_ids())::uuid[])) then
    return false;
  end if;
  if not app.feature_on(p_org, 'maintenance') then return false; end if;

  if p_tip = 'fault_report' then
    if not app.mentenanta_vede_sesizarea(p_id) then return false; end if;
    if p_actiune = 'read' then return true; end if;
    v_eu := app.fisa_mea(p_org);
    return app.ssm_acces(p_org, 'maintenance', 'update', null)
        or exists (
          select 1 from public.fault_reports fr
           where fr.id = p_id and fr.organization_id = p_org and fr.deleted_at is null
             and v_eu is not null
             and (fr.raportat_de_employee_id = v_eu or fr.atribuit_employee_id = v_eu));
  end if;

  -- Catalogul: documente pe echipament, PV pe intervenție, scan pe autorizație.
  -- Entitatea trebuie să existe ÎN organizația din cale — altfel o cale cu id-ul
  -- altei firme ar trece pe drepturile apelantului din firma lui.
  if p_tip = 'equipment' then
    if not exists (select 1 from public.equipment e where e.id = p_id and e.organization_id = p_org) then
      return false;
    end if;
  elsif p_tip = 'intervention' then
    if not exists (select 1 from public.maintenance_interventions i where i.id = p_id and i.organization_id = p_org) then
      return false;
    end if;
  elsif p_tip = 'iscir_authorization' then
    if not exists (select 1 from public.iscir_authorizations a where a.id = p_id and a.organization_id = p_org) then
      return false;
    end if;
  else
    return false;
  end if;

  return case p_actiune
    when 'read' then app.ssm_acces(p_org, 'maintenance', 'read', null)
    else app.ssm_acces(p_org, 'maintenance', 'update', null)
  end;
end;
$$;

-- Poarta bucketului: `{org}/{entity_type}/{entity_id}/{fisier}`. Segmentele se
-- validează ÎNAINTE de cast: un `::uuid` pe un segment stricat ar ridica 22P02
-- din interiorul politicii, adică eroare de server, nu refuz.
create or replace function app.mentenanta_poate_fisier(p_name text, p_actiune text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org  uuid := app.path_org(p_name);
  v_tip  text := app.path_segment(p_name, 2);
  v_id   text := app.path_segment(p_name, 3);
begin
  if v_org is null or v_tip is null or v_id is null or app.path_segment(p_name, 4) is null then
    return false;
  end if;
  if v_tip not in ('fault_report', 'equipment', 'intervention', 'iscir_authorization') then
    return false;
  end if;
  if v_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return app.mentenanta_poate_atasament(v_org, v_tip, v_id::uuid, p_actiune);
end;
$$;

-- Destinatarii alertelor și ai sesizărilor noi: fișele din setări, sau — fără
-- setări — toți administratorii activi ai organizației. Întoarce utilizatori.
create or replace function internal.mentenanta_responsabili(p_org uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with setari as (
    select s.responsabili
      from public.maintenance_settings s
     where s.organization_id = p_org and s.deleted_at is null
     limit 1
  ),
  din_setari as (
    select e.user_id
      from setari s
      cross join lateral unnest(s.responsabili) as r(employee_id)
      join public.employees e on e.id = r.employee_id
     where e.organization_id = p_org and e.deleted_at is null and e.user_id is not null
  )
  select user_id from din_setari
  union
  select m.user_id
    from public.organization_members m
   where m.organization_id = p_org and m.role = 'org_admin' and m.status = 'active'
     and not exists (select 1 from din_setari);
$$;

-- O notificare, fără dubluri către cel care tocmai a făcut gestul.
create or replace function internal.mentenanta_notifica(
  p_org uuid, p_user uuid, p_kind public.notification_kind,
  p_title text, p_body text, p_link text, p_entity_type text, p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user is null then return; end if;
  if auth.uid() is not null and p_user = auth.uid() then return; end if;
  insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
  values (p_user, p_org, p_kind, left(p_title, 200), left(p_body, 4000), p_link, p_entity_type, p_entity_id);
end;
$$;

-- ============================================================
-- 4. Numerotarea `SZ-2026-0001`
-- ============================================================
create or replace function internal.aloca_numar_sesizare(p_org uuid, p_an integer)
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
  values (p_org, 'sesizare', p_an, 'SZ', 2, 4)
  on conflict (organization_id, document_type, year) do update
    set next_number = public.document_sequences.next_number + 1,
        updated_at  = now()
  returning next_number - 1, prefix, padding
       into v_numar, v_prefix, v_padding;
  return coalesce(nullif(v_prefix, ''), 'SZ') || '-' || p_an::text || '-' || lpad(v_numar::text, v_padding, '0');
end;
$$;

-- `default ''` pe coloană, nu `null`: tipul generat pentru `Insert` cere o
-- coloană `not null` fără default, deși numărul îl scrie triggerul de mai jos
-- (capcana #29, în sens invers). Șirul gol înseamnă „alocă”.
create or replace function internal.fault_reports_numar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Numărul îl dă ÎNTOTDEAUNA baza: un client nu-și alege numărul (ar putea
  -- „rezerva” SZ-2026-0001 sau sări peste secvență). Doar contextul de serviciu
  -- (backfill, import) poate aduce unul gata făcut.
  if not app.is_service_context() or coalesce(new.numar, '') = '' then
    new.numar := internal.aloca_numar_sesizare(
      new.organization_id,
      extract(year from (coalesce(new.raportat_la, now()) at time zone 'Europe/Bucharest'))::integer);
  end if;
  return new;
end;
$$;

-- Rândurile existente primesc numere în ordinea raportării. Triggerele de
-- utilizator se opresc pe durata umplerii: altfel fiecare rând ar primi un rând
-- de audit „update" fără ca cineva să fi schimbat ceva, iar `set_actor` ar pune
-- `updated_by = null` sub psql.
do $$
declare r record;
begin
  alter table public.fault_reports disable trigger user;
  for r in
    select id, organization_id, raportat_la
      from public.fault_reports
     where numar is null
     order by organization_id, raportat_la, id
  loop
    update public.fault_reports
       set numar = internal.aloca_numar_sesizare(
             r.organization_id,
             extract(year from (r.raportat_la at time zone 'Europe/Bucharest'))::integer)
     where id = r.id;
  end loop;
  alter table public.fault_reports enable trigger user;
end $$;

alter table public.fault_reports alter column numar set not null;
alter table public.fault_reports alter column numar set default '';
alter table public.fault_reports
  drop constraint if exists fault_reports_numar_ck,
  add constraint fault_reports_numar_ck check (numar ~ '^[A-Z]{2,16}-[0-9]{4}-[0-9]{1,12}$');
create unique index if not exists fault_reports_numar_uq
  on public.fault_reports (organization_id, numar) where deleted_at is null;

create trigger fault_reports_numar
  before insert on public.fault_reports
  for each row execute function internal.fault_reports_numar();

-- ============================================================
-- 5. Garda: mașina de stări și drepturile nominale
-- ============================================================
-- Înlocuiește `ssm_fault_guard` (0011:753). Tranzițiile se validează pentru
-- ORICINE; cine poate schimba CE se verifică doar în afara contextului de
-- serviciu (jobul de închidere automată, clientul admin al acțiunilor).
create or replace function internal.fault_reports_garda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_serviciu   boolean := app.is_service_context();
  v_gestionar  boolean := false;
  v_eu         uuid;
  v_raportor   boolean := false;
  v_tehnician  boolean := false;
  v_schimbate  text[];
  v_permise    text[];
  v_strain     text;
  v_permis     boolean;
begin
  -- ── Referințele rămân în FIRMĂ (INSERT și UPDATE) ───────────────────────
  -- Cheile străine simple (`references employees (id)`) nu știu de organizație:
  -- fără verificările astea, un client ar putea atribui sesizarea fișei unui
  -- angajat din altă firmă (și i-ar trimite notificarea), ar lega-o de utilajul
  -- altei firme sau ar marca-o duplicat al unei sesizări străine.
  if (tg_op = 'INSERT' or new.equipment_id is distinct from old.equipment_id)
     and not exists (select 1 from public.equipment q
                      where q.id = new.equipment_id and q.organization_id = new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Echipamentul nu aparține organizației.';
  end if;
  if new.raportat_de_employee_id is not null
     and (tg_op = 'INSERT' or new.raportat_de_employee_id is distinct from old.raportat_de_employee_id)
     and not exists (select 1 from public.employees e
                      where e.id = new.raportat_de_employee_id and e.organization_id = new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Raportorul nu aparține organizației.';
  end if;
  if new.atribuit_employee_id is not null
     and (tg_op = 'INSERT' or new.atribuit_employee_id is distinct from old.atribuit_employee_id)
     and not exists (select 1 from public.employees e
                      where e.id = new.atribuit_employee_id
                        and e.organization_id = new.organization_id
                        and e.deleted_at is null) then
    raise exception using errcode = 'P0001',
      message = 'Tehnicianul ales nu aparține organizației sau nu mai are fișă activă.';
  end if;
  if new.duplicat_al_id is not null
     and (tg_op = 'INSERT' or new.duplicat_al_id is distinct from old.duplicat_al_id)
     and not exists (select 1 from public.fault_reports d
                      where d.id = new.duplicat_al_id
                        and d.organization_id = new.organization_id
                        and d.id <> new.id) then
    raise exception using errcode = 'P0001',
      message = 'Sesizarea originală nu aparține organizației.';
  end if;

  -- ── INSERT: o sesizare se naște „nou", fără atribuire și fără rezolvare ──
  if tg_op = 'INSERT' then
    if not v_serviciu then
      if new.status <> 'nou' then
        raise exception using errcode = 'P0001',
          message = 'O sesizare nouă pornește întotdeauna din starea „nouă”.';
      end if;
      if new.intervention_id is not null or new.rezolvat_la is not null or new.inchis_la is not null then
        raise exception using errcode = 'P0001',
          message = 'O sesizare nouă nu poate fi deja rezolvată sau închisă.';
      end if;
      if new.atribuit_employee_id is not null
         and not app.ssm_acces(new.organization_id, 'maintenance', 'update', null) then
        raise exception using errcode = 'P0001',
          message = 'Doar responsabilii de mentenanță pot atribui o sesizare.';
      end if;
      -- Coloanele „de sistem” nu se primesc de la client: momentul raportării e
      -- acum, contul raportorului e cel autentificat, contorul de redeschideri
      -- pornește de la zero. Numărul îl pune triggerul de numerotare.
      new.raportat_la := now();
      new.raportat_de_user_id := auth.uid();
      new.redeschisa_de_ori := 0;
      new.motiv_redeschidere := null;
      -- Câmpurile altor etape ale fluxului nu se completează la naștere.
      new.nota_rezolvare := null;
      new.motiv_respingere := null;
      new.motiv_respingere_tip := null;
      new.duplicat_al_id := null;
      new.atribuit_la := null;
    end if;
    if new.atribuit_employee_id is not null and new.atribuit_la is null then
      new.atribuit_la := now();
    end if;
    return new;
  end if;

  -- ── UPDATE ──────────────────────────────────────────────────────────────
  -- Ștergerea logică trece prin politica de UPDATE, care acum deschide ușa și
  -- raportorului și tehnicianului. Ei NU șterg: raportorul își RETRAGE
  -- sesizarea (rămâne în evidență), tehnicianul n-are ce căuta aici. Fără
  -- verificarea asta, ramura ar fi fost o poartă deschisă („fail-open").
  if new.deleted_at is not null and old.deleted_at is null then
    if not (v_serviciu or app.is_platform_admin()
            or app.ssm_acces(new.organization_id, 'maintenance', 'update', null)) then
      raise exception using errcode = 'P0001',
        message = 'Nu aveți dreptul de a șterge această sesizare.';
    end if;
    return new;
  end if;

  -- 0. Cine apasă. Actorii NOMINALI (raportor, tehnician) nu primesc coloanele
  --    scrise de triggere: se fixează la valoarea veche și le recalculează
  --    tranziția de mai jos. Fără asta, cineva ar fi putut trimite
  --    `rezolvat_la` din 2019 sau `redeschisa_de_ori = 0`, iar lista de
  --    excepții de la pasul 2 le-ar fi lăsat să treacă.
  if not v_serviciu then
    v_gestionar := app.is_platform_admin()
                   or app.ssm_acces(new.organization_id, 'maintenance', 'update', null);
    if not v_gestionar then
      new.rezolvat_la          := old.rezolvat_la;
      new.inchis_la            := old.inchis_la;
      new.atribuit_la          := old.atribuit_la;
      new.redeschisa_de_ori    := old.redeschisa_de_ori;
      new.motiv_respingere_tip := old.motiv_respingere_tip;
      new.raportat_de_user_id  := old.raportat_de_user_id;
      new.raportat_la          := old.raportat_la;
      new.numar                := old.numar;
    end if;
  end if;

  -- 0b. Intervenția trebuie să fie A ACESTEI sesizări: aceeași firmă, același
  --     echipament, legată de ea (sau nelegată încă — rândurile dinainte de
  --     0181). Se verifică ORICÂND se schimbă și, din nou, la intrarea în
  --     „rezolvat” — altfel s-ar putea agăța mai devreme, pe altă tranziție,
  --     și ar trece neverificată la rezolvare.
  if new.intervention_id is not null
     and (new.intervention_id is distinct from old.intervention_id
          or (new.status = 'rezolvat' and old.status is distinct from 'rezolvat'))
     and not exists (
       select 1 from public.maintenance_interventions mi
        where mi.id = new.intervention_id
          and mi.organization_id = new.organization_id
          and mi.equipment_id = new.equipment_id
          and mi.deleted_at is null
          and (mi.fault_report_id is null or mi.fault_report_id = new.id)) then
    raise exception using errcode = 'P0001',
      message = 'Intervenția aleasă nu aparține acestei sesizări.';
  end if;

  -- 1. Tranziția de stare, pentru toată lumea.
  if new.status is distinct from old.status then
    v_permis := case old.status
      when 'nou'          then new.status in ('in_analiza', 'in_lucru', 'respins', 'retrasa')
      when 'in_analiza'   then new.status in ('in_lucru', 'in_asteptare', 'respins', 'retrasa')
      when 'in_lucru'     then new.status in ('rezolvat', 'in_asteptare', 'in_analiza')
      when 'in_asteptare' then new.status in ('in_lucru', 'respins')
      when 'rezolvat'     then new.status in ('inchis', 'in_lucru')
      else false
    end;
    if not v_permis then
      raise exception using errcode = 'P0001',
        message = format('Sesizarea nu poate trece din „%s” în „%s”.', old.status, new.status);
    end if;

    if new.status = 'in_lucru' and new.atribuit_employee_id is null then
      raise exception using errcode = 'P0001',
        message = 'Atribuiți sesizarea unui tehnician înainte de a o trece în lucru.';
    end if;
    if new.status = 'rezolvat' and new.intervention_id is null then
      raise exception using errcode = 'P0001',
        message = 'O sesizare nu poate fi marcată rezolvată fără intervenția de mentenanță care a rezolvat-o.';
    end if;
    if new.status = 'respins' then
      if coalesce(length(btrim(new.motiv_respingere)), 0) < 5 then
        raise exception using errcode = 'P0001', message = 'Respingerea unei sesizări cere un motiv scris.';
      end if;
      new.motiv_respingere_tip := coalesce(new.motiv_respingere_tip, 'altul');
      if new.motiv_respingere_tip = 'duplicat' and new.duplicat_al_id is null then
        raise exception using errcode = 'P0001',
          message = 'Respingerea ca duplicat cere sesizarea originală.';
      end if;
    end if;
    if old.status = 'rezolvat' and new.status = 'in_lucru' then
      -- Motiv NOU, nu cel rămas pe rând de la redeschiderea anterioară.
      if coalesce(length(btrim(new.motiv_redeschidere)), 0) < 5
         or new.motiv_redeschidere is not distinct from old.motiv_redeschidere then
        raise exception using errcode = 'P0001',
          message = 'Redeschiderea unei sesizări rezolvate cere un motiv scris.';
      end if;
      new.intervention_id := null;
      new.rezolvat_la := null;
      new.redeschisa_de_ori := old.redeschisa_de_ori + 1;
    end if;
    if new.status = 'rezolvat' and new.rezolvat_la is null then new.rezolvat_la := now(); end if;
    if new.status = 'inchis' and new.inchis_la is null then new.inchis_la := now(); end if;
  end if;

  if new.atribuit_employee_id is distinct from old.atribuit_employee_id then
    new.atribuit_la := case when new.atribuit_employee_id is null then null else now() end;
  end if;

  -- 2. Drepturile nominale, doar pentru oameni (`v_gestionar` e calculat la 0).
  if not v_serviciu then
    if not v_gestionar then
      v_eu := app.fisa_mea(new.organization_id);
      v_raportor := v_eu is not null and v_eu = old.raportat_de_employee_id;
      v_tehnician := v_eu is not null and v_eu = old.atribuit_employee_id;

      -- Ce s-a schimbat, fără coloanele scrise de triggere.
      select coalesce(array_agg(n.key), '{}') into v_schimbate
        from jsonb_each(to_jsonb(new)) n
       where n.key not in ('updated_at', 'updated_by', 'rezolvat_la', 'inchis_la', 'atribuit_la',
                           'redeschisa_de_ori', 'motiv_respingere_tip')
         and n.value is distinct from (to_jsonb(old) -> n.key);

      v_permise := '{}';
      if v_raportor then
        -- Raportorul își completează sesizarea cât e „nouă", o retrage, confirmă
        -- ori contestă rezolvarea.
        if old.status = 'nou' then v_permise := v_permise || array['descriere', 'urgenta']; end if;
        if (old.status in ('nou', 'in_analiza') and new.status = 'retrasa')
           or (old.status = 'rezolvat' and new.status in ('inchis', 'in_lucru')) then
          v_permise := v_permise || array['status', 'motiv_redeschidere'];
        end if;
        -- La redeschidere, garda însăși golește `intervention_id` (pasul 1);
        -- fără excepția asta, propria scriere a gărzii ar fi „câmp străin”.
        if old.status = 'rezolvat' and new.status = 'in_lucru' then
          v_permise := v_permise || array['intervention_id'];
        end if;
      end if;
      if v_tehnician then
        -- Tehnicianul lucrează sesizarea LUI: o începe (din nouă sau din analiză,
        -- odată ce i-a fost atribuită), o pune în așteptare și o reia, o rezolvă.
        if (old.status in ('nou', 'in_analiza', 'in_asteptare') and new.status = 'in_lucru')
           or (old.status = 'in_lucru' and new.status in ('in_asteptare', 'rezolvat')) then
          v_permise := v_permise || array['status', 'nota_rezolvare'];
        end if;
        -- Intervenția se leagă DOAR la rezolvare, nu se agață dinainte.
        if old.status = 'in_lucru' and new.status = 'rezolvat' then
          v_permise := v_permise || array['intervention_id'];
        end if;
        if new.status is not distinct from old.status and old.status in ('in_lucru', 'in_asteptare') then
          v_permise := v_permise || array['nota_rezolvare'];
        end if;
      end if;

      select min(c) into v_strain from unnest(v_schimbate) c where not (c = any (v_permise));
      if v_strain is not null then
        if not (v_raportor or v_tehnician) then
          raise exception using errcode = 'P0001',
            message = 'Nu aveți dreptul de a modifica această sesizare.';
        end if;
        raise exception using errcode = 'P0001',
          message = format('Nu aveți dreptul de a modifica acest câmp al sesizării (%s).', v_strain);
      end if;
    end if;
  end if;

  -- 3. Istoricul afișat pe sesizare.
  if new.status is distinct from old.status then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua, motiv)
    values (new.organization_id, new.id, auth.uid(), 'status', old.status::text, new.status::text,
            case
              when new.status = 'respins' then new.motiv_respingere
              when old.status = 'rezolvat' and new.status = 'in_lucru' then new.motiv_redeschidere
              when new.status = 'inchis' and v_serviciu then 'Închisă automat, fără obiecții din partea raportorului.'
              else null
            end);
  end if;
  if new.atribuit_employee_id is distinct from old.atribuit_employee_id then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua)
    values (new.organization_id, new.id, auth.uid(), 'atribuit_employee_id',
            old.atribuit_employee_id::text, new.atribuit_employee_id::text);
  end if;
  if new.urgenta is distinct from old.urgenta then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua)
    values (new.organization_id, new.id, auth.uid(), 'urgenta', old.urgenta::text, new.urgenta::text);
  end if;
  if new.equipment_id is distinct from old.equipment_id then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua)
    values (new.organization_id, new.id, auth.uid(), 'equipment_id', old.equipment_id::text, new.equipment_id::text);
  end if;
  if new.duplicat_al_id is distinct from old.duplicat_al_id and new.duplicat_al_id is not null then
    insert into public.fault_report_history (organization_id, fault_report_id, actor_user_id, camp, valoare_veche, valoare_noua)
    values (new.organization_id, new.id, auth.uid(), 'duplicat_al_id', null, new.duplicat_al_id::text);
  end if;

  return new;
end;
$$;

drop trigger if exists fault_reports_guard on public.fault_reports;
create trigger fault_reports_garda
  before insert or update on public.fault_reports
  for each row execute function internal.fault_reports_garda();

-- ============================================================
-- 6. Notificările
-- ============================================================
create or replace function internal.fault_reports_notifica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link       text := '/mentenanta/sesizari/' || new.id::text;
  v_echip      record;
  v_raportor   uuid;
  v_tehnician  uuid;
  v_user       uuid;
begin
  if new.deleted_at is not null then return null; end if;

  select e.cod, e.denumire, e.responsabil_employee_id into v_echip
    from public.equipment e where e.id = new.equipment_id;
  select e.user_id into v_raportor from public.employees e
   where e.id = new.raportat_de_employee_id and e.organization_id = new.organization_id;
  v_raportor := coalesce(v_raportor, new.raportat_de_user_id);

  if tg_op = 'INSERT' then
    for v_user in
      select r.user_id from internal.mentenanta_responsabili(new.organization_id) r
      union
      select e.user_id from public.employees e
       where e.id = v_echip.responsabil_employee_id and e.deleted_at is null and e.user_id is not null
    loop
      perform internal.mentenanta_notifica(
        new.organization_id, v_user, 'task',
        'Sesizare nouă ' || new.numar || ': ' || coalesce(v_echip.cod, '?'),
        coalesce(v_echip.denumire, '') || case when new.opreste_functionarea then ' — utilajul e OPRIT. ' else '. ' end
          || left(new.descriere, 300),
        v_link, 'fault_report', new.id);
    end loop;
    return null;
  end if;

  -- Atribuire → tehnicianul.
  if new.atribuit_employee_id is distinct from old.atribuit_employee_id and new.atribuit_employee_id is not null then
    select e.user_id into v_tehnician from public.employees e
     where e.id = new.atribuit_employee_id and e.organization_id = new.organization_id;
    perform internal.mentenanta_notifica(
      new.organization_id, v_tehnician, 'task',
      'Sesizare atribuită: ' || new.numar,
      coalesce(v_echip.cod || ' — ' || v_echip.denumire || '. ', '') || left(new.descriere, 300),
      v_link, 'fault_report', new.id);
  end if;

  -- Schimbare de stare → raportorul, care altfel n-are de unde ști.
  if new.status is distinct from old.status then
    perform internal.mentenanta_notifica(
      new.organization_id, v_raportor,
      case new.status
        when 'rezolvat' then 'success'::public.notification_kind
        when 'respins'  then 'warning'::public.notification_kind
        when 'inchis'   then 'info'::public.notification_kind
        else 'info'::public.notification_kind
      end,
      'Sesizarea ' || new.numar || ': ' ||
        case new.status
          when 'in_analiza'   then 'în analiză'
          when 'in_lucru'     then 'în lucru'
          when 'in_asteptare' then 'în așteptare'
          when 'rezolvat'     then 'rezolvată — confirmați sau redeschideți'
          when 'respins'      then 'respinsă'
          when 'inchis'       then 'închisă'
          when 'retrasa'      then 'retrasă'
          else new.status::text
        end,
      case
        when new.status = 'respins' then coalesce(new.motiv_respingere, left(new.descriere, 300))
        when new.status = 'rezolvat' then coalesce(new.nota_rezolvare, 'Intervenția a fost înregistrată. Dacă defecțiunea persistă, redeschideți sesizarea.')
        else coalesce(v_echip.cod || ' — ' || v_echip.denumire, left(new.descriere, 300))
      end,
      v_link, 'fault_report', new.id);
  end if;

  return null;
end;
$$;

create trigger fault_reports_notifica
  after insert or update on public.fault_reports
  for each row execute function internal.fault_reports_notifica();

create or replace function internal.fault_report_comments_notifica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s          record;
  v_raportor   uuid;
  v_tehnician  uuid;
  v_user       uuid;
  v_link       text := '/mentenanta/sesizari/' || new.fault_report_id::text;
  v_titlu      text;
begin
  if new.deleted_at is not null then return null; end if;
  select fr.numar, fr.raportat_de_employee_id, fr.raportat_de_user_id, fr.atribuit_employee_id
    into v_s from public.fault_reports fr where fr.id = new.fault_report_id;
  v_titlu := 'Comentariu nou la ' || coalesce(v_s.numar, 'sesizare');

  select e.user_id into v_raportor from public.employees e
   where e.id = v_s.raportat_de_employee_id and e.organization_id = new.organization_id;
  v_raportor := coalesce(v_raportor, v_s.raportat_de_user_id);
  select e.user_id into v_tehnician from public.employees e
   where e.id = v_s.atribuit_employee_id and e.organization_id = new.organization_id;

  -- Nota internă ajunge DOAR la responsabili (cei care trec de aceeași
  -- verificare ca politica de SELECT) — nu la raportor și nici la tehnician,
  -- care ar citi în notificare un text pe care fișa i-l ascunde.
  if new.intern then
    for v_user in select r.user_id from internal.mentenanta_responsabili(new.organization_id) r loop
      if v_user is distinct from auth.uid() then
        perform internal.mentenanta_notifica(new.organization_id, v_user, 'info', v_titlu,
          left(new.continut, 300), v_link, 'fault_report', new.fault_report_id);
      end if;
    end loop;
    return null;
  end if;

  -- Comentariul raportorului merge la tehnician (sau la responsabili, dacă nu
  -- e atribuită); al oricui altcuiva, la raportor.
  if new.autor_employee_id is not null and new.autor_employee_id = v_s.raportat_de_employee_id then
    if v_tehnician is not null then
      perform internal.mentenanta_notifica(new.organization_id, v_tehnician, 'info', v_titlu,
        left(new.continut, 300), v_link, 'fault_report', new.fault_report_id);
    else
      for v_user in select r.user_id from internal.mentenanta_responsabili(new.organization_id) r loop
        perform internal.mentenanta_notifica(new.organization_id, v_user, 'info', v_titlu,
          left(new.continut, 300), v_link, 'fault_report', new.fault_report_id);
      end loop;
    end if;
  else
    perform internal.mentenanta_notifica(new.organization_id, v_raportor, 'info', v_titlu,
      left(new.continut, 300), v_link, 'fault_report', new.fault_report_id);
  end if;
  return null;
end;
$$;

create trigger fault_report_comments_notifica
  after insert on public.fault_report_comments
  for each row execute function internal.fault_report_comments_notifica();

-- Un comentariu, odată scris, își păstrează părintele, autorul și felul: la
-- UPDATE se schimbă doar textul și ștergerea logică. Altfel autorul și-ar fi
-- putut muta comentariul pe o sesizare pe care n-o vede, sau l-ar fi făcut
-- „intern" după ce politica de INSERT i-a refuzat asta.
create or replace function internal.fault_report_comments_garda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_service_context() then return new; end if;
  if new.fault_report_id is distinct from old.fault_report_id
     or new.organization_id is distinct from old.organization_id
     or new.autor_employee_id is distinct from old.autor_employee_id
     or new.autor_user_id is distinct from old.autor_user_id
     or new.intern is distinct from old.intern
     or new.created_at is distinct from old.created_at then
    raise exception using errcode = 'P0001',
      message = 'Unui comentariu i se poate schimba doar textul.';
  end if;
  return new;
end $$;

drop trigger if exists fault_report_comments_garda on public.fault_report_comments;
create trigger fault_report_comments_garda
  before update on public.fault_report_comments
  for each row execute function internal.fault_report_comments_garda();

-- ============================================================
-- 7. Jurnalul de opriri, legat de sesizare și de intervenție
-- ============================================================
create or replace function internal.fault_reports_oprire()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deschisa boolean := new.status in ('nou', 'in_analiza', 'in_lucru', 'in_asteptare');
begin
  if new.deleted_at is null and new.opreste_functionarea and v_deschisa then
    if not exists (
      select 1 from public.equipment_opriri o
       where o.fault_report_id = new.id and o.sfarsit is null and o.deleted_at is null
    ) then
      insert into public.equipment_opriri (organization_id, equipment_id, inceput, tip, motiv, fault_report_id)
      values (new.organization_id, new.equipment_id, coalesce(new.raportat_la, now()), 'neplanificata',
              'Sesizarea ' || new.numar || ': ' || left(new.descriere, 120), new.id);
    end if;
  else
    update public.equipment_opriri o
       set sfarsit = greatest(o.inceput, coalesce(new.rezolvat_la, now())),
           updated_at = now()
     where o.fault_report_id = new.id and o.sfarsit is null and o.deleted_at is null;
  end if;
  return null;
end;
$$;

create trigger fault_reports_oprire
  after insert or update on public.fault_reports
  for each row execute function internal.fault_reports_oprire();

-- O intervenție cu `oprire_minute` (fără sesizare, deci planificată) își scrie
-- oprirea în jurnal; anularea ei logică o anulează și pe aceea.
create or replace function internal.maintenance_interventions_oprire()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_inceput timestamptz;
begin
  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    update public.equipment_opriri set deleted_at = now(), updated_at = now()
     where intervention_id = new.id and deleted_at is null;
    return null;
  end if;
  if tg_op = 'INSERT' and new.deleted_at is null and new.fault_report_id is null
     and coalesce(new.oprire_minute, 0) > 0 then
    v_inceput := (new.data + coalesce(new.ora_start, time '08:00')) at time zone 'Europe/Bucharest';
    insert into public.equipment_opriri (organization_id, equipment_id, inceput, sfarsit, tip, motiv, intervention_id)
    values (new.organization_id, new.equipment_id, v_inceput,
            v_inceput + make_interval(mins => new.oprire_minute),
            case when new.tip = 'corectiva' then 'neplanificata' else 'planificata' end,
            left(new.descriere, 120), new.id);
  end if;
  return null;
end;
$$;

create trigger maintenance_interventions_oprire
  after insert or update on public.maintenance_interventions
  for each row execute function internal.maintenance_interventions_oprire();

-- ============================================================
-- 8. Închiderea automată (programată în M9, apelabilă și manual)
-- ============================================================
create or replace function internal.sesizari_inchide_rezolvate(p_org uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  with de_inchis as (
    select fr.id
      from public.fault_reports fr
      left join public.maintenance_settings s
        on s.organization_id = fr.organization_id and s.deleted_at is null
     where fr.deleted_at is null
       and fr.status = 'rezolvat'
       and (p_org is null or fr.organization_id = p_org)
       and fr.rezolvat_la < now() - make_interval(days => coalesce(s.inchidere_automata_zile, 5))
  )
  update public.fault_reports fr
     set status = 'inchis'
    from de_inchis d
   where fr.id = d.id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function internal.sesizari_inchide_rezolvate(uuid) from public, anon, authenticated;
grant execute on function internal.sesizari_inchide_rezolvate(uuid) to service_role;

-- ============================================================
-- 9. Bucketul `org-mentenanta` și politicile lui de storage
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-mentenanta', 'org-mentenanta', false, 26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

drop policy if exists mentenanta_objects_select on storage.objects;
create policy mentenanta_objects_select on storage.objects
for select to authenticated
using (bucket_id = 'org-mentenanta' and app.mentenanta_poate_fisier(name, 'read'));

drop policy if exists mentenanta_objects_insert on storage.objects;
create policy mentenanta_objects_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'org-mentenanta'
  and app.mentenanta_poate_fisier(name, 'update')
  and owner = (select auth.uid())
);

-- UPDATE există doar ca încărcarea pe URL semnat să poată rescrie obiectul pe
-- care tot ea l-a creat. Fără DELETE: ștergerea trece prin service_role.
drop policy if exists mentenanta_objects_update on storage.objects;
create policy mentenanta_objects_update on storage.objects
for update to authenticated
using (
  bucket_id = 'org-mentenanta'
  and app.mentenanta_poate_fisier(name, 'update')
  and owner = (select auth.uid())
)
with check (
  bucket_id = 'org-mentenanta'
  and app.mentenanta_poate_fisier(name, 'update')
  and owner = (select auth.uid())
);

-- ============================================================
-- 10. RLS pe tabelele noi
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'fault_report_comments', 'fault_report_history', 'maintenance_attachments',
    'equipment_opriri', 'maintenance_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- comentarii
create policy fault_report_comments_select on public.fault_report_comments
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.mentenanta_vede_sesizarea(fault_report_id)
  and (not intern or app.ssm_acces(organization_id, 'maintenance', 'update', null))
);
create policy fault_report_comments_insert on public.fault_report_comments
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.mentenanta_vede_sesizarea(fault_report_id)
  and (not intern or app.ssm_acces(organization_id, 'maintenance', 'update', null))
  and (
    autor_employee_id = app.fisa_mea(organization_id)
    or (autor_employee_id is null and app.ssm_acces(organization_id, 'maintenance', 'update', null))
  )
  -- Contul autorului e al apelantului, nu unul ales: altfel comentariul apare
  -- semnat de altcineva pe ecranul celui care nu vede fișa autorului.
  and (autor_user_id is null or autor_user_id = (select auth.uid()))
  and deleted_at is null
);
create policy fault_report_comments_update on public.fault_report_comments
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and (
    autor_employee_id = app.fisa_mea(organization_id)
    or app.ssm_acces(organization_id, 'maintenance', 'update', null)
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.mentenanta_vede_sesizarea(fault_report_id)
  and (not intern or app.ssm_acces(organization_id, 'maintenance', 'update', null))
  and (
    autor_employee_id = app.fisa_mea(organization_id)
    or app.ssm_acces(organization_id, 'maintenance', 'update', null)
  )
);

-- istoric: doar citire, prin părinte; scrierea o face garda (definer)
create policy fault_report_history_select on public.fault_report_history
for select to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.mentenanta_vede_sesizarea(fault_report_id)
);

-- atașamente
create policy maintenance_attachments_select on public.maintenance_attachments
for select to authenticated
using (app.mentenanta_poate_atasament(organization_id, entity_type, entity_id, 'read'));
create policy maintenance_attachments_insert on public.maintenance_attachments
for insert to authenticated
with check (
  app.mentenanta_poate_atasament(organization_id, entity_type, entity_id, 'update')
  and created_by = (select auth.uid())
  and deleted_at is null
);
create policy maintenance_attachments_update on public.maintenance_attachments
for update to authenticated
using (
  app.mentenanta_poate_atasament(organization_id, entity_type, entity_id, 'update')
  and (created_by = (select auth.uid()) or app.ssm_acces(organization_id, 'maintenance', 'update', null))
)
with check (
  app.mentenanta_poate_atasament(organization_id, entity_type, entity_id, 'update')
);

-- opriri: le vede cine vede echipamentul (team) sau sesizarea legată; le scrie
-- de mână cine administrează. Rândurile automate le scriu triggerele (definer).
-- Garda opririlor: referințele rămân în firmă, iar tehnicianul (care trece de
-- politica de UPDATE pe oprirea sesizării lui) poate DOAR să o închidă —
-- `sfarsit` pe un rând încă deschis. Fără asta, ramura nominală a politicii îi
-- lăsa orice coloană: începutul, tipul, echipamentul, ștergerea logică.
create or replace function internal.equipment_opriri_garda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.equipment_id is distinct from old.equipment_id)
     and not exists (select 1 from public.equipment q
                      where q.id = new.equipment_id and q.organization_id = new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Echipamentul nu aparține organizației.';
  end if;
  if new.fault_report_id is not null
     and (tg_op = 'INSERT' or new.fault_report_id is distinct from old.fault_report_id)
     and not exists (select 1 from public.fault_reports fr
                      where fr.id = new.fault_report_id and fr.organization_id = new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Sesizarea nu aparține organizației.';
  end if;
  if new.intervention_id is not null
     and (tg_op = 'INSERT' or new.intervention_id is distinct from old.intervention_id)
     and not exists (select 1 from public.maintenance_interventions mi
                      where mi.id = new.intervention_id and mi.organization_id = new.organization_id) then
    raise exception using errcode = 'P0001', message = 'Intervenția nu aparține organizației.';
  end if;

  if tg_op = 'UPDATE'
     and not (app.is_service_context() or app.is_platform_admin()
              or app.ssm_acces(new.organization_id, 'maintenance', 'update', null)) then
    if new.organization_id is distinct from old.organization_id
       or new.equipment_id is distinct from old.equipment_id
       or new.fault_report_id is distinct from old.fault_report_id
       or new.intervention_id is distinct from old.intervention_id
       or new.inceput is distinct from old.inceput
       or new.tip is distinct from old.tip
       or new.motiv is distinct from old.motiv
       or new.deleted_at is distinct from old.deleted_at
       or new.created_at is distinct from old.created_at
       or old.sfarsit is not null then
      raise exception using errcode = 'P0001',
        message = 'Tehnicianul poate doar să închidă oprirea sesizării lui (momentul repunerii în funcțiune).';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists equipment_opriri_garda on public.equipment_opriri;
create trigger equipment_opriri_garda
  before insert or update on public.equipment_opriri
  for each row execute function internal.equipment_opriri_garda();

create policy equipment_opriri_select on public.equipment_opriri
for select to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and (
      app.ssm_acces(organization_id, 'maintenance', 'read', null)
      or (fault_report_id is not null and app.mentenanta_vede_sesizarea(fault_report_id))
    )
  )
);
create policy equipment_opriri_insert on public.equipment_opriri
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.ssm_acces(organization_id, 'maintenance', 'update', null)
  and deleted_at is null
);
create policy equipment_opriri_update on public.equipment_opriri
for update to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and (
      app.ssm_acces(organization_id, 'maintenance', 'update', null)
      -- Tehnicianul închide oprirea sesizării lui („funcționează din nou de la…").
      or (fault_report_id is not null and exists (
            select 1 from public.fault_reports fr
             where fr.id = equipment_opriri.fault_report_id
               and fr.organization_id = equipment_opriri.organization_id
               and fr.atribuit_employee_id = app.fisa_mea(fr.organization_id)))
    )
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and (
    app.ssm_acces(organization_id, 'maintenance', 'update', null)
    or (fault_report_id is not null and exists (
          select 1 from public.fault_reports fr
           where fr.id = equipment_opriri.fault_report_id
             and fr.organization_id = equipment_opriri.organization_id
             and fr.atribuit_employee_id = app.fisa_mea(fr.organization_id)))
  )
);

-- setări: citite de cine vede modulul (team), scrise doar de administratori.
create policy maintenance_settings_select on public.maintenance_settings
for select to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and app.ssm_acces(organization_id, 'maintenance', 'read', null)
  )
);
create policy maintenance_settings_insert on public.maintenance_settings
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.has_permission(organization_id, 'maintenance', 'update') = 'all'
  and deleted_at is null
);
create policy maintenance_settings_update on public.maintenance_settings
for update to authenticated
using (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.has_permission(organization_id, 'maintenance', 'update') = 'all'
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.has_permission(organization_id, 'maintenance', 'update') = 'all'
);

-- actor, audit, updated_at, granturi
do $$
declare t text;
begin
  foreach t in array array[
    'fault_report_comments', 'maintenance_attachments', 'equipment_opriri', 'maintenance_settings']
  loop
    execute format('create trigger %1$s_actor before insert or update on public.%1$I for each row execute function internal.set_actor()', t);
    execute format('create trigger %I before update on public.%I for each row execute function app.set_updated_at()', 'set_updated_at_' || t, t);
    perform internal.attach_audit(t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('revoke delete on public.%I from authenticated', t);
  end loop;
end $$;
grant select on public.fault_report_history to authenticated;

-- ============================================================
-- 11. Politicile existente, recreate integral
-- ============================================================
-- fault_reports: tehnicianul atribuit vede și poate scrie; raportorul poate
-- scrie (garda îi limitează câmpurile). USING ȘI WITH CHECK, amândouă.
drop policy if exists fault_reports_select on public.fault_reports;
create policy fault_reports_select on public.fault_reports
for select to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and (
      app.ssm_acces(organization_id, 'maintenance', 'read', raportat_de_employee_id)
      or atribuit_employee_id = app.fisa_mea(organization_id)
    )
  )
);

drop policy if exists fault_reports_update on public.fault_reports;
create policy fault_reports_update on public.fault_reports
for update to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and (
      app.ssm_acces(organization_id, 'maintenance', 'update', raportat_de_employee_id)
      or raportat_de_employee_id = app.fisa_mea(organization_id)
      or atribuit_employee_id = app.fisa_mea(organization_id)
    )
  )
)
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and (
    app.ssm_acces(organization_id, 'maintenance', 'update', raportat_de_employee_id)
    or raportat_de_employee_id = app.fisa_mea(organization_id)
    or atribuit_employee_id = app.fisa_mea(organization_id)
  )
);

-- equipment: cine are o sesizare vizibilă pe un utilaj îi vede fișa de bază —
-- altfel tehnicianul-angajat nu citea nici denumirea utilajului pe care lucrează
-- (`col = null` cere `team`, 0011:887). Subinterogarea pe `fault_reports` rulează
-- sub politica ei, deci întoarce doar sesizările vizibile apelantului.
drop policy if exists equipment_select on public.equipment;
create policy equipment_select on public.equipment
for select to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and (
      app.ssm_acces(organization_id, 'maintenance', 'read', null)
      -- Doar TEHNICIANUL atribuit citește rândul utilajului de pe sesizarea lui
      -- (are nevoie de el la intervenție). Raportorul primește cod și denumire
      -- prin `cautaEchipament` — rândul întreg ar expune valoarea de achiziție
      -- și derogările oricui depune o sesizare pe orice utilaj.
      or exists (
        select 1 from public.fault_reports fr
         where fr.equipment_id = equipment.id
           and fr.organization_id = equipment.organization_id
           and fr.deleted_at is null
           and fr.atribuit_employee_id = app.fisa_mea(fr.organization_id))
    )
  )
);

-- intervenții: executantul și tehnicianul sesizării le văd; tehnicianul poate
-- înregistra intervenția pe sesizarea LUI.
drop policy if exists maintenance_interventions_select on public.maintenance_interventions;
create policy maintenance_interventions_select on public.maintenance_interventions
for select to authenticated
using (
  app.is_platform_admin() or (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.feature_on(organization_id, 'maintenance')
    and (
      app.ssm_acces(organization_id, 'maintenance', 'read', null)
      or executant_employee_id = app.fisa_mea(organization_id)
      -- Tehnicianul sesizării, nu și raportorul: intervenția poartă costuri și
      -- numele furnizorului, care nu-i sunt destinate celui care a sesizat.
      or (fault_report_id is not null and exists (
            select 1 from public.fault_reports fr
             where fr.id = maintenance_interventions.fault_report_id
               and fr.organization_id = maintenance_interventions.organization_id
               and fr.atribuit_employee_id = app.fisa_mea(fr.organization_id)))
    )
  )
);

drop policy if exists maintenance_interventions_insert on public.maintenance_interventions;
create policy maintenance_interventions_insert on public.maintenance_interventions
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and (
    app.ssm_acces(organization_id, 'maintenance', 'update', null)
    -- Tehnicianul atribuit: doar pe echipamentul sesizării LUI și fără plan —
    -- planul mișcă scadențe, iar aceea e treaba gestionarului.
    or (fault_report_id is not null and plan_id is null and exists (
          select 1 from public.fault_reports fr
           where fr.id = maintenance_interventions.fault_report_id
             and fr.organization_id = maintenance_interventions.organization_id
             and fr.equipment_id = maintenance_interventions.equipment_id
             -- Doar cât sesizarea e în lucru: „rezolvat” pleacă numai de acolo,
             -- deci o intervenție scrisă din altă stare ar rămâne orfană.
             and fr.status = 'in_lucru'
             and fr.atribuit_employee_id = app.fisa_mea(fr.organization_id)))
  )
  and deleted_at is null
);

-- ============================================================
-- 12. Drepturi pe funcții
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'app.mentenanta_vede_sesizarea(uuid)',
    'app.mentenanta_poate_atasament(uuid,text,uuid,text)',
    'app.mentenanta_poate_fisier(text,text)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'internal.mentenanta_responsabili(uuid)',
    'internal.mentenanta_notifica(uuid,uuid,public.notification_kind,text,text,text,text,uuid)',
    'internal.aloca_numar_sesizare(uuid,integer)',
    'internal.fault_reports_numar()',
    'internal.fault_reports_garda()',
    'internal.fault_reports_notifica()',
    'internal.fault_report_comments_notifica()',
    'internal.fault_report_comments_garda()',
    'internal.fault_reports_oprire()',
    'internal.maintenance_interventions_oprire()',
    'internal.equipment_opriri_garda()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 13. Verificarea migrării
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  t text;
begin
  foreach t in array array['fault_report_comments','fault_report_history','maintenance_attachments','equipment_opriri','maintenance_settings'] loop
    if not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'public' and c.relname = t and c.relrowsecurity and c.relforcerowsecurity) then
      v_lipsa := v_lipsa || (t || ' fără RLS forțat');
    end if;
  end loop;
  if not exists (select 1 from pg_catalog.pg_trigger where tgname = 'fault_reports_garda' and tgrelid = 'public.fault_reports'::regclass) then
    v_lipsa := v_lipsa || 'fault_reports_garda';
  end if;
  if exists (select 1 from pg_catalog.pg_trigger where tgname = 'fault_reports_guard' and tgrelid = 'public.fault_reports'::regclass) then
    v_lipsa := v_lipsa || 'fault_reports_guard (vechi) încă atașat';
  end if;
  if exists (select 1 from public.fault_reports where numar is null) then
    v_lipsa := v_lipsa || 'sesizări fără număr';
  end if;
  if not exists (select 1 from storage.buckets where id = 'org-mentenanta') then
    v_lipsa := v_lipsa || 'bucketul org-mentenanta';
  end if;
  if not exists (select 1 from pg_catalog.pg_policy where polname = 'mentenanta_objects_insert') then
    v_lipsa := v_lipsa || 'politica de storage';
  end if;
  if not exists (select 1 from pg_catalog.pg_enum e join pg_catalog.pg_type ty on ty.oid = e.enumtypid
                  where ty.typname = 'fault_status' and e.enumlabel = 'inchis') then
    v_lipsa := v_lipsa || 'enum fault_status fără inchis';
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception 'Migrarea 0181 e incompletă: %', array_to_string(v_lipsa, '; ');
  end if;
end $$;

commit;
