-- 0191_mentenanta_zilnica.sql
--
-- MENTENANȚĂ, FAZA M9: JOBUL ZILNIC ȘI REZUMATUL DE DIMINEAȚĂ.
--
-- Planul o numea 0184; între timp 0184–0190 au fost ocupate (registru,
-- asistent, salarizare, tichete, aprobatori, KPI), deci e 0191.
--
-- ── CE ADUCE ────────────────────────────────────────────────────────────────
--  · `internal.mentenanta_zilnica()`, programată la 05:10 (UTC, deci 08:10 vara
--    și 07:10 iarna, ora României), pentru fiecare firmă ACTIVĂ cu modulul
--    `maintenance` pornit (`feature_on`; firma suspendată, arhivată sau cu
--    abonamentul încheiat e sărită — cazul 47):
--      1. `internal.genereaza_alerte(org)` — aceeași funcție pe care o cheamă și
--         jobul de conformitate al Flotei; e idempotentă prin `on conflict`, deci
--         două joburi pe aceeași zi produc aceleași rânduri;
--      2. `internal.mentenanta_rezumat(org)` — UN SINGUR rezumat pe destinatar:
--         scadențele de mentenanță cu alertă nouă (plan, ISCIR, garanție),
--         planurile pe contor ajunse aproape de țintă, contoarele necitite,
--         sesizările CRITICE fără tehnician de peste 24 h (cazul 11) și
--         opririle deschise de peste 3 zile fără nicio intervenție;
--      3. `internal.sesizari_inchide_rezolvate(org)` — „rezolvat” neconfirmat
--         trece în „închis” după `inchidere_automata_zile`; garda din 0181 scrie
--         în istoric „Închisă automat…” (cazul 8).
--  · REPARĂ `internal.mentenanta_responsabili` (0181): responsabilii din setări
--    trebuie să fie MEMBRI ACTIVI ai firmei; plecații nu mai primesc nimic —
--    nici rezumatul, nici, pe producție, notificările de sesizare nouă,
--    atribuire și notă internă din 0181, care cheamă aceeași funcție.
--  · Destinatarii: responsabilii din setări (sau, fără ei, toți `org_admin` —
--    `internal.mentenanta_responsabili`) primesc TOT; responsabilul planului și
--    al echipamentului primesc doar ce ține de ale lor; RSVTI-ul din setări
--    primește autorizațiile ISCIR. Linkul e `/mentenanta` pentru cine citește
--    parcul (`maintenance:read` ≥ team, prin `internal.scope_membru`) și
--    `/portal/sesizari` („Echipamentele în grija mea”) pentru ceilalți.
--  · Deduplicarea: alertele cu `compliance_alerts` se marchează în
--    `alert_notifications` (`canal = 'in_app'`, același canal ca al Flotei —
--    fiecare job își filtrează propriile `entity_type`); celelalte (contoare,
--    sesizări, opriri) în `maintenance_rezumat_trimis`, tabelă nouă: același
--    element nu se mai trimite aceluiași om 7 zile.
--  · Pragurile de alertă (30/14/7 implicit) se editează în `/mentenanta/setari`:
--    `maintenance_settings.praguri_alerta_zile`, oglindită de un trigger în
--    `alert_rules` (o versiune pe zi, pentru cele trei `entity_type` ale
--    modulului). `alert_rules` cere `compliance:*` prin politică, iar pragurile
--    sunt ale mentenanței — triggerul e punctul unic de scriere.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
--  · Nu schimbă semnătura lui `internal.genereaza_alerte` și nu atinge
--    `expirables`, `app.poate_vedea_expirabil` sau `app.can_path` (le rescrie
--    Flota). Nu cheamă `internal.curata_alerte`: e pe toată firma, deci ar
--    închide și alertele Flotei din jobul altui modul.
--  · NU șterge obiectele orfane din `org-mentenanta`. Un `delete from
--    storage.objects` scoate doar METADATELE; fișierul rămâne în spațiul de
--    stocare, de negăsit (de aceea Supabase blochează ștergerea directă).
--    `pg_net` nu e activat pe instanță, deci jobul n-are cum chema API-ul de
--    Storage. Curățarea orfanilor (> 24 h, fără rând în
--    `maintenance_attachments`) o face aplicația, prin API, în
--    `pregatesteFisier` (`mentenanta/sesizari/actions.ts`).
--
-- Aplicare: psql byte-exact, după bancul local; producția cere confirmare.

