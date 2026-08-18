# Stările de interacțiune — decizia aplicată

## Alegere

**„Două fundaluri, o cerneală" (propunerea 1) ca sistem de bază**, cu trei corecții preluate din 2 și 3 și cu o simplificare proprie: în tabel există exact DOUĂ fundaluri, ambele OPACE, și zero token noi.

Corecțiile aplicate peste propunerea 1:
1. `color-scheme: light` merge în `globals.css` pe `:root` (varianta 2/3), NU ca `scheme-light` pe `<html>` (varianta 1). Clasa e reală — am compilat-o cu tailwindcss 4.3.3 al proiectului și emite `color-scheme: light` — dar o linie în `:root`, lângă paletă, nu poate fi ștearsă din greșeală la o editare de layout și prinde și `::-webkit-autofill` și bara de derulare. Plus `accent-color`, indicatorul de calendar și autofill (varianta 3).
2. Rândul „selectat" NU folosește `bg-primary/8` (varianta 1) și cu atât mai puțin `bg-primary/12` (varianta 2): selectat = `bg-surface` + bară navy de 2px pe prima celulă + checkbox bifat. Motiv la punctul 2 din „contraste".
3. Butonul distructiv nu are nevoie de `--color-danger-hover` (varianta 1 și 2 îl cereau): la hover se INVERSEAZĂ în plin (varianta 3), 6,11:1 în ambele stări, semnal care merge spre închis, zero tokeni.

## De ce

1. Foaia colectivă de pontaj decide singură: are `<thead sticky>`, coloană `sticky left-0` și celule cu fundal propriu. Orice fundal de rând translucid (varianta 2: hover `/6`, selectat `/12`, `/16`) lasă conținutul să se vadă pe sub coloana lipită la derulare orizontală — varianta 2 recunoaște regula „ce acoperă trebuie să fie opac" doar pentru antet, dar rândul ei rămâne translucid. Varianta 1 și 3 sunt opace pe rând; varianta 1 o face fără token nou.
2. Varianta 2 pică WCAG pe exact starea pe care o inventează: `text-muted-foreground` pe `bg-primary/12` = 4,37:1 și pe `/16` = 4,01:1 (calculat, nu estimat). Nu listează perechea. Rândul ei selectat e neconform.
3. Varianta 3 introduce `--color-rule: #847f70`, o a patra familie de nuanțe (gri-oliv) care nu e nici crem, nici navy, și un rând activ auriu de 1,14:1 pe pagină — pe care propria secțiune de riscuri îl declară neconform. Auriul ca purtător de stare e o funcție pe care paleta nu i-o dă.
4. `<select>` și `<input type=date>` nu se repară din clase: toate trei o spun, dar numai 2 și 3 pun linia în `globals.css`, unde nu depinde de un utilitar Tailwind și acoperă și bara de derulare a paginii.
5. Hover-ul de rând cerut „mic, dar perceptibil": `bg-surface` = ΔL* 3,45 și 1,092:1 față de pagină, cu textul secundar la 5,08:1. E singura treaptă care ține și textul secundar peste 4,5:1 — treapta următoare (`bg-border`, ΔL* 9,7) îl coboară la 4,31:1, deci e admisă numai pe `active:` de buton, unde nu există text secundar.
6. Zero tokeni noi înseamnă că reinjectarea culorii per organizație (promisă în comentariul din `globals.css`) nu are variabile derivate de resincronizat.

## Tokeni noi

**Niciunul.** `globals.css` primește doar comportament, nu culoare: `color-scheme: light` și `accent-color: var(--color-primary)` pe `:root`, plus două reguli pentru internele native (`input:-webkit-autofill`, `input[type="date"]::-webkit-calendar-picker-indicator`). `@theme inline` rămâne neatins.

De ce se poate, când două din trei propuneri cereau tokeni:

- `--color-border-strong` / `--color-rule` (chenar de câmp): înlocuit cu `border-foreground/60`. Nu e o culoare nouă, e o modulație a cernelii — și, în plus, e MAI stabil decât un token solid: fundalul unui element se pictează implicit sub chenar (`background-clip: border-box`), deci `border-foreground/60` pe un câmp cu `bg-background` compune mereu peste `#faf7f0` → **4,23:1**, indiferent dacă acel câmp stă pe pagină sau pe panoul de filtre. Un `#79808e` solid ar da 3,71:1 pe pagină și 3,40:1 pe panou — marjă mai mică, tocmai unde e nevoie de ea.
- `--color-danger-hover` / `--color-danger-active`: nu mai există buton distructiv plin. Distructivul e conturat și se INVERSEAZĂ la hover (`hover:bg-danger hover:text-danger-foreground`), 6,11:1 în ambele stări, semnal care merge spre închis. Cele două locuri cu `bg-rose-700 hover:bg-rose-800` (confirmarea de casare, confirmarea din dialog) devin butonul conturat. `brightness-90` a fost respins: e un filtru, deci stinge și pictograma și inelul de focus odată cu fondul.
- `--color-surface-raised` (antet lipicios): înlocuit cu `bg-surface`, care e deja opac. Treapta a doua, unde e nevoie de ea (`active:` pe controale), e `bg-border` — token existent, `#e3dbc9`, ΔL* 9,7 față de pagină.
- `--color-row-zebra` / `--color-row-active`: nu există zebră și nu există rând activ auriu.

Un singur token ar deveni necesar dacă produsul cere vreodată o a treia treaptă OPACĂ într-un tabel (rând selectat distinct de rând la hover, într-o listă cu checkbox-uri). `bg-border` nu poate ocupa acel loc: textul secundar pe el e 4,31:1. Atunci — și numai atunci — se adaugă `--color-surface-2: #e7e6e2` (adică `primary 8%` peste crem, opac), care ține textul secundar la 4,74:1.

