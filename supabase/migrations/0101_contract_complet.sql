-- supabase/migrations/0101_contract_complet.sql
--
-- CONTRACTUL GENERAT SPUNE ȘI CU CE ACT DE IDENTITATE, ȘI UNDE SE LUCREAZĂ.
--
-- ── CE LIPSEA ────────────────────────────────────────────────────────────────
-- Șablonul `contract_munca` din `0033_inrolare_unificata.sql:98` conține
-- numele, CNP-ul și adresa salariatului — dar NU seria și numărul actului de
-- identitate, deși textul uzual al CIM le cere („posesor al cărții de identitate
-- seria … nr. …, eliberat/ă de … la data de …").
--
-- Și, mai grav: nu conține deloc LOCUL MUNCII. Clauza e obligatorie prin art. 17
-- alin. (3) lit. b) din Codul muncii, iar contractul emis de aplicație nu spunea
-- unde se prestează munca. Verificat în baza reală: toate cele 8 contracte au
-- `loc_munca` NULL, deci nici n-ar fi avut ce tipări.
--
-- ── ⚠️ MIGRAREA ASTA SE APLICĂ DUPĂ DEPLOY, NU ÎNAINTE ──────────────────────
-- E singura din serie cu ordine obligatorie față de cod, și motivul e mecanic:
--
--   · `randeaza()` (`generator.ts:36-44`) tratează o cheie ABSENTĂ exact ca pe
--     una goală, iar `genereazaDocument` ARUNCĂ `businessRule` la prima
--     variabilă fără valoare (`:83-88`);
--   · UPDATE-ul de mai jos schimbă seed-ul de platformă, deci intră în vigoare
--     INSTANTANEU pentru aplicația care rulează;
--   · baza e una singură pentru dezvoltare și producție (`.env.local` și
--     `.env.production` arată către același proiect Supabase).
--
-- Aplicată înaintea codului care furnizează `{{serie_act}}`, `{{numar_act}}`,
-- `{{act_eliberat_de}}`, `{{act_eliberat_la}}` și `{{loc_munca}}`, ar face ca
-- FIECARE înrolare din fereastra dintre migrare și deploy să iasă cu
-- „Contractul de muncă nu a putut fi generat".
--
-- ── DE CE UPDATE, NU UN ȘABLON NOU ──────────────────────────────────────────
-- Codul cere șablonul după `cod = 'contract_munca'` (`contract-munca.ts:85`).
-- Un cod nou ar cere și o schimbare de cod, pentru zero câștig. UPDATE-ul atinge
-- DOAR rândul de platformă (`organization_id is null`): o firmă care și-a scris
-- propriul contract rămâne cu al ei, neatins — exact ce trebuie, fiindcă
-- varianta organizației bate seed-ul la căutare (`generator.ts:77`).
--
-- Firmele cu șablon propriu NU vor avea variabilele noi. Nu e o scăpare:
-- adaptorul le trimite oricum, iar `randeaza()` ignoră o valoare pentru care
-- șablonul n-are `{{…}}`. Documentul lor rămâne exact cum și l-au scris.
--
-- Forward-only: 0033 NU se editează.

\set ON_ERROR_STOP on

begin;

-- =====================================================================================
-- 1. Contractul individual de muncă, completat
-- =====================================================================================

update public.hr_document_templates
   set continut_html =
         '<h1>CONTRACT INDIVIDUAL DE MUNCĂ</h1>' ||
         '<p>Nr. {{numar_contract}} din {{data_contract}}</p>' ||
         '<p>Încheiat între {{organizatie_denumire}}, în calitate de angajator, și ' ||
         '{{angajat_nume}}, CNP {{cnp_complet}}, posesor al actului de identitate seria ' ||
         '{{serie_act}} nr. {{numar_act}}, eliberat de {{act_eliberat_de}} la data de ' ||
         '{{act_eliberat_la}}, domiciliat în {{angajat_adresa}}, în calitate de salariat.</p>' ||
         '<p>Salariatul este încadrat în funcția de {{functie}}, în cadrul departamentului ' ||
         '{{departament}}, începând cu data de {{data_angajarii}}.</p>' ||
         '<p>Locul de muncă: {{loc_munca}}.</p>' ||
         '<p>Durata contractului: {{durata_contract}}. Norma de lucru: {{norma_ore_saptamana}} ' ||
         'ore/săptămână, {{norma_ore_zi}} ore/zi, în regim {{mod_lucru}}.</p>' ||
         '<p>Salariul de bază lunar brut: {{salariu_brut}} lei.</p>' ||
         '<p>Durata concediului de odihnă anual: {{zile_concediu_anual}} zile lucrătoare.</p>',
       -- Lista stă pe un singur literal, nu spartă pe rânduri: Postgres
       -- concatenează literalele adiacente, dar `valori-inrolare.test.ts` o
       -- citește de aici ca să o compare cu harta din cod, iar un tablou rupt în
       -- două l-ar face să nu mai poată.
       variabile = '["numar_contract","data_contract","organizatie_denumire","angajat_nume","cnp_complet","serie_act","numar_act","act_eliberat_de","act_eliberat_la","angajat_adresa","functie","departament","data_angajarii","loc_munca","durata_contract","norma_ore_saptamana","norma_ore_zi","mod_lucru","salariu_brut","zile_concediu_anual"]'::jsonb,
       updated_at = now()
 where cod = 'contract_munca'
   and organization_id is null;

-- =====================================================================================
-- 2. Note de proiectare
-- =====================================================================================
--
-- CE SE ÎNTÂMPLĂ CU FIȘELE VECHI, care n-au serie, număr sau emitent de act:
-- adaptorul (`src/lib/documents/valori-inrolare.ts`) nu trimite NICIODATĂ șirul
-- gol — pune un text de rezervă („nespecificat"). Regula are precedent în
-- `contract-munca.ts:54`, unde CNP-ul lipsă devine „CNP nefurnizat la înrolare".
-- Fără ea, generarea ar cădea pentru fiecare dintre cele 11 fișe existente.
--
-- Doar identitatea și numărul contractului chiar blochează emiterea; restul
-- primesc rezervă și lasă documentul să iasă, cu un gol vizibil pe hârtie — care
-- e mai util decât niciun document.

commit;
