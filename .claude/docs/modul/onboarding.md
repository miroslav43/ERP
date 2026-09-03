---
tip: modul
titlu: Integrare (onboarding)
aliases: [onboarding, integrare, checklist]
cai:
  - "src/app/(app)/onboarding/**"
  - "src/lib/queries/checklist.ts"
  - "src/schemas/checklist.ts"
  - "supabase/migrations/0014_checklist.sql"
  - "supabase/migrations/0088_integrare_defecte.sql"
  - "supabase/migrations/0089_integrare_etape.sql"
tabele:
  [
    checklist_templates,
    checklist_template_steps,
    checklist_instances,
    checklist_instance_items,
    checklist_completion_records,
  ]
permisiuni: [checklists:read, checklists:create, checklists:update, checklists:approve]
feature: onboarding
capcane: [12]
citeste_daca:
  - "„Checklistul este închis” pe un checklist deschis → secțiunea D6"
  - "pas obligatoriu care nu se poate bifa niciodată → secțiunea D4"
scris_pe: 0815fbff2c885cd44b5768ee25f084f16a9e95b8
scris_la: 2026-09-03
tags: [modul, hr]
---

# Integrare (onboarding)

Parcursuri pe șablon pentru angajatul nou — predare de echipament, semnături, citit
regulament — cu pași atribuiți unor **responsabili** care nu sunt subiectul parcursului.
La final se emite o dovadă **imutabilă**, cu checksum.

Modulul e cel mai corectat din proiect: `0088` a închis nouă defecte tăcute deodată,
niciunul prins de typecheck, lint, teste sau de cele trei bariere SQL. Toate se manifestau
ca **refuz fără eroare** sau ca **acceptare în gol**. Secțiunile de mai jos le păstrează
sub codurile din migrare, ca să se poată căuta.

## Rute și cine ajunge

| Rută                                                                            | Poartă                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `/onboarding`                                                                   | `checklists:read` own                                      |
| `/onboarding/noua`                                                              | `checklists:create` all                                    |
| `/onboarding/[id]`                                                              | `checklists:read` own                                      |
| `/onboarding/[id]/dovada`                                                       | `checklists:read` own                                      |
| `/onboarding/sabloane`, `/onboarding/sabloane/nou`, `/onboarding/sabloane/[id]` | `checklists:read` own; scrierea cere `create`/`update` all |
| `/onboarding/sarcinile-mele`                                                    | `checklists:read` own                                      |

Toate intră cu `own`. Ce diferă e booleanul de scriere.

## Server Actions

`src/app/(app)/onboarding/actions.ts`.

| Grup     | Funcții                                              | Permisiune / minScope       |
| -------- | ---------------------------------------------------- | --------------------------- |
| Parcurs  | `pornesteInstanta`                                   | `checklists:create` / all   |
| Parcurs  | `finalizeazaInstanta`, `anuleazaInstanta`            | `checklists:approve` / team |
| Pași     | `bifeazaPas`, `confirmaCitire`                       | `checklists:update` / own   |
| Dovezi   | `pregatesteIncarcareDovada`, `salveazaDovada`        | `checklists:update` / own   |
| Dovezi   | `linkDovada`                                         | `checklists:read` / own     |
| Șabloane | `creeazaSablon`, `salveazaSablon`, `adaugaPas`       | `checklists:create` / all   |
| Șabloane | `actualizeazaSablon`, `actualizeazaPas`, `stergePas` | `checklists:update` / all   |

## D1 — de ce managerul are `checklists:update` la `own`, nu la `team`

Managerul n-avea deloc `checklists:update`, deci ramura scrisă pentru el în `0014` era cod
mort din ziua întâi: nu putea bifa niciun pas. `0088` i-a dat cheia, dar la scope **`own`**,
care deschide exact ramura pe responsabil — „pot bifa pasul al cărui responsabil sunt".

`team` ar fi fost greșit din două motive, ambele verificate în migrare:

- ar fi aprins politicile de vizibilitate pe Inventar, care cereau fix `update >= team`,
  deschizând stocul întregii firme (D9);
- s-ar fi ancorat pe subordonarea față de **subiect**, nu pe faptul că e responsabilul
  desemnat — deci managerul ar fi putut bifa pașii HR-ului din onboardingul subalternului.

