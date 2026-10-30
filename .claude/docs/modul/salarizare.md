---
tip: modul
titlu: Salarizare
aliases: [payroll, state de plată, fluturași]
cai:
  - "src/app/(app)/salarizare/**"
  - "src/lib/queries/payroll.ts"
  - "src/schemas/payroll.ts"
  - "src/domain/payroll/**"
tabele:
  [
    payroll_periods,
    payroll_entries,
    payroll_bonuses,
    payroll_deductions,
    payroll_garnishments,
    payroll_settings,
    payroll_prior_income,
    payroll_personal_deduction_brackets,
    salary_component_types,
    medical_leave_codes,
  ]
permisiuni:
  [payroll:read, payroll:create, payroll:update, payroll:approve, payroll:export, employees:read]
feature: payroll
capcane: [2, 17]
citeste_daca:
  - "perioadă care nu se recalculează → [[date/pontaj]]"
  - "sumă greșită → src/domain/payroll/, nu pagina asta"
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, finance]
---

# Salarizare

Perioade lunare de salarizare: se creează, se calculează din pontaj, se aprobă, se
închid. Produce fluturași PDF și gestionează popriri. **Singurul modul cuplat de valori
legale** — plafoane, deduceri personale, cote — care sunt marcate în `NOTES.md` ca
neconfirmate de contabil.

## Paginile modulului

Pagina asta e trunchiul; restul s-a spart pe subarborele de rute
(`.claude/docs/meta/conventii.md`).

| Pagină                             | Ce ține                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| [[modul/salarizare/actiuni]]       | scrierile, porțile lor, pre-verificările dinaintea bazei, setările     |
| [[modul/salarizare/calcul]]        | motorul `calculatePayrollEntry`, etapele lui, catalogul de atenționări |
| [[modul/salarizare/livrabile]]     | cele patru descărcări ale perioadei aprobate, porțile și antetele lor  |
| [[modul/salarizare/nomenclatoare]] | `/salarizare/componente` și `/salarizare/popriri`: poarta lor aparte   |
| [[modul/salarizare/portal]]        | ce vede angajatul din portal despre propriul fluturaș                  |

## Rute și cine ajunge

| Rută                                            | Poartă                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| `/salarizare`                                   | `payroll:read` all; „Istoric venituri" cere `payroll:create`, „Setări" `payroll:update` |
| `/salarizare/[id]`                              | `payroll:read` all; butoanele cer `create`, `update`, `approve`, `export`               |
| `/salarizare/[id]/[entryId]`                    | `payroll:read` all                                                                      |
| `/salarizare/componente`, `/salarizare/popriri` | `payroll:read` la orice scope ([[modul/salarizare/nomenclatoare]])                      |
| `/salarizare/istoric-venituri`                  | `payroll:create` all                                                                    |
| `/salarizare/setari`                            | `payroll:update` all                                                                    |

**Niciun scope de „echipă".** Modulul nu are noțiunea: cele patru ecrane
administrative cer `all` direct, iar `manager` — care are `payroll` pe `none`
(`0002_authz.sql:1191`) — nu trece de niciunul. Preambulul cere `requireFeature`,
`getPermissionMap` **și** `getEnabledFeatures` prin `Promise.all`, în toate paginile
modulului — citiri independente, respinse la fel ca înlănțuite.

**Fiecare link de IEȘIRE trece prin poarta paginii-ȚINTĂ**, nu prin a salarizării:
`poateDeschide` din `src/config/porti-ruta.ts`. Pontajul, concediile, diurna și
rapoartele sunt module opționale, iar `requireFeature` dă 404 fără ele; fișa angajatului
cere `employees:read` all, deci numele devin linkuri (`LinkEntitate`) numai atunci.
Atenționările fluturașului își iau adresa din `legaturi-avertismente.ts`: ruta generică
(`unde`) din catalogul `src/domain/payroll/erori.ts` devine ecranul omului și al lunii,
sau text simplu dacă ținta e închisă. Traducerea se face la randare, din cod, deci
acoperă și fluturașii vechi, fără schimbarea formei salvate.

## Citiri

`src/lib/queries/payroll.ts` — cel mai mare fișier de citiri din proiect, marcat
`"server-only"`: `listeazaPerioade`, `citestePerioada`, `listeazaInregistrari`,
`citesteInregistrare`, `citesteFluturasulPropriu`, `perioadaInregistrarii`,
`pontajAgregatPerioada`, `zileLucratoareLuna`, `angajatiActiviCuContract`,
`scutiriActivePerioada`, `componenteSalarialeActivePerioada`, `primeSiRetineriPerioada`,
`istoricVenitPerAngajat`, `certificateMedicaleLuna`, `compensariLuna`,
`diurnaLunaPerAngajat`, `plafoaneDiurnaLuna`, `popririActive`, `dosarePopriri`,
`salariulMinimLaData`, `angajatiFaraIban`, `rezumatSalarizareAngajat`,
`perioadaSalarizariiPentruPontaj`, plus setările valabile la o dată.

`listeazaInregistrari` numără `calc_warnings` la citire (`avertismente`) și ridică
`programSubCinciZile`: tabelul perioadei are coloana „Atenționări" și NUMEȘTE oamenii cu
program sub cinci zile pe săptămână, în loc să-i afli deschizând fiecare fluturaș. Codul
vechi `NORMA_SUB_CINCI_ZILE` rămâne recunoscut, pentru perioadele aprobate înainte de
redenumire, deci nerecalculate.

