---
tip: modul
titlu: Flotă — rezervările mașinilor de pool
aliases: [rezervari, vehicle_reservations, rezervare masina, pool, grila de ocupare]
cai:
  - "supabase/migrations/0216_flota_rezervari.sql"
  - "src/domain/fleet/rezervari.ts"
  - "src/schemas/fleet-rezervari.ts"
  - "src/lib/queries/fleet-rezervari.ts"
  - "src/app/(app)/flota/rezervari/**"
  - "src/app/(portal)/portal/masina-mea/rezervari/**"
  - "src/app/(app)/flota/actions-setari.ts"
  - "tests/rls/proba-flota-rezervari.sql"
  - "supabase/migrations/0233_oracol_intre_firme.sql"
  - "tests/rls/proba-oracol-intre-firme.sql"
tabele: [vehicle_reservations, trip_sheets, vehicle_assignments, vehicles, fleet_settings]
permisiuni:
  [
    vehicle_reservations:read,
    vehicle_reservations:create,
    vehicle_reservations:update,
    vehicle_reservations:approve,
  ]
feature: fleet
capcane: [17, 18, 22, 23, 31]
scris_pe: 3760e43cc77bfb934a236ef82ab1475d647c0a11
scris_la: 2026-10-30
tags: [modul, operations]
---

# Flotă — rezervările mașinilor de pool

Extensia F12d a planului „Flotă completă”, din `0216_flota_rezervari.sql` (specificația o
numea 0213). Un angajat rezervă o mașină de pool (`vehicles.pool`) pe ZILE ÎNTREGI, ambele
capete incluse: foaia e „o foaie pe vehicul și zi” (`[[modul/flota/foaia-zilnica]]`), deci
o rezervare pe ore n-ar avea cu ce se potrivi. Alocările: `[[modul/flota]]`.

## Rute și cine ajunge

| Rută                                      | Poartă                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `/flota/rezervari`                        | `vehicle_reservations:read` own; „De aprobat” cu `approve` team         |
| `/flota/rezervari?rezervare=noua&vehicul` | caseta, cu `create` own (`deschisInitial` + `key`); `&de_la=` din grilă |
| `/portal/masina-mea/rezervari`            | `read` own; doar ale mele, fără select de angajat, fără decizii         |
| `/flota/[id]` (secțiunea „Rezervări”)     | doar pe pool și cu `read` own (`sectiune-vehicul.tsx`)                  |
| `/flota/setari` (trei câmpuri)            | `vehicles:update` all, ca restul setărilor (`salveazaSetariFlota`)      |

Matricea din seed: `org_admin` all pe toate patru; `manager` read/approve = team,
create/update = own (își face propria rezervare, nu le scrie pe ale echipei); `employee`
read/create/update = own; `hr` NICIUN rând (decizia 3: HR nu vede parcul).

## Server Actions

`src/app/(app)/flota/rezervari/actions.ts` (numele `actions.ts`, nu `actions-rezervari.ts`).

| Funcție               | Permisiune / minScope                 |
| --------------------- | ------------------------------------- |
| `creeazaRezervare`    | `vehicle_reservations:create` / own   |
| `decideRezervarea`    | `vehicle_reservations:approve` / team |
| `anuleazaRezervarea`  | `vehicle_reservations:update` / own   |
| `scurteazaRezervarea` | `vehicle_reservations:update` / own   |

Sub `all`, `employee_id` trimis = CONFLICT fără drum la bază; fișa proprie se citește prin
RLS (ca `fisaProprieFoaie`), fără client admin. Statusul NU se trimite. Tranzițiile filtrează
pe id + organizație + stare și fac `.select()`: zero rânduri = CONFLICT. Setările
rezervărilor sunt OBLIGATORII în `salveazaSetariFlota` (schema extinsă cu
`campuriSetariRezervari`): un implicit le-ar fi resetat tăcut la o salvare care le omite.

## Citiri

`src/lib/queries/fleet-rezervari.ts`, selecturi literale fără generic explicit (inferența a
prins `employees.full_name` nullable): `listeazaRezervari` și `rezervarileMele` (keyset pe
`de_la desc, id desc`), `rezervariDeAprobat` + `numarRezervariDeAprobat` (ACELAȘI filtru:
`ceruta`, `pana_la >= azi`, fără ale mele — contorul din panou și unealta asistentului),
`rezervarileVehiculului`, `urmatoareleMeleRezervari`, `foileRezervarii`, `vehiculePool`,
`ocupareaPool` și `setarileRezervarilor` (RPC-uri `public.*`).

## Ce refuză baza tăcut sau cu P0001

