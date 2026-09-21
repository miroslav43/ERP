-- supabase/migrations/0150_regulile_modulelor.sql
--
-- REGULI DE MODUL CARE TRĂIAU DOAR ÎN SERVER ACTION.
--
-- ── DE UNDE VINE MIGRAREA ───────────────────────────────────────────────────
-- Ultima parte din lotul 5 al auditului „atinge frontendul baza direct?"
-- (`docs/audit-frontend-baza-2026-09-21.md`). Patru reguli care se citeau în cod
-- și nu se verificau în bază.
--
-- ── (F22) MODULUL NEACTIVAT SE PUTEA FOLOSI ────────────────────────────────
-- Poarta de modul (`requireFeature`) există doar în pagini și acțiuni. 22 de
-- politici de scriere — KPI, evaluări, tichete — nu cheamă `app.feature_on`, nici
-- direct, nici printr-un helper. O firmă fără abonament la modulul acela îl putea
-- folosi prin PostgREST, cu propria sesiune: ocolire de licențiere, nu de date.
-- Politicile de mai jos sunt REGENERATE din definițiile live, cu garda adăugată
-- în față — nu rescrise de mână, ca să nu se piardă nicio condiție.
--
-- ── (F10) `maintenance:create = all` DESCHIDEA TOT CATALOGUL ───────────────
-- Cheia e dată în seed fiecărui angajat, ca să poată depune o SESIZARE. Dar
-- `app.ssm_acces(org, resursa, "create", null)` e poarta pentru toate tabelele
-- modulului, deci un angajat obișnuit putea insera direct intervenții „reușite"
-- (care sting scadențe legale și scriu proces-verbal în registrul oficial),
-- autorizații ISCIR valabile zeci de ani, echipamente, planuri și citiri de
-- contor. Catalogul cere de acum `maintenance:update`; sesizarea rămâne pe
-- `create`, dar numai în numele propriu.
--
-- ── (F29, F30) CONCEDIILE ──────────────────────────────────────────────────
-- Decizia de business din `0056_concedii_hr_nu_aproba.sql` — „HR înregistrează,
-- nu aprobă" — trăia doar în acțiune: cu `leave:update = all`, un PATCH direct
-- trecea orice cerere pe „aprobată". Iar solicitantul își putea modifica
-- perioada și tipul după trimitere, deși ecranul nu i-o mai permite.
--
-- ── (F19) DOCUMENTUL CERERII DE CONCEDIU ───────────────────────────────────
-- `verificaCaleaDocumentului` se uită dacă fișierul e sub prefixul fișei — în
-- acțiune. Prin PostgREST se putea trimite calea documentului unui COLEG, iar
-- aprobatorul o deschidea cu propriile drepturi, crezând că e justificarea
-- cererii.
--
-- ── CE NU ATINGE ────────────────────────────────────────────────────────────
-- F33 (FK-uri compuse, ca departamentul să nu poată fi al altei firme) și F36
-- (regulile contractului de muncă) cer chei unice noi și o migrare de date; sunt
-- notate în audit ca rămase, cu tot cu motivul.

begin;

