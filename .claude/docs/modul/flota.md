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
  - "supabase/migrations/0225_flota_costuri_ascunse.sql"
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
    vehicle_costuri,
    vehicle_document_costuri,
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
  - "foaie refuzată cu „Vehiculul ales nu vă este alocat” → [[modul/flota/roluri-si-portal]]; permis, aviz medical, șofer → [[modul/flota/soferi]]; amendă, art. 39, incident, daună → [[modul/flota/amenzi-si-daune]] (acțiunile, citirile, erorile → [[modul/flota/amenzi-actiuni]]; cine conducea, scrisoarea cu CNP, recuperarea → [[modul/flota/amenzi-scrisoarea]]); declarația șoferului din portal, amenzile în rezumatul zilnic și pe fișa vehiculului → [[modul/flota/declaratia-soferului]]"
  - "curse, foaie trimisă, numărul FP, PDF, orele foilor → [[modul/flota/foaia-zilnica]]; plafoanele foii, foaia numerotată, gărzile, ce se mai mișcă pe o foaie trimisă sau aprobată → [[modul/flota/foaia-zilnica-garzi]]; service, costuri, anvelope → [[modul/flota/service-si-costuri]]; rapoarte lunare, Excel, pachet pentru contabil → [[modul/flota/rapoarte]]; Saga, WinMentor, notă contabilă → [[modul/flota/export-contabil]]"
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
| `/flota/aprobari`, `/flota/anomalii`    | `trip_sheets:approve` team; anomaliile: `vehicles:update` team      |
| `/flota/foi/sabloane`                   | `trip_sheets:update` all — șabloanele de traseu (0200)              |
| `/flota/setari`                         | `vehicles:update` all — responsabili, praguri (0201)                |
| `/flota/setari/documente`               | `vehicles:update` all — tipurile de document ale firmei (0202)      |
| `/flota/fiscal`                         | `vehicles:read` all — regimul de deducere, luna fiscală (0205)      |
| `/flota/amenzi`, `/flota/incidente`     | `vehicle_fines`/`vehicle_incidents` read all (0206)                 |
| `/api/export/flota/foaie/[id]`          | `trip_sheets:read` own + RLS — PDF-ul foii (0200)                   |
| `/flota/rapoarte`, `/api/export/flota*` | `vehicles:read` + `trip_sheets:read` all; export: `vehicles:export` |
| `/portal/masina-mea*`                   | modulul (0215: și fără drept pe foi); foile: `trip_sheets:read` own |

Drepturile pe roluri (0199), garda de vehicul alocat sau pool, „aprobatorul doar decide” și
„Mașina mea”: `[[modul/flota/roluri-si-portal]]`. **Șoferii** și permisele (0204):
`[[modul/flota/soferi]]`. **Amenzile și dauna** (0206; scrisoarea de la art. 39 cere și
`employees:read` all, pentru CNP; recuperarea de la șofer NU e automată):
`[[modul/flota/amenzi-si-daune]]`. **Fiscalul** (0205, avantajul în natură e SUGESTIE):
`[[modul/flota/fiscal]]`. Rapoartele lunare, Excelul și pachetul pentru contabil (F8):
`[[modul/flota/rapoarte]]`. **Fișa vehiculului, nomenclatorul firmei și fișierele**
`org-flota`: `[[modul/flota/documente-si-erori]]`.

## Server Actions și citiri

Tabelul acțiunilor din `flota/actions.ts` cu permisiunea și `minScope` fiecăreia,
kilometrajul obligatoriu la creare, `vehicles:delete` inert, citirile din `fleet.ts`,
casetele fără rută (vehicul nou, foaie nouă) și traducerea din `FormData`:
`[[modul/flota/actiuni]]`. Scrierile pe vehicule și documente sunt toate `minScope: "all"`.

## Ce refuză baza tăcut

