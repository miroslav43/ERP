## F. Cererea de concediu: din numărător, formular de HR complet

**Scop:** cererea de pe `/unelte/cerere-concediu-de-odihna` devine o scrisoare de HR completă, în opt variante, cu aceeași formă pe ecran, în PDF și în Word, cu intrările greșite refuzate în loc de înlocuite și cu un calculator nou de zile cuvenite pe an.

**De ce:** auditul live din 8 oct 2026 a dat uneltei 3/5. Calculul zilelor e corect în toate cele 10 scenarii de sărbători, dar documentul e mai sărac decât un model Word instituțional. Constatările, cu dovezi, din `audit-unelte.json`, plus două găsite la scrierea planului:

- **API-ul înlocuia tăcut datele invalide.** `de_la=2036-01-05` → 200, cerere pentru 07–13.11.2026. `de_la=2019-01-05` → 200, perioada 07–20.11.2026. `de_la=abc` → 200. `2026-02-30` → 400, dar cu mesajul fals „Data de sfârșit e înaintea celei de început”. Cauza: `normalizeazaData`, `cerere.ts:73-78`.
- **Cerere de „0 zile lucrătoare”.** `14–15.11.2026` și `01.12.2026` → 200, fără avertisment.
- **Art. 139 alin. (2¹) lipsea.** Pentru 26.04–07.05.2027, unealta scade 30.04 și 03.05, adică datele ortodoxe. Pentru un salariat romano-catolic sau reformat sunt 10 zile, nu 8.
- **Descărcarea cu interval inversat** ducea omul pe o pagină `text/plain` cu 400, fără formular.
- **Variantele „fără plată” și „eveniment” n-aveau semnătură în previzualizare.** `PrevizualizareDocument` nu randează `semnaturi`.
- **Lipseau rubrici** (verdict PLAUZIBIL): anul concediului (art. 146 alin. (2)), departamentul, numărul de înregistrare, „Se aprobă / Nu se aprobă”, soldul.
- **Acordul gramatical:** „cele 1 zile de weekend”, „250 zile lucrătoare”.
- **PDF-ul și Word-ul arătau altfel decât previzualizarea.** Titlul era la stânga, „Către” gri la 9 pt, locul și data gri la 8 pt. Sedila nu se normaliza. „Ziua de azi” se lua în UTC (`cerere.ts:89-91`).
- **Implicitul azi + 30** cădea pe 07.11.2026, o sâmbătă. Verdictul a fost RESPINS ca defect juridic, dar a rămas reziduul cosmetic.
- **Nou: legătura din fișier ducea la un 404.** Ruta comună pune `sursa: /unelte/${unealta}`, deci `/unelte/cerere-concediu`. Verificat cu `curl -sI https://administrativo.ro/unelte/cerere-concediu` → `HTTP/2 404`. Legătura UTM din fiecare PDF și Word descărcat, canalul de achiziție hotărât pe 7 oct, duce într-o pagină inexistentă.
- **Nou: Excel-ul nedocumentat** (`format=xlsx` → 200, „un fișier Excel cu textul cererii”) și slug-ul API diferit de cel al paginii (`/api/unelte/cerere-concediu-de-odihna` → 404).
- **Utilizare:** 16 afișări pe poziția 6 și 0 clicuri în Search Console. E singura unealtă deja pe prima pagină pentru un termen cu volum. Concurentul folositor.ro are un calculator separat de zile cuvenite.

Tipărirea din browser pe 3 pagini e reparată în **secțiunea B** (`data-tipar="ascunde"` pe `Antet`/`Subsol` din `cadru.tsx`). Secțiunea asta doar consumă reparația, în verificarea headless din F14.

**Decizii luate**

1. **Model nou de scrisoare (`Scrisoare`), nu încă un caz în `DocumentTabelar`.** `DocumentTabelar` e un formular: titlu la stânga, câmpuri, tabel. Cererea e o scrisoare: „Către” la dreapta, „CERERE” centrat, loc și dată la stânga, semnătura la dreapta, rubrica angajatorului jos. Un `if` în `pdf.ts`/`docx.ts`, comune pentru cinci unelte, ar fi atins randări pe care alte secțiuni le modifică. Modelul propriu (`src/lib/unelte/scrisoare.ts`) e citit de toate trei randările: HTML (`ScrisoarePrevizualizata`), PDF și Word. Ce e pe ecran e ce se descarcă.
2. **Geometria PDF-ului e o funcție pură** (`asezaScrisoarea`), cu măsurarea textului injectată. Așa „CERERE e centrat” și „nimic nu iese din margine” devin teste, o dată cu o măsură falsă și o dată cu fontul DejaVu real, nu doar „PDF-ul se deschide”.
3. **Rută statică proprie `/api/unelte/cerere-concediu`**, care bate ruta dinamică, plus alias pe slug-ul paginii. Cererea iese din `registru.ts`. Excel nu mai e servit (400), fiindcă o cerere de semnat nu e un tabel. Legătura din fișier duce la pagina reală.
4. **Intrare prezentă și greșită = problemă. Intrare lipsă = implicit.** Asta se aplică pe API și pe pagină, cu un singur cititor (`citesteCererea`). Pe pagină, problemele se arată lângă formular. Pe API, un client primește 400 cu motivul. O navigare din browser (`sec-fetch-mode: navigate` sau `Accept: text/html`) primește 303 înapoi pe pagină, cu aceiași parametri, deci fără JavaScript și fără pagină goală. Toate răspunsurile au `cache-control: private, no-store`, fiindcă poartă nume de oameni.
5. **Probleme și avertismente sunt lucruri diferite.** Termenul de 60 de zile (art. 148 alin. (4)) e un drept al salariatului, nu o interdicție: verdictul RESPINS din audit spune la fel. O cerere datată după începutul perioadei apare la regularizări. Fracțiunea de 10 zile (art. 148 alin. (5)) poate fi în altă cerere. Toate trei sunt avertismente pe pagină și **nu intră în documentul de semnat**.
6. **Cultul se alege după calendarul Paștelui (iulian sau gregorian), nu după o listă de culte.** Legea trimite la „data la care sunt celebrate de acel cult”. Opțiunea arată data Paștelui din anul respectiv în ambele calendare, ca omul să-și recunoască data. Pentru calendarul gregorian, datele ortodoxe devin zile lucrătoare: alin. (2¹) mută zilele, iar alin. (3¹) cere recuperarea dacă se iau ambele. Interpretarea e ⚠ în NOTES.md.
7. **AN_MIN = 2024 pentru cerere.** Calendarul comun pune 6–7 ianuarie în orice an, deși au intrat în art. 139 la 09.03.2023 (Legea 52/2023, verificat pe portal). Dacă altă secțiune condiționează 6–7 ianuarie de an în `sarbatoriAnului`, `sarbatoriAnuluiPentruCult` preia corecția fără schimbări, fiindcă ia fixele de acolo.
8. **Evenimentele familiale: fără zile legale scrise pentru sectorul privat.** Art. 152 alin. (2) trimite la lege, la contractul colectiv sau la regulamentul intern. Numerele din HG 250/1992 art. 24 (5, 3, 3 zile) se aplică doar bugetarilor. Pagina le arată ca reper, cu această precizare, iar documentul scrie un număr doar dacă omul îl completează (`zile_ccm`).
9. **Variantele: opt.** Odihnă, fără plată, eveniment, paternal (Legea 210/1999), îngrijitor (art. 152¹), formare profesională, adică „concediul de studii” din cerință (art. 155–157, cu sau fără plată), reprogramare (art. 149) și întrerupere (art. 151 alin. (1)). **Rechemarea rămâne pe dinafară.** E decizia angajatorului (art. 151 alin. (2)), cu obligația lui de a suporta cheltuielile, deci nu e o cerere a salariatului. Un model scris de noi ar fi semnat de un patron care nu știe de obligația aceea. **Absentarea din art. 152² rămâne și ea pe dinafară:** e o informare cu recuperare, nu un concediu.
10. **Fracțiunile: până la 3 perioade în aceeași cerere**, doar la odihnă. Suprapunerea și fracțiunea cu o singură dată sunt probleme. Lipsa fracțiunii de 10 zile e avertisment.
11. **Zilele cuvenite pe an au pagină separată, `/unelte/calculator-zile-concediu`.** Altă căutare și alt concurent (folositor.ro). Calculul reutilizează `calculeazaAcumulareProportionala` din `src/domain/leave/sold.ts`, deci aceeași regulă ca soldul din aplicație. **Proporția e prezentată ca practică, nu ca lege**, la fel ca ghidul `/ghid/concediu-de-odihna`: „Codul muncii nu conține nicio regulă de proporționalizare”. Se arată valoarea exactă și ambele rotunjiri.
12. **Mențiunea „Generat gratuit cu administrativo.ro” rămâne, dar iese din textul semnat.** În PDF stă în marginea de jos, la 7 pt, sub rubrica angajatorului. În Word e în **subsolul paginii** (`Footer`), deci se șterge fără să atingi cererea. Pe ecran lipsește. Motivul: fișierele circulă între firme și sunt singurul canal de revenire măsurabil (UTM). Scoasă, n-ar mai aduce pe nimeni. În corp, ar face cererea să arate a reclamă, iar un HR ar putea refuza s-o înregistreze. Legătura duce acum la pagina reală, nu la 404.
13. **Varianta se alege din legături (bara de sus), nu dintr-un `<select>`.** Fără JavaScript, un `<select>` n-ar putea arăta câmpurile variantei alese înainte de trimitere. Legătura păstrează câmpurile comune (oamenii și perioada) și le lasă în urmă pe cele ale variantei vechi.
14. **Titlul SEO se schimbă** în „Cerere concediu de odihnă 2026, Word/PDF gratuit”. Are 48 de caractere, plafonul exact. Cu 16 afișări pe poziția 6 și 0 clicuri, titlul trebuie să spună din prima „Word/PDF gratuit”, cum cere auditul de utilizare.
15. **Doar GET.** Dacă secțiunea de confidențialitate mută uneltele pe POST, ruta primește un `POST` care face `new URLSearchParams(await cerere.text())` și cheamă același corp. `cerereDinParametri` primește deja un `URLSearchParams`, deci nimic din F se rescrie.
16. **Ordinea de deploy:** F12 schimbă ce se descarcă înainte ca F14 să schimbe ce se vede. Deploy-ul pe producție, confirmat de utilizator, se face **după F14**, nu între taskuri.

**Harta fișierelor**

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| `src/domain/calendar/paste-gregorian.ts` (+ `.test.ts`) | Paștele gregorian (Meeus/Jones/Butcher) | F1 |
| `src/domain/calendar/sarbatori-cult.ts` (+ `.test.ts`) | Sărbătorile anului după calendarul cultului, art. 139 alin. (2¹) | F2 |
| `src/lib/unelte/text-curat.ts` (+ `.test.ts`) | Fără caractere de control; sedilă → virgulă | F3 |
| `src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere.ts` (+ `cerere.test.ts`) | Citire strictă a datelor, 0 zile = problemă, azi în București, interval implicit, calendarul cultului | F4, F5, F14 |
| `…/cerere-concediu-de-odihna/text-zile.ts` (+ `.test.ts`) | Acordul numerelor („1 zi”, „20 de zile”) | F6 |
| `…/cerere-concediu-de-odihna/variante.ts` (+ `.test.ts`) | Cele 8 variante, temeiurile, cifrele legale, evenimentele | F7 |
| `NOTES.md` §3 | ⚠ valorile noi; corectura despre 6–7 ianuarie | F7 |
| `src/lib/unelte/scrisoare.ts`, `scrisoare-asezare.ts` (+ `scrisoare.test.ts`) | Modelul scrisorii; așezarea pe pagini A4, pură | F8 |
| `src/lib/unelte/scrisoare-pdf.ts`, `scrisoare-docx.ts` (+ `scrisoare-randari.test.ts`) | Randările PDF și Word ale scrisorii | F9 |
| `…/cerere-concediu-de-odihna/cerere-model.ts` (+ `.test.ts`) | Parametri → `CerereCitita` (probleme, avertismente) → `Scrisoare` | F10 |
| `src/app/(marketing)/_componente/scrisoare.tsx` (+ `.test.tsx`) | Previzualizarea HTML a scrisorii | F11 |
| `src/app/api/unelte/cerere-concediu/route.ts` (+ `.test.ts`), `src/app/api/unelte/cerere-concediu-de-odihna/route.ts` | Descărcarea: 400 / 303 / fișier, fără cache public; aliasul | F12 |
| `src/lib/unelte/registru.ts`, `src/app/api/unelte/[unealta]/route.test.ts` | Cererea iese din registrul comun | F12 |
| `src/app/(marketing)/unelte/calculator-zile-concediu/calcul.ts` (+ `.test.ts`), `page.tsx` | Calculatorul de zile cuvenite | F13 |
| `src/content/landing/unelte.ts`, `harta.ts`, `legaturi.ts`, `ro.ts`, `en.ts`, `src/app/llms.txt/route.ts`, `src/app/(marketing)/unelte/page.tsx` | Pagina nouă în sitemap, llms, hub, pagina de start; textele cererii | F13, F14 |
| `…/cerere-concediu-de-odihna/page.tsx` | Pagina rescrisă: variante, formular complet, probleme, avertismente | F14 |
| `…/cerere-concediu-de-odihna/cerere-document.ts` (+ `.test.ts`) | **Șters** (înlocuit de `cerere-model.ts`) | F14 |

Toate căile de import din codul de mai jos au fost verificate pe disc: `@/domain/calendar/sarbatori` (`sarbatoriAnului`, `sarbatoriDupaZi`, `Sarbatoare`), `@/domain/calendar/paste-ortodox`, `@/lib/format/date` (`formatDate`, `todayInBucharest`), `@/content/legal/zile-libere` (`cuDe`), `@/domain/leave/sold` (`calculeazaAcumulareProportionala`, `rotunjesteZileConcediu`), `@/lib/pdf/document` (`pornesteDocument`, `GRI`, `NEGRU`, `LATIME_A4`, `INALTIME_A4`), `@/content/landing/contact` (`ADRESA_SITE`), `@/lib/unelte/document-tabelar` (`EroareIntrare`, `LINIE_GOALA`, `SEMNATURA_FISIER`, `numeFisierSigur`, `Format`), `docx@9.8.1` (`AlignmentType`, `BorderStyle`, `Footer`, `Tab`, `TabStopType`, cu `Tab` sondat: produce `<w:tab/>`). **Tot codul de mai jos a fost rulat** pe o copie a `src/` din scratchpad (`lucru-cerere-concediu/sim`): 238 de teste verzi în fișierele atinse, `tsc --noEmit` fără erori în fișierele secțiunii, `eslint` cu cod 0, `prettier --check` curat. Picau doar testele care citesc `supabase/` sau `public/`, necopiate în sim. PDF-urile generate au fost rasterizate și verificate vizual: o pagină, aspect de scrisoare.

**Verificarea adversarială (8 oct 2026, a doua copie, independentă).** Planul a fost aplicat mecanic, bloc cu bloc, pe o copie proaspătă a `src/` de la `e3dc457` (`verif-cerere-concediu/aplica.py`): fiecare bloc „vechi” s-a găsit exact o dată, iar rezultatul e identic, octet cu octet, cu `lucru-cerere-concediu/sim`. Pe copia asta: `tsc --noEmit` pe tot proiectul, fără nicio eroare în afara lui `next.config` necopiat; `vitest --project unit --project ui`, 7838 de teste verzi, cu singurele roșii din mediul copiei (`.git`, `mobil/`, `next.config.ts` lipsă și un timeout sub încărcare, verde rulat singur); `eslint` 0 și `prettier --check` curat pe cele 38 de fișiere; ambele porți `check:server`, inclusiv `client-imports-server-only.mjs` (adăugată după sim, în `2b6cd6a`), curate. Testul F4 a fost rulat și pe `cerere.ts` vechi: pică 11 din 20, cu exact mesajele de la pasul 2. Sondaj legal cu curl pe legislatie.just.ro: art. 139 alin. (2¹)/(3¹) și Legea 52/2023, art. 146 alin. (2) cu HP 40/2026, art. 148 alin. (4)–(5), art. 152¹ alin. (1)–(3), art. 156 alin. (1), art. 157 alin. (1), Legea 210/1999 art. 2, 4 și 4¹: toate confirmate. Corectat: avertismentul de report numește acum „HP nr. 40/2026” și spune că compensarea are loc la încetarea contractului (art. 146 alin. (3)), cum spune decizia.

**Lanțul de verificare** (îl cheamă fiecare task ca „lanțul complet”, fără pipe către `tail`, ca un cod de ieșire să nu se piardă):

```bash
cd /srv/apps/ERP
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs
```

Plus `pnpm exec prettier --write <fișierele taskului> && pnpm exec prettier --check <fișierele taskului>`. Fișierele de aici sunt deja formatate, dar pluginul de Tailwind sortează clasele.

---

### Task F1: Paștele gregorian

**Fișiere:**
- Create: `src/domain/calendar/paste-gregorian.ts`
- Test: `src/domain/calendar/paste-gregorian.test.ts`

**Interfețe:**
- Consumă: `pasteOrtodox(an: number): Date` din `./paste-ortodox`, doar în test, pentru invariant.
- Produce: `export function pasteGregorian(an: number): Date`: miezul nopții UTC, `RangeError` în afara 1900–2199.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/domain/calendar/paste-gregorian.test.ts`:

```ts
// src/domain/calendar/paste-gregorian.test.ts

import { describe, expect, it } from "vitest";

import { pasteGregorian } from "./paste-gregorian";
import { pasteOrtodox } from "./paste-ortodox";

function iso(data: Date): string {
  const an = data.getUTCFullYear().toString().padStart(4, "0");
  const luna = (data.getUTCMonth() + 1).toString().padStart(2, "0");
  const zi = data.getUTCDate().toString().padStart(2, "0");
  return `${an}-${luna}-${zi}`;
}

