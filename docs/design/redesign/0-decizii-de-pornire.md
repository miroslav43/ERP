# Faza B — cele trei decizii dinaintea primei linii de cod

**Dată:** 2026-08-23 · **Stare:** aplicată (B2), scrisă (B1, B3)

Trei lucruri trebuiau hotărâte înainte de a scrie `cn()` și primitivele, fiindcă fiecare
dintre ele ar fi blocat sau ar fi corupt tăcut o fază de mai târziu. Documentul le închide.

---

## B1 · Scadențele: valorile rămân diferite, vocabularul se unifică

### Ce părea a fi problema

`PRAG_AVERTIZARE_ZILE` există de trei ori, cu **același nume** și **două valori**, iar două
dintre ele sunt fixate de teste:

```
src/domain/ssm/scadente.test.ts:34        expect(PRAG_AVERTIZARE_ZILE).toBe(30)
src/domain/maintenance/scadente.test.ts:41 expect(PRAG_AVERTIZARE_ZILE).toBe(15)
```

O componentă `Scadenta` cu un prag implicit unic ar sparge o suită indiferent ce valoare alege.

### Ce e de fapt problema

Citite până la capăt, cele trei module nu au praguri diferite — au **vocabulare de stare
diferite**, iar același `expiraLa === null` înseamnă în ele trei severități incompatibile.

| domeniu | fișier | prag | stări | ce înseamnă `null` |
| --- | --- | --- | --- | --- |
| SSM și PSI | `src/domain/ssm/scadente.ts:22` | **30** zile, plus critic la **7** | `niciodata` · `expirat` · `critic` · `atentie` · `ok` | **`ok`** — tipul n-are periodicitate legală, deci odată efectuat nu expiră niciodată |
| Mentenanță | `src/domain/maintenance/scadente.ts:17` | **15** zile, plus 10 % din periodicitatea contorului | `in_intarziere` · `scadenta_apropiata` · `in_regula` · `fara_scadenta` | **`fara_scadenta`** — neutru, rang 0, sub „în regulă" |
| Flotă | `src/app/(app)/flota/etichete.ts:57` | **30** zile | `expirat` · `curand` · `in_regula` · `lipsa` | **`lipsa`** — grav |

Un `Scadenta` cu un singur comportament implicit pentru `null` ar fi schimbat tăcut severitatea
în două module din trei. Asta, nu numărul 30 sau 15, era capcana.

### Decizia

**1. Valorile rămân. Se schimbă numele, ca să nu mai poată fi confundate.**

| azi | devine | valoare | de ce exact atât |
| --- | --- | --- | --- |
| `PRAG_AVERTIZARE_ZILE` (ssm) | `PRAG_SSM_AVERTIZARE_ZILE` | 30 | E `ssm_legal_parameters.zile_avertizare_scadenta` din seed-ul `0011`. Parametru de reglementare, nu convenție de interfață. |
| `PRAG_CRITIC_ZILE` (ssm) | `PRAG_SSM_CRITIC_ZILE` | 7 | Convenție de interfață, declarată ca atare în comentariul existent. |
| `PRAG_AVERTIZARE_ZILE` (mentenanță) | `PRAG_MENTENANTA_AVERTIZARE_ZILE` | 15 | **Mentenanța se programează, nu se reînnoiește.** O revizie se prinde în graficul echipei în două săptămâni; o autorizație se reînnoiește la o instituție, cu drum și termen de eliberare. Preavizul măsoară timpul până la acțiune, iar acțiunile sunt de naturi diferite. |
| `PRAG_AVERTIZARE_ZILE` (flotă) | `PRAG_FLOTA_AVERTIZARE_ZILE` | 30 | ITP, RCA și asigurarea se reînnoiesc la un terț, ca și documentele SSM. Aceeași natură, deci același preaviz. |

Cele două aserțiuni din teste își schimbă **numele importat, nu valoarea**. Nicio suită nu se
sparge pe cifră.

**2. Vocabularul se unifică în șase trepte.** Cinci pentru scadențe reale, una pentru „nu se
poate calcula".

```ts
export type TreaptaScadenta =
  | "neaplicabil"  // nu expiră niciodată, sau nu avem de unde număra — FĂRĂ semnal
  | "in_regula"    // are termen și e departe
  | "curand"       // ≤ pragul de avertizare
  | "critic"       // ≤ pragul critic
  | "expirat"      // termenul a trecut
  | "lipsa";       // ar trebui să existe și nu există
```

Rangul de gravitate, în ordinea de mai sus: `neaplicabil` 0 → `lipsa` 5.

