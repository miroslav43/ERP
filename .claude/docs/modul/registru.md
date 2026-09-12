---
tip: modul
titlu: Registrul de documente
aliases: [registru, inregistrare, numar-de-inregistrare]
cai:
  - "src/app/(app)/registru/**"
  - "src/lib/queries/registru.ts"
  - "src/lib/queries/nomenclator.ts"
  - "src/lib/registru/document-generat.ts"
  - "src/schemas/registru.ts"
  - "supabase/migrations/0120_registru_documente.sql"
  - "supabase/migrations/0124_registru_backfill.sql"
  - "supabase/migrations/0135_registru_nomenclator_si_rezolvare.sql"
  - "supabase/migrations/0136_registru_conectare_totala.sql"
  - "supabase/migrations/0140_registru_data_si_numar_document.sql"
  - "supabase/migrations/0141_registru_indicativ_retroactiv.sql"
  - "supabase/migrations/0142_registru_doar_ce_cere_legea.sql"
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
capcane: [2, 17, 41, 42]
citeste_daca:
  - "index fără `where deleted_at is null` care pare o scăpare → secțiunea „fără ștergere logică”"
  - "„Registrul pe anul X este închis” → secțiunea exercițiului"
  - "42501 pe un `.insert()` în `registru_documente` → secțiunea celor trei drumuri"
scris_pe: 90b099aea9f6b9cc51ce16b42bef95bc1e83348e
scris_la: 2026-09-12
tags: [modul]
---

# Registrul de documente

Orice document produs de aplicație primește un număr în formatul `437/02.09.2026`, dintr-un
registru **unic pe firmă**, cu contorul resetat la 1 ianuarie. Temeiul e citat în antetul
migrării: Legea 16/1996 art. 7 (de unde vine enumul `sens`), Ordinul 217/1996 art. 9
(coloanele și resetarea anuală), OMFP 2634/2015 pct. 24 și 58.

Specificațiile, în `docs/superpowers/specs/`: `2026-09-03-registru-inregistrare-documente-design.md`
și `2026-09-10-registru-acoperire-totala-design.md` (nomenclator, indicativ, răspunsuri, surse).

## Rute și cine ajunge

| Rută                    | Poartă                    |
| ----------------------- | ------------------------- |
| `/registru`             | `registru:read` **all**   |
| `/registru/listare`     | `registru:export` **all** |
| `/registru/nomenclator` | `registru:read` **all**   |

Toate sub `requireFeature(..., "nucleu")`. Din seed-ul lui `0120`: `super_admin` și
`org_admin` au `read`, `export` și `update`; `hr` are `read` și `export`, **fără** `update`.
`manager` și `employee` n-au niciun rând — absența permisiunii ESTE refuzul. Nomenclatorul
se **scrie** cu `registru:update` (`0135` §5, pe `nomenclator_dosare`, `nomenclator_tipuri`,
`nomenclator_config`): aceleași chei ca registrul, fiindcă indicativul e o coloană de
registru.

## Trei drumuri către un număr, niciunul prin `.insert()`

Un `employee` care depune o cerere de concediu produce o **intrare** în registru. Deci
alocatorul nu poate fi păzit de `registru:*` — angajatul n-are cheia aia și nici n-ar
trebui s-o aibă. De aici trei drumuri, toate cu alocarea numărului **în bază**:

1. **Trigger pe tabela sursă.** Dreptul care contează e dreptul de a scrie **documentul**,
   verificat deja de RLS-ul acelei tabele. `internal.inregistreaza_document` e
   `security definer` și **revocată complet** de la `authenticated` — nu se cheamă din
   TypeScript. Triggerele se numesc `zz_*` ca să ruleze după celelalte pe aceeași tabelă.
2. **Documentele generate la cerere**, fără rând în bază și deci fără INSERT pe care să pui
   trigger (stat de plată, fluturaș, D112, notă contabilă, ordin bancar, foaie colectivă):
   `public.inregistreaza_document_generat`, prin `inregistreazaDocumentGenerat`
   (`src/lib/registru/document-generat.ts`). Poarta **nu** e `registru:*`, ci permisiunea
   modulului, dedusă din tip printr-un `case`; un tip necunoscut ridică P0001, nu alocă
   tăcut. `entitateId` face regenerarea idempotentă. Fără număr, fără document: eșecul
   înregistrării oprește exportul.
3. **Înregistrarea manuală**, pentru ce vine pe hârtie — art. 8. Vezi acțiunile mai jos.

