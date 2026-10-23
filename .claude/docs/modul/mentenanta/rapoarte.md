---
tip: modul
titlu: Mentenanță — rapoarte și indicatori
aliases:
  [
    rapoarte mentenanță,
    indicatori mentenanță,
    MTTR,
    MTBF,
    disponibilitate,
    Pareto,
    cost per echipament,
  ]
cai:
  - "src/app/(app)/mentenanta/rapoarte/**"
  - "src/app/api/export/mentenanta/rapoarte/route.ts"
  - "src/domain/maintenance/indicatori.ts"
  - "src/lib/queries/maintenance-rapoarte.ts"
  - "tests/rls/proba-mentenanta-rapoarte.sql"
  - "supabase/migrations/0232_mentenanta_costuri_echipament.sql"
tabele:
  [
    equipment,
    equipment_costuri,
    maintenance_interventions,
    maintenance_plans,
    fault_reports,
    equipment_opriri,
    maintenance_settings,
  ]
permisiuni: [maintenance:read, maintenance:export]
feature: maintenance
capcane: [2]
citeste_daca:
  - "o cifră din raport pare prea mică sau „—” → „Ce refuză baza tăcut”"
  - "„la timp”, disponibilitatea sau MTBF nu se potrivesc cu socoteala de mână → „Cum se calculează”"
  - "CSV-ul diferă de ecran → „Exportul”"
scris_pe: 9db525aeb5cc48094f85f4fe37b4a424e68ed3f8
scris_la: 2026-10-23
tags: [modul, operations]
---

# Mentenanță — rapoarte și indicatori

Extrasă din [[modul/mentenanta]] (M8, fără migrare). Raportul pe perioadă: costuri pe
echipament, disponibilitate, timpi de reparație și de rezolvare, defecte repetate, planuri
și verificări legale făcute la timp, amânări, citiri restante. Panoul `/mentenanta` și-a
mutat cifrele de sus pe `Indicator` (planuri, ISCIR, sesizări, echipamente în reparație sau
în conservare — casatele nu, `echipamenteCuProbleme`), fiecare cu linkul spre lista lui.

## Rute și cine ajunge

| Rută                                   | Poartă                                                 |
| -------------------------------------- | ------------------------------------------------------ |
| `/mentenanta/rapoarte?de_la=&pana_la=` | `maintenance:read` team; CSV `maintenance:export` team |
| `/api/export/mentenanta/rapoarte`      | `maintenance:export` team                              |

Lipsa perioadei = ultimele 12 luni. `normalizeazaPerioada` schimbă capetele inversate,
taie viitorul la azi și scurtează peste maximul de zile, și SPUNE ce a îndreptat
(`Callout` pe pagină); exportul folosește aceeași normalizare. Scurtăturile („Anul
curent”, „Luna trecută”…) sunt linkuri, nu stare.

## Citiri

`src/lib/queries/maintenance-rapoarte.ts`, separat de `maintenance.ts` fiindcă servește
un CALCUL, nu o listă: `interventiiInPerioada`, `executiiPlanuriPanaLa`,
`sesizariInPerioada`, `opririInPerioada`, `echipamentePentruRaport`,
`planuriPentruRaport`. Toate paginează keyset pe `id`, câte o pagină sub `max_rows`, până
la `PLAFON_RAPORT`, și întorc `trunchiat` — cerând un rând în plus la capăt, ca să știe
dacă mai există. `incarcaRaport` (`rapoarte/date-raport.ts`) le cheamă în paralel o dată,
pentru ecran și pentru CSV. Intervalele de timp sunt ziua României (`momentInceputZi`),
fără milisecunde: punctul ar rupe filtrul `or=` al opririlor.

## Cum se calculează

`src/domain/maintenance/indicatori.ts`, pur. Orice împărțire trece prin `imparte`, care
întoarce `null` la numitor zero; ecranul scrie „—”, CSV-ul lasă celula goală.

- **Costuri**: preventiv (preventivă + predictivă), corectiv, legal; intern / extern după
  `executant_extern`. Intervenția acoperită de garanție intră DOAR în coloana de garanție,
  nu în costul suportat (cazul 23).
