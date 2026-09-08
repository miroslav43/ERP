---
tip: modul
titlu: Concedii — acțiuni și citiri
aliases: [concedii-actiuni, concedii-citiri]
cai:
  - "src/app/(app)/concedii/actions.ts"
  - "src/app/(app)/concedii/suspendare-contract.ts"
  - "src/lib/queries/leave.ts"
  - "src/schemas/leave.ts"
tabele:
  [
    leave_requests,
    leave_request_days,
    leave_balances,
    approval_tasks,
    notifications,
    employees,
    leave_types,
    employment_contracts,
    contract_suspendari,
    reges_evenimente,
  ]
permisiuni: [leave:read, leave:create, leave:update, leave:approve]
feature: leave
capcane: [11, 17, 33]
scris_pe: 47e18f43940275c35d1c823e1ea001aac548df9e
scris_la: 2026-09-08
tags: [modul, hr]
---

# Concedii — acțiuni și citiri

Cele șase scrieri ale cererii și cele unsprezece citiri ale ei. Ce refuză baza tăcut stă în
trunchi, [[modul/concedii]], fiindcă acolo se ajunge dintr-un bug. Configurarea firmei e
în [[modul/concedii/setari]].

## Server Actions

`src/app/(app)/concedii/actions.ts`. Cele șase scrieri de configurare stau în
`setari/actions.ts` și sunt descrise în [[modul/concedii/setari]].

| Funcție                               | Permisiune / minScope  |
| ------------------------------------- | ---------------------- |
| `creeazaCerereConcediu`               | `leave:create` / own   |
| `trimiteCerere`, `anuleazaCerere`     | `leave:update` / own   |
| `decideCerere`                        | `leave:approve` / team |
| `pregatesteIncarcareDocumentConcediu` | `leave:create` / own   |
| `linkDocumentConcediu`                | `leave:read` / own     |

`decideCerere` întoarce `{ id, zilePastrate, suspendare }`, nu doar identificatorul
cererii, iar `revalidate` își declară tipul explicit pe forma asta. `zilePastrate` e
numărul de zile de concediu peste care exista deja o linie de pontaj scrisă de om;
`suspendare` e un `RezultatSuspendare` — v. „Ce refuză baza tăcut" din [[modul/concedii]]
pentru amândouă. `creeazaCerereConcediu` și `trimiteCerere` le poartă pe amândouă în
`CerereTrimisa`, lângă `aprobataInstant`, fiindcă pot aproba pe loc prin `aprobaPeLoc`;
când n-au aprobat nimic, `zilePastrate` e `0` și `suspendare` e constanta `FARA_SUSPENDARE`
(`ceruta: false`), citită de ecran ca „nimic de arătat".

Cine adaugă un apelant nou trebuie să le **afișeze pe amândouă**: e singurul loc în care
cineva care poate repara se uită la ecran, iar cele două eșecuri sunt independente — al
doilea n-are voie să-l ascundă pe primul. Azi le arată `DecizieAprobare`
(`aprobari/decizie-aprobare.tsx`, folosită și de `/concedii/[id]`), ca listă de `atentii`
cu `role="alert"` care supraviețuiește închiderii panoului, `ActiuniCerere`
(`[id]/actiuni-cerere.tsx`, folosită și de portal) și `DialogCerereNoua`, prin toast-uri
separate. `formular-cerere.tsx` din portal nu: trece rezultatul prin `Formular`, care
păstrează doar `id`-ul, pentru navigare. În plus, `decideCerere` îi scrie angajatului o
notificare în `notifications`, cu clientul admin, filtrat pe organizație. Notificarea e un
plus, nu poarta: dacă INSERT-ul cade, eșecul se loghează și aprobarea rămâne dată.

**Declararea suspendării de contract stă în fișier propriu.**
`src/app/(app)/concedii/suspendare-contract.ts` exportă `declaraSuspendareaContractului`
și tipul `RezultatSuspendare` (`ceruta`, `declarata`, `termen`, `motiv`). E chemată din
DOUĂ locuri, din același motiv ca `sincronizeazaConcediulAprobat`: din `aprobaPeLoc`
(aprobarea pe loc a patronului) și din ramura lui `decideCerere` în care cererea trece
efectiv pe `aprobata` — nu la un pas intermediar, fiindcă o declarație trimisă devreme s-ar
corecta cu un al doilea mesaj. Scrie `contract_suspendari` și, prin
`genereazaEvenimenteReges`, două rânduri în `reges_evenimente`, cu clientul admin și filtru
explicit pe `organization_id`: politica de INSERT cere `employees:update = all`, pe care un
aprobator cu `leave:approve = team` nu-l are. Contractul activ îl caută în
`employment_contracts`. Nu aruncă niciodată — ce n-a mers iese ca `motiv`, în cuvintele
omului care trebuie să repare.

