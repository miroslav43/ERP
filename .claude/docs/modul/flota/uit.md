---
tip: modul
titlu: Flotă — codul UIT (RO e-Transport) pe cursele foii (F12f)
aliases: [uit, e-transport, etransport, trip_sheet_uit, e_transport]
cai:
  - "supabase/migrations/0217_flota_uit_etransport.sql"
  - "src/app/(app)/flota/foi/uit/**"
  - "src/app/(app)/flota/foi/[id]/uit-cursa.tsx"
  - "src/app/(app)/flota/foi/[id]/sectiune-curse.tsx"
  - "src/domain/fleet/uit.ts"
  - "src/lib/pdf/foaie-din-date.ts"
  - "tests/rls/proba-flota-uit.sql"
tabele: [trip_sheet_uit, trip_sheet_curse]
permisiuni: [trip_sheets:read, trip_sheets:update]
feature: fleet
capcane: [17, 18, 22, 23]
scris_pe: 97b5acfddbe7d49a15a6f59fb55916822462a40a
scris_la: 2026-10-22
tags: [modul, operations]
---

# Flotă — codul UIT (RO e-Transport) pe cursă

Extinde `[[modul/flota/foaia-zilnica]]`. Migrarea `0217_flota_uit_etransport.sql`.
Aplicația **ține minte** codul UIT primit de șofer, îl **verifică** (format, cifre de
control, valabilitate în ziua foii) și **avertizează** când lipsește. Nu declară nimic
la ANAF, nu verifică online codul și nu transmite GPS: toate cer SPV sau dispozitivul
de poziționare. Niciun text nu spune „conform e-Transport”.

## Modelul

- `trip_sheet_curse.e_transport` (`neaplicabil` / `risc_fiscal_national` /
  `international`): AFIRMAȚIA omului, nu se deduce din bunuri (lista se schimbă prin
  ordin ANAF). Se scrie ca orice câmp al cursei, doar pe ciornă (`curse_inainte`).
- `trip_sheet_uit`: zero sau mai multe coduri pe cursă (grupaj: câte unul pe
  partidă). Unicitate doar pe `(cursa_id, uit)`: același cod apare legal pe mai multe
  curse și foi (vânzare ambulantă, transport de mai multe zile, schimbarea vehiculului).
- `expira_la` e GENERATED (`data_inceput + valabilitate_zile`) = **prima zi
  expirată**, ca `data_exp_uit` de la ANAF. Valabilitatea e în zile (CHECK 1–31);
  formularul oferă 5 și 15. — capcana #22
- `trip_sheet_id` e denormalizat ca RLS-ul să fie copia literală a curselor; îl
  trimite clientul și îl VERIFICĂ triggerul.

## Ce refuză baza

- **Format și cifre de control**: CHECK `tsu_uit_format` prin `app.uit_valid`
  (XSD `UitType` + regula BR-019 din Schematron-ul ANAF). 23514. Baza NU mapează
  literele: „O” trimis dintr-un import e refuzat; maparea O→0 I→1 Z→2 S→5 G→6 B→8 o
  face doar formularul. Normalizează doar majusculele și separatorii.
- **Starea foii**: doar pe ciornă, ca liniile (P0001 „Codurile UIT se modifică doar
  cât foaia de parcurs este ciornă…”). Specificația presupunea și `respins`; F4 a ales
  doar `draft`, deci UIT-ul urmează F4. Nu e tăcut.
- **Identitatea**: `cursa_id`, `trip_sheet_id`, `organization_id` și `uit` nu se
  schimbă prin UPDATE (P0001). Un cod greșit se șterge și se adaugă din nou, ca
  auditul să le arate pe amândouă.
- **Apartenența**: un `organization_id` care nu e al apelantului dă P0001 „Cursa nu
  există în această organizație.”, același mesaj ca o cursă inexistentă — nimic despre
  starea foii altei firme. `super_admin` primește tot P0001 la INSERT (nu e membru).
- **Între colegi** ordinea trigger → `WITH CHECK` scurge doar STAREA foii (P0001 în
  loc de 42501), ca la curse și alimentări.

## Ce refuză baza tăcut

- **UPDATE pe UIT-ul altcuiva** (alt șofer, subordonatul managerului) = **0 rânduri,
  fără eroare** (`USING`). `actualizeazaUit` și `stergeUit` fac `.select()` și tratează
  golul drept CONFLICT. — capcana #17