- **Garda de firmă vine prima** (Y2), înaintea lacătului pe vehicul: în
  `rezervari_inainte`, în `alocari_rezervari` și în `internal.alocari_inainte` (0233,
  primul BEFORE pe `vehicle_assignments`). Rulează înaintea WITH CHECK, deci un rând pus pe
  altă firmă afla din refuzuri dacă vehiculul ei e în pool, ieșit din parc, alocat, cu foaie
  sau din ce zi e rezervat. Acum 42501 neutru, ocolit doar de contextul de serviciu — NU de
  steagul `app.flota_rezervari_sistem`. E scrisă `not coalesce(…, false)`: pe forma fără
  `coalesce`, o rezervare cu `organization_id` lăsat gol trecea pe lângă gardă (comparația cu
  NULL nu ridică), iar NOT NULL se judecă abia după WITH CHECK. Proba:
  `tests/rls/proba-oracol-intre-firme.sql`, verificările (g17) rezervarea pe altă firmă,
  (n7) rezervarea fără firmă, (g18) alocarea, și pozitiva (p8).
- **Statusul îl pune triggerul** (`rezervari_inainte`): `confirmata` fără aprobare sau pentru
  cine are `approve = all` (și rezervarea proprie a administratorului, decizia I-d9),
  altfel `ceruta`. O cerere `ceruta` blochează zilele ca una confirmată (EXCLUDE pe gist).
- **Auto-decizia dă P0001**: `manager_path` conține fișa omului, deci RLS-ul l-ar lăsa.
- **`hr` vede 0 rânduri, fără eroare**; INSERT-ul lui dă 42501. Pagina îi arată
  AccesRestrictionat, iar cardul din „Mașina mea” nu apare.
- **Colegii nu se văd sub `read = own`**: ocuparea vine DOAR prin
  `public.ocuparea_vehiculelor_pool` (intervale, sursa, `a_mea`; `rezervare_id` doar pe ale
  mele; starea doar pe rezervări, NULL pe foi). Fereastra se taie la azi: o perioadă trecută
  dă zero rânduri (trecutul parcului se citește prin RLS). Zero rânduri și pentru cine n-are
  `create`, altă firmă sau modulul oprit.
- **Legătura foaie → rezervare o pune doar baza** (`foi_parcurs_rezervare`, BEFORE pe
  `trip_sheets`, după `foi_parcurs_numerotare`). `trip_sheets.data` e GENERATED, deci NULL în
  BEFORE: ziua se calculează din `plecare_la`. Valoarea din client se ignoră.
- **Conflicte în ambele sensuri, sub lacăt pe vehicul**: rezervare peste o alocare sau peste
  foaia altui șofer → P0001; foaie pe ziua rezervată de altul (și la `respins → draft`) →
  P0001 „Vehiculul este rezervat…” (pe `vehicle_id`); alocare peste rezervarea altuia →
  P0001 cu instrucțiunea de anulare (`alocari_rezervari`, după `alocari_inainte`).
- **Rezervarea obligatorie** (setare, oprită implicit): foaia pe pool fără rezervare
  confirmată → P0001, în afară de `trip_sheets:create = all`.
- **Doar scurtare**, cel mult până azi și nu sub ultima foaie; anularea cu foi → P0001.
  „Foaie” înseamnă cea legată SAU foaia nelegată a omului pe vehicul în zilele rezervării
  (`internal.rezervari_ultima_foaie`): doar `confirmata` leagă, iar foaia făcută cât cererea
  aștepta NU se leagă retroactiv la aprobare. Vehiculul, angajatul, prima zi, scopul,
  detaliile, `id`, `created_at`: imuabile.
- **Fără ștergere din aplicație**: `deleted_at` dă P0001 (și WITH CHECK, a doua plasă).
- **Ieșirea din pool, vânzarea, casarea sau ștergerea vehiculului** anulează rezervările
  viitoare fără foaie (aceeași regulă), cu `warning` (`vehicles_rezervari_la_iesire`).
  Calea de sistem (steagul `app.flota_rezervari_sistem`) scrie fără `updated_by`, ca 0173.
- **Cererea nedecisă după ultima zi** rămâne `ceruta` („Expirată nedecisă”): decizia e
  refuzată, anularea nu; nu mai intră în contor.

Proba: `tests/rls/proba-flota-rezervari.sql` (toate cele cinci roluri; (31) foaia nelegată,
(32) ce NU iese din ocupare),
blocul `(l) F12d` și fixture-ul din `tests/rls/izolare.sql`.

## Notificări

`rezervari_notifica` (AFTER, `entity_type = 'vehicle_reservation'`): cererea → aprobatorii
(`internal.rezervari_aprobatori`: responsabilii din `internal.flota_responsabili` cu `approve
= all` + managerul DIRECT; plasa: membrii cu `approve = all`); decizia, anularea de altcineva
și rezervarea făcută pentru om → angajatul. `/flota/rezervari` se traduce în portal în
`/portal/masina-mea/rezervari`; `?stare=ceruta` rămâne text.

## Ce NU e aici

Rezervarea pe ore, prelungirea, memento-ul din ziua dinainte și anularea automată a cererilor
expirate (cer jobul F5), ramura de rezervare în `app.sofer_la`, coada „De aprobat” în portal
(I-d11: responsabilul care aprobă lucrează în aplicația mare).

## Când NU e suficientă pagina asta

Ordinea exactă a verificărilor: `internal.rezervari_inainte`. ⚠ Contabil: rezervarea nu e
document justificativ fiscal, documentul rămâne foaia. ⚠ Jurist: minimizarea datelor din
rezervări (auditul nu ține scopul și destinația).
