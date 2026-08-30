-- supabase/migrations/0112_concediu_doar_zi_intreaga.sql
-- Concediul se cere doar pe zile ÎNTREGI. Jumătățile de zi ies din bază, nu
-- doar din formular.
--
-- ┌ De ce nu se șterg etichetele din enum ────────────────────────────────────
-- │ Postgres nu știe să scoată o valoare dintr-un `enum`: `prima_jumatate` și
-- │ `a_doua_jumatate` rămân în `public.leave_day_portion`, la fel cum
-- │ `jumatate_in_sus`/`jumatate_in_jos` rămân în `public.leave_rounding_mode`.
-- │ Bariera e o CONSTRÂNGERE pe coloană, care nu cere rescrierea tipului și
-- │ nici atingerea celor 8 coloane care îl folosesc. Etichetele rămase sunt
-- │ inerte: nicio coloană nu le mai poate primi.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ Ce s-a verificat ÎNAINTE de a scrie constrângerile ───────────────────────
-- │   leave_requests cu porțiune parțială ......... 0 din 8
-- │   leave_request_days cu porțiune parțială ..... 0
-- │   leave_requests cu zile_lucratoare fracționar  0
-- │   leave_types cu rotunjire pe jumătate ........ 3 (toate `odihna`,
-- │                                                  toate `reglementat=false`)
-- │ Cele 3 rânduri se mută pe `zi_in_sus` — varianta favorabilă salariatului,
-- │ aceeași direcție ca `jumatate_in_sus` pe care o înlocuiește. Sunt
-- │ `reglementat=false`, deci `internal.leave_types_protejeaza_reglementat`
-- │ (0064) nu le apără; un UPDATE pe un tip reglementat ar fi fost refuzat.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce moare și rotunjirea la jumătate de zi ──────────────────────────────
-- │ E o regulă de ACUMULARE, nu de cerere — dar produce solduri de forma
-- │ „12,5 zile" dintr-un drept proporțional. Cu cereri doar pe zile întregi,
-- │ jumătatea aceea nu se mai poate cheltui pe nimic: rămâne pe ecran ca un
-- │ drept pe care omul nu-l poate lua. Nota C din 0009 spune că legea nu
-- │ impune o regulă de rotunjire; alegerea rămâne a firmei, dar numai dintre
-- │ cele care dau zile întregi.
-- └───────────────────────────────────────────────────────────────────────────
--
-- Corpurile funcțiilor de mai jos sunt EXTRASE din bază cu `pg_get_functiondef`
-- și peticite programatic — nu retranscrise. Diferența față de original e de
-- exact 1 linie la `internal.leave_requests_pregateste`, 5 la
-- `internal.leave_requests_sincronizeaza`, 2 la `internal.recalc_sold` și 1 la
-- `internal.seed_leave_defaults`.

begin;

-- =====================================================================================
-- 1. Cererile și zilele lor: numai „zi_intreaga"
-- =====================================================================================
-- Coloanele rămân (au `default 'zi_intreaga'`, deci un INSERT care le omite e
-- corect prin construcție), dar nu mai pot primi altceva — nici dintr-un
-- `psql`, nici dintr-o funcție viitoare care ar reînvia parametrii.

alter table public.leave_requests
  add constraint leave_requests_doar_zi_intreaga
  check (portiune_inceput = 'zi_intreaga' and portiune_sfarsit = 'zi_intreaga');

alter table public.leave_request_days
  add constraint leave_request_days_doar_zi_intreaga
  check (portiune = 'zi_intreaga');

-- =====================================================================================
-- 2. app.numara_zile_lucratoare — semnătura pierde porțiunile
-- =====================================================================================
-- Se DROP-uiește, nu se înlocuiește: parametrii cu valoare implicită nu pot fi
-- scoși printr-un `create or replace`. Singurul apelant e
-- `internal.leave_requests_pregateste`, rescris la punctul 3 din aceeași
-- tranzacție (plpgsql leagă apelul la execuție, deci ordinea dintre ele nu
-- contează).
--
-- ATENȚIE la granturi: funcția veche avea `=X/postgres`, adică EXECUTE pentru
-- PUBLIC. Nu era o decizie — coada de REVOKE/GRANT din 0016 numea din greșeală
-- `app.este_zi_lucratoare` de două ori, iar `numara_zile_lucratoare` a rămas pe
-- moștenirea implicită. Obiectul nou pornește cu drepturile pe care le-ar fi
-- avut: aceleași ca sora ei.

