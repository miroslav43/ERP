## B. Robustețe comună: calendar, documente, intrări, tipărire

**Scop:** cele șapte unelte publice dau, pentru orice intrare, documentul cerut: zilele lucrătoare corecte pe toți anii oferiți, fișiere Word care se deschid, nume care nu se rup, liste care nu se taie pe tăcute, o tipărire din browser fără meniu și fără cookie-uri, ore scrise românește și un aviz când adresa a fost corectată.

**De ce:** auditul live din 8 oct 2026 (`audit-unelte.json`, 18 agenți, 7 unelte) a găsit șapte defecte care se repetă de la o unealtă la alta:

1. **Calendarul greșește pe 2020–2023.** `sarbatoriAnului` pune 6 și 7 ianuarie în fiecare an, dar ele sunt în art. 139 abia din 09.03.2023. Ianuarie 2022 iese „18 zile × 8 h = 144 h” în loc de 20 de zile și 160 h. Totalurile anuale de pe pagina foii ies 249/252/249/247 în loc de 251/254/251/248. Formularul acceptă anii 2020–2035 (`AN_MIN = 2020`).
2. **Word corupt la caractere de control, pe toate cele șase unelte cu documente.** De exemplu `nume=A%01B%0BC`: HTTP 200, dar `word/document.xml` nu e XML valid și Word refuză fișierul. U+000B vine din rândul manual al lui Word sau PowerPoint. XLSX-ul iese valid la U+000B (exceljs scoate controalele C0, dar lipește cuvintele: „Condicade”), însă NU la U+FFFE/U+FFFF, care rup `sharedStrings.xml` (verificat cu saxes la verificarea planului); PDF-ul pune spații.
3. **Virgula și punctul și virgula despart numele.** `foaie.ts:87` desparte cu `split(/[\n,;]/)`, așa că „Popescu, Ion” devine doi angajați. Pagina spune „câte un nume pe rând”.
4. **Peste 60 de nume, restul se pierd fără niciun semn.** Cu 70 de nume, pagina, PDF-ul, DOCX-ul și XLSX-ul au 60 de rânduri, iar câmpul de text arată în continuare 70.
5. **Tipărirea din browser.** Am măsurat azi, pe producție, cu `page.pdf`: foaia de pontaj cu 10 nume iese pe **5 pagini A4**, cererea de concediu pe **3**. Pe hârtie ies meniul, bara de cookie-uri și subsolul. Regula `[data-tipar="ascunde"]` există (`globals.css:1071`), dar n-o poartă nici `<header>` din `Antet`, nici `<footer>` din `Subsol`, nici bara. `Banda` nu transmite atributul, deci `page.tsx:317` îl pune degeaba. Cu o simulare CSS a reparației, aceeași foaie iese pe **1 pagină A4 culcată**, cererea pe **1 pagină portret**, iar foaia cu 60 de nume pe 3 pagini culcate.
6. **Virgulă mobilă afișată.** `ore=7.3` pe iunie 2026 dă „153.29999999999998 h”, cu punct zecimal.
7. **Parametrii invalizi sunt înlocuiți fără niciun semn.** `an=1999&luna=13` dă foaia pentru luna curentă, cu HTTP 200. `luna=2e1` dă februarie. `format=DOCX` dă PDF.

Contextul comercial: în 35 de zile n-a existat nicio descărcare de la un om. Singurul vizitator venit din Google pe o unealtă și-a făcut cont în 3 minute. O unealtă care greșește norma din ianuarie sau dă un Word care nu se deschide pierde exact omul ăsta.

**Decizii luate**

- **D1. Calendarul ține ziua intrării în vigoare, nu o condiție pe an.** Fiecare sărbătoare introdusă din 2016 încoace primește `inVigoareDin` (ISO) și intră în listă doar dacă ziua ei calendaristică e la sau după acea dată. Pe 2020–2035 rezultatul e identic cu `an >= 2024`: ianuarie 2023 cade înainte de 09.03.2023. Diferența e că regula e cea din lege și acoperă și 24 ianuarie (16.10.2016), 1 iunie (21.11.2016) și Vinerea Mare (16.03.2018). REGES calculează termene pentru configurări valabile din 2018 (`valabilDeLa: "2018-01-01"`). Garanția declarată în cod: lista e corectă din 2017 încolo. **Corectat la verificare (8 oct 2026):** 24 ianuarie ARE mențiune în consolidare — alin. (1) a fost rescris „la 16-10-2016” de Legea nr. 176/2016 (MO nr. 808 din 13.10.2016), care introduce „24 ianuarie – Ziua Unirii Principatelor Române” (textul legii descărcat cu curl de pe `DetaliiDocumentAfis/182520`). De aceea 24 ianuarie primește și el `inVigoareDin`. 30 noiembrie e în lista rescrisă din 2016 și nu are mențiune separată după; pentru anii de dinainte de 2017 nu promitem nimic.
- **D2. Lista REGES (`sarbatoriLegale`) primește aceeași regulă, scrisă separat.** Nu o derivăm din `domain/calendar`. Cele două implementări sunt independente intenționat, iar testul de echivalență din `evenimente.lacune.test.ts` le păzește. Îl extind de la 2020–2035 la 2016–2035, ca să prindă și regulile din 2016 (24 ianuarie, 1 iunie) și 2018.
- **D3. Nicio migrare.** Seed-ul `public_holidays` acoperă 2024–2040 și coincide cu funcția reparată. Comentariul tabelei din `0009_leave.sql` („6 și 7 ianuarie … aplicabile din 2017”) e greșit, dar migrarea e aplicată și nu se editează. Corectura se scrie în `NOTES.md` și în docblock-ul din `sarbatori.ts`.
- **D4. Curățarea textului se face într-un singur punct.** `curataText` și `curataDocument` stau în `document-tabelar.ts`, care e pur și fără importuri. Se aplică în `raspunsDocument`, deci pe toate uneltele și toate formatele, și în `PrevizualizareDocument`, ca pagina să arate ce se descarcă. Nu se aplică în cele cinci funcții `text()` ale uneltelor. **Excepția:** Excelul foii de pontaj nu trece prin `raspunsDocument` (are generatorul lui ExcelJS, cu formule, în `route.ts`); acolo singurul text liber sunt numele, iar ele trec prin `curataText` din B3, în `citesteAngajati`. Testul rutei din B4 păzește cazul (U+FFFE într-un nume). Regulile:
  - CRLF și CR devin LF.
  - Separatorii (tab, U+000B, U+000C, NEL, U+2028, U+2029) devin spațiu.
  - Restul caracterelor interzise de producția `Char` din XML 1.0 se șterg, la fel C1, spațiile de lățime zero, BOM-ul, U+FFFE, U+FFFF și surogatele orfane.
  - `\n` rămâne: etichetele de coloană îl folosesc („1\nM”).
- **D5. Testul folosește un parser XML real: `saxes@5.0.1`, adăugat ca devDependency exactă.** E deja în lockfile, prin exceljs. Am verificat azi: saxes respinge U+000B, U+0000 și U+FFFE cu „disallowed character”. `happy-dom` acceptă U+000B fără eroare, deci nu poate fi poartă. Pe `pnpm` nu există pachetul `saxes` hoistat; e nevoie de dependența directă.
- **D6. Numele se despart doar la rând nou.** Rând nou înseamnă LF, CRLF, CR, U+000B, U+000C, NEL, U+2028 sau U+2029. Tabul dintr-un rând devine spațiu, așa că două coloane lipite din Excel („Popa⇥Ion”) dau „Popa Ion”. Argumentul: o coloană copiată din Excel vine deja cu un nume pe rând. O listă scrisă cu virgule se rescrie o dată, pe când un nume rupt în doi nu se vede până la semnătură.
- **D7. Plafonul de 60 rămâne.** URL-ul cade la Cloudflare (520) pe la 8–10 KB, iar 60 de nume tipărite înseamnă 3 pagini A4 culcate. Se adaugă un aviz pe pagină („Am păstrat primii 60 din 70 de angajați…”) și o notă în fișier, fiindcă fișierul circulă fără pagină. Același lucru se întâmplă cu numele scurtate la 80 de caractere.
- **D8. Tipărirea se repară cu marcaje explicite, după convenția `data-tipar`.** Le primesc `<header>` din `Antet`, `<footer>` din `Subsol`, bara de cookie-uri, `Banda` (prin prop) și banda formularului de pe fiecare dintre cele 6 pagini cu document. Plus o pagină CSS numită `peisaj` (`@page peisaj { size: A4 landscape }`), cerută de figura foii de pontaj și de previzualizările cu `orientare: "peisaj"`. Am respins regula „magică” `main section:not(#documentul)`: ar ascunde tăcut orice bandă nouă.
- **D9. Orele se scriu în ceas, după regula produsului din `src/lib/format/ore.ts`** („nu există 8,5 ore”). Orele întregi rămân fără „:00” („8 h”, „168 h”), fracțiile se scriu „7:18 h”. Norma se rotunjește la minut. „21 de zile” se scrie cu „de”, prin `cuDe`.
- **D10. API-ul rămâne tolerant, pagina avertizează.** Un link vechi sau trunchiat dă tot un fișier, nu o pagină text/plain cu 400. Pagina arată `AvizCorectari` (`role="status"`, nu se tipărește), care spune ce a corectat și ce a folosit în loc. Comparația se face cu `Number`, nu cu `parseInt`, ca „2e1” să nu mai treacă drept 2. Singura schimbare în API: formatul se citește fără majuscule și spații („DOCX” → docx). Datele cererii de concediu (`de_la`/`pana_la`) aparțin secțiunii care deține cererea, care refolosește `AvizCorectari`.
- **D11. Datele `lastmod`.** B4, B6 și B8 schimbă `page.tsx` fără să schimbe textul implicit al paginii, deci SHA-urile lor intră în `scripts/checks/lastmod-fara-continut.txt`, într-un al doilea commit în același push. B7 schimbă textul vizibil al foii („… × 8 h = 168 h normă”), deci ridică `actualizat` în `harta.ts`.
- **D12. Verificarea se face pe trei niveluri.**
  - Local, cu `next dev -H 127.0.0.1`: HTML, CSS și `page.pdf`. Hidratarea nu se termină local (memoria `erp-next-dev-nu-hidrateaza`), deci bara de cookie-uri nu apare.
  - Pe staging, cu `e2e/unelte-tipar.spec.ts`, rulat după deploy-ul automat din `staging.yml`. Build de producție, bara apare.
  - Pe producție, cu sonda, doar după un deploy confirmat de utilizator.
- **În afara secțiunii (nu le ating aici):** `maxLength` pe câmpuri și 414 în nginx pentru URL-uri lungi; `cache-control: public` pe descărcări; conținutul juridic al fiecărei unelte.

**Convenții pentru toți pașii.** `REPO=/srv/apps/ERP`. `SCRATCH` = directorul scratchpad al sesiunii care execută (din promptul de sistem). Căile cu paranteze se pun mereu între ghilimele. Lanțul de verificare complet al fiecărui task:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

Pe fișierele atinse se rulează `pnpm exec prettier --write <fișiere>`, apoi `pnpm exec prettier --check <fișiere>`. După commit se rulează `node scripts/checks/lastmod.mjs`. Fără `pnpm build`. Pentru pagini, semnătura rămâne `searchParams: Promise<…>`, verificată în `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:75`.

**Harta fișierelor**

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| `src/domain/calendar/sarbatori.ts` | sărbătorile legale, fiecare cu ziua intrării în vigoare | B1 |
| `src/domain/calendar/sarbatori.test.ts` | 2016–2024 față de lege | B1 |
| `src/domain/reges/evenimente.ts` | `sarbatoriLegale`, aceeași regulă | B1 |
| `src/domain/reges/evenimente.lacune.test.ts` | echivalența pe 2016–2035; termen peste 6 ianuarie | B1 |
| `src/content/legal/zile-libere.test.ts` | totalurile anuale 2020–2023 | B1 |
| `NOTES.md` (§ Sărbători legale) | istoricul legal corectat | B1 |
| `src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts` (nou) | foaia: zile, nume, ore, avize | B1, B3, B4, B7, B8 |
| `src/lib/unelte/document-tabelar.ts` | `curataText`, `curataDocument`, `normalizeazaFormat` | B2, B8 |
| `src/lib/unelte/raspuns.ts` | punctul unic de curățare pentru fișiere | B2 |
| `src/lib/unelte/randari.test.ts` | XML valid (saxes), formatul fără majuscule | B2, B8 |
| `package.json`, `pnpm-lock.yaml` | `saxes@5.0.1` ca devDependency | B2 |
| `src/app/(marketing)/_componente/previzualizare-document.tsx` | previzualizare curățată; orientarea la tipar | B2, B6 |
| `src/app/(marketing)/_componente/previzualizare-document.test.tsx` (nou) | previzualizarea arată textul curățat | B2 |
| `src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts` | `citesteAngajati`, avize, `oreFoaie`, `textNorma` | B3, B4, B7, B8 |
| `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts` | nota de trunchiere; textul normei | B4, B7 |
| `src/app/api/unelte/foaie-de-pontaj/route.ts` | lista, nota, textul normei, formatul | B4, B7, B8 |
| `src/app/api/unelte/foaie-de-pontaj/route.test.ts` (nou) | descărcările foii | B4, B7, B8 |
| `src/app/(marketing)/unelte/condica-de-prezenta/model.ts` + `model.test.ts` | nota de trunchiere | B4 |
| `src/app/(marketing)/_componente/aviz-corectari.tsx` (nou) + `aviz-corectari.test.tsx` (nou) | avizul de pe pagină | B4 |
| `src/app/(marketing)/unelte/avize.test.tsx` (nou) | avizele pe paginile randate | B4, B8 |
| `src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx` | aviz, tipar, normă | B4, B6, B7, B8 |
| `src/app/(marketing)/unelte/condica-de-prezenta/page.tsx` | aviz, tipar | B4, B6, B8 |
| `src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx` | tipar, aviz | B6, B8 |
| `src/app/(marketing)/unelte/{fisa-instruire-ssm,fisa-evaluare,cerere-concediu-de-odihna}/page.tsx` | tipar | B6 |
| `src/app/(marketing)/_componente/{banda,antet,subsol,bara-consimtamant}.tsx` | `data-tipar` | B5 |
| `src/app/(marketing)/_componente/tipar.test.tsx` (nou) | componentele nu se tipăresc | B5 |
| `src/app/globals.css` (blocul `@media print`) | `@page peisaj` | B6 |
| `src/app/(marketing)/unelte/tipar.test.tsx` (nou) | pe pagini, la tipar rămâne doar documentul | B6 |
| `e2e/unelte-tipar.spec.ts` (nou) | tipar pe staging, cu hidratare | B6 |
| `scripts/checks/lastmod-fara-continut.txt` | SHA-urile fără conținut | B4, B6, B8 |
| `src/content/landing/harta.ts` | `actualizat` pentru foaia de pontaj | B7 |
| `src/app/api/unelte/[unealta]/route.test.ts` | `format=DOCX` | B8 |
| `src/domain/calendar/sarbatori.paritate-sql.test.ts` (nou) | paritatea `sarbatoriAnului` ↔ seed-ul `public_holidays` (0009) | B9 |

Ordinea de execuție: B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9. B1 și B5 sunt independente de restul. B9 (paritatea calendarului cu seed-ul SQL, adăugat de criticul de completitudine) cere doar B1. **B2 rulează după A5:** blocul „vechi” al lui A5 din `raspuns.ts` conține linia `const continut = await RANDARI[format](d);`, pe care B2 o schimbă; în ordinea A5 → B2, ancora lui B2 rămâne neatinsă de A5. B3 cere B2; B4 cere B3; B6 cere B5 și B2; B7 cere B4; B8 cere B4 și B7.

---

### Task B1: 6 și 7 ianuarie (și 1 iunie, Vinerea Mare) din ziua intrării în vigoare

**Fișiere:**
- Modify: `src/domain/calendar/sarbatori.ts:13-57`
- Modify: `src/domain/reges/evenimente.ts:107-137`
- Modify: `NOTES.md:192-197`
- Test: `src/domain/calendar/sarbatori.test.ts` (adaugă la sfârșit), `src/domain/reges/evenimente.lacune.test.ts:45-53`, `src/content/legal/zile-libere.test.ts:47`, `src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts` (Create)

**Interfețe:**
- Consumă: `pasteOrtodox(an: number): Date` (`./paste-ortodox`); `construiesteFoaie(an, luna, angajati, oreZi): Foaie`; `calendarulAnului(an): CalendarAn`; `construiesteCalendar(anInceput: number, anSfarsit: number): CalendarLucrator`; `deplaseazaZileLucratoare(zi: ZiIso, numar: number, calendar: CalendarLucrator): ZiIso`.
- Produce: aceleași semnături publice, neschimbate: `sarbatoriAnului(an: number): readonly Sarbatoare[]`, `sarbatoriDupaZi(an: number): ReadonlyMap<string, string>`, `sarbatoriLegale(an: number): readonly ZiIso[]`. Se schimbă doar conținutul pentru anii dinainte de 2024.

- [ ] **Pasul 1: Scrie testele care pică**

Adaugă la sfârșitul fișierului `src/domain/calendar/sarbatori.test.ts`:

```ts
/**
 * Lista din art. 139 alin. (1) s-a schimbat prin lege. Datele vin din mențiunile
 * formei consolidate a Codului muncii (legislatie.just.ro, DetaliiDocument/128647,
 * consolidarea din 27.04.2026, citită pe 8 oct 2026):
 *   · 24 ianuarie — „la 16-10-2016” (Legea 176/2016 rescrie alin. (1));
 *   · 1 iunie — „la 21-11-2016” (Legea 220/2016);
 *   · Vinerea Mare — „la 16-03-2018” (Legea 64/2018);
 *   · 6 și 7 ianuarie — „la 09-03-2023” (Legea 52/2023, MO 186/06.03.2023).
 * Datele Paștelui (2017: 16 aprilie, 2018: 8 aprilie) sunt scrise de mână.
 */
describe("sarbatoriAnului — lista se schimbă prin lege", () => {
  const are = (an: number, zi: string) => sarbatoriAnului(an).some((s) => iso(s.data) === zi);

  it("6 și 7 ianuarie lipsesc în 2022 și 2023, apar din 2024", () => {
    expect(are(2022, "2022-01-06")).toBe(false);
    expect(are(2022, "2022-01-07")).toBe(false);
    // Legea a intrat în vigoare în martie 2023: ianuarie 2023 era încă lucrător.
    expect(are(2023, "2023-01-06")).toBe(false);
    expect(are(2024, "2024-01-06")).toBe(true);
    expect(are(2024, "2024-01-07")).toBe(true);
  });

  it("Vinerea Mare apare din 2018, Ziua Copilului și 24 ianuarie din 2017", () => {
    expect(are(2017, "2017-04-14")).toBe(false);
    expect(are(2018, "2018-04-06")).toBe(true);
    expect(are(2016, "2016-06-01")).toBe(false);
    expect(are(2017, "2017-06-01")).toBe(true);
    expect(are(2016, "2016-01-24")).toBe(false);
    expect(are(2017, "2017-01-24")).toBe(true);
  });

  it.each([
    [2016, 12],
    [2017, 14],
    [2018, 15],
    [2022, 15],
    [2023, 15],
    [2024, 17],
  ])("în %i sunt %i sărbători", (an, numar) => {
    expect(sarbatoriAnului(an)).toHaveLength(numar);
  });

  it("obiectele întoarse nu poartă câmpul intern de intrare în vigoare", () => {
    const boboteaza = sarbatoriAnului(2026).find((s) => s.denumire === "Bobotează");
    expect(boboteaza !== undefined && Object.keys(boboteaza).sort()).toEqual([
      "data",
      "denumire",
      "tip",
    ]);
  });
});
```

