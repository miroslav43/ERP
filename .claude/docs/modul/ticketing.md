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
capcane: [17]
citeste_daca:
  - "42P17 «infinite recursion» la citirea unui tichet → secțiunea despre 0062"
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
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

## Prioritatea nu se alege

`internal.tickets_calculeaza_prioritatea` o **derivă** din ce a declarat solicitantul —
un defect care blochează activitatea urcă singur la `ridicata`. Câmpul nu e expus în
formular.

Singura excepție e suprascrierea manuală a IT-ului: atunci `prioritate_manuala` devine
`true`, triggerul nu mai recalculează niciodată peste ea, iar constrângerea din `0045`
cere justificare scrisă. Cine adaugă o cale nouă de scriere a priorității trebuie să
seteze steagul, altfel prima recalculare i-o șterge.

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