drop function app.numara_zile_lucratoare(
  uuid, date, date, public.leave_day_portion, public.leave_day_portion);

create function app.numara_zile_lucratoare(
  p_organization_id uuid, p_inceput date, p_sfarsit date
) returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::numeric(6,2)
  from generate_series(p_inceput, p_sfarsit, interval '1 day') as z
  where app.este_zi_lucratoare(p_organization_id, z::date);
$$;

revoke all on function app.numara_zile_lucratoare(uuid, date, date) from public, anon;
grant execute on function app.numara_zile_lucratoare(uuid, date, date) to authenticated, service_role;

-- =====================================================================================
-- 3. Triggerul de pregătire: apel cu trei argumente
-- =====================================================================================

CREATE OR REPLACE FUNCTION internal.leave_requests_pregateste()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_tip public.leave_types%rowtype; v_org uuid;
begin
  select * into v_tip from public.leave_types where id = new.leave_type_id and deleted_at is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'Tipul de concediu selectat nu există sau a fost dezactivat.';
  end if;
  if v_tip.organization_id <> new.organization_id then
    raise exception using errcode = 'P0001', message = 'Tipul de concediu aparține altei organizații.';
  end if;
  select organization_id into v_org from public.employees where id = new.employee_id and deleted_at is null;
  if v_org is null or v_org <> new.organization_id then
    raise exception using errcode = 'P0001', message = 'Angajatul selectat nu aparține organizației curente.';
  end if;

  -- Cele trei chei sunt aceleași, în aceeași ordine, ca
  -- `TIPURI_CU_ORIGINAL_FIZIC` din `src/domain/leave/documente-fizice.ts`.
  -- Actul lor se predă pe hârtie, deci trimiterea nu mai așteaptă un fișier;
  -- încărcarea rămâne posibilă din interfață, ca ajutor, dar e opțională.
  if v_tip.necesita_document and new.status = 'trimisa'
     and v_tip.key not in ('medical', 'maternitate', 'donator_sange')
     and coalesce(btrim(new.atasament_path), '') = '' and new.medical_code_id is null then
    raise exception using errcode = 'P0001',
      message = 'Acest tip de concediu necesită un document justificativ atașat înainte de trimitere.';
  end if;

  if new.data_inceput < (current_date - interval '2 years')::date then
    raise exception using errcode = 'P0001',
      message = 'Perioada solicitată este mai veche de doi ani. Corectați datele cererii.';
  end if;

  new.intrerupe_alte_concedii := v_tip.intrerupe_alte_concedii;
  new.zile_calendaristice := (new.data_sfarsit - new.data_inceput) + 1;
  new.zile_lucratoare := app.numara_zile_lucratoare(
    new.organization_id, new.data_inceput, new.data_sfarsit);

  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status <> 'trimisa') then
    new.trimisa_la := now();
  end if;
  if new.status in ('aprobata', 'respinsa') and (tg_op = 'INSERT' or old.status <> new.status) then
    new.decis_la := now();
  end if;
  new.updated_at := now();
  return new;
end; $function$
;

revoke all on function internal.leave_requests_pregateste() from public;
grant execute on function internal.leave_requests_pregateste() to authenticated, service_role;

-- =====================================================================================
-- 4. Sincronizarea zilelor: fiecare zi a cererii e întreagă
-- =====================================================================================
-- Dispar și cele două condiții de regenerare pe schimbarea porțiunii: coloanele
-- nu se mai pot schimba, deci comparația era o ramură moartă care ținea vie
-- ideea că jumătățile există.

