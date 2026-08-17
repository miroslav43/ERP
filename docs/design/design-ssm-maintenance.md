## Enum-uri Postgres introduse

```
ssm_training_kind        : introductiv_general | la_locul_de_munca | periodic | suplimentar_adiacent
ssm_confirm_method       : semnatura_fizica | semnatura_digitala | confirmare_in_app
fire_ext_type            : p3 | p6 | p9 | g5 | co2 | spuma | apa_pulverizata | alt_tip
fire_ext_status          : ok | expirat | in_service | casat
fire_check_kind          : verificare_periodica | reincarcare | reparatie | proba_presiune | inlocuire
fire_check_result        : conform | neconform_remediat | neconform_inlocuit | casat
permit_status            : valabil | expira_curand | expirat | in_reinnoire | revocat
occ_exam_kind            : angajare | periodic | reluare_activitate | la_cerere | supraveghere_speciala
occ_exam_result          : apt | apt_conditionat | inapt_temporar | inapt
work_restriction_kind    : fara_inaltime | fara_greutati | fara_conducere_auto | fara_ture_noapte | fara_expunere_zgomot | fara_expunere_chimica | program_redus | schimbare_post | interdictie_totala | alta
equipment_status         : activ | rezerva | in_mentenanta | defect | casat
meter_kind               : ore_functionare | km
meter_source             : manual | import | interventie | telematica
maint_plan_kind          : preventiva | revizie | verificare_iscir | verificare_metrologica | verificare_electrica | verificare_psi
maint_interval_kind      : zile | ore_functionare | km
maint_intervention_kind  : preventiva | corectiva | avarie | revizie | verificare_legala
maint_executor_kind      : intern | furnizor
fault_severity           : minora | medie | majora | critica
fault_status             : nou | atribuit | in_lucru | rezolvat | respins | inchis
```
Valori adaugate la enum-ul comun `expiry_entity_type` (modulul de expirari/alerte): `ssm_training`, `fire_extinguisher_check`, `environmental_permit`, `occupational_health_exam`, `maintenance_plan`, `equipment_warranty`, `equipment_meter_stale`.

## Conventii locale (o singura data)

- Helper-e presupuse: `is_member(org)`, `has_perm(org, 'cheie')` (citeste `role_permissions`), `feature_on(org,'ssm'|'maintenance')`, `current_employee_id(org)`, `is_manager_of(employee_id)`.
- Fiecare politica SELECT/INSERT/UPDATE contine implicit `is_member(organization_id) AND feature_on(organization_id, <modul>)`. Mai jos scriu doar conditia suplimentara.
- DELETE fizic = interzis peste tot: `DELETE = false` pe toate tabelele; „stergerea" = UPDATE `deleted_at` cu aceleasi drepturi ca UPDATE.
- Documentele: `document_id uuid FK->documents(id) RESTRICT` (modul comun; Storage privat, semnare URL doar in Server Action).
- Chei de permisiune folosite: `ssm.read`, `ssm.write`, `ssm.medical.read`, `ssm.medical.write`, `maintenance.read`, `maintenance.write`, `maintenance.fault.report`, `maintenance.fault.assign`.
- Sincronizare cu infrastructura comuna: fiecare tabela cu scadenta are trigger AFTER INSERT/UPDATE care apeleaza `expiry_upsert(org, <entity_type>, id, due_date, subiect_text, meta jsonb)` si `expiry_dismiss(...)` la soft delete/rezolvare. Nicio tabela din modulele astea nu-si tine propriile alerte.

---

# SSM / PSI

### ssm_training_types
scop: catalogul tipurilor de instruire SSM/PSI definite de organizatie, cu periodicitatea implicita.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
cod text NOT NULL
denumire text NOT NULL
kind ssm_training_kind NOT NULL
periodicitate_luni int NULL
durata_minima_minute int NULL
necesita_test boolean NOT NULL DEFAULT false
necesita_document boolean NOT NULL DEFAULT true
activ boolean NOT NULL DEFAULT true
```
constrangeri: UNIQUE(organization_id, cod) WHERE deleted_at IS NULL; CHECK(kind = 'periodic' AND periodicitate_luni IS NOT NULL OR kind <> 'periodic'); CHECK(periodicitate_luni IS NULL OR periodicitate_luni BETWEEN 1 AND 120)
indexuri: (organization_id, activ) WHERE deleted_at IS NULL
rls: SELECT = `has_perm(org,'ssm.read')`; INSERT/UPDATE = `has_perm(org,'ssm.write')`; DELETE = false
nota: `introductiv_general` si `la_locul_de_munca` sunt evenimente unice (periodicitate NULL) — nu genereaza scadenta recurenta, doar obligativitate la angajare.

### ssm_training_type_rules
scop: suprascrie periodicitatea unui tip de instruire pe departament si/sau functie (loc de munca cu pericol deosebit = 6 luni vs 12 luni standard).
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
training_type_id uuid NOT NULL FK->ssm_training_types(id) RESTRICT
department_id uuid NULL FK->departments(id) RESTRICT
position_id uuid NULL FK->positions(id) RESTRICT
periodicitate_luni int NOT NULL
obligatoriu boolean NOT NULL DEFAULT true
valabil_de_la date NOT NULL
valabil_pana_la date NULL
```
constrangeri: UNIQUE(organization_id, training_type_id, department_id, position_id, valabil_de_la) WHERE deleted_at IS NULL; CHECK(department_id IS NOT NULL OR position_id IS NOT NULL); CHECK(valabil_pana_la IS NULL OR valabil_pana_la > valabil_de_la)
indexuri: (organization_id, training_type_id) WHERE deleted_at IS NULL
rls: SELECT = `has_perm(org,'ssm.read')`; INSERT/UPDATE = `has_perm(org,'ssm.write')`; DELETE = false
nota: precedenta la rezolvare, in ordine: (position + department) > position > department > default din `ssm_training_types`. Istoric prin `valabil_de_la` — schimbarea periodicitatii nu rescrie instruirile deja efectuate.

