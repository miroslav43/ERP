---
tip: modul
titlu: Evaluări
aliases: [evaluari, kpi, performanta]
cai:
  - "src/app/(app)/evaluari/**"
  - "src/lib/queries/evaluari.ts"
  - "src/lib/queries/kpi.ts"
  - "src/schemas/evaluari.ts"
  - "supabase/migrations/0038_evaluari_angajati.sql"
  - "supabase/migrations/0072_evaluari_sabloane_editabile.sql"
  - "supabase/migrations/0119_kpi_lunar.sql"
tabele:
  [
    employee_evaluations,
    evaluation_templates,
    kpi_seturi,
    kpi_indicatori,
    kpi_tinte_angajat,
    kpi_evaluari_lunare,
    kpi_valori,
  ]
permisiuni: [evaluations:read, evaluations:create, evaluations:update]
feature: [evaluations, kpi]
capcane: [17]
citeste_daca:
  - "manager care nu poate salva KPI deși vede echipa → secțiunea „managerul direct”"
  - "ecran KPI care dă 404 deși evaluările merg → secțiunea „Rute și cine ajunge”"
scris_pe: 00e37653eadf3e9d2827de0ebf88e9a043eec856
scris_la: 2026-09-04
tags: [modul, hr]
---

# Evaluări

**Două fluxuri complet independente**, cu aceeași poartă de permisiuni: evaluarea anuală
pe șablon (0038 → 0072) și KPI-ul lunar (0119). Nu există discriminant `tip` pe
`employee_evaluations` și nicio politică nu se condiționează pe el — separarea e prin
tabele, nu printr-o coloană.

De la desprinderea lui `kpi` ca modul propriu în `src/config/features.ts`, separarea e și
**comercială**: cheile de facturare sunt două (`evaluations` și `kpi`), cheile de
permisiune rămân una singură (`evaluations:*`). Cine caută o permisiune `kpi:*` n-o
găsește — nu există.

## Rute și cine ajunge

| Rută                   | `requireFeature` | Poarta paginii          | Ce deblochează în plus scrierea                  |
| ---------------------- | ---------------- | ----------------------- | ------------------------------------------------ |
| `/evaluari`            | `evaluations`    | `evaluations:read` team | `evaluations:create` team                        |
| `/evaluari/sabloane`   | `evaluations`    | `evaluations:read` team | `evaluations:update` **all**                     |
| `/evaluari/kpi`        | `kpi`            | `evaluations:read` team | `evaluations:create` team                        |
| `/evaluari/kpi/[id]`   | `kpi`            | `evaluations:read` team | `evaluations:update` team **și** luna în `draft` |
| `/evaluari/kpi/seturi` | `kpi`            | `evaluations:read` team | `evaluations:update` team                        |
| `/portal/kpi-ul-meu`   | `kpi`            | portalul angajatului    | propria serie, citire                            |

Toate paginile intră cu **aceeași** poartă de permisiune — `evaluations:read` la scope
`team`. Ce diferă e booleanul de scriere calculat pe server: cine n-are `update` vede
ecranul complet și fără butoane, nu `AccesRestrictionat`.

Ce **nu** mai e comun e modulul. O organizație cu `evaluations` activ dar fără `kpi`
deschide `/evaluari` și `/evaluari/sabloane`, iar ecranele de KPI îi dau **404**:
`requireFeature` cheamă `notFound()`, nu `AccesRestrictionat`, deci nimic nu explică
refuzul. Intrarea de meniu `portal-kpi` are și ea `featureKey: "kpi"` și dispare în același
caz. Pentru ecranele KPI de administrare nu există element de meniu deloc — se ajunge la
ele din `/evaluari`.

În preambul, `requireFeature` și `getPermissionMap` se cheamă **paralel** (`Promise.all`),
ca la pasul 3+4 din `src/lib/actions/create-action.ts`: citiri independente, decizii în
aceeași ordine ca înainte — modul dezactivat înaintea permisiunii lipsă.

Permisiunile `evaluations:*` sunt proprii modulului din `0070`: până atunci acțiunile
cereau `employees:update`, pe care `manager` nu-l are la scope suficient, deci evaluările
erau în fapt exclusiv ale HR-ului. Astăzi `manager` are `read`, `create` și `update` la
scope `team`.

## Server Actions

`src/app/(app)/evaluari/actions.ts` — anualele, toate pe `feature: "evaluations"`:

| Funcție                                                                        | Permisiune / minScope       |
| ------------------------------------------------------------------------------ | --------------------------- |
| `creeazaSablonEvaluare`, `actualizeazaSablonEvaluare`, `duplicaSablonEvaluare` | `evaluations:update` / all  |
| `arhiveazaSablonEvaluare`, `reactiveazaSablonEvaluare`                         | `evaluations:update` / all  |
| `creeazaEvaluare`                                                              | `evaluations:create` / team |
| `actualizeazaEvaluare`, `finalizeazaEvaluare`                                  | `evaluations:update` / team |
| `redeschideEvaluare`                                                           | `evaluations:update` / all  |