## Tabelul de aplicat

PRINCIPIU: în tabele și pagini există exact două fundaluri, ambele opace — `bg-background` (repaus) și `bg-surface` (atins sau recesat). A treia treaptă, `bg-border`, apare NUMAI pe `active:` la controale. Restul stărilor se fac din chenar, cuvânt și pictogramă.

**0. globals.css / layout — se face ÎNTÂI, altfel restul nu repară capturile**

| element | stare | ce se scrie |
|---|---|---|
| `:root` | controale native | `color-scheme: light;` |
| `:root` | checkbox/radio/progress | `accent-color: var(--color-primary);` |
| `input:-webkit-autofill` | autofill Chrome | `-webkit-text-fill-color: var(--color-foreground); box-shadow: 0 0 0 1000px var(--color-background) inset;` |
| `input[type="date"]::-webkit-calendar-picker-indicator` | glifa nativă | `opacity: .6; cursor: pointer;` + `:hover { opacity: 1 }` |
| `:focus-visible` | inelul global | rămâne exact cum e (`2px solid var(--color-ring)`, offset 2) — nu se dublează în clase |
| `@theme inline` | — | nemodificat |

**1. RÂND DE TABEL**

| element | stare | clase exacte |
|---|---|---|
| înveliș | — | `overflow-x-auto rounded-lg border border-border bg-background` |
| `<table>` | — | `w-full text-left text-sm` |
| `<tbody>` | — | `divide-y divide-border` |
| `<tr>` | normal | `group/rand transition-colors` (fără fundal — moștenește pagina) |
| `<tr>` | hover | `hover:bg-surface` |
| `<tr>` | selectat | `bg-surface` + prima celulă `border-l-2 border-l-primary` + checkbox bifat (`accent-primary`) |
| `<tr>` | selectat + hover | rămâne `bg-surface` — starea o poartă bara și checkbox-ul, nu fundalul |
| prima `<td>` | normal | `border-l-2 border-l-transparent` (obligatoriu, altfel rândurile sar 2px la selecție) |
| `<td>` | — | `px-4 py-3 align-middle` |
| `<td>` numeric | — | `px-4 py-3 text-right tabular-nums` |
| text secundar în celulă | — | `text-muted-foreground` |
| link în rând | — | `font-medium text-primary underline-offset-2 hover:underline` |
| zebra | — | *niciuna.* Ocupă fix treapta folosită de hover; `divide-y divide-border` face urmărirea rândului cu zero cerneală |
| linii verticale | — | interzise în tabelele-listă; permise DOAR în matrice (pontaj): `border-r border-border` |

**1b. MATRICE (foaia colectivă, 31 de coloane) — singurul caz cu sticky**

| element | stare | clase exacte |
|---|---|---|
| `<tr>` | normal / hover | `group/rand transition-colors hover:bg-surface` |
| `<th scope="row">` lipit | normal | `sticky left-0 z-10 border-r border-border bg-background px-3 py-2 text-left font-normal whitespace-nowrap` |
| `<th scope="row">` lipit | hover pe rând | `group-hover/rand:bg-surface` — **niciodată `bg-inherit`**: fundalul rândului la repaus e transparent |
| `<td>` de zi | — | `border-r border-border px-1 py-2 text-center text-xs` |
| butonul din celulă | hover | `hover:outline-2 hover:-outline-offset-2 hover:outline-ring` — inel INTERIOR, nu umplere: e singurul feedback uniform peste toate cele 4 umpluturi de coloană |
| butonul din celulă | focus | `focus-visible:-outline-offset-2` (singura suprascriere locală permisă a regulii globale: cu offset pozitiv, inelul e acoperit de celula vecină) |
| celulă goală editabilă | — | „—" în `text-muted-foreground` (era `text-zinc-300`) |
| `CLASE_TIP_ZI` | lucrătoare | `""` |
| `CLASE_TIP_ZI` | weekend | `"bg-surface"` |
| `CLASE_TIP_ZI` | sărbătoare | `"bg-accent/25"` — singura apariție a auriului din tot sistemul; sensul e purtat deja de „*", `title` și `aria-label` |
| `CLASE_TIP_ZI` | absență nemotivată | `"bg-danger/8"` — singura excepție care merită alarmă |
| `CLASE_TIP_ZI` | concediu / medical / delegație | `""` — codul de 3 litere din celulă e purtătorul (era albastru / mov / verde) |
| `<thead>` lipit | — | `bg-surface` pe FIECARE `<th>`, nu pe `<thead>` (cu `border-collapse: collapse`, fundalul de pe grup nu se pictează sub sticky) |
| `<th>` de zi weekend/sărbătoare | — | fără tentă: „S"/„D"/„*" există deja în antet, iar un `<th>` lipit trebuie să fie opac |
| `<tfoot>` | — | `bg-surface font-medium`; celula lipită: `sticky left-0 z-10 bg-surface` |

**2. ANTET DE TABEL**

| element | stare | clase exacte |
|---|---|---|
| `<thead>` | — | `bg-surface border-b border-border text-left` |
| `<thead>` lung | lipit | `sticky top-0 z-20` + `bg-surface` repetat pe fiecare `<th>` |
| `<th>` | — | `px-4 py-3 text-left text-xs font-semibold tracking-wide text-foreground` |
| `<th>` numeric | — | `px-4 py-3 text-right text-xs font-semibold tabular-nums` |
| buton de sortare din `<th>` | normal → hover | `-m-1 flex w-full items-center gap-1 rounded p-1 text-left transition-colors hover:bg-border` (treapta 2, opacă, peste antetul deja `bg-surface`) |
| indicator de sortare | — | `<ChevronUp/ChevronDown className="size-3.5" aria-hidden />` + `aria-sort` pe `<th>` |