CREATE OR REPLACE FUNCTION internal.leave_requests_sincronizeaza()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_r      record;
  v_step   record;
  v_n_cand integer;
  v_n_escl integer;
begin
  -- regenerează liniile de zi când perioada s-a schimbat
  if tg_op = 'INSERT'
     or old.data_inceput <> new.data_inceput or old.data_sfarsit <> new.data_sfarsit then
    delete from public.leave_request_days where leave_request_id = new.id;
    insert into public.leave_request_days
      (organization_id, leave_request_id, data, portiune, este_lucratoare, status)
    select new.organization_id, new.id, z::date,
      'zi_intreaga'::public.leave_day_portion,
      app.este_zi_lucratoare(new.organization_id, z::date),
      new.status
    from generate_series(new.data_inceput, new.data_sfarsit, interval '1 day') as z;
  elsif old.status is distinct from new.status then
    update public.leave_request_days
       set status = new.status, updated_at = now()
     where leave_request_id = new.id and status <> 'intrerupta';
  end if;

  -- întreruperea concediilor suprapuse (CM peste CO aprobat)
  if new.intrerupe_alte_concedii and new.status = 'aprobata'
     and (tg_op = 'INSERT' or old.status is distinct from 'aprobata') then
    update public.leave_request_days d
       set status = 'intrerupta', updated_at = now()
      from public.leave_requests r
     where d.leave_request_id = r.id
       and r.employee_id = new.employee_id and r.id <> new.id
       and r.organization_id = new.organization_id
       and r.status = 'aprobata' and r.deleted_at is null
       and d.data between new.data_inceput and new.data_sfarsit
       and d.status = 'aprobata';

    for v_r in
      select distinct rr.id, rr.leave_type_id, rr.employee_id, rr.organization_id
        from public.leave_requests rr
        join public.leave_request_days dd on dd.leave_request_id = rr.id
       where rr.employee_id = new.employee_id and rr.id <> new.id
         and rr.status = 'aprobata' and rr.deleted_at is null
         and dd.status = 'intrerupta'
    loop
      if not exists (select 1 from public.leave_request_days
                      where leave_request_id = v_r.id and status = 'aprobata') then
        update public.leave_requests set status = 'intrerupta', updated_at = now() where id = v_r.id;
      end if;
      perform internal.recalc_sold(v_r.organization_id, v_r.employee_id, v_r.leave_type_id,
                                   extract(year from new.data_inceput)::int, v_r.id);
    end loop;
  end if;

  -- lanțul de aprobare: la trimitere se rezolvă și se creează sarcinile, pas cu pas.
  if new.status = 'trimisa' and (tg_op = 'INSERT' or old.status is distinct from 'trimisa') then
    for v_step in
      select s.*
        from public.approval_flows f
        join public.approval_steps s on s.flow_id = f.id and s.deleted_at is null
       where f.organization_id = new.organization_id and f.entity_type = 'leave_request'
         and f.activ and f.deleted_at is null
       order by s.ordine
    loop
      continue when exists (
        select 1 from public.approval_tasks t
         where t.entity_type = 'leave_request' and t.entity_id = new.id
           and t.step_id = v_step.id and t.deleted_at is null
      );

      with inseratii as (
        insert into public.approval_tasks
          (organization_id, flow_id, step_id, entity_type, entity_id, ordine,
           approver_user_id, approver_employee_id, termen_la)
        select new.organization_id, v_step.flow_id, v_step.id, 'leave_request', new.id, v_step.ordine,
               c.user_id, c.employee_id,
               case when v_step.sla_ore is null then null else now() + make_interval(hours => v_step.sla_ore) end
          from internal.rezolva_aprobatori(new.organization_id, v_step.id, new.employee_id) c
        returning 1
      )
      select count(*) into v_n_cand from inseratii;

      if v_n_cand > 25 then
        raise exception using errcode = 'P0001',
          message = 'Pasul de aprobare vizează prea multe persoane; restrângeți-l.';
      end if;

      if v_n_cand = 0 and not v_step.optional then
        -- Mulțime vidă pe un pas obligatoriu: ESCALADARE, nu sărire și nu
        -- blocare. Se reia rezolvarea ca pentru un pas virtual
        -- permission_key='leave:approve', scope 'all'.
        with inseratii_escl as (
          insert into public.approval_tasks
            (organization_id, flow_id, step_id, entity_type, entity_id, ordine,
             approver_user_id, approver_employee_id, termen_la)
          select new.organization_id, v_step.flow_id, v_step.id, 'leave_request', new.id, v_step.ordine,
                 e.user_id, e.employee_id,
                 case when v_step.sla_ore is null then null else now() + make_interval(hours => v_step.sla_ore) end
            from (
              select distinct on (m.user_id) m.user_id,
                     (select em.id from public.employees em
                       where em.organization_id = new.organization_id and em.user_id = m.user_id
                         and em.is_primary and em.deleted_at is null) as employee_id
                from public.organization_members m
                join public.role_permissions rp
                  on rp.role = m.role and rp.deleted_at is null
                 and rp.resource = 'leave' and rp.action = 'approve'
                 and (rp.organization_id = new.organization_id or rp.organization_id is null)
               where m.organization_id = new.organization_id and m.deleted_at is null and m.status = 'active'
                 and rp.scope = 'all'
                 and m.user_id is distinct from (
                       select e2.user_id from public.employees e2
                        where e2.id = new.employee_id and e2.deleted_at is null)
               order by m.user_id, (rp.organization_id is null) asc
            ) e
          returning 1
        )
        select count(*) into v_n_escl from inseratii_escl;

        if v_n_escl > 25 then
          raise exception using errcode = 'P0001',
            message = 'Pasul de aprobare vizează prea multe persoane; restrângeți-l.';
        end if;

        if v_n_escl > 0 then
          perform app.write_audit('update', new.organization_id, 'leave_requests', new.id, null,
            jsonb_build_object('eveniment', 'escaladare_fara_manager', 'step_id', v_step.id,
                                'candidati', v_n_escl));
        else
          -- Firma cu un singur om: nimeni nu poate decide. O singură sarcină
          -- auto-aprobată, cu urmă explicită — nu se blochează, nu se sare tăcut.
          insert into public.approval_tasks
            (organization_id, flow_id, step_id, entity_type, entity_id, ordine,
             approver_user_id, approver_employee_id, status, decis_la, comentariu)
          values
            (new.organization_id, v_step.flow_id, v_step.id, 'leave_request', new.id, v_step.ordine,
             null, null, 'aprobata', now(), 'Pas fără destinatar — aprobat automat');

          perform app.write_audit('update', new.organization_id, 'leave_requests', new.id, null,
            jsonb_build_object('eveniment', 'pas_fara_destinatar', 'step_id', v_step.id));
        end if;
      end if;
    end loop;
  end if;

  if tg_op = 'INSERT' or old.status is distinct from new.status
     or old.data_inceput <> new.data_inceput or old.data_sfarsit <> new.data_sfarsit then
    perform internal.recalc_sold(new.organization_id, new.employee_id, new.leave_type_id,
                                 extract(year from new.data_inceput)::int, new.id);
    if extract(year from new.data_sfarsit)::int <> extract(year from new.data_inceput)::int then
      perform internal.recalc_sold(new.organization_id, new.employee_id, new.leave_type_id,
                                   extract(year from new.data_sfarsit)::int, new.id);
    end if;
  end if;
  return null;
