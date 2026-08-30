---
tip: modul
titlu: Pontaj
aliases: [attendance, prezenta]
cai:
  - "src/app/(app)/pontaj/**"
  - "src/lib/queries/attendance.ts"
  - "src/schemas/attendance.ts"
  - "src/domain/attendance/**"
tabele:
  [
    attendance_periods,
    attendance_entries,
    attendance_settings,
    attendance_approval_batches,
    attendance_week_submissions,
    attendance_week_submission_days,
    puncte_lucru,
  ]
permisiuni: [attendance:read, attendance:create, attendance:update, attendance:approve]
feature: attendance
capcane: [2, 6, 7, 9, 17]
citeste_daca:
  - "buton de aprobare care nu apare → [[rol/manager]]"
  - "tranziție de perioadă respinsă → [[date/pontaj]]"
scris_pe: 3c9747a4f30ad317e7ea4e01fe0a4e778381411e
scris_la: 2026-08-30
tags: [modul, hr]
---

# Pontaj

Evidența zilnică a prezenței, pe perioade lunare care se deschid, se aprobă în loturi și
se blochează. Are trei fluxuri paralele: **ziua** (`attendance_entries`, interval
completat de mână prin `salveazaZiPontaj`), **săptămâna planificată**
(`attendance_week_submissions`, trimisă de angajat și decisă de manager) și
**pontarea rapidă** (`0096_pontaj_rapid.sql` — ceas „Am intrat"/„Am ieșit" sau
confirmarea zilei standard, apăsate din portal, scrise tot în `attendance_entries` cu
`sursa = pontare_rapida`).

## Rute și cine ajunge

