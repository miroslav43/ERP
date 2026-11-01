---
tip: modul
titlu: Registrul de documente
aliases: [registru, inregistrare, numar-de-inregistrare]
cai:
  - "src/app/(app)/registru/**"
  - "src/lib/queries/registru.ts"
  - "src/lib/queries/nomenclator.ts"
  - "src/lib/registru/document-generat.ts"
  - "src/lib/registru/filtre.ts"
  - "src/components/registru/numar-registru.tsx"
  - "src/schemas/registru.ts"
  - "supabase/migrations/0120_registru_documente.sql"
  - "supabase/migrations/0135_registru_nomenclator_si_rezolvare.sql"
  - "supabase/migrations/0142_registru_doar_ce_cere_legea.sql"
  - "supabase/migrations/0184_registru_angajat.sql"
  - "supabase/migrations/0185_registru_angajat_garda.sql"
tabele:
  [
    registru_documente,
    registru_exercitii,
    nomenclator_dosare,
    nomenclator_tipuri,
    nomenclator_config,
    document_sequences,
  ]
permisiuni: [registru:read, registru:export, registru:update, organizations:update]
capcane: [12, 17, 41, 42]
citeste_daca:
  - "index fără `where deleted_at is null` care pare o scăpare → secțiunea „fără ștergere logică”"
  - "„Registrul pe anul X este închis” → secțiunea exercițiului"
  - "42501 pe un `.insert()` în `registru_documente` → secțiunea celor trei drumuri"
scris_pe: c78f84c1a25c63c9490dcfe8104b51bf51aff507
scris_la: 2026-11-01
tags: [modul]
---

# Registrul de documente

Orice document produs de aplicație primește un număr în formatul `437/02.09.2026`, dintr-un
registru **unic pe firmă**, cu contorul resetat la 1 ianuarie. Temeiul e citat în antetul
migrării 0120: Legea 16/1996 art. 7 (enumul `sens`), Ordinul 217/1996 art. 9 (coloanele și
resetarea anuală), OMFP 2634/2015 pct. 24 și 58.

Specificațiile, în `docs/superpowers/specs/`: `2026-09-03-registru-inregistrare-documente-design.md`,
`2026-09-10-registru-acoperire-totala-design.md` (nomenclator, indicativ, răspunsuri, surse) și
`2026-10-08-registru-navigare-si-panou-design.md` (angajat, panou, filtre, sortare, grupare).

## Paginile modulului

| Pagină                   | Ce ține                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| [[modul/registru/ecran]] | ecranul `/registru`, panoul, filtrele, legăturile și ce refuză citirea |

## Rute și cine ajunge

| Rută                    | Poartă                    |
| ----------------------- | ------------------------- |
| `/registru`             | `registru:read` **all**   |
| `/registru/listare`     | `registru:export` **all** |
| `/registru/nomenclator` | `registru:read` **all**   |

Toate sub `requireFeature(..., "nucleu")`. Din seed-ul lui `0120`: `super_admin` și
`org_admin` au `read`, `export` și `update`; `hr` are `read` și `export`, **fără** `update`.
`manager` și `employee` n-au niciun rând — absența permisiunii ESTE refuzul. Nomenclatorul
se **scrie** cu `registru:update` (`0135` §5). `hr` ajunge pe `/registru/nomenclator` fără
să poată schimba ceva — intenționat.

## Angajatul e o coloană, nu o deducție (0184, 0185)

`registru_documente.angajat_id` (FK `employees`, `on delete set null`, index neparțial
`(organization_id, an, angajat_id, numar)`) e scrisă de alocator: scriitorul generic o ia din
`col_ang`, trigger-ele dedicate din `new.employee_id`, RPC-ul manual din `p_angajat_id`
opțional. Backfill-ul din 0184 a sărit anii închiși (`registru_verifica_exercitiu` ridică
P0001 și la UPDATE, chiar pentru superuser) și a cerut `exists` pe `employees` — un id orfan
ar fi oprit tot. **0185**: alocatorul însuși refuză cu P0001 un angajat din altă firmă, pe
orice drum (revizuirea de securitate a cerut paritatea, nu doar pe drumul manual). Coloana NU
e pinuită de gardă — rămâne corectabilă, ca `indicativ_dosar`. Nomenclatorul arată contorul
per dosar și duce la `/registru?an&dosar`; fișa angajatului (tab-ul de documente) are „Vezi
în registru". `inregistreaza_document_generat` nu primește angajat: fluturașul rămâne fără.

## Trei drumuri către un număr, niciunul prin `.insert()`

Un `employee` care depune o cerere de concediu produce o **intrare** în registru, deci
alocatorul nu poate fi păzit de `registru:*`. Toate drumurile alocă **în bază**:

1. **Trigger pe tabela sursă.** Dreptul care contează e dreptul de a scrie **documentul**,
   verificat de RLS-ul acelei tabele. `internal.inregistreaza_document` (14 parametri din 0184) e `security definer` și **revocată complet** de la `authenticated`. Triggerele se
   numesc `zz_*` ca să ruleze după celelalte.
2. **Documentele generate la cerere** (stat de plată, fluturaș, D112, notă contabilă, ordin
   bancar, foaie colectivă): `public.inregistreaza_document_generat`, prin
   `inregistreazaDocumentGenerat`. Poarta e permisiunea modulului, dedusă din tip; tip
   necunoscut ridică P0001. `entitateId` face regenerarea idempotentă.
