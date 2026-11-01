---
tip: modul
titlu: SSM și PSI — Server Actions și ce refuză baza la scriere
cai:
  - "src/app/(app)/ssm/actions.ts"
  - "src/app/(app)/ssm/actions-instruiri-medicina.test.ts"
  - "src/app/(app)/ssm/actions-accidente.test.ts"
  - "src/app/(app)/ssm/actions-stingatoare.test.ts"
  - "src/app/(app)/ssm/actions-eip-autorizatii.test.ts"
  - "src/app/(app)/ssm/actions-modul.test.ts"
  - "src/schemas/ssm.ts"
tabele:
  [
    ssm_trainings,
    ssm_training_types,
    occupational_health_exams,
    employee_work_restrictions,
    work_accidents,
    ppe_issuances,
    fire_extinguishers,
    fire_extinguisher_checks,
    personnel_authorizations,
  ]
permisiuni: [ssm:read, ssm:create, ssm:update]
capcane: []
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul, hr]
---

Secțiune extrasă din [[modul/ssm]]: scrierile modulului, și cele două refuzuri tăcute
care le aparțin — coloanele pe care acțiunile NU le trimit și allow-list-ul de audit al
fișei de aptitudine.

## Server Actions

`src/app/(app)/ssm/actions.ts` — toate pe `minScope: "team"`, în afara nomenclatorului.

| Grup            | Funcții                                                                        | Permisiune          |
| --------------- | ------------------------------------------------------------------------------ | ------------------- |
| Instruiri       | `inregistreazaInstruireBloc`; `confirmaSemnaturaInstruire`                     | `create` / `update` |
| Medicina muncii | `adaugaFisaAptitudine`                                                         | `ssm:create`        |
| Accidente       | `inregistreazaAccident`; `comunicaAccidentLaItm`, `finalizeazaCercetare`       | `create` / `update` |
| Stingătoare     | `adaugaStingator`, `inregistreazaVerificareStingator`; `actualizeazaStingator` | `create` / `update` |
| EIP             | `predaEip`; `marcheazaEipReturnat`, `confirmaPrimireaEip`                      | `create` / `update` |
| Autorizații     | `adaugaAutorizatieNominala`; `schimbaSuspendareaAutorizatiei`                  | `create` / `update` |
| Nomenclator     | `nomenclatorInstruiri`                                                         | `ssm:read` / own    |

`confirmaSemnaturaInstruire` scrie doar `ssm_trainings.semnatura_confirmata`, coloană
existentă din `0011` pe care nicio acțiune n-o scria; revalidează și
`/portal/instruirile-mele`, fiindcă portalul o citea. Allow-list de audit: `id` singur.

Două refuzuri mutate din bază în `src/schemas/ssm.ts`: `durata_ore` e `numarObligatoriu`,
nu `z.coerce.number()` — câmpul gol devenea 0 și instruirea se salva „0:00 h"; iar
`fisaAptitudineSchema` respinge prin `superRefine` o valabilitate anterioară examinării,
fișă care se scria deja expirată. A doua regulă e oglindită în `inroleazaAngajatSchema`,
fiindcă înrolarea inserează aceeași fișă — v. [[modul/angajati]].

`nomenclatorInstruiri` e singura pe `own` și n-are `revalidate`: o cheamă `DosarulMeu`
direct dintr-un Server Component, iar `revalidatePath` în timpul randării aruncă. E și
singura care citește prin `createAdminSupabase()`, cu filtru explicit pe
`organization_id`: `ssm_training_types` n-are coloană de angajat, deci `app.ssm_acces`
cere scope ≥ `team` și un `employee` ar vedea UUID-uri în loc de denumiri.

Contractele sunt fixate pe clientul fals: `actions-instruiri-medicina.test.ts`,
`actions-accidente.test.ts`, `actions-stingatoare.test.ts`,
`actions-eip-autorizatii.test.ts`, plus `actions-modul.test.ts`, care ia lista din
exporturile lui `./actions` și verifică pe fiecare cheia `feature` — o acțiune legată din
greșeală de alt modul trece toate celelalte teste.

## Ce refuză baza tăcut

- **Coloanele pe care acțiunile NU le trimit**, fiindcă le pune un trigger BEFORE din
  `0011` și numai când primește `null`: `ssm_trainings.urmatoarea_scadenta`,
  `work_accidents.termen_comunicare_ore`, `ppe_issuances.data_inlocuirii` și cele trei
  `fire_extinguishers.scadenta_*` (rescrise integral la fiecare scriere). Trimise din
  client, periodicitatea legală configurată e ignorată fără eroare. Din triggere AFTER vin
  rândul de `employee_work_restrictions` (un INSERT manual dă 23505 pe indexul unic
  parțial) și `ultima_*` de pe stingător, după o verificare — fără un al doilea UPDATE din
  acțiune. `created_by`/`updated_by` le scrie `internal.set_actor`, altfel decât în
  [[modul/flota]]. — `actions-stingatoare.test.ts`, `actions-accidente.test.ts`
- **Fișa de aptitudine e art. 9 GDPR în audit.** `rezultat`, `medic`, `unitate_medicala` și
  `cost` stau în afara allow-list-ului lui `adaugaFisaAptitudine`, pe TOATE căile — reușită,
  eșec și refuz de validare, unde `createAction` jurnalizează `denied` prin aceeași
  allow-list; `observatii` nici nu e în schemă. Allow-list STRICTĂ, deci un câmp nou nu intră
  în jurnal decât adăugat explicit: nu-l adăuga. — `actions-instruiri-medicina.test.ts`
