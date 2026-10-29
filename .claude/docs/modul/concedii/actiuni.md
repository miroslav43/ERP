---
tip: modul
titlu: Concedii — acțiuni și citiri
aliases: [concedii-actiuni, concedii-citiri]
cai:
  - "src/app/(app)/concedii/actions.ts"
  - "src/app/(app)/concedii/suspendare-contract.ts"
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
    attendance_entries,
  ]
permisiuni: [leave:read, leave:create, leave:update, leave:approve]
feature: leave
capcane: [3, 11, 17, 33]
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul, hr]
---

# Concedii — acțiuni și citiri

Scrierile cererii. Ce refuză baza tăcut stă în trunchi, [[modul/concedii]], fiindcă acolo
se ajunge dintr-un bug. Configurarea firmei e în [[modul/concedii/setari]].

## Paginile modulului

| Pagină                            | Ce ține                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| [[modul/concedii/actiuni/citiri]] | funcțiile din `src/lib/queries/leave.ts`, soldul afișat, ce se mișcă la o schimbare de citire |

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

`decideCerere` întoarce `{ id, zileInlocuite, suspendare }`, nu doar identificatorul
cererii, iar `revalidate` își declară tipul explicit pe forma asta. `zileInlocuite` e
numărul de zile peste care exista deja o linie de pontaj scrisă de om și pe care concediul
aprobat le-a TRECUT pe concediu în foaia de prezență — ziua se rescrie, nu se păstrează
(era `zilePastrate`, cu înțelesul exact invers, până pe 6 oct 2026);
`suspendare` e un `RezultatSuspendare` — v. „Ce refuză baza tăcut" din [[modul/concedii]]
pentru amândouă. `creeazaCerereConcediu` și `trimiteCerere` le poartă pe amândouă în
`CerereTrimisa`, lângă `aprobataInstant`, fiindcă pot aproba pe loc prin `aprobaPeLoc`;
când n-au aprobat nimic, `zileInlocuite` e `0` și `suspendare` e constanta `FARA_SUSPENDARE`
(`ceruta: false`), citită de ecran ca „nimic de arătat".

Numărul vine din `sincronizeazaConcediulAprobat`, care întoarce DOAR câmpul `inlocuite` al
lui `RezultatSincronizare` (`src/app/(app)/pontaj/sincronizare-concediu.ts`). Celelalte
trei — `create`, `actualizate` și mai ales `pastrate`, adică zilele pe care UPDATE-ul le-a
ratat tăcut fiindcă erau deja aprobate — **nu ies pe drumul concediilor**; se văd numai
prin butonul de sincronizare din `/pontaj`. Un `0` întors aici înseamnă deci „nicio zi
înlocuită SAU sincronizarea n-a rulat SAU au fost zile pe care baza le-a refuzat tăcut".

Cine adaugă un apelant nou trebuie să le **afișeze pe amândouă** (`zileInlocuite` și
`suspendare`): primul spune că aprobatorul tocmai a schimbat pontajul altcuiva, al doilea
că a rămas un termen legal de respectat; sunt independente, iar al doilea n-are voie să-l
ascundă pe primul. E singurul loc în care cineva care poate repara se uită la ecran. Azi
le arată `DecizieAprobare` (`aprobari/decizie-aprobare.tsx`, folosită și de
`/concedii/[id]`), ca listă de `atentii` cu `role="alert"` care supraviețuiește închiderii
panoului, `ActiuniCerere` (`[id]/actiuni-cerere.tsx`, folosită și de portal) și
`DialogCerereNoua`, prin toast-uri separate. `formular-cerere.tsx` din portal nu: trece
rezultatul prin `Formular`, care păstrează doar `id`-ul, pentru navigare. În plus, când
`inlocuite > 0` și fișa are cont de utilizator, `sincronizeazaConcediulAprobat` îi scrie
angajatului o notificare în `notifications`, cu clientul admin, filtrat pe organizație:
`kind: "info"`, „Zile pontate trecute pe concediu", cu link spre `/portal/pontajul-meu` —
el a pontat zilele alea, deci trebuie să afle că i s-a schimbat foaia. Notificarea e un
plus, nu poarta: dacă INSERT-ul cade, eșecul se loghează și aprobarea rămâne dată.

**Ce se verifică abia la TRIMITERE stă într-o funcție proprie.**
`verificaInainteDeTrimitere` are doi apelanți — crearea cu `trimite: true` și
`trimiteCerere`, care ridică o ciornă existentă — și rulează într-o ordine care nu e
cosmetică: `refuzulPerioadei` (`src/domain/leave/verificari.ts`) ÎNAINTEA soldului, apoi
soldul, apoi plafonul legal anual, apoi suprapunerea; de ce, în [[modul/concedii]]. Data
angajării intră în `CerereDeVerificat` ca `angajatDin` și e luată de pe fișa CERERII, nu a
celui care apasă: la crearea pentru sine vine din aceeași citire care aduce `id`-ul fișei
proprii, iar pentru o fișă aleasă explicit sau la ridicarea unei ciorne dintr-un drum
separat, `dataAngajarii`, cu clientul admin și filtru explicit pe organizație — rolul
`employee` nu-și vede fișa prin RLS, iar aici trebuie o singură cale pentru ambele
scope-uri. Mesajele de refuz numără zilele cu `textZile` (`src/lib/format/numar.ts`), nu
cu `formatAmount`: „1 zi", nu „1,00 zile".

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
omului care trebuie să repare. Consecințele pe termene și transmitere:
[[modul/concedii/suspendare]].

