## C. Calculatorul de salariu: corect la intrare, complet ca funcții

**Scop:** calculatorul de la `/unelte/calculator-salariu` citește suma așa cum o scrie un român, nu mai produce niciun brut ilegal sau rezultat pentru altă cifră decât cea cerută, și acoperă tot ce au calculatoarele gratuite concurente (perioadele lui 2026, deducerile suplimentare, tichetele, timpul parțial, scutirea pentru handicap, costul pentru firmă, legătura de trimis), cu fiecare valoare legală legată de articolul ei.

**De ce:** auditul live din 8 oct 2026 (65 de cazuri live, toate identice cu o recalculare independentă) a găsit calculul corect, dar intrarea și acoperirea slabe:

- **MAJOR:** „4.500” este citit ca 4,5 lei („Net 4 lei din brut 4,5 lei”). „5.000” prin adresă dă 5 lei, iar „3.000” net dă „Net 3 lei din brut 4 lei”. Pagina însăși afișează sumele cu punct de mii. Cauza: `parseAmount` (`src/lib/format/money.ts:80-84`) citește punctul singur ca virgulă zecimală, iar `parametri.ts:24` îl folosește fără adaptare.
- „5000 lei”, „abc”, „1e10” și „1.234.567” sunt înlocuite tăcut cu 4.325 (`parametri.ts:24-28`). Netul cerut de 500.000 de lei e plafonat tăcut la 292.500.
- Net→brut întoarce un brut sub salariul minim când ținta e sub 2.699 lei și nu există persoane în întreținere: 2.614 → 4.320, 2.500 → 4.127, 1.500 → 2.417 (`salariu.ts:119-131`). Testul `salariu.test.ts:57` verifică proprietatea doar cu o persoană în întreținere.
- Facilitatea de 200 de lei nu expiră în cod: `FACILITATE_SALARIU_MINIM.valabilPana` nu e citit nicăieri.
- Nota despre timpul parțial nu spune că baza minimă de contribuții e 4.125 lei în iulie–decembrie 2026 (OUG 89/2025 art. III alin. (5) lit. b)).
- Cosmetic: deducerea e afișată întreagă (865) peste venitul impozabil (art. 77 alin. (2)), apare „7.500,5 lei”, iar la 360 px „− 2.137 lei” se rupe pe două rânduri.
- **Defect nou, găsit în timp ce scriam planul și confirmat live:** `intrare()` îi dă motorului luna ca 21 de zile. Calculul 5.394 / 21 × 21 iese 5.393,999… în virgulă mobilă, așa că CAS de 1.348,50 cade la 1.348 în loc de 1.349 (OUG 59/2005 rotunjește 50 de bani în sus). Producția arată azi „CAS − 1.348 lei” la brut 5.394 și „CASS − 541 lei” la 5.415 (corect: 542). Sunt aproximativ 225 de bruturi între 4.325 și 20.000 (0 persoane) cu un leu greșit (recontat la verificarea adversarială pe 4.326–20.000: 223 cu CAS sau CASS diferit, 228 cu netul diferit; cifra exactă depinde de ce se numără). Pe plaja 1–500.000, cu 0–4 persoane, sunt 9.604 combinații.
- **Al doilea defect nou, confirmat live:** cu 3–4 persoane în întreținere, net→brut iese cu până la 185 de lei prea mare lângă pragul minim + 2.000 de lei. Acolo deducerea de 25% × 4.325 = 1.081 de lei dispare dintr-o dată, iar căutarea înapoi are doar 60 de lei. Producția: `?suma=3715&din=net&persoane=4` dă brut 6.291, dar 6.153 dă exact 3.715. Simularea a găsit 94 de ținte greșite între 3.600 și 3.900. Deducerea sub 26 de ani și tichetele, adăugate de plan, mută aceeași cădere și la 0–2 persoane, respectiv mai jos în brut. Reparat în C4 și C6, validat offline față de căutarea exhaustivă pe 14 combinații de opțiuni.
- **Funcții:** utilitatea a primit 3 din 5. Concurenții (folositor.ro, zarinacrm.ro, curs-valutar-bnr.ro) au tichete, deducerea sub 26 de ani, 100 de lei pe copil, alegerea perioadei ian.–iun. / iul.–dec. 2026 și timp parțial. „Pentru un părinte sau un tânăr sub 26 de ani, netul afișat e deci greșit față de fluturaș.”

**Decizii luate**

1. **Separatorul de mii se rezolvă în calculator, nu în `parseAmount`.** `parseAmount` e partajat cu toată aplicația, unde „1.5” poate fi un număr legitim. Regula intră în `citesteSuma()` din `parametri.ts`, care recunoaște `^\d{1,3}(\.\d{3})+$` și `^\d{1,3}(,\d{3})+$` ca mii, fiindcă o sumă de salariu cu trei zecimale nu există. Un „4.5” rămâne 4,5 → 5 lei, iar pagina spune că a rotunjit.
2. **Suma se rotunjește la leu la citire, iar pagina o spune.** „7.500,50” se calculează ca 7.501 („Suma avea bani; calculatorul lucrează în lei întregi”). Motivul: motorul rotunjește brutul la leu oricum (`rotunjireLei`), iar desfășurătorul trebuie să se închidă cu creionul.
3. **O sumă necitibilă sau un net de neatins nu produce niciun rezultat.** În locul rezultatului apare mesajul de eroare, iar câmpul păstrează textul scris de om. Câmpul gol rămâne implicit salariul minim al perioadei. Asta e o alegere, nu o eroare.
4. **Luna intră în motor ca O SINGURĂ zi lucrătoare** (`zileLucratoareLuna = zileLucrate = 1`). Împărțirea și înmulțirea devin exacte, iar cele circa 225 de bruturi greșite se repară. Am verificat offline că, pe brut întreg, CASS (×0,1), CAM (×0,0225) și impozitul nu mai au nicio rotunjire greșită pe 1–500.000. **Motorul produsului** (`calc.ts:367-377`, `salariuZi * zilePlatite`) are același mecanism pe zilele reale ale lunii. Secțiunea asta NU îl atinge (e motorul statelor de plată). E trecut la întrebările pentru utilizator.
5. **Perioada e o alegere a omului, cu implicitul dat de ziua de azi la București** (`todayInBucharest()`). `"2026-1"` = ianuarie–iunie (4.050 lei, 300 de lei scutiți, plafon 4.300). `"2026-2"` = iulie–decembrie (4.325 lei, 200 de lei, plafon 4.600). Facilitatea depinde de perioada ALEASĂ, nu de ceas. Cine calculează în 2027 pentru decembrie 2026 trebuie să primească tot 200 de lei. După 31.12.2026, implicitul rămâne iulie–decembrie 2026 și pagina afișează un banner care spune că valorile pentru 2027 nu sunt încă verificate. Testul-alarmă existent (`salarizare-publica.test.ts:58`) rămâne și pică pe 1 ianuarie 2027.
6. **Deducerea personală o calculează calculatorul, nu grila motorului.** Motorul primește un singur prag „orice venit → X lei”, unde X = deducerea de bază (art. 77 alin. (4)) + 15% din minim sub 26 de ani (alin. (10) lit. a), doar pentru venit ≤ minim + 2.000) + 100 de lei × copii la școală (alin. (10) lit. b), indiferent de venit). Toate se acordă numai la funcția de bază (alin. (1)). Cifra afișată e plafonată la venitul impozabil (alin. (2)). Motorul nu are deducere suplimentară, iar a o adăuga acolo ar schimba statele de plată, deci nu e treaba secțiunii.
7. **Rotunjirea la ,50 rămâne `Math.round` (în sus) și CAS/CASS rămân NErotunjite în baza de impozit.** Sunt cele două constatări PLAUZIBILE de 1 leu. Nu se schimbă nimic fără sursă. Intră ca întrebări ⚠ în `NOTES.md` §3, iar un test fixează comportamentul actual (4.453 → impozit 209), ca orice schimbare viitoare să fie deliberată.
8. **Tichetele de masă: impozit da, CASS da, CAS nu, CAM nu, plafonul OUG 89 nu.** Temeiurile sunt art. 76 alin. (3) lit. h), art. 157 alin. (1) lit. ț), art. 142 lit. r), art. 220^4 alin. (2) și OUG 89/2025 art. III alin. (1) lit. b). Le dau motorului pe calea lui (`valoareTichetMasa`, `ticheteImpozabile`, `ticheteSupuseCass`), deci regimul e cel din produs. **Tichetele intră în „venitul brut lunar” pentru grila deducerii** (⚠ de confirmat). Art. 76 alin. (3) lit. h) le face venit salarial, iar OUG 89/2025 le scoate explicit doar din plafonul ei. Motorul produsului NU le include, iar diferența e scrisă în NOTES. Valoarea maximă e 45 de lei (Legea 165/2018 art. 14, verificat). Peste ea apare un avertisment, nu un refuz, fiindcă art. 32 permite indexarea din octombrie 2026 prin ordin.
9. **Timp parțial:** norma în ore pe zi (1–8). Brutul minim legal e `ceil(minim × ore / 8)`. Facilitatea OUG 89 nu se aplică (cere normă întreagă). CAS și CASS se compară cu baza minimă `minim − 300/200` (art. 146 alin. (5^6), art. 168 alin. (6^1), OUG 89/2025 art. III alin. (5)), iar diferența o plătește **angajatorul**, nu angajatul (art. 146 alin. (5^9)). Excepțiile din alin. (5^7) se aleg cu o singură bifă. Impozitul angajatului NU scade diferența plătită de firmă (⚠ în NOTES).
10. **Scutirile pe sectoare nu se adaugă:** art. 60 pct. 2 și 5 sunt abrogate de la 01.01.2025, iar pct. 4 de la 01.01.2023 (verificat în forma consolidată). Se adaugă doar **handicapul grav sau accentuat** (art. 60 pct. 1 lit. b), impozit 0). Cercetarea-dezvoltare (pct. 3) cere proiect, buget și stat separat, deci rămâne la „Ce nu calculează”.
11. **Fără euro, fără pagini programatice pe sume** (de tipul `/salariu-net/5000-brut` la folositor.ro). Euro cere cursul BNR, adică rețea la fiecare cerere. Paginile pe sume ar canibaliza canonicalul și ghidul salariului minim cu conținut subțire. Le înlocuiește grila brut→net pe trepte, cu legături `?suma=` pe canonicalul paginii. Se reevaluează când GSC arată impresii pe „X brut în net”.
12. **Legătura de trimis:** adresa normalizată (doar parametrii diferiți de implicit, plus `perioada`), un buton „Copiază legătura” (componentă client mică) și un link „Trimite pe WhatsApp” (`wa.me`, server, merge fără JS). Fără scurtător de linkuri și fără bază de date.
13. **Componentele se scot din `page.tsx` o singură dată (C2):** `formular.tsx` (server, fără `"use client"`), `desfasurator.tsx` și `randuri.ts`, o funcție pură testabilă în proiectul `unit`. Fiecare funcție nouă adaugă apoi un câmp și un rând acolo, cu testul ei.
14. **Ghidul salariului minim primește netul și costul pentru ianuarie–iunie** (în tabel apare azi „—”), din același motor. `actualizatIso` al ghidului NU se schimbă: înseamnă data verificării Codului muncii, pe care secțiunea nu o reface.

**Harta fișierelor**

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| `src/app/(marketing)/unelte/calculator-salariu/parametri.ts` | citirea adresei: `citesteSuma`, opțiunile, erorile, `adresaPartajabila` | C1, C3, C4, C5, C6, C7, C8, C10 |
| `src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts` | testele citirii și ale calculului din adresă | C1, C3–C8, C10 |
| `src/app/(marketing)/unelte/calculator-salariu/lei.ts` (nou) | `lei()`, `deLei()` — formatarea sumelor și a numeralului | C2, C9 |
| `src/app/(marketing)/unelte/calculator-salariu/lei.test.ts` (nou) | testele formatării | C2, C9 |
| `src/app/(marketing)/unelte/calculator-salariu/formular.tsx` (nou) | formularul GET | C2, C3, C5–C8 |
| `src/app/(marketing)/unelte/calculator-salariu/formular.test.tsx` (nou) | randarea formularului (proiectul `ui`) | C2, C3, C5–C8 |
| `src/app/(marketing)/unelte/calculator-salariu/randuri.ts` (nou) | rândurile desfășurătorului, `impartireaCostului` | C2, C5–C9 |
| `src/app/(marketing)/unelte/calculator-salariu/randuri.test.ts` (nou) | închiderea desfășurătorului pe rânduri | C2, C5–C9 |
| `src/app/(marketing)/unelte/calculator-salariu/desfasurator.tsx` (nou) | tabelele „Angajatul” și „Firma” | C2 |
| `src/app/(marketing)/unelte/calculator-salariu/desfasurator.test.tsx` (nou) | `whitespace-nowrap` pe valori | C2 |
| `src/app/(marketing)/unelte/calculator-salariu/copiaza-legatura.tsx` (nou, `"use client"`) | butonul de copiere | C10 |
| `src/app/(marketing)/unelte/calculator-salariu/copiaza-legatura.test.tsx` (nou) | copiere și lipsa clipboard-ului | C10 |
| `src/app/(marketing)/unelte/calculator-salariu/tabele.ts` (nou) | tabelul salariului minim pe perioade, grilele brut↔net | C11 |
| `src/app/(marketing)/unelte/calculator-salariu/tabele.test.ts` (nou) | cifrele tabelelor și ale `llms.txt` | C11 |
| `src/app/(marketing)/unelte/calculator-salariu/page.tsx` | compunerea paginii | C1–C11 |
| `src/lib/unelte/salariu.ts` | calculul: opțiuni, deduceri, tichete, timp parțial, net→brut | C3–C8 |
| `src/lib/unelte/salariu.test.ts` | vectori numerici recalculați de mână | C3–C8 |
| `src/content/legal/salarizare-publica.ts` | valorile legale, cu temei: perioade, deduceri, tichete | C3–C7 |
| `src/content/legal/salarizare-publica.test.ts` | valorile legale | C3, C5–C7 |
| `src/content/legal/salariu-minim.ts` | celulele „—” din tabelul ghidului | C11 |
| `src/content/landing/unelte.ts` | `ANTET_CALCULATOR.lead` | C11 |
| `src/app/(marketing)/unelte/page.tsx` | nota din hub | C11 |
| `src/app/llms.txt/route.ts` | descrierea uneltei | C11 |
| `src/content/landing/continut.test.ts` | `wa.me` în `SCUTITE` (poarta furnizorilor externi) | C10 |
| `src/content/landing/harta.ts` | `actualizat` pentru `/unelte/calculator-salariu` (și `/unelte` în C11) | fiecare task |
| `NOTES.md` §3 | întrebările ⚠ pentru contabil | C5, C6, C7 |

**Coordonarea cu secțiunea D (motorul de salarizare; adăugată de criticul de completitudine, 8 oct 2026).** D3–D5 rulează ÎNAINTEA lui C3 (valul 1): după ele, `calculatePayrollEntry` aplică singur suma neimpozabilă când primește `lunaVenituri`, iar `EmployeeContractSnapshot` are `functieDeBaza?` (implicit `true`). Reguli pentru C3–C8:
- `intrare()` din `salariu.ts` **nu trimite `lunaVenituri`** motorului. Calculatorul aplică suma o singură dată, el însuși (normă întreagă, tichete în afara plafonului). Dacă ar trimite-o, suma s-ar scădea de două ori din baze.
- Cifrele perioadelor (4.050/4.325, 300/200, 4.300/4.600) rămân literale în C3–C7; D6′ (după C8) le derivă din `src/domain/payroll/etape/facilitate-salariu-minim.ts` și adaugă testul de paritate calculator ↔ motor. D6 în forma lui originală NU se aplică peste C (ar reveni la `dinBrut(…, luna)` pe 21 de zile).
- Testele existente ale motorului rămân verzi fără nimic de la C: C nu atinge `src/domain/payroll`.

**Comune tuturor taskurilor (nu se repetă în fiecare):**

- Cale scurtă în comenzi: `C=src/app/\(marketing\)/unelte/calculator-salariu` (shell). În `vitest run`, căile se pun între ghilimele.
- **Data din `harta.ts`:** blocul `/unelte/calculator-salariu` (azi `actualizat: "2026-10-07"`, `src/content/landing/harta.ts:379`) primește data zilei commitului, adică ieșirea lui `date +%F`. Poarta `node scripts/checks/lastmod.mjs`, rulată DUPĂ commit și ÎNAINTE de push, o verifică. Dacă pică, se ridică data și se face `git commit --amend --only -- src/content/landing/harta.ts` (commitul nu e încă împins).
- **Pornirea serverului de dev pentru verificarea headless** (un apel Bash, `run_in_background: true`): `cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917`. Se așteaptă până când `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3917/unelte/calculator-salariu` dă `200`. **Oprirea** se face într-un apel SEPARAT: `pkill -f "next dev -H 127.0.0.1 -p 391[7]"`, apoi `rm -f /srv/apps/ERP/.next/dev/types/validator.ts /srv/apps/ERP/.next/dev/types/routes.d.ts` și `pnpm typecheck` din nou. `next dev` nu hidratează fiabil, așa că HTML-ul și CSS-ul se verifică local, iar comportamentul de client (C10) rămâne pe testul din happy-dom.
- **Scriptul headless** e creat o singură dată, în C1, la `/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs`, și e reluat cu alte argumente în taskurile cu UI.
- Atribuirea din fiecare commit: `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- **Blocurile „vechi” din taskurile de după primul** sunt codul scris de un task anterior, așa cum apare în plan. După `prettier --write`, un text JSX lung sau o listă pot fi împărțite altfel pe rânduri. Ancora rămâne atunci aceeași instrucțiune, adică același element sau aceleași cuvinte, și se înlocuiește elementul întreg. Codul nou se scrie apoi tot prin `prettier --write`.
- **Dacă execuția începe după 8 oct 2026:** se reverifică sursele citate în taskuri (comenzile `curl` din C3), iar `VERIFICARE.la` primește data reverificării, nu cea din plan. Testul care o fixează (`salarizare-publica.test.ts`, „poarta: valorile au data verificării…”) primește aceeași dată.

---

### Task C1: Suma citită cum o scrie un român

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/calculator-salariu/parametri.ts` (înlocuit integral)
- Modify: `src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts` (înlocuit integral)
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx`: linia 159 (destructurarea), liniile 188-195 (câmpul `suma`), liniile 241-258 (banda rezultatului)
- Modify: `src/content/landing/harta.ts:379`

**Interfețe:**
- Consumă: `parseAmount(input: string): number | null` (`src/lib/format/money.ts:66`), `dinBrut`/`dinNet(… ): RezultatSalariu` (`src/lib/unelte/salariu.ts`), `SALARIU_MINIM_BRUT_2026_IULIE` (`src/content/legal/salarizare-publica.ts:31`).
- Produce:
  ```ts
  export const SUMA_MAX = 500_000;
  export type CitireSuma =
    | Readonly<{ ok: true; valoare: number; rotunjita: boolean }>
    | Readonly<{ ok: false; eroare: string }>;
  export function citesteSuma(text: string): CitireSuma;
  export type ParametriCalculator = Readonly<{
    text: string; suma: number | null; eroare: string | null; rotunjita: boolean;
    din: "brut" | "net"; persoane: number; functieDeBaza: boolean;
  }>;
  export function parametriCalculator(q: URLSearchParams): ParametriCalculator;
  export type CalculCalculator = Readonly<{
    parametri: ParametriCalculator; rezultat: RezultatSalariu | null;
    eroare: string | null; subMinim: boolean;
  }>;
  export function calculeazaDinParametri(q: URLSearchParams): CalculCalculator;
  ```

- [ ] **Pasul 1: Scrie testul care pică.** Înlocuiește tot `src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts` cu:

```ts
import { describe, expect, it } from "vitest";

import { calculeazaDinParametri, citesteSuma, parametriCalculator } from "./parametri";

const q = (o: Record<string, string>) => new URLSearchParams(o);

describe("citirea sumei, cum o scrie un român", () => {
  it("punctul de mii nu e virgulă zecimală: „4.500” e 4.500 de lei, nu 4,5", () => {
    // Auditul din 8 oct 2026: „4.500” dădea „Net 4 lei din brut 4,5 lei”.
    expect(citesteSuma("4.500")).toEqual({ ok: true, valoare: 4500, rotunjita: false });
    expect(citesteSuma("5.000")).toEqual({ ok: true, valoare: 5000, rotunjita: false });
    expect(citesteSuma("12.500")).toEqual({ ok: true, valoare: 12500, rotunjita: false });
    expect(citesteSuma("500.000")).toEqual({ ok: true, valoare: 500000, rotunjita: false });
    // Tastatura englezească: trei „zecimale” la lei nu există, deci tot mii.
    expect(citesteSuma("5,000")).toEqual({ ok: true, valoare: 5000, rotunjita: false });
  });

  it("acceptă spațiile, spațiul neîntrerupt, caracterele invizibile și sufixul de monedă", () => {
    for (const t of ["5000 lei", "5.000 lei", "5 000", "5 000", "5000LEI", "5000 RON", "​5000"]) {
      expect(citesteSuma(t), t).toEqual({ ok: true, valoare: 5000, rotunjita: false });
    }
  });

  it("banii se rotunjesc la leu, iar rotunjirea se spune", () => {
    expect(citesteSuma("7.500,50")).toEqual({ ok: true, valoare: 7501, rotunjita: true });
    expect(citesteSuma("4325,4")).toEqual({ ok: true, valoare: 4325, rotunjita: true });
    // Un singur punct urmat de una sau două cifre rămâne zecimal: 4,5 → 5 lei, spus pe față.
    expect(citesteSuma("4.5")).toEqual({ ok: true, valoare: 5, rotunjita: true });
  });

  it("formatele lipite din Excel sau de pe fluturaș: mii și bani deodată", () => {
    // O regulă de mii prea lacomă ar face din „4.500,00” 450.000 (Review Focus 1).
    for (const t of ["4.500,00", "4 500,00 lei", "4,500.00", "4500.00", "4 500,00 lei"]) {
      expect(citesteSuma(t), t).toEqual({ ok: true, valoare: 4500, rotunjita: false });
    }
  });

  it("ce nu se poate citi primește un mesaj, nu salariul minim", () => {
    for (const t of ["abc", "1e10", "Infinity", "NaN", "lei", "<script>", "1,2,3", "5000 de lei"]) {
      expect(citesteSuma(t).ok, t).toBe(false);
    }
    expect(citesteSuma("abc")).toEqual({
      ok: false,
      eroare: "Nu am înțeles suma „abc”. Scrie-o ca 5000 sau 5.000.",
    });
  });

  it("zero, negativ și peste plafon sunt refuzate, fiecare cu motivul lui", () => {
    const subUnLeu = { ok: false, eroare: "Suma trebuie să fie de cel puțin 1 leu." };
    expect(citesteSuma("0")).toEqual(subUnLeu);
    expect(citesteSuma("-5")).toEqual(subUnLeu);
    expect(citesteSuma("0,4")).toEqual(subUnLeu);
    const pestePlafon = { ok: false, eroare: "Calculatorul merge până la 500.000 de lei pe lună." };
    expect(citesteSuma("500.001")).toEqual(pestePlafon);
    expect(citesteSuma("1.234.567")).toEqual(pestePlafon);
    expect(citesteSuma("9".repeat(20))).toEqual(pestePlafon);
  });
});

