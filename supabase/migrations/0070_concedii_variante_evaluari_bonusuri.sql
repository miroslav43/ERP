-- supabase/migrations/0070_concedii_variante_evaluari_bonusuri.sql
--
-- Trei lipsuri care aveau aceeași formă: regula exista în lege, dar aplicația
-- n-avea unde s-o pună.
--
-- (1) CONCEDIILE CONDIȚIONATE ERAU IMPOSIBIL DE INTRODUS.
--     Paternal 15 zile cu atestat de puericultură · creștere copil 3 ani pentru
--     copilul cu handicap · căsătorie 2 zile la căsătoria unui copil · deces 1 zi
--     pentru rudele de gradul II. Toate patru sunt în lege, și niciuna nu se
--     putea configura: triggerul din 0035 blochează orice modificare a zilelor
--     pe un tip reglementat, iar 0037 interzice și grilele pe astfel de tipuri.
--
--     Protecția e corectă și rămâne neatinsă — ea împiedică un angajator să pună
--     3 zile la maternitate. Ce lipsea era o a treia cale: VARIANTE predefinite,
--     seed de platformă, pe care angajatorul le ALEGE, nu le editează. Legea
--     rămâne apărată, dar completă.
--
-- (2) LIPSEAU DOUĂ TIPURI DE CONCEDIU: studii și evenimente speciale.
--
-- (3) EVALUĂRILE FOLOSEAU `employees:update`.
--     Cerința e ca formularul de evaluare să poată fi creat „de super user sau
--     de managerul direct". Dar `manager` n-are `employees:update` la scope
--     suficient, deci în practică evaluările erau exclusiv ale HR-ului și ale
--     administratorului. Chei proprii, cu `manager` la scope `team`.
--
-- (4) BONUSURILE ERAU DOAR AD-HOC.
--     `payroll_bonuses` cere `period_id` (0026:218): o sumă pe o lună, tastată
--     manual, pentru fiecare angajat, în fiecare lună. Cerința e „un loc unde
--     creezi o regulă generală pe care poți să o aplici la angajat".

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Variantele legale ale concediilor reglementate
-- =====================================================================================

create type public.leave_variant_condition as enum
  ('atestat', 'grad_handicap', 'grad_rudenie', 'varsta_copil', 'alta');

