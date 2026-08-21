-- supabase/migrations/0040_organizations_caen_secundare.sql
-- Coduri CAEN secundare, alături de `cod_caen` (principal, coloană
-- existentă). Array simplu — fără atribute suplimentare per cod, deci fără
-- tabel separat. Fără CHECK de format: regula (4 cifre + apartenență la
-- nomenclator + limite pe formă juridică) trăiește în Zod
-- (`src/schemas/organization.ts`), la fel ca CUI/IBAN/CNP în acest proiect.
alter table organizations
  add column cod_caen_secundare text[] not null default '{}';