**3. CÂMP DE INTRARE**

| element | stare | clase exacte |
|---|---|---|
| `<label>` | — | `mb-1 block text-sm font-medium text-foreground` |
| `<input>` / `<textarea>` | normal | `h-9 w-full rounded-md border border-foreground/60 bg-background px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground` (`<textarea>`: `min-h-20 py-2` în loc de `h-9`) |
| câmp | hover | `hover:border-foreground` |
| câmp | focus | **nicio clasă** — regula globală `:focus-visible`. Se ȘTERG `outline-none`, `focus-visible:outline-2`, `focus-visible:outline-offset-2`, `focus-visible:ring-2 focus-visible:outline-none`, `focus-visible:ring-ring` |
| câmp | dezactivat | `disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground` |
| câmp | doar-citire | `read-only:border-border read-only:bg-surface` |
| câmp | eroare | `aria-invalid:border-danger` + `aria-invalid="true" aria-describedby={idEroare}` |
| mesaj de eroare | — | `mt-1 flex items-start gap-1.5 text-xs text-danger` + `<AlertCircle className="size-3.5 shrink-0 translate-y-px" aria-hidden />` + `role="alert"` |
| text ajutător | — | `mt-1 text-xs text-muted-foreground` |
| înveliș `<select>` | — | `relative` |
| `<select>` | normal | bază + `cursor-pointer appearance-none pr-9 [&>option]:bg-background [&>option]:text-foreground` |
| chevron | — | `<ChevronDown aria-hidden className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2" />` |
| `<input type="date">` | normal | bază + `min-w-40 [&::-webkit-datetime-edit]:text-foreground [&::-webkit-inner-spin-button]:appearance-none` (indicatorul de calendar e stilat global) |
| `<input type="checkbox">` | — | `size-4 shrink-0 rounded-xs border-foreground/60 accent-primary` |
| câmp de căutare (înveliș) | normal / focus | `flex items-center gap-2 rounded-md border border-foreground/60 bg-background px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring` |
| input din înveliș | — | `w-full bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground` (**fără** `outline-none`) |
| câmp în panoul de filtre | — | rămâne `bg-background` — căsuța de scris e mereu treapta cea mai deschisă |

**4. BUTOANE**

