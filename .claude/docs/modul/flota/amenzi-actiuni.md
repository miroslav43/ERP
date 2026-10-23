---
tip: modul
titlu: Flotă — amenzi și daune, acțiunile, citirile și erorile
aliases: [actions-amenzi, flota-amenzi, traduEroareAmenzi, TRANZITII_AMENDA]
cai:
  - "src/app/(app)/flota/actions-amenzi.ts"
  - "src/lib/queries/flota-amenzi.ts"
  - "src/schemas/flota-amenzi.ts"
  - "src/domain/fleet/amenzi.ts"
  - "src/app/(app)/flota/erori.ts"
  - "src/app/(app)/flota/erori-amenzi.test.ts"
tabele: [vehicle_fines, vehicle_incidents]
permisiuni:
  [
    vehicle_fines:read,
    vehicle_fines:create,
    vehicle_fines:update,
    vehicle_incidents:read,
    vehicle_incidents:create,
    vehicle_incidents:update,
  ]
feature: fleet
capcane: []
scris_pe: 59875840fcf542f696cecc8982d47c68375f2596
scris_la: 2026-10-23
tags: [modul, operations, legal]
---

# Flotă — amenzi și daune: acțiunile, citirile și erorile

Secțiuni extrase din [[modul/flota/amenzi-si-daune]] (pagina trecuse de plafonul dur al
convenției vault-ului). Ce refuză baza pe amenzi și incidente rămâne acolo; pagina de
modul e [[modul/flota]].

## Server Actions

`src/app/(app)/flota/actions-amenzi.ts`, toate cu `minScope: "all"`.

| Funcție                                                                         | Permisiune                 |
| ------------------------------------------------------------------------------- | -------------------------- |
| `inregistreazaAmenda`                                                           | `vehicle_fines:create`     |
| `actualizeazaAmenda`, `desemneazaSofer`, `retrageDesemnarea`, `trimiteRaspuns`  | `vehicle_fines:update`     |
| `schimbaStadiulAmenzii` (plătită, contestată, anulată cu motiv), `stergeAmenda` | `vehicle_fines:update`     |
| `raporteazaIncident`                                                            | `vehicle_incidents:create` |
| `actualizeazaIncident`, `schimbaStadiulIncidentului`, `stergeIncident`          | `vehicle_incidents:update` |

Fiecare tranziție adaugă stadiul de plecare ca filtru (`.eq` sau `.in`) și `.select()` după:
zero rânduri e CONFLICT, nu succes. Plecările permise se calculează din matricea
`TRANZITII_AMENDA` din domeniu, aceeași ca a bazei.

**Excepția cu două încercări:** `desemneazaSofer` și `trimiteRaspuns` încearcă întâi calea
obișnuită (care schimbă stadiul), iar la zero rânduri o a doua, pe amenda `contestata` cu
`raspuns_trimis_la` gol, care scrie doar șoferul / data răspunsului și lasă stadiul în pace.
Altfel o amendă marcată „contestată” înainte de răspuns rămânea cu termenul în scadențe și
fără nicio cale de a-l închide.

## Citiri

`src/lib/queries/flota-amenzi.ts` (`import "server-only"`): `listeazaAmenzi` și
`listeazaIncidente` (cursor keyset pe momentul faptei, cu total exact), `citesteAmenda`,
`citesteIncident`, `rezumatAmenzi` (numărători exacte, nu citire de rânduri),
`soferSugerat`, `soferiPentruDesemnare` (și angajații plecați), `vehiculePentruAmenzi`
(și vehiculele vândute), `cercetariSsm`, `datePersonaleSofer` (doar pentru scrisoare).

## Erori traduse

În `flota/erori.ts`, blocul „amenzi și daune”: `traduEroareAmenzi` pune pe câmp restricțiile
(`vf_*`, `vi_*`) și mesajele P0001 ale triggerelor; refuzurile de stadiu rămân mesaj general,
cu textul bazei. `erori-amenzi.test.ts` citește migrarea și cere ca FIECARE mesaj să fie fie
mapat pe un câmp, fie declarat general: un mesaj nou fără traducere pică testul.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/flota-amenzi.ts` →
`src/lib/queries/flota-amenzi.ts` → `actions-amenzi.ts` → paginile. Tranzițiile stau în
`src/domain/fleet/amenzi.ts`, iar `amenzi.test.ts` compară matricea cu textul migrării.
Cheile de permisiune: `src/config/permissions.ts` + seed-ul din 0206. Rutele intră și în
`file-module.ts` (filele), `porti-ruta.ts` (porțile), `destinatii.ts` (asistentul) și
`e2e/module.spec.ts`, în blocuri delimitate.
