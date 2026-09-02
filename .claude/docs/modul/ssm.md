---
tip: modul
titlu: SSM și PSI
aliases: [ssm, psi, protectia-muncii]
cai:
  - "src/app/(app)/ssm/**"
  - "src/lib/queries/ssm.ts"
  - "src/schemas/ssm.ts"
  - "src/domain/ssm/**"
  - "supabase/migrations/0011_ssm.sql"
  - "supabase/migrations/0021_fix_instruiri_ssm.sql"
tabele:
  [
    ssm_trainings,
    ssm_training_types,
    ssm_training_type_periods,
    occupational_health_exams,
    employee_work_restrictions,
    work_accidents,
    ppe_issuances,
    fire_extinguishers,
    fire_extinguisher_checks,
    personnel_authorizations,
    ssm_legal_parameters,
  ]
permisiuni: [ssm:read, ssm:create, ssm:update]
feature: ssm
capcane: [26, 32]
citeste_daca:
  - "listă goală fără eroare la scadențe → [[rol/hr]]"
  - "instruire periodică respinsă la salvare → 0021, secțiunea de mai jos"
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul, hr]
---

# SSM și PSI

Instruiri periodice, medicina muncii cu restricții de aptitudine, accidente de muncă și
comunicarea lor la ITM, echipament individual de protecție, stingătoare cu verificări, și
autorizații nominale. Rolul care îl administrează e `hr` — care, tocmai de asta, are aici
cele mai multe refuzuri tăcute din proiect.

## Rute și cine ajunge

| Rută                                                          | Poartă                                               |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `/ssm`                                                        | `ssm:read` own ca să intre; fiecare card cere `team` |
| `/ssm/instruiri`, `/ssm/instruiri/noua`                       | `ssm:read` / `ssm:create` team                       |
| `/ssm/medicina-muncii`                                        | `ssm:read` team                                      |
| `/ssm/accidente`, `/ssm/accidente/[id]`, `/ssm/accidente/nou` | `ssm:read` / `ssm:create` team                       |
| `/ssm/eip`                                                    | `ssm:read` team                                      |
| `/ssm/stingatoare`                                            | `ssm:read` team                                      |
| `/ssm/autorizatii`                                            | `ssm:read` team                                      |

Pragul de intrare e `own`, dar tot ce e dincolo de propriul dosar cere `team`. Un
`employee` ajunge deci pe pagină și o vede aproape goală — starea e corectă, nu un defect.

## Server Actions

`src/app/(app)/ssm/actions.ts` — toate pe `minScope: "team"`, în afara nomenclatorului.

| Grup            | Funcții                                                                        | Permisiune          |
| --------------- | ------------------------------------------------------------------------------ | ------------------- |
| Instruiri       | `inregistreazaInstruireBloc`                                                   | `ssm:create`        |
| Medicina muncii | `adaugaFisaAptitudine`                                                         | `ssm:create`        |
| Accidente       | `inregistreazaAccident`; `comunicaAccidentLaItm`, `finalizeazaCercetare`       | `create` / `update` |
| Stingătoare     | `adaugaStingator`, `inregistreazaVerificareStingator`; `actualizeazaStingator` | `create` / `update` |
| EIP             | `predaEip`; `marcheazaEipReturnat`, `confirmaPrimireaEip`                      | `create` / `update` |
| Autorizații     | `adaugaAutorizatieNominala`; `schimbaSuspendareaAutorizatiei`                  | `create` / `update` |
| Nomenclator     | `nomenclatorInstruiri`                                                         | `ssm:read` / own    |

`nomenclatorInstruiri` e singura pe `own` și n-are `revalidate`: o cheamă `DosarulMeu`
direct dintr-un Server Component, iar `revalidatePath` în timpul randării aruncă.

## Citiri

`src/lib/queries/ssm.ts` — fără niciun filtru manual de scope. Politicile din `0011` o fac
în Postgres, prin `app.ssm_acces`, pe coloana `employee_id` a fiecărei tabele; un filtru
duplicat în TypeScript ar putea diverge tăcut de regula reală.

Politicile SELECT din `0011` **nu** conțin `deleted_at is null` — fiecare citire îl adaugă
explicit.

## Ce refuză baza tăcut

- **`public.expirables` întoarce zero rânduri pentru `hr`.** Politica ei cere ȘI
  `poate_vedea_expirabil`, ȘI `compliance:read` — pe care rolul care administrează SSM
  nu-l are. Fără eroare, fără listă. Toate scadențele se calculează din tabelele sursă.
  — capcana #26, v. [[rol/hr]]
- **`ssm_legal_parameters` e mapată pe resursa `compliance`, nu pe `ssm`.** Deci pragul de
  preaviz nu se citește din tabel: e constanta `PRAG_SSM_AVERTIZARE_ZILE` din
  `src/domain/ssm/scadente.ts`. La fel `environmental_permits`. — capcana #32
- **`app.ssm_acces` cu `p_employee` NULL sare peste ramura `own`.** Un rând fără angajat —
  un stingător, o autorizație de mediu — cere cel puțin `team`. Consecința: pentru un
  `employee` tabelele fără ancoră de angajat sunt invizibile, iar ecranul arată gol în loc
  să arate refuz.

## De ce nicio instruire periodică nu se putea salva (0021)

`internal.ssm_training_sync()` compunea cheia scadenței ca `domeniu || ':' || cod` —
`ssm:periodic` — și o trimitea în `public.expirables`, unde constrângerea `expirables_kind_ck`
acceptă `^[a-z][a-z0-9_]{1,48}$`. Tiparul nu are două puncte. Deci exact cazul obișnuit —
instruirea periodică, cea cerută de ITM la control — pica la salvare cu 23514, pentru
oricine. Tipurile fără periodicitate treceau, fiindcă nu produc scadență, iar asta făcea
defectul să pară intermitent.

`0021_fix_instruiri_ssm.sql` schimbă separatorul în underscore și validează cheia în
funcție, cu mesaj propriu, înainte de a atinge tabela.

De reținut e cum a scăpat: migrarea se aplică fără eroare (constrângerea se evaluează la
INSERT, nu la crearea funcției), cele trei bariere SQL treceau, iar testul de izolare
demonstra absența accesului NEautorizat — nu prezența celui autorizat. L-a prins doar
verificarea `(l)` din `tests/rls/izolare.sql`, extinsă cu o instruire inserată ca
utilizator obișnuit.

## Ce NU e aici

`0011_ssm.sql` creează și `equipment`, `equipment_meters`, `maintenance_plans`,
`maintenance_interventions` și `fault_reports` — dar acelea sunt modulul de mentenanță, cu
resursa de permisiune `maintenance`, nu `ssm`. Aceeași migrare, două module.

Documentele scanate ale angajatului și dosarul lui de personal: [[modul/angajati]].

## Când NU e suficientă pagina asta

- Calculul stării unei scadențe: `src/domain/ssm/scadente.ts`, cu teste.
- De ce `hr` nu vede o listă pe care o administrează: [[rol/hr]].
