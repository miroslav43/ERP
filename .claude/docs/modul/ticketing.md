---
tip: modul
titlu: Ticketing IT
aliases: [ticketing, tichete, helpdesk]
cai:
  - "src/app/(app)/ticketing/**"
  - "src/domain/ticketing/**"
  - "src/lib/queries/ticketing.ts"
  - "src/schemas/ticketing.ts"
  - "supabase/migrations/0045_ticketing_it.sql"
  - "supabase/migrations/0046_ticketing_it_reguli.sql"
  - "supabase/migrations/0062_ticketing_recursie_politici.sql"
  - "supabase/migrations/0233_oracol_intre_firme.sql"
tabele: [tickets, ticket_comments, ticket_history, ticket_watchers, ticket_attachments]
permisiuni: [tickets:read, tickets:create, tickets:update, tickets:approve]
feature: ticketing
capcane: [11, 17]
citeste_daca:
  - "42P17 «infinite recursion» la citirea unui tichet → [[modul/ticketing/recursie-politici]]"
  - "căutare liberă, o cifră a cozii care duce la altă listă, trunchiere → [[modul/ticketing/actiuni]]"
  - "tichet fără `department_id`, repartizare refuzată, prioritate suprascrisă fără istoric → clientul admin, în [[modul/ticketing/actiuni]]"
scris_pe: 773c1627da87c388355631aa7419448022014599
scris_la: 2026-10-27
tags: [modul]
---

# Ticketing IT

Cereri de echipament și sesizări de defecțiune software, cu aprobare de la managerul
direct sau de la patron și o coadă pentru IT. **Nu s-a adăugat niciun rol nou** în
`app_role`: aprobatorii ceruți existau deja, iar algebra de scope-uri face restul —
angajatul `own`, managerul `team`, administratorul `all`.

## Paginile modulului

Trunchiul ține ce e modulul, cine ajunge unde, ce i se oferă pe ecran și **ce refuză baza
fără să spună** — secțiunea pentru care se deschide pagina dintr-un bug. Scrierile și
citirile s-au spart pe subpagină (`.claude/docs/meta/conventii.md`).

| Pagină                                | Ce ține                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------- |
| [[modul/ticketing/actiuni]]           | scrierile tichetului, clientul admin, citirile listei și predicatele cozii |
| [[modul/ticketing/recursie-politici]] | de ce citirea unei tabele-copil cădea cu `42P17` și ce formă au politicile |

## Rute și cine ajunge

| Rută               | Poartă               |
| ------------------ | -------------------- |
| `/ticketing`       | `tickets:read` own   |
| `/ticketing/nou`   | `tickets:create` own |
| `/ticketing/[id]`  | `tickets:read` own   |
| `/ticketing/coada` | `tickets:read` team  |

`hr` are `tickets` doar la scope **own** (0046): e solicitant în ticketing, nu operator IT
— deci nu ajunge în coadă. — v. [[rol/hr]]

Preambulul celor patru pagini păstrează ordinea canonică a porților, dar pornește
`requireFeature` și `getPermissionMap` în același `Promise.all`: sunt două citiri
independente, pe tabele diferite, iar înlănțuite erau două dus-întorsuri seriale spre
PostgREST. `can()` rămâne după amândouă, deci verdictul nu se schimbă — nu „îndrepta"
forma înapoi la două `await` seriale doar fiindcă `anunturi/page.tsx` e scrisă așa.

Segmentul `[id]` trece prin `idDinRuta`: numărul afișat pus în adresă dă 404, ca orice
segment care nu e UUID. Proveniența rămâne tot în adresă (`?din=coada`), ca firimitura
fișei să ducă înapoi în coada echipei și nu în „Tichetele mele"; orice legătură dintre
module trece prin `poateDeschide`/`legaturaSigura` (`src/config/porti-ruta.ts`), deci un
rol care n-ar putea deschide ținta vede text, nu link.

Un cont fără fișă de personal nu poate fi solicitant — `creeazaTichet` îl refuză în
`fisaMea`. De-asta `/ticketing` îi ascunde butonul „Tichet nou" și îi oferă coada când
are `tickets:read` la `team`, iar `/ticketing/nou` răspunde cu o stare goală în loc de
un formular care s-ar refuza abia la trimitere.

## Ce se oferă pe ecran

Butoanele de stare de pe fișă vin din `tranzitiiPeTichet` (`src/domain/ticketing/stari.ts`),
nu din `tranzitiiOferite`: decizia pe o cerere are o singură cale, `DecizieCerere` →
`decideTichet`, care scrie și `motiv_respingere`. Solicitantul care nu operează pierde
doar `respins → redeschis` — din `redeschis` se trece în `in_lucru` fără nicio decizie,
deci și-ar ocoli reaprobarea — și păstrează „Anulează", singura cale prin care își
retrage cererea.

Managerul direct al solicitantului primește butoanele de decizie numai dacă are
`tickets:approve` la `team`, exact ce cere acțiunea: un `hr` care e șef direct le primea
și se lovea de refuz.

