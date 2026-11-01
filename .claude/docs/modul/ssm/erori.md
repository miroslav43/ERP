---
tip: modul
titlu: SSM și PSI — erori traduse și etichete
cai:
  - "src/app/(app)/ssm/erori.ts"
  - "src/app/(app)/ssm/erori.test.ts"
  - "src/app/(app)/ssm/etichete.ts"
  - "src/app/(app)/ssm/etichete.test.ts"
tabele: [work_accidents, fire_extinguishers, personnel_authorizations]
permisiuni: [ssm:create, ssm:update]
capcane: []
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul, hr]
---

Secțiune extrasă din [[modul/ssm]]: ce coduri primesc mesaj propriu în modul, ce se
aruncă mai departe către traducerea generică, și cum stau etichetele lipite de enumuri.

## Erori traduse

`src/app/(app)/ssm/erori.ts` dă mesaj propriu doar pentru `23505` (potrivit pe numele
constrângerii — stingător, autorizație nominală, număr intern de accident; altfel duplicat
generic), `22012`/`22003` și `P0001`, al cărui text vine din triggerele lui `0011` cu
cifre în el și se propagă neschimbat, tăiat la 300 de caractere. Orice alt cod — `42501`,
`23503`, `23514`, `PGRST116` — se aruncă MAI DEPARTE neatins, către traducerea generică
din `createAction`; la fel o eroare care nu e PostgREST, chiar cu cod `23505`.
— `erori.test.ts`

`etichete.ts` e lipit de enumurile din `src/schemas/ssm.ts` prin `Record<Enum, string>`:
tsc prinde valoarea fără text. Ce nu vede tsc e gravitatea tonului — `pericol` cade exact
pe accidentele cu comunicare la ITM. — `etichete.test.ts`