În `src/domain/reges/evenimente.lacune.test.ts`, înlocuiește blocul de la liniile 45–53:

```ts
describe("sarbatoriLegale — aceeași listă ca în calendarul național", () => {
  // Două liste și două implementări ale Paștelui ortodox: REGES (+13 zile fix)
  // și `domain/calendar`. Ambele spun că oglindesc seed-ul `public_holidays`.
  // Azi coincid; testul păzește prima modificare făcută doar într-una din ele.
  it.each(Array.from({ length: 16 }, (_, i) => 2020 + i))("anul %i", (an) => {
    const reges = new Set(sarbatoriLegale(an));
    const calendar = new Set(sarbatoriAnului(an).map((s) => s.data.toISOString().slice(0, 10)));
    expect(reges).toEqual(calendar);
  });
```

cu:

```ts
describe("sarbatoriLegale — aceeași listă ca în calendarul național", () => {
  // Două liste și două implementări ale Paștelui ortodox: REGES (+13 zile fix)
  // și `domain/calendar`. Ambele spun că oglindesc seed-ul `public_holidays`.
  // Azi coincid; testul păzește prima modificare făcută doar într-una din ele.
  // De la 2016, nu de la 2020: altfel n-ar vedea regulile din 2016 (24 ianuarie,
  // 1 iunie) și din 2018 (Vinerea Mare), iar REGES are configurări valabile din 2018.
  it.each(Array.from({ length: 20 }, (_, i) => 2016 + i))("anul %i", (an) => {
    const reges = new Set(sarbatoriLegale(an));
    const calendar = new Set(sarbatoriAnului(an).map((s) => s.data.toISOString().slice(0, 10)));
    expect(reges).toEqual(calendar);
  });

  it("6 ianuarie 2023 era zi lucrătoare; 6 ianuarie 2025 nu mai e", () => {
    // 05.01.2023 joi + 1 → vineri 06.01.2023 (Legea 52/2023 abia din 09.03.2023).
    expect(deplaseazaZileLucratoare("2023-01-05", 1, construiesteCalendar(2023, 2023))).toBe(
      "2023-01-06",
    );
    // 03.01.2025 vineri + 1 → peste weekend, 6 și 7 ianuarie → miercuri 08.01.2025.
    expect(deplaseazaZileLucratoare("2025-01-03", 1, construiesteCalendar(2025, 2025))).toBe(
      "2025-01-08",
    );
  });
```

În `src/content/legal/zile-libere.test.ts`, înaintea testului de la linia 48 (`it("pagina spune numărul corect de sărbători …`), inserează:

```ts
  /**
   * 6 și 7 ianuarie sunt în art. 139 abia din 9 martie 2023 (Legea 52/2023).
   * Totalurile, numărate pe calendar: 2020 și 2022 au 251, 2021 are 254, 2023
   * are 248. Pagina foii de pontaj arăta 249, 252, 249 și 247 (auditul din 8 oct 2026).
   */
  it.each([
    [2020, 251],
    [2021, 254],
    [2022, 251],
    [2023, 248],
  ])("zile lucrătoare în %i: %i; sărbători: 15", (an, zile) => {
    const c = calendarulAnului(an);
    expect(c.zileLucratoare).toBe(zile);
    expect(c.sarbatori).toBe(15);
    expect(c.luni[0]?.zileLucratoare).toBe(20);
  });

```

Creează `src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { construiesteFoaie } from "./foaie";

/**
 * Foaia de pontaj pe anii pe care formularul îi acceptă (2020–2035).
 *
 * Auditul din 8 oct 2026: ianuarie 2022 ieșea „18 zile × 8 h = 144 h”, fiindcă
 * 6 și 7 ianuarie erau socotite sărbători și înainte de Legea 52/2023. Cifrele
 * de mai jos sunt numărate pe calendar, nu derivate din funcția testată.
 */
describe("zilele lucrătoare ale foii", () => {
  it.each([
    [2020, 20],
    [2021, 20],
    [2022, 20],
    [2023, 20],
    [2024, 20],
    [2026, 18],
  ])("zile lucrătoare în ianuarie %i: %i", (an, zile) => {
    expect(construiesteFoaie(an, 1, ["Popa Ion"], 8).zileLucratoare).toBe(zile);
  });

  it("ianuarie 2022: 160 h normă, iar 6 și 7 ianuarie sunt zile obișnuite", () => {
    const f = construiesteFoaie(2022, 1, ["Popa Ion"], 8);
    expect(f.normaLunara).toBe(160);
    expect(f.zile[5]?.sarbatoare).toBeNull(); // 6 ianuarie 2022, joi
    expect(f.zile[6]?.sarbatoare).toBeNull(); // 7 ianuarie 2022, vineri
  });

  it("din 2024, 6 și 7 ianuarie sunt sărbători", () => {
    const f = construiesteFoaie(2025, 1, ["Popa Ion"], 8);
    expect(f.zile[5]?.sarbatoare).toBe("Bobotează");
    expect(f.zile[6]?.sarbatoare).toBe("Soborul Sfântului Ioan Botezătorul");
  });
});
```

- [ ] **Pasul 2: Rulează testele și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/calendar/sarbatori.test.ts src/domain/reges/evenimente.lacune.test.ts src/content/legal/zile-libere.test.ts "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts"
```

Ce trebuie să pice:
- `zile lucrătoare în ianuarie 2020: 20` (expected 18 to be 20);
- `în 2022 sunt 15 sărbători` (got 17);
- `zile lucrătoare în 2020: 251; sărbători: 15` (expected 249 to be 251);
- `6 ianuarie 2023 era zi lucrătoare` (expected '2023-01-09' to be '2023-01-06').

Testul „obiectele întoarse nu poartă câmpul intern…” trece și înainte: e o pază pentru implementare, nu un test roșu. (Rulat la verificare, pe o copie a repo-ului: 17 teste roșii, exact cele de mai sus și rudele lor.)

Echivalența REGES pe 2016–2023 trece încă: ambele liste greșesc la fel.

- [ ] **Pasul 3: Implementarea minimă**

În `src/domain/calendar/sarbatori.ts`, înlocuiește tot blocul de la `function adaugaZile` (linia 13) până la sfârșitul lui `sarbatoriAnului` (linia 57), adică:

```ts
function adaugaZile(data: Date, zile: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + zile));
}

/**
 * Sărbătorile legale naționale (România) pentru anul dat: fixele din
 * Codul Muncii plus cele mobile, derivate din data Paștelui ortodox.
 *
 * Funcție PURĂ — reflectă exact lista din seed-ul `public_holidays`
 * (supabase/migrations/0009_leave.sql), fără acces la bază de date.
 */
export function sarbatoriAnului(an: number): readonly Sarbatoare[] {
  const paste = pasteOrtodox(an);

  const fixe: readonly Sarbatoare[] = [
```

… până la:

```ts
  return [...fixe, ...mobile].sort(
    (primul, alDoilea) => primul.data.getTime() - alDoilea.data.getTime(),
  );
}
```

cu:

```ts
/** O sărbătoare candidată, cu ziua din care e în lege, dacă a intrat din 2016 încoace. */
type Candidata = Sarbatoare & { readonly inVigoareDin?: string };

function adaugaZile(data: Date, zile: number): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() + zile));
}

/** `"2023-01-06"` — cheia comparată cu ziua intrării în vigoare. */
function ziIso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Ziua din care fiecare sărbătoare adăugată în 2016 sau după e în art. 139 alin. (1).
 *
 * Sursa: mențiunile „(la …)” din forma consolidată a Codului muncii pe
 * legislatie.just.ro (DetaliiDocument/128647, consolidarea din 27.04.2026,
 * descărcată cu curl pe 8 oct 2026):
 *   · 24 ianuarie — Legea nr. 176/2016, MO nr. 808 din 13.10.2016, „la 16-10-2016”
 *     (rescrie alin. (1) și introduce 24 ianuarie; DetaliiDocumentAfis/182520);
 *   · 1 iunie — Legea nr. 220/2016, MO nr. 931 din 18.11.2016, „la 21-11-2016”;
 *   · Vinerea Mare — Legea nr. 64/2018, MO nr. 226 din 13.03.2018, „la 16-03-2018”;
 *   · 6 și 7 ianuarie — Legea nr. 52/2023, MO nr. 186 din 06.03.2023, „la 09-03-2023”.
 *
 * Se compară ZIUA sărbătorii, nu anul: 6–7 ianuarie 2023 au căzut înaintea legii,
 * deci ianuarie 2023 are 20 de zile lucrătoare, nu 19. Până pe 8 oct 2026 lista
 * nu ținea cont de asta, iar foaia de pontaj greșea norma pe 2020–2023.
 *
 * Celelalte sărbători sunt în lista rescrisă la 16.10.2016, fără mențiune
 * ulterioară: lista e garantată din 2017 încolo, nu și înainte (30 noiembrie și
 * restul au intrat prin legi necitite aici).
 */
const IN_VIGOARE_DIN = {
  unireaPrincipatelor: "2016-10-16",
  ziuaCopilului: "2016-11-21",
  vinereaMare: "2018-03-16",
  bobotezaSiSfantulIoan: "2023-03-09",
} as const;

/**
 * Sărbătorile legale naționale (România) pentru anul dat: fixele din
 * Codul Muncii plus cele mobile, derivate din data Paștelui ortodox, fiecare
 * doar din ziua în care a intrat în lege.
 *
 * Funcție PURĂ. Pentru 2024–2040 reflectă exact lista din seed-ul
 * `public_holidays` (supabase/migrations/0009_leave.sql). Comentariul tabelei
 * din aceeași migrare dă 6–7 ianuarie „din 2016/2017” și e GREȘIT; migrarea e
 * aplicată, deci nu se editează — sursa corectă e aici și în NOTES.md.
 */
export function sarbatoriAnului(an: number): readonly Sarbatoare[] {
  const paste = pasteOrtodox(an);

  const fixe: readonly Candidata[] = [
    { data: new Date(Date.UTC(an, 0, 1)), denumire: "Anul Nou", tip: "fix" },
    { data: new Date(Date.UTC(an, 0, 2)), denumire: "A doua zi de Anul Nou", tip: "fix" },
    {
      data: new Date(Date.UTC(an, 0, 6)),
      denumire: "Bobotează",
      tip: "fix",
      inVigoareDin: IN_VIGOARE_DIN.bobotezaSiSfantulIoan,
    },
    {
      data: new Date(Date.UTC(an, 0, 7)),
      denumire: "Soborul Sfântului Ioan Botezătorul",
      tip: "fix",
      inVigoareDin: IN_VIGOARE_DIN.bobotezaSiSfantulIoan,
    },
    {
      data: new Date(Date.UTC(an, 0, 24)),
      denumire: "Unirea Principatelor Române",
      tip: "fix",
      inVigoareDin: IN_VIGOARE_DIN.unireaPrincipatelor,
    },
    { data: new Date(Date.UTC(an, 4, 1)), denumire: "Ziua Muncii", tip: "fix" },
    {
      data: new Date(Date.UTC(an, 5, 1)),
      denumire: "Ziua Copilului",
      tip: "fix",
      inVigoareDin: IN_VIGOARE_DIN.ziuaCopilului,
    },
    { data: new Date(Date.UTC(an, 7, 15)), denumire: "Adormirea Maicii Domnului", tip: "fix" },
    { data: new Date(Date.UTC(an, 10, 30)), denumire: "Sfântul Andrei", tip: "fix" },
    { data: new Date(Date.UTC(an, 11, 1)), denumire: "Ziua Națională a României", tip: "fix" },
    { data: new Date(Date.UTC(an, 11, 25)), denumire: "Crăciunul", tip: "fix" },
    { data: new Date(Date.UTC(an, 11, 26)), denumire: "A doua zi de Crăciun", tip: "fix" },
  ];

  const mobile: readonly Candidata[] = [
    {
      data: adaugaZile(paste, -2),
      denumire: "Vinerea Mare",
      tip: "mobil",
      inVigoareDin: IN_VIGOARE_DIN.vinereaMare,
    },
    { data: paste, denumire: "Paștele", tip: "mobil" },
    { data: adaugaZile(paste, 1), denumire: "A doua zi de Paște", tip: "mobil" },
    { data: adaugaZile(paste, 49), denumire: "Rusaliile", tip: "mobil" },
    { data: adaugaZile(paste, 50), denumire: "A doua zi de Rusalii", tip: "mobil" },
  ];

  return [...fixe, ...mobile]
    .filter((s) => s.inVigoareDin === undefined || ziIso(s.data) >= s.inVigoareDin)
    .map(({ data, denumire, tip }): Sarbatoare => ({ data, denumire, tip }))
    .sort((primul, alDoilea) => primul.data.getTime() - alDoilea.data.getTime());
}
```

În `src/domain/reges/evenimente.ts`, înlocuiește:

```ts
/**
 * Sărbătorile legale (art. 139 Codul muncii). Lista se schimbă prin lege —
 * DE CONFIRMAT anual cu juristul; zilele suplimentare se pot injecta din configurare.
 */
export function sarbatoriLegale(an: number): readonly ZiIso[] {
  const prefix = String(an).padStart(4, "0");
  const paste = pasteOrtodox(an);
  const mobile: readonly ZiIso[] = [
    adaugaZileCalendaristice(paste, -2), // Vinerea Mare
    paste,
    adaugaZileCalendaristice(paste, 1),
    adaugaZileCalendaristice(paste, 49), // Rusalii
    adaugaZileCalendaristice(paste, 50),
  ];
  return [...ZILE_FIXE.map((zi) => `${prefix}-${zi}`), ...mobile].sort();
}
```

cu:

```ts
/**
 * Ziua din care sărbătoarea e în art. 139 alin. (1): aceleași patru mențiuni din
 * forma consolidată ca în `src/domain/calendar/sarbatori.ts` (24 ianuarie din
 * 16.10.2016, 1 iunie din 21.11.2016, Vinerea Mare din 16.03.2018, 6–7 ianuarie
 * din 09.03.2023).
 * Scrise separat intenționat: `evenimente.lacune.test.ts` cere ca cele două
 * liste să coincidă an de an, 2016–2035.
 */
const FIXE_IN_VIGOARE_DIN: Readonly<Record<string, ZiIso>> = {
  "01-06": "2023-03-09",
  "01-07": "2023-03-09",
  "01-24": "2016-10-16",
  "06-01": "2016-11-21",
};
const VINEREA_MARE_DIN: ZiIso = "2018-03-16";

/**
 * Sărbătorile legale (art. 139 Codul muncii). Lista se schimbă prin lege —
 * DE CONFIRMAT anual cu juristul; zilele suplimentare se pot injecta din configurare.
 * Garantată din 2017 încolo (vezi `FIXE_IN_VIGOARE_DIN`).
 */
export function sarbatoriLegale(an: number): readonly ZiIso[] {
  const prefix = String(an).padStart(4, "0");
  const paste = pasteOrtodox(an);
  const vinereaMare = adaugaZileCalendaristice(paste, -2);
  const fixe = ZILE_FIXE.map((zi) => `${prefix}-${zi}`).filter(
    (zi) => zi >= (FIXE_IN_VIGOARE_DIN[zi.slice(5)] ?? ""),
  );
  const mobile: readonly ZiIso[] = [
    ...(vinereaMare >= VINEREA_MARE_DIN ? [vinereaMare] : []),
    paste,
    adaugaZileCalendaristice(paste, 1),
    adaugaZileCalendaristice(paste, 49), // Rusalii
    adaugaZileCalendaristice(paste, 50),
  ];
  return [...fixe, ...mobile].sort();
}
```

În `NOTES.md`, înlocuiește:

```
⚠️ Lista zilelor fixe și a celor mobile (offset față de **Paștele ortodox**, nu
cel catolic). Lista **s-a modificat prin lege** de mai multe ori: 6 și 7 ianuarie
au fost adăugate în 2016, Vinerea Mare în 2018. Se adaugă și zilele pentru
salariații aparținând altor culte religioase legale.
```

cu:

```
⚠️ Lista zilelor fixe și a celor mobile (offset față de **Paștele ortodox**, nu
cel catolic). Lista **s-a modificat prin lege** de mai multe ori. Datele din
mențiunile formei consolidate a Codului muncii (legislatie.just.ro, consolidarea
din 27.04.2026, citită pe 8 oct 2026): 24 ianuarie de la 16.10.2016 (Legea
176/2016, care rescrie alin. (1)), 1 iunie de la 21.11.2016 (Legea 220/2016),
Vinerea Mare de la 16.03.2018 (Legea 64/2018), 6 și 7 ianuarie de la 09.03.2023
(Legea 52/2023, MO 186/06.03.2023). `src/domain/calendar/sarbatori.ts` și
`src/domain/reges/evenimente.ts` aplică aceste date; seed-ul `public_holidays`
începe în 2024, deci nu e atins. Comentariul tabelei din `0009_leave.sql` („6 și
7 ianuarie … din 2016”) e greșit și rămâne așa: migrarea e aplicată. Se adaugă și
zilele pentru salariații aparținând altor culte religioase legale.
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/calendar src/domain/reges src/content/legal/zile-libere.test.ts src/content/landing "src/app/(marketing)/unelte" src/lib/reges
pnpm exec prettier --write src/domain/calendar/sarbatori.ts src/domain/calendar/sarbatori.test.ts src/domain/reges/evenimente.ts src/domain/reges/evenimente.lacune.test.ts src/content/legal/zile-libere.test.ts "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" NOTES.md
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

Totul verde. Testele existente pe 2024–2035 rămân neatinse (seed-ul și lista coincid).

- [ ] **Pasul 5: Verificare live pe staging (după push, după rularea `staging.yml`)**

```bash
gh run list --workflow staging.yml --limit 3   # rularea pentru HEAD: success, durată > 30 s
curl -s -u "coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)" 'https://staging.administrativo.ro/api/unelte/foaie-de-pontaj?an=2022&luna=1' -o "$SCRATCH/ian2022.xlsx"
unzip -p "$SCRATCH/ian2022.xlsx" xl/sharedStrings.xml | grep -o '20 zile lucrătoare × 8 h = 160 h normă'
```

Trebuie să iasă exact un rând. Înainte ieșea „18 zile lucrătoare × 8 h = 144 h normă”.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
git add -- "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts"
git status --short -- src/domain/calendar src/domain/reges src/content/legal/zile-libere.test.ts NOTES.md "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts"
git fetch origin main
git diff --name-only HEAD origin/main -- src/domain/calendar src/domain/reges NOTES.md
git commit --only -F - -- src/domain/calendar/sarbatori.ts src/domain/calendar/sarbatori.test.ts src/domain/reges/evenimente.ts src/domain/reges/evenimente.lacune.test.ts src/content/legal/zile-libere.test.ts NOTES.md "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" <<'EOF'
fix(calendar): 6 și 7 ianuarie sunt sărbători abia din 9 martie 2023