D9 s-a reparat în **aceeași** migrare, chiar dacă `own` nu aprindea politicile atunci:
ecranul de permisiuni per membru (`0063`) lasă orice `org_admin` să acorde mâine
`checklists:update = team` unui manager anume, și atunci s-ar fi deschis tăcut.

## D6 — mesajul fals „Checklistul este închis"

Două jumătăți ale aceluiași defect:

- **Responsabilul nu vedea INSTANȚA**, doar pasul. Orice pagină citește întâi instanța,
  deci sarcina atribuită se năștea moartă, cu 404. `0088` adaugă o politică PERMISSIVE
  suplimentară — se însumează prin OR, politica din `0014` rămâne neatinsă.
- **Triggerul mințea.** Sub `security invoker`, citirea statusului instanței trecea prin
  RLS cu drepturile celui care bifează; pentru un responsabil care nu e subiectul, rândul
  era invizibil, statusul ieșea NULL, iar `null is distinct from 'in_curs'` e adevărat —
  refuz cu o cauză inexistentă. Funcția e azi `security definer`.

Regula generală, dincolo de caz: **un trigger nu are voie să depindă de o politică de
citire ca să afle un fapt.**

## D4 — pași obligatorii și nebifabili pe veci

`acces_revocat` și `documente_semnate` există în enumul din `0014` și n-au fost
implementate niciodată. Interfața le arăta dezactivate, dar schema Zod accepta enumul
ÎNTREG — iar o Server Action se poate chema direct. Un pas creat pe una din ele era
obligatoriu prin `_automat_ck` și nebifabil, deci instanța devenea imposibil de finalizat.

Valorile **nu** s-au scos din enum (Postgres nu știe `drop value`, iar `0014` e aplicată):
s-au închis printr-un CHECK. Rămân vizibile în catalog ca istorie, dar nu se mai pot scrie.

## D10 — parcursul gol care se finalizează singur

Poarta de finalizare aduna cu `array_agg` pașii obligatorii nebifați și verifica dacă
rezultatul e nenul. Peste **zero** rânduri, `array_agg` întoarce NULL — deci „nu există
pași nebifați" era adevărat **în gol**. În producție există deja o dovadă imutabilă, cu
checksum, care atestă o integrare încheiată cu `total_pasi = 0` și conținut vid: un
document care nu atestă nimic, dar arată exact ca unul care atestă.

Precedentul reparației era deja în repo — `internal.cursuri_pregateste_inrolarea` refuză
înrolarea la un curs fără nicio lecție. Modulul de cursuri învățase lecția; integrarea nu.

## Ce refuză baza tăcut

- **`checklist_completion_records` nu are `deleted_at`.** Un `.is("deleted_at", null)` pe
  ea dă **42703**, iar un trigger BEFORE refuză orice UPDATE sau DELETE cu P0001: rândul îl
  scrie exclusiv triggerul de finalizare. `checklist_instance_items` sunt copiate de
  trigger la crearea instanței — nu se inserează din cod. — capcana #12
- **Nicio tabelă `checklist_*` nu are politică DELETE.** Ștergerea e logică peste tot.
- **`checklists:approve` era seedat și citit de zero politici** până la `0088`, care i-a
  dat conținut: e cheia care ÎNCHIDE parcursul (`finalizeazaInstanta`, `anuleazaInstanta`).

## Ce se mișcă împreună

Materialele de citit refolosesc `course_materials` din [[modul/cursuri]] — nu s-a construit
o bibliotecă paralelă. Predarea de echipament trece prin alocările din [[modul/inventar]],
vizibile aici doar prin politicile îngustate de D9. Fișa și invitația noului angajat sunt
la [[modul/angajati]].

Numerotarea sare de la `0090` la `0092` și de la `0093` la `0095`: două coliziuni cu
sesiunea care livra invitațiile. Convenția e să-ți redenumești **propria** migrare.

## Când NU e suficientă pagina asta

- Forma unui pas și verificările automate: `supabase/migrations/0089_integrare_etape.sql`.
- Cine poate bifa ce: [[rol/manager]].