create table public.leave_type_variants (
  id                uuid primary key default gen_random_uuid(),
  -- NULL = variantă de platformă, vizibilă tuturor și needitabilă. Aceeași
  -- convenție ca la `salary_component_types` și `hr_document_templates`.
  organization_id   uuid references public.organizations (id) on delete cascade,
  leave_type_key    text not null,
  cod               text not null,
  denumire          text not null,
  zile              numeric(6, 2) not null,
  conditie_tip      public.leave_variant_condition not null,
  conditie_descriere text not null,
  necesita_document boolean not null default true,
  temei_legal       text,
  activ             boolean not null default true,
  ordine            smallint not null default 100,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz,
  constraint ltv_cod_ck check (cod ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint ltv_zile_ck check (zile >= 0 and zile <= 1100),
  constraint ltv_denumire_ck check (char_length(btrim(denumire)) between 2 and 160),
  constraint ltv_conditie_ck check (char_length(btrim(conditie_descriere)) between 2 and 300)
);

create unique index leave_type_variants_platforma_uniq
  on public.leave_type_variants (leave_type_key, cod)
  where organization_id is null and deleted_at is null;
create unique index leave_type_variants_org_uniq
  on public.leave_type_variants (organization_id, leave_type_key, cod)
  where organization_id is not null and deleted_at is null;
create index leave_type_variants_tip_idx
  on public.leave_type_variants (leave_type_key) where deleted_at is null;

comment on table public.leave_type_variants is
  'Variantele legale ale unui tip de concediu, condiționate de un document sau '
  'o situație (atestat de puericultură, grad de handicap, grad de rudenie). '
  'Angajatorul le ALEGE la depunerea cererii, nu le editează: rândurile de '
  'platformă (organization_id NULL) sunt needitabile, iar protecția tipurilor '
  'reglementate din 0035 rămâne neatinsă.';

-- Legătura cu cererea: ce variantă s-a invocat.
alter table public.leave_requests
  add column if not exists leave_variant_id uuid references public.leave_type_variants (id) on delete restrict;

create index leave_requests_varianta_idx
  on public.leave_requests (leave_variant_id) where deleted_at is null;

comment on column public.leave_requests.leave_variant_id is
  'Varianta legală invocată (ex. „paternal 15 zile, cu atestat de puericultură"). '
  'NULL = varianta de bază a tipului. Plafonul verificat la depunere e cel al '
  'variantei, nu leave_types.plafon_anual_zile.';

-- Seed-ul de platformă. ⚠️ Toate valorile sunt DE CONFIRMAT de jurist.
insert into public.leave_type_variants
  (organization_id, leave_type_key, cod, denumire, zile, conditie_tip, conditie_descriere,
   necesita_document, temei_legal, ordine)
values
  (null, 'paternal', 'paternal_atestat', 'Concediu paternal, cu atestat de puericultură',
   15, 'atestat',
   'Tatăl a absolvit un curs de puericultură și prezintă atestatul.',
   true, 'Legea 210/1999 art. 2 alin. (2) (DE VERIFICAT)', 10),

  (null, 'crestere_copil', 'cic_handicap', 'Creștere copil cu handicap, până la 3 ani',
   1095, 'grad_handicap',
   'Copilul are certificat de încadrare în grad de handicap.',
   true, 'OUG 111/2010 art. 2 alin. (1) (DE VERIFICAT)', 10),

  (null, 'casatorie', 'casatorie_copil', 'Căsătoria unui copil',
   2, 'grad_rudenie',
   'Se căsătorește un copil al salariatului, nu salariatul însuși.',
   true, 'CCM / regulament intern (DE VERIFICAT)', 10),

  (null, 'deces_ruda', 'deces_grad_ii', 'Deces, rudă de gradul II',
   1, 'grad_rudenie',
   'Bunici, nepoți, frați și surori — rude de gradul II. Gradul I are 3 zile.',
   true, 'CCM / regulament intern (DE VERIFICAT)', 10)
on conflict do nothing;

alter table public.leave_type_variants enable row level security;
alter table public.leave_type_variants force row level security;

-- Variantele de platformă (organization_id NULL) se văd de toți; cele proprii,
-- doar de organizația lor. Aceeași formă ca la `salary_component_types_select`.
create policy leave_type_variants_select on public.leave_type_variants
  for select to authenticated
  using (
    organization_id is null
    or organization_id = any ((select app.current_org_ids())::uuid[])
  );

create policy leave_type_variants_insert on public.leave_type_variants
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'leave', 'update', 'all')
    and deleted_at is null
  );

-- Rândurile de PLATFORMĂ nu se pot modifica: clauza `USING` cere un
-- `organization_id` propriu, iar cele de platformă îl au NULL. Fără asta, un
-- org_admin ar putea rescrie „paternal 15 zile" în „paternal 60 de zile" —
-- adică exact ocolirea pe care protecția din 0035 o închide pe tipuri.
create policy leave_type_variants_update on public.leave_type_variants
  for update to authenticated
  using (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'leave', 'update', 'all')
  )
  with check (
    organization_id is not null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'leave', 'update', 'all')
  );

do $$
begin
  execute 'create trigger trg_leave_type_variants_actor before insert or update on public.leave_type_variants for each row execute function internal.set_actor()';
  perform internal.attach_audit('leave_type_variants');
  execute 'grant select, insert, update on public.leave_type_variants to authenticated';
exception when undefined_function then
  null;
end;
$$;

