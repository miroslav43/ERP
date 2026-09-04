import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
// API-ul importat implicit din "expo-file-system" (SDK 57 instalat aici) e cel
// NOU, pe clase `File`/`Directory`/`Paths` — `cacheDirectory` nu există pe el,
// iar `writeAsStringAsync` ARUNCĂ la rulare (verificat în sursă,
// `expo-file-system/src/legacyWarnings.ts`: fiecare funcție veche e un shim
// care doar aruncă și trimite spre migrare, `errorOnLegacyMethodUse`). Forma
// veche, folosită mai jos, e păstrată neschimbată sub subpath-ul `/legacy` —
// nu e un ocol, e mecanismul oficial de coexistență al pachetului cât timp
// nu s-a migrat la `File`/`Directory`.
import * as FileSystem from "expo-file-system/legacy";

/**
 * Cât așteptăm o operație rapidă, FĂRĂ interacțiune umană — scriere pe disc,
 * interogarea `Sharing.isAvailableAsync` — înainte să presupunem că
 * promisiunea nu se mai termină. Aceeași idee ca `TIMP_LIMITA_VERIFICARE_MS`
 * din `lacat.tsx` (rundă 2), aplicată aici la rundă 3.
 */
const TIMP_LIMITA_RAPID_MS = 5000;

/**
 * Cât așteptăm o fereastră nativă care CERE o decizie umană —
 * `Sharing.shareAsync` (foaia de partajare), `Print.printAsync`
 * (previzualizarea de tipărire) — înainte să presupunem că promisiunea nu se
 * mai termină NICIODATĂ. Mult mai generos decât `TIMP_LIMITA_RAPID_MS`, din
 * același motiv ca `TIMP_LIMITA_CERERE_JETON_MS` din `push.ts`: un timeout
 * scurt ar tăia un om care încă alege unde să trimită fluturașul, tratând o
 * decizie normală drept eșec. Fără NICIUN timeout însă, o promisiune nativă
 * blocată ar ține `ferestraFisierDeschisa`/`inCursFisier` din `App.tsx`
 * `true` PE VIAȚĂ — alerta „o fereastră a rămas deschisă" ar apărea la
 * fiecare revenire, la nesfârșit, iar felul acela nu s-ar mai putea
 * descărca deloc (semnalat de revizor, rundă 3).
 */
const TIMP_LIMITA_FEREASTRA_MS = 5 * 60 * 1000;

/**
 * Înfășoară o promisiune nativă cu un timp limită. La expirare, RESPINGE
 * (nu rezolvă cu o valoare de rezervă): `salveazaPdf`/`tipareste` rulează
 * deja într-un `try/catch` în `App.tsx` (`primesteMesaj`), care arată deja
 * un mesaj potrivit și eliberează gărzile de reintrare în `finally` — o
 * respingere de-aici curge direct în mecanismul ăla existent, fără cod nou
 * de tratare a erorii.
 */
function cuTimpLimita<T>(promisiune: Promise<T>, timpLimitaMs: number): Promise<T> {
  let idTemporizator: ReturnType<typeof setTimeout> | null = null;
  const cuTimeout = new Promise<T>((_rezolva, respinge) => {
    idTemporizator = setTimeout(() => {
      respinge(new Error(`Timp de așteptare depășit (${timpLimitaMs} ms)`));
    }, timpLimitaMs);
  });
  return Promise.race([promisiune, cuTimeout]).finally(() => {
    if (idTemporizator !== null) clearTimeout(idTemporizator);
  });
}

/**
 * Cele două căi care se rup tăcut într-un WebView.
 *
 * Descărcarea și tipărirea nu sunt funcții „în plus": fără ele, un angajat care
 * nu-și poate scoate fluturașul din aplicație — dar poate din Chrome — șterge
 * iconița.
 *
 * VERIFICAT ÎN COD, NU PRESUPUS (rutele reale, la data scrierii):
 * · `/api/export/salarizare/fluturas?inregistrare=<id>` — link `<a>` simplu pe
 *   `/portal/salariul-meu`, PDF cu `content-disposition: attachment`.
 * · `/portal/cursurile-mele/<id>/adeverinta` — `<Link>` (next/link) pe pagina
 *   cursului, HTML `text/html` fără `content-disposition` (destinat tipăririi
 *   din dialogul browserului, nu descărcării).
 *
 * `<Link>`-ul de mai sus țintește un Route Handler, nu o pagină — nu există
 * arbore RSC de preluat. Next detectează asta la runtime (fetch-ul intern de
 * RSC primește HTML în loc de payload RSC) și cade pe o navigare grea de
 * browser (`window.location`) — exact genul de navigare pe care
 * `onShouldStartLoadWithRequest` din `App.tsx` o vede. Interceptarea de mai
 * jos prinde deci navigarea de FALLBACK, nu click-ul însuși; de aceea regexul
 * tolerează și un eventual `?`/`/` după `adeverinta`, nu doar sfârșitul strict
 * al șirului — navigarea finală pornește din codul intern al routerului, nu
 * dintr-un `href` scris de noi.
 */