3. **Înregistrarea manuală**, pentru ce vine pe hârtie — art. 8.

`internal.registru_config_surse()` e harta unică din care se creează **și** triggerele,
**și** backfill-ul, **și** backfill-ul lui 0184. Sursele cu status se înregistrează la
**tranziție**, nu la inserare. `0142` a scos ce **nu** e document; rândurile deja scrise
s-au **anulat**, nu șters.

## Server Actions

`actions.ts` — toate prin `.rpc()` sau `.update()` + `.select()`, niciuna cu `.insert()`.

| Acțiune                        | `name`                       | Poartă                     |
| ------------------------------ | ---------------------------- | -------------------------- |
| `inregistreazaDocumentManual`  | `registru.manual`            | `registru:update` all      |
| `inchideExercitiu`             | `registru.close_year`        | `registru:update` all      |
| `redeschideExercitiu`          | `registru.reopen_year`       | `organizations:update` all |
| `actualizeazaDosarNomenclator` | `registru.nomenclator_dosar` | `registru:update` all      |
| `actualizeazaAvizNomenclator`  | `registru.nomenclator_aviz`  | `registru:update` all      |

`inregistreazaDocumentManual` întoarce `numarAfisat`, iar dialogul îl **arată** în toast, cu
acțiune „Arată în registru" spre `?q=<numărul>`: numărul alocat e singurul lucru care trebuie
scris pe hârtie, iar rândul nou poate fi ascuns de filtrele curente.

⚠️ `inchideExercitiu` și `redeschideExercitiu` n-au **niciun apelant** în interfață.
`traduEroare` (`erori.ts`) propagă P0001 cu mesajul bazei; pe 42501 cere ca mesajul să
conțină `registru_documente`. Testele acțiunilor și citirilor rulează pe clientul fals.
`src/schemas/registru.ts` importă `./mesaje-zod`, deci o regulă fără mesaj propriu spune
ceva românesc, nu textul implicit al lui Zod.

## Registrul NU are `deleted_at`

**Abatere deliberată**: OMFP pct. 58 lit. d) interzice eliminările. Un rând se **anulează**
(`anulat_la` + `motiv_anulare`). Consecința: **indexurile nu sunt parțiale**, iar lipsa
predicatului e intenționată — numai pe registru; nomenclatorul are `deleted_at` ca oriunde.

⚠️ Consecința pe care o uită codul: `numereRegistruPentru` (`src/lib/queries/registru.ts`) —
drumul INVERS, de pe fișa documentului-sursă spre rândul lui, folosit de
`src/components/registru/numar-registru.tsx` — filtrează `.is("deleted_at", null)` pe tabela
asta. Un filtru pe o coloană care nu există întoarce **42703**, iar nici `tsc`, nici clientul
fals din teste nu-l prind (capcana #12). Verifică pe staging înainte să te sprijini pe el.

## Ce refuză baza

- **Inserarea directă e închisă** (`0135` §14): un `.insert()` dă **42501** la execuție.
- **Răspunsul nu ia număr nou** (art. 9): `internal.rezolva_document` completează rândul
  cererii. Un rând per caz.
- **`nomenclator_dosare.indicativ` e GENERATĂ** (cifră romană, literă, cifră arabă); un
  UPDATE peste ea e respins.
- **Un exercițiu închis blochează totul, inclusiv anularea** (`registru_verifica_exercitiu`,
  P0001) — pct. 58 lit. h).
- **Garda rescrie din OLD** (forma finală în **0148**, nu 0120): număr, dată, sens, tip,
  entitate, retroactiv, `created_at` **și** rezumat, emitent, destinatar, numărul/data
  emitentului, file, anexe, punct de lucru — trimise de client, sunt ignorate tăcut.
  Corectabile rămân `indicativ_dosar`, `angajat_id`, rezolvarea.
- **`amprenta`** e SHA-256 peste registrul anului, scris la închidere.

## ⚠️ De ce alocatorul nu cheamă `lpad`

`lpad` **TAIE** când șirul e mai lung decât lungimea cerută — `lpad('10', 1, '0')` → `'1'`.
Cu `padding = 1`, de la al zecelea document numărul s-ar trunchia și ar coliziona pe indexul
unic. Se concatenează direct. **Golurile sunt permise, repetările nu.**

## Ce se mișcă împreună

Alocatorul refolosește `document_sequences` cu `document_type = 'registru_general'`; anul e
în cheia unică, deci resetarea vine din construcție. `numar_de_pornire` există fiindcă o
firmă migrată nu pornește de la 1. Nomenclatorul implicit se seamănă per firmă
(`internal.seed_nomenclator`), din el vine `indicativ_dosar`.

⚠️ Harta surselor se rescrie **întreagă** (`0140`, `0142`); orice parametru nou pe o funcție
de registru cere `drop function if exists` înainte de `create or replace` (capcana #41 —
0184 a făcut exact asta la alocator și la RPC-ul manual), iar `drop` șterge și
`comment on function`, care se re-adaugă.

## Când NU e suficientă pagina asta

- Textul actelor și decizia completă: specificațiile de mai sus.
- Ce e conectat azi: `select * from internal.registru_config_surse()`.
- Documentele de personal care produc intrări: [[modul/angajati]].
- ⚠️ Termenele de păstrare din nomenclatorul implicit sunt un punct de plecare, nu un aviz.
- Numărul de registru pe documentele-sursă (`NumarRegistru`) și celulele-filtru: [[strat/navigare]].
