---
tip: modul
titlu: Flotă
aliases: [fleet, vehicule, foi de parcurs]
cai:
  - "src/app/(app)/flota/**"
  - "src/lib/queries/fleet.ts"
  - "src/schemas/fleet.ts"
  - "src/domain/fleet/**"
tabele: [vehicles, vehicle_documents, trip_sheets, fuel_entries, odometer_anomalies]
permisiuni:
  [
    vehicles:read,
    vehicles:create,
    vehicles:update,
    trip_sheets:read,
    trip_sheets:create,
    trip_sheets:update,
    trip_sheets:approve,
  ]
feature: fleet
capcane: [18, 19, 21, 22, 23]
citeste_daca:
  - "vehicul care nu apare în listă → [[rol/manager]]"
  - "42501 la salvarea unui vehicul → capcana #23"
  - "tip de document care lipsește din listă → 0116, cele patru de transport sunt activ=false"
scris_pe: d28998af68b63913b9e7c4fe692f398571d0321b
scris_la: 2026-08-30
tags: [modul, operations]
---

# Flotă

Vehicule, documentele lor cu scadențe, foi de parcurs cu alimentări, și anomalii de
kilometraj. **Modulul cu cea mai densă concentrație de refuzuri tăcute din proiect** —
patru din cele cinci capcane de mai jos nu produc nicio eroare.

## Rute și cine ajunge

| Rută                                 | Poartă                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| `/flota`, `/flota/[id]`              | `vehicles:read` own; creare cere `vehicles:create` all              |
| `/flota/foi`, `/flota/foi/[id]`      | `trip_sheets:read`/`update` own                                     |
| `/flota/aprobari`, `/flota/anomalii` | `trip_sheets:approve` team; confirmarea cere `vehicles:update` team |

**Vehiculul nou și foaia nouă NU mai au rută.** `/flota/nou` și `/flota/foi/noua` au
dispărut, fără redirect, în favoarea unor casete pe listă — tiparul din `[[modul/concedii]]`.
Se deschid prin parametru: `/flota?vehicul=nou` și `/flota/foi?foaie=noua`, cu
`deschisInitial` + `key` pe componentă (o navigare pe ACEEAȘI rută nu remontează, deci
fără `key` caseta nu s-ar mai deschide a doua oară). Citirile fostei pagini de foaie stau
în `foi/date-foaie-noua.ts`, `server-only`, chemat doar pentru cine are `trip_sheets:create`.

## Server Actions

`src/app/(app)/flota/actions.ts`.

| Funcție                                  | Permisiune / minScope        |
| ---------------------------------------- | ---------------------------- |
| `creeazaVehicul`, `adaugaDocument`       | `vehicles:create` / all      |
| `actualizeazaVehicul`, `stergeVehicul`   | `vehicles:update` / all      |
| `actualizeazaDocument`, `stergeDocument` | `vehicles:update` / all      |
| `creeazaFoaie`                           | `trip_sheets:create` / own   |
| `trimiteFoaie`, `adaugaAlimentare`       | `trip_sheets:update` / own   |
| `decideFoaie`                            | `trip_sheets:approve` / team |
| `confirmaAnomalie`                       | `vehicles:update` / team     |

Cele patru scrieri noi sunt toate `minScope: "all"`, fiindcă politicile cer literal
`has_permission(...) = 'all'`. **`vehicles:delete` NU se folosește**, deși seed-ul din
`0002_authz.sql:1153` îl acordă lui `super_admin` și `org_admin`: politicile flotei se
uită numai la `vehicles:update`, deci cheia rămâne inertă — poarta care contează e a bazei,
nu a acțiunii. Ștergerea e logică, prin `deleted_at`: cele șase tabele ale flotei primesc
grant doar pe `select`, `insert` și `update` (`0012_fleet.sql:1080`).

## Citiri

`src/lib/queries/fleet.ts`: `listeazaVehicule`, `citesteVehicul`, `scadenteCurente`,
`documenteleVehiculului`, `tipuriDocument`, `listeazaFoi`, `citesteFoaie`,
`kmDePlecareSugerat`, `combustibilPeFoi`, `alimentarileFoii`, `anomaliiNeconfirmate`,
`anomaliiPeFoi`.

## Ce refuză baza tăcut

Citește secțiunea asta înainte de orice scriere în modul.

