---
tip: modul
titlu: Flotă — șoferii, permisele și verificările încrucișate
aliases: [driver_licenses, permis de conducere, aviz medical, verificari_soferi, delegatie foaie]
cai:
  - "supabase/migrations/0201_flota_soferi.sql"
  - "src/app/(app)/flota/actions-soferi.ts"
  - "src/app/(app)/flota/permis-sofer.tsx"
  - "src/app/(app)/flota/dialog-permis.tsx"
  - "src/app/(app)/flota/avertismente-sofer.tsx"
  - "src/app/(app)/flota/avertismente-optiuni.ts"
  - "src/app/(app)/flota/foi/[id]/soferul-foii.tsx"
  - "src/app/(app)/flota/foi/[id]/legatura-deplasare.tsx"
  - "src/domain/fleet/soferi.ts"
  - "src/lib/queries/soferi.ts"
  - "src/schemas/soferi.ts"
  - "tests/rls/proba-flota-soferi.sql"
tabele: [driver_licenses, trip_sheets, business_trips, expirables, occupational_health_exams]
permisiuni: [driver_licenses:read, driver_licenses:create, driver_licenses:update, trip_sheets:update]
feature: fleet
capcane: [17, 19, 26]
scris_pe: 231c60b3569e3b9f140ed3b01614d70ad7bbef47
scris_la: 2026-10-12
tags: [modul, operations, hr]
---

# Flotă — șoferii, permisele și verificările încrucișate

Extrasă din `[[modul/flota]]`. Migrarea: `0201_flota_soferi.sql` (planul o numea 0178;
numerele intermediare s-au ocupat). Regula de fond: **avertizează, nu blochează** —
permisul expirat, avizul lipsă, concediul sau contractul încetat nu refuză nicio foaie
și nicio predare.

## Cine ce poate

| Rol         | `driver_licenses`                           |
| ----------- | ------------------------------------------- |
| `org_admin` | read/create/update = all                    |
| `hr`        | read/create/update = all — **fără parc**    |
| `manager`   | read = team                                 |
| `employee`  | read = own                                  |
| super_admin | citește (consola); nu scrie, nu e membru    |

Cheie proprie, nu `vehicles:*`: decizia 3 a planului dă HR-ului permisele și avizele,
nu mașinile și nici foile (proba (10): `hr` vede zero vehicule). Nicio cheie `delete`:
ștergerea e logică, prin `update`. Politicile trec prin `app.ssm_acces` (accesul uniform
pe angajat din 0011). `minScope` e `own` în acțiuni: judecă baza, pe angajat.

## Ce refuză baza

- **Un singur permis activ pe angajat** (`driver_licenses_angajat_uq`, parțial). Reînnoirea
  e UPDATE pe același rând, istoricul e în audit. Al doilea INSERT dă 23505, tradus în
  „modificați-l pe cel existent”.
- **Categoriile**: lista închisă din OUG 195/2002 art. 20 (`internal.categorii_permis`,
  oglindită de `CATEGORII_PERMIS`). Triggerul `internal.permise_inainte` le normalizează
  (`b` → `B`, `tr` → `Tr`), scoate dublurile, le ordonează după lege; una necunoscută dă
  P0001 pe câmpul `categorii`. CHECK-ul are lista scrisă literal: un CHECK cheamă funcția
  cu drepturile celui care scrie, iar `authenticated` n-are EXECUTE pe `internal`.
- **Angajatul altei firme**: cheie străină COMPUSĂ spre `employees (id, organization_id)`
  (23503). Mutarea permisului pe alt om dă P0001.
- `fisier_path` există, nullable, dar n-are încă încărcare (vine cu fișierele din F6).

Scadența intră în `expirables` (`entity_type = 'driver_license'`, responsabil = șoferul),
cu ramură proprie în `app.poate_vedea_expirabil`. Rezumatul zilnic al flotei rămâne pe
`vehicle_document` (lista albă din 0198 nu s-a lărgit).

## Avizul medical — `app.stare_aviz_sofer`

Întoarce doar `apt` / `expirat` / `lipsa`. Rezultatul `inapt*` iese **`lipsa`** (art. 9
GDPR: flota află că nu există aptitudine valabilă, nu de ce). Cu SSM oprit sau pentru cine
nu poate afla starea șoferului: `null`, iar ecranul nu scrie nimic.

## Faptele verificărilor — `public.verificari_soferi`

Prin `.rpc()`, un rând per angajat VIZIBIL (ceilalți lipsesc, fără eroare; plafon 500 de
id-uri). Vizibil = el însuși, cine îi vede foile, cine îi vede permisul, cine
administrează parcul (`internal.poate_vedea_sofer`). Coloanele: concediu aprobat în zi
(`concediu`/`medical` după `leave_types.tip_zi_pontaj`), contract încetat, permis,
aviz, delegație (`null` cu diurna oprită).

**Generatorul de tipuri le dă NON-null** (nu poate deduce nullabilitatea unui `returns
table`); `verificariSoferi` le copiază în `FapteSofer`, care le lărgește la tipul
adevărat. Verdictul (ce mesaj se arată) e în `src/domain/fleet/soferi.ts`, testat în
vitest: categoria cerută de vehicul (masă, locuri), localitatea firmei (`organizations.oras`,
potrivire fără diacritice), etichetele scurte.

## Unde apar

- Fișa angajatului: `PermisSofer` (HR și administratorul scriu prin `DialogPermis`).
- „Mașina mea”: „Permisul meu”, doar citire.
- Foaia (aplicație și portal): `SoferulFoii` — avertismentele + legătura cu deplasarea.
- Fișa vehiculului: avertismentele șoferului de acum; în selectorul de predare și în
  caseta „Foaie nouă”, eticheta scurtă lângă nume (`cuAvertismente`).

## Foaia legată de deplasare

`trip_sheets.business_trip_id`, cu garda SEPARATĂ `internal.foi_deplasare_garda` (aceeași
firmă, același angajat, deplasare neanulată) — nu o ramură în `foi_parcurs_inainte`, pe
care o rescriu și alte faze. Comparațiile `to_jsonb(new) - …` de acolo acoperă coloana:
pe foaia trimisă sau aprobată legătura nu se mai schimbă. `legaDeplasarea` filtrează pe
`status = 'draft'`, deci zero rânduri = CONFLICT. Cu legătură, avertismentul „fără
delegație” tace.

Diurna: `deplasareNouaSchema` primește `vehicle_id`, doar pe `auto_serviciu`/`mixt`
(oglinda lui `business_trips_vehicul_ck`). Corectura (`actualizeazaDeplasare`) nu-l
șterge când formularul nu-l are; îl golește doar când transportul nu mai e cu mașina.

Probă: `tests/rls/proba-flota-soferi.sql` (20) și izolarea `(l)` „permisele șoferilor”.