| element | stare | clase exacte |
|---|---|---|
| bază (toate) | — | `inline-flex h-9 items-center justify-center gap-2 rounded-md border border-transparent px-4 text-sm font-medium whitespace-nowrap transition-colors active:translate-y-px` |
| dezactivat (toate, identic) | — | `disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground disabled:translate-y-0` |
| în lucru (toate) | — | `aria-busy:cursor-progress` + `<Loader2 className="size-4 animate-spin" aria-hidden />` + text schimbat („Se salvează…") |
| primar | normal / hover / apăsat | `bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active` |
| secundar | normal / hover / apăsat | `border-foreground/60 bg-background text-foreground hover:bg-surface active:bg-border` |
| distructiv | normal | `border-danger bg-background text-danger` |
| distructiv | hover / apăsat | `hover:bg-danger hover:text-danger-foreground active:bg-danger active:text-danger-foreground` — inversare, nu diluare |
| distructiv | confirmarea finală din dialog | **aceleași clase** — nu există variantă plină; nu există `--color-danger-hover`, iar opacitatea peste crem DESCHIDE, deci ar da semnal invers |
| terțiar / doar-iconiță | normal → apăsat | `text-foreground hover:bg-surface active:bg-border` (+ `size-9 gap-0 px-0` și `aria-label` obligatoriu la doar-iconiță) |
| link-buton | — | `text-primary underline decoration-1 underline-offset-4 hover:decoration-2 disabled:text-muted-foreground disabled:no-underline` |
| filă de navigație | inactiv / activ | `-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground` / `border-b-2 border-primary text-foreground` + `aria-current="page"` |

**5. BADGE DE STARE** — fundal transparent, ca să nu se bată cu starea rândului

| element | stare | clase exacte |
|---|---|---|
| bază (toate) | — | `inline-flex items-center gap-1.5 rounded-full border border-foreground/30 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground` |
| bulină | — | `size-1.5 shrink-0 rounded-full` + `aria-hidden="true"` (cue redundant; cuvântul e purtătorul) |
| Activ, Aprobată, În regulă, În stoc, Finalizat | — | bază + bulină `bg-success` |
| În lucru, Trimisă, În aprobare, Expiră curând, În service | — | bază + bulină `bg-warning`; textul rămâne `text-foreground` (`text-warning` = 3,40:1, interzis ca text) |
| Respinsă | — | bază + `text-danger` + bulină `bg-danger` |
| Expirat | — | bază + `text-danger` + bulină `bg-danger` + `<AlertTriangle className="size-3 shrink-0" aria-hidden />` — singurul cu pictogramă, ca să se distingă de „Respinsă" fără culoare |
| Anulată, Casat, Arhivat, Întreruptă, Vândut | — | bază + `text-muted-foreground` + bulină `bg-muted-foreground` |
| Ciornă, Candidat, Lipsește | — | bază + `text-muted-foreground` + bulină `border border-muted-foreground bg-transparent` (bulină goală = neînceput) |
| auriu în badge | — | **niciodată** |

**6. CARD / PANOU DE FILTRE / SEPARATOARE**

| element | stare | clase exacte |
|---|---|---|
| card | — | `rounded-lg border border-border bg-background` |
| antet de card | — | `flex items-center justify-between gap-3 border-b border-border px-4 py-3` |
| titlu / corp de card | — | `text-sm font-semibold text-foreground` / `p-4` |
| subsol de card | — | `border-t border-border bg-surface px-4 py-3` |
| card apăsabil | normal → apăsat | `rounded-lg border border-border bg-background p-4 transition-colors hover:bg-surface active:bg-border` |
| panou de filtre | — | `flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4` |
| stare goală | — | `empty-state.tsx` rămâne neatins — e deja corect |
| callout neutru | — | `rounded-md border border-border bg-surface p-3 text-sm text-foreground` |
| callout de eroare | — | `rounded-md border border-danger/40 bg-danger/8 p-3 text-sm text-foreground` + `role="alert"` + `<AlertCircle className="size-4 shrink-0 text-danger" aria-hidden />` |
| callout de atenție | — | `rounded-md border border-warning/40 bg-warning/12 p-3 text-sm text-foreground` + `<AlertTriangle className="size-4 shrink-0" aria-hidden />` |
| callout informativ | — | `rounded-md border border-border bg-surface p-3 text-sm text-foreground` (albastrul dispare — informativul e neutru) |
| separator orizontal | — | `border-t border-border` sau `<hr className="border-border" />` |
| separator de secțiune majoră | — | `border-t-2 border-border` |
| separator vertical în bară | — | `h-5 w-px shrink-0 bg-border` |
| listă în card | — | `divide-y divide-border` |

## Reguli de înlocuire

SCOPUL REAL, măsurat cu grep pe `src`, nu estimat: **1291 de apariții `dark:` în 134 de fișiere** (125 `.tsx` + 9 `.ts`), plus **~1430 de clase din palete străine fără `dark:`** (zinc, slate, blue, sky, rose, red, emerald, amber, orange, purple, violet, white). Briefingul spune ~300 în 52 de fișiere — e de patru ori mai mult. În plus: 90 × `disabled:opacity-*` și 155 × `focus-visible:outline-*`, toate de șters.

═══ PASUL 0 — SE FACE ÎNTÂI, SINGUR, ÎNTR-UN COMMIT SEPARAT ═══
Se adaugă în `src/app/globals.css` blocul de la categoria 0 din tabel. Se dă `next dev` cu macOS pe temă întunecată și se face captură. Abia ce rămâne stricat după linia asta se repară din clase. Dacă se șterg întâi cele 1291 de `dark:`, `<select>`, popup-ul de opțiuni, calendarul, spinnerele și bara de derulare rămân negre exact ca în capturi, iar concluzia va fi că refactorizarea n-a mers.

═══ PASUL 1 — PERECHI MECANICE 1:1 (sed/regex, fără judecată) ═══

-- neutre, fundal --
bg-zinc-50 dark:bg-zinc-900                  ->  bg-surface
bg-zinc-50 dark:bg-zinc-800                  ->  bg-surface
bg-zinc-50 dark:bg-zinc-950                  ->  bg-surface
bg-zinc-50/50 dark:bg-zinc-900/40            ->  bg-surface
bg-zinc-100 dark:bg-zinc-800                 ->  bg-surface
bg-zinc-100 dark:bg-zinc-700                 ->  bg-surface
hover:bg-zinc-50 dark:hover:bg-zinc-900      ->  hover:bg-surface
hover:bg-zinc-50 dark:hover:bg-zinc-800      ->  hover:bg-surface
bg-white dark:bg-zinc-900                    ->  bg-background
bg-white dark:bg-zinc-950                    ->  bg-background
bg-white dark:bg-white                       ->  bg-background
bg-white                                     ->  bg-background
bg-slate-100 dark:bg-slate-800               ->  bg-surface
bg-zinc-900 dark:bg-zinc-100                 ->  bg-primary
text-white dark:text-zinc-900                ->  text-primary-foreground
text-white                                   ->  text-primary-foreground

-- neutre, chenar și separatoare (structură) --
border-zinc-200 dark:border-zinc-700         ->  border-border
border-zinc-200 dark:border-zinc-800         ->  border-border
border-zinc-100 dark:border-zinc-800         ->  border-border
border-zinc-50 dark:border-zinc-900          ->  border-border
border-slate-200 dark:border-slate-700       ->  border-border
divide-zinc-200 dark:divide-zinc-800         ->  divide-border
divide-zinc-200 dark:divide-zinc-700         ->  divide-border
divide-zinc-100 dark:divide-zinc-800         ->  divide-border
divide-slate-200 dark:divide-slate-700       ->  divide-border

-- neutre, chenar de CONTROL (vezi pasul 3 pentru excepții) --
border-zinc-300 dark:border-zinc-700         ->  border-foreground/60
border-zinc-300 dark:border-zinc-600         ->  border-foreground/60
border-slate-300 dark:border-slate-600       ->  border-foreground/60

-- neutre, text --
text-zinc-600 dark:text-zinc-300             ->  text-muted-foreground
text-zinc-600 dark:text-zinc-400             ->  text-muted-foreground
text-zinc-500 dark:text-zinc-400             ->  text-muted-foreground
text-zinc-400 dark:text-zinc-600             ->  text-muted-foreground
text-zinc-300 dark:text-zinc-700             ->  text-muted-foreground
text-slate-600 dark:text-slate-300           ->  text-muted-foreground
text-zinc-700 dark:text-zinc-200             ->  text-foreground
text-zinc-700 dark:text-zinc-300             ->  text-foreground
text-zinc-800 dark:text-zinc-100             ->  text-foreground
text-zinc-900 dark:text-zinc-100             ->  text-foreground
text-slate-700 dark:text-slate-200           ->  text-foreground
text-slate-800 dark:text-slate-100           ->  text-foreground
text-slate-900 dark:text-slate-100           ->  text-foreground
text-slate-900 dark:text-slate-50            ->  text-foreground
hover:text-zinc-900 dark:hover:text-zinc-100 ->  hover:text-foreground
hover:text-zinc-900 dark:hover:text-zinc-50  ->  hover:text-foreground

-- albastru = navy (acțiuni, linkuri, file) --
bg-blue-700                                  ->  bg-primary
hover:bg-blue-800                            ->  hover:bg-primary-hover
bg-sky-700                                   ->  bg-primary
bg-slate-900                                 ->  bg-primary
text-blue-700 dark:text-blue-300             ->  text-primary
text-blue-800 dark:text-blue-300             ->  text-primary
border-blue-700 dark:border-blue-400         ->  border-primary
border-blue-200 dark:border-blue-800         ->  border-border
bg-blue-50 dark:bg-blue-950                  ->  bg-surface
bg-blue-100 dark:bg-blue-950                 ->  bg-surface
bg-blue-100 dark:bg-blue-900                 ->  bg-surface
bg-blue-50/40 dark:bg-blue-950/30            ->  bg-surface
text-blue-900 dark:text-blue-100             ->  text-foreground
text-blue-900 dark:text-blue-50              ->  text-foreground
hover:bg-blue-50 dark:hover:bg-blue-950      ->  hover:outline-2 hover:-outline-offset-2 hover:outline-ring   [DOAR celula din foaia colectivă]

-- roșu / trandafiriu = danger --
text-red-700 dark:text-red-400               ->  text-danger
text-red-800 dark:text-red-200               ->  text-danger
text-red-900 dark:text-red-100               ->  text-danger
text-rose-600 dark:text-rose-400             ->  text-danger
text-rose-700 dark:text-rose-300             ->  text-danger
text-rose-800 dark:text-rose-200             ->  text-danger
text-rose-900 dark:text-rose-50              ->  text-danger
text-rose-900 dark:text-rose-100             ->  text-danger
border-rose-300 dark:border-rose-700         ->  border-danger
border-rose-200 dark:border-rose-900         ->  border-danger/40
border-red-300 dark:border-red-900           ->  border-danger/40
bg-rose-50 dark:bg-rose-950                  ->  bg-danger/8
bg-rose-50/60 dark:bg-rose-950/30            ->  bg-danger/8
bg-red-50 dark:bg-red-950                    ->  bg-danger/8
hover:bg-rose-50 dark:hover:bg-rose-950      ->  hover:bg-danger hover:text-danger-foreground

-- galben / portocaliu = warning --
border-amber-300 dark:border-amber-900       ->  border-warning/40
border-amber-300 dark:border-amber-700       ->  border-warning/40
bg-amber-50 dark:bg-amber-950                ->  bg-warning/12
text-amber-900 dark:text-amber-100           ->  text-foreground
text-amber-900 dark:text-amber-50            ->  text-foreground
text-amber-700 dark:text-amber-400           ->  text-foreground
text-orange-900 dark:text-orange-100         ->  text-foreground
text-orange-900 dark:text-orange-50          ->  text-foreground
ring-1 ring-amber-300                        ->  border border-warning/40

-- verde = success --
border-emerald-300 dark:border-emerald-800   ->  border-success/40
border-emerald-300 dark:border-emerald-700   ->  border-success/40
text-emerald-700 dark:text-emerald-400       ->  text-foreground
text-emerald-800 dark:text-emerald-200       ->  text-foreground
text-emerald-900 dark:text-emerald-100       ->  text-foreground
text-emerald-900 dark:text-emerald-50        ->  text-foreground

-- focus și disabled (ștergere pură) --
focus-visible:outline-2                      ->  (șters)
focus-visible:outline-offset-2               ->  (șters)
focus-visible:outline-slate-900              ->  (șters)
focus-visible:outline-sky-600                ->  (șters)
focus-visible:ring-2                         ->  (șters)
focus-visible:ring-ring                      ->  (șters)
focus-visible:outline-none                   ->  (șters)
outline-none                                 ->  (șters — 3 apariții, sunt cele care omoară inelul global)
disabled:opacity-60                          ->  disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground
disabled:opacity-50                          ->  idem

-- rest --
dark:bg-zinc-900 fără pereche deschisă (~90) ->  se ȘTERGE și se ADAUGĂ bg-background (sunt câmpuri fără fundal declarat)
dark:bg-zinc-950 fără pereche                ->  idem
orice altă clasă care începe cu dark:        ->  se ȘTERGE

═══ PASUL 2 — REȚETE PE ȘIR ÎNTREG (înlocuire de literal, cele mai eficiente) ═══
Fiecare acoperă zeci de apariții identice. Se caută șirul exact.

"mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-2 dark:border-zinc-600 dark:bg-zinc-900"
  ->  "mt-1 w-full rounded-md border border-foreground/60 bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground hover:border-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground aria-invalid:border-danger"
  (constanta de câmp, definită identic în cel puțin 7 fișiere: pontaj/celula-zi.tsx:21, angajati/formular-angajat.tsx:38, inventar/nou/formular-obiect.tsx:36, inventar/[id]/formular-returnare.tsx:21, inventar/[id]/formular-predare.tsx:29, inventar/[id]/actiuni-obiect.tsx:55, concedii/noua/formular-cerere.tsx:39 — EXTRAGE-O într-un singur modul `src/components/ui/camp.ts` în loc s-o înlocuiești de 7 ori)

"rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
  ->  "rounded-md border border-foreground/60 bg-background px-3 py-2 text-sm text-foreground"

"inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2"
  ->  "inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-active"

"rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-zinc-600 dark:hover:bg-zinc-800"
  ->  "rounded-md border border-foreground/60 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface active:bg-border"

"border border-rose-300 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950"
  ->  "border border-danger bg-background px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-danger-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"

"rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 disabled:opacity-60"
  ->  "rounded-md border border-danger bg-background px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-danger-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"

"rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
  ->  "flex items-start gap-2 rounded-md border border-danger/40 bg-danger/8 p-3 text-sm text-foreground"   + role="alert" + <AlertCircle className="size-4 shrink-0 translate-y-0.5 text-danger" aria-hidden />

"rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950"
  ->  "flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/12 p-4 text-sm text-foreground"   + <AlertTriangle className="size-4 shrink-0 translate-y-0.5" aria-hidden />

"rounded-lg border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
  ->  "rounded-lg border border-border bg-surface p-3 text-sm text-foreground"

"font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-blue-300"
  ->  "font-medium text-primary underline-offset-2 hover:underline"

"bg-zinc-50 text-left dark:bg-zinc-900"                        ->  "bg-surface border-b border-border text-left"
"overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800"  ->  "overflow-x-auto rounded-lg border border-border bg-background"
"divide-y divide-zinc-200 dark:divide-zinc-800"                ->  "divide-y divide-border"

Fișiere care folosesc DEJA tokenii, dar greșit (setari/*, panou/*) — 3 corecții:
  "border-border bg-surface text-foreground focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
    ->  "border-foreground/60 bg-background text-foreground h-9 rounded-md border px-3 text-sm"     (câmpul era pe treapta greșită: fundalul de scris e mereu cel mai deschis)
  "bg-primary ... focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
    ->  "bg-primary ... hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
  panou/page.tsx:151  "border-border bg-surface hover:bg-background ..."
    ->  "border-border bg-background hover:bg-surface active:bg-border ..."     (hover-ul era inversat: se DESCHIDEA la hover)

═══ PASUL 3 — CAZURI CARE CER JUDECATĂ (nu automatiza) ═══

1. `border-zinc-300` NU înseamnă același lucru peste tot. Pe `<input>`, `<select>`, `<textarea>`, `<button>` secundar → `border-foreground/60` (control interactiv, 1.4.11 cere ≥3:1). Pe `<p>`, `<div>`, callout, card → `border-border` (chenar decorativ, scutit). Criteriu mecanic de triere:
     grep -rn "border-zinc-300" src | grep -vE "<(input|select|textarea|button)|CLASA_CAMP|rounded-md border border-zinc-300 px-3 py-2 text-sm"
   Ce rămâne după filtru (ex. pontaj/foaie-colectiva.tsx:132, banda „Perioada este blocată") primește `border-border`.

2. Cele 22 de hărți `CLASE_*` din 10 fișiere `etichete.ts` (ssm, pontaj, diurna, inventar, angajati, concedii, mentenanta, onboarding, flota, portal, plus `src/lib/audit/etichete.ts`) — NU se înlocuiesc clasă cu clasă. Se creează întâi `src/components/ui/badge.tsx` cu baza și cele cinci tonuri din categoria 5, apoi fiecare hartă devine un `Record<Stare, Ton>`:
     "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"  ->  "succes"
     "bg-amber-100  text-amber-900  dark:bg-amber-950  dark:text-amber-100"      ->  "atentie"
     "bg-red-100 / bg-rose-100 + text-red-900 / text-rose-900 + dark:*"          ->  "pericol"
     "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"             ->  "neutru"
     "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"         ->  "ciorna"
     "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-50"      ->  "atentie"
     "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100"             ->  "atentie"  (trimis/în curs, nu „informativ")
     "bg-purple-* / bg-violet-* / bg-sky-*"                                      ->  "neutru"
   Excepție care se scrie de mână: „Expirat" e `pericol` + `<AlertTriangle>`, ca să se distingă de „Respinsă" fără culoare. Azi există nouă familii de nuanțe pentru șase stări — asta e reparația cu cel mai mare randament din toată migrarea.

3. `CLASE_TIP_ZI` din `pontaj/etichete.ts` — se rescrie manual după tabelul 1b: șase nuanțe devin `bg-surface`, `bg-accent/25`, `bg-danger/8` și trei șiruri goale. Nu e o traducere 1:1: patru tipuri de zi rămân fără fundal fiindcă codul de 3 litere din celulă e deja purtătorul stării.

4. `foaie-colectiva.tsx` — singurul fișier cu `sticky` pe celule. `bg-white` de pe `<th scope="row">` (linia 213) devine `bg-background group-hover/rand:bg-surface`, iar `<tr>` primește `group/rand transition-colors hover:bg-surface`. NU pune `bg-inherit` și NU pune fundal translucid pe `<tr>`: la repaus rândul e transparent, deci celula lipită ar lăsa conținutul să treacă pe sub ea la derulare orizontală.

5. `focus-visible:outline-2` fără `outline-offset` pe butonul din celula de pontaj (linia 264) — acolo se PĂSTREAZĂ o suprascriere, dar alta: `focus-visible:-outline-offset-2`. Cu offset pozitiv, inelul e desenat peste marginea celulei vecine și e acoperit de fundalul ei.

6. `text-rose-800` etc. în interiorul unui callout `bg-danger/8` → `text-foreground` (13,11:1), iar pictograma rămâne `text-danger`. Ca mesaj de eroare de sine stătător sub un câmp → `text-danger` (6,11:1). Ambele trec, dar amestecul lor în același bloc arată ca două sisteme.

═══ PASUL 4 — VERIFICARE (toate trebuie să dea 0) ═══
grep -rn "dark:" src | wc -l
grep -rnE "(bg|text|border|divide|ring|outline|placeholder|from|to)-(zinc|slate|gray|neutral|stone|blue|sky|rose|red|emerald|green|amber|yellow|orange|purple|violet|indigo|teal|cyan)-[0-9]+" src | wc -l
grep -rn "bg-white\|text-white\|disabled:opacity-\|outline-none" src | wc -l
grep -rn "text-warning\|border-accent\|text-accent" src | wc -l        # interzise: 3,40:1 și 2,26:1
grep -rn "bg-inherit" src | wc -l                                       # interzis pe celule lipite
grep -rn "color-scheme" src/app/globals.css | wc -l                     # trebuie 1

## Contraste verificate

Toate valorile sunt calculate cu formula WCAG 2.1 (luminanță relativă din sRGB liniarizat), nu estimate. Compozitele translucide sunt compuse alfa peste fundalul real în spațiu gamma sRGB — am verificat cu `@tailwindcss/cli` al proiectului (4.3.3) că `bg-primary/8` compilează în `color-mix(in oklab, #0f1e3d 8%, transparent)`, adică exact `rgba(15,30,61,.08)`, și că `scheme-light`, `border-foreground/60`, `group-hover/rand:`, `hover:-outline-offset-2` și `read-only:` compilează toate. `hover:` iese sub `@media (hover: hover)` — pe atingere nu există stare intermediară, deci rândul trebuie să fie lizibil fără ea (este: 14,93:1).

**Cele trei trepte de crem**
| treaptă | valoare | ΔL* față de pagină | raport față de pagină | fg | muted |
|---|---|---|---|---|---|
| `bg-background` | #faf7f0 | — | — | 14,93:1 | 5,55:1 |
| `bg-surface` (hover, antet, panou, dezactivat) | #f2ede1 | 3,45 | 1,092:1 | 13,67:1 | 5,08:1 |
| `bg-border` (doar `active:` pe controale) | #e3dbc9 | 9,70 | 1,288:1 | 11,59:1 | **4,31:1 — de aceea niciodată pe un rând** |

**1. Rând de tabel**
| pereche | culori | raport | verdict |
|---|---|---|---|
| text pe rând normal | #14213d / #faf7f0 | 14,93:1 | ✓ AAA |
| text pe rând la hover | #14213d / #f2ede1 | 13,67:1 | ✓ AAA |
| text secundar pe rând la hover | #5b6478 / #f2ede1 | 5,08:1 | ✓ AA |
| link în rând, repaus / hover | #0f1e3d / #faf7f0 · #f2ede1 | 15,41:1 · 14,12:1 | ✓ |
| bara de selecție `border-l-primary` (non-text) | #0f1e3d / #f2ede1 | 14,12:1 | ✓ |
| delta hover (cât de subtil) | #f2ede1 / #faf7f0 | 1,092:1, ΔL* 3,45 | perceptibil, mic |
| defectul actual, pentru comparație | #14213d pe `dark:bg-zinc-900` #18181b | 1,11:1 | ✗ exact capturile |

**1b. Matrice de pontaj**
| pereche | culori | raport | verdict |
|---|---|---|---|
| text pe coloană de weekend | #14213d / #f2ede1 | 13,67:1 | ✓ |
| text pe coloană de sărbătoare `bg-accent/25` | #14213d / #eee2be | 12,37:1 | ✓ |
| text secundar pe sărbătoare | #5b6478 / #eee2be | 4,59:1 | ✓ (la `/30` ar fi 4,40 ✗ — de aceea 25%) |
| text pe absență nemotivată `bg-danger/8` | #14213d / #f4e6df | 13,11:1 | ✓ |
| inel de hover pe celulă (non-text) pe cele 4 umpluturi | #2a3d66 / #faf7f0 · #f2ede1 · #eee2be · #f4e6df | 10,03 · 9,18 · 8,26 · 8,83:1 | ✓ toate ≥3 |
| coloana lipită la hover | #14213d / #f2ede1 | 13,67:1 | ✓ opac, nu lasă conținut pe sub |

**2. Antet**
| pereche | culori | raport | verdict |
|---|---|---|---|
| `<th>` pe `bg-surface` | #14213d / #f2ede1 | 13,67:1 | ✓ |
| buton de sortare la hover (`bg-border` peste antet) | #14213d / #e3dbc9 | 11,59:1 | ✓ |
| delta hover pe antet | #e3dbc9 / #f2ede1 | 1,179:1 | perceptibil |

**3. Câmpuri**
| pereche | culori | raport | verdict |
|---|---|---|---|
| text în câmp | #14213d / #faf7f0 | 14,93:1 | ✓ |
| placeholder | #5b6478 / #faf7f0 | 5,55:1 | ✓ (orice alfa sub 100 pică: `/80` = 3,63, `/70` = 2,99) |
| chenar `border-foreground/60`, compus peste fundalul propriu al câmpului | #707785 / #faf7f0 | **4,23:1** | ✓ 1.4.11, și e același număr pe pagină și pe panoul de filtre |
| chenar actual `border-border` pe câmp | #e3dbc9 / #faf7f0 | **1,29:1** | ✗ pică 1.4.11 — motivul pentru care câmpurile fac excepție |
| chenar de câmp dezactivat (`border-border` pe `bg-surface`) | #e3dbc9 / #f2ede1 | 1,18:1 | scutit (controalele dezactivate sunt exceptate de 1.4.11) |
| text de câmp dezactivat | #5b6478 / #f2ede1 | 5,08:1 | ✓ trece oricum |
| chenar de eroare `border-danger` | #b3261e / #faf7f0 | 6,11:1 | ✓ |
| mesaj de eroare | #b3261e / #faf7f0 | 6,11:1 | ✓ |
| inel de focus (regula globală) | #2a3d66 / #faf7f0 · #f2ede1 | 10,03:1 · 9,18:1 | ✓ |

**4. Butoane**
| pereche | culori | raport | verdict |
|---|---|---|---|
| primar: repaus / hover / apăsat | #faf7f0 pe #0f1e3d · #1b2a4e · #2a3d66 | 15,41 · 13,19 · 10,03:1 | ✓ |
| inel de focus pe butonul primar | #2a3d66 / #0f1e3d | **1,54:1** | ✗ → `outline-offset: 2px` din regula globală e obligatoriu; decalat, inelul cade pe crem (10,03:1) |
| secundar: repaus / hover / apăsat | #14213d pe #faf7f0 · #f2ede1 · #e3dbc9 | 14,93 · 13,67 · 11,59:1 | ✓ |
| distructiv: repaus | #b3261e / #faf7f0 | 6,11:1 | ✓ |
| distructiv: hover/apăsat (inversat) | #faf7f0 / #b3261e | 6,11:1 | ✓ |
| dezactivat, propus | #5b6478 / #f2ede1 | 5,08:1 | ✓ |
| dezactivat, actual `disabled:opacity-60` | #faf7f0 / #6d7585 | **4,34:1** | ✗ (`opacity-50` = 3,22:1) |

**5. Badge** (fundal transparent — de aceea numerele se dau pe ambele trepte pe care poate cădea)
| pereche | pe pagină | pe rând la hover | verdict |
|---|---|---|---|
| cuvânt neutru `text-foreground` | 14,93:1 | 13,67:1 | ✓ |
| cuvânt „Respinsă"/„Expirat" `text-danger` | 6,11:1 | 5,60:1 | ✓ |
| cuvânt „Anulată"/„Ciornă" `text-muted-foreground` | 5,55:1 | 5,08:1 | ✓ |
| bulină success (non-text) | 4,91:1 | 4,50:1 | ✓ |
| bulină danger | 6,11:1 | 5,60:1 | ✓ |
| bulină muted | 5,55:1 | 5,08:1 | ✓ |
| bulină warning | 3,40:1 | 3,12:1 | ✓ (la limită; e cue redundant — cuvântul e purtătorul) |
| contur `border-foreground/30` (decorativ) | 1,88:1 | 1,86:1 | scutit — pastila nu poartă informație |
| `text-warning` ca text | 3,40:1 | 3,12:1 | ✗ **interzis ca text la orice dimensiune sub 18,66px bold** |
| `--color-warning-foreground` #faf7f0 pe `--color-warning` | 3,40:1 | — | ✗ orice badge sau buton warning PLIN pică AA — de aceea warning apare doar ca bulină și ca chenar |

**6. Card / panou / callout**
| pereche | culori | raport | verdict |
|---|---|---|---|
| chenar de card `border-border` | #e3dbc9 / #faf7f0 | 1,288:1 | scutit, și e norma industriei (zinc-200 pe alb = 1,269:1) |
| panou de filtre față de pagină | #f2ede1 / #faf7f0 | 1,092:1 | vizibil ca tavă |
| câmp pe panoul de filtre | #faf7f0 / #f2ede1 | 1,092:1 | căsuța de scris rămâne cea mai deschisă |
| text pe callout de eroare | #14213d / #f4e6df | 13,11:1 | ✓ |
| pictogramă `text-danger` pe callout de eroare | #b3261e / #f4e6df | 5,36:1 | ✓ |
| text pe callout de atenție | #14213d / #f2e8d7 | 13,16:1 | ✓ |
| chenar `border-danger/40` (decorativ, dublat de pictogramă) | #dea39c / #faf7f0 | 1,99:1 | scutit |
| auriu `--color-accent` ca indicator singur | #c9a227 / #faf7f0 | **2,26:1** | ✗ → auriul apare o singură dată, ca umplutură de coloană de sărbătoare, și niciodată ca purtător de stare |
| `text-accent-foreground` pe `bg-accent` (dacă apare vreodată o pastilă plină) | #14213d / #c9a227 | 6,60:1 | ✓ |

**Erori găsite în cele trei propuneri, verificate prin recalcul**
1. Propunerea 2, defect de fond: nu calculează `text-muted-foreground` pe rândul selectat. `bg-primary/12` → #dedddb dă **4,37:1**, iar `bg-primary/16` → #d4d4d3 dă **4,01:1**. Ambele pică 4,5:1. Toată scara ei de patru intensități se sprijină pe două trepte pe care textul secundar nu le suportă.
2. Propunerea 2, al doilea defect: badge-ul „În lucru" pune culoarea în chenar — `border-warning` pe `bg-warning/16` = **2,87:1**, sub 3:1. Chenarul nu poate fi purtător acolo unde propunerea spune că este.
3. Propunerea 1 a estimat `--color-danger-hover: #8f1e18` la 7,4:1; valoarea reală e **8,29:1**. A dat rândul selectat la 12,79 față de 12,76 și textul secundar la 4,75 față de 4,74 — rotunjiri, nu erori.
4. Propunerea 3 declară corect că auriul pică (2,26:1) și că rândul activ auriu are ~1,15:1 (valoarea exactă: **1,144:1**) — apoi îl păstrează oricum, sprijinit pe un checkbox care în aplicație nu există în niciun tabel. Am verificat: zero `<tr>` cu selecție în tot `src`.
5. Propunerea 3 dă `hover:brightness-90` la 5,67:1 — aritmetic corect (filtrul se aplică și textului), dar filtrul stinge și pictograma și inelul de focus, și nu e un token, deci reinjectarea culorii per organizație nu-l poate atinge.
6. Toate trei au dreptate pe cauza reală a capturilor cu `<select>` și `<input type=date>`: nu clasele `dark:`, ci `color-scheme`. Ordinea de lucru corectă e cea din propunerea 3 — întâi linia din `:root`, apoi curățenia.
