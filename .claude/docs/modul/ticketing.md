---
tip: modul
titlu: Ticketing IT
aliases: [ticketing, tichete, helpdesk]
cai:
  - "src/app/(app)/ticketing/**"
  - "src/lib/queries/ticketing.ts"
  - "src/schemas/ticketing.ts"
  - "supabase/migrations/0045_ticketing_it.sql"
  - "supabase/migrations/0046_ticketing_it_reguli.sql"
  - "supabase/migrations/0062_ticketing_recursie_politici.sql"
tabele: [tickets, ticket_comments, ticket_history, ticket_watchers, ticket_attachments]
permisiuni: [tickets:read, tickets:create, tickets:update, tickets:approve]
feature: ticketing
capcane: [11, 17]
citeste_daca:
  - "42P17 «infinite recursion» la citirea unui tichet → secțiunea despre 0062"
  - "căutare liberă în listă care întoarce prea mult sau prea puțin → secțiunea „Citiri”"
  - "tichet scris fără `department_id`, sau prioritate suprascrisă fără rând în istoric → partea despre clientul admin din „Server Actions”"
scris_pe: a2cdfa5180b0b036c983f85f493fe74846b2909c
scris_la: 2026-10-06
tags: [modul]
---

# Ticketing IT

Cereri de echipament și sesizări de defecțiune software, cu aprobare de la managerul
direct sau de la patron și o coadă pentru IT. **Nu s-a adăugat niciun rol nou** în
`app_role`: aprobatorii ceruți existau deja, iar algebra de scope-uri face restul —
angajatul `own`, managerul `team`, administratorul `all`.

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

## Server Actions

`src/app/(app)/ticketing/actions.ts`.

| Funcție                                                                  | Permisiune / minScope    |
| ------------------------------------------------------------------------ | ------------------------ |
| `creeazaTichet`                                                          | `tickets:create` / own   |
| `schimbaStatusul`                                                        | `tickets:update` / own   |
| `comenteaza`, `urmareste`                                                | `tickets:read` / own     |
| `decideTichet`                                                           | `tickets:approve` / team |
| `suprascriePrioritatea`, `asigneaza`, `marcheazaDuplicat`, `aplicaMacro` | `tickets:update` / all   |

Cele patru pe `all` sunt uneltele IT-ului: prioritate manuală, asignare, marcare de
duplicat, macro. `schimbaStatusul` rămâne pe `own`, fiindcă și solicitantul închide sau
redeschide propriul tichet.

Modulul ocolește RLS cu `createAdminSupabase()` în trei puncte, toate în `actions.ts`:
`fisaMea` și departamentul din fișa solicitantului (`creeazaTichet`) — ca citirea să nu
depindă de scope-ul `employees:read` al rolului care deschide tichetul — și rândul de
justificare din `ticket_history` (`suprascriePrioritatea`), fiindcă `0045` dă pe tabela
aia doar `grant select` și o politică `_select`: istoricul e scris altfel exclusiv de
trigger. Toate trei filtrează explicit pe `organization_id` și toate trei își citesc
`error`: înghițită, eroarea scria tichetul fără `department_id` sau raporta prioritate
suprascrisă cu istoricul lipsă, definitiv și fără urmă. Cine mai adaugă o cale pe
clientul admin aici păstrează amândouă plasele.

Contractul acțiunilor e fixat pe clientul Supabase fals, în `actions-solicitant.test.ts`
(deschidere, decizie, tranziție, comentariu, urmărire) și `actions-operare.test.ts`
(uneltele IT). Fiecare unealtă pe `all` e probată și cu `tickets:update = team` —
treapta imediat sub prag, exact ce îi dă managerului seed-ul din
`0046_ticketing_it_reguli.sql` — ca o coborâre a pragului să nu treacă neobservată.
Testele NU prind o politică RLS greșită; aia rămâne pe `tests/rls/izolare.sql`.
`etichete.test.ts` cere ca hărțile din `etichete.ts` să aibă exact cheile enum-urilor din
`src/domain/ticketing/` — o stare nouă fără eticheta ei ajunge pe ecran ca cheie brută.

## Citiri