**`lipsa` e deasupra lui `expirat`**, iar motivul e deja scris în proiect, în
`src/domain/ssm/scadente.ts`:

> „un tip de instruire obligatoriu pe care angajatul nu l-a făcut NICIODATĂ e mai grav decât
> unul expirat de curând — nu există măcar un istoric, deci nu se poate calcula o scadență."

Același lucru e adevărat pentru un vehicul fără niciun document: nu are dată de la care să
numere, deci **nu se va aprinde niciodată singur**, oricât ar trece. Cazul e real în baza de
producție, nu ipotetic.

**3. Semantica lui `null` rămâne la apelant. Primitiva nu ghicește niciodată.**

Traducerea, fără pierdere de înțeles:

| SSM | → | Mentenanță | → | Flotă | → |
| --- | --- | --- | --- | --- | --- |
| `niciodata` | `lipsa` | `in_intarziere` | `expirat` | `lipsa` | `lipsa` |
| `expirat` | `expirat` | `scadenta_apropiata` | `curand` | `expirat` | `expirat` |
| `critic` | `critic` | `in_regula` | `in_regula` | `curand` | `curand` |
| `atentie` | `curand` | `fara_scadenta` | `neaplicabil` | `in_regula` | `in_regula` |
| `ok` (cu termen) | `in_regula` | | | | |
| `ok` (`null`, nu expiră) | `neaplicabil` | | | | |

Mentenanța și flota nu produc niciodată `critic` — și e în regulă. O treaptă neatinsă nu strică
nimic; o treaptă lipsă ar fi obligat un modul să mintă.

**Unde stă codul.** `stareScadenta` se mută din `src/app/(app)/flota/etichete.ts` în
`src/domain/fleet/scadente.ts`, lângă surorile ei. Comparația lexicografică pe ISO se
păstrează exact — e corectă și evită capcana de fus orar, explicată în comentariul existent.

**Se face în Faza 3**, odată cu primitiva `Scadenta`. Aici s-a decis doar ce se face.

---

## B2 · Prettier nu sortează clasele din `cn()` și `cva()` — aplicat

### Dovada, rulată pe instalarea proiectului

```
$ printf 'export const A = () => <div className="p-4 flex text-sm bg-surface" />;\n' \
    | pnpm exec prettier --stdin-filepath proba.tsx
export const A = () => <div className="bg-surface flex p-4 text-sm" />;   ← sortat

$ printf 'export const B = cn("p-4 flex text-sm bg-surface");\n' \
    | pnpm exec prettier --stdin-filepath proba.ts
export const B = cn("p-4 flex text-sm bg-surface");                       ← NESORTAT

$ printf 'export const c = cva("p-4 flex text-sm bg-surface");\n' \
    | pnpm exec prettier --stdin-filepath proba.ts
export const c = cva("p-4 flex text-sm bg-surface");                      ← NESORTAT
```

### De ce contează exact acum

Din clipa în care clasele se mută din `className="…"` în `cn(…)` și `cva(…)`,
`src/components/ui/` devine singurul cod din depozit cu clase nesortate — iar
`pnpm format:check`, care rulează în CI (`.github/workflows/ci.yml:40`), **nu se plânge**,
fiindcă fișierul e consistent-nesortat. Defectul ar fi trecut nevăzut exact în locul de unde
se propagă în tot restul aplicației.

### Reparația, deja aplicată

`.prettierrc.json` primește:

```json
"tailwindFunctions": ["cn", "cva", "buton", "clasaControl"]
```

Verificat după aplicare: `cn("p-4 flex text-sm bg-surface")` devine
`cn("bg-surface flex p-4 text-sm")`, iar `clasaControl("h-9 w-full px-3 border rounded-md")`
devine `clasaControl("h-9 w-full rounded-md border px-3")`.

`buton` și `clasaControl` sunt trecute în listă **înainte de a exista**, deliberat: un nume
necunoscut de plugin e ignorat fără eroare, iar așa nu există fereastra în care primitiva
există și sortarea încă nu.

---

## B3 · Suprafața partajată: ~50 de puncte, în cinci zone

Cifrele sunt măsurate pe arbore, nu estimate.

### Ce consumă fiecare zonă din afara ei