describe("parametrii calculatorului de salariu", () => {
  it("implicit: salariul minim brut, fără persoane, funcție de bază", () => {
    expect(parametriCalculator(new URLSearchParams())).toEqual({
      text: "4325",
      suma: 4325,
      eroare: null,
      rotunjita: false,
      din: "brut",
      persoane: 0,
      functieDeBaza: true,
    });
  });

  it("un câmp golit (doar spații) înseamnă salariul minim, nu o eroare", () => {
    const p = parametriCalculator(new URLSearchParams({ suma: "   " }));
    expect([p.suma, p.eroare, p.text]).toEqual([4325, null, "4325"]);
  });

  it("mărginește persoanele și citește direcția și funcția de bază", () => {
    expect(parametriCalculator(q({ persoane: "17" })).persoane).toBe(4);
    expect(parametriCalculator(q({ persoane: "-1" })).persoane).toBe(0);
    expect(parametriCalculator(q({ din: "orice" })).din).toBe("brut");
    expect(parametriCalculator(q({ baza: "nu" })).functieDeBaza).toBe(false);
  });

  it("o sumă de neînțeles nu produce un rezultat pentru altă cifră", () => {
    const r = calculeazaDinParametri(q({ suma: "5000 de lei" }));
    expect(r.rezultat).toBeNull();
    expect(r.parametri.text).toBe("5000 de lei");
    expect(r.eroare).toBe("Nu am înțeles suma „5000 de lei”. Scrie-o ca 5000 sau 5.000.");
  });

  it("„4.500” brut dă netul pentru 4.500 de lei", () => {
    // CAS 4.500 × 25% = 1.125; CASS 450. Deducere fără persoane la minim + 175 lei:
    // pasul 4, 18% × 4.325 = 778,50 → 779. Impozit (4.500 − 1.125 − 450 − 779) × 10%
    // = 214,6 → 215. Net 4.500 − 1.125 − 450 − 215 = 2.710.
    const r = calculeazaDinParametri(q({ suma: "4.500" }));
    expect(r.rezultat?.brut).toBe(4500);
    expect(r.rezultat?.net).toBe(2710);
  });

  it("„3.000” net cere 5.036 de lei brut, nu 4 lei", () => {
    const r = calculeazaDinParametri(q({ suma: "3.000", din: "net" }));
    expect(r.rezultat?.brut).toBe(5036);
    expect(r.rezultat?.net).toBeGreaterThanOrEqual(3000);
  });

  it("semnalează un brut sub salariul minim, pe care calculul cu normă întreagă nu-l acoperă", () => {
    expect(calculeazaDinParametri(q({ suma: "3000" })).subMinim).toBe(true);
    expect(calculeazaDinParametri(q({ suma: "4325" })).subMinim).toBe(false);
  });

  it("calculul din net întoarce brutul care dă netul", () => {
    expect(calculeazaDinParametri(q({ suma: "2981", din: "net" })).rezultat?.brut).toBe(5000);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts"`
  Așteptat (verificat pe o copie, 8 oct 2026): 11 teste picate, 3 trecute. Vitest NU oprește fișierul la import pentru un export lipsă: `citesteSuma` vine `undefined`, deci testele lui pică cu `TypeError: citesteSuma is not a function`; cele pe `parametriCalculator` pică pe forma veche a obiectului (lipsesc `text`, `eroare`, `rotunjita`). Pe forma veche, `parametriCalculator({ suma: "4.500" }).suma` e 4,5.

- [ ] **Pasul 3: Implementarea minimă.** Înlocuiește tot `src/app/(marketing)/unelte/calculator-salariu/parametri.ts` cu:

```ts
import { SALARIU_MINIM_BRUT_2026_IULIE } from "@/content/legal/salarizare-publica";
import { parseAmount } from "@/lib/format/money";
import { dinBrut, dinNet, type RezultatSalariu } from "@/lib/unelte/salariu";

/**
 * Intrările calculatorului din adresă, normalizate, și calculul lor.
 *
 * Formular GET, ca restul uneltelor: starea stă în adresă, pagina merge fără
 * JavaScript, iar un link de forma `?suma=5000` se poate trimite cuiva.
 *
 * O sumă care nu se poate citi NU se înlocuiește cu salariul minim: până pe
 * 8 oct 2026, „5000 lei” și „abc” afișau calculul pentru 4.325 de lei, fără
 * niciun mesaj. Acum pagina spune ce n-a înțeles și nu arată alt calcul.
 */

/** Plafonul calculatorului, pe lună. */
export const SUMA_MAX = 500_000;

export type CitireSuma =
  | Readonly<{ ok: true; valoare: number; rotunjita: boolean }>
  | Readonly<{ ok: false; eroare: string }>;

// „5.000”, „12.500”, „1.250.000”: punctul desparte miile, așa scrie orice român
// și așa afișează pagina însăși. `parseAmount` e partajat cu restul aplicației
// și citește un punct singur ca zecimal; regula de aici e doar a calculatorului,
// unde o sumă de salariu cu trei zecimale nu există.
const MII_CU_PUNCT = /^\d{1,3}(?:\.\d{3})+$/u;
// „5,000”, de pe o tastatură englezească: tot mii, din același motiv.
const MII_CU_VIRGULA = /^\d{1,3}(?:,\d{3})+$/u;
// Spațiile (și cel neîntrerupt, din Excel) plus caracterele invizibile din copy-paste.
const SPATII = /[\s  ​⁠﻿]/gu;
const MONEDA = /(?:lei|ron)$/iu;

export function citesteSuma(text: string): CitireSuma {
  const curat = text.replace(SPATII, "").replace(MONEDA, "");
  const fara = MII_CU_PUNCT.test(curat)
    ? curat.replace(/\./gu, "")
    : MII_CU_VIRGULA.test(curat)
      ? curat.replace(/,/gu, "")
      : curat;
  const n = fara === "" ? null : parseAmount(fara);
  if (n === null) {
    return {
      ok: false,
      eroare: `Nu am înțeles suma „${text.trim().slice(0, 20)}”. Scrie-o ca 5000 sau 5.000.`,
    };
  }
  // Calculatorul lucrează în lei întregi: impozitul și contribuțiile se
  // rotunjesc la leu (OUG 59/2005), iar desfășurătorul trebuie să se închidă.
  const valoare = Math.round(n);
  if (valoare < 1) return { ok: false, eroare: "Suma trebuie să fie de cel puțin 1 leu." };
  if (valoare > SUMA_MAX) {
    return { ok: false, eroare: "Calculatorul merge până la 500.000 de lei pe lună." };
  }
  return { ok: true, valoare, rotunjita: valoare !== n };
}

export type ParametriCalculator = Readonly<{
  /** Textul din câmp, întors în formular așa cum l-a scris omul — și când n-a putut fi citit. */
  text: string;
  /** Suma citită, la leu; `null` când textul n-a putut fi citit. */
  suma: number | null;
  eroare: string | null;
  /** Suma avea bani și a fost rotunjită la leu. */
  rotunjita: boolean;
  din: "brut" | "net";
  /** 0–4; 4 înseamnă „4 și peste”, ca în tabelul art. 77 alin. (4). */
  persoane: number;
  functieDeBaza: boolean;
}>;

export function parametriCalculator(q: URLSearchParams): ParametriCalculator {
  const text = (q.get("suma") ?? "").slice(0, 20);
  const gol = text.trim() === "";
  const citire: CitireSuma = gol
    ? { ok: true, valoare: SALARIU_MINIM_BRUT_2026_IULIE, rotunjita: false }
    : citesteSuma(text);
  const persoane = Number.parseInt(q.get("persoane") ?? "", 10);
  return {
    text: gol ? String(SALARIU_MINIM_BRUT_2026_IULIE) : text,
    suma: citire.ok ? citire.valoare : null,
    eroare: citire.ok ? null : citire.eroare,
    rotunjita: citire.ok && citire.rotunjita,
    din: q.get("din") === "net" ? "net" : "brut",
    persoane: Number.isFinite(persoane) ? Math.min(4, Math.max(0, persoane)) : 0,
    functieDeBaza: q.get("baza") !== "nu",
  };
}

export type CalculCalculator = Readonly<{
  parametri: ParametriCalculator;
  /** `null` când nu există un calcul pentru cifra cerută; motivul e în `eroare`. */
  rezultat: RezultatSalariu | null;
  eroare: string | null;
  /** Brut sub salariul minim: calculul cu normă întreagă nu se aplică (vezi pagina). */
  subMinim: boolean;
}>;

export function calculeazaDinParametri(q: URLSearchParams): CalculCalculator {
  const p = parametriCalculator(q);
  if (p.suma === null) return { parametri: p, rezultat: null, eroare: p.eroare, subMinim: false };
  const rezultat =
    p.din === "net"
      ? dinNet(p.suma, p.persoane, p.functieDeBaza)
      : dinBrut(p.suma, p.persoane, p.functieDeBaza);
  return {
    parametri: p,
    rezultat,
    eroare: null,
    subMinim: rezultat.brut < SALARIU_MINIM_BRUT_2026_IULIE,
  };
}
```

Apoi trei editări în `src/app/(marketing)/unelte/calculator-salariu/page.tsx`.

Bloc vechi (linia 159):
```tsx
  const { parametri, rezultat, subMinim } = calculeazaDinParametri(q);
```
Bloc nou:
```tsx
  const { parametri, rezultat, eroare, subMinim } = calculeazaDinParametri(q);
```

Bloc vechi (liniile 188-195):
```tsx
            <input
              type="text"
              inputMode="decimal"
              name="suma"
              maxLength={20}
              defaultValue={String(parametri.suma)}
              className={CLASA_CAMP}
            />
```
Bloc nou:
```tsx
            <input
              type="text"
              inputMode="decimal"
              name="suma"
              maxLength={20}
              defaultValue={parametri.text}
              aria-invalid={eroare !== null}
              aria-describedby={eroare !== null ? "eroare-suma" : undefined}
              className={CLASA_CAMP}
            />
```

Bloc vechi (liniile 241-258):
```tsx
      <Banda
        id="rezultat"
        inaltime="scurta"
        supratitlu="Rezultatul"
        titlu={`Net ${lei(rezultat.net)} din brut ${lei(rezultat.brut)}`}
      >
        <div className="mt-6">
          <Desfasurator r={rezultat} />
        </div>
        {subMinim && (
          <p className="border-mk-rigla mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]">
            Brutul e sub salariul minim de {lei(SALARIU_MINIM_BRUT_2026_IULIE)}. Cu normă întreagă,
            salariul nu poate fi mai mic; la timp parțial, CAS și CASS se datorează în general cel
            puțin la nivelul salariului minim, cu excepțiile din Codul fiscal (de exemplu elevii și
            studenții până la 26 de ani) — calculul de mai sus nu le aplică.
          </p>
        )}
      </Banda>
```
Bloc nou:
```tsx
      <Banda
        id="rezultat"
        inaltime="scurta"
        supratitlu="Rezultatul"
        titlu={
          rezultat === null
            ? "Suma nu a putut fi calculată"
            : `Net ${lei(rezultat.net)} din brut ${lei(rezultat.brut)}`
        }
      >
        {rezultat === null ? (
          <p
            id="eroare-suma"
            role="alert"
            className="border-mk-cerneala mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]"
          >
            {eroare}
          </p>
        ) : (
          <>
            {parametri.rotunjita && parametri.suma !== null && (
              <p className="text-mk-text-slab mt-4 max-w-[68ch] text-[0.875rem] leading-[1.6]">
                Suma avea bani; calculatorul lucrează în lei întregi, deci am calculat pentru{" "}
                {lei(parametri.suma)}.
              </p>
            )}
            <div className="mt-6">
              <Desfasurator r={rezultat} />
            </div>
            {subMinim && (
              <p className="border-mk-rigla mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]">
                Brutul e sub salariul minim de {lei(SALARIU_MINIM_BRUT_2026_IULIE)}. Cu normă
                întreagă, salariul nu poate fi mai mic; la timp parțial, CAS și CASS se datorează în
                general cel puțin la nivelul salariului minim, cu excepțiile din Codul fiscal (de
                exemplu elevii și studenții până la 26 de ani) — calculul de mai sus nu le aplică.
              </p>
            )}
          </>
        )}
      </Banda>
```
(Nota despre timpul parțial se corectează în C7, unde calculul chiar îl aplică.)

Și în `src/content/landing/harta.ts`, blocul `cale: "/unelte/calculator-salariu"`: `actualizat: "2026-10-07"` → `actualizat: "<ieșirea lui date +%F>"`.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts" src/lib/unelte/salariu.test.ts src/content/landing/continut.test.ts`
  Apoi lanțul complet: `pnpm typecheck && pnpm check:server && pnpm lint && pnpm test`, și `pnpm exec prettier --write "src/app/(marketing)/unelte/calculator-salariu/parametri.ts" "src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts" "src/app/(marketing)/unelte/calculator-salariu/page.tsx" src/content/landing/harta.ts && pnpm exec prettier --check` pe aceleași căi.

- [ ] **Pasul 5: Verificarea headless.** Creează scriptul (în scratchpad, nu în repo) `/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs`:

```js
// Uz: node verifica.mjs "<interogare>|<text așteptat în #rezultat>" ...
// Fiecare interogare e deschisă la 1366 px și la 360 px. Se cere textul și
// scrollWidth ≤ clientWidth (fără derulare laterală). Ieșirea e 1 la orice eșec.
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";

const BAZA = process.env.BAZA ?? "http://127.0.0.1:3917";
const OUT = new URL(".", import.meta.url).pathname;
const cereri = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath:
    "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
});
let esecuri = 0;
for (const [nume, viewport] of [
  ["desktop", { width: 1366, height: 900 }],
  ["mobil", { width: 360, height: 780 }],
]) {
  const ctx = await browser.newContext({ viewport, locale: "ro-RO" });
  const page = await ctx.newPage();
  const erori = [];
  page.on("pageerror", (e) => erori.push(e.message));
  for (const [i, cerere] of cereri.entries()) {
    const [interogare, asteptat] = cerere.split("|");
    await page.goto(`${BAZA}/unelte/calculator-salariu?${interogare}`, { waitUntil: "load" });
    const text = (await page.locator("#rezultat").innerText()).replace(/\s+/g, " ");
    const [sw, cw] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    const ok = text.includes(asteptat) && sw <= cw;
    if (!ok) esecuri += 1;
    console.log(`${ok ? "OK  " : "EȘEC"} ${nume} ?${interogare} · scroll ${sw}/${cw} · „${text.slice(0, 160)}”`);
    await page.screenshot({ path: `${OUT}${nume}-${String(i)}.png` });
  }
  if (erori.length > 0) {
    esecuri += 1;
    console.log(nume, "erori de pagină:", erori);
  }
  await ctx.close();
}
await browser.close();
process.exit(esecuri === 0 ? 0 : 1);
```

Pornește serverul (vezi „Comune”), apoi:
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=4.500|Net 2.710 lei din brut 4.500 lei" \
  "suma=5000%20lei|Net 2.981 lei din brut 5.000 lei" \
  "suma=3.000&din=net|din brut 5.036 lei" \
  "suma=abc|Nu am înțeles suma „abc”" \
  "suma=7.500,50|am calculat pentru 7.501 lei"
```
Rezultat așteptat: 10 × `OK`, ieșire 0, `scroll 360/360` pe mobil. Deschide `mobil-3.png` cu Read și verifică două lucruri: mesajul apare în locul desfășurătorului, iar câmpul păstrează „abc”. Oprește serverul (apel separat), șterge fișierele generate și rulează din nou `pnpm typecheck`.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git commit --only -m "fix(unelte): calculatorul de salariu citește „4.500” ca mii și nu mai înlocuiește tăcut suma" -m "Punctul de mii românesc era citit ca virgulă zecimală (4.500 → 4,5 lei), iar o sumă necitibilă afișa calculul pentru salariul minim. Acum: mii recunoscute, sufixul lei acceptat, mesaj în locul rezultatului, rotunjirea la leu spusă pe față." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "src/app/(marketing)/unelte/calculator-salariu/parametri.ts" "src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts" "src/app/(marketing)/unelte/calculator-salariu/page.tsx" src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task C2: Formularul, desfășurătorul și formatarea sumelor, scoase din pagină

**Fișiere:**
- Create: `src/app/(marketing)/unelte/calculator-salariu/lei.ts`, `lei.test.ts`
- Create: `src/app/(marketing)/unelte/calculator-salariu/randuri.ts`, `randuri.test.ts`
- Create: `src/app/(marketing)/unelte/calculator-salariu/desfasurator.tsx`, `desfasurator.test.tsx`
- Create: `src/app/(marketing)/unelte/calculator-salariu/formular.tsx`, `formular.test.tsx`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx`. Liniile 50-55 (`CLASA_CAMP`, `lei`) și 112-150 (`Desfasurator`) dispar. Formularul (liniile 185-238 din forma de după C1) devine `<Formular p={parametri} eroare={eroare} />`.
- Modify: `src/content/landing/harta.ts` (data)

**Interfețe:**
- Consumă: `ParametriCalculator` (C1), `RezultatSalariu` (`src/lib/unelte/salariu.ts:21`).
- Produce:
  ```ts
  // lei.ts
  export function lei(n: number): string;
  // randuri.ts
  export type FelRand = "plus" | "minus" | "total" | "info";
  export type RandDesfasurator = Readonly<{ eticheta: string; valoare: number; fel: FelRand }>;
  export type Desfasurare = Readonly<{
    angajat: readonly RandDesfasurator[];
    angajator: readonly RandDesfasurator[];
  }>;
  export function randuriDesfasurator(r: RezultatSalariu): Desfasurare;
  // desfasurator.tsx
  export function Desfasurator({ r }: { readonly r: RezultatSalariu }): JSX.Element;
  // formular.tsx
  export function Formular(p: { readonly p: ParametriCalculator; readonly eroare: string | null }): JSX.Element;
  ```

- [ ] **Pasul 1: Scrie testele care pică.**

`src/app/(marketing)/unelte/calculator-salariu/lei.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { lei } from "./lei";

describe("sumele în lei", () => {
  it("întregi fără zecimale, cu punct de mii", () => {
    expect(lei(4325)).toBe("4.325 lei");
    expect(lei(500000)).toBe("500.000 lei");
    expect(lei(0)).toBe("0 lei");
  });

  it("cu bani, întotdeauna două zecimale — nu „7.500,5 lei”", () => {
    expect(lei(7500.5)).toBe("7.500,50 lei");
    expect(lei(803.6)).toBe("803,60 lei");
  });
});
```

`src/app/(marketing)/unelte/calculator-salariu/randuri.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { dinBrut } from "@/lib/unelte/salariu";

import { randuriDesfasurator } from "./randuri";

const suma = (randuri: readonly { valoare: number; fel: string }[], fel: string) =>
  randuri.filter((r) => r.fel === fel).reduce((s, r) => s + r.valoare, 0);

describe("rândurile desfășurătorului", () => {
  it("la angajat se închid cu creionul: brut − ce se scade = net", () => {
    for (const brut of [4325, 4500, 5000, 6000, 10000]) {
      const r = dinBrut(brut, 0, true);
      const { angajat } = randuriDesfasurator(r);
      expect(r.brut - suma(angajat, "minus"), String(brut)).toBe(r.net);
      expect(angajat.at(-1)).toEqual({ eticheta: "Salariu net", valoare: r.net, fel: "total" });
    }
  });

  it("la firmă se închid pe cost: brut + CAM = cost total", () => {
    const r = dinBrut(5000, 0, true);
    const { angajator } = randuriDesfasurator(r);
    expect(suma(angajator, "plus")).toBe(r.costTotal);
    expect(angajator.at(-1)?.eticheta).toBe("Cost total pentru firmă");
  });

  it("suma neimpozabilă apare doar la salariul minim", () => {
    const eticheta = "Din care neimpozabil (OUG 89/2025)";
    const laMinim = randuriDesfasurator(dinBrut(4325, 0, true)).angajat.map((x) => x.eticheta);
    const pesteMinim = randuriDesfasurator(dinBrut(4326, 0, true)).angajat.map((x) => x.eticheta);
    expect(laMinim).toContain(eticheta);
    expect(pesteMinim).not.toContain(eticheta);
  });
});
```

`src/app/(marketing)/unelte/calculator-salariu/desfasurator.test.tsx`:
```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { dinBrut } from "@/lib/unelte/salariu";

import { Desfasurator } from "./desfasurator";

describe("desfășurătorul", () => {
  it("valorile nu se rup pe două rânduri: „− 1.250 lei” rămâne întreg la 360 px", () => {
    // Auditul din 8 oct 2026: la 360 px, „lei” cădea sub cifră la CAS și la cost.
    const { container } = render(<Desfasurator r={dinBrut(5000, 0, true)} />);
    const celule = [...container.querySelectorAll("td")];
    expect(celule.length).toBeGreaterThan(0);
    for (const td of celule) expect(td.className, td.textContent ?? "").toContain("whitespace-nowrap");
    expect(celule.map((td) => td.textContent)).toContain("− 1.250 lei");
  });

  it("are două tabele, pentru angajat și pentru firmă", () => {
    const { container } = render(<Desfasurator r={dinBrut(5000, 0, true)} />);
    expect([...container.querySelectorAll("caption")].map((c) => c.textContent)).toEqual([
      "Angajatul",
      "Firma",
    ]);
  });
});
```

`src/app/(marketing)/unelte/calculator-salariu/formular.test.tsx`:
```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Formular } from "./formular";
import { parametriCalculator } from "./parametri";

const randeaza = (o: Record<string, string>) => {
  const p = parametriCalculator(new URLSearchParams(o));
  return render(<Formular p={p} eroare={p.eroare} />).container;
};

describe("formularul calculatorului", () => {
  it("e un formular GET care se întoarce la rezultat", () => {
    const form = randeaza({}).querySelector("form");
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("#rezultat");
  });

  it("pune înapoi valorile din adresă, inclusiv un text necitibil, marcat invalid", () => {
    const c = randeaza({ suma: "abc", din: "net", persoane: "2", baza: "nu" });
    const suma = c.querySelector<HTMLInputElement>('input[name="suma"]');
    expect(suma?.value).toBe("abc");
    expect(suma?.getAttribute("aria-invalid")).toBe("true");
    expect(suma?.getAttribute("aria-describedby")).toBe("eroare-suma");
    expect(c.querySelector<HTMLSelectElement>('select[name="din"]')?.value).toBe("net");
    expect(c.querySelector<HTMLSelectElement>('select[name="persoane"]')?.value).toBe("2");
    expect(c.querySelector<HTMLSelectElement>('select[name="baza"]')?.value).toBe("nu");
  });

  it("o sumă bună nu e marcată invalidă", () => {
    const suma = randeaza({ suma: "5.000" }).querySelector('input[name="suma"]');
    expect(suma?.getAttribute("aria-invalid")).toBe("false");
    expect(suma?.hasAttribute("aria-describedby")).toBe(false);
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui "src/app/(marketing)/unelte/calculator-salariu/"`
  Așteptat: patru fișiere picate la import (`Failed to resolve import "./lei"`, `"./randuri"`, `"./desfasurator"`, `"./formular"`); `parametri.test.ts` trece.

- [ ] **Pasul 3: Implementarea minimă.**

`src/app/(marketing)/unelte/calculator-salariu/lei.ts`:
```ts
/**
 * O sumă în lei, în convenția românească: „4.325 lei”, „803,60 lei”.
 *
 * Fără zecimale când suma e întreagă (impozitul și contribuțiile sunt
 * rotunjite la leu, OUG 59/2005), cu exact două când nu e (un tichet de
 * 40,18 lei). Varianta veche, cu `maximumFractionDigits: 2`, scria „7.500,5 lei”.
 */
export function lei(n: number): string {
  const zecimale = Number.isInteger(n) ? 0 : 2;
  const text = new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: zecimale,
    maximumFractionDigits: zecimale,
  }).format(n);
  return `${text} lei`;
}
```

`src/app/(marketing)/unelte/calculator-salariu/randuri.ts`:
```ts
import type { RezultatSalariu } from "@/lib/unelte/salariu";

/**
 * Rândurile desfășurătorului, ca date: pagina le desenează, testele verifică
 * că se închid. La angajat, brut − rândurile „minus” = net; la firmă, suma
 * rândurilor „plus” = costul total. Un rând nou care strică închiderea pică
 * în `randuri.test.ts`, nu pe ecranul cuiva.
 */

export type FelRand = "plus" | "minus" | "total" | "info";
export type RandDesfasurator = Readonly<{ eticheta: string; valoare: number; fel: FelRand }>;
export type Desfasurare = Readonly<{
  angajat: readonly RandDesfasurator[];
  angajator: readonly RandDesfasurator[];
}>;

const rand = (eticheta: string, valoare: number, fel: FelRand): RandDesfasurator => ({
  eticheta,
  valoare,
  fel,
});

export function randuriDesfasurator(r: RezultatSalariu): Desfasurare {
  return {
    angajat: [
      rand("Salariu brut", r.brut, "plus"),
      ...(r.sumaNeimpozabila > 0
        ? [rand("Din care neimpozabil (OUG 89/2025)", r.sumaNeimpozabila, "info")]
        : []),
      rand("CAS — pensie, 25%", r.cas, "minus"),
      rand("CASS — sănătate, 10%", r.cass, "minus"),
      rand("Deducere personală", r.deducerePersonala, "info"),
      rand("Impozit pe venit, 10%", r.impozit, "minus"),
      rand("Salariu net", r.net, "total"),
    ],
    angajator: [
      rand("Salariu brut", r.brut, "plus"),
      rand("CAM — contribuția asiguratorie pentru muncă, 2,25%", r.cam, "plus"),
      rand("Cost total pentru firmă", r.costTotal, "total"),
    ],
  };
}
```
(Închiderea la angajat se verifică pe `minus` scăzute din `r.brut`. Rândurile `plus` de acolo (brutul, iar din C6 tichetele de pe card) nu intră în sumă, iar la firmă se adună toate rândurile `plus`.)

`src/app/(marketing)/unelte/calculator-salariu/desfasurator.tsx`:
```tsx
import type { RezultatSalariu } from "@/lib/unelte/salariu";

import { lei } from "./lei";
import { randuriDesfasurator, type RandDesfasurator } from "./randuri";

function Tabel({
  legenda,
  randuri,
}: {
  readonly legenda: string;
  readonly randuri: readonly RandDesfasurator[];
}) {
  return (
    <table className="w-full border-collapse text-left text-[0.9375rem]">
      <caption className="font-mk-display mb-2 text-left text-[1.0625rem] font-semibold">
        {legenda}
      </caption>
      <tbody>
        {randuri.map(({ eticheta, valoare, fel }) => (
          <tr
            key={eticheta}
            className={`border-mk-rigla/40 border-b ${fel === "total" ? "font-semibold" : ""}`}
          >
            <th
              scope="row"
              className={`py-2 pr-4 font-normal ${fel === "info" ? "text-mk-text-slab" : ""}`}
            >
              {eticheta}
            </th>
            {/* Fără rupere: la 360 px, „− 2.137 lei” se despărțea pe două rânduri (auditul din 8 oct 2026). */}
            <td className="font-mk-date py-2 text-right whitespace-nowrap tabular-nums">
              {fel === "minus" ? "− " : ""}
              {lei(valoare)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Desfășurătorul salariului: ce primește angajatul și ce plătește firma. */
export function Desfasurator({ r }: { readonly r: RezultatSalariu }) {
  const { angajat, angajator } = randuriDesfasurator(r);
  return (
    <div className="grid max-w-[64rem] gap-8 lg:grid-cols-2">
      <Tabel legenda="Angajatul" randuri={angajat} />
      <Tabel legenda="Firma" randuri={angajator} />
    </div>
  );
}
```

`src/app/(marketing)/unelte/calculator-salariu/formular.tsx`:
```tsx
import type { ParametriCalculator } from "./parametri";

/**
 * Formularul GET al calculatorului. Server, fără JavaScript: starea stă în
 * adresă, iar `#rezultat` deschide pagina la rezultat, nu sus, pe formular.
 */

const CLASA_CAMP =
  "border-mk-rigla bg-mk-hartie focus:border-mk-text rounded w-full border px-3 py-2.5 text-base";
const CLASA_ETICHETA = "text-[0.875rem] font-medium";

export function Formular({
  p,
  eroare,
}: {
  readonly p: ParametriCalculator;
  readonly eroare: string | null;
}) {
  return (
    <form method="get" action="#rezultat" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Suma (lei)</span>
        <input
          type="text"
          inputMode="decimal"
          name="suma"
          maxLength={20}
          defaultValue={p.text}
          aria-invalid={eroare !== null}
          aria-describedby={eroare !== null ? "eroare-suma" : undefined}
          className={CLASA_CAMP}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Suma e</span>
        <select name="din" defaultValue={p.din} className={CLASA_CAMP}>
          <option value="brut">brută — calculează netul</option>
          <option value="net">netă — calculează brutul</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Persoane în întreținere</span>
        <select name="persoane" defaultValue={String(p.persoane)} className={CLASA_CAMP}>
          <option value="0">niciuna</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4 sau mai multe</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Funcția de bază</span>
        <select name="baza" defaultValue={p.functieDeBaza ? "da" : "nu"} className={CLASA_CAMP}>
          <option value="da">da — aici e funcția de bază</option>
          <option value="nu">nu — al doilea contract</option>
        </select>
      </label>
      <div className="flex items-end sm:col-span-2 lg:col-span-4">
        <button
          type="submit"
          data-umami-event="calculator-salariu"
          className="bg-mk-cerneala text-mk-text-inv inline-flex h-11 items-center justify-center rounded px-8 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
        >
          Calculează
        </button>
      </div>
    </form>
  );
}
```

Editările din `page.tsx`. Importurile, după `import { calculeazaDinParametri } from "./parametri";` (linia 23):
```tsx
import { calculeazaDinParametri } from "./parametri";
```
devine
```tsx
import { Desfasurator } from "./desfasurator";
import { Formular } from "./formular";
import { lei } from "./lei";
import { calculeazaDinParametri } from "./parametri";
```
Importul `type RezultatSalariu` din linia 14 nu mai e folosit:
```tsx
import { dinBrut, dinNet, type RezultatSalariu } from "@/lib/unelte/salariu";
```
→
```tsx
import { dinBrut, dinNet } from "@/lib/unelte/salariu";
```
Se șterg liniile 50-55 (`const CLASA_CAMP = …` și `/** Sumele sunt deja rotunjite … */ const lei = …`) și liniile 112-150 (toată `function Desfasurator`). Blocul `<form method="get" action="#rezultat" …> … </form>` din banda formularului (de la `<form` până la `</form>` inclusiv, cu câmpul `suma` modificat în C1) se înlocuiește cu:
```tsx
        <Formular p={parametri} eroare={eroare} />
```
Comentariul `{/* `#rezultat`: … */}` de deasupra formularului rămâne.

Data din `harta.ts` se ridică.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui "src/app/(marketing)/unelte/calculator-salariu/" src/content/landing/continut.test.ts`, apoi lanțul complet și `prettier --write`/`--check` pe cele 9 fișiere atinse.

- [ ] **Pasul 5: Verificarea headless la 360 px.** Pornește serverul, apoi:
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=8550|− 2.138 lei" "suma=5000|Cost total pentru firmă 5.113 lei" "suma=7.500,50|7.501 lei"
```
Așteptat: 6 × `OK`. Deschide `mobil-0.png`: rândul CAS („− 2.138 lei”, 8.550 × 25% = 2.137,50 → 2.138) stă pe un singur rând, iar „Angajatul” și „Firma” stau una sub alta. Pe `desktop-0.png` stau alăturate. Oprește serverul și curăță (vezi „Comune”).

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git add -- "src/app/(marketing)/unelte/calculator-salariu/lei.ts" "src/app/(marketing)/unelte/calculator-salariu/lei.test.ts" "src/app/(marketing)/unelte/calculator-salariu/randuri.ts" "src/app/(marketing)/unelte/calculator-salariu/randuri.test.ts" "src/app/(marketing)/unelte/calculator-salariu/desfasurator.tsx" "src/app/(marketing)/unelte/calculator-salariu/desfasurator.test.tsx" "src/app/(marketing)/unelte/calculator-salariu/formular.tsx" "src/app/(marketing)/unelte/calculator-salariu/formular.test.tsx"
git commit --only -m "refactor(unelte): formularul și desfășurătorul calculatorului, componente cu teste proprii" -m "Desfășurătorul are două tabele (angajatul, firma) și valori care nu se mai rup la 360 px; sumele cu bani au două zecimale, nu „7.500,5 lei”." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task C3: Cele două perioade din 2026, facilitatea legată de perioadă, banner după 31 decembrie 2026, rotunjirea exactă

**Fișiere:**
- Modify: `src/content/legal/salarizare-publica.ts`: antetul (liniile 6-29), după linia 31, `VERIFICARE` (liniile 33-53) și `SETARI_SALARIZARE_PUBLICE` (liniile 91-106)
- Modify: `src/content/legal/salarizare-publica.test.ts`: importul (liniile 3-8), linia 42, plus un bloc nou la final
- Modify: `src/lib/unelte/salariu.ts` (înlocuit integral)
- Modify: `src/lib/unelte/salariu.test.ts`: importul (linia 3), plus două blocuri noi la final
- Modify: `src/app/(marketing)/unelte/calculator-salariu/parametri.ts` (înlocuit integral) și `parametri.test.ts` (înlocuit integral)
- Modify: `src/app/(marketing)/unelte/calculator-salariu/formular.tsx`, `formular.test.tsx`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx`: importul `formatDate`, bucla parametrilor, banda rezultatului, nota din „Limitele”
- Modify: `src/content/landing/harta.ts` (data)

**Verificare pe sursă, înainte de cod** (refă-o dacă execuți după 8 oct 2026; ce scrie aici am citit pe 8 oct 2026 cu `curl`):
```bash
mkdir -p /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/legi
cd /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/legi
curl -sSL --max-time 150 -A "Mozilla/5.0" https://legislatie.just.ro/Public/DetaliiDocument/291450 -o hg1506.html
curl -sSL --max-time 150 -A "Mozilla/5.0" https://legislatie.just.ro/Public/DetaliiDocument/308231 -o hg146.html
curl -sSL --max-time 150 -A "Mozilla/5.0" https://legislatie.just.ro/Public/DetaliiDocument/305817 -o oug89.html
python3 -I -c 'import re,html,sys
for f in sys.argv[1:]:
    t=open(f,encoding="utf-8",errors="replace").read(); t=re.sub(r"<script.*?</script>","",t,flags=re.S)
    t=re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>"," ",t)))
    for k in ["Forma consolidata","+ Articolul 1 ","+ Articolul 2 ","Articolul III (1)"]:
        i=t.find(k); print(f,k,"→",t[i:i+420] if i>=0 else "—")' hg1506.html hg146.html oug89.html
```
Ce trebuie să iasă (confirmat pe 8 oct 2026; portalul are pauze de conectare, așa că se reîncearcă):
- HG 1506/2024 art. 1: „Începând cu data de 1 ianuarie 2025 … 4.050 lei lunar, pentru … 165,334 ore pe lună, reprezentând 24,496 lei/oră”. HG 146/2026 art. 2 o abrogă „la data prevăzută la art. 1”, adică 1 iulie 2026.
- HG 146/2026 art. 1: 4.325 lei din 1 iulie 2026, 166,667 ore, 25,949 lei/oră.
- OUG 89/2025, forma consolidată din 16.08.2026, art. III alin. (1): „300 lei/lună … 1 ianuarie-30 iunie 2026, respectiv … 200 lei/lună … 1 iulie-31 decembrie 2026”. Lit. b) dă plafonul „4.300 lei inclusiv” (ian.–iun.) și „4.600 lei inclusiv” (iul.–dec.), „fără a include contravaloarea tichetelor de masă”. Alin. (6) spune că articolul se aplică „veniturilor aferente lunilor ianuarie-decembrie 2026 inclusiv”.
Dacă vreo cifră diferă, taskul se oprește și cifra din cod urmează sursa.

**Interfețe:**
- Consumă: `calculatePayrollEntry(input: PayrollCalcInput): PayrollCalcResult`, `PayrollSettingsSnapshot` (`src/domain/payroll/calc.ts:334`, `:55`), `grilaDeducerePersonala(minim: number)` (`salarizare-publica.ts:74`), `todayInBucharest(): DateString` și `toBucharestDateString(moment: Date): DateString` (`src/lib/format/date.ts:115`, `:106`).
- Produce:
  ```ts
  // salarizare-publica.ts
  export const SALARIU_MINIM_BRUT_2026_IANUARIE = 4050;
  export type Perioada = "2026-1" | "2026-2";
  export type ValoriPerioada = Readonly<{
    eticheta: string; valabilDeLa: string; valabilPana: string; salariuMinim: number;
    oreLunaMedie: string; leiPeOra: string; actSalariuMinim: string;
    facilitate: Readonly<{ suma: number; plafonVenitBrut: number }>;
    setari: PayrollSettingsSnapshot;
  }>;
  export const PERIOADE_2026: Readonly<Record<Perioada, ValoriPerioada>>;
  export const PERIOADE: readonly Perioada[];
  export function estePerioada(v: string | null): v is Perioada;
  export function perioadaPentruZi(zi: string): Perioada;
  export function valoriExpirate(zi: string): boolean;
  // salariu.ts
  export type OptiuniSalariu = Readonly<{ perioada: Perioada; persoane: number; functieDeBaza: boolean }>;
  export const OPTIUNI_IMPLICITE: OptiuniSalariu;
  export const BRUT_MAX = 500_000;
  export function calculeazaDinBrut(brut: number, optiuni: OptiuniSalariu): RezultatSalariu;
  export function calculeazaDinNet(net: number, optiuni: OptiuniSalariu): RezultatSalariu;
  export function dinBrut(brut: number, persoane: number, functieDeBaza: boolean): RezultatSalariu; // neschimbat, iul.–dec.
  export function dinNet(net: number, persoane: number, functieDeBaza: boolean): RezultatSalariu;   // neschimbat, iul.–dec.
  // parametri.ts
  export type ParametriCalculator = Readonly<{ text: string; suma: number | null; eroare: string | null;
    rotunjita: boolean; din: "brut" | "net"; optiuni: OptiuniSalariu }>;
  export function parametriCalculator(q: URLSearchParams, azi: string): ParametriCalculator;
  export type CalculCalculator = Readonly<{ parametri: ParametriCalculator; rezultat: RezultatSalariu | null;
    eroare: string | null; minimLegal: number; subMinim: boolean; expirat: boolean }>;
  export function calculeazaDinParametri(q: URLSearchParams, azi: string): CalculCalculator;
  ```

- [ ] **Pasul 1: Scrie testele care pică.**

În `src/content/legal/salarizare-publica.test.ts`, bloc vechi (liniile 3-8):
```ts
import {
  FACILITATE_SALARIU_MINIM,
  grilaDeducerePersonala,
  SETARI_SALARIZARE_PUBLICE as S,
  VERIFICARE,
} from "./salarizare-publica";
```
Bloc nou:
```ts
import { toBucharestDateString } from "@/lib/format/date";

import {
  FACILITATE_SALARIU_MINIM,
  grilaDeducerePersonala,
  PERIOADE_2026,
  perioadaPentruZi,
  SETARI_SALARIZARE_PUBLICE as S,
  valoriExpirate,
  VERIFICARE,
} from "./salarizare-publica";
```
Linia 42, `expect(VERIFICARE.la).toBe("2026-10-03");`, devine:
```ts
    expect(VERIFICARE.la).toBe("2026-10-08");
    expect(VERIFICARE.surse.map((s) => s.eticheta)).toContain(
      "HG 1506/2024 — salariul minim până la 30 iunie 2026",
    );
```
La finalul fișierului:
```ts
describe("cele două perioade ale lui 2026", () => {
  it("ianuarie–iunie: 4.050 lei (HG 1506/2024), 300 de lei scutiți, plafon 4.300", () => {
    const v = PERIOADE_2026["2026-1"];
    expect(v.salariuMinim).toBe(4050);
    expect(v.facilitate).toEqual({ suma: 300, plafonVenitBrut: 4300 });
    expect(v.setari.salariuMinimBrut).toBe(4050);
    // Primul prag al grilei: fără persoane, venit până la minim — 20% × 4.050 = 810.
    expect(v.setari.deducerePersonala[0]?.valoare).toBe(810);
    expect([v.oreLunaMedie, v.leiPeOra, v.actSalariuMinim]).toEqual(["165,334", "24,496", "HG 1506/2024"]);
  });

  it("iulie–decembrie: 4.325 lei (HG 146/2026), 200 de lei, plafon 4.600 — aceleași setări ca până acum", () => {
    const v = PERIOADE_2026["2026-2"];
    expect(v.salariuMinim).toBe(4325);
    expect(v.facilitate).toEqual({ suma: 200, plafonVenitBrut: 4600 });
    expect(v.setari).toBe(S);
    expect([v.oreLunaMedie, v.leiPeOra, v.actSalariuMinim]).toEqual(["166,667", "25,949", "HG 146/2026"]);
  });

  it("ziua alege perioada; după 31 decembrie 2026 valorile sunt expirate", () => {
    expect(perioadaPentruZi("2026-06-30")).toBe("2026-1");
    expect(perioadaPentruZi("2026-07-01")).toBe("2026-2");
    expect(perioadaPentruZi("2027-01-01")).toBe("2026-2");
    expect(valoriExpirate("2026-12-31")).toBe(false);
    expect(valoriExpirate("2027-01-01")).toBe(true);
  });

  it("ziua e cea din România: 30 iunie, 22:30 UTC, e deja 1 iulie la București", () => {
    expect(perioadaPentruZi(toBucharestDateString(new Date("2026-06-30T22:30:00Z")))).toBe("2026-2");
  });
});
```

În `src/lib/unelte/salariu.test.ts`, bloc vechi (linia 3):
```ts
import { dinBrut, dinNet } from "./salariu";
```
Bloc nou:
```ts
import { calculeazaDinBrut, calculeazaDinNet, dinBrut, dinNet, OPTIUNI_IMPLICITE } from "./salariu";
```
La finalul fișierului:
```ts
describe("perioada ianuarie–iunie 2026", () => {
  const S1 = { ...OPTIUNI_IMPLICITE, perioada: "2026-1" } as const;

  it("4.050 brut → 2.574 net, cost 4.134, cu 300 de lei scutiți", () => {
    // Baza: 4.050 − 300 = 3.750. CAS 25% = 937,50 → 938; CASS 10% = 375.
    // Deducere 20% × 4.050 = 810. Impozit (3.750 − 937,50 − 375 − 810) × 10% = 162,75 → 163.
    // Net 3.750 − 938 − 375 − 163 + 300 = 2.574. CAM 2,25% × 3.750 = 84,375 → 84; cost 4.050 + 84 = 4.134.
    expect(calculeazaDinBrut(4050, S1)).toMatchObject({
      sumaNeimpozabila: 300,
      cas: 938,
      cass: 375,
      deducerePersonala: 810,
      impozit: 163,
      net: 2574,
      cam: 84,
      costTotal: 4134,
    });
  });

  it("4.051 pierde facilitatea: net 2.449", () => {
    // CAS 1.012,75 → 1.013; CASS 405,10 → 405; deducerea, pasul 1: 19,5% × 4.050 = 789,75 → 790.
    // Impozit (4.051 − 1.012,75 − 405,10 − 790) × 10% = 184,315 → 184. Net 4.051 − 1.013 − 405 − 184 = 2.449.
    expect(calculeazaDinBrut(4051, S1).net).toBe(2449);
  });

  it("4.050 în iulie–decembrie nu mai e salariul minim: fără scutire", () => {
    expect(calculeazaDinBrut(4050, OPTIUNI_IMPLICITE).sumaNeimpozabila).toBe(0);
  });

  it("net 2.575 cere 4.280 de lei brut: capcana de după minim e mai lungă în prima jumătate", () => {
    // Peste 4.050, cei 300 de lei scutiți se pierd: netul revine peste 2.574 abia la 4.280.
    expect(calculeazaDinNet(2575, S1).brut).toBe(4280);
    expect(calculeazaDinNet(2574, S1).brut).toBe(4050);
  });
});

describe("rotunjirea la leu nu mai depinde de virgula mobilă", () => {
  // Auditul din 8 oct 2026: motorul primea luna ca 21 de zile, iar 5.394 / 21 × 21 iese
  // 5.393,999… — CAS 1.348,50 se rotunjea în jos. Circa 225 de bruturi între 4.325 și 20.000.
  it("brut 5.394: CAS 1.348,50 → 1.349, net 3.194", () => {
    // CASS 539,4 → 539; deducere la minim + 1.069: pasul 22, 9% × 4.325 = 389,25 → 389;
    // impozit (5.394 − 1.348,5 − 539,4 − 389) × 10% = 311,71 → 312; net 5.394 − 1.349 − 539 − 312 = 3.194.
    expect(dinBrut(5394, 0, true)).toMatchObject({ cas: 1349, net: 3194 });
  });

  it("brut 5.415: CASS 541,50 → 542", () => {
    expect(dinBrut(5415, 0, true).cass).toBe(542);
  });
});
```

`src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts`: înlocuiește blocul `describe("parametrii calculatorului de salariu", …)` (tot, de la linia lui până la final) și importul. Blocul `describe("citirea sumei…")` din C1 rămâne neschimbat. Capul fișierului devine:
```ts
import { describe, expect, it } from "vitest";

import { calculeazaDinParametri, citesteSuma, parametriCalculator } from "./parametri";

const q = (o: Record<string, string>) => new URLSearchParams(o);
const AZI = "2026-10-08";
```
Iar blocul înlocuit:
```ts
describe("parametrii calculatorului de salariu", () => {
  it("implicit: salariul minim al perioadei de azi, fără persoane, funcție de bază", () => {
    expect(parametriCalculator(new URLSearchParams(), AZI)).toEqual({
      text: "4325",
      suma: 4325,
      eroare: null,
      rotunjita: false,
      din: "brut",
      optiuni: { perioada: "2026-2", persoane: 0, functieDeBaza: true },
    });
  });

  it("în martie 2026 implicitul e ianuarie–iunie, cu minimul de 4.050", () => {
    const p = parametriCalculator(new URLSearchParams(), "2026-03-15");
    expect(p.optiuni.perioada).toBe("2026-1");
    expect(p.suma).toBe(4050);
  });

  it("perioada din adresă bate ziua de azi; una necunoscută e ignorată", () => {
    expect(parametriCalculator(q({ perioada: "2026-1" }), AZI).optiuni.perioada).toBe("2026-1");
    expect(parametriCalculator(q({ perioada: "2025-2" }), AZI).optiuni.perioada).toBe("2026-2");
  });

  it("un câmp golit (doar spații) înseamnă salariul minim al perioadei, nu o eroare", () => {
    const p = parametriCalculator(new URLSearchParams({ suma: "   " }), AZI);
    expect([p.suma, p.eroare, p.text]).toEqual([4325, null, "4325"]);
  });

  it("4.325 în ianuarie–iunie e un salariu peste minim: fără sumă scutită, net 2.599", () => {
    // Review Focus 3: suma rămasă în câmp după schimbarea perioadei.
    // CAS 1.081,25 → 1.081; CASS 432,50 → 433; deducere minim + 275, pasul 6, 17% × 4.050 = 688,50 → 689;
    // impozit (4.325 − 1.081,25 − 432,5 − 689) × 10% = 212,225 → 212; net 4.325 − 1.081 − 433 − 212 = 2.599.
    const r = calculeazaDinParametri(q({ suma: "4325", perioada: "2026-1" }), AZI);
    expect(r.rezultat).toMatchObject({ sumaNeimpozabila: 0, net: 2599 });
    expect(r.subMinim).toBe(false);
  });

  it("mărginește persoanele și citește direcția și funcția de bază", () => {
    expect(parametriCalculator(q({ persoane: "17" }), AZI).optiuni.persoane).toBe(4);
    expect(parametriCalculator(q({ persoane: "-1" }), AZI).optiuni.persoane).toBe(0);
    expect(parametriCalculator(q({ din: "orice" }), AZI).din).toBe("brut");
    expect(parametriCalculator(q({ baza: "nu" }), AZI).optiuni.functieDeBaza).toBe(false);
  });

  it("o sumă de neînțeles nu produce un rezultat pentru altă cifră", () => {
    const r = calculeazaDinParametri(q({ suma: "5000 de lei" }), AZI);
    expect(r.rezultat).toBeNull();
    expect(r.parametri.text).toBe("5000 de lei");
    expect(r.eroare).toBe("Nu am înțeles suma „5000 de lei”. Scrie-o ca 5000 sau 5.000.");
  });

  it("„4.500” brut dă netul pentru 4.500 de lei", () => {
    // CAS 1.125; CASS 450; deducere pasul 4, 18% × 4.325 = 778,50 → 779;
    // impozit (4.500 − 1.125 − 450 − 779) × 10% = 214,6 → 215; net 2.710.
    const r = calculeazaDinParametri(q({ suma: "4.500" }), AZI);
    expect(r.rezultat?.brut).toBe(4500);
    expect(r.rezultat?.net).toBe(2710);
  });

  it("„3.000” net cere 5.036 de lei brut, nu 4 lei", () => {
    const r = calculeazaDinParametri(q({ suma: "3.000", din: "net" }), AZI);
    expect(r.rezultat?.brut).toBe(5036);
  });

  it("semnalează un brut sub salariul minim al perioadei alese", () => {
    expect(calculeazaDinParametri(q({ suma: "3000" }), AZI).subMinim).toBe(true);
    expect(calculeazaDinParametri(q({ suma: "4325" }), AZI).subMinim).toBe(false);
    expect(calculeazaDinParametri(q({ suma: "4050" }), AZI).subMinim).toBe(true);
    const ianuarie = calculeazaDinParametri(q({ suma: "4050", perioada: "2026-1" }), AZI);
    expect(ianuarie.subMinim).toBe(false);
    expect(ianuarie.minimLegal).toBe(4050);
    expect(ianuarie.rezultat?.net).toBe(2574);
  });

  it("calculul din net întoarce brutul care dă netul", () => {
    expect(calculeazaDinParametri(q({ suma: "2981", din: "net" }), AZI).rezultat?.brut).toBe(5000);
  });

  it("după 31 decembrie 2026 pagina știe că valorile au expirat", () => {
    expect(calculeazaDinParametri(new URLSearchParams(), "2027-01-04").expirat).toBe(true);
    expect(calculeazaDinParametri(new URLSearchParams(), AZI).expirat).toBe(false);
  });
});
```

În `formular.test.tsx`, bloc vechi:
```tsx
  const p = parametriCalculator(new URLSearchParams(o));
```
Bloc nou:
```tsx
  const p = parametriCalculator(new URLSearchParams(o), "2026-10-08");
```
și, înainte de ultimul `});` al fișierului:
```tsx
  it("perioada aleasă rămâne aleasă", () => {
    const c = randeaza({ perioada: "2026-1" });
    expect(c.querySelector<HTMLSelectElement>('select[name="perioada"]')?.value).toBe("2026-1");
    expect(
      [...c.querySelectorAll('select[name="perioada"] option')].map((o) => o.textContent),
    ).toEqual(["ianuarie–iunie 2026", "iulie–decembrie 2026"]);
  });
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/content/legal/salarizare-publica.test.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu/"`
  Așteptat: `PERIOADE_2026`, `calculeazaDinBrut` și `OPTIUNI_IMPLICITE` nu sunt exportate. `VERIFICARE.la` primește `"2026-10-03"`. Pe forma veche, `dinBrut(5394, 0, true).cas` primește 1348 în loc de 1349 (asta dovedește că testul prinde defectul).

- [ ] **Pasul 3: Implementarea minimă.**

`src/content/legal/salarizare-publica.ts`. În antet, bloc vechi:
```ts
 * ── VERIFICATE PE 3 OCT 2026, PE TEXTELE OFICIALE ─────────────────────────
 * Citite cu `curl` în Portalul Legislativ (forme consolidate):
 *  - salariul minim 4.325 lei din 1 iulie 2026 — HG 146/2026, MO nr. 196 din
 *    13 martie 2026;
```
Bloc nou:
```ts
 * ── VERIFICATE PE 3 OCT 2026, PE TEXTELE OFICIALE ─────────────────────────
 * Citite cu `curl` în Portalul Legislativ (forme consolidate):
 *  - salariul minim 4.325 lei din 1 iulie 2026 — HG 146/2026, MO nr. 196 din
 *    13 martie 2026; art. 2 abrogă HG 1506/2024 la aceeași dată;
 *  - (8 oct 2026) salariul minim 4.050 lei din 1 ianuarie 2025 până la 30 iunie
 *    2026, 165,334 ore, 24,496 lei/oră — HG 1506/2024 art. 1, MO 1185 din
 *    28 noiembrie 2024;
 *  - (8 oct 2026) suma scutită în ianuarie–iunie 2026: 300 lei, plafon 4.300 lei
 *    — OUG 89/2025 art. III alin. (1), forma consolidată din 16.08.2026;
```
Tot în antet, bloc vechi:
```ts
 * Valabil pentru iulie–decembrie 2026: la 1 ianuarie 2027 facilitatea expiră
 * (art. III alin. (6)) și valorile se reverifică.
```
Bloc nou:
```ts
 * Valabil pentru 2026, pe cele două perioade din `PERIOADE_2026`: la 1 ianuarie
 * 2027 facilitatea expiră (art. III alin. (6)) și valorile se reverifică.
 * `valoriExpirate()` face pagina să spună asta din prima zi a lui 2027.
```
După linia 31 (`export const SALARIU_MINIM_BRUT_2026_IULIE = 4325;`):
```ts

/** HG 1506/2024 art. 1: în vigoare de la 1 ianuarie 2025 până la 30 iunie 2026 (abrogată de HG 146/2026 art. 2). */
export const SALARIU_MINIM_BRUT_2026_IANUARIE = 4050;
```
În `VERIFICARE`, bloc vechi:
```ts
export const VERIFICARE = {
  la: "2026-10-03",
  surse: [
    {
      eticheta: "HG 146/2026 — salariul minim",
      href: "https://legislatie.just.ro/Public/DetaliiDocumentAfis/308231",
    },
```
Bloc nou:
```ts
export const VERIFICARE = {
  la: "2026-10-08",
  surse: [
    {
      eticheta: "HG 146/2026 — salariul minim",
      href: "https://legislatie.just.ro/Public/DetaliiDocumentAfis/308231",
    },
    {
      eticheta: "HG 1506/2024 — salariul minim până la 30 iunie 2026",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/291450",
    },
```
Bloc vechi (liniile 91-106):
```ts
export const SETARI_SALARIZARE_PUBLICE: PayrollSettingsSnapshot = {
  valabilDeLa: "2026-07-01",
  cotaCas: 0.25,
  cotaCass: 0.1,
  cotaImpozit: 0.1,
  cotaCamAngajator: 0.0225,
  normaZilnicaOre: 8,
  procentSporNoapte: 0.25,
  procentSporWeekend: 0,
  procentOreSuplimentare: 0.75,
  valoareTichetMasa: 0,
  ticheteImpozabile: false,
  deducerePersonala: grilaDeducerePersonala(SALARIU_MINIM_BRUT_2026_IULIE),
  rotunjireLei: true,
  salariuMinimBrut: SALARIU_MINIM_BRUT_2026_IULIE,
};
```
Bloc nou:
```ts
function setariPentruMinim(minim: number, valabilDeLa: string): PayrollSettingsSnapshot {
  return {
    valabilDeLa,
    cotaCas: 0.25,
    cotaCass: 0.1,
    cotaImpozit: 0.1,
    cotaCamAngajator: 0.0225,
    normaZilnicaOre: 8,
    procentSporNoapte: 0.25,
    procentSporWeekend: 0,
    procentOreSuplimentare: 0.75,
    valoareTichetMasa: 0,
    ticheteImpozabile: false,
    deducerePersonala: grilaDeducerePersonala(minim),
    rotunjireLei: true,
    salariuMinimBrut: minim,
  };
}

export const SETARI_SALARIZARE_PUBLICE: PayrollSettingsSnapshot = setariPentruMinim(
  SALARIU_MINIM_BRUT_2026_IULIE,
  "2026-07-01",
);

/** Cele două perioade ale lui 2026. Cheia e și valoarea din adresă (`?perioada=`). */
export type Perioada = "2026-1" | "2026-2";

export type ValoriPerioada = Readonly<{
  eticheta: string;
  valabilDeLa: string;
  valabilPana: string;
  salariuMinim: number;
  /** Text, nu număr: se afișează, nu se calculează cu el. */
  oreLunaMedie: string;
  leiPeOra: string;
  actSalariuMinim: string;
  /** OUG 89/2025 art. III alin. (1): suma scutită și plafonul de venit brut (fără tichete). */
  facilitate: Readonly<{ suma: number; plafonVenitBrut: number }>;
  setari: PayrollSettingsSnapshot;
}>;

export const PERIOADE_2026: Readonly<Record<Perioada, ValoriPerioada>> = {
  "2026-1": {
    eticheta: "ianuarie–iunie 2026",
    valabilDeLa: "2026-01-01",
    valabilPana: "2026-06-30",
    salariuMinim: SALARIU_MINIM_BRUT_2026_IANUARIE,
    oreLunaMedie: "165,334",
    leiPeOra: "24,496",
    actSalariuMinim: "HG 1506/2024",
    // OUG 89/2025 art. III alin. (1): 300 de lei pe lună pentru 1 ianuarie–30 iunie
    // 2026; lit. b): venit brut, fără tichete, de cel mult 4.300 de lei.
    facilitate: { suma: 300, plafonVenitBrut: 4300 },
    setari: setariPentruMinim(SALARIU_MINIM_BRUT_2026_IANUARIE, "2026-01-01"),
  },
  "2026-2": {
    eticheta: "iulie–decembrie 2026",
    valabilDeLa: FACILITATE_SALARIU_MINIM.valabilDeLa,
    valabilPana: FACILITATE_SALARIU_MINIM.valabilPana,
    salariuMinim: SALARIU_MINIM_BRUT_2026_IULIE,
    oreLunaMedie: "166,667",
    leiPeOra: "25,949",
    actSalariuMinim: "HG 146/2026",
    facilitate: {
      suma: FACILITATE_SALARIU_MINIM.suma,
      plafonVenitBrut: FACILITATE_SALARIU_MINIM.plafonVenitBrut,
    },
    setari: SETARI_SALARIZARE_PUBLICE,
  },
};

export const PERIOADE: readonly Perioada[] = ["2026-1", "2026-2"];

export function estePerioada(v: string | null): v is Perioada {
  return v === "2026-1" || v === "2026-2";
}

/**
 * Perioada în care cade o zi `AAAA-LL-ZZ` (ziua din România, `todayInBucharest()`).
 * După 31 decembrie 2026 rămâne a doua jumătate a lui 2026; `valoriExpirate` o
 * spune pe față, în loc să prezinte valorile vechi drept actuale.
 */
export function perioadaPentruZi(zi: string): Perioada {
  return zi < PERIOADE_2026["2026-2"].valabilDeLa ? "2026-1" : "2026-2";
}

export function valoriExpirate(zi: string): boolean {
  return zi > PERIOADE_2026["2026-2"].valabilPana;
}
```

`src/lib/unelte/salariu.ts`, înlocuit integral:
```ts
import { PERIOADE_2026, type Perioada } from "@/content/legal/salarizare-publica";
import { calculatePayrollEntry, type PayrollCalcInput } from "@/domain/payroll/calc";

/**
 * Brut → net și net → brut pentru calculatorul public, prin ACELAȘI motor ca
 * modulul de salarizare (`calculatePayrollEntry`). Un calculator public care ar
 * socoti altfel decât produsul ar arăta, pe aceeași cifră, două neturi diferite.
 *
 * Întrebarea e „cât iese net din brutul ăsta”: o lună întreagă lucrată, fără
 * absențe, sporuri sau rețineri, într-una din cele două perioade ale lui 2026
 * (`PERIOADE_2026`: salariul minim și suma scutită diferă).
 *
 * Singurul lucru pe care motorul nu-l știe e suma neimpozabilă de la salariul
 * minim (OUG 89/2025 art. III): 300 de lei în ianuarie–iunie 2026 și 200 de lei
 * în iulie–decembrie, scoși din baza de impozit, CAS, CASS și CAM. Se aplică
 * aici, peste motor.
 */

export type OptiuniSalariu = Readonly<{
  perioada: Perioada;
  /** 0–4; 4 înseamnă „4 și peste”, ca în tabelul art. 77 alin. (4). */
  persoane: number;
  functieDeBaza: boolean;
}>;

/** Normă întreagă, funcția de bază, fără persoane, în iulie–decembrie 2026. */
export const OPTIUNI_IMPLICITE: OptiuniSalariu = {
  perioada: "2026-2",
  persoane: 0,
  functieDeBaza: true,
};

export type RezultatSalariu = Readonly<{
  brut: number;
  cas: number;
  cass: number;
  deducerePersonala: number;
  impozit: number;
  /** Suma scoasă din baza de impozit și contribuții (OUG 89/2025 art. III); 0 când nu se aplică. */
  sumaNeimpozabila: number;
  net: number;
  cam: number;
  costTotal: number;
}>;

const BRUT_MIN = 1;
export const BRUT_MAX = 500_000;

const margineste = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

function intrare(brutImpozabil: number, o: OptiuniSalariu): PayrollCalcInput {
  const setari = PERIOADE_2026[o.perioada].setari;
  return {
    // Deducerea personală se acordă numai la funcția de bază (art. 77 alin. (1)
    // Cod fiscal). Motorul n-are noțiunea; în afara ei, grila e goală.
    settings: o.functieDeBaza ? setari : { ...setari, deducerePersonala: [] },
    contract: { salariuBaza: brutImpozabil, nrPersoaneIntretinere: o.persoane },
    // Luna întreagă, ca O SINGURĂ zi lucrătoare. Motorul împarte salariul la
    // zilele lucrătoare și îl înmulțește înapoi cu zilele lucrate; cu 21 de zile,
    // 5.394 / 21 × 21 ieșea 5.393,999… în virgulă mobilă, iar CAS-ul de 1.348,50
    // se rotunjea la 1.348 în loc de 1.349 (OUG 59/2005: 50 de bani în sus).
    // Circa 225 de bruturi între 4.325 și 20.000 aveau un leu greșit (8 oct 2026).
    attendance: {
      zileLucratoareLuna: 1,
      zileLucrate: 1,
      oreLucrate: setari.normaZilnicaOre,
      oreSuplimentare: 0,
      oreNoapte: 0,
      zileConcediuOdihna: 0,
      zileConcediuMedical: 0,
      zileAbsentaNemotivata: 0,
    },
    bonuses: [],
    deductions: [],
  };
}

/**
 * Condițiile art. III alin. (1): funcția de bază, normă întreagă (presupusă de
 * calculator), salariul de bază egal cu minimul PERIOADEI, venit brut de cel
 * mult plafonul ei. Fără sporuri, brutul calculatorului ESTE salariul de bază.
 */
function sumaNeimpozabila(brut: number, o: OptiuniSalariu): number {
  const v = PERIOADE_2026[o.perioada];
  return o.functieDeBaza && brut === v.salariuMinim && brut <= v.facilitate.plafonVenitBrut
    ? v.facilitate.suma
    : 0;
}

export function calculeazaDinBrut(brut: number, optiuni: OptiuniSalariu): RezultatSalariu {
  const b = Math.round(margineste(brut, BRUT_MIN, BRUT_MAX) * 100) / 100;
  const o: OptiuniSalariu = {
    ...optiuni,
    persoane: Math.round(margineste(optiuni.persoane, 0, 10)),
  };
  const scutit = sumaNeimpozabila(b, o);
  // Motorul calculează impozitul și contribuțiile pe brutul FĂRĂ suma scutită;
  // omul primește însă tot brutul, deci suma scutită se adaugă înapoi la net.
  const r = calculatePayrollEntry(intrare(b - scutit, o));
  return {
    brut: b,
    cas: r.cas,
    cass: r.cass,
    deducerePersonala: r.deducerePersonala,
    impozit: r.impozit,
    sumaNeimpozabila: scutit,
    net: r.net + scutit,
    cam: r.camAngajator,
    costTotal: b + r.camAngajator,
  };
}

/** Cât poate coborî înapoi căutarea: o treaptă a grilei de deducere (50 de lei), cu rezervă. */
const RECUL_MAXIM_LEI = 60;

/**
 * Net → brut: cel mai mic brut întreg care atinge netul cerut.
 *
 * Netul NU e strict monoton în brut: la fiecare prag de 50 de lei, deducerea
 * personală scade cu 0,5% din salariul minim, iar netul coboară cu până la ~2
 * lei înainte să urce iar. Bisecția găsește un brut bun, dar nu neapărat pe cel
 * mai mic — de aceea se caută înapoi, leu cu leu, o treaptă întreagă. Un brut cu
 * câțiva lei prea mare ar fi bani în plus pentru angajator.
 */
export function calculeazaDinNet(net: number, optiuni: OptiuniSalariu): RezultatSalariu {
  const tinta = margineste(net, BRUT_MIN, BRUT_MAX);
  const calc = (b: number) => calculeazaDinBrut(b, optiuni);
  let jos = BRUT_MIN;
  let sus = BRUT_MAX;
  for (let i = 0; i < 60 && sus - jos > 0.01; i += 1) {
    const mijloc = (jos + sus) / 2;
    if (calc(mijloc).net < tinta) jos = mijloc;
    else sus = mijloc;
  }
  let start = Math.ceil(sus);
  let ales = calc(start);
  // Bisecția merge pe bruturi cu bani: un brut fracționar poate atinge ținta prin
  // rotunjirea contribuțiilor, iar întregul de deasupra să rămână cu un leu SUB
  // ea. Auditul din 7 oct 2026 a găsit 26 din 124 de ținte rotunde (2.700–15.000)
  // întoarse cu netul = ținta − 1. Se urcă leu cu leu până când ținta e atinsă.
  for (let pas = 0; ales.net < tinta && pas < 4 * RECUL_MAXIM_LEI && start < BRUT_MAX; pas += 1) {
    start += 1;
    ales = calc(start);
  }
  // La salariul minim, suma neimpozabilă face netul să sară în sus, iar brutul
  // de imediat deasupra are un net MAI MIC. Minimul perioadei se încearcă explicit.
  const laMinim = calc(PERIOADE_2026[optiuni.perioada].salariuMinim);
  if (laMinim.net >= tinta && laMinim.brut < ales.brut) ales = laMinim;
  for (let b = start - 1; b >= Math.max(BRUT_MIN, start - RECUL_MAXIM_LEI); b -= 1) {
    const r = calc(b);
    if (r.net >= tinta && r.brut < ales.brut) ales = r;
  }
  return ales;
}

/** Forma scurtă, cu valorile din iulie–decembrie 2026 (ghidul salariului minim, viniețele). */
export function dinBrut(brut: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  return calculeazaDinBrut(brut, { ...OPTIUNI_IMPLICITE, persoane, functieDeBaza });
}

export function dinNet(net: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  return calculeazaDinNet(net, { ...OPTIUNI_IMPLICITE, persoane, functieDeBaza });
}
```

`src/app/(marketing)/unelte/calculator-salariu/parametri.ts`. Importurile și tot ce urmează după `citesteSuma` se înlocuiesc. Capul fișierului (bloc vechi):
```ts
import { SALARIU_MINIM_BRUT_2026_IULIE } from "@/content/legal/salarizare-publica";
import { parseAmount } from "@/lib/format/money";
import { dinBrut, dinNet, type RezultatSalariu } from "@/lib/unelte/salariu";
```
Bloc nou:
```ts
import {
  estePerioada,
  PERIOADE_2026,
  perioadaPentruZi,
  valoriExpirate,
} from "@/content/legal/salarizare-publica";
import { parseAmount } from "@/lib/format/money";
import {
  calculeazaDinBrut,
  calculeazaDinNet,
  type OptiuniSalariu,
  type RezultatSalariu,
} from "@/lib/unelte/salariu";
```
Totul de la `export type ParametriCalculator` până la finalul fișierului se înlocuiește cu:
```ts
export type ParametriCalculator = Readonly<{
  /** Textul din câmp, întors în formular așa cum l-a scris omul — și când n-a putut fi citit. */
  text: string;
  /** Suma citită, la leu; `null` când textul n-a putut fi citit. */
  suma: number | null;
  eroare: string | null;
  /** Suma avea bani și a fost rotunjită la leu. */
  rotunjita: boolean;
  din: "brut" | "net";
  optiuni: OptiuniSalariu;
}>;

/** Un întreg din adresă, mărginit; `implicit` când lipsește sau nu e număr. */
function intreg(text: string | null, implicit: number, min: number, max: number): number {
  const n = Number.parseInt(text ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : implicit;
}

function optiuniDin(q: URLSearchParams, azi: string): OptiuniSalariu {
  const ceruta = q.get("perioada");
  return {
    perioada: estePerioada(ceruta) ? ceruta : perioadaPentruZi(azi),
    persoane: intreg(q.get("persoane"), 0, 0, 4),
    functieDeBaza: q.get("baza") !== "nu",
  };
}

/**
 * @param azi Ziua curentă în România (`todayInBucharest()`), care alege perioada
 *   când adresa n-o spune. E parametru, nu ceas citit aici, ca testele să fie fixe.
 */
export function parametriCalculator(q: URLSearchParams, azi: string): ParametriCalculator {
  const optiuni = optiuniDin(q, azi);
  const minim = PERIOADE_2026[optiuni.perioada].salariuMinim;
  const text = (q.get("suma") ?? "").slice(0, 20);
  const gol = text.trim() === "";
  const citire: CitireSuma = gol
    ? { ok: true, valoare: minim, rotunjita: false }
    : citesteSuma(text);
  return {
    text: gol ? String(minim) : text,
    suma: citire.ok ? citire.valoare : null,
    eroare: citire.ok ? null : citire.eroare,
    rotunjita: citire.ok && citire.rotunjita,
    din: q.get("din") === "net" ? "net" : "brut",
    optiuni,
  };
}

export type CalculCalculator = Readonly<{
  parametri: ParametriCalculator;
  /** `null` când nu există un calcul pentru cifra cerută; motivul e în `eroare`. */
  rezultat: RezultatSalariu | null;
  eroare: string | null;
  /** Brutul minim legal pentru opțiunile alese: pragul lui `subMinim`. */
  minimLegal: number;
  subMinim: boolean;
  /** Ziua de azi e după ultima perioadă cu valori verificate (31 decembrie 2026). */
  expirat: boolean;
}>;

export function calculeazaDinParametri(q: URLSearchParams, azi: string): CalculCalculator {
  const p = parametriCalculator(q, azi);
  const minimLegal = PERIOADE_2026[p.optiuni.perioada].salariuMinim;
  const expirat = valoriExpirate(azi);
  if (p.suma === null) {
    return { parametri: p, rezultat: null, eroare: p.eroare, minimLegal, subMinim: false, expirat };
  }
  const rezultat =
    p.din === "net" ? calculeazaDinNet(p.suma, p.optiuni) : calculeazaDinBrut(p.suma, p.optiuni);
  return {
    parametri: p,
    rezultat,
    eroare: null,
    minimLegal,
    subMinim: rezultat.brut < minimLegal,
    expirat,
  };
}
```

`formular.tsx`. Importurile, bloc vechi:
```tsx
import type { ParametriCalculator } from "./parametri";
```
Bloc nou:
```tsx
import { PERIOADE, PERIOADE_2026 } from "@/content/legal/salarizare-publica";

import type { ParametriCalculator } from "./parametri";
```
Bloc vechi:
```tsx
    <form method="get" action="#rezultat" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
```
Bloc nou:
```tsx
    <form method="get" action="#rezultat" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```
Bloc vechi:
```tsx
        <select name="persoane" defaultValue={String(p.persoane)} className={CLASA_CAMP}>
```
Bloc nou:
```tsx
        <select name="persoane" defaultValue={String(p.optiuni.persoane)} className={CLASA_CAMP}>
```
Bloc vechi (subșir din rândul `<select name="baza" …>`, pe care `prettier` l-a adus pe un singur rând în C2; `Edit` îl găsește oricum ar fi împărțit rândul):
```tsx
defaultValue={p.functieDeBaza ? "da" : "nu"}
```
Bloc nou:
```tsx
defaultValue={p.optiuni.functieDeBaza ? "da" : "nu"}
```
Bloc vechi:
```tsx
      <div className="flex items-end sm:col-span-2 lg:col-span-4">
```
Bloc nou (câmpul de perioadă stă înaintea butonului):
```tsx
      <label className="flex flex-col gap-1.5">
        <span className={CLASA_ETICHETA}>Perioada</span>
        <select name="perioada" defaultValue={p.optiuni.perioada} className={CLASA_CAMP}>
          {PERIOADE.map((cheie) => (
            <option key={cheie} value={cheie}>
              {PERIOADE_2026[cheie].eticheta}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
```

`page.tsx`. Bloc vechi:
```tsx
import { formatDate } from "@/lib/format/date";
```
Bloc nou:
```tsx
import { formatDate, todayInBucharest } from "@/lib/format/date";
```
Bloc vechi:
```tsx
  const q = new URLSearchParams();
  for (const cheie of ["suma", "din", "persoane", "baza"]) {
    const v = unul(p[cheie]);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  const { parametri, rezultat, eroare, subMinim } = calculeazaDinParametri(q);
```
Bloc nou:
```tsx
  const q = new URLSearchParams();
  // Toate cheile: `parametri.ts` le citește doar pe cele pe care le cunoaște.
  for (const [cheie, valoare] of Object.entries(p)) {
    const v = unul(valoare);
    if (v !== undefined && v !== "") q.set(cheie, v);
  }
  // Ziua din România alege perioada implicită și spune când valorile au expirat.
  // Pagina e oricum dinamică (citește `searchParams`), deci ceasul nu se îngheață la build.
  const { parametri, rezultat, eroare, minimLegal, subMinim, expirat } = calculeazaDinParametri(
    q,
    todayInBucharest(),
  );
```
În banda rezultatului (forma din C1), bloc vechi:
```tsx
        {rezultat === null ? (
          <p
            id="eroare-suma"
```
Bloc nou:
```tsx
        {expirat && (
          <p
            role="note"
            className="border-mk-cerneala mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]"
          >
            Valorile sunt cele verificate pentru 2026. Pentru 2027, calculatorul nu are încă
            valori verificate: salariul minim, suma scutită și deducerea se pot schimba.
          </p>
        )}
        {rezultat === null ? (
          <p
            id="eroare-suma"
```
Bloc vechi (tot textul paragrafului `subMinim`, ca în C1):
```tsx
                Brutul e sub salariul minim de {lei(SALARIU_MINIM_BRUT_2026_IULIE)}. Cu normă
                întreagă, salariul nu poate fi mai mic; la timp parțial, CAS și CASS se datorează în
                general cel puțin la nivelul salariului minim, cu excepțiile din Codul fiscal (de
                exemplu elevii și studenții până la 26 de ani) — calculul de mai sus nu le aplică.
```
Bloc nou (deja în forma lui `prettier`, ca blocul vechi din C7 să se potrivească exact):
```tsx
                Brutul e sub salariul minim de {lei(minimLegal)}. Cu normă întreagă, salariul nu
                poate fi mai mic; la timp parțial, CAS și CASS se datorează în general cel puțin la
                nivelul salariului minim, cu excepțiile din Codul fiscal (de exemplu elevii și
                studenții până la 26 de ani) — calculul de mai sus nu le aplică.
```
În banda „Limitele”, bloc vechi:
```tsx
          Valorile sunt cele din iulie–decembrie 2026; pentru statul de plată, confirmă cu
          contabilul firmei.
```
Bloc nou:
```tsx
          Valorile sunt cele din perioada aleasă a lui 2026; pentru statul de plată, confirmă cu
          contabilul firmei.
```
Data din `harta.ts` se ridică.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/content/legal/ src/lib/unelte/ "src/app/(marketing)/unelte/calculator-salariu/" src/content/landing/continut.test.ts "src/app/(marketing)/_componente/"`
  (`_componente/` conține `viniete.tsx`, care cheamă `dinBrut(6000, 0, true)`, iar ghidul cheamă `dinBrut(MINIM, 0, true)`: semnăturile scurte au rămas.) Apoi lanțul complet și `prettier --write`/`--check`.

- [ ] **Pasul 5: Verificarea headless.**
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=4050&perioada=2026-1|Net 2.574 lei din brut 4.050 lei" \
  "suma=5394|− 1.349 lei" \
  "|Net 2.699 lei din brut 4.325 lei"
```
Așteptat: 6 × `OK`. Pe `desktop-0.png`, câmpul „Perioada” arată „ianuarie–iunie 2026”. Bannerul de expirare nu se poate vedea azi. E acoperit de testul `expirat` din `parametri.test.ts`.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- src/content/legal/salarizare-publica.ts src/content/legal/salarizare-publica.test.ts src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/content/legal src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git commit --only -m "feat(unelte): calculatorul de salariu pe ianuarie–iunie și iulie–decembrie 2026, cu facilitatea legată de perioadă" -m "4.050 lei și 300 de lei scutiți în prima jumătate (HG 1506/2024, OUG 89/2025 art. III), banner după 31.12.2026, iar luna intră în motor ca o singură zi: 5.394 / 21 × 21 rotunjea CAS-ul de 1.348,50 în jos." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/content/legal/salarizare-publica.ts src/content/legal/salarizare-publica.test.ts src/lib/unelte/salariu.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task C4: Net → brut nu întoarce niciodată un brut ilegal, iar netul de neatins e refuzat pe față

**De ce, în plus față de audit:** în timp ce scriam planul am simulat căutarea pe toate opțiunile și am găsit un defect live, nu doar cel cu minimul. Cu 3 sau 4 persoane în întreținere, net→brut întoarce un brut cu până la 185 de lei prea mare lângă pragul minim + 2.000. Exemple din producție, pe 8 oct 2026: `?suma=3715&din=net&persoane=4` dă brut 6.291, dar 6.153 dă exact 3.715. `?suma=3800&din=net&persoane=4` dă 6.496 în loc de 6.311. Simularea a găsit 94 de ținte greșite între 3.600 și 3.900 la 4 persoane. Cu deducerea sub 26 de ani (C5), aceeași cădere apare la orice număr de persoane.

**Fișiere:**
- Modify: `src/content/legal/salarizare-publica.ts` (`PLAFON_DEDUCERE_PESTE_MINIM`, după `grilaDeducerePersonala`)
- Modify: `src/lib/unelte/salariu.ts`: importul, `calculeazaDinNet` și `dinNet` (forma din C3)
- Modify: `src/lib/unelte/salariu.test.ts`: liniile 25-32 și 57-63, cele două apeluri `calculeazaDinNet(…, S1).brut` din C3, plus un bloc nou
- Modify: `src/app/(marketing)/unelte/calculator-salariu/parametri.ts`, `parametri.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx` (destructurarea și o notă în banda rezultatului)
- Modify: `src/content/landing/harta.ts` (data)

**Interfețe:**
- Consumă: `calculeazaDinBrut`, `PERIOADE_2026`, `lei` (C2).
- Produce:
  ```ts
  export function brutMinimLegal(o: OptiuniSalariu): number;
  export type RezultatNet = Readonly<{ rezultat: RezultatSalariu; ridicatLaMinim: boolean }>;
  export function calculeazaDinNet(net: number, optiuni: OptiuniSalariu): RezultatNet | null; // era RezultatSalariu
  // CalculCalculator primește: ridicatLaMinim: boolean
  ```

- [ ] **Pasul 1: Scrie testele care pică.**

`src/lib/unelte/salariu.test.ts`, bloc vechi (liniile 25-32):
```ts
  it("dinNet întoarce CEL MAI MIC brut care atinge netul cerut, și lângă praguri", () => {
    const bruturi = Array.from({ length: 1201 }, (_, i) => 3500 + i);
    const neturi = bruturi.map((b) => dinBrut(b, 0, true).net);
    for (const tinta of [2600, 2642.13, 2643, 2650, 2700]) {
      const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
      expect(dinNet(tinta, 0, true).brut, String(tinta)).toBe(minim);
    }
  });
```
Bloc nou:
```ts
  it("dinNet întoarce CEL MAI MIC brut LEGAL care atinge netul cerut, și lângă praguri", () => {
    // Bruturile încep la salariul minim: sub el, niciun brut nu e un răspuns (auditul din 8 oct 2026).
    const bruturi = Array.from({ length: 1201 }, (_, i) => 4325 + i);
    const neturi = bruturi.map((b) => dinBrut(b, 0, true).net);
    for (const tinta of [2600, 2700, 2710, 2731.5, 2750, 3000]) {
      const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
      expect(dinNet(tinta, 0, true).brut, String(tinta)).toBe(minim);
    }
  });
```
Bloc vechi (liniile 57-63):
```ts
  it("un net sub cel de la salariul minim întoarce salariul minim, nu un brut sub el", () => {
    // Cu o persoană în întreținere, netul la minim e peste 2.700: niciun brut
    // legal cu normă întreagă nu dă exact 2.700.
    const r = dinNet(2700, 1, true);
    expect(r.brut).toBe(4325);
    expect(r.net).toBeGreaterThanOrEqual(2700);
  });
```
Bloc nou:
```ts
  it("un net sub cel de la salariul minim întoarce salariul minim, nu un brut sub el", () => {
    // Cu o persoană în întreținere, netul la minim e peste 2.700: niciun brut
    // legal cu normă întreagă nu dă exact 2.700.
    const r = dinNet(2700, 1, true);
    expect(r.brut).toBe(4325);
    expect(r.net).toBeGreaterThanOrEqual(2700);
    // Fără persoane, cazul pe care testul vechi nu-l acoperea: 2.614 întorcea 4.320.
    expect(dinNet(2614, 0, true).brut).toBe(4325);
  });
```
În blocul `describe("perioada ianuarie–iunie 2026")` din C3, bloc vechi:
```ts
    expect(calculeazaDinNet(2575, S1).brut).toBe(4280);
    expect(calculeazaDinNet(2574, S1).brut).toBe(4050);
```
Bloc nou:
```ts
    expect(calculeazaDinNet(2575, S1)?.rezultat.brut).toBe(4280);
    expect(calculeazaDinNet(2574, S1)?.rezultat.brut).toBe(4050);
```
La finalul fișierului:
```ts
describe("net → brut nu coboară sub minimul legal și nu plafonează tăcut", () => {
  it("fără persoane, orice net sub 2.699 întoarce 4.325, marcat ca ridicare la minim", () => {
    // Auditul din 8 oct 2026, live: 2.614 → 4.320, 2.500 → 4.127, 1.500 → 2.417.
    for (const tinta of [2614, 2500, 1500, 1]) {
      const r = calculeazaDinNet(tinta, OPTIUNI_IMPLICITE);
      expect(r?.rezultat.brut, String(tinta)).toBe(4325);
      expect(r?.rezultat.net, String(tinta)).toBe(2699);
      expect(r?.ridicatLaMinim, String(tinta)).toBe(true);
    }
  });

  it("exact netul de la minim nu e o ridicare", () => {
    expect(calculeazaDinNet(2699, OPTIUNI_IMPLICITE)).toMatchObject({
      ridicatLaMinim: false,
      rezultat: { brut: 4325 },
    });
  });

  it("în ianuarie–iunie, minimul legal e 4.050", () => {
    const r = calculeazaDinNet(2000, { ...OPTIUNI_IMPLICITE, perioada: "2026-1" });
    expect(r?.rezultat.brut).toBe(4050);
    expect(r?.ridicatLaMinim).toBe(true);
  });

  it("un net peste ce dă brutul de 500.000 de lei e refuzat, nu plafonat", () => {
    // 500.000 brut: CAS 125.000, CASS 50.000, fără deducere; impozit 32.500; net 292.500.
    expect(calculeazaDinNet(292_500, OPTIUNI_IMPLICITE)?.rezultat.brut).toBe(500_000);
    expect(calculeazaDinNet(292_501, OPTIUNI_IMPLICITE)).toBeNull();
    expect(calculeazaDinNet(500_000, OPTIUNI_IMPLICITE)).toBeNull();
  });

  it("lângă pragul de minim + 2.000, cu 3–4 persoane, brutul nu iese cu 100+ lei prea mare", () => {
    // Live, 8 oct 2026: net 3.715 cu 4 persoane → brut 6.291 (net 3.788), iar 6.153 dă exact 3.715.
    // 6.153: minim + 1.828, pasul 37, 45% − 18,5 = 26,5% × 4.325 = 1.146,13 → 1.146.
    // Impozit (6.153 − 1.538,25 − 615,3 − 1.146) × 10% = 285,345 → 285; net 6.153 − 1.538 − 615 − 285 = 3.715.
    expect(dinNet(3715, 4, true).brut).toBe(6153);
    expect(dinNet(3800, 4, true).brut).toBe(6311);
    for (const persoane of [3, 4]) {
      const bruturi = Array.from({ length: 2400 }, (_, i) => 4325 + i);
      const neturi = bruturi.map((b) => dinBrut(b, persoane, true).net);
      for (let tinta = 3600; tinta <= 3900; tinta += 5) {
        const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
        expect(dinNet(tinta, persoane, true).brut, `${String(persoane)} pers., ${String(tinta)}`).toBe(
          minim,
        );
      }
    }
  });
});
```

`parametri.test.ts`, la finalul fișierului:
```ts
describe("net → brut, din adresă", () => {
  it("un net mai mic decât cel de la minim: brutul e minimul, cu explicație", () => {
    const r = calculeazaDinParametri(q({ suma: "2614", din: "net" }), AZI);
    expect(r.rezultat?.brut).toBe(4325);
    expect(r.ridicatLaMinim).toBe(true);
    expect(r.subMinim).toBe(false);
  });

  it("un net de neatins primește un mesaj, nu un calcul pentru alt net", () => {
    const r = calculeazaDinParametri(q({ suma: "300.000", din: "net" }), AZI);
    expect(r.rezultat).toBeNull();
    expect(r.eroare).toBe(
      "Pentru un net de 300.000 lei ar trebui un brut de peste 500.000 lei, cât acoperă calculatorul.",
    );
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts"`
  Așteptat: `dinNet(2614, 0, true).brut` primește 4320 în loc de 4325, `dinNet(3715, 4, true).brut` primește 6291 în loc de 6153, `calculeazaDinNet(292_501, …)` primește un obiect în loc de `null`, iar `r.ridicatLaMinim` e `undefined`. Pe forma din C3, `pnpm typecheck` raportează și `Property 'rezultat' does not exist on type 'RezultatSalariu'`.

- [ ] **Pasul 3: Implementarea minimă.**

`src/content/legal/salarizare-publica.ts`, după funcția `grilaDeducerePersonala`:
```ts

/** Art. 77 alin. (3): deducerea de bază se acordă până la minim + 2.000 de lei inclusiv. */
export const PLAFON_DEDUCERE_PESTE_MINIM = PAS_LEI * PASI;
```

`src/lib/unelte/salariu.ts`. Bloc vechi (din C3):
```ts
import { PERIOADE_2026, type Perioada } from "@/content/legal/salarizare-publica";
```
Bloc nou:
```ts
import {
  PERIOADE_2026,
  type Perioada,
  PLAFON_DEDUCERE_PESTE_MINIM,
} from "@/content/legal/salarizare-publica";
```
Bloc vechi (din C3):
```ts
export function calculeazaDinNet(net: number, optiuni: OptiuniSalariu): RezultatSalariu {
  const tinta = margineste(net, BRUT_MIN, BRUT_MAX);
  const calc = (b: number) => calculeazaDinBrut(b, optiuni);
  let jos = BRUT_MIN;
  let sus = BRUT_MAX;
```
Bloc nou:
```ts
function celMaiMicBrut(tinta: number, optiuni: OptiuniSalariu): RezultatSalariu {
  const calc = (b: number) => calculeazaDinBrut(b, optiuni);
  // Pragul deducerii (art. 77 alin. (3), minim + 2.000 de lei). Peste el, deducerea
  // de bază dispare dintr-o dată (la 4 persoane, 25% × 4.325 = 1.081 de lei) și
  // netul cade cu peste 100 de lei. Căutarea înapoi de 60 de lei nu trecea peste
  // cădere: net 3.715 cu 4 persoane întorcea 6.291 (net 3.788) în loc de 6.153,
  // adică 138 de lei de brut în plus (live, 8 oct 2026). Sub prag și peste el,
  // netul e aproape monoton, așa că se caută doar în partea care conține răspunsul.
  const prag = Math.max(
    BRUT_MIN,
    Math.floor(PERIOADE_2026[optiuni.perioada].salariuMinim + PLAFON_DEDUCERE_PESTE_MINIM),
  );
  // Sub prag, netul e cel mai mare în ultimii lei dinaintea lui. O rotunjire de 50
  // de bani îl poate muta cu un leu (cu tichete, CASS 632,50 → 633 la 5.425 face
  // netul de acolo mai mic decât cel de la 5.424), deci se încearcă ultimii cinci
  // lei. Dacă niciunul nu atinge ținta, niciun brut de dedesubt n-o atinge, iar
  // brutul găsit devine capătul de sus al bisecției, care rămâne valid.
  let atinsSubPrag: number | null = null;
  for (let b = prag; b >= Math.max(BRUT_MIN, prag - 5) && atinsSubPrag === null; b -= 1) {
    if (calc(b).net >= tinta) atinsSubPrag = b;
  }
  let jos = atinsSubPrag === null ? prag : BRUT_MIN;
  let sus = atinsSubPrag ?? BRUT_MAX;
```
Bloc vechi (finalul fișierului, din C3):
```ts
  return ales;
}

/** Forma scurtă, cu valorile din iulie–decembrie 2026 (ghidul salariului minim, viniețele). */
export function dinBrut(brut: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  return calculeazaDinBrut(brut, { ...OPTIUNI_IMPLICITE, persoane, functieDeBaza });
}

export function dinNet(net: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  return calculeazaDinNet(net, { ...OPTIUNI_IMPLICITE, persoane, functieDeBaza });
}
```
Bloc nou:
```ts
  return ales;
}

/** Brutul minim legal pentru opțiunile alese: salariul minim al perioadei, la normă întreagă. */
export function brutMinimLegal(o: OptiuniSalariu): number {
  return PERIOADE_2026[o.perioada].salariuMinim;
}

export type RezultatNet = Readonly<{
  rezultat: RezultatSalariu;
  /** Netul cerut era sub cel de la brutul minim legal: s-a întors brutul minim, nu unul ilegal. */
  ridicatLaMinim: boolean;
}>;

/**
 * Net → brut, cu două refuzuri pe față:
 * - un net peste ce dă brutul maxim întoarce `null` (era „Net 292.500 din brut
 *   500.000” pentru un net cerut de 500.000);
 * - un net sub cel de la brutul minim legal întoarce brutul minim legal, marcat:
 *   auditul din 8 oct 2026 a găsit 2.614 → 4.320, 2.500 → 4.127, 1.500 → 2.417,
 *   salarii pe care nu le poți plăti.
 */
export function calculeazaDinNet(net: number, optiuni: OptiuniSalariu): RezultatNet | null {
  const tinta = margineste(net, BRUT_MIN, BRUT_MAX);
  if (calculeazaDinBrut(BRUT_MAX, optiuni).net < tinta) return null;
  const ales = celMaiMicBrut(tinta, optiuni);
  const minim = brutMinimLegal(optiuni);
  if (ales.brut >= minim) return { rezultat: ales, ridicatLaMinim: false };
  let b = Math.ceil(minim);
  let r = calculeazaDinBrut(b, optiuni);
  for (let pas = 0; r.net < tinta && pas < 4 * RECUL_MAXIM_LEI && b < BRUT_MAX; pas += 1) {
    b += 1;
    r = calculeazaDinBrut(b, optiuni);
  }
  return { rezultat: r, ridicatLaMinim: true };
}

/** Forma scurtă, cu valorile din iulie–decembrie 2026 (ghidul salariului minim, viniețele). */
export function dinBrut(brut: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  return calculeazaDinBrut(brut, { ...OPTIUNI_IMPLICITE, persoane, functieDeBaza });
}

/** Netul de neatins cade pe brutul maxim: forma scurtă nu are cum să spună „nu se poate”. */
export function dinNet(net: number, persoane: number, functieDeBaza: boolean): RezultatSalariu {
  const o: OptiuniSalariu = { ...OPTIUNI_IMPLICITE, persoane, functieDeBaza };
  return calculeazaDinNet(net, o)?.rezultat ?? calculeazaDinBrut(BRUT_MAX, o);
}
```
Comentariul JSDoc de deasupra fostei `calculeazaDinNet` („Net → brut: cel mai mic brut întreg…”) rămâne deasupra lui `celMaiMicBrut`.

`parametri.ts`. Bloc vechi:
```ts
import {
  calculeazaDinBrut,
  calculeazaDinNet,
  type OptiuniSalariu,
  type RezultatSalariu,
} from "@/lib/unelte/salariu";
```
Bloc nou:
```ts
import {
  BRUT_MAX,
  brutMinimLegal,
  calculeazaDinBrut,
  calculeazaDinNet,
  type OptiuniSalariu,
  type RezultatSalariu,
} from "@/lib/unelte/salariu";

import { lei } from "./lei";
```
Bloc vechi:
```ts
  subMinim: boolean;
  /** Ziua de azi e după ultima perioadă cu valori verificate (31 decembrie 2026). */
  expirat: boolean;
}>;
```
Bloc nou:
```ts
  subMinim: boolean;
  /** Netul cerut era sub cel de la brutul minim legal; brutul afișat e minimul. */
  ridicatLaMinim: boolean;
  /** Ziua de azi e după ultima perioadă cu valori verificate (31 decembrie 2026). */
  expirat: boolean;
}>;
```
Funcția `calculeazaDinParametri`, înlocuită integral:
```ts
export function calculeazaDinParametri(q: URLSearchParams, azi: string): CalculCalculator {
  const p = parametriCalculator(q, azi);
  const minimLegal = brutMinimLegal(p.optiuni);
  const expirat = valoriExpirate(azi);
  const faraRezultat = (eroare: string | null): CalculCalculator => ({
    parametri: p,
    rezultat: null,
    eroare,
    minimLegal,
    subMinim: false,
    ridicatLaMinim: false,
    expirat,
  });
  if (p.suma === null) return faraRezultat(p.eroare);
  if (p.din === "brut") {
    const rezultat = calculeazaDinBrut(p.suma, p.optiuni);
    return {
      parametri: p,
      rezultat,
      eroare: null,
      minimLegal,
      subMinim: rezultat.brut < minimLegal,
      ridicatLaMinim: false,
      expirat,
    };
  }
  const r = calculeazaDinNet(p.suma, p.optiuni);
  if (r === null) {
    return faraRezultat(
      `Pentru un net de ${lei(p.suma)} ar trebui un brut de peste ${lei(BRUT_MAX)}, cât acoperă calculatorul.`,
    );
  }
  return {
    parametri: p,
    rezultat: r.rezultat,
    eroare: null,
    minimLegal,
    subMinim: r.rezultat.brut < minimLegal,
    ridicatLaMinim: r.ridicatLaMinim,
    expirat,
  };
}
```
Importul `PERIOADE_2026` rămâne (îl folosește `parametriCalculator`).

`page.tsx`. Bloc vechi:
```tsx
  const { parametri, rezultat, eroare, minimLegal, subMinim, expirat } = calculeazaDinParametri(
    q,
    todayInBucharest(),
  );
```
Bloc nou:
```tsx
  const { parametri, rezultat, eroare, minimLegal, subMinim, ridicatLaMinim, expirat } =
    calculeazaDinParametri(q, todayInBucharest());
```
Bloc vechi:
```tsx
            <div className="mt-6">
              <Desfasurator r={rezultat} />
            </div>
```
Bloc nou:
```tsx
            {ridicatLaMinim && (
              <p className="border-mk-cerneala mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]">
                Netul cerut e mai mic decât cel de la brutul minim legal. Brutul nu poate coborî sub{" "}
                {lei(minimLegal)}, deci acesta e brutul, iar netul real iese {lei(rezultat.net)}.
              </p>
            )}
            <div className="mt-6">
              <Desfasurator r={rezultat} />
            </div>
```
Data din `harta.ts` se ridică.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/lib/unelte/ "src/app/(marketing)/unelte/calculator-salariu/" src/content/legal/`, apoi lanțul complet și `prettier --write`/`--check`.

- [ ] **Pasul 5: Verificarea headless.**
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=2614&din=net|Net 2.699 lei din brut 4.325 lei" \
  "suma=2614&din=net|Brutul nu poate coborî sub 4.325 lei" \
  "suma=500000&din=net|ar trebui un brut de peste 500.000 lei"
```
Așteptat: 6 × `OK`.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- src/content/legal/salarizare-publica.ts src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/content/legal src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git commit --only -m "fix(unelte): net → brut nu mai întoarce un brut sub salariul minim, nici unul prea mare lângă pragul deducerii" -m "2.614 net dădea 4.320 brut; 3.715 net cu 4 persoane dădea 6.291 în loc de 6.153; 500.000 net era plafonat tăcut la 292.500." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/content/legal/salarizare-publica.ts src/lib/unelte/salariu.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu/parametri.ts" "src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts" "src/app/(marketing)/unelte/calculator-salariu/page.tsx" src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task C5: Deducerea personală completă — sub 26 de ani, copiii la școală, plafonată la venit

**Fișiere:**
- Modify: `src/content/legal/salarizare-publica.ts` (după `grilaDeducerePersonala`), `salarizare-publica.test.ts` (import, bloc nou)
- Modify: `src/lib/unelte/salariu.ts` (importuri, `OptiuniSalariu`, `OPTIUNI_IMPLICITE`, `RezultatSalariu`, `intrare`, `calculeazaDinBrut`, funcție nouă `deduceri`), `salariu.test.ts` (bloc nou)
- Modify: `src/app/(marketing)/unelte/calculator-salariu/parametri.ts` (`optiuniDin`), `parametri.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/formular.tsx`, `formular.test.tsx`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/randuri.ts`, `randuri.test.ts`
- Modify: `NOTES.md` §3, „Deducere personală”
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx` (lista „Ce nu calculează”)
- Modify: `src/content/landing/harta.ts` (data)

**Verificare pe sursă** (Codul fiscal, `https://legislatie.just.ro/Public/DetaliiDocument/171282`, forma consolidată din 08.08.2026, citită pe 8 oct 2026). Se descarcă cu `curl`, ca în C3, și se caută `Articolul 77 Deducere personală`.
- Alin. (1): deducerea se acordă „numai pentru veniturile din salarii la locul unde se află funcția de bază”.
- Alin. (2): „cuprinde deducerea personală de bază și deducerea personală suplimentară și se acordă în limita venitului impozabil lunar realizat”.
- Alin. (3): până la „2.000 de lei peste nivelul salariului de bază minim brut”.
- Alin. (10) lit. a): „15% din salariul de bază minim brut … pentru persoanele fizice cu vârsta de până la 26 de ani, care realizează venituri din salarii al căror nivel este de până la nivelul prevăzut la alin. (3)”.
- Alin. (10) lit. b): „100 de lei lunar pentru fiecare copil cu vârsta de până la 18 ani, dacă acesta este înscris într-o unitate de învățământ, părintelui …, indiferent de nivelul acestora”.
- Nota de consolidare: articolul e „modificat de Punctul 40, Articolul I din ORDONANȚA nr. 16 din 15 iulie 2022”, în vigoare de la 01.01.2023, fără modificări ulterioare.

**Interfețe:**
- Consumă: `grilaDeducerePersonala`, `PROCENTE_BAZA`, `PAS_LEI`, `PASI` (`salarizare-publica.ts:64-66`, locale).
- Produce:
  ```ts
  // salarizare-publica.ts (PLAFON_DEDUCERE_PESTE_MINIM există din C4)
  export function valoareDeducereDeBaza(minim: number, persoane: number, venitBrut: number): number;
  export function valoareDeducereSub26(minim: number): number;
  export const DEDUCERE_COPIL_SCOALA = 100;
  // salariu.ts — OptiuniSalariu primește: sub26: boolean; copiiScoala: number
  // RezultatSalariu primește: deducereDeBaza, deducereSub26, deducereCopii: number;
  //   deducerePersonala devine deducerea ACORDATĂ (≤ venitul impozabil)
  ```

- [ ] **Pasul 1: Scrie testele care pică.**

`salarizare-publica.test.ts`: în importul din C3 se adaugă `valoareDeducereDeBaza` și `valoareDeducereSub26`:
```ts
import {
  FACILITATE_SALARIU_MINIM,
  grilaDeducerePersonala,
  PERIOADE_2026,
  perioadaPentruZi,
  SETARI_SALARIZARE_PUBLICE as S,
  valoareDeducereDeBaza,
  valoareDeducereSub26,
  valoriExpirate,
  VERIFICARE,
} from "./salarizare-publica";
```
La final:
```ts
describe("deducerile calculate direct, fără grilă", () => {
  const dinGrila = (minim: number, persoane: number, venit: number) =>
    [...grilaDeducerePersonala(minim)]
      .filter(
        (p) =>
          persoane >= p.nrPersoaneIntretinereMin &&
          (p.nrPersoaneIntretinereMax === null || persoane <= p.nrPersoaneIntretinereMax) &&
          venit <= p.venitBrutMax,
      )
      .sort((a, b) => a.venitBrutMax - b.venitBrutMax)[0]?.valoare ?? 0;

  it("deducerea de bază e pragul din grilă, pe fiecare leu și fiecare număr de persoane, în ambele perioade", () => {
    for (const minim of [4050, 4325]) {
      for (let persoane = 0; persoane <= 5; persoane += 1) {
        for (let venit = minim - 3; venit <= minim + 2003; venit += 1) {
          const unde = `${String(minim)}/${String(persoane)}/${String(venit)}`;
          expect(valoareDeducereDeBaza(minim, persoane, venit), unde).toBe(
            dinGrila(minim, persoane, venit),
          );
        }
      }
    }
  });

  it("sub 26 de ani: 15% din minim — 648,75 → 649 din iulie, 607,50 → 608 în ianuarie–iunie", () => {
    // ⚠ Art. 66 Cod fiscal ar neglija 50 de bani: 607. Întrebare deschisă în NOTES.md §3.
    expect(valoareDeducereSub26(4325)).toBe(649);
    expect(valoareDeducereSub26(4050)).toBe(608);
  });
});
```

`salariu.test.ts`, la final:
```ts
describe("deducerea personală suplimentară (art. 77 alin. (10))", () => {
  const O = OPTIUNI_IMPLICITE;

  it("sub 26 de ani, brut 5.000: deducere 562 + 649 = 1.211, net 3.046", () => {
    // 15% × 4.325 = 648,75 → 649. Impozit (5.000 − 1.250 − 500 − 1.211) × 10% = 203,9 → 204.
    // Net 5.000 − 1.250 − 500 − 204 = 3.046 (fără deducerea suplimentară: 2.981).
    expect(calculeazaDinBrut(5000, { ...O, sub26: true })).toMatchObject({
      deducereDeBaza: 562,
      deducereSub26: 649,
      deducerePersonala: 1211,
      impozit: 204,
      net: 3046,
    });
  });

  it("sub 26 de ani se oprește la minim + 2.000: 6.325 o primește, 6.326 nu", () => {
    // 6.325: deducerea de bază e 0% (pasul 40), cea suplimentară 649. CAS 1.581,25 → 1.581,
    // CASS 632,50 → 633; impozit (6.325 − 1.581,25 − 632,5 − 649) × 10% = 346,225 → 346; net 3.765.
    expect(calculeazaDinBrut(6325, { ...O, sub26: true })).toMatchObject({
      deducereSub26: 649,
      net: 3765,
    });
    // 6.326: nicio deducere. CAS 1.581,50 → 1.582; CASS 632,60 → 633;
    // impozit (6.326 − 1.581,5 − 632,6) × 10% = 411,19 → 411; net 6.326 − 1.582 − 633 − 411 = 3.700.
    expect(calculeazaDinBrut(6326, { ...O, sub26: true })).toMatchObject({
      deducereSub26: 0,
      net: 3700,
    });
  });

  it("copiii la școală: 100 de lei pe copil, indiferent de venit — brut 8.000, un copil: net 4.690", () => {
    // Peste minim + 2.000 nu există deducere de bază. Impozit (8.000 − 2.000 − 800 − 100) × 10% = 510;
    // net 8.000 − 2.000 − 800 − 510 = 4.690 (fără copil: impozit 520, net 4.680).
    expect(calculeazaDinBrut(8000, { ...O, copiiScoala: 1 })).toMatchObject({
      deducereCopii: 100,
      net: 4690,
    });
    expect(calculeazaDinBrut(8000, O).net).toBe(4680);
  });

  it("sub 26 de ani și doi copii, brut 5.000: 1.411 lei deducere, net 3.066", () => {
    // 562 + 649 + 200 = 1.411. Impozit (5.000 − 1.250 − 500 − 1.411) × 10% = 183,9 → 184; net 3.066.
    expect(calculeazaDinBrut(5000, { ...O, sub26: true, copiiScoala: 2 })).toMatchObject({
      deducerePersonala: 1411,
      net: 3066,
    });
  });

  it("în afara funcției de bază, nicio deducere — nici cea suplimentară (alin. (1))", () => {
    // 4.325 fără facilitate (cere funcția de bază): CAS 1.081,25 → 1.081; CASS 432,50 → 433;
    // impozit (4.325 − 1.081,25 − 432,5) × 10% = 281,125 → 281; net 4.325 − 1.081 − 433 − 281 = 2.530.
    expect(
      calculeazaDinBrut(4325, { ...O, functieDeBaza: false, sub26: true, copiiScoala: 3 }),
    ).toMatchObject({ deducerePersonala: 0, deducereSub26: 0, deducereCopii: 0, net: 2530 });
  });

  it("deducerea afișată nu trece de venitul impozabil (art. 77 alin. (2))", () => {
    // 1.000 brut, 4 persoane: grila dă 45% × 4.325 = 1.946,25 → 1.946, dar venitul după CAS (250)
    // și CASS (100) e 650. Impozitul e 0 oricum; acum și cifra afișată e 650.
    expect(calculeazaDinBrut(1000, { ...O, persoane: 4 })).toMatchObject({
      deducereDeBaza: 1946,
      deducerePersonala: 650,
      impozit: 0,
      net: 650,
    });
  });

  it("⚠ comportamentul de azi, de confirmat (NOTES.md §3): CAS și CASS NErotunjite în baza de impozit", () => {
    // 4.453: deducere pasul 3, 18,5% × 4.325 = 800,125 → 800. (4.453 − 1.113,25 − 445,30 − 800) × 10%
    // = 209,445 → 209. Cu CAS și CASS rotunjite întâi: 209,5 → 210. O schimbare trebuie să fie deliberată.
    expect(dinBrut(4453, 0, true).impozit).toBe(209);
  });

  it("⚠ comportamentul de azi, de confirmat: 18% × 4.325 = 778,50 se rotunjește în sus, la 779", () => {
    expect(dinBrut(4500, 0, true).deducerePersonala).toBe(779);
  });
});
```

`randuri.test.ts`: importul
```ts
import { dinBrut } from "@/lib/unelte/salariu";
```
devine
```ts
import { calculeazaDinBrut, dinBrut, OPTIUNI_IMPLICITE } from "@/lib/unelte/salariu";
```
iar înainte de ultimul `});` al fișierului:
```ts
  it("deducerile suplimentare apar pe rânduri, iar totalul plafonat spune că e plafonat", () => {
    const r = calculeazaDinBrut(5000, { ...OPTIUNI_IMPLICITE, sub26: true, copiiScoala: 2 });
    const randuri = randuriDesfasurator(r).angajat.map((x) => [x.eticheta, x.valoare]);
    expect(randuri).toContainEqual(["Deducere de bază", 562]);
    expect(randuri).toContainEqual(["Deducere sub 26 de ani", 649]);
    expect(randuri).toContainEqual(["Deducere pentru copiii înscriși la școală", 200]);
    expect(randuri).toContainEqual(["Deducere personală, total", 1411]);
    const mic = calculeazaDinBrut(1000, { ...OPTIUNI_IMPLICITE, persoane: 4 });
    expect(randuriDesfasurator(mic).angajat.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "Deducere personală, în limita venitului",
      650,
    ]);
  });
```

`parametri.test.ts`. În testul „implicit…” din C3, bloc vechi:
```ts
      optiuni: { perioada: "2026-2", persoane: 0, functieDeBaza: true },
```
Bloc nou:
```ts
      optiuni: { perioada: "2026-2", persoane: 0, functieDeBaza: true, sub26: false, copiiScoala: 0 },
```
La final:
```ts
describe("deducerile suplimentare, din adresă", () => {
  it("sub26=da și copii=2 ajung în opțiuni; copiii sunt mărginiți la 6", () => {
    const o = parametriCalculator(q({ sub26: "da", copii: "2" }), AZI).optiuni;
    expect([o.sub26, o.copiiScoala]).toEqual([true, 2]);
    expect(parametriCalculator(q({ copii: "40" }), AZI).optiuni.copiiScoala).toBe(6);
    expect(parametriCalculator(q({ sub26: "1" }), AZI).optiuni.sub26).toBe(false);
  });

  it("5.000 brut, sub 26 de ani: net 3.046", () => {
    expect(calculeazaDinParametri(q({ suma: "5000", sub26: "da" }), AZI).rezultat?.net).toBe(3046);
  });
});
```

`formular.test.tsx`, înainte de ultimul `});`:
```tsx
  it("opțiunile suplimentare stau într-un <details>, deschis doar când una e aleasă", () => {
    expect(randeaza({}).querySelector("details")?.hasAttribute("open")).toBe(false);
    const c = randeaza({ sub26: "da", copii: "3" });
    expect(c.querySelector("details")?.hasAttribute("open")).toBe(true);
    expect(c.querySelector<HTMLInputElement>('input[name="sub26"]')?.checked).toBe(true);
    expect(c.querySelector<HTMLInputElement>('input[name="sub26"]')?.value).toBe("da");
    expect(c.querySelector<HTMLSelectElement>('select[name="copii"]')?.value).toBe("3");
  });
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/content/legal/salarizare-publica.test.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu/"`
  Așteptat: `valoareDeducereDeBaza` nu e exportată. `calculeazaDinBrut(5000, { …, sub26: true })` dă `deducerePersonala: 562` și `net: 2981`. `calculeazaDinBrut(1000, { persoane: 4 }).deducerePersonala` e 1946 în loc de 650. Formularul nu are `<details>`. Cele două teste ⚠ (4.453 și 4.500) TREC deja: fixează comportamentul existent.

- [ ] **Pasul 3: Implementarea minimă.**

`salarizare-publica.ts`, după `export const PLAFON_DEDUCERE_PESTE_MINIM = PAS_LEI * PASI;` (adăugat în C4):
```ts

/**
 * Deducerea de bază din art. 77 alin. (4), calculată direct pentru un venit.
 * Dă aceeași valoare ca pragul din `grilaDeducerePersonala` care acoperă venitul
 * (testat pe fiecare leu, în ambele perioade). `venitBrut` e venitul brut lunar
 * din salarii; calculatorul include în el tichetele (⚠ NOTES.md §3).
 */
export function valoareDeducereDeBaza(minim: number, persoane: number, venitBrut: number): number {
  if (venitBrut > minim + PLAFON_DEDUCERE_PESTE_MINIM) return 0;
  const pas = venitBrut <= minim ? 0 : Math.ceil((venitBrut - minim) / PAS_LEI);
  const baza = PROCENTE_BAZA[Math.min(4, Math.max(0, Math.round(persoane)))] ?? 0;
  return Math.round((Math.round(minim * 100) * (baza - 5 * pas)) / 100_000);
}

/**
 * Art. 77 alin. (10) lit. a): 15% din salariul minim, pentru cei de până la 26 de
 * ani cu venituri din salarii de cel mult minim + 2.000 de lei. Rotunjită ca grila,
 * cu 50 de bani în sus (⚠ art. 66: 607,50 → 607 sau 608; NOTES.md §3).
 */
export function valoareDeducereSub26(minim: number): number {
  return Math.round((Math.round(minim * 100) * 150) / 100_000);
}

/**
 * Art. 77 alin. (10) lit. b): 100 de lei pe lună pentru fiecare copil sub 18 ani
 * înscris la școală, „indiferent de nivelul” veniturilor părintelui.
 */
export const DEDUCERE_COPIL_SCOALA = 100;
```
În antetul fișierului, bloc vechi:
```ts
 * ── CE NU ACOPERĂ ─────────────────────────────────────────────────────────
 * Deducerea personală suplimentară (art. 77 alin. (10): sub 26 de ani, copii
 * înscriși la școală), facilitățile pe sectoare, tichetele, timpul parțial
 * (unde contribuțiile se datorează la minim). Pagina le spune pe față.
```
Bloc nou:
```ts
 * ── CE NU ACOPERĂ ─────────────────────────────────────────────────────────
 * Facilitățile pe sectoare (abrogate din 2025, OUG 156/2024), scutirea pentru
 * cercetare-dezvoltare, sporurile și concediile. Pagina le spune pe față.
 * Deducerea suplimentară (art. 77 alin. (10)) e acoperită din 8 oct 2026.
```

`src/lib/unelte/salariu.ts`. Bloc vechi (din C4):
```ts
import {
  PERIOADE_2026,
  type Perioada,
  PLAFON_DEDUCERE_PESTE_MINIM,
} from "@/content/legal/salarizare-publica";
```
Bloc nou:
```ts
import {
  DEDUCERE_COPIL_SCOALA,
  PERIOADE_2026,
  type Perioada,
  PLAFON_DEDUCERE_PESTE_MINIM,
  valoareDeducereDeBaza,
  valoareDeducereSub26,
} from "@/content/legal/salarizare-publica";
```
Bloc vechi:
```ts
  persoane: number;
  functieDeBaza: boolean;
}>;

/** Normă întreagă, funcția de bază, fără persoane, în iulie–decembrie 2026. */
export const OPTIUNI_IMPLICITE: OptiuniSalariu = {
  perioada: "2026-2",
  persoane: 0,
  functieDeBaza: true,
};
```
Bloc nou:
```ts
  persoane: number;
  functieDeBaza: boolean;
  /** Până la 26 de ani: deducerea suplimentară de 15% din minim (art. 77 alin. (10) lit. a)). */
  sub26: boolean;
  /** Copii sub 18 ani înscriși la școală: 100 de lei fiecare (art. 77 alin. (10) lit. b)). */
  copiiScoala: number;
}>;

/** Normă întreagă, funcția de bază, fără persoane, în iulie–decembrie 2026. */
export const OPTIUNI_IMPLICITE: OptiuniSalariu = {
  perioada: "2026-2",
  persoane: 0,
  functieDeBaza: true,
  sub26: false,
  copiiScoala: 0,
};
```
Bloc vechi:
```ts
  cass: number;
  deducerePersonala: number;
  impozit: number;
```
Bloc nou:
```ts
  cass: number;
  /** Deducerea ACORDATĂ: suma celor trei de mai jos, în limita venitului impozabil (art. 77 alin. (2)). */
  deducerePersonala: number;
  deducereDeBaza: number;
  deducereSub26: number;
  deducereCopii: number;
  impozit: number;
```
Bloc vechi:
```ts
function intrare(brutImpozabil: number, o: OptiuniSalariu): PayrollCalcInput {
  const setari = PERIOADE_2026[o.perioada].setari;
  return {
    // Deducerea personală se acordă numai la funcția de bază (art. 77 alin. (1)
    // Cod fiscal). Motorul n-are noțiunea; în afara ei, grila e goală.
    settings: o.functieDeBaza ? setari : { ...setari, deducerePersonala: [] },
```
Bloc nou:
```ts
function intrare(brutImpozabil: number, o: OptiuniSalariu, deducere: number): PayrollCalcInput {
  const setari = PERIOADE_2026[o.perioada].setari;
  return {
    // Deducerea o calculează `deduceri()` (art. 77, cu partea suplimentară, pe care
    // grila motorului n-o are); motorul o primește ca un singur prag, valabil
    // pentru orice venit. Funcția de bază se verifică tot în `deduceri()`.
    settings: {
      ...setari,
      deducerePersonala:
        deducere > 0
          ? [
              {
                nrPersoaneIntretinereMin: 0,
                nrPersoaneIntretinereMax: null,
                venitBrutMax: Number.MAX_SAFE_INTEGER,
                valoare: deducere,
              },
            ]
          : [],
    },
```
Bloc vechi (începutul lui `calculeazaDinBrut`, din C3):
```ts
  const o: OptiuniSalariu = {
    ...optiuni,
    persoane: Math.round(margineste(optiuni.persoane, 0, 10)),
  };
  const scutit = sumaNeimpozabila(b, o);
  // Motorul calculează impozitul și contribuțiile pe brutul FĂRĂ suma scutită;
  // omul primește însă tot brutul, deci suma scutită se adaugă înapoi la net.
  const r = calculatePayrollEntry(intrare(b - scutit, o));
  return {
    brut: b,
    cas: r.cas,
    cass: r.cass,
    deducerePersonala: r.deducerePersonala,
    impozit: r.impozit,
```
Bloc nou:
```ts
  const o: OptiuniSalariu = {
    ...optiuni,
    persoane: Math.round(margineste(optiuni.persoane, 0, 10)),
    copiiScoala: Math.round(margineste(optiuni.copiiScoala, 0, 10)),
  };
  const scutit = sumaNeimpozabila(b, o);
  const d = deduceri(b, o);
  // Motorul calculează impozitul și contribuțiile pe brutul FĂRĂ suma scutită;
  // omul primește însă tot brutul, deci suma scutită se adaugă înapoi la net.
  const r = calculatePayrollEntry(intrare(b - scutit, o, d.deBaza + d.sub26 + d.copii));
  // Art. 77 alin. (2): deducerea se acordă „în limita venitului impozabil lunar”.
  // Motorul o plafonează deja (baza de impozit nu coboară sub zero); aici se
  // plafonează și cifra afișată — la 4,5 lei brut se afișa „Deducere 865 lei”.
  const venitInainteDeDeducere = Math.max(0, b - scutit - r.cas - r.cass);
  return {
    brut: b,
    cas: r.cas,
    cass: r.cass,
    deducerePersonala: Math.min(r.deducerePersonala, venitInainteDeDeducere),
    deducereDeBaza: d.deBaza,
    deducereSub26: d.sub26,
    deducereCopii: d.copii,
    impozit: r.impozit,
```
Funcție nouă, pusă imediat înaintea lui `export function calculeazaDinBrut`:
```ts
type Deduceri = Readonly<{ deBaza: number; sub26: number; copii: number }>;

/**
 * Deducerea personală, art. 77 Cod fiscal: cea de bază (alin. (4)) plus cea
 * suplimentară (alin. (10)) — 15% din minim până la 26 de ani, pentru un venit de
 * cel mult minim + 2.000 de lei, și 100 de lei pe copil înscris la școală,
 * indiferent de venit. Toată se acordă numai la funcția de bază (alin. (1)).
 */
function deduceri(venitBrut: number, o: OptiuniSalariu): Deduceri {
  if (!o.functieDeBaza) return { deBaza: 0, sub26: 0, copii: 0 };
  const minim = PERIOADE_2026[o.perioada].salariuMinim;
  return {
    deBaza: valoareDeducereDeBaza(minim, o.persoane, venitBrut),
    sub26:
      o.sub26 && venitBrut <= minim + PLAFON_DEDUCERE_PESTE_MINIM ? valoareDeducereSub26(minim) : 0,
    copii: DEDUCERE_COPIL_SCOALA * o.copiiScoala,
  };
}
```
(Grila de bază se aplică pe brutul ÎNTREG, nu pe cel diminuat cu suma scutită. La salariul minim, amândouă sunt sub prag și dau aceeași valoare: 865, respectiv 810.)

`parametri.ts`, în `optiuniDin`, bloc vechi:
```ts
    persoane: intreg(q.get("persoane"), 0, 0, 4),
    functieDeBaza: q.get("baza") !== "nu",
  };
```
Bloc nou:
```ts
    persoane: intreg(q.get("persoane"), 0, 0, 4),
    functieDeBaza: q.get("baza") !== "nu",
    sub26: q.get("sub26") === "da",
    copiiScoala: intreg(q.get("copii"), 0, 0, 6),
  };
```

`randuri.ts`, bloc vechi:
```ts
      rand("Deducere personală", r.deducerePersonala, "info"),
```
Bloc nou:
```ts
      ...(r.deducereSub26 > 0 || r.deducereCopii > 0
        ? [
            rand("Deducere de bază", r.deducereDeBaza, "info"),
            ...(r.deducereSub26 > 0 ? [rand("Deducere sub 26 de ani", r.deducereSub26, "info")] : []),
            ...(r.deducereCopii > 0
              ? [rand("Deducere pentru copiii înscriși la școală", r.deducereCopii, "info")]
              : []),
          ]
        : []),
      rand(etichetaDeducere(r), r.deducerePersonala, "info"),
```
și, deasupra lui `export function randuriDesfasurator`:
```ts
function etichetaDeducere(r: RezultatSalariu): string {
  const calculata = r.deducereDeBaza + r.deducereSub26 + r.deducereCopii;
  if (r.deducerePersonala < calculata) return "Deducere personală, în limita venitului";
  return r.deducereSub26 > 0 || r.deducereCopii > 0 ? "Deducere personală, total" : "Deducere personală";
}
```

`formular.tsx`: o constantă și un bloc `<details>` înaintea `<div className="flex items-end …">` al butonului. Bloc vechi:
```tsx
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
```
Bloc nou:
```tsx
      <details
        open={areOptiuniAlese(p)}
        className="border-mk-rigla border-t pt-4 sm:col-span-2 lg:col-span-3"
      >
        <summary className="cursor-pointer text-[0.9375rem] font-medium">
          Mai multe opțiuni
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-start gap-2 text-[0.9375rem] leading-[1.5]">
            <input
              type="checkbox"
              name="sub26"
              value="da"
              defaultChecked={p.optiuni.sub26}
              className="mt-1 size-4 shrink-0"
            />
            <span>
              Am vârsta „de până la 26 de ani” (art. 77 alin. (10) lit. a)): deducerea suplimentară
              de 15% din salariul minim
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>
              Copii sub 18 ani înscriși la școală (deducerea o ia un singur părinte, alin. (12))
            </span>
            <select name="copii" defaultValue={String(p.optiuni.copiiScoala)} className={CLASA_CAMP}>
              <option value="0">niciunul</option>
              <option value="1">1 — 100 de lei deducere</option>
              <option value="2">2 — 200 de lei</option>
              <option value="3">3 — 300 de lei</option>
              <option value="4">4 — 400 de lei</option>
              <option value="5">5 — 500 de lei</option>
              <option value="6">6 sau mai mulți — 600 de lei</option>
            </select>
          </label>
        </div>
      </details>
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
```
Și deasupra lui `export function Formular`:
```tsx
/** `<details>` se deschide singur când adresa are deja o opțiune suplimentară aleasă. */
function areOptiuniAlese(p: ParametriCalculator): boolean {
  return p.optiuni.sub26 || p.optiuni.copiiScoala > 0;
}
```
(„6 sau mai mulți” e mărginirea din `parametri.ts`, `intreg(…, 0, 0, 6)`. Legea nu are plafon de copii, așa că opțiunea spune 600 de lei, adică exact cât calculează aplicația.)

`NOTES.md`. Bloc vechi:
```markdown
⚠️ Salariul minim de referință · pragurile de venit × număr de persoane în
întreținere · procentele pe fiecare prag și intervalul de degresivitate.
```
Bloc nou:
```markdown
⚠️ Salariul minim de referință · pragurile de venit × număr de persoane în
întreținere · procentele pe fiecare prag și intervalul de degresivitate.

**Întrebări pentru contabil, din calculatorul public** (`/unelte/calculator-salariu`,
auditul din 8 oct 2026). Codul nu se schimbă fără răspuns, iar testele din
`src/lib/unelte/salariu.test.ts` marcate „⚠” fixează comportamentul de azi:

- ⚠️ **Deducerea care cade exact pe 50 de bani.** `grilaDeducerePersonala` și
  `valoareDeducereSub26` rotunjesc ,50 în SUS: 18% × 4.325 = 778,50 → 779;
  15% × 4.050 = 607,50 → 608. Art. 66 Cod fiscal („Stabilirea sumelor fixe”)
  neglijează fracțiunile „de până la 50 de bani inclusiv” → 778, respectiv 607.
  N-am găsit text care să spună dacă art. 66 se aplică unei deduceri calculate
  procentual. Exemplu: brut 4.476–4.525, fără persoane.
- ⚠️ **„Cu vârsta de până la 26 de ani” (art. 77 alin. (10) lit. a)).** Textul nu
  spune dacă luna în care omul împlinește 26 de ani mai intră. Calculatorul nu
  decide: bifa citează legea, iar omul alege. De confirmat cu contabilul ce lună
  e ultima cu deducerea suplimentară.
- ⚠️ **CAS și CASS rotunjite sau nu în baza de impozit.** `calculatePayrollEntry`
  (`src/domain/payroll/calc.ts`, `bazaImpozit`) scade CAS și CASS NErotunjite.
  Brut 4.453: (4.453 − 1.113,25 − 445,30 − 800) × 10% = 209,445 → 209. Cu
  contribuțiile rotunjite întâi (1.113 și 445, cum le declară D112) iese 209,5 →
  210, sau 209 dacă art. 66 se aplică și impozitului. Art. 78 alin. (2) lit. a)
  scade „contribuțiile … datorate”, iar OUG 59/2005 art. 1 rotunjește la leu
  sumele datorate. Diferența e de 1 leu la ~3% din bruturi. Răspunsul mută și
  statele de plată din aplicație, nu doar calculatorul.
```

`page.tsx`, lista „Ce nu calculează” (banda „Limitele”). Deducerea suplimentară nu mai e o limită. Bloc vechi:
```tsx
            "Deducerea personală suplimentară: 15% din salariul minim pentru cei sub 26 de ani și 100 de lei pentru fiecare copil înscris la școală — art. 77 alin. (10).",
            "Scutirile pentru persoanele cu handicap și tichetele de masă. Facilitățile pe sectoare de activitate nu se mai aplică veniturilor din 2025 (OUG 156/2024).",
```
Bloc nou:
```tsx
            "Scutirile pentru persoanele cu handicap și tichetele de masă. Facilitățile pe sectoare de activitate nu se mai aplică veniturilor din 2025 (OUG 156/2024).",
```

Data din `harta.ts` se ridică.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/content/legal/ src/lib/unelte/ "src/app/(marketing)/unelte/calculator-salariu/" "src/app/(marketing)/_componente/"`, apoi lanțul complet și `prettier --write`/`--check` (inclusiv `NOTES.md`).

- [ ] **Pasul 5: Verificarea headless.**
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=5000&sub26=da&copii=2|Net 3.066 lei din brut 5.000 lei" \
  "suma=5000&sub26=da&copii=2|Deducere sub 26 de ani 649 lei" \
  "suma=3046&din=net&sub26=da|din brut 5.000 lei"
```
Așteptat: 6 × `OK`. Pe `mobil-0.png`, `<details>` e deschis, iar bifa și textul ei încap fără derulare laterală.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- src/content/legal/salarizare-publica.ts src/content/legal/salarizare-publica.test.ts src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" NOTES.md src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/content/legal src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" NOTES.md src/content/landing/harta.ts
git commit --only -m "feat(unelte): deducerea sub 26 de ani și cea pentru copiii la școală în calculatorul de salariu" -m "Art. 77 alin. (10) lit. a) și b), doar la funcția de bază; deducerea afișată plafonată la venitul impozabil (alin. (2)). Două rotunjiri de 1 leu rămân întrebări pentru contabil în NOTES.md §3." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/content/legal/salarizare-publica.ts src/content/legal/salarizare-publica.test.ts src/lib/unelte/salariu.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu" NOTES.md src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task C6: Tichetele de masă

**Fișiere:**
- Modify: `src/content/legal/salarizare-publica.ts` (o constantă nouă, o sursă în `VERIFICARE`), `salarizare-publica.test.ts`
- Modify: `src/lib/unelte/salariu.ts`, `salariu.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/parametri.ts`, `parametri.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/formular.tsx`, `formular.test.tsx`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/randuri.ts`, `randuri.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx` (`<Formular>`, avertismentele)
- Modify: `NOTES.md` §3, „Tichete de masă”
- Modify: `src/content/landing/harta.ts` (data)

**Verificare pe sursă** (citit pe 8 oct 2026; se reface cu `curl`, ca în C3):
- Legea 165/2018, `https://legislatie.just.ro/Public/DetaliiDocument/202623`, forma consolidată din 01.12.2025. Art. 14: „Valoarea nominală a unui tichet de masă nu poate depăși suma de 45 lei.” (modificat de Legea 201/2025). Nota cu art. II din Legea 201/2025 spune că valoarea se aplică „și în semestrul I al anului 2026, precum și în primele trei luni ale semestrului II al anului 2026”. Art. 32: indexare semestrială prin ordin comun. Art. 12 alin. (2): „un număr de tichete de masă cel mult egal cu numărul de zile lucrate”.
- Codul fiscal (doc. 171282, 08.08.2026): art. 76 alin. (3) lit. h) (tichetele de masă intră în veniturile salariale), art. 142 lit. r) (nu intră în baza CAS), art. 157 alin. (1) lit. ț) (intră în baza CASS, de la 01.01.2024, prin Legea 296/2023), art. 220^4 alin. (2) („Nu se cuprind în baza lunară de calcul al contribuției asiguratorie pentru muncă sumele prevăzute la art. 142”).
- OUG 89/2025 art. III alin. (1) lit. b): plafonul de 4.300 / 4.600 lei se socotește „fără a include contravaloarea tichetelor de masă”.
- Dacă vreo sursă a fost modificată după 8 oct 2026 (un ordin de indexare publicat, de exemplu), constanta urmează sursa, iar testul care o fixează se schimbă odată cu ea.

