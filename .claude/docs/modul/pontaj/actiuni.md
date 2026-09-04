---
tip: modul
titlu: Pontaj — acțiuni și citiri
aliases: [pontaj-actiuni]
cai:
  - "src/app/(app)/pontaj/**/actions.ts"
  - "src/lib/queries/attendance.ts"
  - "src/schemas/attendance.ts"
  - "src/domain/attendance/**"
tabele: [attendance_entries, attendance_periods, attendance_approval_batches]
permisiuni: [attendance:read, attendance:create, attendance:update, attendance:approve]
feature: attendance
capcane: [2, 6, 7, 17]
scris_pe: 00e37653eadf3e9d2827de0ebf88e9a043eec856
scris_la: 2026-09-04
tags: [modul, hr]
---

# Pontaj — acțiuni și citiri

Secțiune extrasă din [[modul/pontaj]]: „Server Actions” trecuse de 40 de rânduri,
ceea ce convenția vault-ului tratează ca o condiție de spargere.

## Server Actions

Toate în `src/app/(app)/pontaj/actions.ts`, cu excepțiile notate.

| Funcție                                           | Permisiune / minScope          | Ce scrie                                |
| ------------------------------------------------- | ------------------------------ | --------------------------------------- |
| `deschidePerioada`                                | `attendance:create` / all      | perioada lunii, status `deschisa`       |
| `salveazaZiPontaj`                                | `attendance:create` / own      | o zi în `attendance_entries`            |
| `pontezaIntrarea`, `pontezaIesirea`               | `attendance:create` / own      | ora de intrare/ieșire pe ziua curentă   |
| `confirmaZiuaStandard`                            | `attendance:create` / own      | ziua completă, din setări               |
| `stergeZiPontaj`                                  | `attendance:create` / own      | `deleted_at` pe zi                      |
| `aprobaPontajBloc`                                | `attendance:approve` / team    | lotul + liniile lui închise             |
| `decideZiPontaj`                                  | `attendance:approve` / team    | verdictul pe o zi                       |
| `blocheazaPerioada`, `redeschidePerioada`         | `attendance:approve` / **all** | statusul perioadei                      |
| `sincronizeazaConcediile`                         | `attendance:create` / all      | zilele care vin din concedii aprobate   |
| `trimiteSaptamanaPontaj` (`saptamana/actions.ts`) | `attendance:create` / own      | submisia săptămânii                     |
| `decideSaptamanaPontaj` (`saptamana/actions.ts`)  | `attendance:approve` / team    | verdictul pe săptămână                  |
| `salveazaSetariPontaj` (`setari/actions.ts`)      | `attendance:update` / all      | `attendance_settings` (versiune nouă)   |
| `salveazaPontareaRapida` (`setari/actions.ts`)    | `attendance:update` / all      | `setari_pontare_rapida` (un rând/firmă) |

Pontarea rapidă — `pontezaIntrarea`, `pontezaIesirea`, `confirmaZiuaStandard` — nu
primește de la client nici ora, nici orele, nici angajatul: schemele ei au un singur
câmp, `cod_punct_lucru`. Ora vine din `ctx.now`, orele se derivă din `configZiDin` +
`oreleZilei`, fișa se rezolvă din sesiune cu `fisaProprie`. Preambulul comun
(`pregatirePontareRapida`) refuză întâi pe `mod_pontare_rapida`, apoi decide ce face cu
codul prin `cumSeTrateazaCodul`. `pontezaIntrarea` e **idempotentă**: a doua atingere pe
o zi deja deschisă întoarce aceeași zi cu `reluare: true`, nu 23505.

Cele trei acțiuni de DECIZIE — `aprobaPontajBloc`, `decideZiPontaj`,
`decideSaptamanaPontaj` — cheamă întâi `refuzaCandAprobareaEStinsa`
(`aprobarea-firmei.ts`). Ascunderea filei „Aprobare" e cosmetică: ruta rămâne validă,
un ecran deschis dinainte are încă butoanele randate, iar o Server Action e un punct de
rețea. Regula NU se poate scrie ca politică RLS — ar cere un subselect peste altă tabelă
în `with check`, iar refuzul ar deveni un UPDATE cu zero rânduri, adică tăcut.

`salveazaZiPontaj` rescrie orele pe server pentru orice scope diferit de `all`: cu
interval complet le derivă, iar fără oră de sfârșit le pune **zero**. Cifrele venite
din client sunt păstrate doar de `attendance:create = all`, unde calculul e o sugestie.

