-- supabase/migrations/0064_concedii_tip_zi_si_plafon.sql
--
-- Două defecte care produceau bani greșiți, ambele TĂCUT.
--
-- (1) SINCRONIZAREA CONCEDIU → PONTAJ CONFUNDA TOATE TIPURILE.
--     `tip_zi` era constanta 'concediu' în patru locuri — 0013:492 și 0013:496
--     (SQL) plus `sincronizare-concediu.ts:76` și `:94` (TypeScript). Dar
--     agregarea pentru salarizare numără pe `tip_zi` (0049:65-66):
--
--       count(*) filter (where e.tip_zi = 'concediu') → zile_concediu_odihna
--       count(*) filter (where e.tip_zi = 'medical')  → zile_concediu_medical
--
--     Consecințele, în ordinea gravității:
--       · CONCEDIUL FĂRĂ PLATĂ SE PLĂTEA. Zilele lui intrau în
--         `zile_concediu_odihna`, iar `calc.ts:324` le adaugă la `zilePlatite`.
--         Un angajat cu 20 de zile de CFP primea salariu întreg.
--       · `zile_concediu_medical` era PERMANENT 0, deci nici avertismentul
--         `CONCEDIU_MEDICAL_NECALCULAT` (calc.ts:304) nu se ridica vreodată.
--       · Maternitatea și creșterea copilului — contract SUSPENDAT, zero drept
--         salarial — se plăteau ca odihnă.
--
--     Reparația nu e o a doua constantă, ci o coloană: fiecare tip de concediu
--     își declară ce fel de zi de pontaj produce. Enum-ul `attendance_day_type`
--     avea deja 'medical'; primește acum și 'fara_plata', fiindcă „absență
--     nemotivată" ar fi fost eticheta greșită pentru o absență APROBATĂ — la fel
--     de neplătită, dar nu o abatere disciplinară. Diferența se vede în raport,
--     în dosarul de personal și la o eventuală cercetare disciplinară.
--
-- (2) ZILELE LEGALE NU ERAU LIMITATE DE NIMIC.
--     `scade_din_sold = true` doar pe `odihna` (0053:51-60), iar verificarea din
--     `concedii/actions.ts:131` e păzită de `if (tip.scade_din_sold)`. Pentru
--     celelalte NOUĂ tipuri, `zile_implicite` era text decorativ: o cerere de 300
--     de zile de concediu paternal trecea fără o vorbă.
--
--     Coloana amesteca două înțelesuri diferite:
--       · „consumă din soldul anual reportabil" — adevărat DOAR pentru odihnă,
--         singurul concediu cu acumulare lunară, reportare și plafon de report;
--       · „are un plafon legal care se verifică la depunere" — adevărat pentru
--         toate.
--     Le separăm. `plafon_anual_zile` e al doilea înțeles, verificat independent
--     de mecanismul de sold.
--
-- Forward-only: 0013 și 0049 NU se editează. Funcțiile lor se redefinesc aici.

\set ON_ERROR_STOP on

-- =====================================================================================
-- 1. Valoarea de enum, în tranzacția ei
-- =====================================================================================
-- `alter type ... add value` nu poate fi FOLOSIT în aceeași tranzacție în care e
-- adăugat (Postgres 17 permite comanda într-o tranzacție, dar nu și referirea
-- valorii noi înainte de commit). Secțiunea 5 o folosește, deci commit aici.

begin;

alter type public.attendance_day_type add value if not exists 'fara_plata';

commit;

begin;

-- =====================================================================================
-- 2. leave_types — ce fel de zi de pontaj produce fiecare tip
-- =====================================================================================

alter table public.leave_types
  add column tip_zi_pontaj public.attendance_day_type not null default 'concediu';

comment on column public.leave_types.tip_zi_pontaj is
  'Ce valoare de tip_zi scrie sincronizarea în attendance_entries pentru acest '
  'concediu. Determină cum îl numără agregarea de salarizare, deci DACĂ ȘI CUM '
  'se plătește: ''concediu'' intră în zilele plătite, ''medical'' merge pe '
  'indemnizația CNAS, ''fara_plata'' nu se plătește deloc. Până la 0064 era '
  'constanta ''concediu'' pentru toate — concediul fără plată se plătea.';

alter table public.leave_types
  add column plafon_anual_zile numeric(6, 2);

comment on column public.leave_types.plafon_anual_zile is
  'Maximul de zile pe an de drept, verificat la depunerea cererii INDEPENDENT de '
  'scade_din_sold. Cele două nu sunt același lucru: scade_din_sold înseamnă '
  '„consumă soldul acumulat și reportabil" (doar odihna), plafonul înseamnă „nu '
  'poți cere mai mult decât atât" (toate). NULL = fără plafon (concediul medical, '
  'a cărui durată o decide medicul, și cel fără plată, negociat).';