Eticheta BUTONULUI solicitantului vine din `ETICHETE_ACTIUNE_SOLICITANT` — hartă parțială,
care cade pe eticheta stării unde n-are verb: „Închis" pe un buton nu spune nimănui că e
confirmarea rezolvării. `src/app/(app)/ticketing/etichete.ts` e folosit și de portal
(`src/app/(portal)/portal/tichetele-mele`), deci etichetele de stare sunt impersonale și o
schimbare aici se vede în ambele locuri. `etichete.test.ts` cere ca hărțile să aibă exact
cheile enum-urilor din `src/domain/ticketing/` — o stare nouă fără eticheta ei ajunge pe
ecran ca cheie brută — și ca verbul să difere de numele stării.

Formularul de tichet nou trece prin `<Formular>` (`src/components/ui/formular.tsx`): un
refuz de validare nu mai golește câmpurile, fiindcă React 19 resetează formularul după
`<form action>`, iar `valoriTrimise` le pune înapoi. Se înlănțuie cu fotografia de la
„Schimbă tipul", care rămâne sursa până la prima trimitere. Porțile sunt
`actiuni-tichet.test.tsx` și `nou/formular-tichet.test.tsx`.

## Prioritatea nu se alege

`internal.tickets_calculeaza_prioritatea` o **derivă** din ce a declarat solicitantul —
un defect care blochează activitatea urcă singur la `ridicata`. Câmpul nu e expus în
formular.

Singura excepție e suprascrierea manuală a IT-ului: atunci `prioritate_manuala` devine
`true`, triggerul nu mai recalculează niciodată peste ea, iar constrângerea din `0045`
cere justificare scrisă. Cine adaugă o cale nouă de scriere a priorității trebuie să
seteze steagul, altfel prima recalculare i-o șterge.

Justificarea se scrie de mână ca rând în `ticket_history`, după UPDATE-ul reușit, iar
eșecul ei oprește acțiunea: utilizatorul vede eroare deși prioritatea e deja schimbată.
E alegerea deliberată — o reîncercare e inofensivă (`prioritate_manuala` e deja `true`),
iar alternativa era succes raportat peste o justificare pierdută. Verificarea rândului
sărit de politică stă ÎNAINTEA istoricului, ca istoricul să nu consemneze o schimbare
care nu s-a produs.

## Ce refuză baza tăcut

- **Obiectul de inventar al defecțiunii se caută doar în firma tichetului** (0233):
  `internal.tickets_valideaza_inventarul` dă un singur P0001 pentru obiectul inexistent și
  pentru cel al altei firme; garda de firmă (42501, administratorul de platformă trece, ca
  în `tickets_update`) vine înaintea căutării. Proba: `tests/rls/proba-oracol-intre-firme.sql`.
- **Tranzițiile de status fac `.select()` după `.update()`.** `ticket_status` are nouă
  valori — `nou`, `in_aprobare`, `respins`, `in_lucru`, `in_asteptare`, `rezolvat`,
  `inchis`, `anulat`, `redeschis`; un tichet care nu mai e în starea așteptată nu produce
  eroare, produce zero rânduri. — capcana #17
- **`aplicaMacro` publică comentariul ÎNAINTEA tranziției**, deci o tranziție sărită
  tăcut lasă răspunsul deja publicat pe tichet; mesajul de CONFLICT spune exact asta, iar
  ordinea e fixată în `actions-operare.test.ts`. Cine inversează pașii îi trimite
  solicitantului un răspuns care anunță o schimbare ce nu s-a produs. — capcana #17
- **Numele celui repartizat e invizibil solicitantului, deși repartizarea nu e.** La scope
  `own`, `employees_select` ascunde rândul operatorului, deci embed-ul `asignat` vine NULL
  pe un tichet care E repartizat, fără nicio eroare; același gol îl are aprobatorul cu
  `employees:read = team`, fiindcă operatorul IT nu e în echipa lui. De-asta citirile cer
  și coloana brută `asignat_employee_id`, iar textul îl dă `responsabilulTichetului`
  (`src/app/(app)/ticketing/etichete.ts`): „Preluat de echipa de suport", niciodată
  „Neatribuit încă". Cine citește doar embed-ul scrie pe ecran contrariul faptelor.
- **`in_asteptare` înseamnă „se așteaptă răspunsul SOLICITANTULUI"**, nu al IT-ului —
  comentariul e pe enum, în `0045_ticketing_it.sql`. Nu există azi niciun cronometru care
  s-o consume; cine adaugă unul trebuie să scadă intervalul, altfel un tichet blocat pe
  utilizator arată ca întârziere a echipei.

## Ce se mișcă împreună

`listeazaObiecteleMele` și `managerulDirectAl` leagă modulul de [[modul/inventar]] și de
lanțul de subordonare: cererea de echipament pleacă de la ce are omul deja alocat, iar
aprobarea merge la managerul lui direct. Pe fișă, „Are deja în primire" se arată doar
aprobatorului sau operatorului care poate deschide `/inventar`, iar înregistrarea
echipamentului cumpărat cere `inventory:update` la `all` și o cerere trecută de decizie —
din „în lucru" încolo, nu mai devreme.

## Când NU e suficientă pagina asta

- Cine aprobă și de ce nu apare butonul: [[rol/manager]].
- Obiectele alocate și stocul: [[modul/inventar]].
- Firimituri, pastile de filtre, legături către fișe, proveniența în adresă — convențiile
  comune tuturor modulelor: [[strat/navigare]].
