---
tip: modul
titlu: Flotă — nomenclatorul de documente și erorile traduse
aliases: [flota-erori, vehicle_document_types, tipuri document vehicul]
cai:
  - "src/app/(app)/flota/erori.ts"
  - "src/app/(app)/flota/etichete.ts"
  - "src/app/(app)/flota/[id]/**"
tabele: [vehicle_document_types, vehicle_documents, vehicle_assignments]
permisiuni: [vehicles:create, vehicles:update]
feature: fleet
capcane: [21]
scris_pe: c2cf6c8f968d9b2a0a3121ba02ff74a4b97f3c6d
scris_la: 2026-10-07
tags: [modul, operations]
---

# Flotă — nomenclatorul de documente și erorile traduse

Extrasă din `[[modul/flota]]`, ca pagina principală să rămână sub plafon.

## Erori traduse

`src/app/(app)/flota/erori.ts` acoperă `23505`, `22012`, `22003` și `P0001`, iar pentru
alocări `traduEroareAlocare` adaugă `23P01`. `22012` (împărțire la zero) apare real: preț
pe litru cu cantitate zero.

**P0001 ajunge pe câmp, nu sub buton.** Mesajele triggerelor se propagă neschimbate —
cifrele din ele se află doar din bază — dar `CAMPURI_DUPA_MESAJ` le potrivește după
ÎNCEPUTUL mesajului, iar `invalidInput` pune `fieldErrors` pe câmpul vinovat. Ce nu se
potrivește rămâne `businessRule`, mesaj general (foaie aprobată, vehicul ieșit din parc).

**Alocările au harta lor** (`CAMPURI_ALOCARE`). În caseta de predare vehiculul e un câmp
ASCUNS: harta foilor ar pune „Vehiculul …” pe `vehicle_id`, iar mesajul s-ar pierde sub
„Corectați câmpurile marcate”. Suprapunerea (`23P01`) cade pe `de_la`, fără `details`, care
are uuid-uri și intervale brute.

Capcana potrivirii: **mesajele din 0012/0018 sunt scrise cu s și t cu SEDILĂ**
(`0012_fleet.sql:600`, `0018_fix_flota.sql:98`), deci tiparele lor ocolesc literele acelea
cu `.`. Mesajele noi (0171+) au ș/ț corecte și se potrivesc direct. Un tipar scris cu altă
formă decât mesajul nu s-ar potrivi NICIODATĂ, iar eroarea ar cădea tăcut în mesajul
general. `erori.test.ts` fixează asta mesaj cu mesaj; `erori-etichete.test.ts` lipește
hărțile din `etichete.ts` de enumurile din `src/schemas/fleet.ts`.

## Nomenclatorul de tipuri de document

`vehicle_document_types` e o TABELĂ, nu un enum — ca primul client de transport să nu
ceară o migrare de platformă. Din rândurile de platformă, **doar șapte sunt active** de la
`0116`: ITP, RCA, CASCO, rovinietă, revizie, stingător, trusă medicală. Cele patru de
transport (licență, copie conformă, tahograf, ADR) au `activ = false` — se reactivează cu
un `UPDATE`, pentru toate firmele deodată.

Un tip PROPRIU firmei nu poate purta codul unuia de platformă (`vdt_normalizeaza`, 0018 §F6):
`kind`-ul din `expirables` se deduce din `cod`, iar o coliziune ar face două tipuri să scrie
peste aceeași scadență. Dezactivarea nu îngheață documentele existente — de la 0018 §F4,
`vdoc_inainte` revalidează tipul doar la INSERT sau când `document_type_id` chiar se schimbă.

Coloana `numar` a ieșit din interfață. Rămâne în bază, cu valorile deja scrise.
