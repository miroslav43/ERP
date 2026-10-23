---
tip: modul
titlu: Flotă — cardurile de combustibil și extrasele lor
aliases:
  [
    fuel_cards,
    fuel_card_transactions,
    card de combustibil,
    card de flotă,
    extras de card,
    import extras,
    potrivirea tranzacțiilor,
    nepotriviri,
  ]
cai:
  - "supabase/migrations/0214_flota_carduri_combustibil.sql"
  - "src/app/(app)/flota/carduri/**"
  - "src/app/api/export/flota/carduri/**"
  - "src/domain/fleet/carduri/**"
  - "src/lib/queries/fleet-carduri.ts"
  - "src/schemas/fleet-carduri.ts"
  - "src/lib/import/csv.ts"
  - "tests/rls/proba-flota-carduri.sql"
  - "src/lib/import/incarcare.ts"
tabele:
  [
    fuel_cards,
    fuel_card_import_profiles,
    fuel_card_imports,
    fuel_card_transactions,
    import_uploads,
    expirables,
    fuel_entries,
    trip_sheets,
  ]
permisiuni: [vehicles:read, vehicles:create, vehicles:update]
feature: fleet
capcane: [7, 18, 19, 23, 26]
scris_pe: 0e303a1085113be87dbcbe9a9e7c0afd49aca517
scris_la: 2026-10-22
tags: [modul, operations]
---

# Flotă — cardurile de combustibil și extrasele lor

Extrasă din `[[modul/flota]]` (extensia F12b). Migrarea: `0214_flota_carduri_combustibil.sql`
(specificația o numea `0211`; traseele F12 s-au mutat după integrarea mentenanței). Regula
de fond: **extrasul compară, nu rescrie**. Tranzacțiile stau în registrul lor; nimic nu se
scrie în `fuel_entries` și nicio foaie aprobată nu se atinge.

## Rute și cine ajunge

| Rută                        | Poartă                                                          |
| --------------------------- | --------------------------------------------------------------- |
| `/flota/carduri`            | `vehicles:read` team; creare `vehicles:create` all              |
| `/flota/carduri/import`     | `vehicles:create` all ȘI `vehicles:update` all                  |
| `/flota/carduri/tranzactii` | `vehicles:update` all ȘI `vehicles:read` all                    |
| `/api/export/flota/carduri` | ca tranzacțiile; `?luna=AAAA-LL` obligatoriu — CSV anti-formulă |

Fără chei noi de permisiune: cardul urmează drepturile vehiculelor. Lista o vede și
managerul (cardurile echipei, ale pool-ului), dar NU tranzacțiile.

## Server Actions

| Fișier                                | Funcții                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `flota/carduri/actions.ts`            | `creeazaCard` (create/all); `actualizeazaCard`, `stergeCard` (update/all)                                                                      |
| `flota/carduri/import/actions.ts`     | `pregatesteIncarcareaExtrasului`, `analizeazaExtras` (create/all); `salveazaProfilImport`, `aplicaImportExtras`, `anuleazaImport` (update/all) |
| `flota/carduri/tranzactii/actions.ts` | `repotrivesteTranzactii`, `leagaTranzactie`, `ignoraTranzactie` (update/all)                                                                   |

Importul urmează tiparul celui de angajați: URL semnat → analiza (citește, potrivește,
urcă lotul JSON, NU scrie în bază) → aplicarea în felii, cu potrivirea RECALCULATĂ pe datele
de atunci. Sursa (cu numere întregi de card) se șterge la PRIMA analiză, cu clientul admin;
o re-analiză după pasul de mapare re-urcă fișierul cu alt `batchId`. Calea:
`{org}/vehicles/{batchId}/…` (`prefixExtrasCard`, `src/lib/documents/cale.ts`).

**Lotul e emis de server** (X2, `import_uploads` din 0226, `src/lib/import/incarcare.ts`):
pregătirea înregistrează `batchId` și calea ÎNAINTEA URL-ului semnat; analiza consumă rândul
(o dată, doar creatorul, doar pe calea înregistrată, UPDATE cu `.select()`) și abia apoi
șterge; aplicarea cere un lot al apelantului deja analizat. Prefixul singur nu ajungea: un
`batchId` egal cu id-ul unui vehicul ștergea orice .csv/.xlsx din folderul lui. Importul de
angajați are aceeași poartă, pe `employees`.

## Citiri

`src/lib/queries/fleet-carduri.ts`: lista cardurilor (embed-uri `| null`), contextul
potrivirii pe perioadă, cheile deja importate, tranzacțiile lunii (keyset pe `efectuat_la`),
sumarul pe stări, candidații de legare. Citirile care alimentează potrivirea numără și
**refuză la plafonul `max_rows`** în loc să taie: o potrivire pe o parte din foi ar
declara „fără foaie” tranzacții care au foaie.