- **`manager` nu are NICIO permisiune `vehicles:*`.** Pe `/flota/foi` și
  `/flota/aprobari`, embed-ul `vehicles!vehicle_id` vine **NULL, fără eroare**. Tipează
  câmpul `| null` și afișează „—". Nu compensa cu `createAdminSupabase`: ESLint îl
  permite doar în `actions.ts`, route handlers, scripts și tests. În plus, un vehicul cu
  `employee_id` NULL e invizibil pentru oricine nu are `vehicles:read = all`. — capcana #18
- **Semaforul de scadențe NU se citește din `expirables`.** Politica de acolo cere ȘI
  dreptul pe vehicul ȘI `compliance:read`, pe care în seed îl au doar `super_admin` și
  `org_admin`. Pentru `hr`, `manager` și `employee` tabela întoarce **zero rânduri,
  fără eroare**. Semaforul se calculează din `expira_la` al rândului
  `vehicle_documents` cu `este_curent = true`. — capcanele #19 și #26
- **Reînnoirea unui document e un INSERT NOU, atât.** Nu trimite `este_curent` (triggerul
  îl forțează la false, iar politica de INSERT cere exact false), nu face UPDATE pe cel
  vechi și nu-l șterge întâi. Sincronizarea alege curentul după `max(expira_la)`. — capcana #21
- **`actualizeazaDocument` NU e reînnoire** — e corectura cifrei greșite pe rândul
  existent. Ștergerea unui document nu e nici ea o linie ștearsă: `vdoc_dupa` promovează
  automat documentul anterior și mută scadența în `expirables`. Ambele drumuri sunt probate
  în `tests/rls/izolare.sql`, verificarea `(l)`, cu rânduri NUMĂRATE — un UPDATE respins de
  `USING` nu ridică eroare, deci un `begin/exception` n-ar dovedi nimic.
- **`vehicles` și `vehicle_documents` cer `created_by` ȘI `updated_by` trimise
  explicit** din client — spre deosebire de tabelele acoperite de `internal.set_actor`.
  Omiterea lor dă **42501**, adică „Nu aveți dreptul…", un mesaj care trimite
  investigația exact în direcția greșită. — capcana #23
- **Coloane GENERATED ALWAYS pe care clientul nu are voie să le trimită:**
  `trip_sheets.km_parcursi`, `fuel_entries.pret_litru`, `odometer_anomalies.diferenta`.
  La fel, `aprobat_de`/`aprobat_la` și `confirmat_de` le scrie triggerul din
  `auth.uid()`. — capcana #22

## Erori traduse

`src/app/(app)/flota/erori.ts` acoperă `23505`, `22012`, `22003` și `P0001`.
`22012` (împărțire la zero) apare real: preț pe litru cu cantitate zero.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/fleet.ts` →
`src/lib/queries/fleet.ts` → acțiuni → pagini. Anomaliile de kilometraj și calculul de
consum stau în `src/domain/fleet/`.

## Nomenclatorul de tipuri de document

`vehicle_document_types` e o TABELĂ, nu un enum — ca primul client de transport să nu
ceară o migrare de platformă. Are unsprezece rânduri de platformă, dar **doar șapte
active** de la `0116`: ITP, RCA, CASCO, rovinietă, revizie, stingător, trusă medicală.
Licența de transport, copia conformă, verificarea tahograf și certificatul ADR au
`activ = false` — se reactivează cu un `UPDATE`, pentru toate firmele deodată.

Un tip PROPRIU firmei nu poate purta codul unuia de platformă (`vdt_normalizeaza`, 0018 §F6):
`kind`-ul din `expirables` se deduce din `cod`, iar o coliziune ar face două tipuri să scrie
peste aceeași scadență. Dezactivarea nu îngheață documentele existente — de la 0018 §F4,
`vdoc_inainte` revalidează tipul doar la INSERT sau când `document_type_id` chiar se schimbă.

Coloana `numar` a ieșit din interfață (formular și tabel) — nu se căuta după ea, nu intra
în niciun raport și nu ajungea în `expirables`. Rămâne în bază cu valorile deja scrise.

## Ce NU e aici

Mentenanța vehiculelor (plan, intervenții, ITP) e modul separat. Diurna pentru deplasări
e alt modul. Fișa șoferului: `[[modul/angajati]]`.

## Când NU e suficientă pagina asta

- Forma politicilor și a funcției de vizibilitate a vehiculului: migrarea care creează
  `vehicles`.
- Scadențele centralizate: capcanele #19, #21 și #26, integral, prin
  `node .claude/skills/administrativo/scripts/capcana.mjs --nr 19`.