-- =====================================================================================
-- 2. Tipurile de concediu care lipseau
-- =====================================================================================

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
    mod_rotunjire_acumulare, plafon_reportare_zile, culoare, temei_legal, reglementat,
    tip_zi_pontaj, plafon_anual_zile)
  select p_organization_id, t.key, t.denumire,
         case when t.key = 'odihna' then coalesce(v_zile_odihna, t.zile) else t.zile end,
         t.scade, t.doc, t.rep, t.termen, t.intrerupe,
         t.rotunjire::public.leave_rounding_mode, t.plafon, t.culoare, t.temei, t.reglementat,
         t.tip_zi::public.attendance_day_type,
         case when t.key in ('medical', 'fara_plata') then null
              when t.key = 'odihna' then coalesce(v_zile_odihna, t.zile)::numeric
              else t.zile::numeric end
  from (values
    ('odihna',        'Concediu de odihnă',                          20, true,  false, true,  18,   false, 'jumatate_in_sus', 20, '#2563EB', 'Codul Muncii art. 145 (DE VERIFICAT)', false, 'concediu'),
    ('medical',       'Concediu medical',                           183, false, true,  false, null, true,  'fara_rotunjire', null, '#DC2626', 'OUG 158/2005 (DE VERIFICAT)', true, 'medical'),
    ('maternitate',   'Concediu de maternitate',                    126, false, true,  false, null, true,  'fara_rotunjire', null, '#DB2777', 'OUG 158/2005 (DE VERIFICAT)', true, 'medical'),
    ('paternal',      'Concediu paternal (la nașterea copilului)',   10, false, true,  false, null, false, 'fara_rotunjire', null, '#0891B2', 'Legea 210/1999 (DE VERIFICAT)', true, 'concediu'),
    ('crestere_copil','Concediu creștere copil',                    730, false, true,  false, null, true,  'fara_rotunjire', null, '#7C3AED', 'OUG 111/2010 (DE VERIFICAT)', true, 'fara_plata'),
    ('casatorie',     'Concediu pentru căsătorie',                    5, false, true,  false, null, false, 'fara_rotunjire', null, '#F59E0B', 'CCM / regulament intern (DE VERIFICAT)', false, 'concediu'),
    ('deces_ruda',    'Concediu pentru deces în familie',             3, false, true,  false, null, false, 'fara_rotunjire', null, '#475569', 'CCM / regulament intern (DE VERIFICAT)', false, 'concediu'),
    ('donator_sange', 'Zi liberă donator de sânge',                   1, false, true,  false, null, false, 'fara_rotunjire', null, '#B91C1C', 'Legea 282/2005 (DE VERIFICAT)', true, 'concediu'),
    ('ingrijitor',    'Concediu de îngrijitor',                       5, false, true,  false, null, false, 'fara_rotunjire', null, '#0D9488', 'Codul Muncii art. 152^1 (DE VERIFICAT)', true, 'concediu'),
    ('fara_plata',    'Concediu fără plată',                         90, false, false, false, null, false, 'fara_rotunjire', null, '#94A3B8', 'Regulament intern (DE VERIFICAT)', false, 'fara_plata'),
    -- Adăugate în 0070. Amândouă ADAPTABILE: legea dă un minim, firma poate mai mult.
    ('studii',        'Concediu pentru formare profesională',        10, false, true,  false, null, false, 'fara_rotunjire', null, '#6366F1', 'Codul Muncii art. 155-158 (DE VERIFICAT)', false, 'concediu'),
    ('eveniment',     'Concediu pentru evenimente speciale',           1, false, false, false, null, false, 'fara_rotunjire', null, '#A855F7', 'CCM / regulament intern (DE VERIFICAT)', false, 'concediu')
  ) as t(key, denumire, zile, scade, doc, rep, termen, intrerupe, rotunjire, plafon, culoare, temei, reglementat, tip_zi)
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
end; $$;

revoke all on function internal.seed_leave_defaults(uuid) from public, anon, authenticated;