-- ── 1. F22: poarta de modul, în politici ──────────────────────────────────
drop policy if exists employee_evaluations_insert on public.employee_evaluations;
create policy employee_evaluations_insert on public.employee_evaluations
for insert to authenticated
with check (
  app.feature_on(organization_id, 'evaluations')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.can_access_evaluation(organization_id, employee_id, 'create'::text) AND (deleted_at IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists employee_evaluations_update on public.employee_evaluations;
create policy employee_evaluations_update on public.employee_evaluations
for update to authenticated
using (
  app.feature_on(organization_id, 'evaluations')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (deleted_at IS NULL) AND app.can_access_evaluation(organization_id, employee_id, 'update'::text) AND ((status = 'draft'::evaluation_status) OR (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = 'all'::permission_scope))))
)
with check (
  app.feature_on(organization_id, 'evaluations')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.can_access_evaluation(organization_id, employee_id, 'update'::text) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists evaluation_templates_insert on public.evaluation_templates;
create policy evaluation_templates_insert on public.evaluation_templates
for insert to authenticated
with check (
  app.feature_on(organization_id, 'evaluations')
  and (((organization_id IS NOT NULL) AND (organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = 'all'::permission_scope) AND (deleted_at IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists evaluation_templates_update on public.evaluation_templates;
create policy evaluation_templates_update on public.evaluation_templates
for update to authenticated
using (
  app.feature_on(organization_id, 'evaluations')
  and (((organization_id IS NOT NULL) AND (organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = 'all'::permission_scope) AND (deleted_at IS NULL)))
)
with check (
  app.feature_on(organization_id, 'evaluations')
  and (((organization_id IS NOT NULL) AND (organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = 'all'::permission_scope) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_evaluari_lunare_insert on public.kpi_evaluari_lunare;
create policy kpi_evaluari_lunare_insert on public.kpi_evaluari_lunare
for insert to authenticated
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.can_access_kpi(organization_id, employee_id, 'create'::text) AND (deleted_at IS NULL) AND (status = 'draft'::evaluation_status) AND (created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_evaluari_lunare_update on public.kpi_evaluari_lunare;
create policy kpi_evaluari_lunare_update on public.kpi_evaluari_lunare
for update to authenticated
using (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (deleted_at IS NULL) AND (status = 'draft'::evaluation_status) AND app.can_access_kpi(organization_id, employee_id, 'update'::text)))
)
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.can_access_kpi(organization_id, employee_id, 'update'::text) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_indicatori_insert on public.kpi_indicatori;
create policy kpi_indicatori_insert on public.kpi_indicatori
for insert to authenticated
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = ANY (ARRAY['all'::permission_scope, 'team'::permission_scope])) AND (deleted_at IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_indicatori_update on public.kpi_indicatori;
create policy kpi_indicatori_update on public.kpi_indicatori
for update to authenticated
using (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (deleted_at IS NULL) AND (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = ANY (ARRAY['all'::permission_scope, 'team'::permission_scope]))))
)
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = ANY (ARRAY['all'::permission_scope, 'team'::permission_scope])) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_seturi_insert on public.kpi_seturi;
create policy kpi_seturi_insert on public.kpi_seturi
for insert to authenticated
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = ANY (ARRAY['all'::permission_scope, 'team'::permission_scope])) AND (deleted_at IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_seturi_update on public.kpi_seturi;
create policy kpi_seturi_update on public.kpi_seturi
for update to authenticated
using (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (deleted_at IS NULL) AND (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = ANY (ARRAY['all'::permission_scope, 'team'::permission_scope]))))
)
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (app.has_permission(organization_id, 'evaluations'::text, 'update'::text) = ANY (ARRAY['all'::permission_scope, 'team'::permission_scope])) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_tinte_angajat_insert on public.kpi_tinte_angajat;
create policy kpi_tinte_angajat_insert on public.kpi_tinte_angajat
for insert to authenticated
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.can_access_kpi(organization_id, employee_id, 'update'::text) AND (deleted_at IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_tinte_angajat_update on public.kpi_tinte_angajat;
create policy kpi_tinte_angajat_update on public.kpi_tinte_angajat
for update to authenticated
using (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (deleted_at IS NULL) AND app.can_access_kpi(organization_id, employee_id, 'update'::text)))
)
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.can_access_kpi(organization_id, employee_id, 'update'::text) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_valori_insert on public.kpi_valori;
create policy kpi_valori_insert on public.kpi_valori
for insert to authenticated
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.acces_kpi_valoare(evaluare_id, 'create'::text) AND (deleted_at IS NULL) AND (created_by = ( SELECT auth.uid() AS uid)) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists kpi_valori_update on public.kpi_valori;
create policy kpi_valori_update on public.kpi_valori
for update to authenticated
using (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND (deleted_at IS NULL) AND app.acces_kpi_valoare(evaluare_id, 'update'::text)))
)
with check (
  app.feature_on(organization_id, 'kpi')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.acces_kpi_valoare(evaluare_id, 'update'::text) AND (updated_by = ( SELECT auth.uid() AS uid))))
);

drop policy if exists ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments
for insert to authenticated
with check (
  app.feature_on(organization_id, 'ticketing')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.pot_vedea_tichetul(ticket_id)))
);

