---
tip: modul
titlu: Inventar
aliases: [inventory, obiecte, predare-primire, proces-verbal]
cai:
  - "src/app/(app)/inventar/**"
  - "src/lib/queries/inventory.ts"
  - "src/schemas/inventory.ts"
  - "src/domain/inventory/**"
tabele: [inventory_items, inventory_allocations, inventory_categories, inventory_import_batches]
permisiuni: [inventory:read, inventory:update]
feature: inventory
capcane: []
citeste_daca:
  - "obiect care nu apare în listă → [[rol/manager]]"
  - "ecran gol la un angajat cu inventar → secțiunea „Ce refuză baza tăcut”"
scris_pe: MANUAL
scris_la: 2026-08-30
tags: [modul, operations]
---

# Inventar

Obiectele firmei și circuitul lor prin mâinile angajaților. **Modulul are numai două
chei de permisiune** — `inventory:read` și `inventory:update` — iar politicile de
INSERT verifică tot `update`: nu există `inventory:create`, deliberat, ca o matrice de
roluri rescrisă per organizație să nu poată deschide o poartă pe care RLS n-o cunoaște.

## Rute și cine ajunge

| Rută                          | Poartă                                                  |
| ----------------------------- | ------------------------------------------------------- |
| `/inventar`                   | `inventory:read` ≠ `none`; banda de cifre doar la `all` |
| `/inventar?obiect=nou`        | caseta de adăugare, deschisă din parametru              |
| `/inventar/[id]`              | `inventory:read` ≠ `none`; scrierile cer `update = all` |
| `/inventar/[id]/pv/[alocare]` | `inventory:read` ≠ `none`; proces-verbal tipăribil      |
| `/inventar/in-primire`        | `inventory:read` ≠ `none`; oglindit în `/portal`        |

Ruta `/inventar/nou` **nu mai există**. Ce ducea acolo duce în `?obiect=nou`, care
deschide caseta prin `deschisInitial` — vezi `dialog-obiect-nou.tsx`. Același tipar ca
la `concedii` și `flota`.

## Server Actions

Toate prin `createAction`, toate pe `feature: inventory`, toate cu `traduEroare`.
Sursa: `src/app/(app)/inventar/actions.ts`.

| Acțiune              | Permisiune         | minScope |
| -------------------- | ------------------ | -------- |
| `creeazaObiect`      | `inventory:update` | `all`    |
| `actualizeazaObiect` | `inventory:update` | `all`    |
| `predaObiect`        | `inventory:update` | `all`    |
| `returneazaObiect`   | `inventory:update` | `all`    |
| `caseazaObiect`      | `inventory:update` | `all`    |
| `readuInStoc`        | `inventory:update` | `all`    |
| `confirmaPrimirea`   | `inventory:read`   | `own`    |

`confirmaPrimirea` e singura acțiune din proiect care autorizează o SCRIERE cu o
permisiune de citire. Nu e o scăpare: politica de UPDATE pe `inventory_allocations` are
o a doua ramură, pentru rândul propriu, iar `minScope: all` ar fi închis-o.

`status` nu e câmp editabil în nicio schemă. Mișcarea prin circuit o fac alocările,
prin trigger; ieșirea din `in_reparatie` are acțiune proprie.

## Citiri

`src/lib/queries/inventory.ts`, funcții libere, `organizationId` primul argument.
**Niciun filtru de scope în interogări** — RLS restrânge singură, spre deosebire de
`queries/employees.ts`.

`categorii()` e singura fără `organizationId`: rândurile de platformă au
`organization_id IS NULL`, iar politica de SELECT arată ambele seturi.

`rezumatInventar()` însumează valorile în felii de 1000, pe cursor keyset, fiindcă
`max_rows` trunchiază tăcut și agregatele PostgREST nu sunt activate. Nu se rescrie în
`.select("valoare.sum()")`.

## Ce refuză baza tăcut

