-- supabase/migrations/0031_fix_rls_organization_sensitive_data.sql
-- 0030 a creat organization_sensitive_data fără RLS activat. Fără GRANT pe
-- authenticated, tabela era oricum inaccesibilă prin PostgREST — dar linter-ul
-- de securitate marchează corect absența RLS ca ERROR: e o plasă de siguranță
-- care nu trebuie să depindă doar de „nu i-am dat GRANT niciodată".
alter table public.organization_sensitive_data enable row level security;
alter table public.organization_sensitive_data force row level security;
