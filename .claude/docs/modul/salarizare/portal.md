---
tip: modul
titlu: Salarizare — fluturașul propriu al angajatului
aliases: [salariul-meu, fluturaș propriu, card salariu]
cai:
  - "src/lib/queries/payroll.ts"
  - "src/app/(portal)/portal/salariul-meu/**"
  - "src/app/(portal)/portal/card-salariu.tsx"
tabele: [payroll_periods, payroll_entries]
permisiuni: [payroll:read]
feature: payroll
capcane: []
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, finance]
---

# Salarizare — fluturașul propriu al angajatului

Secțiune extrasă din [[modul/salarizare]]: ce vede `employee` din portal despre propriul
salariu și de ce luna lui vine pe un al doilea drum, nu prin embed.

## Ce vede angajatul din portal

`citesteFluturasulPropriu` (cel mai recent, dintr-o perioadă aprobată) plus
`perioadaInregistrarii` pentru luna lui — un al doilea drum, fiindcă `period_id` se află
abia după primul. NU se face embed PostgREST pe `payroll_periods`: un embed refuzat de RLS
întoarce `null` în loc de rând, fără eroare, adică exact bug-ul închis în 0027.

Cele două ecrane care le folosesc: `/portal/salariul-meu` (fluturașul întreg, prin
`Fluturas`) și cardul de pe ecranul de start, `portal/card-salariu.tsx` — net de plată,
luna, și un inel cu două felii (net vs. CAS+CASS+impozit, care însumează brutul). Cardul
NU e pe fundal plin: `Inel` își desenează separatoarele în `var(--color-background)`.

## Ce refuză baza tăcut

- **Perioadele NU mai sunt complet închise pentru angajat** — de la
  `0113_luna_fluturasului_propriu.sql`. `payroll_periods_select` cerea `payroll:read = all`,
  deci `an` și `luna` îi erau refuzate tăcut, iar portalul își scria fluturașul fără lună
  (`perioada={null}` stătea literal în cod). Ramura nouă îi dă EXACT perioadele
  `aprobat`/`inchis` în care are propriul fluturaș, prin `app.are_fluturas_in_perioada`
  (definer, ca verificarea să nu treacă prin RLS-ul lui `payroll_entries` — vezi 0027).
  Poarta pozitivă e `tests/rls/proba-fluturas-luna.sql`, care cade pe verificarea (1) dacă
  cineva restrânge politica la loc.
