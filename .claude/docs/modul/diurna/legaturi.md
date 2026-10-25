---
tip: modul
titlu: Diurnă — ce se mișcă împreună
aliases: [diurna-politica, per_diem_policies, per_diem_valori_legale, diurna-notificari]
cai:
  - "src/app/(app)/diurna/politica/**"
  - "src/app/(app)/diurna/actions.ts"
  - "src/app/(app)/diurna/etichete.ts"
  - "src/lib/queries/per-diem.ts"
  - "supabase/migrations/0060_salarizare_diurna.sql"
  - "supabase/migrations/0147_diurna_valori_legale.sql"
  - "supabase/migrations/0156_diurna_zile_calendaristice.sql"
tabele:
  [
    per_diem_policies,
    per_diem_valori_legale,
    per_diem_country_rates,
    per_diem_calculations,
    countries,
    payroll_entries,
    notifications,
  ]
permisiuni: [per_diem:read, per_diem:update, per_diem:approve]
feature: per_diem
capcane: [14]
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr]
---

# Diurnă — ce se mișcă împreună

Secțiune extrasă din [[modul/diurna]]: politica firmei, valorile legale, calculul zilelor,
drumul spre salarizare și notificările deplasării. Ce refuză baza și rutele rămân în
trunchi; scrierile sunt în [[modul/diurna/actiuni]].

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
calculează din portul TS — capcana #14. Textul „N zile” îl scrie `textZile`, mutat în
`src/lib/format/numar.ts` și re-exportat de `diurna/etichete.ts`: același formator în
previzualizare, în listă și pe decontul tipărit.

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

Politica aplicată se numește pe ecran, nu doar în calcul: previzualizarea din
`/diurna/noua`, fișa deplasării și rândul „fără politică valabilă” din listă o leagă spre
`/diurna/politica`, dar numai pentru cine o poate deschide (`per_diem:update = all`,
judecat prin `poateDeschide` din `src/config/porti-ruta.ts`); fără drept rămâne text
simplu, nu un link care duce la refuz.

Notificările deplasării (din 9 oct 2026, `actions.ts`): la trimitere, `anuntaAprobatorii`
scrie o sarcină (`/diurna/<id>`) managerului direct și administratorilor firmei, fără
expeditor și fără hr; la decizie, `anuntaProprietarul` scrie angajatului rezultatul pe
`/portal/diurna-mea/<id>`. Decizia pe o CHELTUIALĂ îl anunță la fel,
`anuntaDeciziaCheltuielii`, cu suma și — la respingere — cu motivul în corp, fiindcă e
singurul loc în care omul îl citește fără să deschidă fișa; până atunci angajatul vedea
decontul schimbat fără să afle de ce (QA 8 oct 2026, FLX-005). Decizia pe deplasare
închide și sarcinile „de aprobat” rămase deschise (`inchideSarcinileDeAprobat`): fără ele,
contorul de necitite al aprobatorului ținea la nesfârșit o deplasare deja decisă
(MGR-021 / FLX-011) — deplasările n-au `approval_tasks`, deci triggerul generic din
`0192_notificari_fluxuri_lipsa.sql` nu le prinde. Închiderea e deliberat fără `.select()`:
zero rânduri înseamnă că nimeni n-avea notificarea, nu un refuz. Toate prin `service_role`
(politica de INSERT lasă un utilizator să scrie doar pentru sine) și în `try/catch`: un
INSERT picat se loghează, decizia rămâne dată — notificarea e un plus, nu poarta.

## Când NU e suficientă pagina asta

- Ce refuză baza fără să spună, rutele și decontul: [[modul/diurna]].
- Scrierile modulului și vehiculul de serviciu: [[modul/diurna/actiuni]].
- Calculul zilelor și al plafoanelor, cu teste: `src/domain/per-diem/`.
