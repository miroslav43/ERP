---
tip: modul
titlu: Evaluări — scrierile modulului
aliases: [evaluari-actiuni, kpi-actiuni, evaluations-actions]
cai:
  - "src/app/(app)/evaluari/actions.ts"
  - "src/app/(app)/evaluari/kpi/actions.ts"
  - "src/app/(app)/evaluari/anunta-evaluarea.ts"
  - "src/schemas/evaluation.ts"
  - "src/schemas/kpi.ts"
  - "supabase/migrations/0162_sterge_sablon_evaluare.sql"
  - "supabase/migrations/0164_sterge_logic.sql"
  - "supabase/migrations/0168_sablon_evaluare_personalizat.sql"
tabele:
  [
    employee_evaluations,
    evaluation_templates,
    kpi_seturi,
    kpi_indicatori,
    kpi_tinte_angajat,
    kpi_evaluari_lunare,
    kpi_valori,
    notifications,
  ]
permisiuni: [evaluations:create, evaluations:update]
feature: [evaluations, kpi]
capcane: [48, 49]
scris_pe: f437506578f23173e26c942102cdd3ddd2d109c8
scris_la: 2026-10-28
tags: [modul, hr]
---

# Evaluări — scrierile modulului

Secțiune extrasă din [[modul/evaluari]]: Server Actions ale celor două fluxuri și
notificările pe care le trimit. Rutele, citirile, instantaneul și **ce refuză baza
tăcut** rămân în trunchi, fiindcă acolo se ajunge dintr-un bug.

## Server Actions

`src/app/(app)/evaluari/actions.ts` — anualele, toate pe `feature: "evaluations"`:

| Funcție                                                                        | Permisiune / minScope       |
| ------------------------------------------------------------------------------ | --------------------------- |
| `creeazaSablonEvaluare`, `actualizeazaSablonEvaluare`, `duplicaSablonEvaluare` | `evaluations:update` / all  |
| `personalizeazaSablonEvaluare`, `stergeSablonEvaluare`                         | `evaluations:update` / all  |
| `arhiveazaSablonEvaluare`, `reactiveazaSablonEvaluare`                         | `evaluations:update` / all  |
| `planificaEvaluari`, `creeazaEvaluare`                                         | `evaluations:create` / team |
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

Schemele sunt în `src/schemas/evaluation.ts` și `src/schemas/kpi.ts`. Până la
normalizarea din `createAction`, acțiunile modulului primeau `FormData` brut, iar Zod
citea fiecare câmp ca `undefined`: nici șabloanele, nici evaluările, nici seturile sau
lunile KPI nu se salvaseră vreodată din ecran, deși testele de acțiune treceau — ele
cheamă acțiunea cu un obiect. — capcana #49

## Programarea e un pas separat de notare

`planificaEvaluari` scrie câte o CIORNĂ fără note per angajat ales, cu instantaneul
criteriilor; notarea vine ulterior, din „Evaluează" pe rândul din listă
(`actualizeazaEvaluare`). Ecranul e `src/app/(app)/evaluari/_components/planificare-evaluari.tsx`.
Ce ține flux-ul corect:

- Un angajat care are deja o ciornă pe același șablon e **sărit**, nu dublat; cele
  finalizate nu contează, evaluarea de anul trecut nu oprește pe cea de acum. Raportul
  întors spune câte s-au creat și câți au fost săriți.
- Un singur INSERT cu toate rândurile: RLS verifică fiecare rând, deci un angajat
  interzis respinge **tot lotul** — preferat unei jumătăți de lot scrise.
- `dataEvaluarii` refuză orice zi la mai mult de **un an în viitor**, cu eroare pe câmp.
  Un an, nu „azi", fiindcă programarea viitoare e legitimă; dar baza n-are niciun prag pe
  `data_evaluarii`, iar o evaluare „din 2030" e o greșeală de tastare (QA 8 oct 2026,
  HR-029). Ceasul se citește la fiecare parsare, nu la încărcarea modulului.

## „Personalizează" schimbă șablonul, nu-l copiază