**Interfețe:**
- Consumă: `PayrollSettingsSnapshot.valoareTichetMasa`, `ticheteImpozabile`, `ticheteSupuseCass` (`calc.ts:101-108`); `attendance.zileLucrate` (= 1, din C3) dă numărul de tichete din motor.
- Produce:
  ```ts
  // salarizare-publica.ts
  export const TICHET_MASA_VALOARE_MAXIMA = 45;
  // salariu.ts — OptiuniSalariu.tichete: Readonly<{ valoare: number; numar: number }>; RezultatSalariu.tichete: number
  // parametri.ts
  export const TICHETE_MAXIM_PE_LUNA = 23;
  // ParametriCalculator primește: textTichet: string; campCuEroare: "suma" | "tichet" | null
  // CalculCalculator primește: avertismente: readonly string[]
  // Formular: semnătura devine Formular({ p }: { readonly p: ParametriCalculator })
  ```

- [ ] **Pasul 1: Scrie testele care pică.**

`salarizare-publica.test.ts`: `TICHET_MASA_VALOARE_MAXIMA` se adaugă în import (ordine alfabetică, după `SETARI_SALARIZARE_PUBLICE as S`). La final:
```ts
describe("tichetele de masă", () => {
  it("valoarea maximă e 45 de lei (Legea 165/2018 art. 14, din Legea 201/2025)", () => {
    expect(TICHET_MASA_VALOARE_MAXIMA).toBe(45);
    expect(VERIFICARE.surse.map((s) => s.href)).toContain(
      "https://legislatie.just.ro/Public/DetaliiDocument/202623",
    );
  });
});
```