| primitivă | `(app)` | `(portal)` | `(platform)` | `(marketing)` | `(auth)`+`(onboarding)` | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `feedback/acces-restrictionat` | 90 | 22 | — | — | — | **112** |
| `feedback/empty-state` | 52 | 16 | — | — | — | **68** |
| `data/skeleton-table` | 56 | — | — | — | — | **56** |
| `data/rand-tabel` | 17 | — | 1 | — | — | **18** |
| `feedback/stare-eroare` | 12 | 1 | — | — | — | **13** |
| `components/onboarding/pas-*` + `progres-asistent` | — | — | 8 | — | 7 | **15** |
| `data/avatar-angajat` | 4 | 1 | — | — | — | **5** |
| `feedback/schelet` | 3 | 1 | — | — | — | **4** |
| `payroll/taxe-pie-chart` | 1 | — | — | 1 | — | **2** |
| `payroll/fluturas` | 1 | 1 | — | — | — | **2** |
| `audit/jurnal-audit` + `schelet-audit` | 1 | — | 2 | — | — | **3** |
| `forms/selector-cod-caen` | 1 | — | 1 | — | — | **2** |
| `forms/formular-profil` | 1 | 1 | — | — | — | **2** |
| `layout/raporteaza-problema` | 1 | 1 | — | — | — | **2** |

În plus, portalul importă **8 fișiere `*/etichete.ts`** din rutele `(app)` (13 importuri:
ticketing, onboarding, diurnă, concedii, SSM, pontaj, mentenanță, inventar) și **13 componente
client** direct din rute `(app)`.

### Decizia, pe fiecare

| primitivă | decizie | consecință |
| --- | --- | --- |
| `AccesRestrictionat` | **se propagă** | Faza 1 îi scoate `<main>`-ul. Portalul are `<main>` propriu la `(portal)/layout.tsx:94`, consola la `(platform)/…/layout.tsx:51` — verificat, nu presupus. |
| `EmptyState` → `StareGoala` | **se propagă**, în același commit | Semnătura se schimbă (`action` devine `actiune`, cu variantă `onClick`). Cele 16 apeluri din portal migrează odată cu cele 52 din `(app)`, altfel jumătate de portal rămâne pe forma veche. |
| `SkeletonTable` → `Schelet` | **se propagă** | Se unifică cu `ScheletLista`/`ScheletCarduri`, care au azi semantică ARIA **opusă** (`role="status"` vs `aria-hidden`). |
| `RandTabel` | **se propagă** | Criticul de audit susținea că trebuie bifurcat, fiindcă „consola are fundal invers". Verificat: pânza consolei e `bg-background` (crem), la fel ca a aplicației — doar railul și antetul sunt navy. Reparația `hover:bg-surface` înseamnă acolo exact același lucru. **Nu se bifurcă.** |
| `StareEroare` | **se propagă** | Se păstrează prop-ul `retry` al copiilor manuale, nu `reset`-ul celor 11 „corecte": în Next 16.3, `reset` golește starea fără să reîncarce, deci butonul „Reîncearcă" e mut. |
| `taxe-pie-chart` | **se mută** în `src/components/grafice/` la Faza 5 | Importul din `(marketing)` trebuie să urmeze. E singura primitivă care a trecut deja granița bilingvă. |
| 8 × `*/etichete.ts` | **se propagă** | **Faza 0 este, prin urmare, un redesign parțial al portalului pe 8 module.** Nu e efect secundar, e domeniu — și se verifică vizual în portal, nu doar prin `pnpm typecheck`. |
| `MarcheazaCitit` | **se mută** în `src/components/anunturi/` | O rută din `(portal)` nu are ce importa dintr-o rută din `(app)`. Mutarea se face la Faza 11 (Anunțuri). |
| 13 componente client din rute `(app)` | **se propagă, modul cu modul** | Regulă la fiecare modul din Fazele 6–25: consumatorii lui din portal se verifică în același commit. |
| `pas-1..7` + `progres-asistent` | **se propagă**, Faza 2.5 | `pas-6-proprietar` e folosit **doar** de consolă: cine își înrolează singur firma e proprietarul, deci pasul n-are sens acolo. Cei doi asistenți împart 6 din 7 pași — consola se verifică odată cu `(onboarding)`. |

### Două datorii descoperite pe drum

- **`progres-asistent` există în două exemplare**: `src/components/onboarding/progres-asistent.tsx`
  (83 de linii, partajat cu consola) și `src/app/(app)/angajati/nou/_components/progres-asistent.tsx`
  (50 de linii, local). Se unifică la Faza 2.5.
- **`(auth)` n-are skip link.** `(app)` și `(portal)` au `<a href="#continut">`, `(auth)` nu — și
  e primul ecran pe care îl vede orice om. Intră în Faza 1, odată cu cromatica.
