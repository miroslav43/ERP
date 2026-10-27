---
tip: modul
titlu: Flotă — exportul costurilor pentru contabilitate, Saga și WinMentor (F12g)
aliases:
  [export contabil, saga, winmentor, nota contabila flota, articole contabile, dbf, jurnal costuri]
cai:
  - "src/domain/fleet/contabil/**"
  - "src/lib/unelte/dbf.ts"
  - "src/schemas/fleet-contabil.ts"
  - "src/lib/queries/fleet-contabil.ts"
  - "src/app/api/export/flota/contabil/**"
  - "src/app/api/export/flota/pachet/route.ts"
  - "src/app/(app)/flota/rapoarte/export-contabil.tsx"
  - "tests/rls/proba-flota-export-contabil.sql"
  - "supabase/migrations/0225_flota_costuri_ascunse.sql"
tabele:
  [
    fuel_entries,
    trip_sheets,
    vehicle_expenses,
    vehicle_service_entries,
    vehicle_fiscal_regimes,
    fuel_card_transactions,
    organizations,
  ]
permisiuni: [vehicles:export, vehicles:read, trip_sheets:read]
feature: fleet
capcane: [2, 18]
scris_pe: 773c1627da87c388355631aa7419448022014599
scris_la: 2026-10-27
tags: [modul, operations]
---

# Flotă — exportul costurilor pentru contabilitate (F12g)

Extinde `[[modul/flota/rapoarte]]`. **Fără migrare, fără chei noi, nu scrie nimic în
bază** (nici audit, nici număr de registru, nici setări). Exportul PROPUNE articole
contabile; contabilul le importă. Formatele Saga și WinMentor sunt **verificate pe
documentația producătorilor, neîncercate într-un import real** (decizia B4): eticheta
stă în casetă și în `CITESTE-MA.txt` din fiecare arhivă.

## Ruta și poarta

`GET /api/export/flota/contabil?luna=AAAA-LL&format=…`, din caseta „Export pentru
contabilitate” de pe `/flota/rapoarte` (`export-contabil.tsx`, formular GET).

- `vehicles:export` la `all` → altfel 403. Apoi `vehicles:read` + `trip_sheets:read` la
  `all` (`poateVedeaRapoarte`) → altfel 403 cu motivul „nota ar ieși incompletă”.
  Butonul lipsește pentru ceilalți (`poateExportaFlota`, pe server).
- Configurarea invalidă (cont `60 22`, lună viitoare, format necunoscut, virgulă ȘI ca
  separator ȘI ca zecimale) → **400 cu motivele**, nu implicite (L17). Luna fără niciun
  cost → 404. O cotă de TVA necunoscută (document dinainte de 2017) → 409, fără fișier.
- `resolveTenant`, nu `requireTenant`: descărcarea răspunde cu cod, nu cu redirecționare.

## Formatele

| `format`       | Ce iese                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `jurnal_csv`   | un rând per cost, cu „intră în notă / motiv”; la final totalurile și maparea conturilor                  |
| `articole_csv` | `Data;Nr. doc;Cont debit;Cont credit;Suma;Explicatie` (ecranul Saga „Articole contabile”)                |
| `winmentor`    | ZIP: `NoteContabile.txt` (INI, `NOTA CONTABILA`), `Partner.txt` dacă e cazul, `de-verificat.csv`         |
| `saga`         | ZIP: `F_<cui>_<nr>_<ZZ.LL.AAAA>.xml` (bon cu cod fiscal), `P_<data>.xml`, `NC_….dbf`, `de-verificat.csv` |

Pachetul lunar (`/api/export/flota/pachet`) primește și jurnalul, cu conturile
`CONFIGURARE_IMPLICITA` marcate „propuse” (implicita I-g7); pe un vehicul ales, doar
costurile lui. Fișierele de import NU intră în pachet.

## Ce intră în note și ce nu

Modelul e pur (`construiesteArticole`, `src/domain/fleet/contabil/articole.ts`); jurnalul
arată și ce n-a intrat, cu motivul:

- sumă zero; foaia ștearsă; **factura de service** (vine prin SPV, Saga o importă
  singur: `include_service = nu` implicit, L4); **alimentarea legată de o tranzacție de
  card** (`fuel_card_transactions.fuel_entry_id`, potrivită sau cu diferență: factura
  emitentului vine prin SPV, I-T4 — bate și `doar_aprobate = nu`); foaia neaprobată
  (implicit doar `aprobat`, L6). Bifele da/nu sunt **radio**: un checkbox nebifat ar fi
  lipsit din cerere și ar fi însemnat „da”.
- TVA-ul se separă pe bani întregi (L8): `baza = round(total/(1+cota))`; la `limitat_50`
  deductibilul e `floor(tva/2)`, nedeductibilul e mereu articol separat (pe cheltuială
  sau pe 635). Σ articole = total, verificat pe 10.000 de valori. Cota după dată:
  19% din 2017, 21% din 01.08.2025 (`cote-tva.ts`).
- Regimul (L11): F10 la data liniei → masa > 3.500 kg ⇒ integral → `regim_implicit`
  (`limitat_50`), cu avertisment care numește vehiculele.
