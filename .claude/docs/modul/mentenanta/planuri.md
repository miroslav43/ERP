---
tip: modul
titlu: Mentenanță — planuri și scadențe
aliases: [planuri de mentenanță, scadențe, amânare plan, grilă fixă, proiecție contor]
cai:
  - "src/app/(app)/mentenanta/planuri/**"
  - "src/app/(app)/mentenanta/echipamente/[id]/formular-plan.tsx"
  - "src/domain/maintenance/proiectie.ts"
  - "src/domain/maintenance/instructiuni.ts"
  - "supabase/migrations/0183_planuri_scadente.sql"
  - "tests/rls/proba-planuri.sql"
tabele: [maintenance_plans, maintenance_interventions, equipment_meters, expirables]
permisiuni: [maintenance:read, maintenance:update]
feature: maintenance
capcane: [17, 52]
citeste_daca:
  - "scadența unui plan nu se mișcă sau se mișcă singură → „Ce refuză baza tăcut”"
  - "amânarea e refuzată sau dispare → „Amânarea”"
  - "un plan pe contor arată „În regulă” deși utilajul e depășit → „Proiecția”"
scris_pe: f3937f52a02b737ac62ef500b1d6b42e81e7640b
scris_la: 2026-10-08
tags: [modul, operations]
---

# Mentenanță — planuri și scadențe

Extrasă din [[modul/mentenanta]]. Din `0183`, un plan are mod de calcul (`flotant` /
`fix`), ancoră, amânare (dată, motiv, contor de amânări), durată și cost estimate, oprire
necesară, temei legal și categorie legală (rezervată pentru M7).

## Rute

| Rută                                              | Poartă                                            |
| ------------------------------------------------- | ------------------------------------------------- |
| `/mentenanta/planuri` (filtre, sortare, paginare) | `maintenance:read` team; „Plan nou” `update` team |
| `/mentenanta/planuri/[id]`                        | `maintenance:read` team; acțiunile `update` team  |

Lista: keyset pe `(urmatoarea_scadenta nulls last, id)` sau pe denumire; filtre SQL
`echipament`, `tip`, `responsabil`, `activ` (`da` implicit în ecran, `nu`, `toate`),
`scadenta` (`depasita` / `curand` 15 zile / `luna` 30 zile — doar pe zile; starea pe contor
se calculează în TS din ultima citire). Pe rând: „Execută”, „Amână” (doar dacă are
periodicitate în zile). Fișa: scadența pe zile și pe contor, proiecția, amânarea, datele,
instrucțiunile ca listă, istoricul execuțiilor (`interventii` cu filtrul `plan`).

## Server Actions

`planuri/actions.ts` — toate `maintenance:update` / team, cu `.select()` după UPDATE și
zero rânduri = `NEGASIT`; `revalidate` ia `equipment_id` din datele întoarse de handler:

| Funcție           | Ce scrie                                                                        |
| ----------------- | ------------------------------------------------------------------------------- |
| `amanaPlan`       | `amanat_pana`, `motiv_amanare` — garda recalculează scadența și `numar_amanari` |
| `comutaPlanActiv` | `activ`, cu `.neq("activ", țintă)`: planul deja în starea cerută e `NEGASIT`    |
| `stergePlan`      | `deleted_at` + `activ=false`; intervențiile rămân cu `plan_id` (istoric)        |

`creeazaPlan` / `actualizeazaPlan` rămân în `mentenanta/actions.ts`; formularul e unul
singur (`echipamente/[id]/formular-plan.tsx`), cu selector de echipament când se deschide de
pe listă. „Execută” = `inregistreazaInterventie` cu `plan_id` fixat; pașii bifați din
instrucțiuni intră în `observatii` (`observatiiCuPasi`).

## Ce refuză baza tăcut

- **`ssm_plan_calc` recalculează doar când i se schimbă intrările** (periodicitate,
  ultima execuție, ancoră, mod, amânare, citire de referință) — un UPDATE pe alt câmp
  nu mută scadența. — capcana #52
- **Modul `flotant` fără nicio execuție** pornește de la ziua CREĂRII planului, nu de la
  azi: altfel o amânare cu 7 zile pe un plan anual neexecutat dădea azi + 365 (calculul
  din ziua amânării bătea amânarea prin `greatest`). Prins de santinelă, proba (7).
- **Modul `fix`**: scadența = prima dată de pe grila `ancoră + n × periodicitate` care e
  ≥ azi și strict după ultima execuție; o execuție întârziată sare restanțele, nu le
  înșiră. Ancora lipsă ⇒ ultima execuție sau azi. Oglinda în TS: `urmatoareaPeGrila`.
- **Amânarea**: `urmatoarea_scadenta = greatest(calc, amanat_pana)`, `numar_amanari`
  crește la fiecare dată nouă; o intervenție **reușită** o șterge (`ssm_intervention_apply`),
  una parțială/eșuată nu. Pe un plan **doar pe contor** amânarea e refuzată cu P0001
  („…scadența pe contor se citește, nu se amână”) — butonul nici nu apare; un plan
  amânat trecut apoi doar pe contor își pierde amânarea tăcut (editarea nu e amânare).
- **Semnătura citirii**: responsabilul fără `update` poate pune pe `citit_de_employee_id`
  doar fișa lui sau nimic — în politica `equipment_meters_insert` (0183), nu doar în
  `inregistreazaContor`; gestionarul alege orice angajat al firmei.
- **Planul dezactivat sau șters** iese din `expirables` prin `maintenance_plan_exp`
  (`is_active = deleted_at is null and activ`), deci și din alertele zilnice.
- **Proiecția** (`proiectieScadentaContor`): ritm din ultimele 90 de zile, minimum 3
  citiri pe cel puțin 7 zile; altfel `null` și ecranul spune de ce. Contorul necitit peste
  `prag_contor_necitit_zile` (setări) marchează estimarea „nesigură” și intră în panoul
  „Contoare necitite”.
- **Responsabilul plecat**: `angajatiInactiviDintre` (status ≠ activ sau șters) dă
  insigna „De reatribuit” pe listă și panoul „Planuri de reatribuit”; nimic nu se blochează.

## Când NU e suficientă pagina asta

- Textul fiecărei verificări: `tests/rls/proba-planuri.sql`.
- Contractul acțiunilor: `planuri/actions.test.ts`, `actions-planuri.test.ts`;
  domeniul: `proiectie.test.ts`, `instructiuni.test.ts`.
- Echipamentul, contoarele, resetarea: [[modul/mentenanta/echipamente]].
