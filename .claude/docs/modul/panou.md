---
tip: modul
titlu: Panou
aliases: [panou, dashboard, acasa]
cai:
  - "src/app/(app)/panou/**"
  - "src/lib/queries/panou.ts"
  - "src/lib/navigation/build-navigation.ts"
tabele: []
permisiuni:
  [
    attendance:approve,
    leave:read,
    per_diem:approve,
    trip_sheets:approve,
    vehicle_reservations:approve,
    tickets:approve,
    vehicles:update,
    checklists:read,
    announcements:read,
    employees:read,
    employees:create,
    organizations:update,
    departments:create,
    reges:transmit,
  ]
capcane: [26]
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
tags: [modul]
---

# Panou

Ecranul de pornire: contoare, o coadă de „ce am de făcut" și scurtături. Nu are date
proprii — e o compunere peste toate celelalte module, ceea ce îl face locul unde greșelile
de poartă din restul aplicației devin vizibile primele.

## Paginile modulului

Trunchiul ține porțile contorilor, cifra din antet și **ce refuză baza** — secțiunea pentru
care se deschide pagina dintr-un bug. Adresele către care duc cifrele s-au spart separat
(`.claude/docs/meta/conventii.md`).

| Pagină                   | Ce ține                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| [[modul/panou/legaturi]] | linkurile cifrelor, „Firma azi", blocul „Pornire", meniul de rezervă |

## Fiecare contor are poarta lui

`contoarePanouPentru` din `src/lib/queries/panou.ts` primește `features` (modulele active),
harta întreagă de permisiuni, `userId` și `role`, apoi decide **contor cu contor** dacă îl
cere. Un contor cerut fără drept n-ar da eroare — ar întoarce zero, iar utilizatorul ar
citi „nimic de făcut" în loc de „n-ai acces". De aceea decizia se ia înaintea interogării,
nu după.

Poarta unui contor e cea a **acțiunii** către care duce, nu cea a listei. `vedeReges` cere
`reges:transmit` la `all`, deși intrarea de meniu se deschide pe `reges:read`: cine doar
citește registrul ar fi primit un număr care îl cheamă undeva unde n-are ce apăsa. Aceeași
regulă ține `vedeAnomalii` pe `vehicles:update` și `vedeRezervari` pe
`vehicle_reservations:approve` la `team` — nu pe `vehicle_reservations:read`, pragul cu care
se deschide `/flota/rezervari`. `vedeIntegrare` (`checklists:read`) și `vedeAvizier`
(`announcements:read`) sunt cele două porți pe `own`: pașii de integrare și anunțurile
necitite sunt treaba cuiva anume, nu a unei echipe.

`role` intră în `Porti` fiindcă pașii de integrare se atribuie și pe rol, nu doar pe fișă:
`sarcinileMele` caută `responsabil_employee_id` egal cu fișa mea SAU `responsabil_tip` de
tip rol cu rolul meu, deci fără el contorul ar fi ratat tocmai pașii lui „oricine e HR".

„Netransmis" înseamnă `de_pregatit` SAU `pregatit` — un eveniment pregătit pare rezolvat și
tocmai de aceea e cel mai aproape de a fi uitat; `transmis`, `confirmat` și `respins` au
plecat deja, `anulat` a fost retras deliberat. Stările sunt cele din enumerarea
`reges_stare_eveniment` (`0086_reges_redenumire.sql:32`, creată ca `revisal_status` în
`0004_hr.sql:77`). Contorul se citește direct din coloana `status`, nu derivat din listă:
spre deosebire de concedii, aici starea CHIAR stă în coloana entității numărate.

`resolveTenant` (nu `requireTenant`) plus `redirect`: fără organizație aleasă, pagina
trimite la selecție, nu afișează un panou gol. Tot de acolo vin `user.id` și rolul, pe care
`contoarePanouPentru` le primește ca argumente — memoizarea `React.cache()` compară prin
identitate, deci argumentele rămân primitive, niciodată un obiect construit la fața locului.