-- Tipurile existente. `medical` are durată dictată de certificat, nu de noi;
-- `fara_plata` se stabilește prin acordul părților (Codul Muncii art. 153) —
-- ambele rămân fără plafon.
update public.leave_types
   set tip_zi_pontaj = case key
         when 'medical'        then 'medical'::public.attendance_day_type
         when 'maternitate'    then 'medical'::public.attendance_day_type
         when 'fara_plata'     then 'fara_plata'::public.attendance_day_type
         when 'crestere_copil' then 'fara_plata'::public.attendance_day_type
         else 'concediu'::public.attendance_day_type
       end,
       plafon_anual_zile = case
         when key in ('medical', 'fara_plata') then null
         else zile_implicite
       end
 where deleted_at is null;

-- =====================================================================================
-- 3. Triggerul de protecție acoperă și coloanele noi
-- =====================================================================================
-- Fără asta, un org_admin ar putea muta `medical` pe tip_zi_pontaj='concediu' și
-- ar reintroduce exact defectul reparat mai sus — ocolind protecția, dar prin
-- coloana nouă. Redefinire completă, nu `alter`: funcția e sursa de adevăr.

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
-- 4. Seed-ul, pentru organizațiile viitoare
-- =====================================================================================
-- Redefinire integrală a `internal.seed_leave_defaults` din 0053, cu cele două
-- coloane noi în lista de valori. Restul e neschimbat, byte cu byte.

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
    ('fara_plata',    'Concediu fără plată',                         90, false, false, false, null, false, 'fara_rotunjire', null, '#94A3B8', 'Regulament intern (DE VERIFICAT)', false, 'fara_plata')
  ) as t(key, denumire, zile, scade, doc, rep, termen, intrerupe, rotunjire, plafon, culoare, temei, reglementat, tip_zi)
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
    -- transforma alegerea în secvență. Copiat byte-exact din 0053.
    insert into public.approval_steps (organization_id, flow_id, ordine, tip, permission_key, optional, sla_ore)
    values (p_organization_id, v_flow, 1, 'permisiune', 'leave:approve', false, 72)
    on conflict do nothing;
  end if;
end; $$;

revoke all on function internal.seed_leave_defaults(uuid) from public, anon, authenticated;

-- =====================================================================================
-- 5. Sincronizarea citește coloana, nu o constantă
-- =====================================================================================
-- Redefinirea lui `app.sincronizeaza_pontaj_concedii` (0013:445). Singura
-- schimbare de fond: `sursa` aduce `lt.tip_zi_pontaj` prin join pe `leave_types`,
-- iar INSERT-ul și DO UPDATE-ul îl folosesc în locul literalului 'concediu'.