describe("pasteGregorian", () => {
  /*
   * Valori SCRISE DE MÂNĂ, nu generate de funcția testată. Verificate pe 8 oct
   * 2026 cu o implementare independentă (`dateutil.easter`, metoda
   * EASTER_WESTERN). 2008 e cel mai devreme Paște din secol (23 martie), 2038 cel
   * mai târziu posibil (25 aprilie); 2025 și 2028 coincid cu Paștele ortodox.
   */
  const cazuri: ReadonlyArray<readonly [number, string]> = [
    [2008, "2008-03-23"],
    [2011, "2011-04-24"],
    [2019, "2019-04-21"],
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2035, "2035-03-25"],
    [2038, "2038-04-25"],
  ];

  it.each(cazuri)("în %i, Paștele gregorian cade pe %s", (an, asteptat) => {
    expect(iso(pasteGregorian(an))).toBe(asteptat);
  });

  it("cade mereu duminica, între 22 martie și 25 aprilie", () => {
    for (let an = 1900; an <= 2199; an += 1) {
      const paste = pasteGregorian(an);
      expect(paste.getUTCDay(), String(an)).toBe(0);
      const ziuaDinAn = iso(paste).slice(5);
      expect(ziuaDinAn >= "03-22" && ziuaDinAn <= "04-25", `${String(an)}: ${ziuaDinAn}`).toBe(
        true,
      );
    }
  });

  it("față de Paștele ortodox: aceeași zi, sau cu 1, 4 ori 5 săptămâni mai devreme", () => {
    // Invariantul care prinde o formulă greșită fără să depindă de tabelul de mai sus.
    for (let an = 1900; an <= 2199; an += 1) {
      const diferenta = (pasteOrtodox(an).getTime() - pasteGregorian(an).getTime()) / 86_400_000;
      expect([0, 7, 28, 35], String(an)).toContain(diferenta);
    }
  });

  it("respinge anii în afara intervalului și anii neîntregi", () => {
    expect(() => pasteGregorian(1899)).toThrow(RangeError);
    expect(() => pasteGregorian(2200)).toThrow(RangeError);
    expect(() => pasteGregorian(2026.5)).toThrow(RangeError);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/calendar/paste-gregorian.test.ts
```

Așteptat: `FAIL … Failed to resolve import "./paste-gregorian"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `src/domain/calendar/paste-gregorian.ts`:

```ts
// src/domain/calendar/paste-gregorian.ts

/**
 * Data Paștelui după calendarul gregorian — Paștele romano-catolic și cel al
 * cultelor protestante.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Art. 139 alin. (2¹) din Codul muncii (introdus prin Legea 37/2020, în
 * vigoare de la 06.04.2020; verificat pe forma consolidată de pe
 * legislatie.just.ro, documentul 128647, descărcată pe 8 oct 2026): salariații
 * unui cult religios legal, creștin, primesc Vinerea Mare, Paștele și Rusaliile
 * „în funcție de data la care sunt celebrate de acel cult”. Pentru un salariat
 * romano-catolic sau reformat, sărbătorile mobile vin din data de aici, nu din
 * `pasteOrtodox`.
 *
 * ── ALGORITMUL ─────────────────────────────────────────────────────────────
 * „Anonim gregorian” (Meeus/Jones/Butcher), valabil pe tot calendarul
 * gregorian. Întoarce direct luna și ziua gregoriene — spre deosebire de
 * `pasteOrtodox`, nu e nevoie de decalajul iulian–gregorian.
 *
 * Funcție PURĂ, același interval de ani ca `pasteOrtodox`.
 */
export function pasteGregorian(an: number): Date {
  if (!Number.isInteger(an) || an < 1900 || an > 2199) {
    throw new RangeError(
      "Anul pentru calculul Paștelui gregorian trebuie să fie un număr întreg între 1900 și 2199.",
    );
  }

  const a = an % 19;
  const b = Math.floor(an / 100);
  const c = an % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const luna = Math.floor((h + l - 7 * m + 114) / 31);
  const zi = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(an, luna - 1, zi));
}
```

- [ ] **Pasul 4: Rulează testele, trec.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/calendar/
```

Așteptat: toate verzi, inclusiv `paste-ortodox.test.ts` și `sarbatori.test.ts`, neatinse. Apoi lanțul complet.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
F="src/domain/calendar/paste-gregorian.ts src/domain/calendar/paste-gregorian.test.ts"
git status --short -- $F
git fetch origin main
git diff --name-only HEAD origin/main -- src/domain/calendar/
git add -- $F
git commit --only -m "$(cat <<'MSG'
feat(calendar): Paștele gregorian, pentru salariații altor culte creștine

Art. 139 alin. (2¹) din Codul muncii: Vinerea Mare, Paștele și Rusaliile se
dau la data cultului. Algoritmul anonim gregorian, cu valori de referință
scrise de mână și invariantul față de Paștele ortodox (0, 7, 28 sau 35 de zile).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- $F
git merge origin/main
git push origin main
```

---

### Task F2: Sărbătorile după calendarul cultului

**Fișiere:**
- Create: `src/domain/calendar/sarbatori-cult.ts`
- Test: `src/domain/calendar/sarbatori-cult.test.ts`

**Interfețe:**
- Consumă: `sarbatoriAnului(an: number): readonly Sarbatoare[]`, `sarbatoriDupaZi(an: number): ReadonlyMap<string, string>` și `type Sarbatoare` din `./sarbatori`, plus `pasteGregorian` (F1).
- Produce:
  - `export type CalendarPaste = "ortodox" | "gregorian"`
  - `export const CALENDARE_PASTE: readonly CalendarPaste[]`
  - `export function sarbatoriAnuluiPentruCult(an: number, calendar: CalendarPaste): readonly Sarbatoare[]`
  - `export function sarbatoriDupaZiPentruCult(an: number, calendar: CalendarPaste): ReadonlyMap<string, string>`

`sarbatori.ts` NU se modifică: ramura `"ortodox"` întoarce exact funcțiile existente, iar fixele se iau din `sarbatoriAnului`.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/domain/calendar/sarbatori-cult.test.ts`:

```ts
// src/domain/calendar/sarbatori-cult.test.ts

import { describe, expect, it } from "vitest";

import { sarbatoriDupaZi } from "./sarbatori";
import { sarbatoriAnuluiPentruCult, sarbatoriDupaZiPentruCult } from "./sarbatori-cult";

/**
 * Ce apără: art. 139 alin. (2¹) din Codul muncii — pentru un salariat de alt
 * cult creștin, Vinerea Mare, Paștele și Rusaliile cad la datele cultului lui.
 * Datele de mai jos sunt scrise de mână (Paștele gregorian 2026 = 5 aprilie,
 * 2027 = 28 martie), nu derivate din funcția testată.
 */
describe("sărbătorile după calendarul Paștelui", () => {
  it("ortodox: exact harta din sarbatoriDupaZi", () => {
    for (const an of [2024, 2026, 2027]) {
      expect([...sarbatoriDupaZiPentruCult(an, "ortodox")], String(an)).toEqual([
        ...sarbatoriDupaZi(an),
      ]);
    }
  });

  it("gregorian 2026: zilele mobile se mută, fixele rămân", () => {
    const h = sarbatoriDupaZiPentruCult(2026, "gregorian");
    expect(h.get("2026-04-03")).toBe("Vinerea Mare");
    expect(h.get("2026-04-05")).toBe("Paștele");
    expect(h.get("2026-04-06")).toBe("A doua zi de Paște");
    expect(h.get("2026-05-24")).toBe("Rusaliile");
    expect(h.get("2026-05-25")).toBe("A doua zi de Rusalii");
    // Datele ortodoxe nu mai sunt zile libere pentru acest salariat — alin. (3¹).
    expect(h.has("2026-04-10")).toBe(false);
    expect(h.has("2026-04-13")).toBe(false);
    // 1 iunie rămâne Ziua Copilului, fără a doua zi de Rusalii ortodoxă.
    expect(h.get("2026-06-01")).toBe("Ziua Copilului");
    expect(h.get("2026-12-25")).toBe("Crăciunul");
    expect(h.size).toBe(17);
  });

  it("gregorian 2027: Paștele pe 28 martie, Rusaliile pe 16 mai", () => {
    const h = sarbatoriDupaZiPentruCult(2027, "gregorian");
    for (const zi of ["2027-03-26", "2027-03-28", "2027-03-29", "2027-05-16", "2027-05-17"]) {
      expect(h.has(zi), zi).toBe(true);
    }
    for (const zi of ["2027-04-30", "2027-05-02", "2027-05-03", "2027-06-20", "2027-06-21"]) {
      expect(h.has(zi), zi).toBe(false);
    }
  });

  it("când Paștele coincide (2025, 2028), cele două calendare dau aceleași zile", () => {
    for (const an of [2025, 2028]) {
      expect([...sarbatoriDupaZiPentruCult(an, "gregorian").keys()].sort(), String(an)).toEqual(
        [...sarbatoriDupaZi(an).keys()].sort(),
      );
    }
  });

  it("lista are 12 sărbători fixe și 5 mobile, în ordine cronologică", () => {
    const lista = sarbatoriAnuluiPentruCult(2026, "gregorian");
    expect(lista.filter((s) => s.tip === "fix")).toHaveLength(12);
    expect(lista.filter((s) => s.tip === "mobil")).toHaveLength(5);
    const timpi = lista.map((s) => s.data.getTime());
    expect(timpi).toEqual([...timpi].sort((a, b) => a - b));
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/calendar/sarbatori-cult.test.ts
```

Așteptat: `Failed to resolve import "./sarbatori-cult"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `src/domain/calendar/sarbatori-cult.ts`:

```ts
// src/domain/calendar/sarbatori-cult.ts

import { pasteGregorian } from "./paste-gregorian";
import { sarbatoriAnului, sarbatoriDupaZi, type Sarbatoare } from "./sarbatori";

/**
 * Sărbătorile legale ale unui salariat, după calendarul după care își serbează
 * cultul lui Paștele.
 *
 * ── TEMEIUL ────────────────────────────────────────────────────────────────
 * Codul muncii, forma consolidată de pe legislatie.just.ro (documentul 128647,
 * descărcată pe 8 oct 2026):
 *  · art. 139 alin. (2¹) — pentru salariații unui cult religios legal, creștin,
 *    Vinerea Mare, prima și a doua zi de Paști, prima și a doua zi de Rusalii
 *    „se acordă în funcție de data la care sunt celebrate de acel cult”;
 *  · alin. (3¹) — cine a primit zilele libere și la datele cultului lui, și la
 *    ale altui cult creștin, recuperează zilele suplimentare.
 * Deci pentru un salariat romano-catolic, datele ortodoxe NU mai sunt libere:
 * le înlocuiesc cele gregoriene. Interpretarea e marcată ⚠ în NOTES.md.
 *
 * ── DE CE CALENDARUL, NU NUMELE CULTULUI ───────────────────────────────────
 * Legea trimite la data cultului, nu la o listă de culte. Pentru cultele
 * creștine din România sunt două date posibile: cea din calendarul iulian (a
 * Bisericii Ortodoxe) și cea din calendarul gregorian (romano-catolici,
 * reformați, evanghelici, unitarieni). Nu legăm aici un cult anume de un
 * calendar; interfața arată ambele date ale anului, iar omul o alege pe a lui.
 *
 * ── DE CE FIXELE VIN DIN `sarbatoriAnului` ─────────────────────────────────
 * Alin. (2¹) mută doar cele cinci zile mobile. Fixele se iau din aceeași
 * funcție ca restul aplicației, deci orice corecție de acolo (de exemplu 6–7
 * ianuarie doar din 2024) ajunge și aici, fără o a doua listă.
 */
export type CalendarPaste = "ortodox" | "gregorian";

export const CALENDARE_PASTE: readonly CalendarPaste[] = ["ortodox", "gregorian"];

function adaugaZile(data: Date, zile: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + zile));
}

function cheie(data: Date): string {
  return `${String(data.getUTCFullYear()).padStart(4, "0")}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

/** Lista sărbătorilor anului; pentru `"ortodox"`, exact `sarbatoriAnului(an)`. */
export function sarbatoriAnuluiPentruCult(
  an: number,
  calendar: CalendarPaste,
): readonly Sarbatoare[] {
  if (calendar === "ortodox") return sarbatoriAnului(an);
  const paste = pasteGregorian(an);
  const mobile: readonly Sarbatoare[] = [
    { data: adaugaZile(paste, -2), denumire: "Vinerea Mare", tip: "mobil" },
    { data: paste, denumire: "Paștele", tip: "mobil" },
    { data: adaugaZile(paste, 1), denumire: "A doua zi de Paște", tip: "mobil" },
    { data: adaugaZile(paste, 49), denumire: "Rusaliile", tip: "mobil" },
    { data: adaugaZile(paste, 50), denumire: "A doua zi de Rusalii", tip: "mobil" },
  ];
  return [...sarbatoriAnului(an).filter((s) => s.tip === "fix"), ...mobile].sort(
    (prima, aDoua) => prima.data.getTime() - aDoua.data.getTime(),
  );
}

/**
 * Perechea lui `sarbatoriDupaZi`, pe calendarul cultului: ziua ISO →
 * denumirea, cu denumirile ADUNATE când două sărbători cad în aceeași zi.
 */
export function sarbatoriDupaZiPentruCult(
  an: number,
  calendar: CalendarPaste,
): ReadonlyMap<string, string> {
  if (calendar === "ortodox") return sarbatoriDupaZi(an);
  const dupaZi = new Map<string, string>();
  for (const sarbatoare of sarbatoriAnuluiPentruCult(an, calendar)) {
    const zi = cheie(sarbatoare.data);
    const dinainte = dupaZi.get(zi);
    dupaZi.set(
      zi,
      dinainte === undefined ? sarbatoare.denumire : `${dinainte} · ${sarbatoare.denumire}`,
    );
  }
  return dupaZi;
}
```

- [ ] **Pasul 4: Rulează testele, trec.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/calendar/
```

Apoi lanțul complet.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
F="src/domain/calendar/sarbatori-cult.ts src/domain/calendar/sarbatori-cult.test.ts"
git status --short -- $F
git fetch origin main
git diff --name-only HEAD origin/main -- src/domain/calendar/
git add -- $F
git commit --only -m "$(cat <<'MSG'
feat(calendar): sărbătorile legale după calendarul cultului (art. 139 alin. 2¹)

Pentru calendarul gregorian, cele cinci zile mobile vin din Paștele gregorian,
iar datele ortodoxe nu mai sunt libere pentru salariat (alin. 3¹). Fixele se
iau din sarbatoriAnului, deci orice corecție de acolo se propagă.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- $F
git merge origin/main
git push origin main
```

---

### Task F3: Textul curățat pentru documente

**Fișiere:**
- Create: `src/lib/unelte/text-curat.ts`
- Test: `src/lib/unelte/text-curat.test.ts`

**Interfețe:**
- Produce: `export function faraCaractereDeControl(text: string): string`, `export function cuVirgula(text: string): string`.

Modulul e mic și comun intenționat. Dacă secțiunea transversală introduce un normalizator comun pentru `docx.ts`, îl poate importa de aici.

> ⚠ **Coordonarea cu B2 (adăugată de criticul de completitudine, 8 oct 2026).** Secțiunea B rulează înaintea lui F (valul 2 față de valul 3). B2 pune în `src/lib/unelte/document-tabelar.ts` un singur punct de curățare, `curataText`, cu regula verificată pe parser XML real (saxes): separatorii devin spațiu, iar se șterg C0 rămase, C1, U+200B–U+200D, U+2060, BOM-ul, **U+FFFE/U+FFFF și surogatele orfane**. Bucla de mai jos atinge doar U+0000–U+001F și U+007F. Un U+FFFE lipit într-un nume ar trece deci prin `scrisoare-docx.ts` (care NU trece prin `raspunsDocument` și deci nici prin `curataDocument`) și ar strica `word/document.xml`, exact defectul transversal D8.3 din audit. Așa ar exista și două reguli de curățare diferite. Regula: `faraCaractereDeControl` își păstrează comportamentul (controlul devine spațiu, ca „Popa⟨VT⟩Ion” să rămână două cuvinte, iar testele din F4 și F8 nu se schimbă), dar **se încheie cu `curataText` din B2**. La Pasul 3, în `text-curat.ts`: importul `import { curataText } from "./document-tabelar";`, iar ultima linie din `faraCaractereDeControl` devine `return curataText(rezultat);`. Docblock-ul funcției primește fraza „Restul (U+FFFE/U+FFFF, surogatele orfane, C1, spațiile de lățime zero) îl scoate `curataText` din B2, singura regulă a uneltelor.” La Pasul 1, testul primește încă un caz:
>
> ```ts
>   it("tot ce rupe XML-ul iese, prin regula comună din B2 (curataText)", () => {
>     expect(faraCaractereDeControl("A\u{FFFE}B\u{200B}C\u{FEFF}")).toBe("ABC");
>   });
> ```
>
> Dacă B2 nu e pe `main` (`grep -n "export function curataText" src/lib/unelte/document-tabelar.ts` nu găsește nimic), F3 nu începe.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/lib/unelte/text-curat.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { cuVirgula, faraCaractereDeControl } from "./text-curat";

describe("textul curățat pentru documente", () => {
  it("caracterele de control devin spații, restul rămâne neatins", () => {
    expect(faraCaractereDeControl("Popa\u000BIon\u0001\u001FSRL\u007F")).toBe("Popa Ion  SRL ");
    expect(faraCaractereDeControl("Ștefan Țepeș — „Ână”")).toBe("Ștefan Țepeș — „Ână”");
  });

  it("emoji-urile și literele din afara BMP nu se rup în două", () => {
    expect(faraCaractereDeControl("a😀b")).toBe("a😀b");
  });

  it("sedila devine virgulă, pe litere mici și mari", () => {
    expect(cuVirgula("şef de ţară, ŞTEFAN ŢEPEŞ")).toBe("șef de țară, ȘTEFAN ȚEPEȘ");
    expect(cuVirgula("șef corect")).toBe("șef corect");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/text-curat.test.ts
```

Așteptat: `Failed to resolve import "./text-curat"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `src/lib/unelte/text-curat.ts`:

```ts
/**
 * Curățarea textului care ajunge într-un document generat.
 *
 * ── DE CE ──────────────────────────────────────────────────────────────────
 * Auditul transversal din 8 oct 2026: un U+000B (ruptura de rând manuală din
 * Word, lipită în formular) ajungea neschimbat în `word/document.xml`, iar
 * Word refuza fișierul ca „not well-formed”. Iar „ş”/„ţ” cu sedilă, încă
 * produse de tastaturi vechi și de unele telefoane, treceau în documentul de
 * semnat lângă „ș”/„ț” corecte.
 *
 * Ca buclă, nu ca expresie regulată, din motivul scris în
 * `src/lib/push/mesaj.ts`: `no-control-regex` semnalează pe bună dreptate un
 * interval de caractere de control într-un regex.
 */

/** Fiecare caracter de control (U+0000–U+001F, U+007F) devine un spațiu. */
export function faraCaractereDeControl(text: string): string {
  let rezultat = "";
  for (const caracter of text) {
    const cod = caracter.codePointAt(0) ?? 0;
    rezultat += cod < 0x20 || cod === 0x7f ? " " : caracter;
  }
  return rezultat;
}

const CU_VIRGULA: Readonly<Record<string, string>> = {
  ş: "ș", // ş → ș
  Ş: "Ș", // Ş → Ș
  ţ: "ț", // ţ → ț
  Ţ: "Ț", // Ţ → Ț
};

/** „ş”, „ţ” (cu sedilă, U+015F/U+0163 și majusculele) → „ș”, „ț” (cu virgulă). */
export function cuVirgula(text: string): string {
  return text.replace(/[ŞşŢţ]/gu, (litera) => CU_VIRGULA[litera] ?? litera);
}
```

- [ ] **Pasul 4: Rulează testele, trec.** Comanda de la pasul 2, apoi lanțul complet.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
F="src/lib/unelte/text-curat.ts src/lib/unelte/text-curat.test.ts"
git status --short -- $F
git fetch origin main
git diff --name-only HEAD origin/main -- src/lib/unelte/
git add -- $F
git commit --only -m "$(cat <<'MSG'
feat(unelte): curățarea textului pentru documente — control și sedilă

Un U+000B lipit din Word făcea .docx-ul de nedeschis (auditul din 8 oct 2026);
ş/ţ cu sedilă treceau în documentul de semnat. Buclă, nu regex, ca în
src/lib/push/mesaj.ts (no-control-regex).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- $F
git merge origin/main
git push origin main
```

---

### Task F4: Cererea citește strict: date, zero zile, ziua de azi, implicitul

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere.ts`: rescris integral, păstrând `construiesteCerere`, `normalizeazaText`, `aziIso`, `plusZile` și `normalizeazaData` (pagina veche încă le folosește; F14 o șterge pe ultima).
- Test: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere.test.ts`: importuri lărgite și patru blocuri `describe` noi la final.

**Interfețe:**
- Consumă: `todayInBucharest(): string` din `@/lib/format/date`, plus `cuVirgula` și `faraCaractereDeControl` (F3).
- Produce:
  - `export const AN_MIN = 2024` (era 2020); `AN_MAX = 2035` neschimbat.
  - `export type DataCitita = Readonly<{ data: string | null; problema: string | null }>`
  - `export function citesteData(brut: string | undefined, eticheta: string): DataCitita`
  - `export function intervalImplicit(azi: string): Readonly<{ deLa: string; panaLa: string }>`
  - `aziIso(): string`: acum în fusul București.
  - `normalizeazaText(brut, maxim?)`: acum scoate caracterele de control și sedila și strânge spațiile.
  - `construiesteCerere(deLa, panaLa): Cerere`: `problema` nenulă și când `zileLucratoare === 0`, cu numerele păstrate.

- [ ] **Pasul 1: Scrie testul care pică.** În `cerere.test.ts`, blocul de import vechi:

```ts
import { describe, expect, it } from "vitest";

import { construiesteCerere, normalizeazaData, normalizeazaText, plusZile } from "./cerere";
```

devine:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AN_MAX,
  AN_MIN,
  aziIso,
  citesteData,
  construiesteCerere,
  intervalImplicit,
  normalizeazaData,
  normalizeazaText,
  plusZile,
} from "./cerere";
```

La sfârșitul fișierului, după ultimul `});`, adaugă:

```ts
describe("intrările din adresă, citite strict (auditul din 8 oct 2026)", () => {
  it("o dată lipsă nu e o greșeală: apelantul pune implicitul", () => {
    expect(citesteData(undefined, "De la")).toEqual({ data: null, problema: null });
    expect(citesteData("  ", "De la")).toEqual({ data: null, problema: null });
  });

  it("o dată bună trece neschimbată", () => {
    expect(citesteData("2026-11-16", "De la")).toEqual({ data: "2026-11-16", problema: null });
  });

  it("o dată prezentă dar greșită e refuzată cu motiv, nu înlocuită cu implicitul", () => {
    for (const brut of ["abc", "2026-02-30", "2026-13-01", "16.11.2026"]) {
      const citita = citesteData(brut, "De la");
      expect(citita.data, brut).toBeNull();
      expect(citita.problema, brut).toMatch(/^De la: .*nu e o dată reală\.$/u);
    }
  });

  it("anii din afara intervalului sunt refuzați, cu intervalul în mesaj", () => {
    expect(citesteData("2036-01-05", "Până la").problema).toBe(
      `Până la: anul 2036 e în afara intervalului ${String(AN_MIN)}–${String(AN_MAX)}.`,
    );
    expect(citesteData("2019-01-05", "De la").problema).toMatch(/2019/u);
  });

  it("anii 2020–2023 nu mai sunt acceptați: calendarul comun ar scădea 6 și 7 ianuarie", () => {
    expect(AN_MIN).toBe(2024);
    expect(citesteData("2023-01-06", "De la").problema).not.toBeNull();
  });
});

describe("cererea fără nicio zi lucrătoare", () => {
  it("un weekend singur nu e o cerere, dar numerele rămân pentru explicație", () => {
    const c = construiesteCerere("2026-11-14", "2026-11-15");
    expect(c.problema).toMatch(/nicio zi lucrătoare/u);
    expect(c.zileWeekend).toBe(2);
  });

  it("o sărbătoare singură nu e o cerere", () => {
    expect(construiesteCerere("2026-12-01", "2026-12-01").problema).toMatch(/nicio zi lucrătoare/u);
  });

  it("o zi lucrătoare lângă un weekend e o cerere", () => {
    expect(construiesteCerere("2026-11-13", "2026-11-15").problema).toBeNull();
  });
});

describe("textul din adresă", () => {
  it("sedila devine virgulă", () => {
    // Sedilele scrise ca escape-uri: `continut.test.ts` refuză sedila în stratul de marketing.
    expect(normalizeazaText("\u015Fef de \u0163ar\u0103, \u015ETEFAN \u0162EPE\u015E")).toBe(
      "șef de țară, ȘTEFAN ȚEPEȘ",
    );
  });

  it("caracterele de control devin un singur spațiu", () => {
    expect(normalizeazaText("Popa\u000BIon\u0001\u001FSRL")).toBe("Popa Ion SRL");
  });
});

describe("ziua de azi și intervalul implicit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("azi e ziua din România, nu din UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T22:30:00Z")); // 01:30 pe 9 octombrie, ora României
    expect(aziIso()).toBe("2026-10-09");
  });

  it("implicitul începe luni, la cel puțin 60 de zile, și se termină vineri", () => {
    // 08.10.2026 + 60 = 07.12.2026, o luni; 09.10.2026 + 60 = 08.12.2026, o marți.
    expect(intervalImplicit("2026-10-08")).toEqual({ deLa: "2026-12-07", panaLa: "2026-12-11" });
    expect(intervalImplicit("2026-10-09")).toEqual({ deLa: "2026-12-14", panaLa: "2026-12-18" });
    const implicit = intervalImplicit("2026-10-08");
    expect(construiesteCerere(implicit.deLa, implicit.panaLa).zileLucratoare).toBe(5);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere.test.ts"
```

Așteptat: `citesteData is not a function`, `intervalImplicit is not a function`, `expected 2020 to be 2024`, „nicio zi lucrătoare” nepotrivit (`problema` e `null`) și `aziIso` → `2026-10-08` în loc de `2026-10-09`.

- [ ] **Pasul 3: Implementarea minimă.** Înlocuiește tot `cerere.ts` (fișierul de 150 de linii citit integral la scrierea planului) cu:

```ts
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
import { todayInBucharest } from "@/lib/format/date";
import { cuVirgula, faraCaractereDeControl } from "@/lib/unelte/text-curat";

/**
 * Cererea de concediu de odihnă: intervalul, și câte zile consumă din sold.
 *
 * ── CE FACE DIFERIT FAȚĂ DE UN MODEL DESCĂRCAT ────────────────────────────
 * Un model în Word are un spațiu gol în care omul scrie „14 zile". Numărul ăla
 * e greșit surprinzător de des, fiindcă art. 145 alin. (3) din Codul muncii
 * spune că sărbătorile legale în care nu se lucrează NU intră în durata
 * concediului — iar cine numără pe calendar le numără.
 *
 * Aici zilele se CALCULEAZĂ: weekendurile și sărbătorile legale se scad, iar
 * cele scoase se și enumeră, cu motivul lângă fiecare. Sărbătorile vin din
 * `sarbatoriDupaZi`, adică din același cod care ține calendarul aplicației,
 * inclusiv Paștele ortodox și zilele care depind de el. E singurul lucru pe
 * care un fișier descărcat nu-l poate face.
 *
 * ── CE NU FACE, ȘI DE CE ──────────────────────────────────────────────────
 * Nu scade zile libere plătite stabilite prin contractul colectiv sau prin
 * regulamentul intern, deși art. 145 alin. (3) le exclude și pe acelea. Nu le
 * putem cunoaște: sunt ale fiecărei firme. Pagina o spune, în loc să dea un
 * număr care pare exact și nu e.
 *
 * ── CE REFUZĂ, DIN 8 OCT 2026 ─────────────────────────────────────────────
 * Auditul live a găsit trei intrări transformate tăcut în documente: o dată
 * din afara intervalului înlocuită cu implicitul (`de_la=2019-01-05` dădea o
 * cerere pentru noiembrie 2026, cu 200), o cerere de „0 zile lucrătoare” pentru
 * un weekend și ziua de azi luată în UTC. `citesteData` și verificarea din
 * `construiesteCerere` le închid.
 */

/**
 * Limitele anilor. AN_MIN e 2024, nu 2020: calendarul comun pune 6 și 7
 * ianuarie în orice an, deși au intrat în art. 139 abia la 09.03.2023 (Legea
 * 52/2023). Pentru 2020–2023 cererea ar fi scăzut două zile care atunci erau
 * lucrătoare.
 */
export const AN_MIN = 2024;
export const AN_MAX = 2035;
/** Peste un an de concediu nu mai e o cerere, e o greșeală de tastare. */
const MAX_ZILE_INTERVAL = 366;

export type ZiExclusa = Readonly<{ data: string; motiv: string }>;

export type Cerere = Readonly<{
  deLa: string;
  panaLa: string;
  zileCalendaristice: number;
  zileLucratoare: number;
  /** Zilele scoase din numărătoare, cu motivul. Weekendurile intră aici grupat. */
  excluse: readonly ZiExclusa[];
  /** Câte weekenduri au căzut în interval — numărate, nu enumerate. */
  zileWeekend: number;
  /** `null` dacă intervalul e bun; altfel motivul, gata de afișat. */
  problema: string | null;
}>;

const ZI_MS = 24 * 60 * 60 * 1000;

/** `2026-09-18` → `Date` la miezul nopții UTC, sau `null` dacă nu e o dată reală. */
function dinIso(valoare: string): Date | null {
  const potrivire = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(valoare);
  if (potrivire === null) return null;
  const [, a, l, z] = potrivire;
  const an = Number(a);
  const luna = Number(l);
  const zi = Number(z);
  const data = new Date(Date.UTC(an, luna - 1, zi));
  // Postgres ar refuza „31 februarie"; `Date.UTC` îl mută tăcut pe 3 martie.
  if (data.getUTCFullYear() !== an || data.getUTCMonth() !== luna - 1 || data.getUTCDate() !== zi) {
    return null;
  }
  return data;
}

function iso(data: Date): string {
  return `${String(data.getUTCFullYear()).padStart(4, "0")}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-${String(data.getUTCDate()).padStart(2, "0")}`;
}

export type DataCitita = Readonly<{ data: string | null; problema: string | null }>;

/**
 * O dată din adresă, citită STRICT. Lipsa nu e o greșeală — `{ data: null,
 * problema: null }`, iar apelantul pune implicitul. O valoare prezentă dar
 * greșită e o greșeală și se spune, cu numele câmpului.
 */
export function citesteData(brut: string | undefined, eticheta: string): DataCitita {
  const valoare = (brut ?? "").trim();
  if (valoare === "") return { data: null, problema: null };
  const data = dinIso(valoare);
  if (data === null) {
    return { data: null, problema: `${eticheta}: „${valoare.slice(0, 20)}” nu e o dată reală.` };
  }
  const an = data.getUTCFullYear();
  if (an < AN_MIN || an > AN_MAX) {
    return {
      data: null,
      problema: `${eticheta}: anul ${String(an)} e în afara intervalului ${String(AN_MIN)}–${String(AN_MAX)}.`,
    };
  }
  return { data: iso(data), problema: null };
}

/**
 * Data din adresă, sau implicitul — și pentru lipsă, și pentru o valoare
 * greșită. Rămâne doar pentru pagina de dinainte de 8 oct 2026; taskul F14
 * o șterge odată cu pagina veche. Codul nou folosește `citesteData`.
 */
export function normalizeazaData(brut: string | undefined, implicit: string): string {
  const data = dinIso((brut ?? "").trim());
  if (data === null) return implicit;
  const an = data.getUTCFullYear();
  return an >= AN_MIN && an <= AN_MAX ? iso(data) : implicit;
}

/**
 * Un câmp de text din adresă: un singur rând, fără caractere de control, cu
 * „ș”/„ț” cu virgulă, plafonat, fără spații la capete.
 */
export function normalizeazaText(brut: string | undefined, maxim = 120): string {
  return cuVirgula(faraCaractereDeControl(brut ?? ""))
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxim);
}

/**
 * Ziua de azi în România, ca `YYYY-MM-DD`. Nu în UTC: între miezul nopții și
 * 02:00–03:00 ora României, `new Date()` în UTC dădea ziua de ieri.
 */
export function aziIso(): string {
  return todayInBucharest();
}

/** Aceeași zi, mutată cu `n` zile. */
export function plusZile(isoData: string, n: number): string {
  const data = dinIso(isoData);
  if (data === null) return isoData;
  return iso(new Date(data.getTime() + n * ZI_MS));
}

/**
 * Intervalul cu care se deschide formularul: prima zi de luni aflată la cel
 * puțin 60 de zile de azi, până vineri în aceeași săptămână.
 *
 * 60, fiindcă art. 148 alin. (4) dă salariatului dreptul să ceară concediul cu
 * cel puțin 60 de zile înainte; luni–vineri, fiindcă implicitul vechi (azi + 30)
 * cădea pe 7 noiembrie 2026, o sâmbătă.
 */
export function intervalImplicit(azi: string): Readonly<{ deLa: string; panaLa: string }> {
  const baza = dinIso(azi) ?? new Date(Date.UTC(AN_MIN, 0, 1));
  const peste60 = new Date(baza.getTime() + 60 * ZI_MS);
  const panaLaLuni = (8 - peste60.getUTCDay()) % 7;
  const luni = new Date(peste60.getTime() + panaLaLuni * ZI_MS);
  return { deLa: iso(luni), panaLa: iso(new Date(luni.getTime() + 4 * ZI_MS)) };
}

export function construiesteCerere(deLa: string, panaLa: string): Cerere {
  const inceput = dinIso(deLa);
  const sfarsit = dinIso(panaLa);
  const gol = (problema: string): Cerere => ({
    deLa,
    panaLa,
    zileCalendaristice: 0,
    zileLucratoare: 0,
    excluse: [],
    zileWeekend: 0,
    problema,
  });

  if (inceput === null || sfarsit === null) return gol("Una dintre date nu e o zi reală.");
  if (sfarsit.getTime() < inceput.getTime()) {
    return gol("Data de sfârșit e înaintea celei de început.");
  }
  const zileCalendaristice = Math.round((sfarsit.getTime() - inceput.getTime()) / ZI_MS) + 1;
  if (zileCalendaristice > MAX_ZILE_INTERVAL) {
    return gol(`Intervalul are ${String(zileCalendaristice)} de zile — prea mult pentru o cerere.`);
  }

  // Intervalul poate traversa 31 decembrie, deci sărbătorile se cer pe ani, nu
  // pe un an presupus. Harta se construiește o dată, nu per zi.
  const sarbatori = new Map<string, string>();
  for (let an = inceput.getUTCFullYear(); an <= sfarsit.getUTCFullYear(); an += 1) {
    for (const [zi, nume] of sarbatoriDupaZi(an)) sarbatori.set(zi, nume);
  }

  const excluse: ZiExclusa[] = [];
  let zileLucratoare = 0;
  let zileWeekend = 0;

  for (let t = inceput.getTime(); t <= sfarsit.getTime(); t += ZI_MS) {
    const zi = new Date(t);
    const dow = zi.getUTCDay();
    const cheie = iso(zi);
    if (dow === 0 || dow === 6) {
      zileWeekend += 1;
      continue;
    }
    const sarbatoare = sarbatori.get(cheie);
    if (sarbatoare !== undefined) {
      excluse.push({ data: cheie, motiv: sarbatoare });
      continue;
    }
    zileLucratoare += 1;
  }

  // Numerele rămân, ca pagina să poată arăta de ce: „2 zile de weekend”.
  const problema =
    zileLucratoare === 0
      ? "Intervalul nu conține nicio zi lucrătoare: toate zilele lui sunt de weekend sau sărbători legale."
      : null;
  return { deLa, panaLa, zileCalendaristice, zileLucratoare, excluse, zileWeekend, problema };
}
```

- [ ] **Pasul 4: Rulează testele, trec.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/cerere-concediu-de-odihna/" src/app/api/unelte/
```

Așteptat: verzi, inclusiv vechile `cerere-document.test.ts` și `[unealta]/route.test.ts`, care folosesc intervale lucrătoare din 2026. Apoi lanțul complet. `lastmod.mjs` nu cere nimic: `page.tsx` nu e atins.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/cerere-concediu-de-odihna"
git status --short -- "$D/cerere.ts" "$D/cerere.test.ts"
git fetch origin main
git diff --name-only HEAD origin/main -- "$D"
git commit --only -m "$(cat <<'MSG'
fix(unelte): cererea de concediu refuză datele greșite în loc să le înlocuiască

Auditul din 8 oct 2026: de_la=2036-01-05 dădea 200 cu o cerere pentru
noiembrie 2026; un weekend dădea o cerere de „0 zile lucrătoare”; ziua de azi
se lua în UTC. citesteData spune ce e greșit, construiesteCerere refuză zero
zile, aziIso e ora României, implicitul e luni la +60 de zile. AN_MIN = 2024:
6–7 ianuarie sunt sărbători abia din 09.03.2023 (Legea 52/2023).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- "$D/cerere.ts" "$D/cerere.test.ts"
git merge origin/main
git push origin main
```

---

### Task F5: Calendarul cultului în numărătoarea zilelor

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere.ts`: importul, semnătura `construiesteCerere` și bucla sărbătorilor.
- Test: `…/cerere.test.ts`: un `describe` nou la final.

**Interfețe:**
- Consumă: `sarbatoriDupaZiPentruCult`, `type CalendarPaste` (F2).
- Produce: `export function construiesteCerere(deLa: string, panaLa: string, calendar: CalendarPaste = "ortodox"): Cerere`. Apelanții existenți, cu două argumente, nu se schimbă.

- [ ] **Pasul 1: Scrie testul care pică.** La sfârșitul lui `cerere.test.ts` adaugă:

```ts
describe("salariatul de alt cult creștin — art. 139 alin. (2¹)", () => {
  it("în săptămâna Paștelui 2026 se scad datele cultului, nu cele ortodoxe", () => {
    // 30.03–10.04.2026: două săptămâni, luni–vineri, fără alte sărbători.
    const ortodox = construiesteCerere("2026-03-30", "2026-04-10");
    const gregorian = construiesteCerere("2026-03-30", "2026-04-10", "gregorian");
    expect(ortodox.zileLucratoare).toBe(9); // doar 10.04, Vinerea Mare ortodoxă
    expect(gregorian.zileLucratoare).toBe(8); // 03.04 și 06.04
    expect(gregorian.excluse.map((z) => z.data)).toEqual(["2026-04-03", "2026-04-06"]);
  });

  it("cazul din audit: 26.04–07.05.2027 are 8 zile ortodox și 10 gregorian", () => {
    expect(construiesteCerere("2027-04-26", "2027-05-07").zileLucratoare).toBe(8);
    expect(construiesteCerere("2027-04-26", "2027-05-07", "gregorian").zileLucratoare).toBe(10);
  });

  it("peste Anul Nou, fiecare an își ia Paștele din calendarul ales", () => {
    // 28.12.2026–02.04.2027: Paștele gregorian 2027 e pe 28 martie, cel ortodox pe 2 mai.
    const ortodox = construiesteCerere("2026-12-28", "2027-04-02");
    const gregorian = construiesteCerere("2026-12-28", "2027-04-02", "gregorian");
    expect(ortodox.zileLucratoare).toBe(67);
    expect(gregorian.zileLucratoare).toBe(65);
    expect(gregorian.excluse.map((z) => z.data)).toEqual([
      "2027-01-01",
      "2027-01-06",
      "2027-01-07",
      "2027-03-26",
      "2027-03-29",
    ]);
  });

  it("implicitul rămâne calendarul ortodox", () => {
    expect(construiesteCerere("2026-03-30", "2026-04-10")).toEqual(
      construiesteCerere("2026-03-30", "2026-04-10", "ortodox"),
    );
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.** Comanda de la F4, pasul 2. Așteptat: `expected 9 to be 8`, `expected 8 to be 10`, `expected 67 to be 65`. Al treilea argument e ignorat.

- [ ] **Pasul 3: Implementarea minimă.** În `cerere.ts`, trei înlocuiri pe codul scris în F4:

```ts
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
```

→

```ts
import { sarbatoriDupaZiPentruCult, type CalendarPaste } from "@/domain/calendar/sarbatori-cult";
```

și

```ts
export function construiesteCerere(deLa: string, panaLa: string): Cerere {
```

→

```ts
/**
 * `calendar` e calendarul Paștelui pentru salariat: `"gregorian"` pentru un cult
 * creștin care îl serbează după calendarul gregorian — art. 139 alin. (2¹).
 */
export function construiesteCerere(
  deLa: string,
  panaLa: string,
  calendar: CalendarPaste = "ortodox",
): Cerere {
```

și

```ts
    for (const [zi, nume] of sarbatoriDupaZi(an)) sarbatori.set(zi, nume);
```

→

```ts
    for (const [zi, nume] of sarbatoriDupaZiPentruCult(an, calendar)) sarbatori.set(zi, nume);
```

- [ ] **Pasul 4: Rulează testele, trec.** Comanda de la F4, pasul 4, apoi lanțul complet.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/cerere-concediu-de-odihna"
git status --short -- "$D/cerere.ts" "$D/cerere.test.ts"
git fetch origin main
git diff --name-only HEAD origin/main -- "$D"
git commit --only -m "$(cat <<'MSG'
feat(unelte): cererea numără după calendarul cultului salariatului

26.04–07.05.2027 are 8 zile lucrătoare pe calendarul ortodox și 10 pe cel
gregorian — art. 139 alin. (2¹) din Codul muncii, lipsă până acum (auditul
din 8 oct 2026). Implicitul rămâne ortodox.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- "$D/cerere.ts" "$D/cerere.test.ts"
git merge origin/main
git push origin main
```

---

### Task F6: Acordul numerelor din cerere

**Fișiere:**
- Create: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/text-zile.ts`
- Test: `…/text-zile.test.ts`

**Interfețe:**
- Consumă: `cuDe(n: number, substantiv: string): string` din `@/content/legal/zile-libere`.
- Produce: `zileLucratoareText(n)`, `zileText(n)`, `zileCalendaristiceText(n)`, `weekendText(n)`, `sarbatoriText(n)`, toate `(n: number) => string`.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `text-zile.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  sarbatoriText,
  weekendText,
  zileCalendaristiceText,
  zileLucratoareText,
  zileText,
} from "./text-zile";

describe("acordul numerelor din cerere (auditul din 8 oct 2026)", () => {
  it("zilele lucrătoare: singular, sub 20 fără „de”, de la 20 cu „de”", () => {
    expect(zileLucratoareText(0)).toBe("nicio zi lucrătoare");
    expect(zileLucratoareText(1)).toBe("1 zi lucrătoare");
    expect(zileLucratoareText(5)).toBe("5 zile lucrătoare");
    expect(zileLucratoareText(19)).toBe("19 zile lucrătoare");
    expect(zileLucratoareText(20)).toBe("20 de zile lucrătoare");
    expect(zileLucratoareText(101)).toBe("101 zile lucrătoare");
    expect(zileLucratoareText(250)).toBe("250 de zile lucrătoare");
  });

  it("weekendul: „o zi de weekend”, nu „cele 1 zile de weekend”", () => {
    expect(weekendText(0)).toBe("nicio zi de weekend");
    expect(weekendText(1)).toBe("o zi de weekend");
    expect(weekendText(2)).toBe("cele 2 zile de weekend");
    expect(weekendText(20)).toBe("cele 20 de zile de weekend");
    expect(weekendText(104)).toBe("cele 104 zile de weekend");
  });

  it("zilele calendaristice și sărbătorile", () => {
    expect(zileText(1)).toBe("1 zi");
    expect(zileText(30)).toBe("30 de zile");
    expect(zileCalendaristiceText(1)).toBe("1 zi calendaristică");
    expect(zileCalendaristiceText(20)).toBe("20 de zile calendaristice");
    expect(sarbatoriText(0)).toBe("nicio sărbătoare legală");
    expect(sarbatoriText(1)).toBe("o sărbătoare legală");
    expect(sarbatoriText(4)).toBe("4 sărbători legale");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/cerere-concediu-de-odihna/text-zile.test.ts"
```

Așteptat: `Failed to resolve import "./text-zile"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `text-zile.ts`:

```ts
import { cuDe } from "@/content/legal/zile-libere";

/**
 * Numerele de zile din cerere, cu acordul românesc.
 *
 * Auditul din 8 oct 2026 a găsit în documentul de semnat „nu se numără cele 1
 * zile de weekend” și „reprezentând 250 zile lucrătoare”. Regula lui „de” (de
 * la 20 în sus, cu excepția lui 101–119, 201–219…) stă deja în `cuDe`; aici se
 * adaugă singularul și zero, pe care `cuDe` nu le tratează.
 */

/** „1 zi lucrătoare”, „5 zile lucrătoare”, „20 de zile lucrătoare”. */
export function zileLucratoareText(n: number): string {
  if (n === 0) return "nicio zi lucrătoare";
  return n === 1 ? "1 zi lucrătoare" : cuDe(n, "zile lucrătoare");
}

/** „1 zi”, „7 zile”, „30 de zile”. */
export function zileText(n: number): string {
  if (n === 0) return "0 zile";
  return n === 1 ? "1 zi" : cuDe(n, "zile");
}

/** „1 zi calendaristică”, „5 zile calendaristice”, „20 de zile calendaristice”. */
export function zileCalendaristiceText(n: number): string {
  return n === 1 ? "1 zi calendaristică" : cuDe(n, "zile calendaristice");
}

/** Ce spune cererea despre weekend: „nicio zi”, „o zi”, „cele 2 zile de weekend”. */
export function weekendText(n: number): string {
  if (n === 0) return "nicio zi de weekend";
  if (n === 1) return "o zi de weekend";
  return `cele ${cuDe(n, "zile de weekend")}`;
}

/** „nicio sărbătoare legală”, „o sărbătoare legală”, „4 sărbători legale”. */
export function sarbatoriText(n: number): string {
  if (n === 0) return "nicio sărbătoare legală";
  if (n === 1) return "o sărbătoare legală";
  return cuDe(n, "sărbători legale");
}
```

- [ ] **Pasul 4: Rulează testele, trec.** Comanda de la pasul 2, apoi lanțul complet.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/cerere-concediu-de-odihna"
git status --short -- "$D/text-zile.ts" "$D/text-zile.test.ts"
git fetch origin main
git add -- "$D/text-zile.ts" "$D/text-zile.test.ts"
git commit --only -m "$(cat <<'MSG'
feat(unelte): acordul numerelor din cererea de concediu

„cele 1 zile de weekend” și „250 zile lucrătoare” (auditul din 8 oct 2026)
devin „o zi de weekend” și „250 de zile lucrătoare”, peste cuDe din ghidul
zilelor libere.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- "$D/text-zile.ts" "$D/text-zile.test.ts"
git merge origin/main
git push origin main
```

---

### Task F7: Variantele cererii și cifrele lor legale

**Fișiere:**
- Create: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/variante.ts`
- Test: `…/variante.test.ts`
- Modify: `NOTES.md` §3, blocul `### Sărbători legale · public_holidays` (liniile 192–197)

**Interfețe:**
- Produce:
  - `export type TipCerere = "odihna" | "fara-plata" | "eveniment" | "paternal" | "ingrijitor" | "formare" | "reprogramare" | "intrerupere"`
  - `export type Varianta = Readonly<{ tip; eticheta; titlu; subtitlu; cuSold: boolean; numaraZile: boolean; temei: string }>`
  - `export const TIPURI_CERERE: readonly TipCerere[]`, `export const VARIANTE: Readonly<Record<TipCerere, Varianta>>`
  - `export function esteTipCerere(brut: string): brut is TipCerere`
  - `ZILE_PATERNAL = 10`, `ZILE_PATERNAL_PUERICULTURA = 5`, `SAPTAMANI_PATERNAL = 8`, `ZILE_INGRIJITOR = 5`, `ZILE_FORMARE_PLATITA = 10`, `ZILE_FRACTIUNE_NEINTRERUPTA = 10`, `ZILE_AVANS_CERERE_ODIHNA = 60`
  - `export type Eveniment = "casatorie-salariat" | "nastere-copil" | "casatorie-copil" | "deces" | "alt"`, `EVENIMENTE_ORDINE`, `EVENIMENTE` (cu `zileBugetar` din HG 250/1992), `esteEveniment`

Sursele au fost verificate cu curl, pe 8 oct 2026: Codul muncii (`DetaliiDocument/128647`), art. 145–158 și 139 citite integral. Legea 210/1999 (`DetaliiDocument/20488`), art. 2, 4 și 4¹. HG 250/1992 (`DetaliiDocument/2564`), art. 24.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `variante.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  esteEveniment,
  esteTipCerere,
  EVENIMENTE,
  EVENIMENTE_ORDINE,
  SAPTAMANI_PATERNAL,
  TIPURI_CERERE,
  VARIANTE,
  ZILE_AVANS_CERERE_ODIHNA,
  ZILE_FORMARE_PLATITA,
  ZILE_FRACTIUNE_NEINTRERUPTA,
  ZILE_INGRIJITOR,
  ZILE_PATERNAL,
  ZILE_PATERNAL_PUERICULTURA,
} from "./variante";

describe("variantele cererii", () => {
  it("lista și catalogul au aceleași chei, iar fiecare variantă își spune temeiul", () => {
    expect([...TIPURI_CERERE].sort()).toEqual(Object.keys(VARIANTE).sort());
    for (const tip of TIPURI_CERERE) {
      const v = VARIANTE[tip];
      expect(v.tip, tip).toBe(tip);
      expect(v.titlu, tip).toMatch(/^Cerere de /u);
      expect(v.temei, tip).toMatch(/art\. \d+/u);
      expect(v.temei.endsWith("."), tip).toBe(true);
    }
  });

  it("soldul se cere doar acolo unde cererea consumă din concediul de odihnă", () => {
    const cuSold = TIPURI_CERERE.filter((t) => VARIANTE[t].cuSold);
    expect(cuSold).toEqual(["odihna", "reprogramare"]);
  });

  it("cheile prototipului nu sunt tipuri și nici evenimente", () => {
    for (const cheie of ["constructor", "__proto__", "toString"]) {
      expect(esteTipCerere(cheie), cheie).toBe(false);
      expect(esteEveniment(cheie), cheie).toBe(false);
    }
    expect(esteTipCerere("paternal")).toBe(true);
  });

  /*
   * Fir de declanșare, nu demonstrație: cifrele sunt citite din textul legii
   * (legislatie.just.ro, 8 oct 2026), iar o schimbare a lor trebuie să treacă
   * printr-o recitire a sursei, nu printr-o corectură de cod.
   */
  it("cifrele legale sunt cele din sursă", () => {
    expect(ZILE_PATERNAL).toBe(10); // Legea 210/1999 art. 2 alin. (1)
    expect(ZILE_PATERNAL_PUERICULTURA).toBe(5); // art. 4 alin. (1)
    expect(SAPTAMANI_PATERNAL).toBe(8); // art. 2 alin. (2)
    expect(ZILE_INGRIJITOR).toBe(5); // Codul muncii art. 152¹ alin. (1)
    expect(ZILE_FORMARE_PLATITA).toBe(10); // art. 157 alin. (1)
    expect(ZILE_FRACTIUNE_NEINTRERUPTA).toBe(10); // art. 148 alin. (5)
    expect(ZILE_AVANS_CERERE_ODIHNA).toBe(60); // art. 148 alin. (4)
    expect(EVENIMENTE_ORDINE.map((e) => EVENIMENTE[e].zileBugetar)).toEqual([5, 3, 3, 3, null]);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/cerere-concediu-de-odihna/variante.test.ts"
```

Așteptat: `Failed to resolve import "./variante"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `variante.ts`:

```ts
/**
 * Variantele cererii: ce document produce fiecare și pe ce temei.
 *
 * ── TEMEIURILE, VERIFICATE PE SURSA PRIMARĂ ───────────────────────────────
 * Descărcate cu curl de pe legislatie.just.ro pe 8 oct 2026:
 *  · Codul muncii, forma consolidată (documentul 128647; cea mai recentă
 *    modificare din text: 27.04.2026) — art. 139, 145–158;
 *  · Legea nr. 210/1999 a concediului paternal (documentul 20488; ultima
 *    modificare: OUG 117/2022, la 29.08.2022, aprobată fără modificări prin
 *    Legea 196/2024) — art. 2, 4, 4¹;
 *  · HG nr. 250/1992 (documentul 2564) — art. 24, numai pentru bugetari.
 * Cifrele sunt ⚠ în NOTES.md: de confirmat de jurist înainte de calcul real.
 *
 * ── CE NU E AICI, ȘI DE CE ────────────────────────────────────────────────
 * Rechemarea din concediu (art. 151 alin. (2)) e o decizie a angajatorului,
 * cu obligația lui de a suporta cheltuielile — nu o cerere a salariatului. Un
 * model de rechemare scris de noi ar fi semnat de un patron care nu știe de
 * obligația aceea. Absentarea pentru urgență familială (art. 152²) e o
 * informare cu recuperarea orelor, nu un concediu.
 */

export type TipCerere =
  | "odihna"
  | "fara-plata"
  | "eveniment"
  | "paternal"
  | "ingrijitor"
  | "formare"
  | "reprogramare"
  | "intrerupere";

export type Varianta = Readonly<{
  tip: TipCerere;
  /** Eticheta din bara de variante a paginii. */
  eticheta: string;
  /** Titlul fișierului (metadatele PDF și Word) și al rândului din pagină. */
  titlu: string;
  /** Ce scrie sub „CERERE”. */
  subtitlu: string;
  /** Rubrica de resurse umane are rândurile de sold (doar la concediul de odihnă). */
  cuSold: boolean;
  /** Documentul spune câte zile lucrătoare consumă perioada. */
  numaraZile: boolean;
  /** Nota cu temeiul, tipărită mic la finalul documentului. */
  temei: string;
}>;

export const TIPURI_CERERE: readonly TipCerere[] = [
  "odihna",
  "fara-plata",
  "eveniment",
  "paternal",
  "ingrijitor",
  "formare",
  "reprogramare",
  "intrerupere",
];

export const VARIANTE: Readonly<Record<TipCerere, Varianta>> = {
  odihna: {
    tip: "odihna",
    eticheta: "Odihnă",
    titlu: "Cerere de concediu de odihnă",
    subtitlu: "de concediu de odihnă",
    cuSold: true,
    numaraZile: true,
    temei:
      "Sărbătorile legale în care nu se lucrează nu sunt incluse în durata concediului de odihnă — art. 145 alin. (3) din Codul muncii.",
  },
  "fara-plata": {
    tip: "fara-plata",
    eticheta: "Fără plată",
    titlu: "Cerere de concediu fără plată",
    subtitlu: "de concediu fără plată",
    cuSold: false,
    numaraZile: false,
    temei:
      "Salariații au dreptul la concedii fără plată pentru rezolvarea unor situații personale; durata se stabilește prin contractul colectiv aplicabil sau prin regulamentul intern — art. 153 din Codul muncii.",
  },
  eveniment: {
    tip: "eveniment",
    eticheta: "Eveniment familial",
    titlu: "Cerere de zile libere pentru un eveniment familial",
    subtitlu: "de zile libere plătite pentru un eveniment familial",
    cuSold: false,
    numaraZile: false,
    temei:
      "Evenimentele familiale deosebite și numărul zilelor libere plătite se stabilesc prin lege, prin contractul colectiv aplicabil sau prin regulamentul intern; zilele nu se includ în concediul de odihnă — art. 152 din Codul muncii.",
  },
  paternal: {
    tip: "paternal",
    eticheta: "Paternal",
    titlu: "Cerere de concediu paternal",
    subtitlu: "de concediu paternal",
    cuSold: false,
    numaraZile: true,
    temei:
      "Concediul paternal este de 10 zile lucrătoare, plus 5 zile cu atestatul de absolvire a cursului de puericultură, și se acordă în primele 8 săptămâni de la nașterea copilului — art. 2 alin. (1)–(2) și art. 4 din Legea nr. 210/1999; angajatorul are obligația de a-l aproba — art. 4¹ alin. (1).",
  },
  ingrijitor: {
    tip: "ingrijitor",
    eticheta: "Îngrijitor",
    titlu: "Cerere de concediu de îngrijitor",
    subtitlu: "de concediu de îngrijitor",
    cuSold: false,
    numaraZile: true,
    temei:
      "Concediul de îngrijitor este de 5 zile lucrătoare într-un an calendaristic, se acordă la solicitarea scrisă a salariatului și nu se include în concediul de odihnă — art. 152¹ alin. (1) și (3) din Codul muncii.",
  },
  formare: {
    tip: "formare",
    eticheta: "Formare profesională",
    titlu: "Cerere de concediu pentru formare profesională",
    subtitlu: "de concediu pentru formare profesională",
    cuSold: false,
    numaraZile: true,
    temei:
      "Concediul fără plată pentru formare profesională se cere cu cel puțin o lună înainte și precizează data de începere, domeniul, durata și instituția — art. 155–156 din Codul muncii; concediul plătit, de până la 10 zile lucrătoare sau 80 de ore, se acordă când angajatorul nu a asigurat formarea pe cheltuiala sa — art. 157.",
  },
  reprogramare: {
    tip: "reprogramare",
    eticheta: "Reprogramare",
    titlu: "Cerere de reprogramare a concediului de odihnă",
    subtitlu: "de reprogramare a concediului de odihnă",
    cuSold: true,
    numaraZile: true,
    temei:
      "Salariatul efectuează concediul în perioada programată, cu excepția situațiilor prevăzute de lege sau a celor în care, din motive obiective, concediul nu poate fi efectuat — art. 149 din Codul muncii.",
  },
  intrerupere: {
    tip: "intrerupere",
    eticheta: "Întrerupere",
    titlu: "Cerere de întrerupere a concediului de odihnă",
    subtitlu: "de întrerupere a concediului de odihnă",
    cuSold: false,
    numaraZile: false,
    temei:
      "Concediul de odihnă poate fi întrerupt, la cererea salariatului, pentru motive obiective — art. 151 alin. (1) din Codul muncii.",
  },
};

/** `Object.hasOwn`-ul listelor: „constructor” nu e un tip de cerere. */
export function esteTipCerere(brut: string): brut is TipCerere {
  return (TIPURI_CERERE as readonly string[]).includes(brut);
}

/** Legea 210/1999 art. 2 alin. (1). */
export const ZILE_PATERNAL = 10;
/** Legea 210/1999 art. 4 alin. (1). */
export const ZILE_PATERNAL_PUERICULTURA = 5;
/** Legea 210/1999 art. 2 alin. (2). */
export const SAPTAMANI_PATERNAL = 8;
/** Codul muncii art. 152¹ alin. (1). */
export const ZILE_INGRIJITOR = 5;
/** Codul muncii art. 157 alin. (1): „de până la 10 zile lucrătoare sau de până la 80 de ore”. */
export const ZILE_FORMARE_PLATITA = 10;
/** Codul muncii art. 148 alin. (5). */
export const ZILE_FRACTIUNE_NEINTRERUPTA = 10;
/** Codul muncii art. 148 alin. (4). */
export const ZILE_AVANS_CERERE_ODIHNA = 60;

export type Eveniment =
  "casatorie-salariat" | "nastere-copil" | "casatorie-copil" | "deces" | "alt";

export const EVENIMENTE_ORDINE: readonly Eveniment[] = [
  "casatorie-salariat",
  "nastere-copil",
  "casatorie-copil",
  "deces",
  "alt",
];

/**
 * Evenimentele din art. 24 alin. (1) din HG 250/1992, plus „alt eveniment”.
 *
 * `zileBugetar` e numărul din hotărâre, care se aplică NUMAI salariaților din
 * administrația publică, regiile autonome cu specific deosebit și unitățile
 * bugetare. Într-o firmă privată numărul îl dau contractul colectiv sau
 * regulamentul intern (art. 152 alin. (2) din Codul muncii), deci cifra nu intră
 * în document: pagina o arată ca reper, documentul scrie doar ce trece omul.
 */
export const EVENIMENTE: Readonly<
  Record<
    Eveniment,
    Readonly<{ eticheta: string; inCerere: string; act: string | null; zileBugetar: number | null }>
  >
> = {
  "casatorie-salariat": {
    eticheta: "Căsătoria mea",
    inCerere: "căsătoria mea",
    act: "certificatul de căsătorie",
    zileBugetar: 5,
  },
  "nastere-copil": {
    eticheta: "Nașterea copilului meu",
    inCerere: "nașterea copilului meu",
    act: "certificatul de naștere al copilului",
    zileBugetar: 3,
  },
  "casatorie-copil": {
    eticheta: "Căsătoria copilului meu",
    inCerere: "căsătoria copilului meu",
    act: "certificatul de căsătorie al copilului",
    zileBugetar: 3,
  },
  deces: {
    eticheta: "Decesul soțului sau al unei rude",
    inCerere: "decesul unui membru al familiei",
    act: "certificatul de deces",
    zileBugetar: 3,
  },
  alt: { eticheta: "Alt eveniment", inCerere: "", act: null, zileBugetar: null },
};

export function esteEveniment(brut: string): brut is Eveniment {
  return (EVENIMENTE_ORDINE as readonly string[]).includes(brut);
}
```

În `NOTES.md`, blocul vechi:

```markdown
⚠️ Lista zilelor fixe și a celor mobile (offset față de **Paștele ortodox**, nu
cel catolic). Lista **s-a modificat prin lege** de mai multe ori: 6 și 7 ianuarie
au fost adăugate în 2016, Vinerea Mare în 2018. Se adaugă și zilele pentru
salariații aparținând altor culte religioase legale.

### Diurne · `per_diem_policies`, `per_diem_country_rates`
```

devine:

```markdown
⚠️ Lista zilelor fixe și a celor mobile (offset față de **Paștele ortodox**, nu
cel catolic). Lista **s-a modificat prin lege** de mai multe ori: 6 și 7 ianuarie
au fost adăugate prin Legea 52/2023, în vigoare de la 09.03.2023 (verificat pe
legislatie.just.ro, documentul 128647, 8 oct 2026), Vinerea Mare în 2018. Se
adaugă și zilele pentru salariații aparținând altor culte religioase legale.

### Unealta publică „Cerere de concediu” · `unelte/cerere-concediu-de-odihna/variante.ts`

⚠️ Valorile scrise în documentul generat, verificate pe 8 oct 2026 pe formele
consolidate de pe legislatie.just.ro, de confirmat de jurist: concediul paternal
de 10 zile lucrătoare + 5 cu atestatul de puericultură, în primele 8 săptămâni
de la naștere (Legea 210/1999 art. 2 și 4, documentul 20488, ultima modificare
OUG 117/2022, aprobată prin Legea 196/2024) · concediul de îngrijitor de 5 zile
lucrătoare pe an (art. 152¹ CM) · concediul plătit pentru formare de până la 10
zile lucrătoare sau 80 de ore (art. 157 CM) · fracțiunea de 10 zile lucrătoare
neîntrerupte (art. 148 alin. (5) CM) · zilele pentru evenimente din HG 250/1992
art. 24 (5/3/3), afișate doar ca REPER pentru bugetari · interpretarea art. 139
alin. (2¹) și (3¹): salariatul de alt cult creștin primește Vinerea Mare,
Paștele și Rusaliile la datele cultului, ÎN LOCUL celor ortodoxe, deci unealta
numără datele ortodoxe ca zile lucrătoare pentru el.

**Fără regulă legală:** proporția „drept ÷ 12 × lunile lucrate” din
`/unelte/calculator-zile-concediu` — practică, nu articol (ca la `leave_types`).

### Diurne · `per_diem_policies`, `per_diem_country_rates`
```

- [ ] **Pasul 4: Rulează testele, trec.** Comanda de la pasul 2, apoi lanțul complet.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/cerere-concediu-de-odihna"
git status --short -- "$D/variante.ts" "$D/variante.test.ts" NOTES.md
git fetch origin main
git diff --name-only HEAD origin/main -- NOTES.md
git add -- "$D/variante.ts" "$D/variante.test.ts"
git commit --only -m "$(cat <<'MSG'
feat(unelte): cele opt variante ale cererii de concediu, cu temeiul fiecăreia

Odihnă, fără plată, eveniment, paternal (Legea 210/1999), îngrijitor (art.
152¹), formare (art. 155–157), reprogramare (art. 149), întrerupere (art. 151).
Cifrele, citite pe legislatie.just.ro pe 8 oct 2026, sunt ⚠ în NOTES.md.
Rechemarea rămâne pe dinafară: e decizia angajatorului, nu o cerere.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- "$D/variante.ts" "$D/variante.test.ts" NOTES.md
git merge origin/main
git push origin main
```

---

### Task F8: Modelul scrisorii și așezarea ei pe pagină

**Fișiere:**
- Create: `src/lib/unelte/scrisoare.ts`, `src/lib/unelte/scrisoare-asezare.ts`
- Test: `src/lib/unelte/scrisoare.test.ts`

**Interfețe:**
- Consumă: `type Format` din `./document-tabelar`, `faraCaractereDeControl` (F3). Testul compară cu `LATIME_A4`/`INALTIME_A4` din `@/lib/pdf/document`.
- Produce (`scrisoare.ts`):
  - `export type RubricaAngajator = Readonly<{ titlu: string; randuri: readonly string[]; semnaturi: readonly string[] }>`
  - `export type Scrisoare = Readonly<{ titluDocument; inregistrare; catre; titlu; subtitlu: string | null; paragrafe: readonly string[]; locSiData; semnatura; rubrica: RubricaAngajator | null; note: readonly string[]; numeFisier; sursa }>`
  - `export function adresaScrisoare(s: Pick<Scrisoare, "sursa">, format: Format, site: string): string`
  - `export function curataScrisoarea(s: Scrisoare): Scrisoare`
- Produce (`scrisoare-asezare.ts`): `LATIME_PAGINA`, `INALTIME_PAGINA`, `MARGINE_SCRISOARE = 57`, `REZERVA_SUBSOL`, `type Masoara = (text: string, marime: number, aldin: boolean) => number`, `type OperatieText`, `type OperatieLinie`, `type Operatie`, `type PaginaAsezata`, `export function rupe(text: string, latime: number, masoara: (t: string) => number): string[]`, `export function asezaScrisoarea(s: Scrisoare, masoara: Masoara): readonly PaginaAsezata[]`

`scrisoare.ts` nu importă nimic `server-only`, fiindcă îl citește și componenta HTML (F11), testată în proiectul `ui`, fără aliasul pentru `server-only`.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/lib/unelte/scrisoare.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { INALTIME_A4, LATIME_A4 } from "@/lib/pdf/document";

import { adresaScrisoare, curataScrisoarea, type Scrisoare } from "./scrisoare";
import {
  asezaScrisoarea,
  INALTIME_PAGINA,
  LATIME_PAGINA,
  MARGINE_SCRISOARE,
  rupe,
  type Operatie,
  type OperatieText,
} from "./scrisoare-asezare";

/** Măsura falsă: lățimea crește cu numărul de litere și cu mărimea. */
const masoara = (t: string, marime: number, aldin: boolean) =>
  Array.from(t).length * marime * (aldin ? 0.6 : 0.5);

const SCRISOARE: Scrisoare = {
  titluDocument: "Cerere de concediu de odihnă",
  inregistrare: "Nr. înregistrare ________ din ____________",
  catre: "Către: Exemplu SRL",
  titlu: "CERERE",
  subtitlu: "de concediu de odihnă",
  paragrafe: [
    "Subsemnatul/Subsemnata Ilie Maria, angajat(ă) în funcția de contabil, vă rog să binevoiți a-mi aproba efectuarea concediului de odihnă aferent anului 2026, în perioada 21.12.2026 – 31.12.2026 inclusiv, reprezentând 8 zile lucrătoare.",
    "Menționez că în intervalul solicitat nu se numără cele 2 zile de weekend și nici sărbătorile legale: 25.12.2026 (Crăciunul).",
  ],
  locSiData: "Arad, 02.10.2026",
  semnatura: "Semnătura salariatului",
  rubrica: {
    titlu: "Se completează de angajator",
    randuri: [
      "☐ Se aprobă / ☐ Nu se aprobă",
      "Zile de concediu de odihnă cuvenite pentru anul 2026: ________",
      "Zile rămase din anul anterior: ________",
      "Zile efectuate până la data cererii: ________",
      "Zile rămase după această cerere: ________",
    ],
    semnaturi: ["Șef ierarhic", "Resurse umane", "Conducătorul unității"],
  },
  note: [
    "Sărbătorile legale în care nu se lucrează nu sunt incluse în durata concediului de odihnă — art. 145 alin. (3) din Codul muncii.",
  ],
  numeFisier: "cerere-odihna-2026-12-21",
  sursa: "/unelte/cerere-concediu-de-odihna",
};

const texte = (pagini: readonly (readonly Operatie[])[]): OperatieText[] =>
  pagini.flat().filter((o): o is OperatieText => o.tip === "text");

function gaseste(
  lista: readonly OperatieText[],
  cauta: (o: OperatieText) => boolean,
): OperatieText {
  const gasit = lista.find(cauta);
  if (gasit === undefined) throw new Error("Operația căutată lipsește din așezare.");
  return gasit;
}

describe("așezarea scrisorii", () => {
  it("constantele A4 sunt aceleași cu ale stratului PDF", () => {
    expect(LATIME_PAGINA).toBe(LATIME_A4);
    expect(INALTIME_PAGINA).toBe(INALTIME_A4);
  });

  it("„CERERE” e centrat, „Către” e la dreapta, locul și data la stânga", () => {
    const t = texte(asezaScrisoarea(SCRISOARE, masoara));
    const titlu = gaseste(t, (o) => o.text === "CERERE");
    expect(titlu.x + masoara("CERERE", titlu.marime, titlu.aldin) / 2).toBeCloseTo(
      LATIME_PAGINA / 2,
      5,
    );
    const catre = gaseste(t, (o) => o.text.startsWith("Către"));
    expect(catre.x + masoara(catre.text, catre.marime, catre.aldin)).toBeCloseTo(
      LATIME_PAGINA - MARGINE_SCRISOARE,
      5,
    );
    expect(gaseste(t, (o) => o.text.startsWith("Arad")).x).toBe(MARGINE_SCRISOARE);
  });

  it("semnătura salariatului stă pe aceeași linie cu locul și data", () => {
    const t = texte(asezaScrisoarea(SCRISOARE, masoara));
    expect(gaseste(t, (o) => o.text === "Semnătura salariatului").y).toBe(
      gaseste(t, (o) => o.text.startsWith("Arad")).y,
    );
  });

  it("o cerere obișnuită încape pe o pagină, cu rubrica angajatorului întreagă", () => {
    const pagini = asezaScrisoarea(SCRISOARE, masoara);
    expect(pagini).toHaveLength(1);
    const t = texte(pagini).map((o) => o.text);
    expect(t).toContain("☐ Se aprobă / ☐ Nu se aprobă");
    for (const s of ["Șef ierarhic", "Resurse umane", "Conducătorul unității"]) {
      expect(t).toContain(s);
    }
  });

  it("nimic nu iese din margini, nici cu un nume de 120 de litere fără spațiu", () => {
    const lung: Scrisoare = {
      ...SCRISOARE,
      catre: `Către: ${"Ă".repeat(120)}`,
      paragrafe: [`Subsemnatul ${"Ș".repeat(120)}, vă rog.`],
      locSiData: `${"Ț".repeat(60)}, 02.10.2026`,
    };
    for (const o of texte(asezaScrisoarea(lung, masoara))) {
      expect(o.x, o.text).toBeGreaterThanOrEqual(MARGINE_SCRISOARE - 1e-6);
      expect(o.x + masoara(o.text, o.marime, o.aldin), o.text).toBeLessThanOrEqual(
        LATIME_PAGINA - MARGINE_SCRISOARE + 1e-6,
      );
    }
  });

  it("un text uriaș trece pe pagina următoare, fără să coboare sub margine", () => {
    const pagini = asezaScrisoarea({ ...SCRISOARE, paragrafe: ["cuvânt ".repeat(1500)] }, masoara);
    expect(pagini.length).toBeGreaterThan(1);
    for (const o of pagini.flat()) {
      const y = o.tip === "text" ? o.y : Math.min(o.y1, o.y2);
      expect(y).toBeGreaterThanOrEqual(MARGINE_SCRISOARE);
    }
  });
});

describe("ruperea în rânduri", () => {
  const m = (t: string) => Array.from(t).length * 5;

  it("rupe pe cuvinte, fără să piardă nimic", () => {
    const text = "Subsemnatul Popa Ion vă rog să binevoiți a aproba concediul de odihnă";
    const randuri = rupe(text, 100, m);
    expect(randuri.length).toBeGreaterThan(1);
    expect(randuri.join(" ")).toBe(text);
    for (const r of randuri) expect(m(r)).toBeLessThanOrEqual(100);
  });

  it("un cuvânt mai lung decât rândul se rupe pe litere, nu se taie", () => {
    const randuri = rupe("a".repeat(65), 100, m);
    expect(randuri.join("")).toBe("a".repeat(65));
    for (const r of randuri) expect(m(r)).toBeLessThanOrEqual(100);
  });
});

describe("modelul scrisorii", () => {
  it("adresa din subsol duce la pagina uneltei, cu UTM", () => {
    expect(adresaScrisoare(SCRISOARE, "pdf", "https://administrativo.ro")).toBe(
      "https://administrativo.ro/unelte/cerere-concediu-de-odihna?utm_source=fisier&utm_medium=pdf&utm_campaign=unelte",
    );
  });

  it("curățarea scoate caracterele de control din fiecare câmp", () => {
    const murdar: Scrisoare = {
      ...SCRISOARE,
      catre: "Către: A\u000BB",
      paragrafe: ["x\u0001y"],
      rubrica: { titlu: "t\u001F", randuri: ["r\u000C"], semnaturi: ["s\u0000"] },
    };
    const curat = JSON.stringify(curataScrisoarea(murdar));
    expect(curat).not.toMatch(/\\u000[0-9a-f]|\\u001[0-9a-f]/u);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/scrisoare.test.ts
```

Așteptat: `Failed to resolve import "./scrisoare"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `src/lib/unelte/scrisoare.ts`:

```ts
import type { Format } from "./document-tabelar";
import { faraCaractereDeControl } from "./text-curat";

/**
 * O cerere scrisă ca scrisoare: „Către” în dreapta, „CERERE” centrat, corpul,
 * locul și data în stânga, semnătura în dreapta, iar jos rubrica angajatorului.
 *
 * ── DE CE NU `DocumentTabelar` ─────────────────────────────────────────────
 * `DocumentTabelar` e un formular: titlu la stânga, câmpuri, tabel. Pe el,
 * PDF-ul cererii ieșea cu titlul aliniat la stânga, „Către” gri la 9 pt și
 * locul și data gri la 8 pt, în timp ce previzualizarea arăta o cerere clasică
 * (auditul din 8 oct 2026). Un model propriu, citit de toate trei randările
 * (HTML, PDF, Word), închide diferența: ce e pe ecran e ce se descarcă.
 */
export type RubricaAngajator = Readonly<{
  titlu: string;
  /** Rânduri de completat de angajator: decizia, apoi soldul. */
  randuri: readonly string[];
  /** Semnăturile de aprobare, de la stânga la dreapta. */
  semnaturi: readonly string[];
}>;

export type Scrisoare = Readonly<{
  /** Titlul fișierului, în metadatele PDF și Word. */
  titluDocument: string;
  /** Rândul de înregistrare din colțul din stânga sus. */
  inregistrare: string;
  /** „Către: Firma SRL”, aliniat la dreapta. */
  catre: string;
  /** „CERERE”, centrat. */
  titlu: string;
  /** Ce fel de cerere, sub titlu. */
  subtitlu: string | null;
  paragrafe: readonly string[];
  /** „Arad, 08.10.2026”, în stânga. */
  locSiData: string;
  /** Eticheta semnăturii, în dreapta, deasupra liniei. */
  semnatura: string;
  rubrica: RubricaAngajator | null;
  /** Temeiul, tipărit mic la final. */
  note: readonly string[];
  /** Fără extensie; trece prin `numeFisierSigur`. */
  numeFisier: string;
  /** Pagina uneltei, fără domeniu; subsolul fișierului duce acolo. */
  sursa: string;
}>;

/**
 * Adresa din subsolul fișierului. Aceiași parametri UTM ca `adresaDinFisier`
 * din `document-tabelar.ts`, care însă cere un `DocumentTabelar` întreg.
 */
export function adresaScrisoare(s: Pick<Scrisoare, "sursa">, format: Format, site: string): string {
  const parametri = new URLSearchParams({
    utm_source: "fisier",
    utm_medium: format,
    utm_campaign: "unelte",
  });
  return `${site}${s.sursa}?${parametri.toString()}`;
}

/**
 * Ultima curățare înainte de randare. Câmpurile sunt deja normalizate de
 * unealtă; asta e plasa pentru orice text adăugat în model fără să treacă pe
 * acolo — un singur U+000B face Word-ul de nedeschis.
 */
export function curataScrisoarea(s: Scrisoare): Scrisoare {
  const c = faraCaractereDeControl;
  return {
    ...s,
    titluDocument: c(s.titluDocument),
    inregistrare: c(s.inregistrare),
    catre: c(s.catre),
    titlu: c(s.titlu),
    subtitlu: s.subtitlu === null ? null : c(s.subtitlu),
    paragrafe: s.paragrafe.map(c),
    locSiData: c(s.locSiData),
    semnatura: c(s.semnatura),
    rubrica:
      s.rubrica === null
        ? null
        : {
            titlu: c(s.rubrica.titlu),
            randuri: s.rubrica.randuri.map(c),
            semnaturi: s.rubrica.semnaturi.map(c),
          },
    note: s.note.map(c),
  };
}
```

și `src/lib/unelte/scrisoare-asezare.ts`:

```ts
import type { Scrisoare } from "./scrisoare";

/**
 * Așezarea unei `Scrisoare` pe pagini A4, ca listă de operații de desen.
 *
 * ── DE CE SEPARAT DE PDF ───────────────────────────────────────────────────
 * `pdf-lib` desenează la coordonate absolute și nu are flux de text. Dacă
 * geometria ar sta în randare, singurul test posibil ar fi „PDF-ul se
 * deschide” — nu și „«CERERE» e centrat” sau „nimic nu iese din margine”.
 * Aici geometria e o funcție pură, cu măsurarea textului injectată: testele o
 * verifică cu o măsură falsă și cu fontul real, iar randarea doar execută.
 *
 * Constantele A4 sunt scrise aici, nu importate din `src/lib/pdf/document.ts`:
 * acela e `server-only`. Un test le compară.
 */

/** A4 portret, în puncte PostScript. */
export const LATIME_PAGINA = 595.28;
export const INALTIME_PAGINA = 841.89;
/** 2 cm, marginea obișnuită a unei scrisori. */
export const MARGINE_SCRISOARE = 57;
/** Locul păstrat jos pentru rândul cu legătura spre unealtă. */
export const REZERVA_SUBSOL = 28;

export type Masoara = (text: string, marime: number, aldin: boolean) => number;

export type OperatieText = Readonly<{
  tip: "text";
  text: string;
  x: number;
  /** Linia de bază. */
  y: number;
  marime: number;
  aldin: boolean;
  /** Gri: notele și etichetele semnăturilor. */
  slab: boolean;
}>;
export type OperatieLinie = Readonly<{
  tip: "linie";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}>;
export type Operatie = OperatieText | OperatieLinie;
export type PaginaAsezata = readonly Operatie[];

const CORP = 11;
const INTERLINIE = 1.45;
/** Lățimea coloanei semnăturii salariatului, în dreapta. */
const COLOANA_SEMNATURA = 170;

/**
 * Rupe textul pe cuvinte, în rânduri care încap în `latime`. Un cuvânt mai lat
 * decât rândul se rupe pe litere, pe mai multe rânduri — nu se taie cu „…”:
 * într-o cerere de semnat, un nume trunchiat e mai rău decât unul rupt.
 * Literele se numără ca puncte de cod, ca un emoji să nu fie tăiat în două.
 */
export function rupe(text: string, latime: number, masoara: (t: string) => number): string[] {
  const randuri: string[] = [];
  let curent = "";
  for (const cuvant of text.split(/\s+/u).filter((c) => c !== "")) {
    const incercare = curent === "" ? cuvant : `${curent} ${cuvant}`;
    if (masoara(incercare) <= latime) {
      curent = incercare;
      continue;
    }
    if (curent !== "") randuri.push(curent);
    let litere = Array.from(cuvant);
    while (litere.length > 0 && masoara(litere.join("")) > latime) {
      // Cel mai lung prefix care încape, prin căutare binară (ca `taie` din pdf.ts).
      let jos = 1;
      let sus = litere.length;
      while (jos < sus) {
        const mijloc = Math.ceil((jos + sus) / 2);
        if (masoara(litere.slice(0, mijloc).join("")) <= latime) jos = mijloc;
        else sus = mijloc - 1;
      }
      randuri.push(litere.slice(0, jos).join(""));
      litere = litere.slice(jos);
    }
    curent = litere.join("");
  }
  if (curent !== "") randuri.push(curent);
  return randuri.length > 0 ? randuri : [""];
}

type Aliniere = "stanga" | "dreapta" | "centru";

export function asezaScrisoarea(s: Scrisoare, masoara: Masoara): readonly PaginaAsezata[] {
  const latimePagina = LATIME_PAGINA;
  const margine = MARGINE_SCRISOARE;
  const util = latimePagina - 2 * margine;
  let pagina: Operatie[] = [];
  const pagini: Operatie[][] = [pagina];
  let y = INALTIME_PAGINA - margine;

  const paginaNoua = () => {
    pagina = [];
    pagini.push(pagina);
    y = INALTIME_PAGINA - margine;
  };
  const asigura = (necesar: number) => {
    if (y - necesar < margine + REZERVA_SUBSOL) paginaNoua();
  };
  const coboara = (puncte: number) => {
    y -= puncte;
  };

  /** Un text rupt pe rânduri: fiecare rând coboară întâi, apoi se scrie pe linia de bază. */
  const bloc = (
    text: string,
    marime: number,
    aliniere: Aliniere,
    optiuni: Readonly<{ aldin?: boolean; slab?: boolean; x?: number; latime?: number }> = {},
  ) => {
    const aldin = optiuni.aldin ?? false;
    const slab = optiuni.slab ?? false;
    const x0 = optiuni.x ?? margine;
    const latime = optiuni.latime ?? util;
    const pas = marime * INTERLINIE;
    for (const rand of rupe(text, latime, (t) => masoara(t, marime, aldin))) {
      asigura(pas);
      y -= pas;
      const w = masoara(rand, marime, aldin);
      const x =
        aliniere === "stanga"
          ? x0
          : aliniere === "dreapta"
            ? x0 + latime - w
            : x0 + (latime - w) / 2;
      pagina.push({ tip: "text", text: rand, x, y, marime, aldin, slab });
    }
  };

  bloc(s.inregistrare, 10, "stanga");
  coboara(4);
  bloc(s.catre, CORP, "dreapta", { x: margine + util * 0.4, latime: util * 0.6 });
  coboara(36);
  bloc(s.titlu, 16, "centru", { aldin: true });
  if (s.subtitlu !== null) bloc(s.subtitlu, CORP, "centru");
  coboara(20);
  for (const p of s.paragrafe) {
    bloc(p, CORP, "stanga");
    coboara(8);
  }

  // Locul și data în stânga, semnătura în dreapta, pe aceeași linie de bază.
  coboara(24);
  asigura(CORP * INTERLINIE * 3 + 40);
  const xSemnatura = latimePagina - margine - COLOANA_SEMNATURA;
  const yRand = y;
  bloc(s.locSiData, CORP, "stanga", { latime: xSemnatura - margine - 12 });
  const yDupaLoc = y;
  y = yRand;
  bloc(s.semnatura, CORP, "centru", { x: xSemnatura, latime: COLOANA_SEMNATURA });
  coboara(30);
  pagina.push({ tip: "linie", x1: xSemnatura, y1: y, x2: latimePagina - margine, y2: y });
  y = Math.min(y, yDupaLoc);

  if (s.rubrica !== null) {
    const r = s.rubrica;
    coboara(30);
    // Rubrica se ține pe o singură pagină: titlul, rândurile și semnăturile.
    asigura(10 * INTERLINIE * (r.randuri.length + 1) + 70);
    pagina.push({ tip: "linie", x1: margine, y1: y, x2: latimePagina - margine, y2: y });
    coboara(6);
    bloc(r.titlu, 10, "stanga", { aldin: true });
    coboara(2);
    for (const rand of r.randuri) bloc(rand, 10, "stanga");
    if (r.semnaturi.length > 0) {
      coboara(40);
      const lat = util / r.semnaturi.length;
      const yLinie = y;
      let yMinim = y;
      r.semnaturi.forEach((eticheta, i) => {
        const x = margine + i * lat;
        pagina.push({ tip: "linie", x1: x, y1: yLinie, x2: x + lat - 18, y2: yLinie });
        y = yLinie;
        bloc(eticheta, 9, "stanga", { x, latime: lat - 18, slab: true });
        yMinim = Math.min(yMinim, y);
      });
      y = yMinim;
    }
  }

  if (s.note.length > 0) {
    coboara(16);
    for (const n of s.note) bloc(n, 8, "stanga", { slab: true });
  }

  return pagini;
}
```

- [ ] **Pasul 4: Rulează testele, trec.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/
```

Apoi lanțul complet.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
F="src/lib/unelte/scrisoare.ts src/lib/unelte/scrisoare-asezare.ts src/lib/unelte/scrisoare.test.ts"
git status --short -- $F
git fetch origin main
git diff --name-only HEAD origin/main -- src/lib/unelte/
git add -- $F
git commit --only -m "$(cat <<'MSG'
feat(unelte): modelul de scrisoare și așezarea lui pe A4, ca funcție pură

Cererea e o scrisoare, nu un formular: „Către” la dreapta, „CERERE” centrat,
loc și dată la stânga, semnătura la dreapta, rubrica angajatorului jos.
Geometria e pură, cu măsurarea injectată, ca alinierea să se poată testa.
Cuvintele prea lungi se rup pe litere, nu se taie cu „…”.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- $F
git merge origin/main
git push origin main
```

---

### Task F9: Scrisoarea în PDF și în Word

**Fișiere:**
- Create: `src/lib/unelte/scrisoare-pdf.ts`, `src/lib/unelte/scrisoare-docx.ts`
- Test: `src/lib/unelte/scrisoare-randari.test.ts`

**Interfețe:**
- Consumă: `pornesteDocument`, `GRI`, `NEGRU` din `@/lib/pdf/document`, `ADRESA_SITE` din `@/content/landing/contact`, `SEMNATURA_FISIER` din `./document-tabelar`, plus F8.
- Produce: `export async function randeazaScrisoarePdf(s: Scrisoare): Promise<Uint8Array>` (`server-only`), `export async function randeazaScrisoareDocx(s: Scrisoare): Promise<Uint8Array>`.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/lib/unelte/scrisoare-randari.test.ts`:

```ts
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { pornesteDocument } from "@/lib/pdf/document";

import { SEMNATURA_FISIER } from "./document-tabelar";
import type { Scrisoare } from "./scrisoare";
import {
  asezaScrisoarea,
  LATIME_PAGINA,
  MARGINE_SCRISOARE,
  type OperatieText,
} from "./scrisoare-asezare";
import { randeazaScrisoareDocx } from "./scrisoare-docx";
import { randeazaScrisoarePdf } from "./scrisoare-pdf";

const S: Scrisoare = {
  titluDocument: "Cerere de concediu de odihnă",
  inregistrare: "Nr. înregistrare ________ din ____________",
  catre: "Către: Ștefan Țepeș SRL",
  titlu: "CERERE",
  subtitlu: "de concediu de odihnă",
  paragrafe: [
    "Subsemnatul/Subsemnata Popa\u000BIon, angajat(ă) în funcția de operator, vă rog să binevoiți a-mi aproba efectuarea concediului de odihnă aferent anului 2026, în perioada 16.11.2026 – 20.11.2026 inclusiv, reprezentând 5 zile lucrătoare.",
  ],
  locSiData: "Arad, 08.10.2026",
  semnatura: "Semnătura salariatului",
  rubrica: {
    titlu: "Se completează de angajator",
    randuri: ["☐ Se aprobă / ☐ Nu se aprobă", "Zile rămase după această cerere: ________"],
    semnaturi: ["Șef ierarhic", "Resurse umane", "Conducătorul unității"],
  },
  note: ["Temeiul — art. 145 alin. (3) din Codul muncii."],
  numeFisier: "cerere-odihna-2026-11-16",
  sursa: "/unelte/cerere-concediu-de-odihna",
};

const TINTA = /\/unelte\/cerere-concediu-de-odihna\?utm_source=fisier&(amp;)?utm_medium=/u;

/** Paragraful Word care conține textul dat. */
const paragraful = (xml: string, text: string) =>
  xml.split("</w:p>").find((p) => p.includes(text)) ?? "";

describe("scrisoarea în PDF", () => {
  it("o pagină A4 portret", async () => {
    const pdf = await PDFDocument.load(await randeazaScrisoarePdf(S));
    expect(pdf.getPageCount()).toBe(1);
    const pagina = pdf.getPage(0);
    expect(pagina.getHeight()).toBeGreaterThan(pagina.getWidth());
  });

  it("subsolul duce la pagina uneltei, nu la slug-ul API-ului", async () => {
    const pdf = await PDFDocument.load(await randeazaScrisoarePdf(S));
    const text = new TextDecoder("latin1").decode(await pdf.save({ useObjectStreams: false }));
    expect(text).toMatch(/\/S \/URI/u);
    expect(text).toMatch(TINTA);
  });

  it("un caracter pe care fontul nu-l are (emoji) nu oprește documentul", async () => {
    const pdf = await PDFDocument.load(
      await randeazaScrisoarePdf({ ...S, paragrafe: ["Subsemnata Ana 😀, vă rog."] }),
    );
    expect(pdf.getPageCount()).toBe(1);
  });

  it("cu fontul real și câmpurile la plafon, nimic nu iese din margini", async () => {
    // Testul cu măsura falsă nu vede lățimile DejaVu; ăsta le vede.
    const { fonturi } = await pornesteDocument("sondă", "test");
    const masoara = (t: string, marime: number, aldin: boolean) =>
      (aldin ? fonturi.aldin : fonturi.normal).widthOfTextAtSize(t, marime);
    const plafon: Scrisoare = {
      ...S,
      catre: `Către: ${"Ș".repeat(120)}`,
      paragrafe: [`Subsemnatul ${"Ă".repeat(120)}, având funcția de ${"W".repeat(80)}.`],
      locSiData: `${"Ț".repeat(60)}, 08.10.2026`,
    };
    const pagini = asezaScrisoarea(plafon, masoara);
    expect(pagini).toHaveLength(1);
    for (const o of pagini.flat().filter((x): x is OperatieText => x.tip === "text")) {
      expect(o.x, o.text).toBeGreaterThanOrEqual(MARGINE_SCRISOARE - 1e-6);
      expect(o.x + masoara(o.text, o.marime, o.aldin), o.text).toBeLessThanOrEqual(
        LATIME_PAGINA - MARGINE_SCRISOARE + 1e-6,
      );
    }
  });
});

describe("scrisoarea în Word", () => {
  it("„Către” la dreapta, titlul centrat, corpul justificat", async () => {
    const zip = await JSZip.loadAsync(await randeazaScrisoareDocx(S));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(paragraful(xml, "Către: Ștefan Țepeș SRL")).toContain('<w:jc w:val="right"/>');
    expect(paragraful(xml, ">CERERE<")).toContain('<w:jc w:val="center"/>');
    expect(paragraful(xml, "Subsemnatul")).toContain('<w:jc w:val="both"/>');
  });

  it("rândul de marketing stă în subsolul paginii, nu în corpul semnat", async () => {
    const zip = await JSZip.loadAsync(await randeazaScrisoareDocx(S));
    expect((await zip.file("word/document.xml")?.async("string")) ?? "").not.toContain(
      SEMNATURA_FISIER,
    );
    expect((await zip.file("word/footer1.xml")?.async("string")) ?? "").toContain(SEMNATURA_FISIER);
    expect((await zip.file("word/_rels/footer1.xml.rels")?.async("string")) ?? "").toMatch(TINTA);
  });

  it("niciun caracter de control nu ajunge în XML", async () => {
    const zip = await JSZip.loadAsync(await randeazaScrisoareDocx(S));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("Popa Ion");
    for (const caracter of xml) {
      const cod = caracter.codePointAt(0) ?? 0;
      expect(
        cod >= 0x20 || cod === 0x09 || cod === 0x0a || cod === 0x0d,
        `U+${cod.toString(16)}`,
      ).toBe(true);
    }
  });

  it("rubrica angajatorului are decizia și cele trei semnături", async () => {
    const zip = await JSZip.loadAsync(await randeazaScrisoareDocx(S));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    for (const t of [
      "☐ Se aprobă / ☐ Nu se aprobă",
      "Șef ierarhic",
      "Resurse umane",
      "Conducătorul unității",
    ]) {
      expect(xml, t).toContain(t);
    }
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/scrisoare-randari.test.ts
```

Așteptat: `Failed to resolve import "./scrisoare-docx"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `src/lib/unelte/scrisoare-pdf.ts`:

```ts
import "server-only";

import { PDFName, PDFString } from "pdf-lib";

import { ADRESA_SITE } from "@/content/landing/contact";
import { GRI, NEGRU, pornesteDocument } from "@/lib/pdf/document";

import { SEMNATURA_FISIER } from "./document-tabelar";
import { adresaScrisoare, curataScrisoarea, type Scrisoare } from "./scrisoare";
import {
  asezaScrisoarea,
  INALTIME_PAGINA,
  LATIME_PAGINA,
  MARGINE_SCRISOARE,
} from "./scrisoare-asezare";

/**
 * `Scrisoare` → PDF. Geometria vine din `asezaScrisoarea`; aici doar se
 * desenează, cu fontul DejaVu încorporat (cele 14 fonturi standard PDF n-au
 * „ș”/„ț” cu virgulă).
 *
 * Rândul „Generat gratuit cu administrativo.ro” stă în marginea de jos a
 * ultimei pagini, la 7 pt, sub rubrica angajatorului — în afara textului care
 * se semnează. Decizia e scrisă în planul din 8 oct 2026, secțiunea F.
 */
export async function randeazaScrisoarePdf(intrare: Scrisoare): Promise<Uint8Array> {
  const s = curataScrisoarea(intrare);
  const { doc, fonturi } = await pornesteDocument(s.titluDocument, "Administrativo");
  const font = (aldin: boolean) => (aldin ? fonturi.aldin : fonturi.normal);

  // Memorizat: fiecare măsurătoare e o așezare OpenType completă.
  const masurate = new Map<string, number>();
  const masoara = (text: string, marime: number, aldin: boolean): number => {
    const cheie = `${aldin ? "a" : "n"}${String(marime)}|${text}`;
    let latime = masurate.get(cheie);
    if (latime === undefined) {
      latime = font(aldin).widthOfTextAtSize(text, marime);
      masurate.set(cheie, latime);
    }
    return latime;
  };

  const pagini = asezaScrisoarea(s, masoara).map((operatii) => {
    const pagina = doc.addPage([LATIME_PAGINA, INALTIME_PAGINA]);
    for (const op of operatii) {
      if (op.tip === "text") {
        pagina.drawText(op.text, {
          x: op.x,
          y: op.y,
          size: op.marime,
          font: font(op.aldin),
          color: op.slab ? GRI : NEGRU,
        });
      } else {
        pagina.drawLine({
          start: { x: op.x1, y: op.y1 },
          end: { x: op.x2, y: op.y2 },
          thickness: 0.6,
          color: GRI,
        });
      }
    }
    return pagina;
  });

  const ultima = pagini.at(-1);
  if (ultima !== undefined) {
    const y = MARGINE_SCRISOARE / 2;
    ultima.drawText(SEMNATURA_FISIER, {
      x: MARGINE_SCRISOARE,
      y,
      size: 7,
      font: fonturi.normal,
      color: GRI,
    });
    // Legătura: adnotare `Link` cu acțiune `URI` peste text (ISO 32000, 12.5.6.5),
    // ca în `pdf.ts` — `pdf-lib` n-are un API pentru ea.
    const latimeText = fonturi.normal.widthOfTextAtSize(SEMNATURA_FISIER, 7);
    const legatura = doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [MARGINE_SCRISOARE, y - 2, MARGINE_SCRISOARE + latimeText, y + 8],
        Border: [0, 0, 0],
        A: { Type: "Action", S: "URI", URI: PDFString.of(adresaScrisoare(s, "pdf", ADRESA_SITE)) },
      }),
    );
    ultima.node.set(PDFName.of("Annots"), doc.context.obj([legatura]));
  }

  return doc.save();
}
```

și `src/lib/unelte/scrisoare-docx.ts`:

```ts
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from "docx";

import { ADRESA_SITE } from "@/content/landing/contact";

import { SEMNATURA_FISIER } from "./document-tabelar";
import { adresaScrisoare, curataScrisoarea, type Scrisoare } from "./scrisoare";

/**
 * `Scrisoare` → .docx, cu același aspect ca previzualizarea și PDF-ul.
 *
 * Mărimile în `docx` sunt în jumătăți de punct (22 = 11 pt); distanțele în
 * twips (567 = 1 cm). Marginile sunt de 2 cm, ca în PDF, deci lățimea utilă a
 * unui A4 (11.906 twips) e 9.638 — acolo stă oprirea de tabulator din dreapta.
 *
 * Rândul „Generat gratuit cu administrativo.ro” e în SUBSOLUL paginii, nu în
 * corp: nu face parte din textul care se semnează, iar cine nu-l vrea îl
 * șterge din subsol fără să atingă cererea.
 */
const MARGINE_TWIPS = 1134;
const LATIME_UTILA_TWIPS = 11906 - 2 * MARGINE_TWIPS;
const ALINIERE = {
  stanga: AlignmentType.LEFT,
  dreapta: AlignmentType.RIGHT,
  centru: AlignmentType.CENTER,
} as const;

type OptiuniRand = Readonly<{
  aliniere?: keyof typeof ALINIERE;
  marime?: number;
  aldin?: boolean;
  slab?: boolean;
  inainte?: number;
  dupa?: number;
}>;

function rand(text: string, o: OptiuniRand = {}): Paragraph {
  return new Paragraph({
    alignment: ALINIERE[o.aliniere ?? "stanga"],
    spacing: { before: o.inainte ?? 0, after: o.dupa ?? 120 },
    children: [
      new TextRun({
        text,
        size: o.marime ?? 22,
        bold: o.aldin ?? false,
        ...(o.slab === true ? { color: "6B7280" } : {}),
      }),
    ],
  });
}

export async function randeazaScrisoareDocx(intrare: Scrisoare): Promise<Uint8Array> {
  const s = curataScrisoarea(intrare);
  const copii: Paragraph[] = [
    rand(s.inregistrare, { marime: 20 }),
    rand(s.catre, { aliniere: "dreapta", inainte: 120 }),
    rand(s.titlu, { aliniere: "centru", marime: 32, aldin: true, inainte: 600, dupa: 60 }),
  ];
  if (s.subtitlu !== null) copii.push(rand(s.subtitlu, { aliniere: "centru", dupa: 360 }));
  for (const p of s.paragrafe) {
    copii.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 567 },
        spacing: { after: 160, line: 360 },
        children: [new TextRun({ text: p, size: 22 })],
      }),
    );
  }
  copii.push(
    new Paragraph({
      spacing: { before: 480, after: 0 },
      tabStops: [{ type: TabStopType.RIGHT, position: LATIME_UTILA_TWIPS }],
      children: [
        new TextRun({ text: s.locSiData, size: 22 }),
        new TextRun({ children: [new Tab(), s.semnatura], size: 22 }),
      ],
    }),
    rand("______________________", { aliniere: "dreapta", inainte: 480 }),
  );

  if (s.rubrica !== null) {
    const r = s.rubrica;
    copii.push(
      new Paragraph({
        spacing: { before: 600, after: 120 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 8 } },
        children: [new TextRun({ text: r.titlu, bold: true, size: 20 })],
      }),
    );
    for (const linie of r.randuri) copii.push(rand(linie, { marime: 20, dupa: 60 }));
    if (r.semnaturi.length > 0) {
      const pas = Math.floor(LATIME_UTILA_TWIPS / r.semnaturi.length);
      const opriri = r.semnaturi.slice(1).map((_, i) => ({
        type: TabStopType.LEFT,
        position: pas * (i + 1),
      }));
      const randCuTaburi = (texte: readonly string[], marime: number, inainte: number) =>
        new Paragraph({
          spacing: { before: inainte, after: 0 },
          tabStops: opriri,
          children: texte.map(
            (t, i) =>
              new TextRun({
                children: i === 0 ? [t] : [new Tab(), t],
                size: marime,
                color: "6B7280",
              }),
          ),
        });
      copii.push(
        randCuTaburi(
          r.semnaturi.map(() => "________________"),
          20,
          720,
        ),
        randCuTaburi(r.semnaturi, 18, 60),
      );
    }
  }

  s.note.forEach((n, i) => {
    copii.push(rand(n, { marime: 16, slab: true, inainte: i === 0 ? 360 : 0, dupa: 60 }));
  });

  const subsol = new Footer({
    children: [
      new Paragraph({
        children: [
          new ExternalHyperlink({
            link: adresaScrisoare(s, "docx", ADRESA_SITE),
            children: [
              new TextRun({ text: SEMNATURA_FISIER, size: 14, color: "6B7280", underline: {} }),
            ],
          }),
        ],
      }),
    ],
  });

  const document = new Document({
    creator: "Administrativo",
    title: s.titluDocument,
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGINE_TWIPS,
              bottom: MARGINE_TWIPS,
              left: MARGINE_TWIPS,
              right: MARGINE_TWIPS,
            },
          },
        },
        footers: { default: subsol },
        children: copii,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
```

- [ ] **Pasul 4: Rulează testele, trec.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/
```

Apoi lanțul complet.

- [ ] **Verificare vizuală a fișierelor.** Generează trei fișiere cu un test temporar, NEcomis, în scratchpad-ul sesiunii. Exemplul de mai jos folosește calea `$SCR`:

```bash
SCR=/tmp/claude-1000/-srv-apps-ERP/<sesiunea>/scratchpad/f9 && mkdir -p "$SCR"
cat > /srv/apps/ERP/src/lib/unelte/zz-sonda.test.ts <<EOF
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { randeazaScrisoareDocx } from "./scrisoare-docx";
import { randeazaScrisoarePdf } from "./scrisoare-pdf";
it("sonda", async () => {
  const s = {
    titluDocument: "Cerere de concediu de odihnă", inregistrare: "Nr. înregistrare ________ din ____________",
    catre: "Către: Exemplu Construcții SRL", titlu: "CERERE", subtitlu: "de concediu de odihnă",
    paragrafe: ["Subsemnatul/Subsemnata Ilie Maria-Ștefania, angajat(ă) în funcția de contabil-șef, vă rog să binevoiți a-mi aproba efectuarea concediului de odihnă aferent anului 2026, în perioada 21.12.2026 – 08.01.2027 inclusiv, reprezentând 11 zile lucrătoare."],
    locSiData: "Cluj-Napoca, 08.10.2026", semnatura: "Semnătura salariatului",
    rubrica: { titlu: "Se completează de angajator", randuri: ["☐ Se aprobă / ☐ Nu se aprobă"], semnaturi: ["Șef ierarhic", "Resurse umane", "Conducătorul unității"] },
    note: ["Temeiul — art. 145 alin. (3) din Codul muncii."], numeFisier: "x", sursa: "/unelte/cerere-concediu-de-odihna",
  };
  writeFileSync("$SCR/cerere.pdf", await randeazaScrisoarePdf(s));
  writeFileSync("$SCR/cerere.docx", await randeazaScrisoareDocx(s));
});
EOF
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/zz-sonda.test.ts; rm -f src/lib/unelte/zz-sonda.test.ts
git status --short -- src/lib/unelte/zz-sonda.test.ts   # trebuie să nu afișeze nimic
```

Rasterizează PDF-ul cu `pymupdf`, dintr-un venv din scratchpad (`python -I`), la 70 dpi, și citește PNG-ul. **Trebuie să iasă:** o singură pagină; „Către” aliniat la dreapta; „CERERE” centrat, aldin, 16 pt; locul și data în stânga, pe aceeași linie cu „Semnătura salariatului” din dreapta; o linie de semnătură sub ea; o riglă și rubrica angajatorului cu trei semnături; nota mică, gri; jos, la 7 pt, „Generat gratuit cu administrativo.ro”. Deschide `.docx`-ul cu `unzip -p cerere.docx word/footer1.xml | grep -c "Generat gratuit"`. Rezultatul trebuie să fie `1`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
F="src/lib/unelte/scrisoare-pdf.ts src/lib/unelte/scrisoare-docx.ts src/lib/unelte/scrisoare-randari.test.ts"
git status --short -- $F
git fetch origin main
git diff --name-only HEAD origin/main -- src/lib/unelte/
git add -- $F
git commit --only -m "$(cat <<'MSG'
feat(unelte): scrisoarea în PDF și Word, cu același aspect ca pe ecran

PDF-ul execută așezarea pură; Word-ul are „Către” la dreapta, titlul centrat,
corpul justificat și tabulatoarele pe lățimea utilă de 2 cm. Rândul „Generat
gratuit” stă în subsolul paginii Word și în marginea de jos a PDF-ului, nu în
textul semnat, iar legătura lui duce la pagina uneltei.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- $F
git merge origin/main
git push origin main
```

---

### Task F10: De la parametri la scrisoare: cititorul comun

**Fișiere:**
- Create: `src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-model.ts`
- Test: `…/cerere-model.test.ts`

**Interfețe:**
- Consumă: din `./cerere` (F4, F5): `aziIso`, `citesteData`, `construiesteCerere`, `intervalImplicit`, `normalizeazaText`, `plusZile`, `type Cerere`. Apoi `./text-zile` (F6), `./variante` (F7), `type CalendarPaste` (F2), `type RubricaAngajator`, `type Scrisoare` (F8), `EroareIntrare` și `LINIE_GOALA` din `@/lib/unelte/document-tabelar`, `cuDe`, `formatDate`.
- Produce:
  - `export const PAGINA_CERERE = "/unelte/cerere-concediu-de-odihna"`
  - `export type Perioada = Readonly<{ deLa: string; panaLa: string }>`
  - `export type OptiuniCerere = Readonly<{ tip; calendar; angajator; departament; salariat; functie; localitate; dataCererii; anAferent: number; perioade: readonly [Perioada, ...Perioada[]]; programat: Perioada | null; eveniment; zileCcm: number | null; motiv; dataNasterii: string | null; puericultura: boolean; persoana; cuPlata: boolean; domeniu; institutie }>`
  - `export type CerereCitita = Readonly<{ optiuni: OptiuniCerere; calcule: readonly Cerere[]; calculProgramat: Cerere | null; probleme: readonly string[]; avertismente: readonly string[] }>`
  - `export function citesteCererea(q: URLSearchParams, azi?: string): CerereCitita`
  - `export function scrisoareaCererii(c: CerereCitita): Scrisoare`. Apelantul garantează `probleme` gol.
  - `export function cerereDinParametri(q: URLSearchParams, azi?: string): Scrisoare`. Aruncă `EroareIntrare` cu toate problemele.
  - `export function adresaVariantei(q: URLSearchParams, tip: TipCerere): string`

Regula care a ieșit din rularea în sim: **cu o intrare greșită nu se mai calculează nimic.** Prima versiune a dat, pentru `de_la=2026-02-30`, și problema adevărată („nu e o dată reală”), și una falsă („sfârșitul e înaintea începutului”), din implicitul pus în locul datei. Testul „31 februarie” o prinde.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `cerere-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { EroareIntrare } from "@/lib/unelte/document-tabelar";

import {
  adresaVariantei,
  cerereDinParametri,
  citesteCererea,
  PAGINA_CERERE,
  scrisoareaCererii,
} from "./cerere-model";
import { TIPURI_CERERE, VARIANTE, type TipCerere } from "./variante";

/**
 * Ce apără: documentul pe care omul îl semnează. Fiecare test pornește de la
 * parametrii din adresă, exact ca pagina și ruta de descărcare. Ziua de azi e
 * fixată prin al doilea argument, ca rezultatul să nu depindă de ceas.
 *
 * Zilele săptămânii folosite sunt verificate, nu deduse: 06.07, 03.08, 09.11,
 * 16.11.2026 și 02.03, 07.09.2026 sunt zile de luni; 12.11.2026 e joi.
 */
const AZI = "2026-10-02";
const BAZA = {
  salariat: "Ilie Maria",
  functie: "contabil",
  angajator: "Exemplu SRL",
  departament: "Contabilitate",
  localitate: "Cluj-Napoca",
};

const cere = (parametri: Record<string, string>, azi = AZI) =>
  citesteCererea(new URLSearchParams(parametri), azi);
const text = (parametri: Record<string, string>, azi = AZI) =>
  scrisoareaCererii(cere(parametri, azi)).paragrafe.join(" ");

describe("cererea de odihnă", () => {
  it("are anul, departamentul, zilele calculate și rubrica de sold", () => {
    const c = cere({ ...BAZA, de_la: "2026-12-21", pana_la: "2026-12-31" });
    expect(c.probleme).toEqual([]);
    expect(c.avertismente).toEqual([]);
    const s = scrisoareaCererii(c);
    const corp = s.paragrafe.join(" ");
    expect(corp).toContain("aferent anului 2026");
    expect(corp).toContain("contabil, departamentul Contabilitate, vă rog");
    expect(corp).toContain("reprezentând 8 zile lucrătoare");
    expect(corp).toContain("25.12.2026 (Crăciunul)");
    expect(s.catre).toBe("Către: Exemplu SRL");
    expect(s.titlu).toBe("CERERE");
    expect(s.subtitlu).toBe("de concediu de odihnă");
    expect(s.locSiData).toBe("Cluj-Napoca, 02.10.2026");
    expect(s.rubrica?.randuri).toContain(
      "Zile de concediu de odihnă cuvenite pentru anul 2026: ________",
    );
    expect(s.sursa).toBe(PAGINA_CERERE);
    expect(s.numeFisier).toBe("cerere-odihna-2026-12-21");
  });

  it("fără date în adresă: luni–vineri, la cel puțin 60 de zile", () => {
    const corp = text({}, "2026-10-08");
    expect(corp).toContain("07.12.2026 – 11.12.2026 inclusiv");
    expect(corp).toContain("reprezentând 5 zile lucrătoare");
  });

  it("doar cu data de început: o singură zi", () => {
    expect(text({ de_la: "2026-11-16" })).toContain("reprezentând 1 zi lucrătoare");
  });

  it("anul anterior apare ca report, după art. 146 alin. (2)", () => {
    expect(
      text({ de_la: "2026-03-02", pana_la: "2026-03-06", an: "2025", data: "2026-01-02" }),
    ).toContain("aferent anului 2025, neefectuat și reportat potrivit art. 146 alin. (2)");
    expect(
      cere({ de_la: "2026-03-02", pana_la: "2026-03-06", an: "2023" }).probleme.join(" "),
    ).toMatch(/art\. 146 alin\. \(2\)/u);
    expect(
      cere({
        de_la: "2026-09-07",
        pana_la: "2026-09-11",
        an: "2024",
        data: "2026-06-01",
      }).avertismente.join(" "),
    ).toMatch(/nr\. 40\/2026/u);
  });

  it("termenul de 60 de zile și data cererii de după început sunt avertismente, nu blocaje", () => {
    const devreme = cere({ de_la: "2026-10-19", pana_la: "2026-10-23", data: "2026-10-02" });
    expect(devreme.probleme).toEqual([]);
    expect(devreme.avertismente.join(" ")).toMatch(/cu 17 zile înainte\. Art\. 148 alin\. \(4\)/u);
    const tarziu = cere({ de_la: "2026-09-14", pana_la: "2026-09-18", data: "2026-10-02" });
    expect(tarziu.probleme).toEqual([]);
    expect(tarziu.avertismente.join(" ")).toMatch(/după începutul perioadei/u);
  });
});

describe("intrările greșite se refuză, nu se înlocuiesc (auditul din 8 oct 2026)", () => {
  it("un an din afara intervalului oprește documentul, cu motivul", () => {
    const c = cere({ de_la: "2036-01-05", pana_la: "2036-01-09" });
    expect(c.probleme.join(" ")).toMatch(/2036/u);
    expect(() => cerereDinParametri(new URLSearchParams({ de_la: "2036-01-05" }), AZI)).toThrow(
      EroareIntrare,
    );
  });

  it("31 februarie e „nu e o dată reală”, nu „sfârșitul e înaintea începutului”", () => {
    const c = cere({ de_la: "2026-02-30", pana_la: "2026-03-06" });
    expect(c.probleme.join(" ")).toMatch(/nu e o dată reală/u);
    expect(c.probleme.join(" ")).not.toMatch(/înaintea/u);
  });

  it("un weekend singur, un interval inversat, un tip sau un calendar necunoscut", () => {
    expect(cere({ de_la: "2026-11-14", pana_la: "2026-11-15" }).probleme.join(" ")).toMatch(
      /nicio zi lucrătoare/u,
    );
    expect(cere({ de_la: "2026-12-20", pana_la: "2026-12-10" }).probleme.join(" ")).toMatch(
      /înaintea/u,
    );
    expect(cere({ tip: "orice" }).probleme.join(" ")).toMatch(/Tipul cererii/u);
    expect(cere({ cult: "xyz" }).probleme.join(" ")).toMatch(/ortodox sau gregorian/u);
  });
});

describe("concediul împărțit în fracțiuni — art. 148 alin. (5)", () => {
  const FRACTIUNI = { ...BAZA, data: "2026-04-01", de_la: "2026-07-06", pana_la: "2026-07-10" };

  it("enumeră fracțiunile, cu zilele fiecăreia și totalul", () => {
    const c = cere({ ...FRACTIUNI, de_la_2: "2026-08-03", pana_la_2: "2026-08-14" });
    expect(c.probleme).toEqual([]);
    expect(c.avertismente).toEqual([]);
    const corp = scrisoareaCererii(c).paragrafe.join(" ");
    expect(corp).toContain("fracționat");
    expect(corp).toContain("1) 06.07.2026 – 10.07.2026 inclusiv — 5 zile lucrătoare");
    expect(corp).toContain("2) 03.08.2026 – 14.08.2026 inclusiv — 10 zile lucrătoare");
    expect(corp).toContain("în total, 15 zile lucrătoare");
    expect(corp).toContain("perioadele solicitate");
  });

  it("avertizează când nicio fracțiune nu are 10 zile lucrătoare", () => {
    const c = cere({ ...FRACTIUNI, de_la_2: "2026-08-03", pana_la_2: "2026-08-07" });
    expect(c.probleme).toEqual([]);
    expect(c.avertismente.join(" ")).toMatch(/Art\. 148 alin\. \(5\)/u);
  });

  it("refuză fracțiunile suprapuse și pe cele cu o singură dată", () => {
    expect(
      cere({ ...FRACTIUNI, de_la_2: "2026-07-08", pana_la_2: "2026-07-15" }).probleme.join(" "),
    ).toMatch(/se suprapun/u);
    expect(cere({ ...FRACTIUNI, de_la_2: "2026-08-03" }).probleme.join(" ")).toMatch(
      /doar una dintre date/u,
    );
  });

  it("la celelalte variante, fracțiunile din adresă se ignoră", () => {
    const c = cere({ ...FRACTIUNI, tip: "fara-plata", de_la_2: "2026-08-03" });
    expect(c.probleme).toEqual([]);
    expect(scrisoareaCererii(c).paragrafe.join(" ")).not.toContain("fracționat");
  });
});

describe("salariatul de alt cult creștin — art. 139 alin. (2¹)", () => {
  it("numără după Paștele gregorian și spune asta în cerere", () => {
    const corp = text({
      de_la: "2026-03-30",
      pana_la: "2026-04-10",
      cult: "gregorian",
      data: "2026-01-15",
    });
    expect(corp).toContain("reprezentând 8 zile lucrătoare");
    expect(corp).toContain("art. 139 alin. (2¹)");
    expect(text({ de_la: "2026-03-30", pana_la: "2026-04-10", data: "2026-01-15" })).toContain(
      "reprezentând 9 zile lucrătoare",
    );
  });
});

describe("celelalte variante", () => {
  it("paternal: 10 zile, data nașterii, actele; avertismente la depășire", () => {
    const de = { ...BAZA, tip: "paternal", nastere: "2026-11-02", de_la: "2026-11-09" };
    const zece = cere({ ...de, pana_la: "2026-11-20" });
    expect(zece.probleme).toEqual([]);
    expect(zece.avertismente).toEqual([]);
    const corp = scrisoareaCererii(zece).paragrafe.join(" ");
    expect(corp).toContain("născut la data de 02.11.2026");
    expect(corp).toContain("Legii nr. 210/1999");
    expect(corp).toContain("certificatului de naștere");

    expect(cere({ ...de, pana_la: "2026-11-27" }).avertismente.join(" ")).toMatch(
      /dă 10 zile lucrătoare/u,
    );
    expect(cere({ ...de, pana_la: "2026-11-27", puericultura: "da" }).avertismente).toEqual([]);
    expect(cere({ ...de, de_la: "2026-10-26", pana_la: "2026-10-30" }).probleme.join(" ")).toMatch(
      /înainte de nașterea/u,
    );
    expect(
      cere({
        ...de,
        nastere: "2026-09-01",
        de_la: "2026-10-26",
        pana_la: "2026-10-30",
      }).avertismente.join(" "),
    ).toMatch(/8 săptămâni/u);
  });

  it("îngrijitor: persoana îngrijită în cerere; peste 5 zile, avertisment", () => {
    const c = cere({
      ...BAZA,
      tip: "ingrijitor",
      persoana: "mamei mele, Ilie Ana",
      de_la: "2026-11-16",
      pana_la: "2026-11-23",
    });
    expect(c.probleme).toEqual([]);
    expect(scrisoareaCererii(c).paragrafe.join(" ")).toContain(
      "sprijin personal mamei mele, Ilie Ana",
    );
    expect(c.avertismente.join(" ")).toMatch(/152¹/u);
  });

  it("formare: cu plată după art. 157, cu instituția și domeniul; termenul de o lună", () => {
    const c = cere({
      ...BAZA,
      tip: "formare",
      plata: "da",
      domeniu: "contabilitate",
      institutie: "Universitatea X",
      de_la: "2026-11-16",
      pana_la: "2026-11-20",
      data: "2026-11-01",
    });
    expect(c.probleme).toEqual([]);
    const corp = scrisoareaCererii(c).paragrafe.join(" ");
    expect(corp).toContain("art. 157");
    expect(corp).toContain("organizat de Universitatea X");
    expect(c.avertismente.join(" ")).toMatch(/o lună înainte/u);
  });

  it("reprogramare: cere perioada programată și o pune în cerere", () => {
    const nou = {
      ...BAZA,
      tip: "reprogramare",
      de_la: "2026-11-16",
      pana_la: "2026-11-20",
      motiv: "internare",
    };
    expect(cere(nou).probleme.join(" ")).toMatch(/concediului programat/u);
    const c = cere({ ...nou, prog_de_la: "2026-08-03", prog_pana_la: "2026-08-14" });
    expect(c.probleme).toEqual([]);
    const corp = scrisoareaCererii(c).paragrafe.join(" ");
    expect(corp).toContain("programat în perioada 03.08.2026 – 14.08.2026 inclusiv");
    expect(corp).toContain("motive obiective: internare");
  });

  it("întrerupere: zilele rămase se numără de la data întreruperii", () => {
    const de = {
      ...BAZA,
      tip: "intrerupere",
      prog_de_la: "2026-08-03",
      prog_pana_la: "2026-08-14",
    };
    const c = cere({ ...de, de_la: "2026-08-10", pana_la: "2036-99-99" });
    expect(c.probleme).toEqual([]);
    const corp = scrisoareaCererii(c).paragrafe.join(" ");
    expect(corp).toContain("începând cu data de 10.08.2026");
    expect(corp).toContain("celor 5 zile lucrătoare rămase neefectuate");
    expect(cere({ ...de, de_la: "2026-08-03" }).probleme.join(" ")).toMatch(/Data întreruperii/u);
    expect(cere({ ...de, de_la: "2026-08-20" }).probleme.join(" ")).toMatch(/Data întreruperii/u);
  });

  it("eveniment: evenimentul ales, zilele din contract, actul; adresele vechi merg", () => {
    const corp = text({
      ...BAZA,
      tip: "eveniment",
      eveniment: "casatorie-salariat",
      zile_ccm: "5",
      de_la: "2026-11-16",
      pana_la: "2026-11-20",
    });
    expect(corp).toContain("cuvenite pentru căsătoria mea");
    expect(corp).toContain("adică 5 zile libere plătite");
    expect(corp).toContain("Anexez, în copie, certificatul de căsătorie.");
    // Adresa de dinainte de 8 oct 2026: `motiv`, fără `eveniment`.
    expect(text({ tip: "eveniment", motiv: "căsătoria mea", de_la: "2026-11-16" })).toContain(
      "cuvenite pentru căsătoria mea",
    );
    expect(cere({ tip: "eveniment", zile_ccm: "0" }).probleme.join(" ")).toMatch(/între 1 și 30/u);
  });
});

describe("fiecare variantă e o cerere completă de semnat", () => {
  const MINIM: Readonly<Record<TipCerere, Record<string, string>>> = {
    odihna: {},
    "fara-plata": {},
    eveniment: {},
    paternal: {},
    ingrijitor: {},
    formare: {},
    reprogramare: { prog_de_la: "2026-08-03", prog_pana_la: "2026-08-07" },
    intrerupere: { prog_de_la: "2026-11-12", prog_pana_la: "2026-11-25" },
  };

  it.each(TIPURI_CERERE)("%s: semnătura salariatului, decizia și cele trei aprobări", (tip) => {
    const c = cere({
      ...BAZA,
      tip,
      de_la: "2026-11-16",
      pana_la: "2026-11-20",
      data: "2026-09-01",
      ...MINIM[tip],
    });
    expect(c.probleme).toEqual([]);
    const s = scrisoareaCererii(c);
    expect(s.semnatura).toBe("Semnătura salariatului");
    expect(s.rubrica?.randuri[0]).toBe("☐ Se aprobă / ☐ Nu se aprobă");
    expect(s.rubrica?.semnaturi).toEqual([
      "Șef ierarhic",
      "Resurse umane",
      "Conducătorul unității",
    ]);
    expect(s.rubrica?.randuri).toHaveLength(VARIANTE[tip].cuSold ? 5 : 1);
    expect(s.titluDocument).toBe(VARIANTE[tip].titlu);
    expect(s.note).toEqual([VARIANTE[tip].temei]);
  });
});

describe("bara de variante", () => {
  it("păstrează oamenii și perioada, nu și câmpurile variantei vechi", () => {
    const q = new URLSearchParams({
      salariat: "Popa",
      de_la: "2026-11-16",
      tip: "eveniment",
      zile_ccm: "5",
      de_la_2: "2026-12-01",
    });
    expect(adresaVariantei(q, "paternal")).toBe(
      `${PAGINA_CERERE}?salariat=Popa&de_la=2026-11-16&tip=paternal#documentul`,
    );
    expect(adresaVariantei(new URLSearchParams(), "odihna")).toBe(`${PAGINA_CERERE}#documentul`);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-model.test.ts"
```

Așteptat: `Failed to resolve import "./cerere-model"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `cerere-model.ts`:

```ts
import { cuDe } from "@/content/legal/zile-libere";
import type { CalendarPaste } from "@/domain/calendar/sarbatori-cult";
import { formatDate } from "@/lib/format/date";
import { EroareIntrare, LINIE_GOALA } from "@/lib/unelte/document-tabelar";
import type { RubricaAngajator, Scrisoare } from "@/lib/unelte/scrisoare";

import {
  aziIso,
  citesteData,
  construiesteCerere,
  intervalImplicit,
  normalizeazaText,
  plusZile,
  type Cerere,
} from "./cerere";
import { weekendText, zileCalendaristiceText, zileLucratoareText, zileText } from "./text-zile";
import {
  esteEveniment,
  esteTipCerere,
  EVENIMENTE,
  SAPTAMANI_PATERNAL,
  VARIANTE,
  ZILE_AVANS_CERERE_ODIHNA,
  ZILE_FORMARE_PLATITA,
  ZILE_FRACTIUNE_NEINTRERUPTA,
  ZILE_INGRIJITOR,
  ZILE_PATERNAL,
  ZILE_PATERNAL_PUERICULTURA,
  type Eveniment,
  type TipCerere,
} from "./variante";

/**
 * Cererea, de la parametrii din adresă la scrisoarea de semnat.
 *
 * ── UN SINGUR CITITOR PENTRU PAGINĂ ȘI PENTRU FIȘIER ──────────────────────
 * Pagina și ruta de descărcare citesc aceiași parametri prin `citesteCererea`.
 * Ce refuză una refuză și cealaltă, cu același mesaj; ce arată pagina e exact
 * ce se descarcă.
 *
 * ── PROBLEME ȘI AVERTISMENTE ──────────────────────────────────────────────
 * O PROBLEMĂ oprește documentul: o dată care nu există, un interval inversat,
 * o perioadă fără nicio zi lucrătoare. Un AVERTISMENT nu oprește nimic: legea
 * dă un drept sau un termen, iar omul poate avea motive să ceară altfel (o
 * regularizare datată după începutul concediului, o cerere depusă cu mai puțin
 * de 60 de zile înainte). Avertismentele se arată pe pagină și NU intră în
 * documentul de semnat.
 *
 * ── PARAMETRII ────────────────────────────────────────────────────────────
 * Comuni: `tip`, `cult`, `angajator`, `departament`, `salariat`, `functie`,
 * `localitate`, `data`, `de_la`, `pana_la`. Pe variantă: `an`, `de_la_2`,
 * `pana_la_2`, `de_la_3`, `pana_la_3` (odihnă); `prog_de_la`, `prog_pana_la`
 * (reprogramare, întrerupere); `eveniment`, `zile_ccm` (eveniment); `motiv`;
 * `nastere`, `puericultura` (paternal); `persoana` (îngrijitor); `plata`,
 * `domeniu`, `institutie` (formare). Parametrii care nu țin de varianta aleasă
 * se ignoră — rămân în adresă când omul trece de la o variantă la alta.
 */

export const PAGINA_CERERE = "/unelte/cerere-concediu-de-odihna";
const MAX_FRACTIUNI = 3;

export type Perioada = Readonly<{ deLa: string; panaLa: string }>;

export type OptiuniCerere = Readonly<{
  tip: TipCerere;
  calendar: CalendarPaste;
  angajator: string;
  departament: string;
  salariat: string;
  functie: string;
  localitate: string;
  dataCererii: string;
  /** Anul pentru care se acordă concediul de odihnă — art. 146. */
  anAferent: number;
  /** Prima e perioada cererii; următoarele, fracțiunile (doar la odihnă). */
  perioade: readonly [Perioada, ...Perioada[]];
  /** Concediul programat (reprogramare) sau cel în curs (întrerupere). */
  programat: Perioada | null;
  eveniment: Eveniment;
  zileCcm: number | null;
  motiv: string;
  dataNasterii: string | null;
  puericultura: boolean;
  persoana: string;
  cuPlata: boolean;
  domeniu: string;
  institutie: string;
}>;

export type CerereCitita = Readonly<{
  optiuni: OptiuniCerere;
  /** Câte un calcul pe fiecare perioadă cerută; gol la întrerupere. */
  calcule: readonly Cerere[];
  /** Concediul programat (reprogramare) sau zilele rămase (întrerupere). */
  calculProgramat: Cerere | null;
  /** Nevid ⇒ nu se generează niciun document. */
  probleme: readonly string[];
  /** Se arată pe pagină; nu intră în document. */
  avertismente: readonly string[];
}>;

const anul = (iso: string) => Number(iso.slice(0, 4));

const zileIntre = (de: string, pana: string) =>
  Math.round((Date.parse(`${pana}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

/** Aceeași zi, cu o lună calendaristică înainte (31 martie → 28 februarie). */
function cuOLunaInainte(iso: string): string {
  const an = anul(iso);
  const luna = Number(iso.slice(5, 7));
  const zi = Number(iso.slice(8, 10));
  const ultimaZi = new Date(Date.UTC(an, luna - 1, 0)).getUTCDate();
  return new Date(Date.UTC(an, luna - 2, Math.min(zi, ultimaZi))).toISOString().slice(0, 10);
}

export function citesteCererea(q: URLSearchParams, azi: string = aziIso()): CerereCitita {
  const probleme: string[] = [];
  const avertismente: string[] = [];
  const brut = (cheie: string) => (q.get(cheie) ?? "").trim();
  const text = (cheie: string, maxim = 120) => normalizeazaText(q.get(cheie) ?? undefined, maxim);
  const data = (cheie: string, eticheta: string): string | null => {
    const citita = citesteData(q.get(cheie) ?? undefined, eticheta);
    if (citita.problema !== null) probleme.push(citita.problema);
    return citita.data;
  };

  const tipBrut = brut("tip");
  let tip: TipCerere = "odihna";
  if (esteTipCerere(tipBrut)) tip = tipBrut;
  else if (tipBrut !== "") probleme.push(`Tipul cererii „${tipBrut.slice(0, 30)}” nu există.`);

  let calendar: CalendarPaste = "ortodox";
  if (brut("cult") === "gregorian") calendar = "gregorian";
  else if (brut("cult") !== "" && brut("cult") !== "ortodox") {
    probleme.push(`Calendarul „${brut("cult").slice(0, 30)}” nu există: ortodox sau gregorian.`);
  }

  // Perioada principală. Fără nicio dată: intervalul implicit. Doar cu data de
  // început: o singură zi. La întrerupere, `de_la` e ziua de la care se întrerupe.
  const implicit = intervalImplicit(azi);
  const deLa = data("de_la", "Data de început") ?? implicit.deLa;
  const panaLaCitit = tip === "intrerupere" ? null : data("pana_la", "Data de sfârșit");
  const panaLa =
    tip === "intrerupere" ? deLa : (panaLaCitit ?? (brut("de_la") === "" ? implicit.panaLa : deLa));
  const perioade: [Perioada, ...Perioada[]] = [{ deLa, panaLa }];

  if (tip === "odihna") {
    for (let k = 2; k <= MAX_FRACTIUNI; k += 1) {
      const cheieDe = `de_la_${String(k)}`;
      const cheiePana = `pana_la_${String(k)}`;
      if (brut(cheieDe) === "" && brut(cheiePana) === "") continue;
      if (brut(cheieDe) === "" || brut(cheiePana) === "") {
        probleme.push(`Fracțiunea ${String(k)} are doar una dintre date.`);
        continue;
      }
      const de = data(cheieDe, `Fracțiunea ${String(k)}, data de început`);
      const pana = data(cheiePana, `Fracțiunea ${String(k)}, data de sfârșit`);
      if (de !== null && pana !== null) perioade.push({ deLa: de, panaLa: pana });
    }
  }

  let programat: Perioada | null = null;
  if (tip === "reprogramare" || tip === "intrerupere") {
    if (brut("prog_de_la") === "" || brut("prog_pana_la") === "") {
      probleme.push(
        "Completați perioada concediului programat: data de început și data de sfârșit.",
      );
    } else {
      const de = data("prog_de_la", "Concediul programat, data de început");
      const pana = data("prog_pana_la", "Concediul programat, data de sfârșit");
      if (de !== null && pana !== null) programat = { deLa: de, panaLa: pana };
    }
  }

  const dataCererii = data("data", "Data cererii") ?? azi;

  let anAferent = anul(deLa);
  if (brut("an") !== "") {
    const n = Number(brut("an"));
    const maxim = anul(deLa);
    if (!Number.isInteger(n) || n < maxim - 2 || n > maxim) {
      probleme.push(
        `Anul concediului poate fi ${String(maxim - 2)}, ${String(maxim - 1)} sau ${String(maxim)}: zilele neefectuate se reportează cel mult 18 luni — art. 146 alin. (2) din Codul muncii.`,
      );
    } else {
      anAferent = n;
    }
  }

  const evenimentBrut = brut("eveniment");
  let eveniment: Eveniment = "alt";
  if (esteEveniment(evenimentBrut)) eveniment = evenimentBrut;
  else if (evenimentBrut !== "") {
    probleme.push(`Evenimentul „${evenimentBrut.slice(0, 30)}” nu e în listă.`);
  }

  let zileCcm: number | null = null;
  if (tip === "eveniment" && brut("zile_ccm") !== "") {
    const n = Number(brut("zile_ccm"));
    if (!Number.isInteger(n) || n < 1 || n > 30) {
      probleme.push("Numărul de zile din contractul colectiv trebuie să fie între 1 și 30.");
    } else {
      zileCcm = n;
    }
  }

  const dataNasterii = tip === "paternal" ? data("nastere", "Data nașterii copilului") : null;

  const optiuni: OptiuniCerere = {
    tip,
    calendar,
    angajator: text("angajator"),
    departament: text("departament", 80),
    salariat: text("salariat"),
    functie: text("functie", 80),
    localitate: text("localitate", 60),
    dataCererii,
    anAferent,
    perioade,
    programat,
    eveniment,
    zileCcm,
    motiv: text("motiv", 160),
    dataNasterii,
    puericultura: brut("puericultura") === "da",
    persoana: text("persoana", 120),
    cuPlata: brut("plata") === "da",
    domeniu: text("domeniu", 80),
    institutie: text("institutie", 120),
  };

  // Cu o intrare greșită nu se mai calculează nimic: un interval construit din
  // implicitul pus în locul unei date greșite ar adăuga o a doua problemă, falsă
  // („sfârșitul e înaintea începutului”), peste cea adevărată.
  if (probleme.length > 0) {
    return { optiuni, calcule: [], calculProgramat: null, probleme, avertismente };
  }

  const calcule =
    tip === "intrerupere"
      ? []
      : perioade.map((p) => construiesteCerere(p.deLa, p.panaLa, calendar));
  calcule.forEach((c, i) => {
    if (c.problema !== null) {
      probleme.push(
        perioade.length > 1 ? `Fracțiunea ${String(i + 1)}: ${c.problema}` : c.problema,
      );
    }
  });

  const ordonate = [...perioade].sort((a, b) => a.deLa.localeCompare(b.deLa));
  for (let i = 1; i < ordonate.length; i += 1) {
    const inainte = ordonate[i - 1];
    const acum = ordonate[i];
    if (inainte !== undefined && acum !== undefined && acum.deLa <= inainte.panaLa) {
      probleme.push("Fracțiunile se suprapun: fiecare zi se cere o singură dată.");
      break;
    }
  }

  let calculProgramat: Cerere | null = null;
  if (programat !== null && tip === "reprogramare") {
    calculProgramat = construiesteCerere(programat.deLa, programat.panaLa, calendar);
    if (calculProgramat.problema !== null) {
      probleme.push(`Concediul programat: ${calculProgramat.problema}`);
    }
  }
  if (programat !== null && tip === "intrerupere") {
    if (deLa <= programat.deLa || deLa > programat.panaLa) {
      probleme.push(
        `Data întreruperii trebuie să cadă după prima zi a concediului (${formatDate(programat.deLa)}) și cel târziu în ultima (${formatDate(programat.panaLa)}).`,
      );
    } else {
      calculProgramat = construiesteCerere(deLa, programat.panaLa, calendar);
      if (calculProgramat.problema !== null) {
        probleme.push(`Zilele rămase: ${calculProgramat.problema}`);
      }
    }
  }

  if (tip === "paternal" && dataNasterii !== null && deLa < dataNasterii) {
    probleme.push("Concediul paternal nu poate începe înainte de nașterea copilului.");
  }

  if (probleme.length === 0) {
    const total = calcule.reduce((suma, c) => suma + c.zileLucratoare, 0);

    if (tip !== "intrerupere" && dataCererii > deLa) {
      avertismente.push(
        `Cererea e datată ${formatDate(dataCererii)}, după începutul perioadei (${formatDate(deLa)}). Se întâmplă la o regularizare; verificați că e intenționat.`,
      );
    }
    if (tip === "odihna" && dataCererii <= deLa) {
      const avans = zileIntre(dataCererii, deLa);
      if (avans < ZILE_AVANS_CERERE_ODIHNA) {
        avertismente.push(
          `Cererea se depune cu ${zileText(avans)} înainte. Art. 148 alin. (4) vă dă dreptul să cereți concediul cu cel puțin 60 de zile înainte, în perioada programată; cu mai puțin, data rămâne la acordul angajatorului.`,
        );
      }
    }
    if (
      tip === "odihna" &&
      perioade.length > 1 &&
      calcule.every((c) => c.zileLucratoare < ZILE_FRACTIUNE_NEINTRERUPTA)
    ) {
      avertismente.push(
        "Niciuna dintre fracțiuni nu are 10 zile lucrătoare. Art. 148 alin. (5) cere ca, la programarea fracționată, fiecare salariat să efectueze într-un an cel puțin 10 zile lucrătoare de concediu neîntrerupt; verificați că le aveți în altă perioadă a anului.",
      );
    }
    if (tip === "odihna" && anAferent === anul(deLa) - 2 && deLa > `${String(anul(deLa))}-06-30`) {
      avertismente.push(
        `Termenul de report de 18 luni pentru anul ${String(anAferent)} s-a încheiat la 30.06.${String(anul(deLa))} — art. 146 alin. (2). Potrivit Deciziei ÎCCJ HP nr. 40/2026, compensarea lor în bani, la încetarea contractului (art. 146 alin. (3)), rămâne posibilă doar dacă angajatorul nu v-a oferit efectiv posibilitatea să le efectuați.`,
      );
    }
    if (tip === "paternal") {
      const cuvenite = ZILE_PATERNAL + (optiuni.puericultura ? ZILE_PATERNAL_PUERICULTURA : 0);
      if (total > cuvenite) {
        avertismente.push(
          `Cererea are ${zileLucratoareText(total)}; Legea nr. 210/1999 dă ${zileLucratoareText(cuvenite)}${optiuni.puericultura ? ", cu atestatul de puericultură" : ""}.`,
        );
      }
      if (dataNasterii !== null && panaLa > plusZile(dataNasterii, SAPTAMANI_PATERNAL * 7 - 1)) {
        avertismente.push(
          `Perioada depășește primele 8 săptămâni de la naștere (până la ${formatDate(plusZile(dataNasterii, SAPTAMANI_PATERNAL * 7 - 1))}), în care art. 2 alin. (2) din Legea nr. 210/1999 acordă concediul.`,
        );
      }
    }
    if (tip === "ingrijitor" && total > ZILE_INGRIJITOR) {
      avertismente.push(
        `Cererea are ${zileLucratoareText(total)}; art. 152¹ alin. (1) garantează ${zileLucratoareText(ZILE_INGRIJITOR)} pe an. Mai mult se poate doar prin lege specială sau prin contractul colectiv aplicabil — alin. (2).`,
      );
    }
    if (tip === "formare" && optiuni.cuPlata && total > ZILE_FORMARE_PLATITA) {
      avertismente.push(
        `Concediul plătit pentru formare profesională e de până la 10 zile lucrătoare sau 80 de ore — art. 157 alin. (1); cererea are ${zileLucratoareText(total)}.`,
      );
    }
    if (tip === "formare" && dataCererii > cuOLunaInainte(deLa)) {
      avertismente.push(
        "Art. 156 alin. (1) cere ca cererea de concediu pentru formare profesională să fie înaintată cu cel puțin o lună înainte de începere.",
      );
    }
  }

  return { optiuni, calcule, calculProgramat, probleme, avertismente };
}

/** Paragraful cu zilele scoase din numărătoare, pentru una sau mai multe perioade. */
function paragrafExcluse(calcule: readonly Cerere[], calendar: CalendarPaste): string {
  const weekend = calcule.reduce((suma, c) => suma + c.zileWeekend, 0);
  const excluse = calcule.flatMap((c) => c.excluse);
  const sarbatori =
    excluse.length > 0
      ? ` și nici sărbătorile legale: ${excluse.map((z) => `${formatDate(z.data)} (${z.motiv})`).join(", ")}`
      : "";
  const cult =
    calendar === "gregorian"
      ? " Vinerea Mare, Paștele și Rusaliile sunt socotite după data la care le celebrează cultul meu creștin — art. 139 alin. (2¹) din Codul muncii."
      : "";
  const unde = calcule.length > 1 ? "perioadele solicitate" : "intervalul solicitat";
  return `Menționez că în ${unde} nu se numără ${weekendText(weekend)}${sarbatori}.${cult}`;
}

/** Scrisoarea de semnat. Apelantul garantează că `c.probleme` e gol. */
export function scrisoareaCererii(c: CerereCitita): Scrisoare {
  const o = c.optiuni;
  const v = VARIANTE[o.tip];
  const [prima] = o.perioade;
  const sau = (t: string) => (t === "" ? LINIE_GOALA : t);
  const perioada = (p: Perioada) => `${formatDate(p.deLa)} – ${formatDate(p.panaLa)} inclusiv`;
  const cine = `Subsemnatul/Subsemnata ${sau(o.salariat)}, angajat(ă) în funcția de ${sau(o.functie)}${o.departament === "" ? "" : `, departamentul ${o.departament}`}`;
  const total = c.calcule.reduce((suma, x) => suma + x.zileLucratoare, 0);
  const calendaristice = c.calcule[0]?.zileCalendaristice ?? 0;
  const reportat =
    o.anAferent < anul(prima.deLa)
      ? ", neefectuat și reportat potrivit art. 146 alin. (2) din Codul muncii"
      : "";
  const paragrafe: string[] = [];

  switch (o.tip) {
    case "odihna": {
      if (o.perioade.length === 1) {
        paragrafe.push(
          `${cine}, vă rog să binevoiți a-mi aproba efectuarea concediului de odihnă aferent anului ${String(o.anAferent)}${reportat}, în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}.`,
        );
      } else {
        const lista = o.perioade
          .map(
            (p, i) =>
              `${String(i + 1)}) ${perioada(p)} — ${zileLucratoareText(c.calcule[i]?.zileLucratoare ?? 0)}`,
          )
          .join("; ");
        paragrafe.push(
          `${cine}, vă rog să binevoiți a-mi aproba efectuarea concediului de odihnă aferent anului ${String(o.anAferent)}${reportat}, fracționat, în următoarele perioade: ${lista}; în total, ${zileLucratoareText(total)}.`,
        );
      }
      paragrafe.push(paragrafExcluse(c.calcule, o.calendar));
      break;
    }
    case "fara-plata": {
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba un concediu fără plată pentru rezolvarea unor situații personale${o.motiv === "" ? "" : ` (${o.motiv})`}, în perioada ${perioada(prima)}, adică ${zileCalendaristiceText(calendaristice)}.`,
      );
      break;
    }
    case "eveniment": {
      const ev = EVENIMENTE[o.eveniment];
      const ce =
        o.eveniment === "alt"
          ? sau(o.motiv)
          : `${ev.inCerere}${o.motiv === "" ? "" : ` (${o.motiv})`}`;
      const cate =
        o.zileCcm === null
          ? ""
          : `, adică ${o.zileCcm === 1 ? "1 zi liberă plătită" : cuDe(o.zileCcm, "zile libere plătite")}`;
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba acordarea zilelor libere plătite cuvenite pentru ${ce}, în perioada ${perioada(prima)}${cate}, potrivit contractului colectiv de muncă aplicabil sau regulamentului intern.`,
      );
      if (ev.act !== null) paragrafe.push(`Anexez, în copie, ${ev.act}.`);
      break;
    }
    case "paternal": {
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba concediul paternal în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}, pentru copilul meu născut la data de ${o.dataNasterii === null ? LINIE_GOALA : formatDate(o.dataNasterii)}, potrivit Legii nr. 210/1999.`,
      );
      paragrafe.push(
        `Anexez copia certificatului de naștere al copilului, din care rezultă calitatea mea de tată${o.puericultura ? ", precum și atestatul de absolvire a cursului de puericultură" : ""}.`,
      );
      break;
    }
    case "ingrijitor": {
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba concediul de îngrijitor în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}, pentru a oferi îngrijire sau sprijin personal ${sau(o.persoana)}, care are nevoie de îngrijire sau sprijin ca urmare a unei probleme medicale grave.`,
      );
      paragrafe.push(
        "Anexez documentele care atestă situația, potrivit ordinului prevăzut la art. 152¹ alin. (5) din Codul muncii.",
      );
      break;
    }
    case "formare": {
      const stagiu = `stagiul de formare profesională din domeniul ${sau(o.domeniu)}, organizat de ${sau(o.institutie)}, care începe la data de ${formatDate(prima.deLa)} și durează ${zileCalendaristiceText(calendaristice)}`;
      paragrafe.push(
        o.cuPlata
          ? `${cine}, vă rog să binevoiți a-mi aproba un concediu plătit pentru formare profesională, potrivit art. 157 din Codul muncii, în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}, pentru ${stagiu}.`
          : `${cine}, vă rog să binevoiți a-mi aproba un concediu fără plată pentru formare profesională, potrivit art. 155 din Codul muncii, în perioada ${perioada(prima)}, pentru ${stagiu}.`,
      );
      break;
    }
    case "reprogramare": {
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba reprogramarea concediului de odihnă aferent anului ${String(o.anAferent)}, programat în perioada ${perioada(o.programat ?? prima)}, în perioada ${perioada(prima)}, reprezentând ${zileLucratoareText(total)}, din următoarele motive obiective: ${sau(o.motiv)}.`,
      );
      paragrafe.push(paragrafExcluse(c.calcule, o.calendar));
      break;
    }
    case "intrerupere": {
      const ramase = c.calculProgramat?.zileLucratoare ?? 0;
      paragrafe.push(
        `${cine}, vă rog să binevoiți a-mi aproba întreruperea concediului de odihnă programat în perioada ${perioada(o.programat ?? prima)}, începând cu data de ${formatDate(prima.deLa)}, din următoarele motive obiective: ${sau(o.motiv)}.`,
      );
      paragrafe.push(
        ramase === 1
          ? "Solicit reprogramarea zilei lucrătoare rămase neefectuate."
          : `Solicit reprogramarea celor ${zileLucratoareText(ramase)} rămase neefectuate.`,
      );
      break;
    }
  }

  const randuri = ["☐ Se aprobă / ☐ Nu se aprobă"];
  if (v.cuSold) {
    randuri.push(
      `Zile de concediu de odihnă cuvenite pentru anul ${String(o.anAferent)}: ________`,
      "Zile rămase din anul anterior: ________",
      "Zile efectuate până la data cererii: ________",
      "Zile rămase după această cerere: ________",
    );
  }
  const rubrica: RubricaAngajator = {
    titlu: "Se completează de angajator",
    randuri,
    semnaturi: ["Șef ierarhic", "Resurse umane", "Conducătorul unității"],
  };

  return {
    titluDocument: v.titlu,
    inregistrare: "Nr. înregistrare ________ din ____________",
    catre: `Către: ${sau(o.angajator)}`,
    titlu: "CERERE",
    subtitlu: v.subtitlu,
    paragrafe,
    locSiData: `${o.localitate === "" ? "____________" : o.localitate}, ${formatDate(o.dataCererii)}`,
    semnatura: "Semnătura salariatului",
    rubrica,
    note: [v.temei],
    numeFisier: `cerere-${o.tip}-${prima.deLa}`,
    sursa: PAGINA_CERERE,
  };
}

/**
 * Pentru ruta de descărcare: scrisoarea, sau `EroareIntrare` cu toate
 * problemele — ruta răspunde 400 (client de API) sau întoarce omul pe pagină.
 */
export function cerereDinParametri(q: URLSearchParams, azi: string = aziIso()): Scrisoare {
  const citita = citesteCererea(q, azi);
  if (citita.probleme.length > 0) throw new EroareIntrare(citita.probleme.join(" "));
  return scrisoareaCererii(citita);
}

/** Câmpurile care se păstrează când omul trece de la o variantă la alta. */
const PARAMETRI_COMUNI = [
  "angajator",
  "departament",
  "salariat",
  "functie",
  "localitate",
  "data",
  "cult",
  "de_la",
  "pana_la",
] as const;

/** Legătura din bara de variante: aceiași oameni și aceeași perioadă, alt tip de cerere. */
export function adresaVariantei(q: URLSearchParams, tip: TipCerere): string {
  const noi = new URLSearchParams();
  for (const cheie of PARAMETRI_COMUNI) {
    const valoare = q.get(cheie);
    if (valoare !== null && valoare !== "") noi.set(cheie, valoare);
  }
  if (tip !== "odihna") noi.set("tip", tip);
  const sir = noi.toString();
  return `${PAGINA_CERERE}${sir === "" ? "" : `?${sir}`}#documentul`;
}
```

- [ ] **Pasul 4: Rulează testele, trec.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/cerere-concediu-de-odihna/"
```

Apoi lanțul complet.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/cerere-concediu-de-odihna"
git status --short -- "$D/cerere-model.ts" "$D/cerere-model.test.ts"
git fetch origin main
git add -- "$D/cerere-model.ts" "$D/cerere-model.test.ts"
git commit --only -m "$(cat <<'MSG'
feat(unelte): un singur cititor al cererii, pentru pagină și pentru fișier

Probleme (opresc documentul) și avertismente (pe pagină, nu în document):
art. 148 alin. (4) și (5), reportul de 18 luni, cele 8 săptămâni de la
naștere, cele 5 zile de îngrijitor, luna de dinaintea formării. Scrisoarea are
anul concediului, departamentul, nr. de înregistrare, „Se aprobă / Nu se
aprobă” și soldul. Fracțiuni până la trei.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- "$D/cerere-model.ts" "$D/cerere-model.test.ts"
git merge origin/main
git push origin main
```

---

### Task F11: Previzualizarea HTML a scrisorii

**Fișiere:**
- Create: `src/app/(marketing)/_componente/scrisoare.tsx`
- Test: `src/app/(marketing)/_componente/scrisoare.test.tsx`, în proiectul `ui` (happy-dom)

**Interfețe:**
- Consumă: `type Scrisoare` (F8). Testul folosește `citesteCererea`, `scrisoareaCererii` (F10), `TIPURI_CERERE` (F7) și `SEMNATURA_FISIER`.
- Produce: `export function ScrisoarePrevizualizata({ scrisoare }: { scrisoare: Scrisoare }): JSX.Element` (componentă de server, fără `"use client"`).

- [ ] **Pasul 1: Scrie testul care pică.** Creează `scrisoare.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  citesteCererea,
  scrisoareaCererii,
} from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-model";
import { TIPURI_CERERE } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/variante";
import { SEMNATURA_FISIER } from "@/lib/unelte/document-tabelar";

import { ScrisoarePrevizualizata } from "./scrisoare";

/**
 * Auditul din 8 oct 2026: previzualizarea variantelor „fără plată” și
 * „eveniment” nu avea linii de semnătură, deși fișierele le aveau. Acum toate
 * variantele trec prin aceeași componentă, din același model ca fișierele.
 */
const PARAMETRI = {
  salariat: "Ilie Maria",
  angajator: "Exemplu SRL",
  de_la: "2026-11-16",
  pana_la: "2026-11-20",
  data: "2026-09-01",
  prog_de_la: "2026-11-12",
  prog_pana_la: "2026-11-25",
};

describe("previzualizarea scrisorii", () => {
  it.each(TIPURI_CERERE)(
    "%s: pe ecran sunt semnătura salariatului și rubrica angajatorului",
    (tip) => {
      const parametri =
        tip === "reprogramare"
          ? { ...PARAMETRI, tip, prog_de_la: "2026-08-03", prog_pana_la: "2026-08-07" }
          : { ...PARAMETRI, tip };
      const citita = citesteCererea(new URLSearchParams(parametri), "2026-09-01");
      expect(citita.probleme).toEqual([]);
      const { getByText, container } = render(
        <ScrisoarePrevizualizata scrisoare={scrisoareaCererii(citita)} />,
      );
      for (const t of [
        "Către: Exemplu SRL",
        "CERERE",
        "Semnătura salariatului",
        "Se completează de angajator",
        "☐ Se aprobă / ☐ Nu se aprobă",
        "Șef ierarhic",
        "Resurse umane",
        "Conducătorul unității",
      ]) {
        expect(getByText(t), `${tip}: ${t}`).toBeTruthy();
      }
      expect(container.textContent).not.toContain(SEMNATURA_FISIER);
    },
  );

  it("„Către” la dreapta și „CERERE” centrat, ca în fișiere", () => {
    const citita = citesteCererea(new URLSearchParams(PARAMETRI), "2026-09-01");
    const { getByText } = render(<ScrisoarePrevizualizata scrisoare={scrisoareaCererii(citita)} />);
    expect(getByText("Către: Exemplu SRL").className).toContain("text-right");
    expect(getByText("CERERE").className).toContain("text-center");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/scrisoare.test.tsx"
```

Așteptat: `Failed to resolve import "./scrisoare"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `scrisoare.tsx`:

```tsx
import type { Scrisoare } from "@/lib/unelte/scrisoare";

/**
 * Previzualizarea unei `Scrisoare` — același obiect din care se fac PDF-ul și
 * Word-ul, deci aceleași rânduri, în aceeași ordine, cu aceleași semnături.
 *
 * Până pe 8 oct 2026 cererea de odihnă avea un `<article>` scris de mână, iar
 * variantele treceau prin previzualizarea tabelară, fără nicio linie de
 * semnătură: ce tipărea omul din browser nu avea unde să semneze.
 *
 * `[overflow-wrap:anywhere]`: un nume de 120 de litere fără spațiu ar fi
 * împins pagina lateral la 360 px. Clasele `print:` scot rama și umplutura —
 * pe hârtie, foaia e chiar documentul.
 */
export function ScrisoarePrevizualizata({ scrisoare: s }: { scrisoare: Scrisoare }) {
  return (
    <article
      aria-label={s.titluDocument}
      className="border-mk-rigla mx-auto max-w-[46rem] border p-6 text-[0.9375rem] leading-[1.75] [overflow-wrap:anywhere] sm:p-12 print:max-w-none print:border-0 print:p-0 print:text-[11pt]"
    >
      <p className="text-[0.875rem]">{s.inregistrare}</p>
      <p className="mt-2 text-right">{s.catre}</p>
      <h2 className="font-mk-display mt-10 text-center text-[1.5rem] font-semibold tracking-[0.02em]">
        {s.titlu}
      </h2>
      {s.subtitlu !== null && <p className="text-center">{s.subtitlu}</p>}
      <div className="mt-8 space-y-4">
        {s.paragrafe.map((p, i) => (
          <p key={`${String(i)}-${p.slice(0, 24)}`} className="indent-8 sm:text-justify">
            {p}
          </p>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap items-start justify-between gap-6">
        <p>{s.locSiData}</p>
        <div className="min-w-[12rem] text-center">
          <p>{s.semnatura}</p>
          <span aria-hidden="true" className="border-mk-text/50 mt-10 block border-b" />
        </div>
      </div>
      {s.rubrica !== null && (
        <section
          aria-label={s.rubrica.titlu}
          className="border-mk-rigla mt-12 border-t pt-6 text-[0.875rem]"
        >
          <p className="font-semibold">{s.rubrica.titlu}</p>
          <ul className="mt-2 space-y-1">
            {s.rubrica.randuri.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {s.rubrica.semnaturi.map((eticheta) => (
              <div key={eticheta}>
                <span aria-hidden="true" className="border-mk-text/50 block border-b" />
                <p className="text-mk-text-slab mt-1 text-[0.8125rem]">{eticheta}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {s.note.map((n) => (
        <p key={n} className="text-mk-text-slab mt-6 text-[0.75rem] leading-[1.5]">
          {n}
        </p>
      ))}
    </article>
  );
}
```

- [ ] **Pasul 4: Rulează testele, trec.** Comanda de la pasul 2, apoi lanțul complet.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
C="src/app/(marketing)/_componente"
git status --short -- "$C/scrisoare.tsx" "$C/scrisoare.test.tsx"
git fetch origin main
git add -- "$C/scrisoare.tsx" "$C/scrisoare.test.tsx"
git commit --only -m "$(cat <<'MSG'
feat(unelte): previzualizarea scrisorii, din același model ca fișierele

Toate cele opt variante au pe ecran semnătura salariatului și rubrica
angajatorului — auditul din 8 oct 2026 a găsit „fără plată” și „eveniment”
fără nicio linie de semnătură.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- "$C/scrisoare.tsx" "$C/scrisoare.test.tsx"
git merge origin/main
git push origin main
```

---

### Task F12: Ruta proprie de descărcare și aliasul

**Fișiere:**
- Create: `src/app/api/unelte/cerere-concediu/route.ts`, `src/app/api/unelte/cerere-concediu-de-odihna/route.ts`
- Test: `src/app/api/unelte/cerere-concediu/route.test.ts`
- Modify: `src/lib/unelte/registru.ts` (liniile 1, 11–14, 19), `src/app/api/unelte/[unealta]/route.test.ts` (liniile 9–17)

**Interfețe:**
- Consumă: `cerereDinParametri`, `PAGINA_CERERE` (F10), `randeazaScrisoarePdf`, `randeazaScrisoareDocx` (F9), `EroareIntrare`, `numeFisierSigur`.
- Produce: `export const dynamic = "force-dynamic"`, `export async function GET(cerere: NextRequest): Promise<Response>` pe ambele căi. Comportamentul: fișierul 200 cu `private, no-store`, 400 `text/plain` pentru client de API, 303 spre `PAGINA_CERERE?…#documentul` pentru navigare.

Înainte de a scrie rutele, citește `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (convenția Route Handler în Next 16.3). Rutele de mai jos folosesc doar `GET(cerere: NextRequest)` și `export const dynamic`, la fel ca `src/app/api/unelte/foaie-de-pontaj/route.ts`.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `src/app/api/unelte/cerere-concediu/route.test.ts`:

```ts
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as GETAlias } from "../cerere-concediu-de-odihna/route";
import { GET } from "./route";

const cere = (cale: string, antete: Record<string, string> = {}) =>
  GET(new NextRequest(`http://localhost${cale}`, { headers: antete }));

const BROWSER = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "sec-fetch-mode": "navigate",
};

describe("descărcarea cererii de concediu", () => {
  it("un client de API primește 400 cu motivul, pentru un interval inversat", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?de_la=2026-12-20&pana_la=2026-12-10&format=pdf",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/înaintea/u);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("o dată prezentă dar invalidă e 400, nu un document pe altă perioadă", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?de_la=2036-01-05&pana_la=2036-01-09&format=docx",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/2036/u);
  });

  it("din browser, eroarea întoarce omul pe pagină, cu formularul completat", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?de_la=2026-12-20&pana_la=2026-12-10&salariat=Popa&format=pdf",
      BROWSER,
    );
    expect(r.status).toBe(303);
    const inapoi = r.headers.get("location") ?? "";
    expect(inapoi.startsWith("/unelte/cerere-concediu-de-odihna?")).toBe(true);
    expect(inapoi).toContain("salariat=Popa");
    expect(inapoi).not.toContain("format=");
    expect(inapoi.endsWith("#documentul")).toBe(true);
    // Redirecționarea poartă numele omului în adresă: niciun cache n-o păstrează.
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("ajunge oricare dintre cele două antete de navigare", async () => {
    const cale = "/api/unelte/cerere-concediu?de_la=2026-11-14&pana_la=2026-11-15&format=pdf";
    expect((await cere(cale, { "sec-fetch-mode": "navigate" })).status).toBe(303);
    expect((await cere(cale, { accept: "text/html" })).status).toBe(303);
    expect((await cere(cale, { accept: "*/*" })).status).toBe(400);
  });

  it("un format necunoscut e refuzat; Excel nu mai e servit; majusculele trec", async () => {
    const baza = "/api/unelte/cerere-concediu?de_la=2026-11-16&pana_la=2026-11-20";
    expect((await cere(`${baza}&format=xlsx`)).status).toBe(400);
    expect((await cere(`${baza}&format=exe`)).status).toBe(400);
    const word = await cere(`${baza}&format=DOCX`);
    expect(word.status).toBe(200);
    expect(word.headers.get("content-type")).toContain("wordprocessingml");
  });

  it("Word: scrisoarea, cu numele fișierului, fără cache public, subsolul spre pagină", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?de_la=2026-11-16&pana_la=2026-11-20&format=docx",
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toBe(
      'attachment; filename="cerere-odihna-2026-11-16.docx"',
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    expect((await zip.file("word/document.xml")?.async("string")) ?? "").toContain("CERERE");
    expect((await zip.file("word/_rels/footer1.xml.rels")?.async("string")) ?? "").toMatch(
      /\/unelte\/cerere-concediu-de-odihna\?utm_source=fisier/u,
    );
  });

  it("adresa cu slug-ul paginii dă același fișier", async () => {
    const r = await GETAlias(
      new NextRequest(
        "http://localhost/api/unelte/cerere-concediu-de-odihna?de_la=2026-11-16&pana_la=2026-11-20&format=pdf",
      ),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
  });
});
```

În `src/app/api/unelte/[unealta]/route.test.ts`, blocul vechi:

```ts
  it("o cerere cu interval inversat primește 400 cu motivul, nu un fișier", async () => {
    const r = await cere(
      "/api/unelte/cerere-concediu?tip=odihna&de_la=2026-12-20&pana_la=2026-12-10&format=pdf",
      "cerere-concediu",
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toMatch(/\S/u);
  });

  it("o unealtă necunoscută primește 404", async () => {
    expect((await cere("/api/unelte/constructor", "constructor")).status).toBe(404);
  });
```

devine (testul de 400 s-a mutat în ruta proprie):

```ts
  it("o unealtă necunoscută primește 404", async () => {
    expect((await cere("/api/unelte/constructor", "constructor")).status).toBe(404);
  });

  it("cererea de concediu nu mai trece pe aici: are ruta ei, cu scrisoarea", async () => {
    // Ruta statică `/api/unelte/cerere-concediu` are prioritate în Next; registrul
    // nu mai are intrarea, deci un apel direct aici nu produce formularul vechi.
    expect((await cere("/api/unelte/cerere-concediu", "cerere-concediu")).status).toBe(404);
  });
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/app/api/unelte/
```

Așteptat: `Failed to resolve import "./route"` în `cerere-concediu/route.test.ts` și `expected 200 to be 404` în testul nou din `[unealta]`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `src/app/api/unelte/cerere-concediu/route.ts`:

```ts
import type { NextRequest } from "next/server";

import {
  cerereDinParametri,
  PAGINA_CERERE,
} from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-model";
import { EroareIntrare, numeFisierSigur } from "@/lib/unelte/document-tabelar";
import { randeazaScrisoareDocx } from "@/lib/unelte/scrisoare-docx";
import { randeazaScrisoarePdf } from "@/lib/unelte/scrisoare-pdf";

/**
 * Descărcarea cererii de concediu: `/api/unelte/cerere-concediu?format=pdf|docx&…`.
 *
 * ── DE CE RUTĂ PROPRIE ─────────────────────────────────────────────────────
 * Ruta comună `/api/unelte/[unealta]` randează `DocumentTabelar`, adică un
 * formular. Cererea e o scrisoare (`src/lib/unelte/scrisoare.ts`), cu altă
 * randare. Ruta statică are prioritate față de cea dinamică, deci adresa
 * rămâne aceeași. Excel nu mai e servit: o cerere de semnat nu e un tabel, iar
 * pagina nu l-a oferit niciodată.
 *
 * ── ERORILE ────────────────────────────────────────────────────────────────
 * Butoanele „Descarcă” trimit formularul direct aici. O intrare greșită
 * întorcea omul pe o pagină goală, `text/plain`, fără formular (auditul din 8
 * oct 2026). Acum, pentru o navigare din browser, eroarea e un 303 înapoi la
 * pagina uneltei, cu aceiași parametri — pagina recitește parametrii și arată
 * problema lângă formular. Un client de API primește în continuare 400, cu
 * motivul în corp.
 *
 * ── FĂRĂ SESIUNE, FĂRĂ BAZĂ, FĂRĂ CACHE PUBLIC ─────────────────────────────
 * Intrările sunt parametri normalizați și plafonați. Răspunsul conține nume de
 * oameni, deci `private, no-store`: nici Cloudflare, nici un proxy nu-l
 * păstrează.
 */
export const dynamic = "force-dynamic";

type FormatCerere = "pdf" | "docx";

const TIP: Readonly<Record<FormatCerere, string>> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const FARA_CACHE = "private, no-store";

/** Lipsa formatului înseamnă PDF; un format prezent dar necunoscut e o eroare. */
function citesteFormat(brut: string | null): FormatCerere | null {
  const valoare = (brut ?? "").trim().toLowerCase();
  if (valoare === "") return "pdf";
  return valoare === "pdf" || valoare === "docx" ? valoare : null;
}

/** O navigare din browser (formularul paginii), nu un `curl` sau un script. */
function esteNavigare(cerere: Request): boolean {
  return (
    cerere.headers.get("sec-fetch-mode") === "navigate" ||
    (cerere.headers.get("accept") ?? "").includes("text/html")
  );
}

export async function GET(cerere: NextRequest): Promise<Response> {
  const q = cerere.nextUrl.searchParams;
  try {
    const format = citesteFormat(q.get("format"));
    if (format === null) {
      throw new EroareIntrare(
        `Formatul „${(q.get("format") ?? "").slice(0, 20)}” nu există: pdf sau docx.`,
      );
    }
    const scrisoare = cerereDinParametri(q);
    const continut =
      format === "pdf"
        ? await randeazaScrisoarePdf(scrisoare)
        : await randeazaScrisoareDocx(scrisoare);
    return new Response(new Uint8Array(continut), {
      headers: {
        "content-type": TIP[format],
        "content-disposition": `attachment; filename="${numeFisierSigur(scrisoare.numeFisier)}.${format}"`,
        "cache-control": FARA_CACHE,
      },
    });
  } catch (eroare) {
    if (!(eroare instanceof EroareIntrare)) throw eroare;
    if (esteNavigare(cerere)) {
      const inapoi = new URLSearchParams(q);
      inapoi.delete("format");
      const sir = inapoi.toString();
      return new Response(null, {
        status: 303,
        headers: {
          location: `${PAGINA_CERERE}${sir === "" ? "" : `?${sir}`}#documentul`,
          "cache-control": FARA_CACHE,
        },
      });
    }
    return new Response(eroare.message, {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": FARA_CACHE },
    });
  }
}
```

Creează `src/app/api/unelte/cerere-concediu-de-odihna/route.ts`:

```ts
import type { NextRequest } from "next/server";

import { GET as descarcaCererea } from "../cerere-concediu/route";

/**
 * Adresa cu slug-ul PAGINII (`/unelte/cerere-concediu-de-odihna`) dădea 404,
 * deși toate celelalte unelte au API-ul la același slug ca pagina (auditul
 * transversal din 8 oct 2026). Aceeași descărcare, sub ambele adrese.
 */
export const dynamic = "force-dynamic";

export function GET(cerere: NextRequest): Promise<Response> {
  return descarcaCererea(cerere);
}
```

În `src/lib/unelte/registru.ts`, scoate linia 1:

```ts
import { cerereDinParametri } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere-document";
```

Comentariul:

```ts
/**
 * Uneltele servite de `/api/unelte/[unealta]`. Foaia de pontaj NU e aici: are
 * ruta ei statică, cu Excel pe formule, iar ruta statică are prioritate.
 */
```

devine:

```ts
/**
 * Uneltele servite de `/api/unelte/[unealta]`. Două NU sunt aici, fiindcă au
 * rută statică, iar ruta statică are prioritate: foaia de pontaj (Excel pe
 * formule) și cererea de concediu (o scrisoare, nu un formular tabelar —
 * `src/app/api/unelte/cerere-concediu/route.ts`).
 */
```

Și scoate intrarea `  "cerere-concediu": cerereDinParametri,` din `UNELTE`.

- [ ] **Pasul 4: Rulează testele, trec.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/app/api/unelte/ src/lib/unelte/
```

Apoi lanțul complet. `cerere-document.ts` rămâne pe disc până la F14, folosit doar de pagina veche.

- [ ] **Verificare pe serverul de dezvoltare: ruta statică bate ruta dinamică.** Testul unitar cheamă handler-ul direct și nu dovedește rutarea. Pornește serverul în fundal, într-un apel separat:

```bash
cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917
```

Apoi, în alt apel:

```bash
B=http://127.0.0.1:3917/api/unelte
curl -s -o /dev/null -w "%{http_code}\n" "$B/cerere-concediu?de_la=2026-11-16&pana_la=2026-11-20&format=xlsx"            # 400 (ruta veche dădea 200)
curl -s -o /dev/null -w "%{http_code}\n" "$B/cerere-concediu-de-odihna?de_la=2026-11-16&pana_la=2026-11-20&format=pdf"   # 200 (era 404)
curl -s -D - -o /dev/null -H "Accept: text/html" "$B/cerere-concediu?de_la=2026-12-20&pana_la=2026-12-10" | grep -iE "^(HTTP|location|cache-control)"
# HTTP/1.1 303 · location: /unelte/cerere-concediu-de-odihna?de_la=…#documentul · cache-control: private, no-store
```

Oprește serverul într-un apel SEPARAT, cu un tipar care nu se potrivește cu el însuși: `pkill -f "next dev -H 127.0.0.1 -p 391[7]"`. Apoi `rm -rf .next/dev/types` și `pnpm typecheck`, fiindcă oprirea corupe `validator.ts` și `routes.d.ts`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
F="src/app/api/unelte/cerere-concediu/route.ts src/app/api/unelte/cerere-concediu/route.test.ts src/app/api/unelte/cerere-concediu-de-odihna/route.ts"
git status --short -- $F src/lib/unelte/registru.ts "src/app/api/unelte/[unealta]/route.test.ts"
git fetch origin main
git diff --name-only HEAD origin/main -- src/lib/unelte/ src/app/api/unelte/
git add -- $F
git commit --only -m "$(cat <<'MSG'
fix(unelte): cererea de concediu are ruta ei — 303 înapoi pe pagină, fără cache public

Descărcarea cu intervalul inversat lăsa omul pe o pagină text/plain; acum o
navigare din browser se întoarce pe pagină, cu formularul, iar un client de
API primește 400. Datele greșite se refuză, Excel nu mai e servit, legătura
din fișier duce la pagina uneltei (ducea la /unelte/cerere-concediu, 404), iar
/api/unelte/cerere-concediu-de-odihna nu mai dă 404. private, no-store: fișierul
poartă nume de oameni.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- $F src/lib/unelte/registru.ts "src/app/api/unelte/[unealta]/route.test.ts"
git merge origin/main
git push origin main
```

---

### Task F13: Calculatorul de zile de concediu cuvenite

**Fișiere:**
- Create: `src/app/(marketing)/unelte/calculator-zile-concediu/calcul.ts`, `…/page.tsx`
- Test: `…/calculator-zile-concediu/calcul.test.ts`
- Modify: `src/content/landing/unelte.ts` (după `ANTET_CERERE_CONCEDIU`), `src/content/landing/harta.ts` (după intrarea `/unelte/cerere-concediu-de-odihna` și intrările `/unelte`, `/`, `/en`), `src/app/llms.txt/route.ts` (înaintea lui `/unelte/condica-de-prezenta`), `src/content/landing/legaturi.ts` (înaintea lui `/unelte/calculator-salariu`), `src/app/(marketing)/unelte/page.tsx` (importul și `PAGINI`), `src/content/landing/ro.ts` și `src/content/landing/en.ts` (`unelteGratuite.unelte`: testul „uneltele de pe pagina de start sunt chiar paginile din /unelte” cere ca lista să conțină fiecare pagină `/unelte/*`)

**Interfețe:**
- Consumă: `citesteData` (F4), `calculeazaAcumulareProportionala(dataAngajarii: Date, an: number, dreptAnual: number, modRotunjire: ModRotunjire, astazi: Date): number` și `rotunjesteZileConcediu(valoare: number, mod: ModRotunjire): number` din `@/domain/leave/sold`, `zileLucratoareText` (F6), `AN_MIN`/`AN_MAX` (F4).
- Produce: `DREPT_MINIM = 20`, `SUPLIMENT_MINIM = 3`, `type IntrareCalcul`, `type RezultatCalcul = Readonly<{ dreptTotal; luniLucrate; proportional; inJos; inSus; anIntreg: boolean }>`, `type CitireCalcul`, `export function citesteCalculul(q: URLSearchParams, anCurent: number): CitireCalcul`, `export function calculeaza(i: IntrareCalcul): RezultatCalcul`, `export const ANTET_CALCULATOR_CONCEDIU: AntetPagina`.

Înainte de pagină, citește `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` pentru `generateMetadata`. Pagina folosește același tipar ca cererea: `searchParams: Promise<…>` și `generateMetadata()` fără argumente.

- [ ] **Pasul 1: Scrie testul care pică.** Creează `calcul.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { calculeaza, citesteCalculul, DREPT_MINIM } from "./calcul";

const citeste = (parametri: Record<string, string>) =>
  citesteCalculul(new URLSearchParams(parametri), 2026);

describe("zilele de concediu cuvenite într-un an", () => {
  it("fără nimic completat: anul curent, minimul legal, an întreg", () => {
    const { intrare, probleme } = citeste({});
    expect(probleme).toEqual([]);
    expect(intrare).toEqual({
      an: 2026,
      dreptAnual: DREPT_MINIM,
      suplimentar: 0,
      dataAngajarii: null,
      dataIncetarii: null,
    });
    expect(calculeaza(intrare)).toEqual({
      dreptTotal: 20,
      luniLucrate: 12,
      proportional: 20,
      inJos: 20,
      inSus: 20,
      anIntreg: true,
    });
  });

  it("angajat pe 15 martie: martie–decembrie, 10 luni din 12", () => {
    const r = calculeaza(citeste({ drept: "20", angajare: "2026-03-15" }).intrare);
    expect(r.luniLucrate).toBe(10);
    expect(r.proportional).toBe(16.67);
    expect(r.inJos).toBe(16);
    expect(r.inSus).toBe(17);
    expect(r.anIntreg).toBe(false);
  });

  it("plecat pe 10 septembrie, angajat de ani buni: ianuarie–septembrie", () => {
    const r = calculeaza(
      citeste({ drept: "21", angajare: "2024-05-02", incetare: "2026-09-10" }).intrare,
    );
    expect(r.luniLucrate).toBe(9);
    expect(r.proportional).toBe(15.75);
  });

  it("zilele suplimentare din art. 147 se adună la drept", () => {
    expect(calculeaza(citeste({ drept: "21", suplimentar: "3" }).intrare).dreptTotal).toBe(24);
  });

  it("sub minimul legal, date greșite și date în ordine inversă sunt refuzate", () => {
    expect(citeste({ drept: "18" }).probleme.join(" ")).toMatch(/art\. 145 alin\. \(1\)/u);
    expect(citeste({ angajare: "2036-01-01" }).probleme.join(" ")).toMatch(/2036/u);
    expect(citeste({ angajare: "2026-09-01", incetare: "2026-03-01" }).probleme.join(" ")).toMatch(
      /înaintea datei angajării/u,
    );
    expect(citeste({ an: "2026", angajare: "2027-02-01" }).probleme.join(" ")).toMatch(
      /după anul 2026/u,
    );
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/calculator-zile-concediu/"
```

Așteptat: `Failed to resolve import "./calcul"`.

- [ ] **Pasul 3: Implementarea minimă.** Creează `calcul.ts`:

```ts
import { citesteData } from "@/app/(marketing)/unelte/cerere-concediu-de-odihna/cerere";
import { calculeazaAcumulareProportionala, rotunjesteZileConcediu } from "@/domain/leave/sold";

/**
 * Câte zile de concediu de odihnă i se cuvin unui salariat într-un an.
 *
 * ── CE E LEGE ȘI CE E PRACTICĂ ─────────────────────────────────────────────
 * Lege (Codul muncii, forma consolidată de pe legislatie.just.ro, documentul
 * 128647, citită pe 8 oct 2026):
 *  · minimul: 20 de zile lucrătoare pe an — art. 145 alin. (1);
 *  · durata efectivă: cea din contractul individual — art. 145 alin. (2);
 *  · cel puțin 3 zile în plus pentru condiții grele, periculoase sau
 *    vătămătoare, nevăzători, alte persoane cu handicap, tineri sub 18 ani —
 *    art. 147 alin. (1)–(2);
 *  · concediul medical, de maternitate, paternal, de îngrijitor etc. se
 *    consideră activitate prestată — art. 145 alin. (4).
 * Practică, NU lege: proporția „drept ÷ 12 × lunile lucrate” pentru un an
 * lucrat parțial. Codul muncii nu are un articol pentru ea (ghidul
 * `/ghid/concediu-de-odihna` o spune la fel), iar rotunjirea o stabilesc
 * contractul colectiv sau regulamentul intern. Pagina o prezintă ca estimare.
 *
 * ── DE CE `calculeazaAcumulareProportionala` ──────────────────────────────
 * E funcția din modulul de concedii al aplicației (`src/domain/leave/sold.ts`):
 * luna angajării și luna plecării se socotesc întregi, la fel ca în soldul pe
 * care îl vede salariatul în aplicație.
 */

export const DREPT_MINIM = 20;
export const SUPLIMENT_MINIM = 3;
const DREPT_MAXIM = 60;
const SUPLIMENT_MAXIM = 30;

export type IntrareCalcul = Readonly<{
  an: number;
  /** Zilele din contractul individual de muncă. */
  dreptAnual: number;
  /** Zilele suplimentare (art. 147 sau contractul colectiv). */
  suplimentar: number;
  dataAngajarii: string | null;
  dataIncetarii: string | null;
}>;

export type RezultatCalcul = Readonly<{
  dreptTotal: number;
  luniLucrate: number;
  /** Cu două zecimale, nerotunjit. */
  proportional: number;
  inJos: number;
  inSus: number;
  anIntreg: boolean;
}>;

export type CitireCalcul = Readonly<{ intrare: IntrareCalcul; probleme: readonly string[] }>;

export function citesteCalculul(q: URLSearchParams, anCurent: number): CitireCalcul {
  const probleme: string[] = [];
  const intreg = (cheie: string, implicit: number, min: number, max: number, mesaj: string) => {
    const brut = (q.get(cheie) ?? "").trim();
    if (brut === "") return implicit;
    const n = Number(brut);
    if (!Number.isInteger(n) || n < min || n > max) {
      probleme.push(mesaj);
      return implicit;
    }
    return n;
  };
  const data = (cheie: string, eticheta: string) => {
    const citita = citesteData(q.get(cheie) ?? undefined, eticheta);
    if (citita.problema !== null) probleme.push(citita.problema);
    return citita.data;
  };

  const an = intreg("an", anCurent, 2024, 2035, "Anul trebuie să fie între 2024 și 2035.");
  const dreptAnual = intreg(
    "drept",
    DREPT_MINIM,
    DREPT_MINIM,
    DREPT_MAXIM,
    `Zilele din contract trebuie să fie între ${String(DREPT_MINIM)} și ${String(DREPT_MAXIM)}: minimul legal e de 20 de zile lucrătoare — art. 145 alin. (1) din Codul muncii.`,
  );
  const suplimentar = intreg(
    "suplimentar",
    0,
    0,
    SUPLIMENT_MAXIM,
    `Zilele suplimentare trebuie să fie între 0 și ${String(SUPLIMENT_MAXIM)}.`,
  );
  const dataAngajarii = data("angajare", "Data angajării");
  const dataIncetarii = data("incetare", "Data încetării contractului");

  if (dataAngajarii !== null && Number(dataAngajarii.slice(0, 4)) > an) {
    probleme.push(`Data angajării e după anul ${String(an)}: în acel an nu se cuvine nicio zi.`);
  }
  if (dataIncetarii !== null && Number(dataIncetarii.slice(0, 4)) < an) {
    probleme.push(
      `Contractul încetează înainte de anul ${String(an)}: în acel an nu se cuvine nicio zi.`,
    );
  }
  if (dataAngajarii !== null && dataIncetarii !== null && dataIncetarii < dataAngajarii) {
    probleme.push("Data încetării e înaintea datei angajării.");
  }

  return { intrare: { an, dreptAnual, suplimentar, dataAngajarii, dataIncetarii }, probleme };
}

export function calculeaza(i: IntrareCalcul): RezultatCalcul {
  const dreptTotal = i.dreptAnual + i.suplimentar;
  const inceputAn = `${String(i.an)}-01-01`;
  const sfarsitAn = `${String(i.an)}-12-31`;
  const inceput =
    i.dataAngajarii !== null && i.dataAngajarii > inceputAn ? i.dataAngajarii : inceputAn;
  const sfarsit =
    i.dataIncetarii !== null && i.dataIncetarii < sfarsitAn ? i.dataIncetarii : sfarsitAn;
  const luniLucrate = Math.max(0, Number(sfarsit.slice(5, 7)) - Number(inceput.slice(5, 7)) + 1);
  const proportional = calculeazaAcumulareProportionala(
    new Date(`${inceput}T00:00:00Z`),
    i.an,
    dreptTotal,
    "fara_rotunjire",
    new Date(`${sfarsit}T00:00:00Z`),
  );
  return {
    dreptTotal,
    luniLucrate,
    proportional,
    inJos: rotunjesteZileConcediu(proportional, "zi_in_jos"),
    inSus: rotunjesteZileConcediu(proportional, "zi_in_sus"),
    anIntreg: luniLucrate === 12,
  };
}
```

Creează `page.tsx`:

```tsx
// src/app/(marketing)/unelte/calculator-zile-concediu/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_CALCULATOR_CONCEDIU } from "@/content/landing/unelte";
import { todayInBucharest } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { AN_MAX, AN_MIN } from "../cerere-concediu-de-odihna/cerere";
import { zileLucratoareText } from "../cerere-concediu-de-odihna/text-zile";
import { calculeaza, citesteCalculul, DREPT_MINIM, SUPLIMENT_MINIM } from "./calcul";

/**
 * Calculatorul de zile de concediu de odihnă, gratuit, fără cont.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Cererea de concediu numără zilele unei PERIOADE. Întrebarea de dinainte —
 * „câte zile am în anul ăsta, dacă m-am angajat în martie?” — se caută separat
 * și are un concurent direct (folositor.ro, auditul din 8 oct 2026). Răspunsul
 * cinstit are două părți: minimul și suplimentul sunt lege, proporția e
 * practică. Pagina le spune separat.
 *
 * Formular GET, fără JavaScript, ca la celelalte unelte: rezultatul stă în
 * adresă și se poate trimite.
 */
const CALE = "/unelte/calculator-zile-concediu";

export function generateMetadata(): Metadata {
  return metadatePagina({
    titlu: `Calculator zile de concediu de odihnă ${todayInBucharest().slice(0, 4)}`,
    descriere:
      "Câte zile de concediu de odihnă ți se cuvin în anul angajării sau al plecării: minimul legal, zilele suplimentare și calculul proporțional. Gratuit, fără cont.",
    cale: CALE,
  });
}

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

/** Zile cu zecimale, în formatul românesc: „16,67”. */
const zecimal = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });

export default async function PaginaCalculatorConcediu({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(p)) {
    const v = Array.isArray(valoare) ? valoare[0] : valoare;
    if (v !== undefined) q.set(cheie, v);
  }
  const anCurent = Number(todayInBucharest().slice(0, 4));
  const { intrare, probleme } = citesteCalculul(q, anCurent);
  const r = probleme.length === 0 ? calculeaza(intrare) : null;

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: CALE,
          nume: ANTET_CALCULATOR_CONCEDIU.titlu,
          descriere: ANTET_CALCULATOR_CONCEDIU.lead,
        })}
      />
      <AntetSecundar
        text={ANTET_CALCULATOR_CONCEDIU}
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Unelte", href: "/unelte" },
          { eticheta: "Zile de concediu", href: CALE },
        ]}
      />

      <Banda inaltime="scurta">
        <form action="#rezultat" method="get" className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Anul</span>
            <input
              type="number"
              name="an"
              min={AN_MIN}
              max={AN_MAX}
              defaultValue={q.get("an") ?? String(intrare.an)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Zile pe an în contract</span>
            <input
              type="number"
              name="drept"
              min={DREPT_MINIM}
              max={60}
              defaultValue={q.get("drept") ?? String(intrare.dreptAnual)}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Zile suplimentare</span>
            <input
              type="number"
              name="suplimentar"
              min={0}
              max={30}
              defaultValue={q.get("suplimentar") ?? String(intrare.suplimentar)}
              className={CLASA_CAMP}
            />
            <span className="text-mk-text-slab text-[0.8125rem]">
              Condiții grele, handicap, sub 18 ani: cel puțin {SUPLIMENT_MINIM} — art. 147.
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">
              Data angajării (dacă e în anul ales)
            </span>
            <input
              type="date"
              name="angajare"
              defaultValue={q.get("angajare") ?? ""}
              min={`${String(AN_MIN)}-01-01`}
              max={`${String(AN_MAX)}-12-31`}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.875rem] font-medium">Data plecării (dacă e în anul ales)</span>
            <input
              type="date"
              name="incetare"
              defaultValue={q.get("incetare") ?? ""}
              min={`${String(AN_MIN)}-01-01`}
              max={`${String(AN_MAX)}-12-31`}
              className={CLASA_CAMP}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="bg-mk-cerneala text-mk-text-inv font-mk-date w-full px-4 py-2.5 text-[0.8125rem] tracking-[0.08em] uppercase"
            >
              Calculează
            </button>
          </div>
        </form>
      </Banda>

      <Banda id="rezultat" inaltime="scurta">
        {r === null ? (
          <div role="alert" className="border-mk-rigla border p-4 text-[0.9375rem]">
            <p className="font-medium">Nu se poate calcula așa:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {probleme.map((pr) => (
                <li key={pr}>{pr}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="max-w-[62ch] space-y-3 text-[1rem] leading-[1.7]">
            <p>
              Dreptul pe un an întreg: <strong>{zileLucratoareText(r.dreptTotal)}</strong>
              {intrare.suplimentar > 0
                ? ` (${String(intrare.dreptAnual)} din contract și ${String(intrare.suplimentar)} suplimentare)`
                : ""}
              .
            </p>
            {r.anIntreg ? (
              <p>
                Lucrați tot anul {intrare.an}, deci vi se cuvine dreptul întreg:{" "}
                <strong>{zileLucratoareText(r.dreptTotal)}</strong>.
              </p>
            ) : (
              <>
                <p>
                  În {intrare.an} lucrați {r.luniLucrate} luni din 12. Proporțional: {r.dreptTotal}{" "}
                  ÷ 12 × {r.luniLucrate} = <strong>{zecimal(r.proportional)} zile</strong> —
                  rotunjit în jos {zileLucratoareText(r.inJos)}, în sus{" "}
                  {zileLucratoareText(r.inSus)}.
                </p>
                <p className="text-mk-text-slab text-[0.9375rem]">
                  Proporția e practica uzuală, nu un articol din Codul muncii; rotunjirea o
                  stabilesc contractul colectiv sau regulamentul intern. Luna angajării și cea a
                  plecării se socotesc întregi, ca în modulul de concedii din aplicație.
                </p>
              </>
            )}
            <p>
              <Link
                href={`/unelte/cerere-concediu-de-odihna?an=${String(intrare.an)}#documentul`}
                className="underline underline-offset-4"
              >
                Fă cererea de concediu pentru anul {intrare.an}, cu zilele lucrătoare calculate
              </Link>
            </p>
          </div>
        )}
      </Banda>

      <Banda
        inaltime="medie"
        supratitlu="Ce spune legea"
        titlu="Ce e lege și ce e doar obicei"
        lead="Patru reguli din Codul muncii stabilesc dreptul. Proporția pentru un an lucrat parțial nu e una dintre ele."
      >
        <div className="border-mk-rigla/40 mt-8 border-t">
          {[
            {
              titlu: "Cel puțin 20 de zile lucrătoare",
              text: "Art. 145 alin. (1): durata minimă a concediului de odihnă anual e de 20 de zile lucrătoare. Durata efectivă se scrie în contractul individual de muncă — alin. (2) — și poate fi mai mare, niciodată mai mică.",
            },
            {
              titlu: "Zile suplimentare, cel puțin 3",
              text: "Art. 147: salariații din condiții grele, periculoase sau vătămătoare, nevăzătorii, alte persoane cu handicap și tinerii sub 18 ani au un concediu suplimentar de cel puțin 3 zile lucrătoare, stabilit prin contractul colectiv aplicabil.",
            },
            {
              titlu: "Concediul medical nu taie zile",
              text: "Art. 145 alin. (4): incapacitatea temporară de muncă, concediile de maternitate, paternal, de risc maternal, pentru îngrijirea copilului bolnav, de îngrijitor și absența din art. 152² se consideră activitate prestată.",
            },
            {
              titlu: "Proporția: practică, nu articol",
              text: "Pentru un an lucrat parțial, „dreptul ÷ 12 × lunile lucrate” e formula folosită peste tot, dar nu are un articol în Codul muncii: vine din contractele colective și din practică. Verificați contractul colectiv aplicabil și regulamentul intern.",
            },
          ].map((rand) => (
            <div
              key={rand.titlu}
              className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
            >
              <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                {rand.titlu}
              </h3>
              <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
                {rand.text}
              </p>
            </div>
          ))}
        </div>
      </Banda>

      <Banda
        inaltime="medie"
        supratitlu="Fără calcule de mână"
        titlu="Soldul de concediu, ținut de aplicație"
        lead="În Administrativo, dreptul fiecărui om se calculează din contract și din regulile firmei, iar soldul scade singur la fiecare cerere aprobată."
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={RO.hero.ctaPrimar.href}
            data-umami-event="cta-calculator-concediu"
            className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {RO.hero.ctaPrimar.eticheta}
          </Link>
          <Link
            href="/module/concedii"
            className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
          >
            Cum funcționează modulul Concedii
          </Link>
        </div>
        <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/calculator-zile-concediu"]} />
      </Banda>
    </Cadru>
  );
}
```

În `src/content/landing/unelte.ts`, după blocul `ANTET_CERERE_CONCEDIU` (care se termină în `…cu motivul lângă fiecare.",\n};`), adaugă:

```ts

/**
 * Perechea cererii: înainte de „ce perioadă”, „câte zile am”. Proporția pentru
 * un an lucrat parțial e prezentată ca practică, nu ca lege — ca în ghidul
 * `/ghid/concediu-de-odihna`.
 */
export const ANTET_CALCULATOR_CONCEDIU: AntetPagina = {
  supratitlu: "Unealtă gratuită",
  titlu: "Calculator de zile de concediu de odihnă",
  lead: "Câte zile de concediu ți se cuvin pe an și cât din ele dacă te-ai angajat sau pleci în cursul anului: minimul legal, zilele suplimentare și calculul proporțional, cu ce e lege și ce e doar practică.",
};
```

În `src/content/landing/harta.ts`, după blocul cu `cale: "/unelte/cerere-concediu-de-odihna"`, adaugă intrarea de mai jos. Pune `actualizat` la data commitului (`date +%F`); `2026-10-09` e doar exemplul.

```ts
  {
    cale: "/unelte/calculator-zile-concediu",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-09",
    sectiune: "Unelte și comparații",
  },
```

În același fișier, la intrarea `/unelte`:

```ts
    // 6 oct: titlul și descrierea numesc toate cele șapte unelte.
    actualizat: "2026-10-07",
```

→

```ts
    // 6 oct: titlul și descrierea numesc toate cele șapte unelte.
    // 9 oct: al optulea rând, calculatorul de zile de concediu.
    actualizat: "2026-10-09",
```

La `/` (după linia `// 7 oct: catalogul de module, …`) și la `/en` (după `// 7 oct: același catalog, în engleză.`), adaugă comentariul `// 9 oct: cardul calculatorului de zile de concediu în banda de unelte (ro.ts/en.ts).` și ridică `actualizat` la data commitului. Poarta lastmod nu vede `ro.ts`, deci data se ridică de mână, cum spune comentariul de la `/`.

În `src/app/llms.txt/route.ts`, înaintea elementului `[\n    "/unelte/condica-de-prezenta",`, adaugă:

```ts
  [
    "/unelte/calculator-zile-concediu",
    "Unealtă gratuită: câte zile de concediu de odihnă se cuvin într-un an — minimul de 20 de zile lucrătoare (art. 145 alin. (1) Codul muncii), zilele suplimentare de cel puțin 3 (art. 147) și estimarea proporțională pentru anul angajării sau al plecării, prezentată ca practică, nu ca regulă legală. Fără cont.",
  ],
```

În `src/content/landing/legaturi.ts`, înaintea cheii `"/unelte/calculator-salariu": [`, adaugă:

```ts
  "/unelte/calculator-zile-concediu": [
    { eticheta: "Concediul de odihnă: zile, programare, report", href: "/ghid/concediu-de-odihna" },
    {
      eticheta: "Cerere de concediu cu zilele calculate",
      href: "/unelte/cerere-concediu-de-odihna",
    },
    { eticheta: "Program de concedii: cerere, aprobare și sold", href: "/module/concedii" },
  ],
```

În `src/app/(marketing)/unelte/page.tsx`, importul:

```ts
import {
  ANTET_CALCULATOR,
  ANTET_CERERE_CONCEDIU,
```

→

```ts
import {
  ANTET_CALCULATOR,
  ANTET_CALCULATOR_CONCEDIU,
  ANTET_CERERE_CONCEDIU,
```

În `PAGINI`, după obiectul cu `href: "/unelte/cerere-concediu-de-odihna"`, adaugă:

```ts
  {
    href: "/unelte/calculator-zile-concediu",
    titlu: ANTET_CALCULATOR_CONCEDIU.titlu,
    lead: ANTET_CALCULATOR_CONCEDIU.lead,
    nota: "minimul legal, zile suplimentare, an lucrat parțial · fără cont",
  },
```

În `src/content/landing/ro.ts`, în `unelteGratuite.unelte`, după obiectul cu `href: "/unelte/cerere-concediu-de-odihna"`:

```ts
      {
        titlu: "Calculator de zile de concediu",
        text: "Câte zile de concediu ți se cuvin pe an și cât din ele în anul angajării sau al plecării.",
        formate: "Online",
        href: "/unelte/calculator-zile-concediu",
      },
```

În `src/content/landing/en.ts`, în același loc:

```ts
      {
        titlu: "Annual leave entitlement calculator",
        text: "How many days of leave you are owed in a year, and how many in the year you join or leave.",
        formate: "Online",
        href: "/unelte/calculator-zile-concediu",
      },
```

- [ ] **Pasul 4: Rulează testele, trec.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/" "src/app/(marketing)/_componente/descrieri.test.ts" src/content/landing/continut.test.ts
```

Așteptat: verzi. Testele de conținut verifică harta, `llms.txt`, legăturile conexe și ancora `#zile-pe-an` nefolosită aici, descrierea între 70 și 160 de caractere (are 159) și unică, nodul `WebApplication`, lista de pe pagina de start și paritatea RO/EN. Apoi lanțul complet, cu `node scripts/checks/lastmod.mjs` verde.

- [ ] **Verificare headless.** Se face în F14, cu același server, pe ambele pagini.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
P="src/app/(marketing)/unelte/calculator-zile-concediu"
git status --short -- "$P" src/content/landing/unelte.ts src/content/landing/harta.ts src/app/llms.txt/route.ts src/content/landing/legaturi.ts "src/app/(marketing)/unelte/page.tsx" src/content/landing/ro.ts src/content/landing/en.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/content/landing/ src/app/llms.txt/ "src/app/(marketing)/unelte/"
git add -- "$P/calcul.ts" "$P/calcul.test.ts" "$P/page.tsx"
git commit --only -m "$(cat <<'MSG'
feat(unelte): calculatorul de zile de concediu cuvenite pe an

Minimul de 20 de zile (art. 145 alin. 1), suplimentul de cel puțin 3 (art.
147) și proporția pentru anul angajării sau al plecării — prezentată ca
practică, nu ca lege, cu ambele rotunjiri. Reutilizează
calculeazaAcumulareProportionala din modulul de concedii. În sitemap, llms.txt,
hub, pagina de start și legăturile conexe.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- "$P/calcul.ts" "$P/calcul.test.ts" "$P/page.tsx" src/content/landing/unelte.ts src/content/landing/harta.ts src/app/llms.txt/route.ts src/content/landing/legaturi.ts "src/app/(marketing)/unelte/page.tsx" src/content/landing/ro.ts src/content/landing/en.ts
git merge origin/main
git push origin main
```

---

### Task F14: Pagina cererii rescrisă pe modelul nou

**Fișiere:**
- Modify (rescris integral): `src/app/(marketing)/unelte/cerere-concediu-de-odihna/page.tsx`. Cele 461 de linii au fost citite integral la scrierea planului.
- Delete: `…/cerere-concediu-de-odihna/cerere-document.ts`, `…/cerere-document.test.ts`
- Modify: `…/cerere.ts` (scoate `normalizeazaData`), `…/cerere.test.ts` (scoate cele 4 aserțiuni `normalizeazaData` și importul), `src/content/landing/harta.ts` (`/unelte/cerere-concediu-de-odihna`, `/unelte`, `/`, `/en`), `src/app/llms.txt/route.ts` (descrierea cererii), `src/app/(marketing)/unelte/page.tsx` (nota cererii), `src/content/landing/ro.ts` și `en.ts` (textul cardului cererii)

**Interfețe:**
- Consumă: `citesteCererea`, `scrisoareaCererii`, `adresaVariantei`, `PAGINA_CERERE` (F10), `ScrisoarePrevizualizata` (F11), `VARIANTE`, `TIPURI_CERERE`, `EVENIMENTE`, `EVENIMENTE_ORDINE` (F7), `sarbatoriText`, `weekendText`, `zileLucratoareText`, `zileText` (F6), `pasteOrtodox`, `pasteGregorian` (F1), `AN_MIN`, `AN_MAX`, `Descarcari`, `PeAcelasiSubiect`, `LEGATURI_CONEXE`, `nodUnealta`, `metadatePagina`.
- Produce: pagina. Parametrii de adresă sunt cei listați în capul lui `cerere-model.ts`. Legăturile vechi `?tip=eveniment&motiv=…` merg în continuare (testat în F10).

Înainte de a scrie pagina, citește `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (`searchParams` ca `Promise`).

- [ ] **Pasul 1: Scrie testul care pică.** Pagina n-are test unitar (convenția proiectului: paginile le acoperă e2e și verificarea headless). Ce o păzește sunt testele existente de conținut. Fă-le întâi roșii, cu ștergerea și curățarea:

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/cerere-concediu-de-odihna"
rm "$D/cerere-document.ts" "$D/cerere-document.test.ts"
```

În `cerere.ts`, scoate blocul (adăugat în F4):

```ts
/**
 * Data din adresă, sau implicitul — și pentru lipsă, și pentru o valoare
 * greșită. Rămâne doar pentru pagina de dinainte de 8 oct 2026; taskul F14
 * o șterge odată cu pagina veche. Codul nou folosește `citesteData`.
 */
export function normalizeazaData(brut: string | undefined, implicit: string): string {
  const data = dinIso((brut ?? "").trim());
  if (data === null) return implicit;
  const an = data.getUTCFullYear();
  return an >= AN_MIN && an <= AN_MAX ? iso(data) : implicit;
}

```

În `cerere.test.ts`, blocul:

```ts
  it("parametrii din adresă se normalizează, nu se cred pe cuvânt", () => {
    expect(normalizeazaData("2026-07-15", "2026-01-01")).toBe("2026-07-15");
    expect(normalizeazaData("1999-07-15", "2026-01-01")).toBe("2026-01-01");
    expect(normalizeazaData("2026-02-31", "2026-01-01")).toBe("2026-01-01");
    expect(normalizeazaData(undefined, "2026-01-01")).toBe("2026-01-01");

    // Un rând nou
```

devine:

```ts
  it("textul din adresă se normalizează, nu se crede pe cuvânt", () => {
    // Un rând nou
```

Iar din importul de la începutul fișierului se scoate linia `  normalizeazaData,`.

- [ ] **Pasul 2: Rulează și vezi roșu.**

```bash
cd /srv/apps/ERP && pnpm typecheck
```

Așteptat: `page.tsx` nu mai compilează (`Cannot find module './cerere-document'` și `Module './cerere' has no exported member 'normalizeazaData'`).

- [ ] **Pasul 3: Implementarea minimă.** Înlocuiește tot `page.tsx` cu:

```tsx
// src/app/(marketing)/unelte/cerere-concediu-de-odihna/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { LEGATURI_CONEXE } from "@/content/landing/legaturi";
import { RO } from "@/content/landing/ro";
import { ANTET_CERERE_CONCEDIU } from "@/content/landing/unelte";
import { pasteGregorian } from "@/domain/calendar/paste-gregorian";
import { pasteOrtodox } from "@/domain/calendar/paste-ortodox";
import { formatDate, todayInBucharest } from "@/lib/format/date";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { Descarcari } from "../../_componente/descarcari";
import { JsonLd } from "../../_componente/json-ld";
import { metadatePagina } from "../../_componente/metadate";
import { nodUnealta } from "../../_componente/noduri-json-ld";
import { PeAcelasiSubiect } from "../../_componente/pe-acelasi-subiect";
import { ScrisoarePrevizualizata } from "../../_componente/scrisoare";
import { AN_MAX, AN_MIN } from "./cerere";
import { adresaVariantei, citesteCererea, PAGINA_CERERE, scrisoareaCererii } from "./cerere-model";
import { sarbatoriText, weekendText, zileLucratoareText, zileText } from "./text-zile";
import { EVENIMENTE, EVENIMENTE_ORDINE, TIPURI_CERERE, VARIANTE } from "./variante";

/**
 * Cererea de concediu, gratuită, fără cont — opt variante, un singur model.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * „Model cerere concediu de odihnă" e o căutare cu intenție limpede și cu o
 * concurență formată aproape numai din fișiere Word de pe bloguri. Toate au
 * același gol: un spațiu în care omul scrie singur numărul de zile. Numărul ăla
 * e greșit des, fiindcă art. 145 alin. (3) din Codul muncii scoate sărbătorile
 * legale din durata concediului, iar cine numără pe calendar le numără.
 *
 * ── CE S-A SCHIMBAT PE 8 OCT 2026 ─────────────────────────────────────────
 * Auditul live a găsit pagina bună ca numărător și săracă ca formular de HR:
 * fără anul concediului, fără departament, fără număr de înregistrare, fără
 * „Se aprobă / Nu se aprobă”, cu variantele fără loc de semnătură pe ecran și
 * cu PDF-ul arătând altfel decât previzualizarea. Acum pagina, PDF-ul și
 * Word-ul citesc aceeași `Scrisoare` (`cerere-model.ts`), iar variantele sunt
 * opt, fiecare cu temeiul ei.
 *
 * ── DE CE FORMULAR GET, FĂRĂ JAVASCRIPT ───────────────────────────────────
 * Parametrii stau în adresă: cererea se poate trimite pe e-mail gata
 * completată, merge cu JavaScript oprit și se tipărește din browser. Varianta
 * se alege din bara de sus (legături), nu dintr-un `<select>`: fără JavaScript,
 * un `<select>` n-ar putea arăta câmpurile variantei alese până la trimitere.
 *
 * ── CE NU FACE ────────────────────────────────────────────────────────────
 * Nu scade zilele libere plătite stabilite prin contractul colectiv sau prin
 * regulamentul intern, deși art. 145 alin. (3) le exclude și pe acelea. Nu le
 * putem cunoaște — sunt ale fiecărei firme. Pagina o spune.
 */
export function generateMetadata(): Metadata {
  return metadatePagina({
    // „Word/PDF gratuit” în titlu: 16 afișări pe poziția 6 și zero clicuri în
    // Search Console (auditul de utilizare din 8 oct 2026). 48 de caractere.
    titlu: `Cerere concediu de odihnă ${todayInBucharest().slice(0, 4)}, Word/PDF gratuit`,
    descriere:
      "Model gratuit de cerere de concediu de odihnă în Word sau PDF, cu zilele lucrătoare calculate. Plus fără plată, paternal, îngrijitor, eveniment. Fără cont.",
    cale: PAGINA_CERERE,
  });
}

type Proprietati = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";

function Camp({
  eticheta,
  ajutor,
  children,
}: Readonly<{ eticheta: string; ajutor?: string; children: ReactNode }>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.875rem] font-medium">{eticheta}</span>
      {children}
      {ajutor !== undefined && (
        <span className="text-mk-text-slab text-[0.8125rem] leading-[1.5]">{ajutor}</span>
      )}
    </label>
  );
}

function CampText({
  nume,
  eticheta,
  valoare,
  maxim,
  exemplu,
}: Readonly<{ nume: string; eticheta: string; valoare: string; maxim: number; exemplu: string }>) {
  return (
    <Camp eticheta={eticheta}>
      <input
        type="text"
        name={nume}
        defaultValue={valoare}
        maxLength={maxim}
        placeholder={exemplu}
        className={CLASA_CAMP}
      />
    </Camp>
  );
}

function CampData({
  nume,
  eticheta,
  valoare,
}: Readonly<{ nume: string; eticheta: string; valoare: string }>) {
  return (
    <Camp eticheta={eticheta}>
      <input
        type="date"
        name={nume}
        defaultValue={valoare}
        min={`${String(AN_MIN)}-01-01`}
        max={`${String(AN_MAX)}-12-31`}
        className={CLASA_CAMP}
      />
    </Camp>
  );
}

export default async function PaginaCerereConcediu({ searchParams }: Proprietati) {
  const p = await searchParams;
  const q = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(p)) {
    const v = Array.isArray(valoare) ? valoare[0] : valoare;
    if (v !== undefined) q.set(cheie, v);
  }

  const citita = citesteCererea(q);
  const o = citita.optiuni;
  const v = VARIANTE[o.tip];
  const scrisoare = citita.probleme.length === 0 ? scrisoareaCererii(citita) : null;
  const [prima] = o.perioade;
  // Valoarea din adresă, așa cum a scris-o omul; altfel cea citită de model.
  const valoare = (cheie: string, implicit: string) => q.get(cheie) ?? implicit;

  const anInceput = Number(prima.deLa.slice(0, 4));
  const pasteIulian = pasteOrtodox(anInceput).toISOString().slice(0, 10);
  const pasteGregorianIso = pasteGregorian(anInceput).toISOString().slice(0, 10);
  const total = citita.calcule.reduce((s, c) => s + c.zileLucratoare, 0);
  const weekend = citita.calcule.reduce((s, c) => s + c.zileWeekend, 0);
  const sarbatori = citita.calcule.reduce((s, c) => s + c.excluse.length, 0);
  const calendaristice = citita.calcule.reduce((s, c) => s + c.zileCalendaristice, 0);
  const cuFractiuni = valoare("de_la_2", "") !== "" || valoare("de_la_3", "") !== "";
  const zileBugetar = EVENIMENTE[o.eveniment].zileBugetar;

  return (
    <Cadru text={RO}>
      <JsonLd
        date={nodUnealta({
          cale: PAGINA_CERERE,
          nume: ANTET_CERERE_CONCEDIU.titlu,
          descriere: ANTET_CERERE_CONCEDIU.lead,
        })}
      />
      {/* `data-tipar="ascunde"` e convenția proiectului: la tipărire rămâne doar
          cererea, fără antet, formular și subsol. */}
      <div data-tipar="ascunde">
        <AntetSecundar
          text={ANTET_CERERE_CONCEDIU}
          firimituri={[
            { eticheta: "Acasă", href: "/" },
            { eticheta: "Unelte", href: "/unelte" },
            { eticheta: "Cerere de concediu", href: PAGINA_CERERE },
          ]}
        />
      </div>

      <Banda inaltime="scurta">
        <div data-tipar="ascunde">
          <nav aria-label="Tipul cererii" className="flex flex-wrap gap-2">
            {TIPURI_CERERE.map((t) => (
              <a
                key={t}
                href={adresaVariantei(q, t)}
                aria-current={t === o.tip ? "page" : undefined}
                className={`rounded border px-3 py-1.5 text-[0.875rem] ${
                  t === o.tip
                    ? "bg-mk-cerneala text-mk-text-inv border-mk-cerneala"
                    : "border-mk-rigla hover:border-mk-text"
                }`}
              >
                {VARIANTE[t].eticheta}
              </a>
            ))}
          </nav>

          <form action="#documentul" method="get" className="mt-6 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="tip" value={o.tip} />
            <CampText
              nume="angajator"
              eticheta="Angajatorul"
              valoare={o.angajator}
              maxim={120}
              exemplu="Firma Exemplu SRL"
            />
            <CampText
              nume="departament"
              eticheta="Departamentul (opțional)"
              valoare={o.departament}
              maxim={80}
              exemplu="Contabilitate"
            />
            <CampText
              nume="salariat"
              eticheta="Numele salariatului"
              valoare={o.salariat}
              maxim={120}
              exemplu="Popescu Ion"
            />
            <CampText
              nume="functie"
              eticheta="Funcția"
              valoare={o.functie}
              maxim={80}
              exemplu="operator"
            />
            <CampText
              nume="localitate"
              eticheta="Localitatea"
              valoare={o.localitate}
              maxim={60}
              exemplu="Timișoara"
            />
            <CampData
              nume="data"
              eticheta="Data cererii"
              valoare={valoare("data", o.dataCererii)}
            />

            {(o.tip === "odihna" || o.tip === "reprogramare") && (
              <Camp eticheta="Concediul aferent anului">
                <select name="an" defaultValue={String(o.anAferent)} className={CLASA_CAMP}>
                  {[anInceput, anInceput - 1, anInceput - 2].map((a) => (
                    <option key={a} value={String(a)}>
                      {a}
                    </option>
                  ))}
                </select>
              </Camp>
            )}

            {(o.tip === "reprogramare" || o.tip === "intrerupere") && (
              <>
                <CampData
                  nume="prog_de_la"
                  eticheta="Concediul programat: de la"
                  valoare={valoare("prog_de_la", "")}
                />
                <CampData
                  nume="prog_pana_la"
                  eticheta="Concediul programat: până la, inclusiv"
                  valoare={valoare("prog_pana_la", "")}
                />
              </>
            )}

            {o.tip === "intrerupere" ? (
              <CampData
                nume="de_la"
                eticheta="Întrerup concediul începând cu"
                valoare={valoare("de_la", prima.deLa)}
              />
            ) : (
              <>
                <CampData
                  nume="de_la"
                  eticheta={o.tip === "reprogramare" ? "Perioada nouă: de la" : "De la"}
                  valoare={valoare("de_la", prima.deLa)}
                />
                <CampData
                  nume="pana_la"
                  eticheta={
                    o.tip === "reprogramare"
                      ? "Perioada nouă: până la, inclusiv"
                      : "Până la, inclusiv"
                  }
                  valoare={valoare("pana_la", prima.panaLa)}
                />
              </>
            )}

            {o.tip === "odihna" && (
              <details className="col-span-full" open={cuFractiuni}>
                <summary className="cursor-pointer text-[0.9375rem] underline underline-offset-4">
                  Concediu împărțit în fracțiuni
                </summary>
                <p className="text-mk-text-slab mt-2 text-[0.875rem] leading-[1.6]">
                  Până la trei perioade în aceeași cerere. Când concediul se împarte, cel puțin o
                  fracțiune din an trebuie să aibă 10 zile lucrătoare neîntrerupte — art. 148 alin.
                  (5) din Codul muncii.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {[2, 3].map((k) => (
                    <Fragment key={k}>
                      <CampData
                        nume={`de_la_${String(k)}`}
                        eticheta={`Fracțiunea ${String(k)}: de la`}
                        valoare={valoare(`de_la_${String(k)}`, "")}
                      />
                      <CampData
                        nume={`pana_la_${String(k)}`}
                        eticheta={`Fracțiunea ${String(k)}: până la`}
                        valoare={valoare(`pana_la_${String(k)}`, "")}
                      />
                    </Fragment>
                  ))}
                </div>
              </details>
            )}

            {o.tip === "eveniment" && (
              <>
                <Camp
                  eticheta="Evenimentul"
                  ajutor={
                    zileBugetar === null
                      ? "Numărul de zile îl dau contractul colectiv sau regulamentul intern."
                      : `La bugetari: ${zileText(zileBugetar)} (HG 250/1992, art. 24). Într-o firmă privată, numărul îl dau contractul colectiv sau regulamentul intern.`
                  }
                >
                  <select name="eveniment" defaultValue={o.eveniment} className={CLASA_CAMP}>
                    {EVENIMENTE_ORDINE.map((e) => (
                      <option key={e} value={e}>
                        {EVENIMENTE[e].eticheta}
                      </option>
                    ))}
                  </select>
                </Camp>
                <Camp eticheta="Zile libere din contract sau regulament (opțional)">
                  <input
                    type="number"
                    name="zile_ccm"
                    min={1}
                    max={30}
                    defaultValue={valoare("zile_ccm", "")}
                    className={CLASA_CAMP}
                  />
                </Camp>
              </>
            )}

            {o.tip === "paternal" && (
              <>
                <CampData
                  nume="nastere"
                  eticheta="Data nașterii copilului"
                  valoare={valoare("nastere", "")}
                />
                <label className="flex items-center gap-2 self-end text-[0.9375rem]">
                  <input
                    type="checkbox"
                    name="puericultura"
                    value="da"
                    defaultChecked={o.puericultura}
                  />
                  Am atestatul de absolvire a cursului de puericultură (+5 zile)
                </label>
              </>
            )}

            {o.tip === "ingrijitor" && (
              <CampText
                nume="persoana"
                eticheta="Cui îi acordați îngrijire"
                valoare={o.persoana}
                maxim={120}
                exemplu="mamei mele, Popescu Maria"
              />
            )}

            {o.tip === "formare" && (
              <>
                <Camp eticheta="Concediul">
                  <select
                    name="plata"
                    defaultValue={o.cuPlata ? "da" : "nu"}
                    className={CLASA_CAMP}
                  >
                    <option value="nu">Fără plată, la inițiativa mea (art. 155–156)</option>
                    <option value="da">Plătit, formare neasigurată de angajator (art. 157)</option>
                  </select>
                </Camp>
                <CampText
                  nume="domeniu"
                  eticheta="Domeniul formării"
                  valoare={o.domeniu}
                  maxim={80}
                  exemplu="contabilitate"
                />
                <CampText
                  nume="institutie"
                  eticheta="Instituția de formare"
                  valoare={o.institutie}
                  maxim={120}
                  exemplu="Universitatea de Vest din Timișoara"
                />
              </>
            )}

            {(o.tip === "fara-plata" ||
              o.tip === "eveniment" ||
              o.tip === "reprogramare" ||
              o.tip === "intrerupere") && (
              <CampText
                nume="motiv"
                eticheta={
                  o.tip === "fara-plata"
                    ? "Motivul (opțional)"
                    : o.tip === "eveniment"
                      ? "Detalii despre eveniment (opțional)"
                      : "Motivele obiective"
                }
                valoare={o.motiv}
                maxim={160}
                exemplu={o.tip === "eveniment" ? "decesul tatălui meu" : "internare în spital"}
              />
            )}

            <Camp
              eticheta="Paștele și Rusaliile, după calendarul"
              ajutor="Art. 139 alin. (2¹): salariații unui cult creștin primesc Vinerea Mare, Paștele și Rusaliile la data cultului lor. Romano-catolicii și reformații le serbează după calendarul gregorian."
            >
              <select name="cult" defaultValue={o.calendar} className={CLASA_CAMP}>
                <option value="ortodox">{`iulian, ortodox (Paștele pe ${formatDate(pasteIulian)})`}</option>
                <option value="gregorian">{`gregorian (Paștele pe ${formatDate(pasteGregorianIso)})`}</option>
              </select>
            </Camp>

            <div className="flex items-end">
              <button
                type="submit"
                className="bg-mk-cerneala text-mk-text-inv font-mk-date w-full px-4 py-2.5 text-[0.8125rem] tracking-[0.08em] uppercase"
              >
                Recalculează
              </button>
            </div>
            <Descarcari
              actiune="/api/unelte/cerere-concediu"
              eveniment="cerere"
              formate={["docx", "pdf"]}
            />
          </form>
        </div>
      </Banda>

      <Banda id="documentul" inaltime="scurta">
        {scrisoare === null ? (
          <div role="alert" className="border-mk-rigla text-mk-text border p-4 text-[0.9375rem]">
            <p className="font-medium">Cererea nu se poate face așa:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {citita.probleme.map((problema) => (
                <li key={problema}>{problema}</li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <ScrisoarePrevizualizata scrisoare={scrisoare} />
            <div className="mt-6 max-w-[46rem] space-y-3" data-tipar="ascunde">
              {v.numaraZile && (
                <p className="text-mk-text-slab text-[0.875rem] leading-[1.6]">
                  Pe calendar: {zileText(calendaristice)}. Nu se numără {weekendText(weekend)} și{" "}
                  {sarbatoriText(sarbatori)}.{" "}
                  <strong className="text-mk-text">Rămân {zileLucratoareText(total)}.</strong>
                </p>
              )}
              {citita.avertismente.length > 0 && (
                <ul className="border-mk-rigla space-y-2 border-l-2 pl-4 text-[0.875rem] leading-[1.6]">
                  {citita.avertismente.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
              <p className="text-mk-text-slab text-[0.875rem] leading-[1.6]">
                Tipăriți pagina din browser — rămâne doar cererea, fără formular și fără meniuri.
                Sau descărcați-o în Word, ca s-o mai modificați înainte de semnare.
              </p>
            </div>
          </>
        )}
      </Banda>

      {/* `Banda` nu primește atribute libere, deci marcajul de tipărire stă pe
          învelișul ei — la fel ca la antet, mai sus. */}
      <div data-tipar="ascunde">
        <Banda
          inaltime="medie"
          supratitlu="Ce spune legea"
          titlu="Cinci reguli care schimbă cererea"
          lead="Codul muncii nu impune un model de cerere. Impune însă lucruri care se văd în ea: numărul de zile, momentul depunerii, fracționarea, plata și zilele cultului."
        >
          <div className="border-mk-rigla/40 mt-8 border-t">
            {[
              {
                titlu: "Sărbătorile legale nu intră în concediu",
                text: "Art. 145 alin. (3) scoate din durata concediului de odihnă atât sărbătorile legale în care nu se lucrează, cât și zilele libere plătite stabilite prin contractul colectiv aplicabil. Pe primele le calculează unealta asta; pe celelalte nu le putem ști, fiindcă sunt ale fiecărei firme — dacă firma ta are așa ceva, scade-le tu din numărul de mai sus.",
              },
              {
                titlu: "Cererea se depune cu 60 de zile înainte",
                text: "Art. 148 alin. (4): în cadrul perioadelor stabilite prin programarea colectivă sau individuală, salariatul poate solicita efectuarea concediului cu cel puțin 60 de zile anterioare efectuării acestuia. Termenul presupune că există o programare — ea se face, potrivit alin. (1), până la sfârșitul anului calendaristic, pentru anul următor.",
              },
              {
                titlu: "Fracțiunile: una de cel puțin 10 zile",
                text: "Art. 148 alin. (5): când concediul se programează fracționat, angajatorul trebuie să-l stabilească astfel încât fiecare salariat să efectueze într-un an cel puțin 10 zile lucrătoare de concediu neîntrerupt. Unealta avertizează când nicio fracțiune din cerere nu le are.",
              },
              {
                titlu: "Alt cult creștin: Paștele cultului",
                text: "Art. 139 alin. (2¹): pentru salariații unui cult creștin, Vinerea Mare, Paștele și Rusaliile se dau la data la care le celebrează cultul. Alegeți calendarul în formular: unealta scade datele cultului, iar cele ortodoxe devin zile lucrătoare pentru dumneavoastră. Cine primește liber la ambele recuperează zilele în plus — alin. (3¹).",
              },
              {
                titlu: "Banii vin înainte de plecare, nu după",
                text: "Art. 150 alin. (3) cere ca indemnizația de concediu să fie plătită cu cel puțin 5 zile lucrătoare înainte de plecare, iar obligația e a angajatorului, fără condiție de cerere din partea salariatului. În practică e ratată aproape peste tot, fiindcă plata se face din același stat de salarii ca restul lunii.",
              },
            ].map((r) => (
              <div
                key={r.titlu}
                className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
              >
                <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                  {r.titlu}
                </h3>
                <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
                  {r.text}
                </p>
              </div>
            ))}
          </div>
        </Banda>

        {/* Celelalte șapte variante, cu temeiul fiecăreia. `id` rămâne cel de
            dinainte de 8 oct 2026, ca legăturile vechi spre secțiune să meargă. */}
        <Banda
          id="alte-cereri"
          inaltime="medie"
          supratitlu="Aceeași unealtă"
          titlu="Fără plată, paternal, îngrijitor, eveniment, formare, reprogramare"
        >
          <div className="border-mk-rigla/40 mt-8 border-t">
            {TIPURI_CERERE.filter((t) => t !== "odihna").map((t) => (
              <div
                key={t}
                className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
              >
                <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                  {VARIANTE[t].titlu}
                </h3>
                <div className="md:col-span-8">
                  <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6]">
                    {VARIANTE[t].temei}
                  </p>
                  <a
                    href={adresaVariantei(new URLSearchParams(), t)}
                    className="mt-2 inline-block text-[0.9375rem] underline underline-offset-4"
                  >
                    {`Fă o ${VARIANTE[t].titlu.charAt(0).toLowerCase()}${VARIANTE[t].titlu.slice(1)}`}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Banda>

        <Banda
          inaltime="medie"
          supratitlu="Fără hârtie"
          titlu="Cererea, aprobarea și soldul, în aplicație"
          lead="În Administrativo, omul cere concediul de pe telefon, șeful îl aprobă dintr-o apăsare, iar zilele se scad singure din sold, fără sărbători și fără weekenduri."
        >
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={RO.hero.ctaPrimar.href}
              data-umami-event="cta-cerere-concediu"
              className="bg-mk-cerneala text-mk-text-inv inline-flex h-12 items-center rounded px-6 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
            >
              {RO.hero.ctaPrimar.eticheta}
            </Link>
            <Link
              href="/vitrina/leave"
              data-umami-event="vitrina-din-cerere"
              className="border-mk-rigla hover:border-mk-text inline-flex h-12 items-center rounded border px-6 text-[0.9375rem] font-medium transition-colors"
            >
              Încearcă ecranul de concedii, fără cont
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
            <Link
              href="/unelte/calculator-zile-concediu"
              className="text-[0.9375rem] underline underline-offset-4"
            >
              Câte zile de concediu ți se cuvin pe an
            </Link>
            <Link href="/module/concedii" className="text-[0.9375rem] underline underline-offset-4">
              Cum funcționează modulul Concedii
            </Link>
          </div>
          <PeAcelasiSubiect legaturi={LEGATURI_CONEXE["/unelte/cerere-concediu-de-odihna"]} />
        </Banda>
      </div>
    </Cadru>
  );
}
```

În `src/app/(marketing)/unelte/page.tsx`, importul:

```ts
import { AN_MAX, AN_MIN, MAX_ANGAJATI } from "./foaie-de-pontaj/foaie";
```

→

```ts
import {
  AN_MAX as AN_MAX_CERERE,
  AN_MIN as AN_MIN_CERERE,
} from "./cerere-concediu-de-odihna/cerere";
import { AN_MAX, AN_MIN, MAX_ANGAJATI } from "./foaie-de-pontaj/foaie";
```

și nota cererii:

```ts
    nota: `${AN_MIN}–${AN_MAX} · zilele lucrătoare calculate · fără cont`,
```

→

```ts
    nota: `${AN_MIN_CERERE}–${AN_MAX_CERERE} · odihnă, fără plată, paternal, îngrijitor · Word, PDF`,
```

În `src/content/landing/ro.ts`:

```ts
        text: "Cu zilele lucrătoare calculate, plus variantele fără plată și pentru evenimente familiale.",
```

→

```ts
        text: "Cu zilele lucrătoare calculate și rubrica angajatorului, plus fără plată, paternal, îngrijitor, eveniment, formare și reprogramare.",
```

În `src/content/landing/en.ts`:

```ts
        text: "With the working days counted, plus unpaid and family-event versions.",
```

→

```ts
        text: "With the working days counted and the employer's section, plus unpaid, paternity, carer's, family-event, training and rescheduling versions.",
```

În `src/app/llms.txt/route.ts`, descrierea cererii:

```ts
    "Unealtă gratuită: cerere de concediu de odihnă gata de tipărit, cu zilele lucrătoare calculate — weekendurile și sărbătorile legale se scad, iar cele scoase se enumeră cu motivul. Plus variantele de concediu fără plată (art. 153) și zile libere pentru evenimente familiale (art. 152). Word sau PDF, fără cont.",
```

→

```ts
    "Unealtă gratuită: cerere de concediu ca scrisoare de semnat, cu zilele lucrătoare calculate — weekendurile și sărbătorile legale se scad și se enumeră cu motivul; cu anul concediului, departamentul, fracțiunile (art. 148 alin. (5)), calendarul Paștelui pentru alte culte creștine (art. 139 alin. (2¹)) și rubrica angajatorului, cu „Se aprobă / Nu se aprobă” și soldul. Opt variante: odihnă, fără plată (art. 153), eveniment familial (art. 152), paternal (Legea 210/1999), îngrijitor (art. 152¹), formare profesională (art. 155–157), reprogramare (art. 149) și întrerupere (art. 151). Word sau PDF, fără cont.",
```

În `src/content/landing/harta.ts`, ridică `actualizat` la data commitului la `/unelte/cerere-concediu-de-odihna`, `/unelte`, `/` și `/en`. La ultimele două adaugă comentariul `// 9 oct: cardul cererii de concediu numește cele opt variante (ro.ts/en.ts).`.

- [ ] **Pasul 4: Rulează testele, trec.**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/" src/content/landing/ src/app/api/unelte/ src/lib/unelte/
```

Așteptat: verzi, inclusiv `descarcari.test.tsx` (`<Descarcari` în `<form`), `descrieri.test.ts` (155 de caractere, unică) și `continut.test.ts`. Acolo trec: titlul fără marcă, `metadatePagina(`, `nodUnealta(`, `LEGATURI_CONEXE["/unelte/cerere-concediu-de-odihna"]`, nicio sedilă în stratul de marketing și lista de pe pagina de start. Apoi lanțul complet, cu `lastmod.mjs` verde.

- [ ] **Verificare headless (pagină, tipar, eroarea din formular).** Pornește serverul ca în F12. Apoi scrie în scratchpad `verifica-cerere.mjs` și rulează-l cu `node verifica-cerere.mjs <director-capturi>`:

```js
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";

const BAZA = "http://127.0.0.1:3917";
const DIR = process.argv[2];
const C = "/unelte/cerere-concediu-de-odihna";
const COMUN = "salariat=Popescu%20Ion&angajator=Exemplu%20SRL&de_la=2026-11-16&pana_la=2026-11-20&data=2026-09-01";
const CAZURI = [
  ["odihna-craciun", `${C}?salariat=Popescu%20Ion&angajator=Exemplu%20SRL&de_la=2026-12-21&pana_la=2027-01-08&data=2026-10-01#documentul`],
  ["fractiuni", `${C}?${COMUN}&de_la_2=2026-12-07&pana_la_2=2026-12-11`],
  ["fara-plata", `${C}?tip=fara-plata&${COMUN}`],
  ["eveniment", `${C}?tip=eveniment&eveniment=casatorie-salariat&zile_ccm=5&${COMUN}`],
  ["paternal", `${C}?tip=paternal&nastere=2026-11-02&${COMUN}`],
  ["ingrijitor", `${C}?tip=ingrijitor&persoana=mamei%20mele&${COMUN}`],
  ["formare", `${C}?tip=formare&plata=da&domeniu=contabilitate&institutie=UVT&${COMUN}`],
  ["reprogramare", `${C}?tip=reprogramare&prog_de_la=2026-08-03&prog_pana_la=2026-08-07&motiv=internare&${COMUN}`],
  ["intrerupere", `${C}?tip=intrerupere&prog_de_la=2026-11-12&prog_pana_la=2026-11-25&motiv=internare&${COMUN}`],
  ["nume-lung", `${C}?salariat=${"Ă".repeat(120)}&angajator=${"Ș".repeat(120)}&de_la=2026-11-16&pana_la=2026-11-20`],
  ["eroare-2036", `${C}?de_la=2036-01-05`],
  ["calculator", "/unelte/calculator-zile-concediu?angajare=2026-03-15"],
];

const browser = await chromium.launch({
  executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
});
for (const latime of [360, 1280]) {
  const pagina = await browser.newPage({ viewport: { width: latime, height: 900 } });
  for (const [nume, cale] of CAZURI) {
    const r = await pagina.goto(BAZA + cale, { waitUntil: "load" });
    const m = await pagina.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      semnatura: document.body.innerText.includes("Semnătura salariatului"),
      rubrica: document.body.innerText.includes("Se aprobă / ☐ Nu se aprobă"),
      alerta: document.querySelector("[role=alert]")?.textContent ?? null,
    }));
    console.log(latime, nume, r?.status(), JSON.stringify(m));
    await pagina.screenshot({ path: `${DIR}/${nume}-${String(latime)}.png`, fullPage: true });
  }
  await pagina.close();
}

// Tipărirea: câte pagini A4 iese cererea.
const tipar = await browser.newPage();
await tipar.goto(BAZA + CAZURI[0][1], { waitUntil: "load" });
await tipar.emulateMedia({ media: "print" });
const pdf = await tipar.pdf({ format: "A4" });
console.log("pagini tipărite:", (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length);

// Descărcarea cu intervalul inversat, din formularul real: omul rămâne pe pagină.
await tipar.emulateMedia({ media: "screen" });
await tipar.goto(`${BAZA}${C}?de_la=2026-12-10&pana_la=2026-12-01`, { waitUntil: "load" });
await Promise.all([tipar.waitForURL(/\/unelte\/cerere-concediu-de-odihna\?/), tipar.click("button[name=format][value=pdf]")]);
console.log("după „Descarcă PDF” cu interval inversat:", tipar.url(), "alerte:", await tipar.locator("[role=alert]").count());
await browser.close();
```

**Trebuie să iasă:**
- pentru fiecare caz și ambele lățimi, `sw === cw`: `360`, fără derulare laterală, inclusiv `nume-lung`;
- `semnatura: true` și `rubrica: true` la toate cele opt variante, plus fracțiuni (defectul „variante fără semnătură” închis);
- `eroare-2036`: `alerta` conține „anul 2036 e în afara intervalului 2024–2035”;
- `calculator`: 200, cu „10 luni din 12” vizibil în captură;
- `pagini tipărite: 1` **dacă secțiunea B e deja pe `main`**. Altfel cifra rămâne 3, din cauza antetului și subsolului din `cadru.tsx`, și se notează ca dependență, nu ca defect al secțiunii F;
- ultima linie: URL-ul paginii uneltei (nu `/api/…`), cu `alerte: 1`.

Citește capturile de la 360 px pentru `odihna-craciun`, `eveniment` și `nume-lung`. Cererea trebuie să arate ca o scrisoare: „Către” la dreapta, „CERERE” centrat, semnătura la dreapta, rubrica cu trei linii. Oprește serverul ca în F12, apoi `rm -rf .next/dev/types` și `pnpm typecheck`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
D="src/app/(marketing)/unelte/cerere-concediu-de-odihna"
git status --short -- "$D" src/content/landing/harta.ts src/app/llms.txt/route.ts "src/app/(marketing)/unelte/page.tsx" src/content/landing/ro.ts src/content/landing/en.ts
git fetch origin main
git diff --name-only HEAD origin/main -- "$D" src/content/landing/ src/app/llms.txt/ "src/app/(marketing)/unelte/page.tsx"
git commit --only -m "$(cat <<'MSG'
feat(unelte): cererea de concediu, formular de HR complet în opt variante

Pagina, PDF-ul și Word-ul citesc aceeași scrisoare: nr. de înregistrare,
anul concediului, departamentul, fracțiunile, calendarul cultului, rubrica
angajatorului cu „Se aprobă / Nu se aprobă” și soldul. Problemele se arată
lângă formular, avertismentele (60 de zile, fracțiunea de 10, termenele
paternal/îngrijitor/formare) sub document, nu în el. Titlul spune „Word/PDF
gratuit” (16 afișări, 0 clicuri pe poziția 6). cerere-document.ts iese.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
)" -- "$D/page.tsx" "$D/cerere.ts" "$D/cerere.test.ts" "$D/cerere-document.ts" "$D/cerere-document.test.ts" src/content/landing/harta.ts src/app/llms.txt/route.ts "src/app/(marketing)/unelte/page.tsx" src/content/landing/ro.ts src/content/landing/en.ts
git merge origin/main
git push origin main
```

---

### Task F15: Verificarea pe producție, după deploy

Fără cod și fără commit. Deploy-ul prin `./administrativo.sh` e o acțiune pe care o confirmă utilizatorul. Taskul începe abia după confirmare și după ce rularea de staging a trecut (memoria `erp-staging-cade-tacut`).

- [ ] **API-ul:**

```bash
B=https://administrativo.ro/api/unelte
curl -s -o /dev/null -w "%{http_code}\n" "$B/cerere-concediu?de_la=2036-01-05&pana_la=2036-01-09&format=docx"   # 400
curl -s -o /dev/null -w "%{http_code}\n" "$B/cerere-concediu?de_la=2026-11-14&pana_la=2026-11-15&format=pdf"   # 400
curl -s -o /dev/null -w "%{http_code}\n" "$B/cerere-concediu?de_la=2026-11-16&pana_la=2026-11-20&format=xlsx"  # 400
curl -s -o /dev/null -w "%{http_code}\n" "$B/cerere-concediu-de-odihna?de_la=2026-11-16&pana_la=2026-11-20&format=pdf"  # 200
curl -s -D - -o /dev/null -H "Accept: text/html" "$B/cerere-concediu?de_la=2026-12-20&pana_la=2026-12-10" | grep -iE "^(HTTP|location|cache-control|cf-cache-status)"
# 303, location relativ spre /unelte/cerere-concediu-de-odihna?…#documentul, private, no-store, cf-cache-status DYNAMIC sau BYPASS
T=$(mktemp -d)   # fișierul descărcat stă în afara arborelui partajat
curl -s -o "$T/c.docx" "$B/cerere-concediu?de_la=2026-11-16&pana_la=2026-11-20&format=docx" && unzip -p "$T/c.docx" word/_rels/footer1.xml.rels | grep -o 'Target="[^"]*"'
curl -sI "https://administrativo.ro/unelte/cerere-concediu-de-odihna?utm_source=fisier&utm_medium=docx&utm_campaign=unelte" | head -1   # 200, nu 404
```

- [ ] **Paginile:** reia scriptul headless din F14 cu `BAZA = "https://administrativo.ro"`. Pagina publică are basic-auth doar pe staging, nu pe producție. Aceleași criterii.
- [ ] **Metadatele:** `curl -s https://administrativo.ro/unelte/cerere-concediu-de-odihna | grep -o '<title>[^<]*'` → „Cerere concediu de odihnă 2026, Word/PDF gratuit · Administrativo”. `/unelte/calculator-zile-concediu` apare în `https://administrativo.ro/sitemap.xml` și în `https://administrativo.ro/llms.txt`.

---

**Review Focus**

1. **Browserul care trimite formularul fără `sec-fetch-mode: navigate` și fără `text/html` în `Accept`.** Ar ateriza pe pagina `text/plain` cu 400, exact defectul reparat. Toate browserele curente trimit cel puțin unul dintre ele la o navigare. Testul din **F12**, „ajunge oricare dintre cele două antete de navigare”, fixează că oricare dintre ele singur dă 303, iar `*/*` (curl) dă 400. Testul 303 verifică și `private, no-store`, fiindcă adresa de întoarcere poartă numele omului.
2. **Lățimile reale DejaVu.** Testele de așezare cu măsura falsă nu văd că „Conducătorul unității” sau un nume de 120 de litere ar ieși din coloană cu fontul real. **F9** are testul „cu fontul real și câmpurile la plafon, nimic nu iese din margini”: `pornesteDocument` adevărat, toate câmpurile la plafon, o pagină.
3. **Un caracter pe care fontul nu-l are (emoji, alfabete exotice) în PDF.** `pdf-lib` desenează glyph-ul lipsă, dar o regresie în fontkit sau în subsetare ar putea arunca, iar o eroare neprinsă din rută e un 500. **F9**: „un caracter pe care fontul nu-l are (emoji) nu oprește documentul”.
4. **Rutarea: ruta statică trebuie să bată `[unealta]`.** Testele unitare cheamă handler-ele direct. Dacă rutarea ar ajunge totuși la ruta comună, testul din **F12** („cererea de concediu nu mai trece pe aici”) garantează 404, nu formularul tabelar vechi cu legătura spre 404. Rutarea reală se verifică prin `curl` pe `next dev` în F12 și pe producție în F15.
5. **Intervalul peste Anul Nou, pe calendarul gregorian.** Sărbătorile se cer pe ani, deci fiecare an trebuie să-și ia Paștele din calendarul ales, nu din cel ortodox. **F5**: „peste Anul Nou, fiecare an își ia Paștele din calendarul ales”, pe 28.12.2026–02.04.2027: 67 de zile ortodox, 65 gregorian, cu 26.03 și 29.03.2027 scăzute. Valorile sunt calculate independent, în Python.