Lista din art. 139 alin. (1) se aplică din ziua intrării în vigoare a fiecărei
modificări (forma consolidată din 27.04.2026): 24 ianuarie din 16.10.2016,
1 iunie din 21.11.2016, Vinerea
Mare din 16.03.2018, 6–7 ianuarie din 09.03.2023 (Legea 52/2023). Foaia de
pontaj dădea 144 h în ianuarie 2022 în loc de 160 h, iar totalurile anuale pe
2020–2023 erau cu 1–2 zile mai mici. Aceeași regulă și în lista REGES; testul
de echivalență acoperă acum 2016–2035. Seed-ul public_holidays (2024+) nu e atins.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
node scripts/checks/lastmod.mjs
git push origin main
```

---

### Task B2: Un singur punct de curățare a textului; Word valid pentru orice intrare

**Fișiere:**
- Modify: `src/lib/unelte/document-tabelar.ts` (după `numeFisierSigur`, linia 89)
- Modify: `src/lib/unelte/raspuns.ts:3,25-26`
- Modify: `src/app/(marketing)/_componente/previzualizare-document.tsx:1,10-11`
- Modify: `package.json`, `pnpm-lock.yaml` (prin `pnpm add`)
- Test: `src/lib/unelte/randari.test.ts` (importuri + bloc nou); `src/app/(marketing)/_componente/previzualizare-document.test.tsx` (Create)

**Interfețe:**
- Consumă: `DocumentTabelar` (`./document-tabelar`), `randeazaDocx|Pdf|Xlsx(d: DocumentTabelar): Promise<Uint8Array>`.
- Produce:
  - `export function curataText(text: string): string`
  - `export function curataDocument(d: DocumentTabelar): DocumentTabelar`
  - `raspunsDocument(d, format)` păstrează semnătura și curăță intern.

- [ ] **Pasul 0: Dependența de test**

```bash
cd /srv/apps/ERP && pnpm add -D --save-exact saxes@5.0.1 && git diff --stat package.json pnpm-lock.yaml
```

Diff-ul trebuie să conțină doar intrarea `"saxes": "5.0.1"` în `devDependencies` și importer-ul din lockfile. Versiunea e deja rezolvată prin exceljs, deci nu se descarcă nimic nou.

- [ ] **Pasul 1: Scrie testele care pică**

În `src/lib/unelte/randari.test.ts`, înlocuiește liniile 1–9:

```ts
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { normalizeazaFormat, numeFisierSigur, type DocumentTabelar } from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { imparte, randeazaPdf, taie } from "./pdf";
import { raspunsDocument } from "./raspuns";
import { randeazaXlsx } from "./xlsx";
```

cu:

```ts
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { SaxesParser } from "saxes";
import { describe, expect, it } from "vitest";

import {
  curataDocument,
  curataText,
  normalizeazaFormat,
  numeFisierSigur,
  type DocumentTabelar,
} from "./document-tabelar";
import { randeazaDocx } from "./docx";
import { imparte, randeazaPdf, taie } from "./pdf";
import { raspunsDocument } from "./raspuns";
import { randeazaXlsx } from "./xlsx";
```

Adaugă la sfârșitul fișierului:

```ts
/**
 * Parserul XML strict pe care îl folosește și exceljs. Respinge orice caracter
 * din afara producției `Char` din XML 1.0, exact ca Word. `happy-dom` NU e o
 * poartă aici: acceptă U+000B fără nicio eroare (verificat pe 8 oct 2026).
 */
function eroriXml(xml: string): readonly string[] {
  const erori: string[] = [];
  const parser = new SaxesParser({ xmlns: true });
  parser.on("error", (eroare) => {
    erori.push(eroare.message);
  });
  parser.write(xml).close();
  return erori;
}

/** Text lipit din Word, PowerPoint sau un PDF: rândul manual U+000B, NUL, BOM. */
const MURDAR: DocumentTabelar = {
  ...DOC,
  titlu: "Condica\u000Bde prezență",
  subtitlu: "Firma\u000CSRL",
  campuri: [{ eticheta: "Angajat", valoare: "Popa\u0000Ion\u0001\u001F\u007F\u{FFFE}\u{FFFF}" }],
  paragrafe: [`Text\u0008 lipit${String.fromCodePoint(0x2028)}din Word`],
  randuri: [["01.10.2026", "Ana\u001FB", "\u{200B}"]],
  note: ["Notă\u{85}finală"],
  semnaturi: ["Întocmit\u0002"],
};

describe("caracterele de control (auditul din 8 oct 2026)", () => {
  it("curataText scoate ce rupe XML-ul și păstrează rândul nou și diacriticele", () => {
    expect(curataText("Popa\u0000Ion")).toBe("PopaIon");
    expect(curataText("Popa\u000BIon")).toBe("Popa Ion");
    expect(curataText("Popa\tIon")).toBe("Popa Ion");
    expect(curataText("a\r\nb\rc")).toBe("a\nb\nc");
    expect(curataText("\u{200B}\u{FEFF}")).toBe("");
    expect(curataText("x\u{FFFE}y\u{FFFF}")).toBe("xy");
    expect(curataText(`L${String.fromCodePoint(0x2028)}S`)).toBe("L S");
    expect(curataText(`orfan${String.fromCharCode(0xd800)}`)).toBe("orfan");
    expect(curataText("Ștefan Țepeș, Ână Îî\n1\nM")).toBe("Ștefan Țepeș, Ână Îî\n1\nM");
  });

  it("curataDocument atinge fiecare text al documentului", () => {
    const d = curataDocument(MURDAR);
    const toate = [
      d.titlu,
      d.subtitlu ?? "",
      ...d.campuri.flatMap((c) => [c.eticheta, c.valoare]),
      ...d.paragrafe,
      ...d.coloane.map((c) => c.eticheta),
      ...d.randuri.flat(),
      ...d.note,
      ...d.semnaturi,
    ].join("|");
    expect(toate).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u{FFFE}\u{FFFF}\u{200B}]/u);
    expect(d.titlu).toBe("Condica de prezență");
    expect(d.umbrite).toEqual(MURDAR.umbrite);
    expect(d.numeFisier).toBe(MURDAR.numeFisier);
  });

  it("controlul: fără curățare, același Word NU e XML valid (parserul chiar vede)", async () => {
    const zip = await JSZip.loadAsync(await randeazaDocx(MURDAR));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(eroriXml(xml).length).toBeGreaterThan(0);
  });

  it("Word-ul descărcat rămâne XML valid oricât de murdar e textul", async () => {
    const r = await raspunsDocument(MURDAR, "docx");
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    for (const parte of ["word/document.xml", "docProps/core.xml"]) {
      const xml = (await zip.file(parte)?.async("string")) ?? "";
      expect(xml, parte).not.toBe("");
      expect(eroriXml(xml), parte).toEqual([]);
    }
    const document = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(document).toContain("Condica de prezență");
    expect(document).toContain("PopaIon");
  });

  it("PDF-ul și Excelul ies și ele din același document", async () => {
    const pdf = await raspunsDocument(MURDAR, "pdf");
    expect((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount()).toBeGreaterThan(0);
    const xlsx = await JSZip.loadAsync(await (await raspunsDocument(MURDAR, "xlsx")).arrayBuffer());
    const siruri = (await xlsx.file("xl/sharedStrings.xml")?.async("string")) ?? "";
    expect(eroriXml(siruri)).toEqual([]);
  });
});
```

Creează `src/app/(marketing)/_componente/previzualizare-document.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocumentTabelar } from "@/lib/unelte/document-tabelar";

import { PrevizualizareDocument } from "./previzualizare-document";

const DOC: DocumentTabelar = {
  titlu: "Condica\u000Bde prezență",
  subtitlu: "Firma\u0000 SRL",
  campuri: [],
  paragrafe: [],
  coloane: [{ eticheta: "Nume", latime: 1 }],
  randuri: [["Ana\u001FB"]],
  umbrite: [],
  note: [],
  semnaturi: [],
  orientare: "portret",
  numeFisier: "condica",
};

/** Ce vede omul pe ecran e ce primește în fișier, inclusiv după curățare. */
describe("previzualizarea documentului", () => {
  it("arată textul curățat, ca fișierele", () => {
    const { container } = render(<PrevizualizareDocument document={DOC} />);
    expect(container.querySelector("figcaption")?.textContent).toContain("Condica de prezență");
    expect(container.textContent).toContain("Firma SRL");
    expect(container.textContent).toContain("AnaB");
    expect(container.textContent).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u);
  });
});
```

- [ ] **Pasul 2: Rulează testele și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte/randari.test.ts "src/app/(marketing)/_componente/previzualizare-document.test.tsx"
```

Ce trebuie să se vadă:
- `randari.test.ts`: patru teste noi roșii (`curataText is not a function`, `curataDocument is not a function`, apoi Word și PDF/Excel); controlul „fără curățare…” e VERDE încă de acum;
- testul de previzualizare cade pe `toContain("Condica de prezență")`: textul are U+000B.

- [ ] **Pasul 3: Implementarea minimă**

În `src/lib/unelte/document-tabelar.ts`, inserează după funcția `numeFisierSigur` (după linia 89, înainte de docblock-ul lui `EroareIntrare`):

```ts
/** CRLF și CR singur devin LF: singurul rând nou pe care îl înțeleg toate randările. */
const RAND_NOU = /\r\n?/gu;

/**
 * Caractere care, într-un text scris de om, înseamnă „aici e un spațiu”: tabul
 * (o celulă de Excel lipită), tabul vertical U+000B (rândul manual din Word,
 * Shift+Enter), form feed, NEL și separatorii Unicode de rând și de paragraf.
 */
const SPATIU_DE_CONTROL = /[\t\v\f\u{85}\u{2028}\u{2029}]/gu;

/**
 * Ce nu are voie într-un document XML 1.0 (producția `Char`: sub U+0020 doar
 * tab, LF și CR; nici U+FFFE, U+FFFF sau surogate orfane), plus caracterele
 * invizibile care fac dintr-un rând gol un „nume”: spațiile de lățime zero și
 * BOM-ul. C1 (U+0080–U+009F) e permis de XML, dar e mereu gunoi de codificare.
 */
const INTERZISE =
  /[\u0000-\u0008\u000E-\u001F\u007F-\u{84}\u{86}-\u{9F}\u{200B}-\u{200D}\u{2060}\u{FEFF}\u{FFFE}\u{FFFF}]|\p{Cs}/gu;

/**
 * Textul unui câmp, curățat de ce rupe un document.
 *
 * ── DE CE AICI, O DATĂ ────────────────────────────────────────────────────
 * Auditul din 8 oct 2026: un U+000B lipit din Word sau PowerPoint ajungea
 * neschimbat în `word/document.xml`, iar Word refuza fișierul („not
 * well-formed”), pe toate cele șase unelte, cu HTTP 200. exceljs scoate singur
 * controalele C0, dar lipește cuvintele („Condicade prezență”) și lasă U+FFFE și
 * U+FFFF, care rup `sharedStrings.xml` (verificat cu saxes pe 8 oct 2026); PDF-ul
 * punea spații. Curățarea stă AICI și se aplică
 * în `raspunsDocument` și în previzualizare, nu în cele cinci funcții `text()`
 * ale uneltelor, unde a șasea unealtă ar fi uitat-o.
 *
 * Păstrează `\n`: etichetele de coloană îl folosesc intenționat („1\nM”).
 */
export function curataText(text: string): string {
  return text.replace(RAND_NOU, "\n").replace(SPATIU_DE_CONTROL, " ").replace(INTERZISE, "");
}

/** Același document, cu fiecare text trecut prin `curataText`. Funcție pură. */
export function curataDocument(d: DocumentTabelar): DocumentTabelar {
  return {
    ...d,
    titlu: curataText(d.titlu),
    subtitlu: d.subtitlu === null ? null : curataText(d.subtitlu),
    campuri: d.campuri.map((c) => ({
      eticheta: curataText(c.eticheta),
      valoare: curataText(c.valoare),
    })),
    paragrafe: d.paragrafe.map((p) => curataText(p)),
    coloane: d.coloane.map((c) => ({ ...c, eticheta: curataText(c.eticheta) })),
    randuri: d.randuri.map((rand) => rand.map((celula) => curataText(celula))),
    note: d.note.map((n) => curataText(n)),
    semnaturi: d.semnaturi.map((s) => curataText(s)),
  };
}
```

În `src/lib/unelte/raspuns.ts`, înlocuiește:

```ts
import { numeFisierSigur, type DocumentTabelar, type Format } from "./document-tabelar";
```

cu:

```ts
import {
  curataDocument,
  numeFisierSigur,
  type DocumentTabelar,
  type Format,
} from "./document-tabelar";
```

și:

```ts
export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  const continut = await RANDARI[format](d);
```

cu:

```ts
export async function raspunsDocument(d: DocumentTabelar, format: Format): Promise<Response> {
  // Punctul unic de curățare pentru toate uneltele și toate formatele: vezi `curataText`.
  const continut = await RANDARI[format](curataDocument(d));
```

În `src/app/(marketing)/_componente/previzualizare-document.tsx`, înlocuiește:

```tsx
import { LINIE_GOALA, type DocumentTabelar } from "@/lib/unelte/document-tabelar";
```

cu:

```tsx
import { curataDocument, LINIE_GOALA, type DocumentTabelar } from "@/lib/unelte/document-tabelar";
```

și:

```tsx
export function PrevizualizareDocument({ document: d }: { document: DocumentTabelar }) {
  return (
```

cu:

```tsx
export function PrevizualizareDocument({ document: brut }: { document: DocumentTabelar }) {
  // Același text ca în fișiere: un U+000B lipit din Word se vede pe ecran ca
  // spațiu, la fel ca în PDF și în Word (vezi `curataText`).
  const d = curataDocument(brut);
  return (
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/lib/unelte "src/app/(marketing)/_componente/previzualizare-document.test.tsx" "src/app/api/unelte" "src/app/(marketing)/unelte"
pnpm exec prettier --write src/lib/unelte/document-tabelar.ts src/lib/unelte/raspuns.ts src/lib/unelte/randari.test.ts "src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/previzualizare-document.test.tsx" package.json
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

Testul „controlul: fără curățare…” TREBUIE să rămână verde: dovedește că saxes vede defectul. Dacă devine roșu, poarta e moartă.

- [ ] **Pasul 4b: Numele de fișier fără liniuță dublă** (adăugat de criticul de completitudine, 8 oct 2026; defect cosmetic, dar trivial, din auditul fișei de evaluare: `<script>` în nume dădea `fisa-evaluare--script-alert-1-script.pdf`). Cauza: uneltele compun `numeFisier` ca `"<unealtă>-" + nume`, iar `numeFisierSigur` transformă orice serie de caractere nepermise într-o liniuță, fără să le comaseze pe cele deja existente. În `src/lib/unelte/randari.test.ts`, lângă testele existente ale lui `numeFisierSigur` (importat deja la linia 5), adaugă:

```ts
  it("numeFisierSigur nu lasă liniuțe duble din compunerea „unealtă-” + nume", () => {
    expect(numeFisierSigur("fisa-evaluare-<script>alert(1)</script>")).toBe(
      "fisa-evaluare-script-alert-1-script",
    );
    expect(numeFisierSigur("pontaj--2026---10")).toBe("pontaj-2026-10");
  });
```

Rulează `pnpm exec vitest run src/lib/unelte/randari.test.ts -t "liniuțe duble"`: pică pe `fisa-evaluare--script…`. În `src/lib/unelte/document-tabelar.ts`, în `numeFisierSigur`, după `.replace(/[^a-zA-Z0-9-]+/gu, "-")` adaugă `.replace(/-{2,}/gu, "-")`. Rulează din nou: verde. Fișierele sunt deja în commitul lui B2.

- [ ] **Pasul 5: Verificare live pe staging (după push)**

Scrie `$SCRATCH/sonda-xml.mjs`:

```js
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire("/srv/apps/ERP/package.json");
const JSZip = require("jszip");
const { SaxesParser } = require("saxes");

const zip = await JSZip.loadAsync(readFileSync(process.argv[2]));
for (const parte of ["word/document.xml", "docProps/core.xml"]) {
  const xml = await zip.file(parte).async("string");
  const erori = [];
  const parser = new SaxesParser({ xmlns: true });
  parser.on("error", (e) => erori.push(e.message));
  parser.write(xml).close();
  console.log(parte, erori.length === 0 ? "VALID" : erori.slice(0, 3));
}
```

```bash
# Toate cele șase: cele cinci din registrul `[unealta]` plus foaia de pontaj (ruta ei
# proprie, care trece tot prin `raspunsDocument` la docx). `salariat` e pentru cerere.
for u in fisa-evaluare fisa-instruire-ssm foaie-de-parcurs condica-de-prezenta cerere-concediu foaie-de-pontaj; do
  curl -s -u "coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)" "https://staging.administrativo.ro/api/unelte/$u?format=docx&nume=A%01B%0BC&salariat=A%01B%0BC&sofer=%00%0B&firma=F%0CSRL&angajati=Popa%0BIon" -o "$SCRATCH/$u.docx"
  node "$SCRATCH/sonda-xml.mjs" "$SCRATCH/$u.docx"
done
```

Fiecare linie trebuie să spună `VALID`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
git add -- "src/app/(marketing)/_componente/previzualizare-document.test.tsx"
git status --short -- src/lib/unelte "src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/previzualizare-document.test.tsx" package.json pnpm-lock.yaml
git fetch origin main
git diff --name-only HEAD origin/main -- src/lib/unelte package.json pnpm-lock.yaml
git commit --only -F - -- src/lib/unelte/document-tabelar.ts src/lib/unelte/raspuns.ts src/lib/unelte/randari.test.ts "src/app/(marketing)/_componente/previzualizare-document.tsx" "src/app/(marketing)/_componente/previzualizare-document.test.tsx" package.json pnpm-lock.yaml <<'EOF'
fix(unelte): Word valid și cu caractere de control în text

Un U+000B (rândul manual din Word) sau orice caracter sub U+0020 ajungea în
word/document.xml, iar Word refuza fișierul, pe toate cele șase unelte.
curataText/curataDocument curăță o singură dată, în raspunsDocument și în
previzualizare. Testul parsează document.xml cu saxes (devDependency exactă,
deja în lockfile prin exceljs), cu o sondă de control care dovedește că
parserul vede defectul.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
node scripts/checks/lastmod.mjs
git push origin main
```

---

### Task B3: Numele se despart doar la rând nou

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts:1,78-95`
- Test: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts`

**Interfețe:**
- Consumă: `curataText(text: string): string` (`@/lib/unelte/document-tabelar`, din B2).
- Produce:
  ```ts
  export type ListaAngajati = Readonly<{ nume: readonly string[]; total: number; omisi: number; scurtate: number }>;
  export function citesteAngajati(brut: string | undefined): ListaAngajati;
  export function normalizeazaAngajati(brut: string | undefined): readonly string[]; // = citesteAngajati(brut).nume
  ```

- [ ] **Pasul 1: Scrie testele care pică**

În `foaie.test.ts`, înlocuiește linia de import:

```ts
import { construiesteFoaie } from "./foaie";
```

cu:

```ts
import { citesteAngajati, construiesteFoaie, normalizeazaAngajati } from "./foaie";
```

Adaugă la sfârșitul fișierului:

```ts
/**
 * Pagina spune „câte un nume pe rând”. Până pe 8 oct 2026, virgula și punctul
 * și virgula despărțeau și ele, deci „Popescu, Ion” ieșea pe două rânduri.
 */
describe("lista de angajați", () => {
  it("virgula și punctul și virgula fac parte din nume", () => {
    expect(normalizeazaAngajati("Popescu, Ion\nIonescu Maria; ing.")).toEqual([
      "Popescu, Ion",
      "Ionescu Maria; ing.",
    ]);
    expect(normalizeazaAngajati('&amp; "quote"')).toEqual(['&amp; "quote"']);
  });

  it("orice fel de rând nou desparte: LF, CRLF (trimis de formular), CR, rândul manual din Word", () => {
    expect(normalizeazaAngajati("A\r\nB\rC\u000BD")).toEqual(["A", "B", "C", "D"]);
    expect(normalizeazaAngajati(`E${String.fromCodePoint(0x2028)}F`)).toEqual(["E", "F"]);
  });

  it("tabul dintre două coloane lipite din Excel devine un spațiu", () => {
    expect(normalizeazaAngajati("Popa\tIon\nIlie \t Maria")).toEqual(["Popa Ion", "Ilie Maria"]);
  });

  it("rândurile cu doar spații invizibile nu sunt angajați (formularul trimite CRLF)", () => {
    const lista = citesteAngajati("A\r\n\u{A0}\u{A0}\r\n\u{200B}\r\n\t\r\nB");
    expect(lista.nume).toEqual(["A", "B"]);
    expect(lista.total).toBe(2);
  });

  it("o listă goală dă zece rânduri goale, de completat cu pixul", () => {
    const lista = citesteAngajati("\u{200B}\n  \n\t");
    expect(lista.total).toBe(0);
    expect(lista.omisi).toBe(0);
    expect(lista.nume).toHaveLength(10);
    expect(lista.nume.every((n) => n === "")).toBe(true);
  });

  it("numără ce a rămas pe dinafară peste 60", () => {
    const lista = citesteAngajati(
      Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n"),
    );
    expect(lista.nume).toHaveLength(60);
    expect(lista.nume.at(-1)).toBe("Om 60");
    expect(lista.total).toBe(70);
    expect(lista.omisi).toBe(10);
  });

  it("numără numele scurtate la 80 de caractere", () => {
    const lista = citesteAngajati(`${"a".repeat(81)}\nScurt`);
    expect(lista.scurtate).toBe(1);
    expect(lista.nume[0]).toHaveLength(80);
  });
});
```

- [ ] **Pasul 2: Rulează testele și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts"
```

Cad toate cele șapte teste noi, fiecare în parte (vitest nu cade la import pentru un export lipsă): primele trei pe aserțiune (`expected [ 'Popescu', 'Ion', …(2) ] to deeply equal [ 'Popescu, Ion', …(1) ]` ș.a.), celelalte patru cu `TypeError: citesteAngajati is not a function`. Verificat pe o copie a repo-ului.

- [ ] **Pasul 3: Implementarea minimă**

În `foaie.ts`, înlocuiește linia 1:

```ts
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
```

cu:

```ts
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
import { curataText } from "@/lib/unelte/document-tabelar";
```

Înlocuiește blocul de la liniile 78–95:

```ts
/**
 * Numele din câmpul de text, câte unul pe rând.
 *
 * Când lista e goală se întorc rânduri goale numerotate: foaia are rost și
 * necompletată — se tipărește și se scrie de mână, ceea ce e chiar felul în care
 * o va folosi jumătate dintre cei care o descarcă.
 */
export function normalizeazaAngajati(brut: string | undefined): readonly string[] {
  const linii = (brut ?? "")
    .split(/[\n,;]/)
    // Plafon și pe lungimea unui nume, nu doar pe numărul lor: un „nume” de mii de
    // caractere (un rând de Excel lipit cu tab-uri) costa secunde de CPU la PDF.
    .map((x) => x.trim().slice(0, MAX_LUNGIME_NUME))
    .filter((x) => x.length > 0)
    .slice(0, MAX_ANGAJATI);
  if (linii.length > 0) return linii;
  return Array.from({ length: 10 }, () => "");
}
```

cu:

```ts
export type ListaAngajati = Readonly<{
  /** Numele de pe foaie: cel mult `MAX_ANGAJATI`, fiecare cel mult `MAX_LUNGIME_NUME`. Gol ⇒ 10 rânduri goale. */
  nume: readonly string[];
  /** Câte nume nevide avea câmpul, înainte de plafon. */
  total: number;
  /** Câte nume au rămas pe dinafară din cauza plafonului de `MAX_ANGAJATI`. */
  omisi: number;
  /** Câte dintre numele păstrate au fost scurtate la `MAX_LUNGIME_NUME`. */
  scurtate: number;
}>;

/**
 * Despărțitorul dintre angajați: DOAR rândul nou.
 *
 * Până pe 8 oct 2026 despărțeau și virgula, și punctul și virgula. Pagina spune
 * „câte un nume pe rând”, dar „Popescu, Ion” ieșea ca doi angajați, iar „&amp;”
 * se rupea la „;” (auditul din 8 oct 2026). O coloană copiată din Excel vine
 * deja cu un nume pe rând. O listă scrisă cu virgule se rescrie o dată, pe când
 * un nume rupt în doi nu se vede până la semnătură. Tabul vertical (U+000B,
 * rândul manual din Word), NEL și separatorii Unicode sunt tot rând nou.
 */
const RAND_NOU_INTRE_NUME = /\r\n|[\n\r\v\f\u{85}\u{2028}\u{2029}]/u;

/**
 * Numele din câmpul de text, câte unul pe rând, plus ce s-a pierdut pe drum.
 *
 * Când lista e goală se întorc rânduri goale numerotate: foaia are rost și
 * necompletată — se tipărește și se scrie de mână, ceea ce e chiar felul în care
 * o va folosi jumătate dintre cei care o descarcă.
 */
export function citesteAngajati(brut: string | undefined): ListaAngajati {
  const toate = (brut ?? "")
    .split(RAND_NOU_INTRE_NUME)
    // `curataText` scoate spațiile de lățime zero (un rând care le conține doar
    // pe ele nu mai trece drept nume) și face din tab un spațiu: „Popa⇥Ion”,
    // două coloane din Excel, devine „Popa Ion”.
    .map((linie) => curataText(linie).replace(/\s+/gu, " ").trim())
    .filter((linie) => linie.length > 0);
  // Plafon și pe lungimea unui nume, nu doar pe numărul lor: un „nume” de mii de
  // caractere costa secunde de CPU la PDF.
  const pastrate = toate.slice(0, MAX_ANGAJATI);
  const nume = pastrate.map((linie) => linie.slice(0, MAX_LUNGIME_NUME));
  return {
    nume: nume.length > 0 ? nume : Array.from({ length: 10 }, () => ""),
    total: toate.length,
    omisi: toate.length - pastrate.length,
    scurtate: pastrate.filter((linie) => linie.length > MAX_LUNGIME_NUME).length,
  };
}

/** Doar numele de pe foaie; vezi `citesteAngajati`. */
export function normalizeazaAngajati(brut: string | undefined): readonly string[] {
  return citesteAngajati(brut).nume;
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte" src/lib/unelte "src/app/api/unelte"
pnpm exec prettier --write "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts"
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

Testele existente trec și ele: `foaie-document.test.ts` („tăiate la 80”) și `condica-de-prezenta/model.test.ts` („mărginită la intrare enormă”).

- [ ] **Commit**

```bash
cd /srv/apps/ERP
git status --short -- "src/app/(marketing)/unelte/foaie-de-pontaj"
git fetch origin main
git diff --name-only HEAD origin/main -- "src/app/(marketing)/unelte/foaie-de-pontaj"
git commit --only -F - -- "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" <<'EOF'
fix(unelte): numele angajaților se despart doar la rând nou

„Popescu, Ion” devenea doi angajați pe foaia de pontaj și în condică, deși
pagina spune „câte un nume pe rând”. Acum despart doar LF/CRLF/CR, rândul
manual din Word și separatorii Unicode; tabul devine spațiu, iar rândurile cu
doar spații invizibile nu mai trec drept nume. citesteAngajati numără și ce s-a
tăiat, pentru avizul din B4.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
node scripts/checks/lastmod.mjs
git push origin main
```

---

### Task B4: Peste 60 de nume — aviz pe pagină și notă în document

**Fișiere:**
- Create: `src/app/(marketing)/_componente/aviz-corectari.tsx`, `src/app/(marketing)/_componente/aviz-corectari.test.tsx`
- Create: `src/app/(marketing)/unelte/avize.test.tsx`, `src/app/api/unelte/foaie-de-pontaj/route.test.ts`
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts` (după `normalizeazaAngajati`, import `cuDe`)
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts:12,27`
- Modify: `src/app/api/unelte/foaie-de-pontaj/route.ts:4-10,62-68,167-173`
- Modify: `src/app/(marketing)/unelte/condica-de-prezenta/model.ts:3-8,21-37,39-44,72-75,82-85`
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx:10,18-27,72-74,170-171`
- Modify: `src/app/(marketing)/unelte/condica-de-prezenta/page.tsx:9,18,55-57,161-165`
- Modify: `scripts/checks/lastmod-fara-continut.txt` (commit separat)
- Test: `foaie.test.ts`, `condica-de-prezenta/model.test.ts`

**Interfețe:**
- Consumă: `ListaAngajati`, `citesteAngajati` (B3); `cuDe(n: number, substantiv: string): string` (`@/content/legal/zile-libere`).
- Produce:
  ```ts
  export function avizAngajati(lista: ListaAngajati): readonly string[];
  export function notaOmisi(lista: ListaAngajati): string | null;
  export function foaieCaDocument(foaie: Foaie, notaAngajati?: string | null): DocumentTabelar;
  export type ParametriCondica = Readonly<{ an: number; luna: number; angajati: readonly string[]; firma: string; notaAngajati: string | null }>;
  export function construiesteCondica(an: number, luna: number, angajati: readonly string[], firma: string, notaAngajati?: string | null): DocumentTabelar;
  export function AvizCorectari({ avize }: { avize: readonly string[] }): React.JSX.Element | null;
  ```

- [ ] **Pasul 1: Scrie testele care pică**

În `foaie.test.ts`, înlocuiește importul cu:

```ts
import {
  avizAngajati,
  citesteAngajati,
  construiesteFoaie,
  normalizeazaAngajati,
  notaOmisi,
} from "./foaie";
```

și adaugă la sfârșit:

```ts
describe("avizul și nota pentru lista tăiată", () => {
  const SAPTEZECI = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");

  it("pagina spune câți au rămas pe dinafară", () => {
    expect(avizAngajati(citesteAngajati(SAPTEZECI))).toEqual([
      "Am păstrat primii 60 din 70 de angajați. Pentru ceilalți 10, generează încă o foaie doar cu numele lor.",
    ]);
  });

  it("numele scurtate se spun și ele", () => {
    expect(avizAngajati(citesteAngajati(`${"a".repeat(81)}\nScurt`))).toEqual([
      "Un nume avea peste 80 de caractere și l-am scurtat.",
    ]);
    expect(avizAngajati(citesteAngajati(`${"a".repeat(81)}\n${"b".repeat(90)}`))).toEqual([
      "2 nume aveau peste 80 de caractere și le-am scurtat.",
    ]);
  });

  it("fișierul primește o notă, fiindcă circulă fără pagină", () => {
    expect(notaOmisi(citesteAngajati(SAPTEZECI))).toBe(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
    expect(notaOmisi(citesteAngajati("Popa Ion"))).toBeNull();
  });

  it("fără nimic tăiat, niciun aviz", () => {
    expect(avizAngajati(citesteAngajati("Popa Ion\nIlie Maria"))).toEqual([]);
  });
});
```

În `condica-de-prezenta/model.test.ts`, înaintea ultimului `});` al fișierului (după testul „condica e mărginită…”), adaugă:

```ts

  it("cu peste 60 de nume, documentul spune că lista e incompletă", () => {
    const q = new URLSearchParams({
      an: "2026",
      luna: "12",
      angajati: Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n"),
    });
    const d = condicaDinParametri(q);
    expect(d.note.at(-1)).toBe(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
  });

  it("fără tăiere, notele rămân cele două de dinainte", () => {
    expect(condicaDinParametri(new URLSearchParams({ angajati: "Popa Ion" })).note).toHaveLength(2);
  });
```

> ⚠ **Coliziune cu A5 (găsită de criticul de completitudine, 8 oct 2026).** A5 (valul 1, deci înaintea lui B4) CREEAZĂ și el `src/app/api/unelte/foaie-de-pontaj/route.test.ts`, cu `describe("ruta foii de pontaj")` și două teste de antet („Excel-ul cu nume iese cu cache-control private, no-store”, „PDF-ul trece prin răspunsul comun, cu același antet”). Dacă fișierul există (`test -f src/app/api/unelte/foaie-de-pontaj/route.test.ts`), **nu-l suprascrie cu `Write`**. Fișierul rezultat are importurile unite (`JSZip`, `NextRequest`, `describe/expect/it`, `GET`), un singur `cere`, funcțiile `parte` și `SAPTEZECI` de mai jos și un singur `describe("ruta foii de pontaj")`, cu cele două teste ale lui A5 urmate de cele patru de mai jos. La Pasul „vezi-le picând”, testele lui A5 rămân verzi. Fișierul intră în `CAI` ca „Modify”, nu ca fișier nou (`git add` nu mai e necesar, dar nu strică). E10 (secțiunea E) presupune exact forma asta: „teste adăugate în route.test.ts (B4/A5)”.

Creează (sau, dacă A5 l-a creat, completează ca mai sus) `src/app/api/unelte/foaie-de-pontaj/route.test.ts`:

```ts
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

const cere = (interogare: string) =>
  GET(new NextRequest(`http://localhost/api/unelte/foaie-de-pontaj?${interogare}`));

async function parte(r: Response, cale: string): Promise<string> {
  const zip = await JSZip.loadAsync(await r.arrayBuffer());
  return (await zip.file(cale)?.async("string")) ?? "";
}

const SAPTEZECI = encodeURIComponent(
  Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n"),
);

describe("ruta foii de pontaj", () => {
  it("Excelul spune că lista a fost tăiată la 60", async () => {
    const r = await cere(`an=2026&luna=12&angajati=${SAPTEZECI}`);
    expect(await parte(r, "xl/sharedStrings.xml")).toContain(
      "Documentul cuprinde primii 60 din 70 de angajați trimiși; ceilalți 10 nu apar aici.",
    );
  });

  it("Word-ul la fel", async () => {
    const r = await cere(`an=2026&luna=12&format=docx&angajati=${SAPTEZECI}`);
    expect(await parte(r, "word/document.xml")).toContain("ceilalți 10 nu apar aici");
  });

  it("fără tăiere, fără notă", async () => {
    const r = await cere("an=2026&luna=12&angajati=Popa%20Ion");
    expect(await parte(r, "xl/sharedStrings.xml")).not.toContain("nu apar aici");
  });

  it("Excelul foii (fără raspunsDocument) primește numele curățate de B3", async () => {
    // exceljs lasă U+FFFE, care rupe sharedStrings.xml, și lipește cuvintele la
    // U+000B. Excelul foii nu trece prin `raspunsDocument`; îl apără `citesteAngajati`.
    const siruri = await parte(
      await cere("an=2026&luna=12&angajati=Popa%EF%BF%BEIon%0AIlie%0BMaria"),
      "xl/sharedStrings.xml",
    );
    expect(siruri).toContain("PopaIon");
    expect(siruri).toContain("Ilie");
    expect(siruri).toContain("Maria");
    expect(siruri).not.toContain("\u{FFFE}");
  });
});
```

Creează `src/app/(marketing)/_componente/aviz-corectari.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvizCorectari } from "./aviz-corectari";