`src/lib/queries/ticketing.ts`. `listeazaTichete` caută liber în `titlu` și în
`numar_afisat` — numărul afișat e ce are omul la îndemână („IT-2026-00042") — și tiparul
`ilike` trece prin `tiparContine` (`src/lib/queries/cursor.ts`), nu prin text scris de
mână. `%`, `_` și `*` tastate de om ar fi altfel jokeri, iar virgula și paranteza rup
gramatica `or=`: rezultatul nu e o eroare, e o listă subtil greșită. Cine adaugă un filtru
de text nou aici trece prin același ajutor. — capcana #11

Paginarea e keyset pe `created_at desc, id desc` cu cursor opac, iar `total` se numără
într-o **a doua** interogare, cu aceleași filtre dar fără predicatul de cursor: numărat pe
interogarea rândurilor, keyset-ul ar fi filtrat și numărătoarea, deci totalul ar fi scăzut
la fiecare pagină.

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

## 42P17: recursiunea dintre politici (0062)

Politicile modulului se citeau una pe alta în cerc:

```
ticket_attachments_select → tickets → tickets_select → ticket_watchers
  → ticket_watchers_select → tickets → …
```

Efectul **nu** era un refuz, ci o eroare: orice citire care atinge o tabelă-copil cădea cu
`42P17`, indiferent de drepturi. Aceleași două muchii închideau bucla și prin
`ticket_comments` și `ticket_history`.

`0062_ticketing_recursie_politici.sql` taie ciclul cu funcții `security definer`, care
citesc tabelele **ocolind RLS** — regula de vizibilitate rămâne identică, doar mutată din
politică în funcție. Cine adaugă o politică nouă aici trebuie să treacă prin funcțiile
alea, nu să interogheze `tickets` direct.

Nu s-a văzut la livrare fiindcă un tichet fără urmăritori nu declanșează totdeauna ramura,
iar planificatorul nu intră în subinterogare când o condiție anterioară a decis deja
rezultatul. A ieșit la iveală abia când `tests/rls/izolare.sql`, verificarea `(c)`, a
primit primele rânduri de ticketing în fixture: cele cinci tabele fuseseră livrate fără
niciun rând acolo, deci nimeni nu le citise vreodată sub o identitate reală.

## Ce refuză baza tăcut

- **Tranzițiile de status fac `.select()` după `.update()`.** `ticket_status` are nouă
  valori — `nou`, `in_aprobare`, `respins`, `in_lucru`, `in_asteptare`, `rezolvat`,
  `inchis`, `anulat`, `redeschis`; un tichet care nu mai e în starea așteptată nu produce
  eroare, produce zero rânduri. — capcana #17
- **`aplicaMacro` publică comentariul ÎNAINTEA tranziției**, deci o tranziție sărită
  tăcut lasă răspunsul deja publicat pe tichet; mesajul de CONFLICT spune exact asta, iar
  ordinea e fixată în `actions-operare.test.ts`. Cine inversează pașii îi trimite
  solicitantului un răspuns care anunță o schimbare ce nu s-a produs. — capcana #17
- **`in_asteptare` înseamnă „se așteaptă răspunsul SOLICITANTULUI"**, nu al IT-ului —
  comentariul e pe enum, în `0045_ticketing_it.sql`. Nu există azi niciun cronometru care
  s-o consume; cine adaugă unul trebuie să scadă intervalul, altfel un tichet blocat pe
  utilizator arată ca întârziere a echipei.

## Ce se mișcă împreună

`listeazaObiecteleMele` și `managerulDirectAl` leagă modulul de [[modul/inventar]] și de
lanțul de subordonare: cererea de echipament pleacă de la ce are omul deja alocat, iar
aprobarea merge la managerul lui direct.

## Când NU e suficientă pagina asta

- Cine aprobă și de ce nu apare butonul: [[rol/manager]].
- Obiectele alocate și stocul: [[modul/inventar]].
- Lotul 7h: „Nerepartizate” și „Asignate mie” pe coadă, căutarea după număr, firimituri după proveniență (`?din=coada`), „Are deja în primire” pe cererile de echipament, cererea aprobată → obiect nou în inventar (`?obiect=nou&denumire=`): [[strat/navigare]].
