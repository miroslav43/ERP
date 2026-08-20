-- supabase/migrations/0033_inrolare_unificata.sql
-- Etapa 1 din foaia de parcurs „Momentul înrolării unui angajat":
--   1) câmpuri lipsă pe fișa de personal (reședință, contact de muncă, stare civilă);
--   2) numerotare automată a mărcii (era liber-text, completată manual);
--   3) două șabloane noi de document (contract de muncă, fișa postului), pe
--      același mecanism deja folosit pentru adeverințe (hr_document_templates).

begin;

-- ============================================================
-- 1. CÂMPURI NOI PE employees
-- ============================================================

create type public.stare_civila as enum ('necasatorit', 'casatorit', 'divortat', 'vaduv');

alter table public.employees
  add column adresa_resedinta_strada text,
  add column adresa_resedinta_oras text,
  add column adresa_resedinta_judet text,
  add column adresa_resedinta_cod_postal text,
  add column email_serviciu text,
  add column telefon_serviciu text,
  add column stare_civila public.stare_civila;

alter table public.employees
  add constraint employees_email_serviciu_format
    check (email_serviciu is null or email_serviciu ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add constraint employees_telefon_serviciu_len check (char_length(telefon_serviciu) <= 32),
  add constraint employees_resedinta_strada_len check (char_length(adresa_resedinta_strada) <= 200),
  add constraint employees_resedinta_oras_len check (char_length(adresa_resedinta_oras) <= 120),
  add constraint employees_resedinta_judet_len check (char_length(adresa_resedinta_judet) <= 80),
  add constraint employees_resedinta_cod_postal_len check (char_length(adresa_resedinta_cod_postal) <= 12);

-- ============================================================
-- 2. NUMEROTAREA AUTOMATĂ A MĂRCII
--
-- Azi `marca` e text liber completat de cine adaugă angajatul (bug raportat).
-- Contor atomic per organizație, într-un singur INSERT ... ON CONFLICT — fără
-- fereastră de cursă între citire și scriere.
-- ============================================================

create table public.employee_marca_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  next_marca int not null default 1 check (next_marca >= 1),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

-- Fără grant-uri către `authenticated`: singurul acces e prin funcția de mai
-- jos (SECURITY DEFINER) — la fel ca `organization_sensitive_data`.
alter table public.employee_marca_counters enable row level security;
alter table public.employee_marca_counters force row level security;

create trigger set_actor_employee_marca_counters
  before insert or update on public.employee_marca_counters
  for each row execute function internal.set_actor();
create trigger set_updated_at_employee_marca_counters
  before update on public.employee_marca_counters
  for each row execute function app.set_updated_at();

create or replace function internal.urmatoarea_marca(p_organization_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_numar int;
begin
  insert into public.employee_marca_counters (organization_id, next_marca, created_by, updated_by)
  values (p_organization_id, 2, (select auth.uid()), (select auth.uid()))
  on conflict (organization_id) do update
    set next_marca = public.employee_marca_counters.next_marca + 1,
        updated_by = (select auth.uid())
  returning next_marca - 1 into v_numar;

  return lpad(v_numar::text, 4, '0');
end;
$$;

revoke all on function internal.urmatoarea_marca(uuid) from public, anon;
grant execute on function internal.urmatoarea_marca(uuid) to authenticated;

-- ============================================================
-- 3. ȘABLOANE NOI: CONTRACT DE MUNCĂ ȘI FIȘA POSTULUI
--
-- Aceeași mecanică de randare ca la adeverințe (0004_hr.sql) — motorul de
-- generare se generalizează în cod (`genereazaDocument`), doar șabloanele
-- sunt noi. Contractul are nevoie de CNP-ul complet (cerință legală reală),
-- nu doar `cnp_mascat` ca la adeverințe — variabila e alta: {{cnp_complet}}.
-- ============================================================

insert into public.hr_document_templates (organization_id, cod, denumire, descriere, continut_html, variabile, serie)
values
  (null, 'contract_munca', 'Contract individual de muncă',
   'Generat automat la înrolarea angajatului, pe baza datelor din formular.',
   '<h1>CONTRACT INDIVIDUAL DE MUNCĂ</h1>' ||
   '<p>Nr. {{numar_contract}} din {{data_contract}}</p>' ||
   '<p>Încheiat între {{organizatie_denumire}}, în calitate de angajator, și ' ||
   '{{angajat_nume}}, CNP {{cnp_complet}}, domiciliat în {{angajat_adresa}}, în calitate de salariat.</p>' ||
   '<p>Salariatul este încadrat în funcția de {{functie}}, în cadrul departamentului {{departament}}, ' ||
   'începând cu data de {{data_angajarii}}.</p>' ||
   '<p>Durata contractului: {{durata_contract}}. Norma de lucru: {{norma_ore_saptamana}} ore/săptămână, ' ||
   '{{norma_ore_zi}} ore/zi, în regim {{mod_lucru}}.</p>' ||
   '<p>Salariul de bază lunar brut: {{salariu_brut}} lei.</p>' ||
   '<p>Durata concediului de odihnă anual: {{zile_concediu_anual}} zile lucrătoare.</p>',
   '["numar_contract","data_contract","organizatie_denumire","angajat_nume","cnp_complet","angajat_adresa","functie","departament","data_angajarii","durata_contract","norma_ore_saptamana","norma_ore_zi","mod_lucru","salariu_brut","zile_concediu_anual"]'::jsonb,
   'CIM'),
  (null, 'fisa_postului', 'Fișa postului',
   'Generată automat la înrolare, pe baza atribuțiilor și competențelor completate în formular.',
   '<h1>FIȘA POSTULUI</h1>' ||
   '<p>Angajat: {{angajat_nume}} — Funcția: {{functie}} — Departament: {{departament}}</p>' ||
   '<p>Subordonare: {{subordonare}}</p>' ||
   '<h2>Atribuții</h2><p>{{atributii}}</p>' ||
   '<h2>Competențe necesare</h2><p>{{competente}}</p>',
   '["angajat_nume","functie","departament","subordonare","atributii","competente"]'::jsonb,
   'FP')
on conflict do nothing;

commit;