describe("avizul de corectare", () => {
  it("nu randează nimic fără avize", () => {
    const { container } = render(<AvizCorectari avize={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("anunță fiecare corectare și nu se tipărește", () => {
    render(<AvizCorectari avize={["Unu.", "Doi."]} />);
    const aviz = screen.getByRole("status");
    expect(aviz.getAttribute("data-tipar")).toBe("ascunde");
    expect([...aviz.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Unu.", "Doi."]);
  });
});
```

Creează `src/app/(marketing)/unelte/avize.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PaginaCondica from "./condica-de-prezenta/page";
import PaginaFoaie from "./foaie-de-pontaj/page";

const SAPTEZECI = Array.from({ length: 70 }, (_, i) => `Om ${String(i + 1)}`).join("\n");

/**
 * Textul avizului (`role="status"`) sau "" dacă lipsește.
 *
 * `querySelector`, nu `getByRole`: condica cu 60 de nume are 1.260 de rânduri,
 * iar `getByRole` calculează rolul accesibil al fiecărui nod. Măsurat la
 * verificarea planului (8 oct 2026): cu `getByRole`, testul condicii a căzut cu
 * „Test timed out in 5000ms” când rula în paralel cu restul `src/app/(marketing)`.
 */
function aviz(container: HTMLElement): string {
  return container.querySelector('[role="status"]')?.textContent ?? "";
}

/**
 * Pagina spune ce a schimbat din ce a primit. Înainte, cu 70 de nume, foaia
 * avea 60 de rânduri și niciun semn (auditul din 8 oct 2026).
 *
 * Plafonul de 20 s: o pagină cu 60 de nume randată în happy-dom a durat 1–8 s
 * sub încărcarea suitei complete.
 */
describe("avizele de pe paginile uneltelor", { timeout: 20_000 }, () => {
  it("foaia de pontaj spune că a păstrat 60 din 70", async () => {
    const { container } = render(
      await PaginaFoaie({
        searchParams: Promise.resolve({ an: "2026", luna: "12", angajati: SAPTEZECI }),
      }),
    );
    expect(aviz(container)).toContain("Am păstrat primii 60 din 70 de angajați");
  });

  it("condica la fel", async () => {
    const { container } = render(
      await PaginaCondica({
        searchParams: Promise.resolve({ an: "2026", luna: "12", angajati: SAPTEZECI }),
      }),
    );
    expect(aviz(container)).toContain("Am păstrat primii 60 din 70 de angajați");
  });

  it("fără nimic de corectat, niciun aviz", async () => {
    const { container } = render(
      await PaginaFoaie({
        searchParams: Promise.resolve({ an: "2026", luna: "12", angajati: "Popa Ion" }),
      }),
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
```

- [ ] **Pasul 2: Rulează testele și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte" "src/app/(marketing)/_componente/aviz-corectari.test.tsx" src/app/api/unelte/foaie-de-pontaj
```

Ce trebuie să pice:
- `foaie.test.ts`: `avizAngajati is not a function`;
- `aviz-corectari.test.tsx`: `Failed to resolve import "./aviz-corectari"`;
- `avize.test.tsx`: `expected '' to contain 'Am păstrat primii 60 din 70 de angajați'`;
- testul rutei: `expected … to contain "Documentul cuprinde…"`;
- testul rutei „Excelul foii … curățate de B3” e VERDE încă de acum (pază pentru B3, nu test roșu);
- testul condicii: `note.at(-1)` e „Zile scoase…”.

- [ ] **Pasul 3: Implementarea minimă**

**`foaie.ts`.** Înlocuiește:

```ts
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
import { curataText } from "@/lib/unelte/document-tabelar";
```

cu:

```ts
import { cuDe } from "@/content/legal/zile-libere";
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
import { curataText } from "@/lib/unelte/document-tabelar";
```

și inserează imediat după funcția `normalizeazaAngajati`:

```ts
/**
 * Ce s-a pierdut din listă, spus pe pagină. Plafonul de 60 rămâne (o adresă
 * mai lungă de ~8 KB cade la Cloudflare, iar 60 de nume înseamnă deja trei
 * pagini A4 culcate), dar nu mai e tăcut: cu 70 de nume, foaia avea 60 de
 * rânduri și nimic nu spunea asta (auditul din 8 oct 2026).
 */
export function avizAngajati(lista: ListaAngajati): readonly string[] {
  const avize: string[] = [];
  if (lista.omisi > 0) {
    avize.push(
      `Am păstrat primii ${String(MAX_ANGAJATI)} din ${cuDe(lista.total, "angajați")}. Pentru ceilalți ${String(lista.omisi)}, generează încă o foaie doar cu numele lor.`,
    );
  }
  if (lista.scurtate === 1) {
    avize.push(`Un nume avea peste ${cuDe(MAX_LUNGIME_NUME, "caractere")} și l-am scurtat.`);
  } else if (lista.scurtate > 1) {
    avize.push(
      `${cuDe(lista.scurtate, "nume")} aveau peste ${cuDe(MAX_LUNGIME_NUME, "caractere")} și le-am scurtat.`,
    );
  }
  return avize;
}

/** Nota din fișierul descărcat: fișierul circulă fără pagină, deci spune singur că lista e incompletă. */
export function notaOmisi(lista: ListaAngajati): string | null {
  if (lista.omisi === 0) return null;
  return `Documentul cuprinde primii ${String(MAX_ANGAJATI)} din ${cuDe(lista.total, "angajați")} trimiși; ceilalți ${String(lista.omisi)} nu apar aici.`;
}
```

(`cuDe(80, "caractere")` dă „80 de caractere”, `cuDe(2, "nume")` dă „2 nume”, `cuDe(70, "angajați")` dă „70 de angajați”.)

**`foaie-document.ts`.** Înlocuiește `export function foaieCaDocument(foaie: Foaie): DocumentTabelar {` cu:

```ts
export function foaieCaDocument(foaie: Foaie, notaAngajati: string | null = null): DocumentTabelar {
```

și `    note: [\`Sărbători legale în lună: ${listaSarbatori === "" ? "niciuna" : listaSarbatori}\`],` cu:

```ts
    note: [
      `Sărbători legale în lună: ${listaSarbatori === "" ? "niciuna" : listaSarbatori}`,
      ...(notaAngajati === null ? [] : [notaAngajati]),
    ],
```

**`route.ts` (foaia de pontaj).** Înlocuiește importul:

```ts
import {
  construiesteFoaie,
  normalizeazaAn,
  normalizeazaAngajati,
  normalizeazaLuna,
  normalizeazaOre,
} from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie";
```

cu:

```ts
import {
  citesteAngajati,
  construiesteFoaie,
  normalizeazaAn,
  normalizeazaLuna,
  normalizeazaOre,
  notaOmisi,
} from "@/app/(marketing)/unelte/foaie-de-pontaj/foaie";
```

Înlocuiește:

```ts
  const angajati = normalizeazaAngajati(q.get("angajati") ?? undefined);
  const foaie = construiesteFoaie(an, luna, angajati, oreZi);

  const format = normalizeazaFormatFoaie(q.get("format"));
  if (format !== "xlsx") {
    return raspunsDocument({ ...foaieCaDocument(foaie), sursa: "/unelte/foaie-de-pontaj" }, format);
  }
```

cu:

```ts
  const lista = citesteAngajati(q.get("angajati") ?? undefined);
  const foaie = construiesteFoaie(an, luna, lista.nume, oreZi);
  const nota = notaOmisi(lista);

  const format = normalizeazaFormatFoaie(q.get("format"));
  if (format !== "xlsx") {
    return raspunsDocument(
      { ...foaieCaDocument(foaie, nota), sursa: "/unelte/foaie-de-pontaj" },
      format,
    );
  }
```

și:

```ts
        .join("; ") || "niciuna"),
  ]);
  // Rândul de jos duce înapoi la unealtă, ca în celelalte fișiere (auditul din 7 oct 2026).
```

cu:

```ts
        .join("; ") || "niciuna"),
  ]);
  if (nota !== null) fila.addRow([nota]);
  // Rândul de jos duce înapoi la unealtă, ca în celelalte fișiere (auditul din 7 oct 2026).
```

**`condica-de-prezenta/model.ts`.** Înlocuiește importul de la liniile 3–8:

```ts
import {
  construiesteFoaie,
  normalizeazaAn,
  normalizeazaAngajati,
  normalizeazaLuna,
} from "../foaie-de-pontaj/foaie";
```

cu:

```ts
import {
  citesteAngajati,
  construiesteFoaie,
  normalizeazaAn,
  normalizeazaLuna,
  notaOmisi,
} from "../foaie-de-pontaj/foaie";
```

Înlocuiește liniile 21–37 (tipul și `parametriCondica`):

```ts
export type ParametriCondica = Readonly<{
  an: number;
  luna: number;
  angajati: readonly string[];
  firma: string;
}>;

/** Intrările din adresă, normalizate cu aceleași limite ca foaia de pontaj. */
export function parametriCondica(q: URLSearchParams): ParametriCondica {
  const acum = new Date();
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    angajati: normalizeazaAngajati(q.get("angajati") ?? undefined),
    firma: (q.get("firma") ?? "").trim().slice(0, 120),
  };
}
```

cu:

```ts
export type ParametriCondica = Readonly<{
  an: number;
  luna: number;
  angajati: readonly string[];
  firma: string;
  /** Nota pentru document când lista a trecut de 60 de nume; `null` altfel. */
  notaAngajati: string | null;
}>;

/** Intrările din adresă, normalizate cu aceleași limite ca foaia de pontaj. */
export function parametriCondica(q: URLSearchParams): ParametriCondica {
  const acum = new Date();
  const lista = citesteAngajati(q.get("angajati") ?? undefined);
  return {
    an: normalizeazaAn(q.get("an") ?? undefined, acum.getUTCFullYear()),
    luna: normalizeazaLuna(q.get("luna") ?? undefined, acum.getUTCMonth() + 1),
    angajati: lista.nume,
    firma: (q.get("firma") ?? "").trim().slice(0, 120),
    notaAngajati: notaOmisi(lista),
  };
}
```

Înlocuiește semnătura:

```ts
export function construiesteCondica(
  an: number,
  luna: number,
  angajati: readonly string[],
  firma: string,
): DocumentTabelar {
```

cu:

```ts
export function construiesteCondica(
  an: number,
  luna: number,
  angajati: readonly string[],
  firma: string,
  notaAngajati: string | null = null,
): DocumentTabelar {
```

Înlocuiește:

```ts
      `Zile scoase (weekend și sărbători legale): ${String(foaie.zile.length - lucratoare.length)}.`,
    ],
```

cu:

```ts
      `Zile scoase (weekend și sărbători legale): ${String(foaie.zile.length - lucratoare.length)}.`,
      ...(notaAngajati === null ? [] : [notaAngajati]),
    ],
```

și:

```ts
  return construiesteCondica(p.an, p.luna, p.angajati, p.firma);
```

cu:

```ts
  return construiesteCondica(p.an, p.luna, p.angajati, p.firma, p.notaAngajati);
```

**Creează `src/app/(marketing)/_componente/aviz-corectari.tsx`:**

```tsx
/**
 * Ce a schimbat unealta din ce a primit, spus pe pagină.
 *
 * Uneltele normalizează intrarea în loc s-o refuze: o adresă construită de mână,
 * un link vechi sau o listă lipită din Excel dau tot un document. Fără aviz însă,
 * omul primea altceva decât ceruse fără niciun semn — foaia pentru altă lună sau
 * 60 de angajați din 70 (auditul din 8 oct 2026).
 *
 * `role="status"`: cititorul de ecran îl anunță fără să întrerupă. Nu se tipărește.
 */
export function AvizCorectari({ avize }: { avize: readonly string[] }) {
  if (avize.length === 0) return null;
  return (
    <div
      role="status"
      data-tipar="ascunde"
      className="border-mk-rigla bg-mk-sl-hartie mt-6 border p-4 text-[0.9375rem] leading-[1.6]"
    >
      <p className="font-medium">Am ajustat ce ai trimis:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {avize.map((aviz) => (
          <li key={aviz}>{aviz}</li>
        ))}
      </ul>
    </div>
  );
}
```

**`foaie-de-pontaj/page.tsx`.** Înlocuiește:

```tsx
import { AntetSecundar } from "../../_componente/antet-secundar";
```

cu:

```tsx
import { AntetSecundar } from "../../_componente/antet-secundar";
import { AvizCorectari } from "../../_componente/aviz-corectari";
```

Înlocuiește importul din `./foaie`:

```tsx
import {
  construiesteFoaie,
  LUNI,
  normalizeazaAn,
  normalizeazaAngajati,
  normalizeazaLuna,
  normalizeazaOre,
  AN_MAX,
  AN_MIN,
} from "./foaie";
```

cu:

```tsx
import {
  avizAngajati,
  citesteAngajati,
  construiesteFoaie,
  LUNI,
  normalizeazaAn,
  normalizeazaLuna,
  normalizeazaOre,
  AN_MAX,
  AN_MIN,
} from "./foaie";
```

Înlocuiește:

```tsx
  const brutAngajati = unul(p.angajati) ?? "";
  const angajati = normalizeazaAngajati(brutAngajati);
  const foaie = construiesteFoaie(an, luna, angajati, oreZi);
```

cu:

```tsx
  const brutAngajati = unul(p.angajati) ?? "";
  const lista = citesteAngajati(brutAngajati);
  const foaie = construiesteFoaie(an, luna, lista.nume, oreZi);
```

Înlocuiește:

```tsx
            normă
          </p>
        </div>
      </Banda>
```

cu:

```tsx
            normă
          </p>
        </div>
        <AvizCorectari avize={avizAngajati(lista)} />
      </Banda>
```

**`condica-de-prezenta/page.tsx`.** Înlocuiește `import { AntetSecundar } from "../../_componente/antet-secundar";` cu cele două linii de mai sus (AntetSecundar + AvizCorectari). Înlocuiește:

```tsx
import { AN_MAX, AN_MIN, LUNI } from "../foaie-de-pontaj/foaie";
```

cu:

```tsx
import { AN_MAX, AN_MIN, avizAngajati, citesteAngajati, LUNI } from "../foaie-de-pontaj/foaie";
```

Înlocuiește:

```tsx
  const ales = parametriCondica(q);
  const document = construiesteCondica(ales.an, ales.luna, ales.angajati, ales.firma);
  const brutAngajati = unul(p.angajati) ?? "";
```

cu:

```tsx
  const ales = parametriCondica(q);
  const document = construiesteCondica(
    ales.an,
    ales.luna,
    ales.angajati,
    ales.firma,
    ales.notaAngajati,
  );
  const brutAngajati = unul(p.angajati) ?? "";
  const avize = avizAngajati(citesteAngajati(q.get("angajati") ?? undefined));
```

Înlocuiește:

```tsx
            eveniment="condica"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
      </Banda>
```

cu:

```tsx
            eveniment="condica"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
        <AvizCorectari avize={avize} />
      </Banda>
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte" "src/app/(marketing)/_componente" src/app/api/unelte src/lib/unelte
pnpm exec prettier --write "src/app/(marketing)/_componente/aviz-corectari.tsx" "src/app/(marketing)/_componente/aviz-corectari.test.tsx" "src/app/(marketing)/unelte/avize.test.tsx" src/app/api/unelte/foaie-de-pontaj/route.ts src/app/api/unelte/foaie-de-pontaj/route.test.ts "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx" "src/app/(marketing)/unelte/condica-de-prezenta/model.ts" "src/app/(marketing)/unelte/condica-de-prezenta/model.test.ts" "src/app/(marketing)/unelte/condica-de-prezenta/page.tsx"
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

- [ ] **Pasul 5: Verificare live pe staging (după push)**

```bash
N=$(node -e 'console.log(encodeURIComponent(Array.from({length:70},(_,i)=>`Om ${i+1}`).join("\n")))')
curl -s -u "coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)" "https://staging.administrativo.ro/unelte/foaie-de-pontaj?an=2026&luna=12&angajati=$N" | grep -o 'Am păstrat primii 60 din 70 de angajați'
curl -s -u "coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)" "https://staging.administrativo.ro/api/unelte/condica-de-prezenta?an=2026&luna=12&format=docx&angajati=$N" -o "$SCRATCH/c70.docx"
unzip -p "$SCRATCH/c70.docx" word/document.xml | grep -o 'ceilalți 10 nu apar aici'
```

Prima comandă trebuie să scoată cel puțin un rând (de obicei două: o dată în HTML și o dată în datele RSC din `self.__next_f`; măsurat pe producție la verificare, un text din pagină apare de 2 ori la `grep -o`, iar `grep -c` dă 1, fiindcă HTML-ul are câteva linii foarte lungi). A doua scoate exact un rând.

- [ ] **Commit (două commituri, un push)**

```bash
cd /srv/apps/ERP
git add -- "src/app/(marketing)/_componente/aviz-corectari.tsx" "src/app/(marketing)/_componente/aviz-corectari.test.tsx" "src/app/(marketing)/unelte/avize.test.tsx" src/app/api/unelte/foaie-de-pontaj/route.test.ts
CAI=("src/app/(marketing)/_componente/aviz-corectari.tsx" "src/app/(marketing)/_componente/aviz-corectari.test.tsx" "src/app/(marketing)/unelte/avize.test.tsx" src/app/api/unelte/foaie-de-pontaj/route.ts src/app/api/unelte/foaie-de-pontaj/route.test.ts "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx" "src/app/(marketing)/unelte/condica-de-prezenta/model.ts" "src/app/(marketing)/unelte/condica-de-prezenta/model.test.ts" "src/app/(marketing)/unelte/condica-de-prezenta/page.tsx")
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
fix(unelte): peste 60 de nume, pagina și fișierul spun ce s-a tăiat

Cu 70 de nume, foaia de pontaj și condica aveau 60 de rânduri fără niciun
semn. Pagina arată acum „Am păstrat primii 60 din 70 de angajați…” (AvizCorectari,
role=status, nu se tipărește), iar PDF-ul, Word-ul și Excelul primesc o notă,
fiindcă fișierul circulă fără pagină. Numele scurtate la 80 de caractere se
spun și ele.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
SHA=$(git rev-parse --short=7 HEAD)
tail -c1 scripts/checks/lastmod-fara-continut.txt | od -An -c   # trebuie să afișeze \n
printf '%s aviz de listă tăiată pe foaie și condică — apare doar peste 60 de nume; textul implicit al paginilor neschimbat\n' "$SHA" >> scripts/checks/lastmod-fara-continut.txt
git commit --only -m "chore(lastmod): $SHA nu schimbă textul implicit al paginilor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- scripts/checks/lastmod-fara-continut.txt
git merge origin/main
node scripts/checks/lastmod.mjs
git push origin main
```

---

### Task B5: Antetul, subsolul, bara de cookie-uri și Banda nu se tipăresc

**Fișiere:**
- Modify: `src/app/(marketing)/_componente/banda.tsx:20-46`
- Modify: `src/app/(marketing)/_componente/antet.tsx:20`
- Modify: `src/app/(marketing)/_componente/subsol.tsx:14`
- Modify: `src/app/(marketing)/_componente/bara-consimtamant.tsx:70-74`
- Test: `src/app/(marketing)/_componente/tipar.test.tsx` (Create)

**Interfețe:**
- Consumă: `RO` (`@/content/landing/ro`), `Cadru({ text, children })`, `BaraConsimtamant()`.
- Produce: `Banda` primește prop nou `"data-tipar"?: "ascunde"`, pus pe `<section>`. Restul semnăturii rămâne neschimbat.

- [ ] **Pasul 1: Scrie testul care pică**

Creează `src/app/(marketing)/_componente/tipar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RO } from "@/content/landing/ro";

import { Banda } from "./banda";
import { BaraConsimtamant } from "./bara-consimtamant";
import { Cadru } from "./cadru";

/**
 * Pe 8 oct 2026, foaia de pontaj tipărită din browser ieșea pe 5 pagini A4, cu
 * meniul, bara de cookie-uri și subsolul. Regula `[data-tipar="ascunde"]` exista
 * în globals.css, dar n-o purta niciuna dintre bucățile astea.
 */
describe("tipărirea paginilor publice", () => {
  it("antetul și subsolul cadrului nu se tipăresc; conținutul da", () => {
    const { container } = render(
      <Cadru text={RO}>
        <p>documentul</p>
      </Cadru>,
    );
    expect(container.querySelector("header")?.getAttribute("data-tipar")).toBe("ascunde");
    expect(container.querySelector("footer")?.getAttribute("data-tipar")).toBe("ascunde");
    expect(container.querySelector("main")?.closest('[data-tipar="ascunde"]')).toBeNull();
  });

  it("Banda pune marcajul pe <section>, și doar când e cerut", () => {
    const { container } = render(
      <>
        <Banda id="ascunsa" titlu="De ce" data-tipar="ascunde" />
        <Banda id="documentul" />
      </>,
    );
    expect(container.querySelector("#ascunsa")?.getAttribute("data-tipar")).toBe("ascunde");
    expect(container.querySelector("#documentul")?.hasAttribute("data-tipar")).toBe(false);
  });

  it("bara de cookie-uri nu se tipărește", async () => {
    localStorage.clear();
    render(<BaraConsimtamant />);
    const bara = await screen.findByRole("region", { name: "Cookie-uri de analiză" });
    expect(bara.getAttribute("data-tipar")).toBe("ascunde");
  });
});
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/_componente/tipar.test.tsx"
```

Toate trei pică, fiecare cu `expected null to be 'ascunde'`.

- [ ] **Pasul 3: Implementarea minimă**

**`banda.tsx`.** Înlocuiește:

```tsx
export function Banda({
  id,
  fundal = "hartie",
  inaltime = "medie",
  supratitlu,
  titlu,
  lead,
  aliniereTitlu = "stanga",
  children,
}: {
  id?: string;
  fundal?: Fundal;
  inaltime?: Inaltime;
  supratitlu?: string;
  titlu?: string;
  lead?: string;
  aliniereTitlu?: "stanga" | "larg";
  children?: ReactNode;
}) {
  const cerneala = fundal === "cerneala";
  return (
    <section
      id={id}
```

cu:

```tsx
export function Banda({
  id,
  fundal = "hartie",
  inaltime = "medie",
  supratitlu,
  titlu,
  lead,
  aliniereTitlu = "stanga",
  "data-tipar": tipar,
  children,
}: {
  id?: string;
  fundal?: Fundal;
  inaltime?: Inaltime;
  supratitlu?: string;
  titlu?: string;
  lead?: string;
  aliniereTitlu?: "stanga" | "larg";
  /**
   * Convenția de tipărire a proiectului (globals.css, `@media print`). Până pe
   * 8 oct 2026, `Banda` nu-l transmitea: `<Banda data-tipar="ascunde">` compila
   * (atributele cu cratimă nu se verifică pe componente) și nu făcea nimic.
   */
  "data-tipar"?: "ascunde";
  children?: ReactNode;
}) {
  const cerneala = fundal === "cerneala";
  return (
    <section
      id={id}
      data-tipar={tipar}
```

**`antet.tsx`.** Înlocuiește:

```tsx
    <header className="border-mk-rigla bg-mk-hartie/95 sticky top-0 z-40 border-b backdrop-blur">
```

cu:

```tsx
    <header
      data-tipar="ascunde"
      className="border-mk-rigla bg-mk-hartie/95 sticky top-0 z-40 border-b backdrop-blur"
    >
```

**`subsol.tsx`.** Înlocuiește:

```tsx
    <footer className="mk-cerneala bg-mk-cerneala text-mk-text-inv">
```

cu:

```tsx
    <footer data-tipar="ascunde" className="mk-cerneala bg-mk-cerneala text-mk-text-inv">
```

**`bara-consimtamant.tsx`.** Înlocuiește:

```tsx
    <div
      role="region"
      aria-label="Cookie-uri de analiză"
      className=
```

cu:

```tsx
    <div
      role="region"
      aria-label="Cookie-uri de analiză"
      data-tipar="ascunde"
      className=
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)"
pnpm exec prettier --write "src/app/(marketing)/_componente/banda.tsx" "src/app/(marketing)/_componente/antet.tsx" "src/app/(marketing)/_componente/subsol.tsx" "src/app/(marketing)/_componente/bara-consimtamant.tsx" "src/app/(marketing)/_componente/tipar.test.tsx"
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

Aceste componente nu sunt `page.tsx`, deci `lastmod` nu e afectat.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
git add -- "src/app/(marketing)/_componente/tipar.test.tsx"
CAI=("src/app/(marketing)/_componente/banda.tsx" "src/app/(marketing)/_componente/antet.tsx" "src/app/(marketing)/_componente/subsol.tsx" "src/app/(marketing)/_componente/bara-consimtamant.tsx" "src/app/(marketing)/_componente/tipar.test.tsx")
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
fix(marketing): antetul, subsolul și bara de cookie-uri nu se mai tipăresc

Regula @media print [data-tipar="ascunde"] exista, dar n-o purta nimic din
cadrul public: foaia de pontaj tipărită ieșea pe 5 pagini cu meniul și subsolul.
Banda transmite acum data-tipar pe <section> (înainte îl înghițea).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
node scripts/checks/lastmod.mjs
git push origin main
```

---

### Task B6: Pe paginile uneltelor, la tipar rămâne doar documentul, pe A4 culcat unde e cazul

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx:99,174`
- Modify: `src/app/(marketing)/unelte/{condica-de-prezenta,foaie-de-parcurs,fisa-instruire-ssm,fisa-evaluare,cerere-concediu-de-odihna}/page.tsx`: banda formularului (liniile 99/110/114/110/146); la cerere și comentariul de la 353–354
- Modify: `src/app/(marketing)/_componente/previzualizare-document.tsx` (`<figure className="mk-foaie">`)
- Modify: `src/app/globals.css:1106-1108`
- Create: `src/app/(marketing)/unelte/tipar.test.tsx`, `e2e/unelte-tipar.spec.ts`
- Modify: `scripts/checks/lastmod-fara-continut.txt` (commit separat)

**Interfețe:**
- Consumă: `Banda` cu `"data-tipar"` (B5); paginile ca funcții `async ({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => JSX.Element`.
- Produce: atributul `data-tipar-pagina="peisaj"` (contract cu CSS-ul `@page peisaj`).

- [ ] **Pasul 0: Linia de bază pe producție (doar citire)**

Scrie `$SCRATCH/sonda-tipar.mjs`:

```js
import { createRequire } from "node:module";
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";

const require = createRequire("/srv/apps/ERP/package.json");
const { PDFDocument } = require("pdf-lib");

const baza = process.argv[2] ?? "http://127.0.0.1:3917";
const nume = (n) =>
  encodeURIComponent(Array.from({ length: n }, (_, i) => `Angajat Numărul ${i + 1}`).join("\n"));
const PAGINI = [
  ["foaie-10", `/unelte/foaie-de-pontaj?luna=5&an=2027&angajati=${nume(10)}`],
  ["foaie-60", `/unelte/foaie-de-pontaj?luna=5&an=2027&angajati=${nume(60)}`],
  ["cerere", "/unelte/cerere-concediu-de-odihna?salariat=Popa%20Ion&de_la=2026-11-16&pana_la=2026-11-20"],
  ["condica", `/unelte/condica-de-prezenta?luna=5&an=2027&angajati=${nume(1)}`],
  ["parcurs", "/unelte/foaie-de-parcurs?luna=5&an=2027"],
  ["ssm", "/unelte/fisa-instruire-ssm"],
  ["evaluare", "/unelte/fisa-evaluare"],
];
const browser = await chromium.launch({
  executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
});
for (const [eticheta, cale] of PAGINI) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  // "load", nu "networkidle": la verificarea planului, fișa de evaluare de pe
  // producție n-a ajuns la networkidle în 30 s la prima rulare (analiticele țin
  // conexiuni deschise). Pauza lasă hidratarea să monteze bara de cookie-uri.
  await page.goto(baza + cale, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.emulateMedia({ media: "print" });
  const vizibile = await page.evaluate(() =>
    [...document.querySelectorAll("section, header, footer, [role=region]")]
      .filter((e) => e.getClientRects().length > 0)
      .filter((e) => e.id === "documentul" || e.closest("#documentul") === null)
      .map((e) => e.id || e.tagName.toLowerCase()),
  );
  const pdf = await PDFDocument.load(await page.pdf({ format: "A4", preferCSSPageSize: true }));
  const foi = pdf.getPages().map((p) => (p.getWidth() > p.getHeight() ? "culcat" : "portret"));
  console.log(eticheta, "| la tipar:", vizibile.join(","), "| pagini:", pdf.getPageCount(), foi.join(" "));
  await page.close();
}
await browser.close();
```

```bash
timeout 300 node "$SCRATCH/sonda-tipar.mjs" https://administrativo.ro | tee "$SCRATCH/tipar-inainte.txt"
```

Așteptat înainte de reparație (rulat la verificarea planului, 8 oct 2026, pe producție):

```
foaie-10 | la tipar: div,header,section,documentul,section,header,footer | pagini: 3 portret portret portret
foaie-60 | la tipar: div,header,section,documentul,section,header,footer | pagini: 7 portret …
cerere   | la tipar: div,header,section,documentul,footer | pagini: 3 portret portret portret
condica  | … | pagini: 3 portret ·  parcurs | … | 4 portret ·  ssm | … | 5 portret ·  evaluare | … | 3 portret
```

`div` e bara de cookie-uri (`[role=region]` fără id): pe producție hidratarea se termină, deci bara apare. Cifrele de 5 și 3 pagini din auditul de dimineață erau măsurate cu A4 forțat culcat; sonda de aici lasă CSS-ul să decidă (`preferCSSPageSize`), deci dă portret.

- [ ] **Pasul 1: Scrie testul care pică**

Creează `src/app/(marketing)/unelte/tipar.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PaginaCerere from "./cerere-concediu-de-odihna/page";
import PaginaCondica from "./condica-de-prezenta/page";
import PaginaFisaEvaluare from "./fisa-evaluare/page";
import PaginaFisaSsm from "./fisa-instruire-ssm/page";
import PaginaFoaieParcurs from "./foaie-de-parcurs/page";
import PaginaFoaie from "./foaie-de-pontaj/page";

const GOL = { searchParams: Promise.resolve({}) };

/**
 * Pe fiecare unealtă cu document, la tipar rămâne DOAR `#documentul`: nici
 * antetul, nici formularul, nici benzile de explicații, nici subsolul. Testul
 * randează pagina reală (funcție async, fără bază de date) și verifică
 * marcajele; CSS-ul care le ascunde e verificat în browser (sonda și e2e).
 *
 * Plafonul de 20 s: fiecare pagină se randează întreagă în happy-dom (0,6–2,3 s
 * măsurat sub încărcarea suitei, la verificarea planului din 8 oct 2026).
 */
describe("tipărirea uneltelor", { timeout: 20_000 }, () => {
  it.each([
    ["foaie-de-pontaj", PaginaFoaie],
    ["condica-de-prezenta", PaginaCondica],
    ["foaie-de-parcurs", PaginaFoaieParcurs],
    ["fisa-instruire-ssm", PaginaFisaSsm],
    ["fisa-evaluare", PaginaFisaEvaluare],
    ["cerere-concediu-de-odihna", PaginaCerere],
  ] as const)("%s: la tipar rămâne doar documentul", async (_slug, Pagina) => {
    const { container } = render(await Pagina(GOL));
    const vizibile = [...container.querySelectorAll("section, header, footer")]
      .filter((e) => e.closest('[data-tipar="ascunde"]') === null)
      .filter((e) => e.id === "documentul" || e.closest("#documentul") === null)
      .map((e) => e.id || e.tagName.toLowerCase());
    expect(vizibile).toEqual(["documentul"]);
  });

  it("foaia de pontaj cere pagina A4 culcată", async () => {
    const { container } = render(await PaginaFoaie(GOL));
    expect(container.querySelector("#documentul figure")?.getAttribute("data-tipar-pagina")).toBe(
      "peisaj",
    );
  });

  it("previzualizarea urmează orientarea documentului", async () => {
    const parcurs = render(await PaginaFoaieParcurs(GOL));
    expect(
      parcurs.container.querySelector("#documentul figure")?.getAttribute("data-tipar-pagina"),
    ).toBe("peisaj");
    const condica = render(await PaginaCondica(GOL));
    expect(
      condica.container.querySelector("#documentul figure")?.hasAttribute("data-tipar-pagina"),
    ).toBe(false);
  });
});
```

Creează `e2e/unelte-tipar.spec.ts`:

```ts
/**
 * Tipărirea uneltelor gratuite, pe staging: build de producție, cu hidratare.
 *
 * Auditul din 8 oct 2026: foaia de pontaj tipărită din browser ieșea pe 4–5
 * pagini, cu meniul, bara de cookie-uri și subsolul; cererea de concediu pe 3.
 * Local, `next dev` nu termină hidratarea și bara de cookie-uri nu apare deloc,
 * deci ea se poate verifica doar aici. Testul cere ÎNTÂI ca bara să fie
 * vizibilă pe ecran: fără asta, „ascunsă la tipar” ar trece și cu o bară care
 * nu s-a montat niciodată.
 */
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const nume = (n: number) =>
  encodeURIComponent(
    Array.from({ length: n }, (_, i) => `Angajat Numărul ${String(i + 1)}`).join("\n"),
  );

/**
 * `eticheta` dă titlul testului. Fără ea, cele două foi de pontaj aveau același
 * titlu (primele 60 de caractere ale adresei sunt identice), iar Playwright
 * refuză titlurile duplicate dintr-un fișier.
 */
const PAGINI: readonly {
  eticheta: string;
  cale: string;
  culcat: boolean;
  pagini: readonly [number, number];
}[] = [
  {
    eticheta: "foaie de pontaj, 10 nume",
    cale: `/unelte/foaie-de-pontaj?luna=5&an=2027&angajati=${nume(10)}`,
    culcat: true,
    pagini: [1, 1],
  },
  {
    eticheta: "foaie de pontaj, 60 de nume",
    cale: `/unelte/foaie-de-pontaj?luna=5&an=2027&angajati=${nume(60)}`,
    culcat: true,
    pagini: [2, 4],
  },
  {
    eticheta: "cerere de concediu",
    cale: "/unelte/cerere-concediu-de-odihna?salariat=Popa%20Ion&de_la=2026-11-16&pana_la=2026-11-20",
    culcat: false,
    pagini: [1, 1],
  },
  {
    eticheta: "condica de prezență",
    cale: `/unelte/condica-de-prezenta?luna=5&an=2027&angajati=${nume(1)}`,
    culcat: false,
    pagini: [1, 2],
  },
  {
    eticheta: "foaie de parcurs",
    cale: "/unelte/foaie-de-parcurs?luna=5&an=2027",
    culcat: true,
    pagini: [1, 3],
  },
  { eticheta: "fișa SSM", cale: "/unelte/fisa-instruire-ssm", culcat: true, pagini: [1, 3] },
  { eticheta: "fișa de evaluare", cale: "/unelte/fisa-evaluare", culcat: false, pagini: [1, 2] },
];

for (const p of PAGINI) {
  test(`tipar: ${p.eticheta}`, async ({ page }) => {
    await page.goto(p.cale);
    const bara = page.getByRole("region", { name: "Cookie-uri de analiză" });
    await expect(bara).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(bara).toBeHidden();
    const vizibile = await page.evaluate(() =>
      [...document.querySelectorAll("section, header, footer, [role=region]")]
        .filter((e) => e.getClientRects().length > 0)
        .filter((e) => e.id === "documentul" || e.closest("#documentul") === null)
        .map((e) => e.id || e.tagName.toLowerCase()),
    );
    expect(vizibile).toEqual(["documentul"]);

    // Pe mai multe pagini, capul de tabel se repetă (globals.css: thead → table-header-group).
    const thead = await page.evaluate(() => {
      const el = document.querySelector("#documentul thead");
      return el === null ? null : getComputedStyle(el).display;
    });
    if (thead !== null) expect(thead).toBe("table-header-group");

    const pdf = await PDFDocument.load(await page.pdf({ format: "A4", preferCSSPageSize: true }));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(p.pagini[0]);
    expect(pdf.getPageCount()).toBeLessThanOrEqual(p.pagini[1]);
    for (const foaie of pdf.getPages()) {
      expect(foaie.getWidth() > foaie.getHeight()).toBe(p.culcat);
    }
  });
}
```

- [ ] **Pasul 2: Rulează testul și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/tipar.test.tsx"
```

Ce trebuie să se vadă:
- fiecare dintre cele șase pagini: `expected [ 'section', 'documentul' ] to deeply equal [ 'documentul' ]` (banda formularului e încă vizibilă);
- testul A4 culcat: `expected null to be 'peisaj'`.

- [ ] **Pasul 3: Implementarea minimă**

**Banda formularului**, în fiecare dintre cele șase `page.tsx`: foaie-de-pontaj, condica-de-prezenta, foaie-de-parcurs, fisa-instruire-ssm, fisa-evaluare, cerere-concediu-de-odihna. Înlocuiește:

```tsx
      <Banda inaltime="scurta">
        <form
```

cu:

```tsx
      {/* Toată banda formularului rămâne pe ecran: altfel umplutura și rigla ei
          se tipăreau goale deasupra documentului. */}
      <Banda inaltime="scurta" data-tipar="ascunde">
        <form
```

**`foaie-de-pontaj/page.tsx`.** Înlocuiește:

```tsx
        <figure className="mk-foaie">
```

cu:

```tsx
        <figure className="mk-foaie" data-tipar-pagina="peisaj">
```

**`cerere-concediu-de-odihna/page.tsx`.** Înlocuiește:

```tsx
      {/* `Banda` nu primește atribute libere, deci marcajul de tipărire stă pe
          învelișul ei — la fel ca la antet, mai sus. */}
```

cu:

```tsx
      {/* Marcajul de tipărire stă pe înveliș, la fel ca la antet, mai sus.
          Din 8 oct 2026, `Banda` primește și ea `data-tipar`. */}
```

**`previzualizare-document.tsx`.** Înlocuiește:

```tsx
    <figure className="mk-foaie">
```

cu:

```tsx
    <figure
      className="mk-foaie"
      data-tipar-pagina={d.orientare === "peisaj" ? "peisaj" : undefined}
    >
```

și, în același fișier, înlocuiește linia scrisă în B2:

```tsx
  const d = curataDocument(brut);
```

cu:

```tsx
  const d = curataDocument(brut);
  // Documentele late (foaia de parcurs, fișa SSM) se tipăresc pe A4 culcat,
  // ca PDF-ul lor: vezi `@page peisaj` din globals.css.
```

**`globals.css`.** Înlocuiește:

```css
  @page {
    margin: 15mm;
  }
```

cu:

```css
  @page {
    margin: 15mm;
  }

  /*
   * Documentele late — foaia de pontaj cu 31 de coloane, foaia de parcurs, fișa
   * SSM — se tipăresc pe A4 culcat, ca PDF-ul lor. Pe portret, tabelul foii de
   * pontaj nu încape, iar containerul derulabil îl taie. Pagina cu nume se
   * aplică doar foilor care conțin elementul marcat; restul rămâne portret.
   * Chrome și Firefox o respectă; Safari ignoră `page` și tipărește portret.
   */
  @page peisaj {
    size: A4 landscape;
  }

  [data-tipar-pagina="peisaj"] {
    page: peisaj;
  }
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)"
pnpm exec prettier --write "src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx" "src/app/(marketing)/unelte/condica-de-prezenta/page.tsx" "src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx" "src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx" "src/app/(marketing)/unelte/fisa-evaluare/page.tsx" "src/app/(marketing)/unelte/cerere-concediu-de-odihna/page.tsx" "src/app/(marketing)/_componente/previzualizare-document.tsx" src/app/globals.css "src/app/(marketing)/unelte/tipar.test.tsx" e2e/unelte-tipar.spec.ts
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

- [ ] **Pasul 5: Verificare headless locală (HTML și CSS; bara nu, fiindcă nu se hidratează)**

```bash
pgrep -af "next dev"   # dacă rulează deja unul pe acest director, folosește-i portul, nu porni altul
```

Pornește serverul în fundal (`run_in_background`):

```bash
cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917
```

Așteaptă cu Monitor până când `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3917/unelte/foaie-de-pontaj` întoarce `200`. Apoi:

```bash
timeout 300 node "$SCRATCH/sonda-tipar.mjs" http://127.0.0.1:3917 | tee "$SCRATCH/tipar-dupa.txt"
```

Trebuie să iasă:

| Pagina | La tipar | Pagini |
| --- | --- | --- |
| `foaie-10` | `documentul` | 1, culcat |
| `foaie-60` | `documentul` | 3, toate culcate (simularea de azi: 3) |
| `cerere` | `documentul` | 1, portret |
| `condica` | `documentul` | portret (simulare: 1) |
| `parcurs` | `documentul` | culcat (simulare: 2) |
| `ssm` | `documentul` | culcat (simulare: 2) |
| `evaluare` | `documentul` | portret (simulare: 1) |

Pentru `foaie-10`, fă și o captură: adaugă temporar în sondă `await page.screenshot({ path: process.env.SCRATCH + "/foaie-tipar.png", fullPage: true })` după `emulateMedia`, apoi deschide imaginea cu Read. Doar tabelul, titlul „Foaie colectivă de prezență” și sărbătorile lunii; niciun meniu. Oprește serverul într-un apel Bash SEPARAT:

```bash
pkill -f "next dev -H 127.0.0.1 -p 391[7]"
```

```bash
cd /srv/apps/ERP && rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts && pnpm typecheck
```

- [ ] **Commit (două commituri, un push)**

```bash
cd /srv/apps/ERP
git add -- "src/app/(marketing)/unelte/tipar.test.tsx" e2e/unelte-tipar.spec.ts
CAI=("src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx" "src/app/(marketing)/unelte/condica-de-prezenta/page.tsx" "src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx" "src/app/(marketing)/unelte/fisa-instruire-ssm/page.tsx" "src/app/(marketing)/unelte/fisa-evaluare/page.tsx" "src/app/(marketing)/unelte/cerere-concediu-de-odihna/page.tsx" "src/app/(marketing)/_componente/previzualizare-document.tsx" src/app/globals.css "src/app/(marketing)/unelte/tipar.test.tsx" e2e/unelte-tipar.spec.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
fix(unelte): la tipărire rămâne doar documentul, pe A4 culcat unde e lat

Foaia de pontaj cu 10 angajați ieșea pe 5 pagini, cererea de concediu pe 3.
Banda formularului e marcată data-tipar pe toate cele șase unelte cu document,
iar foaia de pontaj și previzualizările „peisaj” cer pagina numită @page peisaj
(A4 culcat). Test pe paginile randate + e2e pe staging (cu bara de cookie-uri,
care apare doar după hidratare).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
SHA=$(git rev-parse --short=7 HEAD)
tail -c1 scripts/checks/lastmod-fara-continut.txt | od -An -c   # trebuie să afișeze \n
printf '%s tipărirea uneltelor: doar marcaje data-tipar și pagina A4 culcată; textul paginilor neschimbat\n' "$SHA" >> scripts/checks/lastmod-fara-continut.txt
git commit --only -m "chore(lastmod): $SHA nu schimbă conținutul paginilor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- scripts/checks/lastmod-fara-continut.txt
git merge origin/main
node scripts/checks/lastmod.mjs
git push origin main
```

- [ ] **Pasul 6: Verificare pe staging (după deploy-ul automat)**

```bash
gh run list --workflow staging.yml --limit 3   # rularea pentru HEAD: success; durată > 30 s (altfel a sărit)
cd /srv/apps/ERP && pnpm test:e2e e2e/unelte-tipar.spec.ts
```

7 teste verzi, fără „flaky”. Dacă pică doar intervalul de pagini la condică, parcurs, SSM sau evaluare, notează cifra reală și strânge intervalul în spec. Nu-l lărgi fără motiv. Foaia cu 10 nume și cererea TREBUIE să rămână la 1.

---

### Task B7: Orele în ceas, fără virgulă mobilă

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts` (importuri; `construiesteFoaie`, ultimele linii ale obiectului întors; funcții noi)
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts:3,17`
- Modify: `src/app/api/unelte/foaie-de-pontaj/route.ts:84-86` + import
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx:164-169,179-181` + import
- Modify: `src/content/landing/harta.ts` (blocul `/unelte/foaie-de-pontaj`)
- Test: `foaie.test.ts`, `src/app/api/unelte/foaie-de-pontaj/route.test.ts`

**Interfețe:**
- Consumă: `formatOre(valoare: number | string, optiuni?: { grupeaza?: boolean }): string` (`@/lib/format/ore`); `cuDe` (deja importat în B4).
- Produce:
  ```ts
  export function oreFoaie(ore: number): string;   // 8 → "8 h", 7.5 → "7:30 h", 153.3 → "153:18 h"
  export function textNorma(foaie: Foaie): string; // "21 de zile lucrătoare × 8 h = 168 h normă"
  // Foaie.normaLunara: rotunjită la minut
  ```

- [ ] **Pasul 1: Scrie testele care pică**

În `foaie.test.ts`, adaugă `oreFoaie` și `textNorma` în lista de import din `./foaie`, apoi adaugă la sfârșit:

```ts
/**
 * Regula produsului (`src/lib/format/ore.ts`): orele se scriu în ceas, nu în
 * zecimale. Pe 8 oct 2026, `ore=7.3` pe iunie 2026 afișa
 * „153.29999999999998 h normă”, cu punct.
 */
describe("orele foii", () => {
  it("norma nu poartă erori de virgulă mobilă: 21 × 7:18 h = 153:18 h", () => {
    const f = construiesteFoaie(2026, 6, ["A"], 7.3);
    expect(f.zileLucratoare).toBe(21);
    expect(f.normaLunara).toBe(153.3);
    expect(textNorma(f)).toBe("21 de zile lucrătoare × 7:18 h = 153:18 h normă");
  });

  it("orele întregi rămân fără „:00”, jumătățile în ceas", () => {
    expect(oreFoaie(8)).toBe("8 h");
    expect(oreFoaie(7.5)).toBe("7:30 h");
    expect(oreFoaie(168)).toBe("168 h");
    expect(oreFoaie(1198)).toBe("1.198 h");
  });

  it("„de” apare de la 20 în sus", () => {
    expect(textNorma(construiesteFoaie(2026, 12, ["A"], 8))).toBe(
      "21 de zile lucrătoare × 8 h = 168 h normă",
    );
    expect(textNorma(construiesteFoaie(2026, 1, ["A"], 8))).toBe(
      "18 zile lucrătoare × 8 h = 144 h normă",
    );
  });
});
```

În `src/app/api/unelte/foaie-de-pontaj/route.test.ts`, înaintea ultimului `});`, adaugă:

```ts

  it("Excelul scrie norma în ceas, fără virgulă mobilă", async () => {
    const siruri = await parte(await cere("an=2026&luna=6&ore=7.3"), "xl/sharedStrings.xml");
    expect(siruri).toContain("21 de zile lucrătoare × 7:18 h = 153:18 h normă");
    expect(siruri).not.toContain("153.2999");
  });
```

- [ ] **Pasul 2: Rulează testele și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" src/app/api/unelte/foaie-de-pontaj
```

Ce trebuie să se vadă:
- `oreFoaie is not a function` (importul cade);
- testul rutei: `expected … to contain "21 de zile lucrătoare × 7:18 h…"`. Azi Excelul conține „21 zile lucrătoare × 7.3 h = 153.29999999999998 h normă”.

- [ ] **Pasul 3: Implementarea minimă**

**`foaie.ts`.** Înlocuiește:

```ts
import { cuDe } from "@/content/legal/zile-libere";
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
import { curataText } from "@/lib/unelte/document-tabelar";
```

cu:

```ts
import { cuDe } from "@/content/legal/zile-libere";
import { sarbatoriDupaZi } from "@/domain/calendar/sarbatori";
import { formatOre } from "@/lib/format/ore";
import { curataText } from "@/lib/unelte/document-tabelar";
```

Înlocuiește:

```ts
    zileLucratoare,
    normaLunara: zileLucratoare * oreZi,
  };
}
```

cu:

```ts
    zileLucratoare,
    // În minute întregi, apoi înapoi în ore: 21 × 7,3 dădea 153,29999999999998.
    normaLunara: Math.round(zileLucratoare * oreZi * 60) / 60,
  };
}

/**
 * Orele foii, în ceas: `8` → „8 h”, `7.5` → „7:30 h”, `153.3` → „153:18 h”.
 *
 * Regula produsului (`src/lib/format/ore.ts`): fără „8,5 ore” și fără „7.5”.
 * Orele întregi rămân fără „:00”, ca pe foaia de hârtie.
 */
export function oreFoaie(ore: number): string {
  return `${formatOre(ore).replace(/:00$/u, "")} h`;
}

/** „21 de zile lucrătoare × 8 h = 168 h normă”: același text pe pagină, în PDF, Word și Excel. */
export function textNorma(foaie: Foaie): string {
  return `${cuDe(foaie.zileLucratoare, "zile lucrătoare")} × ${oreFoaie(foaie.oreZi)} = ${oreFoaie(foaie.normaLunara)} normă`;
}
```

**`foaie-document.ts`.** Înlocuiește `import type { Foaie } from "./foaie";` cu `import { textNorma, type Foaie } from "./foaie";`, apoi linia:

```ts
    subtitlu: `${String(foaie.zileLucratoare)} zile lucrătoare × ${String(foaie.oreZi)} h = ${String(foaie.normaLunara)} h normă`,
```

cu:

```ts
    subtitlu: textNorma(foaie),
```

**`route.ts`.** Adaugă `textNorma,` în importul din `@/app/(marketing)/unelte/foaie-de-pontaj/foaie`, după `notaOmisi,`. Înlocuiește:

```ts
  fila.addRow([
    `${foaie.zileLucratoare} zile lucrătoare × ${foaie.oreZi} h = ${foaie.normaLunara} h normă`,
  ]);
```

cu:

```ts
  fila.addRow([textNorma(foaie)]);
```

**`page.tsx` (foaia de pontaj).** Adaugă `textNorma,` în importul din `./foaie`. Înlocuiește:

```tsx
          <p className="text-mk-text-slab text-[0.9375rem]">
            <span className="font-mk-date text-mk-text">{foaie.zileLucratoare}</span> zile
            lucrătoare · <span className="font-mk-date text-mk-text">{foaie.normaLunara}</span> ore
            normă
          </p>
```

cu:

```tsx
          <p className="font-mk-date text-mk-text text-[0.9375rem]">{textNorma(foaie)}</p>
```

Înlocuiește:

```tsx
              {foaie.zileLucratoare} zile lucrătoare × {foaie.oreZi} h = {foaie.normaLunara} h
```

cu:

```tsx
              {textNorma(foaie)}
```

**`harta.ts`.** Înlocuiește:

```ts
    cale: "/unelte/foaie-de-pontaj",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-07",
```

cu același bloc, dar cu `actualizat: "AAAA-LL-ZZ",`, unde `AAAA-LL-ZZ` = ieșirea lui `date +%F` din ziua commitului. Dacă între timp data din fișier e deja mai nouă, o lași așa.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte" src/app/api/unelte src/content/landing
pnpm exec prettier --write "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx" src/app/api/unelte/foaie-de-pontaj/route.ts src/app/api/unelte/foaie-de-pontaj/route.test.ts src/content/landing/harta.ts
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

- [ ] **Pasul 5: Verificare live pe staging (după push)**

```bash
curl -s -u "coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)" 'https://staging.administrativo.ro/unelte/foaie-de-pontaj?luna=6&an=2026&ore=7.3' | grep -o '21 de zile lucrătoare × 7:18 h = 153:18 h normă' | wc -l
```

Rezultatul trebuie să fie cel puțin `2` (de obicei `4`): textul apare o dată deasupra foii și o dată în capul ei, iar fiecare apariție se repetă în datele RSC (`self.__next_f`). Nu folosi `grep -c`: numără LINII, iar HTML-ul Next are câteva linii foarte lungi, deci ar da 1 (măsurat pe producție la verificarea planului). `153.2999` nu trebuie să apară deloc: `grep -c '153\.2999'` dă 0.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie-document.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx" src/app/api/unelte/foaie-de-pontaj/route.ts src/app/api/unelte/foaie-de-pontaj/route.test.ts src/content/landing/harta.ts)
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
fix(unelte): norma foii de pontaj în ceas, fără virgulă mobilă

ore=7.3 afișa „153.29999999999998 h normă”, cu punct zecimal. Norma se
rotunjește la minut și se scrie în ceas, ca în restul produsului: „21 de zile
lucrătoare × 7:18 h = 153:18 h normă”; orele întregi rămân „8 h”. Același text
pe pagină, în PDF, Word și Excel (textNorma).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git merge origin/main
node scripts/checks/lastmod.mjs
git push origin main
```

---

### Task B8: Parametrii corectați se spun pe pagină; formatul se citește fără majuscule

**Fișiere:**
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts` (funcții noi după `notaOmisi`)
- Modify: `src/lib/unelte/document-tabelar.ts:16-18`
- Modify: `src/app/api/unelte/foaie-de-pontaj/route.ts:47-49`
- Modify: `src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx` (aviz)
- Modify: `src/app/(marketing)/unelte/condica-de-prezenta/page.tsx` (aviz)
- Modify: `src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx` (importuri, aviz)
- Modify: `scripts/checks/lastmod-fara-continut.txt` (commit separat)
- Test: `foaie.test.ts`, `src/lib/unelte/randari.test.ts`, `src/app/api/unelte/foaie-de-pontaj/route.test.ts`, `src/app/api/unelte/[unealta]/route.test.ts`, `src/app/(marketing)/unelte/avize.test.tsx`

**Interfețe:**
- Consumă: `normalizeazaOre`, `oreFoaie` (B7), `LUNI`, `AN_MIN`, `AN_MAX` din `foaie.ts`; `AvizCorectari` (B4).
- Produce:
  ```ts
  export type ParametriBruti = Readonly<{ an?: string | undefined; luna?: string | undefined; ore?: string | undefined }>;
  export function avizeParametri(brut: ParametriBruti, ales: Readonly<{ an: number; luna: number }>): readonly string[];
  // normalizeazaFormat(brut: string | null): Format — acum fără majuscule și spații
  ```

- [ ] **Pasul 1: Scrie testele care pică**

În `foaie.test.ts`, adaugă `avizeParametri` și `normalizeazaLuna` în importul din `./foaie`, apoi la sfârșit:

```ts
/**
 * API-ul rămâne tolerant (un link vechi dă tot un fișier), dar pagina spune ce
 * a corectat. Înainte, `an=1999&luna=13` dădea foaia lunii curente fără semn.
 */
describe("avizele pentru parametrii corectați", () => {
  const ALES = { an: 2026, luna: 10 };

  it("anul și luna din afara limitelor se spun pe nume, cu valoarea folosită", () => {
    expect(avizeParametri({ an: "1999", luna: "13" }, ALES)).toEqual([
      "Anul „1999” nu e un an între 2020 și 2035; am folosit 2026.",
      "Luna „13” nu e între 1 și 12; am folosit octombrie.",
    ]);
  });

  it("„2e1” nu mai trece tăcut drept februarie", () => {
    expect(avizeParametri({ luna: "2e1" }, { an: 2026, luna: normalizeazaLuna("2e1", 10) })).toEqual([
      "Luna „2e1” nu e între 1 și 12; am folosit februarie.",
    ]);
  });

  it("valorile bune, cu zero în față sau cu spații, nu dau aviz", () => {
    expect(avizeParametri({ an: " 2026 ", luna: "05", ore: "7,5" }, { an: 2026, luna: 5 })).toEqual(
      [],
    );
  });

  it("parametrii lipsă sau goi nu dau aviz", () => {
    expect(avizeParametri({ an: "", luna: undefined, ore: "  " }, ALES)).toEqual([]);
  });

  it("orele: avizul spune valoarea folosită de fapt", () => {
    expect(avizeParametri({ ore: "abc" }, ALES)).toEqual([
      "Orele pe zi „abc” nu sunt un număr între 0 și 24; am folosit 8 h.",
    ]);
    // parseFloat citește „7,5abc” drept 7,5: foaia e pe 7:30 h, iar avizul trebuie s-o spună.
    expect(avizeParametri({ ore: "7,5abc" }, ALES)).toEqual([
      "Orele pe zi „7,5abc” nu sunt un număr între 0 și 24; am folosit 7:30 h.",
    ]);
  });

  it("textul primit se citează scurtat la 24 de caractere", () => {
    const [aviz] = avizeParametri({ an: "x".repeat(100) }, ALES);
    expect(aviz).toContain(`„${"x".repeat(24)}…”`);
    expect(aviz).not.toContain("x".repeat(25));
  });
});
```

În `src/lib/unelte/randari.test.ts`, în blocul `describe("modelul comun"`, după testul „formatul necunoscut cade pe PDF”, adaugă:

```ts

  it("formatul se citește fără majuscule și fără spații", () => {
    expect(normalizeazaFormat("DOCX")).toBe("docx");
    expect(normalizeazaFormat(" xlsx ")).toBe("xlsx");
    expect(normalizeazaFormat("Pdf")).toBe("pdf");
  });
```

În `src/app/api/unelte/foaie-de-pontaj/route.test.ts`, înaintea ultimului `});`:

```ts

  it("formatul se citește fără majuscule: PDF dă PDF, nu Excel", async () => {
    expect((await cere("an=2026&luna=12&format=PDF")).headers.get("content-type")).toBe(
      "application/pdf",
    );
    expect((await cere("an=2026&luna=12&format=DOCX")).headers.get("content-type")).toContain(
      "wordprocessingml",
    );
  });
```

În `src/app/api/unelte/[unealta]/route.test.ts`, înaintea ultimului `});`:

```ts

  it("formatul cu majuscule dă formatul cerut, nu PDF", async () => {
    const r = await cere("/api/unelte/fisa-evaluare?format=DOCX", "fisa-evaluare");
    expect(r.headers.get("content-type")).toContain("wordprocessingml");
  });
```

În `src/app/(marketing)/unelte/avize.test.tsx`, adaugă importul `import PaginaFoaieParcurs from "./foaie-de-parcurs/page";`, apoi înaintea ultimului `});`:

```tsx

  it("foaia de pontaj spune când anul și luna din adresă au fost corectate", async () => {
    const { container } = render(
      await PaginaFoaie({ searchParams: Promise.resolve({ an: "1999", luna: "13" }) }),
    );
    expect(aviz(container)).toContain("Anul „1999” nu e un an între 2020 și 2035");
    expect(aviz(container)).toContain("Luna „13” nu e între 1 și 12");
  });

  it("condica și foaia de parcurs la fel", async () => {
    const condica = render(await PaginaCondica({ searchParams: Promise.resolve({ an: "abc" }) }));
    expect(aviz(condica.container)).toContain("Anul „abc”");
    condica.unmount();
    const parcurs = render(
      await PaginaFoaieParcurs({ searchParams: Promise.resolve({ luna: "0" }) }),
    );
    expect(aviz(parcurs.container)).toContain("Luna „0” nu e între 1 și 12");
  });
```

- [ ] **Pasul 2: Rulează testele și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)/unelte" src/lib/unelte/randari.test.ts src/app/api/unelte
```

Ce trebuie să se vadă:
- `avizeParametri is not a function`;
- `normalizeazaFormat("DOCX")`: expected 'docx', received 'pdf';
- ruta foii: content-type `…spreadsheetml.sheet` în loc de `application/pdf`;
- paginile: `expected '' to contain 'Anul „1999” nu e un an între 2020 și 2035'` (și analoagele).

- [ ] **Pasul 3: Implementarea minimă**

**`foaie.ts`.** Inserează după `notaOmisi`:

```ts
export type ParametriBruti = Readonly<{
  an?: string | undefined;
  luna?: string | undefined;
  ore?: string | undefined;
}>;

function prezent(brut: string | undefined): brut is string {
  return brut !== undefined && brut.trim() !== "";
}

/** Textul primit, scurtat: o adresă lungă nu se reproduce întreagă pe pagină. */
function citat(brut: string): string {
  const t = brut.trim();
  return t.length > 24 ? `${t.slice(0, 24)}…` : t;
}

/**
 * Ce s-a corectat din adresă, spus în cuvinte, cu valoarea folosită de fapt.
 *
 * Ruta de descărcare rămâne TOLERANTĂ: un link vechi sau tăiat dă tot un fișier,
 * nu o pagină text/plain de eroare. Pagina însă spune ce a schimbat; altfel omul
 * primea foaia altei luni, cu numele de fișier al acelei luni (auditul din 8 oct 2026).
 *
 * Compară cu `Number`, nu cu `parseInt`: „2e1” trece prin `parseInt` drept 2 și
 * dădea februarie fără niciun semn. La ore, valoarea folosită vine din
 * `normalizeazaOre`, ca avizul să nu spună „8” când foaia e pe 7:30.
 */
export function avizeParametri(
  brut: ParametriBruti,
  ales: Readonly<{ an: number; luna: number }>,
): readonly string[] {
  const avize: string[] = [];
  if (prezent(brut.an) && Number(brut.an.trim()) !== ales.an) {
    avize.push(
      `Anul „${citat(brut.an)}” nu e un an între ${String(AN_MIN)} și ${String(AN_MAX)}; am folosit ${String(ales.an)}.`,
    );
  }
  if (prezent(brut.luna) && Number(brut.luna.trim()) !== ales.luna) {
    avize.push(
      `Luna „${citat(brut.luna)}” nu e între 1 și 12; am folosit ${LUNI[ales.luna - 1] ?? ""}.`,
    );
  }
  if (prezent(brut.ore)) {
    const folosit = normalizeazaOre(brut.ore);
    if (Number(brut.ore.trim().replace(",", ".")) !== folosit) {
      avize.push(
        `Orele pe zi „${citat(brut.ore)}” nu sunt un număr între 0 și 24; am folosit ${oreFoaie(folosit)}.`,
      );
    }
  }
  return avize;
}
```

**`document-tabelar.ts`.** Înlocuiește:

```ts
export function normalizeazaFormat(brut: string | null): Format {
  return brut === "docx" || brut === "xlsx" ? brut : "pdf";
}
```

cu:

```ts
export function normalizeazaFormat(brut: string | null): Format {
  // „DOCX” sau „ docx ” înseamnă tot Word; până pe 8 oct 2026 primeau tăcut un PDF.
  const format = brut?.trim().toLowerCase();
  return format === "docx" || format === "xlsx" ? format : "pdf";
}
```

**`route.ts` (foaia de pontaj).** Înlocuiește:

```ts
function normalizeazaFormatFoaie(brut: string | null): Format {
  return brut === "pdf" || brut === "docx" ? brut : "xlsx";
}
```

cu:

```ts
function normalizeazaFormatFoaie(brut: string | null): Format {
  const format = brut?.trim().toLowerCase();
  return format === "pdf" || format === "docx" ? format : "xlsx";
}
```

**`foaie-de-pontaj/page.tsx`.** Adaugă `avizeParametri,` în importul din `./foaie`. Înlocuiește:

```tsx
        <AvizCorectari avize={avizAngajati(lista)} />
```

cu:

```tsx
        <AvizCorectari
          avize={[
            ...avizeParametri(
              { an: unul(p.an), luna: unul(p.luna), ore: unul(p.ore) },
              { an, luna },
            ),
            ...avizAngajati(lista),
          ]}
        />
```

**`condica-de-prezenta/page.tsx`.** Înlocuiește importul:

```tsx
import { AN_MAX, AN_MIN, avizAngajati, citesteAngajati, LUNI } from "../foaie-de-pontaj/foaie";
```

cu:

```tsx
import {
  AN_MAX,
  AN_MIN,
  avizAngajati,
  avizeParametri,
  citesteAngajati,
  LUNI,
} from "../foaie-de-pontaj/foaie";
```

și:

```tsx
  const avize = avizAngajati(citesteAngajati(q.get("angajati") ?? undefined));
```

cu:

```tsx
  const avize = [
    ...avizeParametri({ an: q.get("an") ?? undefined, luna: q.get("luna") ?? undefined }, ales),
    ...avizAngajati(citesteAngajati(q.get("angajati") ?? undefined)),
  ];
```

**`foaie-de-parcurs/page.tsx`.** Înlocuiește:

```tsx
import { AntetSecundar } from "../../_componente/antet-secundar";
```

cu:

```tsx
import { AntetSecundar } from "../../_componente/antet-secundar";
import { AvizCorectari } from "../../_componente/aviz-corectari";
```

și:

```tsx
import { AN_MAX, AN_MIN, LUNI } from "../foaie-de-pontaj/foaie";
```

cu:

```tsx
import { AN_MAX, AN_MIN, avizeParametri, LUNI } from "../foaie-de-pontaj/foaie";
```

Înlocuiește:

```tsx
  const ales = parametriFoaieParcurs(q);
  const document = construiesteFoaieParcurs(ales);
```

cu:

```tsx
  const ales = parametriFoaieParcurs(q);
  const document = construiesteFoaieParcurs(ales);
  const avize = avizeParametri(
    { an: q.get("an") ?? undefined, luna: q.get("luna") ?? undefined },
    ales,
  );
```

și:

```tsx
            eveniment="parcurs"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
      </Banda>
```

cu:

```tsx
            eveniment="parcurs"
            formate={["docx", "pdf", "xlsx"]}
          />
        </form>
        <AvizCorectari avize={avize} />
      </Banda>
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run "src/app/(marketing)" src/lib/unelte src/app/api/unelte
pnpm exec prettier --write "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" src/lib/unelte/document-tabelar.ts src/lib/unelte/randari.test.ts src/app/api/unelte/foaie-de-pontaj/route.ts src/app/api/unelte/foaie-de-pontaj/route.test.ts "src/app/api/unelte/[unealta]/route.test.ts" "src/app/(marketing)/unelte/avize.test.tsx" "src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx" "src/app/(marketing)/unelte/condica-de-prezenta/page.tsx" "src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx"
pnpm typecheck && pnpm check:server && pnpm lint && pnpm test
```

Testul existent „formatul necunoscut cade pe PDF” (`exe` → pdf) rămâne verde.

- [ ] **Pasul 5: Verificare live pe staging (după push)**

```bash
A="coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)"
curl -s -u "$A" 'https://staging.administrativo.ro/unelte/foaie-de-pontaj?an=1999&luna=13' | grep -o 'Anul „1999” nu e un an între 2020 și 2035'
curl -s -u "$A" 'https://staging.administrativo.ro/unelte/foaie-de-parcurs?luna=2e1' | grep -o 'Luna „2e1” nu e între 1 și 12; am folosit februarie'
curl -s -u "$A" -o /dev/null -w '%{content_type}\n' 'https://staging.administrativo.ro/api/unelte/fisa-evaluare?format=DOCX'
```

Primele două comenzi scot fiecare cel puțin un rând (de obicei două: HTML + datele RSC). A treia scoate `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

- [ ] **Commit (două commituri, un push)**

```bash
cd /srv/apps/ERP
CAI=("src/app/(marketing)/unelte/foaie-de-pontaj/foaie.ts" "src/app/(marketing)/unelte/foaie-de-pontaj/foaie.test.ts" src/lib/unelte/document-tabelar.ts src/lib/unelte/randari.test.ts src/app/api/unelte/foaie-de-pontaj/route.ts src/app/api/unelte/foaie-de-pontaj/route.test.ts "src/app/api/unelte/[unealta]/route.test.ts" "src/app/(marketing)/unelte/avize.test.tsx" "src/app/(marketing)/unelte/foaie-de-pontaj/page.tsx" "src/app/(marketing)/unelte/condica-de-prezenta/page.tsx" "src/app/(marketing)/unelte/foaie-de-parcurs/page.tsx")
git status --short -- "${CAI[@]}"
git fetch origin main
git diff --name-only HEAD origin/main -- "${CAI[@]}"
git commit --only -F - -- "${CAI[@]}" <<'EOF'
fix(unelte): pagina spune când a corectat anul, luna sau orele din adresă

an=1999&luna=13 dădea foaia lunii curente fără niciun semn, iar luna=2e1 dădea
februarie. API-ul rămâne tolerant (un link vechi dă tot un fișier); foaia de
pontaj, condica și foaia de parcurs arată ce au folosit în loc. Formatul se
citește fără majuscule: format=DOCX dădea PDF (sau Excel, la foaia de pontaj).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
SHA=$(git rev-parse --short=7 HEAD)
tail -c1 scripts/checks/lastmod-fara-continut.txt | od -An -c   # trebuie să afișeze \n
printf '%s aviz de parametri corectați pe foaie, condică și parcurs — apare doar la adrese invalide; textul implicit neschimbat\n' "$SHA" >> scripts/checks/lastmod-fara-continut.txt
git commit --only -m "chore(lastmod): $SHA nu schimbă textul implicit al paginilor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- scripts/checks/lastmod-fara-continut.txt
git merge origin/main
node scripts/checks/lastmod.mjs
git push origin main
```

### Task B9: Paritatea calendarului TypeScript cu seed-ul SQL `public_holidays`

(Adăugat de criticul de completitudine, 8 oct 2026. Acoperă a doua jumătate a defectului transversal D8.2 din audit: „cererea de concediu numără zilele în TypeScript (`sarbatoriDupaZi`), iar modulul de concedii le numără în SQL (`app.este_zi_lucratoare` + `public_holidays`). Sunt două implementări fără test de paritate.” B1 spune în docblock că lista „reflectă exact seed-ul”, dar nimic nu păzește afirmația. Independent de B2–B8, cere doar B1.)

**Fișiere:**
- Create: `src/domain/calendar/sarbatori.paritate-sql.test.ts`

**Interfețe:**
- Consumă: `sarbatoriAnului(an: number): readonly Sarbatoare[]` (`./sarbatori`, după B1), `pasteOrtodox(an: number): Date` (`./paste-ortodox`), textul lui `supabase/migrations/0009_leave.sql` (blocul `-- SEED 2024–2040`, `insert into public.public_holidays … from generate_series(2024, 2040) … (values (make_date(s.an, L, Z), '…', …), (internal.paste_ortodox(s.an) ± N, '…', …))`). Tiparul de test static pe o migrare există deja în `src/domain/leave/documente-fizice.test.ts`.
- Produce: nimic exportat.

- [ ] **Pasul 1: Scrie testul.** `src/domain/calendar/sarbatori.paritate-sql.test.ts`:

```ts
// src/domain/calendar/sarbatori.paritate-sql.test.ts
//
// Aceeași listă de sărbători trăiește în două limbaje: `sarbatoriAnului` (unelte
// publice, cererea de concediu, foaia de pontaj) și seed-ul `public_holidays`
// din 0009 (modulul de concedii, `app.este_zi_lucratoare`). Auditul din 8 oct
// 2026 a găsit că nimic nu le ține lipite. Testul citește seed-ul ca text și îl
// recalculează cu Paștele din TypeScript; `paste-ortodox.ts` declară că
// reproduce exact `internal.paste_ortodox`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { pasteOrtodox } from "./paste-ortodox";
import { sarbatoriAnului } from "./sarbatori";

const MIGRARI = join(__dirname, "..", "..", "..", "supabase", "migrations");
const SEED = readFileSync(join(MIGRARI, "0009_leave.sql"), "utf8");

const iso = (d: Date) => d.toISOString().slice(0, 10);

function aniiSeedului(): readonly number[] {
  const m = /from generate_series\((\d{4}),\s*(\d{4})\)\s+as\s+s\(an\)/u.exec(SEED);
  expect(m, "generate_series(…) as s(an) a dispărut din seed").not.toBeNull();
  const [de, pana] = [Number(m?.[1]), Number(m?.[2])];
  return Array.from({ length: pana - de + 1 }, (_, i) => de + i);
}

function seedulPentru(an: number): readonly string[] {
  const zile: string[] = [];
  for (const [, luna, zi] of SEED.matchAll(/\(make_date\(s\.an,\s*(\d{1,2}),\s*(\d{1,2})\),\s*'/gu)) {
    zile.push(iso(new Date(Date.UTC(an, Number(luna) - 1, Number(zi)))));
  }
  const paste = pasteOrtodox(an);
  for (const [, semn, n] of SEED.matchAll(/\(internal\.paste_ortodox\(s\.an\)(?:\s*([+-])\s*(\d+))?,\s*'/gu)) {
    const decalaj = n === undefined ? 0 : (semn === "-" ? -1 : 1) * Number(n);
    zile.push(iso(new Date(paste.getTime() + decalaj * 86_400_000)));
  }
  return [...new Set(zile)].sort();
}

describe("sarbatoriAnului ↔ seed-ul public_holidays (0009_leave.sql)", () => {
  it("seed-ul are 12 sărbători fixe și 5 mobile (dacă se schimbă, se schimbă testul cu el)", () => {
    expect([...SEED.matchAll(/\(make_date\(s\.an,/gu)].length).toBe(12);
    expect([...SEED.matchAll(/\(internal\.paste_ortodox\(s\.an\)/gu)].length).toBe(5);
  });

  it.each(aniiSeedului())("anul %i: aceleași zile", (an) => {
    const ts = [...new Set(sarbatoriAnului(an).map((s) => iso(s.data)))].sort();
    expect(ts).toEqual(seedulPentru(an));
  });

  it("nicio altă migrare nu inserează sau șterge sărbători legale", () => {
    // O migrare nouă care adaugă un an sau o sărbătoare trebuie să extindă
    // testul de față, nu să ocolească paritatea.
    const altele = readdirSync(MIGRARI)
      .filter((f) => f.endsWith(".sql") && f !== "0009_leave.sql")
      .filter((f) =>
        /(insert\s+into|delete\s+from|update)\s+public\.public_holidays\b/iu.test(
          readFileSync(join(MIGRARI, f), "utf8"),
        ),
      );
    expect(altele).toEqual([]);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l verde, apoi fă proba de roșu.** Testul e o pază, nu reparația unui defect, deci trece din prima pe `main` cu B1:

```bash
cd /srv/apps/ERP && pnpm exec vitest run src/domain/calendar/sarbatori.paritate-sql.test.ts
```

Așteptat: verde, 17 ani (2024–2040), 12 fixe și 5 mobile, nicio altă migrare. Criticul a rulat aceeași logică pe 8 oct 2026, cu `jiti`, pe `sarbatori.ts` și `0009_leave.sql` de pe disc: 0 nepotriviri, iar lista „altele” e goală (`0016`, `0015`, `0167`, `0169` doar citesc tabela). **Proba de roșu** se face prin mutație în fișierul nou, care e al taskului: în `it.each`, `expect(ts).toEqual(seedulPentru(an))` devine temporar `expect(ts).toEqual(seedulPentru(an).filter((z) => !z.endsWith("-06-01")))`. Rulezi și vezi `anul 2024: aceleași zile` căzând cu `+ "2024-06-01"`. Apoi refaci linia și rulezi din nou, verde. Dacă al treilea `it` găsește migrări, corectezi expresia, nu lista.

- [ ] **Pasul 3: LANȚ** (`pnpm typecheck && pnpm check:server && pnpm lint && pnpm test`), apoi `pnpm exec prettier --write` și `--check` pe fișierul nou.

- [ ] **Pasul 4: Commit**

```bash
cd /srv/apps/ERP
git status --short -- src/domain/calendar/sarbatori.paritate-sql.test.ts
git fetch origin main
git diff --name-only HEAD origin/main -- src/domain/calendar supabase/migrations
git add -- src/domain/calendar/sarbatori.paritate-sql.test.ts
git commit --only -m "test(calendar): sărbătorile din TypeScript și seed-ul public_holidays, lipite de un test" -m "Uneltele publice numărau zilele prin sarbatoriAnului, modulul de concedii prin public_holidays (0009), fără nicio pază între ele (audit 8 oct 2026)." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/domain/calendar/sarbatori.paritate-sql.test.ts
git merge origin/main
git push origin main
```

Limită declarată: testul nu verifică funcția SQL `internal.paste_ortodox` însăși, ci presupune că e identică cu `pasteOrtodox` (cum declară docblock-ul TS). O probă în banca locală (`select internal.paste_ortodox(an)` pe 2024–2040 comparat cu valorile scrise de mână din `paste-ortodox.test.ts`) ar închide și asta. Rămâne datorie.

- [ ] **După B8: deploy pe producție, doar cu confirmarea utilizatorului**

Deploy-ul se face prin `./administrativo.sh` (memoria `erp-deploy-productie.md`). După el:

```bash
timeout 300 node "$SCRATCH/sonda-tipar.mjs" https://administrativo.ro
```

Rezultatul trebuie să coincidă cu tabelul din B6, pasul 5. Se compară cu `$SCRATCH/tipar-inainte.txt`.

---

**Review Focus**

Condiții pe care niciun test din forma inițială a secțiunii nu le prindea și care ar fi mușcat un utilizator real. Fiecare are testul adăugat în taskul care deține codul.

1. **Formularul trimite CRLF, iar oamenii lipesc rânduri „goale” făcute din NBSP sau ZWSP.** Un textarea trimis prin GET codifică rândul nou ca `%0D%0A`. Un rând cu doar U+00A0 sau U+200B ar fi devenit un angajat fără nume, adică un rând de semnătură în plus pe fiecare zi a condicii. Test în **B3**: „rândurile cu doar spații invizibile nu sunt angajați (formularul trimite CRLF)”.
2. **Termenele REGES din ianuarie 2023 se mută cu o zi.** Lista REGES alimentează `construiesteCalendar(an - 1, an + 1)` în `genereaza-evenimente.ts`. Un termen calculat peste 6 ianuarie 2023 trebuie să cadă pe 06.01, iar unul din 2025 pe 08.01. Echivalența celor două liste nu prinde o greșeală făcută la fel în amândouă. Test în **B1**: „6 ianuarie 2023 era zi lucrătoare; 6 ianuarie 2025 nu mai e”.
3. **Avizul pentru ore ar fi mințit.** `normalizeazaOre` folosește `parseFloat`, deci „7,5abc” dă 7,5. Un aviz scris „am folosit 8” ar fi contrazis foaia generată pe 7:30. Test în **B8**: „orele: avizul spune valoarea folosită de fapt”.
4. **Foaia cu 60 de nume pe mai multe pagini tipărite.** Containerul `overflow-x-auto` și pagina numită `peisaj` ar putea opri repetarea capului de tabel sau ar putea pune o primă pagină portret goală înaintea celei culcate (propagarea paginii numite). Test în **B6**, e2e: foaia cu 60 de nume are 2–4 pagini, TOATE culcate, iar `thead` are `display: table-header-group` la tipar. Simularea de azi a dat 3 pagini culcate.
5. **Previzualizarea și fișierul ar fi spus lucruri diferite.** Curățarea doar în `raspunsDocument` lăsa pe ecran „Condica⟨VT⟩de prezență” lipit, iar în fișier „Condica de prezență”. Test în **B2**: `previzualizare-document.test.tsx`, „arată textul curățat, ca fișierele”.

Risc rămas, declarat și netestabil aici: Safari ignoră proprietatea CSS `page`, deci acolo foaia de pontaj se tipărește pe portret, dacă omul nu alege „Landscape”. Recomandarea rămâne descărcarea PDF-ului, care e culcat prin construcție.

---

**Verificarea adversarială a secțiunii (8 oct 2026)**

Toate cele opt taskuri au fost aplicate, în ordine, pe o copie a repo-ului (`src`, `tests`, `scripts`, `e2e`, configurările, `node_modules` legat simbolic, plus `saxes@5.0.1` din `.pnpm`). Fiecare bloc „vechi” a fost găsit exact o dată. Fiecare set de teste a picat înainte de implementare și a trecut după. Pe copia finală: `tsc --noEmit` verde (cu sondă de control care pică), `check:server` verde, ESLint verde, 2.218 teste verzi pe `src/domain`, `src/content`, `src/app/(marketing)`, `src/app/api`, `src/lib/unelte`, `src/lib/reges`, plus `playwright test --list` cu 7 teste. Ce s-a corectat în plan:

1. **Legal:** 24 ianuarie are mențiune în consolidare. Legea nr. 176/2016 (MO nr. 808 din 13.10.2016) rescrie alin. (1) „la 16-10-2016” și introduce 24 ianuarie. Textul legii e descărcat cu curl de pe `legislatie.just.ro/Public/DetaliiDocumentAfis/182520`. Ambele implementări primesc regula, iar 2016 are 12 sărbători, nu 13. Pe sondaj, cu curl pe `DetaliiDocument/128647`, s-au confirmat și cele trei mențiuni din plan: 09-03-2023, 16-03-2018 și 21-11-2016.
2. **exceljs nu curăță tot:** scoate controalele C0, dar lasă U+FFFE/U+FFFF, care rup `sharedStrings.xml`, și lipește cuvintele. S-a corectat afirmația „XLSX-ul iese valid”. S-a adăugat și un test de pază pentru Excelul foii de pontaj, care nu trece prin `raspunsDocument`.
3. **`avize.test.tsx` cădea pe timeout:** `getByRole` pe condica de 1.260 de rânduri dădea „Test timed out in 5000ms” în suita paralelă. Testul folosește acum `querySelector('[role="status"]')`, iar `describe` are `{ timeout: 20_000 }`. Același plafon îl are și `tipar.test.tsx`.
4. **e2e:** cele două foi de pontaj aveau același titlu de test (`p.cale.slice(0, 60)`), iar Playwright refuză titlurile duplicate (verificat: „duplicate test title”). Fiecare intrare are acum o `eticheta`.
5. **Verificările pe staging:** `grep -c` numără linii, iar HTML-ul Next are câteva linii foarte lungi. Fiecare text apare și în datele RSC. Pe producție s-a măsurat 1 la `grep -c` și 2 la `grep -o`. Așteptările „exact un rând” și „2” au devenit „cel puțin”.
6. **Sonda de tipar:** `networkidle` a expirat o dată pe `fisa-evaluare` de pe producție, așa că sonda așteaptă acum `load` plus 1,5 s. Linia de bază reală a fost rulată și e trecută în B6, la pasul 0.
7. Mărunțișuri: descrierile eșecurilor (vitest nu cade la import pentru un export lipsă), titlurile de test cu „20 zile”, liniile citate din pagina condicii și sonda XML din B2, care acoperă acum toate cele șase unelte.

Rămas, în afara secțiunii: pe copia completă a suitei, `src/app/(app)/pontaj/setari/formular-setari-pontaj.test.tsx` a picat o dată sub încărcare. Fișierul nu e atins de secțiune. `docs.test.ts` și `indemn-instalare.test.ts` au picat doar fiindcă pe copie lipseau `docs/` și `.claude/`.
