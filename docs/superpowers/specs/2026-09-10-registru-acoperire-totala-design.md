# Registrul de documente — acoperire totală

**Data:** 2026-09-10
**Stare:** aprobat, gata de plan de implementare
**Continuă:** `2026-09-03-registru-inregistrare-documente-design.md`

Specificația din 3 septembrie a construit registrul și l-a conectat la două surse.
Asta îl duce la acoperire totală: toate sursele care produc un document care se poate
tipări sau semna, plus trei lucruri pe care specificația precedentă le-a ratat la
citirea actelor.

---

## 1. Ce a ratat prima specificație

Recitirea textului autentic al Instrucțiunilor aprobate prin Ordinul de zi nr. 217
din 23 mai 1996, descărcat de pe site-ul Arhivelor Naționale, a scos trei abateri.

### 1.1 Indicativul dosarului lipsește din registru

Prima specificație a citat lista de elemente din art. 9 și s-a oprit cu un element
înainte de final. Textul real:

> „La înregistrarea documentelor se vor preciza următoarele elemente: numărul de
> înregistrare, data înregistrării, numărul și data documentului date de emitent,
> numărul filelor documentului, numărul anexelor, emitentul, conținutul documentului
> în rezumat, compartimentul căruia i s-a repartizat, data expedierii, modul
> rezolvării, destinatarul, numărul de înregistrare al documentului la care se
> conexează **și indicativul dosarului după nomenclator, care se va stabili și
> completa în registru după rezolvarea documentului**."

Art. 11 definește indicativul: cifră romană pentru compartiment, literă majusculă
pentru subdiviziune, cifră arabă pentru dosar. Oricare dintre primele două poate
lipsi dacă firma n-are subdiviziuni sau compartimente. Tot art. 11:

> „La înregistrarea documentelor, indicativul dosarului va figura în registrul de
> intrare-ieșire, la rubrica rezervată acestuia, **ca și pe fiecare document în
> parte**."

Deci indicativul nu e doar o coloană de registru: se tipărește pe document.

Nomenclatorul se întocmește de fiecare creator, după modelul din anexa nr. 1, și se
confirmă de Arhivele Naționale — art. 5 lit. a) și art. 11.

### 1.2 Răspunsurile primeau număr nou

Art. 9, textual:

> „În cazul documentelor expediate ca răspuns, acestea vor primi **numărul de
> înregistrare al documentului la care se răspunde**."

Același articol cere pe rândul de registru coloanele „data expedierii", „modul
rezolvării" și „destinatarul" — care descriu modelul de registratură clasic: **un
rând per caz**, iar răspunsul se consemnează pe rândul cererii.

Implementarea de azi alocă un număr proaspăt la fiecare inserare. Decizia care aprobă
o cerere de concediu ar lua un număr nou, contrar art. 9.

### 1.3 Exercițiul nu se poate închide

Garda care blochează un an închis există (`internal.registru_verifica_exercitiu`), dar
nu există nicio funcție care să pună `stare = 'inchis'`. Pe codul de azi, o firmă nu
poate ajunge niciodată în starea aia. Pct. 58 lit. h) din OMFP 2634/2015 rămâne
neacoperit în fapt, deși tabela îl anticipează.

---

## 2. Cele trei regimuri legale, ținute separat

Ușor de confundat, și confuzia produce fie registre umflate, fie goluri.

| Regim                             | Temei                                      | Ce impune                                                                                              | Unde e în aplicație                                  |
| --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Registrul de intrare-ieșire       | L. 16/1996 art. 7 · Ord. 217/1996 art. 8-9 | Toate documentele intrate, ieșite ori întocmite pentru uz intern, într-un contor unic pe firmă, anual  | `registru_documente` — obiectul acestei specificații |
| Numerotarea pe serii              | OMFP 2634/2015 pct. 24                     | Număr sau serie secvențială per tip de document financiar-contabil, cu numărul de pornire pe exercițiu | `document_sequences` — patru consumatori azi         |
| Registre unice de evidență impuse | HG 1425/2006 art. 141                      | Patru registre distincte, cu modele proprii în anexele 15-18                                           | **neconstruit** — livrare separată, vezi §9          |