`rezumatSalarizareAngajat` și `perioadaSalarizariiPentruPontaj` sunt drumurile inverse —
spre fișa angajatului și spre perioada de pontaj — pe care modulul nu le avea: lega doar
dinspre el însuși.

## Ce refuză baza tăcut

- **Tranzițiile de perioadă se verifică prin `.select()` după `.update()`.** O tranziție
  respinsă de `USING` nu dă eroare — afectează zero rânduri. `aprobaPerioada`,
  `inchidePerioada` și `redeschidePerioada` tratează rezultatul gol drept conflict. — capcana #17
- **Agregarea din pontaj se paginează după angajat.** PostgREST trunchiază tăcut peste
  `max_rows`; `pontajAgregatPerioada` citește pe angajați, nu pe rânduri de pontaj. — capcana #2
- **`istoricVenitPerAngajat` și `diurnaLunaPerAngajat` citeau fără fereastră și fără
  `ORDER`**, deci creșteau cu fiecare lună calculată până la trunchierea tăcută: media
  pentru indemnizațiile CO/CM scădea, iar diurna unor deplasări lipsea de pe stat. Acum
  trec prin `citesteTot` (`src/lib/queries/citeste-tot.ts`), cu cursor keyset. — capcana #2
- **`baremLegalZi` din `diurnaLunaPerAngajat` e plafonul ÎNTREGII deplasări, deja
  înmulțit cu multiplul**, nu baremul legal pe zi; „ziua" e sintetică. De aceea
  `calculeazaPerioada` îl împarte la `multiplicatorPlafonZilnic` înainte de a-l da etapei,
  ca ea să-l reaplice exact. Până la 2 oct 2026 etapa îl mai înmulțea o dată și îl compara
  cu suma TOTALĂ: o deplasare de o zi ieșea neimpozitată, una lungă impozitată fără temei.
- **Un pontaj blocat, dar GOL, trece prin calcul fără o vorbă** și dă „brut 0,00 lei"
  pentru toată lumea — salariul se plătește pe zilele din pontaj. Ecranul perioadei
  întreabă `numarZilePontatePerioada` și pune un AVERTISMENT, nu un blocaj (o firmă în
  pauză are legitim o lună fără pontaj), iar calculul marchează fiecare fluturaș cu
  `SAL_PONTAJ_FARA_ZILE`.
- **Traducerea erorilor acoperă șase coduri**, mai multe decât oriunde altundeva:
  `23505`, `42P10`, `23514`, `22003`, `22012`, `P0001` (`erori.ts`). `22003` și `22012`
  sunt depășire numerică și împărțire la zero — vin din calcul, nu din autorizare, unde
  un mesaj generic ar trimite investigația greșit.
- **Funcția de pe fluturașul trimis pe e-mail vine din coloană, nu din embed.**
  `0110_functia_pe_fisa.sql` a desființat nomenclatorul `job_positions` și a mutat
  denumirea pe `employees.functie`. `job_position_id` a rămas pe tabelă, dar nu-l mai
  populează nimeni, deci embed-ul vechi întorcea `null` — fără eroare — pentru fiecare
  fișă creată după 0110. `COLOANE_FLUTURAS_EMAIL` cere azi `functie`, la fel ca
  `api/export/salarizare/fluturas/route.ts:70`.
- **Indemnizația de CM se împarte în trei baze**, după `retine_cas`/`retine_impozit`/
  `retine_cass` din `medical_leave_codes` (`0127_indemnizatie_cm_retineri.sql`). Înainte,
  impozitul cădea pe toată indemnizația — inclusiv maternitate (`11`) și risc maternal
  (`15`), neimpozabile — iar CAS și CASS nu se rețineau deloc: net mai mare, fără eroare.
  Un cod fără steaguri cade pe implicitele majoritare: CAS și impozit da, CASS nu.
- **Valorile legale nu sunt adevăr.** Plafoanele și cotele din `payroll_settings` și
  `payroll_personal_deduction_brackets` sunt marcate în `NOTES.md` ca ⚠ de confirmat de
  contabil înainte de orice calcul real.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/payroll.ts` →
`src/lib/queries/payroll.ts` → acțiuni → pagini. **Calculul propriu-zis nu e aici**: stă
în `src/domain/payroll/`, acoperit cu teste, iar o sumă greșită se repară acolo, nu în
pagină. Motorul, etapele lui, suma neimpozabilă de la salariul minim, lanțul
concediului medical, programul sub cinci zile (numit și pe ecranul perioadei) și felul
în care avertismentele își scriu orele: [[modul/salarizare/calcul]].

## Ce NU e aici

Pontajul care alimentează calculul (`[[modul/pontaj]]`), diurna, și fișa angajatului
(`[[modul/angajati]]`). Fluturașul propriu al angajatului trăiește în portal.

## Când NU e suficientă pagina asta

- Orice întrebare despre o cifră: `src/domain/payroll/` plus `NOTES.md` §valorile legale.
- Exportul: route handlers sub `src/app/api/export/salarizare/` — [[modul/salarizare/livrabile]]
  spune doar cum se cer și ce antete întorc.
- Legăturile dintre ecrane (lotul 7i: atenționările → ecranul de reparat, `legaturi-avertismente.ts`): [[strat/navigare]].