| Rută                    | Poartă                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/pontaj`               | `attendance:read` cu scope citit prin `scopeFor`; butoanele cer `create` own/all, `approve` team, `update` all |
| `/pontaj?vizualizare=…` | aceeași poartă; vezi „Cele trei vizualizări" mai jos                                                            |
| `/pontaj/aprobare`      | `attendance:approve` team; blocarea cere `all`                                                                 |
| `/pontaj/perioade`      | `attendance:approve` team/all, `attendance:create` all                                                         |
| `/pontaj/perioade/[id]` | `attendance:read` team                                                                                         |
| `/pontaj/saptamana`     | `attendance:create` own; decizia cere `approve` team                                                           |
| `/pontaj/setari`        | `attendance:update` all; tot de aici se aleg `mod_pontare_rapida` și `verificare_pontare`                      |

Toate trec întâi prin `requireFeature(tenant.organizationId, "attendance")`.

## Cele trei vizualizări ale lui `/pontaj`

`?vizualizare=` cu `saptamana` (IMPLICITĂ, deci absentă din adresă) · `luna` · `lista`.
Enumul și opțiunile stau în `vizualizari.ts`; comutarea folosește primitiva
`ComutatorVizualizare`, deci starea e în adresă și nu se livrează JavaScript pentru ea.

- **`saptamana`** — grila orară a pontajului PROPRIU, `?saptamana=<luni ISO>`. Se pontează
  trăgând peste o zonă dintr-o zi; la eliberare se deschide `CelulaZi` cu intervalul
  precompletat (`oraInceputInitiala`/`oraSfarsitInitiala`, care BAT `intrare`). Fereastra
  e 06:00–22:00, lărgită de `intervalulGrilei` cât să cuprindă orice intrare din afara ei.
  Tragerea e doar cu mausul: pe telefon `touch-action: none` ar bloca derularea paginii,
  deci acolo atingerea deschide dialogul cu intervalul propus — aceeași cale ca tastatura.
- **`luna`** — calendar de 7 coloane cu TOȚI angajații, max 3 pe zi plus „+N alții"
  (citibili prin `sr-only`, nu prin `title`). Server Component pur, needitabil.
- **`lista`** — foaia colectivă, neschimbată.

`luna` și `lista` se hrănesc din ACELEAȘI citiri și se ramifică abia la randare
(`LunaIntreaga` din `page.tsx`); o a doua citire ar fi însemnat două ecrane care pot
arăta lucruri diferite pentru aceeași lună. Aritmetica grilei orare e în
`src/domain/attendance/grila-orara.ts`, cu teste — inclusiv cel purtător: orice tragere
produce un interval pe care `oreleZilei` îl acceptă.

Săptămâna se ancorează în luna din adresă (`an`+`luna`), iar comutatorul completează
cheia care lipsește în cealaltă direcție — altfel comutarea ar sări în altă perioadă
decât cea de pe ecran.

## Server Actions

Toate în `src/app/(app)/pontaj/actions.ts`, cu excepțiile notate.

| Funcție                                           | Permisiune / minScope          | Ce scrie                              |
| ------------------------------------------------- | ------------------------------ | ------------------------------------- |
| `deschidePerioada`                                | `attendance:create` / all      | perioada lunii, status `deschisa`     |
| `salveazaZiPontaj`                                | `attendance:create` / own      | o zi în `attendance_entries`          |
| `pontezaIntrarea`, `pontezaIesirea`               | `attendance:create` / own      | ora de intrare/ieșire pe ziua curentă |
| `confirmaZiuaStandard`                            | `attendance:create` / own      | ziua completă, din setări             |
| `stergeZiPontaj`                                  | `attendance:create` / own      | `deleted_at` pe zi                    |
| `aprobaPontajBloc`                                | `attendance:approve` / team    | lotul + liniile lui închise           |
| `decideZiPontaj`                                  | `attendance:approve` / team    | verdictul pe o zi                     |
| `blocheazaPerioada`, `redeschidePerioada`         | `attendance:approve` / **all** | statusul perioadei                    |
| `sincronizeazaConcediile`                         | `attendance:create` / all      | zilele care vin din concedii aprobate |
| `trimiteSaptamanaPontaj` (`saptamana/actions.ts`) | `attendance:create` / own      | submisia săptămânii                   |
| `decideSaptamanaPontaj` (`saptamana/actions.ts`)  | `attendance:approve` / team    | verdictul pe săptămână                |
| `salveazaSetariPontaj` (`setari/actions.ts`)      | `attendance:update` / all      | `attendance_settings`                 |

Pontarea rapidă — `pontezaIntrarea`, `pontezaIesirea`, `confirmaZiuaStandard` — nu
primește de la client nici ora, nici orele, nici angajatul: schemele ei au un singur
câmp, `cod_punct_lucru`. Ora vine din `ctx.now`, orele se derivă din `configZiDin` +
`oreleZilei`, fișa se rezolvă din sesiune cu `fisaProprie`. Preambulul comun
(`pregatirePontareRapida`) refuză întâi pe `mod_pontare_rapida`, apoi cere codul de pe
afiș dacă `verificare_pontare = cod_qr`. `pontezaIntrarea` e **idempotentă**: a doua
atingere pe o zi deja deschisă întoarce aceeași zi cu `reluare: true`, nu 23505.

`salveazaZiPontaj` rescrie orele pe server pentru orice scope diferit de `all`: cu
interval complet le derivă, iar fără oră de sfârșit le pune **zero**. Cifrele venite
din client sunt păstrate doar de `attendance:create = all`, unde calculul e o sugestie.

## Citiri

`src/lib/queries/attendance.ts`, funcții libere cu `organizationId` primul argument:
`citestePerioada`, `citestePerioadaDupaId`, `listeazaPerioade`,
`listeazaAngajatiPontaj` (cursor keyset, `limita + 1`), `angajatiPontajDupaId`,
`intrariLuna`, `intrariProprii`, `setariPontaj`, `setariPontajComplete`,
`istoricSetariPontaj`, `loturiPerioadei`, `liniiDeAprobat`, `citesteSaptamanaPontaj`,
`saptamaniDeAprobat`, `departamente`.

`setariPontaj` întoarce și `program_start` (nullable), `mod_pontare_rapida` și
`verificare_pontare` — cine adaugă o coloană de setări o adaugă în DOUĂ locuri:
lista de câmpuri a lui `setariPontaj` și `CAMPURI_SETARI_PONTAJ`. Amândouă întorc
versiunea în vigoare la o dată (`valabil_de_la`), iar `null` e o stare normală: firma
n-a configurat nimic și apelantul cade pe valori de rezervă.

**Valoarea de rezervă a pontării rapide e `ceas`, nu `oprit`** — `MOD_PONTARE_IMPLICIT`
din `src/schemas/attendance.ts`, folosită în toate cele patru locuri care cădeau înainte
pe literalul `"oprit"`, dintre care unul e poarta de scriere (`pregatirePontareRapida`).
Implicitul din COD e cel care decide, nu `default`-ul coloanei: două din trei firme n-au
niciun rând în `attendance_settings`, iar `oprit` din al treilea era backfill de
`ALTER TABLE` (0096), nealegerea nimănui. Consecință: butonul „Am intrat" apare pe
ecranul de start fără ca firma să configureze ceva; cine nu-l vrea îl stinge din
`/pontaj/setari`.

## Ce refuză baza tăcut

Secțiunea care justifică pagina. Fiecare rând are artefact.

- **Coloanele calculate de triggere BEFORE nu se trimit din client**:
  `attendance_periods.data_inceput`/`data_sfarsit`/`blocata_la`/`blocata_de`,
  `attendance_entries.period_id` și `tip_zi` când e null. În plus, politicile INSERT
  **cer** `approved_at`/`approved_by`/`batch_id` = NULL,
  `attendance_approval_batches.linii_aprobate` = 0, `attendance_periods.status` =
  `deschisa`. Un INSERT cu doar (organization_id, an, luna) reușește. — capcana #6
- **`.upsert()` cade cu 42P10.** `attendance_entries_zi_uq` e index unic **parțial**
  (`where deleted_at is null`), iar PostgREST nu emite predicatul în `ON CONFLICT`.
  Salvarea unei zile și sincronizarea cu concediile se fac citire-apoi-INSERT-sau-UPDATE.
  — capcana #7
- **Tranzițiile perioadei sunt exact**: `deschisa`→{`in_aprobare`, `blocata`},
  `in_aprobare`→{`deschisa`, `blocata`}, `blocata`→`deschisa`.
  `blocata`→`in_aprobare` ridică P0001. Blocarea și deblocarea cer scope **all** — un
  manager cu `team` primește 42501, deci butonul se ascunde cu
  `can(permisiuni, "attendance:approve", "all")`. — capcana #9
- **Un UPDATE respins de `USING` afectează zero rânduri, fără eroare.** Orice tranziție
  face `.select()` după `.update()` și tratează rezultatul gol drept conflict. — capcana #17
- **Foaia colectivă se paginează după ANGAJAT, nu după rânduri de pontaj.** PostgREST
  trunchiază tăcut peste `max_rows`; angajați × zile depășește pragul altfel. — capcana #2
- **O zi deschisă și neînchisă nu poate fi aprobată**: constrângerea
  `attendance_entries_aprobare_zi_incheiata_ck` (`0096_pontaj_rapid.sql`) cere ca
  `approved_at` să fie null cât timp există `ora_inceput` fără `ora_sfarsit`. 23514 NU e
  tradus de `traduEroare`, iar el ar cădea pe ÎNTREG lotul — de aceea `aprobaPontajBloc`
  filtrează zilele în curs înainte, le numără și întoarce `zileDeschise`. Constrângerea e
  plasa de sub filtru, nu invers; fără ea, „Am ieșit" de după aprobare e respins tăcut de
  `USING`. — capcana #17
- **`intrariProprii` NU filtrează pe `employee_id`** — se bazează pe RLS. Corect pentru
  un `employee`, dar pentru scope `all` (`hr`, `org_admin`) RLS nu îngustează nimic, deci
  funcția întoarce pontajul ÎNTREGII firme. Orice ecran „al meu" trebuie să rezolve fișa
  explicit și să filtreze pe ea: `sectiune-saptamana.tsx` cheamă `fisaMea` + `intrariLuna(org, [fisa], …)`.
  `fisaMea`, nu `idFisaProprie`: `app.current_employee_id()` CERE `is_primary`, în timp ce
  a doua doar sortează după el — de aici starea `fara_principala`, un cont care își vede
  marca și căruia baza îi refuză orice scriere.
- **`oraOptionala` respinge ora brută din Postgres.** Coloana `time` sosește `"08:30:00"`,
  iar schema cere `^([01]\d|2[0-3]):[0-5]\d$`. Cine deschidea o zi cu interval din foaia
  colectivă, schimba doar observația și apăsa „Salvează" primea eroare de validare pe un
  câmp neatins. Normalizarea se face o singură dată, în `intrareaClient`
  (`intrare-client.ts`), care e acum singurul constructor al formei de client — testat în
  `intrare-client.test.ts`, inclusiv perechea brut-respins / normalizat-acceptat.
- **`employee` nu-și poate citi propria fișă cu clientul autentificat**: politica
  `employees_select` (`0005_hr_rls.sql`) nu deschide drumul, deci `fisaProprie` folosește
  `createAdminSupabase()` cu filtru explicit pe `organization_id` și cere
  `is_primary = true`, cerința lui `app.current_employee_id`. Același motiv pentru
  `puncte_lucru`: `puncte_lucru_select` (`0030_onboarding_companie.sql`) cere
  `departments:read`, pe care rolul `employee` nu-l are, deci codul de pe afiș se rezolvă
  tot cu clientul admin, filtrat pe organizație. — `0096_pontaj_rapid.sql`

## Erori traduse

`src/app/(app)/pontaj/erori.ts`, funcția `traduEroare` (tip `never`, întrerupe fluxul
ca un `throw`):

- **23505** → mesaj propriu: ziua există deja pentru angajatul acela.
- **P0001** → mesajul triggerului **se propagă**, trunchiat. Deliberat: mesajele din
  `0013_attendance.sql` conțin cifrele („perioada 08.2026 este blocată"), iar traducerea
  generică le-ar înlocui cu un text fără informație. `error.details` și `error.hint` nu
  se propagă niciodată.

## Ce se mișcă împreună

O schimbare de formă a zilei de pontaj atinge, în ordine: migrarea →
`src/types/database.ts` → `src/schemas/attendance.ts` →
`src/lib/queries/attendance.ts` → `src/app/(app)/pontaj/actions.ts` →
**`intrare-client.ts`** (singurul loc care construiește forma de client, și singurul care
normalizează ora) → `page.tsx` + componenta de celulă. Calculul orelor stă separat, în
`src/domain/attendance/`, cu teste:
`calcul-ore.ts` (`oreleZilei`, inversa `intervalulPropus` și valorile de rezervă din
`configZiDin` — un singur loc, nu patru copii), `grila-orara.ts` (fereastra orară, alinierea la sferturi, poziția blocului — tot ce se
poate greși TĂCUT desenând o săptămână), `ceas.ts` (`stareaCeasului`,
`minuteScurse`, `formatDurata`) și `zi-de-pontat.ts` (`meritaPontata`). Toate sunt pure:
ora curentă vine de la apelant, fiindcă autoritatea ei e ceasul serverului.

O sursă nouă de intrare se adaugă în trei locuri deodată: enumul din migrare,
`SURSE_INTRARE` din `src/schemas/attendance.ts` și `ETICHETE_SURSA` din
`src/app/(app)/pontaj/etichete.ts`.

**Orele se scriu pe ceas, nu zecimal.** Orice durată sau moment din zi trece prin
`formatOre`/`formatOraZi` (`src/lib/format/ore.ts`), iar câmpurile sunt `IntrareOra` și
`IntrareDurata` (`src/components/ui/intrare-ora.tsx`), nu `<input type="time">`. Baza
rămâne zecimală: câmpul ascuns predă `8.5` pentru `8:30`, deci schemele Zod și acțiunile
primesc exact ce primeau. Două efecte vizibile doar la rulare — `parseOre` RESPINGE
zecimalele tastate (`8,5` rămâne marcat greșit, nu devine tăcut `85`), iar o celulă
`peTelefon: "meta"` din `Tabel` trebuie să întoarcă `<span>`, nu `<div>`: sub 768px se
randează într-un `<p>`, iar marcajul nevalid dă eroare de hidratare fără ca ceva să
pară stricat.

Regula după care ies cifrele o scrie în cuvinte `rezumatRegulaPontaj`
(`src/app/(app)/pontaj/etichete.ts`), compusă pe SERVER și trimisă formularului
săptămânii ca `regulaFirmei`: steagul `areSetari` nu se deduce din `config`, iar o firmă
neconfigurată și una configurată pe exact valorile de rezervă ar da altfel același text.
`src/app/(app)/pontaj/etichete.test.ts` leagă textul de `oreleZilei`.

## Ce NU e aici

Concediile (`[[modul/concedii]]` — pontajul doar le sincronizează prin
`sincronizeazaConcediile`), sporurile și agregarea în state de plată
(`[[modul/salarizare]]`), și fișa angajatului (`[[modul/angajati]]`).

Butoanele pontării rapide nu sunt sub `/pontaj`: ecranele stau în
`src/app/(portal)/portal/`, iar afișul cu cod QR și rotirea lui `cod_pontaj` în
`src/app/(app)/puncte-lucru/`. Aici sunt doar acțiunile pe care le apelează și setările
care le pornesc.

## Când NU e suficientă pagina asta

- Calculul efectiv al orelor și al intervalului de noapte: `src/domain/attendance/` și
  `src/app/(app)/pontaj/interval-noapte.ts`.
- Forma exactă a politicilor: migrarea `0013_attendance.sql`, care e și scheletul canonic
  pentru orice migrare nouă.
- Coloanele și tipurile pontării rapide, cu motivele lor: `0096_pontaj_rapid.sql`.