`salariu.test.ts`, la final:
```ts
describe("tichetele de masă", () => {
  const O = OPTIUNI_IMPLICITE;
  const T = { valoare: 45, numar: 20 };

  it("brut 5.000 și 20 × 45 lei: CASS și impozit pe tichete, CAS și CAM nu — net 2.771, cost 6.013", () => {
    // Tichete 900. CAS 25% × 5.000 = 1.250 (art. 142 lit. r): fără tichete). CASS 10% × 5.900 = 590
    // (art. 157 alin. (1) lit. ț)). Deducerea pe venitul de 5.900 (⚠ tichetele incluse): minim + 1.575,
    // pasul 32, 4% × 4.325 = 173. Impozit (5.000 − 1.250 − 590 − 173 + 900) × 10% = 388,7 → 389.
    // Net în cont 5.000 − 1.250 − 590 − 389 = 2.771. CAM 2,25% × 5.000 = 112,50 → 113, fără tichete
    // (art. 220^4 alin. (2)). Cost 5.000 + 113 + 900 = 6.013.
    expect(calculeazaDinBrut(5000, { ...O, tichete: T })).toMatchObject({
      tichete: 900,
      cas: 1250,
      cass: 590,
      deducerePersonala: 173,
      impozit: 389,
      net: 2771,
      cam: 113,
      costTotal: 6013,
    });
  });

  it("la salariul minim, tichetele nu strică facilitatea: plafonul OUG 89 le exclude", () => {
    // Baza 4.125. CAS 1.031,25 → 1.031. CASS 10% × (4.125 + 900) = 502,50 → 503.
    // Deducerea pe 5.225: pasul 18, 11% × 4.325 = 475,75 → 476.
    // Impozit (4.125 − 1.031,25 − 502,5 − 476 + 900) × 10% = 301,525 → 302.
    // Net 4.125 − 1.031 − 503 − 302 + 200 = 2.489. CAM 2,25% × 4.125 = 92,81 → 93; cost 4.325 + 93 + 900 = 5.318.
    expect(calculeazaDinBrut(4325, { ...O, tichete: T })).toMatchObject({
      sumaNeimpozabila: 200,
      cass: 503,
      deducerePersonala: 476,
      impozit: 302,
      net: 2489,
      costTotal: 5318,
    });
  });

  it("tichete cu bani: 21 × 40,18 = 843,78 lei, la ban", () => {
    expect(calculeazaDinBrut(5000, { ...O, tichete: { valoare: 40.18, numar: 21 } }).tichete).toBe(
      843.78,
    );
  });

  it("net → brut ține cont de tichete: 2.771 în cont cere 5.000 brut", () => {
    expect(calculeazaDinNet(2771, { ...O, tichete: T })?.rezultat.brut).toBe(5000);
  });

  it("cu tichete, pragul deducerii coboară în brut: 4 persoane, 20 × 45 lei — cel mai mic brut, pe toată plaja", () => {
    // Venitul grilei e brut + 900, deci deducerea dispare la 5.426 de lei brut, nu la 6.326:
    // netul cade de la 3.110 (5.425) la 3.002 (5.426). Cu pragul socotit fără tichete, simularea a dat 50 de ținte
    // greșite între 2.900 și 3.400; de exemplu, 3.062 întorcea 5.527 în loc de 5.339.
    const o = { ...O, persoane: 4, tichete: T };
    const bruturi = Array.from({ length: 2400 }, (_, i) => 4325 + i);
    const neturi = bruturi.map((b) => calculeazaDinBrut(b, o).net);
    for (let tinta = 2900; tinta <= 3400; tinta += 7) {
      const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
      expect(calculeazaDinNet(tinta, o)?.rezultat.brut, String(tinta)).toBe(minim);
    }
    // Chiar sub prag, rotunjirea mută netul cu un leu. 5.424: CASS (5.424 + 900) × 10% = 632,40 → 632,
    // impozit (5.424 − 1.356 − 632,4 − 1.081 + 900) × 10% = 325,46 → 325, net 3.111.
    // 5.425: CASS 632,50 → 633, impozit 325,525 → 326, net 3.110. Pentru 3.111, răspunsul e 5.424.
    expect(calculeazaDinNet(3111, o)?.rezultat.brut).toBe(5424);
  });

  it("valoare fără număr sau număr fără valoare înseamnă fără tichete", () => {
    expect(calculeazaDinBrut(5000, { ...O, tichete: { valoare: 45, numar: 0 } }).net).toBe(2981);
    expect(calculeazaDinBrut(5000, { ...O, tichete: { valoare: 0, numar: 20 } }).net).toBe(2981);
  });

  it("tichete de 23 × 100 de lei: pragul deducerii (4.025) cade sub minim, iar net → brut rămâne legal și minim", () => {
    // Review Focus 5: fereastra de cinci lei de sub prag cade sub minimul legal.
    const o = { ...O, persoane: 4, tichete: { valoare: 100, numar: 23 } };
    const bruturi = Array.from({ length: 4000 }, (_, i) => 4325 + i);
    const neturi = bruturi.map((b) => calculeazaDinBrut(b, o).net);
    for (let tinta = 2000; tinta <= 4000; tinta += 37) {
      const minim = bruturi.find((_, i) => (neturi[i] ?? 0) >= tinta);
      expect(calculeazaDinNet(tinta, o)?.rezultat.brut, String(tinta)).toBe(minim);
    }
  });
});
```