Sursele drumului 1 nu se mai caută prin triggere: `internal.registru_config_surse()` e harta
unică din care se creează **și** triggerele, **și** backfill-ul, deci nu pot diverge —
`select * from internal.registru_config_surse()` spune ce e conectat azi. Sursele cu status
se înregistrează la **tranziția** către starea în care documentul există, nu la inserare: o
cerere de concediu în ciornă nu e un document.

Simetric, `0142` a scos din hartă ce **nu** e document — invitația de înrolare, anunțul de
pe avizier, sesizarea de defecțiune, lista de integrare, afișul de punct de lucru, listarea
de audit. Criteriul: intră ce e numit de un act normativ sau ce poate fi cerut într-un
control. Rândurile deja scrise s-au **anulat**, nu s-au șters.

## Server Actions

`src/app/(app)/registru/actions.ts` — toate prin `.rpc()` sau prin `.update()` cu
`.select()`, niciuna cu `.insert()` în registru.

| Acțiune                        | `name`                       | Poartă                     |
| ------------------------------ | ---------------------------- | -------------------------- |
| `inregistreazaDocumentManual`  | `registru.manual`            | `registru:update` all      |
| `inchideExercitiu`             | `registru.close_year`        | `registru:update` all      |
| `redeschideExercitiu`          | `registru.reopen_year`       | `organizations:update` all |
| `actualizeazaDosarNomenclator` | `registru.nomenclator_dosar` | `registru:update` all      |
| `actualizeazaAvizNomenclator`  | `registru.nomenclator_aviz`  | `registru:update` all      |

Redeschiderea are pragul mai sus decât închiderea fiindcă rupe o listare care poate fi deja
la un control; amprenta veche **nu** se șterge, ca diferența să rămână demonstrabilă.
⚠️ `inchideExercitiu` și `redeschideExercitiu` n-au azi **niciun apelant** în interfață:
acțiunile există, ecranul care le cheamă nu.

`traduEroare` (`registru/erori.ts`, tiparul din `ssm/erori.ts`) propagă P0001 cu mesajul
bazei, trunchiat la 300 de caractere. Fără el, `mapPostgrestError` ar înlocui „Registrul pe
anul X este închis." cu un mesaj generic, iar cine ține registrul n-ar afla ce să corecteze.

## Registrul NU are `deleted_at`

**Abatere deliberată** de la tiparul proiectului, unde orice tabelă are ștergere logică și
indexuri **parțiale** `where deleted_at is null`. OMFP pct. 58 lit. d) cere liste
„numerotate în ordine cronologică, interzicându-se inserări, intercalări, precum și orice
eliminări sau adăugări ulterioare". Un rând de registru nu se șterge — se **anulează**
(`anulat_la` + `motiv_anulare`), ca la `hr_issued_documents`.

Consecința pentru cine scrie cod aici: **indexurile nu sunt parțiale**, iar lipsa
predicatului e intenționată; cine copiază tiparul din `0013_attendance.sql` în altă tabelă
pune `where deleted_at is null` la loc. Abaterea e **numai a registrului** — tabelele
nomenclatorului au `deleted_at` și indexuri parțiale ca oriunde altundeva (`0135` §3).

## Ce refuză baza

- **Inserarea directă în registru e închisă.** `0135` §14 retrage politica INSERT și revocă
  grantul: un număr venit din client s-ar putea fabrica sau repeta, contra pct. 58 lit. o).
  Un `.insert()` pe `registru_documente` nu dă o eroare de tip, ci **42501** la execuție.
- **Răspunsul nu ia număr nou** — art. 9. `internal.rezolva_document` nu alocă număr și nu
  inserează rând: completează `data_expedierii`, `mod_rezolvare`, `destinatar` și
  `rezolvat_la` pe rândul cererii. Un rând per caz.
- **`nomenclator_dosare.indicativ` e coloană GENERATĂ** din cifra romană, literă și cifra
  arabă (art. 11). Un UPDATE peste ea e **respins**, nu ignorat tăcut — de aceea lipsește
  din `dosarNomenclatorSchema`, unde firma schimbă doar conținutul și termenul.
- **Un exercițiu închis blochează totul, inclusiv anularea.**
  `internal.registru_verifica_exercitiu` ridică P0001 la orice INSERT sau UPDATE pe un an
  cu `stare = 'inchis'` — pct. 58 lit. h). Un document anulat după închidere ar schimba un
  registru deja listat la control.
- **Coloanele de identitate ale rândului se rescriu din OLD.** `guard_registru_documente`
  pinuiește `numar_afisat`, `data_inregistrare`, `sens`, `tip_document`, `entitate_tip`,
  `entitate_id`, `inregistrat_retroactiv` și `created_at` — trimise de client, sunt ignorate
  tăcut, nu respinse. Ce **nu** pinuiește contează la fel: `numar_document_emitent`,
  `data_document_emitent` și `indicativ_dosar` rămân corectabile, iar pe asta s-au sprijinit
  `0140` și `0141` ca să repare rubrici greșite fără să atingă numerotarea.
