-- supabase/migrations/0097_inrolare_date_obligatorii.sql
--
-- CE LIPSEA DIN SCHEMĂ CA UN CONTRACT SĂ POATĂ FI COMPLET.
--
-- ── (1) DATA ELIBERĂRII ACTULUI DE IDENTITATE ────────────────────────────────
-- Textul contractului individual de muncă cere, cuvânt cu cuvânt, „posesor al
-- cărții de identitate seria … nr. …, eliberat/ă de … LA DATA DE …". Schema are
-- `serie_act`, `numar_act`, `act_eliberat_de` și `act_valabil_pana` din
-- `0004_hr.sql:169-173` — dar data eliberării nu există NICĂIERI: nici în bază,
-- nici în schema Zod, nici în formular. Contractul generat nu putea fi complet
-- nici dacă cineva completa tot ce se putea completa.
--
-- ── (2) LOCUL DE MUNCĂ NU ERA LEGAT DE NIMIC ────────────────────────────────
-- `employment_contracts.loc_munca` e text liber din 0004. `public.puncte_lucru`
-- există din `0030_onboarding_companie.sql:289`, cu CRUD și ecran propriu — și
-- NICIO tabelă nu o referă. Comentariul din `puncte-lucru/actions.ts:143` o
-- spune pe față. Locul muncii e clauză obligatorie a CIM (art. 17 alin. (3)
-- lit. b) din Codul muncii), deci merită o legătură, nu un șir tastat de mână.
--
-- Verificat în baza reală înainte de a scrie migrarea: toate cele 8 contracte
-- active au `loc_munca` NULL. Nu există date de migrat, doar un drum de deschis.
--
-- ── DE CE NICIUN `NOT NULL` ─────────────────────────────────────────────────
-- Tot în baza reală: toate cele 11 fișe active n-au nici serie, nici număr de
-- act, nici emitent, nici adresă de domiciliu. Un `not null` ar face migrarea să
-- cadă la aplicare. Regula strictă stă în Zod, pe schema de ÎNROLARE — ecranul
-- de editare și importul în masă rămân permisive, ca o corecție de telefon pe un
-- angajat vechi să nu ceară găsirea buletinului.
--
-- ── DE CE CHEIE COMPUSĂ, NU DOAR FK ─────────────────────────────────────────
-- Un FK simplu verifică EXISTENȚA rândului, nu apartenența lui la firmă: un uuid
-- de punct de lucru din altă organizație, trimis direct către Server Action, ar
-- intra în contract. Tiparul proiectului pentru asta e în
-- `0074_chei_compuse_tenant.sql` — cheie unică `(id, organization_id)` pe tabela
-- referită, apoi FK pe perechea de coloane. `puncte_lucru` nu o avea încă.
--
-- Forward-only: 0004, 0030 și 0074 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Data eliberării actului de identitate
-- =====================================================================================

alter table public.employees
  add column if not exists act_eliberat_la date;

-- Plauzibilitate, nu corectitudine: o carte de identitate românească nu a putut
-- fi eliberată înainte de 1993 (Legea 105/1996 a introdus formatul actual, dar
-- primele au apărut în 1993), iar una eliberată în viitor e o greșeală de tastare.
alter table public.employees
  add constraint employees_act_eliberat_la_ck
  check (
    act_eliberat_la is null
    or (act_eliberat_la >= date '1993-01-01' and act_eliberat_la <= current_date)
  );

comment on column public.employees.act_eliberat_la is
  'Data eliberării actului de identitate. Cerută literal de textul CIM („eliberat de … la data de …”); '
  'lipsea din toate cele trei straturi. Obligatorie la ÎNROLARE, prin Zod, nu prin NOT NULL: '
  'fișele existente nu o au, iar un NOT NULL ar fi făcut migrarea să cadă la aplicare.';

-- =====================================================================================
-- 2. Punctul de lucru devine referențiabil
-- =====================================================================================

-- Cheia compusă, pe modelul din 0074. Fără ea, FK-ul de mai jos ar verifica doar
-- existența rândului, nu și firma din care face parte.
alter table public.puncte_lucru
  add constraint puncte_lucru_id_org_uk unique (id, organization_id);

comment on constraint puncte_lucru_id_org_uk on public.puncte_lucru is
  'Ținta FK-urilor compuse. Vezi 0074_chei_compuse_tenant.sql: un FK simplu verifică '
  'existența, nu apartenența la tenant.';

alter table public.employment_contracts
  add column if not exists punct_lucru_id uuid;

alter table public.employment_contracts
  add constraint contracts_punct_lucru_fk
  foreign key (punct_lucru_id, organization_id)
  references public.puncte_lucru (id, organization_id)
  on delete set null;

create index contracts_punct_lucru_idx
  on public.employment_contracts (punct_lucru_id)
  where punct_lucru_id is not null and deleted_at is null;

comment on column public.employment_contracts.punct_lucru_id is
  'Punctul de lucru unde se prestează munca. NULL = sediul social sau o locație '
  'ocazională (șantier, delegare), al cărei text rămâne în `loc_munca`. '
  'AMÂNDOUĂ se scriu: denumirea rezolvată intră în `loc_munca` ca să rămână corectă '
  'în documentele deja emise chiar dacă punctul de lucru e redenumit ulterior.';

commit;