`randuri.test.ts`, înainte de ultimul `});`:
```ts
  it("cu tichete, ambele desfășurătoare se închid, iar tichetele apar pe card și în cost", () => {
    const r = calculeazaDinBrut(5000, { ...OPTIUNI_IMPLICITE, tichete: { valoare: 45, numar: 20 } });
    const { angajat, angajator } = randuriDesfasurator(r);
    expect(r.brut - suma(angajat, "minus")).toBe(r.net);
    expect(suma(angajator, "plus")).toBe(r.costTotal);
    expect(angajat.map((x) => [x.eticheta, x.valoare])).toContainEqual(["Tichete de masă, pe card", 900]);
    expect(angajat.map((x) => [x.eticheta, x.valoare])).toContainEqual(["Net și tichete, împreună", 3671]);
    expect(angajator.map((x) => x.eticheta)).toContain("Tichete de masă");
  });
```

`parametri.test.ts`. În testul „implicit…”, obiectul așteptat devine:
```ts
    expect(parametriCalculator(new URLSearchParams(), AZI)).toEqual({
      text: "4325",
      suma: 4325,
      eroare: null,
      campCuEroare: null,
      rotunjita: false,
      din: "brut",
      textTichet: "",
      optiuni: {
        perioada: "2026-2",
        persoane: 0,
        functieDeBaza: true,
        sub26: false,
        copiiScoala: 0,
        tichete: { valoare: 0, numar: 0 },
      },
    });
```
La final:
```ts
describe("tichetele de masă, din adresă", () => {
  it("„45” și 20 de tichete ajung în opțiuni; „40,18” rămâne cu bani; numărul e mărginit la 23", () => {
    expect(parametriCalculator(q({ tichet: "45", tichete: "20" }), AZI).optiuni.tichete).toEqual({
      valoare: 45,
      numar: 20,
    });
    expect(parametriCalculator(q({ tichet: "40,18 lei", tichete: "21" }), AZI).optiuni.tichete).toEqual(
      { valoare: 40.18, numar: 21 },
    );
    expect(parametriCalculator(q({ tichete: "99" }), AZI).optiuni.tichete.numar).toBe(23);
  });

  it("o valoare necitibilă oprește calculul, cu mesaj pe câmpul tichetului", () => {
    const r = calculeazaDinParametri(q({ suma: "5000", tichet: "patruzeci", tichete: "20" }), AZI);
    expect(r.rezultat).toBeNull();
    expect(r.eroare).toBe("Nu am înțeles valoarea tichetului „patruzeci”.");
    expect(r.parametri.campCuEroare).toBe("tichet");
    expect(calculeazaDinParametri(q({ tichet: "250" }), AZI).eroare).toBe(
      "Valoarea unui tichet de masă trebuie să fie între 0 și 100 de lei.",
    );
  });

  it("peste 45 de lei: avertisment, nu refuz", () => {
    const r = calculeazaDinParametri(q({ suma: "5000", tichet: "50", tichete: "20" }), AZI);
    expect(r.rezultat).not.toBeNull();
    expect(r.avertismente).toEqual([
      "Legea 165/2018 (art. 14) limitează tichetul de masă la 45 de lei. Peste, diferența nu mai e tichet de masă, ci venit cu toate contribuțiile; calculul de mai sus o tratează totuși ca tichet.",
    ]);
    expect(calculeazaDinParametri(q({ suma: "5000", tichet: "45", tichete: "20" }), AZI).avertismente).toEqual([]);
  });

  it("5.000 brut și 20 de tichete de 45: net 2.771, cost 6.013", () => {
    const r = calculeazaDinParametri(q({ suma: "5000", tichet: "45", tichete: "20" }), AZI);
    expect([r.rezultat?.net, r.rezultat?.costTotal]).toEqual([2771, 6013]);
  });
});
```

`formular.test.tsx`. Bloc vechi:
```tsx
  return render(<Formular p={p} eroare={p.eroare} />).container;
```
Bloc nou:
```tsx
  return render(<Formular p={p} />).container;
```
Înainte de ultimul `});`:
```tsx
  it("tichetele: valoarea scrisă rămâne în câmp, numărul în listă, iar <details> se deschide", () => {
    const c = randeaza({ tichet: "40,18", tichete: "21" });
    expect(c.querySelector<HTMLInputElement>('input[name="tichet"]')?.value).toBe("40,18");
    expect(c.querySelector<HTMLSelectElement>('select[name="tichete"]')?.value).toBe("21");
    expect(c.querySelectorAll('select[name="tichete"] option')).toHaveLength(24);
    expect(c.querySelector("details")?.hasAttribute("open")).toBe(true);
  });

  it("eroarea de pe tichet marchează câmpul tichetului, nu suma", () => {
    const c = randeaza({ suma: "5000", tichet: "abc", tichete: "20" });
    expect(c.querySelector('input[name="tichet"]')?.getAttribute("aria-invalid")).toBe("true");
    expect(c.querySelector('input[name="suma"]')?.getAttribute("aria-invalid")).toBe("false");
  });
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/content/legal/salarizare-publica.test.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu/"`
  Așteptat: `TICHET_MASA_VALOARE_MAXIMA` nu e exportată. `calculeazaDinBrut(5000, { …, tichete })` dă `tichete: undefined` și `net: 2981`. `textTichet` și `avertismente` lipsesc. Formularul nu are `input[name="tichet"]`.

- [ ] **Pasul 3: Implementarea minimă.**

`salarizare-publica.ts`, după `export const DEDUCERE_COPIL_SCOALA = 100;`:
```ts

/**
 * Legea 165/2018 art. 14, forma consolidată din 01.12.2025 (modificat de Legea
 * 201/2025): „Valoarea nominală a unui tichet de masă nu poate depăși suma de
 * 45 lei.” Art. II din Legea 201/2025 o ține pe ianuarie–septembrie 2026; din
 * octombrie 2026, art. 32 permite indexarea semestrială prin ordin comun
 * (⚠ NOTES.md §3). Peste ea, calculatorul avertizează, nu refuză.
 *
 * Regimul fiscal, Codul fiscal (forma din 08.08.2026): venit salarial (art. 76
 * alin. (3) lit. h)), fără CAS (art. 142 lit. r)), cu CASS (art. 157 alin. (1)
 * lit. ț)), fără CAM (art. 220^4 alin. (2)), în afara plafonului OUG 89/2025
 * (art. III alin. (1) lit. b)).
 */
export const TICHET_MASA_VALOARE_MAXIMA = 45;
```
În `VERIFICARE.surse`, după intrarea „OUG 59/2005 — rotunjirea la leu”:
```ts
    {
      eticheta: "Legea 165/2018, art. 14 — valoarea maximă a tichetului de masă",
      href: "https://legislatie.just.ro/Public/DetaliiDocument/202623",
    },
```

`src/lib/unelte/salariu.ts`. Bloc vechi:
```ts
  /** Copii sub 18 ani înscriși la școală: 100 de lei fiecare (art. 77 alin. (10) lit. b)). */
  copiiScoala: number;
}>;
```
Bloc nou:
```ts
  /** Copii sub 18 ani înscriși la școală: 100 de lei fiecare (art. 77 alin. (10) lit. b)). */
  copiiScoala: number;
  /** Tichetele de masă din lună: valoarea unuia și câte (cel mult unul pe zi lucrată). */
  tichete: Readonly<{ valoare: number; numar: number }>;
}>;
```
Bloc vechi:
```ts
  sub26: false,
  copiiScoala: 0,
};
```
Bloc nou:
```ts
  sub26: false,
  copiiScoala: 0,
  tichete: { valoare: 0, numar: 0 },
};
```
Bloc vechi:
```ts
  net: number;
  cam: number;
  costTotal: number;
}>;
```
Bloc nou:
```ts
  /** Salariul net, în cont — fără tichete. */
  net: number;
  /** Valoarea tichetelor de masă din lună, pe card. */
  tichete: number;
  cam: number;
  /** Brut + CAM + tichete. */
  costTotal: number;
}>;
```
Bloc vechi:
```ts
function intrare(brutImpozabil: number, o: OptiuniSalariu, deducere: number): PayrollCalcInput {
  const setari = PERIOADE_2026[o.perioada].setari;
  return {
```
Bloc nou:
```ts
function intrare(
  brutImpozabil: number,
  o: OptiuniSalariu,
  deducere: number,
  tichete: number,
): PayrollCalcInput {
  const setari = PERIOADE_2026[o.perioada].setari;
  return {
```
Bloc vechi (în `intrare`):
```ts
    settings: {
      ...setari,
      deducerePersonala:
```
Bloc nou:
```ts
    settings: {
      ...setari,
      // Tichetele pe calea motorului, deci cu regimul din produs: impozabile, cu
      // CASS, fără CAS și fără CAM. Luna e o singură „zi” (vezi `attendance`), iar
      // motorul înmulțește valoarea pe tichet cu zilele lucrate: aici, cu 1.
      valoareTichetMasa: tichete,
      ticheteImpozabile: true,
      ticheteSupuseCass: true,
      deducerePersonala:
```
Funcție nouă, înaintea lui `type Deduceri`:
```ts
/** Valoarea tichetelor din lună, la ban: 21 × 40,18 = 843,78. Zero dacă lipsește valoarea sau numărul. */
function valoareTichete(o: OptiuniSalariu): number {
  const valoare = margineste(o.tichete.valoare, 0, 1000);
  const numar = Math.round(margineste(o.tichete.numar, 0, 31));
  return valoare > 0 && numar > 0 ? Math.round(valoare * numar * 100) / 100 : 0;
}
```
În `celMaiMicBrut` (din C4), bloc vechi:
```ts
  const prag = Math.max(
    BRUT_MIN,
    Math.floor(PERIOADE_2026[optiuni.perioada].salariuMinim + PLAFON_DEDUCERE_PESTE_MINIM),
  );
```
Bloc nou:
```ts
  // Tichetele intră în venitul grilei (vezi `calculeazaDinBrut`), deci pragul,
  // socotit în brut, coboară cu valoarea lor: cu 20 × 45 lei, de la 6.325 la 5.425.
  const prag = Math.max(
    BRUT_MIN,
    Math.floor(
      PERIOADE_2026[optiuni.perioada].salariuMinim +
        PLAFON_DEDUCERE_PESTE_MINIM -
        valoareTichete(optiuni),
    ),
  );
```
În `calculeazaDinBrut`, bloc vechi (din C5):
```ts
  const scutit = sumaNeimpozabila(b, o);
  const d = deduceri(b, o);
  // Motorul calculează impozitul și contribuțiile pe brutul FĂRĂ suma scutită;
  // omul primește însă tot brutul, deci suma scutită se adaugă înapoi la net.
  const r = calculatePayrollEntry(intrare(b - scutit, o, d.deBaza + d.sub26 + d.copii));
```
Bloc nou:
```ts
  const scutit = sumaNeimpozabila(b, o);
  const tichete = valoareTichete(o);
  // ⚠ Tichetele intră în venitul brut lunar al grilei (art. 76 alin. (3) lit. h));
  // motorul produsului nu le pune acolo. Întrebare deschisă în NOTES.md §3.
  const d = deduceri(b + tichete, o);
  // Motorul calculează impozitul și contribuțiile pe brutul FĂRĂ suma scutită;
  // omul primește însă tot brutul, deci suma scutită se adaugă înapoi la net.
  const r = calculatePayrollEntry(intrare(b - scutit, o, d.deBaza + d.sub26 + d.copii, tichete));
```
Bloc vechi:
```ts
  const venitInainteDeDeducere = Math.max(0, b - scutit - r.cas - r.cass);
```
Bloc nou:
```ts
  const venitInainteDeDeducere = Math.max(0, b - scutit + tichete - r.cas - r.cass);
```
Bloc vechi (finalul obiectului întors):
```ts
    net: r.net + scutit,
    cam: r.camAngajator,
    costTotal: b + r.camAngajator,
  };
```
Bloc nou:
```ts
    net: r.net + scutit,
    tichete,
    cam: r.camAngajator,
    costTotal: b + r.camAngajator + tichete,
  };
```

