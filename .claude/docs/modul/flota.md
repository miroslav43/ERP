---
tip: modul
titlu: Flotă
aliases: [fleet, vehicule, foi de parcurs]
cai:
  - "src/app/(app)/flota/**"
  - "src/lib/queries/fleet.ts"
  - "src/schemas/fleet.ts"
  - "src/domain/fleet/**"
  - "src/app/(portal)/portal/masina-mea/**"
tabele:
  [
    vehicles,
    vehicle_assignments,
    vehicle_documents,
    trip_sheets,
    trip_sheet_curse,
    trip_route_templates,
    fuel_entries,
    odometer_anomalies,
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
  ]
feature: fleet
capcane: [18, 19, 21, 22, 23, 26]
citeste_daca:
  - "foaie refuzată cu „Vehiculul ales nu vă este alocat” → [[modul/flota/roluri-si-portal]]"
  - "curse, foaie trimisă care nu se mai modifică, numărul FP, PDF → [[modul/flota/foaia-zilnica]]"
  - "42501 la salvarea unui vehicul → capcana #23"
scris_pe: 376052e0c8cbbb56c35b210dfda28d12158be879
scris_la: 2026-10-12
tags: [modul, operations]
---

# Flotă

Vehicule, documentele lor cu scadențe, foi de parcurs cu alimentări, și anomalii de
kilometraj. **Modulul cu cea mai densă concentrație de refuzuri tăcute din proiect** —
majoritatea refuzurilor de mai jos nu produc nicio eroare.

## Rute și cine ajunge

| Rută                                 | Poartă                                                              |
| ------------------------------------ | ------------------------------------------------------------------- |
| `/flota`, `/flota/[id]`              | `vehicles:read` own; creare cere `vehicles:create` all              |
| `/flota/foi`, `/flota/foi/[id]`      | `trip_sheets:read`/`update` own                                     |
| `/flota/aprobari`, `/flota/anomalii` | `trip_sheets:approve` team; confirmarea cere `vehicles:update` team |
| `/flota/foi/sabloane`                | `trip_sheets:update` all — șabloanele de traseu (0197)              |
| `/api/export/flota/foaie/[id]`       | `trip_sheets:read` own + RLS — PDF-ul foii (0197)                   |
| `/portal/masina-mea*`                | `trip_sheets:read` own — portalul șoferului, din 0196               |

Drepturile pe roluri (0196), garda de vehicul alocat sau pool, regula „aprobatorul doar
decide” și portalul „Mașina mea”: `[[modul/flota/roluri-si-portal]]`.

**Fișa vehiculului nu e doar de citit.** Modificarea și ștergerea stau amândouă în spatele
lui `vehicles:update` all — `poateAdministra` din `[id]/page.tsx`, poarta cerută de
`vehicule_update` în bază. Sub ea intră și corectura documentelor din coloana „Acțiuni”.
Pe un rând fără document, aceeași coloană are „+” (`vehicles:create`, cu tipul
preselectat); „Document nou” din capul secțiunii deschide aceeași casetă fără tip (panoul
permanent de sub tabel a fost scos). Pentru cine nu poate nici una, nici alta, coloana
lipsește cu totul. Tabelul listează TOATE tipurile: obligatoriile întâi (roșu „Lipsește”
când n-au document), apoi opționalele (pastilă neutră „Neînregistrat” — lipsa lor nu e o
problemă); un document fără dată de expirare e „Fără scadență”, nu „Lipsește”.

**Vehiculul nou și foaia nouă NU au rută**: casete pe listă, deschise prin parametru
(`/flota?vehicul=nou`, `/flota/foi?foaie=noua`), cu `deschisInitial` + `key` (o navigare pe
ACEEAȘI rută nu remontează). Datele casetei de foaie: `foi/date-foaie-noua.ts`, doar
vehicule `activ` (baza refuză foaia pe unul vândut sau casat).

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
de traseu (0197): `[[modul/flota/foaia-zilnica]]`.

**Kilometrajul de bord e obligatoriu la creare** (`numarObligatoriu`) și lipsește din
modificare. Pe `default 0`, prima foaie trecea de orice verificare. `z.coerce.number()` nu
ajunge: `Number("")` și `Number(null)` dau `0`. Corectura e `corecteazaKilometraj`, cu
motivul în audit.

**Starea foii decide tot ce se mai scrie** (0197 §D1, pe orice scope): pe `trimis` doar
retragerea sau decizia, pe `respins` doar redeschiderea, pe `aprobat` doar stornarea.
Cursele și alimentările se scriu DOAR pe ciornă.

