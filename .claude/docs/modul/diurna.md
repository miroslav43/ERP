---
tip: modul
titlu: Diurnă
aliases: [per_diem, deplasari, delegatii]
cai:
  - "src/app/(app)/diurna/**"
  - "src/lib/queries/per-diem.ts"
  - "src/schemas/per-diem.ts"
  - "supabase/migrations/0015_per_diem.sql"
  - "supabase/migrations/0060_salarizare_diurna.sql"
  - "supabase/migrations/0147_diurna_valori_legale.sql"
  - "supabase/migrations/0156_diurna_zile_calendaristice.sql"
tabele:
  [
    business_trips,
    business_trip_legs,
    trip_expenses,
    per_diem_calculations,
    per_diem_policies,
    per_diem_country_rates,
    per_diem_valori_legale,
    countries,
  ]
permisiuni: [per_diem:read, per_diem:create, per_diem:update, per_diem:delete, per_diem:approve]
feature: per_diem
capcane: [14, 16, 17]
citeste_daca:
  - "aprobare respinsă cu 42501 → [[rol/manager]]"
  - "diurnă care nu apare în statul de plată → [[modul/salarizare]]"
scris_pe: 1db8a262e7f998f4096cbe32db00c079103712f3
scris_la: 2026-09-24
tags: [modul, hr]
---

# Diurnă

Deplasări în țară și în străinătate, cu diurna calculată pe **țară și pe zi**, decont de
cheltuieli și o politică a firmei versionată în timp. Modulul își calculează singur
plafonul zilnic și împărțirea impozabil / neimpozabil; salarizarea preia rezultatul, nu-l
reface.

## Rute și cine ajunge

| Rută                    | Poartă                                                            |
| ----------------------- | ----------------------------------------------------------------- |
| `/diurna`               | `per_diem:read` own; scope-ul filtrează lista                     |
| `/diurna/noua`          | `per_diem:create` own; alegerea altui angajat cere `all`          |
| `/diurna/[id]`          | `per_diem:read` own                                               |
| `/diurna/[id]/editeaza` | `per_diem:update` own                                             |
| `/diurna/[id]/decont`   | `per_diem:read` own                                               |
| `/diurna/aprobari`      | `per_diem:approve` team                                           |
| `/diurna/politica`      | `per_diem:read` own ca să vadă; `per_diem:update` all ca să scrie |

Toate trec prin `requireFeature(tenant.organizationId, "per_diem")` — dar pornit în
`Promise.all` alături de `getPermissionMap`, nu înaintea lui, cum arată preambulul
canonic. Poarta rămâne întreagă: `requireFeature` cheamă `notFound()`, iar aruncarea
respinge `Promise.all`-ul înainte să se ajungă la `can()`. Cele două citiri sunt
independente, pe tabele diferite, și toate paginile modulului o fac la fel;
readusă la serial, ordinea „canonică" plătește un dus-întors de rețea în plus, fără să
verifice nimic în plus. Angajatul are și `/portal/diurna-mea`, revalidată de fiecare
acțiune prin `CAI_PORTAL_DIURNA`.

## Server Actions

`src/app/(app)/diurna/actions.ts` — un singur fișier pentru tot modulul.

| Funcție                                                              | Permisiune / minScope     |
| -------------------------------------------------------------------- | ------------------------- |
| `creeazaDeplasare`                                                   | `per_diem:create` / own   |
| `trimiteDeplasare`, `actualizeazaDeplasare`                          | `per_diem:update` / own   |
| `adaugaEtapa`, `stergeEtapa`, `adaugaCheltuiala`, `stergeCheltuiala` | `per_diem:update` / own   |
| `stergeCiornaDeplasare`                                              | `per_diem:delete` / own   |
| `decideDeplasare`, `deconteazaDeplasare`, `decideCheltuiala`         | `per_diem:approve` / team |
| `creeazaPolitica`                                                    | `per_diem:update` / all   |

`creeazaDeplasare` refuză un `employee_id` explicit când scope-ul nu e `all` — o cerere
pentru altcineva se oprește în acțiune, înainte să atingă baza.

`creeazaPolitica` primește **doar ce decide firma**: `diurna_interna_zi`, opțional suma
fixă externă (`diurna_externa_zi` + `moneda_diurna_externa`), `mod_calcul_zile`, pragul unic
`ore_minime`, regula de frontieră, `tarif_km_auto_personal`. Restul le pune acțiunea:
`moneda_tarif_km` = moneda țării interne, `categorie_barem` = `"II"`, ambele praguri de ore =
`ore_minime` (deci `fractiune_zi_partiala` rămâne inoperantă), valorile legale = umplutură,
v. mai jos.

