---
tip: modul
titlu: Flotă — acțiuni și citiri
aliases: [flota-actiuni, fleet actions]
cai:
  - "src/app/(app)/flota/actions.ts"
  - "src/app/(app)/flota/actions-*.ts"
  - "src/lib/queries/fleet.ts"
  - "src/lib/queries/fleet-service.ts"
  - "src/app/(app)/flota/valori-vehicul.ts"
  - "src/app/(app)/flota/[id]/valori-document.ts"
  - "src/app/(app)/flota/foi/date-foaie-noua.ts"
  - "supabase/migrations/0173_flota_alocari.sql"
  - "tests/rls/proba-flota-alocari.sql"
tabele:
  [vehicles, vehicle_documents, vehicle_assignments, trip_sheets, fuel_entries, odometer_anomalies]
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
capcane: [22, 23]
scris_pe: 4e95b7cbf409195aaf371cdcafaac92aeb7ed7af
scris_la: 2026-10-22
tags: [modul, operations]
---

# Flotă — acțiuni și citiri

Secțiuni extrase din [[modul/flota]] la integrarea F12: cu lista „Extensii”, pagina trecuse
de plafonul dur al convenției vault-ului.

## Server Actions

`src/app/(app)/flota/actions.ts`.

| Funcție                                               | Permisiune / minScope        |
| ----------------------------------------------------- | ---------------------------- |
| `creeazaVehicul`, `adaugaDocument`                    | `vehicles:create` / all      |
| `actualizeazaVehicul`, `stergeVehicul`                | `vehicles:update` / all      |
| `corecteazaKilometraj`                                | `vehicles:update` / all      |
| `alocaVehicul`, `incheieAlocarea`, `stergeAlocarea`   | `vehicles:update` / all      |
| `actualizeazaDocument`, `stergeDocument`              | `vehicles:update` / all      |
| `creeazaFoaie` (șoferul sub `all` = fișa proprie)     | `trip_sheets:create` / own   |
| `trimiteFoaie`, `redeschideFoaie`, `adaugaAlimentare` | `trip_sheets:update` / own   |
| `decideFoaie`                                         | `trip_sheets:approve` / team |
| `confirmaAnomalie`                                    | `vehicles:update` / team     |

Cursele, retragerea, corectura și ștergerea ciornei, alimentările corectate și șabloanele
de traseu (0200): `[[modul/flota/foaia-zilnica]]`.
Planurile de service, intervențiile și cheltuielile (`actions-service.ts`, 0203):
`[[modul/flota/service-si-costuri]]`. `salveazaSetariFlota` (`vehicles:update`
/ all, `actions-setari.ts`), jobul zilnic de scadențe și notificările foii (0201):
`[[modul/flota/alerte-si-setari]]`. Tipurile de document (`actions-tipuri.ts`) și
fișierele (`actions-fisiere.ts`, 0202): `[[modul/flota/documente-si-erori]]`. Ieșirea din
parc: extensia h (`[[modul/flota/iesire]]`), nu `actualizeazaVehicul`.

**Kilometrajul de bord e obligatoriu la creare** (`numarObligatoriu`) și lipsește din
modificare. Pe `default 0`, prima foaie trecea de orice verificare (`Number("")` e `0`).
Corectura e `corecteazaKilometraj`, cu motivul în audit.

**Starea foii decide tot ce se mai scrie** (0200 §D1, pe orice scope; cursele și
alimentările DOAR pe ciornă): tabelul stărilor e în `[[modul/flota/foaia-zilnica-garzi]]`.

Scrierile pe vehicule și documente sunt toate `minScope: "all"`, fiindcă politicile cer
literal `has_permission(...) = 'all'`. **`vehicles:delete` NU se folosește**, deși
`0002_authz.sql:1153` îl acordă lui `super_admin` și `org_admin`: politicile se uită numai
la `vehicles:update`, deci cheia rămâne inertă. Ștergerea e logică, prin `deleted_at`:
tabelele flotei primesc grant doar pe `select`, `insert` și `update`
(`0012_fleet.sql:1080`). Contractele scrierilor și ale traducerii de erori sunt fixate pe
clientul fals: `actions-*.test.ts`, `erori-etichete.test.ts`.

## Alocarea șoferului

- **Șoferul vehiculului NU se scrie pe `vehicles`** (0173). `vehicles.employee_id` e
  derivatul alocării deschise din `vehicle_assignments` (`pana_la is null`); scris direct
  dă P0001. `alocaVehicul` e un singur INSERT: triggerul închide singur alocarea precedentă
  și mută responsabilul din `expirables`; vânzarea, casarea sau ștergerea vehiculului închid
  alocarea. Proba: `tests/rls/proba-flota-alocari.sql`.

## Casetele fără rută

**Vehiculul nou și foaia nouă NU au rută**: casete pe listă, deschise prin parametru
(`/flota?vehicul=nou`, `/flota/foi?foaie=noua`), cu `deschisInitial` + `key` (o navigare pe
ACEEAȘI rută nu remontează). Datele casetei de foaie: `foi/date-foaie-noua.ts`, doar
vehicule `activ` (baza refuză foaia pe unul vândut sau casat).

## Din `FormData` spre acțiuni

`flota/valori-vehicul.ts` și `flota/[id]/valori-document.ts` sunt singura traducere din
`FormData` spre încărcătura acțiunilor, la creare și la modificare, ca și
`CampuriVehicul`/`CampuriDocument`. Două
capcane tăcute stau acolo, prinse de `valori-vehicul.test.ts` și `valori-document.test.ts`:
`Number("")` e `0`, nu `NaN` (un cost necompletat s-ar salva ca „0 lei"), iar bifa
`pool` nebifată LIPSEȘTE din `FormData`, deci absența ei înseamnă `false`.

## Citiri

`src/lib/queries/fleet.ts`: `listeazaVehicule`,
`citesteVehicul`, `scadenteCurente`, `documenteleVehiculului`,
`nomenclatorDocumente` (tot, cu setarea firmei), `tipuriDocument(org)` (doar active),
`urlSemnateFlota`, `listeazaFoi`, `citesteFoaie` (cu instantaneul vehiculului),
`kmDePlecareSugerat`, `combustibilPeFoi`, `alimentarileFoii`, `anomaliiNeconfirmate`,
`anomaliiPeFoi`, `curseleFoii`, `sabloaneTraseu`, `numeleContului`, `setariFlota`,
`candidatiResponsabiliFlota`, plus, pentru portal, `vehicululMeu` și `foileMele` (filtru
explicit pe șofer). Service, intervenții, cheltuieli și costuri: `fleet-service.ts`;
`pragSaltVehicul` (un singur număr, pentru cine nu citește `fleet_settings`): `fleet.ts`.
Codurile UIT ale foii (`uiturileFoii`, `stareETransportPeFoi`): `[[modul/flota/uit]]`.
