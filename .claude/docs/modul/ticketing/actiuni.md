---
tip: modul
titlu: Ticketing IT — acțiuni și citiri
aliases: [ticketing-actiuni, ticketing-citiri]
cai:
  - "src/app/(app)/ticketing/actions.ts"
  - "src/lib/queries/ticketing.ts"
  - "src/schemas/ticketing.ts"
tabele: [tickets, ticket_comments, ticket_history, ticket_watchers, employees]
permisiuni: [tickets:read, tickets:create, tickets:update, tickets:approve]
feature: ticketing
capcane: [11, 17]
scris_pe: 773c1627da87c388355631aa7419448022014599
scris_la: 2026-10-27
tags: [modul]
---

# Ticketing IT — acțiuni și citiri

Secțiune extrasă din [[modul/ticketing]]: scrierile tichetului și citirile lui. Rutele,
ce se oferă pe ecran, prioritatea și **ce refuză baza tăcut** rămân în trunchi, fiindcă
acolo se ajunge dintr-un bug.

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

`marcheazaDuplicat` n-a avut la livrare nicio cale de apel în interfață, deci
`parent_ticket_id` nu se putea scrie de nicăieri. Intrarea e acum `MarcheazaDuplicat` pe
fișă, hrănită cu candidați de pe server; acțiunea refuză auto-duplicatul și lanțurile —
un părinte care e el însuși duplicat — ca „rezolvarea părintelui" să nu trebuiască să
urce recursiv.

Modulul ocolește RLS cu `createAdminSupabase()` în patru puncte, toate în `actions.ts`:
`fisaMea` și departamentul din fișa solicitantului (`creeazaTichet`) — ca citirea să nu
depindă de scope-ul `employees:read` al rolului care deschide tichetul —, rândul de
justificare din `ticket_history` (`suprascriePrioritatea`), fiindcă `0045` dă pe tabela
aia doar `grant select` și o politică `_select`: istoricul e scris altfel exclusiv de
trigger, și fișa destinatarului din `asigneaza`, fiindcă cheia străină
`tickets.asignat_employee_id` nu e compusă cu `organization_id` — baza ar primi și fișa
altei firme, iar triggerul de repartizare (`0192` §3) ar căuta destinatarul acolo; un
operator poate fi un membru `employee` cu `tickets:update = all`, care prin RLS își vede
doar propria fișă. Angajatul necunoscut în firmă oprește acțiunea cu NEGASIT, înaintea
oricărui UPDATE. Toate patru filtrează explicit pe `organization_id` și toate patru își
citesc `error`: înghițită, eroarea scria tichetul fără `department_id` sau raporta
prioritate suprascrisă cu istoricul lipsă, definitiv și fără urmă. Cine mai adaugă o cale
pe clientul admin aici păstrează amândouă plasele.

Contractul acțiunilor e fixat pe clientul Supabase fals, în `actions-solicitant.test.ts`
(deschidere, decizie, tranziție, comentariu, urmărire) și `actions-operare.test.ts`
(uneltele IT). Fiecare unealtă pe `all` e probată și cu `tickets:update = team` —
treapta imediat sub prag, exact ce îi dă managerului seed-ul din
`0046_ticketing_it_reguli.sql` — ca o coborâre a pragului să nu treacă neobservată.
Testele NU prind o politică RLS greșită; aia rămâne pe `tests/rls/izolare.sql`.

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

Cifrele tabloului cozii și scurtăturile lor împart un singur predicat,
`STATUSURI_DESCHISE_COADA`: „Deschise", „Fără mișcare de 7 zile" și „Nerepartizate" din
`rezumatCoada` se regăsesc ca `deschise`, `fara_miscare` și `nerepartizate` în
`filtreTicheteSchema`, iar `listeazaTichete` le aplică pe aceeași listă de statusuri.
Cine mai adaugă o cifră pe tablou îi scrie filtrul din aceeași constantă — altfel cifra
duce la o listă care n-o confirmă, fără nicio eroare. `solicitant_employee_id` e filtru
de INTRARE pe coadă (se vine pe el din fișa angajatului); „Tichetele mele" rămâne pe
argumentul separat `doarSolicitant`.

`duplicateleTichetului` și `candidatiOriginal` n-au cursor: amândouă se opresc la
`.limit(50)`, deci pe un tichet cu mai multe duplicate decât atât lista de pe fișă e
trunchiată fără să spună. Candidații sunt doar tichetele deschise de același tip care nu
sunt ele însele duplicate — aceeași regulă pe care o verifică a doua oară acțiunea.

Embed-urile de persoane cer `deleted_at` pe lângă `id, full_name`, fiindcă legătura spre
fișă se hotărăște în pagină (`hrefFisa`), iar `COLOANE_LISTA` cere și coloana brută
`asignat_employee_id` pe lângă embed-ul `asignat` — motivul stă în trunchi, la „Ce refuză
baza tăcut".