begin;

-- ============================================================
-- 1. Pragurile de alertă în setările modulului
-- ============================================================
alter table public.maintenance_settings
  add column if not exists praguri_alerta_zile integer[] not null default array[30, 14, 7];

alter table public.maintenance_settings
  drop constraint if exists maintenance_settings_praguri_ck;
alter table public.maintenance_settings
  add constraint maintenance_settings_praguri_ck check (
    coalesce(array_length(praguri_alerta_zile, 1), 0) between 1 and 8
    and 0 < all (praguri_alerta_zile)
    and 365 >= all (praguri_alerta_zile)
  );

comment on column public.maintenance_settings.praguri_alerta_zile is
  'Cu câte zile înainte de scadență (plan, ISCIR, garanție) pleacă o alertă în rezumatul zilnic. Oglindite în alert_rules de internal.mentenanta_setari_praguri.';

-- ============================================================
-- 2. Registrul elementelor fără alertă de conformitate, deja trimise
-- ============================================================
-- Contoarele, sesizările și opririle nu trec prin `expirables` (n-au o dată de
-- scadență), deci n-au `compliance_alerts` și nici `alert_notifications`. Fără
-- un registru, rezumatul ar repeta în fiecare dimineață aceeași sesizare
-- neatribuită. Planul cerea verificarea pe `notifications` (entity_id, titlu,
-- 7 zile), dar rezumatul e UNA singură per om, cu entity_id gol: nu are pe ce
-- se lega o verificare per element. Un rând per (om, element, zi).
create table if not exists public.maintenance_rezumat_trimis (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  tip              text not null,
  entity_id        uuid not null,
  notification_id  uuid references public.notifications (id) on delete set null,
  trimis_in        date not null default app.azi_local(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) on delete set null,
  updated_by       uuid references auth.users (id) on delete set null,
  deleted_at       timestamptz,
  constraint maintenance_rezumat_trimis_tip_ck check (
    tip in ('contor_aproape', 'contor_necitit', 'sesizare_neatribuita', 'oprire_deschisa')
  )
);

create unique index if not exists maintenance_rezumat_trimis_uq
  on public.maintenance_rezumat_trimis (organization_id, user_id, tip, entity_id, trimis_in)
  where deleted_at is null;
create index if not exists maintenance_rezumat_trimis_notificare_idx
  on public.maintenance_rezumat_trimis (notification_id)
  where deleted_at is null and notification_id is not null;

comment on table public.maintenance_rezumat_trimis is
  'Ce element (contor, sesizare, oprire) a intrat deja în rezumatul zilnic al cui. Scrisă doar de internal.mentenanta_rezumat; un element nu se repetă aceluiași om 7 zile.';

