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
  - "supabase/migrations/0076_cursuri_punte_integrare.sql"
  - "supabase/migrations/0077_cursuri_test_grila.sql"
  - "supabase/migrations/0078_cursuri_reguli_atribuire.sql"
tabele:
  [
    courses,
    course_materials,
    course_material_versions,
    course_items,
    course_enrollments,
    course_answer_keys,
    course_assignment_rules,
  ]
permisiuni: [courses:read, courses:create, courses:update, courses:export]
feature: courses
capcane: [17]
citeste_daca:
  - "curs care nu acceptă înrolări → secțiunea „ce refuză baza”"
scris_pe: a67bb3cc1be0a37072b4d1bb96fb262cf8338586
scris_la: 2026-10-31
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

## Paginile modulului

Pagina asta e trunchiul; restul s-a spart pe subarborele de rute
(`.claude/docs/meta/conventii.md`).

| Pagină                       | Ce ține                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| [[modul/cursuri/actiuni]]    | Server Actions: tabelul și pragul de scope comun                                          |
| [[modul/cursuri/biblioteca]] | `/cursuri/biblioteca/**`: octeții, asistentul de material, cheia de răspuns, „Folosit în” |

## Rute și cine ajunge

| Rută                                                                        | Poartă                |
| --------------------------------------------------------------------------- | --------------------- |
| `/cursuri`, `/cursuri/[id]`, `/cursuri/[id]/reguli`, `/cursuri/[id]/stadiu` | `courses:read` team   |
| `/cursuri/biblioteca`, `/cursuri/biblioteca/[id]`, `/cursuri/conformitate`  | `courses:read` team   |
| `/cursuri/nou`, `/cursuri/[id]/atribuire`, `/cursuri/biblioteca/nou`        | `courses:create` team |
| `/cursuri/[id]/editare`                                                     | `courses:update` team |
| `/portal/cursurile-mele/**`                                                 | portalul angajatului  |

Rutele de citire scriu poarta cu `scopeFor` **plus** `can`: `scope === null || scope === "none"`
se respinge explicit, înainte de comparația de rang. Rutele de scriere gardează pe `can`
singur — cheia absentă din hartă face `can` fals oricum, iar `scopeFor` n-ar adăuga nimic.
Ecranele de citire calculează apoi `poateEdita` / `poateCrea` / `poateAtribui` pe server, deci
un `courses:read` fără `create` vede lista fără butoane, nu un ecran restricționat.

Angajatul are `courses` la `own` cu `{read, update, export}` — nu compune cursuri, dar
progresul și semnătura trec prin `update`, din portal.

Rutele citesc filtre din URL ca indicatorii și celulele să poată trimite în lista deja
filtrată: stadiul prin `filtreDinUrl` (`?status=`, `?doar_restante=da`, `?angajat=`, cu
pastile de retragere), conformitatea prin `?arata=probleme`, care restrânge matricea la
oamenii cu o celulă lipsă, expirată sau critică — aceeași matrice, nu o sublistă
inventată. Drumurile care IES din modul trec prin poarta paginii-țintă, nu a sursei:
`employees:read` pentru lista și fișele de angajați (fără el numele rămâne text, iar
starea goală nu mai promite un buton pe care omul n-ar avea voie să apese),
`poateDeschide("/onboarding/sabloane/[id]", …)` pentru șabloane. Mecanica e în
[[strat/navigare]].

Preambulul rulează `requireFeature` și `getPermissionMap` **în paralel**, prin `Promise.all`,
în toate paginile modulului — abatere deliberată de la înlănțuirea din rețeta canonică, fiindcă
sunt două citiri independente și costul e rețea, nu bază. Ordinea observabilă nu se schimbă:
`requireFeature` cheamă `notFound()`, iar `can()` rulează oricum după `await`.

## Citiri

`src/lib/queries/cursuri.ts` e `server-only`, deci un import dintr-o componentă client
pică la build. Căutarea liberă din `listeazaCursuri` și `listeazaMateriale` trece prin
`tiparContine` (`src/lib/queries/cursor.ts`), nu prin tipar scris de mână: `%`, `_` și `*`
tastate de om ar fi jokeri, iar virgula și paranteza rup gramatica `or=` — rezultatul nu e
o eroare, e o listă subtil greșită. `max_rows = 1000` trunchiază tăcut, deci listările sunt
fie pe cursor keyset, fie cu `.limit()` explicit sub prag.