drop policy if exists ticket_attachments_update on public.ticket_attachments;
create policy ticket_attachments_update on public.ticket_attachments
for update to authenticated
using (
  app.feature_on(organization_id, 'ticketing')
  and (((deleted_at IS NULL) AND (organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[]))))
)
with check (
  app.feature_on(organization_id, 'ticketing')
  and ((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])))
);

drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments
for insert to authenticated
with check (
  app.feature_on(organization_id, 'ticketing')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.pot_vedea_tichetul(ticket_id) AND ((intern = false) OR app.can(organization_id, 'tickets'::text, 'update'::text, 'team'::permission_scope)) AND (autor_employee_id = app.fisa_mea(organization_id))))
);

drop policy if exists ticket_comments_update on public.ticket_comments;
create policy ticket_comments_update on public.ticket_comments
for update to authenticated
using (
  app.feature_on(organization_id, 'ticketing')
  and (((deleted_at IS NULL) AND (autor_employee_id = app.fisa_mea(organization_id))))
)
with check (
  app.feature_on(organization_id, 'ticketing')
  and ((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])))
);

drop policy if exists ticket_watchers_insert on public.ticket_watchers;
create policy ticket_watchers_insert on public.ticket_watchers
for insert to authenticated
with check (
  app.feature_on(organization_id, 'ticketing')
  and (((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.pot_vedea_tichetul(ticket_id)))
);

drop policy if exists ticket_watchers_update on public.ticket_watchers;
create policy ticket_watchers_update on public.ticket_watchers
for update to authenticated
using (
  app.feature_on(organization_id, 'ticketing')
  and (((deleted_at IS NULL) AND (organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND ((employee_id = app.fisa_mea(organization_id)) OR app.can(organization_id, 'tickets'::text, 'update'::text, 'team'::permission_scope))))
)
with check (
  app.feature_on(organization_id, 'ticketing')
  and ((organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])))
);

drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets
for insert to authenticated
with check (
  app.feature_on(organization_id, 'ticketing')
  and (((deleted_at IS NULL) AND (organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND app.can(organization_id, 'tickets'::text, 'create'::text, 'own'::permission_scope) AND (solicitant_employee_id = app.fisa_mea(organization_id)) AND (status =
CASE
    WHEN (tip = ANY (ARRAY['software'::ticket_type, 'hardware'::ticket_type])) THEN 'in_aprobare'::ticket_status
    ELSE 'nou'::ticket_status
END) AND (COALESCE(prioritate_manuala, false) = false) AND (prioritate_motiv IS NULL) AND (asignat_employee_id IS NULL) AND (aprobat_de_employee_id IS NULL) AND (decizie_la IS NULL) AND (motiv_respingere IS NULL) AND (closed_at IS NULL)))
);

drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets
for update to authenticated
using (
  app.feature_on(organization_id, 'ticketing')
  and ((( SELECT app.is_platform_admin() AS is_platform_admin) OR ((deleted_at IS NULL) AND (organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[])) AND ((app.has_permission(organization_id, 'tickets'::text, 'update'::text) = 'all'::permission_scope) OR (solicitant_employee_id = app.fisa_mea(organization_id)) OR (asignat_employee_id = app.fisa_mea(organization_id)) OR app.sunt_manager_direct(solicitant_employee_id)))))
)
with check (
  app.feature_on(organization_id, 'ticketing')
  and ((( SELECT app.is_platform_admin() AS is_platform_admin) OR (organization_id = ANY (( SELECT app.current_org_ids() AS current_org_ids)::uuid[]))))
);

-- ── 2. F10: catalogul de mentenanță cere `update`, nu `create` ────────────
-- `fault_reports` (sesizarea) rămâne pe `create`, dar cu raportorul fixat pe
-- fișa apelantului: altfel oricine putea depune sesizări în numele altcuiva.
drop policy if exists fault_reports_insert on public.fault_reports;
create policy fault_reports_insert on public.fault_reports
for insert to authenticated
with check (
  organization_id = any ((select app.current_org_ids())::uuid[])
  and app.feature_on(organization_id, 'maintenance')
  and app.ssm_acces(organization_id, 'maintenance', 'create', raportat_de_employee_id)
  -- NULL rămâne permis: `tests/rls/izolare.sql` numără printre scrierile
  -- legitime sesizarea fără raportor — un defect semnalat de cineva care n-are
  -- fișă de personal, sau semnalat anonim. Ce se închide e numai semnarea ÎN
  -- NUMELE ALTCUIVA.
  and (
    raportat_de_employee_id is null
    or raportat_de_employee_id = app.fisa_mea(organization_id)
  )
  and deleted_at is null
);