Meniul se construiește din aceeași hartă, prin `buildNavigation` — un modul deblocat care
nu apare în meniu înseamnă aproape întotdeauna `getPermissionMap` chemat fără `memberId`,
v. [[rol/manager]]. Insignele lui (`leave_pending`, `attendance_pending`, `ssm_expiring`,
`fleet_expiring`, `maintenance_due`, `reges_pending`, `announcements_unread`) vin din
`insigneMeniu`, deci din aceiași contori; `null` și `0` se omit amândouă, așa că o pastilă
absentă nu spune dacă blocul e gol sau ascuns. `announcements_unread` e singura alimentată
din afara cozii — `ContoarePanou.avizier` stă lângă `coada`, tocmai ca să nu ceară un rând.

## Un singur obiect: linkul duce la el, nu la o listă de un rând

`contorCereriConcediu` și `contorTichete` întorc `ContorCuUnic` — numărul ȘI, când e exact
unul, id-ul lui. De aceea au pierdut `head: true` și au căpătat `.limit(2)`: `count` rămâne
exact peste tot filtrul, iar cel mult două rânduri costă la fel. `unicDin` umple `unicId`
numai când numărul e `1`, iar `coadaDinContoare` duce atunci în `/concedii/<id>`, respectiv
`/ticketing/<id>`; altfel, la lista filtrată.

`cerereUnicaId` și `tichetUnicId` stau în `CoadaPanou` lângă contori, dar **nu sunt
contori** — nu produc rânduri. Testul care numără cheile le exclude pe sufix: în
`coada.test.ts`, `CONTORI` sunt cheile care nu se termină în `Id`. Un contor nou numit cu
sufixul ăsta ar ieși tăcut din invariantul care păzește coada.

## Cifra din antet se numără din rânduri, nu din contori

Rândurile cozii se construiesc în `coadaDinContoare`, iar cifra din antet e
`numarulDinAntet` peste ele — amândouă în `src/app/(app)/panou/coada.ts`. `ContoarePanou`
**nu mai are** câmp `totalDeRezolvat`: o sumă peste contori nu poate ști ce ajunge pe
ecran, iar un contor adăugat fără rândul lui intra tăcut în cifră. Ce nu s-a construit nu
se mai numără.

Rândurile stau în fișier propriu, nu în `page.tsx`, ca să poată fi testate:
`queries/panou.ts` începe cu `import "server-only"`, deci un test care ar fi importat
pagina ar fi căzut la încărcare, nu la aserțiune. `coada.ts` importă doar TIPUL, iar
`coada.test.ts` verifică — numărând cheile-contor ale lui `CoadaPanou`, nu dintr-o listă
scrisă de mână — că fiecare produce un rând. `reges` e singurul rând `urgent`: termenul lui
e prevăzut de lege.

## Rândul de pontaj poartă luna în link

`pontajDeAprobat` (din `src/lib/queries/attendance.ts`) întoarce `zile`, `fise` și lista
`luni`, nu un contor. Rândul le adună — se aprobă din același ecran, în două blocuri — și
scrie detaliul despărțit: „8 zile din 2 luni" e avertismentul că un singur ecran nu le
arată pe toate. Linkul duce în `/pontaj/aprobare?an=&luna=` pe prima lună cu restanțe,
fiindcă ecranul lucrează pe O lună și se deschide implicit pe cea curentă; fără parametri,
panoul ar fi numărat o lună și ecranul ar fi arătat alta. Când sunt doar fișe săptămânale,
luna se lasă implicită — fișele se arată în capul ecranului, indiferent de lună. Aceeași
sumă `zile + fise` alimentează insigna `attendance_pending`.

## Pragurile vin din domeniu, nu din panou

`PRAG_PANOU_ZILE` nu mai e o cifră proprie: e `PRAG_CONTRACTE_EXPIRA_ZILE`, din
`src/domain/hr/contracte-expira.ts`, adică exact fereastra pe care o filtrează
`/angajati?contract=expira`. Scadențele de flotă folosesc **alt** prag,
`PRAG_FLOTA_AVERTIZARE_ZILE`, din modulul lor. Cât timp cifrele stăteau scrise în locuri
diferite, ziua în care una s-ar fi schimbat ar fi dat contorul de pe panou și lista de
dincolo cu numere diferite, fără nicio eroare.

