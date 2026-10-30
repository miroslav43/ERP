---
tip: modul
titlu: Flotă — drepturile pe roluri și „Mașina mea” — portalul șoferului
aliases: [masina-mea, portal flota]
cai:
  - "src/app/(portal)/portal/masina-mea/**"
tabele: [vehicles, trip_sheets, vehicle_incidents, vehicle_reservations]
permisiuni:
  [trip_sheets:read, trip_sheets:create, vehicle_incidents:create, vehicle_reservations:read]
feature: fleet
capcane: []
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, operations]
---

# Flotă — portalul „Mașina mea”

Secțiune extrasă din [[modul/flota/roluri-si-portal]]: rutele portalului șoferului,
poarta fiecăreia și citirile care filtrează pe fișa proprie.

## Portalul: `/portal/masina-mea`

| Rută                              | Poartă                                                              |
| --------------------------------- | ------------------------------------------------------------------- |
| `/portal/masina-mea`              | doar modulul fleet (0215: și omul fără drept pe foi)                |
| `/portal/masina-mea?foaie=noua`   | caseta, cu `trip_sheets:create`                                     |
| `/portal/masina-mea/foi/[id]`     | `trip_sheets:read` own; foaia altcuiva → 404                        |
| `/portal/masina-mea?incident=nou` | declarația de incident, cu `vehicle_incidents:create` own (0206 §F) |
| `/portal/masina-mea/rezervari`    | `vehicle_reservations:read` (0216): `[[modul/flota/rezervari]]`     |

Din 0215 (F12c, decizia 3), pagina nu mai cere `trip_sheets:read`: omul FĂRĂ drept pe foi
sau pe vehicule (de regulă `hr`) care conduce o mașină a firmei vede aici vehiculul alocat
LUI și PV-urile la care e parte, fără semafor, fără mașini comune și fără foi (secțiunea
foilor lipsește). Ramura e în `vehicule_select`; cardul mașinii nu o moștenește (0214
judecă prin `app.poate_vedea_vehicul_dupa_id`). Meniul ține încă intrarea pe
`trip_sheets:read`: hr-ul ajunge la pagină din notificare. PV-urile:
`[[modul/flota/proces-verbal]]`.

Declarația șoferului (mașina lui sau pool, doar declarațiile proprii, notificarea
responsabilului): `[[modul/flota/declaratia-soferului]]`.

Intrarea de meniu `portal-masina` (fără slot pe bara de jos). Citirile filtrează EXPLICIT
pe fișa proprie (`vehicululMeu`, `foileMele` cu keyset peste `listeazaFoi`), ca la tot
portalul: un administrator care e și șofer ar vedea altfel tot parcul. Semaforul mașinii
e `semaforVehicul` din `src/domain/fleet/scadente.ts`, aceeași funcție ca în `/flota`.
Acțiunile foii revalidează și `/portal`, `/portal/masina-mea`, `/portal/masina-mea/foi/<id>`.