**Octeții documentului justificativ nu trec prin nicio acțiune.**
`pregatesteIncarcareDocumentConcediu` întoarce `{ cale, urlSemnat }` — adresa semnată
întreagă (`data.signedUrl`), nu jetonul din ea —, iar octeții urcă din browser direct în
`org-documents` printr-un `PUT` cu corp binar, `urcaPeUrlSemnat`
(`src/lib/storage/urca-semnat.ts`), nu prin `uploadToSignedUrl` din SDK: tokenul din
adresă E autorizația, verificată la semnare sub sesiunea apelantului, deci ecranul nu mai
are nevoie de un client Supabase în browser. Calea ajunge în
`creeazaCerereConcediu` printr-un câmp ascuns numit `atasament_path` — exact cheia din
`creeazaCerereSchema`, ca `fieldErrors` s-o găsească. Fișierul e sus **înainte** ca
cererea să existe: un abandon lasă un obiect orfan, preferabil unei cereri care trimite
spre un fișier inexistent. Calea venită de la client o verifică `verificaCaleaDocumentului`
prin `caleInPrefix` (`src/lib/documents/cale.ts`), nu prin `startsWith`: pe lângă prefixul
fișei se cer segmente curate — cad segmentul gol, `.`, `..`, formele lor
procent-codificate, `\` și caracterele de control, fiindcă normalizarea unei căi se
întâmplă abia la `fetch`, adică după ce ea a fost deja scrisă în rând.

Imediat după cale, și ÎNAINTEA oricărei citiri a tipului de concediu, vine
`verificaDocumentulAtasat`: măsoară obiectul urcat (`src/lib/storage/masoara-obiectul.ts`),
îi citește capul (`src/lib/storage/primii-octeti.ts`) și compară semnătura cu tipul
MĂSURAT, nu cu cel declarat de browser (`src/lib/storage/semnatura.ts`) — totul cu
clientul utilizatorului, deci RLS-ul de Storage decide dacă își poate citi înapoi propriul
fișier. Ce nu se potrivește iese ca VALIDARE pe `atasament_path`, iar obiectul e scos din
bucket cu clientul de serviciu. Un singur punct acoperă ambele ecrane; ce trebuie să facă
ecranul după o respingere e în [[modul/concedii/documente]].

`linkDocumentConcediu` face drumul invers — citește RÂNDUL cu clientul utilizatorului, ca
RLS să decidă cine vede cererea, și abia calea din rândul întors se semnează, pentru un
minut. Eroarea citirii se scrie `throw traduEroare(error)`: `traduEroare` din `./erori`
ÎNTOARCE eroarea, n-o aruncă (capcana #3), iar fără `throw` o citire căzută aluneca în
ramura „document lipsă" de mai jos și ieșea pe ecran ca `notFound`. Componentele
`incarcare-document.tsx` și `link-document.tsx` stau în `src/app/(app)/concedii/`; prima e
folosită și de formularul din portal, deci se schimbă pentru amândouă ecranele deodată.

## Schemele

`src/schemas/leave.ts` vorbește în formatul pe care îl vede omul, nu în cel pe care îl
trimite: `IntrareData` (`src/components/ui/intrare-data.tsx`) arată `zz.ll.aaaa` și
trimite ISO, deci mesajele lui `dataObligatorie` cer „o dată (zz.ll.aaaa)", iar singura
cauză reală a erorii e câmpul gol. `superRefine`-ul care validează anul retestează
`RE_DATA` și **iese** când o dată n-a trecut regexul: o rafinare rulează și după ce o
problemă de câmp a fost deja raportată, deci fără garda asta un câmp gol primea două
mesaje lipite.

## Ce se mișcă împreună la o schimbare de formă

Forma returnată de o acțiune se mișcă în trei locuri deodată: tipul din `handler`, tipul
scris explicit în `revalidate` (declarat înaintea handlerului, deci TypeScript n-are de
unde-l infera) și componenta client care citește `rezultat.data`. `decideCerere` le are
pe toate trei, iar de la `suspendare` forma trimite și într-un tip din alt fișier,
`RezultatSuspendare`. La `creeazaCerereConcediu` și `trimiteCerere` e un al patrulea loc:
adnotarea `CerereTrimisa` din `audit.entityId`, declarată ÎNAINTEA lui `revalidate` —
`TData` se inferează din prima adnotare văzută, deci două forme diferite dărâmă restul
obiectului.

Trio-ul propriu al unei citiri (`.select()`, `.returns<T>()`, consumatorul) e în
[[modul/concedii/actiuni/citiri]].

## Când NU e suficientă pagina asta

- Ce refuză baza fără să spună, plus rutele și cine ajunge unde: [[modul/concedii]].
- Calculul zilelor lucrătoare și al drepturilor: `src/domain/leave/`.
- Ce se întâmplă mai departe cu evenimentele pregătite la aprobare — termene, transmitere,
  reconciliere: [[modul/reges]].
