-- supabase/migrations/0137_pontaj_arhiva_granturi.sql
--
-- GRANTURILE ARHIVEI DE PONTAJ, ADUSE LA CE SPUNE 0134 CĂ SUNT.
--
-- ── CE S-A ÎNTÂMPLAT ────────────────────────────────────────────────────────
-- `0134` scrie, în secțiunea 8: „Granturile de mai jos dau `select`, atât."
-- Instrucțiunile erau:
--
--   revoke all    on table public.pontaj_arhive_lunare from public, anon;
--   grant  select on table public.pontaj_arhive_lunare to authenticated;
--
-- Pe bancul local, un `postgres:17-alpine` gol, asta chiar dădea `select` și
-- atât — de aceea proba a trecut verde și defectul n-a apărut nicăieri.
--
-- Pe Supabase nu. Proiectul are `alter default privileges in schema public grant
-- all on tables to anon, authenticated, service_role`, deci tabela s-a NĂSCUT cu
-- toate drepturile pentru `authenticated`. `revoke ... from public, anon` nu-l
-- atinge pe `authenticated`, iar `grant select` peste `all` e o instrucțiune fără
-- efect. Verificat imediat după aplicare, pe baza reală: `authenticated` avea
-- DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE.
--
-- ── DE CE NU ERA O BREȘĂ, ȘI DE CE TOTUȘI SE REPARĂ ─────────────────────────
-- Tabela are `force row level security` și O SINGURĂ politică, de SELECT. Sub
-- RLS forțat, absența unei politici pentru o comandă înseamnă REFUZ, nu
-- permisiune — deci niciun INSERT, UPDATE sau DELETE al unui utilizator
-- autentificat n-a fost vreodată posibil. Verificarea (12) din
-- `tests/rls/proba-arhiva-pontaj.sql` o probează, sub identitate de `org_admin`.
--
-- Se repară fiindcă o arhivă legală merită și a doua barieră, nu doar pe cea
-- care ține. Un grant care contrazice comentariul de deasupra lui e, în plus, o
-- capcană pentru cine citește peste un an și crede ce scrie acolo.
--
-- ── CE NU FACE ──────────────────────────────────────────────────────────────
-- Nu atinge celelalte tabele. Interogarea de control de pe 10 sept 2026 a găsit
-- 50 de perechi (tabelă, drept) în aceeași situație — INSERT/UPDATE/DELETE
-- acordate lui `authenticated` fără politică potrivită, de la `announcements`
-- până la `tickets`. Toate sunt ținute tot de RLS, la fel. Curățarea lor e o
-- sarcină separată, cu propria ei probă; ascunsă aici, ar fi o migrare care face
-- altceva decât spune numele.
--
-- `service_role` rămâne neatins: e clientul admin, iar `createAdminSupabase()`
-- îl folosește în alte module.

begin;

revoke insert, update, delete, truncate, references, trigger
  on table public.pontaj_arhive_lunare
  from authenticated;

-- Reafirmat explicit, ca fișierul să se poată citi singur: după revocarea de mai
-- sus, `authenticated` are pe tabela asta exact un drept.
grant select on table public.pontaj_arhive_lunare to authenticated;

commit;