### ssm_training_sessions
scop: sedinta de instruire colectiva, ca sa nu se reintroduca aceleasi date pentru 40 de angajati.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
training_type_id uuid NOT NULL FK->ssm_training_types(id) RESTRICT
data date NOT NULL
ora_inceput time NULL
durata_minute int NOT NULL
instructor_employee_id uuid NULL FK->employees(id) RESTRICT
instructor_extern text NULL
tematica text NULL
document_id uuid NULL FK->documents(id) RESTRICT
```
constrangeri: CHECK(instructor_employee_id IS NOT NULL OR instructor_extern IS NOT NULL); CHECK(durata_minute BETWEEN 5 AND 960); CHECK(data <= current_date)
indexuri: (organization_id, data DESC) WHERE deleted_at IS NULL
rls: SELECT = `has_perm(org,'ssm.read')`; INSERT/UPDATE = `has_perm(org,'ssm.write')`; DELETE = false

### ssm_trainings
scop: instruirea efectuata de un angajat (o linie in fisa individuala de instruire), cu scadenta urmatoarei instruiri.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
employee_id uuid NOT NULL FK->employees(id) RESTRICT
training_type_id uuid NOT NULL FK->ssm_training_types(id) RESTRICT
session_id uuid NULL FK->ssm_training_sessions(id) RESTRICT
data date NOT NULL
durata_minute int NOT NULL
instructor_employee_id uuid NULL FK->employees(id) RESTRICT
instructor_extern text NULL
periodicitate_aplicata_luni int NULL
urmatoarea_instruire date NULL
rezultat_test_punctaj numeric(5,2) NULL
admis boolean NOT NULL DEFAULT true
confirm_method ssm_confirm_method NULL
confirmat_la timestamptz NULL
confirmat_ip inet NULL
semnatura_document_id uuid NULL FK->documents(id) RESTRICT
document_id uuid NULL FK->documents(id) RESTRICT
observatii text NULL
```
constrangeri: UNIQUE(organization_id, employee_id, training_type_id, data) WHERE deleted_at IS NULL; CHECK(data <= current_date); CHECK(urmatoarea_instruire IS NULL OR urmatoarea_instruire > data); CHECK(rezultat_test_punctaj IS NULL OR rezultat_test_punctaj BETWEEN 0 AND 100); CHECK(confirmat_la IS NULL OR confirm_method IS NOT NULL)
indexuri: (organization_id, employee_id, data DESC) WHERE deleted_at IS NULL; (organization_id, urmatoarea_instruire) WHERE deleted_at IS NULL AND urmatoarea_instruire IS NOT NULL
rls: SELECT = `has_perm(org,'ssm.read') OR employee_id = current_employee_id(org) OR is_manager_of(employee_id)`; INSERT/UPDATE = `has_perm(org,'ssm.write')`; UPDATE limitat pe coloanele `confirm_method/confirmat_la/confirmat_ip` = `employee_id = current_employee_id(org)` (confirmarea in app o face angajatul, restul campurilor raman blocate prin trigger de coloane); DELETE = false
nota: `periodicitate_aplicata_luni` se copiaza (snapshot) din regula rezolvata la momentul instruirii si `urmatoarea_instruire = data + periodicitate_aplicata_luni luni`, calculate in trigger, nu in client. Fara snapshot, o schimbare de regula ar rescrie retroactiv scadentele istorice. La `admis = false` scadenta se seteaza la `data + 30 zile` (reinstruire) — regula configurabila la nivel de org, nu hardcodata.

