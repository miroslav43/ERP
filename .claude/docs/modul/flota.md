---
tip: modul
titlu: Flotă
aliases: [fleet, vehicule, foi de parcurs]
cai:
  - "src/app/(app)/flota/**"
  - "src/lib/queries/fleet.ts"
  - "src/lib/queries/fleet-service.ts"
  - "src/schemas/fleet.ts"
  - "src/schemas/fleet-service.ts"
  - "src/domain/fleet/**"
  - "src/app/(portal)/portal/masina-mea/**"
  - "src/app/api/export/flota/**"
  - "src/app/(app)/flota/fiscal/**"
tabele:
  [
    vehicles,
    vehicle_assignments,
    vehicle_documents,
    vehicle_document_types,
    vehicle_document_type_setari,
    trip_sheets,
    trip_sheet_curse,
    trip_route_templates,
    fleet_settings,
    vehicle_fiscal_regimes,
    vehicle_consumption_norms,
    vehicle_fines,
    vehicle_incidents,
    fuel_entries,
    odometer_anomalies,
    vehicle_service_plans,
    vehicle_service_entries,
    vehicle_expenses,
  ]
permisiuni:
  [
    vehicles:read,
    vehicles:create,
    vehicles:update,
    trip_sheets:read,
    trip_sheets:create,
    trip_sheets:update,
    trip_sheets:approve,
    vehicles:export,
  ]
feature: fleet
capcane: [18, 19, 21, 22, 23, 26]
citeste_daca:
  - "foaie refuzată cu „Vehiculul ales nu vă este alocat” → [[modul/flota/roluri-si-portal]]; permis, aviz medical, șofer → [[modul/flota/soferi]]; amendă, art. 39, incident, daună → [[modul/flota/amenzi-si-daune]]"
  - "curse, foaie trimisă, numărul FP, PDF, orele foilor → [[modul/flota/foaia-zilnica]]; service, costuri, anvelope → [[modul/flota/service-si-costuri]]; rapoarte lunare, Excel, pachet pentru contabil → [[modul/flota/rapoarte]]"
  - "alerte de scadență, /flota/setari → [[modul/flota/alerte-si-setari]]; regim fiscal, avantaj în natură, /flota/fiscal → [[modul/flota/fiscal]]; proces-verbal de predare, PVA, confirmarea șoferului → [[modul/flota/proces-verbal]]"
scris_pe: b6ed2c66abe3b535c04d7993c3465e8fff1629de
scris_la: 2026-10-13
tags: [modul, operations]
---

# Flotă

Vehicule, documentele lor cu scadențe, foi de parcurs cu alimentări, și anomalii de
kilometraj. **Modulul cu cea mai densă concentrație de refuzuri tăcute din proiect** —
majoritatea celor de mai jos nu dau nicio eroare.

## Rute și cine ajunge

| Rută                                    | Poartă                                                              |
| --------------------------------------- | ------------------------------------------------------------------- |
| `/flota`, `/flota/[id]`                 | `vehicles:read` own; creare cere `vehicles:create` all              |
| `/flota/foi`, `/flota/foi/[id]`         | `trip_sheets:read`/`update` own                                     |
| `/flota/aprobari`, `/flota/anomalii`    | `trip_sheets:approve` team; confirmarea cere `vehicles:update` team |
| `/flota/foi/sabloane`                   | `trip_sheets:update` all — șabloanele de traseu (0200)              |
| `/flota/setari`                         | `vehicles:update` all — responsabili, praguri (0201)                |
| `/flota/setari/documente`               | `vehicles:update` all — tipurile de document ale firmei (0202)      |
| `/flota/fiscal`                         | `vehicles:read` all — regimul de deducere, luna fiscală (0205)      |
| `/flota/amenzi`, `/flota/incidente`     | `vehicle_fines`/`vehicle_incidents` read all (0206)                 |
| `/api/export/flota/foaie/[id]`          | `trip_sheets:read` own + RLS — PDF-ul foii (0200)                   |
| `/flota/rapoarte`, `/api/export/flota*` | `vehicles:read` + `trip_sheets:read` all; export: `vehicles:export` |
| `/portal/masina-mea*`                   | `trip_sheets:read` own — portalul șoferului, din 0199               |

Drepturile pe roluri (0199), garda de vehicul alocat sau pool, regula „aprobatorul doar
decide” și portalul „Mașina mea”: `[[modul/flota/roluri-si-portal]]`.

