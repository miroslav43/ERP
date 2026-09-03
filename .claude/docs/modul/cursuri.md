---
tip: modul
titlu: Cursuri
aliases: [cursuri, instruire, elearning]
cai:
  - "src/app/(app)/cursuri/**"
  - "src/lib/queries/cursuri.ts"
  - "src/schemas/cursuri.ts"
  - "src/domain/cursuri/**"
  - "supabase/migrations/0075_cursuri.sql"
  - "supabase/migrations/0077_cursuri_test_grila.sql"
  - "supabase/migrations/0078_cursuri_reguli_atribuire.sql"
tabele:
  [
    courses,
    course_materials,
    course_lessons,
    course_enrollments,
    course_quiz_questions,
    course_assignment_rules,
  ]
permisiuni: [courses:read, courses:create, courses:update, courses:export]
feature: courses
capcane: [17]
citeste_daca:
  - "curs care nu acceptă înrolări → secțiunea „ce refuză baza”"
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul, hr]
---

# Cursuri

Bibliotecă de materiale (PDF și video), cursuri ca listă ordonată de lecții, înrolări per
angajat cu ciclu de reluare, test grilă cu prag de trecere și adeverință imutabilă.

**De ce modul nou, și nu o extensie a checklist-urilor:** seed-ul îi dă managerului
`checklists` la `team` cu doar `{read, approve}` — nici `create`, nici `update`. Prin
urmare fiecare ramură `scope >= team AND is_manager_of` scrisă în politicile lui `0014` era
cod mort, iar cerința aici e explicit ca **managerul să poată construi** cursuri pentru
echipa lui. `0075` a introdus resursa proprie `courses`, cu `manager` la scope `team`.

## Rute și cine ajunge

| Rută                                                                         | Poartă               |
| ---------------------------------------------------------------------------- | -------------------- |
| `/cursuri`, `/cursuri/nou`, `/cursuri/[id]`                                  | `courses:read` team  |
| `/cursuri/[id]/editare`, `/cursuri/[id]/reguli`                              | `courses:read` team  |
| `/cursuri/[id]/atribuire`, `/cursuri/[id]/stadiu`                            | `courses:read` team  |
| `/cursuri/biblioteca`, `/cursuri/biblioteca/nou`, `/cursuri/biblioteca/[id]` | `courses:read` team  |
| `/cursuri/conformitate`                                                      | `courses:read` team  |
| `/portal/cursurile-mele/**`                                                  | portalul angajatului |

Poarta e scrisă cu `scopeFor` **plus** `can`: `scope === null || scope === "none"` se
respinge explicit, înainte de comparația de rang. Angajatul are `courses` la `own` cu
`{read, update, export}` — nu compune cursuri, dar progresul și semnătura trec prin
`update`, din portal.

## Server Actions

`src/app/(app)/cursuri/actions.ts` — **toate** pe `minScope: "team"`, ceea ce face din
`courses` unul dintre puținele module în care managerul e autor, nu doar aprobator.

| Grup      | Funcții                                                                                                                  | Permisiune          |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Curs      | `creeazaCurs`; `actualizeazaCurs`, `publicaCurs`, `dezactiveazaCurs`                                                     | `create` / `update` |
| Materiale | `creeazaMaterial`, `pregatesteIncarcareMaterial`, `salveazaVersiuneFisier`, `salveazaVersiuneLink`, `renuntaLaIncarcare` | `courses:create`    |
| Materiale | `actualizeazaMaterial`, `stergeMaterial`                                                                                 | `courses:update`    |
| Lecții    | `adaugaLectie`; `actualizeazaLectie`, `stergeLectie`, `mutaLectie`                                                       | `create` / `update` |
| Înrolări  | `atribuieCurs`, `aplicaRegulile`, `creeazaRegula`; `anuleazaInrolare`, `stergeRegula`                                    | `create` / `update` |
| Test      | `salveazaTest`                                                                                                           | `courses:update`    |
| Materiale | `linkPreviewMaterial`                                                                                                    | `courses:read`      |

## Cheia de răspuns stă în tabelă separată

RLS **n-are granularitate pe coloană**. Dacă răspunsurile corecte ar sta lângă întrebări,
orice angajat care poate citi întrebările — și trebuie să le poată citi — le-ar citi și pe
ele printr-un `select *` prin PostgREST.

Separarea într-o tabelă proprie, fără nicio politică pentru `authenticated`, e singura
barieră reală; altfel testul ar fi decorativ. Cine adaugă un ecran de administrare a
testului trece prin Server Action cu client admin, nu prin clientul utilizatorului.

## Ce refuză baza

- **Nu se poate face înrolare la un curs nepublicat, dezactivat sau FĂRĂ NICIO LECȚIE.**
  `internal.cursuri_pregateste_inrolarea` verifică toate trei și ridică P0001. Regula e
  precedentul pe care modulul de integrare l-a primit abia mai târziu, prin `0088`: o
  poartă care numără elemente trebuie să respingă și cazul zero, altfel e adevărată în gol.
- **Tranzițiile de înrolare fac `.select()` după `.update()`.** O înrolare care nu mai e în
  starea așteptată nu produce eroare, produce zero rânduri. — capcana #17
- **Termenul e opțional** (`0085_cursuri_termen_optional.sql`, redenumită din `0079` după o
  coliziune amonte). Un curs fără termen nu e un curs „expirat imediat": ecranele și
  rapoartele de conformitate trebuie să trateze NULL ca „fără scadență".

## Ce se mișcă împreună

`0076_cursuri_punte_integrare.sql` leagă modulul de [[modul/onboarding]]: un pas de
checklist se bifează **singur** când angajatul termină cursul legat de el. Mecanismul nu e
nou — e același `verificare_automata` care bifează „Predare echipament" la returnarea
ultimului bun. Un al doilea mecanism ar fi însemnat două locuri în care se decide același
lucru.

`course_materials` e biblioteca comună: pașii de integrare care cer citirea unui
regulament o refolosesc, în loc să-și construiască una paralelă.

Regulile de atribuire (`0078`) există pentru un singur caz, dar acela contează —
**angajatul nou**: fără ele cineva trebuie să-și amintească să-i dea instructajul.

## Când NU e suficientă pagina asta

- Ecranul angajatului și adeverința: `src/app/(portal)/portal/cursurile-mele/`.
- Instruirile SSM, care sunt alt modul cu altă lege: [[modul/ssm]].
