---
tip: modul
titlu: Flotă — drepturile pe roluri și „Mașina mea” — șoferul foii noi
aliases: [foaie-noua, dialog foaie]
cai:
  - "src/app/(app)/flota/foi/dialog-foaie-noua.tsx"
  - "src/app/(app)/flota/foi/date-foaie-noua.ts"
tabele: [vehicles, vehicle_assignments, trip_sheets]
permisiuni: [trip_sheets:create, trip_sheets:update]
feature: fleet
capcane: []
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, operations]
---

# Flotă — șoferul foii noi

Secțiune extrasă din [[modul/flota/roluri-si-portal]]: de unde vine șoferul foii,
ce primește caseta „Foaie nouă” și unde apare butonul.

## Șoferul foii în aplicație

`creeazaFoaie`: cu `trip_sheets:create = all` șoferul vine din formular (`null` →
VALIDARE pe `employee_id`). Sub `all`, șoferul e fișa PRINCIPALĂ a contului, citită prin
RLS (`fisaProprieFoaie`): fără ea, CONFLICT; cu alt id trimis, CONFLICT.
`foaieNouaSchema.employee_id` e deci nullable.

Caseta „Foaie nouă” (`DialogFoaieNoua`) primește `angajati: null` când șoferul e cel
conectat: selectorul dispare, iar câmpul lipsă pleacă `null`. Datele vin din
`dateFoaieNoua(org, { fel: "propriu", fisaId })` — mașina alocată plus pool-ul, NU tot ce
vede rolul (managerul vede și mașinile echipei, pe care foaia ar cădea cu P0001).
`bazaFoaie` alege unde duce „Deschide ciorna”. Contractul e fixat de
`dialog-foaie-noua.test.tsx` (happy-dom). Cheia casetei vine din `cheieCasetaFoaie(deschide,
vehicul)` pe ambele pagini: vehiculul propus de asistent intră în cheie, deci a doua
propunere, pe altă mașină, remontează caseta (F12e).

Pe `/flota/foi/[id]`, închiderea și alimentarea apar doar pe foaia proprie când
`trip_sheets:update` nu e `all`. Pe `/flota/[id]`, „Foaie nouă pe acest vehicul” apare sub
`all` doar pe pool sau pe mașina proprie.
