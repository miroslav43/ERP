-- supabase/migrations/0129_reges_sporuri.sql
-- Sporurile ajung în mesajul de contract: fiecare tip de componentă salarială
-- primește identificatorul lui din nomenclatorul REGES.
--
-- ┌ De ce o coloană nouă și nu `cod_revisal` ─────────────────────────────────
-- │ `salary_component_types.cod_revisal` există din 0026 și pare să facă exact
-- │ asta. Nu face: e codul din nomenclatorul REVISAL vechi, un șir scurt de
-- │ tipul „S01", bun pentru fișierul `.rvs` și pentru rapoartele interne.
-- │ REGES-Online cere UUID-ul poziției din nomenclatorul lui, care e altă
-- │ mulțime, cu altă cardinalitate și cu altă sursă. Reciclarea coloanei ar fi
-- │ însemnat două înțelesuri pe același câmp, iar primul care le confundă
-- │ trimite un „S01" acolo unde serverul așteaptă un UUID.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ Nomenclator general SAU al angajatorului — aceeași coloană ───────────────
-- │ Schema nu face distincția: `referintaTipSpor` primește un UUID, indiferent
-- │ dacă vine din `TipSpor` (național, citit prin GET) sau din nomenclatorul
-- │ propriu al firmei (creat prin API, care întoarce UUID-ul). Distincția
-- │ rămâne la noi, în `reges_nomenclatoare.organization_id`, și e exact aceeași
-- │ convenție ca la `salary_component_types.organization_id`: NULL = platformă.
-- └───────────────────────────────────────────────────────────────────────────
--
-- ┌ De ce NU se completează nimic automat ────────────────────────────────────
-- │ Ar fi fost tentant să potrivim `denumire` cu `nume` din nomenclator și să
-- │ umplem coloana singuri. Un spor mapat greșit declară la ITM un pachet
-- │ salarial pe care omul nu-l are — și o face TĂCUT, fiindcă mesajul e valid.
-- │ Coloana rămâne NULL până când cineva alege explicit, iar
-- │ `verificaContract` oprește mesajul cât timp e NULL, cu un motiv care spune
-- │ ce lipsește. Un refuz zgomotos e mai ieftin decât o declarație greșită.
-- └───────────────────────────────────────────────────────────────────────────

begin;

-- =====================================================================================
-- 1. Legătura către nomenclatorul REGES
-- =====================================================================================
-- Fără cheie străină spre `reges_nomenclatoare`: acolo unicitatea e pe
-- `(organization_id, tip, reges_id)`, iar `reges_id` singur nu e cheie. O
-- constrângere ar fi cerut și `tip`-ul pe rândul ăsta, adică o a doua coloană
-- care nu poate lua decât o valoare. Integritatea o ține sincronizarea, care
-- marchează `activ = false` în loc să șteargă.

alter table public.salary_component_types
  add column if not exists reges_tip_spor_id uuid;

comment on column public.salary_component_types.reges_tip_spor_id is
  'UUID-ul tipului de spor în nomenclatorul REGES — general (`TipSpor`) sau al '
  'angajatorului. Ajunge în `referintaTipSpor` din obiectul `salariu` al '
  'mesajului de contract. NULL = nemapat: contractele care folosesc tipul NU se '
  'pot transmite, iar `verificaContract` spune de ce. NU e `cod_revisal`, care e '
  'codul scurt din nomenclatorul REVISAL vechi.';

-- Doar tipurile care CHIAR sunt sporuri pot purta o mapare. `indemnizatie`,
-- `prima_recurenta` și `beneficiu_natura` sunt componente de salarizare
-- internă; schema REGES nu le cunoaște, iar o mapare pe ele ar fi o invitație
-- să fie trimise ca sporuri.
alter table public.salary_component_types
  add constraint salary_component_types_spor_reges_ck
  check (reges_tip_spor_id is null or kind in ('spor_procent', 'spor_suma'));

create index salary_component_types_reges_spor_idx
  on public.salary_component_types (organization_id, reges_tip_spor_id)
  where reges_tip_spor_id is not null and deleted_at is null;

-- =====================================================================================
-- 2. Note de proiectare
-- =====================================================================================
--
-- (A) CE INTRĂ ÎN MESAJ ȘI CE NU
--     `sporurileContractului` (src/lib/reges/compune.ts) citește exclusiv
--     `kind in ('spor_procent', 'spor_suma')`, active la data trimiterii.
--     `spor_procent` → `esteProcent: true`, `spor_suma` → `false`: distincția
--     nu se deduce din valoare, se traduce dintr-un enum care o declară.
--
-- (B) SPORURILE PROPRII FIRMEI CER UN PAS ÎN PLUS
--     Cele din nomenclatorul național se mapează direct, după sincronizare.
--     Un spor negociat intern („fidelitate") trebuie mai întâi CREAT în
--     registrul angajatorului, printr-un apel care întoarce UUID-ul — abia el
--     se scrie aici. Apelul acela nu e încă implementat: endpoint-ul dedicat
--     nomenclatoarelor specifice nu e cunoscut la data migrării.
--
-- (C) DE CE VALIDAREA OPREȘTE ÎN LOC SĂ SARĂ
--     Un spor fără mapare ar putea fi omis tăcut din mesaj. Ar declara atunci
--     un salariu mai mic decât cel real, corect din punct de vedere al schemei
--     și fals din punct de vedere al faptelor. Mesajul se oprește.

commit;
