## J. Măsurare și conversie: știm cine folosește uneltele și îi aducem în aplicație

**Scop:** fiecare descărcare și fiecare cont venit dintr-o unealtă se numără pe server, fără date personale, iar cine a generat un document vede imediat ce face aplicația în locul uneltei, cu o adresă de înregistrare care spune din ce unealtă a venit.

**De ce:** auditul de utilizare din 8 oct 2026 (agentul „utilizare”, verificat adversarial) a acoperit 35 de zile de date, 3 sept – 8 oct:

- **0 descărcări umane** pe toate cele 7 unelte și pe toate formatele. Din 275 de cereri spre `/api/unelte/*`, 258 veneau de la serverul însuși (`2a02:c207:2316:2304::1`, auditurile noastre), iar celelalte 17 erau boți (OVH `158.69.*` cu UA de Chrome, `jscrawler`, un scaner de `.env`, `meta-externalagent`, `SEO-audit-check`).
- **Umami nu vede vizitatorii cu blocant.** Singurul om care a folosit o unealtă și și-a făcut cont (30 sept, 13:33 Google → foaia de pontaj cu 2 angajați → 13:36 `POST /inregistrare`) lipsește complet din Umami: nicio cerere `/api/send` de la IP-ul lui. Verificatorul a confirmat cauza în cod: `ScriptUmami` pune `data-do-not-track="true"` (`src/app/(marketing)/_componente/analitice.tsx:116`).
- **Descărcările nu sunt numărate durabil nicăieri pe server.** `src/lib/unelte/raspuns.ts` și `src/app/api/unelte/foaie-de-pontaj/route.ts` nu scriu nimic. Ora și UA există doar în `docker logs strawboss-nginx-1`, un stdout comun pentru ~10 site-uri, care se pierde la recrearea containerului.
- **Aterizările din Google apar în nginx cu IP-ul proxy-ului de preîncărcare** (`2001:4860:7:226::/64` și `2001:4860:7:626::/64`, confirmate pe geofeed-ul oficial Chrome Prefetch Proxy), iar omul apare abia la cererile următoare.
- **Singura conversie organică documentată din tot site-ul a venit dintr-o unealtă**, iar contul a fost abandonat în aceeași zi. Uneltele aduc 2 din cele 5 clicuri organice ale site-ului pe 90 de zile.
- Am verificat azi pe Umami (API, citire): goal-ul „Descărcări foaie de pontaj” (`948522f2…`) numără evenimentul `foaie-excel`, pe care nu-l mai emite nimic din `src/`. Butoanele trimit `foaie-pdf|docx|xlsx` (`descarcari.tsx:32`). **Panoul arată zero pentru totdeauna, oricâte descărcări ar fi.**
- Paginile de unealtă au CTA-ul spre `/inregistrare` doar în banda de jos (`foaie-de-pontaj/page.tsx:354`, `RO.hero.ctaPrimar.href`), fără nicio marcă de proveniență. Un cont venit dintr-o unealtă nu se deosebește de unul venit din antet.

**Decizii luate**

1. **Numărătoarea de referință e un eveniment Umami trimis de pe server, nu o tabelă și nu un contor în proces.**
   - Fără tabelă: uneltele publice nu ating baza (constrângere globală), iar o migrare plus RLS ar costa mai mult decât informația, la volumul de azi (0–2 evenimente pe săptămână).
   - Fără contor în memorie sau în fișier: `administrativo-web` rulează în 2 replici (`docker ps`), deci fiecare replică ar număra jumătate și ar pierde totul la repornire.
   - Umami e deja o bază durabilă (Postgres în stack-ul `umami`), cu API și panou. Am verificat azi, din containerul `administrativo_administrativo-web.1`, că `https://analitice.administrativo.ro/api/send` răspunde, ca și `http://umami:3000/api/send` (400 la corp gol, deci nu s-a scris nimic).
   - Adresa de trimitere se derivă din `NEXT_PUBLIC_UMAMI_SRC`, deci nu e nevoie de o variabilă nouă în `docker-stack.yml`, unde o variabilă nelistată nu ajunge în container (memoria „timerul systemd…”).
2. **Ce pleacă la Umami: nimic care să identifice omul.** Am citit sursa `api/send` din Umami 3.3.1 (`src/app/api/send/route.ts`, `src/lib/detect.ts`, de pe GitHub, tag `v3.3.1`; containerul confirmă 3.3.1):
   - `payload.ip` și `payload.userAgent` bat antetele cererii. Trimitem `ip: "127.0.0.1"`: `getLocation` ignoră adresele locale, deci rămâne fără țară, fără oraș și fără IP-ul serverului (care ar fi dat „DE”, adică exact țara auditurilor noastre).
   - Trimitem un UA fix, `Mozilla/5.0 (X11; Linux x86_64) Administrativo/1.0`. Am verificat cu `isbot` 5.1.31 și 5.2.2, versiunile pe care le acceptă Umami (`^5.2.1`): `false`, deci nu e aruncat ca „beep boop”.
   - Trimitem `browser/os/device: "server"`. Sesiunea Umami e `uuid(site, ip, ua, sare lunară)`, deci toate evenimentele de server ale unei luni stau într-o singură sesiune. Nu se poate lega nimic de un om.
   - Evenimentul e doar un nume: `dl:<unealtă>:<format>:<clasă>` sau `cont:<sursă>`. `event_name` e `varchar(50)` (`prisma/schema.prisma:140`). Un test verifică toate combinațiile din hartă, cel mai lung nume are azi 45 de caractere.
   - `/api/websites/:id/stats` numără vizitatori doar din sesiunile cu pagini vizualizate (`having … > 0` în `getWebsiteStats`), deci sesiunea de server nu umflă cifra de vizitatori.
3. **Clasa se decide pe server, dintr-o singură privire la antete, apoi antetele se aruncă.** Ordinea:
   - **audit**: `?m=` în adresă, IP-ul serverului (`62.171.154.194`, `2a02:c207:2316:2304::1`, din `cf-connecting-ip` sau primul `x-forwarded-for`) sau UA `SEO-audit-check`;
   - **robot**: UA gol sau UA de bot, crawler sau client HTTP;
   - **om**: `Sec-Fetch-User: ?1`, adică navigare pornită de un clic. Butoanele de descărcare sunt `formAction` într-un formular GET (`descarcari.tsx`), deci un clic real trimite antetul ăsta;
   - **neconfirmat**: restul. Aici intră preîncărcările, a doua cerere a managerului de descărcări din Android, browserele fără `Sec-Fetch` și boții care se dau drept Chrome, cum era OVH-ul din audit.

   **Cookie-ul de sesiune NU se citește.** Ar fi deosebit echipa de vizitatori, dar ar fi însemnat folosirea unui cookie de autentificare în alt scop. Echipa rămâne în „om”, iar raportul o spune.
4. **Numărăm și vizitatorii cu blocant sau cu DNT, conștient.** Comentariul din `deploy/umami/docker-stack.yml` spune că blocantul nu se ocolește. Nu-l ocolim:
   - nu urmărim pe nimeni de la o pagină la alta;
   - nu punem nimic în browser;
   - nu trimitem nimic din browser.

   Serverul numără un fapt pe care îl vede oricum: s-a cerut un PDF. Azi faptul ăsta stă, cu IP cu tot, în jurnalul nginx. După această secțiune stă fără IP într-o numărătoare. Politica de confidențialitate o spune explicit (J3). Am lăsat totuși întrebarea la utilizator, fiindcă schimbă o poziție scrisă în repo.
5. **Trimiterea nu întârzie și nu poate strica descărcarea.**
   - Merge prin `after()` din `next/server`, documentat pentru Route Handlers și Server Functions în `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`, cu termen de 3 s.
   - Orice excepție din numărare e prinsă, inclusiv `E468`, pe care `after` îl aruncă sincron în afara unei cereri (am citit `next/dist/server/after/after.js`).
   - Testele existente ale rutelor nu ating rețeaua: cererile lor n-au `host: administrativo.ro`, deci nu se programează nimic, iar unde s-ar programa, `after` aruncă `E468` în afara unei cereri și eroarea e prinsă.
6. **Rutele se învelesc, nu se rescriu.** Rutele sunt rescrise de A5, B, E și F, deci J3 nu le atinge corpul:
   - `export async function GET(` devine `async function genereaza(`, iar la final se adaugă `export const GET = cuNumarare(genereaza);`;
   - unealta se citește din cale (`/api/unelte/<segment>`), formatul din `content-disposition` al răspunsului;
   - un test de pază cere învelișul pe fiecare `route.ts` de sub `src/app/api/unelte/`, oricâte vor fi atunci.
7. **Atribuirea conversiei prin UTM, nu printr-un parametru nou.**
   - CTA-urile uneltelor duc la `/inregistrare?utm_source=unealta&utm_medium=<loc>&utm_campaign=<slug>`. A4 păstrează `utm_*` în Umami, deci și pâlnia din browser vede sursa.
   - Pagina de înregistrare citește `utm_campaign` doar dacă `utm_source=unealta` și slug-ul există în hartă.
   - Acțiunea programează `cont:<slug>` pe server după ce organizația s-a creat. O sursă stricată devine `null` (`.catch(null)` în Zod) și nu oprește niciodată o înregistrare.
8. **CTA-ul e pe pagină, după document, nu doar în banda de jos.**
   - Se randează pe server când adresa poartă date de formular (`areDateDeFormular` din A2), adică după „Generează”.
   - Altfel stă ascuns (`hidden`) și apare la primul clic pe un buton de descărcare, printr-un client component de 15 rânduri. Descărcarea directă nu reîncarcă pagina, iar fără asta cine descarcă direct n-ar vedea nimic.
   - Textul e pe unealtă și numește modulul care face lucrul ăla. Prețul se calculează din `preturi.ts` (`PRET_NUCLEU`, `PRETURI_MODULE`), cu „prima lună gratuită” și „fără TVA adăugat”, ca pe `/preturi`.
   - Pentru SSM spunem cinstit ce scrie și în fișa modulului (`fise-module.ts:248`): fișa semnată rămâne pe hârtie, aplicația ține evidența.
   - Pentru salarizare nu promitem aceleași cifre ca în calculator. Secțiunea D arată că motorul nu aplică încă facilitatea OUG 89/2025.
9. **„Salvează configurația în cont” și „importă angajații din foaie” nu se fac.** Ambele cer ca numele scrise de vizitator să supraviețuiască drumului înregistrare → e-mail → invitație → `/bun-venit`. E-mailul se deschide adesea pe alt dispozitiv, deci `localStorage` nu ajunge. Rămân două variante, ambele respinse:
   - stocare pe server a numelor unui vizitator anonim, adică bază pentru unelte, plus date personale fără cont și fără temei clar;
   - numele în adresa de înregistrare, adică exact scurgerea pe care o repară secțiunea A.

   Volumul (1 conversie în 35 de zile) nu justifică riscul. Revenim după 8 săptămâni de date din J6.
10. **Raportul e un script la cerere, nu un timer.**
    - `node scripts/raport-unelte/raport.mjs` scoate ultima săptămână ISO încheiată din API-ul Umami: vizitatori RO pe unealtă, descărcări pe clasă și format, conturi pe sursă și evenimentele din browser.
    - Partea pură e în `.mjs` testat, fiindcă pe VM rulează Node 20, fără eliminarea tipurilor.
    - Un timer ar trimite săptămânal zerouri și ar cere un fișier `/etc/administrativo/*.env` în plus (vezi `deploy/push-livrare.service`).
11. **Panoul Umami se repară.**
    - Goal-ul mort `foaie-excel` se șterge, dar doar dacă încă ține valoarea veche.
    - Se adaugă goal-uri pe evenimente de server: `dl:foaie-de-pontaj:xlsx:om`, `cont:foaie-de-pontaj`, `cont:cerere-concediu-de-odihna`.
    - Un test cere ca fiecare goal pe eveniment din `scripts/umami-goaluri.sh` să numere un eveniment pe care codul chiar îl emite.
    - Pâlniile nu primesc evenimente de server: acelea stau în altă sesiune, deci nu se leagă cu paginile.
12. **Fără schimbări nginx în J.** A6 deține `log_format durate`. Cu numărătoarea pe server, jurnalul nu mai e sursa cifrelor. Regula preîncărcării Google se scrie în antetul `raport.mjs` și în memoria `erp-analitice-fapte-verificate` (J8).
13. **Cache-ul descărcărilor e al secțiunii A** (A5: `private, no-store`). J îl consumă: o a doua descărcare identică ajunge la server și se numără.

**Harta fișierelor**

| Fișier | Responsabilitate | Task |
| --- | --- | --- |
| `src/lib/unelte/masurare.ts` (Create) | Clasa cererii, unealta din cale, formatul din răspuns, numele evenimentelor, sursa conversiei; pur, fără `server-only` | J1 |
| `src/lib/unelte/masurare.test.ts` (Create) | Tabelul de UA-uri reale din audit, IP-urile serverului, gazdele, lungimile de nume | J1 |
| `src/lib/unelte/umami-server.ts` (Create) | `configUmami`, `corpEveniment`, `trimiteEveniment`, `programeaza` (`after`), `cuNumarare`, `numaraConversia` | J2 |
| `src/lib/unelte/umami-server.test.ts` (Create) | Corpul fără IP/UA, Umami căzut/lent, `E468`, HEAD/400/staging | J2 |
| `src/app/api/unelte/[unealta]/route.ts` (Modify) | `GET = cuNumarare(genereaza)` | J3 |
| `src/app/api/unelte/foaie-de-pontaj/route.ts` (Modify) | idem | J3 |
| `src/app/api/unelte/condica-de-prezenta/route.ts` (E), `cerere-concediu/route.ts` (F), `foaie-de-parcurs/route.ts` (G), `fisa-evaluare/route.ts` (I7) (Modify, dacă există) | idem; aliasul `cerere-concediu-de-odihna/route.ts` (F) rămâne neatins, fiindcă deleagă la un GET deja învelit | J3 |
| `src/app/api/unelte/numarare.test.ts` (Create) | Paza: fiecare `route.ts` de unealtă e învelit; fiecare dosar static se leagă de o unealtă | J3 |
| `src/app/api/unelte/[unealta]/route.test.ts` (Modify, aditiv) | Integrare: descărcarea de om a primei unelte din registru pleacă drept `dl:<unealtă>:pdf:om`, fără IP/UA | J3 |
| `src/content/legal/confidentialitate.ts` (Modify) | Secțiunea 8: numărarea pe server, ce conține, ce nu | J3 |
| `src/content/legal/confidentialitate.test.ts` (Modify; creat de A7) | Politica spune numărarea pe server | J3 |
| `src/content/landing/harta.ts` (Modify) | `actualizat` pe `/legal/confidentialitate` (J3) și pe paginile de unelte (J5) | J3, J5 |
| `src/app/(auth)/inregistrare/schema.ts` (Modify) | Câmpul `sursa`, care nu poate respinge | J4 |
| `src/app/(auth)/inregistrare/actions.ts` (Modify) | `numaraConversia(...)` după crearea organizației | J4 |
| `src/app/(auth)/inregistrare/page.tsx` (Modify) | Citește sursa din UTM | J4 |
| `src/app/(auth)/inregistrare/formular-inregistrare.tsx` (Modify) | Trimite `sursa` cu acțiunea | J4 |
| `src/app/(auth)/inregistrare/actions.test.ts` (Create) | Conversia numărată cu sursa; sursa stricată nu oprește contul | J4 |
| `src/content/landing/cta-unelte.ts` (Create) | Textul pe unealtă, prețul din `preturi.ts`, `adresaInregistrare` | J5 |
| `src/app/(marketing)/_componente/continua-in-aplicatie.tsx` (Create) | `ContinuaInAplicatie`, `aGenerat` | J5 |
| `src/app/(marketing)/_componente/revelare-dupa-descarcare.tsx` (Create) | Client: arată CTA-ul la clicul pe o descărcare | J5 |
| `src/app/(marketing)/_componente/continua-in-aplicatie.test.tsx` (Create) | Componenta + paza pe paginile de unelte | J5 |
| `src/app/(marketing)/unelte/*/page.tsx` (Modify, toate paginile de unealtă) | CTA după document; banda de jos cu `adresaInregistrare` | J5 |
| `scripts/raport-unelte/agregare.mjs` (Create) | Partea pură a raportului | J6 |
| `scripts/raport-unelte/agregare.test.ts` (Create) | Săptămâna ISO, parsarea, tabelul | J6 |
| `scripts/raport-unelte/raport.mjs` (Create) | CLI: autentificare Umami, cereri, tipărire | J6 |
| `scripts/umami-goaluri.sh` (Modify) | Șterge goal-ul mort, adaugă goal-uri pe evenimente de server | J7 |
| `scripts/umami-goaluri.test.ts` (Create) | Fiecare goal numără un eveniment emis | J7 |
| — | Deploy staging → (confirmare) → producție, verificare live, memoria | J8 |

**Dependențe între secțiuni:**
- J3 rulează după A5 (antetul `private, no-store`), A7 (textul din secțiunea 8 a politicii, pe care J3 îl extinde) și după E, F, G, H și I: E, F, G și I7 creează rute statice sub `src/app/api/unelte/` (condica, cererea, foaia de parcurs, fișa de evaluare), iar H5 și K8–K10 ating `[unealta]/route.ts` și testul lui. Rutele se învelesc toate deodată; o rută creată DUPĂ J3 face paza din `numarare.test.ts` roșie, deci secțiunea care o creează trebuie să o scrie direct ca `export const GET = cuNumarare(genereaza)`.
- J5 rulează după A2 (`areDateDeFormular`) și după B, C, E, F, G, H, I și K (paginile de unealtă în forma finală; K adaugă patru unelte noi: `calculator-zile-lucratoare`, `cerere-demisie`, `programare-concedii`, `adeverinta-salariat`, pentru care `cta-unelte.ts` are deja intrări). O pagină de unealtă creată DUPĂ J5 face roșu testul „fiecare pune îndemnul după document”.
- Ordinea internă: J1 → J2 → J3, J4. J1 → J5, J6, J7. J8 vine ultimul.

Formatarea: codul e scris pentru `printWidth: 100` (`.prettierrc.json`). Dacă `prettier --check` cade pe un fișier al taskului, rulezi `pnpm exec prettier --write` pe același fișier, rerulezi testele taskului și abia apoi comiți.

---

### Task J1: clasa cererii și numele evenimentelor

**Fișiere:**
- Create: `src/lib/unelte/masurare.ts`
- Test: `src/lib/unelte/masurare.test.ts` (proiectul `unit`, `environment: "node"`)

**Interfețe:**
- Consumă: `PAGINI: readonly Pagina[]` din `@/content/landing/harta` (verificat: `export const PAGINI` la `harta.ts:91`, fiecare `Pagina` are `cale: string`). Globalele `Headers`, `Request`, `Response`, `URL`, `URLSearchParams` (Node 20).
- Produce:

```ts
export const DOMENIU_MASURAT: "administrativo.ro";
export const SURSA_UTM_UNEALTA: "unealta";
export const LUNGIME_MAXIMA_NUME: 50;
export const IP_SERVER: ReadonlySet<string>;
export type Clasa = "audit" | "robot" | "om" | "neconfirmat";
export const CLASE: readonly Clasa[];
export const FORMATE_NUMARATE: ReadonlySet<string>;
export const SLUGURI_UNELTE: ReadonlySet<string>;
export type ParametriPagina = Readonly<Record<string, string | string[] | undefined>>;
export type EvenimentServer = Readonly<{ nume: string; cale: string }>;
export function ipClient(antete: Pick<Headers, "get">): string | null;
export function esteRobot(agent: string): boolean;
export function clasificaCererea(antete: Pick<Headers, "get">, parametri: URLSearchParams): Clasa;
export function gazdaMasurata(antete: Pick<Headers, "get">): boolean;
export function unealtaDinCale(cale: string): string | null;
export function formatDinRaspuns(raspuns: Response): string | null;
export function numeEvenimentDescarcare(unealta: string, format: string, clasa: Clasa): string;
export function numeEvenimentCont(sursa: string | null): string;
export function sursaConversiei(brut: unknown): string | null;
export function sursaDinParametri(p: ParametriPagina): string | null;
export function evenimentDescarcare(cerere: Request, raspuns: Response): EvenimentServer | null;
export function evenimentCont(sursa: unknown, antete: Pick<Headers, "get">): EvenimentServer | null;
```

- [ ] **Pasul 1: Scrie testul care pică** — `src/lib/unelte/masurare.test.ts`:

```ts
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CLASE,
  DOMENIU_MASURAT,
  FORMATE_NUMARATE,
  LUNGIME_MAXIMA_NUME,
  SLUGURI_UNELTE,
  clasificaCererea,
  esteRobot,
  evenimentCont,
  evenimentDescarcare,
  formatDinRaspuns,
  ipClient,
  numeEvenimentCont,
  numeEvenimentDescarcare,
  sursaConversiei,
  sursaDinParametri,
  unealtaDinCale,
} from "./masurare";

/** UA-uri reale: cele din jurnalul auditului din 8 oct 2026, plus telefoanele uzuale. */
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const ANDROID_DESCARCARI =
  "AndroidDownloadManager/14 (Linux; U; Android 14; SM-A546B Build/UP1A.231005.007)";
const CUBOT =
  "Mozilla/5.0 (Linux; Android 10; Cubot X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const OVH_CA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SAFARI_15 =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15";
const META =
  "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)";
const HEADLESS =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36";

const antete = (a: Record<string, string>) => new Headers(a);
const fara = new URLSearchParams();

describe("clasificaCererea", () => {
  it("un clic real pe o descărcare e „om”", () => {
    expect(clasificaCererea(antete({ "user-agent": IPHONE, "sec-fetch-user": "?1" }), fara)).toBe(
      "om",
    );
    expect(clasificaCererea(antete({ "user-agent": ANDROID, "sec-fetch-user": "?1" }), fara)).toBe(
      "om",
    );
  });

  it("fără semnul clicului, aceeași cerere e „neconfirmat”, nu „om”", () => {
    expect(clasificaCererea(antete({ "user-agent": IPHONE }), fara)).toBe("neconfirmat");
    // A doua cerere, a managerului de descărcări din Android, nu dublează oamenii.
    expect(clasificaCererea(antete({ "user-agent": ANDROID_DESCARCARI }), fara)).toBe(
      "neconfirmat",
    );
    // Safari sub 16.4 nu trimite Sec-Fetch: subnumărare acceptată, nu supranumărare.
    expect(clasificaCererea(antete({ "user-agent": SAFARI_15 }), fara)).toBe("neconfirmat");
    // Botul OVH din audit (5 sept), care se dădea drept Chrome.
    expect(clasificaCererea(antete({ "user-agent": OVH_CA_CHROME }), fara)).toBe("neconfirmat");
  });

  it("boții și clienții HTTP sunt „robot”, chiar dacă trimit Sec-Fetch-User", () => {
    for (const ua of [META, HEADLESS, "curl/8.5.0", "python-requests/2.31", "node", ""]) {
      expect(clasificaCererea(antete({ "user-agent": ua, "sec-fetch-user": "?1" }), fara), ua).toBe(
        "robot",
      );
    }
    expect(clasificaCererea(antete({}), fara)).toBe("robot");
  });

  it("un telefon Cubot nu e robot doar pentru că are „bot” în nume", () => {
    expect(esteRobot(CUBOT)).toBe(false);
    expect(clasificaCererea(antete({ "user-agent": CUBOT, "sec-fetch-user": "?1" }), fara)).toBe(
      "om",
    );
  });

  it("auditurile noastre bat orice alt semn", () => {
    const om = { "user-agent": IPHONE, "sec-fetch-user": "?1" };
    expect(clasificaCererea(antete(om), new URLSearchParams("m=1791483495"))).toBe("audit");
    expect(clasificaCererea(antete({ ...om, "cf-connecting-ip": "62.171.154.194" }), fara)).toBe(
      "audit",
    );
    expect(
      clasificaCererea(
        antete({ ...om, "x-forwarded-for": "2a02:c207:2316:2304::1, 172.69.130.85" }),
        fara,
      ),
    ).toBe("audit");
    expect(
      clasificaCererea(antete({ ...om, "cf-connecting-ip": "::ffff:62.171.154.194" }), fara),
    ).toBe("audit");
    expect(clasificaCererea(antete({ "user-agent": "SEO-audit-check" }), fara)).toBe("audit");
  });

  it("IP-ul se ia din Cloudflare, apoi din primul x-forwarded-for", () => {
    expect(ipClient(antete({ "cf-connecting-ip": " 82.137.40.16 " }))).toBe("82.137.40.16");
    expect(ipClient(antete({ "x-forwarded-for": "82.137.40.16, 172.69.130.85" }))).toBe(
      "82.137.40.16",
    );
    expect(ipClient(antete({}))).toBeNull();
  });
});

describe("unealta și formatul", () => {
  it("harta are toate uneltele de azi și nu are hub-ul", () => {
    for (const slug of [
      "foaie-de-pontaj",
      "condica-de-prezenta",
      "cerere-concediu-de-odihna",
      "foaie-de-parcurs",
      "fisa-instruire-ssm",
      "fisa-evaluare",
      "calculator-salariu",
    ]) {
      expect(SLUGURI_UNELTE.has(slug), slug).toBe(true);
    }
    expect(SLUGURI_UNELTE.has("unelte")).toBe(false);
    expect(SLUGURI_UNELTE.has("")).toBe(false);
  });

  it("calea rutei dă unealta paginii, inclusiv prin alias", () => {
    expect(unealtaDinCale("/api/unelte/foaie-de-pontaj")).toBe("foaie-de-pontaj");
    expect(unealtaDinCale("/api/unelte/cerere-concediu")).toBe("cerere-concediu-de-odihna");
    expect(unealtaDinCale("/api/unelte/fisa-evaluare/x")).toBe("fisa-evaluare");
    for (const cale of [
      "/api/unelte/constructor",
      "/api/unelte/__proto__",
      "/api/unelte/hasOwnProperty",
      "/api/unelte/",
      "/unelte/foaie-de-pontaj",
    ]) {
      expect(unealtaDinCale(cale), cale).toBeNull();
    }
  });

  it("formatul se citește din numele fișierului atașat", () => {
    const cu = (d: string) => new Response("x", { headers: { "content-disposition": d } });
    expect(formatDinRaspuns(cu('attachment; filename="pontaj-2026-10.xlsx"'))).toBe("xlsx");
    expect(formatDinRaspuns(cu("attachment; filename*=UTF-8''cerere.pdf"))).toBe("pdf");
    expect(formatDinRaspuns(cu('attachment; filename="arhiva.zip"'))).toBe("alt");
    expect(formatDinRaspuns(cu('inline; filename="x.pdf"'))).toBeNull();
    expect(formatDinRaspuns(new Response("x"))).toBeNull();
  });

  it("niciun nume de eveniment nu depășește coloana din Umami", () => {
    for (const slug of SLUGURI_UNELTE) {
      for (const format of [...FORMATE_NUMARATE, "alt"]) {
        for (const clasa of CLASE) {
          const nume = numeEvenimentDescarcare(slug, format, clasa);
          expect(nume.length, nume).toBeLessThanOrEqual(LUNGIME_MAXIMA_NUME);
        }
      }
      expect(numeEvenimentCont(slug).length, slug).toBeLessThanOrEqual(LUNGIME_MAXIMA_NUME);
    }
    expect(numeEvenimentCont(null)).toBe("cont:direct");
  });
});

describe("evenimentDescarcare", () => {
  const fisier = () =>
    new Response("%PDF", {
      headers: { "content-disposition": 'attachment; filename="condica-prezenta-2026-10.pdf"' },
    });
  const cerere = (gazda: string, metoda = "GET") =>
    new Request("http://localhost/api/unelte/condica-de-prezenta?format=pdf&luna=10", {
      method: metoda,
      headers: { host: gazda, "user-agent": IPHONE, "sec-fetch-user": "?1" },
    });

  it("o descărcare de om pe domeniul măsurat dă numele și pagina uneltei", () => {
    expect(evenimentDescarcare(cerere("administrativo.ro"), fisier())).toEqual({
      nume: "dl:condica-de-prezenta:pdf:om",
      cale: "/unelte/condica-de-prezenta",
    });
  });

  it("staging, localhost, HEAD și răspunsurile fără fișier nu se numără", () => {
    expect(evenimentDescarcare(cerere("staging.administrativo.ro"), fisier())).toBeNull();
    expect(evenimentDescarcare(cerere("localhost:3000"), fisier())).toBeNull();
    expect(evenimentDescarcare(cerere("administrativo.ro", "HEAD"), fisier())).toBeNull();
    expect(
      evenimentDescarcare(cerere("administrativo.ro"), new Response("x", { status: 400 })),
    ).toBeNull();
    expect(
      evenimentDescarcare(
        cerere("administrativo.ro"),
        new Response(null, { status: 303, headers: { location: "/unelte/x" } }),
      ),
    ).toBeNull();
  });
});

describe("sursa conversiei", () => {
  it("se ia doar din campania unei unelte existente", () => {
    expect(
      sursaDinParametri({ utm_source: "unealta", utm_campaign: "foaie-de-pontaj" }),
    ).toBe("foaie-de-pontaj");
    expect(sursaDinParametri({ utm_source: "fisier", utm_campaign: "foaie-de-pontaj" })).toBeNull();
    expect(sursaDinParametri({ utm_source: "unealta", utm_campaign: "inexistenta" })).toBeNull();
    expect(
      sursaDinParametri({ utm_source: "unealta", utm_campaign: ["foaie-de-pontaj", "x"] }),
    ).toBeNull();
    expect(sursaDinParametri({})).toBeNull();
    for (const brut of ["__proto__", "constructor", 42, null, undefined, "x".repeat(500)]) {
      expect(sursaConversiei(brut)).toBeNull();
    }
  });

  it("contul se numără doar pe domeniul măsurat și nu pentru audituri sau roboți", () => {
    const om = { host: DOMENIU_MASURAT, "user-agent": IPHONE };
    expect(evenimentCont("foaie-de-pontaj", antete(om))).toEqual({
      nume: "cont:foaie-de-pontaj",
      cale: "/inregistrare",
    });
    expect(evenimentCont("nu-exista", antete(om))?.nume).toBe("cont:direct");
    expect(evenimentCont(null, antete({ ...om, host: "staging.administrativo.ro" }))).toBeNull();
    expect(
      evenimentCont(null, antete({ ...om, "cf-connecting-ip": "62.171.154.194" })),
    ).toBeNull();
    expect(evenimentCont(null, antete({ ...om, "user-agent": "curl/8.5.0" }))).toBeNull();
  });
});

describe("un singur domeniu, scris o dată", () => {
  it("e același cu data-domains din scriptul Umami", () => {
    const sursa = readFileSync("src/app/(marketing)/_componente/analitice.tsx", "utf8");
    expect(/data-domains="([^"]+)"/u.exec(sursa)?.[1]).toBe(DOMENIU_MASURAT);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte/masurare.test.ts
```

Așteptat: `Failed to resolve import "./masurare"` (fișierul nu există), cu toate testele căzute.

- [ ] **Pasul 3: Implementarea minimă** — `src/lib/unelte/masurare.ts`:

```ts
// src/lib/unelte/masurare.ts
import { PAGINI } from "@/content/landing/harta";

/**
 * Numărarea uneltelor gratuite pe server: ce s-a cerut, nu cine a cerut.
 *
 * ── DE CE PE SERVER ───────────────────────────────────────────────────────
 * Auditul din 8 oct 2026, pe 35 de zile: zero evenimente de descărcare de la
 * vizitatori externi în Umami, iar singurul om care și-a făcut cont dintr-o
 * unealtă (30 sept, foaia de pontaj) lipsește cu totul din Umami — avea
 * măsurarea blocată. Descărcarea și înregistrarea trec oricum prin server, deci
 * se pot număra acolo, fără să depindă de browser.
 *
 * ── CE PLEACĂ ȘI CE NU ────────────────────────────────────────────────────
 * Pleacă un nume: `dl:<unealtă>:<format>:<clasă>` sau `cont:<sursă>`. NU pleacă
 * adresa IP, identificarea browserului, cookie-urile sau valorile din formular.
 * IP-ul și antetele se citesc aici o singură dată, ca să aleagă clasa, și se
 * aruncă. Cookie-ul de sesiune NU se citește deloc: ar fi deosebit echipa de
 * vizitatori, dar ar fi însemnat folosirea unui cookie de autentificare în alt
 * scop decât autentificarea.
 *
 * ── DE CE FĂRĂ `server-only` ──────────────────────────────────────────────
 * E pur — antete, șiruri, adrese —, deci îl testează direct proiectul `unit`,
 * iar pagina de înregistrare îl folosește la randare. Trimiterea, care chiar
 * iese în rețea, stă în `umami-server.ts`.
 */

/** Singurul domeniu numărat. Aceeași valoare ca `data-domains` din `ScriptUmami` (test). */
export const DOMENIU_MASURAT = "administrativo.ro";

/** `utm_source` al adreselor de înregistrare puse pe unelte (`cta-unelte.ts`). */
export const SURSA_UTM_UNEALTA = "unealta";

/** `website_event.event_name` e `varchar(50)` în Umami 3.3.1 (`prisma/schema.prisma`). */
export const LUNGIME_MAXIMA_NUME = 50;

/**
 * Adresele serverului însuși, de unde pleacă auditurile noastre (curl,
 * playwright). În jurnalul din 8 oct 2026, 258 din 275 de cereri spre
 * `/api/unelte` veneau de la adresa IPv6 de mai jos.
 */
export const IP_SERVER: ReadonlySet<string> = new Set([
  "62.171.154.194",
  "2a02:c207:2316:2304::1",
]);

export type Clasa = "audit" | "robot" | "om" | "neconfirmat";

export const CLASE: readonly Clasa[] = ["om", "neconfirmat", "robot", "audit"];

export const FORMATE_NUMARATE: ReadonlySet<string> = new Set(["pdf", "docx", "xlsx"]);

/** Uneltele, din harta paginilor publice: o unealtă nouă se numără fără altă listă. */
export const SLUGURI_UNELTE: ReadonlySet<string> = new Set(
  PAGINI.flatMap((p) => {
    const slug = /^\/unelte\/([a-z0-9-]+)$/u.exec(p.cale)?.[1];
    return slug === undefined ? [] : [slug];
  }),
);

/** Rutele de API al căror segment diferă de adresa paginii. */
const ALIAS_API: Readonly<Record<string, string>> = {
  "cerere-concediu": "cerere-concediu-de-odihna",
};

export type ParametriPagina = Readonly<Record<string, string | string[] | undefined>>;

export type EvenimentServer = Readonly<{ nume: string; cale: string }>;

/** UA-ul cu care se recunoaște scriptul nostru de audit SEO (86.125.92.115, 8 oct 2026). */
const AGENT_AUDIT = /SEO-audit-check/iu;

/**
 * Boți, crawlere, previzualizări de link și clienți HTTP. Lista e scrisă pentru
 * ce trece prin `/api/unelte`, nu ca bibliotecă generală: ce scapă de ea cade în
 * „neconfirmat”, fiindcă un bot nu trimite `Sec-Fetch-User`.
 */
const AGENT_ROBOT =
  /bot|crawl|spider|slurp|scan|preview|headless|playwright|puppeteer|phantomjs|selenium|lighthouse|pagespeed|inspectiontool|mediapartners|externalagent|facebookexternalhit|whatsapp|curl\/|wget|python|httpx|aiohttp|go-http-client|java\/|okhttp|axios|node-fetch|undici|^node|libwww|scrapy|claude|chatgpt|perplexity/iu;

/** Telefoane cu „bot” în numele modelului; scoase înainte de potrivire. */
const MODEL_CU_BOT = /\bcubot\b/giu;

export function ipClient(antete: Pick<Headers, "get">): string | null {
  const brut =
    antete.get("cf-connecting-ip") ?? antete.get("x-forwarded-for")?.split(",")[0] ?? "";
  const ip = brut
    .trim()
    .toLowerCase()
    .replace(/^::ffff:(?=\d{1,3}(?:\.\d{1,3}){3}$)/u, "");
  return ip === "" ? null : ip;
}

export function esteRobot(agent: string): boolean {
  const curat = agent.replace(MODEL_CU_BOT, "").trim();
  return curat === "" || AGENT_ROBOT.test(curat);
}

/**
 * Clasa unei cereri. Ordinea e regula: un audit rămâne audit chiar dacă arată
 * ca un om, iar „om” cere semnul pe care îl pune doar o navigare pornită de un
 * clic — `Sec-Fetch-User: ?1`. Butoanele de descărcare sunt `formAction` într-un
 * formular GET, deci un clic real îl trimite. Fără el: „neconfirmat”.
 */
export function clasificaCererea(antete: Pick<Headers, "get">, parametri: URLSearchParams): Clasa {
  const agent = antete.get("user-agent") ?? "";
  const ip = ipClient(antete);
  if (parametri.has("m") || (ip !== null && IP_SERVER.has(ip)) || AGENT_AUDIT.test(agent)) {
    return "audit";
  }
  if (esteRobot(agent)) return "robot";
  return antete.get("sec-fetch-user") === "?1" ? "om" : "neconfirmat";
}

/** nginx trimite `Host: $host`; staging și localhost nu se numără în statistica producției. */
export function gazdaMasurata(antete: Pick<Headers, "get">): boolean {
  const gazda = (antete.get("host") ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/u, "");
  return gazda === DOMENIU_MASURAT;
}

export function unealtaDinCale(cale: string): string | null {
  const segment = /^\/api\/unelte\/([a-z0-9-]+)(?:\/|$)/u.exec(cale)?.[1];
  if (segment === undefined) return null;
  if (SLUGURI_UNELTE.has(segment)) return segment;
  const alias = Object.hasOwn(ALIAS_API, segment) ? ALIAS_API[segment] : undefined;
  return alias !== undefined && SLUGURI_UNELTE.has(alias) ? alias : null;
}

/** Formatul, din numele fișierului atașat; `null` dacă răspunsul nu e o descărcare. */
export function formatDinRaspuns(raspuns: Response): string | null {
  const dispozitie = raspuns.headers.get("content-disposition") ?? "";
  if (!/^\s*attachment\b/iu.test(dispozitie)) return null;
  const nume = /filename\*?=(?:utf-8'')?"?([^";]+)"?/iu.exec(dispozitie)?.[1] ?? "";
  const extensie = /\.([a-z0-9]{1,5})$/iu.exec(nume.trim())?.[1]?.toLowerCase() ?? "";
  return FORMATE_NUMARATE.has(extensie) ? extensie : "alt";
}

export function numeEvenimentDescarcare(unealta: string, format: string, clasa: Clasa): string {
  return `dl:${unealta}:${format}:${clasa}`;
}

export function numeEvenimentCont(sursa: string | null): string {
  return `cont:${sursa ?? "direct"}`;
}

export function sursaConversiei(brut: unknown): string | null {
  return typeof brut === "string" && SLUGURI_UNELTE.has(brut) ? brut : null;
}

/** Sursa unei înregistrări, din adresa pusă de `adresaInregistrare` pe unelte. */
export function sursaDinParametri(p: ParametriPagina): string | null {
  if (p["utm_source"] !== SURSA_UTM_UNEALTA) return null;
  return sursaConversiei(p["utm_campaign"]);
}

export function evenimentDescarcare(cerere: Request, raspuns: Response): EvenimentServer | null {
  if (cerere.method !== "GET" || raspuns.status !== 200) return null;
  if (!gazdaMasurata(cerere.headers)) return null;
  const adresa = new URL(cerere.url);
  const unealta = unealtaDinCale(adresa.pathname);
  const format = formatDinRaspuns(raspuns);
  if (unealta === null || format === null) return null;
  const clasa = clasificaCererea(cerere.headers, adresa.searchParams);
  return { nume: numeEvenimentDescarcare(unealta, format, clasa), cale: `/unelte/${unealta}` };
}

/**
 * Contul nou. Clasa nu intră în nume — înregistrarea are deja limitare de rată
 * și e mereu un om sau un test —, dar auditurile și roboții nu se numără.
 */
export function evenimentCont(
  sursa: unknown,
  antete: Pick<Headers, "get">,
): EvenimentServer | null {
  if (!gazdaMasurata(antete)) return null;
  const clasa = clasificaCererea(antete, new URLSearchParams());
  if (clasa === "audit" || clasa === "robot") return null;
  return { nume: numeEvenimentCont(sursaConversiei(sursa)), cale: "/inregistrare" };
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte/masurare.test.ts
```

Așteptat: toate testele `masurare.test.ts` verzi. Apoi lanțul:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check src/lib/unelte/masurare.ts src/lib/unelte/masurare.test.ts
```

- [ ] **Commit**

```bash
cd /srv/apps/ERP
C=(src/lib/unelte/masurare.ts src/lib/unelte/masurare.test.ts)
git status --short -- "${C[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "${C[@]}"
git commit --only -m "feat(unelte): clasa cererii și numele evenimentelor de server, fără date personale

