# Redesign — ce s-a livrat până acum

**Ultima actualizare:** 2026-08-23 · Fazele B, 0, 1, 2 (primitive) și 4 (panoul)

Documentul înregistrează **ce s-a schimbat și de ce**, ca următoarea sesiune să nu
redescopere. Ce urmează e în planul aprobat; ce e închis, e aici.

---

## Cifrele, înainte și după

| ce                                         | înainte | acum  |
| ------------------------------------------ | ------: | ----: |
| Clase din paleta implicită Tailwind        |     110 | **0** |
| Hărți de stare `CLASE_*`                   |      27 | **1** (`CLASE_TIP_ZI`, excepție documentată) |
| Scara tipografică veche (`text-sm`, …)     |    1447 | **6** (doar comentarii) |
| `disabled:opacity-*` (3,22:1 și 4,34:1)    |      90 | **3** |
| Inele de focus scrise local                |     155 | **0** (6 apariții, toate în comentarii și teste) |
| Clasa butonului primar, copiată            |     200 | **11** (toate non-butoane, verificate) |
| Landmark-uri `<main>` duplicate            |     181 | **0** |
| Antete `<header>` scrise de mână           |     122 | **1** (bannerul portalului, n-are `<h1>`) |
| Stări goale concurente                     |       3 | **1** |
| Sisteme de schelet, cu ARIA opusă          |       2 | **1** |
| Ecrane de eroare concurente                |       3 | **1** |
| `loading.tsx` / `error.tsx`                | 53 / 50 | **65 / 61**, plus `global-error` și `not-found` |
| Teste care randează o componentă           |       0 | **96** |
| Teste, total                               |    ~975 | **1342** |

---

## Defecte reale găsite pe drum

Nu erau în plan. Au ieșit din migrare și fiecare era invizibil pentru `typecheck`,
`lint` și `build`.

**38 de `error.tsx` aveau butonul „Reîncearcă" MORT.** Destructurau `{ error, retry }`,
dar Next trimite `{ error, reset }` — `retry` era `undefined`, iar clicul arunca
`TypeError`. Toate 38 erau copii manuale ale aceluiași fișier.

Ironia: cele 11 fișiere „corecte", care trimiteau `reset`, aveau ALT defect —
`reset()` singur golește limita de eroare, dar rezultatul cache-uit de pe server
rămâne cel stricat, deci ecranul se reface identic. Copiile „proaste" își scriau
propriul handler cu `router.refresh()` și funcționau. Consolidarea a păstrat
comportamentul copiilor.

**`tailwind-merge` ștergea tăcut jumătate din clasele primitivelor.** Nu știe că
`text-corp` e o mărime declarată în `@theme`; vede prefixul `text-`, o clasifică
drept culoare și o pune în conflict cu `text-foreground`. În funcție de ordinea
în care Prettier sortase clasele, ori pastila își pierdea mărimea, ori câmpul de
formular își pierdea culoarea. Reparat în `src/lib/ui/cn.ts`, fixat de 18 teste
în `cn.test.ts`. **Regula de întreținere: orice token nou în `@theme` sau orice
`@utility` nou primește o pereche în `cn.ts` ȘI un rând în `cn.test.ts`.**

**15 stări goale recomandau „Ștergeți filtrele" fără să existe butonul.** Estimarea
inițială era cinci.

**Trei erori de contrast, apărute la mutarea învelișului pe navy.** `text-muted-foreground`
pe navy = 1,52:1 (firimitura, practic invizibilă); butonul „Comută" al comutatorului
de organizație era `bg-primary` pe `bg-primary`, adică dispărut; textul de eroare
al aceluiași comutator, `text-danger` pe navy = 2,51:1. Toate trei erau corecte pe
crem și s-au stricat când fundalul s-a schimbat.

**`(portal)/layout.tsx` n-avea nicio lățime maximă.** Fiecare pagină își purta
propriul `max-w-2xl` — 21 de copii ale aceleiași valori, iar a 22-a lipsea. Când
paginile au trecut pe lățimile numite, listele portalului s-au întins pe toată
lățimea ecranului. Lățimea aparține acum învelișului.

