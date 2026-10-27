---
tip: modul
titlu: Ticketing IT — recursiunea dintre politici
aliases: [ticketing-42p17, ticketing-recursie]
cai:
  - "supabase/migrations/0045_ticketing_it.sql"
  - "supabase/migrations/0062_ticketing_recursie_politici.sql"
tabele: [tickets, ticket_comments, ticket_history, ticket_watchers, ticket_attachments]
permisiuni: [tickets:read]
feature: ticketing
capcane: []
scris_pe: 773c1627da87c388355631aa7419448022014599
scris_la: 2026-10-27
tags: [modul]
---

# Ticketing IT — recursiunea dintre politici

Secțiune extrasă din [[modul/ticketing]]: de ce citirea unei tabele-copil cădea cu
`42P17` și ce formă au politicile de atunci. Se deschide dintr-o eroare, nu la
construcție.

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