-- Organizațiile EXISTENTE primesc și ele cele două tipuri noi. Sunt adaptabile,
-- deci nu ating nimic din ce a configurat deja angajatorul.
insert into public.leave_types (organization_id, key, denumire, zile_implicite, scade_din_sold,
  necesita_document, se_reporteaza, intrerupe_alte_concedii, mod_rotunjire_acumulare,
  culoare, temei_legal, reglementat, tip_zi_pontaj, plafon_anual_zile)
select o.id, t.key, t.denumire, t.zile, false, t.doc, false, false,
       'fara_rotunjire'::public.leave_rounding_mode, t.culoare, t.temei, false,
       'concediu'::public.attendance_day_type, t.zile
  from public.organizations o
 cross join (values
   ('studii', 'Concediu pentru formare profesională', 10::numeric, true, '#6366F1', 'Codul Muncii art. 155-158 (DE VERIFICAT)'),
   ('eveniment', 'Concediu pentru evenimente speciale', 1::numeric, false, '#A855F7', 'CCM / regulament intern (DE VERIFICAT)')
 ) as t(key, denumire, zile, doc, culoare, temei)
 where o.deleted_at is null
   and not exists (
     select 1 from public.leave_types lt
      where lt.organization_id = o.id and lt.key = t.key and lt.deleted_at is null
   );

-- =====================================================================================
-- 3. Permisiuni proprii pentru evaluări
-- =====================================================================================
-- Până acum acțiunile din `evaluari/actions.ts` cereau `employees:update`, pe
-- care `manager` nu-l are la scope suficient — deci evaluările erau, în fapt,
-- exclusiv ale HR-ului și ale administratorului, contrar cerinței.

insert into public.role_permissions (organization_id, role, resource, action, scope)
values
  (null, 'super_admin', 'evaluations', 'read',   'all'),
  (null, 'super_admin', 'evaluations', 'create', 'all'),
  (null, 'super_admin', 'evaluations', 'update', 'all'),
  (null, 'org_admin',   'evaluations', 'read',   'all'),
  (null, 'org_admin',   'evaluations', 'create', 'all'),
  (null, 'org_admin',   'evaluations', 'update', 'all'),
  (null, 'hr',          'evaluations', 'read',   'all'),
  (null, 'hr',          'evaluations', 'create', 'all'),
  (null, 'hr',          'evaluations', 'update', 'all'),
  -- Managerul direct: DOAR echipa lui. Asta e schimbarea de fond.
  (null, 'manager',     'evaluations', 'read',   'team'),
  (null, 'manager',     'evaluations', 'create', 'team'),
  (null, 'manager',     'evaluations', 'update', 'team'),
  -- Angajatul își vede propriile evaluări, nu le creează.
  (null, 'employee',    'evaluations', 'read',   'own')
on conflict do nothing;

-- =====================================================================================
-- 4. Reguli recurente de bonus
-- =====================================================================================
-- Criteriul de aplicare reia tiparul din `leave_entitlement_rules` (0035): un
-- discriminant + o valoare, cu CHECK care garantează exact una populată.

create type public.bonus_rule_criterion as enum
  ('toti', 'departament', 'functie', 'vechime', 'nivel_incadrare');

create type public.bonus_rule_kind as enum ('procent_din_baza', 'suma_fixa');

