---
tip: modul
titlu: Angajați — documentele emise și șabloanele lor
aliases: [sabloane documente, hr_document_templates, antet documente, sigla]
cai:
  - "src/app/(app)/angajati/sabloane-documente/**"
  - "src/app/(app)/angajati/[id]/documente/**"
  - "src/lib/documents/**"
  - "src/lib/pdf/din-html.ts"
tabele: [hr_document_templates, hr_issued_documents, organization_branding, employees]
permisiuni: [employees:read, employees:create, employees:update, employees:delete, branding:update]
capcane: []
scris_pe: cd77c37564a0a2474dda087e9d2ec85035b57e46
scris_la: 2026-10-25
tags: [modul, hr, nucleu]
---

# Angajați — documentele emise și șabloanele lor

Secțiune extrasă din [[modul/angajati]] (pagina principală e la plafon): editorul de
șabloane, emiterea și antetul tipărit al firmei.

## Șabloanele

- **Șabloanele sunt DATE, nu cod**: `hr_document_templates.continut_html`, HTML cu
  `{{variabila}}`. Rândul cu `organization_id is null` e seedul de platformă și e
  **intangibil** — `with check` cere `organization_id is not null`, deci editarea lui dă
  zero rânduri, nu eroare. Editarea din `/angajati/sabloane-documente` clonează seedul în
  rândul firmei la prima salvare; generatorul preferă automat varianta firmei
  (`generator.ts:76-77`). Nu `.upsert()`: indexurile sunt PARȚIALE, deci 42P10.
- **O variabilă inventată într-un șablon nu strică o emitere, ci TOATE emiterile**
  viitoare ale acelui document — `genereazaDocument` aruncă la prima variabilă fără
  valoare. Mulțimea validă e `VARIABILE_PER_COD` din `src/lib/documents/variabile.ts`,
  verificată la salvare. Cele trei copii ale listei (SQL-ul migrărilor, hărțile din
  `valori-inrolare.ts`, constanta) sunt legate între ele de `valori-inrolare.test.ts`.
- **HTML-ul de șablon NU e evadat** la randare: `randeaza` evadează doar valorile
  interpolate, iar `paginaTiparibila` îl inserează brut într-o pagină servită de
  `/documente/[id]`. De când firmele îl pot edita, singura apărare e `curataHtml`, care
  RECONSTRUIEȘTE marcajul din șapte etichete și zero atribute
  (`src/lib/documents/curata-html.ts`). Aceeași mulțime de șapte e și contractul cu
  `src/lib/pdf/din-html.ts` și cu bara editorului; cele trei se schimbă împreună.
- **Regenerarea nu suprascrie**: emite un document nou și îl marchează pe cel vechi
  `anulat_la`. Întâi emite, apoi anulează — invers, un eșec de emitere ar lăsa angajatul
  fără document valid. Acțiunea declară `employees:create` (cerut de `hr_issued_insert`),
  dar anularea trece prin `hr_issued_update`, care cere `employees:update`. Probat
  empiric în `tests/rls/proba-sabloane-documente.sql`, nu dedus.

## Documentul propriu al firmei

`creeazaSablonPersonalizat` (`/angajati/sabloane-documente/nou`, `employees:create = all`,
ca `hr_templates_insert`) adaugă un document care nu există în catalogul platformei. Codul
tehnic se DEDUCE din denumire, nu se cere: pe cod ocupat se încearcă sufixe numerice, iar
`hr_templates_org_uniq` fiind index PARȚIAL, un rând șters nu ține codul blocat — o
coliziune 23505 cu altă sesiune se reia pe sufixul următor. `restabilesteSablonPlatforma`
e ștergere logică prin `stergeLogic` (UPDATE direct pe `deleted_at` pica mereu cu 42501,
`0164`), iar documentele DEJA emise nu se schimbă: fiecare poartă textul cu care a fost
emis.

## Antetul tipărit și sigla

Antetul și sigla stau pe `organization_branding`, cu cheie proprie — `branding:update`
(`salveazaAntetDocumente`, `pregatesteSigla`, `salveazaSigla`, `stergeSigla`): ecranul se
deschide la `employees:update = all`, dar caseta rămâne read-only fără ea, iar datele de
identificare ale firmei cer `organizations:update`.

- **Scrierea e „UPDATE dacă există, altfel INSERT”, cu `.select()` obligatoriu** — un
  UPDATE respins de `USING` afectează zero rânduri FĂRĂ eroare, deci refuzul ar fi arătat
  exact ca o salvare reușită.
- **Calea siglei are exact forma `{org}/branding/logo/…`** (`app.path_resource` cere
  patru segmente, iar segmentul de resursă e verificat de `app.can_path`), și acțiunea
  refuză o cale din afara prefixului firmei apelantului.
- **Ce a declarat browserul la semnare nu e crezut**: obiectul se măsoară în Storage și i
  se compară primii octeți cu tipul, fiindcă `pdf-lib` nu poate încorpora decât PNG/JPEG
  adevărate — altfel sigla dispărea tăcut din PDF. Fișierul respins sau scos rămâne în
  bucket: nicio politică DELETE pe `storage.objects`.