### fire_extinguishers
scop: inventarul stingatoarelor si al mijloacelor PSI, cu scadentele de verificare, reincarcare si proba de presiune.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
cod_inventar text NOT NULL
tip fire_ext_type NOT NULL
capacitate_kg numeric(6,2) NULL
locatie_id uuid NULL FK->locations(id) RESTRICT
locatie_detaliu text NULL
serie_producator text NULL
producator text NULL
data_fabricatie date NULL
data_punere_in_functiune date NULL
ultima_verificare date NULL
urmatoarea_verificare date NULL
ultima_reincarcare date NULL
urmatoarea_reincarcare date NULL
ultima_proba_presiune date NULL
urmatoarea_proba_presiune date NULL
data_casare_planificata date NULL
furnizor_service_id uuid NULL FK->suppliers(id) RESTRICT
status fire_ext_status NOT NULL DEFAULT 'ok'
responsabil_employee_id uuid NULL FK->employees(id) RESTRICT
document_id uuid NULL FK->documents(id) RESTRICT
```
constrangeri: UNIQUE(organization_id, cod_inventar) WHERE deleted_at IS NULL; CHECK(capacitate_kg IS NULL OR capacitate_kg > 0); CHECK(data_fabricatie IS NULL OR data_fabricatie <= current_date); CHECK(urmatoarea_verificare IS NULL OR ultima_verificare IS NULL OR urmatoarea_verificare > ultima_verificare)
indexuri: (organization_id, status) WHERE deleted_at IS NULL; (organization_id, urmatoarea_verificare) WHERE deleted_at IS NULL AND status <> 'casat'
rls: SELECT = `has_perm(org,'ssm.read')`; INSERT/UPDATE = `has_perm(org,'ssm.write')`; DELETE = false
nota: trei scadente independente (verificare anuala, reincarcare, proba presiune) — nu le colapsa intr-o singura coloana. In registrul comun de expirari se publica trei randuri distincte cu acelasi `entity_id` si `subtype` in meta, ca alerta sa spuna exact ce expira. Intervalele (12/60/120 luni) stau intr-o tabela de configurare pe tip, cu `valabil_de_la`, nu in cod.

### fire_extinguisher_checks
scop: istoricul verificarilor/reincarcarilor efectuate pe fiecare stingator.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
fire_extinguisher_id uuid NOT NULL FK->fire_extinguishers(id) RESTRICT
kind fire_check_kind NOT NULL
data date NOT NULL
rezultat fire_check_result NOT NULL
executant_furnizor_id uuid NULL FK->suppliers(id) RESTRICT
executant_employee_id uuid NULL FK->employees(id) RESTRICT
numar_document text NULL
cost numeric(14,2) NOT NULL DEFAULT 0
urmatoarea_scadenta date NULL
observatii text NULL
document_id uuid NULL FK->documents(id) RESTRICT
```
constrangeri: CHECK(data <= current_date); CHECK(cost >= 0); CHECK(executant_furnizor_id IS NOT NULL OR executant_employee_id IS NOT NULL); CHECK(urmatoarea_scadenta IS NULL OR urmatoarea_scadenta > data)
indexuri: (organization_id, fire_extinguisher_id, data DESC) WHERE deleted_at IS NULL
rls: SELECT = `has_perm(org,'ssm.read')`; INSERT/UPDATE = `has_perm(org,'ssm.write')`; DELETE = false
nota: trigger AFTER INSERT actualizeaza pe `fire_extinguishers` doar campul corespunzator lui `kind` si trece `status='ok'`; la `rezultat='casat'` -> `status='casat'` si se retrage din registrul de expirari.

### environmental_permits
scop: autorizatiile de mediu, apa, deseuri si celelalte avize cu termen, cu conditiile impuse si responsabilul.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
denumire text NOT NULL
tip text NOT NULL
emitent text NOT NULL
numar text NOT NULL
data_emitere date NOT NULL
data_expirare date NULL
permanenta boolean NOT NULL DEFAULT false
locatie_id uuid NULL FK->locations(id) RESTRICT
conditii text NULL
obligatii_raportare text NULL
responsabil_employee_id uuid NULL FK->employees(id) RESTRICT
status permit_status NOT NULL DEFAULT 'valabil'
termen_reinnoire_zile int NOT NULL DEFAULT 90
document_id uuid NULL FK->documents(id) RESTRICT
```
constrangeri: UNIQUE(organization_id, emitent, numar) WHERE deleted_at IS NULL; CHECK(data_expirare IS NULL OR data_expirare > data_emitere); CHECK(permanenta = true AND data_expirare IS NULL OR permanenta = false AND data_expirare IS NOT NULL)
indexuri: (organization_id, data_expirare) WHERE deleted_at IS NULL AND permanenta = false
rls: SELECT = `has_perm(org,'ssm.read')`; INSERT/UPDATE = `has_perm(org,'ssm.write')`; DELETE = false
nota: `status` este derivat (trigger + job zilnic), niciodata editabil din UI in afara de `in_reinnoire` / `revocat`. Reinnoirea creeaza un rand NOU legat prin `inlocuieste_permit_id uuid NULL FK->environmental_permits(id)` — nu se editeaza numarul si data pe randul vechi (dovada istorica in caz de control).

### occupational_health_exams
scop: fisele de aptitudine din medicina muncii, cu rezultatul si termenul urmatorului control.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
employee_id uuid NOT NULL FK->employees(id) RESTRICT
kind occ_exam_kind NOT NULL
data date NOT NULL
data_expirare date NULL
rezultat occ_exam_result NOT NULL
restrictii text NULL
clinica_furnizor_id uuid NULL FK->suppliers(id) RESTRICT
clinica_denumire text NULL
medic text NULL
numar_fisa text NULL
document_id uuid NULL FK->documents(id) RESTRICT
cost numeric(14,2) NOT NULL DEFAULT 0
```
constrangeri: UNIQUE(organization_id, employee_id, data, kind) WHERE deleted_at IS NULL; CHECK(data <= current_date); CHECK(data_expirare IS NULL OR data_expirare > data); CHECK(rezultat IN ('apt_conditionat','inapt_temporar','inapt') AND restrictii IS NOT NULL OR rezultat = 'apt')
indexuri: (organization_id, employee_id, data DESC) WHERE deleted_at IS NULL; (organization_id, data_expirare) WHERE deleted_at IS NULL
rls: SELECT = `has_perm(org,'ssm.medical.read') OR employee_id = current_employee_id(org)`; INSERT/UPDATE = `has_perm(org,'ssm.medical.write')`; DELETE = false
nota: date de sanatate (GDPR art. 9). Managerul NU are acces la randul brut — vede doar `v_employee_fitness` (apt/inapt + restrictii active + data expirarii), fara clinica, medic, numar fisa, document. Fiecare descarcare a `document_id` trece obligatoriu prin Server Action cu scriere in `audit_log` (acelasi tipar ca la CNP/IBAN). Nu se stocheaza niciodata diagnostic.

