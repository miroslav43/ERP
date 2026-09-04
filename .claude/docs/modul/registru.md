---
tip: modul
titlu: Registrul de documente
aliases: [registru, inregistrare, numar-de-inregistrare]
cai:
  - "src/app/(app)/registru/**"
  - "src/lib/queries/registru.ts"
  - "supabase/migrations/0120_registru_documente.sql"
  - "supabase/migrations/0124_registru_backfill.sql"
tabele: [registru_documente, registru_exercitii, document_sequences]
permisiuni: [registru:read, registru:export, registru:update]
capcane: [2, 17]
citeste_daca:
  - "index fără `where deleted_at is null` care pare o scăpare → secțiunea „fără ștergere logică”"
  - "„Registrul pe anul X este închis” → secțiunea exercițiului"
scris_pe: f11e9ac903a57ab4e46972c1953c5f2685fdadaa
scris_la: 2026-09-03
tags: [modul]
---

# Registrul de documente

Orice document produs de aplicație primește un număr în formatul `437/02.09.2026`, dintr-un
registru **unic pe firmă**, cu contorul resetat la 1 ianuarie. Temeiul e citat în antetul
migrării: Legea 16/1996 art. 7 (de unde vine enumul `sens`), Ordinul 217/1996 art. 9
(coloanele și resetarea anuală), OMFP 2634/2015 pct. 24 și 58.

Specificația completă:
`docs/superpowers/specs/2026-09-03-registru-inregistrare-documente-design.md`.

## Rute și cine ajunge

| Rută                | Poartă                    |
| ------------------- | ------------------------- |
| `/registru`         | `registru:read` **all**   |
| `/registru/listare` | `registru:export` **all** |

Ambele sub `requireFeature(..., "nucleu")`. Din seed-ul lui `0120`: `super_admin` și
`org_admin` au `read`, `export` și `update`; `hr` are `read` și `export`, **fără**
`update`. `manager` și `employee` n-au niciun rând — absența permisiunii ESTE refuzul.

## Înregistrarea e în trigger, nu într-un apel din interfață

Un `employee` care depune o cerere de concediu produce o **intrare** în registru. Deci
alocatorul nu poate fi păzit de `registru:*` — angajatul n-are cheia aia și nici n-ar
trebui s-o aibă.

Soluția: înregistrarea se face din trigger `after insert` pe tabela sursă. Dreptul care
contează e dreptul de a scrie **documentul**, verificat deja de RLS-ul acelei tabele.
`internal.inregistreaza_document` e `security definer` și **revocată complet** de la
`authenticated` — nu se poate chema din TypeScript.

Câștigul: niciun ecran nu poate „uita" să înregistreze. „Orice document are număr" devine
structural, nu disciplină de programator. Triggerele se numesc `zz_*` ca să ruleze după
celelalte pe aceeași tabelă.

Conectate azi: `hr_issued_documents` și `employment_contracts`. Celelalte paisprezece
puncte — inventar, diurnă, salarizare, SSM, concedii, cursuri, puncte de lucru — vin în
tura următoare.

## Registrul NU are `deleted_at`

**Abatere deliberată** de la tiparul proiectului, unde orice tabelă are ștergere logică și
indexuri **parțiale** `where deleted_at is null`.

OMFP pct. 58 lit. d) cere liste „numerotate în ordine cronologică, interzicându-se inserări,
intercalări, precum și orice eliminări sau adăugări ulterioare". Un rând de registru nu se
șterge — se **anulează** (`anulat_la` + `motiv_anulare`), ca la `hr_issued_documents`.

Consecința pentru cine scrie cod aici: **indexurile nu sunt parțiale**, iar lipsa
predicatului e intenționată. Cine copiază tiparul din `0013_attendance.sql` în altă tabelă
trebuie să pună `where deleted_at is null` la loc.

## Ce refuză baza

- **Un exercițiu închis blochează totul, inclusiv anularea.**
  `internal.registru_verifica_exercitiu` ridică P0001 la orice INSERT sau UPDATE pe un an
  cu `stare = 'inchis'` — pct. 58 lit. h). Un document anulat după închidere ar schimba un
  registru deja listat la control.
- **Coloanele de identitate ale rândului se rescriu din OLD.** `guard_registru_documente`
  pinuiește `numar_afisat`, `data_inregistrare`, `sens`, `tip_document`, `entitate_tip`,
  `entitate_id`, `inregistrat_retroactiv` și `created_at`. Trimise de client, sunt ignorate
  tăcut, nu respinse — se poate schimba doar ce ține de anulare.
- **`amprenta`** e un SHA-256 peste registrul anului, scris la închidere: pct. 58 lit. d)
  interzice adăugările ulterioare, iar amprenta le face **detectabile**. Mecanica e cea de
  la `hr_issued_documents.continut_checksum`.

## ⚠️ De ce alocatorul nu cheamă `lpad`

Capcană deja documentată la `0098` și repetată identic aici. În PostgreSQL `lpad`
**TAIE** când șirul e mai lung decât lungimea cerută:

```
lpad('9',  1, '0') → '9'
lpad('10', 1, '0') → '1'      ← verificat pe baza proiectului
```

Registrul are `padding = 1`. Cu `lpad`, de la al **zecelea** document al anului numărul s-ar
trunchia la „1", ar coliziona pe indexul unic, iar reîncercările ar arde numere la fiecare
apăsare până la epuizare — adică „numerotarea e ocupată", permanent, tot restul anului. Se
concatenează direct.

**Golurile sunt permise, repetările nu** — aceeași regulă ca la marcă (`0033`), tichete
(`0047`) și contracte (`0098`).

## Ce se mișcă împreună

Alocatorul refolosește `public.document_sequences` cu `document_type = 'registru_general'`,
al patrulea consumator al aceleiași mecanici. Anul face parte din cheia unică
`(organization_id, document_type, year)`, deci **resetarea pe 1 ianuarie vine din
construcție**, nu dintr-un job programat.

`numar_de_pornire` din `registru_exercitii` există fiindcă OMFP pct. 24 cere ca procedura
proprie să declare, pentru fiecare exercițiu, numărul de la care se emite primul document —
o firmă migrată din alt sistem nu pornește de la 1.

`0124_registru_backfill.sql` a adus în registru documentele emise în anul curent **înainte**
ca triggerele să existe, în ordinea datei lor: un registru pe 2026 care începe în septembrie
nu e un registru, e o listă care începe de la mijloc.

## Ce refuză citirea tăcut

- **`max_rows = 1000` trunchiază tăcut**, iar exportul are propriul plafon,
  `MAX_RANDURI_EXPORT`. Listarea folosește cursor pe numărul de înregistrare
  (`codificaCursor` / `decodificaCursor`), nu `.range()`. — capcana #2

## Când NU e suficientă pagina asta

- Textul actelor și decizia completă: specificația din `docs/superpowers/specs/`.
- Documentele de personal care produc intrări: [[modul/angajati]].