Cartela de flotă e locul unde cele două praguri încă se ating: numărul vine pe
`PRAG_FLOTA_AVERTIZARE_ZILE`, iar nota de dedesubt („Nimic în următoarele … de zile") e
scrisă cu `PRAG_PANOU_ZILE`. Cât timp sunt egale nu se vede nimic; când se despart, nota
va descrie altă fereastră decât cifra.

## Ce refuză baza tăcut

- **Scadențele NU se citesc din `public.expirables`.** Politica ei cere în plus
  `compliance:read`, acordat doar lui `super_admin` și `org_admin`; pentru oricine altcineva
  tabela întoarce zero rânduri fără eroare. Panoul le calculează din tabelele sursă —
  `vehicle_documents` pentru flotă, și așa mai departe. — capcana #26
- **„Lipsește" e o stare distinctă de „expiră curând".** Un vehicul fără niciun document nu
  are dată de la care să numere, deci nu se aprinde NICIODATĂ singur, oricât ar trece.
  Cazul e real în producție, nu ipotetic, de aceea `faraDocumente` se numără separat.
- **`regesDeTransmis` e `0`, nu un semnal, cât timp firma n-are credențiale REGES.**
  `contorRegesDeTransmis` cheamă întâi `citesteRezumatCredentiale`; dacă lipsesc sau nu sunt
  `activ`, întoarce zero fără să mai atingă `reges_evenimente`, deci rândul nu apare deloc.
  Evenimentele rămân în registrul modulului: fără credențiale n-au unde pleca, iar un rând
  care cere ceva ce nimeni nu poate face nu se golește niciodată. — `e5b1284`
- **Cererile TALE de concediu nu intră în contor.** `contorCereriConcediu` primește `userId`
  și exclude `employee_id` egal cu `idFisaProprie(...)`, fiindcă rândul duce la
  `/concedii/echipa`, ecran care filtrează la fel. Când `idFisaProprie` întoarce `null` —
  administrator care nu e angajat — nu se exclude nimic. — `e5b1284`
- **Lunile `blocata` nu se numără la pontaj.** O lună blocată respinge orice aprobare, deci
  o zi neaprobată din ea ar fi stat pe panou pe veci; `pontajDeAprobat` scoate perioadele
  `blocata` înainte de a număra zilele. Tot acolo ies zilele de concediu
  (`leave_request_id`) și cele respinse, exact ca în lista de aprobare. — `e5b1284`
- **Insigna avizierului dispare cu totul fără fișă proprie.** `anunturiNecitite` întoarce
  `null` când `idFisaProprie` nu găsește nimic: fără fișă nu există „citit", deci nici
  cifră. Predicatul e același ca segmentul „Necitite" din `/anunturi`, unde duce insigna —
  `anunturiPublicate` minus `idAnunturiCitite`. — `a67bb3c`
- **Pașii de integrare NU dispar fără fișă.** `pasiiDeIntegrareAiMei` trece `null` mai
  departe ca `employeeId`, iar `sarcinileMele` caută atunci doar ramura pe ROL: același
  administrator invitat care n-are avizier primește totuși pașii atribuiți rolului lui. Nu
  e un defect, e asimetria dintre „citit de cineva" și „atribuit unui rol". — `a67bb3c`
- **Un contor numărat dintr-o listă moștenește plafonul listei.** `anunturiNecitite`
  numără peste rândurile aduse de `anunturiPublicate` (limită implicită), iar
  `numarRezervariDeAprobat` își reteză `count`-ul la `PLAFON_DE_APROBAT`. Peste plafon
  cifra iese mai mică decât realitatea, fără eroare și fără antet — forma cea mai
  liniștitoare a unei cifre greșite. — `a67bb3c`

## Când NU e suficientă pagina asta

- De unde vine fiecare cifră: pagina modulului respectiv — pentru evenimentele netransmise,
  [[modul/reges]]; pentru zile și fișe săptămânale, [[modul/pontaj]]; pentru cererile în
  curs, [[modul/concedii]]; pentru rezervările de pool, [[modul/flota]]; pentru anunțurile
  necitite, [[modul/anunturi]].
- De ce un card lipsește: [[rol/manager]], [[rol/hr]].
- Rândul „Pași de integrare care vă revin” (`pasiIntegrare`, `sarcinileMele` pe fișă + rol):
  [[modul/onboarding]], iar pentru porți și linkuri, [[strat/navigare]].
