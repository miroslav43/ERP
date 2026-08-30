-- =====================================================================================
-- 0108_drepturile_mele_concediu.sql
--
-- Scrisă ca 0107, renumerotată la merge: `0107_departamentul_conducere.sql`
-- ocupase deja numărul și era APLICATĂ pe bază (30 aug), iar regula
-- forward-only interzice mutarea celei aplicate. Se mută cea care n-a plecat
-- încă nicăieri. Conținutul e neatins.
--
-- Angajatul își vede, din portal, la ce tipuri de concediu are dreptul și câte
-- zile la fiecare — după setările firmei lui, nu după o listă generică.
--
-- ── DE CE O FUNCȚIE ȘI NU O INTEROGARE DIN APLICAȚIE ─────────────────────────
-- Calculul există deja, întreg, în `app.drept_concediu` (0035:179): baza din
-- `leave_types.zile_implicite` plus grilele care i se aplică omului — vechime,
-- condiții de muncă, grad de handicap, vârstă sub 18, departament, funcție.
-- Migrarea asta NU rescrie nicio formulă; doar o face ajungibilă.
--
-- Două ziduri o făceau inaccesibilă din portal:
--
--   1. `app.drept_concediu` stă în schema `app`, iar PostgREST expune doar
--      `public` — `.rpc()` nu ajunge niciodată la ea.
--
--   2. Angajatul NU poate citi `leave_entitlement_rules`: politica `ler_select`
--      (0009:917) cere `leave:read = all`, iar el are `own`. Ar fi primit zero
--      grile FĂRĂ NICIO EROARE, deci un calcul făcut în aplicație i-ar fi arătat
--      liniștit doar baza, fără sporurile la care are dreptul. Exact tiparul
--      tăcut din `docs/design/ecrane/capcane.md`.
--
-- ── CE NU FACE ───────────────────────────────────────────────────────────────
-- Nu primește niciun identificator de angajat. Fișa se rezolvă ÎNĂUNTRU, din
-- `app.current_employee_id()`, deci nimeni nu poate cere drepturile altcuiva
-- schimbând un parametru. Organizația se verifică față de apartenența reală
-- (`app.current_org_ids()`), nu față de cookie-ul de organizație.
--
-- Nu scrie nimic: `stable`, fără `insert`/`update`. Soldul rămâne materializat
-- de „Aplică drepturile" din ecranul de setări; asta e doar o oglindă.
-- =====================================================================================

begin;

create or replace function public.drepturile_mele_concediu(
  p_organization_id uuid,
  p_an integer
)
returns table (
  leave_type_id  uuid,
  denumire       text,
  zile           numeric,
  reglementat    boolean,
  scade_din_sold boolean,
  temei_legal    text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_employee uuid;
begin
  -- Apartenența reală, nu organizația din cookie. Un utilizator care nu e membru
  -- al firmei cerute primește zero rânduri, nu o eroare care i-ar confirma că
  -- firma există.
  if not (p_organization_id = any (app.current_org_ids())) then
    return;
  end if;

  v_employee := app.current_employee_id(p_organization_id);

  -- Cont fără fișă de angajat (de pildă un `org_admin` care nu e și angajat):
  -- n-are drepturi proprii de arătat, deci lista e goală. Ecranul are deja o
  -- stare pentru asta — vezi `FaraFisa`.
  if v_employee is null then
    return;
  end if;

  return query
    select
      lt.id,
      lt.denumire,
      app.drept_concediu(p_organization_id, v_employee, lt.id, p_an),
      lt.reglementat,
      lt.scade_din_sold,
      lt.temei_legal
    from public.leave_types lt
    where lt.organization_id = p_organization_id
      and lt.activ
      and lt.deleted_at is null
    order by lt.scade_din_sold desc, lt.denumire;
end;
$$;

comment on function public.drepturile_mele_concediu(uuid, integer) is
  'Drepturile de concediu ale utilizatorului AUTENTIFICAT în organizația dată, pe an: '
  'un rând per tip activ, cu zilele calculate de app.drept_concediu (bază + grile). '
  'Nu primește employee_id — fișa se rezolvă din app.current_employee_id(), deci nu poate '
  'întoarce drepturile altcuiva. Read-only: soldul rămâne scris de aplica_drepturi_concediu.';

revoke all on function public.drepturile_mele_concediu(uuid, integer) from public;
grant execute on function public.drepturile_mele_concediu(uuid, integer) to authenticated;

commit;