### employee_work_restrictions
scop: consecinta operationala a unui rezultat medical neconform — restrictia efectiva care se verifica in alte module.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
employee_id uuid NOT NULL FK->employees(id) RESTRICT
exam_id uuid NULL FK->occupational_health_exams(id) RESTRICT
kind work_restriction_kind NOT NULL
detaliu text NULL
valabil_de_la date NOT NULL
valabil_pana_la date NULL
blocheaza boolean NOT NULL DEFAULT false
ridicata_la date NULL
ridicata_de uuid NULL
```
constrangeri: CHECK(valabil_pana_la IS NULL OR valabil_pana_la >= valabil_de_la); EXCLUDE pe (organization_id, employee_id, kind) cu suprapunere de interval WHERE deleted_at IS NULL AND ridicata_la IS NULL
indexuri: (organization_id, employee_id) WHERE deleted_at IS NULL AND ridicata_la IS NULL
rls: SELECT = `has_perm(org,'ssm.read') OR is_manager_of(employee_id) OR employee_id = current_employee_id(org)`; INSERT/UPDATE = `has_perm(org,'ssm.medical.write')`; DELETE = false
nota: e tabela publica pentru manageri (`kind` + `detaliu` scurt), spre deosebire de fisa medicala. Aici traieste consecinta, nu diagnosticul.

### Consecinte propuse pentru `apt_conditionat` / `inapt` / fisa expirata

Politica per organizatie, in `org_settings.ssm` (`blocheaza` | `avertizeaza` | `ignora`), niciodata hardcodata:

1. **Trigger la INSERT** pe `occupational_health_exams` cu rezultat ≠ `apt`: se creeaza automat randuri draft in `employee_work_restrictions` (HR confirma tipul), plus notificare catre HR + managerul direct prin infrastructura comuna de alerte.
2. **`inapt` / `inapt_temporar`**: `blocheaza = true`. Efecte, verificate in Server Action + RLS-ul modulului tinta:
   - attendance: refuza inregistrarea/aprobarea pontajului pe zile din interval (mesaj: „angajat inapt medical — necesita decizie HR").
   - fleet: exclus din lista de soferi asignabili (`fara_conducere_auto`), iar asignarile viitoare existente sunt marcate pentru revizuire.
   - maintenance: nu poate fi `atribuit_lui` pe interventii, nici executant pe echipament ISCIR.
   - onboarding/HR: se genereaza task „decizie: schimbare post / suspendare CIM".
3. **`apt_conditionat`**: `blocheaza = false` implicit — avertisment vizibil (badge in fisa angajatului, in planificator si la asignare), plus blocaje selective doar pentru restrictiile bifate ca blocante (ex. `fara_ture_noapte` blocheaza planificarea in schimbul 3, `fara_inaltime` blocheaza asignarea pe interventii marcate „lucru la inaltime").
4. **Fisa expirata** (`data_expirare < current_date`): tratata ca `inapt_temporar` la nivel de avertizare (escaladare la blocare dupa N zile de intarziere, N configurabil), pentru ca legal angajatul nu poate fi mentinut in activitate fara aviz valabil.
5. **Angajarea**: examenul `angajare` cu rezultat `apt`/`apt_conditionat` este precondition pentru activarea angajatului in modulul onboarding (checklist item blocant).
6. Toate blocajele sunt **soft-overridable** de `org_admin` cu motiv obligatoriu, scris in `audit_log` — altfel utilizatorii ocolesc sistemul in afara lui.

---

# MENTENANTA

### equipment
scop: registrul echipamentelor si utilajelor supuse mentenantei.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
cod_inventar text NOT NULL
denumire text NOT NULL
categorie_id uuid NULL FK->equipment_categories(id) RESTRICT
serie text NULL
producator text NULL
model text NULL
an_fabricatie int NULL
locatie_id uuid NULL FK->locations(id) RESTRICT
locatie_detaliu text NULL
vehicle_id uuid NULL FK->vehicles(id) RESTRICT
parent_equipment_id uuid NULL FK->equipment(id) RESTRICT
data_achizitie date NULL
valoare_achizitie numeric(14,2) NOT NULL DEFAULT 0
garantie_expira date NULL
status equipment_status NOT NULL DEFAULT 'activ'
responsabil_employee_id uuid NULL FK->employees(id) RESTRICT
supus_iscir boolean NOT NULL DEFAULT false
numar_inregistrare_iscir text NULL
document_id uuid NULL FK->documents(id) RESTRICT
```
constrangeri: UNIQUE(organization_id, cod_inventar) WHERE deleted_at IS NULL; UNIQUE(organization_id, serie) WHERE deleted_at IS NULL AND serie IS NOT NULL; CHECK(an_fabricatie IS NULL OR an_fabricatie BETWEEN 1900 AND extract(year from current_date)+1); CHECK(valoare_achizitie >= 0); CHECK(parent_equipment_id <> id)
indexuri: (organization_id, status) WHERE deleted_at IS NULL; (organization_id, categorie_id) WHERE deleted_at IS NULL; (organization_id, garantie_expira) WHERE deleted_at IS NULL AND garantie_expira IS NOT NULL
rls: SELECT = `has_perm(org,'maintenance.read') OR responsabil_employee_id = current_employee_id(org)`; INSERT/UPDATE = `has_perm(org,'maintenance.write')`; DELETE = false
nota: vehiculele raman in modulul `fleet`; `vehicle_id` leaga doar echipamentul montat pe vehicul (macara, cap tractor + agregat frigorific). `status` este derivat partial: trece automat in `in_mentenanta` cand exista o interventie deschisa cu downtime si revine la starea anterioara la inchidere — pastreaza `status_anterior` in meta ca sa nu pierzi `rezerva`.