create or replace function app.sincronizeaza_pontaj_concedii(
  p_organization_id uuid, p_an smallint, p_luna smallint
)
returns table (linii_create integer, linii_actualizate integer, linii_pastrate integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_start date := make_date(p_an::int, p_luna::int, 1);
  v_end   date := (make_date(p_an::int, p_luna::int, 1) + interval '1 month - 1 day')::date;
  v_perioada public.attendance_periods%rowtype;
  v_total integer := 0;
  v_noi integer := 0;
  v_actualizate integer := 0;
begin
  if not app.can(p_organization_id, 'attendance', 'create', 'all') then
    raise exception 'Nu ai dreptul să sincronizezi pontajul cu concediile aprobate.' using errcode = '42501';
  end if;
  if not app.feature_on(p_organization_id, 'attendance') then
    raise exception 'Modulul de pontaj nu este activ pentru această organizație.' using errcode = 'P0001';
  end if;

  select p.* into v_perioada
    from public.attendance_periods p
   where p.organization_id = p_organization_id and p.an = p_an and p.luna = p_luna and p.deleted_at is null;
  if not found then
    raise exception 'Luna de pontaj % nu a fost deschisă.', to_char(v_start, 'MM.YYYY') using errcode = 'P0001';
  end if;
  if v_perioada.status = 'blocata' then
    raise exception 'Perioada de pontaj % este blocată și nu mai poate fi sincronizată.',
      to_char(v_start, 'MM.YYYY') using errcode = 'P0001';
  end if;

  with sursa as (
    select distinct lr.employee_id, d.data, lr.id as leave_request_id,
           coalesce(lt.tip_zi_pontaj, 'concediu'::public.attendance_day_type) as tip_zi
      from public.leave_request_days d
      join public.leave_requests lr on lr.id = d.leave_request_id
      left join public.leave_types lt on lt.id = lr.leave_type_id
     where lr.organization_id = p_organization_id
       and lr.deleted_at is null
       and d.data between v_start and v_end
       -- DE ALINIAT cu valoarea reală a enum-ului de status din 0009:
       and lr.status::text in ('aprobata', 'aprobat', 'approved')
       and app.este_zi_lucratoare(p_organization_id, d.data)
  ),
  scrise as (
    insert into public.attendance_entries as e (
      organization_id, employee_id, data, ore_lucrate, ore_suplimentare, ore_noapte,
      tip_zi, sursa, leave_request_id
    )
    select p_organization_id, s.employee_id, s.data, 0, 0, 0, s.tip_zi, 'sincronizare_concedii', s.leave_request_id
      from sursa s
    on conflict (organization_id, employee_id, data) where deleted_at is null
    do update set
      tip_zi = excluded.tip_zi,
      ore_lucrate = 0,
      ore_suplimentare = 0,
      ore_noapte = 0,
      leave_request_id = excluded.leave_request_id,
      updated_at = now()
    where e.sursa = 'sincronizare_concedii'   -- liniile manuale rămân neatinse
    returning (xmax = 0) as inserata
  )
  select (select count(*) from sursa),
         count(*) filter (where inserata),
         count(*) filter (where not inserata)
    into v_total, v_noi, v_actualizate
    from scrise;

  return query select v_noi, v_actualizate, v_total - v_noi - v_actualizate;
end;
$$;

revoke all on function app.sincronizeaza_pontaj_concedii(uuid, smallint, smallint) from public, anon;
grant execute on function app.sincronizeaza_pontaj_concedii(uuid, smallint, smallint) to authenticated;

-- =====================================================================================
-- 6. Agregarea numără separat zilele fără plată
-- =====================================================================================
-- `create or replace` NU poate schimba tipul de retur al unei funcții
-- `returns table` — coloana nouă cere drop + create. Semnătura de apel rămâne
-- identică, deci `.rpc("pontaj_agregat_salarizare", ...)` din
-- `src/lib/queries/payroll.ts:759` nu se schimbă.

drop function if exists public.pontaj_agregat_salarizare(uuid);

create function public.pontaj_agregat_salarizare(p_period_id uuid)
returns table (
  employee_id                 uuid,
  zile_lucrate                numeric,
  zile_concediu_odihna        numeric,
  zile_concediu_medical       numeric,
  zile_absenta_nemotivata     numeric,
  zile_fara_plata             numeric,
  zile_repaus_lucrate         numeric,
  zile_sarbatoare_lucrate     numeric,
  ore_lucrate                 numeric,
  ore_normale_zi              numeric,
  ore_normale_repaus          numeric,
  ore_normale_sarbatoare      numeric,
  ore_suplimentare_zi         numeric,
  ore_suplimentare_repaus     numeric,
  ore_suplimentare_sarbatoare numeric,
  ore_noapte                  numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.employee_id,
    count(*) filter (where e.tip_zi in ('lucratoare', 'delegatie'))::numeric,
    count(*) filter (where e.tip_zi = 'concediu')::numeric,
    count(*) filter (where e.tip_zi = 'medical')::numeric,
    count(*) filter (where e.tip_zi = 'absenta_nemotivata')::numeric,
    count(*) filter (where e.tip_zi = 'fara_plata')::numeric,
    count(*) filter (where e.tip_zi = 'weekend' and e.ore_lucrate > 0)::numeric,
    count(*) filter (where e.tip_zi = 'sarbatoare' and e.ore_lucrate > 0)::numeric,
    coalesce(sum(e.ore_lucrate), 0),
    coalesce(sum(e.ore_lucrate - e.ore_suplimentare)
             filter (where e.tip_zi in ('lucratoare', 'delegatie')), 0),
    coalesce(sum(e.ore_lucrate - e.ore_suplimentare)
             filter (where e.tip_zi = 'weekend'), 0),
    coalesce(sum(e.ore_lucrate - e.ore_suplimentare)
             filter (where e.tip_zi = 'sarbatoare'), 0),
    coalesce(sum(e.ore_suplimentare)
             filter (where e.tip_zi in ('lucratoare', 'delegatie')), 0),
    coalesce(sum(e.ore_suplimentare) filter (where e.tip_zi = 'weekend'), 0),
    coalesce(sum(e.ore_suplimentare) filter (where e.tip_zi = 'sarbatoare'), 0),
    coalesce(sum(e.ore_noapte), 0)
  from public.attendance_entries e
  where e.period_id = p_period_id
    and e.deleted_at is null
  group by e.employee_id;
$$;

comment on function public.pontaj_agregat_salarizare(uuid) is
  'Pontajul lunii agregat pe angajat, cu orele separate pe cele trei axe de spor. '
  'Un rând per angajat, ca să nu se atingă max_rows = 1000. SECURITY INVOKER: '
  'RLS-ul attendance_entries rămâne bariera. Din 0064 zilele fără plată se '
  'numără separat — până atunci intrau în zile_concediu_odihna și SE PLĂTEAU.';

revoke all on function public.pontaj_agregat_salarizare(uuid) from public, anon;
grant execute on function public.pontaj_agregat_salarizare(uuid) to authenticated;

commit;
