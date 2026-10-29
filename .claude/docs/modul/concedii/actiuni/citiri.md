---
tip: modul
titlu: Concedii — acțiuni și citiri — stratul de citire
aliases: [concedii-citiri]
cai:
  - "src/lib/queries/leave.ts"
tabele: [leave_requests, leave_request_days, leave_balances, leave_types, employees, approval_tasks]
permisiuni: [leave:read]
feature: leave
capcane: [2]
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul, hr]
---

# Concedii — acțiuni și citiri — stratul de citire

Secțiune extrasă din [[modul/concedii/actiuni]]: funcțiile de citire ale cererii, soldul
afișat și ce se mișcă împreună cu o citire. Scrierile au rămas în mamă. Ce refuză baza
tăcut pe ecranele care doar arată cereri e în [[modul/concedii/vederi]].

## Citiri

`src/lib/queries/leave.ts`: `listeazaCereri`, `citesteCerere`, `zileleCererii`,
`lantulAprobarii`, `soldAnual`, `istoricSold`, `numarDeAprobat`, `deAprobat`,
`calendarLunii`, `angajatiPlanificator`, `zileNelucratoare`, `cereriCareOcupaZile`,
`numarCereriInAsteptareLuna`. Citirile de configurare — `configurareConcedii`,
`previzualizeazaDrepturi`, `coduriIndemnizatieMedicala`, `varianteConcediu` — sunt în
[[modul/concedii/setari]].

**Soldul afișat se compune din funcții pure, nu din interogări.** `imperecheazaSold`
leagă tipurile active de rândurile din `leave_balances` ale unui SINGUR angajat și
primește opțional harta `leave_type_id → zile` a drepturilor calculate; `dreptDinRand`
alege ce drept se arată; `ramaseDinRand` scade din el; `tipuriAfisateInSold` decide ce
rânduri intră în tabel. Harta vine numai din `drepturileMele`
(`src/lib/queries/portal.ts`, RPC-ul `public.drepturile_mele_concediu` din
`0108_drepturile_mele_concediu.sql`), care își rezolvă singură fișa apelantului din
`app.current_employee_id()` — deci dreptul proporțional cu lunile lucrate
(`0193_concediu_proportional_cu_lunile.sql`) ajunge DOAR pe fișa privitorului, iar în
tabelul de echipă celelalte rânduri intră fără el. Aceleași funcții servesc
`src/app/(app)/concedii/sold/page.tsx` și rezumatul din
`src/app/(app)/concedii/page.tsx`, ca cele două ecrane să nu poată spune cifre diferite;
ce iese `null` din ele e explicat în [[modul/concedii]].

`numarCereriInAsteptareLuna` nu e citită de niciun ecran de concedii: o cheamă
`src/app/(app)/salarizare/actions.ts`, înaintea calculului de salarii. Predicatul ei e
COPIA celui din triggerul de pe `payroll_periods` (`0026_payroll.sql`) — `trimisa` și
`in_aprobare`, **fără** `aprobata`, deci NU același filtru ca `cereriCareOcupaZile` de mai
jos; dacă triggerul se schimbă, lista de stări se mută odată cu el. Întoarce un `count`
cu `head: true`, deci nu are ce să trunchieze.

`calendarLunii` își traduce singură angajatul și tipul, prin embed imbricat PostgREST
(`angajat:employees!employee_id`, `tip:leave_types!leave_requests_leave_type_id_fkey`),
nu printr-un al doilea val de interogări în `src/app/(app)/concedii/calendar/page.tsx`.
Deliberat fără `!inner`: un embed to-one pe care RLS îl golește întoarce NULL, nu elimină
rândul — v. [[modul/concedii/vederi]] pentru ce vede omul atunci.
`.returns<RandZiCalendar[]>()` rămâne obligatoriu, dar **nu** fiindcă ar lipsi relațiile
din tipurile generate: ambele chei străine au `isOneToOne: false`, deci inferența
supabase-js dă tablou acolo unde rândul are obiect, iar `RandZiCalendar`,
`AngajatEmbedCalendar` și `TipEmbedCalendar` o corectează de mână. `leave_request_id` se
cere din selecția EXTERIOARĂ, fiindcă fiecare pastilă din grilă și fiecare casetă din
planificator duce la cererea zilei (`cerereId`); `status`-ul de lângă el e al ZILEI, e
altul decât al cererii, iar al cererii nu se mai cere din embed.

