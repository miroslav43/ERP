-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_audit_ip_robust.sql — auditul nu mai poate fi dezactivat dintr-un antet
--
-- DEFECTUL, verificat empiric înainte de corecție:
-- `log_audit_event` primea IP-ul ca `text` și îl convertea cu `p_ip::inet`.
-- Valoarea vine din antetul `X-Forwarded-For`, care este trimis de client și
-- deci complet controlabil de el. Un antet care nu e o adresă IP face cast-ul
-- să arunce 22P02:
--
--   select public.log_audit_event('login_failed', 'failure', null, 'test',
--          null, null, null, '<script>alert(1)</script>', 'ua', 'req', null);
--   ERROR: invalid input syntax for type inet: "<script>alert(1)</script>"
--
-- Consecința nu este o eroare cosmetică. `createAction` scrie în audit atât la
-- succes, cât și la refuz. Un atacator care trimite un `X-Forwarded-For`
-- invalid face ca FIECARE scriere în jurnal să eșueze — deci fie își blochează
-- propriile acțiuni, fie, mai grav, le execută fără să lase urmă. Pentru un ERP
-- multi-tenant, evaziunea din jurnalul de audit este exact ce nu ne permitem.
--
-- CORECȚIA: conversia devine tolerantă. O adresă nevalidă se înregistrează ca
-- `NULL`, iar rândul de audit se scrie oricum. Un IP lipsă este o pierdere de
-- informație acceptabilă; un eveniment neînregistrat nu este.
-- ─────────────────────────────────────────────────────────────────────────────

-- Conversie care nu aruncă niciodată. `strict` face funcția să întoarcă NULL
-- pentru intrare NULL fără să mai execute corpul.
create or replace function internal.to_inet_safe(p_valoare text)
returns inet
language plpgsql
immutable
strict
set search_path = ''
as $$
begin
  -- Antetul poate conține și portul („1.2.3.4:5678”) sau spații; păstrăm doar
  -- prima parte plauzibilă și lăsăm Postgres să judece restul.
  return btrim(split_part(p_valoare, ':', 1))::inet;
exception when others then
  -- Inclusiv IPv6, unde `split_part` pe „:” ar rupe adresa: încercăm întreg.
  begin
    return btrim(p_valoare)::inet;
  exception when others then
    return null;
  end;
end;
$$;

comment on function internal.to_inet_safe(text) is
  'Conversie text→inet care întoarce NULL în loc să arunce. Intrarea vine dintr-un antet controlat de client.';

revoke execute on function internal.to_inet_safe(text) from public, anon, authenticated;

create or replace function public.log_audit_event(
  p_action          public.audit_action,
  p_status          public.audit_status default 'success',
  p_organization_id uuid    default null,
  p_entity_type     text    default null,
  p_entity_id       uuid    default null,
  p_before          jsonb   default null,
  p_after           jsonb   default null,
  p_ip              text    default null,
  p_user_agent      text    default null,
  p_request_id      text    default null,
  p_error_code      text    default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_organization_id is not null
     and not app.is_member(p_organization_id)
     and not app.is_platform_admin()
     and not app.is_service_context() then
    raise exception 'Acces interzis la jurnalul acestei organizații.' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, action, status, entity_type, entity_id,
    before, after, ip, user_agent, request_id, error_code
  )
  values (
    p_organization_id, (select auth.uid()), p_action, p_status, p_entity_type, p_entity_id,
    p_before, p_after,
    internal.to_inet_safe(nullif(p_ip, 'necunoscut')),
    -- Antetele sunt și ele controlate de client: le tăiem la o lungime rezonabilă
    -- ca un `User-Agent` de un megaoctet să nu umple tabela de audit.
    left(p_user_agent, 512),
    left(p_request_id, 128),
    left(p_error_code, 64)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.log_audit_event(
  public.audit_action, public.audit_status, uuid, text, uuid, jsonb, jsonb, text, text, text, text
) from public, anon;
grant execute on function public.log_audit_event(
  public.audit_action, public.audit_status, uuid, text, uuid, jsonb, jsonb, text, text, text, text
) to authenticated, service_role;
