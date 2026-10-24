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
scris_pe: c1ad3b039681d8b4d5f1f466c0c2a4e7f3ab67f8
scris_la: 2026-10-24
tags: [modul, operations, legal]
---

# Flotă — amenzi și daune: acțiunile, citirile și erorile

Secțiuni extrase din [[modul/flota/amenzi-si-daune]] (pagina trecuse de plafonul dur al
convenției vault-ului). Ce refuză baza pe amenzi și incidente rămâne acolo; pagina de
modul e [[modul/flota]].

## Server Actions

`src/app/(app)/flota/actions-amenzi.ts`, toate cu `minScope: "all"`, în afară de
`declaraIncident` (`vehicle_incidents:create` / own, declarația șoferului din portal:
`[[modul/flota/declaratia-soferului]]`).

| Funcție                                                                         | Permisiune                 |
| ------------------------------------------------------------------------------- | -------------------------- |
| `inregistreazaAmenda`                                                           | `vehicle_fines:create`     |
| `actualizeazaAmenda`, `desemneazaSofer`, `retrageDesemnarea`, `trimiteRaspuns`  | `vehicle_fines:update`     |
| `schimbaStadiulAmenzii` (plătită, contestată, anulată cu motiv), `stergeAmenda` | `vehicle_fines:update`     |
| `raporteazaIncident`, `declaraIncident` (own)                                   | `vehicle_incidents:create` |
| `actualizeazaIncident`, `schimbaStadiulIncidentului`, `stergeIncident`          | `vehicle_incidents:update` |

Fiecare tranziție adaugă stadiul de plecare ca filtru (`.eq` sau `.in`) și `.select()` după:
zero rânduri e CONFLICT, nu succes. Plecările permise se calculează din matricea
`TRANZITII_AMENDA` din domeniu, aceeași ca a bazei.

**Excepția cu două încercări:** `desemneazaSofer` și `trimiteRaspuns` încearcă întâi calea
obișnuită (care schimbă stadiul), iar la zero rânduri o a doua, pe amenda `contestata` cu
`raspuns_trimis_la` gol, care scrie doar șoferul / data răspunsului și lasă stadiul în pace.
Altfel o amendă marcată „contestată” înainte de răspuns rămânea cu termenul în scadențe și
fără nicio cale de a-l închide.

**Declarația din portal:** `declaraIncident` (`fleet.incident.declare`, `revalidate` pe
`/portal/masina-mea` și `/flota/incidente`) își citește întâi fișa PRINCIPALĂ prin clientul
utilizatorului (`employees:read = own`, deci `is_primary` + `deleted_at is null`) și
oprește cu `businessRule` contul fără fișă; apoi trimite `declarat_de_employee_id` și
`sofer_id` = fișa lui, chiar dacă apelantul are `create = all`. E singura scriere de aici
care NU face `.select()` după ea: id-ul îl pune acțiunea, cu `randomUUID()`, fiindcă
șoferul nu vede rândul incidentului (`vehicle_incidents_select` a rămas doar `read = all`),
iar `RETURNING` ar cădea cu 42501 pe fiecare declarație. Intrarea e
`declaratieIncidentSchema` din `src/schemas/flota-amenzi.ts`: doar vehiculul, tipul,
momentul, locul și descrierea, cu validările comune din `detaliiIncident`. Vehiculul, ziua
alocării și costurile refuzate le judecă baza — [[modul/flota/declaratia-soferului]].

## Citiri

`src/lib/queries/flota-amenzi.ts` (`import "server-only"`): `listeazaAmenzi` și
`listeazaIncidente` (cursor keyset pe momentul faptei, cu total exact), `citesteAmenda`,
`citesteIncident`, `rezumatAmenzi` (numărători exacte, nu citire de rânduri),
`soferSugerat`, `soferiPentruDesemnare` (și angajații plecați), `vehiculePentruAmenzi`
(și vehiculele vândute), `cercetariSsm`, `datePersonaleSofer` (doar pentru scrisoare) și
`declaratiileMele` (portalul, prin `incidente_declarate_de_mine`).

`COLOANE_INCIDENT` aduce și `declarat_de_employee_id`, deci `RandIncident` (din
`listeazaIncidente` și `citesteIncident`) spune dacă incidentul a fost declarat din portal
sau înregistrat de administrator (nul). Lista șoferului are tipul ei, `RandDeclaratie`:
numai ce a declarat el, stadiul și închiderea — fără costuri, despăgubire, asigurător,
dosar, observații și cercetare SSM, pe care le scrie responsabilul. Citirea trece prin
funcția `incidente_declarate_de_mine`, nu prin tabelă, cu `organizationId` primul argument,
cursor keyset pe (`produs_la`, `id`) și `total` pe toate declarațiile.

## Erori traduse

În `flota/erori.ts`, blocul „amenzi și daune”: `traduEroareAmenzi` pune pe câmp restricțiile
(`vf_*`, `vi_*`) și mesajele P0001 ale triggerelor, prin `CAMPURI_AMENZI`, potrivite pe
începutul mesajului. Din X2 intră acolo și fișa de șofer care nu există, e ștearsă logic
sau e din altă firmă: „Șoferul desemnat nu există…” pe `employee_id` și „Șoferul
incidentului nu există…” pe `sofer_id` — un singur mesaj pe tabelă, fiindcă baza nu
deosebește cele trei cazuri.

Rămân mesaj general, cu textul și cifrele bazei: refuzurile de stadiu, două dintre cele ale
declarației din portal („Declarantul unui incident…”, „Contul dumneavoastră nu e legat de o
fișă…”) și garda de firmă pusă de X2 înaintea oricărei căutări („Nu aveți dreptul de a
înregistra amenzi / incidente în această organizație.”) — refuzuri ale rândului întreg, nu
ale unei casete. Al treilea refuz al declarației, vehiculul nealocat în ziua incidentului,
face excepție: începe cu „Vehiculul ales” și ajunge pe `vehicle_id`.

`erori-amenzi.test.ts` citește migrarea și cere ca FIECARE mesaj să fie fie mapat pe un
câmp, fie trecut în lista `GENERALE`: un mesaj nou fără traducere pică testul (mesajele cu
`%s` se judecă tot după început). Mai cere ca mesajele să aibă ș/ț cu virgulă și să se
termine cu punct, verifică perechile mesaj → câmp cele mai frecvente și are plasa
„migrarea are mesajele de verificat”, contra unui regex care nu mai prinde nimic.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/flota-amenzi.ts` →
`src/lib/queries/flota-amenzi.ts` → `actions-amenzi.ts` → paginile. Tranzițiile stau în
`src/domain/fleet/amenzi.ts`, iar `amenzi.test.ts` compară matricea cu textul migrării.
Cheile de permisiune: `src/config/permissions.ts` + seed-ul din 0206. Rutele intră și în
`file-module.ts` (filele), `porti-ruta.ts` (porțile), `destinatii.ts` (asistentul) și
`e2e/module.spec.ts`, în blocuri delimitate.