- **Un vehicul fără șofer și fără `pool` e invizibil sub `vehicles:read` own/team.**
  Managerul vede, din 0199, mașinile echipei și pool-ul; angajatul, mașina lui și
  pool-ul. Pe o foaie de pe o mașină care nu mai e a șoferului, embed-ul
  `vehicles!vehicle_id` vine **NULL, fără eroare**: tipează câmpul `| null` și afișează
  „—". Nu compensa cu `createAdminSupabase`. Caseta „Foaie nouă" devine explicație sau
  link spre parc când lista vine goală. — capcana #18
- **Costurile nu vin cu rândul vehiculului** (0225): valoarea de achiziție și costul
  documentelor stau în tabele 1:1; angajatul, hr-ul și managerul pe pool primesc `null`,
  fără eroare — `[[modul/flota/service-si-costuri]]`.
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
- **Șoferul vehiculului NU se scrie pe `vehicles`** (0173): e derivatul alocării deschise,
  scris direct dă P0001 — `alocaVehicul` și ce închide alocarea: `[[modul/flota/actiuni]]`.
- **Coloane GENERATED ALWAYS pe care clientul nu are voie să le trimită:**
  `trip_sheets.km_parcursi` și `data` (0200), `trip_sheet_curse.km_parcursi`,
  `fuel_entries.pret_litru`, `odometer_anomalies.diferenta`. La fel, `aprobat_de`/
  `aprobat_la`, `confirmat_de`, `numar` și instantaneul vehiculului le scrie baza. — capcana #22
- **Tipul de document se judecă pe setarea FIRMEI, iar fișierul pe folderul entității**
  (0202, P0001): `[[modul/flota/documente-si-erori]]`.
- **O foaie activă pe vehicul și zi** (0200): a doua dă 23505 pe `ts_vehicul_zi_uq`, tradus
  pe `plecare_la`.

## Erori traduse

În `[[modul/flota/documente-si-erori]]`: P0001 pe câmp, hărțile separate (alocări,
setări, tipuri), SEDILA din mesajele 0012/0018.

## Ce se mișcă împreună

Migrarea → `src/types/database.ts` → `src/schemas/fleet.ts` →
`src/lib/queries/fleet.ts` → acțiuni → pagini. Anomaliile de kilometraj și calculul de
consum stau în `src/domain/fleet/`. Traducerea din `FormData` (`valori-vehicul.ts`,
`valori-document.ts`) și cele două capcane tăcute ale ei: `[[modul/flota/actiuni]]`.

## Extensii

- F12a, bon OCR (0213): `[[modul/flota/bon-ocr]]`.
- F12b, carduri (0214): `[[modul/flota/carduri]]`.
- F12c, proces-verbal de predare-primire (0215): `[[modul/flota/proces-verbal]]`.
- F12d, rezervări pe pool (0216): `[[modul/flota/rezervari]]`.
- F12e, unelte de flotă în asistent: `[[modul/asistent/unelte-flota]]`.
- F12f, UIT pe cursă (0217): `[[modul/flota/uit]]`.
- F12g, export contabil (Saga, WinMentor): `[[modul/flota/export-contabil]]`.
- F12h, ieșirea din parc (0218): `[[modul/flota/iesire]]`.

## Ce NU e aici

Utilajele și ISCIR: `[[modul/mentenanta]]`; service-ul vehiculelor e al flotei (0203).
Diurna pentru deplasări e alt modul (vehiculul deplasării: `[[modul/flota/soferi]]`). Fișa
șoferului: `[[modul/angajati]]`.

## Când NU e suficientă pagina asta

- Forma politicilor și a vizibilității vehiculului: migrarea care creează `vehicles`.
- Scadențele centralizate: capcanele #19, #21 și #26, integral, prin
  `node .claude/skills/administrativo/scripts/capcana.mjs --nr 19`.
- Legăturile anomaliilor, fișa vehiculului, coada cu șoferul foii: [[strat/navigare]].