### equipment_meters
scop: contorul curent al unui echipament (ore de functionare sau km), sursa scadentelor care nu sunt calendaristice.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
equipment_id uuid NOT NULL FK->equipment(id) RESTRICT
kind meter_kind NOT NULL
unitate text NOT NULL
valoare_curenta numeric(14,2) NOT NULL DEFAULT 0
offset_resetare numeric(14,2) NOT NULL DEFAULT 0
actualizat_la timestamptz NULL
actualizat_de uuid NULL
rata_zilnica numeric(12,4) NULL
rata_calculata_la timestamptz NULL
rata_manuala_zilnica numeric(12,4) NULL
prag_citire_veche_zile int NOT NULL DEFAULT 30
```
constrangeri: UNIQUE(organization_id, equipment_id, kind) WHERE deleted_at IS NULL; CHECK(valoare_curenta >= 0); CHECK(rata_zilnica IS NULL OR rata_zilnica >= 0)
indexuri: (organization_id, equipment_id) WHERE deleted_at IS NULL; (organization_id, actualizat_la) WHERE deleted_at IS NULL
rls: SELECT = `has_perm(org,'maintenance.read')`; INSERT/UPDATE = `has_perm(org,'maintenance.write')`; DELETE = false
nota: `valoare_curenta` este **derivata** din ultima citire + `offset_resetare` (contor schimbat fizic) — nu se editeaza direct. `rata_zilnica` este recalculata de job, `rata_manuala_zilnica` e fallback-ul introdus de om cand nu exista istoric suficient.

### equipment_meter_readings
scop: istoricul append-only al citirilor de contor, din care se calculeaza rata de consum si proiectia scadentei.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
meter_id uuid NOT NULL FK->equipment_meters(id) RESTRICT
equipment_id uuid NOT NULL FK->equipment(id) RESTRICT
valoare numeric(14,2) NOT NULL
citit_la timestamptz NOT NULL
sursa meter_source NOT NULL DEFAULT 'manual'
resetare boolean NOT NULL DEFAULT false
intervention_id uuid NULL FK->maintenance_interventions(id) RESTRICT
observatii text NULL
```
constrangeri: UNIQUE(organization_id, meter_id, citit_la) WHERE deleted_at IS NULL; CHECK(valoare >= 0); CHECK(citit_la <= now())
indexuri: (organization_id, meter_id, citit_la DESC) WHERE deleted_at IS NULL
rls: SELECT = `has_perm(org,'maintenance.read')`; INSERT = `has_perm(org,'maintenance.write') OR current_employee_id(org) IS NOT NULL` (operatorul isi poate raporta orele); UPDATE = `has_perm(org,'maintenance.write')`; DELETE = false
nota: trigger BEFORE INSERT respinge o valoare mai mica decat ultima citire daca `resetare = false` — altfel proiectiile devin negative si alertele explodeaza. La `resetare = true` se actualizeaza `offset_resetare` pe meter.

