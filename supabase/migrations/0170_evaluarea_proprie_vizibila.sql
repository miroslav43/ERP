-- supabase/migrations/0170_evaluarea_proprie_vizibila.sql
--
-- MANAGERUL NU-ȘI MAI SCRIE SINGUR EVALUAREA; O VEDE DOAR FINALIZATĂ.
--
-- ── DEFECTUL ────────────────────────────────────────────────────────────────
-- `app.can_access_evaluation` pe scope `team` întreabă `app.is_manager_of`,
-- adică „apelantul e în `manager_path`-ul angajatului”. Dar `manager_path`
-- îl conține și pe angajatul ÎNSUȘI (verificat pe date reale, 6 oct 2026:
-- Pervulescu Razvan, manager, `id = any(manager_path)` adevărat). Deci pentru
-- propria fișă `is_manager_of` e adevărat, iar un manager:
--   · își vedea CIORNA propriei evaluări — concluzia pe jumătate scrisă a
--     șefului lui, exact ce 0119 a ascuns angajaților;
--   · și-o putea MODIFICA și FINALIZA singur (politica UPDATE trece prin
--     aceeași funcție, cu scope `team` pe `evaluations:update`);
--   · își putea CREA o evaluare (politica INSERT, `evaluations:create = team`).
-- Ecranele nu ofereau drumul — lista „Evaluare nouă” exclude propria fișă —
-- dar baza îl lăsa deschis oricui scria direct.
--
-- ── REPARAȚIA ───────────────────────────────────────────────────────────────
-- 1. `can_access_evaluation`, pe `team`: echipa NU include propria fișă. Asta
--    închide citirea ciornei, modificarea și crearea, în toate cele trei
--    politici care o folosesc (și numai ele o folosesc).
-- 2. `employee_evaluations_select`: o ramură în plus — evaluarea proprie se
--    vede, dar numai FINALIZATĂ, pentru orice rol. Fără ea, punctul 1 i-ar fi
--    luat managerului și evaluarea încheiată, pe care trebuie s-o vadă.
-- `is_manager_of` rămâne cum e: îl folosesc și alte module (concedii, pontaj),
-- iar acolo includerea propriei fișe e o alegere a lor, nu a evaluărilor.
-- Scope-ul `all` (HR, administrator) nu se schimbă.

begin;

-- ============================================================
-- 1. FUNCȚIA — echipa fără propria fișă
-- ============================================================

create or replace function app.can_access_evaluation(p_org uuid, p_employee uuid, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case app.has_permission(p_org, 'evaluations', p_action)
    when 'all' then true
    when 'team' then app.is_manager_of(p_org, p_employee)
                     and p_employee is distinct from app.current_employee_id(p_org)
    when 'own' then p_employee = app.current_employee_id(p_org)
    else false
  end
$$;

comment on function app.can_access_evaluation(uuid, uuid, text) is
  'Accesul la evaluarea unui angajat, după scope-ul permisiunii evaluations.<acțiune>. Pe team, echipa exclude propria fișă (0170): nimeni nu-și scrie singur evaluarea.';

revoke all on function app.can_access_evaluation(uuid, uuid, text) from public;
grant execute on function app.can_access_evaluation(uuid, uuid, text) to authenticated;

-- ============================================================
-- 2. POLITICA SELECT — evaluarea proprie, doar finalizată
-- ============================================================

drop policy if exists employee_evaluations_select on public.employee_evaluations;

create policy employee_evaluations_select on public.employee_evaluations
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and deleted_at is null
    and (
      (
        app.can_access_evaluation(organization_id, employee_id, 'read')
        and (
          status = 'finalizat'
          or app.has_permission(organization_id, 'evaluations', 'read') <> 'own'
        )
      )
      or (
        status = 'finalizat'
        and employee_id = app.current_employee_id(organization_id)
      )
    )
  );

commit;