Audit, robot, om (Sec-Fetch-User), neconfirmat; unealta din cale, formatul din
content-disposition; dl:<unealtă>:<format>:<clasă> și cont:<sursă>, sub cele 50
de caractere ale coloanei din Umami. Nu se citesc cookie-uri.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${C[@]}"
git merge origin/main
git push origin main
```

---

### Task J2: trimiterea la Umami, după răspuns

**Fișiere:**
- Create: `src/lib/unelte/umami-server.ts`
- Test: `src/lib/unelte/umami-server.test.ts` (proiectul `unit`)

**Interfețe:**
- Consumă: din J1 `DOMENIU_MASURAT`, `evenimentCont`, `evenimentDescarcare`, `type EvenimentServer`. `after` din `next/server`: `export declare function after<T>(task: AfterTask<T>): void` (`node_modules/next/dist/server/after/after.d.ts`), care aruncă sincron `E468` în afara unei cereri (`after.js`). `server-only` are alias de test în `vitest.config.mts:57`.
- Produce:

```ts
export const AGENT_SERVER: "Mozilla/5.0 (X11; Linux x86_64) Administrativo/1.0";
export const IP_FARA_LOCALIZARE: "127.0.0.1";
export type ConfigUmami = Readonly<{ adresa: string; site: string }>;
export type Cerere = (adresa: string, optiuni: RequestInit) => Promise<Response>;
export type Trimitere = (ev: EvenimentServer) => Promise<boolean>;
export type Programator = (sarcina: () => Promise<unknown>) => void;
export type OptiuniNumarare = Readonly<{ programator?: Programator; trimite?: Trimitere }>;
export function configUmami(src: string | undefined, site: string | undefined): ConfigUmami | null;
export function configUmamiDinMediu(): ConfigUmami | null;
export function corpEveniment(config: ConfigUmami, ev: EvenimentServer): Readonly<{ type: "event"; payload: Readonly<Record<string, string>> }>;
export function trimiteEveniment(ev: EvenimentServer, deps?: Readonly<{ config?: ConfigUmami | null; cerere?: Cerere }>): Promise<boolean>;
export function programeaza(ev: EvenimentServer | null, optiuni?: OptiuniNumarare): boolean;
export function cuNumarare<C extends Request, A extends unknown[]>(genereaza: (cerere: C, ...rest: A) => Promise<Response>, optiuni?: OptiuniNumarare): (cerere: C, ...rest: A) => Promise<Response>;
export function numaraConversia(sursa: unknown, antete: Pick<Headers, "get">, optiuni?: OptiuniNumarare): boolean;
```

- [ ] **Pasul 1: Scrie testul care pică** — `src/lib/unelte/umami-server.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EvenimentServer } from "./masurare";
import {
  AGENT_SERVER,
  IP_FARA_LOCALIZARE,
  type Programator,
  configUmami,
  configUmamiDinMediu,
  corpEveniment,
  cuNumarare,
  numaraConversia,
  programeaza,
  trimiteEveniment,
} from "./umami-server";

const CONFIG = {
  adresa: "http://analitice.test/api/send",
  site: "00000000-0000-4000-8000-000000000000",
} as const;
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IP_VIZITATOR = "82.137.40.16";
const EV: EvenimentServer = {
  nume: "dl:condica-de-prezenta:pdf:om",
  cale: "/unelte/condica-de-prezenta",
};

function cerereOm(antete: Record<string, string> = {}, metoda = "GET"): Request {
  return new Request("http://localhost/api/unelte/condica-de-prezenta?format=pdf&luna=10", {
    method: metoda,
    headers: {
      host: "administrativo.ro",
      "user-agent": IPHONE,
      "sec-fetch-user": "?1",
      "cf-connecting-ip": IP_VIZITATOR,
      ...antete,
    },
  });
}

function fisier(): Response {
  return new Response("%PDF", {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="condica-prezenta-2026-10.pdf"',
    },
  });
}

function colector() {
  const sarcini: Array<() => Promise<unknown>> = [];
  const programator: Programator = (sarcina) => {
    sarcini.push(sarcina);
  };
  const trimise: EvenimentServer[] = [];
  const trimite = async (ev: EvenimentServer) => {
    trimise.push(ev);
    return true;
  };
  return { sarcini, programator, trimise, trimite };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("configurația", () => {
  it("adresa de trimitere vine din adresa scriptului", () => {
    expect(configUmami("http://analitice.test/script.js", " site-1 ")).toEqual({
      adresa: "http://analitice.test/api/send",
      site: "site-1",
    });
  });

  it("fără script, fără site sau cu o adresă stricată nu se trimite nimic", () => {
    expect(configUmami(undefined, "site-1")).toBeNull();
    expect(configUmami("http://analitice.test/script.js", "")).toBeNull();
    expect(configUmami("nu e o adresă", "site-1")).toBeNull();
  });

  it("din mediu citește variabilele publice ale scriptului", () => {
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SRC", "http://analitice.test/script.js");
    vi.stubEnv("NEXT_PUBLIC_UMAMI_ID", "site-1");
    expect(configUmamiDinMediu()).toEqual({
      adresa: "http://analitice.test/api/send",
      site: "site-1",
    });
  });
});

describe("corpul trimis", () => {
  it("are doar numele, pagina și valori fixe — nimic despre vizitator", () => {
    expect(corpEveniment(CONFIG, EV)).toEqual({
      type: "event",
      payload: {
        website: CONFIG.site,
        hostname: "administrativo.ro",
        url: "/unelte/condica-de-prezenta",
        name: EV.nume,
        ip: IP_FARA_LOCALIZARE,
        userAgent: AGENT_SERVER,
        browser: "server",
        os: "server",
        device: "server",
      },
    });
  });
});

describe("trimiteEveniment", () => {
  it("face POST la Umami, cu termen, și raportează reușita", async () => {
    const cerere = vi.fn(
      async (_adresa: string, _optiuni: RequestInit) =>
        new Response('{"cache":"x","sessionId":"s","visitId":"v"}'),
    );
    expect(await trimiteEveniment(EV, { config: CONFIG, cerere })).toBe(true);
    expect(cerere).toHaveBeenCalledTimes(1);
    expect(cerere.mock.calls[0]?.[0]).toBe(CONFIG.adresa);
    const optiuni = cerere.mock.calls[0]?.[1];
    expect(optiuni?.method).toBe("POST");
    expect(optiuni?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(optiuni?.body))).toEqual(corpEveniment(CONFIG, EV));
  });

  it("„beep boop”, un 400 sau o rețea căzută nu aruncă și nu sunt reușite", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const beep = async () => new Response('{"beep":"boop"}');
    const respins = async () => new Response("{}", { status: 400 });
    const cazut = async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    };
    for (const cerere of [beep, respins, cazut]) {
      expect(await trimiteEveniment(EV, { config: CONFIG, cerere })).toBe(false);
    }
  });

  it("fără configurație nu atinge rețeaua", async () => {
    const cerere = vi.fn(async (_adresa: string, _optiuni: RequestInit) => new Response("{}"));
    expect(await trimiteEveniment(EV, { config: null, cerere })).toBe(false);
    expect(cerere).not.toHaveBeenCalled();
  });
});

describe("cuNumarare", () => {
  it("întoarce exact răspunsul rutei și programează o singură trimitere", async () => {
    const { sarcini, programator, trimise, trimite } = colector();
    const raspuns = fisier();
    const GET = cuNumarare(async (_c: Request) => raspuns, { programator, trimite });
    expect(await GET(cerereOm())).toBe(raspuns);
    expect(sarcini).toHaveLength(1);
    await sarcini[0]?.();
    expect(trimise).toEqual([EV]);
  });

  it("Umami care nu răspunde niciodată nu întârzie descărcarea", async () => {
    const { sarcini, programator } = colector();
    const GET = cuNumarare(async () => fisier(), {
      programator,
      trimite: () => new Promise<boolean>(() => {}),
    });
    expect((await GET(cerereOm())).status).toBe(200);
    expect(sarcini).toHaveLength(1);
  });

  it("în afara unei cereri, `after` aruncă E468 — descărcarea merge mai departe", async () => {
    const GET = cuNumarare(async () => fisier());
    expect((await GET(cerereOm())).status).toBe(200);
    expect(programeaza(EV)).toBe(false);
  });

  it("HEAD, staging și erorile rutei nu se numără", async () => {
    const { sarcini, programator, trimite } = colector();
    const GET = cuNumarare(async () => fisier(), { programator, trimite });
    await GET(cerereOm({}, "HEAD"));
    await GET(cerereOm({ host: "staging.administrativo.ro" }));
    expect(sarcini).toHaveLength(0);

    const cade = cuNumarare(
      async (): Promise<Response> => {
        throw new Error("generare");
      },
      { programator, trimite },
    );
    await expect(cade(cerereOm())).rejects.toThrow("generare");
    expect(sarcini).toHaveLength(0);
  });

  it("păstrează al doilea argument al unei rute dinamice", async () => {
    const GET = cuNumarare(
      async (_c: Request, ctx: { params: Promise<{ unealta: string }> }) =>
        new Response((await ctx.params).unealta),
    );
    const r = await GET(new Request("http://localhost/api/unelte/fisa-evaluare"), {
      params: Promise.resolve({ unealta: "fisa-evaluare" }),
    });
    expect(await r.text()).toBe("fisa-evaluare");
  });

  it("corpul care pleacă nu poartă IP-ul sau browserul vizitatorului", async () => {
    const { sarcini, programator } = colector();
    const cerere = vi.fn(async (_adresa: string, _optiuni: RequestInit) => new Response("{}"));
    const GET = cuNumarare(async () => fisier(), {
      programator,
      trimite: (ev) => trimiteEveniment(ev, { config: CONFIG, cerere }),
    });
    await GET(cerereOm());
    await sarcini[0]?.();
    const corp = String(cerere.mock.calls[0]?.[1]?.body);
    expect(corp).not.toContain(IP_VIZITATOR);
    expect(corp).not.toContain("iPhone");
    expect(corp).toContain('"name":"dl:condica-de-prezenta:pdf:om"');
  });
});