Scrierile pe vehicule și documente sunt toate `minScope: "all"`, fiindcă politicile cer
literal `has_permission(...) = 'all'`. **`vehicles:delete` NU se folosește**, deși
`0002_authz.sql:1153` îl acordă lui `super_admin` și `org_admin`: politicile se uită numai
la `vehicles:update`, deci cheia rămâne inertă — poarta care contează e a bazei. Ștergerea
e logică, prin `deleted_at`: tabelele flotei primesc grant doar pe `select`, `insert` și
`update` (`0012_fleet.sql:1080`). Contractele scrierilor, ale traducerii de erori și ale
casetei „Foaie nouă" sunt fixate pe clientul fals: `actions-vehicule.test.ts`,
`actions-foi.test.ts`, `erori-etichete.test.ts`, `foi/date-foaie-noua.test.ts`.

**Ieșirea din parc trece prin `actualizeazaVehicul`** (`vehicule_insert` cere `status =
'activ'`): `status` și `motiv_iesire` sunt doar în `actualizeazaVehiculSchema`, cu motiv
obligatoriu la `vandut`/`casat`; `data_iesire` o pune baza. Ștergerea e pentru rândul care
n-ar fi trebuit să existe; `vehicles_dupa` scoate scadențele din semafor.

**Orele foilor sunt ora României.** `plecare_la`, `sosire_la` și `alimentat_la` trec prin
`dataOraRomania` și ies în UTC; formularele umplu câmpul cu `oraRomanieiPentruCamp`. Cu
`z.iso.datetime({ local: true })`, 15:00 tastat apărea 18:00.

## Citiri

`src/lib/queries/fleet.ts` (marcat `import "server-only"`): `listeazaVehicule`,
`citesteVehicul`, `scadenteCurente`, `documenteleVehiculului`, `tipuriDocument`,
`listeazaFoi` (filtre și pe `data`), `citesteFoaie` (cu instantaneul vehiculului),
`kmDePlecareSugerat`, `combustibilPeFoi`, `alimentarileFoii`, `anomaliiNeconfirmate`,
`anomaliiPeFoi`, `curseleFoii`, `sabloaneTraseu`, `numeleContului`, plus, pentru portal,
`vehicululMeu` și `foileMele` (filtru explicit pe șofer).

## Ce refuză baza tăcut

Citește secțiunea asta înainte de orice scriere în modul.

- **Un vehicul fără șofer și fără `pool` e invizibil sub `vehicles:read` own/team.**
  Managerul vede, din 0196, mașinile echipei și pool-ul; angajatul, mașina lui și
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
  existent. Ștergerea unui document nu e nici ea o linie ștearsă: `vdoc_dupa` promovează
  automat documentul anterior și mută scadența în `expirables`. Ambele drumuri sunt probate
  în `tests/rls/izolare.sql`, verificarea `(l)`, cu rânduri NUMĂRATE — un UPDATE respins de
  `USING` nu ridică eroare.
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
  dă P0001, în afara contextului de serviciu (seed, importuri). `alocaVehicul` e un singur
  INSERT: triggerul închide singur alocarea precedentă și mută responsabilul din
  `expirables`. Nu există alocări viitoare, iar vânzarea, casarea sau ștergerea vehiculului
  închid alocarea. Proba: `tests/rls/proba-flota-alocari.sql`.
- **Coloane GENERATED ALWAYS pe care clientul nu are voie să le trimită:**
  `trip_sheets.km_parcursi` și `data` (0197), `trip_sheet_curse.km_parcursi`,
  `fuel_entries.pret_litru`, `odometer_anomalies.diferenta`. La fel, `aprobat_de`/
  `aprobat_la`, `confirmat_de`, `numar` și instantaneul vehiculului le scrie baza. — capcana #22
- **O foaie activă pe vehicul și zi** (0197): a doua dă 23505 pe `ts_vehicul_zi_uq`, tradus
  pe `plecare_la`; nu „vehicul cu același număr”.

## Erori traduse și nomenclatorul de documente

În `[[modul/flota/documente-si-erori]]`: P0001 pe câmp, harta separată a alocărilor,
SEDILA din mesajele 0012/0018, tipurile de document active și coloana `numar`.

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

Închiderea și alimentarea (`foi/[id]/actiuni-foaie.tsx`) folosesc `Camp` cu `noValidate`:
regulile pe care baza le refuză oricum se spun în client, pe câmp. Fiecare formular are
erorile și `useTransition`-ul lui, ca o eroare la alimentare să nu înroșească sosirea.

## Ce NU e aici

Mentenanța vehiculelor (plan, intervenții, ITP) e modul separat. Diurna pentru deplasări
e alt modul. Fișa șoferului: `[[modul/angajati]]`.

## Când NU e suficientă pagina asta

- Forma politicilor și a vizibilității vehiculului: migrarea care creează `vehicles`.
- Scadențele centralizate: capcanele #19, #21 și #26, integral, prin
  `node .claude/skills/administrativo/scripts/capcana.mjs --nr 19`.
- Loturile 7g și 7l (legăturile anomaliilor, fișa vehiculului, coada cu șoferul foii): [[strat/navigare]].
