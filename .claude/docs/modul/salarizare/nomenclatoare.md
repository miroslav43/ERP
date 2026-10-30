---
tip: modul
titlu: Salarizare — componente și popriri
aliases: [sporuri și prime, șabloane componente, dosare de poprire]
cai:
  - "src/app/(app)/salarizare/componente/**"
  - "src/app/(app)/salarizare/popriri/**"
tabele: [salary_component_types, salary_components, payroll_garnishments, payroll_deductions]
permisiuni: [payroll:read, payroll:create, payroll:update, employees:read]
feature: payroll
capcane: []
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, finance]
---

# Salarizare — componente și popriri

Secțiune extrasă din [[modul/salarizare]]: cele două nomenclatoare ale modulului,
singurele ecrane care se deschid la orice scope, și ce lasă baza să se vadă în ele.

## Poarta lor e alta decât a modulului

Cele două nomenclatoare fac excepție de la regula „`all` direct":
`componente/page.tsx:73-74` și `popriri/page.tsx:52-53` cer doar ca `payroll:read` să
EXISTE, la orice scope, și lasă baza să îngusteze lista. Poarta compară cu `null` **și** cu `"none"`, fiindcă
`getPermissionMap` scoate scope-ul `none` din hartă după rezolvare
(`permissions.ts:127`), iar `scopeFor` întoarce `null` pentru o cheie absentă
(`permissions.ts:142-144`) — o poartă scrisă doar pe `=== "none"` nu se închide
niciodată. Butoanele de scriere cer `payroll:create`/`update` all.

Numele angajaților sunt linkuri spre fișă doar cu `employees:read` all, prin
`LinkEntitate` (`src/components/ui/link-entitate.tsx`); pe `/salarizare/componente` prin
`hrefFisa` (`src/lib/navigare/fisa.ts`), care închide și linkul unui angajat șters.

## Ce intră și ce iese pe URL

- `?nou=<id>`, pus de `laReusita` al celor două formulare în casetă: rândul tocmai creat
  capătă inel și ancora `#dosar-<id>` / `#sablon-<id>`, deci ecranul derulează la el în
  loc să-l lase pierdut în listă.
- `?angajat=<id>` pe `/salarizare/popriri` e filtru de INTRARE, dinspre fișa angajatului:
  lista n-avea nicio adresă pe om, deci de pe fișă nu se putea ajunge la dosarele lui.
  Se acceptă numai un UUID; starea goală spune atunci „niciun dosar pentru acest angajat",
  nu „niciun dosar de poprire".
- `/salarizare/componente` arată pentru fiecare șablon **cine îl are azi**, din
  `salary_components` valabile la `todayInBucharest()`: înainte de a-i schimba regimul
  fiscal nu se putea vedea pe cine afectează.

## Ce refuză baza tăcut

- **`/salarizare/popriri` deschis nu înseamnă lista întreagă.**
  `payroll_garnishments_select` trece prin `app.poate_accesa_salariul(…, 'read')`
  (`0059_salarizare_popriri.sql:106-111`), deci sub `all` rămân doar dosarele proprii —
  listă scurtă sau `StareGoala`, niciodată eroare. Catalogul de la
  `/salarizare/componente` e invers: `salary_component_types_select`
  (`0005_hr_rls.sql:751-759`) filtrează numai pe organizație — un șablon nu e salariul
  nimănui.
