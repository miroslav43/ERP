-- ─────────────────────────────────────────────────────────────────────────────
-- 0024_revoca_executie_triggere.sql
--
-- Advisor-ii Supabase au semnalat 7 funcții `SECURITY DEFINER` din `0004_hr.sql`
-- apelabile direct prin PostgREST — `/rest/v1/rpc/tg_set_updated_at` și
-- celelalte 6 funcții-trigger ale modulului HR. Niciuna nu a primit vreodată
-- `revoke execute`, spre deosebire de `app.set_updated_at()` și
-- `internal.handle_new_user()` din `0001_kernel.sql`, care stabilesc exact acest
-- tipar. A fost un rând omis la scrierea `0004`, nu o decizie.
--
-- Apelate direct (în afara contextului de trigger), toate cad oricum cu eroarea
-- Postgres „trigger functions can only be called as triggers" — nu există cale
-- de exploatare. Rămâne însă suprafață inutilă expusă prin API-ul public, iar
-- regula proiectului e explicită: nimic din ce nu e gândit ca RPC nu rămâne
-- apelabil de `anon`/`authenticated`.
--
-- Revocarea nu afectează declanșarea triggerelor: executorul Postgres invocă
-- funcția-trigger direct, fără verificare de EXECUTE pe rolul sesiunii — acel
-- drept se verifică doar la apel explicit (`SELECT func()` sau RPC).
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

revoke execute on function public.tg_departments_path() from public, anon, authenticated;
revoke execute on function public.tg_departments_path_cascade() from public, anon, authenticated;
revoke execute on function public.tg_employees_manager_path() from public, anon, authenticated;
revoke execute on function public.tg_employees_manager_path_cascade() from public, anon, authenticated;
revoke execute on function public.tg_employees_validari() from public, anon, authenticated;
revoke execute on function public.tg_contracts_validari() from public, anon, authenticated;
revoke execute on function public.tg_set_updated_at() from public, anon, authenticated;
