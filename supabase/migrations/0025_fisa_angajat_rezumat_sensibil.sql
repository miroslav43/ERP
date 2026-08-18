-- ─────────────────────────────────────────────────────────────────────────────
-- 0025_fisa_angajat_rezumat_sensibil.sql
--
-- Fișa unui angajat (`/angajati/[id]`) cădea cu 42501 pentru orice utilizator
-- cu `employees:read = all` (org_admin, hr): `permission denied for table
-- employee_sensitive_data`. Reprodus și confirmat direct în Postgres, ca
-- `authenticated`, cu request.jwt.claims setat pe un org_admin real:
--
--   ERROR: 42501: permission denied for table employee_sensitive_data
--   HINT: Grant the required privileges to the current role with:
--         GRANT SELECT ON public.employee_sensitive_data TO authenticated;
--
-- Cauza: `0007_fix_hr_rls.sql` a șters — corect — orice politică de SELECT pe
-- această tabelă și a revocat orice privilegiu al lui `authenticated`, ca
-- accesul să treacă exclusiv prin `hr_read_sensitive()`, care auditează fiecare
-- citire. Dar `citesteRezumatDateSensibile()` (`src/lib/queries/employees.ts`)
-- citește direct din tabelă — nu valorile clare, doar rezumatul deja mascat
-- (`cnp_last4`, `iban_last4`, `banca`) afișat pe fișă. Fără nicio cale de acces,
-- rămăsese pur și simplu ruptă.
--
-- Soluția NU e „revocă mai puțin" (ar redeschide exact breșa din 0007: SELECT
-- direct pe criptotext, fără audit). E un grant ÎNGUST, pe coloane, plus o
-- politică RLS care verifică EXACT pragul de autorizare pe care îl verifică deja
-- `hr_read_sensitive()` (`employees:read = all`):
--
--   * `GRANT SELECT` doar pe cele 5 coloane nesensibile — `cnp_ciphertext`,
--     `iv`, `tag`, `key_version`, `hash` rămân inaccesibile prin API-ul public,
--     inclusiv printr-un apel REST manual pe tabelă, indiferent ce selectează
--     clientul.
--   * Politica RLS limitează și rândurile la organizația proprie.
--
-- Citirea rezumatului mascat nu se auditează — nu e o citire de date sensibile,
-- e afișarea a ceea ce oricum e deja ascuns. Auditul rămâne exclusiv pe calea
-- care întoarce valoarea clară.
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

-- `deleted_at` intră în grant fiindcă interogarea aplicației îl folosește ca
-- filtru (`.is("deleted_at", null)`) — privilegiul pe coloană se cere pentru
-- orice referire, nu doar pentru cele din lista SELECT.
grant select (employee_id, organization_id, cnp_last4, iban_last4, banca, deleted_at)
  on public.employee_sensitive_data to authenticated;

create policy sensitive_select_rezumat on public.employee_sensitive_data
  for select to authenticated
  using (
    organization_id = any ((select app.current_org_ids())::uuid[])
    and app.has_permission(organization_id, 'employees', 'read') = 'all'
  );