-- ============================================================
-- 3. Helperi
-- ============================================================
-- Un număr cu substantivul lui, ca în limba română: „1 contor”, „3 contoare”,
-- „20 de contoare”, „101 contoare”. Oglinda lui `textNumarat`
-- (`src/app/(app)/mentenanta/etichete.ts`), fără separator de mii.
create or replace function internal.mentenanta_numarat(p_n integer, p_singular text, p_plural text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_n = 1 then '1 ' || p_singular
    when p_n >= 20 and (p_n % 100 = 0 or p_n % 100 >= 20) then p_n::text || ' de ' || p_plural
    else p_n::text || ' ' || p_plural
  end;
$$;

-- O citire de contor, fără zecimale inutile și cu virgulă: 1250 → „1250”,
-- 12.5 → „12,5”.
create or replace function internal.mentenanta_cifra(p_x numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_x is null then '?'
    when p_x = trunc(p_x) then trunc(p_x)::bigint::text
    else replace(round(p_x, 1)::text, '.', ',')
  end;
$$;

-- Destinatarii alertelor și ai sesizărilor noi — RESCRISĂ de la forma din 0181
-- (singura anterioară), cu aceeași semnătură. DEFECT REPARAT: ramura din setări
-- lua `employees.user_id` fără să întrebe `organization_members`, deci un
-- responsabil scos din firmă (membru `inactive`/`suspended` sau șters logic),
-- cu fișa încă legată de cont, primea rezumatul zilnic, notificările de
-- sesizare nouă, de atribuire și nota internă (0181:805, 0181:897) — coduri de
-- utilaje și descrieri de defecte, și prin push (0122). `notifications_select`
-- cere doar `user_id = auth.uid()`, deci notificarea îi rămânea vizibilă.
-- Acum cere membru ACTIV și neșters în aceeași firmă, pe ambele ramuri, iar
-- rezerva spre `org_admin` lucrează pe lista FILTRATĂ: dacă toți responsabilii
-- din setări au plecat, alertele ajung la administratori, nu la nimeni.
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
      join public.organization_members m
        on m.organization_id = p_org
       and m.user_id = e.user_id
       and m.status = 'active'
       and m.deleted_at is null
     where e.organization_id = p_org and e.deleted_at is null and e.user_id is not null
  )
  select user_id from din_setari
  union
  select m.user_id
    from public.organization_members m
   where m.organization_id = p_org and m.role = 'org_admin' and m.status = 'active'
     and m.deleted_at is null
     and not exists (select 1 from din_setari);
$$;

-- ============================================================
-- 4. Pragurile din setări → `alert_rules`
-- ============================================================
-- AFTER, pe definer: politica lui `alert_rules` cere `compliance:create = all`,
-- pe care un responsabil de mentenanță nu-l are neapărat; dreptul de a schimba
-- pragurile e cel de pe setări (`maintenance:update = all`, verificat de
-- politica lui `maintenance_settings` înainte ca triggerul să ruleze). O
-- versiune pe zi: `alert_rules` păstrează istoricul pe `valabil_de_la`, iar a
-- doua salvare din aceeași zi rescrie versiunea zilei, nu adaugă una.
create or replace function internal.mentenanta_setari_praguri()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tip text;
begin
  if new.deleted_at is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.praguri_alerta_zile is not distinct from old.praguri_alerta_zile then
    return null;
  end if;

  foreach v_tip in array array['maintenance_plan', 'iscir_authorization', 'equipment'] loop
    insert into public.alert_rules as r
      (organization_id, entity_type, kind, praguri_zile, alerteaza_la_depasire, valabil_de_la)
    values
      (new.organization_id, v_tip, '*', new.praguri_alerta_zile, true, app.azi_local())
    on conflict (organization_id, entity_type, kind, valabil_de_la) where deleted_at is null
    do update set praguri_zile = excluded.praguri_zile;
  end loop;
  return null;
end;
$$;

drop trigger if exists maintenance_settings_praguri on public.maintenance_settings;
create trigger maintenance_settings_praguri
  after insert or update on public.maintenance_settings
  for each row execute function internal.mentenanta_setari_praguri();

-- ============================================================
-- 5. Rezumatul zilnic al unei firme
-- ============================================================
-- O singură instrucțiune, cu CTE-uri care scriu: toate citesc ACELAȘI
-- instantaneu, deci verificarea „deja trimis?” vede starea de dinaintea
-- rulării, iar o a doua rulare găsește totul marcat și nu scrie nimic.
-- Întoarce câte notificări (rezumate) au plecat.
create or replace function internal.mentenanta_rezumat(p_org uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_azi           date := app.azi_local();
  v_prag_contor   integer;
  v_rsvti         uuid;
  v_n             integer := 0;
begin
  if p_org is null then
    return 0;
  end if;

  select s.prag_contor_necitit_zile, s.rsvti_employee_id
    into v_prag_contor, v_rsvti
    from public.maintenance_settings s
   where s.organization_id = p_org and s.deleted_at is null
   limit 1;
  v_prag_contor := coalesce(v_prag_contor, 30);

  with
  gestionari as (
    select r.user_id from internal.mentenanta_responsabili(p_org) r
  ),
  -- Ultima citire pe (echipament, tip de contor), după zi și apoi după
  -- momentul scrierii — două citiri în aceeași zi se ordonează ca în 0180.
  ultima_citire as (
    select distinct on (m.equipment_id, m.tip)
           m.equipment_id, m.tip, m.citire, m.data_citirii
      from public.equipment_meters m
     where m.organization_id = p_org and m.deleted_at is null
     order by m.equipment_id, m.tip, m.data_citirii desc, m.created_at desc
  ),
  echipamente_vii as (
    select q.id, q.cod, q.denumire, q.responsabil_employee_id
      from public.equipment q
     where q.organization_id = p_org
       and q.deleted_at is null
       and q.status in ('in_functiune', 'in_reparatie')
  ),
  -- ── Elementele, toate în aceeași formă ─────────────────────────────────
  --   tip · entity_id (cheia de deduplicare) · alert_id (doar scadențele) ·
  --   rang (ordinea în corp) · ordine · eticheta · personal (fișele care îl
  --   primesc pe lângă gestionari)
  scadente as (
    select case when a.status = 'expirat' then 'scadenta_depasita' else 'scadenta_apropiata' end as tip,
           x.id as entity_id,
           a.id as alert_id,
           case when a.status = 'expirat' then 1 else 5 end as rang,
           x.expires_at::text as ordine,
           coalesce(q.cod || ' · ', '') || x.label || ' — ' ||
             case when a.status = 'expirat'
                  then 'depășită din ' || to_char(x.expires_at, 'DD.MM.YYYY')
                  else 'scadentă pe ' || to_char(x.expires_at, 'DD.MM.YYYY') end as eticheta,
           array_remove(array[
             case when x.entity_type = 'maintenance_plan' then p.responsabil_employee_id end,
             q.responsabil_employee_id,
             case when x.entity_type = 'iscir_authorization' then v_rsvti end
           ], null) as personal
      from public.compliance_alerts a
      join public.expirables x on x.id = a.expirable_id
      left join public.maintenance_plans p
        on x.entity_type = 'maintenance_plan' and p.id = x.entity_id
      left join public.iscir_authorizations ia
        on x.entity_type = 'iscir_authorization' and ia.id = x.entity_id
      left join public.equipment q
        on q.id = case x.entity_type
                    when 'maintenance_plan'    then p.equipment_id
                    when 'iscir_authorization' then ia.equipment_id
                    when 'equipment'           then x.entity_id
                  end
     where a.organization_id = p_org
       and a.deleted_at is null
       and a.status in ('nou', 'expirat')
       and x.deleted_at is null
       and x.is_active
       and x.entity_type in ('maintenance_plan', 'iscir_authorization', 'equipment')
  ),
  contor_aproape as (
    select 'contor_aproape'::text as tip,
           p.id as entity_id,
           null::uuid as alert_id,
           4 as rang,
           p.denumire as ordine,
           q.cod || ' · ' || p.denumire || ': ' ||
             case when p.urmatoarea_scadenta_contor - u.citire <= 0
                  then 'ținta de ' || internal.mentenanta_cifra(p.urmatoarea_scadenta_contor) || ' ' || p.tip_contor::text
                       || ' a fost depășită (contorul arată ' || internal.mentenanta_cifra(u.citire) || ')'
                  else 'mai sunt ' || internal.mentenanta_cifra(p.urmatoarea_scadenta_contor - u.citire) || ' '
                       || p.tip_contor::text || ' până la ' || internal.mentenanta_cifra(p.urmatoarea_scadenta_contor)
             end as eticheta,
           array_remove(array[p.responsabil_employee_id, q.responsabil_employee_id], null) as personal
      from public.maintenance_plans p
      join echipamente_vii q on q.id = p.equipment_id
      join ultima_citire u on u.equipment_id = p.equipment_id and u.tip = p.tip_contor
     where p.organization_id = p_org
       and p.deleted_at is null
       and p.activ
       and p.tip_contor is not null
       and p.urmatoarea_scadenta_contor is not null
       -- Aceeași regulă ca `stareScadentaContor` (src/domain/maintenance/scadente.ts):
       -- 10% din periodicitate, sau 50 de unități când periodicitatea lipsește.
       and p.urmatoarea_scadenta_contor - u.citire <=
           case when coalesce(p.periodicitate_contor, 0) > 0
                then p.periodicitate_contor * 0.1 else 50 end
  ),
  contor_necitit as (
    select 'contor_necitit'::text as tip,
           q.id as entity_id,
           null::uuid as alert_id,
           6 as rang,
           coalesce(min(u.data_citirii)::text, '0000') as ordine,
           q.cod || ' · ' || q.denumire || ': ' ||
             string_agg(
               case when u.data_citirii is null then 'nicio citire de ' || t.tip::text
                    else 'ultima citire de ' || t.tip::text || ' pe ' || to_char(u.data_citirii, 'DD.MM.YYYY') end,
               '; ' order by t.tip::text) as eticheta,
           array_remove(array[q.responsabil_employee_id], null) as personal
      from echipamente_vii q
      join (select distinct p.equipment_id, p.tip_contor as tip
              from public.maintenance_plans p
             where p.organization_id = p_org and p.deleted_at is null and p.activ
               and p.tip_contor is not null) t on t.equipment_id = q.id
      left join ultima_citire u on u.equipment_id = q.id and u.tip = t.tip
     where u.data_citirii is null or u.data_citirii < v_azi - v_prag_contor
     group by q.id, q.cod, q.denumire, q.responsabil_employee_id
  ),
  sesizari_neatribuite as (
    select 'sesizare_neatribuita'::text as tip,
           fr.id as entity_id,
           null::uuid as alert_id,
           2 as rang,
           fr.raportat_la::text as ordine,
           fr.numar || ' · ' || coalesce(q.cod, '?') || ': ' || left(fr.descriere, 80)
             || ' (raportată pe ' || to_char(fr.raportat_la at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') || ')' as eticheta,
           '{}'::uuid[] as personal
      from public.fault_reports fr
      left join public.equipment q on q.id = fr.equipment_id
     where fr.organization_id = p_org
       and fr.deleted_at is null
       and fr.urgenta = 'critica'
       and fr.atribuit_employee_id is null
       and fr.status in ('nou', 'in_analiza', 'in_asteptare')
       and fr.raportat_la < now() - interval '24 hours'
  ),
  opriri as (
    select 'oprire_deschisa'::text as tip,
           o.id as entity_id,
           null::uuid as alert_id,
           3 as rang,
           o.inceput::text as ordine,
           q.cod || ' · ' || q.denumire || ': oprit din '
             || to_char(o.inceput at time zone 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI')
             || ', fără nicio intervenție' as eticheta,
           array_remove(array[q.responsabil_employee_id], null) as personal
      from public.equipment_opriri o
      join public.equipment q on q.id = o.equipment_id and q.deleted_at is null and q.status <> 'casat'
     where o.organization_id = p_org
       and o.deleted_at is null
       and o.sfarsit is null
       and o.inceput < now() - interval '3 days'
       and o.intervention_id is null
       and not exists (
         select 1 from public.maintenance_interventions i
          where o.fault_report_id is not null
            and i.fault_report_id = o.fault_report_id
            and i.deleted_at is null)
  ),
  elemente as (
    select * from scadente
    union all select * from contor_aproape
    union all select * from contor_necitit
    union all select * from sesizari_neatribuite
    union all select * from opriri
  ),
  -- ── Cine primește ce ───────────────────────────────────────────────────
  destinatari as (
    select e.*, g.user_id from elemente e cross join gestionari g
    union
    select e.*, emp.user_id
      from elemente e
      join public.employees emp
        on emp.id = any (e.personal)
       and emp.organization_id = p_org
       and emp.deleted_at is null
       and emp.user_id is not null
      join public.organization_members m
        on m.organization_id = p_org
       and m.user_id = emp.user_id
       and m.status = 'active'
       and m.deleted_at is null
  ),
  noi as (
    select d.*
      from destinatari d
     where d.user_id is not null
       and case
             when d.alert_id is not null then not exists (
               select 1 from public.alert_notifications an
                where an.alert_id = d.alert_id
                  and an.canal = 'in_app'
                  and an.destinatar_cheie = d.user_id::text)
             else not exists (
               select 1 from public.maintenance_rezumat_trimis r
                where r.organization_id = p_org
                  and r.user_id = d.user_id
                  and r.tip = d.tip
                  and r.entity_id = d.entity_id
                  and r.deleted_at is null
                  and r.trimis_in > v_azi - 7)
           end
  ),
  -- Un element = un rând per om, chiar dacă scadența are mai multe alerte
  -- (la prima rulare, o scadență peste 5 zile atinge deodată pragurile 30, 14 și 7).
  distincte as (
    select distinct on (n.user_id, n.tip, n.entity_id)
           n.user_id, n.tip, n.entity_id, n.rang, n.ordine, n.eticheta
      from noi n
     order by n.user_id, n.tip, n.entity_id
  ),
  numerotate as (
    select d.*, row_number() over (partition by d.user_id order by d.rang, d.ordine, d.entity_id) as rn
      from distincte d
  ),
  pe_om as (
    select n.user_id,
           count(*) filter (where n.tip = 'scadenta_depasita')::integer    as depasite,
           count(*) filter (where n.tip = 'scadenta_apropiata')::integer   as apropiate,
           count(*) filter (where n.tip = 'contor_aproape')::integer       as contoare_aproape,
           count(*) filter (where n.tip = 'contor_necitit')::integer       as necitite,
           count(*) filter (where n.tip = 'sesizare_neatribuita')::integer as sesizari,
           count(*) filter (where n.tip = 'oprire_deschisa')::integer      as opriri,
           count(*)::integer                                               as total,
           string_agg('· ' || n.eticheta, E'\n' order by n.rn) filter (where n.rn <= 8) as linii
      from numerotate n
     group by n.user_id
  ),
  scrise as (
    insert into public.notifications (user_id, organization_id, kind, title, body, link, entity_type, entity_id)
    select o.user_id,
           p_org,
           case when o.depasite + o.sesizari + o.opriri > 0
                then 'warning'::public.notification_kind
                else 'reminder'::public.notification_kind end,
           left('Mentenanța de azi: ' || array_to_string(array_remove(array[
             case when o.depasite > 0 then internal.mentenanta_numarat(o.depasite, 'scadență depășită', 'scadențe depășite') end,
             case when o.sesizari > 0 then internal.mentenanta_numarat(o.sesizari, 'sesizare critică fără tehnician', 'sesizări critice fără tehnician') end,
             case when o.opriri > 0 then internal.mentenanta_numarat(o.opriri, 'oprire de peste 3 zile', 'opriri de peste 3 zile') end,
             case when o.contoare_aproape > 0 then internal.mentenanta_numarat(o.contoare_aproape, 'plan pe contor la țintă', 'planuri pe contor la țintă') end,
             case when o.apropiate > 0 then internal.mentenanta_numarat(o.apropiate, 'scadență apropiată', 'scadențe apropiate') end,
             case when o.necitite > 0 then internal.mentenanta_numarat(o.necitite, 'contor necitit', 'contoare necitite') end
           ], null), ', ') || '.', 200),
           left(o.linii || case when o.total > 8
                                then E'\n… și încă ' || internal.mentenanta_numarat(o.total - 8, 'element', 'elemente') || '.'
                                else '' end, 4000),
           case when internal.scope_membru(p_org, o.user_id, 'maintenance', 'read') in ('team', 'all')
                then '/mentenanta' else '/portal/sesizari' end,
           'maintenance_rezumat',
           null
      from pe_om o
    returning id, user_id
  ),
  marcate_alerte as (
    insert into public.alert_notifications
      (organization_id, alert_id, canal, recipient_user_id, notification_id, status, sent_at)
    select p_org, n.alert_id, 'in_app', n.user_id, s.id, 'trimis', now()
      from noi n
      join scrise s on s.user_id = n.user_id
     where n.alert_id is not null
    on conflict (alert_id, canal, destinatar_cheie) do nothing
    returning 1
  ),
  marcate_elemente as (
    insert into public.maintenance_rezumat_trimis (organization_id, user_id, tip, entity_id, notification_id, trimis_in)
    select distinct p_org, n.user_id, n.tip, n.entity_id, s.id, v_azi
      from noi n
      join scrise s on s.user_id = n.user_id
     where n.alert_id is null
    on conflict (organization_id, user_id, tip, entity_id, trimis_in) where deleted_at is null do nothing
    returning 1
  )
  -- Instrucțiunile care scriu din WITH rulează o dată și complet, citite sau
  -- nu de interogarea principală; se numără doar rezumatele.
  select count(*) into v_n from scrise;

  return coalesce(v_n, 0);
end;
$$;

comment on function internal.mentenanta_rezumat(uuid) is
  'Rezumatul zilnic al mentenanței pentru o firmă: o notificare per destinatar, doar cu elementele netrimise lui. Idempotentă: a doua rulare din aceeași zi nu scrie nimic.';

-- ============================================================
-- 6. Jobul zilnic
-- ============================================================
-- Fiecare firmă în subtranzacția ei: o eroare pe datele uneia (o etichetă prea
-- lungă, o regulă stricată) nu oprește rezumatul celorlalte. Întoarce un
-- raport, util la rularea manuală și în `cron.job_run_details`.
create or replace function internal.mentenanta_zilnica()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org       uuid;
  v_firme     integer := 0;
  v_alerte    integer := 0;
  v_rezumate  integer := 0;
  v_inchise   integer := 0;
  v_esuate    integer := 0;
  v_x         integer;
begin
  for v_org in
    select o.id
      from public.organizations o
     where o.deleted_at is null
       -- Aceleași stări ca `app.current_org_ids`: o firmă suspendată sau
       -- arhivată nu mai e deschisă nimănui, deci nici rezumatul nu pleacă.
       and o.status in ('pending', 'active')
       and o.subscription_status not in ('canceled', 'expired')
       and app.feature_on(o.id, 'maintenance')
     order by o.id
  loop
    begin
      v_x := internal.genereaza_alerte(v_org);
      v_alerte := v_alerte + coalesce(v_x, 0);
      v_x := internal.mentenanta_rezumat(v_org);
      v_rezumate := v_rezumate + coalesce(v_x, 0);
      v_x := internal.sesizari_inchide_rezolvate(v_org);
      v_inchise := v_inchise + coalesce(v_x, 0);
      v_firme := v_firme + 1;
    exception when others then
      v_esuate := v_esuate + 1;
      raise warning 'mentenanta_zilnica: firma % a eșuat: % (%)', v_org, sqlerrm, sqlstate;
    end;
  end loop;

  return jsonb_build_object(
    'firme', v_firme, 'alerte_noi', v_alerte, 'rezumate', v_rezumate,
    'sesizari_inchise', v_inchise, 'firme_esuate', v_esuate);
end;
$$;

comment on function internal.mentenanta_zilnica() is
  'Jobul de dimineață al mentenanței (pg_cron „mentenanta-zilnica”): alerte, rezumat per destinatar, închiderea automată a sesizărilor rezolvate. Doar firmele active cu modulul pornit.';

-- ============================================================
-- 7. RLS pe registrul rezumatului
-- ============================================================
alter table public.maintenance_rezumat_trimis enable row level security;
alter table public.maintenance_rezumat_trimis force row level security;

-- Fiecare își vede propriile rânduri; scrie doar jobul (context de serviciu).
create policy maintenance_rezumat_trimis_select on public.maintenance_rezumat_trimis
for select to authenticated
using (
  app.is_platform_admin() or (
    deleted_at is null
    and organization_id = any ((select app.current_org_ids())::uuid[])
    and user_id = (select auth.uid())
  )
);
create policy maintenance_rezumat_trimis_insert on public.maintenance_rezumat_trimis
for insert to authenticated
with check (
  (select app.is_service_context())
  and organization_id = any ((select app.current_org_ids())::uuid[])
  and deleted_at is null
);
create policy maintenance_rezumat_trimis_update on public.maintenance_rezumat_trimis
for update to authenticated
using (
  (select app.is_service_context())
  and organization_id = any ((select app.current_org_ids())::uuid[])
)
with check (
  (select app.is_service_context())
  and organization_id = any ((select app.current_org_ids())::uuid[])
);

-- Actor, updated_at, granturi. FĂRĂ `attach_audit`, deliberat, ca la
-- `alert_notifications` în 0008: e o proiecție scrisă de mașină, iar auditul ei
-- ar îneca jurnalul; decizia umană (pragurile) e auditată pe setări și pe
-- `alert_rules`.
do $$
declare t text;
begin
  foreach t in array array['maintenance_rezumat_trimis'] loop
    execute format('drop trigger if exists %1$s_actor on public.%1$I', t);
    execute format('create trigger %1$s_actor before insert or update on public.%1$I for each row execute function internal.set_actor()', t);
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || t, t);
    execute format('create trigger %I before update on public.%I for each row execute function app.set_updated_at()', 'set_updated_at_' || t, t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('revoke delete on public.%I from authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ============================================================
-- 8. Drepturi pe funcții
-- ============================================================
-- Ca în 0181: fără EXECUT pentru nimeni în afara proprietarului (triggerele definer).
revoke all on function internal.mentenanta_responsabili(uuid) from public, anon, authenticated;
revoke all on function internal.mentenanta_numarat(integer, text, text) from public, anon, authenticated;
revoke all on function internal.mentenanta_cifra(numeric) from public, anon, authenticated;
revoke all on function internal.mentenanta_setari_praguri() from public, anon, authenticated;
revoke all on function internal.mentenanta_rezumat(uuid) from public, anon, authenticated;
revoke all on function internal.mentenanta_zilnica() from public, anon, authenticated;
grant execute on function internal.mentenanta_rezumat(uuid) to service_role;
grant execute on function internal.mentenanta_zilnica() to service_role;

commit;

-- ============================================================
-- 9. Programarea
-- ============================================================
-- Garda de disponibilitate, convenția din 0008/0042/0075/0095: pe Postgres-ul
-- gol din CI și din bancul local `pg_cron` nu există, iar migrarea trebuie să
-- treacă. `cron.schedule` cu același nume REPROGRAMEAZĂ; `unschedule` înainte
-- e doar pentru claritatea rulării repetate.
do $do$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema cron;

    perform cron.unschedule('mentenanta-zilnica')
     where exists (select 1 from cron.job where jobname = 'mentenanta-zilnica');

    perform cron.schedule(
      'mentenanta-zilnica',
      '10 5 * * *',
      $job$select internal.mentenanta_zilnica()$job$
    );
  else
    raise notice 'pg_cron indisponibil: jobul zilnic al mentenanței nu a fost programat.';
  end if;
end;
$do$;

-- ============================================================
-- 10. Verificare
-- ============================================================
do $$
declare
  v_lipsa text[] := '{}';
  v_job   bigint;
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
                  and table_name = 'maintenance_settings' and column_name = 'praguri_alerta_zile') then
    v_lipsa := v_lipsa || 'maintenance_settings.praguri_alerta_zile';
  end if;
  if to_regclass('public.maintenance_rezumat_trimis') is null then
    v_lipsa := v_lipsa || 'maintenance_rezumat_trimis';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'maintenance_rezumat_trimis_uq') then
    v_lipsa := v_lipsa || 'maintenance_rezumat_trimis_uq';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'maintenance_settings_praguri'
                  and tgrelid = 'public.maintenance_settings'::regclass) then
    v_lipsa := v_lipsa || 'triggerul maintenance_settings_praguri';
  end if;
  if position('organization_members' in pg_get_functiondef('internal.mentenanta_responsabili(uuid)'::regprocedure)) = 0
     or pg_get_functiondef('internal.mentenanta_responsabili(uuid)'::regprocedure) !~ 'm\.deleted_at is null' then
    v_lipsa := v_lipsa || 'internal.mentenanta_responsabili cu filtrul pe membri activi';
  end if;
  if to_regprocedure('internal.mentenanta_zilnica()') is null then
    v_lipsa := v_lipsa || 'internal.mentenanta_zilnica()';
  end if;
  if to_regprocedure('internal.mentenanta_rezumat(uuid)') is null then
    v_lipsa := v_lipsa || 'internal.mentenanta_rezumat(uuid)';
  end if;
  -- Semnătura pe care o cheamă și jobul Flotei rămâne cea din 0008.
  if to_regprocedure('internal.genereaza_alerte(uuid)') is null then
    v_lipsa := v_lipsa || 'internal.genereaza_alerte(uuid) (semnătura)';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
       and tablename = 'maintenance_rezumat_trimis') <> 3 then
    v_lipsa := v_lipsa || 'trio-ul de politici pe maintenance_rezumat_trimis';
  end if;
  -- `cron.job` există doar cu extensia instalată; plpgsql nu scurtcircuitează
  -- planificarea, deci interogarea trece prin `execute`.
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    execute $q$select count(*) from cron.job where jobname = 'mentenanta-zilnica'$q$ into v_job;
    if v_job = 0 then
      v_lipsa := v_lipsa || 'jobul pg_cron mentenanta-zilnica';
    end if;
  end if;
  if array_length(v_lipsa, 1) > 0 then
    raise exception '0191: lipsesc %', array_to_string(v_lipsa, ', ');
  end if;
end $$;