**Octeții documentului justificativ nu trec prin nicio acțiune.**
`pregatesteIncarcareDocumentConcediu` întoarce `{ cale, token }`, fișierul urcă din
browser direct în `org-documents` (`uploadToSignedUrl`), iar calea ajunge în
`creeazaCerereConcediu` printr-un câmp ascuns numit `atasament_path` — exact cheia din
`creeazaCerereSchema`, ca `fieldErrors` s-o găsească. Fișierul e sus **înainte** ca
cererea să existe: un abandon lasă un obiect orfan, preferabil unei cereri care trimite
spre un fișier inexistent. `linkDocumentConcediu` face drumul invers — citește RÂNDUL cu
clientul utilizatorului, ca RLS să decidă cine vede cererea, și abia calea din rândul
întors se semnează, pentru un minut. Componentele `incarcare-document.tsx` și
`link-document.tsx` stau în `src/app/(app)/concedii/`; prima e folosită și de formularul
din portal, deci se schimbă pentru amândouă ecranele deodată.

## Citiri

`src/lib/queries/leave.ts`: `listeazaCereri`, `citesteCerere`, `zileleCererii`,
`lantulAprobarii`, `soldAnual`, `istoricSold`, `numarDeAprobat`, `deAprobat`,
`calendarLunii`, `angajatiPlanificator`, `zileNelucratoare`. Citirile de configurare —
`configurareConcedii`, `previzualizeazaDrepturi`, `coduriIndemnizatieMedicala`,
`varianteConcediu` — sunt în [[modul/concedii/setari]].

`calendarLunii` își traduce singură angajatul și tipul, prin embed imbricat PostgREST
(`angajat:employees!employee_id`, `tip:leave_types!leave_requests_leave_type_id_fkey`),
nu printr-un al doilea val de interogări în `src/app/(app)/concedii/calendar/page.tsx`.
Deliberat fără `!inner`: un embed to-one pe care RLS îl golește întoarce NULL, nu elimină
rândul — v. [[modul/concedii]] pentru ce vede omul atunci. `.returns<RandZiCalendar[]>()`
rămâne obligatoriu, dar **nu** fiindcă ar lipsi relațiile din tipurile generate: ambele
chei străine au `isOneToOne: false`, deci inferența supabase-js dă tablou acolo unde
rândul are obiect, iar `RandZiCalendar`, `AngajatEmbedCalendar` și `TipEmbedCalendar` o
corectează de mână. Din embed au ieșit `id` și `status`-ul cererii, iar din selecția
exterioară `leave_request_id`; `status`-ul ZILEI rămâne, e altul.

`zileNelucratoare` e memoizată pe cerere cu `cache()` din React, ca `resolveTenant` și
`getPermissionMap` — o pagină care o cheamă din corpul ei și din secțiunea streamată
plătește un singur val. Memoizarea ține doar fiindcă argumentele sunt primitive
(`organizationId`, doi ani): `cache()` compară prin identitate, deci un argument-obiect
n-ar nimeri niciodată în cache. E consumată și din afara modulului — `[[modul/pontaj]]`,
`[[modul/salarizare]]` și portal — deci semnătura ei nu se schimbă local.

## Ce se mișcă împreună la o schimbare de formă

Forma returnată de o acțiune se mișcă în trei locuri deodată: tipul din `handler`, tipul
scris explicit în `revalidate` (declarat înaintea handlerului, deci TypeScript n-are de
unde-l infera) și componenta client care citește `rezultat.data`. `decideCerere` le are
pe toate trei, iar de la `suspendare` forma trimite și într-un tip din alt fișier,
`RezultatSuspendare`. La `creeazaCerereConcediu` și `trimiteCerere` e un al patrulea loc:
adnotarea `CerereTrimisa` din `audit.entityId`, declarată ÎNAINTEA lui `revalidate` —
`TData` se inferează din prima adnotare văzută, deci două forme diferite dărâmă restul
obiectului.

O citire are propriul trio: șirul din `.select()`, interfața exportată pe care o impune
`.returns<T>()` și consumatorul care umblă prin rânduri. Nimic nu leagă primele două —
`.returns<T>()` afirmă, nu verifică — deci un câmp scos din `select` și lăsat în tip trece
de `pnpm typecheck` și cade abia la rulare, ca `undefined`. `calendarLunii` cu
`calendar/page.tsx` e cazul cu cele mai multe verigi.

## Când NU e suficientă pagina asta

- Ce refuză baza fără să spună, plus rutele și cine ajunge unde: [[modul/concedii]].
- Calculul zilelor lucrătoare și al drepturilor: `src/domain/leave/`.
- Ce se întâmplă mai departe cu evenimentele pregătite la aprobare — termene, transmitere,
  reconciliere: [[modul/reges]].