**Șoferii** (0204: permise, `driver_licenses`, HR fără parc; aviz medical; verificările pe
foaie și la predare): `[[modul/flota/soferi]]`. **Amenzile și dauna** (0206: scrisoarea de la
art. 39 cere și `employees:read` all, pentru CNP; recuperarea de la șofer NU e automată):
`[[modul/flota/amenzi-si-daune]]`. **Fiscalul** (0205: regimul de deducere, norma de consum,
SUGESTIA de avantaj în natură): `[[modul/flota/fiscal]]`. Rapoartele lunare, Excelul și
pachetul pentru contabil (F8): `[[modul/flota/rapoarte]]`.

**Fișa vehiculului, nomenclatorul firmei și fișierele** (cine o modifică, coloana „Acțiuni”
a documentelor, obligatoriile și opționalele pe vehicul, setarea pe tip, scanarea, poza
bonului, `org-flota`): `[[modul/flota/documente-si-erori]]`.

**Vehiculul nou și foaia nouă NU au rută**: casete pe listă, deschise prin parametru
(`/flota?vehicul=nou`, `/flota/foi?foaie=noua`), cu `deschisInitial` + `key` (o navigare pe
ACEEAȘI rută nu remontează). Datele casetei de foaie: `foi/date-foaie-noua.ts`, doar
vehicule `activ` (baza refuză foaia pe unul vândut sau casat).

## Extensii (F12)

- b, carduri de combustibil (0214): `[[modul/flota/carduri]]`
- c, proces-verbal de predare-primire (0215): `[[modul/flota/proces-verbal]]`
- d, rezervări pe mașinile de pool (0216): `[[modul/flota/rezervari]]`
- h, ieșirea din parc (0218): `[[modul/flota/iesire]]`

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
parc: extensia h, nu `actualizeazaVehicul`.

**Kilometrajul de bord e obligatoriu la creare** (`numarObligatoriu`) și lipsește din
modificare. Pe `default 0`, prima foaie trecea de orice verificare (`Number("")` e `0`, mai
jos). Corectura e `corecteazaKilometraj`, cu motivul în audit.

**Starea foii decide tot ce se mai scrie** (0200 §D1, pe orice scope; cursele și
alimentările DOAR pe ciornă): tabelul stărilor e în `[[modul/flota/foaia-zilnica]]`.

Scrierile pe vehicule și documente sunt toate `minScope: "all"`, fiindcă politicile cer
literal `has_permission(...) = 'all'`. **`vehicles:delete` NU se folosește**, deși
`0002_authz.sql:1153` îl acordă lui `super_admin` și `org_admin`: politicile se uită numai
la `vehicles:update`, deci cheia rămâne inertă. Ștergerea
e logică, prin `deleted_at`: tabelele flotei primesc grant doar pe `select`, `insert` și
`update` (`0012_fleet.sql:1080`). Contractele scrierilor și ale traducerii de erori sunt
fixate pe clientul fals: `actions-*.test.ts`, `erori-etichete.test.ts`.

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

## Ce refuză baza tăcut

Citește-o înainte de orice scriere în modul.

- **Un vehicul fără șofer și fără `pool` e invizibil sub `vehicles:read` own/team.**
  Managerul vede, din 0199, mașinile echipei și pool-ul; angajatul, mașina lui și
  pool-ul. Pe o foaie de pe o mașină care nu mai e a șoferului, embed-ul
  `vehicles!vehicle_id` vine **NULL, fără eroare**: tipează câmpul `| null` și afișează
  „—". Nu compensa cu `createAdminSupabase`. Caseta „Foaie nouă" devine explicație sau
  link spre parc când lista vine goală. — capcana #18
- **Semaforul de scadențe NU se citește din `expirables`.** Politica de acolo cere ȘI
  dreptul pe vehicul ȘI `compliance:read`, pe care în seed îl au doar `super_admin` și
  `org_admin`. Pentru `hr`, `manager` și `employee` tabela întoarce **zero rânduri,
  fără eroare**. Semaforul se calculează din `expira_la` al rândului
  `vehicle_documents` cu `este_curent = true`. — capcanele #19 și #26
- **Reînnoirea unui document e un INSERT NOU, atât.** Nu trimite `este_curent` (triggerul
  îl forțează la false, iar politica de INSERT cere exact false), nu face UPDATE pe cel
  vechi și nu-l șterge întâi. Sincronizarea alege curentul după `max(expira_la)`. — capcana #21
- **`actualizeazaDocument` NU e reînnoire** — e corectura cifrei greșite pe rândul
  existent. Ștergerea unui document promovează automat documentul anterior (`vdoc_dupa`) și
  mută scadența în `expirables`. Ambele drumuri: `tests/rls/izolare.sql`, verificarea `(l)`,
  cu rânduri NUMĂRATE — un UPDATE respins de `USING` nu ridică eroare.