`src/app/(app)/evaluari/kpi/actions.ts` — KPI lunar, toate pe `feature: "kpi"` și
`minScope: "team"`: `creeazaSetKpi`, `actualizeazaSetKpi`, `arhiveazaSetKpi`,
`seteazaTintaKpi`, `stergeTintaKpi`, `deschideLunaKpi`, `salveazaLunaKpi`,
`finalizeazaLunaKpi`. Toate cer `evaluations:update`, în afară de `deschideLunaKpi`, care
cere `evaluations:create` — deschiderea lunii chiar inserează un rând. Cu modulul `kpi`
inactiv se opresc toate în `MODUL_DEZACTIVAT`, înaintea oricărei verificări de permisiune;
anualele, pe `evaluations`, nu sunt atinse.

Redeschiderea unei evaluări anuale e singura care urcă la `all`: finalizarea o face
managerul, anularea ei nu.

## Managerul DIRECT, nu subarborele

`app.is_manager_of` verifică `manager_path @> [angajatul curent]`, adică **tot
subarborele** — șeful șefului trece la fel de bine ca șeful direct. Pentru evaluarea anuală
e în regulă. La KPI, cerința e „ținte stabilite de managerul direct", deci **scrierea** cere
`app.este_manager_direct`, care se uită la `manager_employee_id`.

`minScope: "team"` din acțiuni e doar poarta aplicației; predicatul îngust e în politică.
Consecința practică: un director care vede KPI-ul întregii divizii **nu-l poate scrie** —
iar refuzul vine din bază, nu din buton. **Citirea** rămâne pe subarbore, deliberat: tăiată
la managerul direct, ar fi ascuns KPI-ul echipei de cine răspunde de ea.

## Ce refuză baza tăcut

- **Luna finalizată nu se redeschide, din nicio cale de cod.** Politica de UPDATE a lui
  `kpi_evaluari_lunare` cere `status = 'draft'` în `USING`; un rând finalizat nu mai trece
  de clauză, deci UPDATE-ul afectează **zero rânduri, fără eroare**. Fiecare tranziție face
  `.select()` după `.update()` și tratează golul drept conflict. — capcana #17
- **Evaluarea anuală rămasă în `draft` era vizibilă angajatului.** Politica de SELECT de pe
  `employee_evaluations` nu filtrează după status, iar `0070` i-a dat angajatului scope
  `own` — concluzia pe jumătate scrisă a managerului. Nimeni nu s-a lovit de ea fiindcă
  portalul n-avea ecran de evaluări; `0119` adaugă unul și închide cazul în secțiunea 11.

## Instantaneul: de ce valorile își copiază definiția

Din clipa în care un șablon sau un set devine editabil, o modificare rescrie retroactiv
sensul notelor deja date. Un `scala_max` mutat de la 5 la 10 transformă un „4 din 5"
istoric într-un „4 din 10"; o pondere schimbată în iulie rescrie scorul din ianuarie; o
țintă mutată de la 40 la 25 face dintr-un „37 din 40" o depășire.

De aceea `employee_evaluations.criterii_sablon` (0072) și `kpi_valori` (0119) țin
**instantaneul** — `cod`, `denumire`, `tip`, `unitate`, `sens`, `pondere`, `scala_max`,
`tinta` — scris la creare, nu citit din definiția curentă.

`kpi_sens` există din același motiv de corectitudine: „vizite: țintă 40, realizat 37" e
92%, dar „rebut: maxim 2%, realizat 1,4%" e 130%, nu 70%. Fără discriminantul de sens,
jumătate din indicatorii reali se calculează exact invers, și nimic nu semnalează asta.

## Ce se mișcă împreună

Un set KPI activ per **funcție**, ținută ca text, nu ca cheie către `job_positions`
(desființate de 0110). Consecința asumată: doi manageri cu subordonați pe aceeași funcție
împart setul, iar divergențele se rezolvă din `kpi_tinte_angajat`, nu prin seturi paralele.

Seria lunară e valoarea modulului, de aceea KPI-ul are tabele proprii în loc de `jsonb`:
„media pe indicator pe ultimele trei luni" și graficul din portal ar fi devenit altfel
agregări peste `jsonb_array_elements`, care încetinesc tăcut la 200 de angajați × 12 luni.

## Când NU e suficientă pagina asta

- Fișa angajatului și lanțul de subordonare: [[modul/angajati]].
- De ce un manager vede dar nu poate scrie: [[rol/manager]].