create table public.payroll_bonus_rules (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  cod               text not null,
  denumire          text not null,
  bonus_type        public.payroll_bonus_type not null default 'prima_performanta',
  kind              public.bonus_rule_kind not null,
  procent           numeric(6, 2),
  suma              numeric(14, 2),
  tip_criteriu      public.bonus_rule_criterion not null default 'toti',
  department_id     uuid references public.departments (id) on delete cascade,
  job_position_id   uuid references public.job_positions (id) on delete cascade,
  vechime_ani_min   smallint,
  nivel_incadrare   text,
  -- Lunile în care se aplică: 1..12. Gol = toate lunile.
  luni              smallint[] not null default '{}',
  impozabil         boolean not null default true,
  supus_contributii boolean not null default true,
  valabil_de_la     date not null,
  valabil_pana      date,
  activ             boolean not null default true,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users (id) on delete set null,
  deleted_at        timestamptz,
  constraint pbr_cod_ck check (cod ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint pbr_denumire_ck check (char_length(btrim(denumire)) between 2 and 160),
  constraint pbr_valoare_ck check (
    (kind = 'procent_din_baza' and procent is not null and procent > 0 and procent <= 300
     and suma is null)
    or (kind = 'suma_fixa' and suma is not null and suma > 0 and procent is null)
  ),
  -- Exact un discriminant populat, potrivit criteriului ales.
  constraint pbr_criteriu_ck check (
    (tip_criteriu = 'toti'
      and department_id is null and job_position_id is null
      and vechime_ani_min is null and nivel_incadrare is null)
    or (tip_criteriu = 'departament' and department_id is not null
      and job_position_id is null and vechime_ani_min is null and nivel_incadrare is null)
    or (tip_criteriu = 'functie' and job_position_id is not null
      and department_id is null and vechime_ani_min is null and nivel_incadrare is null)
    or (tip_criteriu = 'vechime' and vechime_ani_min is not null
      and department_id is null and job_position_id is null and nivel_incadrare is null)
    or (tip_criteriu = 'nivel_incadrare' and nivel_incadrare is not null
      and department_id is null and job_position_id is null and vechime_ani_min is null)
  ),
  constraint pbr_interval_ck check (valabil_pana is null or valabil_pana >= valabil_de_la),
  constraint pbr_luni_ck check (
    luni <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]
  )
);

create unique index payroll_bonus_rules_cod_uniq
  on public.payroll_bonus_rules (organization_id, lower(cod))
  where deleted_at is null;
create index payroll_bonus_rules_activ_idx
  on public.payroll_bonus_rules (organization_id, activ, valabil_de_la)
  where deleted_at is null;

comment on table public.payroll_bonus_rules is
  'Reguli recurente de bonus, materializate în payroll_bonuses la calculul '
  'perioadei. Până la 0070 existau doar bonusuri ad-hoc, legate obligatoriu de o '
  'perioadă: o sumă pe o lună, tastată manual, pentru fiecare angajat, în '
  'fiecare lună.';

alter table public.payroll_bonus_rules enable row level security;
alter table public.payroll_bonus_rules force row level security;

create policy payroll_bonus_rules_select on public.payroll_bonus_rules
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'read', 'all')
  );

create policy payroll_bonus_rules_insert on public.payroll_bonus_rules
  for insert to authenticated
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'create', 'all')
    and deleted_at is null
  );

create policy payroll_bonus_rules_update on public.payroll_bonus_rules
  for update to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  )
  with check (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.can(organization_id, 'payroll', 'update', 'all')
  );

do $$
begin
  execute 'create trigger trg_payroll_bonus_rules_actor before insert or update on public.payroll_bonus_rules for each row execute function internal.set_actor()';
  perform internal.attach_audit('payroll_bonus_rules');
  execute 'grant select, insert, update on public.payroll_bonus_rules to authenticated';
exception when undefined_function then
  null;
end;
$$;

commit;

-- =====================================================================================
-- Note de proiectare
-- =====================================================================================
-- · De ce variantele NU sunt rânduri în `leave_types`: un tip nou ar fi apărut
--   în toate listele, în soldul anual și în rapoarte ca un concediu separat.
--   „Paternal 15 zile" nu e alt concediu decât „paternal 10 zile" — e același
--   drept, într-o situație anume.
--
-- · De ce politica de UPDATE cere `organization_id is not null`: rândurile de
--   platformă trebuie să fie needitabile. Fără clauza asta, un org_admin ar fi
--   putut rescrie „paternal, 15 zile" în „paternal, 60 de zile" — exact ocolirea
--   pe care protecția tipurilor reglementate din 0035 o închide.
--
-- · De ce regulile de bonus au `luni smallint[]` în loc de un rând per lună: o
--   primă de vacanță se dă în iulie și decembrie, iar două rânduri identice în
--   afară de lună s-ar fi desincronizat la prima editare.