### maintenance_plans
scop: planul de mentenanta recurent pe un echipament, cu interval calendaristic sau pe contor.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
equipment_id uuid NOT NULL FK->equipment(id) RESTRICT
denumire text NOT NULL
kind maint_plan_kind NOT NULL
interval_tip maint_interval_kind NOT NULL
interval_valoare numeric(12,2) NOT NULL
meter_id uuid NULL FK->equipment_meters(id) RESTRICT
instructiuni text NULL
furnizor_id uuid NULL FK->suppliers(id) RESTRICT
responsabil_employee_id uuid NULL FK->employees(id) RESTRICT
durata_estimata_ore numeric(6,2) NULL
cost_estimat numeric(14,2) NOT NULL DEFAULT 0
ultima_efectuare_data date NULL
ultima_efectuare_contor numeric(14,2) NULL
urmatoarea_scadenta_data date NULL
contor_tinta numeric(14,2) NULL
proiectie_scadenta date NULL
proiectie_calculata_la timestamptz NULL
prag_avertizare_zile int NOT NULL DEFAULT 14
prag_avertizare_unitati numeric(12,2) NULL
oprire_necesara boolean NOT NULL DEFAULT false
activ boolean NOT NULL DEFAULT true
```
constrangeri: CHECK(interval_valoare > 0); CHECK(interval_tip = 'zile' AND meter_id IS NULL OR interval_tip <> 'zile' AND meter_id IS NOT NULL); CHECK(interval_tip = 'zile' AND contor_tinta IS NULL OR interval_tip <> 'zile'); CHECK(interval_tip <> 'zile' OR proiectie_scadenta IS NULL)
indexuri: (organization_id, urmatoarea_scadenta_data) WHERE deleted_at IS NULL AND activ; (organization_id, proiectie_scadenta) WHERE deleted_at IS NULL AND activ AND proiectie_scadenta IS NOT NULL; (organization_id, equipment_id) WHERE deleted_at IS NULL
rls: SELECT = `has_perm(org,'maintenance.read')`; INSERT/UPDATE = `has_perm(org,'maintenance.write')`; DELETE = false
nota: cele doua scadente sunt coloane diferite pentru ca au semantica diferita. `urmatoarea_scadenta_data` = adevar contractual (interval calendaristic). `contor_tinta` = adevar pentru ore/km. `proiectie_scadenta` = estimare, recalculata, niciodata editabila de utilizator si niciodata afisata fara marcaj „estimat".

### maintenance_interventions
scop: lucrarea de mentenanta efectiv executata, cu cost, downtime si documente.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
equipment_id uuid NOT NULL FK->equipment(id) RESTRICT
plan_id uuid NULL FK->maintenance_plans(id) RESTRICT
fault_report_id uuid NULL FK->fault_reports(id) RESTRICT
numar text NOT NULL
kind maint_intervention_kind NOT NULL
data_start timestamptz NOT NULL
data_finalizare timestamptz NULL
executant maint_executor_kind NOT NULL
furnizor_id uuid NULL FK->suppliers(id) RESTRICT
executant_employee_id uuid NULL FK->employees(id) RESTRICT
descriere text NOT NULL
contor_la_interventie numeric(14,2) NULL
cost_manopera numeric(14,2) NOT NULL DEFAULT 0
cost_piese numeric(14,2) NOT NULL DEFAULT 0
cost_total numeric(14,2) GENERATED ALWAYS AS (cost_manopera + cost_piese) STORED
downtime_ore numeric(8,2) NOT NULL DEFAULT 0
numar_document_furnizor text NULL
observatii text NULL
```
constrangeri: UNIQUE(organization_id, numar) WHERE deleted_at IS NULL; CHECK(data_finalizare IS NULL OR data_finalizare >= data_start); CHECK(cost_manopera >= 0 AND cost_piese >= 0 AND downtime_ore >= 0); CHECK(executant = 'furnizor' AND furnizor_id IS NOT NULL OR executant = 'intern' AND executant_employee_id IS NOT NULL)
indexuri: (organization_id, equipment_id, data_start DESC) WHERE deleted_at IS NULL; (organization_id, data_start DESC) WHERE deleted_at IS NULL AND data_finalizare IS NULL
rls: SELECT = `has_perm(org,'maintenance.read') OR executant_employee_id = current_employee_id(org)`; INSERT/UPDATE = `has_perm(org,'maintenance.write')`; DELETE = false
nota: la finalizare, trigger-ul (a) inchide `plan_id`: seteaza `ultima_efectuare_data`, `ultima_efectuare_contor = contor_la_interventie`, recalculeaza scadenta/`contor_tinta`; (b) inchide `fault_report_id` in `rezolvat`; (c) inregistreaza o citire de contor cu `sursa='interventie'`. `cost_total` este generated — niciodata calculat in client.