Registrul general stă **peste** seriile proprii, nu în locul lor. Art. 9 cere în
registru două coloane distincte: „numărul de înregistrare" și „numărul și data
documentului date de emitent". Un contract de muncă are și numărul lui din
`public.aloca_numar_contract`, și un număr de registru.

---

## 3. Nomenclatorul dosarelor

### 3.1 Trei tabele

`public.nomenclator_dosare` — un rând per dosar, cu compartimentul și subdiviziunea
denormalizate, adică exact forma tabelului din anexa nr. 1:

| Coloană                 | Rol                                                                  |
| ----------------------- | -------------------------------------------------------------------- |
| `compartiment_cifra`    | cifră romană, rubrica 1 din anexa 1                                  |
| `compartiment_denumire` | denumirea compartimentului de muncă                                  |
| `subdiviziune_litera`   | literă majusculă, rubrica 2 — `null` dacă firma n-are                |
| `subdiviziune_denumire` | `null` odată cu litera                                               |
| `dosar_cifra`           | cifră arabă, rubrica 3, renumerotată de la 1 la fiecare compartiment |
| `continut`              | conținutul documentelor ce constituie dosarul, în rezumat            |
| `termen_pastrare`       | rubrica 4                                                            |
| `indicativ`             | coloană generată: `II.A.3`, `II.3` sau `3`                           |

`public.nomenclator_tipuri` — leagă un `tip_document` de un dosar. Cheie unică pe
(firmă, tip_document): un tip se clasează într-un singur dosar.

`public.nomenclator_config` — un rând per firmă, cu data avizării la Arhivele
Naționale, numărul avizului și direcția județeană. Art. 11 cere confirmarea; aplicația
n-o poate obține, dar o poate evidenția.

### 3.2 Nomenclator implicit

O firmă nouă primește un nomenclator generat din modulele aplicației, prin
`internal.seed_nomenclator(uuid)`, chemată dintr-un trigger `after insert` pe
`organizations` și rulată o dată pentru firmele existente.

Șapte compartimente: conducere și organizare, resurse umane, financiar-contabil,
securitate și sănătate în muncă, administrativ și patrimoniu, parc auto, formare
profesională. Fiecare tip de document din §5 primește un dosar.

⚠️ **Termenele de păstrare din seed se confirmă de contabil sau jurist.** Sursele
folosite: OMFP 2634/2015 pct. 38-40 (state de salarii 50 de ani; celelalte documente
financiar-contabile 10 ani; anexa 4, cinci ani) și HG 1425/2006 (fișa de instruire se
păstrează de la angajare până la încetarea raportului de muncă). Se trec și în
`NOTES.md`.

### 3.3 Indicativul ajunge în registru

`internal.inregistreaza_document` caută dosarul după `tip_document` în
`nomenclator_tipuri` și scrie `indicativ_dosar` pe rândul de registru. Un tip fără
dosar lasă coloana goală — nu blochează înregistrarea, fiindcă art. 9 spune că
indicativul se completează „după rezolvarea documentului". Se poate corecta manual
din arhivă.

---

## 4. Regula răspunsului

### 4.1 Un rând per caz

`internal.rezolva_document(p_organization_id, p_entitate_tip, p_entitate_id,
p_mod_rezolvare, p_destinatar, p_data_expedierii)` găsește rândul de registru al
entității și completează `data_expedierii`, `mod_rezolvare`, `destinatar` și
`rezolvat_la`. Nu alocă număr. Nu inserează rând.

Cererea de concediu: `after insert` pe `leave_requests` înregistrează cu sens
`intrare` și tip `cerere_concediu`. `after update of status` cheamă
`rezolva_document` când statusul devine final, cu `mod_rezolvare` egal cu decizia.
Registrul arată un rând, 437, cu cererea și rezolvarea ei.

Aceeași mecanică pentru orice sursă care are un status care se închide: foi de parcurs
aprobate, deplasări, sesizări de defecțiune, instanțe de checklist finalizate.

### 4.2 Garda se lărgește

`internal.guard_registru_documente` rescrie azi din `old` toate coloanele de
identitate. Coloanele de rezolvare trebuie să devină scriibile: `data_expedierii`,
`mod_rezolvare`, `destinatar`, `rezolvat_la`, `indicativ_dosar`, `conexat_la`,
`numar_file`, `numar_anexe`, `compartiment`. Coloanele pinuite rămân pinuite.

