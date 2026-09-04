# Revizuire multi-agent — 31 august 2026

Vânătoare de defecte pe tot arborele, cu 42 de agenți pe arii disjuncte și o
poartă adversarială per finding (verdict implicit RESPINS). 20 de defecte
distincte confirmate, 5 respinse.

Cele **roșii și portocalii sunt reparate** — vezi tabelul de mai jos. Fișierul
ăsta ține ce a rămas: defectele mici, capcanele respinse (ca să nu fie
re-raportate) și golurile de acoperire pe care analiza le-a scos la iveală.

> Intervalul acoperit: arborele necomis de la ora 23:00 pe 30 august, plus
> commit-urile `3674b87`, `e649b9e`, `600ddf7` (30 august, seara) și `7118b67`,
> `2c4c91e`, `0d8b05f` (31 august, dimineața). Arborele a fost comis și împins
> de alte sesiuni **în timpul analizei** — o parte din findings au ajuns astfel
> să descrie cod deja comis.

---

## Reparat

| Sev | Fișier                                            | Ce se întâmpla                                                     |
| --- | ------------------------------------------------- | ------------------------------------------------------------------ |
| 🔴  | `tsconfig.tsbuildinfo`                            | `pnpm typecheck` era **orb**, nu doar roșu                         |
| 🔴  | `pontaj/saptamana/actions.ts` + ambele `page.tsx` | weekendul lucrat se ștergea la a doua salvare                      |
| 🔴  | `flota/[id]/campuri-document.tsx`                 | RCA se salva ca ITP                                                |
| 🟠  | `flota/foi/dialog-foaie-noua.tsx`                 | foaia se salva pe primul angajat alfabetic; buton mort la parc gol |
| 🟠  | `flota/[id]/dialog-vehicul.tsx`                   | „Casat" supraviețuia lui Renunță                                   |
| 🟠  | `components/ui/formular-dialog.tsx`               | Escape/backdrop/X închideau caseta în timpul trimiterii            |
| 🟠  | `inventar/[id]/dialog-returnare.tsx`              | starea la returnare rămânea pe alegerea abandonată                 |
| 🟠  | `flota/foi/date-foaie-noua.ts`                    | eroarea Postgres înghițită ⇒ listă goală tăcută                    |
| 🟠  | `portal/ceas/page.tsx`                            | scurtătura de pe telefon ponta duminica                            |
| 🟠  | `inventar/campuri-obiect.tsx`                     | `type="number"` făcea suportul de virgulă mort                     |
| 🟠  | `lib/queries/inventory.ts`                        | `angajatiActivi` fără `.limit()`                                   |
| 🟠  | `tests/rls/izolare.sql`                           | poarta pozitivă proba doar UPDATE; calea reală e INSERT            |