Potrivirea e o funcție pură, `src/domain/fleet/carduri/potrivire.ts`: storno → card (amprentă,
altfel cifre pe SUFIX) → vehicul (numărul din extras bate cardul) → necombustibil → foaia
zilei → alimentarea (bonul egal bate litrii; toleranțe constante). Din 0218 (I-h2), numărul
unui vehicul ieșit se poate pune pe o mașină nouă: același număr pe două vehicule neșterse
merge la cel care îl purta în ziua tranzacției (ieșit în ziua aceea sau după ea, altfel cel
din parc), după `vehicles.data_iesire` din context.

## Ce refuză baza tăcut

- **Tranzacțiile le vede doar `vehicles:read = all`** (implicita I-b3). Managerul și
  șoferul primesc **zero rânduri, fără eroare**, chiar pe foaia lor. Cardul îl văd.
- **Semaforul cardului se calculează din `fuel_cards.valabil_pana`**, nu din `expirables`:
  acolo politica cere și `compliance:read`. — capcanele #19, #26
- **Un UPDATE respins de USING atinge zero rânduri** (manager pe un card, altă firmă):
  fiecare acțiune face `.select()` și tratează golul drept CONFLICT.
- **Datele din extras sunt imuabile** după import (P0001); se schimbă doar legătura,
  starea, nota, categoria. Extrasul greșit se ANULEAZĂ (`anuleazaImport`: tranzacțiile,
  apoi lotul), abia apoi se reimportă: indexul de dedup e parțial pe `deleted_at is null`.
- **`fctx_alimentare_uq` se judecă la fiecare UPDATE/INSERT, nu la final**: repotrivirea
  merge după oră, importul după ordinea din fișier, deci alimentarea poate trece la alt
  rând. `repotrivesteTranzactii` o ELIBEREAZĂ întâi (altfel 23505 la fiecare reîncercare);
  importul care o găsește legată între timp scrie tranzacția „fără alimentare”, nu o
  numără tăcut ca duplicat (doar `fctx_dedup_uq` e duplicat).
- **Repotrivirea e ATOMICĂ** (X2): toată lista de scrieri pleacă într-un singur
  `rpc("repotriveste_tranzactii_card")` (0214 §11b, INVOKER, în ordinea dată, doar coloanele
  potrivirii). Un rând refuzat (anulat între timp, 23505) derulează tot: luna rămâne cum era,
  nu pe jumătate „fără alimentare”.
- **O celulă peste tipul coloanei** (km în `integer`, preț în `numeric(12,4)`, valoare în
  `numeric(14,2)`) ar trece de previzualizare și ar pica felia întreagă pe 22003: analiza
  golește km-ul și prețul și respinge rândul cu valoare absurdă.
- **`ignorata` cere notă** (sau stornoul din extras), iar starea și legătura merg împreună
  (`fctx_stare_ck`, 23514). Foaia și vehiculul le pune triggerul din alimentare, nu clientul.
- **Numărul cardului nu se schimbă** după înregistrare (P0001): alt număr e alt card.
- **Vehiculul vândut, casat sau șters scoate scadența cardului** din `expirables`, prin
  `vehicles_carduri_resincronizeaza`; un card nou pe el e refuzat (P0001).
- **Profilul de import nu se face cu `.upsert()`**: indexul unic e parțial (42P10), deci
  citire, apoi UPDATE sau INSERT. — capcana #7
- `created_by`/`updated_by` sunt cerute nominal de `WITH CHECK`; acțiunile le trimit. — capcana #23

## Erori traduse

`flota/carduri/erori.ts` (`traduEroareCarduri`): 23505 pe `fcard_amprenta_uq`,
`fctx_dedup_uq`, `fctx_alimentare_uq`, `fcip_org_emitent_uq`, plus P0001 pe câmp
(`tinta`, `numar`, `nota`, `fuel_entry_id`). `flota/erori.ts` nu se atinge.

## Ce se mișcă împreună

Migrarea → `database.ts` → `schemas/fleet-carduri.ts` → `queries/fleet-carduri.ts` →
acțiuni → pagini. `app.poate_vedea_expirabil` (ramura `fuel_card`) și lista albă din
`internal.flota_rezumat` (forma 0203, notificarea duce la `/flota/carduri?card=<id>`) se
rescriu INTEGRAL de la forma ultimă: F12h le rescrie din nou după 0214 și caută ramura.
Pragurile din `/flota/setari` se oglindesc și pentru carduri (`flota_setari_praguri`).
`valori-card.ts` e singura traducere `FormData` → acțiune (ținta e un singur câmp).

## Ce NU e aici

Până la răspunsul lui Miro: „Adaugă pe foaie” ([DECIZIA-2c]), tranzacțiile pe foaia
șoferului ([DECIZIA-3b]), „Trece la cheltuieli” și `vehicle_expense_id` ([DECIZIA-4c]).
Fără conversie valutară, fără API cu emitenții, fără istoricul atribuirilor cardului.
Presetările emitenților sunt NECALIBRATE: primul extras real le corectează.

## Când NU e suficientă pagina asta

- Forma exactă a politicilor și a triggerelor: migrarea 0214.
- Ce poate scrie fiecare rol, cu rânduri numărate: `tests/rls/proba-flota-carduri.sql`.
- Valorile ⚠ (retenția extraselor, extrasul ca document de deducere): `NOTES.md`.