`listeazaInrolari` are două particularități care vin din termenul opțional: restanțele se
taie față de ziua României (`todayInBucharest`), nu de cea UTC — între miezul nopții și
ora 3 ziua UTC e încă ieri —, iar pe sortarea după `termen` paginarea trece prin
`predicatKeysetNulabil`, cu `VALOARE_NULA` în cursor. `gt`/`lt` nu potrivesc niciodată
NULL: cu keyset-ul simplu, o pagină terminată pe o înrolare fără scadență n-avea
continuare, iar după o valoare NULL-urile nu mai apăreau deloc.

`numeAngajati` întoarce `{ nume, deleted_at }` pe fiecare id, nu doar numele: prezența în
hartă înseamnă „rândul a trecut de RLS pentru cine privește", iar `deleted_at` hotărăște
dacă numele devine link — o fișă ștearsă rămâne cu nume în istoricul înrolării, fără drum.
`sabloaneCuCursul` citește pașii de integrare legați de curs
(`checklist_template_items.curs_id`, `0076`), cu șabloanele șterse tăiate în JS, fiindcă
`deleted_at` de pe tabela încorporată nu intră în `.is()` de pe cererea de bază.

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
- **Indicatorii din stadiu nu se pot număra din lista afișată.** `listeazaInrolari` taie
  lista la 50 de rânduri ȘI o primește deja filtrată din URL: pe `?status=finalizat`,
  „Înrolări" arăta doar finalizații, iar „Au parcurs" se compara cu el însuși. Totalurile
  se cer separat, de la filtrele implicite (`filtreInrolariSchema.parse({})`), și vin din
  `count`, nu din rândurile aduse. — `src/app/(app)/cursuri/[id]/stadiu/page.tsx`
- **`aplicaRegulile` verifică eroarea pe FIECARE citire paralelă**, nu doar pe reguli și
  fișe. Rolurile vin din `organization_members`, iar cine e deja înrolat din
  `course_enrollments`; o citire picată acolo nu dă eroare, dă listă goală — adică
  „0 atribuiri" pe o regulă pe rol, sau un ciclu nou pentru toată lumea, fiindcă triggerul
  de pregătire numerotează ciclul și baza nu refuză „duplicatul".
  — `actions-inrolari.test.ts`
- **Codul și denumirea cursului au indexuri unice separate** (`courses_cod_uk`,
  `courses_denumire_uk`). `traduEroare` le desparte: 23505 pe denumire aterizează pe câmpul
  `denumire`, nu pe `cod` — altfel omul schimba codul și primea aceeași eroare.
  — `erori.test.ts`

## Ce se mișcă împreună

`0076_cursuri_punte_integrare.sql` leagă modulul de [[modul/onboarding]]: un pas de
checklist se bifează **singur** când angajatul termină cursul legat de el. Mecanismul nu e
nou — e același `verificare_automata` care bifează „Predare echipament" la returnarea
ultimului bun. Un al doilea mecanism ar fi însemnat două locuri în care se decide același
lucru. Legătura se vede acum și dinspre curs: pagina lui listează șabloanele cu un pas
legat de el, fiindcă retragerea din publicare sau dezactivarea ar rupe tăcut un parcurs de
integrare, iar până atunci nimic de pe ecran nu spunea pe care.

`course_materials` e biblioteca comună: pașii de integrare care cer citirea unui
regulament o refolosesc, în loc să-și construiască una paralelă.

Regulile de atribuire (`0078`) există pentru un singur caz, dar acela contează —
**angajatul nou**: fără ele cineva trebuie să-și amintească să-i dea instructajul.

## Când NU e suficientă pagina asta

- Ecranul angajatului și adeverința: `src/app/(portal)/portal/cursurile-mele/`.
- Instruirile SSM, care sunt alt modul cu altă lege: [[modul/ssm]].
- Tiparul linkurilor de entitate, al pastilelor de filtru și al toastului cu acțiune, cu
  poarta paginii-țintă: [[strat/navigare]].