---

## 5. Cele 43 de surse

Verificate în cod, nu din memorie. Coloana „drum" spune cum se înregistrează.

### 5.1 Ieșiri — 11

| Sursă                       | Tip document           | Drum                   |
| --------------------------- | ---------------------- | ---------------------- |
| `hr_issued_documents`       | după șablon            | trigger — **există**   |
| `employment_contracts`      | `contract_munca`       | trigger — **există**   |
| `contract_suspendari`       | `decizie_suspendare`   | trigger                |
| `job_descriptions`          | `fisa_postului`        | trigger                |
| `personnel_authorizations`  | `autorizatie_personal` | trigger                |
| `course_completion_records` | `adeverinta_curs`      | trigger                |
| `invitations`               | `invitatie_inrolare`   | trigger                |
| `puncte_lucru`              | `afis_punct_lucru`     | RPC din pagina de afiș |
| `work_accidents`            | `comunicare_itm`       | trigger                |
| `payroll_garnishments`      | `adresa_poprire`       | trigger                |
| `reges_propuneri`           | `transmitere_reges`    | trigger                |

### 5.2 Uz intern — 25

| Sursă                       | Tip document                                                       | Drum                |
| --------------------------- | ------------------------------------------------------------------ | ------------------- |
| `leave_requests`            | `cerere_concediu`                                                  | trigger + rezolvare |
| `holiday_compensation`      | `decizie_compensare_sarbatoare`                                    | trigger             |
| `overtime_compensation`     | `decizie_compensare_ore`                                           | trigger             |
| `attendance_periods`        | `foaie_colectiva_prezenta`                                         | RPC din export      |
| `payroll_periods`           | `stat_plata`, `fluturas`, `d112`, `nota_contabila`, `ordin_bancar` | RPC din export      |
| `business_trips`            | `ordin_deplasare`                                                  | trigger             |
| `per_diem_calculations`     | `decont_deplasare`                                                 | trigger             |
| `inventory_allocations`     | `pv_predare_primire`                                               | trigger             |
| `ppe_issuances`             | `fisa_eip`                                                         | trigger             |
| `ssm_trainings`             | `fisa_instruire`                                                   | trigger             |
| `risk_assessments`          | `evaluare_riscuri`                                                 | trigger             |
| `prevention_plan_measures`  | `plan_prevenire`                                                   | trigger             |
| `hot_work_permits`          | `permis_lucru_foc`                                                 | trigger             |
| `fire_extinguisher_checks`  | `pv_verificare_stingator`                                          | trigger             |
| `evacuation_drills`         | `pv_exercitiu_evacuare`                                            | trigger             |
| `safety_committee_meetings` | `pv_sedinta_cssm`                                                  | trigger             |
| `dangerous_incidents`       | `pv_incident_periculos`                                            | trigger             |
| `occupational_diseases`     | `fisa_semnalare_bp`                                                | trigger             |
| `employee_evaluations`      | `fisa_evaluare`                                                    | trigger             |
| `checklist_instances`       | `dovada_integrare`                                                 | trigger + rezolvare |
| `trip_sheets`               | `foaie_parcurs`                                                    | trigger + rezolvare |
| `maintenance_interventions` | `pv_interventie`                                                   | trigger             |
| `fault_reports`             | `sesizare_defectiune`                                              | trigger + rezolvare |
| `announcements`             | `nota_interna`                                                     | trigger             |
| export audit                | `listare_audit`                                                    | RPC din export      |

### 5.3 Intrări — 7

Poartă deja numărul emitentului. Se înregistrează cu `numar_document_emitent` și
`emitent` completate, dar primesc și număr propriu de registru — art. 8 cere
înregistrarea documentelor **intrate**, iar numărul de registru e al nostru.

`employee_documents` · `work_permits` · `occupational_health_exams` ·
`iscir_authorizations` · `environmental_permits` · `vehicle_documents` ·
certificatele medicale, care sunt un caz de `employee_documents`.

### 5.4 Un trigger generic, nu 40 de funcții

