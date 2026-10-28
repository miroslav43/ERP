---
tip: modul
titlu: Concedii — documentul justificativ
aliases: [concedii-documente, atasament-concediu]
cai:
  - "src/app/(app)/concedii/actions.ts"
  - "src/app/(app)/concedii/incarcare-document.tsx"
  - "src/lib/documents/cale.ts"
  - "src/lib/storage/semnatura.ts"
  - "src/lib/storage/masoara-obiectul.ts"
tabele: [leave_requests, leave_types]
permisiuni: [leave:read, leave:create]
feature: leave
capcane: [3]
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [modul, hr]
---

# Concedii — documentul justificativ

Secțiune extrasă din [[modul/concedii]]: ce refuză tăcut baza — și Storage — în jurul
atașamentului unei cereri. Drumul octeților, de la URL-ul semnat până în rând, e în
[[modul/concedii/actiuni]].

## Ce refuză baza tăcut

- **Cerința de atașament nu lovește toate tipurile la fel.**
  `internal.leave_requests_pregateste` ridică P0001 la trimiterea unui tip cu
  `necesita_document` doar dacă `atasament_path` e gol **și** `medical_code_id` e null —
  un ecran fără încărcare de fișier lasă deci să treacă tipurile cu cod de indemnizație și
  blochează restul, fără ca diferența să apară nicăieri. Scutite explicit: cheile din
  `TIPURI_CU_ORIGINAL_FIZIC`. — `supabase/migrations/0106_concediu_document_original.sql`
- **Segmentul 2 al căii de Storage e un nume de resursă REAL, nu un cuvânt liber.**
  `app.can_path` îl dă direct lui `app.has_permission`, iar un cuvânt absent din
  `role_permissions.resource` întoarce `none` — refuz TĂCUT la fiecare încărcare. Calea
  concediilor e `{org}/leave/{employee_id}/…`, exclusiv prin `construiesteCaleDocument`.
  — `src/lib/documents/cale.ts`, `supabase/migrations/0073_cale_storage_resurse.sql`
- **Calea primită de la client nu se crede pe cuvânt.** Poarta de Storage păzește
  scrierea fișierului, nu referința scrisă în rând, deci `creeazaCerereConcediu` trece
  `atasament_path` prin `caleInPrefix`, nu prin `startsWith`: pe lângă prefixul fișei se
  cer segmente curate — cad segmentul gol, `.`, `..` și formele lor procent-codificate. La
  citire, zero rânduri sub politica de SELECT nu se deosebesc de „nu există": ambele ies
  ca același `notFound`. — `verificaCaleaDocumentului` și `linkDocumentConcediu`, în
  `src/app/(app)/concedii/actions.ts`
- **Nici octeții nu se cred pe cuvânt, iar respingerea lor ȘTERGE obiectul.**
  `verificaDocumentulAtasat` rulează imediat după verificarea căii și înaintea oricărei
  citiri a tipului de concediu: măsoară obiectul (`masoaraObiectul`), îi citește capul
  (`citestePrimiiOcteti`) și compară semnătura cu tipul măsurat, totul sub sesiunea
  apelantului — tipul declarat de browser nu contează. Ce nu se potrivește iese ca
  VALIDARE pe `atasament_path`, iar fișierul e scos din bucket cu clientul de serviciu,
  fiindcă `storage.objects` n-are politică DELETE. De aceea `IncarcareDocumentConcediu`
  golește calea din câmpul ascuns și remontează inputul (`key`) la o respingere a
  serverului: o retrimitere pe aceeași cale ar lovi un obiect deja șters. Verificarea din
  browser, înaintea urcării, e curtoazie, nu poartă.
  — `src/app/(app)/concedii/actions.ts`, `src/lib/storage/semnatura.ts`
- **`traduEroare` ÎNTOARCE eroarea, nu o aruncă** (invers față de rudele din alte module):
  fiecare apel se scrie `throw traduEroare(e)`. Fără `throw`, o eroare de citire a cererii
  ieșea pe ecran ca document lipsă, prin `notFound`-ul de mai sus.
  — `src/app/(app)/concedii/erori.ts`, capcana #3

## Ce NU e aici

Contractul de cale în Storage (bucket, entități, limită, MIME) stă în
`src/lib/documents/cale.ts`, comun cu `[[modul/angajati]]`.