**Un obiect NEALOCAT e invizibil sub `all`.** Politica de SELECT pe `inventory_items`
gradează după scope: la `all` se vede tot; la `team` doar dacă există o alocare pe un
subordonat; la `own` doar dacă există una pe propria fișă. Un `manager` care caută un
laptop din depozit primește zero rânduri, fără nicio eroare. De aceea banda de cifre de
pe listă se randează exclusiv la `all` — altfel ar arăta zerouri care par o defecțiune.

**`status` e un CACHE, nu sursa de adevăr.** Îl scrie triggerul de propagare din
alocări. Dacă cele două se contrazic, adevărul e în `inventory_allocations`; de aceea
`custodie()` din `src/domain/inventory/fisa.ts` întreabă întâi alocarea deschisă.

**Numărul de inventar nu se eliberează niciodată.** Indexul unic e TOTAL, pe
`upper(btrim(numar_inventar))`, fără predicat pe `deleted_at` — iar `inventory_items`
nici n-are `deleted_at`, deliberat. „LT-0012" și „lt-0012 " sunt același obiect.

**Predarea concurentă a aceluiași obiect eșuează, corect.** Constrângerea de excludere
GiST pe `(item_id, tstzrange(predat_la, returnat_la))` face imposibilă a doua alocare
deschisă. Doi oameni care predau simultan același laptop: unul primește `23P01`.

**Returnarea cu starea „defect" NU duce obiectul în stoc**, ci în `in_reparatie`, de
unde nu iese decât printr-un gest explicit. Regula e a triggerului rescris în
`0019_fix_inventar.sql`, nu a ecranului.

**Citirea alocărilor vede mai mult decât poate scrie UPDATE-ul:** o politică adăugată în
`0014_checklist.sql` deschide alocările oricui are `checklists:update = team`.

**`hr` are `inventory:update = all`; `manager` și `employee` au doar `read`**, pe `team`
respectiv `own`. Absența lui `update` înseamnă că niciun buton de scriere nu se
randează, iar dacă s-ar randa, baza ar refuza tăcut.

## Erori traduse

`src/app/(app)/inventar/erori.ts`: `23P01` (obiect deja predat, cu numele deținătorului
și momentul), `23505` (număr de inventar duplicat), `P0001` (mesajul triggerului, deja
în română). Restul se re-aruncă.

## Ce se mișcă împreună

Cele douăsprezece câmpuri ale obiectului trăiesc în **trei locuri care trebuie să
rămână sincronizate**: `campuriObiect` (schema), `CAMPURI_FISA` (contorul de
completitudine) și `valoriObiect` (adaptorul `FormData`). Poarta care le leagă e
`valori-obiect.test.ts` — compară cheile adaptorului cu lista din domeniu.

`campuri-obiect.tsx` e folosit de amândouă casetele, adăugare și modificare. O coloană
nouă cere: migrare → tipuri → `campuriObiect` → `CAMPURI_FISA` → `valoriObiect` →
`CampuriObiect` → `ListaDefinitii` de pe fișă.

Offboarding-ul depinde de `returnat_la IS NULL`: un checklist cu obiecte nereturnate nu
se finalizează. Ticketing-ul afișează defecțiunile pe fișa obiectului, dacă modulul e
activ.

## Ce NU e aici

Importul din Excel — tabelele `inventory_import_batches` / rândurile lor există în
schemă, cu RPC de revocare, dar **niciun ecran nu le folosește**. La fel
`app.aloca_numar_inventar`: numerotarea atomică din `document_sequences` e scrisă și
neapelată.

`pv_document_path` se citește în mai multe locuri și nu se scrie nicăieri: procesul-verbal
se randează ca pagină tipăribilă, nu se generează ca fișier în Storage.

`inventory_items` n-are `casat_la`. Cronologia scrie punctul de casare fără dată;
`updated_at` nu-i ține locul, fiindcă se mișcă la orice editare ulterioară.

## Când NU e suficientă pagina asta

Când un rol vede un ecran gol și nu știi dacă e RLS sau o listă chiar goală: proba
empirică per rol, nu raționamentul. Când atingi politicile, citește migrarea
`0010_inventory.sql` — ordinea secțiunilor și bucla de granturi nu se reproduc din
memorie.