- **`amprenta`** e un SHA-256 peste registrul anului, scris la închidere: pct. 58 lit. d)
  interzice adăugările ulterioare, iar amprenta le face **detectabile**. Mecanica e cea de
  la `hr_issued_documents.continut_checksum`.

## ⚠️ De ce alocatorul nu cheamă `lpad`

Capcană documentată la `0098` și repetată identic aici: `lpad` **TAIE** când șirul e mai lung
decât lungimea cerută — `lpad('10', 1, '0')` → `'1'`, verificat pe baza proiectului. Registrul
are `padding = 1`, deci de la al **zecelea** document al anului numărul s-ar trunchia la „1",
ar coliziona pe indexul unic, iar reîncercările ar arde numere până la epuizare — „numerotarea
e ocupată", tot restul anului. Se concatenează direct. **Golurile sunt permise, repetările
nu** — ca la marcă (`0033`), tichete (`0047`) și contracte (`0098`).

## Ce se mișcă împreună

Alocatorul refolosește `public.document_sequences` cu `document_type = 'registru_general'`.
Anul face parte din cheia unică `(organization_id, document_type, year)`, deci **resetarea
pe 1 ianuarie vine din construcție**, nu dintr-un job programat. `numar_de_pornire` din
`registru_exercitii` există fiindcă OMFP pct. 24 cere ca procedura proprie să declare,
pentru fiecare exercițiu, numărul primului document — o firmă migrată din alt sistem nu
pornește de la 1.

`0124_registru_backfill.sql` a adus documentele emise în anul curent **înainte** ca
triggerele să existe, în ordinea datei lor: un registru pe 2026 care începe în septembrie nu
e un registru, e o listă care începe de la mijloc.

Nomenclatorul implicit se seamănă per firmă (`internal.seed_nomenclator`), firmele noi îl
primesc dintr-un trigger pe `organizations`, iar din el vine `indicativ_dosar`, completat de
alocator din `nomenclator_tipuri`. Rândurile scrise înainte să existe nomenclatorul le-a
completat `0141`, care **ocolește exercițiile închise** în loc să cadă pe garda lor.

⚠️ Două reguli pentru cine atinge mecanica: harta surselor se rescrie **întreagă**, nu se
petecește (`0140`, `0142`) — o versiune peticită în două migrări e exact divergența pe care
`0136` a vrut s-o facă imposibilă; și orice parametru nou pe o funcție de registru cere
`drop function if exists` înainte de `create or replace`, altfel iese o supraîncărcare, iar
triggerele care cheamă cu argumente numite cad la execuție — capcana #41, plătită aici.

## Ce refuză citirea tăcut

- **`max_rows = 1000` trunchiază tăcut**, iar exportul are propriul plafon,
  `MAX_RANDURI_EXPORT`. Listarea folosește cursor pe numărul de înregistrare
  (`codificaCursor` / `decodificaCursor`), nu `.range()`. — capcana #2
- **Nomenclatorul NU e paginat**, deliberat: se citește întreg, ca formularul din anexa
  nr. 1. Plafonul rămâne explicit — `MAX_DOSARE` — ca trunchierea să nu fie tăcută.
  Ordonarea pe `compartiment_cifra` e alfabetică: corectă până la „VIII", greșită de la
  „IX" în sus.
- **`indicativ_dosar` gol nu e o eroare** — art. 9 îl vrea completat „după rezolvarea
  documentului", iar un tip neclasat în nomenclator n-are niciunul. Ecranul arată „—".
- **`hr` ajunge pe `/registru/nomenclator`, fără să poată schimba ceva.** Poarta paginii e
  `registru:read`, iar butonul din antetul lui `/registru` apare doar la `registru:update`.
  Pe URL scris de mână ecranul se încarcă fără nicio acțiune — intenționat, nu o scăpare.

## Când NU e suficientă pagina asta

- Textul actelor și decizia completă: specificațiile din `docs/superpowers/specs/`.
- Ce e conectat azi și cu ce coloane: `select * from internal.registru_config_surse()`.
- Documentele de personal care produc intrări: [[modul/angajati]].
- ⚠️ Termenele de păstrare din nomenclatorul implicit sunt un punct de plecare, nu un
  aviz — `NOTES.md` le ține la valorile ⚠️ de confirmat de contabil sau jurist.