**Ora se citește și se scrie ca ora României.** `plecare_la` și `sosire_la`, la deplasare și
la etapă, trec prin `dataOraRomania` (`src/schemas/comun.ts`); formularele umplu câmpul
invers, cu `oraRomanieiPentruCamp` (`src/lib/format/date.ts`), deci deschis și salvat neatins
reproduce momentul stocat. Înainte, șirul fără fus ajungea neatins în Postgres și era citit
în fusul sesiunii: 15:00 tastat se scria 15:00 UTC și apărea 18:00 pe fișă.

**Refuzurile bazei se întorc pe câmp, nu sub buton.** `adaugaEtapa` traduce P0001-urile lui
`internal.valideaza_etapa_deplasare` în `fieldErrors`: „să se încadreze” pe `plecare_la` +
`sosire_la`, „două țări diferite” pe `to_country_id`. `creeazaPolitica` pune pe
`valabil_de_la` atât 23505 (`per_diem_policies_uk` — o singură versiune pe zi) cât și P0001-ul
valorilor legale. Formularele înroșesc câmpul vinovat și lasă sub buton doar „Corectați
câmpurile marcate”.

## Citiri

`src/lib/queries/per-diem.ts` (marcat `import "server-only"`): `listeazaDeplasari`,
`citesteDeplasare`, `deplasarileMele`, `etapele`, `cheltuielile`, `calculeSalvate`,
`politicaLaData`, `politiciOrganizatie`, `valoriLegaleDiurna`, `tari`, `baremeleTarilor`,
`baremTara`, `angajatiDupaId`.

`valoriLegaleDiurna` NU ia `organizationId` — `per_diem_valori_legale` e nomenclator global,
ca `tari`; o citește `/diurna/politica` ca să arate plafonul pe care firma nu-l alege.

## Ce refuză baza

- **Aprobarea unui manager e respinsă cu 42501.** `business_trips_update` acceptă în
  `USING` ramura de aprobare, dar `WITH CHECK` cere `poate_accesa_deplasare(..., 'update')`
  pe **ambele** ramuri. Rolul `manager` are `per_diem:approve = team` și
  `per_diem:read = team`, dar niciun `per_diem:update` — deci `has_permission` întoarce
  `none` la verificarea de scriere. Merge pentru `org_admin` și `super_admin`, sau după ce
  firma adaugă rândul de `per_diem:update` pe organizație. Identic la `trip_expenses`.
  — capcana #16, v. [[rol/manager]]
- **Fără politică valabilă la data plecării, nu se poate crea nimic.**
  `internal.valideaza_deplasare` cere un rând din `app.per_diem_politica(org, data)` și
  ridică P0001 cu data în mesaj. Politica e versionată: se adaugă un rând nou, nu se
  editează cel vechi.
- **`decontata` și `anulata` sunt terminale.** Orice schimbare de stare din ele ridică
  P0001.
- **După intrarea în aprobare, datele de bază sunt ale aprobatorului.** Modificarea lui
  `plecare_la`, `sosire_la` sau `employee_id` pe o deplasare care nu mai e `ciorna` ori
  `respinsa` cere drept de aprobare — altfel P0001.
- **Politica se datează după lege, nu înaintea ei — iar valorile legale nu se aleg.**
  `internal.aplica_valori_legale_diurna` (`0147_diurna_valori_legale.sql`) caută rândul din
  `per_diem_valori_legale` valabil la `valabil_de_la`; fără el, P0001 cu data în mesaj. Pe
  același trigger `before insert or update`, tăcut: `diurna_baza_legala_interna`,
  `multiplu_plafon_neimpozabil` și `plafon_salarii_baza_luna` trimise din aplicație sunt
  înlocuite cu rândul de lege, fără eroare. Nomenclatorul îl scrie doar administratorul de
  platformă (`app.is_platform_admin()` în INSERT și UPDATE).
- **Vehiculul trebuie să fie al organizației.** P0001, verificat în trigger, nu prin cheie
  străină.