/**
 * Amândouă funcțiile de mai jos verifică ACUM și originea, nu doar calea
 * (rundă 3 de revizuire — aceeași orbire ca la `push.ts`, impact mai mic: la
 * data scrierii, documentul din WebView putea fi legitim pe alt origin decât
 * portalul, fiindcă poarta de navigare lăsa să treacă orice — vezi
 * `App.tsx`/`push.ts` pentru lanțul complet. O cale care se potrivește pe un
 * site străin ar fi adus conținutul ACELUI site și l-ar fi dat lui
 * `Sharing`/`Print`, crezând că e fluturașul sau adeverința noastră). Poarta
 * s-a închis la rundă 4; verificările de aici rămân ca apărare în adâncime —
 * ele sunt cele care decid ce ajunge într-o fereastră a sistemului.
 * `try/catch` fiindcă `url` vine dintr-un eveniment de navigare, nu dintr-o
 * sursă controlată de noi.
 */
export function eDescarcare(url: string, origineaPortalului: string): boolean {
  try {
    const parsat = new URL(url);
    return parsat.origin === origineaPortalului && parsat.pathname.includes("/api/export/");
  } catch {
    return false;
  }
}

export function eTiparire(url: string, origineaPortalului: string): boolean {
  try {
    const parsat = new URL(url);
    return (
      parsat.origin === origineaPortalului &&
      /\/portal\/cursurile-mele\/[^/]+\/adeverinta(?:[/?]|$)/.test(parsat.pathname)
    );
  } catch {
    return false;
  }
}

/** Nume de rezervă, derivat din URL, dacă serverul nu trimite `content-disposition`. */
function numeDinUrl(url: string): string {
  const fara = url.split("?")[0] ?? "";
  const ultim = fara.split("/").pop() ?? "document";
  return ultim.endsWith(".pdf") ? ultim : `${ultim}.pdf`;
}

/**
 * Curăță numele înainte să devină o cale de fișier locală. Serverul îl trimite
 * deja curat (`numeFisier()`, `src/lib/pdf/document.ts`, doar `[a-z0-9.\-_]`),
 * dar scrierea pe disc nu are voie să aibă încredere într-un șir venit prin
 * rețea doar pentru că celălalt capăt e „al nostru" — un `/` sau un `..`
 * strecurat acolo ar scrie în afara directorului de cache.
 */
function numeSigur(nume: string): string {
  const curatat = nume.replace(/[\\/]/g, "-").replace(/\.\./g, "-");
  return curatat === "" ? "document.pdf" : curatat;
}

/**
 * Scriptul care aduce fișierul DIN pagină — deci cu cookie-urile sesiunii — și
 * îl trimite nativ prin `postMessage`. `credentials: "same-origin"` e explicit
 * deși e implicitul lui `fetch`: documentează intenția.
 *
 * Raportează ÎNTOTDEAUNA înapoi, pe trei căi, niciodată în tăcere:
 * · `raspuns.ok` fals (401/403/404/409/500 — vezi rutele: fluturașul respinge
 *   cu 403/404/409, adeverința cu 401/403/404) → `{ ok: false }`, fără să
 *   încerce să interpreteze corpul de eroare (text simplu) ca PDF/HTML;
 * · `fetch` sau citirea eșuează (rețea moartă, `FileReader` care aruncă) →
 *   prins de `.catch`, tot `{ ok: false }`;
 * · succes → `{ ok: true, date, ...nume pentru pdf }`.
 *
 * Ce NU poate raporta: dacă pagina navighează în altă parte (tare, prin
 * `location.assign`) cât timp `fetch`-ul e în zbor, realm-ul JS moare o dată cu
 * el — promisiunea nu mai rulează niciodată, niciun `postMessage` nu mai
 * pleacă. Asta nu se poate rezolva de aici; recuperarea e în `App.tsx`, cu
 * același tipar de temporizator ca la înregistrarea jetonului de push.
 */
export function scriptDeAducere(url: string, fel: "pdf" | "html"): string {
  const urlJson = JSON.stringify(url);
  const felJson = JSON.stringify(fel);
  const numeImplicitJson = JSON.stringify(numeDinUrl(url));

  const extrageCorp =
    fel === "pdf"
      ? `
          var nume = ${numeImplicitJson};
          var antet = raspuns.headers.get("content-disposition");
          if (antet) {
            var potrivire = /filename="([^"]*)"/.exec(antet);
            if (potrivire && potrivire[1]) nume = potrivire[1];
          }
          return raspuns.blob().then(function (corp) {
            return new Promise(function (rezolva, respinge) {
              var citire = new FileReader();
              citire.onloadend = function () {
                rezolva({ nume: nume, date: citire.result });
              };
              citire.onerror = function () {
                respinge(new Error("citire eșuată"));
              };
              citire.readAsDataURL(corp);
            });
          });
        `
      : `
          return raspuns.text().then(function (text) {
            return { date: text };
          });
        `;

  return `
    (function () {
      fetch(${urlJson}, { credentials: "same-origin" })
        .then(function (raspuns) {
          if (!raspuns.ok) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ fel: ${felJson}, ok: false }));
            return null;
          }
          ${extrageCorp}
        })
        .then(function (rezultat) {
          if (rezultat === null || rezultat === undefined) return;
          var mesaj = { fel: ${felJson}, ok: true, date: rezultat.date };
          ${fel === "pdf" ? "mesaj.nume = rezultat.nume;" : ""}
          window.ReactNativeWebView.postMessage(JSON.stringify(mesaj));
        })
        .catch(function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({ fel: ${felJson}, ok: false }));
        });
    })();
    true;
  `;
}