`internal.registru_inreg_generic()` citește `to_jsonb(new)` și își ia configurația din
`TG_ARGV`: sens, tip document, eticheta pentru rezumat, coloana cu `employee_id`,
coloana cu numărul emitentului, coloana cu data documentului, coloana cu punctul de
lucru. Numele angajatului se rezolvă din `employees.full_name` când rândul are
`employee_id`.

Patruzeci de funcții aproape identice ar fi patruzeci de locuri de greșit. Triggerele
rămân `zz_*`, ca să ruleze după celelalte pe aceeași tabelă.

---

## 6. Documentele fără rând în bază

`public.inregistreaza_document_generat(...)` — schema `public`, fiindcă `.rpc()` nu
ajunge la schema `app`. Poarta nu e `registru:*`, ci permisiunea modulului, dedusă din
`p_tip_document` printr-un `case` explicit:

| Tipuri                                                             | Poartă                   |
| ------------------------------------------------------------------ | ------------------------ |
| `fluturas`, `stat_plata`, `d112`, `nota_contabila`, `ordin_bancar` | `payroll:export` all     |
| `foaie_colectiva_prezenta`                                         | `attendance:read` all    |
| `afis_punct_lucru`                                                 | `departments:update` all |
| `listare_audit`                                                    | `audit:read` all         |

Un tip necunoscut ridică `P0001`. Regenerarea nu arde numere: idempotența pe
(firmă, tip, entitate) există deja.

---

## 7. Înregistrarea manuală

Fără ea registrul e structural incomplet. Art. 8 cere toate documentele intrate; o
demisie pe hârtie, o adresă de la inspectorat, o citație nu au rând în nicio tabelă.
Codul muncii art. 81 obligă expres la înregistrarea demisiei.

`public.inregistreaza_document_manual(...)` — cere `registru:update` scope `all`,
acceptă doar `sens` `intrare` sau `intern`, cu rezumat obligatoriu. Ecran nou sub
`/registru/adauga`.

**Fluxul de demisie nu există în aplicație.** Căutat în toate migrările și în tot
codul sursă, zero rezultate. Până se construiește, demisia se înregistrează manual.

INSERT direct pe `registru_documente` se revocă de la `authenticated`: numerele se
alocă doar prin funcții, altfel se pot fabrica.

---

## 8. Închiderea exercițiului

`public.inchide_exercitiu_registru(p_organization_id, p_an)` — cere `registru:update`
all. Numără rândurile, calculează amprenta SHA-256 peste registrul anului în ordinea
numărului, scrie `stare = 'inchis'`, `inchis_la`, `inchis_de`, `total_inregistrari`,
`amprenta`.

`public.redeschide_exercitiu_registru(p_organization_id, p_an, p_motiv)` — cere
`org_admin`, motiv între 3 și 500 de caractere, scrie `redeschis_la`, `redeschis_de`,
`motiv_redeschidere`. Cicatricea rămâne permanent; amprenta veche nu se șterge, ca
diferența să fie demonstrabilă.

---

## 9. Ce NU face specificația asta

- **Cele patru registre din HG 1425/2006 art. 141** — accidentați în muncă,
  incidente periculoase, accidente ușoare, accidentați cu incapacitate peste trei zile,
  după modelele din anexele 15-18. Altă obligație, alte formulare, livrare separată.
- **Fluxul de demisie.** Se înregistrează manual până există.
- **Tipărirea indicativului pe fiecare document** (art. 11). Coloana și nomenclatorul
  se construiesc aici; punerea lui în șabloanele de document e pasul următor.
- **Backfill pentru sursele nou conectate.** `0124` a adus în registru documentele
  celor două surse existente. Sursele noi primesc backfill în aceeași migrare, pe
  aceeași mecanică, dar numai pe anul curent.

---

## 10. Verificare

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — lanțul complet, cu build.
- Proba de scriere reală pe cele cinci roluri: un `employee` care depune o cerere de
  concediu trebuie să producă un rând de registru, deși n-are nicio cheie `registru:*`.
- Un `hr` trebuie să vadă arhiva; un `manager` nu.
- Al zecelea document al anului trebuie să aibă numărul 10, nu 1 — capcana `lpad`.
- Un al doilea INSERT pe aceeași entitate nu trebuie să ardă un număr.
- Un an închis trebuie să refuze și înregistrarea, și anularea.