`parametri.ts`. Importul din `@/content/legal/salarizare-publica` primește `TICHET_MASA_VALOARE_MAXIMA`:
```ts
import {
  estePerioada,
  PERIOADE_2026,
  perioadaPentruZi,
  TICHET_MASA_VALOARE_MAXIMA,
  valoriExpirate,
} from "@/content/legal/salarizare-publica";
```
După funcția `citesteSuma`:
```ts
/** O lună are cel mult 23 de zile lucrătoare; tichetele sunt cel mult câte zile lucrate (Legea 165/2018 art. 12 alin. (2)). */
export const TICHETE_MAXIM_PE_LUNA = 23;

/** Valoarea unui tichet, cu bani („40,18”); câmpul gol înseamnă fără tichete. */
function citesteTichet(text: string): CitireSuma {
  const curat = text.replace(SPATII, "").replace(MONEDA, "");
  const n = curat === "" ? null : parseAmount(curat);
  if (n === null) {
    return { ok: false, eroare: `Nu am înțeles valoarea tichetului „${text.trim()}”.` };
  }
  if (n < 0 || n > 100) {
    return { ok: false, eroare: "Valoarea unui tichet de masă trebuie să fie între 0 și 100 de lei." };
  }
  return { ok: true, valoare: Math.round(n * 100) / 100, rotunjita: false };
}
```
Bloc vechi (în `ParametriCalculator`):
```ts
  suma: number | null;
  eroare: string | null;
```
Bloc nou:
```ts
  suma: number | null;
  /** Prima eroare de citire: a sumei, altfel a tichetului. */
  eroare: string | null;
  /** Câmpul pe care îl privește `eroare`, ca formularul să-l marcheze pe el. */
  campCuEroare: "suma" | "tichet" | null;
```
Bloc vechi:
```ts
  din: "brut" | "net";
  optiuni: OptiuniSalariu;
}>;
```
Bloc nou:
```ts
  din: "brut" | "net";
  /** Valoarea tichetului, cum a scris-o omul (câmpul gol: fără tichete). */
  textTichet: string;
  optiuni: OptiuniSalariu;
}>;
```
Bloc vechi:
```ts
function optiuniDin(q: URLSearchParams, azi: string): OptiuniSalariu {
```
Bloc nou:
```ts
function optiuniDin(q: URLSearchParams, azi: string, valoareTichet: number): OptiuniSalariu {
```
Bloc vechi:
```ts
    copiiScoala: intreg(q.get("copii"), 0, 0, 6),
  };
```
Bloc nou:
```ts
    copiiScoala: intreg(q.get("copii"), 0, 0, 6),
    tichete: {
      valoare: valoareTichet,
      numar: intreg(q.get("tichete"), 0, 0, TICHETE_MAXIM_PE_LUNA),
    },
  };
```
Funcția `parametriCalculator`, înlocuită integral:
```ts
export function parametriCalculator(q: URLSearchParams, azi: string): ParametriCalculator {
  const textTichet = (q.get("tichet") ?? "").slice(0, 12);
  const tichet: CitireSuma =
    textTichet.trim() === "" ? { ok: true, valoare: 0, rotunjita: false } : citesteTichet(textTichet);
  const optiuni = optiuniDin(q, azi, tichet.ok ? tichet.valoare : 0);
  const minim = PERIOADE_2026[optiuni.perioada].salariuMinim;
  const text = (q.get("suma") ?? "").slice(0, 20);
  const gol = text.trim() === "";
  const citire: CitireSuma = gol
    ? { ok: true, valoare: minim, rotunjita: false }
    : citesteSuma(text);
  const eroareSuma = citire.ok ? null : citire.eroare;
  const eroareTichet = tichet.ok ? null : tichet.eroare;
  return {
    text: gol ? String(minim) : text,
    suma: citire.ok ? citire.valoare : null,
    eroare: eroareSuma ?? eroareTichet,
    campCuEroare: eroareSuma !== null ? "suma" : eroareTichet !== null ? "tichet" : null,
    rotunjita: citire.ok && citire.rotunjita,
    din: q.get("din") === "net" ? "net" : "brut",
    textTichet,
    optiuni,
  };
}
```
Bloc vechi (în `CalculCalculator`):
```ts
  /** Netul cerut era sub cel de la brutul minim legal; brutul afișat e minimul. */
  ridicatLaMinim: boolean;
```
Bloc nou:
```ts
  /** Netul cerut era sub cel de la brutul minim legal; brutul afișat e minimul. */
  ridicatLaMinim: boolean;
  /** Ce trebuie spus lângă un rezultat valid (un tichet peste maximul legal). */
  avertismente: readonly string[];
```
În `calculeazaDinParametri`, bloc vechi:
```ts
  const expirat = valoriExpirate(azi);
  const faraRezultat = (eroare: string | null): CalculCalculator => ({
    parametri: p,
    rezultat: null,
    eroare,
    minimLegal,
    subMinim: false,
    ridicatLaMinim: false,
    expirat,
  });
  if (p.suma === null) return faraRezultat(p.eroare);
  if (p.din === "brut") {
    const rezultat = calculeazaDinBrut(p.suma, p.optiuni);
    return {
      parametri: p,
      rezultat,
      eroare: null,
      minimLegal,
      subMinim: rezultat.brut < minimLegal,
      ridicatLaMinim: false,
      expirat,
    };
  }
```
Bloc nou:
```ts
  const expirat = valoriExpirate(azi);
  const avertismente =
    p.optiuni.tichete.valoare > TICHET_MASA_VALOARE_MAXIMA
      ? [
          `Legea 165/2018 (art. 14) limitează tichetul de masă la ${String(TICHET_MASA_VALOARE_MAXIMA)} de lei. Peste, diferența nu mai e tichet de masă, ci venit cu toate contribuțiile; calculul de mai sus o tratează totuși ca tichet.`,
        ]
      : [];
  const faraRezultat = (eroare: string | null): CalculCalculator => ({
    parametri: p,
    rezultat: null,
    eroare,
    minimLegal,
    subMinim: false,
    ridicatLaMinim: false,
    avertismente: [],
    expirat,
  });
  if (p.eroare !== null || p.suma === null) return faraRezultat(p.eroare);
  if (p.din === "brut") {
    const rezultat = calculeazaDinBrut(p.suma, p.optiuni);
    return {
      parametri: p,
      rezultat,
      eroare: null,
      minimLegal,
      subMinim: rezultat.brut < minimLegal,
      ridicatLaMinim: false,
      avertismente,
      expirat,
    };
  }
```
Bloc vechi (finalul funcției):
```ts
    subMinim: r.rezultat.brut < minimLegal,
    ridicatLaMinim: r.ridicatLaMinim,
    expirat,
  };
}
```
Bloc nou:
```ts
    subMinim: r.rezultat.brut < minimLegal,
    ridicatLaMinim: r.ridicatLaMinim,
    avertismente,
    expirat,
  };
}
```

`formular.tsx`. Importul de tip devine:
```tsx
import { TICHETE_MAXIM_PE_LUNA, type ParametriCalculator } from "./parametri";
```
Semnătura, bloc vechi:
```tsx
export function Formular({
  p,
  eroare,
}: {
  readonly p: ParametriCalculator;
  readonly eroare: string | null;
}) {
```
Bloc nou:
```tsx
export function Formular({ p }: { readonly p: ParametriCalculator }) {
```
Câmpul sumei, bloc vechi:
```tsx
          aria-invalid={eroare !== null}
          aria-describedby={eroare !== null ? "eroare-suma" : undefined}
```
Bloc nou:
```tsx
          aria-invalid={p.campCuEroare === "suma"}
          aria-describedby={p.campCuEroare === "suma" ? "eroare-suma" : undefined}
```
`areOptiuniAlese`, bloc vechi:
```tsx
  return p.optiuni.sub26 || p.optiuni.copiiScoala > 0;
```
Bloc nou:
```tsx
  return (
    p.optiuni.sub26 ||
    p.optiuni.copiiScoala > 0 ||
    p.optiuni.tichete.numar > 0 ||
    p.textTichet.trim() !== ""
  );
```
În `<details>`, după `<label>`-ul cu `select name="copii"` (înainte de `</div>`-ul grilei):
```tsx
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Valoarea unui tichet de masă (lei)</span>
            <input
              type="text"
              inputMode="decimal"
              name="tichet"
              maxLength={12}
              placeholder="ex. 45"
              defaultValue={p.textTichet}
              aria-invalid={p.campCuEroare === "tichet"}
              aria-describedby={p.campCuEroare === "tichet" ? "eroare-suma" : undefined}
              className={CLASA_CAMP}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Tichete în lună (cel mult câte zile lucrate)</span>
            <select
              name="tichete"
              defaultValue={String(p.optiuni.tichete.numar)}
              className={CLASA_CAMP}
            >
              {Array.from({ length: TICHETE_MAXIM_PE_LUNA + 1 }, (_, n) => (
                <option key={n} value={String(n)}>
                  {n === 0 ? "niciun tichet" : String(n)}
                </option>
              ))}
            </select>
          </label>
```
(`TICHETE_MAXIM_PE_LUNA` e o valoare exportată dintr-un fișier fără `"use server"`, importată de o componentă server. Nu e granița de la capcana 39.)

`randuri.ts`. Bloc vechi:
```ts
      rand("CASS — sănătate, 10%", r.cass, "minus"),
```
Bloc nou:
```ts
      ...(r.tichete > 0 ? [rand("Din tichete de masă, în baza CASS și a impozitului", r.tichete, "info")] : []),
      rand(r.tichete > 0 ? "CASS — sănătate, 10%, cu tichetele" : "CASS — sănătate, 10%", r.cass, "minus"),
```
Bloc vechi:
```ts
      rand("Salariu net", r.net, "total"),
    ],
    angajator: [
      rand("Salariu brut", r.brut, "plus"),
      rand("CAM — contribuția asiguratorie pentru muncă, 2,25%", r.cam, "plus"),
```
Bloc nou:
```ts
      rand("Salariu net", r.net, "total"),
      ...(r.tichete > 0
        ? [
            rand("Tichete de masă, pe card", r.tichete, "plus"),
            rand("Net și tichete, împreună", r.net + r.tichete, "total"),
          ]
        : []),
    ],
    angajator: [
      rand("Salariu brut", r.brut, "plus"),
      rand("CAM — contribuția asiguratorie pentru muncă, 2,25%", r.cam, "plus"),
      ...(r.tichete > 0 ? [rand("Tichete de masă", r.tichete, "plus")] : []),
```

`page.tsx`. Bloc vechi:
```tsx
        <Formular p={parametri} eroare={eroare} />
```
Bloc nou:
```tsx
        <Formular p={parametri} />
```
Bloc vechi:
```tsx
  const { parametri, rezultat, eroare, minimLegal, subMinim, ridicatLaMinim, expirat } =
    calculeazaDinParametri(q, todayInBucharest());
```
Bloc nou:
```tsx
  const {
    parametri,
    rezultat,
    eroare,
    minimLegal,
    subMinim,
    ridicatLaMinim,
    avertismente,
    expirat,
  } = calculeazaDinParametri(q, todayInBucharest());
```
Bloc vechi:
```tsx
            <div className="mt-6">
              <Desfasurator r={rezultat} />
            </div>
```
Bloc nou:
```tsx
            {avertismente.map((a) => (
              <p
                key={a}
                className="border-mk-cerneala mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]"
              >
                {a}
              </p>
            ))}
            <div className="mt-6">
              <Desfasurator r={rezultat} />
            </div>
```
În lista „Ce nu calculează”, bloc vechi:
```tsx
            "Scutirile pentru persoanele cu handicap și tichetele de masă. Facilitățile pe sectoare de activitate nu se mai aplică veniturilor din 2025 (OUG 156/2024).",
```
Bloc nou:
```tsx
            "Scutirile pentru persoanele cu handicap și pentru cercetare-dezvoltare. Facilitățile pe sectoare de activitate nu se mai aplică veniturilor din 2025 (OUG 156/2024).",
```
(Tichetele se calculează de acum, iar handicapul iese din listă în C8.)

`NOTES.md`. Bloc vechi:
```markdown
⚠️ Valoarea maximă legală (se actualizează prin ordin) · regimul fiscal (ce
contribuții se aplică — schimbat de mai multe ori în ultimii ani) · plafonul
lunar cumulat al veniturilor neimpozabile și **ordinea de includere** în el.
```
Bloc nou:
```markdown
⚠️ Valoarea maximă legală (se actualizează prin ordin) · regimul fiscal (ce
contribuții se aplică — schimbat de mai multe ori în ultimii ani) · plafonul
lunar cumulat al veniturilor neimpozabile și **ordinea de includere** în el.

Din calculatorul public (8 oct 2026):

- ⚠️ **Tichetele în „venitul brut lunar” al grilei art. 77 alin. (4).**
  Calculatorul public le include: art. 76 alin. (3) lit. h) le face venit
  salarial, iar OUG 89/2025 art. III alin. (1) lit. b) le scoate explicit doar
  din plafonul facilității, semn că implicit intră. Motorul produsului
  (`cautaPragDeducere(…, brut)` în `src/domain/payroll/calc.ts`) NU le include.
  Brut 5.000 + 20 × 45 lei: grila pe 5.900 dă 173 lei, pe 5.000 ar da 562 — 39 de
  lei de impozit diferență. După răspuns, cele două se aliniază.
- ⚠️ **Valoarea maximă după septembrie 2026.** Legea 165/2018 art. 14 spune 45 de
  lei; art. II din Legea 201/2025 o ține până în septembrie 2026, apoi art. 32
  permite indexarea prin ordin comun. N-am găsit ordinul pe legislatie.just.ro
  pe 8 oct 2026. Calculatorul avertizează peste 45, nu refuză
  (`TICHET_MASA_VALOARE_MAXIMA`).
```

Data din `harta.ts` se ridică.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/content/legal/ src/lib/unelte/ "src/app/(marketing)/unelte/calculator-salariu/" src/content/landing/continut.test.ts`, apoi lanțul complet (cu `pnpm check:server`: `parametri.ts` nu e `"use server"`) și `prettier`.

- [ ] **Pasul 5: Verificarea headless.**
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=5000&tichet=45&tichete=20|Net 2.771 lei din brut 5.000 lei" \
  "suma=5000&tichet=45&tichete=20|Cost total pentru firmă 6.013 lei" \
  "suma=5000&tichet=50&tichete=20|limitează tichetul de masă la 45 de lei" \
  "suma=5000&tichet=abc&tichete=20|Nu am înțeles valoarea tichetului „abc”"
```
Așteptat: 8 × `OK`. Pe `mobil-0.png`, rândul „Net și tichete, împreună 3.671 lei” încape pe un rând.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- src/content/legal/salarizare-publica.ts src/content/legal/salarizare-publica.test.ts src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" NOTES.md src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/content/legal src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" NOTES.md src/content/landing/harta.ts
git commit --only -m "feat(unelte): tichetele de masă în calculatorul de salariu" -m "Impozit și CASS pe tichete, fără CAS și CAM, în afara plafonului OUG 89/2025; 45 de lei maxim (Legea 165/2018 art. 14), cu avertisment peste. Includerea tichetelor în grila deducerii e ⚠ în NOTES.md §3." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/content/legal/salarizare-publica.ts src/content/legal/salarizare-publica.test.ts src/lib/unelte/salariu.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu" NOTES.md src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task C7: Timpul parțial, cu contribuția minimă plătită de firmă

**Fișiere:**
- Modify: `src/content/legal/salarizare-publica.ts` (`ValoriPerioada`, `PERIOADE_2026`), `salarizare-publica.test.ts`
- Modify: `src/lib/unelte/salariu.ts`, `salariu.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/parametri.ts`, `parametri.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/formular.tsx`, `formular.test.tsx`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/randuri.ts`, `randuri.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx` (nota „sub minim”, nota de timp parțial, „Limitele”)
- Modify: `NOTES.md` §3
- Modify: `src/content/landing/harta.ts` (data)

**Verificare pe sursă** (citit pe 8 oct 2026):
- Codul fiscal (doc. 171282, 08.08.2026), art. 146 alin. (5^6): CAS-ul „nu poate fi mai mic decât … cota … asupra salariului de bază minim brut pe țară în vigoare în luna …, corespunzător numărului zilelor lucrătoare din lună în care contractul a fost activ”. Alin. (5^7) lit. a)–e) dă excepțiile: elevi sau studenți până la 26 de ani; ucenici sub 18 ani; persoane cu dizabilități sau alte categorii cu drept legal la mai puțin de 8 ore pe zi; pensionari pentru limită de vârstă; mai multe contracte cu baza cumulată de cel puțin minimul. Alin. (5^9): „diferența se suportă de către angajator/plătitorul de venit în numele angajatului”. Art. 168 alin. (6^1): alin. (5^6)–(5^9) „se aplică în mod corespunzător” la CASS.
- OUG 89/2025 art. III alin. (5): prin derogare de la art. 146 alin. (5^6) și art. 168 alin. (6^1), salariul minim „se diminuează … a) … 1 ianuarie-30 iunie 2026, cu suma de 300 lei lunar; … b) … 1 iulie-31 decembrie 2026, cu suma de 200 lei lunar”. Baza minimă e deci 3.750, respectiv 4.125 de lei.
- Alin. (1) din același articol cere pentru suma scutită „încadrați cu normă întreagă”, deci la timp parțial nu se aplică.

**Interfețe:**
- Produce:
  ```ts
  // salarizare-publica.ts — ValoriPerioada.reducereBazaMinima: number (300 / 200)
  // salariu.ts
  //   OptiuniSalariu primește: oreZi: number (1–8; 8 = normă întreagă); contributieMinima: boolean
  //   RezultatSalariu primește: casSuportatAngajator: number; cassSuportatAngajator: number
  export function brutMinimLegal(o: OptiuniSalariu): number; // devine proporțional: ceil(minim × ore / 8)
  export function bazaMinimaContributii(o: OptiuniSalariu): number;
  ```

- [ ] **Pasul 1: Scrie testele care pică.**

`salarizare-publica.test.ts`, în `describe("cele două perioade ale lui 2026")`, înainte de `it("ziua alege perioada…`:
```ts
  it("baza minimă de contribuții la timp parțial: minimul minus 300, respectiv 200 de lei (OUG 89/2025 art. III alin. (5))", () => {
    expect(PERIOADE_2026["2026-1"].reducereBazaMinima).toBe(300);
    expect(PERIOADE_2026["2026-2"].reducereBazaMinima).toBe(200);
  });
```

`salariu.test.ts`: importul primește `brutMinimLegal`:
```ts
import {
  brutMinimLegal,
  calculeazaDinBrut,
  calculeazaDinNet,
  dinBrut,
  dinNet,
  OPTIUNI_IMPLICITE,
} from "./salariu";
```
La final:
```ts
describe("timpul parțial și contribuția minimă (Codul fiscal art. 146 alin. (5^6)–(5^9))", () => {
  const P4 = { ...OPTIUNI_IMPLICITE, oreZi: 4 };

  it("4 ore, brut 2.163: angajatul plătește pe brut, firma diferența până la 4.125 — cost 2.899", () => {
    // Fără sumă scutită (cere normă întreagă). CAS 25% × 2.163 = 540,75 → 541; CASS 216,30 → 216.
    // Deducere 20% × 4.325 = 865. Impozit (2.163 − 540,75 − 216,3 − 865) × 10% = 54,095 → 54.
    // Net 2.163 − 541 − 216 − 54 = 1.352.
    // Baza minimă 4.325 − 200 = 4.125: CAS minim 1.031,25 → 1.031, CASS minim 412,50 → 413.
    // Firma: 1.031 − 541 = 490 și 413 − 216 = 197 (alin. (5^9)). CAM 2,25% × 2.163 = 48,67 → 49.
    // Cost 2.163 + 49 + 490 + 197 = 2.899.
    expect(calculeazaDinBrut(2163, P4)).toMatchObject({
      sumaNeimpozabila: 0,
      cas: 541,
      cass: 216,
      impozit: 54,
      net: 1352,
      casSuportatAngajator: 490,
      cassSuportatAngajator: 197,
      cam: 49,
      costTotal: 2899,
    });
  });

  it("cu o excepție din alin. (5^7), firma nu mai plătește diferența: cost 2.212", () => {
    expect(calculeazaDinBrut(2163, { ...P4, contributieMinima: false })).toMatchObject({
      net: 1352,
      casSuportatAngajator: 0,
      cassSuportatAngajator: 0,
      costTotal: 2212,
    });
  });

  it("în ianuarie–iunie, baza minimă e 3.750: la 2.025 brut, 4 ore, firma plătește 432 + 172", () => {
    // CAS 506,25 → 506; CASS 202,50 → 203. Minim: 25% × 3.750 = 937,50 → 938; 10% × 3.750 = 375.
    // Diferențe 938 − 506 = 432 și 375 − 203 = 172. Impozit (2.025 − 506,25 − 202,5 − 810) × 10%
    // = 50,625 → 51; net 2.025 − 506 − 203 − 51 = 1.265. CAM 45,56 → 46; cost 2.025 + 46 + 432 + 172 = 2.675.
    expect(calculeazaDinBrut(2025, { ...P4, perioada: "2026-1" })).toMatchObject({
      casSuportatAngajator: 432,
      cassSuportatAngajator: 172,
      net: 1265,
      costTotal: 2675,
    });
  });

  it("la timp parțial, 4.325 nu primește suma scutită: net 2.616", () => {
    // CAS 1.081,25 → 1.081; CASS 432,50 → 433; impozit (4.325 − 1.081,25 − 432,5 − 865) × 10% = 194,625 → 195;
    // net 4.325 − 1.081 − 433 − 195 = 2.616 (la normă întreagă: 2.699).
    expect(calculeazaDinBrut(4325, P4)).toMatchObject({
      sumaNeimpozabila: 0,
      net: 2616,
      casSuportatAngajator: 0,
    });
  });

  it("brutul minim legal e proporțional cu norma, rotunjit în sus la leu", () => {
    expect(brutMinimLegal(P4)).toBe(2163); // 4.325 × 4 / 8 = 2.162,50
    expect(brutMinimLegal({ ...OPTIUNI_IMPLICITE, oreZi: 6 })).toBe(3244); // 3.243,75
    expect(brutMinimLegal({ ...P4, perioada: "2026-1" })).toBe(2025);
    expect(brutMinimLegal(OPTIUNI_IMPLICITE)).toBe(4325);
  });

  it("net → brut la 4 ore nu coboară sub 2.163", () => {
    expect(calculeazaDinNet(1000, P4)).toMatchObject({
      ridicatLaMinim: true,
      rezultat: { brut: 2163, net: 1352 },
    });
    expect(calculeazaDinNet(1353, P4)?.rezultat.brut).toBe(2164);
  });

  it("la normă întreagă, peste minim, firma nu plătește nicio diferență", () => {
    for (const b of [4325, 4326, 5000]) {
      expect(calculeazaDinBrut(b, OPTIUNI_IMPLICITE).casSuportatAngajator, String(b)).toBe(0);
      expect(calculeazaDinBrut(b, OPTIUNI_IMPLICITE).cassSuportatAngajator, String(b)).toBe(0);
    }
  });

  it("4 ore, brut 2.163 și 20 × 45 lei tichete: firma plătește 490 la CAS, dar doar 107 la CASS", () => {
    // Review Focus 4. CAS 541 (fără tichete); CASS (2.163 + 900) × 10% = 306,30 → 306. Deducerea pe 3.063: 865.
    // Impozit (2.163 − 540,75 − 306,3 − 865 + 900) × 10% = 135,095 → 135; net 2.163 − 541 − 306 − 135 = 1.181.
    // Firma: 1.031 − 541 = 490 și 413 − 306 = 107. Cost 2.163 + 49 + 900 + 490 + 107 = 3.709.
    expect(
      calculeazaDinBrut(2163, { ...OPTIUNI_IMPLICITE, oreZi: 4, tichete: { valoare: 45, numar: 20 } }),
    ).toMatchObject({ net: 1181, casSuportatAngajator: 490, cassSuportatAngajator: 107, costTotal: 3709 });
  });
});
```

`randuri.test.ts`, înainte de ultimul `});`:
```ts
  it("la timp parțial, diferențele plătite de firmă apar în cost și desfășurătorul se închide", () => {
    const r = calculeazaDinBrut(2163, { ...OPTIUNI_IMPLICITE, oreZi: 4 });
    const { angajator } = randuriDesfasurator(r);
    expect(suma(angajator, "plus")).toBe(r.costTotal);
    expect(angajator.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "CAS până la baza minimă, plătit de firmă",
      490,
    ]);
    expect(angajator.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "CASS până la baza minimă, plătit de firmă",
      197,
    ]);
  });
```

`parametri.test.ts`. În obiectul așteptat de testul „implicit…”, `optiuni` primește la final:
```ts
        tichete: { valoare: 0, numar: 0 },
        oreZi: 8,
        contributieMinima: true,
```
(înlocuiește linia `tichete: { valoare: 0, numar: 0 },` cu cele trei). La final:
```ts
describe("timpul parțial, din adresă", () => {
  it("ore=4 și minim=nu ajung în opțiuni; orele sunt mărginite la 1–8", () => {
    const o = parametriCalculator(q({ ore: "4", minim: "nu" }), AZI).optiuni;
    expect([o.oreZi, o.contributieMinima]).toEqual([4, false]);
    expect(parametriCalculator(q({ ore: "12" }), AZI).optiuni.oreZi).toBe(8);
    expect(parametriCalculator(q({ ore: "0" }), AZI).optiuni.oreZi).toBe(1);
  });

  it("2.000 brut la 4 ore e sub minimul de 2.163; 2.163 nu e", () => {
    const sub = calculeazaDinParametri(q({ suma: "2000", ore: "4" }), AZI);
    expect([sub.subMinim, sub.minimLegal]).toEqual([true, 2163]);
    expect(calculeazaDinParametri(q({ suma: "2163", ore: "4" }), AZI).subMinim).toBe(false);
  });
});
```

`formular.test.tsx`, înainte de ultimul `});`:
```tsx
  it("norma și excepția de la contribuția minimă rămân alese și deschid <details>", () => {
    const c = randeaza({ ore: "4", minim: "nu" });
    expect(c.querySelector<HTMLSelectElement>('select[name="ore"]')?.value).toBe("4");
    expect(c.querySelector<HTMLInputElement>('input[name="minim"]')?.checked).toBe(true);
    expect(c.querySelector<HTMLInputElement>('input[name="minim"]')?.value).toBe("nu");
    expect(c.querySelector("details")?.hasAttribute("open")).toBe(true);
  });
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/content/legal/salarizare-publica.test.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu/"`
  Așteptat: `reducereBazaMinima` e `undefined`. `calculeazaDinBrut(2163, P4)` dă `casSuportatAngajator: undefined` și `costTotal: 2212`. `brutMinimLegal(P4)` dă 4325. `calculeazaDinBrut(4325, P4).net` dă 2699, fiindcă facilitatea se aplică greșit la timp parțial.

- [ ] **Pasul 3: Implementarea minimă.**

`salarizare-publica.ts`. În `ValoriPerioada`, bloc vechi:
```ts
  /** OUG 89/2025 art. III alin. (1): suma scutită și plafonul de venit brut (fără tichete). */
  facilitate: Readonly<{ suma: number; plafonVenitBrut: number }>;
```
Bloc nou:
```ts
  /** OUG 89/2025 art. III alin. (1): suma scutită și plafonul de venit brut (fără tichete). */
  facilitate: Readonly<{ suma: number; plafonVenitBrut: number }>;
  /**
   * OUG 89/2025 art. III alin. (5): cu cât scade salariul minim folosit ca bază
   * minimă de CAS și CASS (art. 146 alin. (5^6), art. 168 alin. (6^1)).
   */
  reducereBazaMinima: number;
```
În `"2026-1"`, după `facilitate: { suma: 300, plafonVenitBrut: 4300 },`:
```ts
    // OUG 89/2025 art. III alin. (5) lit. a): baza minimă 4.050 − 300 = 3.750 de lei.
    reducereBazaMinima: 300,
```
În `"2026-2"`, după închiderea obiectului `facilitate: { … },`:
```ts
    // Lit. b): 4.325 − 200 = 4.125 de lei.
    reducereBazaMinima: 200,
```

`src/lib/unelte/salariu.ts`. Bloc vechi:
```ts
  /** Tichetele de masă din lună: valoarea unuia și câte (cel mult unul pe zi lucrată). */
  tichete: Readonly<{ valoare: number; numar: number }>;
}>;
```
Bloc nou:
```ts
  /** Tichetele de masă din lună: valoarea unuia și câte (cel mult unul pe zi lucrată). */
  tichete: Readonly<{ valoare: number; numar: number }>;
  /** Ore pe zi din contract, 1–8; 8 înseamnă normă întreagă. */
  oreZi: number;
  /**
   * CAS și CASS cel puțin la baza minimă (art. 146 alin. (5^6), art. 168 alin. (6^1)).
   * `false` pentru excepțiile din art. 146 alin. (5^7).
   */
  contributieMinima: boolean;
}>;
```
Bloc vechi:
```ts
  tichete: { valoare: 0, numar: 0 },
};
```
Bloc nou:
```ts
  tichete: { valoare: 0, numar: 0 },
  oreZi: 8,
  contributieMinima: true,
};
```
Bloc vechi:
```ts
  /** Valoarea tichetelor de masă din lună, pe card. */
  tichete: number;
  cam: number;
  /** Brut + CAM + tichete. */
  costTotal: number;
}>;
```
Bloc nou:
```ts
  /** Valoarea tichetelor de masă din lună, pe card. */
  tichete: number;
  /** Diferența până la CAS-ul de la baza minimă, plătită de firmă „în numele angajatului” (art. 146 alin. (5^9)). */
  casSuportatAngajator: number;
  cassSuportatAngajator: number;
  cam: number;
  /** Brut + CAM + tichete + diferențele de mai sus. */
  costTotal: number;
}>;
```
Bloc vechi (`sumaNeimpozabila`, din C3):
```ts
  return o.functieDeBaza && brut === v.salariuMinim && brut <= v.facilitate.plafonVenitBrut
    ? v.facilitate.suma
    : 0;
}
```
Bloc nou:
```ts
  // Art. III alin. (1) cere „normă întreagă”: la timp parțial, nicio sumă scutită.
  return o.oreZi >= NORMA_INTREAGA &&
    o.functieDeBaza &&
    brut === v.salariuMinim &&
    brut <= v.facilitate.plafonVenitBrut
    ? v.facilitate.suma
    : 0;
}

/** Baza minimă de CAS și CASS: salariul minim al perioadei, diminuat (OUG 89/2025 art. III alin. (5)). */
export function bazaMinimaContributii(o: OptiuniSalariu): number {
  const v = PERIOADE_2026[o.perioada];
  return v.salariuMinim - v.reducereBazaMinima;
}

/**
 * Cât plătește firma peste ce i se reține angajatului, ca CAS și CASS să ajungă
 * la baza minimă (art. 146 alin. (5^6) și (5^9), art. 168 alin. (6^1)). Pentru
 * o lună întreagă cu contract activ, baza e minimul întreg, nu proporțional cu
 * orele. La normă întreagă, peste minim, diferența e zero.
 */
function suportatDeAngajator(cas: number, cass: number, o: OptiuniSalariu) {
  if (!o.contributieMinima) return { cas: 0, cass: 0 };
  const baza = bazaMinimaContributii(o);
  const setari = PERIOADE_2026[o.perioada].setari;
  return {
    cas: Math.max(0, Math.round(baza * setari.cotaCas) - cas),
    cass: Math.max(0, Math.round(baza * setari.cotaCass) - cass),
  };
}
```
Bloc vechi:
```ts
const BRUT_MIN = 1;
export const BRUT_MAX = 500_000;
```
Bloc nou:
```ts
const BRUT_MIN = 1;
export const BRUT_MAX = 500_000;
const NORMA_INTREAGA = 8;
```
În `calculeazaDinBrut`, bloc vechi:
```ts
    copiiScoala: Math.round(margineste(optiuni.copiiScoala, 0, 10)),
  };
```
Bloc nou:
```ts
    copiiScoala: Math.round(margineste(optiuni.copiiScoala, 0, 10)),
    oreZi: Math.round(margineste(optiuni.oreZi, 1, NORMA_INTREAGA)),
  };
```
Bloc vechi:
```ts
  const venitInainteDeDeducere = Math.max(0, b - scutit + tichete - r.cas - r.cass);
```
Bloc nou:
```ts
  const venitInainteDeDeducere = Math.max(0, b - scutit + tichete - r.cas - r.cass);
  // ⚠ Diferența plătită de firmă nu intră în baza de impozit a angajatului (NOTES.md §3).
  const suportat = suportatDeAngajator(r.cas, r.cass, o);
```
Bloc vechi:
```ts
    tichete,
    cam: r.camAngajator,
    costTotal: b + r.camAngajator + tichete,
  };
```
Bloc nou:
```ts
    tichete,
    casSuportatAngajator: suportat.cas,
    cassSuportatAngajator: suportat.cass,
    cam: r.camAngajator,
    costTotal: b + r.camAngajator + tichete + suportat.cas + suportat.cass,
  };
```
Bloc vechi (din C4):
```ts
/** Brutul minim legal pentru opțiunile alese: salariul minim al perioadei, la normă întreagă. */
export function brutMinimLegal(o: OptiuniSalariu): number {
  return PERIOADE_2026[o.perioada].salariuMinim;
}
```
Bloc nou:
```ts
/**
 * Brutul minim legal pentru opțiunile alese: salariul minim al perioadei,
 * proporțional cu orele din contract (minimul e stabilit „pentru un program
 * normal de lucru”, cu valoare orară — HG 146/2026 art. 1, HG 1506/2024 art. 1),
 * rotunjit în sus la leu: 4 ore → 2.162,50 → 2.163.
 */
export function brutMinimLegal(o: OptiuniSalariu): number {
  const ore = Math.round(margineste(o.oreZi, 1, NORMA_INTREAGA));
  return Math.ceil((PERIOADE_2026[o.perioada].salariuMinim * ore) / NORMA_INTREAGA);
}
```
(`margineste` și `NORMA_INTREAGA` sunt declarate mai sus în fișier, înaintea folosirii.)

`parametri.ts`, în `optiuniDin`, bloc vechi:
```ts
      numar: intreg(q.get("tichete"), 0, 0, TICHETE_MAXIM_PE_LUNA),
    },
  };
```
Bloc nou:
```ts
      numar: intreg(q.get("tichete"), 0, 0, TICHETE_MAXIM_PE_LUNA),
    },
    oreZi: intreg(q.get("ore"), 8, 1, 8),
    contributieMinima: q.get("minim") !== "nu",
  };
```

`randuri.ts`, bloc vechi:
```ts
      ...(r.tichete > 0 ? [rand("Tichete de masă", r.tichete, "plus")] : []),
```
Bloc nou:
```ts
      ...(r.casSuportatAngajator > 0
        ? [rand("CAS până la baza minimă, plătit de firmă", r.casSuportatAngajator, "plus")]
        : []),
      ...(r.cassSuportatAngajator > 0
        ? [rand("CASS până la baza minimă, plătit de firmă", r.cassSuportatAngajator, "plus")]
        : []),
      ...(r.tichete > 0 ? [rand("Tichete de masă", r.tichete, "plus")] : []),
```

`formular.tsx`. `areOptiuniAlese`, bloc vechi:
```tsx
    p.optiuni.tichete.numar > 0 ||
    p.textTichet.trim() !== ""
  );
```
Bloc nou:
```tsx
    p.optiuni.tichete.numar > 0 ||
    p.textTichet.trim() !== "" ||
    p.optiuni.oreZi < 8 ||
    !p.optiuni.contributieMinima
  );
```
În `<details>`, după `<label>`-ul cu `select name="tichete"`:
```tsx
          <label className="flex flex-col gap-1.5">
            <span className={CLASA_ETICHETA}>Program de lucru</span>
            <select name="ore" defaultValue={String(p.optiuni.oreZi)} className={CLASA_CAMP}>
              <option value="8">normă întreagă, 8 ore pe zi</option>
              {[7, 6, 5, 4, 3, 2, 1].map((ore) => (
                <option key={ore} value={String(ore)}>
                  {ore === 1 ? "timp parțial, 1 oră pe zi" : `timp parțial, ${String(ore)} ore pe zi`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-[0.9375rem] leading-[1.5] sm:col-span-2">
            <input
              type="checkbox"
              name="minim"
              value="nu"
              defaultChecked={!p.optiuni.contributieMinima}
              className="mt-1 size-4 shrink-0"
            />
            <span>
              Fără contribuția minimă: elev sau student până la 26 de ani, ucenic sub 18 ani,
              persoană cu dizabilități cu program redus prin lege, pensionar pentru limită de vârstă
              sau alt contract care ajunge la salariul minim (Codul fiscal art. 146 alin. (5^7))
            </span>
          </label>
```

`page.tsx`. Importurile, bloc vechi:
```tsx
import { dinBrut, dinNet } from "@/lib/unelte/salariu";
```
Bloc nou:
```tsx
import { bazaMinimaContributii, dinBrut, dinNet } from "@/lib/unelte/salariu";
```
Bloc vechi (`FACILITATE_SALARIU_MINIM,` … din importul `salarizare-publica`):
```tsx
import {
  FACILITATE_SALARIU_MINIM,
  SALARIU_MINIM_BRUT_2026_IULIE,
  VERIFICARE,
} from "@/content/legal/salarizare-publica";
```
Bloc nou:
```tsx
import {
  FACILITATE_SALARIU_MINIM,
  PERIOADE_2026,
  SALARIU_MINIM_BRUT_2026_IULIE,
  VERIFICARE,
} from "@/content/legal/salarizare-publica";
```
Paragraful `subMinim`, bloc vechi (forma din C3):
```tsx
            {subMinim && (
              <p className="border-mk-rigla mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]">
                Brutul e sub salariul minim de {lei(minimLegal)}. Cu normă întreagă, salariul nu
                poate fi mai mic; la timp parțial, CAS și CASS se datorează în general cel puțin la
                nivelul salariului minim, cu excepțiile din Codul fiscal (de exemplu elevii și
                studenții până la 26 de ani) — calculul de mai sus nu le aplică.
              </p>
            )}
```
Bloc nou:
```tsx
            {subMinim && (
              <p className="border-mk-rigla mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]">
                Brutul e sub minimul legal de {lei(minimLegal)} pentru{" "}
                {parametri.optiuni.oreZi === 8
                  ? "normă întreagă"
                  : `${String(parametri.optiuni.oreZi)} ${parametri.optiuni.oreZi === 1 ? "oră" : "ore"} pe zi`}
                : salariul minim orar e {PERIOADE_2026[parametri.optiuni.perioada].leiPeOra} lei (
                {PERIOADE_2026[parametri.optiuni.perioada].actSalariuMinim}).
              </p>
            )}
            {parametri.optiuni.oreZi < 8 && parametri.optiuni.contributieMinima && (
              <p className="border-mk-rigla mt-6 max-w-[68ch] border-l-2 pl-4 text-[0.9375rem] leading-[1.65]">
                La timp parțial, CAS și CASS se datorează cel puțin la baza minimă de{" "}
                {lei(bazaMinimaContributii(parametri.optiuni))} — salariul minim diminuat cu{" "}
                {PERIOADE_2026[parametri.optiuni.perioada].reducereBazaMinima} de lei (OUG 89/2025
                art. III alin. (5)). Diferența o plătește firma, nu angajatul (Codul fiscal art. 146
                alin. (5^9)), iar calculul de mai sus o include în cost. Excepțiile din alin. (5^7)
                se aleg în „Mai multe opțiuni”.
              </p>
            )}
```
În lista „Ce nu calculează”, bloc vechi:
```tsx
            "Timpul parțial, sporurile, orele suplimentare și concediile din lună.",
```
Bloc nou:
```tsx
            "Sporurile, orele suplimentare și concediile din lună.",
```
Nota de sub listă, bloc vechi:
```tsx
          Calculul e informativ, pentru un contract cu normă întreagă, fără sporuri și fără cazurile
          din lista de mai sus; suma neimpozabilă de la salariul minim (OUG 89/2025) e inclusă.
```
Bloc nou:
```tsx
          Calculul e informativ, pentru o lună întreagă lucrată, fără sporuri și fără cazurile din
          lista de mai sus; suma neimpozabilă de la salariul minim (OUG 89/2025) e inclusă.
```
(`continut.test.ts:1584` cere în continuare `/suma neimpozabilă de la salariul minim[^.]*e inclusă/`, `/informativ/` și `/contabil/`: toate rămân.)

`NOTES.md`. Bloc vechi (ultimul punct din lista adăugată în C5):
```markdown
  sumele datorate. Diferența e de 1 leu la ~3% din bruturi. Răspunsul mută și
  statele de plată din aplicație, nu doar calculatorul.
```
Bloc nou:
```markdown
  sumele datorate. Diferența e de 1 leu la ~3% din bruturi. Răspunsul mută și
  statele de plată din aplicație, nu doar calculatorul.
- ⚠️ **Timp parțial: diferența până la baza minimă și impozitul angajatului.**
  Calculatorul reține angajatului CAS și CASS pe brutul real, iar diferența până
  la baza minimă (4.125 lei în iulie–decembrie 2026) o pune în costul firmei
  (art. 146 alin. (5^9): „se suportă de către angajator … în numele
  angajatului”). Baza de impozit a angajatului scade doar contribuțiile reținute,
  iar diferența nu e tratată ca venit al lui. De confirmat ambele: 4 ore, brut
  2.163 → impozit 54, net 1.352, firma plătește 490 + 197.
```

Data din `harta.ts` se ridică.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/content/legal/ src/lib/unelte/ "src/app/(marketing)/unelte/calculator-salariu/" src/content/landing/continut.test.ts`, apoi lanțul complet și `prettier`.

- [ ] **Pasul 5: Verificarea headless.**
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=2163&ore=4|Net 1.352 lei din brut 2.163 lei" \
  "suma=2163&ore=4|Cost total pentru firmă 2.899 lei" \
  "suma=2163&ore=4|baza minimă de 4.125 lei" \
  "suma=2000&ore=4|sub minimul legal de 2.163 lei pentru 4 ore pe zi" \
  "suma=1000&din=net&ore=4|din brut 2.163 lei"
```
Așteptat: 10 × `OK`. Pe `mobil-1.png`, rândurile „CAS până la baza minimă, plătit de firmă” se rup pe eticheta din stânga, nu pe valoare.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- src/content/legal/salarizare-publica.ts src/content/legal/salarizare-publica.test.ts src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" NOTES.md src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/content/legal src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" NOTES.md src/content/landing/harta.ts
git commit --only -m "feat(unelte): timpul parțial în calculatorul de salariu, cu contribuția minimă plătită de firmă" -m "Baza minimă 4.125 / 3.750 lei (OUG 89/2025 art. III alin. (5)), diferența în costul firmei (art. 146 alin. (5^9)), excepțiile din alin. (5^7), brutul minim proporțional cu orele, fără sumă scutită la timp parțial." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/content/legal/salarizare-publica.ts src/content/legal/salarizare-publica.test.ts src/lib/unelte/salariu.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu" NOTES.md src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task C8: Scutirea de impozit pentru handicap grav sau accentuat

**Fișiere:**
- Modify: `src/lib/unelte/salariu.ts`, `salariu.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/parametri.ts`, `parametri.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/formular.tsx`, `formular.test.tsx`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/randuri.ts`, `randuri.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx` („Limitele”)
- Modify: `src/content/landing/harta.ts` (data)

**Verificare pe sursă** (Codul fiscal, doc. 171282, 08.08.2026, citit pe 8 oct 2026). `+ Articolul 60 Scutiri`: „Sunt scutiți de la plata impozitului pe venit … 1. persoanele fizice cu handicap grav sau accentuat, pentru veniturile realizate din: … b) salarii și asimilate salariilor, prevăzute la art. 76 alin. (1)-(3)”, deci inclusiv tichetele (alin. (3) lit. h)). În aceeași formă: „2. Abrogat. (la 01-01-2025 … OUG nr. 156 din 30 decembrie 2024)”, „4. Abrogat. (la 01-01-2023 …)”, „5. Abrogat. (la 01-01-2025 …)”. Pct. 3 (cercetare-dezvoltare) e în vigoare, dar cere proiect, buget și stat de plată separate, deci nu intră în calculator. Scutirea privește doar impozitul: CAS, CASS și CAM rămân.

**Interfețe:**
- Produce: `OptiuniSalariu.scutitImpozit: boolean`; `RezultatSalariu.impozitScutit: boolean`.

- [ ] **Pasul 1: Scrie testele care pică.**

`salariu.test.ts`, la final:
```ts
describe("scutirea de impozit pentru handicap grav sau accentuat (art. 60 pct. 1)", () => {
  const H = { ...OPTIUNI_IMPLICITE, scutitImpozit: true };

  it("brut 5.000: impozit 0, net 3.250; CAS, CASS și CAM rămân", () => {
    // 5.000 − 1.250 − 500 − 0 = 3.250. CAM 113, cost 5.113 — neschimbat.
    expect(calculeazaDinBrut(5000, H)).toMatchObject({
      impozit: 0,
      impozitScutit: true,
      cas: 1250,
      cass: 500,
      net: 3250,
      costTotal: 5113,
    });
  });

  it("se cumulează cu suma scutită de la salariul minim: 4.325 → net 2.881", () => {
    // Baza 4.125: 4.125 − 1.031 − 413 − 0 + 200 = 2.881.
    expect(calculeazaDinBrut(4325, H).net).toBe(2881);
  });

  it("scutește și tichetele (venit salarial, art. 76 alin. (3) lit. h)): 5.000 + 20 × 45 → net 3.160", () => {
    // 5.000 − 1.250 − 590 − 0 = 3.160.
    expect(calculeazaDinBrut(5000, { ...H, tichete: { valoare: 45, numar: 20 } }).net).toBe(3160);
  });

  it("fără bifă, nimic nu se schimbă", () => {
    expect(calculeazaDinBrut(5000, OPTIUNI_IMPLICITE)).toMatchObject({ impozit: 269, impozitScutit: false });
  });
});
```

`randuri.test.ts`, înainte de ultimul `});`:
```ts
  it("impozitul scutit spune temeiul", () => {
    const r = calculeazaDinBrut(5000, { ...OPTIUNI_IMPLICITE, scutitImpozit: true });
    expect(randuriDesfasurator(r).angajat.map((x) => [x.eticheta, x.valoare])).toContainEqual([
      "Impozit pe venit — scutit, Codul fiscal art. 60 pct. 1",
      0,
    ]);
  });