- **`vehicles` și `vehicle_documents` cer `created_by` ȘI `updated_by` trimise
  explicit** din client — spre deosebire de tabelele acoperite de `internal.set_actor`.
  Omiterea lor dă **42501**, adică „Nu aveți dreptul…", un mesaj care trimite
  investigația exact în direcția greșită. — capcana #23
- **O anomalie confirmată e închisă, din 0171 și în bază.** Orice schimbare de
  `confirmat_la`, `confirmat_de` sau `nota` după confirmare dă P0001, iar `confirmat_de`
  nu mai vine din payload. `confirmaAnomalie` păstrează `.is("confirmat_la", null)`: fără
  el, al doilea clic ar primi P0001 în loc de CONFLICT.
- **Scrierea foilor și a alimentărilor se judecă pe dreptul de SCRIERE.** Din 0171,
  `foi_insert` filtrează rândul prin `app.poate_crea_foaie` (pe `trip_sheets:create`), iar
  `alimentari_insert`/`_update` prin `app.poate_scrie_foaie` (pe `update`). Înainte,
  ambele foloseau dreptul de citire. Proba: `tests/rls/proba-flota-integritate.sql`, care
  verifică și `department_id` din altă firmă (P0001).
- **Șoferul vehiculului NU se scrie pe `vehicles`** (0173). `vehicles.employee_id` e
  derivatul alocării deschise din `vehicle_assignments` (`pana_la is null`); scris direct
  dă P0001. `alocaVehicul` e un singur INSERT: triggerul închide singur alocarea precedentă
  și mută responsabilul din `expirables`; vânzarea, casarea sau ștergerea vehiculului închid
  alocarea. Proba: `tests/rls/proba-flota-alocari.sql`.
- **Coloane GENERATED ALWAYS pe care clientul nu are voie să le trimită:**
  `trip_sheets.km_parcursi` și `data` (0200), `trip_sheet_curse.km_parcursi`,
  `fuel_entries.pret_litru`, `odometer_anomalies.diferenta`. La fel, `aprobat_de`/
  `aprobat_la`, `confirmat_de`, `numar` și instantaneul vehiculului le scrie baza. — capcana #22
- **Tipul de document se judecă pe setarea FIRMEI** (0202): un tip de platformă retras
  pentru ea dă P0001 la un document nou, iar unul retras din platformă (transportul, 0116) trece dacă firma l-a activat. Calea scanării și a bonului trebuie să stea în
  folderul entității (P0001); bonul se urcă doar pe ciornă. Proba:
  `tests/rls/proba-flota-tipuri-fisiere.sql`.
- **O foaie activă pe vehicul și zi** (0200): a doua dă 23505 pe `ts_vehicul_zi_uq`, tradus
  pe `plecare_la`.

## Erori traduse

În `[[modul/flota/documente-si-erori]]`: P0001 pe câmp, hărțile separate (alocări,
setări, tipuri), SEDILA din mesajele 0012/0018.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/fleet.ts` →
`src/lib/queries/fleet.ts` → acțiuni → pagini. Anomaliile de kilometraj și calculul de
consum stau în `src/domain/fleet/`.

`flota/valori-vehicul.ts` și `flota/[id]/valori-document.ts` sunt singura traducere din
`FormData` spre încărcătura acțiunilor, la creare și la modificare, ca și
`CampuriVehicul`/`CampuriDocument`. Două
capcane tăcute stau acolo, prinse de `valori-vehicul.test.ts` și `valori-document.test.ts`:
`Number("")` e `0`, nu `NaN` (un cost necompletat s-ar salva ca „0 lei"), iar bifa
`pool` nebifată LIPSEȘTE din `FormData`, deci absența ei înseamnă `false`.

Trimiterea și alimentarea (`foi/[id]/actiuni-foaie.tsx`) sunt două `<Formular>` separate:
un refuz la alimentare nu înroșește trimiterea, iar valorile tastate rămân (ADM-022).

## Ce NU e aici

Mentenanța vehiculelor (plan, intervenții, ITP) e modul separat. Diurna pentru deplasări
e alt modul (vehiculul deplasării: `[[modul/flota/soferi]]`). Fișa șoferului: `[[modul/angajati]]`.

## Când NU e suficientă pagina asta

- Forma politicilor și a vizibilității vehiculului: migrarea care creează `vehicles`.
- Scadențele centralizate: capcanele #19, #21 și #26, integral, prin
  `node .claude/skills/administrativo/scripts/capcana.mjs --nr 19`.
- Legăturile anomaliilor, fișa vehiculului, coada cu șoferul foii: [[strat/navigare]].