- **Sumă externă fixă în altă monedă decât baremul → calcul incomplet, nu eroare.**
  `app.recalculeaza_diurna` (`0147_diurna_valori_legale.sql`) și oglinda ei TS din
  `src/domain/per-diem/sume.ts` marchează `curs_incomplet` și lasă sumele în lei NULL pe
  toată deplasarea: există un singur `curs_diurna`, iar plafonul rămâne în moneda baremului
  țării. Al doilea curs nu se inventează; ecranul arată un calcul fără sume.
- **Tranzițiile fac `.select()` după `.update()`.** `decideDeplasare` filtrează pe
  `status = "in_aprobare"`, `deconteazaDeplasare` pe `status = "aprobata"`; rezultatul gol
  devine un mesaj de conflict, nu „succes". — capcana #17

Mesajele P0001 ale modulului sunt scrise pentru utilizatorul final, în română, cu cifre
din bază — de aceea `src/app/(app)/diurna/erori.ts` le lasă să treacă pe ecran, tăiate la
300 de caractere, în loc să le înlocuiască cu textul generic.

## Ce se mișcă împreună

**Cum se numără zilele e o alegere a firmei, pe politică** — `mod_calcul_zile`, adăugat de
`0156_diurna_zile_calendaristice.sql`: `ferestre_24h` (câte 24 de ore de la ora plecării,
restul final tăiat de praguri) sau `zile_calendaristice` (fiecare zi din calendar, ora
României, în care omul e pe drum se plătește întreagă, inclusiv ziua plecării și a
întoarcerii). Implicitul coloanei e `ferestre_24h`, deci nicio politică existentă nu-și
schimbă calculul; formularul propune `zile_calendaristice`, iar lista de versiuni arată
alegerea pe coloana „Zilele se numără”. În modul calendaristic `ore_minime` nu mai taie
ultima fereastră, ci doar deplasarea prea scurtă în TOTAL. Motorul e
`app.calculeaza_zile_diurna_calendar`, ales de `app.recalculeaza_diurna` după modul
politicii; oglinda TS e `zileCalendaristice` din `src/domain/per-diem/ferestre.ts`. Cele
două se schimbă împreună: schema `app` nu se poate chema prin `.rpc()`, deci ecranele
calculează din portul TS — capcana #14.

Împărțirea impozabil / neimpozabil se calculează **aici**, în `per_diem_calculations`, unde
se cunosc baremul pe țară și defalcarea zilnică. `0060_salarizare_diurna.sql` o duce în
`payroll_entries.diurna_neimpozabila` și `diurna_impozabila`. Salarizarea **nu** reface
plafonul zilnic; recalculează doar plafonul LUNAR, fiindcă acela se verifică pe cumulul
lunii și pe salariul de bază: două deplasări care separat se încadrează pot împreună să
depășească. — [[modul/salarizare]]

Cât plătește firma și cât e neimpozabil sunt decizii separate: suma în `per_diem_policies`,
plafonul în `per_diem_valori_legale`. Diurna externă are două regimuri —
`diurna_externa_zi` completată = sumă fixă a firmei, în `moneda_diurna_externa`; NULL =
baremul țării × `multiplu_diurna_externa`. Plafonul neimpozabil extern rămâne legat de
baremul ȚĂRII în ambele cazuri, de aici și calculul incomplet când monedele nu coincid.
`/diurna/politica` arată baremurile valabile azi, categoria II, într-un dialog deschis din
textul „baremul țării” (`politica/baremuri-tari.tsx`, pe `DialogPortat` din [[modul/ssm]]).

Regula de frontieră (`per_diem_border_rule`) e o alegere a firmei, nu o valoare legală
implicită: `tara_plecare`, `tara_sosire`, `tara_cu_valoare_mai_mare` sau `durata_maxima`.
Schimbarea ei se face printr-o politică nouă, cu istoric.

`countries`, `per_diem_country_rates` și `per_diem_valori_legale` NU sunt multi-tenant —
sunt nomenclatoare globale. Ultimul e versionat prin `valabil_de_la`: o lege nouă înseamnă
un rând nou acolo, nicio politică de firmă atinsă, iar versiunile deja scrise păstrează
valorile copiate la momentul lor.

## Ce NU e aici

Foaia de parcurs și vehiculul în sine sunt la [[modul/flota]]; diurna doar referă
`vehicle_id`, verificat pe organizație. Plata efectivă și impozitarea intră în
[[modul/salarizare]].

## Când NU e suficientă pagina asta

- Calculul zilelor și al plafoanelor: `src/domain/per-diem/`, cu teste.
- De ce un rol vede lista dar nu poate aproba: [[rol/manager]].