**Cinci schelete desenau alt număr de coloane decât tabelul de sub ele** — exact
saltul de layout pe care propriul lor comentariu pretindea că-l evită.

**`--font-mono` nu era declarat nicăieri**, deși `font-mono` apare de 75 de ori:
CNP-ul, IBAN-ul, CUI-ul și codul COR se randau în trei fonturi diferite, după
sistemul de operare. IBM Plex Mono era deja descărcat de consola de platformă și
neconsumat de nimeni — o instanță plătită și nefolosită.

---

## Deciziile care se pot uita ușor

**Scadențele: valorile rămân diferite, vocabularul se unifică.** Cele trei
`PRAG_AVERTIZARE_ZILE` (SSM 30, mentenanță 15, flotă 30) NU erau trei valori ale
aceluiași lucru — `expiraLa === null` însemna `ok` la SSM, `fara_scadenta` la
mentenanță și `lipsa` la flotă. Trei severități incompatibile. Detaliile în
`0-decizii-de-pornire.md` §B1.

**Nicio primitivă din `src/components/ui/` nu primește `"use client"`** decât dacă
are stare proprie. Fără directivă, fișierul e *partajat*: se compilează în graful
care îl importă, deci o funcție de randare (`children` ca funcție) nu traversează
niciodată granița server→client. Toate cele 94 de pagini din `(app)` sunt Server
Components; un `useId()` într-o primitivă le-ar fi rupt pe toate.

**Notificările folosesc API-ul `popover`, nu `z-index`.** `<dialog>` cu
`showModal()` intră în TOP LAYER, deasupra oricărui `z-index`. O notificare pe un
nivel obișnuit ar fi fost invizibilă exact în cazul pentru care există:
confirmarea unei acțiuni ireversibile, cu „Anulează" în ea.

**Contorul se derivă din aceeași logică ca lista.** În firma de demonstrație
există 7 sarcini de aprobare `in_asteptare`, toate pe cereri deja anulate sau
aprobate — `approval_tasks` n-are cheie străină către entitate (legătură
polimorfă). Un `count(*)` naiv ar fi afișat „7 de semnat" permanent. Panoul
numără CERERILE. Vezi capul lui `src/lib/queries/panou.ts`.

**„Lipsește" e o treaptă proprie, mai gravă decât „expiră curând".** Un vehicul
fără niciun document n-are dată de la care să numere, deci nu se aprinde
niciodată singur. Cazul e real în producție: firma de demonstrație are exact un
astfel de vehicul, și zero scadențe în fereastra de 30 de zile.

**Indicatorii se adaptează la efectiv.** Sub 25 de angajați, panoul arată numere
absolute; procentele apar abia peste prag. Pe cei 8 angajați ai celei mai mari
firme reale, o plecare înseamnă 12,5 % fluctuație.

---

## Ce a rămas de prins DOAR de `pnpm build`

Verificarea mea se oprește la `tsc --noEmit`, `eslint`, `prettier --check` și
`vitest`. Build-ul îl dă utilizatorul, cu `./administrativo.sh prod`.

Ce nu se vede fără el:

- **granița server/client** — un fișier `"use server"` care exportă o constantă
  trece de `tsc` și cade la build;
- **`popover` și `<dialog>`** în `toast.tsx` și `dialog.tsx`, care ating API-uri
  de browser la prima randare;
- **fonturile `next/font`** — `monoCifre` e declarat într-un modul propriu și
  aplicat pe trei învelișuri; o cale greșită se vede abia la build.

---

## Ce NU s-a atins

`(marketing)` — are propriul sistem calculat (`--mk-celula: 34px`, „pasul vertical
e 8px, fără excepție"); cele 17 apariții ale scării vechi de acolo sunt corecte în
sistemul lor. Migrările de bază de date. Testele E2E. Modulele lipsă (campanii de
evaluare, bareme pe țări, `employee_change_requests`).