```

`parametri.test.ts`. În obiectul așteptat de „implicit…”, după `contributieMinima: true,` se adaugă `scutitImpozit: false,`. La final:
```ts
describe("scutirea pentru handicap, din adresă", () => {
  it("handicap=da scutește de impozit; orice altă valoare nu", () => {
    expect(parametriCalculator(q({ handicap: "da" }), AZI).optiuni.scutitImpozit).toBe(true);
    expect(parametriCalculator(q({ handicap: "1" }), AZI).optiuni.scutitImpozit).toBe(false);
    expect(calculeazaDinParametri(q({ suma: "5000", handicap: "da" }), AZI).rezultat?.net).toBe(3250);
  });
});
```

`formular.test.tsx`, înainte de ultimul `});`:
```tsx
  it("bifa de handicap rămâne bifată și deschide <details>", () => {
    const c = randeaza({ handicap: "da" });
    expect(c.querySelector<HTMLInputElement>('input[name="handicap"]')?.checked).toBe(true);
    expect(c.querySelector("details")?.hasAttribute("open")).toBe(true);
  });
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu/"`
  Așteptat: `impozit: 269` în loc de 0, `impozitScutit: undefined`, iar `input[name="handicap"]` lipsește.

- [ ] **Pasul 3: Implementarea minimă.**

`salariu.ts`. Bloc vechi:
```ts
  contributieMinima: boolean;
}>;
```
Bloc nou:
```ts
  contributieMinima: boolean;
  /** Handicap grav sau accentuat: fără impozit pe salarii (Codul fiscal art. 60 pct. 1 lit. b)). */
  scutitImpozit: boolean;
}>;
```
Bloc vechi:
```ts
  oreZi: 8,
  contributieMinima: true,
};
```
Bloc nou:
```ts
  oreZi: 8,
  contributieMinima: true,
  scutitImpozit: false,
};
```
Bloc vechi:
```ts
  impozit: number;
  /** Suma scoasă din baza de impozit și contribuții (OUG 89/2025 art. III); 0 când nu se aplică. */
```
Bloc nou:
```ts
  impozit: number;
  /** Impozitul e zero prin scutire (art. 60 pct. 1), nu prin calcul. */
  impozitScutit: boolean;
  /** Suma scoasă din baza de impozit și contribuții (OUG 89/2025 art. III); 0 când nu se aplică. */
```
În `intrare`, bloc vechi:
```ts
      valoareTichetMasa: tichete,
```
Bloc nou:
```ts
      // Art. 60 pct. 1: scutirea privește doar impozitul; CAS, CASS și CAM rămân.
      cotaImpozit: o.scutitImpozit ? 0 : setari.cotaImpozit,
      valoareTichetMasa: tichete,
```
În obiectul întors de `calculeazaDinBrut`, bloc vechi:
```ts
    impozit: r.impozit,
    sumaNeimpozabila: scutit,
```
Bloc nou:
```ts
    impozit: r.impozit,
    impozitScutit: o.scutitImpozit,
    sumaNeimpozabila: scutit,
```

`parametri.ts`, în `optiuniDin`, bloc vechi:
```ts
    contributieMinima: q.get("minim") !== "nu",
  };
```
Bloc nou:
```ts
    contributieMinima: q.get("minim") !== "nu",
    scutitImpozit: q.get("handicap") === "da",
  };
```

`randuri.ts`, bloc vechi:
```ts
      rand("Impozit pe venit, 10%", r.impozit, "minus"),
```
Bloc nou:
```ts
      rand(
        r.impozitScutit ? "Impozit pe venit — scutit, Codul fiscal art. 60 pct. 1" : "Impozit pe venit, 10%",
        r.impozit,
        "minus",
      ),
```

`formular.tsx`. `areOptiuniAlese`, bloc vechi:
```tsx
    p.optiuni.oreZi < 8 ||
    !p.optiuni.contributieMinima
  );
```
Bloc nou:
```tsx
    p.optiuni.oreZi < 8 ||
    !p.optiuni.contributieMinima ||
    p.optiuni.scutitImpozit
  );
```
După `<label>`-ul cu `input name="minim"`:
```tsx
          <label className="flex items-start gap-2 text-[0.9375rem] leading-[1.5]">
            <input
              type="checkbox"
              name="handicap"
              value="da"
              defaultChecked={p.optiuni.scutitImpozit}
              className="mt-1 size-4 shrink-0"
            />
            <span>Handicap grav sau accentuat: fără impozit pe salariu (art. 60 pct. 1)</span>
          </label>
```

`page.tsx`, lista „Ce nu calculează”, bloc vechi (din C6):
```tsx
            "Scutirile pentru persoanele cu handicap și pentru cercetare-dezvoltare. Facilitățile pe sectoare de activitate nu se mai aplică veniturilor din 2025 (OUG 156/2024).",
```
Bloc nou:
```tsx
            "Scutirea pentru cercetare-dezvoltare (art. 60 pct. 3), care cere proiect și stat de plată separate. Facilitățile pe sectoare de activitate (construcții, agricultură, industria alimentară, IT) nu se mai aplică veniturilor din 2025 (OUG 156/2024).",
```
Data din `harta.ts` se ridică.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui src/lib/unelte/ "src/app/(marketing)/unelte/calculator-salariu/" src/content/landing/continut.test.ts`, apoi lanțul complet și `prettier`.

- [ ] **Pasul 5: Verificarea headless.**
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=5000&handicap=da|Net 3.250 lei din brut 5.000 lei" \
  "suma=5000&handicap=da|scutit, Codul fiscal art. 60 pct. 1"
```
Așteptat: 4 × `OK`.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/lib/unelte "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git commit --only -m "feat(unelte): scutirea de impozit pentru handicap grav sau accentuat în calculatorul de salariu" -m "Codul fiscal art. 60 pct. 1 lit. b); facilitățile pe sectoare rămân în „Ce nu calculează”, abrogate din 2025." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/lib/unelte/salariu.ts src/lib/unelte/salariu.test.ts "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---