- **`updated_by` lipsă la UPDATE** = 42501 (`uit_update` îl cere în `WITH CHECK`).
  Acțiunile îl trimit explicit. — capcana #23
- **Embed-ul vehiculului NULL** pe foaia unui șofer (capcana #18): masa e
  necunoscută, deci secțiunea UIT apare (decizia I-f1).

## Cascada

Cursa ștearsă logic (`curse_sterge_uit`) și foaia ștearsă logic (`foi_sterge_uit`:
ciorna ștearsă sau foaia aprobată stornată) își șterg logic codurile, cu `updated_by`
din rândul șters. Pe foaia aprobată garda de stare se ocolește prin GUC-ul local
`app.flota_cascada_uit`, pe care PostgREST nu-l poate seta. Funcțiile sunt SECURITY
DEFINER; pe proiect `postgres` are `rolbypassrls`.

## Cine scrie

| Rol           | Citește                     | Scrie                                     |
| ------------- | --------------------------- | ----------------------------------------- |
| `org_admin`   | toate                       | pe foaia oricui (update = all), pe ciornă |
| `manager`     | foile echipei (read=team)   | doar pe foaia LUI (update = own)          |
| `employee`    | foile proprii               | foile proprii                             |
| `hr`          | nimic                       | nimic (42501)                             |
| `super_admin` | toate (`is_platform_admin`) | nimic (P0001)                             |

Managerul-dispecer NU scrie codul pe foaia șoferului (decizia I-f6); ar cere
`trip_sheets:update = team`, care deschide și cursele și alimentările.

## Acțiuni

`src/app/(app)/flota/foi/uit/actions.ts` (nu `actions-uit.ts`: uneltele recunosc
acțiunile doar după numele `actions.ts`). Toate pe `trip_sheets:update` / own:
`adaugaUit` (`fleet.uit.add`), `actualizeazaUit` (data, valabilitatea, observația;
`fleet.uit.update`), `stergeUit` (logic; `fleet.uit.remove`). Erorile:
`traduEroareUit` din `flota/erori.ts` — separat de `traduEroare`, care ar fi spus
„Există deja un vehicul…” la un UIT dublat. Încadrarea cursei pleacă prin
`adaugaCursa`/`actualizeazaCursa`; la corectură e opțională, ca o casetă fără selector
să nu o rescrie.

## Citiri și ecrane

`uiturileFoii(org, foaie)` și `stareETransportPeFoi(org, foi)` în
`src/lib/queries/fleet.ts`; `curseleFoii` aduce `e_transport`. Coada numără doar
`lipsa_uit`, `uit_expirat`, `uit_neinceput` (nota de prag cere vehiculul); o citire
la plafonul PostgREST dă „?”, nu zero.

`SectiuneCurse` (foaie și portal): coloana „e-Transport” pe cursele unde are sens
(vehicul ≥ 2.500 kg sau masă necunoscută, ori cursă marcată sau cu cod), lista
`UitCursa` cu pastila „Valabil / Expirat din … / Începe pe …”, avertismentele pe rând
și un Callout deasupra. Formularul arată „Am citit: …” la tastare și o notă când data
e departe de ziua foii. Coada `/flota/aprobari`: pastila „e-Transport: N”.

PDF-ul foii (și pachetul lunar, prin `modelFoaieDinDate`): sub cursă, „e-Transport: … ·
UIT: …”, avertismentele sus, iar nota spune că UIT-ul se prezintă împreună cu
documentul care însoțește transportul. Excelul lunar: coloana „UIT” în registrul foilor.

## Probe

`tests/rls/proba-flota-uit.sql`: pozitive pe toate rolurile care scriu, negative pe
format, identitate, stare, roluri și izolare, cascada pe cursă, pe ciornă și pe foaia
aprobată stornată, rânduri NUMĂRATE. `izolare.sql`: fixture pe ambele firme și blocul
`(l) F12f`.

## Ce NU e aici

Declararea la ANAF, confirmarea, verificarea online, lista bunurilor cu risc fiscal,
pragurile de 500 kg / 10.000 lei, GPS-ul, comutatorul per firmă (așteaptă setarea în
`fleet_settings`, decizia I-T1) și sugestia „UIT-uri valabile azi de pe foile tale”.
⚠ De confirmat de contabil: interpretarea „ziua de început se numără” și o eventuală
modificare a OUG 41/2022 după consolidarea din 24.04.2025.