### maintenance_intervention_parts
scop: piesele si materialele consumate intr-o interventie, legate optional de stoc.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
intervention_id uuid NOT NULL FK->maintenance_interventions(id) RESTRICT
inventory_item_id uuid NULL FK->inventory_items(id) RESTRICT
denumire text NOT NULL
cod_piesa text NULL
cantitate numeric(12,3) NOT NULL
unitate text NOT NULL DEFAULT 'buc'
pret_unitar numeric(14,2) NOT NULL DEFAULT 0
valoare numeric(14,2) GENERATED ALWAYS AS (round(cantitate * pret_unitar, 2)) STORED
```
constrangeri: CHECK(cantitate > 0); CHECK(pret_unitar >= 0)
indexuri: (organization_id, intervention_id) WHERE deleted_at IS NULL
rls: SELECT/INSERT/UPDATE = ca la `maintenance_interventions`; DELETE = false
nota: tabela, nu `jsonb` — piesele se raporteaza, se agrega pe cost si se leaga de stoc cand feature-ul `inventory` e activ. `denumire` ramane text liber pentru piese cumparate ad-hoc, deci modulul functioneaza si fara `inventory`. `cost_piese` de pe interventie se recalculeaza din suma liniilor prin trigger.

### fault_reports
scop: sesizarea unei defectiuni de catre orice angajat si urmarirea ei pana la rezolvare.
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
numar text NOT NULL
equipment_id uuid NOT NULL FK->equipment(id) RESTRICT
raportor_employee_id uuid NOT NULL FK->employees(id) RESTRICT
descriere text NOT NULL
severitate fault_severity NOT NULL DEFAULT 'medie'
opreste_productia boolean NOT NULL DEFAULT false
status fault_status NOT NULL DEFAULT 'nou'
atribuit_employee_id uuid NULL FK->employees(id) RESTRICT
atribuit_la timestamptz NULL
rezolvat_la timestamptz NULL
motiv_respingere text NULL
intervention_id uuid NULL FK->maintenance_interventions(id) RESTRICT
raportat_la timestamptz NOT NULL DEFAULT now()
```
constrangeri: UNIQUE(organization_id, numar) WHERE deleted_at IS NULL; CHECK(status = 'respins' AND motiv_respingere IS NOT NULL OR status <> 'respins'); CHECK(status IN ('atribuit','in_lucru') AND atribuit_employee_id IS NOT NULL OR status NOT IN ('atribuit','in_lucru')); CHECK(rezolvat_la IS NULL OR rezolvat_la >= raportat_la)
indexuri: (organization_id, status, severitate) WHERE deleted_at IS NULL; (organization_id, equipment_id, raportat_la DESC) WHERE deleted_at IS NULL
rls: SELECT = `has_perm(org,'maintenance.read') OR raportor_employee_id = current_employee_id(org) OR atribuit_employee_id = current_employee_id(org)`; INSERT = `has_perm(org,'maintenance.fault.report') OR current_employee_id(org) IS NOT NULL` (cu `raportor_employee_id = current_employee_id(org)` fortat server-side); UPDATE = `has_perm(org,'maintenance.write') OR (atribuit_employee_id = current_employee_id(org) AND doar tranzitia atribuit->in_lucru->rezolvat)`; DELETE = false
nota: raportarea trebuie sa fie deschisa oricarui angajat (altfel defectele nu ajung niciodata in sistem), dar atribuirea si respingerea cer `maintenance.fault.assign`. Tranzitiile de status se valideaza intr-un trigger cu masina de stari, nu in UI: `nou -> atribuit|respins`, `atribuit -> in_lucru|respins`, `in_lucru -> rezolvat`, `rezolvat -> inchis|in_lucru`.

### fault_report_attachments
scop: fotografii si documente atasate unei sesizari (esential pentru diagnoza de la distanta).
coloane:
```
id uuid PK
organization_id uuid NOT NULL FK->organizations(id) RESTRICT
fault_report_id uuid NOT NULL FK->fault_reports(id) RESTRICT
document_id uuid NOT NULL FK->documents(id) RESTRICT
```
constrangeri: UNIQUE(organization_id, fault_report_id, document_id) WHERE deleted_at IS NULL
indexuri: (organization_id, fault_report_id) WHERE deleted_at IS NULL
rls: mosteneste vizibilitatea `fault_reports` (EXISTS pe randul parinte); DELETE = false

---

## Scadenta pe ore de functionare / km — model si alerte

**Principiul:** o scadenta pe contor NU este o data. Adevarul este `contor_tinta`; data este doar o proiectie. Le tinem in coloane separate si nu amestecam niciodata cele doua semantici in aceeasi coloana.

**1. Tinta.** La finalizarea unei interventii legate de plan:
`contor_tinta = ultima_efectuare_contor + interval_valoare`
(pentru primul ciclu: `contor_tinta = valoare_curenta + interval_valoare`, sau contorul de la punerea in functiune).

**2. Ramas.** `ramas = contor_tinta - meter.valoare_curenta` (in ore sau km). Aceasta este marimea afisata primar in UI: „mai are 87 h pana la revizie", nu o data falsa.