`trimiteSaptamanaPontaj` citește `p_lucreaza_weekend` din `attendance_settings`, NU din
formular — câmpul a plecat din `trimiteSaptamanaPontajSchema`. Steagul se salvează pe
submisie fiindcă aprobatorul trebuie să vadă ce regulă era ATUNCI, dar regula e a firmei:
venind de la client, o cerere fabricată putea declara „aici se lucrează în weekend" la o
firmă de birou. Caseta din formular a rămas ce a fost mereu în fapt — alege dacă zilele de
weekend pleacă cu interval (`intervalDeTrimis`). **Atenție**: `createAction` primește
`rawInput: unknown`, deci un câmp rămas într-un apelant NU produce eroare de tip; Zod îl
taie tăcut. Câmpurile scoase din scheme se caută de mână prin apelanți.

## Citiri

`src/lib/queries/attendance.ts`, funcții libere cu `organizationId` primul argument:
`citestePerioada`, `citestePerioadaDupaId`, `listeazaPerioade`,
`listeazaAngajatiPontaj` (cursor keyset, `limita + 1`), `angajatiPontajDupaId`,
`intrariLuna`, `intrariProprii`, `zilePontateAngajat`, `setariPontaj`,
`setariPontajComplete`, `istoricSetariPontaj`, `loturiPerioadei`, `liniiDeAprobat`,
`citesteSaptamanaPontaj`, `saptamaniDeAprobat`, `departamente`, `setariPontareRapida`,
`afiseDePontare`.

`zilePontateAngajat` e singura care cere explicit `employee_id` și n-are cursor: aduce
dintr-un drum reuniunea celor trei ferestre de care are nevoie verificarea limitelor
(săptămâna, ziua dinainte, perioada de referință) și le taie în TypeScript. Filtrul pe
angajat NU e opțional acolo — pentru scope `all` RLS nu îngustează nimic, iar media s-ar
calcula pe orele întregii firme. Nu poate fi trunchiată de `max_rows`, fiindcă
`attendance_entries_zi_uq` garantează cel mult un rând pe angajat pe zi: sub 380 de
rânduri chiar la o perioadă de referință de 12 luni.

`setariPontaj` întoarce DOAR parametrii juridici (cele trei câmpuri de pontare rapidă
au plecat în 0115) — cine adaugă o coloană de setări o adaugă în DOUĂ locuri:
lista de câmpuri a lui `setariPontaj` și `CAMPURI_SETARI_PONTAJ`. Amândouă întorc
versiunea în vigoare la o dată (`valabil_de_la`), iar `null` e o stare normală: firma
n-a configurat nimic și apelantul cade pe valori de rezervă.

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

`tip_prezenta` a trecut prin exact lanțul ăsta în 0118, plus `plan-si-fapt.ts` și cele
două ecrane de plan. `TIPURI_PREZENTA` a trebuit MUTAT sus în `src/schemas/attendance.ts`:
`salveazaZiPontajSchema` e declarată înaintea secțiunii planului, iar un `const` de modul
citit înaintea declarației lui e o ReferenceError la ÎNCĂRCARE — `tsc` tace, pagina cade la
prima cerere.

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

Amândouă câmpurile pun singure două punctele, dar după REGULI DIFERITE.
`mascheazaOraZi` ghicește unde se termină ora din faptul că o oră din zi nu trece de 23
(`8` → `08:`, `25` → `02:5`); o durată n-are plafonul ăsta — `40:00`, `48:00` — deci
`mascheazaDurata` taie fix după a doua cifră, iar `8:30` se tastează `0830`. Un `:`
tastat de om se păstrează unde l-a pus. Consecința în `parseOre`: `48:` e o intrare
VALIDĂ (48 de ore fix), fiindcă exact atât lasă masca în urmă când cineva scrie `48` și
pleacă din câmp.

Regula după care ies cifrele o scrie în cuvinte `rezumatRegulaPontaj`
(`src/app/(app)/pontaj/etichete.ts`), compusă pe SERVER și trimisă formularului
săptămânii ca `regulaFirmei`: steagul `areSetari` nu se deduce din `config`, iar o firmă
neconfigurată și una configurată pe exact valorile de rezervă ar da altfel același text.
`src/app/(app)/pontaj/etichete.test.ts` leagă textul de `oreleZilei`.
