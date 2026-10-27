---
tip: modul
titlu: Pontaj — acțiuni și citiri — ce se mișcă împreună
aliases: [pontaj-actiuni-lanturi]
cai:
  - "src/schemas/attendance.ts"
  - "src/domain/attendance/**"
tabele: [attendance_entries, attendance_periods]
permisiuni: []
feature: attendance
capcane: []
scris_pe: 773c1627da87c388355631aa7419448022014599
scris_la: 2026-10-27
tags: [modul, hr]
---

# Pontaj — acțiuni și citiri — ce se mișcă împreună

Secțiune extrasă din [[modul/pontaj/actiuni]]: corpul paginii trecuse de plafonul dur,
iar lanțurile de fișiere pe care le atinge o schimbare de formă a zilei sunt partea care
nu se schimbă la fiecare acțiune nouă.

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

Starea lunii nu se mai deduce din `perioada === null`: `stareaLunii` și `intervalulLunii`
(`src/domain/attendance/luna.ts`, cu teste) citesc rândul LIPSĂ ca lună **deschisă** —
perechea în bază e `internal.pontaj_perioada_lunii` (0132), care naște rândul la prima
scriere din lună. Singura stare care refuză e `blocata`: `in_aprobare` nu blochează
scrierea nici în bază (0013:293), iar portalul o trata ca refuz. `actions.ts` păstrează
totuși o copie locală a lui `intervalulLunii`.

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