**3. Rata de consum.** Job `pg_cron` nocturn, pe fiecare `equipment_meters`:
```
rata_zilnica = (v_ultim - v_referinta) / nullif(zile_intre, 0)
  peste fereastra ultimelor 90 de zile, minim 3 citiri si minim 7 zile acoperite
  ignorand citirile cu resetare = true
```
Daca nu exista date suficiente: `rata_zilnica = rata_manuala_zilnica` (introdusa de responsabil, ex. „8 h/zi lucratoare"); daca nici aceea nu exista, `rata_zilnica = NULL`.

**4. Proiectia.**
```
proiectie_scadenta = data(actualizat_la) + ceil(ramas / rata_zilnica) zile,  daca rata_zilnica > 0
proiectie_scadenta = NULL,                                                    daca rata_zilnica IS NULL sau 0
```
`ramas <= 0` -> proiectia devine data curenta (deja scadent). Se scrie si `proiectie_calculata_la`.

**5. Alerta.** Registrul comun de expirari primeste un rand pe plan, `entity_type = 'maintenance_plan'`, cu:
- `due_date = urmatoarea_scadenta_data` pentru `interval_tip = 'zile'`;
- `due_date = proiectie_scadenta` pentru ore/km, plus `meta = {tip:'contor', unitate, ramas, contor_tinta, valoare_curenta, estimat:true}` — UI-ul afiseaza „~12.03.2026 (estimat) — mai sunt 87 h".

Alerta se declanseaza pe **oricare** dintre conditii (OR, nu AND):
- `ramas <= prag_avertizare_unitati` (prag in ore/km — cel mai fiabil semnal);
- `proiectie_scadenta <= current_date + prag_avertizare_zile` (util pentru planificarea aprovizionarii cu piese si a opririi);
- `ramas <= 0` -> severitate ridicata, indiferent de proiectie.

**6. Recalculare imediata.** Trigger AFTER INSERT pe `equipment_meter_readings` recalculeaza `ramas` si `proiectie_scadenta` doar pentru planurile echipamentului respectiv si face `expiry_upsert`. Fara asta, un utilaj care lucreaza 20 h/zi ar putea depasi scadenta intre doua rulari ale job-ului nocturn.

**7. Contor invechit.** Daca `now() - actualizat_la > prag_citire_veche_zile`, proiectia este nesigura: se publica o alerta separata `entity_type = 'equipment_meter_stale'` („contor necitit de 45 de zile") si UI-ul marcheaza proiectia ca expirata. Un contor necitit este cauza reala a reviziilor ratate, nu calculul.

**8. Ce nu facem:** nu scriem proiectia in `urmatoarea_scadenta_data`, nu generam automat interventii din proiectie (doar propuneri in lista „de planificat"), nu blocam echipamentul automat la depasire — doar escaladam severitatea alertei catre responsabil si `org_admin`.

## Rapoarte (view-uri; `security_invoker = on`, deci RLS-ul tabelelor de baza se aplica automat)

### v_maintenance_cost_per_equipment
grupare: `organization_id, equipment_id, luna (date_trunc)`
coloane: `equipment_id, cod_inventar, denumire, categorie, luna, nr_interventii, cost_manopera, cost_piese, cost_total, cost_preventiv, cost_corectiv, procent_corectiv, cost_cumulat_12l, valoare_achizitie, cost_cumulat_12l / nullif(valoare_achizitie,0) AS raport_cost_valoare`
utilitate: `raport_cost_valoare > 0.4` intr-un an = semnal de inlocuire. `procent_corectiv` mare = plan preventiv prost dimensionat.

### v_equipment_downtime
grupare: `organization_id, equipment_id, luna`
coloane: `equipment_id, luna, downtime_ore_total, downtime_planificat (kind = 'preventiva'|'revizie'|'verificare_legala'), downtime_neplanificat (kind = 'corectiva'|'avarie'), nr_opriri, mttr_ore = downtime_neplanificat / nullif(nr_avarii,0), disponibilitate_pct = 1 - downtime_ore_total / ore_calendaristice_luna`
nota: `ore_calendaristice_luna` vine dintr-un parametru de organizatie (ore de program pe schimb), nu 24×zile — altfel disponibilitatea iese fals de buna. Parametrul sta in tabela de configurare cu istoric.

### v_equipment_fault_ranking
grupare: `organization_id, equipment_id` pe fereastra parametrizata (ultimele 12 luni)
coloane: `equipment_id, nr_sesizari, nr_sesizari_critice, nr_respinse, timp_mediu_atribuire_ore, timp_mediu_rezolvare_ore, mtbf_zile = zile_in_fereastra / nullif(nr_avarii,0), ultima_avarie_la, top_severitate`
ordonare implicita: `nr_sesizari_critice DESC, nr_sesizari DESC`.

### v_ssm_compliance (bonus, alimenteaza dashboard-ul SSM)
coloane: `organization_id, employee_id, instruire_periodica_scadenta_la, zile_pana_la_scadenta, fisa_medicala_expira_la, are_restrictii_active, status_conformitate ('conform'|'expira_curand'|'neconform')`
plus agregat per organizatie: `pct_angajati_conformi, nr_stingatoare_expirate, nr_autorizatii_mediu_sub_90_zile`.