### Task C9: „Din 100 de lei plătiți de firmă” — împărțirea costului

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/calculator-salariu/lei.ts`, `lei.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/randuri.ts`, `randuri.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx` (un paragraf sub desfășurător)
- Modify: `src/content/landing/harta.ts` (data)

**Interfețe:**
- Produce:
  ```ts
  // lei.ts
  export function deLei(n: number): string; // „1 leu”, „19 lei”, „20 de lei”, „101 lei”, „120 de lei”
  // randuri.ts
  export type ImpartireCost = Readonly<{ net: number; tichete: number; stat: number }>;
  export function impartireaCostului(r: RezultatSalariu): ImpartireCost; // procente întregi, cu suma 100
  ```

- [ ] **Pasul 1: Scrie testele care pică.**

`lei.test.ts`: importul devine `import { deLei, lei } from "./lei";`, iar la final:
```ts
describe("numeralul cu „lei”", () => {
  it("„de” de la 20 în sus și la sute fixe, ca în română", () => {
    expect(deLei(1)).toBe("1 leu");
    expect(deLei(0)).toBe("0 lei");
    expect(deLei(19)).toBe("19 lei");
    expect(deLei(20)).toBe("20 de lei");
    expect(deLei(58)).toBe("58 de lei");
    expect(deLei(100)).toBe("100 de lei");
    expect(deLei(101)).toBe("101 lei");
    expect(deLei(119)).toBe("119 lei");
    expect(deLei(120)).toBe("120 de lei");
  });
});
```

`randuri.test.ts`: importul `./randuri` devine `import { impartireaCostului, randuriDesfasurator } from "./randuri";`, iar la final:
```ts
describe("împărțirea costului firmei", () => {
  it("5.000 brut: din 100 de lei, 58 ajung la angajat, 42 la stat", () => {
    // 2.981 / 5.113 = 58,3% → 58; statul = 100 − 58 = 42.
    expect(impartireaCostului(dinBrut(5000, 0, true))).toEqual({ net: 58, tichete: 0, stat: 42 });
  });

  it("la salariul minim, 61 / 39", () => {
    // 2.699 / 4.418 = 61,09% → 61.
    expect(impartireaCostului(dinBrut(4325, 0, true))).toEqual({ net: 61, tichete: 0, stat: 39 });
  });

  it("cu tichete, cele trei părți fac tot 100", () => {
    // Net 2.771, tichete 900, cost 6.013: 46,08% → 46; 14,97% → 15; statul 39.
    const r = calculeazaDinBrut(5000, { ...OPTIUNI_IMPLICITE, tichete: { valoare: 45, numar: 20 } });
    expect(impartireaCostului(r)).toEqual({ net: 46, tichete: 15, stat: 39 });
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/unelte/calculator-salariu/lei.test.ts" "src/app/(marketing)/unelte/calculator-salariu/randuri.test.ts"`
  Așteptat: `deLei` și `impartireaCostului` nu sunt exportate.

- [ ] **Pasul 3: Implementarea minimă.**

`lei.ts`, la final:
```ts

/**
 * Un număr întreg urmat de „lei”, cu „de” acolo unde româna îl cere: de la 20
 * în sus în fiecare sută și la sutele fixe („20 de lei”, „100 de lei”), nu și
 * la 1–19 sau 101–119 („19 lei”, „101 lei”). Un singur leu e „1 leu”.
 */
export function deLei(n: number): string {
  if (n === 1) return "1 leu";
  const rest = n % 100;
  const cuDe = rest >= 20 || (rest === 0 && n !== 0);
  return `${String(n)} ${cuDe ? "de lei" : "lei"}`;
}
```

`randuri.ts`, la final:
```ts

export type ImpartireCost = Readonly<{ net: number; tichete: number; stat: number }>;

/**
 * Din fiecare 100 de lei pe care îi plătește firma: cât ajunge la angajat în cont,
 * cât pe cardul de tichete și cât la stat (CAS, CASS, impozit, CAM și diferențele
 * de la timpul parțial). Procente întregi; partea statului e restul până la 100,
 * ca cele trei să facă mereu exact 100.
 */
export function impartireaCostului(r: RezultatSalariu): ImpartireCost {
  if (r.costTotal <= 0) return { net: 0, tichete: 0, stat: 0 };
  const net = Math.round((r.net / r.costTotal) * 100);
  const tichete = Math.round((r.tichete / r.costTotal) * 100);
  return { net, tichete, stat: 100 - net - tichete };
}
```

`page.tsx`. Importurile, bloc vechi:
```tsx
import { Desfasurator } from "./desfasurator";
import { Formular } from "./formular";
import { lei } from "./lei";
import { calculeazaDinParametri } from "./parametri";
```
Bloc nou:
```tsx
import { Desfasurator } from "./desfasurator";
import { Formular } from "./formular";
import { deLei, lei } from "./lei";
import { calculeazaDinParametri } from "./parametri";
import { impartireaCostului } from "./randuri";
```
Bloc vechi:
```tsx
            <div className="mt-6">
              <Desfasurator r={rezultat} />
            </div>
```
Bloc nou:
```tsx
            <div className="mt-6">
              <Desfasurator r={rezultat} />
            </div>
            <ImpartireaCostului r={rezultat} />
```
Componentă nouă în `page.tsx`, după `function TabelUzual(…) { … }`:
```tsx
/** Fraza care se citește și se trimite mai departe: cât din costul firmei ajunge la om. */
function ImpartireaCostului({ r }: { readonly r: RezultatSalariu }) {
  const i = impartireaCostului(r);
  return (
    <p className="mt-6 max-w-[68ch] text-[1.0625rem] leading-[1.6]">
      Din fiecare 100 de lei plătiți de firmă, {deLei(i.net)} ajung la angajat în cont
      {i.tichete > 0 ? `, ${deLei(i.tichete)} pe cardul de tichete` : ""}, iar {deLei(i.stat)} merg
      la stat, ca impozit și contribuții.
    </p>
  );
}
```
și importul de tip, bloc vechi:
```tsx
import { bazaMinimaContributii, dinBrut, dinNet } from "@/lib/unelte/salariu";
```
Bloc nou:
```tsx
import { bazaMinimaContributii, dinBrut, dinNet, type RezultatSalariu } from "@/lib/unelte/salariu";
```
Data din `harta.ts` se ridică.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui "src/app/(marketing)/unelte/calculator-salariu/"`, apoi lanțul complet și `prettier`.

- [ ] **Pasul 5: Verificarea headless.**
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=5000|Din fiecare 100 de lei plătiți de firmă, 58 de lei ajung la angajat în cont, iar 42 de lei merg la stat" \
  "suma=5000&tichet=45&tichete=20|46 de lei ajung la angajat în cont, 15 lei pe cardul de tichete, iar 39 de lei"
```
Așteptat: 4 × `OK`.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
git commit --only -m "feat(unelte): calculatorul de salariu spune cât din costul firmei ajunge la angajat" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task C10: Legătura de trimis — „Copiază legătura” și WhatsApp

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/calculator-salariu/parametri.ts` (`adresaPartajabila`, `legaturaWhatsApp`), `parametri.test.ts`
- Create: `src/app/(marketing)/unelte/calculator-salariu/copiaza-legatura.tsx` (`"use client"`), `copiaza-legatura.test.tsx`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx` (sub fraza din C9)
- Modify: `src/content/landing/continut.test.ts` (`SCUTITE`, în `describe("furnizorii externi sunt numiți în documentele legale")`): `wa.me` e un host extern nou
- Modify: `src/content/landing/harta.ts` (data)

**Interfețe:**
- Consumă: `ADRESA_SITE` (`src/content/landing/contact.ts:54`, fără importuri, sigur pe server și în teste); `lei` (C2).
- Produce:
  ```ts
  export function adresaPartajabila(p: ParametriCalculator): string;
  export function legaturaWhatsApp(r: RezultatSalariu, adresa: string): string;
  export function CopiazaLegatura({ adresa }: { readonly adresa: string }): JSX.Element;
  ```

- [ ] **Pasul 1: Scrie testele care pică.**

`parametri.test.ts`: importul devine
```ts
import {
  adresaPartajabila,
  calculeazaDinParametri,
  citesteSuma,
  legaturaWhatsApp,
  parametriCalculator,
} from "./parametri";
```
La final:
```ts
describe("legătura de trimis", () => {
  it("păstrează doar ce diferă de implicit, plus perioada, și se citește înapoi la fel, în altă zi", () => {
    const p = parametriCalculator(
      q({
        suma: "5.000",
        din: "net",
        perioada: "2026-1",
        persoane: "2",
        baza: "nu",
        sub26: "da",
        copii: "1",
        tichet: "40,18",
        tichete: "21",
        ore: "6",
        minim: "nu",
        handicap: "da",
      }),
      AZI,
    );
    const url = new URL(adresaPartajabila(p));
    expect(url.pathname).toBe("/unelte/calculator-salariu");
    expect(url.hash).toBe("#rezultat");
    // Deschisă în martie 2027, legătura trebuie să arate tot ianuarie–iunie 2026, nu perioada zilei.
    const inapoi = parametriCalculator(url.searchParams, "2027-03-01");
    expect(inapoi.optiuni).toEqual(p.optiuni);
    expect([inapoi.suma, inapoi.din]).toEqual([5000, "net"]);
  });

  it("calculul implicit are o legătură scurtă", () => {
    const adresa = adresaPartajabila(parametriCalculator(new URLSearchParams(), AZI));
    expect(adresa.endsWith("/unelte/calculator-salariu?suma=4325&perioada=2026-2#rezultat")).toBe(true);
  });

  it("WhatsApp primește cifrele și legătura, codate", () => {
    const r = calculeazaDinParametri(q({ suma: "5000" }), AZI);
    if (r.rezultat === null) throw new Error("Calculul de control lipsește.");
    const adresa = adresaPartajabila(r.parametri);
    const wa = new URL(legaturaWhatsApp(r.rezultat, adresa));
    expect(wa.origin).toBe("https://wa.me");
    expect(wa.searchParams.get("text")).toBe(
      `Calcul salariu: net 2.981 lei din brut 5.000 lei, cost pentru firmă 5.113 lei. ${adresa}`,
    );
  });
});
```

`src/app/(marketing)/unelte/calculator-salariu/copiaza-legatura.test.tsx`:
```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopiazaLegatura } from "./copiaza-legatura";

const ADRESA =
  "https://administrativo.ro/unelte/calculator-salariu?suma=5000&perioada=2026-2#rezultat";

function cuClipboard(valoare: unknown) {
  Object.defineProperty(navigator, "clipboard", { value: valoare, configurable: true });
}

describe("copierea legăturii", () => {
  afterEach(() => cuClipboard(undefined));

  it("arată legătura într-un câmp de citit, care merge și fără JavaScript", () => {
    render(<CopiazaLegatura adresa={ADRESA} />);
    const camp = screen.getByLabelText<HTMLInputElement>("Legătura spre acest calcul");
    expect(camp.value).toBe(ADRESA);
    expect(camp.readOnly).toBe(true);
    // 16 px: Safari pe iOS mărește pagina la atingerea unui câmp mai mic (91217eb).
    expect(camp.className).toContain("text-base");
  });

  it("copiază adresa și spune că a copiat-o", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    cuClipboard({ writeText });
    render(<CopiazaLegatura adresa={ADRESA} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiază legătura" }));
    });
    expect(writeText).toHaveBeenCalledWith(ADRESA);
    expect(screen.getByRole("button").textContent).toBe("Copiat");
  });

  it("fără clipboard (pagină http, browser vechi), cere copierea de mână și nu aruncă", async () => {
    cuClipboard(undefined);
    render(<CopiazaLegatura adresa={ADRESA} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiază legătura" }));
    });
    expect(
      screen.getByText("Browserul n-a permis copierea: selectează legătura și copiaz-o."),
    ).toBeTruthy();
  });
});
```

- [ ] **Pasul 2: Rulează-le și vezi-le picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui "src/app/(marketing)/unelte/calculator-salariu/parametri.test.ts" "src/app/(marketing)/unelte/calculator-salariu/copiaza-legatura.test.tsx"`
  Așteptat: `adresaPartajabila` nu e exportată, iar `./copiaza-legatura` nu se rezolvă.

- [ ] **Pasul 3: Implementarea minimă.**

`parametri.ts`. Importurile primesc, deasupra celui din `@/content/legal/salarizare-publica`:
```ts
import { ADRESA_SITE } from "@/content/landing/contact";
```
La finalul fișierului:
```ts

/**
 * Adresa de trimis pentru calculul curent: doar parametrii diferiți de implicit,
 * plus perioada. Implicitul perioadei depinde de zi, iar o legătură trimisă în
 * iunie trebuie să deschidă tot iunie și în iulie.
 */
export function adresaPartajabila(p: ParametriCalculator): string {
  const o = p.optiuni;
  const q = new URLSearchParams();
  if (p.suma !== null) q.set("suma", String(p.suma));
  if (p.din === "net") q.set("din", "net");
  q.set("perioada", o.perioada);
  if (o.persoane > 0) q.set("persoane", String(o.persoane));
  if (!o.functieDeBaza) q.set("baza", "nu");
  if (o.sub26) q.set("sub26", "da");
  if (o.copiiScoala > 0) q.set("copii", String(o.copiiScoala));
  if (o.tichete.valoare > 0 && o.tichete.numar > 0) {
    q.set("tichet", String(o.tichete.valoare));
    q.set("tichete", String(o.tichete.numar));
  }
  if (o.oreZi < 8) q.set("ore", String(o.oreZi));
  if (!o.contributieMinima) q.set("minim", "nu");
  if (o.scutitImpozit) q.set("handicap", "da");
  return `${ADRESA_SITE}/unelte/calculator-salariu?${q.toString()}#rezultat`;
}

/** Legătura „Trimite pe WhatsApp”: un link `wa.me`, fără script, care merge și fără JavaScript. */
export function legaturaWhatsApp(r: RezultatSalariu, adresa: string): string {
  const text = `Calcul salariu: net ${lei(r.net)} din brut ${lei(r.brut)}, cost pentru firmă ${lei(r.costTotal)}. ${adresa}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
```
(`String(40.18)` dă „40.18”. Citit înapoi de `citesteTichet`, un punct urmat de două cifre e zecimal, deci 40,18. Testul de mai sus o dovedește.)

`src/app/(marketing)/unelte/calculator-salariu/copiaza-legatura.tsx`:
```tsx
"use client";

import { useId, useState } from "react";

/**
 * Legătura spre calculul curent, cu buton de copiere.
 *
 * Fără JavaScript, câmpul rămâne: legătura se selectează și se copiază de mână.
 * Cu JavaScript, butonul o copiază. Unde browserul refuză clipboard-ul (pagină
 * încadrată, context nesecurizat, permisiune refuzată), spune ce e de făcut în
 * loc să tacă.
 */
export function CopiazaLegatura({ adresa }: { readonly adresa: string }) {
  const id = useId();
  const [stare, setStare] = useState<"gata" | "copiat" | "manual">("gata");

  async function copiaza() {
    try {
      await navigator.clipboard.writeText(adresa);
      setStare("copiat");
    } catch {
      setStare("manual");
    }
  }

  return (
    <div className="mt-6 max-w-[40rem]">
      <label htmlFor={id} className="text-[0.875rem] font-medium">
        Legătura spre acest calcul
      </label>
      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="text"
          readOnly
          value={adresa}
          onFocus={(e) => e.currentTarget.select()}
          className="border-mk-rigla bg-mk-hartie min-w-0 flex-1 rounded border px-3 py-2.5 text-base"
        />
        <button
          type="button"
          onClick={() => void copiaza()}
          data-umami-event="calculator-salariu-copiaza"
          className="border-mk-cerneala inline-flex h-11 shrink-0 items-center justify-center rounded border px-5 text-[0.9375rem] font-medium"
        >
          {stare === "copiat" ? "Copiat" : "Copiază legătura"}
        </button>
      </div>
      <p aria-live="polite" className="text-mk-text-slab mt-1.5 min-h-5 text-[0.8125rem]">
        {stare === "manual"
          ? "Browserul n-a permis copierea: selectează legătura și copiaz-o."
          : ""}
      </p>
    </div>
  );
}
```

`page.tsx`. Bloc vechi:
```tsx
import { Desfasurator } from "./desfasurator";
```
Bloc nou:
```tsx
import { CopiazaLegatura } from "./copiaza-legatura";
import { Desfasurator } from "./desfasurator";
```
Bloc vechi:
```tsx
import { calculeazaDinParametri } from "./parametri";
```
Bloc nou:
```tsx
import { adresaPartajabila, calculeazaDinParametri, legaturaWhatsApp } from "./parametri";
```
(Importurile locale stau în ordinea alfabetică a căii, convenția fișierului, deci `./copiaza-legatura` vine înaintea lui `./desfasurator`. Nicio unealtă n-o impune: `prettier` are doar `prettier-plugin-tailwindcss`, care reordonează clasele, iar ESLint n-are `import/order`.)
Bloc vechi (din C9):
```tsx
            <ImpartireaCostului r={rezultat} />
```
Bloc nou:
```tsx
            <ImpartireaCostului r={rezultat} />
            <CopiazaLegatura adresa={adresaPartajabila(parametri)} />
            <a
              href={legaturaWhatsApp(rezultat, adresaPartajabila(parametri))}
              target="_blank"
              rel="noopener noreferrer"
              data-umami-event="calculator-salariu-whatsapp"
              className="mt-1 inline-block text-[0.9375rem] underline underline-offset-4"
            >
              Trimite calculul pe WhatsApp
            </a>
```
`src/content/landing/continut.test.ts`. Poarta „fiecare host extern apelat din cod e numit sau scutit cu motiv” scanează literalii `"https://…"` din `src/` și pică pe orice host necunoscut. Literalul `https://wa.me/?text=` din `legaturaWhatsApp` o face roșie (verificat pe o copie cu C1–C10 aplicate: `wa.me: furnizor nou — numește-l în anexa termenilor sau în politica de confidențialitate și adaugă-l aici`). `wa.me` nu primește date de la noi: e o legătură pe care o apasă cititorul, ca `legislatie.just.ro`. Se scutește cu motivul scris. Bloc vechi (în `const SCUTITE`):
```ts
    "legislatie.just.ro":
      "legătură în afară către textul de lege, pe care o apasă cititorul; nu primește date de la noi",
  };
```
Bloc nou:
```ts
    "legislatie.just.ro":
      "legătură în afară către textul de lege, pe care o apasă cititorul; nu primește date de la noi",
    "wa.me":
      "legătura „Trimite pe WhatsApp” din calculatorul de salariu, pe care o apasă cititorul; textul e calculul de pe pagină, nu date de la noi",
  };
```
Data din `harta.ts` se ridică.

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui "src/app/(marketing)/unelte/calculator-salariu/" src/content/landing/continut.test.ts`, apoi lanțul complet. Fără blocul din `continut.test.ts`, `pnpm test` e roșu exact pe poarta furnizorilor externi. `pnpm check:server` contează aici: `copiaza-legatura.tsx` e `"use client"` și exportă doar componenta.

- [ ] **Pasul 5: Verificarea headless.**
```bash
node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/verifica.mjs \
  "suma=5000&persoane=2|Legătura spre acest calcul" "suma=5000&persoane=2|Trimite calculul pe WhatsApp"
```
Așteptat: 4 × `OK`, cu `scroll 360/360` și pe mobil, unde câmpul cu adresa lungă are `min-w-0` și nu împinge pagina. Comportamentul butonului nu se verifică aici (`next dev` nu hidratează fiabil). Rămâne pe `copiaza-legatura.test.tsx` și se verifică pe staging după deploy.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/continut.test.ts src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/continut.test.ts src/content/landing/harta.ts
git add -- "src/app/(marketing)/unelte/calculator-salariu/copiaza-legatura.tsx" "src/app/(marketing)/unelte/calculator-salariu/copiaza-legatura.test.tsx"
git commit --only -m "feat(unelte): legătura de trimis a calculatorului de salariu — copiere și WhatsApp" -m "wa.me intră în SCUTITE din continut.test.ts: o legătură apăsată de cititor, nu un furnizor care primește date." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "src/app/(marketing)/unelte/calculator-salariu" src/content/landing/continut.test.ts src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

---
### Task C11: Ancorele de căutare — salariul minim 2026 pe perioade, grilele brut↔net, antetul, hub-ul și `llms.txt`

**Fișiere:**
- Create: `src/app/(marketing)/unelte/calculator-salariu/tabele.ts`, `tabele.test.ts`
- Modify: `src/app/(marketing)/unelte/calculator-salariu/page.tsx`: `metadata.descriere` (liniile 38-39), `TabelUzual` (liniile 57-110), banda „Netul la salariul minim” (liniile 260-286), banda „Calcule uzuale” (liniile 293-326)
- Modify: `src/content/legal/salariu-minim.ts`: importurile (liniile 1-3), după linia 37, tabelul (liniile 165-168)
- Modify: `src/content/landing/unelte.ts:66` (`ANTET_CALCULATOR.lead`)
- Modify: `src/app/(marketing)/unelte/page.tsx:82` (nota din hub)
- Modify: `src/app/llms.txt/route.ts:151-153`
- Modify: `src/content/landing/harta.ts`: blocurile `/unelte/calculator-salariu` și `/unelte` (data)

**Interfețe:**
- Consumă: `PERIOADE`, `PERIOADE_2026` (C3), `calculeazaDinBrut`, `dinNet`, `OPTIUNI_IMPLICITE`.
- Produce:
  ```ts
  export type ColoanaSalariuMinim = Readonly<{ perioada: Perioada; eticheta: string; brut: number;
    oreLuna: string; leiPeOra: string; act: string; neimpozabil: number; net: number; costTotal: number }>;
  export function salariulMinim2026(): readonly ColoanaSalariuMinim[];
  export const TREPTE_BRUT: readonly [4325, 4500, 5000, 5500, 6000, 6500, 7000, 8000, 9000, 10000, 12000, 15000, 20000];
  export const TREPTE_NET: readonly [3000, 3500, 4000, 5000, 6000, 7000];
  export type RandBrutNet = Readonly<{ brut: number; net: number; netDouaPersoane: number; costTotal: number }>;
  export function grilaBrutNet(): readonly RandBrutNet[];
  export type RandNetBrut = Readonly<{ net: number; brut: number; costTotal: number }>;
  export function grilaNetBrut(): readonly RandNetBrut[];
  ```

- [ ] **Pasul 1: Scrie testul care pică.** `src/app/(marketing)/unelte/calculator-salariu/tabele.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { lei } from "./lei";
import { grilaBrutNet, grilaNetBrut, salariulMinim2026, TREPTE_BRUT } from "./tabele";

describe("tabelele fixe ale calculatorului", () => {
  it("salariul minim în 2026, pe perioade: 4.050 → 2.574 / 4.134 și 4.325 → 2.699 / 4.418", () => {
    // Calculele sunt în salariu.test.ts (C3 și vectorii publicați).
    expect(salariulMinim2026()).toEqual([
      {
        perioada: "2026-1",
        eticheta: "ianuarie–iunie 2026",
        brut: 4050,
        oreLuna: "165,334",
        leiPeOra: "24,496",
        act: "HG 1506/2024",
        neimpozabil: 300,
        net: 2574,
        costTotal: 4134,
      },
      {
        perioada: "2026-2",
        eticheta: "iulie–decembrie 2026",
        brut: 4325,
        oreLuna: "166,667",
        leiPeOra: "25,949",
        act: "HG 146/2026",
        neimpozabil: 200,
        net: 2699,
        costTotal: 4418,
      },
    ]);
  });

  it("grila brut → net: cifrele verificate live pe 8 oct 2026", () => {
    // Auditul: 5.000 → 2.981 (cost 5.113), 10.000 → 5.850 (10.225), 20.000 → 11.700.
    // 5.000 cu 2 persoane: minim + 675, pasul 14, 30% − 7 = 23% × 4.325 = 994,75 → 995;
    // impozit (5.000 − 1.250 − 500 − 995) × 10% = 225,5 → 226; net 3.024.
    // Peste 6.325 deducerea dispare la orice număr de persoane: 10.000 dă 5.850 în ambele coloane.
    const g = grilaBrutNet();
    expect(g.map((r) => r.brut)).toEqual([...TREPTE_BRUT]);
    expect(g.find((r) => r.brut === 5000)).toEqual({
      brut: 5000,
      net: 2981,
      netDouaPersoane: 3024,
      costTotal: 5113,
    });
    expect(g.find((r) => r.brut === 10000)).toEqual({
      brut: 10000,
      net: 5850,
      netDouaPersoane: 5850,
      costTotal: 10225,
    });
    expect(g.find((r) => r.brut === 20000)?.net).toBe(11700);
  });

  it("grila net → brut: 3.000 → 5.036, 5.000 → 8.548, 7.000 → 11.967", () => {
    const g = grilaNetBrut();
    expect(g.find((r) => r.net === 3000)).toEqual({ net: 3000, brut: 5036, costTotal: 5149 });
    expect(g.find((r) => r.net === 5000)).toEqual({ net: 5000, brut: 8548, costTotal: 8740 });
    expect(g.find((r) => r.net === 7000)?.brut).toBe(11967);
  });

  it("llms.txt și ghidul salariului minim spun aceleași cifre ca tabelele", async () => {
    const { PAGINI } = await import("@/app/llms.txt/route");
    const text = PAGINI.find(([cale]) => cale === "/unelte/calculator-salariu")?.[1] ?? "";
    for (const c of salariulMinim2026()) expect(text, c.eticheta).toContain(lei(c.net));
    expect(text).toContain(lei(grilaBrutNet().find((r) => r.brut === 5000)?.net ?? 0));
    const { SALARIU_MINIM } = await import("@/content/legal/salariu-minim");
    const randuri = SALARIU_MINIM.tabel?.randuri ?? [];
    expect(randuri).toContainEqual(["Net, normă întreagă, fără persoane în întreținere", "2.574 lei", "2.699 lei"]);
    expect(randuri).toContainEqual(["Cost total pentru firmă", "4.134 lei", "4.418 lei"]);
  });
});
```
(`PaginaLege.tabel` e opțional, `tabel?: Readonly<{ … randuri: readonly (readonly string[])[] }>` în `src/content/legal/tipuri.ts:99-109`, de unde `?.` și `?? []`.)

- [ ] **Pasul 2: Rulează-l și vezi-l picând.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(marketing)/unelte/calculator-salariu/tabele.test.ts"`
  Așteptat: `Failed to resolve import "./tabele"`. După ce modulul există, pică doar testul `llms.txt…`: textul vechi nu conține „2.574 lei”, iar ghidul are „—”.

- [ ] **Pasul 3: Implementarea minimă.**

`src/app/(marketing)/unelte/calculator-salariu/tabele.ts`:
```ts
import { PERIOADE, PERIOADE_2026, type Perioada } from "@/content/legal/salarizare-publica";
import { calculeazaDinBrut, dinNet, OPTIUNI_IMPLICITE } from "@/lib/unelte/salariu";

/**
 * Tabelele fixe ale paginii, calculate de același motor ca rezultatul, ca
 * pagina să nu se poată contrazice. Răspund direct la căutările „salariul minim
 * 2026”, „5000 brut în net”, „brut din net 4000”. Fiecare rând duce la calculul
 * complet (`?suma=`), iar canonicalul rămâne pagina fără parametri. Paginile
 * separate pe sume (ca la concurență) nu se fac: conținut subțire, care ar
 * canibaliza canonicalul și ghidul salariului minim.
 */

export type ColoanaSalariuMinim = Readonly<{
  perioada: Perioada;
  eticheta: string;
  brut: number;
  oreLuna: string;
  leiPeOra: string;
  act: string;
  neimpozabil: number;
  net: number;
  costTotal: number;
}>;

export function salariulMinim2026(): readonly ColoanaSalariuMinim[] {
  return PERIOADE.map((perioada) => {
    const v = PERIOADE_2026[perioada];
    const r = calculeazaDinBrut(v.salariuMinim, { ...OPTIUNI_IMPLICITE, perioada });
    return {
      perioada,
      eticheta: v.eticheta,
      brut: v.salariuMinim,
      oreLuna: v.oreLunaMedie,
      leiPeOra: v.leiPeOra,
      act: v.actSalariuMinim,
      neimpozabil: r.sumaNeimpozabila,
      net: r.net,
      costTotal: r.costTotal,
    };
  });
}

export const TREPTE_BRUT = [
  4325, 4500, 5000, 5500, 6000, 6500, 7000, 8000, 9000, 10000, 12000, 15000, 20000,
] as const;
export const TREPTE_NET = [3000, 3500, 4000, 5000, 6000, 7000] as const;

export type RandBrutNet = Readonly<{
  brut: number;
  net: number;
  netDouaPersoane: number;
  costTotal: number;
}>;

/** Brut → net în iulie–decembrie 2026, fără persoane și cu două persoane în întreținere. */
export function grilaBrutNet(): readonly RandBrutNet[] {
  return TREPTE_BRUT.map((brut) => {
    const r = calculeazaDinBrut(brut, OPTIUNI_IMPLICITE);
    return {
      brut,
      net: r.net,
      netDouaPersoane: calculeazaDinBrut(brut, { ...OPTIUNI_IMPLICITE, persoane: 2 }).net,
      costTotal: r.costTotal,
    };
  });
}

export type RandNetBrut = Readonly<{ net: number; brut: number; costTotal: number }>;

/** Net → brut în iulie–decembrie 2026, fără persoane. */
export function grilaNetBrut(): readonly RandNetBrut[] {
  return TREPTE_NET.map((net) => {
    const r = dinNet(net, 0, true);
    return { net, brut: r.brut, costTotal: r.costTotal };
  });
}
```

`page.tsx`. `metadata`, bloc vechi:
```tsx
  descriere:
    "Calcul salariu net din brut și brut din net, cu valorile din iulie 2026: CAS, CASS, impozit, deducerea personală și costul total pentru firmă.",
```
Bloc nou (154 de caractere; titlul de 43 rămâne):
```tsx
  descriere:
    "Calcul salariu net din brut și brut din net, 2026: CAS, CASS, impozit, deducerea pentru copii și sub 26 de ani, tichete de masă, timp parțial, cost firmă.",
```
Importurile primesc:
```tsx
import { grilaBrutNet, grilaNetBrut, salariulMinim2026, type ColoanaSalariuMinim } from "./tabele";
```
(după `import { impartireaCostului } from "./randuri";`). `TabelUzual`, înlocuit integral (liniile 57-110):
```tsx
/** Un tabel de calcule uzuale; fiecare rând duce la calculul complet. */
function TabelUzual({
  legenda,
  capete,
  randuri,
}: {
  readonly legenda: string;
  readonly capete: readonly string[];
  readonly randuri: readonly Readonly<{ valori: readonly number[]; href: string }>[];
}) {
  return (
    // `relative`: un `sr-only` dintr-un container derulabil fără el târa pagina lateral.
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left">
        <caption className="font-mk-display mb-3 text-left text-[1.125rem] font-semibold">
          {legenda}
        </caption>
        <thead>
          <tr className="border-mk-rigla border-b">
            {capete.map((cap) => (
              <th
                key={cap}
                scope="col"
                className="font-mk-date text-mk-text-slab py-2 pr-4 text-[0.6875rem] font-medium tracking-[0.1em] uppercase"
              >
                {cap}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {randuri.map((rand) => (
            <tr key={rand.href} className="border-mk-rigla/40 border-b">
              {rand.valori.map((v, i) => (
                <td
                  key={String(i)}
                  className="font-mk-date py-2.5 pr-4 text-[0.9375rem] whitespace-nowrap tabular-nums"
                >
                  {i === 0 ? (
                    <Link href={rand.href} className="underline underline-offset-4">
                      {lei(v)}
                    </Link>
                  ) : (
                    lei(v)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RANDURI_SALARIU_MINIM: readonly (readonly [string, (c: ColoanaSalariuMinim) => string])[] = [
  ["Brut pe lună", (c) => lei(c.brut)],
  ["Ore pe lună, în medie", (c) => c.oreLuna],
  ["Brut pe oră", (c) => `${c.leiPeOra} lei`],
  ["Actul normativ", (c) => c.act],
  ["Neimpozabil (OUG 89/2025 art. III)", (c) => lei(c.neimpozabil)],
  ["Net, normă întreagă, fără persoane", (c) => lei(c.net)],
  ["Cost total pentru firmă", (c) => lei(c.costTotal)],
];

/** Salariul minim pe cele două perioade ale lui 2026, cu netul și costul din același motor. */
function TabelSalariuMinim() {
  const coloane = salariulMinim2026();
  return (
    <div className="relative mt-8 overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left text-[0.9375rem]">
        <caption className="font-mk-display mb-3 text-left text-[1.125rem] font-semibold">
          Salariul minim în 2026, pe cele două perioade
        </caption>
        <thead>
          <tr className="border-mk-rigla border-b">
            <td className="py-2 pr-4" />
            {coloane.map((c) => (
              <th
                key={c.perioada}
                scope="col"
                className="font-mk-date text-mk-text-slab py-2 pr-4 text-[0.6875rem] font-medium tracking-[0.1em] uppercase"
              >
                <Link
                  href={`?suma=${String(c.brut)}&perioada=${c.perioada}#rezultat`}
                  className="underline underline-offset-4"
                >
                  {c.eticheta}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RANDURI_SALARIU_MINIM.map(([eticheta, valoare]) => (
            <tr key={eticheta} className="border-mk-rigla/40 border-b">
              <th scope="row" className="py-2.5 pr-4 font-normal">
                {eticheta}
              </th>
              {coloane.map((c) => (
                <td
                  key={c.perioada}
                  className="font-mk-date py-2.5 pr-4 whitespace-nowrap tabular-nums"
                >
                  {valoare(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```
(Celula goală din colțul tabelului e un `<td>`, nu un `<th>` cu `sr-only`, deci nu există niciun `sr-only` care să tragă pagina lateral.)

În banda „Netul la salariul minim”, bloc vechi (liniile 282-286 din forma inițială):
```tsx
            </Link>
            .
          </p>
        </div>
      </Banda>
```
Bloc nou:
```tsx
            </Link>
            .
          </p>
        </div>
        <TabelSalariuMinim />
      </Banda>
```
(Blocul e unic: banda „Pentru toată firma” se închide cu `<PeAcelasiSubiect …/>`, nu cu `</div>`.)
Banda „Calcule uzuale”, bloc vechi:
```tsx
        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <TabelUzual
            legenda="Calcul salariu net din brut"
            capete={["Brut", "Net", "Cost firmă"]}
            randuri={[4325, 4500, 5000, 6000, 7000, 8000, 10000, 15000].map((brut) => {
              const r = dinBrut(brut, 0, true);
              return {
                valori: [r.brut, r.net, r.costTotal],
                href: `?suma=${String(brut)}&din=brut#rezultat`,
              };
            })}
          />
          <TabelUzual
            legenda="Calcul salariu brut din net"
            capete={["Net dorit", "Brut necesar", "Cost firmă"]}
            randuri={[3000, 3500, 4000, 5000, 6000, 7000].map((net) => {
              const r = dinNet(net, 0, true);
              return {
                valori: [net, r.brut, r.costTotal],
                href: `?suma=${String(net)}&din=net#rezultat`,
              };
            })}
          />
        </div>
        <p className="text-mk-text-slab mt-5 max-w-[68ch] text-[0.8125rem] leading-[1.55]">
          Normă întreagă, funcția de bază, fără persoane în întreținere, valorile din iulie 2026.
          Pentru alte situații, scrie suma în calculator.
        </p>
```
Bloc nou:
```tsx
        <div className="mt-6 grid gap-10 lg:grid-cols-[3fr_2fr]">
          <TabelUzual
            legenda="Calcul salariu net din brut"
            capete={["Brut", "Net", "Net, 2 persoane", "Cost firmă"]}
            randuri={grilaBrutNet().map((r) => ({
              valori: [r.brut, r.net, r.netDouaPersoane, r.costTotal],
              href: `?suma=${String(r.brut)}&din=brut&perioada=2026-2#rezultat`,
            }))}
          />
          <TabelUzual
            legenda="Calcul salariu brut din net"
            capete={["Net dorit", "Brut necesar", "Cost firmă"]}
            randuri={grilaNetBrut().map((r) => ({
              valori: [r.net, r.brut, r.costTotal],
              href: `?suma=${String(r.net)}&din=net&perioada=2026-2#rezultat`,
            }))}
          />
        </div>
        <p className="text-mk-text-slab mt-5 max-w-[68ch] text-[0.8125rem] leading-[1.55]">
          Normă întreagă, funcția de bază, fără tichete, valorile din iulie–decembrie 2026. Peste
          6.325 de lei brut, deducerea personală nu se mai acordă, deci persoanele în întreținere
          nu mai schimbă netul. Pentru alte situații, scrie suma în calculator.
        </p>
```
`dinNet` nu mai e folosit în pagină (grila net → brut vine din `tabele.ts`), iar `tsc` (`noUnusedLocals`, TS6133) și `eslint` (`no-unused-vars`) pică amândouă pe el — verificat pe o copie cu C1–C11 aplicate. `dinBrut` rămâne (`laMinim`). Importul, bloc vechi (din C9):
```tsx
import { bazaMinimaContributii, dinBrut, dinNet, type RezultatSalariu } from "@/lib/unelte/salariu";
```
Bloc nou:
```tsx
import { bazaMinimaContributii, dinBrut, type RezultatSalariu } from "@/lib/unelte/salariu";
```

`src/content/legal/salariu-minim.ts`. Bloc vechi (liniile 1-3):
```ts
import { dinBrut } from "@/lib/unelte/salariu";

import { FACILITATE_SALARIU_MINIM, SALARIU_MINIM_BRUT_2026_IULIE } from "./salarizare-publica";
```
Bloc nou:
```ts
import { calculeazaDinBrut, dinBrut, OPTIUNI_IMPLICITE } from "@/lib/unelte/salariu";

import {
  FACILITATE_SALARIU_MINIM,
  SALARIU_MINIM_BRUT_2026_IANUARIE,
  SALARIU_MINIM_BRUT_2026_IULIE,
} from "./salarizare-publica";
```
După linia 37 (`const UN_LEU_PESTE = dinBrut(MINIM + 1, 0, true);`):
```ts
/** Ianuarie–iunie 2026: 4.050 lei, cu 300 de lei scutiți (OUG 89/2025 art. III alin. (1)). */
const LA_MINIM_IANUARIE = calculeazaDinBrut(SALARIU_MINIM_BRUT_2026_IANUARIE, {
  ...OPTIUNI_IMPLICITE,
  perioada: "2026-1",
});
```
Bloc vechi (liniile 165-168):
```ts
      ["Net, normă întreagă, fără persoane în întreținere", "—", lei(LA_MINIM.net)],
      ["Cost total pentru firmă", "—", lei(LA_MINIM.costTotal)],
    ],
    nota: "Netul și costul sunt calculate doar pentru valoarea în vigoare, la fel ca în calculatorul de salariu, cu suma scutită inclusă.",
```
Bloc nou:
```ts
      [
        "Net, normă întreagă, fără persoane în întreținere",
        lei(LA_MINIM_IANUARIE.net),
        lei(LA_MINIM.net),
      ],
      ["Cost total pentru firmă", lei(LA_MINIM_IANUARIE.costTotal), lei(LA_MINIM.costTotal)],
    ],
    nota: `Netul și costul sunt calculate de același motor ca în calculatorul de salariu, cu suma scutită a fiecărei perioade: ${String(LA_MINIM_IANUARIE.sumaNeimpozabila)} de lei în ianuarie–iunie, ${String(LA_MINIM.sumaNeimpozabila)} de lei din iulie (OUG 89/2025 art. III).`,
```
(`String(…)` + „de lei”, nu `lei(…)`: `lei` din `salariu-minim.ts` scrie „300 lei”, iar în frază româna cere „300 de lei”.)
`actualizatIso` al ghidului NU se schimbă (Decizia 14).

`src/content/landing/unelte.ts:66`, bloc vechi:
```ts
  lead: "Scrie brutul și afli netul, sau invers — cu salariul minim de 4.325 de lei, deducerea personală, CAS, CASS, impozitul și costul total pentru angajator, la valorile din iulie 2026.",
```
Bloc nou:
```ts
  lead: "Scrie brutul și afli netul, sau invers, pentru ianuarie–iunie sau iulie–decembrie 2026: CAS, CASS, impozitul, deducerea personală, și pentru copii sau sub 26 de ani, tichetele de masă, timpul parțial și costul total pentru firmă.",
```

`src/app/(marketing)/unelte/page.tsx:82`, bloc vechi:
```tsx
    nota: "net din brut și brut din net · valorile din iulie 2026",
```
Bloc nou:
```tsx
    nota: "net și brut · tichete, deduceri, timp parțial · ambele perioade din 2026",
```

`src/app/llms.txt/route.ts`, bloc vechi:
```ts
    "Unealtă gratuită: calculator de salariu net din brut și brut din net, la valorile din iulie–decembrie 2026 — salariul minim de 4.325 lei (HG 146/2026), cei 200 de lei neimpozabili la salariul minim (OUG 89/2025 art. III), deducerea personală din art. 77, CAS 25%, CASS 10%, impozit 10%, CAM 2,25%, sume rotunjite la leu. Exemple: 4.325 brut → 2.699 net; 5.000 brut → 2.981 net.",
```
Bloc nou:
```ts
    "Unealtă gratuită: calculator de salariu net din brut și brut din net, pentru ianuarie–iunie 2026 (salariul minim de 4.050 lei, HG 1506/2024, cu 300 de lei neimpozabili) și iulie–decembrie 2026 (4.325 lei, HG 146/2026, cu 200 de lei neimpozabili; OUG 89/2025 art. III). Deducerea personală din art. 77, inclusiv 15% din minim până la 26 de ani și 100 de lei pe copil înscris la școală; tichetele de masă (impozit și CASS, fără CAS și CAM); timpul parțial, cu baza minimă de contribuții plătită de firmă; scutirea pentru handicap grav sau accentuat; CAS 25%, CASS 10%, impozit 10%, CAM 2,25%, costul total pentru firmă, sume rotunjite la leu. Legătura spre calcul se poate trimite. Exemple: 4.050 lei brut în ianuarie–iunie → 2.574 lei net; 4.325 lei brut → 2.699 lei net; 5.000 lei brut → 2.981 lei net.",
```

`harta.ts`: data ridicată în blocul `cale: "/unelte/calculator-salariu"` și în blocul `cale: "/unelte"` (acolo, comentariul `// 6 oct: …` rămâne, iar dedesubt se adaugă `// <data>: nota calculatorului de salariu numește funcțiile noi.`).

- [ ] **Pasul 4: Rulează testele, trec.**
  `cd /srv/apps/ERP && pnpm exec vitest run --project unit --project ui "src/app/(marketing)/unelte/calculator-salariu/" src/content/ "src/app/(marketing)/_componente/"`. `continut.test.ts` acoperă `llms.txt` ↔ sitemap, iar `metadate.test.ts` lungimile. Apoi lanțul complet, `prettier` și `node scripts/checks/lastmod.mjs` (după commit).

- [ ] **Pasul 5: Verificarea headless a tabelelor la 360 px.** Scriptul `verifica.mjs` citește doar `#rezultat`, așa că tabelele se măsoară separat. Creează `/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-calculator-salariu/tabele.mjs`:
```js
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";

const browser = await chromium.launch({
  executablePath:
    "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
});
const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
await page.goto("http://127.0.0.1:3917/unelte/calculator-salariu", { waitUntil: "load" });
const masuri = await page.evaluate(() => ({
  pagina: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
  tabele: [...document.querySelectorAll("table caption")].map((c) => c.textContent),
  minim: document.body.innerText.includes("Salariul minim în 2026, pe cele două perioade"),
  ianuarie: document.body.innerText.includes("2.574 lei"),
}));
console.log(JSON.stringify(masuri));
await page.screenshot({ path: new URL("./tabele-360.png", import.meta.url).pathname, fullPage: true });
await browser.close();
process.exit(masuri.pagina[0] <= masuri.pagina[1] && masuri.minim && masuri.ianuarie ? 0 : 1);
```
Rulează-l cu `node` (serverul pornit). Așteptat: `pagina` = `[360,360]` (tabelele derulează în containerul lor, nu pagina întreagă) și ieșire 0. Deschide `tabele-360.png` cu Read: coloana „Net, 2 persoane” se derulează în tabel, nu rupe pagina. Verifică și ghidul: `curl -s http://127.0.0.1:3917/ghid/salariu-minim-pe-economie | grep -c "2.574 lei"` trebuie să dea ≥ 1.

- [ ] **Commit**
```bash
cd /srv/apps/ERP
git status --short -- "src/app/(marketing)/unelte" src/content/legal/salariu-minim.ts src/content/landing/unelte.ts src/app/llms.txt/route.ts src/content/landing/harta.ts
git fetch origin main
git diff --name-only HEAD origin/main -- "src/app/(marketing)/unelte" src/content/legal/salariu-minim.ts src/content/landing src/app/llms.txt
git add -- "src/app/(marketing)/unelte/calculator-salariu/tabele.ts" "src/app/(marketing)/unelte/calculator-salariu/tabele.test.ts"
git commit --only -m "feat(unelte): salariul minim 2026 pe perioade și grilele brut↔net pe trepte, ca ancore de căutare" -m "Tabelele vin din același motor ca rezultatul; ghidul salariului minim primește netul și costul din ianuarie–iunie (2.574 / 4.134 lei); antetul, hub-ul și llms.txt numesc funcțiile noi." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "src/app/(marketing)/unelte/calculator-salariu" "src/app/(marketing)/unelte/page.tsx" src/content/legal/salariu-minim.ts src/content/landing/unelte.ts src/app/llms.txt/route.ts src/content/landing/harta.ts
node scripts/checks/lastmod.mjs
git merge origin/main
git push origin main
```

- [ ] **Deploy** (după C11, cu confirmarea explicită a utilizatorului; un „da” anterior nu acoperă acest deploy): `./administrativo.sh`, conform `erp-deploy-productie.md`. Staging întâi: verifică rulările staging (memoria `erp-staging-cade-tacut.md`). Apoi pe producție, `verifica.mjs` cu `BAZA=https://administrativo.ro` și cazurile din C1–C9. Fiecare trebuie să dea `OK`, iar butonul „Copiază legătura” se încearcă manual pe telefon, singurul loc unde se vede hidratarea.

---
### Review Focus

Cinci condiții pe care testele inițiale nu le prindeau și care ar lovi un om real. **Testele lor sunt acum scrise în Pasul 1 al taskului care deține codul** (mutate acolo la verificarea adversarială din 8 oct 2026, ca executorul să nu le poată sări), și au fost rulate pe o copie cu C1–C11 aplicate: trec toate.

1. **Suma lipită din Excel sau de pe un fluturaș, cu bani** („4.500,00”, „4 500,00 lei”, „4,500.00”, „4500.00”): o regulă de mii prea lacomă ar face din „4.500,00” 450.000. → C1, `parametri.test.ts`, „formatele lipite din Excel…”.
2. **Câmpul golit și trimis** (doar spații): trebuie să dea salariul minim al perioadei, nu „Nu am înțeles suma „””. → C1 (fără `azi`) și, în forma cu `AZI`, în blocul înlocuit de C3.
3. **Schimbarea perioadei cu suma rămasă în câmp**: 4.325 în ianuarie–iunie e un salariu peste minim (net 2.599, fără sumă scutită). E corect matematic, dar ușor de citit greșit; legătura „ianuarie–iunie 2026” din tabelul salariului minim (C11) duce la minimul corect. → C3, `parametri.test.ts`.
4. **Timp parțial cu tichete**, cazul obișnuit în comerț: CASS-ul angajatului include tichetele, deci diferența plătită de firmă la CASS e mai mică (107, nu 197). → C7, `salariu.test.ts`.
5. **Tichete mari (23 × 100 de lei) care împing pragul deducerii sub minim** (4.025): net → brut rămâne legal și minim. → C6, `salariu.test.ts`.

**Verificarea adversarială din 8 oct 2026 (seara)**, pe o copie a lui `src/` cu toate blocurile C1–C11 aplicate mecanic, în ordine, din acest fișier (fiecare „bloc vechi” găsit exact o dată, după `prettier --write`): fiecare Pas 2 pică așa cum spune, fiecare Pas 4 trece; `tsc --noEmit` pe tot proiectul curat, `eslint` și `prettier --check` curate, `check:server` curat, `vitest --project unit --project ui` verde (în afara testelor care cer `docs/`, `mobil/` sau istoric git, absente din copie). Net → brut comparat cu căutarea exhaustivă pe 146 de combinații de opțiuni (perioadă × 0/2/4 persoane × sub 26 × fără / 20 × 45 / 23 × 100 tichete × 8 / 4 ore × 0 / 2 copii, plus în afara funcției de bază și handicap), ținte 500–7.000 din 3 în 3: 0 diferențe. Singurul defect care ar fi oprit execuția: poarta furnizorilor externi din `continut.test.ts`, roșie pe `wa.me` în C10 — reparată acolo. Corecturi mărunte: eșecul așteptat la C1 Pas 2, „300 de lei” în nota ghidului (C11), eticheta bifei de vârstă cu cuvintele legii și ⚠ în NOTES (C5), mențiunea alin. (12) la copii (C5).

În afara testelor, cu ochii, înainte de deploy: pe `mobil-*.png` din C5–C8, `<details>` deschis cu toate cele opt câmpuri trebuie să încapă la 360 px fără derulare laterală. `verifica.mjs` o măsoară (`scrollWidth`), dar doar pentru combinațiile rulate acolo.