- **Bonul fără CUI-ul stației** (`cui_statie` NULL, F12a) nu primește TVA deductibil
  (proxy L13/D4 ⚠). Cheltuielile și service-ul n-au câmp de CUI: TVA-ul lor se separă
  ca deductibil, cu avertisment. În Saga, doar bonul cu CUI devine XML; restul merge în
  DBF. Firma neplătitoare de TVA: un articol pe linie, fără XML.
- Avertismente fixe: alimentările din străinătate nu se disting (D12), bonul cu factură
  cerută s-ar dubla, `platitor_tva` e starea de azi; plus număr repetat în aceeași zi.

## Ce refuză baza tăcut

- **La `team`, exportul ar ieși PARȚIAL, fără eroare.** Proba (4): managerul vede 2
  alimentări din 4, 2 vehicule din 3, **zero tranzacții de card** (`tranzactii_card_select`
  cere `vehicles:read = all`) și **zero regimuri** (`vehicle_fiscal_regimes_select`, tot
  `all`): bonul plătit cu cardul ar fi intrat în note, iar TVA-ul s-ar fi dedus cu regimul
  implicit. Cheltuielile și intervențiile se adaugă la pierdere: `vex_select`/`vse_select`
  cer `app.poate_vedea_costurile_vehiculului`, iar la `team` vehiculele din **pool** rămân
  afară chiar alocate echipei (forma e fixată de `0225` §9). — capcana #18
- **`max_rows = 1000`**: toate citirile trec prin `citesteTot` (keyset pe `id`), iar
  legăturile cu cardul și regimurile se cer în felii de 200 de id-uri. — capcana #2
- **Luna se taie în ora României** pe `alimentat_la` (timestamptz): o fereastră în UTC
  ar fi luat alimentarea din prima zi a lunii următoare, la 00:30 (proba (2): 5 în loc
  de 4). Cheltuielile și service-ul au `date`, deci se taie pe zile.
- **Tranzacția de card se leagă după `fuel_entry_id`, nu după luna ei**: una din 31,
  23:50 poate fi a unei alimentări din ziua 1 (proba (3)).
- Vehiculul șters logic: din 0199, `vehicule_select` nu filtrează `deleted_at`, nici
  `vex_select`/`vse_select` (din 0203 §7, pe `app.poate_vedea_costurile_vehiculului`), așa
  că costurile lui intră (au existat). Numărul vine din instantaneul foii (`vehicul_nr`), apoi din vehicul;
  un embed NULL dă „vehicul necunoscut”, nu o excepție (testul pe clientul fals).
- Din `employees` se ia DOAR `full_name` (D11), și doar în jurnal: explicațiile care
  intră în programul de contabilitate nu poartă numele șoferului.

## Presupuneri ⚠ (de reglat la acceptanță, D7)

Toate stau în constante, câte un fișier per format: `FORMAT_DATA_SAGA` (ZZ.LL.AAAA),
`FORMAT_PARTENER_WM` (CUI fără `RO`), `JURNAL_CUMPARARI_WM`, punctul zecimal și CRLF în
WinMentor, structura DBF (askit.ro, 2020; importul DBF după Saga 598 e neconfirmat,
R10 — `articole_csv` e calea de rezervă). Textul care intră în programul de contabilitate
e ASCII (`inAscii`, L7): codificarea așteptată nu e documentată. Conturile implicite
(`configurare.ts`) sunt toate ⚠ de confirmat de contabil.

## Ce se mișcă împreună

`linii.ts` (forma comună + cartografierile `satisfies Record<Enum, …>`) → `articole.ts`
→ `format-*.ts` → `fisiere.ts` (ce fișiere ies) → ruta (ZIP cu `jszip`). Schema
(`fleet-contabil.ts`) dă și `configurareDinCerere`; caseta o folosește ca să valideze
memoria din browser (`localStorage`, per firmă, în `try/catch`).

## Ce NU e aici

Persistența conturilor în bază (D1 b: o migrare nouă, doar după acceptanță), factura de
intrare WinMentor (cere coduri de articol, L3), Saga WEB, amenzile (F11) pe 6581,
registrul de documente (L16). Acceptanța cu un contabil, într-o bază de test Saga și
WinMentor, NU s-a făcut: se notează aici ce a mers și ce s-a corectat în constante.

**Cheltuiala plătită cu cardul de flotă NU se recunoaște.** 0214 nu are
`vehicle_expense_id` (I-b4), deci singura excludere pe card e alimentarea legată prin
`fuel_entry_id`. O spălătorie, o taxă sau un „combustibil fără foaie” trecute de mână la
cheltuieli și facturate și de emitentul cardului (tranzacțiile `necombustibil` /
`fara_foaie`) intră în note de două ori, fără avertisment. Se schimbă doar cu D-b4.

## Când NU e suficientă pagina asta

Specificația: `f12-plan/F12g.md` (faptele E1–E24, deciziile L1–L18, D1–D12). Testele:
`src/domain/fleet/contabil/*.test.ts` (fișierul de aur WinMentor, DBF dus-întors),
`fleet-contabil.test.ts`, `contabil/route.test.ts`, `export-contabil.test.tsx`; proba
`tests/rls/proba-flota-export-contabil.sql`.