do $$
declare
  v_tabela text;
begin
  -- Aceleași cinci tabele care formează catalogul: ce se întâmplă cu ele e
  -- administrare, nu sesizare.
  foreach v_tabela in array array[
    'equipment', 'maintenance_plans', 'maintenance_interventions',
    'iscir_authorizations', 'equipment_meters'
  ] loop
    execute format('drop policy if exists %I on public.%I', v_tabela || '_insert', v_tabela);
    execute format($f$
      create policy %I on public.%I
      for insert to authenticated
      with check (
        organization_id = any ((select app.current_org_ids())::uuid[])
        and app.feature_on(organization_id, 'maintenance')
        and app.ssm_acces(organization_id, 'maintenance', 'update', null)
        and deleted_at is null
      )
    $f$, v_tabela || '_insert', v_tabela);
  end loop;
end $$;

-- ── 3. F29 + F30 + F19: concediile ────────────────────────────────────────
create or replace function internal.leave_reguli_de_business()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
begin
  if app.is_service_context() then
    return new;
  end if;

  -- (F19) Documentul trebuie să fie sub dosarul fișei din cerere. Verificarea
  -- exista doar în `concedii/actions.ts`, deci un PATCH direct putea lega
  -- documentul unui coleg — pe care aprobatorul îl deschide apoi cu drepturile
  -- lui, crezând că e justificarea cererii.
  if new.atasament_path is not null then
    v_prefix := new.organization_id::text || '/leave/' || new.employee_id::text || '/';
    if position(v_prefix in new.atasament_path) <> 1
       or new.atasament_path ~ '(^|/)\.\.(/|$)' then
      raise exception 'Documentul atașat nu aparține dosarului acestei cereri.'
        using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    -- (F29) Decizia cere dreptul de APROBARE, nu pe cel de editare. `hr` are
    -- `leave:update = all` tocmai ca să înregistreze cereri în numele altcuiva
    -- (0056), dar decizia nu-i aparține.
    if new.status is distinct from old.status
       and new.status in ('aprobata', 'respinsa')
       and not (
         app.can(new.organization_id, 'leave', 'approve', 'all')
         or (app.has_permission(new.organization_id, 'leave', 'approve') = 'team'
             and app.is_manager_of(new.organization_id, new.employee_id))
       ) then
      raise exception 'Decizia asupra cererii de concediu o ia doar cine are dreptul de aprobare.'
        using errcode = 'P0001';
    end if;

    -- (F30) După trimitere, conținutul cererii e înghețat pentru solicitant:
    -- perioada, tipul și porțiunile de zi. Anularea și decizia rămân posibile.
    if old.status not in ('ciorna', 'respinsa')
       and new.employee_id = app.current_employee_id(new.organization_id)
       and (new.data_inceput, new.data_sfarsit, new.leave_type_id,
            new.portiune_inceput, new.portiune_sfarsit, new.leave_variant_id)
           is distinct from
           (old.data_inceput, old.data_sfarsit, old.leave_type_id,
            old.portiune_inceput, old.portiune_sfarsit, old.leave_variant_id) then
      raise exception 'Cererea a fost deja trimisă: perioada și tipul nu se mai pot schimba. Anuleaz-o și depune alta.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal.leave_reguli_de_business() from public, anon;

-- `zz_` ca să ruleze după `trg_leave_requests_pregateste`, care normalizează
-- datele: garda trebuie să vadă valorile finale, nu pe cele trimise.
drop trigger if exists zz_leave_reguli_de_business on public.leave_requests;
create trigger zz_leave_reguli_de_business
  before insert or update on public.leave_requests
  for each row execute function internal.leave_reguli_de_business();

commit;