end; $function$
;

-- =====================================================================================
-- 5. Soldul: o zi lucrătoare aprobată valorează o zi
-- =====================================================================================
-- `sum(case when portiune = 'zi_intreaga' then 1 else 0.5 end)` devine
-- `count(*)`: filtrul `d.este_lucratoare` din `where` face deja selecția.

CREATE OR REPLACE FUNCTION internal.recalc_sold(p_org uuid, p_employee uuid, p_type uuid, p_an integer, p_cerere uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_folosite numeric(6,2); v_asteptare numeric(6,2); v_vechi numeric(6,2); v_vechi_ast numeric(6,2);
  v_id uuid;
  v_scade boolean; v_denumire text;
  v_ramase numeric(6,2);
begin
  select lt.scade_din_sold, lt.denumire into v_scade, v_denumire
    from public.leave_types lt where lt.id = p_type;

  if not coalesce(v_scade, true) then
    return;
  end if;

  v_id := internal.asigura_sold(p_org, p_employee, p_type, p_an);

  select count(*)
    into v_folosite
    from public.leave_request_days d
    join public.leave_requests r on r.id = d.leave_request_id
   where r.organization_id = p_org and r.employee_id = p_employee
     and r.leave_type_id = p_type and r.deleted_at is null
     and d.este_lucratoare and d.status = 'aprobata'
     and extract(year from d.data)::int = p_an;

  select count(*)
    into v_asteptare
    from public.leave_request_days d
    join public.leave_requests r on r.id = d.leave_request_id
   where r.organization_id = p_org and r.employee_id = p_employee
     and r.leave_type_id = p_type and r.deleted_at is null
     and d.este_lucratoare and d.status in ('trimisa', 'in_aprobare')
     and extract(year from d.data)::int = p_an;

  select folosite, in_asteptare into v_vechi, v_vechi_ast
    from public.leave_balances where id = v_id for update;

  update public.leave_balances
     set folosite = v_folosite, in_asteptare = v_asteptare, updated_at = now()
   where id = v_id
  returning ramase into v_ramase;

  if v_scade and v_ramase < 0
     and (v_folosite + v_asteptare) > (v_vechi + v_vechi_ast) then
    raise exception using errcode = 'P0001', message = format(
      'Soldul de „%s" pe anul %s nu acoperă zilele solicitate: lipsesc %s zile. '
      'Reduceți perioada sau cereți ajustarea dreptului anual.',
      v_denumire, p_an, trim(to_char(-v_ramase, 'FM9990D00')));
  end if;

  if v_folosite <> v_vechi then
    insert into public.leave_accruals
      (organization_id, employee_id, leave_type_id, an, eveniment, delta, sold_dupa, motiv, leave_request_id)
    select p_org, p_employee, p_type, p_an,
           (case when v_folosite > v_vechi then 'consum' else 'restituire' end)::public.leave_accrual_event,
           (v_vechi - v_folosite),
           b.ramase,
           case when v_folosite > v_vechi
                then 'Zile consumate prin cerere de concediu aprobată.'
                else 'Zile restituite (cerere anulată sau concediu întrerupt).' end,
           p_cerere
      from public.leave_balances b where b.id = v_id;
  end if;
end;
$function$
;

-- =====================================================================================
-- 6. Rotunjirea acumulării nu mai produce jumătăți de zi
-- =====================================================================================

update public.leave_types
   set mod_rotunjire_acumulare = 'zi_in_sus', updated_at = now()
 where mod_rotunjire_acumulare = 'jumatate_in_sus';

update public.leave_types
   set mod_rotunjire_acumulare = 'zi_in_jos', updated_at = now()
 where mod_rotunjire_acumulare = 'jumatate_in_jos';

alter table public.leave_types
  alter column mod_rotunjire_acumulare set default 'zi_in_sus';

alter table public.leave_types
  add constraint leave_types_rotunjire_fara_jumatati
  check (mod_rotunjire_acumulare not in ('jumatate_in_sus', 'jumatate_in_jos'));

-- =====================================================================================
-- 7. Seed-ul organizațiilor viitoare
-- =====================================================================================
-- Fără asta, prima organizație creată după migrare ar cădea pe constrângerea de
-- mai sus: seed-ul scrie explicit `'jumatate_in_sus'` pentru `odihna`, singurul
-- tip care nu e pe `fara_rotunjire`.

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
    ('odihna',        'Concediu de odihnă',                          20, true,  false, true,  18,   false, 'zi_in_sus', 20, '#2563EB', 'Codul Muncii art. 145 (DE VERIFICAT)', false, 'concediu'),
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
end; $function$
;

revoke all on function internal.seed_leave_defaults(uuid) from public, anon, authenticated;

commit;