`portal/pontare-rapida.tsx` (butoanele dispărute la „numai cod QR") fusese deja
reparat de `0d8b05f`, prin conducta proprie de revizuire — vezi §4, fiindcă
reparația a rămas nepăzită de vreun test.

---

## 1. Rămas de reparat

### 1.1 `revalidate` nu numește ruta mutată

`src/app/(app)/pontaj/setari/actions.ts:24`

`salveazaSetariPontaj` declară `revalidate: ["/pontaj", "/pontaj/setari"]`, dar
formularul de reguli s-a mutat la `/pontaj/setari/reguli` (`600ddf7`).
`/pontaj/setari` e acum fila de pontare rapidă, adică exact ecranul care NU
afișează ce s-a scris. Contrastul e în același fișier: `salveazaPontareaRapida`
(linia 66) are lista corectă pentru ecranul ei.

**Nu se manifestă azi**, și merită spus de ce: pe Next.js 16.3,
`revalidate.js:220-223` setează `store.pathWasRevalidated` **necondiționat de
calea efectivă** (are chiar un `// TODO: only revalidate if the path matches` în
cod), iar `action-handler.js:99-121` re-randează ruta curentă oricum. Ecranul se
împrospătează deci din efect colateral, nu din declarație. În clipa în care
cineva scoate `/pontaj` din listă, sau Next repară acel TODO, „Regula în
vigoare" rămâne pe versiunea veche sub un mesaj de reușită.

```diff
- revalidate: ["/pontaj", "/pontaj/setari"],
+ revalidate: ["/pontaj", "/pontaj/setari", "/pontaj/setari/reguli"],
```

### 1.2 Diagnosticele de salarizare trimit la fila greșită

`src/domain/payroll/erori.ts:155` și `:165`

`SAL_SPOR_NOAPTE_SUB_PRAG` și `SAL_ORE_IN_MOD_NEDECLARAT` au ambele
`unde: "/pontaj/setari"`, iar textele lor spun „bifați felul de muncă respectiv
în setările de pontaj" și „puneți pragul pe 0". Ambele controale au trecut pe
`/pontaj/setari/reguli`; `/pontaj/setari` randează acum exclusiv
`FormularPontareRapida`, unde niciunul nu există.

Contabilul apasă linkul de reparare din avertisment și ajunge pe o pagină despre
ceas, cod QR și afișe. `src/lib/asistent/destinatii.ts` enumeră corect ambele
căi — deci reparația e doar de aliniat cu el.

```diff
- unde: "/pontaj/setari",
+ unde: "/pontaj/setari/reguli",
```

### 1.3 Antetul lui 0116 se sprijină pe o clauză care nu mai există

`supabase/migrations/0116_tipuri_document_vehicul_esentiale.sql:31`

Antetul scrie: „`vdt_select` filtrează pe `deleted_at is null` dar NU pe
`activ`". Nu mai e adevărat din `0020_fix_sarcini_aprobare.sql:105-116`, care a
făcut `drop policy vdt_select` + recreare fără acel predicat — și care are chiar
o verificare ce ridică excepție dacă predicatul reapare în `USING`
(`0020:134-140`). Politica în vigoare filtrează doar pe organizație; ambele
filtre stau în `tipuriDocument()` (`src/lib/queries/fleet.ts:396-404`, care pune
ȘI `.eq("activ", true)` ȘI `.is("deleted_at", null)`).

Concluzia migrării rămâne corectă — un tip dezactivat rămâne citibil, iar
`internal.flota_sincronizeaza_grup` își ia mai departe `cod` și `denumire` din
el. Doar premisa e falsă, iar migrarea e scrisă ca sursă de adevăr pentru
următoarea persoană care retrage un tip.

**Migrare deja aplicată: nu se editează SQL-ul.** Se corectează comentariul, sau
se pune nota în migrarea următoare care atinge nomenclatorul.

Formularea corectă: _„`vdt_select` (rescrisă în 0020) nu filtrează nici
`deleted_at`, nici `activ` — ambele filtre stau în `tipuriDocument()`.
`activ = false` se alege fiindcă e reversibil printr-un UPDATE și fiindcă
`deleted_at` ar intra în conflict cu indexul unic parțial pe `cod`."_

### 1.4 Inventarul de rute e pe jumătate actualizat

`docs/conturi-si-rute.md:183` și `:208`

Livrarea a șters trei rute de formular și a mutat una. Commit-ul de flotă
(`e649b9e`) și-a scos rândurile; cel de inventar (`3674b87`) nu — `/inventar/nou`
e încă în tabel, deși `ls src/app/(app)/inventar/nou` întoarce „No such file",
iar `inventar/page.tsx:272` scrie explicit „Ruta `/inventar/nou` a dispărut".
Iar `600ddf7` a adăugat `/pontaj/setari/reguli` fără niciun rând.

Documentul e singura hartă a permisiunii care păzește fiecare rută — exact ce
citește cineva care aude „hr nu poate adăuga un obiect de inventar". Azi îl
trimite la un 404, și nu-i spune nimic despre pagina unde stau cele optsprezece
cifre de dreptul muncii (`attendance:update ≥ all`, `reguli/page.tsx:29`).

- șterge rândul `/inventar/nou` (linia 183)
- adaugă `/pontaj/setari/reguli` — `attendance:update ≥ all` / `attendance` —
  lângă cel existent de la linia 208

### 1.5 `tipImplicit` e promisiune fără apelant

`src/app/(app)/flota/[id]/campuri-document.tsx:46`

Prop-ul e declarat (46), documentat (45) drept „Tipul preselectat la adăugare,
când se pornește de pe un rând anume", destructurat (54) și folosit (72). Un
grep pe tot `src/` arată că singurele trei apariții ale identificatorului sunt în
interiorul acestui fișier: `dialog-document.tsx:63` dă `documentul`,
`formular-document.tsx:79` nu dă niciunul. (`domain/leave/tip-implicit.ts` e alt
simbol, `tipImplicitConcediu`.)

Era **cauza directă** a defectului cu ITP-ul preselectat, acum reparat prin
opțiunea goală: dacă legătura ar fi existat, `defaultValue` n-ar fi căzut
niciodată pe `""`. Rămâne de ales una din două:

- **leagă-l** — tabelul de conformitate din `flota/[id]/page.tsx` randează pe
  rândul „Lipsește" un declanșator care trimite `tipImplicit={tip.id}`, ca
  butonul de pe rândul RCA să deschidă caseta cu RCA deja ales;
- **scoate-l** — prop, docblock și ramura `?? tipImplicit`, ca fișierul să nu
  mai promită o purtare care nu se întâmplă.

Prima variantă e ce voia autorul și e vizibil utilă; a doua e cinstită imediat.

---

## 2. Convenție: sedilă în loc de virgulă dedesubt

**1267 de apariții, în 26 de fișiere.** `CLAUDE.md` e explicit: `ș`/`ț` cu
virgulă dedesubt (U+0219/U+021B), nu cu sedilă (U+015F/U+0163).

```bash
grep -rlP '[\x{0163}\x{015F}]' src/ supabase/migrations/   # 26 de fișiere
```

Aproape toate sunt în comentarii. **Două sunt date vizibile pe ecran**, în
`supabase/migrations/0012_fleet.sql`:

| linia | valoarea                              |
| ----- | ------------------------------------- |
| 1112  | `'Inspecţie tehnică periodică (ITP)'` |
| 1119  | `'Licenţă de transport'`              |

A doua e dezactivată de `0116`, deci rămâne una singură — și e chiar opțiunea pe
care selectorul de tip document o alegea automat până azi.

Migrările sunt aplicate, deci corectura e un `update` într-o migrare nouă pe
`vehicle_document_types.denumire`, nu o editare a lui 0012. Comentariile se pot
trece printr-un `tr` oricând, dar merită un pas separat: e un diff de 1267 de
linii care ar îneca orice altceva.

---

## 3. Ce a respins poarta adversarială

Cinci findings au căzut la verificare. Se notează ca să nu fie re-raportate.

| Findingul                                                          | De ce a căzut                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „0115 e o migrare comisă, editată acum"                            | Diff-ul e comment-only, verificat linie cu linie. Între timp `2c4c91e` a readus fișierul la octeții chiar aplicați.                                                                                              |
| „Lipsește repausul de 24h după o zi de 12h+, art. 114 alin. 4"     | Art. 114 din Legea 53/2003 reglementează plafonul de 48h/săptămână și perioada de referință, **nu** repausul gradual. Repausul zilnic e art. 135 (12h consecutive), deja implementat. Citare juridică fabricată. |
| „Ecranul rămâne vechi după salvarea regulilor" (×2)                | Demontat din sursa Next.js instalată — vezi §1.1. Simptomul nu există azi; a supraviețuit doar ca defect latent.                                                                                                 |
| „Pagina de vault a pontajului nu cunoaște `/pontaj/setari/reguli`" | `.claude/docs/modul/pontaj.md:53` are deja rândul; fusese adăugat în același diff.                                                                                                                               |

---

## 4. Goluri de acoperire pe care le-a arătat analiza

### 4.1 Un test care blinda defectul

`src/domain/attendance/pontare-rapida.test.ts:92`

Testul „`cod_qr` ascunde butonul obișnuit și cere scanarea" verifică
`poateCeas === false` — corect pentru funcția pură, dar el a fost singurul lucru
verde în timp ce ecranul de scanare nu desena niciun buton. Nu are **niciun caz
cu cod prezent**, fiindcă acea decizie stă în componentă.

Reparația din `0d8b05f` a atins **doar** `pontare-rapida.tsx`, fără test. Deci
regresia care a ajuns o dată în producție e în continuare nepăzită: cine
reorganizează `cePoateFace` o poate reintroduce cu suita verde.

Ce lipsește, minimal — un test de componentă (proiectul `ui` din vitest) care
randează `<PontareRapida>` cu `verificare: "cod_qr"` și `cod="ABC123"` și
așteaptă butonul „Am intrat" pe ecran. Alternativa, dacă decizia se mută înapoi
în domeniu: al treilea argument `areCod` pentru `cePoateFace`, testabil pur.

### 4.2 Opțiunea goală nu are nicio poartă

Trei `<select obligatoriu>` fără `<option value="">` au fost găsite în aceeași
livrare (tip document, șofer), iar alte două erau scrise corect
(`dialog-predare.tsx:86`, `campuri-obiect.tsx:122`). Nu e neglijență, e absența
unei reguli: `Camp` primește controlul printr-un render prop, deci apelantul își
construiește singur opțiunile și nimic nu-l poate obliga.

Pe `defaultValue=""` fără opțiune potrivită, browserul selectează **prima**
opțiune, iar `z.uuid()` primește un UUID valid și tace. Nu există cod de eroare,
nu există rând roșu.

Proiectul are precedent pentru o poartă la nivel de sursă —
`src/lib/queries/coloane.test.ts`. Echivalentul aici: un test care scanează
`src/**/*.tsx`, găsește fiecare `<Camp … obligatoriu … fel="select">` și cere ca
`<select>`-ul din interior să conțină un `<option value="">`.

### 4.3 Aceeași citire, scrisă de două ori

`src/lib/queries/inventory.ts:245` (`angajatiActivi`) și
`src/app/(app)/flota/foi/date-foaie-noua.ts:40` fac interogarea identică —
aceleași coloane, aceleași filtre, aceeași ordonare — în două module diferite, și
au divergat imediat: una verifica `error`, cealaltă nu; una avea `.limit()`,
cealaltă nu. Ambele sunt reparate, dar diferența va reveni.

Ar trebui să fie o singură funcție într-un modul comun de citiri, și atunci intră
și sub `coloane.test.ts`.

### 4.4 Poarta de tip poate redeveni oarbă oricând

Reparația aplicată a fost `rm tsconfig.tsbuildinfo`. Mecanismul rămâne:
`tsconfig.json` are `"incremental": true`, iar `.tsbuildinfo` păstrează lista de
fișiere a programului precedent. La orice **ștergere** de fișier, `tsc` ridică
`TS6053: File … not found` — o eroare de CONSTRUCȚIE a programului, nu de
verificare. Se oprește acolo și **nu mai raportează nimic semantic**.

Dovada, cu o sondă de control (`const sonda: number = "text"` pus în `src/`):

```
$ pnpm typecheck            # cu .tsbuildinfo învechit
error TS6053: File '…/inventar/nou/page.tsx' not found.      ← singura ieșire
                                                               eroarea de tip lipsește

$ pnpm typecheck            # după rm tsconfig.tsbuildinfo
src/sonda.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.
```

Cât timp starea aia ține, `pnpm verify` e verde-orb. Refactorul flotă/inventar a
trecut integral prin ea.

Trei variante, în ordinea preferinței:

1. `"typecheck": "tsc --noEmit --incremental false"` în `package.json` —
   onest prin construcție, costă câteva zeci de secunde;
2. un `rm -f tsconfig.tsbuildinfo` înaintea lui `tsc` în același script;
3. un hook `PostToolUse` care șterge `.tsbuildinfo` după orice ștergere de
   fișier din `src/`.

Alegerea e a lui Miro — schimbă o unealtă partajată cu CI și cu celelalte
sesiuni, deci nu se face pe tăcute.

### 4.5 Zero teste pe acțiuni

`PROGRESS.md` o numește blocajul #3, iar analiza asta o confirmă: defectul cel
mai grav — steagul de weekend — trăia într-o Server Action, adică exact stratul
fără niciun test. Cele două cauze ale lui au fost găsite de agenți care citeau
cod, nu de o suită.