- **Cost / valoare**: costul suportat pe ultimele 12 luni până la capătul perioadei, oricât
  de scurtă e perioada, împărțit la `valoare_achizitie`; strict peste
  `PRAG_COST_VALOARE_INLOCUIRE` = semnal de înlocuire. Fără valoare: „—”, fără semnal.
  Valoarea vine din `equipment_costuri` (0232), încorporată: o văd
  `maintenance:update = all` și `maintenance:read >= team`, deci orice cititor al
  paginii; pentru restul embed-ul e `null`, adică tot „—”.
- **Program**: `ore_functionare_pe_zi` în primele `zile_pe_saptamana` zile (luni = 1), din
  setări. Echipamentul intră în parc de la punerea în funcțiune și iese la casare; opririle
  lui se taie la aceeași fereastră (oprirea lăsată deschisă la casare nu mai scade nimic
  după ea), iar ale unui echipament din afara parcului nu intră deloc. Opririle aceluiași
  echipament se UNESC unde se suprapun (sesizare duplicată), iar plafonul de ore pe zi e al
  echipamentului, nu al opririi. Orele de program și MTBF se scriu în ore, nu în zile.
- **Disponibilitate** = 1 − ore de oprire (toate tipurile) / ore de program. **MTTR**: media
  opririlor NEPLANIFICATE (unite) încheiate în perioadă, în ore calendaristice. **MTBF**: ore
  de program fără oprirea neplanificată / opririle neplanificate (unite) începute în perioadă.
  **Costul opririlor**: ore de oprire în program × `cost_ora_oprire`; nesetat = „—” și link
  spre setări.
- **Sesizări**: fără `respins` și `retrasa`. Defect repetat = altă sesizare pe același
  echipament în cele `ZILE_DEFECT_REPETAT` zile dinainte (de aceea se citește și înaintea
  perioadei). Timpii de atribuire și de rezolvare: de la `raportat_la`.
- **La timp** e RECONSTITUIT: baza nu păstrează scadența de la execuție. O execuție reușită
  din perioadă se judecă față de execuția reușită precedentă + periodicitatea (zile și/sau
  contor); planul `fix` față de grila din `data_ancora` (`urmatoareaPeGrila`, ca
  `ssm_plan_calc`). Prima execuție cunoscută nu intră în procent. Planul activ încă depășit
  pe zile la capătul perioadei intră ca nefăcut la timp (`restante`), altfel un plan uitat
  lăsa „100 %”. Execuția după o amânare iese întârziată.
- **Amânări**: „Planuri amânate acum” = planuri active cu `amanat_pana`. `numar_amanari` e
  ISTORIC: execuția reușită golește `amanat_pana`, nu și contorul (0183; cazul 27).
- **Zile de depășire** (verificări legale): întârzierile execuțiilor + verificările active
  încă depășite la capătul perioadei. **Citiri restante**: starea de AZI, aceeași regulă
  ca panoul (`contoareCuPlan` + `contorInvechit`).

## Ce refuză baza tăcut

- **O citire tăiată arată ca o firmă mică.** Peste plafon, pagina afișează „Cifrele de mai
  jos sunt un minim” cu lista citirilor tăiate; exportul pune `trunchiat` în audit
  (cazul 45, capcana #2).
- **Managerul primește parcul, intervențiile, planurile și opririle întregi, dar doar
  sesizările echipei lui** (ancora `raportat_de_employee_id`): Pareto după sesizări și
  timpii lui sunt ai echipei, costurile ale firmei. `hr` nu primește nimic, iar
  `employee` nu are pagina (poarta e `team`). Proba:
  `tests/rls/proba-mentenanta-rapoarte.sql`.
- **Un echipament șters logic nu mai are nume**: costurile lui rămân în total, rândul se
  cheamă „Echipament indisponibil” și nu e link.

## Exportul

`/api/export/mentenanta/rapoarte`: un rând pe echipament, `;` și zecimală virgulă, BOM,
celulele care încep ca o formulă primesc apostrof. Liniile le face `liniiCsvRaport`
(`rapoarte/csv-raport.ts`) din ACELAȘI `RaportMentenanta` ca tabelul. Exportul e auditat
(`entity_type = maintenance_report`).

## Când NU e suficientă pagina asta

- Contractul calculului: `indicatori.test.ts`; al citirilor:
  `maintenance-rapoarte.test.ts`; al rutei: `api/export/mentenanta/rapoarte/route.test.ts`.
- Programul și costul orei de oprire se setează în [[modul/mentenanta/sesizari]].