`cereriCareOcupaZile` întoarce INTERVALE, nu zile — capetele sunt sute pe an acolo unde
zilele sunt zeci de mii — iar desfacerea o face clientul, prin `zileOcupate`
(`src/domain/leave/zile-ocupate.ts`), care e și locul unde se filtrează pe persoana
aleasă. Rândul poartă și `id`-ul cererii, ca mesajul de suprapunere din casetă s-o LEGE,
nu doar s-o numească. Filtrul de status (`trimisa`, `in_aprobare`, `aprobata`) e același
cu predicatul constrângerii `leave_requests_fara_suprapunere` din `0009_leave.sql` și cu
cel al verificării de suprapunere din `verificaInainteDeTrimitere`: se schimbă deodată,
altfel calendarul ori marchează zile pe care baza le-ar accepta, ori le lasă libere pe
cele pe care le va refuza. O ciornă nu ocupă nimic, deliberat. Nu filtrează pe angajat —
RLS îngustează singură, iar un `hr` cu `leave:read = all` are nevoie de toate, fiindcă
depune cereri în numele altora. Embed-ul `tip:leave_types!leave_type_id(denumire)` e
to-one fără `!inner`, ca la `calendarLunii`: golit de RLS vine NULL, iar denumirea cade pe
`"Concediu"`. Citirea n-are nici `limit`, nici cursor, pe o fereastră de trei ani — peste
`max_rows = 1000` PostgREST trunchiază tăcut (capcana #2), și se pierd exact marcajele:
cererea tot va fi refuzată la trimitere, dar omul n-o vede venind. Eticheta din tooltip se
compune pe server, în `dateCerereNoua` (`src/app/(app)/concedii/date-cerere-noua.ts`),
fiindcă stratul de citiri n-are voie să importe din arborele de rute.

`zileNelucratoare` e memoizată pe cerere cu `cache()` din React, ca `resolveTenant` și
`getPermissionMap` — o pagină care o cheamă din corpul ei și din secțiunea streamată
plătește un singur val. Memoizarea ține doar fiindcă argumentele sunt primitive
(`organizationId`, doi ani): `cache()` compară prin identitate, deci un argument-obiect
n-ar nimeri niciodată în cache. E consumată și din afara modulului — `[[modul/pontaj]]`,
`[[modul/salarizare]]` și portal — deci semnătura ei nu se schimbă local. Consumatorii
rămân însă exclusiv de server: fișierul începe cu `import "server-only"`, deci o
componentă client care ar importa din el cade la build, nu tăcut la rulare.

## Ce se mișcă împreună la o schimbare de formă

O citire are propriul trio: șirul din `.select()`, interfața exportată pe care o impune
`.returns<T>()` și consumatorul care umblă prin rânduri. Nimic nu leagă primele două —
`.returns<T>()` afirmă, nu verifică — deci un câmp scos din `select` și lăsat în tip trece
de `pnpm typecheck` și cade abia la rulare, ca `undefined`. `calendarLunii` cu
`calendar/page.tsx` e cazul cu cele mai multe verigi.

## Când NU e suficientă pagina asta

- Scrierile cererii și ce se mișcă la o schimbare de formă returnată:
  [[modul/concedii/actiuni]].
- Ce refuză baza fără să spună, plus rutele și cine ajunge unde: [[modul/concedii]].
- Calculul zilelor lucrătoare și al drepturilor: `src/domain/leave/`.
