-- supabase/migrations/0086_reges_redenumire.sql
-- REGES-Online (fost Revisal) — pasul 1: redenumirea.
--
-- De la 1 ianuarie 2026 REGES-Online a înlocuit definitiv Revisal. Numele vechi
-- rămăsese în bază pe două tabele, două enum-uri și toate obiectele lor derivate.
-- Migrarea NU schimbă nicio coloană și niciun rând: doar vocabularul.
--
-- ⚠ NU E COMPATIBILĂ ÎNAPOI. `.from("revisal_events")` întoarce 42P01 în clipa
-- aplicării. Migrarea și deploy-ul codului merg în aceeași fereastră — cu atât
-- mai mult cu cât dev și producție folosesc ACELAȘI proiect Supabase.
--
-- DE CE DINAMIC, ȘI NU O LISTĂ DE `rename` SCRISE DE MÂNĂ
-- Numele cheilor străine sunt generate de Postgres (`<tabelă>_<coloană>_fkey`) și
-- nu apar nicăieri în migrări. O listă scrisă din memorie ar rata exact obiectele
-- pe care nimeni nu le-a numit explicit. Buclele de mai jos citesc catalogul, deci
-- redenumesc TOT ce poartă prefixul vechi, inclusiv ce s-a adăugat între timp.
--
-- CE NU SE REDENUMEȘTE
-- `employment_contracts.cod_revisal` și `salary_component_types.cod_revisal` rămân.
-- Nu sunt nume vechi pentru un lucru nou: sunt identificatorul din sistemul VECHI,
-- păstrat ca dată istorică. Corespondentul REGES e `ReferintaContract.Id`, un uuid
-- care primește propria coloană în 0087.

---------------------------------------------------------------------------
-- 1. Tabelele și enum-urile
---------------------------------------------------------------------------

alter table public.revisal_config rename to reges_termene;
alter table public.revisal_events rename to reges_evenimente;

alter type public.revisal_event_type rename to reges_tip_eveniment;
alter type public.revisal_status     rename to reges_stare_eveniment;

---------------------------------------------------------------------------
-- 2. Constrângeri, indexuri, politici — după prefix, din catalog
---------------------------------------------------------------------------

do $$
declare
  v_pereche  text[];
  v_vechi    text;
  v_nou      text;
  r          record;
begin
  foreach v_pereche slice 1 in array array[
    array['revisal_config', 'reges_termene'],
    array['revisal_events', 'reges_evenimente']
  ]
  loop
    v_vechi := v_pereche[1];
    v_nou   := v_pereche[2];

    -- Constrângerile (PK, FK, CHECK). Redenumirea unei constrângeri cu index
    -- propriu îi redenumește și indexul, deci acestea trebuie luate PRIMELE.
    for r in
      select conname
      from pg_catalog.pg_constraint
      where conrelid = ('public.' || v_nou)::regclass
        and conname like v_vechi || '\_%'
    loop
      execute format('alter table public.%I rename constraint %I to %I',
                     v_nou, r.conname, overlay(r.conname placing v_nou from 1 for length(v_vechi)));
    end loop;

    -- Indexurile rămase (cele fără constrângere în spate).
    for r in
      select c.relname
      from pg_catalog.pg_class c
      join pg_catalog.pg_index i on i.indexrelid = c.oid
      where i.indrelid = ('public.' || v_nou)::regclass
        and c.relname like v_vechi || '\_%'
    loop
      execute format('alter index public.%I rename to %I',
                     r.relname, overlay(r.relname placing v_nou from 1 for length(v_vechi)));
    end loop;

    -- Politicile RLS.
    for r in
      select polname
      from pg_catalog.pg_policy
      where polrelid = ('public.' || v_nou)::regclass
        and polname like v_vechi || '\_%'
    loop
      execute format('alter policy %I on public.%I rename to %I',
                     r.polname, v_nou, overlay(r.polname placing v_nou from 1 for length(v_vechi)));
    end loop;
  end loop;
end
$$;

---------------------------------------------------------------------------
-- 3. Triggerele
---------------------------------------------------------------------------
-- `internal.attach_audit(t)` face `drop trigger if exists audit_<t>` pe numele
-- NOU. Triggerul vechi `audit_revisal_events` supraviețuiește redenumirii tabelei
-- și n-ar fi atins de acel drop — rezultatul ar fi DOUĂ triggere de audit pe
-- aceeași tabelă, deci două rânduri în `audit_logs` pentru fiecare scriere.
-- De aceea se șterge explicit, înainte de reatașare.

drop trigger if exists audit_revisal_config on public.reges_termene;
drop trigger if exists audit_revisal_events on public.reges_evenimente;

alter trigger revisal_config_set_updated_at on public.reges_termene
  rename to reges_termene_set_updated_at;
alter trigger revisal_events_set_updated_at on public.reges_evenimente
  rename to reges_evenimente_set_updated_at;

select internal.attach_audit('reges_termene');
select internal.attach_audit('reges_evenimente');

---------------------------------------------------------------------------
-- 4. Comentarii
---------------------------------------------------------------------------

comment on table public.reges_termene is
  'Termenele legale de transmitere către REGES-Online, per tip de eveniment. '
  'organization_id NULL = implicit de platformă; rândul organizației îl bate. '
  '⚠ Valorile seedate vin din H.G. 905/2017 și sunt DE CONFIRMAT DE JURIST sub norma REGES 2025.';

comment on table public.reges_evenimente is
  'Registrul de evenimente de raportat la Inspecția Muncii: ce s-a întâmplat și '
  'până când trebuie transmis. Mesajele efective către API stau în reges_mesaje (0087).';
