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
scris_pe: c72c3e8dbdab4bbee1ff6f55e311080155c5c4a2
scris_la: 2026-08-28
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
| `/flota/nou`                         | `vehicles:create` all                                               |
| `/flota/foi`, `/flota/foi/[id]`      | `trip_sheets:read`/`update` own                                     |
| `/flota/foi/noua`                    | `trip_sheets:create` own                                            |
| `/flota/aprobari`, `/flota/anomalii` | `trip_sheets:approve` team; confirmarea cere `vehicles:update` team |

## Server Actions

`src/app/(app)/flota/actions.ts`.

| Funcție                            | Permisiune / minScope        |
| ---------------------------------- | ---------------------------- |
| `creeazaVehicul`, `adaugaDocument` | `vehicles:create` / all      |
| `creeazaFoaie`                     | `trip_sheets:create` / own   |
| `trimiteFoaie`, `adaugaAlimentare` | `trip_sheets:update` / own   |
| `decideFoaie`                      | `trip_sheets:approve` / team |
| `confirmaAnomalie`                 | `vehicles:update` / team     |

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

## Ce NU e aici

Mentenanța vehiculelor (plan, intervenții, ITP) e modul separat. Diurna pentru deplasări
e alt modul. Fișa șoferului: `[[modul/angajati]]`.

## Când NU e suficientă pagina asta

- Forma politicilor și a funcției de vizibilitate a vehiculului: migrarea care creează
  `vehicles`.
- Scadențele centralizate: capcanele #19, #21 și #26, integral, prin
  `node .claude/skills/administrativo/scripts/capcana.mjs --nr 19`.
