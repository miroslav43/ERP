---
tip: modul
titlu: Flotă — șoferii, permisele și verificările încrucișate
aliases: [driver_licenses, permis de conducere, aviz medical, verificari_soferi, delegatie foaie]
cai:
  - "supabase/migrations/0204_flota_soferi.sql"
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
permisiuni:
  [
    driver_licenses:read,
    driver_licenses:create,
    driver_licenses:update,
    trip_sheets:update,
    per_diem:read,
  ]
feature: fleet
capcane: [17, 19, 26]
scris_pe: b8fdfaeefdcd1abc6ab449bf02e078fe6b923387
scris_la: 2026-10-21
tags: [modul, operations, hr]
---

# Flotă — șoferii, permisele și verificările încrucișate

Extrasă din `[[modul/flota]]`. Migrarea: `0204_flota_soferi.sql` (planul o numea 0178). Regula de fond: **avertizează, nu blochează** —
permisul expirat, avizul lipsă, concediul sau contractul încetat nu refuză nicio foaie
și nicio predare.

## Cine ce poate

| Rol         | `driver_licenses`                        |
| ----------- | ---------------------------------------- |
| `org_admin` | read/create/update = all                 |
| `hr`        | read/create/update = all — **fără parc** |
| `manager`   | read = team                              |
| `employee`  | read = own                               |
| super_admin | citește (consola); nu scrie, nu e membru |

Cheie proprie, nu `vehicles:*`: decizia 3 a planului dă HR-ului permisele și avizele,
nu mașinile și nici foile (proba (10): `hr` vede zero vehicule). Nicio cheie `delete`:
ștergerea e logică, prin `update`. Politicile trec prin `app.ssm_acces` (0011). `minScope`
e `own` în acțiuni: judecă baza, pe angajat.

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
`vehicle_document` (lista albă din 0201 nu s-a lărgit).

**`app.poate_vedea_expirabil` are DOUĂ rescrieri paralele.** 0204 o rescrie de la 0011 și
adaugă `driver_license`; traseul F7 (service, 0203) o rescrie tot de la 0011 și adaugă
`vehicle_service`. 0204 rulează după 0203, deci forma de aici poartă AMBELE ramuri, iar blocul
de verificare și proba (27) o păzesc: fără ea, scadențele de service ar fi dispărut tăcut din
lista de conformitate. Orice `entity_type` nou pornește de la forma din 0204.

## Avizul medical — `app.stare_aviz_sofer` (SECURITY DEFINER, art. 9 GDPR)

Funcția rulează cu drepturile bazei, deci **judecă singură cine află ce**. Fără asta,
oricine vede foile șoferului ar fi citit starea examenelor medicale ocolind RLS-ul din
`occupational_health_exams` (reparat în 0204 înainte de aplicare, editată pe loc).

Regula (decizia lui Miro, 12 oct): **fără acces SSM pe fișa șoferului, nu primești NIMIC
derivat din aviz** — nici `apt`, nici un semnal generic de tipul „de verificat”, fiindcă și
acela dezvăluie că avizul NU e valabil. Poarta stă ÎNAINTEA citirii și acoperă toate stările.

- **Exact** (`apt` / `expirat` / `lipsa`): doar cine ar fi putut citi rândul prin RLS
  (`app.ssm_acces(org, 'ssm', 'read', angajat)`, aceeași poartă ca politica examenelor), cine
  administrează parcul (`vehicles:update = all`) sau platforma. În seed: `org_admin`, `hr`,
  **managerul propriului om** (`ssm:read = team`, deci îl poate citi oricum), omul însuși
  (`own`). Rezultatul `inapt*` iese **`lipsa`** și pentru ei.
- **`null`** = „nu se știe”, pentru oricine altcineva: de pildă un manager căruia i s-a retras
  `ssm:read`, deși vede foile șoferului. Mai înseamnă SSM oprit sau șofer pe care apelantul nu-l
  vede. `de_verificat` nu mai există nici în bază, nici în `soferi.ts`; domeniul tratează `null`
  (și orice alt text în afară de `expirat` / `lipsa`) ca „fără semnal”, nu ca problemă, iar
  `PermisSofer` nu scrie rândul de aviz.

Proba retrage managerului `ssm:read` printr-o suprascriere pe organizație (`role_permissions`,
scope `none`), o șterge și verifică seed-ul, apoi ramura parcului (`vehicles:update = all`).

## Faptele verificărilor — `public.verificari_soferi`

Prin `.rpc()`, un rând per angajat VIZIBIL (ceilalți lipsesc, fără eroare; plafon 500 de
id-uri). Vizibil = el însuși, cine îi vede foile, cine îi vede permisul, cine
administrează parcul (`internal.poate_vedea_sofer`). Coloanele: absență aprobată în zi
(**doar `absent`**: nici `medical`, nici tipul — CM-ul e dată de sănătate, iar funcția
DEFINER ar fi sărit peste RLS-ul din `leave_requests`), contract încetat, permis, aviz (vezi
mai sus), delegație (vezi mai jos). Avertismentul din UI zice „are o absență aprobată”,
niciodată „concediu medical”.

**Câmpurile permisului** (`permis_exista`, `permis_categorii`, `permis_expira_la`) ies doar
pentru cine ar trece `driver_licenses_select` pe acel angajat (`app.ssm_acces(org,
'driver_licenses', 'read', angajat)` sau platforma): HR, administratorul, managerul echipei,
omul însuși. Cine vede șoferul doar prin foile lui (de pildă un manager căruia i s-a retras
`driver_licenses:read`) primește `null` la toate trei — „nu se știe”, **nu** „fără permis”
(`false` + categorii goale ar fi tot o informație). Absența și contractul încetat rămân
pentru toți cei vizibili (decizia lui Miro).

**Delegația** iese exactă doar pentru cine ar trece `business_trips_select` pe acel angajat
(membru al firmei și `app.poate_accesa_deplasare(org, angajat, 'read')`): administratorul,
managerul cu `per_diem:read = team`, omul însuși. `hr` (fără `per_diem:*`), un manager fără
`per_diem:read` și platforma primesc `null`, ca la diurna oprită: domeniul nu judecă și nu scrie
„fără delegație”.

**Generatorul de tipuri le dă NON-null** (nu deduce nullabilitatea unui `returns table`), deși
`aviz`, delegația și câmpurile permisului pot fi `null`; `verificariSoferi` le copiază în
`FapteSofer`, care le lărgește la tipul adevărat (`null` = „fără semnal” în `avertismenteSofer`).
Verdictul (ce mesaj se arată) e în `src/domain/fleet/soferi.ts`, testat în vitest: categoria
cerută de vehicul (masă, locuri), localitatea firmei (`organizations.oras`, potrivire fără
diacritice), etichetele scurte.

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

Probă: `tests/rls/proba-flota-soferi.sql` ((21)–(26) și (28)–(37) sunt cele de securitate: aviz `null` fără acces SSM, permis `null` fără `driver_licenses:read`, delegație `null` fără citirea deplasărilor, rolurile cu acces primesc exact; (27) păzește ramura `vehicle_service`) și izolarea `(l)` „permisele șoferilor”.
