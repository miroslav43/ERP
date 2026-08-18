-- ─────────────────────────────────────────────────────────────────────────────
-- 0010b_fix_garda_audit.sql — garda R9 nu mai confundă „secretar" cu „secret"
--
-- `internal.audit_forbidden_patterns()` din 0002 refuză atașarea triggerului
-- generic de audit pe orice tabelă care are o coloană cu aspect de secret. E
-- regula corectă: un rând de audit care conține criptotext, un hash de token
-- sau o parolă e o A DOUA copie a datei sensibile, într-o tabelă cu alte reguli
-- de acces și altă retenție.
--
-- Tiparul `%secret%` era însă prea larg pentru limba română. Faza 7 a picat pe
-- `safety_committee_meetings.secretar_employee_id` — secretarul comitetului de
-- securitate și sănătate în muncă:
--
--   ERROR: R9: tabela public.safety_committee_meetings conține coloane
--          sensibile (secretar_employee_id)
--
-- Coloana e un `uuid` care trimite la un angajat. Nu are nimic secret în ea.
-- Consecința nu era o scurgere, ci opusul: o tabelă din registrul obligatoriu
-- ITM rămânea complet NEauditată, iar migrarea se oprea.
--
-- Efectul secundar mai puțin vizibil e că un fals pozitiv erodează regula
-- însăși: dezvoltatorul care se lovește de el a doua oară scoate garda, nu
-- tiparul. De aceea îl restrâng acum, nu îl ocolesc.
--
-- Restrângerea: `secret` devine cuvânt de sine stătător sau segment delimitat de
-- underscore (`client_secret`, `secret_key`, `app_secret_v2`), niciodată prefix
-- al altui cuvânt. `secretar` nu mai intră; `secretariat_token` intră în
-- continuare, prin tiparul `%token%`.
--
-- Celelalte tipare rămân neatinse. `%hash%` și `%parol%` nu au echivalent
-- românesc care să producă aceeași coliziune — „parola" ESTE cuvântul căutat,
-- iar „hash" nu apare în română.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function internal.audit_forbidden_patterns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    '%ciphertext%',
    '%\_iv',
    '%auth\_tag%',
    '%hash%',
    '%token%',
    -- `secret` ca segment propriu, nu ca prefix: prinde `secret`,
    -- `secret_key`, `client_secret`, `app_secret_v2`; nu prinde `secretar`.
    'secret',
    'secret\_%',
    '%\_secret',
    '%\_secret\_%',
    '%parol%'
  ];
$$;

comment on function internal.audit_forbidden_patterns() is
  'Tipare de coloane care interzic auditul generic. `secret` e delimitat de underscore ca să nu prindă „secretar" (0010b).';

-- Verificare că restrângerea chiar face diferența pe care o pretinde: dacă
-- vreodată cineva lărgește tiparele la loc, migrarea următoare cade aici, nu
-- în producție.
do $$
declare
  v_tipare text[] := internal.audit_forbidden_patterns();
begin
  if not ('client_secret' ilike any (v_tipare)) then
    raise exception 'Garda R9 nu mai prinde `client_secret` — restrângerea a mers prea departe.';
  end if;
  if not ('cnp_ciphertext' ilike any (v_tipare)) then
    raise exception 'Garda R9 nu mai prinde criptotextul.';
  end if;
  if 'secretar_employee_id' ilike any (v_tipare) then
    raise exception 'Garda R9 încă prinde `secretar_employee_id` — restrângerea nu a avut efect.';
  end if;
end
$$;
