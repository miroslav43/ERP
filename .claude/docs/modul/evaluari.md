---
tip: modul
titlu: Evaluări
aliases: [evaluari, kpi, performanta]
cai:
  - "src/app/(app)/evaluari/**"
  - "src/lib/queries/evaluari.ts"
  - "src/schemas/evaluation.ts"
  - "supabase/migrations/0038_evaluari_angajati.sql"
  - "supabase/migrations/0072_evaluari_sabloane_editabile.sql"
  - "supabase/migrations/0119_kpi_lunar.sql"
  - "supabase/migrations/0168_sablon_evaluare_personalizat.sql"
  - "supabase/migrations/0170_evaluarea_proprie_vizibila.sql"
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
capcane: [2, 48]
citeste_daca:
  - "ecran KPI care dă 404 deși evaluările merg → secțiunea „Rute și cine ajunge”"
  - "ștergere care nu șterge nimic → secțiunea „Ce refuză baza tăcut”"
  - "listă de șabloane din care lipsește unul → secțiunea „Citiri”"
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
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

## Paginile modulului

Trunchiul ține rutele, citirile anualei și **ce refuză baza tăcut** — secțiunea pentru care
se deschide pagina dintr-un bug. Restul s-a spart pe subpagini.

| Pagină                     | Ce ține                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| [[modul/evaluari/actiuni]] | scrierile ambelor fluxuri, programarea, varianta firmei a unui șablon, ștergerea logică, anunțurile |
| [[modul/evaluari/kpi]]     | managerul direct, citirile lunare, setul pe funcție, luna închisă                                   |

## Rute și cine ajunge

| Rută                      | `requireFeature` | Poarta paginii          | Ce deblochează în plus scrierea                              |
| ------------------------- | ---------------- | ----------------------- | ------------------------------------------------------------ |
| `/evaluari`               | `evaluations`    | `evaluations:read` team | `evaluations:create` team programează, `update` team notează |
| `/evaluari/sabloane`      | `evaluations`    | `evaluations:read` team | `evaluations:update` **all**                                 |
| `/evaluari/ale-mele`      | `evaluations`    | **nicio permisiune**    | nimic, e numai citire                                        |
| `/evaluari/kpi`           | `kpi`            | `evaluations:read` team | `evaluations:create` team                                    |
| `/evaluari/kpi/[id]`      | `kpi`            | `evaluations:read` team | `evaluations:update` team **și** luna în `draft`             |
| `/evaluari/kpi/seturi`    | `kpi`            | `evaluations:read` team | `evaluations:update` team                                    |
| `/portal/evaluarile-mele` | `evaluations`    | portalul angajatului    | propria serie, citire                                        |
| `/portal/kpi-ul-meu`      | `kpi`            | portalul angajatului    | propria serie, citire                                        |

Poarta fiecărei rute e declarată o singură dată, în `src/config/porti-ruta.ts`; din același
registru se filtrează banda de file (`fileEvaluari()` din `src/config/file-module.ts`), deci
o filă apare doar dacă pagina ei chiar se deschide. Componenta de file a modulului nu mai
există.

`/evaluari/ale-mele` e singura rută fără poartă de permisiune: evaluarea **proprie
finalizată** se vede pentru orice rol (`0170`), iar RLS întoarce doar pe ea. Secțiunea
„KPI-ul meu" de pe ea cere în plus modulul `kpi` și `evaluations:read` la `own`. Celelalte
intră cu **aceeași** poartă — `evaluations:read` la scope `team` —, iar ce diferă e
booleanul de scriere calculat pe server: cine n-are `update` vede ecranul complet și fără
butoane, nu `AccesRestrictionat`.

Ce **nu** e comun e modulul. O organizație cu `evaluations` activ dar fără `kpi` deschide
`/evaluari` și `/evaluari/sabloane`, iar ecranele de KPI îi dau **404**: `requireFeature`
cheamă `notFound()`, nu `AccesRestrictionat`, deci nimic nu explică refuzul. Intrarea de
meniu `portal-kpi` are și ea `featureKey: "kpi"` și dispare în același caz. Invers, la o
firmă doar cu `kpi`, firimitura „Evaluări" din luna de KPI nu se randează deloc.

În preambul, `requireFeature` și `getPermissionMap` se cheamă **paralel** (`Promise.all`),
ca la pasul 3+4 din `src/lib/actions/create-action.ts`: citiri independente, decizii în
aceeași ordine ca înainte — modul dezactivat înaintea permisiunii lipsă.

Permisiunile `evaluations:*` sunt proprii modulului din `0070`: până atunci acțiunile
cereau `employees:update`, pe care `manager` nu-l are la scope suficient, deci evaluările
erau în fapt exclusiv ale HR-ului. Astăzi `manager` are `read`, `create` și `update` la
scope `team`.

## Citiri

`src/lib/queries/evaluari.ts` — funcții libere, `organizationId` primul argument. Două
locuri unde varianta „simplă" scade tăcut, fără nicio eroare:

- **„Folosit în N evaluări", la șabloane.** `listeazaSabloane` cere `count` cu
  `head: true`, câte o interogare pe șablon. Un embed agregat ar fi trecut prin RLS-ul
  evaluărilor — managerul ar fi văzut mai puțin decât are firma și ar fi editat un șablon
  crezând că nu atinge pe nimeni; iar numărarea pe rânduri citite scade peste
  `max_rows = 1000`. — capcana #2
- **Cifrele din capul paginii.** `indicatoriEvaluari` ține contoarele pe `count` +
  `head: true`, iar media pe cele mai recente `ESANTION_MEDIE` evaluări finalizate — citite
  cu un rând în plus, ca un eșantion exact plin să nu se raporteze drept tăiat.
  `esantionTrunchiat` e singurul lucru care spune ecranului că media nu e pe toate; pe
  același eșantion se numără și `angajatiEvaluati`, iar acolo nimic nu se declară. — capcana #2

Un șablon lipsă din listă nu e o eroare: `listeazaSabloane` **ascunde** șablonul de
platformă cât timp firma are o variantă a lui (`derivat_din`, `0168`), ca să rămână un
singur card — al firmei, cu insigna „Personalizat" —, în listă, la „Evaluare nouă" și pe
fișă. Contează orice variantă neștearsă, inclusiv una arhivată: arhivarea e o alegere a
firmei, nu o cerere de a reveni la cel generic.

`listeazaEvaluari` duce în rând și instantaneul, notele, concluzia și `template_id`:
„Evaluează" deschide ciorna direct din listă, iar numele șablonului e un link către lista
filtrată pe el. Citirile lunare sunt în [[modul/evaluari/kpi]].

## Ce refuză baza tăcut

- **Ștergerea logică printr-un UPDATE pică întotdeauna cu `42501`**, pe tabelele modulului
  care au `deleted_at is null` în politica SELECT: rândul NOU e verificat contra politicii
  care tocmai îl ascunde. Șablonul, ținta și indicatorul KPI nu se ștergeau niciodată, iar
  compensările își înghițeau eroarea. Drumul de astăzi, prin funcții de bază, e în
  [[modul/evaluari/actiuni]]. — capcana #48
- **Evaluarea proprie nu se mai scrie de propria mână.** `manager_path` îl conține și pe
  angajatul însuși, deci pe scope `team` un manager își vedea ciorna și o putea modifica,
  finaliza sau crea. `0170` scoate propria fișă din ramura `team` a lui
  `app.can_access_evaluation` și lasă în loc o ramură de SELECT pentru evaluarea proprie
  **finalizată**, valabilă oricărui rol. Ecranele nu ofereau drumul, dar baza îl lăsa
  deschis oricui scria direct.
- **UPDATE-ul de tranziție refuzat de `USING` afectează zero rânduri, fără eroare** — de
  aceea fiecare tranziție face `.select()` după `.update()` și tratează golul drept
  CONFLICT. Cazul lunii KPI închise e în [[modul/evaluari/kpi]].

## Instantaneul: de ce valorile își copiază definiția

Din clipa în care un șablon sau un set devine editabil, o modificare rescrie retroactiv
sensul notelor deja date. Un `scala_max` mutat de la 5 la 10 transformă un „4 din 5"
istoric într-un „4 din 10"; o pondere schimbată în iulie rescrie scorul din ianuarie; o
țintă mutată de la 40 la 25 face dintr-un „37 din 40" o depășire.

De aceea `employee_evaluations.criterii_sablon` (0072) și `kpi_valori` (0119) țin
**instantaneul** — `cod`, `denumire`, `tip`, `unitate`, `sens`, `pondere`, `scala_max`,
`tinta` — scris la creare, nu citit din definiția curentă. Varianta firmei a unui șablon de
platformă (`0168`) nu schimbă nimic aici: evaluările deja făcute poartă criteriile cu care
au fost completate, iar ciornele programate cu `planificaEvaluari` își iau instantaneul în
clipa programării, nu la notare.

## Ce se mișcă împreună

Fiecare acțiune are test pe clientul Supabase fals, lângă acțiunea verificată
(`src/app/(app)/evaluari/actions-sabloane.test.ts`,
`src/app/(app)/evaluari/actions-evaluari.test.ts` și perechile din
`src/app/(app)/evaluari/kpi/`): acolo sunt fixate verbatim payload-ul fiecărei scrieri și
căile de `revalidate`. O politică RLS greșită rămâne însă pe `tests/rls/izolare.sql`, iar
un refuz tăcut al bazei nu se vede în niciunul dintre ele.

## Când NU e suficientă pagina asta

- Fișa angajatului, lanțul de subordonare și țintele KPI puse de pe fișă: [[modul/angajati]].
- De ce un manager vede dar nu poate scrie: [[rol/manager]].
- Filtrele de intrare (`?angajat=`, `?status=`, `?template_id=`), seturile din antet,
  „Redeschide” pe fișă, notificările și luna din istoricul portalului: [[strat/navigare]].
