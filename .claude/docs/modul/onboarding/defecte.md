---
tip: modul
titlu: Integrare (onboarding) — defectele închise de 0088
cai:
  - "src/app/(app)/onboarding/**"
  - "supabase/migrations/0014_checklist.sql"
  - "supabase/migrations/0088_integrare_defecte.sql"
  - "supabase/migrations/0089_integrare_etape.sql"
tabele: [checklist_template_items, checklist_instances, checklist_instance_items]
permisiuni: [checklists:update, checklists:approve]
capcane: []
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul, hr]
---

# Integrare (onboarding) — defectele închise de 0088

Secțiune extrasă din [[modul/onboarding]]: modulul e cel mai corectat din proiect, iar
`0088` a închis nouă defecte tăcute deodată, niciunul prins de typecheck, lint, teste sau
de cele trei bariere SQL. Toate se manifestau ca **refuz fără eroare** sau ca **acceptare
în gol**. Secțiunile de mai jos le păstrează sub codurile din migrare, ca să se poată căuta.

## D1 — de ce managerul are `checklists:update` la `own`, nu la `team`

Managerul n-avea deloc `checklists:update`, deci ramura scrisă pentru el în `0014` era cod
mort din ziua întâi: nu putea bifa niciun pas. `0088` i-a dat cheia, dar la scope **`own`**,
care deschide exact ramura pe responsabil — „pot bifa pasul al cărui responsabil sunt".

`team` ar fi fost greșit din două motive, ambele verificate în migrare:

- ar fi aprins politicile de vizibilitate pe Inventar, care cereau fix `update >= team`,
  deschizând stocul întregii firme (D9);
- s-ar fi ancorat pe subordonarea față de **subiect**, nu pe faptul că e responsabilul
  desemnat — deci managerul ar fi putut bifa pașii HR-ului din onboardingul subalternului.

D9 s-a reparat în **aceeași** migrare, chiar dacă `own` nu aprindea politicile atunci:
ecranul de permisiuni per membru (`0063`) lasă orice `org_admin` să acorde mâine
`checklists:update = team` unui manager anume, și atunci s-ar fi deschis tăcut.

## D6 — mesajul fals „Checklistul este închis"

Două jumătăți ale aceluiași defect:

- **Responsabilul nu vedea INSTANȚA**, doar pasul. Orice pagină citește întâi instanța,
  deci sarcina atribuită se năștea moartă, cu 404. `0088` adaugă o politică PERMISSIVE
  suplimentară — se însumează prin OR, politica din `0014` rămâne neatinsă.
- **Triggerul mințea.** Sub `security invoker`, citirea statusului instanței trecea prin
  RLS cu drepturile celui care bifează; pentru un responsabil care nu e subiectul, rândul
  era invizibil, statusul ieșea NULL, iar `null is distinct from 'in_curs'` e adevărat —
  refuz cu o cauză inexistentă. Funcția e azi `security definer`.

Regula generală, dincolo de caz: **un trigger nu are voie să depindă de o politică de
citire ca să afle un fapt.**

## D4 — pași obligatorii și nebifabili pe veci

`acces_revocat` și `documente_semnate` există în enumul din `0014` și n-au fost
implementate niciodată. Interfața le arăta dezactivate, dar schema Zod accepta enumul
ÎNTREG — iar o Server Action se poate chema direct. Un pas creat pe una din ele era
obligatoriu prin `_automat_ck` și nebifabil, deci instanța devenea imposibil de finalizat.

Valorile **nu** s-au scos din enum (Postgres nu știe `drop value`, iar `0014` e aplicată):
s-au închis printr-un CHECK. Rămân vizibile în catalog ca istorie, dar nu se mai pot scrie.

## D10 — parcursul gol care se finalizează singur

Poarta de finalizare aduna cu `array_agg` pașii obligatorii nebifați și verifica dacă
rezultatul e nenul. Peste **zero** rânduri, `array_agg` întoarce NULL — deci „nu există
pași nebifați" era adevărat **în gol**. În producție există deja o dovadă imutabilă, cu
checksum, care atestă o integrare încheiată cu `total_pasi = 0` și conținut vid: un
document care nu atestă nimic, dar arată exact ca unul care atestă.

Precedentul reparației era deja în repo — `internal.cursuri_pregateste_inrolarea` refuză
înrolarea la un curs fără nicio lecție. Modulul de cursuri învățase lecția; integrarea nu.
