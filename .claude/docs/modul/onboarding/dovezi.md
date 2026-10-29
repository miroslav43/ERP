---
tip: modul
titlu: Integrare (onboarding) — dovada de pas
cai:
  - "src/app/(app)/onboarding/**"
  - "src/lib/onboarding/cale.ts"
  - "src/lib/storage/**"
  - "src/schemas/checklist.ts"
tabele: [checklist_instance_items]
permisiuni: [checklists:read, checklists:update]
capcane: [53]
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul, hr]
---

# Integrare (onboarding) — dovada de pas

Secțiune extrasă din [[modul/onboarding]]: fișierul atașat unui pas, cei trei timpi ai
încărcării și ce nu se crede de la client.

Trei timpi: `pregatesteIncarcareDovada` întoarce `cale` + `urlSemnat`
(`createSignedUploadUrl`), browserul urcă octeții cu `urcaPeUrlSemnat` — un `PUT`
obișnuit, nu clientul Supabase din browser —, iar `salveazaDovada` scrie rândul.

- **Un fișier urcat în pas satisface dovada de tip `document`.** Triggerul din `0092`,
  `dovadaLipseste` din `pas-checklist.tsx` și pre-verificarea din `bifeazaPas` trebuie să
  spună același lucru — de aceea handlerul citește și `dovada_fisier_path`, nu doar
  `tip_dovada`: altfel bifarea era respinsă cu VALIDARE exact după gestul cerut.
- **Calea se re-verifică cu `caleInPrefix`, nu cu `startsWith`.** Prefixul include PASUL,
  ca poarta de aplicație să nu fie mai laxă decât `app.checklist_poate_dovada`, iar
  `caleInPrefix` respinge în plus segmentele goale și `.`/`..`, inclusiv
  procent-codificate — pe care un `startsWith` le lasă să treacă.
- **`mime` și `marime_bytes` din `input` NU ajung în rând.** Sunt doar ce a declarat
  browserul înainte să urce ceva, iar tokenul semnat nu le fixează; rămân în allow-list-ul
  de audit, atât. Rândul se scrie cu ce raportează Storage prin `masoaraObiectul`, trecut
  din nou prin `verificaDovada` **pe server** — deci un fișier care a trecut de
  verificarea din browser poate fi respins abia la înregistrare.
- **Mărimea e măsurată, tipul declarat nu mai e crezut pe cuvânt.** `content_type` de la
  Storage e tot antetul cu care s-a urcat obiectul, deci 1024 de zerouri numite `.pdf`
  trec și de `verificaDovada`. După ea, `salveazaDovada` citește primii octeți ai
  obiectului DEJA urcat (`citestePrimiiOcteti` — un URL semnat pe 60 de secunde plus un
  `fetch` cu `Range: bytes=0-4095`, **sub sesiunea apelantului**, nu `service_role`) și îi
  compară cu `potrivesteSemnatura`. Refuzul e VALIDARE pe câmpul `cale`, cu
  `MESAJ_CONTINUT_NEPOTRIVIT`. Un `null` la citire — obiect lipsă, sau pe care apelantul
  nu-l poate citi înapoi — se tratează la fel ca „nu e ce pretinde".
- **Browserul pre-verifică doar mărimea și tipul declarat.** `incarcare-dovada.tsx` cheamă
  `verificaDovada` pe `File` înainte de orice drum la server, dar nu se uită în octeți: un
  fișier cu conținut nepotrivit urcă întreg, cei 20 MB inclusiv, și cade abia la
  înregistrare. Câmpul e `IncarcareFisier`, remontat cu o `key` de generație după o
  încărcare reușită (altfel numele rămas în câmp ar părea o a doua dovadă).
- **`src/lib/storage/semnatura.ts` e pur, `src/lib/storage/primii-octeti.ts` e
  `server-only`.** Separarea e deliberată: componentele client care pre-verifică semnătura
  (dosarul, concediile) importă doar primul, fiindcă un import al celui de-al doilea dintr-o
  componentă client cade doar la build și la `pnpm check:server` — capcana #53. `semnatura.ts`
  își declară în antet limitele asumate: Word și Excel se recunosc după antetul ZIP, deci
  orice arhivă redenumită trece, iar HEIC și MP4 împart caseta `ftyp`.
- **Obiectul rămâne în bucket când rândul nu se scrie.** Ecranul nu șterge nimic de pe
  client — curățarea trece prin `service_role`, după audit —, ci cere reluarea încărcării.
  La fel pentru fișierul respins pentru conținut.
