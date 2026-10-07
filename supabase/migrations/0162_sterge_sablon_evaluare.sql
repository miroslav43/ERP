-- supabase/migrations/0162_sterge_sablon_evaluare.sql
--
-- ȘTERGEREA UNUI ȘABLON DE EVALUARE NEFOLOSIT.
--
-- ── DE CE ───────────────────────────────────────────────────────────────────
-- Ecranul `/evaluari/sabloane` avea doar „Arhivează”. Pentru un șablon folosit
-- e corect: evaluările făcute pe el îl referă (`employee_evaluations.template_id`,
-- `on delete restrict`), iar arhiva îl ține la vedere. Pentru o copie făcută din
-- greșeală, nefolosită niciodată, arhiva lasă doar gunoi permanent în listă —
-- șablonul arhivat RĂMÂNE afișat, cu pastila „Arhivat”.
--
-- ── DE CE O FUNCȚIE, ȘI NU UN UPDATE DIN APLICAȚIE ──────────────────────────
-- `evaluation_templates_select` (0072) începe cu `deleted_at is null`. Un
-- `update … set deleted_at = now() where id = …` dat ca `authenticated` pică
-- ÎNTOTDEAUNA cu 42501 „new row violates row-level security policy”: clauza
-- WHERE citește coloane, deci Postgres aplică politica SELECT și rândului NOU,
-- iar rândul nou e exact cel pe care politica îl ascunde. Verificat pe
-- Postgres 17 cu o tabelă minimală, CU și FĂRĂ `returning` — pică în ambele
-- cazuri. Nu e capcana 28 (aceea e despre INSERT … RETURNING); e aceeași
-- familie, pe UPDATE.
--
-- Alternativa — scoaterea lui `deleted_at is null` din politica SELECT — ar fi
-- mutat filtrul în fiecare citire din aplicație, iar prima citire care îl uită
-- ar fi arătat șabloanele șterse. Funcția face autorizarea explicit, cu
-- aceleași predicate ca `evaluation_templates_update` (0150), plus regula
-- „nefolosit” pe care politica n-o poate exprima fără un subselect tăcut.
--
-- ── CE REFUZĂ ───────────────────────────────────────────────────────────────
-- · modulul `evaluations` inactiv                             → P0001
-- · lipsa `evaluations:update = all` în firma dată            → 42501
-- · șablon inexistent, din altă firmă, deja șters, de platformă → P0002
-- · șablon folosit de cel puțin o evaluare nearhivată         → P0001
-- Mesajele sunt pentru om: acțiunea le transmite ca atare.

begin;

-- ============================================================
-- 1. FUNCȚIA
-- ============================================================

create or replace function public.sterge_sablon_evaluare(
  p_organization_id uuid,
  p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_evaluari integer;
begin
  if not (p_organization_id = any ((select app.current_org_ids())::uuid[])) then
    raise exception 'Nu aveți dreptul să ștergeți șabloane în această organizație.' using errcode = '42501';
  end if;
  if not app.feature_on(p_organization_id, 'evaluations') then
    raise exception 'Modulul de evaluări nu este activ pentru această organizație.' using errcode = 'P0001';
  end if;
  if app.has_permission(p_organization_id, 'evaluations', 'update') <> 'all' then
    raise exception 'Nu aveți dreptul să ștergeți șabloane de evaluare.' using errcode = '42501';
  end if;

  -- `for update` ține rândul până la commit: o evaluare creată între numărare și
  -- ștergere ar fi rămas pe un șablon șters.
  select t.id into v_id
    from public.evaluation_templates t
   where t.id = p_id
     and t.organization_id = p_organization_id
     and t.deleted_at is null
   for update;
  if v_id is null then
    raise exception 'Șablonul nu mai există sau nu poate fi șters.' using errcode = 'P0002';
  end if;

  select count(*) into v_evaluari
    from public.employee_evaluations e
   where e.template_id = p_id
     and e.deleted_at is null;
  if v_evaluari > 0 then
    raise exception 'Șablonul este folosit de % %, deci nu poate fi șters. Arhivați-l: evaluările făcute pe el rămân neatinse.',
      v_evaluari, case when v_evaluari = 1 then 'evaluare' else 'evaluări' end
      using errcode = 'P0001';
  end if;

  update public.evaluation_templates
     set deleted_at = now(),
         activ = false,
         updated_by = (select auth.uid())
   where id = p_id;

  return p_id;
end;
$$;

comment on function public.sterge_sablon_evaluare(uuid, uuid) is
  'Ștergere logică a unui șablon de evaluare al firmei, doar dacă nicio evaluare nu-l folosește. '
  'SECURITY DEFINER fiindcă politica SELECT ascunde rândurile șterse — vezi 0162.';

-- ============================================================
-- 2. DREPTURI
-- ============================================================

revoke all on function public.sterge_sablon_evaluare(uuid, uuid) from public, anon;
grant execute on function public.sterge_sablon_evaluare(uuid, uuid) to authenticated;

commit;
