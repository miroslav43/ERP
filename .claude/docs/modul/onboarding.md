---
tip: modul
titlu: Integrare (onboarding)
aliases: [onboarding, integrare, parcurs, checklist]
cai:
  - "src/app/(app)/onboarding/**"
  - "src/lib/queries/checklist.ts"
  - "src/lib/onboarding/cale.ts"
  - "src/lib/storage/**"
  - "src/schemas/checklist.ts"
  - "supabase/migrations/0014_checklist.sql"
  - "supabase/migrations/0088_integrare_defecte.sql"
  - "supabase/migrations/0089_integrare_etape.sql"
tabele:
  [
    checklist_templates,
    checklist_template_items,
    checklist_template_stages,
    checklist_instances,
    checklist_instance_items,
    checklist_completion_records,
  ]
permisiuni: [checklists:read, checklists:create, checklists:update, checklists:approve]
feature: onboarding
capcane: [2, 12]
citeste_daca:
  - "butoanele de închidere lipsesc pe un parcurs în curs → secțiunea Ce refuză baza tăcut"
  - "„Dovada nu există încă” pe un parcurs finalizat → secțiunea Ce refuză baza tăcut"
  - "câmpul de filtru rămâne plin după „Șterge filtrele” → secțiunea Ce se mișcă împreună"
scris_pe: 6e0792e9aa37ea9f4b874d856489a4f0b9344c20
scris_la: 2026-10-29
tags: [modul, hr]
---

# Integrare (onboarding)

Parcursuri pe șablon pentru angajatul nou — predare de echipament, semnături, citit
regulament — cu pași atribuiți unor **responsabili** care nu sunt subiectul parcursului.
La final se emite o dovadă **imutabilă**, cu checksum.