/**
 * Scrie PDF-ul (venit ca `data:` URI base64, prin `postMessage`) în directorul
 * de cache și deschide foaia de partajare a sistemului.
 *
 * Dacă `Sharing` nu e disponibil (n-ar trebui, pe iOS/Android reale — vezi
 * raportul), fișierul tot rămâne scris local; omul doar nu primește foaia de
 * partajare. Un om care închide foaia fără să aleagă nimic NU e o cale de
 * eșec: fișierul e deja pe disc, foaia era doar o comoditate în plus.
 *
 * ── FEREASTRA NATIVĂ DE MAI JOS (ȘI CEA DIN `tipareste`) NU SE POATE ÎNCHIDE
 *    DE AICI (găsit la revizuire, Task 10) ──────────────────────────────────
 * `Sharing.shareAsync` prezintă `UIActivityViewController`
 * (`Print.printAsync`, mai jos, prezintă `UIPrintInteractionController`) —
 * aceeași clasă de fereastră nativă separată ca `Modal`-ul din
 * `scanner.tsx`, care rămâne PESTE vălul biometric (`lacat.tsx`) dacă omul
 * trimite aplicația în fundal cât una din ele e deschisă. Spre deosebire de
 * `Scanner`, NU există niciun `dismiss()` de apelat aici: nici
 * `expo-sharing`, nici `expo-print` nu expun așa ceva (verificat în sursa
 * iOS a pachetelor instalate — niciun rezultat pentru „dismiss"). Ce se
 * poate mitiga (o alertă nativă care iese deasupra pe iOS, prin propria
 * `UIWindow` a `Alert.alert`; fără echivalent pe Android) trăiește în
 * `App.tsx`, lângă restul logicii de `AppState` — vezi comentariul de acolo
 * pentru detalii, verificările din sursă ȘI limitarea EXACTĂ (corectare
 * rundă 3 de revizuire, ca să nu rămână afirmația trunchiată doar aici):
 * instantaneul din switcher/„Recente" se face ÎNAINTE ca alerta să apuce să
 * ruleze — NU e acoperit de nimic din JavaScript, pe NICIO platformă. Ce
 * acoperă alerta e strict fereastra de interacțiune de DUPĂ revenire, și
 * doar pe iOS.
 *
 * Cele două `await`-uri native de mai jos (`Sharing.isAvailableAsync`,
 * `Sharing.shareAsync`) — și cel din `tipareste` — trec printr-un timeout
 * generos (`cuTimpLimita`, mai jos), aceeași clasă de reparație ca
 * `verificaDisponibilitatea` din `lacat.tsx` (rundă 2): o promisiune nativă
 * care nu se termină NICIODATĂ ar ține `ferestraFisierDeschisa`/
 * `inCursFisier` din `App.tsx` `true` PE VIAȚĂ — alerta de mai sus ar
 * apărea la fiecare revenire, la nesfârșit, iar felul acela nu s-ar mai
 * putea descărca deloc. Semnalat de revizor la runda asta, aplicat acum și
 * aici.
 */
export async function salveazaPdf(nume: string, dataUri: string): Promise<void> {
  const base64 = dataUri.split(",")[1] ?? "";
  const cale = `${FileSystem.cacheDirectory}${numeSigur(nume)}`;
  await cuTimpLimita(
    FileSystem.writeAsStringAsync(cale, base64, { encoding: FileSystem.EncodingType.Base64 }),
    TIMP_LIMITA_RAPID_MS,
  );
  if (await cuTimpLimita(Sharing.isAvailableAsync(), TIMP_LIMITA_RAPID_MS)) {
    await cuTimpLimita(
      Sharing.shareAsync(cale, { mimeType: "application/pdf", UTI: "com.adobe.pdf" }),
      TIMP_LIMITA_FEREASTRA_MS,
    );
  }
}

/** Vezi comentariul de la `salveazaPdf` despre fereastra nativă de tipărire. */
export async function tipareste(html: string): Promise<void> {
  await cuTimpLimita(Print.printAsync({ html }), TIMP_LIMITA_FEREASTRA_MS);
}