Șablonul de platformă (`organization_id is null`) e comun tuturor firmelor, deci nu se
poate edita pe loc. Butonul făcea o copie alături, „… (copie)": în listă apăreau două
carduri, iar omul — care voia să schimbe șablonul, nu să mai aibă unul — o ștergea.

Astăzi editorul se deschide pe conținutul șablonului de platformă și **nu creează nimic
până la „Salvează"**; salvarea cheamă `personalizeazaSablonEvaluare`, care face un singur
INSERT cu `derivat_din` = șablonul de platformă (`0168_sablon_evaluare_personalizat.sql`).
Baza garantează că originea e chiar un șablon de platformă (trigger) și că firma are o
singură variantă vie (index unic parțial): `23505` înseamnă „a fost deja creată", de
exemplu din altă filă, iar `P0001` vine cu mesajul triggerului. `stergeSablonEvaluare` pe
variantă readuce în listă șablonul de platformă.

## Ștergerea logică nu trece prin `update({ deleted_at })`

Pe o tabelă a cărei politică SELECT cere `deleted_at is null`, UPDATE-ul care pune
`deleted_at` pică ÎNTOTDEAUNA cu `42501`, cu sau fără `.select()` după: clauza WHERE
citește coloane, deci rândul NOU e verificat contra politicii SELECT, iar el e tocmai cel
ascuns. Acțiunile care ștergeau așa nu funcționaseră niciodată — printre ele ținta și
indicatorul KPI, plus compensările care își înghițeau eroarea. — capcana #48

Astăzi: `stergeSablonEvaluare` → `public.sterge_sablon_evaluare`
(`0162_sterge_sablon_evaluare.sql`), care repetă autorizarea politicii de UPDATE și refuză
șablonul folosit de vreo evaluare (`P0001`, „arhivați-l") sau inexistent ori de platformă
(`P0002`); mesajele lor sunt scrise pentru om și trec neschimbate, fiindcă
`mapPostgrestError` le-ar fi înlocuit cu formularea generică. Restul — `kpi_seturi`,
`kpi_indicatori`, `kpi_tinte_angajat`, `kpi_evaluari_lunare` — trec prin `stergeLogic()`
din `src/lib/supabase/sterge-logic.ts` → `public.sterge_logic`
(`0164_sterge_logic.sql`), inclusiv compensările care retrag un set sau o lună rămase fără
linii. Un vector gol de la funcție = „nimic de șters" SAU „refuzat de `USING`", deci se
tratează ca un UPDATE cu zero rânduri: CONFLICT. `stergeTintaKpi` citește angajatul
ÎNAINTE de ștergere — după ea, politica SELECT nu mai lasă rândul să fie văzut, iar
revalidarea fișei are nevoie de el.

## Notificările: un plus, niciodată poarta

`src/app/(app)/evaluari/anunta-evaluarea.ts` duce vestea celui care n-ar afla-o altfel:
angajatului că evaluarea lui a fost finalizată (`finalizeazaEvaluare` și
`creeazaEvaluare` cu `status = "finalizat"`), managerului direct că are o ciornă de notat
(`planificaEvaluari`), angajatului că luna KPI s-a închis, cu scorul
(`finalizeazaLunaKpi`).

Primesc `createAdminSupabase()` din `actions.ts` — singurul loc în care ESLint îl permite
—, fiindcă `notifications` se scrie pentru ALT utilizator, al cărui `user_id` un manager cu
`employees:read = team` nu-l vede neapărat; ocolirea RLS e mărginită de filtrul explicit pe
`organization_id`. Niciuna nu aruncă: când se ajunge la ele, scrierea e deja făcută, iar o
notificare picată n-are voie s-o dea înapoi — eșecul se loghează și acțiunea întoarce
reușita.

Linkul depinde de rol: `employee` e trimis în portal (`/portal/evaluarile-mele`,
`/portal/kpi-ul-meu`), orice alt rol în aplicație (`/evaluari/ale-mele`) — portalul e doar
al rolului `employee`, iar un manager evaluat ar fi ajuns pe o adresă care îl
redirecționează în altă parte. Fișa fără cont nu primește nimic: angajatul n-a fost încă
invitat, iar evaluarea îl așteaptă din clipa în care intră.
