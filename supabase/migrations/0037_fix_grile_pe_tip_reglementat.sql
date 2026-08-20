-- supabase/migrations/0037_fix_grile_pe_tip_reglementat.sql
-- Gaură rămasă în 0035_reguli_concediu.sql: `internal.leave_types_protejeaza_reglementat`
-- blochează editarea DIRECTĂ a `leave_types.zile_implicite` pe un tip reglementat
-- (medical, maternitate, creștere copil, paternal, îngrijitor, donator de
-- sânge), dar nimic nu împiedica o grilă din `leave_entitlement_rules` să
-- adauge zile suplimentare pe același tip, prin `leave_type_id` — o cale
-- ocolită spre exact ce trigger-ul de mai sus interzice. Cerința clientului
-- ("patronul nu poate modifica numărul de zile" pe tipurile fixe) se aplică
-- indiferent de cale.

begin;

create or replace function internal.leave_entitlement_rules_interzice_reglementat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reglementat boolean;
  v_denumire    text;
begin
  select lt.reglementat, lt.denumire into v_reglementat, v_denumire
  from public.leave_types lt
  where lt.id = new.leave_type_id;

  if coalesce(v_reglementat, false) then
    raise exception using errcode = 'P0001', message = format(
      '„%s" este un concediu reglementat legal — nu poate primi zile suplimentare din '
      'grilele companiei.', coalesce(v_denumire, 'Tipul de concediu')
    );
  end if;
  return new;
end;
$$;

revoke all on function internal.leave_entitlement_rules_interzice_reglementat()
  from public, anon, authenticated;

create trigger trg_ler_interzice_reglementat
  before insert or update on public.leave_entitlement_rules
  for each row execute function internal.leave_entitlement_rules_interzice_reglementat();

commit;