describe("numaraConversia", () => {
  it("contul de pe administrativo.ro pleacă cu sursa lui", async () => {
    const { sarcini, programator, trimise, trimite } = colector();
    const antete = new Headers({ host: "administrativo.ro", "user-agent": IPHONE });
    expect(numaraConversia("foaie-de-pontaj", antete, { programator, trimite })).toBe(true);
    await sarcini[0]?.();
    expect(trimise).toEqual([{ nume: "cont:foaie-de-pontaj", cale: "/inregistrare" }]);
  });

  it("staging și serverul nostru nu se numără", () => {
    const { sarcini, programator, trimite } = colector();
    for (const antete of [
      new Headers({ host: "staging.administrativo.ro", "user-agent": IPHONE }),
      new Headers({
        host: "administrativo.ro",
        "user-agent": IPHONE,
        "cf-connecting-ip": "62.171.154.194",
      }),
    ]) {
      expect(numaraConversia("foaie-de-pontaj", antete, { programator, trimite })).toBe(false);
    }
    expect(sarcini).toHaveLength(0);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte/umami-server.test.ts
```

Așteptat: `Failed to resolve import "./umami-server"`.

- [ ] **Pasul 3: Implementarea minimă** — `src/lib/unelte/umami-server.ts`:

```ts
// src/lib/unelte/umami-server.ts
import "server-only";

import { after } from "next/server";

import {
  DOMENIU_MASURAT,
  evenimentCont,
  evenimentDescarcare,
  type EvenimentServer,
} from "./masurare";

/**
 * Trimiterea evenimentelor de server la Umami, DUPĂ ce răspunsul a plecat.
 *
 * ── CE ȘTIE UMAMI DESPRE NOI ──────────────────────────────────────────────
 * Am citit `api/send` din Umami 3.3.1: `payload.ip` și `payload.userAgent` bat
 * antetele cererii. `127.0.0.1` e o adresă locală, pe care `getLocation` o
 * ignoră: fără țară, fără oraș și fără IP-ul serverului, care ar fi dat „DE”,
 * adică țara auditurilor noastre. UA-ul fix trece de `isbot` (verificat pe
 * 5.1.31 și 5.2.2); un UA care conține „bot” sau „compatible;” ar fi primit
 * `{"beep":"boop"}` și nimic scris. Sesiunea Umami e `uuid(site, ip, ua, sare
 * lunară)`, deci toate evenimentele de server ale unei luni stau într-o singură
 * sesiune: nu se poate lega nimic de un om.
 *
 * ── DE CE `after()` ───────────────────────────────────────────────────────
 * Descărcarea nu așteaptă statistica. `after` rulează sarcina după răspuns, în
 * Route Handlers și în Server Functions. În afara unei cereri — teste, scripturi —
 * aruncă sincron `E468`; numărarea tace atunci, nu cade.
 */
export const AGENT_SERVER = "Mozilla/5.0 (X11; Linux x86_64) Administrativo/1.0";
export const IP_FARA_LOCALIZARE = "127.0.0.1";
const TERMEN_MS = 3000;

export type ConfigUmami = Readonly<{ adresa: string; site: string }>;
export type Cerere = (adresa: string, optiuni: RequestInit) => Promise<Response>;
export type Trimitere = (ev: EvenimentServer) => Promise<boolean>;
export type Programator = (sarcina: () => Promise<unknown>) => void;
export type OptiuniNumarare = Readonly<{ programator?: Programator; trimite?: Trimitere }>;

export function configUmami(src: string | undefined, site: string | undefined): ConfigUmami | null {
  const script = src?.trim() ?? "";
  const id = site?.trim() ?? "";
  if (script === "" || id === "") return null;
  try {
    return { adresa: new URL("/api/send", script).toString(), site: id };
  } catch {
    return null;
  }
}

/**
 * Scrise ÎNTREGI, nu prin `process.env[cheie]`: Next înlocuiește la build doar
 * forma literală, iar imaginea de producție nu are variabilele la rulare
 * (`Dockerfile`: `ENV NEXT_PUBLIC_UMAMI_*` doar în etapa de build). Ca la
 * `ScriptUmami`, lipsa lor înseamnă „nu se trimite nimic”, nu o eroare.
 */
export function configUmamiDinMediu(): ConfigUmami | null {
  return configUmami(process.env.NEXT_PUBLIC_UMAMI_SRC, process.env.NEXT_PUBLIC_UMAMI_ID);
}

export function corpEveniment(
  config: ConfigUmami,
  ev: EvenimentServer,
): Readonly<{ type: "event"; payload: Readonly<Record<string, string>> }> {
  return {
    type: "event",
    payload: {
      website: config.site,
      hostname: DOMENIU_MASURAT,
      url: ev.cale,
      name: ev.nume,
      ip: IP_FARA_LOCALIZARE,
      userAgent: AGENT_SERVER,
      browser: "server",
      os: "server",
      device: "server",
    },
  };
}

export async function trimiteEveniment(
  ev: EvenimentServer,
  deps: Readonly<{ config?: ConfigUmami | null; cerere?: Cerere }> = {},
): Promise<boolean> {
  const config = deps.config !== undefined ? deps.config : configUmamiDinMediu();
  if (config === null) return false;
  const cerere: Cerere = deps.cerere ?? fetch;
  try {
    const raspuns = await cerere(config.adresa, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": AGENT_SERVER },
      body: JSON.stringify(corpEveniment(config, ev)),
      signal: AbortSignal.timeout(TERMEN_MS),
    });
    const text = await raspuns.text();
    if (!raspuns.ok || text.includes('"beep"')) {
      console.warn("[masurare] Umami n-a scris evenimentul", {
        nume: ev.nume,
        status: raspuns.status,
      });
      return false;
    }
    return true;
  } catch (eroare: unknown) {
    console.warn("[masurare] evenimentul n-a plecat", {
      nume: ev.nume,
      motiv: eroare instanceof Error ? eroare.name : "necunoscut",
    });
    return false;
  }
}

export function programeaza(ev: EvenimentServer | null, optiuni: OptiuniNumarare = {}): boolean {
  if (ev === null) return false;
  const trimite: Trimitere = optiuni.trimite ?? ((e) => trimiteEveniment(e));
  const programator: Programator = optiuni.programator ?? after;
  try {
    programator(() => trimite(ev));
    return true;
  } catch {
    // `after` în afara unei cereri (E468): teste, scripturi. Nu se numără nimic.
    return false;
  }
}

/**
 * Învelișul rutelor de descărcare: `export const GET = cuNumarare(genereaza)`.
 * Răspunsul trece neatins; o eroare a rutei se propagă ca înainte; o eroare a
 * numărării nu ajunge niciodată la vizitator.
 */
export function cuNumarare<C extends Request, A extends unknown[]>(
  genereaza: (cerere: C, ...rest: A) => Promise<Response>,
  optiuni: OptiuniNumarare = {},
): (cerere: C, ...rest: A) => Promise<Response> {
  return async (cerere: C, ...rest: A): Promise<Response> => {
    const raspuns = await genereaza(cerere, ...rest);
    try {
      programeaza(evenimentDescarcare(cerere, raspuns), optiuni);
    } catch (eroare: unknown) {
      console.warn("[masurare] descărcarea nu s-a putut număra", {
        motiv: eroare instanceof Error ? eroare.name : "necunoscut",
      });
    }
    return raspuns;
  };
}

/** Contul nou, numărat pe server: Umami din browser l-a pierdut pe singurul venit dintr-o unealtă. */
export function numaraConversia(
  sursa: unknown,
  antete: Pick<Headers, "get">,
  optiuni: OptiuniNumarare = {},
): boolean {
  try {
    return programeaza(evenimentCont(sursa, antete), optiuni);
  } catch {
    return false;
  }
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/lib/unelte/umami-server.test.ts src/lib/unelte/masurare.test.ts
```

Apoi lanțul:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check src/lib/unelte/umami-server.ts src/lib/unelte/umami-server.test.ts
```

Dacă `typecheck` cade pe `programator = optiuni.programator ?? after`, tipul generic al lui `after` nu s-a potrivit. Scrii atunci `?? ((sarcina) => after(sarcina))`, fără nicio altă schimbare.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
C=(src/lib/unelte/umami-server.ts src/lib/unelte/umami-server.test.ts)
git status --short -- "${C[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "${C[@]}"
git commit --only -m "feat(unelte): evenimentele de server pleacă la Umami după răspuns, fără IP și fără UA

ip 127.0.0.1 (fără localizare), UA fix care trece de isbot, o singură sesiune
pe lună; after() cu termen de 3 s; nicio eroare de numărare nu ajunge la
vizitator.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${C[@]}"
git merge origin/main
git push origin main
```

---

### Task J3: rutele de descărcare numără, politica o spune

**Fișiere:**
- Modify: `src/app/api/unelte/[unealta]/route.ts`. Linia `:16` (`export async function GET(`), plus un rând nou la final și un import.
- Modify: `src/app/api/unelte/foaie-de-pontaj/route.ts`. Azi, linia `:56` (`export async function GET(cerere: NextRequest): Promise<Response> {`), plus finalul fișierului și un import. După E10 fișierul e rescris, dar păstrează exact semnătura asta (`E-pontaj-condica.md:3700`).
- Modify, **dacă există** la momentul execuției: `src/app/api/unelte/condica-de-prezenta/route.ts` (E), `src/app/api/unelte/cerere-concediu/route.ts` (F), `src/app/api/unelte/foaie-de-parcurs/route.ts` (G), `src/app/api/unelte/fisa-evaluare/route.ts` (I7). Aceeași transformare. `src/app/api/unelte/cerere-concediu-de-odihna/route.ts` (F) NU se atinge: deleagă la GET-ul din `cerere-concediu`, deja învelit (vezi „Excepție” la pasul 3). Lista exactă o dă `find src/app/api/unelte -name route.ts`.
- Modify: `src/content/legal/confidentialitate.ts`. Secțiunea 8, fraza adăugată de A7 („Statistica proprie, pe serverul nostru…”), plus `DATA_CONFIDENTIALITATE` (`:29`).
- Modify: `src/content/landing/harta.ts`. Blocul `cale: "/legal/confidentialitate"` (azi `:433-438`).
- Create: `src/app/api/unelte/numarare.test.ts`
- Modify: `src/app/api/unelte/[unealta]/route.test.ts`
- Modify: `src/content/legal/confidentialitate.test.ts` (creat de A7)

**Interfețe:**
- Consumă: `cuNumarare` (J2), `unealtaDinCale` (J1). `SECTIUNI_CONFIDENTIALITATE` (`confidentialitate.ts:34`). `UNELTE: Readonly<Record<string, Constructor>>` din `@/lib/unelte/registru` (verificat: `export const UNELTE` la `registru.ts:15`).
- Produce: `export const GET = cuNumarare(genereaza);` în fiecare rută de unealtă. Tipul lui `GET` rămâne cel al lui `genereaza`, deci validatorul de rute din Next vede aceeași semnătură.

- [ ] **Pasul 1: Scrie testele care pică**

`src/app/api/unelte/numarare.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { unealtaDinCale } from "@/lib/unelte/masurare";

const RADACINA = "src/app/api/unelte";

function rute(dosar: string): string[] {
  return readdirSync(dosar, { withFileTypes: true }).flatMap((intrare) => {
    const cale = join(dosar, intrare.name);
    if (intrare.isDirectory()) return rute(cale);
    return intrare.name === "route.ts" ? [cale] : [];
  });
}

/**
 * Auditul din 8 oct 2026: descărcările nu erau numărate nicăieri pe server. O
 * rută nouă de unealtă care uită învelișul ar reface golul în tăcere — Umami din
 * browser nu-l vede pe cine blochează măsurarea.
 */
/**
 * O rută care doar deleagă la GET-ul altei rute (aliasul din F12:
 * `cerere-concediu-de-odihna` cheamă GET-ul din `../cerere-concediu/route`)
 * primește deja un GET învelit. Învelită încă o dată, ar număra fiecare
 * descărcare de două ori.
 */
const DELEGARE = /import \{ GET as \w+ \} from "\.\.\/[a-z0-9-]+\/route";/u;

describe("numărarea pe server acoperă toate rutele de unelte", () => {
  it("fiecare route.ts exportă GET prin cuNumarare, o singură dată", () => {
    const fisiere = rute(RADACINA);
    expect(fisiere.length, "n-am găsit nicio rută — s-a mutat dosarul?").toBeGreaterThanOrEqual(2);
    for (const fisier of fisiere) {
      const sursa = readFileSync(fisier, "utf8");
      if (DELEGARE.test(sursa)) {
        expect(sursa, `${fisier}: deleagă, deci nu se mai învelește`).not.toMatch(/cuNumarare/u);
        continue;
      }
      expect(sursa, fisier).toMatch(/export const GET = cuNumarare\(/u);
      expect(sursa, fisier).not.toMatch(/export (?:async )?function GET\b/u);
    }
  });

  it("fiecare dosar static se leagă de o unealtă din hartă", () => {
    for (const intrare of readdirSync(RADACINA, { withFileTypes: true })) {
      if (!intrare.isDirectory() || intrare.name.startsWith("[")) continue;
      expect(unealtaDinCale(`/api/unelte/${intrare.name}`), intrare.name).not.toBeNull();
    }
  });
});
```

`src/app/api/unelte/[unealta]/route.test.ts`: **NU se rescrie fișierul.** La momentul lui J3 el poartă blocuri adăugate de B8, E12, F12, H5, I7 și K8–K10, iar F12/E12/I7 scot unelte din `UNELTE` (`fisa-evaluare`, condica, cererea trec pe rute statice). De aceea testul nou nu numește nicio unealtă: o alege din registru pe prima care descarcă un PDF doar cu `?format=pdf`. Trei editări, toate aditive.

(a) Primul rând al fișierului, `import { NextRequest } from "next/server";`, rămâne. Rândul `import { … } from "vitest";` primește `afterEach`, `beforeEach` și `vi` (păstrezi ce importă deja). Imediat după el, înaintea lui `import { GET } from "./route";`, adaugi:

```ts
/*
 * `after` din `next/server` aruncă în afara unei cereri reale. Aici îl înlocuim
 * cu o coadă, ca să putem rula sarcina programată și să vedem ce pleacă la
 * Umami. Restul modulului (NextRequest) rămâne cel adevărat.
 */
const { programate } = vi.hoisted(() => ({
  programate: [] as Array<() => Promise<unknown>>,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (sarcina: () => Promise<unknown>) => {
    programate.push(sarcina);
  },
}));

import { unealtaDinCale } from "@/lib/unelte/masurare";
import { UNELTE } from "@/lib/unelte/registru";
```

Dacă fișierul importă deja `UNELTE` (H5 o face), nu-l mai importi a doua oară.

(b) Funcția `cere` primește antete opționale. Vechi (azi `:6-7`):

```ts
const cere = (cale: string, slug: string) =>
  GET(new NextRequest(`http://localhost${cale}`), { params: Promise.resolve({ unealta: slug }) });
```

Nou:

```ts
const cere = (cale: string, slug: string, antete: Record<string, string> = {}) =>
  GET(new NextRequest(`http://localhost${cale}`, { headers: antete }), {
    params: Promise.resolve({ unealta: slug }),
  });
```

Dacă o secțiune anterioară a schimbat forma lui `cere`, adaugi doar al treilea parametru, `antete`, și `{ headers: antete }` în `new NextRequest(…)`. Apelurile existente rămân neatinse.

(c) La sfârșitul fișierului:

```ts
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const OM = {
  host: "administrativo.ro",
  "user-agent": IPHONE,
  "sec-fetch-user": "?1",
  "cf-connecting-ip": "82.137.40.16",
};

/**
 * Prima unealtă din registrul comun care dă un PDF doar cu `?format=pdf`. Cererea
 * de probă n-are `host`, deci nu se numără. Registrul se schimbă de la o secțiune
 * la alta (E12, F12, I7 scot unelte, K le adaugă); testul nu depinde de care rămân.
 */
async function unealtaCareDescarca(): Promise<{ slug: string; pagina: string }> {
  for (const slug of Object.keys(UNELTE)) {
    const pagina = unealtaDinCale(`/api/unelte/${slug}`);
    if (pagina === null) continue;
    const r = await cere(`/api/unelte/${slug}?format=pdf`, slug);
    if (r.status === 200 && /^attachment/u.test(r.headers.get("content-disposition") ?? "")) {
      return { slug, pagina };
    }
  }
  throw new Error("Nicio unealtă din registru nu descarcă un PDF doar cu ?format=pdf.");
}

describe("numărarea descărcărilor pe server", () => {
  beforeEach(() => {
    programate.length = 0;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("descărcarea unui om pleacă drept dl:<unealtă>:pdf:om, fără IP și fără UA", async () => {
    const { slug, pagina } = await unealtaCareDescarca();
    expect(programate).toHaveLength(0);
    vi.stubEnv("NEXT_PUBLIC_UMAMI_SRC", "http://analitice.test/script.js");
    vi.stubEnv("NEXT_PUBLIC_UMAMI_ID", "00000000-0000-4000-8000-000000000000");
    const trimis = vi.fn(
      async (_adresa: unknown, _optiuni?: RequestInit) => new Response('{"cache":"x"}'),
    );
    vi.stubGlobal("fetch", trimis);

    const r = await cere(`/api/unelte/${slug}?format=pdf`, slug, OM);
    expect(r.status).toBe(200);
    expect(programate).toHaveLength(1);

    await programate[0]?.();
    expect(trimis).toHaveBeenCalledTimes(1);
    expect(String(trimis.mock.calls[0]?.[0])).toBe("http://analitice.test/api/send");
    const corp = String(trimis.mock.calls[0]?.[1]?.body);
    expect(JSON.parse(corp).payload.name).toBe(`dl:${pagina}:pdf:om`);
    expect(corp).not.toContain("82.137.40.16");
    expect(corp).not.toContain("iPhone");
  });

  it("404, staging și localhost nu programează nimic", async () => {
    const { slug } = await unealtaCareDescarca();
    await cere("/api/unelte/inexistent?format=pdf", "inexistent", OM);
    await cere(`/api/unelte/${slug}?format=pdf`, slug, { ...OM, host: "staging.administrativo.ro" });
    await cere(`/api/unelte/${slug}?format=pdf`, slug);
    expect(programate).toHaveLength(0);
  });
});
```

Verificat de verificatorul planului (8 oct 2026) pe o copie: cu ruta de azi învelită și cu J1/J2 din plan, cele trei teste trec (`unealtaCareDescarca` alege azi `fisa-evaluare`); fără înveliș, primul cade pe `expected [] to have a length of 1`.

La sfârșitul lui `src/content/legal/confidentialitate.test.ts` (creat de A7) se adaugă:

```ts
describe("numărarea pe server a uneltelor", () => {
  it("politica spune ce se numără pe server și ce nu pleacă", () => {
    expect(politica).toMatch(/se numără și pe server/u);
    expect(politica).toMatch(/fără adresa IP/u);
    expect(politica).toMatch(/fără identificarea browserului/u);
    expect(politica).toMatch(/fără valorile din formular/u);
  });
});
```

(`politica` e constanta `JSON.stringify(SECTIUNI_CONFIDENTIALITATE)` definită de A7 în capul fișierului.)

- [ ] **Pasul 2: Rulează-le și vezi-le picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/app/api/unelte src/content/legal/confidentialitate.test.ts
```

Așteptat:
- `numarare.test.ts`: `expected '…export async function GET(…' to match /export const GET = cuNumarare\(/u`, cu numele primei rute neînvelite;
- `route.test.ts`: `expected [] to have a length of 1`;
- `confidentialitate.test.ts`: `expected … to match /se numără și pe server/u`.

- [ ] **Pasul 3: Implementarea minimă**

`src/app/api/unelte/[unealta]/route.ts`. Vechi (`:1-5`):

```ts
import type { NextRequest } from "next/server";

import { EroareIntrare, normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { constructorPentru } from "@/lib/unelte/registru";
import { raspunsDocument } from "@/lib/unelte/raspuns";
```

Nou:

```ts
import type { NextRequest } from "next/server";

import { EroareIntrare, normalizeazaFormat } from "@/lib/unelte/document-tabelar";
import { constructorPentru } from "@/lib/unelte/registru";
import { raspunsDocument } from "@/lib/unelte/raspuns";
import { cuNumarare } from "@/lib/unelte/umami-server";
```

Vechi (`:16`):

```ts
export async function GET(
```

Nou:

```ts
async function genereaza(
```

La sfârșitul fișierului, după `}`-ul care închide funcția:

```ts

/**
 * Descărcarea se numără pe server, după răspuns și fără IP (`src/lib/unelte/
 * masurare.ts`): Umami din browser nu-l vede pe cine blochează măsurarea.
 */
export const GET = cuNumarare(genereaza);
```

`src/app/api/unelte/foaie-de-pontaj/route.ts`. Importul se adaugă după `import { raspunsDocument } from "@/lib/unelte/raspuns";`:

```ts
import { cuNumarare } from "@/lib/unelte/umami-server";
```

Vechi (azi `:56`):

```ts
export async function GET(cerere: NextRequest): Promise<Response> {
```

Nou:

```ts
async function genereaza(cerere: NextRequest): Promise<Response> {
```

La sfârșitul fișierului adaugi același bloc `export const GET = cuNumarare(genereaza);`, cu comentariul de mai sus. Aceeași transformare, cu import, redenumire și rândul final, se face în fiecare `route.ts` pe care îl listează:

```bash
cd /srv/apps/ERP && find src/app/api/unelte -name route.ts | sort
```

Dacă un fișier are deja o funcție numită `genereaza`, folosești `genereazaDescarcarea` pentru redenumire și în rândul final.

**Excepție: rutele care doar deleagă.** `src/app/api/unelte/cerere-concediu-de-odihna/route.ts` (F12) are `import { GET as descarcaCererea } from "../cerere-concediu/route";` și `export function GET(cerere) { return descarcaCererea(cerere); }`. După J3, `descarcaCererea` e deja GET-ul învelit al căii `cerere-concediu`, iar evenimentul ia unealta din calea cererii (`/api/unelte/cerere-concediu-de-odihna` → `cerere-concediu-de-odihna`). Fișierul ăsta NU se atinge: învelit, ar număra fiecare descărcare de două ori. Paza din `numarare.test.ts` îl recunoaște după import și cere să nu conțină `cuNumarare`. Același tratament pentru orice altă rută-alias de forma asta.

`src/content/legal/confidentialitate.ts`, secțiunea 8. Vechi (textul lăsat de A7, `A-confidentialitate.md:2105`; azi, înainte de A7, linia `:103` are doar prima propoziție — dacă A7 n-a rulat, te oprești: J3 depinde de A7):

```ts
      "Statistica proprie, pe serverul nostru, nu folosește cookie-uri și nu urmărește vizitatorii de la un site la altul. Primește adresa paginii fără valorile din formulare; din parametrii adresei păstrează doar pe cei de campanie (utm_…) și marcajul m, cu care ne recunoaștem propriile verificări.",
```

Nou (prima linie rămâne byte cu byte cea a lui A7, se adaugă a doua):

```ts
      "Statistica proprie, pe serverul nostru, nu folosește cookie-uri și nu urmărește vizitatorii de la un site la altul. Primește adresa paginii fără valorile din formulare; din parametrii adresei păstrează doar pe cei de campanie (utm_…) și marcajul m, cu care ne recunoaștem propriile verificări.",
      "Descărcările din uneltele gratuite și conturile create se numără și pe server, ca cifra să nu depindă de browser: se înregistrează doar unealta, formatul fișierului, dacă cererea pare a unui om, a unui robot sau a unui test de-al nostru și, pentru conturi, unealta din care ai venit — fără adresa IP, fără identificarea browserului și fără valorile din formular. Toate aceste numărători stau într-o singură sesiune tehnică pe lună, deci nu pot fi legate de o persoană.",
```

`DATA_CONFIDENTIALITATE` devine data zilei în care se comite, în forma `"<zi> <lună> <an>"` (de exemplu `"9 octombrie 2026"`).

`src/content/landing/harta.ts`, blocul `cale: "/legal/confidentialitate"`. Câmpul `actualizat` (oricare ar fi valoarea lăsată de A7) devine data commitului, `AAAA-LL-ZZ`. Deasupra pui un comentariu de o linie: `// <dată>: numărarea pe server a uneltelor, în secțiunea 8.`

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit src/app/api/unelte src/content/legal src/lib/unelte
```

Apoi lanțul complet:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check $(find src/app/api/unelte -name '*.ts') src/content/legal/confidentialitate.ts src/content/legal/confidentialitate.test.ts src/content/landing/harta.ts
```

`continut.test.ts` („furnizorii externi sunt numiți”) rămâne verde: codul nou nu conține niciun literal `https://` în `src/`, iar adresa Umami vine din mediu.

- [ ] **Verificare locală a rutei, fără rețea spre Umami** (răspunsul trebuie să rămână identic):

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/api/unelte/foaie-de-pontaj" "src/app/api/unelte/[unealta]"
```

Așteptat: testele create de A5, B4 și E10 pentru antete, formate și conținut trec neschimbate. Învelișul nu modifică răspunsul.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
mapfile -t RUTE < <(find src/app/api/unelte -name route.ts | sort)
C=("${RUTE[@]}" "src/app/api/unelte/[unealta]/route.test.ts" src/app/api/unelte/numarare.test.ts src/content/legal/confidentialitate.ts src/content/legal/confidentialitate.test.ts src/content/landing/harta.ts)
git status --short -- "${C[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- src/app/api/unelte/numarare.test.ts
git commit --only -m "feat(unelte): fiecare descărcare se numără pe server, fără IP; politica o spune

GET = cuNumarare(genereaza) pe toate rutele /api/unelte; o poartă cade pe o
rută nouă neînvelită. Secțiunea 8 a politicii: ce se numără și ce nu pleacă.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${C[@]}"
git merge origin/main
git push origin main
```

---

### Task J4: contul își spune unealta din care a venit

**Fișiere:**
- Modify: `src/app/(auth)/inregistrare/schema.ts`. Câmpul `acceptTermeni` (`:58-60`) și închiderea obiectului (`:61`).
- Modify: `src/app/(auth)/inregistrare/actions.ts`. Importurile (`:3-17`) și blocul de după `const invitationId = rezultat.invitation_id;` (`:111`).
- Modify: `src/app/(auth)/inregistrare/page.tsx`. Importurile și funcția (`:22-37`).
- Modify: `src/app/(auth)/inregistrare/formular-inregistrare.tsx`. Semnătura (`:28`) și apelul acțiunii (`:41-51`).
- Test: `src/app/(auth)/inregistrare/actions.test.ts` (Create, proiectul `unit`)

**Interfețe:**
- Consumă:
  - `numaraConversia(sursa: unknown, antete: Pick<Headers, "get">)` (J2) și `sursaDinParametri(p: ParametriPagina)` (J1);
  - `headers()` din `next/headers`, care întoarce `ReadonlyHeaders` cu `.get`;
  - `createPublicAction` (`src/lib/actions/public-action.ts:42`), care cheamă `def.handler(ctx, parsed.data)`.
- Produce:
  - `schemaInregistrare` cu `sursa?: string | null`; o valoare invalidă devine `null`, nu eroare;
  - `FormularInregistrare({ sursa }: Readonly<{ sursa?: string | null }>)`;
  - pagina `/inregistrare` primește `searchParams`.

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(auth)/inregistrare/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * `createPublicAction` e înlocuit cu identitatea, ca testul să cheme direct
 * `handler`-ul: limitarea de rată și clientul anon nu sunt subiectul aici.
 * Restul dependențelor care ies din proces sunt false.
 */
const { rpc, numaraConversia } = vi.hoisted(() => ({
  rpc: vi.fn(),
  numaraConversia: vi.fn(),
}));

vi.mock("@/lib/actions/public-action", () => ({
  createPublicAction: (definitie: unknown) => definitie,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminSupabase: () => ({ rpc }) }));
vi.mock("@/lib/auth/token-invitatie", () => ({
  generateazaTokenInvitatie: async () => ({ token: "tok", hash: "hash" }),
}));
vi.mock("@/lib/email/invitations", () => ({
  trimiteEmailInvitatie: async () => ({ ok: true }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "administrativo.ro", "user-agent": "Mozilla/5.0" }),
}));
vi.mock("@/lib/unelte/umami-server", () => ({ numaraConversia }));

import { inregistreazaFirma } from "./actions";
import { schemaInregistrare } from "./schema";

type Definitie = { handler: (ctx: unknown, input: unknown) => Promise<unknown> };
const definitie = inregistreazaFirma as unknown as Definitie;

const CTX = {
  supabase: {},
  meta: { ip: null, userAgent: null },
  requestId: "r-1",
  now: new Date("2026-10-08T10:00:00Z"),
};
const BAZA = {
  firma: "Firma Test SRL",
  cui: "14399840",
  prenume: "Ana",
  nume: "Pop",
  email: "ana@example.com",
  telefon: "",
  acceptTermeni: true,
};

beforeEach(() => {
  rpc.mockReset();
  numaraConversia.mockReset();
  rpc.mockResolvedValue({ data: { organization_id: "o-1", invitation_id: "i-1" }, error: null });
});

describe("conversia numărată pe server", () => {
  it("contul venit din foaia de pontaj se numără cu sursa lui", async () => {
    await definitie.handler(CTX, schemaInregistrare.parse({ ...BAZA, sursa: "foaie-de-pontaj" }));
    expect(numaraConversia).toHaveBeenCalledTimes(1);
    expect(numaraConversia.mock.calls[0]?.[0]).toBe("foaie-de-pontaj");
    expect((numaraConversia.mock.calls[0]?.[1] as Headers).get("host")).toBe("administrativo.ro");
  });

  it("fără sursă, contul se numără ca direct", async () => {
    await definitie.handler(CTX, schemaInregistrare.parse(BAZA));
    expect(numaraConversia).toHaveBeenCalledTimes(1);
    expect(numaraConversia.mock.calls[0]?.[0] ?? null).toBeNull();
  });

  it("o sursă stricată nu oprește înregistrarea", async () => {
    for (const sursa of ["x".repeat(500), 42, "__proto__", { a: 1 }]) {
      const input = schemaInregistrare.parse({ ...BAZA, sursa });
      await expect(definitie.handler(CTX, input)).resolves.toEqual({
        email: "ana@example.com",
        prinEmail: true,
      });
    }
    expect(rpc).toHaveBeenCalledTimes(4);
  });

  it("dacă baza refuză, nu se numără niciun cont", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "CUI existent." } });
    await expect(
      definitie.handler(CTX, schemaInregistrare.parse({ ...BAZA, sursa: "foaie-de-pontaj" })),
    ).rejects.toThrow("CUI existent.");
    expect(numaraConversia).not.toHaveBeenCalled();
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(auth)/inregistrare/actions.test.ts"
```

Așteptat:
- primele două teste: `expected "vi.fn()" to be called 1 times, but got 0 times` (verificat pe o copie a codului de azi);
- al treilea: `schemaInregistrare.parse` primește `sursa: "x…"` și o aruncă tăcut (Zod scoate cheile necunoscute), deci trece deja;
- al patrulea trece deja.

Cele două căderi sunt cele care contează.

- [ ] **Pasul 3: Implementarea minimă**

`schema.ts`. Vechi (`:58-61`):

```ts
  acceptTermeni: z.literal(true, {
    error: "Trebuie să accepți termenii ca să putem crea contul.",
  }),
});
```

Nou:

```ts
  acceptTermeni: z.literal(true, {
    error: "Trebuie să accepți termenii ca să putem crea contul.",
  }),
  /*
   * Unealta din care a venit vizitatorul (`utm_campaign` pe adresele puse de
   * `adresaInregistrare`). `.catch(null)`: o valoare stricată devine „direct”,
   * nu un formular respins — statistica nu are voie să coste un cont. Lista
   * uneltelor o verifică `sursaConversiei`, nu schema.
   */
  sursa: z.string().max(80).nullish().catch(null),
});
```

`CAMPURI_INREGISTRARE` rămâne neschimbat. `sursa` nu are câmp vizibil și nu poate avea erori.

`actions.ts`. Vechi (`:1-3`):

```ts
"use server";

import { businessRule } from "@/lib/actions/errors";
```

Nou:

```ts
"use server";

import { headers } from "next/headers";

import { businessRule } from "@/lib/actions/errors";
```

Vechi (`:14-15`):

```ts
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ZILE_EXPIRARE_IMPLICIT } from "@/schemas/membership";
```

Nou:

```ts
import { createAdminSupabase } from "@/lib/supabase/admin";
import { numaraConversia } from "@/lib/unelte/umami-server";
import { ZILE_EXPIRARE_IMPLICIT } from "@/schemas/membership";
```

Vechi (`:110-111`):

```ts
    const organizationId = rezultat.organization_id;
    const invitationId = rezultat.invitation_id;
```

Nou:

```ts
    const organizationId = rezultat.organization_id;
    const invitationId = rezultat.invitation_id;

    // Contul se numără pe server, nu doar din browser: singurul cont venit
    // dintr-o unealtă (30 sept 2026) lipsea cu totul din Umami. Fără IP și fără
    // date din formular — doar `cont:<unealtă>` (`src/lib/unelte/masurare.ts`).
    numaraConversia(input.sursa, await headers());
```

`page.tsx`. Vechi (`:1-6`):

```tsx
// src/app/(auth)/inregistrare/page.tsx
import type { Metadata } from "next";

import { ScriptUmami } from "@/app/(marketing)/_componente/analitice";

import { FormularInregistrare } from "./formular-inregistrare";
```

Nou:

```tsx
// src/app/(auth)/inregistrare/page.tsx
import type { Metadata } from "next";

import { ScriptUmami } from "@/app/(marketing)/_componente/analitice";
import { type ParametriPagina, sursaDinParametri } from "@/lib/unelte/masurare";

import { FormularInregistrare } from "./formular-inregistrare";
```

Vechi (`:22-25`):

```tsx
export default function PaginaInregistrare() {
  return (
    <>
      <FormularInregistrare />
```

Nou:

```tsx
/**
 * `searchParams` face pagina dinamică; costul e o randare pe cerere, pe o pagină
 * vizitată de câteva ori pe săptămână. Sursa e doar un slug din hartă — nimic
 * din ce scrie vizitatorul nu trece pe aici.
 */
export default async function PaginaInregistrare({
  searchParams,
}: Readonly<{ searchParams: Promise<ParametriPagina> }>) {
  const sursa = sursaDinParametri(await searchParams);
  return (
    <>
      <FormularInregistrare sursa={sursa} />
```

`formular-inregistrare.tsx`. Vechi (`:28`):

```tsx
export function FormularInregistrare() {
```

Nou:

```tsx
export function FormularInregistrare({ sursa = null }: Readonly<{ sursa?: string | null }>) {
```

Vechi (`:47-50`):

```tsx
        // Schema cere `true` literal, deci conversia se face aici — altfel
        // mesajul de eroare ar vorbi despre tipuri, nu despre accept.
        acceptTermeni: date.get("acceptTermeni") === "on",
      });
```

Nou:

```tsx
        // Schema cere `true` literal, deci conversia se face aici — altfel
        // mesajul de eroare ar vorbi despre tipuri, nu despre accept.
        acceptTermeni: date.get("acceptTermeni") === "on",
        // Unealta din care a venit, citită pe server din UTM; nu e un câmp.
        sursa,
      });
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit "src/app/(auth)/inregistrare/actions.test.ts" src/lib/unelte
```

Apoi lanțul:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check "src/app/(auth)/inregistrare/schema.ts" "src/app/(auth)/inregistrare/actions.ts" "src/app/(auth)/inregistrare/page.tsx" "src/app/(auth)/inregistrare/formular-inregistrare.tsx" "src/app/(auth)/inregistrare/actions.test.ts"
```

`check:server` verifică exporturile din `actions.ts`. Fișierul exportă tot doar `inregistreazaFirma`, iar importurile noi nu se exportă.

- [ ] **Verificare locală a paginii** (HTML-ul se verifică local, comportamentul de client NU; memoria `erp-next-dev-nu-hidrateaza`):

```bash
cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917
```

(în fundal, `run_in_background`), apoi, într-un apel separat:

```bash
for i in $(seq 1 60); do curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3917/inregistrare | grep -q 200 && break; sleep 2; done
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:3917/inregistrare?utm_source=unealta&utm_medium=dupa-document&utm_campaign=foaie-de-pontaj'
curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:3917/inregistrare?utm_source=unealta&utm_campaign=__proto__'
```

Așteptat: `200` și `200`. Oprirea, într-un apel separat: `pkill -f "next dev -H 127.0.0.1 -p 391[7]"`. Apoi `rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts && pnpm typecheck`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
C=("src/app/(auth)/inregistrare/schema.ts" "src/app/(auth)/inregistrare/actions.ts" "src/app/(auth)/inregistrare/page.tsx" "src/app/(auth)/inregistrare/formular-inregistrare.tsx" "src/app/(auth)/inregistrare/actions.test.ts")
git status --short -- "${C[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "src/app/(auth)/inregistrare/actions.test.ts"
git commit --only -m "feat(inregistrare): contul nou se numără pe server, cu unealta din care a venit

Sursa vine din utm_campaign (doar slug-uri din hartă); o valoare stricată devine
„direct” și nu respinge formularul. cont:<sursă> pleacă după crearea
organizației, fără IP și fără datele firmei.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${C[@]}"
git merge origin/main
git push origin main
```

---

### Task J5: îndemnul de după document, pe fiecare unealtă

**Fișiere:**
- Create: `src/content/landing/cta-unelte.ts`
- Create: `src/app/(marketing)/_componente/continua-in-aplicatie.tsx`
- Create: `src/app/(marketing)/_componente/revelare-dupa-descarcare.tsx`
- Test: `src/app/(marketing)/_componente/continua-in-aplicatie.test.tsx` (proiectul `ui`, happy-dom)
- Modify: fiecare `src/app/(marketing)/unelte/<slug>/page.tsx`. Azi sunt 7, plus `calculator-zile-concediu` (F) și cele patru ale lui K (`calculator-zile-lucratoare`, `cerere-demisie`, `programare-concedii`, `adeverinta-salariat`), dacă au fost create. Lista exactă: `ls -d "src/app/(marketing)/unelte"/*/`. Se modifică:
  - importurile;
  - un element nou imediat după `</Banda>`-ul care închide `<Banda id="documentul"` (la calculator, `<Banda id="rezultat"`);
  - fiecare `href={RO.hero.ctaPrimar.href}` din pagină.
- Modify: `src/content/landing/harta.ts`. Câmpul `actualizat` al fiecărei pagini de unealtă atinse.

**Interfețe:**
- Consumă:
  - din `./preturi` (verificat): `PRET_NUCLEU`, `PRAG_ANGAJATI`, `PRETURI_MODULE`, `MODULE_NUCLEU`, `lunar(suma, "ro")`;
  - `type FeatureKey` din `@/config/features`;
  - din `./ro`: `RO.hero.ctaPrimar` (`{ eticheta: "Creează cont · prima lună gratuită", href: "/inregistrare" }`, `ro.ts:73`);
  - `slugModul` din `./slug-module` și `fisaModulului` din `./fise-module`;
  - `SURSA_UTM_UNEALTA`, `type ParametriPagina` (J1);
  - `areDateDeFormular(adresa: string): boolean` din `./adresa-analitice` (A2);
  - `Banda` (`id`, `inaltime`, `supratitlu`, `titlu`, `lead`, `children`).
- Produce:

```ts
// src/content/landing/cta-unelte.ts
export type LocCta = "dupa-document" | "banda";
export type CtaUnealta = Readonly<{ modul: FeatureKey; titlu: string; text: string }>;
export function areCtaPropriu(unealta: string): boolean;
export function ctaPentru(unealta: string): CtaUnealta;
export function pretPentru(modul: FeatureKey): string;
export function adresaInregistrare(unealta: string, loc: LocCta): string;
// src/app/(marketing)/_componente/continua-in-aplicatie.tsx
export function aGenerat(p: ParametriPagina): boolean;
export function ContinuaInAplicatie(props: Readonly<{ unealta: string; generat: boolean }>): JSX.Element;
// src/app/(marketing)/_componente/revelare-dupa-descarcare.tsx ("use client")
export function RevelareDupaDescarcare(props: Readonly<{ tinta: string }>): null;
```

- [ ] **Pasul 1: Scrie testul care pică** — `src/app/(marketing)/_componente/continua-in-aplicatie.test.tsx`:

```tsx
import { readFileSync, readdirSync, existsSync } from "node:fs";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

import { fisaModulului } from "@/content/landing/fise-module";
import { PRETURI_MODULE, PRET_NUCLEU } from "@/content/landing/preturi";
import {
  adresaInregistrare,
  areCtaPropriu,
  ctaPentru,
  pretPentru,
} from "@/content/landing/cta-unelte";
import { SLUGURI_UNELTE, sursaDinParametri } from "@/lib/unelte/masurare";

/** Ca în `comutator-vizualizare.test.tsx`: doar atributele verificate ajung pe `<a>`. */
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: Record<string, unknown>) =>
      createElement(
        "a",
        {
          href: props["href"] as string,
          "data-umami-event": props["data-umami-event"] as string | undefined,
        },
        props["children"] as ReactNode,
      ),
  };
});

import { ContinuaInAplicatie, aGenerat } from "./continua-in-aplicatie";

describe("aGenerat", () => {
  it("doar valorile din formular contează, nu campania sau marcajul de audit", () => {
    expect(aGenerat({})).toBe(false);
    expect(aGenerat({ m: "1791483495" })).toBe(false);
    expect(aGenerat({ utm_source: "fisier", utm_campaign: "unelte" })).toBe(false);
    expect(aGenerat({ luna: "10" })).toBe(true);
    expect(aGenerat({ angajati: ["Ana", "Ion"] })).toBe(true);
    expect(aGenerat({ luna: undefined })).toBe(false);
  });
});

describe("ContinuaInAplicatie", () => {
  it("după generare: înregistrarea cu sursa uneltei și pagina modulului", () => {
    const { container } = render(<ContinuaInAplicatie unealta="foaie-de-pontaj" generat />);
    const sectiune = container.querySelector("#continua-foaie-de-pontaj") as HTMLElement;
    expect(sectiune.hidden).toBe(false);
    expect(sectiune.getAttribute("data-tipar")).toBe("ascunde");

    const inscriere = screen.getByText("Creează cont · prima lună gratuită");
    const href = inscriere.getAttribute("href") ?? "";
    expect(href).toBe(adresaInregistrare("foaie-de-pontaj", "dupa-document"));
    expect(
      sursaDinParametri(Object.fromEntries(new URL(href, "http://x").searchParams)),
    ).toBe("foaie-de-pontaj");
    expect(inscriere.getAttribute("data-umami-event")).toBe("cta-foaie-de-pontaj");

    expect(container.querySelector('a[href="/module/pontaj"]')).not.toBeNull();
    expect(container.textContent).toContain(`${PRET_NUCLEU} lei / lună`);
    expect(container.textContent).toContain("prima lună gratuită");
    expect(container.textContent).toContain("fără TVA");
  });

  it("înainte de generare stă ascuns și apare la primul clic pe o descărcare", () => {
    const { container } = render(
      <>
        <button type="button" name="format" value="pdf">
          Descarcă PDF
        </button>
        <ContinuaInAplicatie unealta="condica-de-prezenta" generat={false} />
      </>,
    );
    const sectiune = container.querySelector("#continua-condica-de-prezenta") as HTMLElement;
    expect(sectiune.hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Descarcă PDF" }));
    expect(sectiune.hidden).toBe(false);
  });

  it("un clic pe alt buton nu-l arată", () => {
    const { container } = render(
      <>
        <button type="button">Generează</button>
        <ContinuaInAplicatie unealta="condica-de-prezenta" generat={false} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Generează" }));
    expect((container.querySelector("#continua-condica-de-prezenta") as HTMLElement).hidden).toBe(
      true,
    );
  });

  it("SSM: spune cinstit că fișa semnată rămâne pe hârtie și dă prețul modulului", () => {
    const { container } = render(<ContinuaInAplicatie unealta="fisa-instruire-ssm" generat />);
    expect(container.textContent).toContain("Fișa semnată rămâne pe hârtie");
    expect(container.textContent).toContain(`${PRETURI_MODULE.ssm} lei / lună`);
    expect(container.querySelector('a[href="/module/ssm"]')).not.toBeNull();
  });
});

describe("textele pe unealtă", () => {
  it("fiecare unealtă din hartă are textul ei și un modul cu pagină", () => {
    for (const slug of SLUGURI_UNELTE) {
      expect(areCtaPropriu(slug), `${slug}: scrie-i intrarea în cta-unelte.ts`).toBe(true);
      expect(fisaModulului(ctaPentru(slug).modul), slug).toBeDefined();
    }
  });

  it("o unealtă necunoscută primește pachetul de bază, nu o eroare", () => {
    expect(ctaPentru("unealta-noua").modul).toBe("nucleu");
  });

  it("prețul vine din preturi.ts: nucleu fără „se adaugă”, modul opțional cu suma lui", () => {
    expect(pretPentru("attendance")).not.toContain("se adaugă");
    expect(pretPentru("fleet")).toContain(`${PRETURI_MODULE.fleet} lei / lună`);
  });
});

describe("paginile de unelte", () => {
  const RADACINA = "src/app/(marketing)/unelte";
  const pagini = readdirSync(RADACINA, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`${RADACINA}/${d.name}/page.tsx`))
    .map((d) => d.name);

  it("fiecare pune îndemnul după document, cu propriul slug", () => {
    expect(pagini.length).toBeGreaterThanOrEqual(7);
    for (const slug of pagini) {
      const sursa = readFileSync(`${RADACINA}/${slug}/page.tsx`, "utf8");
      const cta = sursa.search(new RegExp(`<ContinuaInAplicatie\\s+unealta="${slug}"`, "u"));
      const document = Math.max(sursa.indexOf('id="documentul"'), sursa.indexOf('id="rezultat"'));
      expect(cta, `${slug}: lipsește <ContinuaInAplicatie unealta="${slug}"`).toBeGreaterThan(-1);
      expect(document, `${slug}: n-are id="documentul" sau id="rezultat"`).toBeGreaterThan(-1);
      expect(cta, `${slug}: îndemnul stă înaintea documentului`).toBeGreaterThan(document);
      expect(sursa, slug).toContain("generat={aGenerat(");
    }
  });

  it("nicio legătură spre înregistrare nu pleacă fără sursa uneltei", () => {
    for (const slug of pagini) {
      const sursa = readFileSync(`${RADACINA}/${slug}/page.tsx`, "utf8");
      expect(sursa, slug).not.toContain("RO.hero.ctaPrimar.href");
      expect(sursa, slug).not.toMatch(/href="\/inregistrare/u);
    }
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project ui "src/app/(marketing)/_componente/continua-in-aplicatie.test.tsx"
```

Așteptat: `Failed to resolve import "@/content/landing/cta-unelte"`.

- [ ] **Pasul 3: Implementarea minimă**

`src/content/landing/cta-unelte.ts`:

```ts
// src/content/landing/cta-unelte.ts
import type { FeatureKey } from "@/config/features";
import { SURSA_UTM_UNEALTA } from "@/lib/unelte/masurare";

import { lunar, MODULE_NUCLEU, PRAG_ANGAJATI, PRET_NUCLEU, PRETURI_MODULE } from "./preturi";
import { RO } from "./ro";

/**
 * Îndemnul de după document, pe fiecare unealtă.
 *
 * ── DE CE AICI ────────────────────────────────────────────────────────────
 * Singura conversie organică din tot site-ul (30 sept 2026) a venit din foaia
 * de pontaj, la trei minute după „Generează”. Pagina avea atunci un singur
 * îndemn, în banda de jos, cu aceeași adresă ca butonul din antet — contul nu
 * spunea de unde vine.
 *
 * ── CE PROMITE ȘI CE NU ───────────────────────────────────────────────────
 * Fiecare text spune ce face modulul în locul uneltei, cu cuvintele fișei lui
 * (`fise-module.ts`). Prețul se calculează din `preturi.ts`. Înscrierea pornește
 * cu pachetul de bază (pontaj, concedii, portal — `0145_marginea_platformei.sql`),
 * deci la modulele opționale spunem că se adaugă, nu că sunt incluse. SSM: fișa
 * semnată rămâne pe hârtie (`fise-module.ts:248`). Salarizare: nu promitem
 * aceleași cifre ca în calculator (secțiunea D a planului din 8 oct 2026).
 */
export type LocCta = "dupa-document" | "banda";

export type CtaUnealta = Readonly<{ modul: FeatureKey; titlu: string; text: string }>;

const CTA: Readonly<Record<string, CtaUnealta>> = {
  "foaie-de-pontaj": {
    modul: "attendance",
    titlu: "Luna viitoare, foaia se completează singură",
    text: "În aplicație, fiecare om își marchează intrarea și ieșirea de pe telefon, iar foaia colectivă iese gata la sfârșitul lunii, cu aceleași weekenduri și sărbători scoase — fără să mai scrii numele încă o dată.",
  },
  "condica-de-prezenta": {
    modul: "attendance",
    titlu: "Condica, ținută de pe telefon",
    text: "Ora sosirii și a plecării se notează pe loc, din telefon, iar evidența cerută de art. 119 alin. (1) din Codul muncii — zilnic, cu ora de început și de sfârșit — e gata de arătat inspectorului.",
  },
  "cerere-concediu-de-odihna": {
    modul: "leave",
    titlu: "Cererea, aprobarea și soldul, în același loc",
    text: "Omul cere concediul din telefon, șeful îl aprobă dintr-o apăsare, iar zilele lucrătoare se scad singure din sold, cu sărbătorile legale scoase la fel ca aici.",
  },
  "calculator-zile-concediu": {
    modul: "leave",
    titlu: "Soldul de concediu, ținut la zi",
    text: "În aplicație, dreptul fiecărui om se calculează din contract, iar soldul scade singur la fiecare cerere aprobată.",
  },
  "foaie-de-parcurs": {
    modul: "fleet",
    titlu: "Foile de parcurs, ținute pe fiecare mașină",
    text: "Modulul Flotă reține kilometrajul și alimentările de pe fiecare foaie, iar consumul rezultat se poate compara cu bonurile. Termenele mașinii se văd înainte de scadență.",
  },
  "fisa-instruire-ssm": {
    modul: "ssm",
    titlu: "Cine a făcut instruirea și când expiră",
    text: "Modulul SSM ține instruirile fiecărui om, cu semafor care se aprinde înainte de termen. Fișa semnată rămâne pe hârtie, ca aceasta; aplicația reține când și de către cine s-a făcut instruirea.",
  },
  "fisa-evaluare": {
    modul: "evaluations",
    titlu: "Evaluarea de anul trecut, găsită pe loc",
    text: "Șablonul de evaluare se face o dată și se refolosește anul următor, iar fiecare evaluare rămâne în dosarul omului, citibilă exact cum a fost completată.",
  },
  "calculator-salariu": {
    modul: "payroll",
    titlu: "Statul de plată, din aceeași aplicație",
    text: "Din fiecare lună de salarizare aprobată, modulul Salarizare scoate statul de plată, fluturașii pe care fiecare om îi vede în portal, declarația 112 și fișierul pentru bancă.",
  },
  /*
   * Uneltele adăugate de secțiunea K (K7–K10). Textele iau doar ce spun fișele
   * `leave` și `nucleu` din `fise-module.ts` și ce face `src/domain/leave/planificator.ts`
   * (un rând pe om, o coloană pe zi): aplicația NU emite adeverințe și NU
   * redactează demisii — ține cererile, soldul, planificatorul și fișa omului. O intrare pentru o unealtă care nu există
   * încă în hartă e inofensivă (`areCtaPropriu` e verificat doar pe hartă).
   */
  "calculator-zile-lucratoare": {
    modul: "leave",
    titlu: "Zilele de concediu, scăzute singure din sold",
    text: "În aplicație, omul cere concediul de pe telefon, iar soldul se scade la aprobare, nu la cerere, și se pune la loc dacă cererea se anulează. Nimeni nu mai ține un al doilea calcul pe hârtie.",
  },
  "programare-concedii": {
    modul: "leave",
    titlu: "Cine e plecat și când, pe ecranul de aprobare",
    text: "Documentul programării îl faci aici. În aplicație, planificatorul arată un rând pe om și o coloană pe zi, cu cererile aprobate și cele încă în aprobare, iar cine aprobă vede dacă un coleg din echipă e deja plecat în aceleași zile.",
  },
  "cerere-demisie": {
    modul: "nucleu",
    titlu: "Fișa fiecărui om, într-un singur loc",
    text: "În aplicație, fiecare angajat are fișa lui, cu drepturi pe rol, iar fiecare acțiune rămâne în jurnalul de audit. Ce iese din uz se marchează ca șters și rămâne în jurnal, nu dispare.",
  },
  "adeverinta-salariat": {
    modul: "nucleu",
    titlu: "Datele angajaților, ținute la zi",
    text: "În aplicație, fiecare angajat are fișa lui, ținută de HR, iar omul își vede propriile date din portal. Datele unei firme nu se văd din contul alteia.",
  },
};

const CTA_IMPLICIT: CtaUnealta = {
  modul: "nucleu",
  titlu: "Evidența de personal, într-un singur cont",
  text: "Pontaj de pe telefon, concedii și dosare de personal, ținute la zi pentru toată firma.",
};

export function areCtaPropriu(unealta: string): boolean {
  return Object.hasOwn(CTA, unealta);
}

export function ctaPentru(unealta: string): CtaUnealta {
  return (areCtaPropriu(unealta) ? CTA[unealta] : undefined) ?? CTA_IMPLICIT;
}

/** Prețul, ca pe `/preturi`: sume finale, fără TVA adăugat, fără card la înscriere. */
export function pretPentru(modul: FeatureKey): string {
  const baza = `${lunar(PRET_NUCLEU, "ro")} până la ${PRAG_ANGAJATI} de angajați, prima lună gratuită, fără card la înscriere`;
  const pret = PRETURI_MODULE[modul];
  if (MODULE_NUCLEU.includes(modul) || pret === undefined) {
    return `Intră în pachetul de bază: ${baza}. Preț final, fără TVA adăugat.`;
  }
  return `Contul pornește cu pachetul de bază: ${baza}. Modulul se adaugă cu ${lunar(pret, "ro")}. Prețuri finale, fără TVA adăugat.`;
}

/**
 * Adresa de înregistrare cu sursa uneltei. UTM, nu un parametru nou: A4 păstrează
 * `utm_*` în Umami, deci și pâlnia din browser vede sursa, iar pagina de
 * înregistrare citește aceeași valoare pe server (`sursaDinParametri`).
 */
export function adresaInregistrare(unealta: string, loc: LocCta): string {
  const q = new URLSearchParams({
    utm_source: SURSA_UTM_UNEALTA,
    utm_medium: loc,
    utm_campaign: unealta,
  });
  return `${RO.hero.ctaPrimar.href}?${q.toString()}`;
}
```

`src/app/(marketing)/_componente/revelare-dupa-descarcare.tsx`:

```tsx
"use client";

import { useEffect } from "react";

/**
 * Arată îndemnul de după document la primul clic pe un buton de descărcare.
 *
 * Descărcările sunt `formAction` spre o rută care răspunde cu un fișier, deci
 * pagina nu se reîncarcă. Fără asta, cine descarcă direct, fără „Generează”,
 * n-ar vedea niciodată îndemnul. Ascultă pe `document`, nu pe formular: butonul
 * stă într-un `<form>` al paginii, iar componenta n-are referință la el.
 */
export function RevelareDupaDescarcare({ tinta }: Readonly<{ tinta: string }>) {
  useEffect(() => {
    const laClic = (e: MouseEvent) => {
      const buton = e.target instanceof Element ? e.target.closest('button[name="format"]') : null;
      if (buton === null) return;
      const sectiune = document.getElementById(tinta);
      if (sectiune !== null) sectiune.hidden = false;
    };
    document.addEventListener("click", laClic);
    return () => document.removeEventListener("click", laClic);
  }, [tinta]);
  return null;
}
```

`src/app/(marketing)/_componente/continua-in-aplicatie.tsx`:

```tsx
import Link from "next/link";

import { adresaInregistrare, ctaPentru, pretPentru } from "@/content/landing/cta-unelte";
import { RO } from "@/content/landing/ro";
import { slugModul } from "@/content/landing/slug-module";
import type { ParametriPagina } from "@/lib/unelte/masurare";

import { areDateDeFormular } from "./adresa-analitice";
import { Banda } from "./banda";
import { RevelareDupaDescarcare } from "./revelare-dupa-descarcare";

/** Adevărat dacă vizitatorul a completat ceva: aceeași listă albă ca statistica (A2). */
export function aGenerat(p: ParametriPagina): boolean {
  const q = new URLSearchParams();
  for (const [cheie, valoare] of Object.entries(p)) {
    if (valoare === undefined) continue;
    for (const v of Array.isArray(valoare) ? valoare : [valoare]) q.append(cheie, v);
  }
  return areDateDeFormular(`?${q.toString()}`);
}

/**
 * Îndemnul de după document. Randat mereu, ascuns până la generare sau până la
 * primul clic pe o descărcare; ascuns și la tipar (`data-tipar="ascunde"`).
 */
export function ContinuaInAplicatie({
  unealta,
  generat,
}: Readonly<{ unealta: string; generat: boolean }>) {
  const cta = ctaPentru(unealta);
  const id = `continua-${unealta}`;
  return (
    <div id={id} hidden={!generat} data-tipar="ascunde">
      <Banda inaltime="scurta" supratitlu="Mai departe" titlu={cta.titlu} lead={cta.text}>
        <p className="text-mk-text-slab mt-4 max-w-[62ch] text-[0.9375rem] leading-[1.6]">
          {pretPentru(cta.modul)}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={adresaInregistrare(unealta, "dupa-document")}
            data-umami-event={`cta-${unealta}`}
            className="bg-mk-cerneala text-mk-text-inv inline-flex min-h-12 items-center rounded px-6 py-3 text-[0.9375rem] font-medium transition-opacity hover:opacity-90"
          >
            {RO.hero.ctaPrimar.eticheta}
          </Link>
          <Link
            href={`/module/${slugModul(cta.modul)}`}
            data-umami-event={`modul-din-${unealta}`}
            className="border-mk-rigla hover:border-mk-text inline-flex min-h-12 items-center rounded border px-6 py-3 text-[0.9375rem] font-medium transition-colors"
          >
            Cum arată în aplicație
          </Link>
        </div>
      </Banda>
      <RevelareDupaDescarcare tinta={id} />
    </div>
  );
}
```

**Paginile.** În fiecare `src/app/(marketing)/unelte/<slug>/page.tsx` se fac trei lucruri:

1. Importul se adaugă lângă celelalte importuri `../../_componente/…` (alfabetic, după `cadru`):

```tsx
import { ContinuaInAplicatie, aGenerat } from "../../_componente/continua-in-aplicatie";
```

   Plus, doar în paginile care au `href={RO.hero.ctaPrimar.href}`:

```tsx
import { adresaInregistrare } from "@/content/landing/cta-unelte";
```

2. Imediat după `</Banda>`-ul care închide `<Banda id="documentul" …>` (la calculatoarele fără `id="documentul"` — `calculator-salariu`, `calculator-zile-concediu` de la F, `calculator-zile-lucratoare` de la K —, după `</Banda>`-ul care închide banda cu `id="rezultat"`) se pune:

```tsx
      <ContinuaInAplicatie unealta="<slug>" generat={aGenerat(p)} />
```

   `p` e `const p = await searchParams;`, prezent azi în toate paginile (`condica:49`, `calculator:153`, `parcurs:57`, `cerere:91`, `ssm:53`, `evaluare:53`, `pontaj:67`). Dacă o secțiune anterioară l-a redenumit, folosești numele ei.

3. Fiecare `href={RO.hero.ctaPrimar.href}` devine `href={adresaInregistrare("<slug>", "banda")}`. `data-umami-event` și eticheta rămân. Pe lângă `foaie-de-pontaj:354` de azi, planurile E, F, G și I pun asemenea legături și în paginile lor (`E-pontaj-condica.md:5205`, `F-cerere-concediu.md:4568` și `:5393`, `G-foaie-parcurs.md:4592`, `I-fisa-evaluare.md:3909`); lista exactă o dă `grep -rn "RO.hero.ctaPrimar.href" "src/app/(marketing)/unelte"`. Dacă după înlocuire `RO` nu mai e folosit în pagină, scoți `import { RO } from "@/content/landing/ro";`, altfel `noUnusedLocals` face `pnpm typecheck` roșu.

Exemplul complet, pe codul citit azi. `condica-de-prezenta/page.tsx`, vechi (`:167-169`):

```tsx
      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>
```

Nou:

```tsx
      <Banda id="documentul" inaltime="scurta">
        <PrevizualizareDocument document={document} />
      </Banda>

      <ContinuaInAplicatie unealta="condica-de-prezenta" generat={aGenerat(p)} />
```

Aceeași formă, pe ancorele de azi:
- `foaie-de-parcurs/page.tsx:168-170`, `fisa-instruire-ssm/page.tsx:151-153` și `fisa-evaluare/page.tsx:160-162` au blocul identic cu cel de mai sus;
- `foaie-de-pontaj/page.tsx`: banda se închide la `:267-268` (`        </figure>` / `      </Banda>`);
- `cerere-concediu-de-odihna/page.tsx`: banda se închide la `:350-351` (`        )}` / `      </Banda>`);
- `calculator-salariu/page.tsx`: după `</Banda>`-ul de la `:257`, cel care închide `<Banda id="rezultat"`;
- `foaie-de-pontaj/page.tsx:354`: `href={RO.hero.ctaPrimar.href}` devine `href={adresaInregistrare("foaie-de-pontaj", "banda")}`.

E, F și C rescriu paginile. Ancora e elementul, nu numărul liniei, iar testul de mai sus o verifică pe fiecare pagină.

**`harta.ts`.** În blocul fiecărei pagini atinse (`cale: "/unelte/<slug>"`), `actualizat` devine data commitului. Deasupra primului bloc de unealtă se adaugă `// <dată>: îndemn după document, cu sursa uneltei în adresa de înregistrare.` Exemplu, pe valoarea de azi:

```ts
  {
    cale: "/unelte/condica-de-prezenta",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-07",
    sectiune: "Unelte și comparații",
  },
```

Nou:

```ts
  {
    cale: "/unelte/condica-de-prezenta",
    prioritate: 0.7,
    limba: "ro",
    traducere: null,
    actualizat: "2026-10-09",
    sectiune: "Unelte și comparații",
  },
```

(cu data reală a commitului).

Dacă testul „fiecare unealtă din hartă are textul ei” numește o unealtă fără intrare, adaugi intrarea în `CTA` după modelul celorlalte. Unealta a fost adăugată de altă secțiune a planului. Modulul se ia din `FISE` (`fise-module.ts`), iar textul din fișa modulului, fără promisiuni noi.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project ui "src/app/(marketing)/_componente/continua-in-aplicatie.test.tsx" "src/app/(marketing)/_componente/descarcari.test.tsx"
```

Apoi lanțul:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check src/content/landing/cta-unelte.ts "src/app/(marketing)/_componente/continua-in-aplicatie.tsx" "src/app/(marketing)/_componente/revelare-dupa-descarcare.tsx" "src/app/(marketing)/_componente/continua-in-aplicatie.test.tsx" "src/app/(marketing)/unelte"/*/page.tsx src/content/landing/harta.ts
```

`check:server` (`client-imports-server-only.mjs`): `revelare-dupa-descarcare.tsx` e singurul fișier `"use client"` nou și nu importă nimic de pe server.

- [ ] **Verificare headless la 360 px** (HTML și CSS local; dezvăluirea la clic NU se verifică local, memoria `erp-next-dev-nu-hidrateaza`, ci în J8). Pornești serverul în fundal:

```bash
cd /srv/apps/ERP && pnpm exec next dev -H 127.0.0.1 -p 3917
```

Scriptul, în `/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-masurare-conversie/cta-360.mjs`:

```js
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";

const BAZA = process.argv[2] ?? "http://127.0.0.1:3917";
const DOSAR = "/tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-masurare-conversie";
const CAZURI = [
  ["foaie-de-pontaj", "?luna=10&an=2026&ore=8&angajati=Test+Unu"],
  ["condica-de-prezenta", "?luna=10&an=2026&angajati=Test+Unu"],
  ["cerere-concediu-de-odihna", "?de_la=2026-12-01&pana_la=2026-12-05"],
  ["foaie-de-parcurs", "?luna=10&an=2026"],
  ["fisa-instruire-ssm", "?nume=Test"],
  ["fisa-evaluare", "?nume=Test"],
  ["calculator-salariu", "?brut=5000"],
];
const b = await chromium.launch({
  executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell",
});
const p = await b.newPage({ viewport: { width: 360, height: 800 } });
await p.route(/googletagmanager|google-analytics|analitice\.administrativo\.ro/u, (r) => r.abort());
let rau = 0;
for (const [slug, q] of CAZURI) {
  await p.goto(`${BAZA}/unelte/${slug}${q}`, { waitUntil: "load" });
  const vizibil = await p.locator(`#continua-${slug}`).isVisible();
  const href = await p.locator(`#continua-${slug} a[data-umami-event="cta-${slug}"]`).getAttribute("href");
  const [sw, cw] = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  await p.locator(`#continua-${slug}`).screenshot({ path: `${DOSAR}/cta-360-${slug}.png` });
  await p.goto(`${BAZA}/unelte/${slug}`, { waitUntil: "load" });
  const ascunsFara = !(await p.locator(`#continua-${slug}`).isVisible());
  const ok = vizibil && ascunsFara && sw === cw && href?.includes(`utm_campaign=${slug}`);
  if (!ok) rau += 1;
  console.log(slug, { vizibil, ascunsFara, sw, cw, href }, ok ? "OK" : "PICĂ");
}
await b.close();
process.exit(rau === 0 ? 0 : 1);
```

```bash
cd /srv/apps/ERP && for i in $(seq 1 60); do curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3917/unelte | grep -q 200 && break; sleep 2; done; node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-masurare-conversie/cta-360.mjs; echo "cod=$?"
```

Așteptat:
- 7 rânduri `OK` și `cod=0`, cu `vizibil: true`, `ascunsFara: true`, `sw === cw === 360` și `href` de forma `/inregistrare?utm_source=unealta&utm_medium=dupa-document&utm_campaign=<slug>`;
- în capturile `cta-360-<slug>.png`, cele două butoane se citesc întregi și se așază unul sub altul fără să iasă din ecran;
- pe SSM, nota despre hârtie e vizibilă.

Oprirea, într-un apel separat: `pkill -f "next dev -H 127.0.0.1 -p 391[7]"`. Apoi `rm -f .next/dev/types/validator.ts .next/dev/types/routes.d.ts && pnpm typecheck`.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
mapfile -t PAGINI < <(git diff --name-only -- "src/app/(marketing)/unelte" | grep '/page.tsx$')
NOI=(src/content/landing/cta-unelte.ts "src/app/(marketing)/_componente/continua-in-aplicatie.tsx" "src/app/(marketing)/_componente/revelare-dupa-descarcare.tsx" "src/app/(marketing)/_componente/continua-in-aplicatie.test.tsx")
C=("${NOI[@]}" "${PAGINI[@]}" src/content/landing/harta.ts)
git status --short -- "${C[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "${NOI[@]}"
git commit --only -m "feat(unelte): îndemn după document, pe fiecare unealtă, cu sursa în adresa de înregistrare

Textul spune ce face modulul în locul uneltei; prețul vine din preturi.ts;
ascuns până la generare sau până la primul clic pe o descărcare. Banda de jos
duce și ea sursa (utm_campaign). lastmod pe paginile atinse.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${C[@]}"
git merge origin/main
git push origin main
```

---

### Task J6: raportul săptămânal din Umami

**Fișiere:**
- Create: `scripts/raport-unelte/agregare.mjs`
- Create: `scripts/raport-unelte/raport.mjs`
- Test: `scripts/raport-unelte/agregare.test.ts` (proiectul `unit` include `scripts/**/*.test.ts`, `vitest.config.mts:68`; `tsconfig.json` are `allowJs: true`, deci importul din `.mjs` se tipizează)

**Interfețe:**
- Consumă: API-ul Umami 3.3.1, verificat azi pe producție (citire):
  - `POST /api/auth/login` → `{ token }`;
  - `GET /api/websites/<id>/metrics?type=event&startAt&endAt&limit` → `[{ x, y }]`, cu `y` număr;
  - `GET …/metrics?type=path&…&country=eq.RO` → `[{ x: "/unelte/foaie-de-pontaj", y: 2 }, …]`;
  - `GET …/stats?…&path=eq./unelte/<slug>&country=eq.RO` → `{ pageviews, visitors, visits, bounces, totaltime, comparison }`, numere simple.

  `.env.production` are `UMAMI_ADMIN_PAROLA`, `NEXT_PUBLIC_UMAMI_ID` și `NEXT_PUBLIC_UMAMI_SRC` (verificat cu `grep -o '^[A-Z_]*UMAMI[A-Z_]*='`).
- Produce (`agregare.mjs`):

```js
export const CLASE; // ["om", "neconfirmat", "robot", "audit"]
export function valoareDinEnv(text, cheie); // string | null
export function numar(v); // number
export function saptamanaTrecuta(acum); // { de: Date, pana: Date, eticheta: string }
export function intervalExplicit(deLa, panaLa); // { de, pana, eticheta }; aruncă la date greșite
export function parseazaEvenimente(randuri); // { unelte: Map<slug, Rand>, conturiDirecte: number, browser: {nume, numar}[] }
export function randeazaRaport({ eticheta, de, pana, vizitatori, evenimente }); // string (Markdown)
```

- [ ] **Pasul 1: Scrie testul care pică** — `scripts/raport-unelte/agregare.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  intervalExplicit,
  numar,
  parseazaEvenimente,
  randeazaRaport,
  saptamanaTrecuta,
  valoareDinEnv,
} from "./agregare.mjs";

describe("valoareDinEnv", () => {
  it("citește o singură cheie, cu ghilimele, fără să confunde prefixele", () => {
    const text =
      'A=1\nXUMAMI_ADMIN_PAROLA=nu\r\nUMAMI_ADMIN_PAROLA="s3cr=et"\r\nB=\nC=\'unu doi\'\n';
    expect(valoareDinEnv(text, "UMAMI_ADMIN_PAROLA")).toBe("s3cr=et");
    expect(valoareDinEnv(text, "C")).toBe("unu doi");
    expect(valoareDinEnv(text, "B")).toBeNull();
    expect(valoareDinEnv(text, "LIPSA")).toBeNull();
  });
});

describe("numar", () => {
  it("acceptă numere, șiruri și forma veche { value }", () => {
    expect(numar(3)).toBe(3);
    expect(numar("4")).toBe(4);
    expect(numar({ value: 5 })).toBe(5);
    expect(numar(null)).toBe(0);
    expect(numar("x")).toBe(0);
  });
});

describe("săptămâna", () => {
  it("joi, 8 oct 2026 → săptămâna ISO 40, de luni până duminică", () => {
    const s = saptamanaTrecuta(new Date("2026-10-08T12:00:00Z"));
    expect(s.de.toISOString()).toBe("2026-09-28T00:00:00.000Z");
    expect(s.pana.toISOString()).toBe("2026-10-04T23:59:59.999Z");
    expect(s.eticheta).toBe("2026-S40");
  });

  it("lunea dă săptămâna care tocmai s-a încheiat, nu pe cea de azi", () => {
    expect(saptamanaTrecuta(new Date("2026-10-05T01:00:00Z")).eticheta).toBe("2026-S40");
    expect(saptamanaTrecuta(new Date("2026-10-04T23:00:00Z")).eticheta).toBe("2026-S39");
  });

  it("peste an: 6 ian 2027 → 2026-S53", () => {
    const s = saptamanaTrecuta(new Date("2027-01-06T08:00:00Z"));
    expect(s.de.toISOString()).toBe("2026-12-28T00:00:00.000Z");
    expect(s.eticheta).toBe("2026-S53");
  });

  it("intervalul explicit include ambele zile și refuză datele greșite", () => {
    const i = intervalExplicit("2026-10-01", "2026-10-07");
    expect(i.de.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(i.pana.toISOString()).toBe("2026-10-07T23:59:59.999Z");
    expect(() => intervalExplicit("2026-10-07", "2026-10-01")).toThrow("Intervalul e inversat.");
    expect(() => intervalExplicit("1 oct", "2026-10-07")).toThrow("AAAA-LL-ZZ");
    expect(() => intervalExplicit("2026-13-40", "2026-10-07")).toThrow("Data nu există.");
  });
});

const RANDURI = [
  { x: "dl:foaie-de-pontaj:xlsx:om", y: 1 },
  { x: "dl:foaie-de-pontaj:xlsx:neconfirmat", y: "1" },
  { x: "dl:foaie-de-pontaj:pdf:audit", y: 3 },
  { x: "dl:condica-de-prezenta:docx:robot", y: 2 },
  { x: "cont:foaie-de-pontaj", y: 1 },
  { x: "cont:direct", y: 2 },
  { x: "foaie-genereaza", y: 4 },
  { x: "condica-pdf", y: 1 },
  { x: "cta-foaie-de-pontaj", y: 1 },
  { x: "citire", y: 42 },
  { x: "dl:rau", y: 9 },
];

describe("parseazaEvenimente", () => {
  it("separă descărcările pe clasă, formatele oamenilor și conturile", () => {
    const e = parseazaEvenimente(RANDURI);
    expect(e.unelte.get("foaie-de-pontaj")).toEqual({
      om: 1,
      neconfirmat: 1,
      robot: 0,
      audit: 3,
      formate: { xlsx: 2 },
      conturi: 1,
    });
    expect(e.unelte.get("condica-de-prezenta")?.robot).toBe(2);
    expect(e.conturiDirecte).toBe(2);
    expect(e.browser).toEqual([
      { nume: "foaie-genereaza", numar: 4 },
      { nume: "condica-pdf", numar: 1 },
      { nume: "cta-foaie-de-pontaj", numar: 1 },
    ]);
  });
});

describe("randeazaRaport", () => {
  it("un rând pe unealtă, ordonat după oamenii care au descărcat, cu totalul", () => {
    const text = randeazaRaport({
      eticheta: "2026-S40",
      de: new Date("2026-09-28T00:00:00.000Z"),
      pana: new Date("2026-10-04T23:59:59.999Z"),
      vizitatori: new Map([
        ["foaie-de-pontaj", 2],
        ["calculator-salariu", 1],
      ]),
      evenimente: parseazaEvenimente(RANDURI),
    });
    expect(text).toContain("# Uneltele gratuite — 2026-S40 (2026-09-28 – 2026-10-04)");
    const randuri = text.split("\n").filter((l) => l.startsWith("| "));
    expect(randuri.slice(2, 6)).toEqual([
      "| foaie-de-pontaj | 2 | 1 | 1 | 0 | 3 | xlsx 2 | 1 |",
      "| calculator-salariu | 1 | 0 | 0 | 0 | 0 | — | 0 |",
      "| condica-de-prezenta | 0 | 0 | 0 | 2 | 0 | — | 0 |",
      "| **Total** | 3 | 1 | 1 | 2 | 3 | | 1 |",
    ]);
    expect(text).toContain("Conturi fără unealtă (direct): 2");
    expect(text).toContain("| foaie-genereaza | 4 |");
  });

  it("o săptămână fără nimic se spune, nu se ascunde", () => {
    const text = randeazaRaport({
      eticheta: "2026-S41",
      de: new Date("2026-10-05T00:00:00.000Z"),
      pana: new Date("2026-10-11T23:59:59.999Z"),
      vizitatori: new Map(),
      evenimente: parseazaEvenimente([]),
    });
    expect(text).toContain("| **Total** | 0 | 0 | 0 | 0 | 0 | | 0 |");
    expect(text).toContain("(niciun eveniment)");
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit scripts/raport-unelte/agregare.test.ts
```

Așteptat: `Failed to resolve import "./agregare.mjs"`.

- [ ] **Pasul 3: Implementarea minimă**

`scripts/raport-unelte/agregare.mjs`:

```js
// scripts/raport-unelte/agregare.mjs
/**
 * Raportul săptămânal al uneltelor gratuite — partea pură, fără rețea și fără
 * parolă, ca testul (`agregare.test.ts`) s-o poată verifica.
 *
 * Numele evenimentelor de server vin din `src/lib/unelte/masurare.ts`:
 *   dl:<unealtă>:<format>:<clasă>   o descărcare; clasa: om, neconfirmat, robot, audit
 *   cont:<sursă>                    un cont creat; sursa e unealta sau „direct”
 *
 * `.mjs`, nu `.ts`: pe VM rulează Node 20, fără eliminarea tipurilor.
 */

const ZI = 24 * 60 * 60 * 1000;

export const CLASE = ["om", "neconfirmat", "robot", "audit"];

const DESCARCARE = /^dl:([a-z0-9-]+):([a-z0-9]+):(om|neconfirmat|robot|audit)$/u;
const CONT = /^cont:([a-z0-9-]+)$/u;
const DIN_BROWSER = /-(?:genereaza|pdf|docx|xlsx)$|^cta-|^modul-din-|^inregistrare-trimisa$/u;

/** O cheie din `.env`, citită pe linie, fără `source` (ca `umami-goaluri.sh`). */
export function valoareDinEnv(text, cheie) {
  for (const linie of text.split(/\r?\n/u)) {
    if (!linie.startsWith(`${cheie}=`)) continue;
    let valoare = linie.slice(cheie.length + 1).trim();
    const intre = (c) => valoare.length >= 2 && valoare.startsWith(c) && valoare.endsWith(c);
    if (intre('"') || intre("'")) valoare = valoare.slice(1, -1);
    return valoare === "" ? null : valoare;
  }
  return null;
}

/** Umami 3.3.1 dă numere; versiunile vechi dădeau `{ value, prev }`. */
export function numar(v) {
  const brut = typeof v === "object" && v !== null && "value" in v ? v.value : v;
  const n = Number(brut);
  return Number.isFinite(n) ? n : 0;
}

function etichetaIso(luni) {
  const joi = new Date(luni.getTime() + 3 * ZI);
  const an = joi.getUTCFullYear();
  const saptamana = 1 + Math.floor((joi.getTime() - Date.UTC(an, 0, 1)) / ZI / 7);
  return `${an}-S${String(saptamana).padStart(2, "0")}`;
}

/** Ultima săptămână ISO încheiată, în UTC: luni 00:00 → duminică 23:59:59.999. */
export function saptamanaTrecuta(acum) {
  const azi = Date.UTC(acum.getUTCFullYear(), acum.getUTCMonth(), acum.getUTCDate());
  const dinLuni = (new Date(azi).getUTCDay() + 6) % 7;
  const luniaAceasta = azi - dinLuni * ZI;
  const de = new Date(luniaAceasta - 7 * ZI);
  return { de, pana: new Date(luniaAceasta - 1), eticheta: etichetaIso(de) };
}

/** `--de-la 2026-10-01 --pana-la 2026-10-07`: ambele zile incluse. */
export function intervalExplicit(deLa, panaLa) {
  const forma = /^\d{4}-\d{2}-\d{2}$/u;
  if (!forma.test(deLa) || !forma.test(panaLa)) throw new Error("Datele se scriu AAAA-LL-ZZ.");
  const de = new Date(`${deLa}T00:00:00Z`);
  const sfarsit = Date.parse(`${panaLa}T00:00:00Z`);
  if (Number.isNaN(de.getTime()) || Number.isNaN(sfarsit)) throw new Error("Data nu există.");
  const pana = new Date(sfarsit + ZI - 1);
  if (de.getTime() > pana.getTime()) throw new Error("Intervalul e inversat.");
  return { de, pana, eticheta: `${deLa} – ${panaLa}` };
}

export function parseazaEvenimente(randuri) {
  const unelte = new Map();
  const rand = (slug) => {
    let r = unelte.get(slug);
    if (r === undefined) {
      r = { om: 0, neconfirmat: 0, robot: 0, audit: 0, formate: {}, conturi: 0 };
      unelte.set(slug, r);
    }
    return r;
  };
  let conturiDirecte = 0;
  const browser = [];
  for (const { x, y } of randuri) {
    const n = numar(y);
    const dl = DESCARCARE.exec(x);
    if (dl !== null) {
      const [, slug, format, clasa] = dl;
      const r = rand(slug);
      r[clasa] += n;
      if (clasa === "om" || clasa === "neconfirmat") r.formate[format] = (r.formate[format] ?? 0) + n;
      continue;
    }
    const cont = CONT.exec(x);
    if (cont !== null) {
      if (cont[1] === "direct") conturiDirecte += n;
      else rand(cont[1]).conturi += n;
      continue;
    }
    if (DIN_BROWSER.test(x)) browser.push({ nume: x, numar: n });
  }
  browser.sort((a, b) => b.numar - a.numar || a.nume.localeCompare(b.nume));
  return { unelte, conturiDirecte, browser };
}

export function randeazaRaport({ eticheta, de, pana, vizitatori, evenimente }) {
  const zi = (d) => d.toISOString().slice(0, 10);
  const gol = { om: 0, neconfirmat: 0, robot: 0, audit: 0, formate: {}, conturi: 0 };
  const slugs = [...new Set([...vizitatori.keys(), ...evenimente.unelte.keys()])];
  const randuri = slugs
    .map((slug) => ({ slug, v: vizitatori.get(slug) ?? 0, ...(evenimente.unelte.get(slug) ?? gol) }))
    .sort((a, b) => b.om - a.om || b.v - a.v || a.slug.localeCompare(b.slug));
  const total = randuri.reduce(
    (t, r) => ({
      v: t.v + r.v,
      om: t.om + r.om,
      neconfirmat: t.neconfirmat + r.neconfirmat,
      robot: t.robot + r.robot,
      audit: t.audit + r.audit,
      conturi: t.conturi + r.conturi,
    }),
    { v: 0, om: 0, neconfirmat: 0, robot: 0, audit: 0, conturi: 0 },
  );
  const formate = (f) =>
    Object.entries(f)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, n]) => `${k} ${n}`)
      .join(" · ") || "—";
  const linii = [
    `# Uneltele gratuite — ${eticheta} (${zi(de)} – ${zi(pana)})`,
    "",
    "| Unealta | Vizitatori RO | Descărcări om | Neconfirmate | Roboți | Audit | Formate (om + neconfirmate) | Conturi |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |",
    ...randuri.map(
      (r) =>
        `| ${r.slug} | ${r.v} | ${r.om} | ${r.neconfirmat} | ${r.robot} | ${r.audit} | ${formate(r.formate)} | ${r.conturi} |`,
    ),
    `| **Total** | ${total.v} | ${total.om} | ${total.neconfirmat} | ${total.robot} | ${total.audit} | | ${total.conturi} |`,
    "",
    `Conturi fără unealtă (direct): ${evenimente.conturiDirecte}`,
    "",
    "## Din browser (Umami, doar vizitatorii care nu blochează măsurarea)",
    "",
    ...(evenimente.browser.length === 0
      ? ["(niciun eveniment)"]
      : [
          "| Eveniment | Număr |",
          "| --- | ---: |",
          ...evenimente.browser.map((e) => `| ${e.nume} | ${e.numar} |`),
        ]),
    "",
    "Citire: „om” = descărcare pornită de un clic (Sec-Fetch-User); „neconfirmate” = fără semnul ăsta (preîncărcări, managerul de descărcări din Android, browsere vechi, boți deghizați); „audit” = testele noastre (?m=, IP-ul serverului). Vizitatorii RO includ și echipa.",
  ];
  return `${linii.join("\n")}\n`;
}
```

`scripts/raport-unelte/raport.mjs`:

```js
#!/usr/bin/env node
// scripts/raport-unelte/raport.mjs
/**
 * Raportul săptămânal al uneltelor gratuite: vizitatori, descărcări și conturi,
 * pe unealtă, din Umami.
 *
 *   node scripts/raport-unelte/raport.mjs                     # ultima săptămână ISO încheiată
 *   node scripts/raport-unelte/raport.mjs --de-la 2026-10-01 --pana-la 2026-10-07
 *   node scripts/raport-unelte/raport.mjs --json              # pentru alte scripturi
 *
 * Parola: `UMAMI_ADMIN_PAROLA` din mediu sau din `.env.production`, citită pe
 * linie, nu cu `source`. Nu se tipărește niciodată, nici ea, nici tokenul;
 * erorile spun doar codul HTTP.
 *
 * ── DE CE DIN UMAMI ȘI NU DIN JURNALELE nginx ─────────────────────────────
 * Jurnalul edge-ului e stdout-ul unui container comun cu ~10 site-uri și se
 * pierde la recreare; din 8 oct 2026 nici nu mai poartă query-ul uneltelor (A6).
 * Plus o capcană de citire: o aterizare din Google apare cu IP-ul proxy-ului de
 * preîncărcare Chrome (2001:4860:7:*), iar omul abia la cererile următoare, cu
 * IP-ul lui. Numărătoarea de care e nevoie o trimite serverul nostru la Umami.
 */
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import {
  intervalExplicit,
  numar,
  parseazaEvenimente,
  randeazaRaport,
  saptamanaTrecuta,
  valoareDinEnv,
} from "./agregare.mjs";

const { values: arg } = parseArgs({
  options: {
    "de-la": { type: "string" },
    "pana-la": { type: "string" },
    json: { type: "boolean", default: false },
  },
});

function mor(mesaj, cod = 1) {
  process.stderr.write(`✗ ${mesaj}\n`);
  process.exit(cod);
}

let env = "";
try {
  env = readFileSync(new URL("../../.env.production", import.meta.url), "utf8");
} catch {
  // Fără fișier: rămân variabilele din mediu.
}

const parola = process.env.UMAMI_ADMIN_PAROLA ?? valoareDinEnv(env, "UMAMI_ADMIN_PAROLA");
const site = process.env.UMAMI_SITE_ID ?? valoareDinEnv(env, "NEXT_PUBLIC_UMAMI_ID");
const script = valoareDinEnv(env, "NEXT_PUBLIC_UMAMI_SRC");
const gazda =
  process.env.UMAMI_GAZDA ??
  (script === null ? "https://analitice.administrativo.ro" : new URL(script).origin);
if (parola === null || parola === "") {
  mor("UMAMI_ADMIN_PAROLA lipsește — nici în mediu, nici în .env.production.");
}
if (site === null) mor("Identificatorul sitului lipsește (NEXT_PUBLIC_UMAMI_ID sau UMAMI_SITE_ID).");

let interval;
try {
  interval =
    arg["de-la"] !== undefined || arg["pana-la"] !== undefined
      ? intervalExplicit(arg["de-la"] ?? "", arg["pana-la"] ?? "")
      : saptamanaTrecuta(new Date());
} catch (eroare) {
  mor(eroare instanceof Error ? eroare.message : "Interval greșit.");
}

const login = await fetch(`${gazda}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: process.env.UMAMI_ADMIN_UTILIZATOR ?? "admin", password: parola }),
  signal: AbortSignal.timeout(20_000),
}).catch(() => null);
if (login === null || !login.ok) {
  mor(`Autentificarea la Umami a eșuat (HTTP ${login?.status ?? "fără răspuns"}).`, 2);
}
const { token } = await login.json();

async function api(cale) {
  const r = await fetch(`${gazda}${cale}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (r === null || !r.ok) mor(`Umami a răspuns ${r?.status ?? "nimic"} la ${cale.split("?")[0]}.`, 2);
  return r.json();
}

const fereastra = `startAt=${interval.de.getTime()}&endAt=${interval.pana.getTime()}`;
const evenimenteBrute = await api(`/api/websites/${site}/metrics?type=event&${fereastra}&limit=500`);
const cai = await api(
  `/api/websites/${site}/metrics?type=path&${fereastra}&country=eq.RO&limit=500`,
);
const evenimente = parseazaEvenimente(evenimenteBrute);

const slugs = new Set(evenimente.unelte.keys());
for (const { x } of cai) {
  const m = /^\/unelte\/([a-z0-9-]+)$/u.exec(x);
  if (m !== null) slugs.add(m[1]);
}

const vizitatori = new Map();
for (const slug of [...slugs].sort()) {
  const s = await api(
    `/api/websites/${site}/stats?${fereastra}&path=eq./unelte/${slug}&country=eq.RO`,
  );
  vizitatori.set(slug, numar(s.visitors));
}

if (arg.json) {
  const iesire = {
    eticheta: interval.eticheta,
    de: interval.de.toISOString(),
    pana: interval.pana.toISOString(),
    vizitatori: Object.fromEntries(vizitatori),
    evenimente: evenimenteBrute,
  };
  process.stdout.write(`${JSON.stringify(iesire, null, 2)}\n`);
} else {
  process.stdout.write(
    randeazaRaport({
      eticheta: interval.eticheta,
      de: interval.de,
      pana: interval.pana,
      vizitatori,
      evenimente,
    }),
  );
}
```

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit scripts/raport-unelte/agregare.test.ts
```

Apoi lanțul:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check scripts/raport-unelte/agregare.mjs scripts/raport-unelte/raport.mjs scripts/raport-unelte/agregare.test.ts
```

Dacă `typecheck` cade pe accesul `r[clasa]` sau `v.value` din `.mjs`, motivul e că `checkJs` e pornit undeva. Nu e azi (`tsconfig.json`). Adaugi atunci `// @ts-check` cu JSDoc pe funcție, nu `any`.

- [ ] **Verificare pe Umami-ul real (citire)**

```bash
cd /srv/apps/ERP && node scripts/raport-unelte/raport.mjs --de-la 2026-09-28 --pana-la 2026-10-08; echo "cod=$?"
cd /srv/apps/ERP && node scripts/raport-unelte/raport.mjs --de-la 2026-09-28 --pana-la 2026-10-08 --json | head -c 600; echo
cd /srv/apps/ERP && node scripts/raport-unelte/raport.mjs --de-la 2026-10-08 --pana-la 2026-10-01; echo "cod=$?"
```

Așteptat, pe datele de azi, citite prin API în timpul planificării:
- tabel cu cel puțin rândurile `foaie-de-pontaj` (2 vizitatori RO), `calculator-salariu`, `cerere-concediu-de-odihna`, `condica-de-prezenta`;
- zero `dl:*`, fiindcă numărarea pe server nu e încă în producție;
- în „Din browser”, `foaie-genereaza | 1`;
- `cod=0`;
- `--json` începe cu `{ "eticheta": "2026-09-28 – 2026-10-08"`;
- al treilea apel: `✗ Intervalul e inversat.` și `cod=1`;
- parola nu apare nicăieri în ieșire. Verifici cu `node scripts/raport-unelte/raport.mjs 2>&1 | grep -cF "$(grep -m1 '^UMAMI_ADMIN_PAROLA=' .env.production | cut -d= -f2- | tr -d '"')"`, care trebuie să dea `0`. Comanda nu tipărește parola, doar numărul.

- [ ] **Commit**

```bash
cd /srv/apps/ERP
C=(scripts/raport-unelte/agregare.mjs scripts/raport-unelte/raport.mjs scripts/raport-unelte/agregare.test.ts)
git status --short -- "${C[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- "${C[@]}"
git commit --only -m "feat(unelte): raportul săptămânal din Umami — vizitatori, descărcări pe clasă, conturi pe sursă

Ultima săptămână ISO încheiată sau un interval explicit; parola din mediu sau
din .env.production, citită pe linie și netipărită.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${C[@]}"
git merge origin/main
git push origin main
```

---

### Task J7: panoul din Umami numără ce se întâmplă

**Fișiere:**
- Modify: `scripts/umami-goaluri.sh`. Funcția nouă `sterge_daca` vine după `creeaza()` (`:70-84`), iar blocul goal-ului mort (`:102-104`) se înlocuiește.
- Test: `scripts/umami-goaluri.test.ts` (Create, proiectul `unit`)

**Interfețe:**
- Consumă:
  - `GET /api/reports?websiteId=…&pageSize=200`, care întoarce `data[]` cu `id`, `type`, `name`, `parameters.value`. Verificat azi: `948522f2… goal "Descărcări foaie de pontaj" foaie-excel`;
  - `DELETE /api/reports/<id>`, exportat de `src/app/api/reports/[reportId]/route.ts` în Umami v3.3.1;
  - `SLUGURI_UNELTE`, `CLASE`, `FORMATE_NUMARATE` (J1); `PAGINI` din `harta.ts`.
- Produce: goal-urile „Foaia de pontaj în Excel (server, om)”, „Cont venit din foaia de pontaj (server)” și „Cont venit din cererea de concediu (server)”. Goal-ul mort dispare.

- [ ] **Pasul 1: Scrie testul care pică** — `scripts/umami-goaluri.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PAGINI } from "@/content/landing/harta";
import { CLASE, FORMATE_NUMARATE, SLUGURI_UNELTE } from "@/lib/unelte/masurare";

/**
 * Pe 8 oct 2026, goal-ul „Descărcări foaie de pontaj” număra `foaie-excel`, pe
 * care nu-l mai trimitea nimic: butoanele trimit `foaie-pdf|docx|xlsx`. Panoul a
 * arătat zero, indiferent de câte descărcări ar fi fost. Testul leagă fiecare
 * goal de un eveniment pe care codul chiar îl emite.
 */
const SCRIPT = readFileSync("scripts/umami-goaluri.sh", "utf8");

function fisiere(dosar: string): string[] {
  return readdirSync(dosar, { withFileTypes: true }).flatMap((intrare) => {
    const cale = join(dosar, intrare.name);
    if (intrare.isDirectory()) return fisiere(cale);
    return /\.tsx?$/u.test(intrare.name) && !/\.test\.tsx?$/u.test(intrare.name) ? [cale] : [];
  });
}
const SURSA = fisiere("src")
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

function emis(nume: string): boolean {
  const dl = /^dl:([a-z0-9-]+):([a-z0-9]+):([a-z]+)$/u.exec(nume);
  if (dl !== null) {
    const [, slug = "", format = "", clasa = ""] = dl;
    return (
      SLUGURI_UNELTE.has(slug) &&
      (FORMATE_NUMARATE.has(format) || format === "alt") &&
      (CLASE as readonly string[]).includes(clasa)
    );
  }
  const cont = /^cont:([a-z0-9-]+)$/u.exec(nume);
  if (cont !== null) return cont[1] === "direct" || SLUGURI_UNELTE.has(cont[1] ?? "");
  return SURSA.includes(`data-umami-event="${nume}"`);
}

describe("goal-urile și pâlniile din Umami", () => {
  it("fiecare goal pe eveniment numără un eveniment emis de cod", () => {
    const evenimente = [
      ...[...SCRIPT.matchAll(/\$\(g event ([^)\s]+)\)/gu)].map((m) => m[1] ?? ""),
      ...[...SCRIPT.matchAll(/"type":"event","value":"([^"]+)"/gu)].map((m) => m[1] ?? ""),
    ];
    expect(evenimente.length).toBeGreaterThanOrEqual(5);
    for (const nume of evenimente) expect(emis(nume), nume).toBe(true);
  });

  it("fiecare goal pe cale ține o pagină din hartă", () => {
    const cai = [...SCRIPT.matchAll(/\$\(g path ([^)\s]+)\)/gu)].map((m) => m[1] ?? "");
    const din = new Set(PAGINI.map((p) => p.cale));
    for (const cale of cai) expect(din.has(cale), cale).toBe(true);
  });
});
```

- [ ] **Pasul 2: Rulează-l și vezi-l picând**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit scripts/umami-goaluri.test.ts
```

Așteptat: `foaie-excel: expected false to be true`.

- [ ] **Pasul 3: Implementarea minimă** — `scripts/umami-goaluri.sh`.

După funcția `creeaza() { … }` (care se termină la `:84`) adaugi:

```bash

# Șterge un raport după nume, DOAR dacă ține încă valoarea veche. O a doua
# rulare, sau un raport refăcut de mână cu alt eveniment, rămân neatinse.
sterge_daca() {
  local nume="$1" valoare="$2" id cod
  id="$(api "$LISTA" | jq -r --arg n "$nume" --arg v "$valoare" \
    '(.data // [])[] | select(.name == $n and .parameters.value == $v) | .id' | head -n1)"
  if [ -z "$id" ]; then
    printf "   ${D}=${N} %-42s nu mai ține „%s”, sar\n" "$nume" "$valoare"; return 0
  fi
  cod="$(api -o /tmp/umami-raspuns.json -w '%{http_code}' -X DELETE "$GAZDA/api/reports/$id")"
  if [ "$cod" = "200" ] || [ "$cod" = "204" ]; then
    printf "   ${V}-${N} %-42s șters (număra „%s”)\n" "$nume" "$valoare"
  else
    printf "   ${R}✗${N} %-42s HTTP %s — %s\n" "$nume" "$cod" "$(head -c 160 /tmp/umami-raspuns.json)"
  fi
}
```

Vechi (`:102-104`):

```bash
creeaza "Descărcări foaie de pontaj"     goal \
  "Exportul în Excel al uneltei gratuite. Măsoară dacă momeala prinde." \
  "$(g event foaie-excel)"
```

Nou:

```bash
# „Descărcări foaie de pontaj" număra `foaie-excel`, pe care nu-l mai trimite
# nimic (butoanele trimit `foaie-pdf|docx|xlsx`): a arătat zero pentru totdeauna
# (8 oct 2026). Îl înlocuiesc evenimentele de pe server, care nu depind de
# blocantul vizitatorului — `src/lib/unelte/masurare.ts`.
sterge_daca "Descărcări foaie de pontaj" foaie-excel

creeaza "Foaia de pontaj în Excel (server, om)"   goal \
  "Descărcarea Excel pornită de un clic, numărată pe server, fără IP." \
  "$(g event dl:foaie-de-pontaj:xlsx:om)"

creeaza "Cont venit din foaia de pontaj (server)" goal \
  "Contul creat după îndemnul din foaia de pontaj, numărat pe server." \
  "$(g event cont:foaie-de-pontaj)"

creeaza "Cont venit din cererea de concediu (server)" goal \
  "Contul creat după îndemnul din cererea de concediu, numărat pe server." \
  "$(g event cont:cerere-concediu-de-odihna)"
```

Mesajul final al scriptului nu se schimbă. Verificarea de la pasul 5 citește lista după rulare.

- [ ] **Pasul 4: Rulează testele, trec**

```bash
cd /srv/apps/ERP && pnpm exec vitest run --project unit scripts/umami-goaluri.test.ts && bash -n scripts/umami-goaluri.sh && echo "sintaxa ok"
```

Apoi lanțul:

```bash
cd /srv/apps/ERP && pnpm typecheck && pnpm check:server && pnpm lint && pnpm test && node scripts/checks/lastmod.mjs && pnpm exec prettier --check scripts/umami-goaluri.test.ts
```

- [ ] **Commit** (scriptul NU se rulează aici: schimbă panoul de producție, iar asta se face în J8, după deploy)

```bash
cd /srv/apps/ERP
C=(scripts/umami-goaluri.sh scripts/umami-goaluri.test.ts)
git status --short -- "${C[@]}"
git fetch origin main
git diff --name-only HEAD origin/main
git add -- scripts/umami-goaluri.test.ts
git commit --only -m "fix(analitice): goal-ul „foaie-excel” număra un eveniment care nu mai există

Se șterge doar dacă ține încă valoarea veche; goal-uri noi pe evenimentele de
server (dl:…:om, cont:…). Un test leagă fiecare goal de un eveniment emis.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "${C[@]}"
git merge origin/main
git push origin main
```

---

### Task J8: deploy și dovada pe producție

**Fișiere:** niciunul în repo. Memoria `erp-analitice-fapte-verificate.md` se actualizează în afara repo-ului.

**Interfețe:**
- Consumă: `ADM_MEDIU=staging ./administrativo.sh stack:deploy`, `./administrativo.sh prod`, `./administrativo.sh stack:status` (ca în A8), `scripts/raport-unelte/raport.mjs` (J6), `scripts/umami-goaluri.sh` (J7), `cta-360.mjs` (J5).
- Produce: producția cu J3, J4 și J5 active, plus panoul Umami reparat.

- [ ] **Pasul 1: Staging întâi** (memoria `erp-staging-cade-tacut`):

```bash
cd /srv/apps/ERP && ADM_MEDIU=staging ./administrativo.sh stack:deploy
A="coleg:$(cat ~/.secrete/administrativo/parola-staging.txt)"
curl -sS -u "$A" -o /dev/null -w '%{http_code} %{content_type}\n' "https://staging.administrativo.ro/api/unelte/condica-de-prezenta?format=pdf&luna=10&an=2026"
node scripts/raport-unelte/raport.mjs --de-la "$(date -u +%F)" --pana-la "$(date -u +%F)" --json | grep -c '"x": "dl:' || true
```

Așteptat:
- `200 application/pdf`;
- numărul de `dl:` neschimbat față de o rulare dinaintea `curl`-ului. Gazda e `staging.administrativo.ro`, deci nu se trimite nimic la Umami-ul de producție.
- [ ] **Pasul 2: OPREȘTE-TE și cere confirmarea utilizatorului pentru producție**: „Fac deploy pe producție cu numărarea pe server a descărcărilor și conturilor (fără IP) și cu îndemnul de după document?”. În aceeași întrebare spui că punctul ⚠ din „Temeiuri și fapte tehnice verificate” (art. 4 alin. (5) din Legea 506/2004 și interesul legitim) e încă neconfirmat de jurist, dacă așa e. Un „da” dat înainte, pentru altă livrare, nu acoperă asta. Doar după „da”:

```bash
cd /srv/apps/ERP && ./administrativo.sh prod && ./administrativo.sh stack:status
```

- [ ] **Pasul 3: Dovada capăt-la-capăt, fără să poluăm cifrele oamenilor**. Cererile pleacă de pe server, cu `?m=`, deci sunt „audit”:

```bash
cd /srv/apps/ERP
M=$(date +%s)
for f in pdf docx xlsx; do curl -sS -o /dev/null -w "%{http_code} $f\n" -A "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" -H 'sec-fetch-user: ?1' "https://administrativo.ro/api/unelte/condica-de-prezenta?format=$f&luna=10&an=2026&m=$M"; done
sleep 5
node scripts/raport-unelte/raport.mjs --de-la "$(date -u +%F)" --pana-la "$(date -u +%F)" --json | grep -E '"x": "dl:condica-de-prezenta:(pdf|docx|xlsx):' 
```

Așteptat:
- `200 pdf`, `200 docx`, `200 xlsx`;
- trei rânduri `dl:condica-de-prezenta:<format>:audit`, fiecare cu `y ≥ 1`;
- niciun `dl:…:om` nou.

Dacă lipsesc, citești jurnalul aplicației pentru `[masurare]`, cu `docker service logs administrativo_administrativo-web --since 10m 2>&1 | grep masurare`:
- `Umami n-a scris evenimentul … status 400`: corpul e greșit;
- `"beep"`: UA-ul fix a fost luat drept bot;
- nimic: `after` n-a rulat, sau gazda nu e `administrativo.ro`.

Repari în taskul care deține codul (J2 sau J1), nu aici.

Repeți `for` de 3 ori (2 replici). Fiecare rulare adaugă câte unu pe fiecare format.

- [ ] **Pasul 4: Panoul Umami**:

```bash
cd /srv/apps/ERP && bash scripts/umami-goaluri.sh
```

Așteptat:
- linia `- Descărcări foaie de pontaj … șters (număra „foaie-excel”)`;
- trei `+` noi;
- la pasul 5 al scriptului, lista citită conține „Foaia de pontaj în Excel (server, om)” și cele două goal-uri „Cont venit din …” și NU mai conține „Descărcări foaie de pontaj”.

A doua rulare trebuie să dea doar `=` (idempotent).

- [ ] **Pasul 5: Îndemnul pe producție, la 360 px, plus dezvăluirea la clic** (care nu se poate verifica local):

```bash
cd /srv/apps/ERP && node /tmp/claude-1000/-srv-apps-ERP/07546773-316d-4512-8e91-a0ab3b8b35ba/scratchpad/plan/lucru-masurare-conversie/cta-360.mjs https://administrativo.ro; echo "cod=$?"
```

Apoi dezvăluirea, cu analiticele anulate și descărcarea acceptată. Cererea pleacă de pe IP-ul serverului, deci e „audit”:

```bash
cd /srv/apps/ERP && node --input-type=module -e '
import { chromium } from "/srv/apps/ERP/node_modules/.pnpm/playwright-core@1.62.1/node_modules/playwright-core/index.mjs";
const b = await chromium.launch({ executablePath: "/home/miro/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell" });
const p = await b.newPage({ viewport: { width: 360, height: 800 }, acceptDownloads: true });
await p.route(/googletagmanager|google-analytics|analitice\.administrativo\.ro/u, (r) => r.abort());
await p.goto("https://administrativo.ro/unelte/condica-de-prezenta", { waitUntil: "load" });
const inainte = await p.locator("#continua-condica-de-prezenta").isVisible();
const [d] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Descarcă PDF" }).click()]);
const dupa = await p.locator("#continua-condica-de-prezenta").isVisible();
console.log({ inainte, dupa, fisier: d.suggestedFilename() }, !inainte && dupa ? "OK" : "PICĂ");
await b.close();'
```

Așteptat:
- `cta-360.mjs`: 7 rânduri `OK`, `cod=0`;
- al doilea: `{ inainte: false, dupa: true, fisier: 'condica-prezenta-2026-10.pdf' } OK`. Numele fișierului e cel lăsat de E, dacă l-a schimbat.
- [ ] **Pasul 6: Primul om real** (nu se poate automatiza; se notează în raport, nu se așteaptă). Prima descărcare făcută de pe telefonul echipei, prin clic, trebuie să apară în raportul săptămânii ca `om`, nu ca `neconfirmat`. Dacă în prima săptămână cu descărcări din browser (`*-pdf|docx|xlsx` în tabelul „Din browser”) `om` rămâne 0 pe toate uneltele, antetul `Sec-Fetch-User` nu ajunge la aplicație. Cauza e la Cloudflare sau nginx, iar regula din `clasificaCererea` trebuie revăzută.
- [ ] **Pasul 7: Memoria**. În `/home/miro/.claude/projects/-srv-apps-ERP/memory/erp-analitice-fapte-verificate.md` adaugi trei puncte:
  - descărcările și conturile se numără pe server, ca evenimente Umami `dl:<unealtă>:<format>:<clasă>` și `cont:<sursă>`, în sesiunea „server”, fără țară. Raportul se scoate cu `node scripts/raport-unelte/raport.mjs`;
  - o cerere cu referer Google de la `2001:4860:7:*` (geofeed Chrome Prefetch Proxy) e o preîncărcare, nu un clic. Clicul se confirmă printr-o cerere următoare, de la alt IP, cu pagina drept referer;
  - goal-ul `foaie-excel` era mort și a fost înlocuit (data J8).

---

**Temeiuri și fapte tehnice verificate (verificatorul planului, 8 oct 2026)**

- **Codul muncii, art. 119 alin. (1)**, citat în textul CTA al condicii: descărcat cu `curl` de pe `https://legislatie.just.ro/Public/DetaliiDocument/309240` (prima formă din „istoric consolidări” e 27.04.2026). Textul: „Angajatorul are obligația de a ține la locul de muncă definit potrivit art. 16^1 evidența orelor de muncă prestate zilnic de fiecare salariat, cu evidențierea orelor de începere și de sfârșit ale programului de lucru, și de a supune controlului inspectorilor de muncă această evidență…”. CTA-ul („zilnic, cu ora de început și de sfârșit — e gata de arătat inspectorului”) îl redă corect.
- **Legea 506/2004, art. 4 alin. (5)–(6)**, verificat pe consolidarea din 08.10.2024 (`https://legislatie.just.ro/Public/DetaliiDocument/288598`, cea mai nouă din istoric; `257056` e forma din 10.07.2022, cu același text la alin. (5)). Alin. (5) cere acordul pentru „stocarea de informații sau obținerea accesului la informația stocată în echipamentul terminal”; alin. (6) lit. b) exceptează operațiunile „strict necesare în vederea furnizării unui serviciu al societății informaționale, solicitat în mod expres”. J nu stochează nimic în browser și citește doar antete pe care browserul le trimite singur la cererea fișierului.
- ⚠ **De confirmat de jurist, înainte de J8 pasul 2** (deploy pe producție): (1) că citirea transientă a `User-Agent`, `Sec-Fetch-User` și a IP-ului, doar pentru clasificare și nereținute, nu e „obținerea accesului la informația stocată în echipamentul terminal” în sensul art. 4 alin. (5) — interpretarea EDPB din Ghidul 2/2023 privind domeniul tehnic al art. 5 alin. (3) ePrivacy e mai largă decât textul românesc; (2) că numărarea anonimă pe server intră în interesul legitim, art. 6 alin. (1) lit. f) GDPR, deja invocat de A7 pentru „statistica fără cookie-uri”. Pasul de confirmare: întrebarea, cu textul nou al secțiunii 8 din J3, trimisă juristului; răspunsul se trece în `NOTES.md` lângă celelalte valori ⚠. Decizia de a NU citi cookie-ul de sesiune evită cazul cel mai discutabil.
- **Umami 3.3.1** (sursa de pe GitHub, tag `v3.3.1`, citită cu `curl`): `src/app/api/send/route.ts` acceptă `payload.ip`, `payload.userAgent`, `payload.browser|os|device` (`z.string().optional()`), cere `website` UUID și respinge un `name` care începe cu `= + - @` (nu e cazul: `dl:`/`cont:`); `getClientInfo` (`src/lib/detect.ts`) ia `payload.ip` înaintea antetelor, iar `getLocation` întoarce `null` pentru o adresă locală; sesiunea e `uuid(sourceId, ip, userAgent, sessionSalt)` cu `SALT_ROTATION` implicit `month`; `prisma/schema.prisma:140` dă `event_name … @db.VarChar(50)`.
- **isbot 5.2.2**: tiparul complet, extras din `index.mjs` (jsDelivr) și evaluat ca `RegExp`: `Mozilla/5.0 (X11; Linux x86_64) Administrativo/1.0` → `false`. Atenție: lista conține `server`, `bot`, `check\b`, `monitor\b` și `node\b` — UA-ul fix nu are voie să capete vreunul dintre cuvintele astea.
- **Codul planului, rulat pe copii în afara repo-ului**: J1 și J2 (30 de teste) trec cu implementările din plan; J4 trece cu editările aplicate pe copia fișierelor de azi (blocurile „vechi” s-au găsit byte cu byte) și cade pe codul de azi exact cum spune pasul 2; J6 (9) trec; J7 cade pe scriptul de azi cu `foaie-excel: expected false to be true` și trece după editare (`bash -n` curat); componentele din J5 trec (8 din 10; cele 2 rămase sunt paza pe pagini, care cade până la editarea paginilor). `tsc` cu `tsconfig.json`-ul repo-ului (inclusiv `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) trece pe toate fișierele noi, pe ruta `[unealta]` învelită și pe fișierele J4 modificate.

---

**Review Focus**

1. **`Sec-Fetch-User` nu ajunge la aplicație.** Dacă Cloudflare sau nginx ar tăia antetul, fiecare om ar apărea „neconfirmat”, iar raportul ar spune „0 oameni” exact în săptămâna în care cineva descarcă. Niciun test din repo nu vede antetele reale de pe drum. Testul adăugat în J1 („fără semnul clicului, aceeași cerere e „neconfirmat”, nu „om””) fixează direcția sigură a erorii: subnumărare, nu supranumărare. Pasul 6 din J8 spune cum se recunoaște lipsa antetului în primele date reale.
2. **Android descarcă de două ori.** Managerul de descărcări din Android cere fișierul a doua oară, cu UA-ul `AndroidDownloadManager` și fără `Sec-Fetch-User`. Dacă ar fi numărat ca om, fiecare utilizator de Android ar dubla cifra. Testul din J1 (`ANDROID_DESCARCARI` → „neconfirmat”) o ține pe loc.
3. **Umami căzut sau lent ar ține descărcarea pe loc.** Un `await` pus din greșeală pe trimitere ar face ca vizitatorul să aștepte 3 s, sau pentru totdeauna, după un PDF. Testul din J2 („Umami care nu răspunde niciodată nu întârzie descărcarea”), cu o trimitere care nu se rezolvă, cere ca răspunsul să plece. Testul „în afara unei cereri, `after` aruncă E468” cere ca o numărare imposibilă să nu strice descărcarea.
4. **Staging ar polua producția.** Staging se construiește din același `.env`, deci poate avea același `NEXT_PUBLIC_UMAMI_ID`. Fără paza de gazdă, testele e2e și descărcările colegilor ar intra în cifrele producției. Testele din J1 (`staging.administrativo.ro`, `localhost:3000` → `null`) și din J3 („404, staging și localhost nu programează nimic”) o țin. Pasul 1 din J8 o verifică live.
5. **Statistica nu are voie să coste un cont.** O sursă stricată (500 de caractere, un număr, `__proto__`, un obiect) ar putea face Zod să respingă formularul, sau `numaraConversia` să arunce în mijlocul înregistrării. Testul din J4 („o sursă stricată nu oprește înregistrarea”) cere ca baza să fie chemată de fiecare dată și ca rezultatul să fie contul creat. `numaraConversia` are `try/catch` propriu, iar testul din J2 acoperă și ramura de staging.