În interfață nu se mai scrie „checklist", ci **parcurs**, iar modulul se numește „Integrare
angajați". Ruta, tabelele, cheile de permisiune și numele acțiunilor au rămas pe
`onboarding`/`checklist`: cele două vocabulare se ating doar în textele de ecran și în
`src/app/(app)/onboarding/etichete.ts` (unde `offboarding` se citește „Plecare din firmă").

## Paginile modulului

| Pagină                       | Ce ține                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| [[modul/onboarding/dovezi]]  | dovada de pas: cei trei timpi ai încărcării și ce nu se crede de la client     |
| [[modul/onboarding/defecte]] | defectele tăcute închise de `0088`, sub codurile din migrare (D1, D4, D6, D10) |

## Rute și cine ajunge

| Rută                                                                            | Poartă                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `/onboarding`                                                                   | `checklists:read` own                                      |
| `/onboarding/noua`                                                              | `checklists:create` all                                    |
| `/onboarding/[id]`                                                              | `checklists:read` own                                      |
| `/onboarding/[id]/dovada`                                                       | `checklists:read` own                                      |
| `/onboarding/sabloane`, `/onboarding/sabloane/nou`, `/onboarding/sabloane/[id]` | `checklists:read` own; scrierea cere `create`/`update` all |
| `/onboarding/sarcinile-mele`                                                    | `checklists:read` own                                      |

Toate intră cu `own`. Ce diferă e booleanul de scriere — plus două porți de pe
`/onboarding/[id]` care NU se citesc din `can()` singur: închiderea parcursului și linkul
spre dovadă (vezi „Ce refuză baza tăcut").

## Server Actions

`src/app/(app)/onboarding/actions.ts`.

| Grup     | Funcții                                                         | Permisiune / minScope       |
| -------- | --------------------------------------------------------------- | --------------------------- |
| Parcurs  | `pornesteInstanta`                                              | `checklists:create` / all   |
| Parcurs  | `finalizeazaInstanta`, `anuleazaInstanta`                       | `checklists:approve` / team |
| Pași     | `bifeazaPas`, `confirmaCitire`                                  | `checklists:update` / own   |
| Dovezi   | `pregatesteIncarcareDovada`, `salveazaDovada`                   | `checklists:update` / own   |
| Dovezi   | `linkDovada`                                                    | `checklists:read` / own     |
| Șabloane | `creeazaSablon`, `salveazaSablon`, `adaugaPas`                  | `checklists:create` / all   |
| Șabloane | `actualizeazaSablon`, `actualizeazaPas`, `stergePas`, `mutaPas` | `checklists:update` / all   |

## Ce refuză baza tăcut

- **`checklist_completion_records` nu are `deleted_at`.** Un `.is("deleted_at", null)` pe
  ea dă **42703**, iar un trigger BEFORE refuză orice UPDATE sau DELETE cu P0001: rândul îl
  scrie exclusiv triggerul de finalizare. `checklist_instance_items` sunt copiate de
  trigger la crearea instanței — nu se inserează din cod. — capcana #12
- **Nicio tabelă `checklist_*` nu are politică DELETE.** Ștergerea e logică peste tot.
- **`checklists:approve` era seedat și citit de zero politici** până la `0088`, care i-a
  dat conținut: e cheia care ÎNCHIDE parcursul (`finalizeazaInstanta`, `anuleazaInstanta`).
- **Cheia `checklists:approve` la scope `team` nu ajunge ca să închizi un parcurs.**
  Politica de UPDATE din `0088` cere, pe lângă cheie, subordonarea față de SUBIECT: un
  manager care vede parcursul doar fiindcă e responsabil de un pas primea butoanele și un
  UPDATE cu zero rânduri. De aceea `/onboarding/[id]` cere în plus ca subiectul să fi venit
  din `angajatiDupaId` (`angajat !== undefined`) — dovada că s-a citit prin subordonare —,
  nu doar `can()`. Pe scope `all`, condiția cade.
- **Pagina dovezii cere aceeași subordonare, nu calitatea de responsabil.** `0088` a adăugat
  ramura de responsabil pe instanțe, nu pe `checklist_completion_records`: fără subordonare
  pagina răspundea „Dovada nu există încă", cu o cauză falsă. Linkul spre ea se arată acum
  doar când `finalizata_la` e nenul ȘI subiectul e vizibil — pe un parcurs în curs sau
  anulat dovada chiar nu există încă.
- **Pașii unui grup de instanțe trec de plafonul PostgREST.** `progresInstante` îi citește
  în buclă cu `.range()`, iar la atingerea plafonului de iterații **aruncă** — procentele
  din semafor s-ar calcula altfel din rânduri tăiate tăcut, fără nicio eroare. — capcana #2

## Ce se mișcă împreună

Materialele de citit refolosesc `course_materials` din [[modul/cursuri]] — nu s-a construit
o bibliotecă paralelă. Predarea de echipament trece prin alocările din [[modul/inventar]],
vizibile aici doar prin politicile îngustate de D9. Fișa și invitația noului angajat sunt
la [[modul/angajati]].

`material_id` al unui pas e scris de `adaugaPas` și `actualizeazaPas` (și e în
allow-list-ul lor de audit): schema îi verifica perechea cu `tip_dovada`, dar handlerul
nu-l trimitea — succes raportat peste un pas de citire fără nimic de citit.

Opțiunile asistentului vin din `sabloane/_componente/optiuni.ts`, același `optiuniAsistent`
pentru „nou" și „[id]": cursurile și materialele se cer doar cu modulul `courses` activ
(lista goală dezactivează cardul, nu scoate pagina pe 404), iar departamentele se citesc cu
`deleted_at is null` — `activ` singur lăsa un departament șters logic să rămână țintă.
Ramura FĂRĂ drept de editare din `/onboarding/sabloane/[id]` cheamă azi același
`optiuniAsistent` numai ca să NUMEASCĂ cursul, materialul și responsabilul fiecărui pas;
legătura spre ei trece prin `poateDeschide` din `src/config/porti-ruta.ts`, deci un nume
necunoscut sau o rută închisă rămân text, nu link mort.

Citirile din `src/lib/queries/checklist.ts` sunt marcate `server-only`: un import dintr-o
componentă client cade la build, nu în producție. Două coloane de acolo există numai pentru
legături și se pierd tăcut dacă le scoți din `select`: `curs_id` pe `pasiiInstantei` (ținta
pasului `curs_finalizat`) și `deleted_at` pe `angajatiDupaId`, cerut de `hrefFisa()` din
`src/lib/navigare/fisa.ts` — fără el, o fișă ștearsă logic capătă link. `PasChecklist`
primește `responsabili` și `hrefCurs` ca proprietăți OPȚIONALE, fiindcă e partajată cu
portalul, care nu le trimite: fără ele rămâne eticheta de tip („Managerul direct"), iar un
responsabil al cărui rând n-a venit prin RLS rămâne tot acolo, fără nume și fără link.

`?sablon=` e filtru de intrare dinspre pagina șablonului: e în `filtreInstanteSchema`, în
`listeazaInstante` și declarat `cheiExterne` în `FiltreInstante` — pastilă fără câmp în
formular, altfel „Filtrează" l-ar pierde. `/onboarding/noua` citește `?sablon=` și
`?angajat=` ca preselecție, dar numai dacă sunt UUID-uri: un id necunoscut nu se potrivește
cu nicio opțiune, iar selectul cade pe prima, fără eroare.

Lista de instanțe își ia filtrele din `filtre-instante.tsx`, ca restul ecranelor cu
`filtre-*.tsx`; câmpurile de dată de acolo trec prin `IntrareData`, a cărei valoare inițială
se numește `implicit`, nu `defaultValue`. `/onboarding/sabloane` face **excepție**: își
scrie formularul GET de mână, în `page.tsx`. Câmpurile lui sunt necontrolate (`defaultValue`
se citește doar la montare), deci au nevoie de `key` legat de valoarea din adresă — „Șterge
filtrele" din `StareGoala` e un `<Link>`, care navighează pe client fără să remonteze
câmpul; fără `key`, rămânea textul vechi peste o listă nefiltrată și se reaplica la
următoarea apăsare pe „Filtrează". Orice filtru nou pe ecranul ăsta se scrie cu aceeași
pereche `key` + `defaultValue`.

Numerotarea sare de la `0090` la `0092` și de la `0093` la `0095`: două coliziuni cu
sesiunea care livra invitațiile. Convenția e să-ți redenumești **propria** migrare.

## Când NU e suficientă pagina asta

- Forma unui pas și verificările automate: `supabase/migrations/0089_integrare_etape.sql`.
- Cine poate bifa ce: [[rol/manager]].
- Ce verifică fiecare acțiune înainte de bază: `actions-instante.test.ts`,
  `actions-sabloane.test.ts`, `actions-dovezi.test.ts`, `erori.test.ts` — pe clientul
  Supabase fals, deci nu țin loc de `tests/rls/`.
- Bunurile nereturnate (vizibile doar cu modulul `inventory` și `inventory:read` team), ancora `#pas-<id>` dinspre „Sarcinile mele", șablonul care se numește pe sine, rândul „Pași de integrare” din panou: [[strat/navigare]].
