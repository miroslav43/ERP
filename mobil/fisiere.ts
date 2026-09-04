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
export function eDescarcare(url: string): boolean {
  return url.includes("/api/export/");
}

export function eTiparire(url: string): boolean {
  return /\/portal\/cursurile-mele\/[^/]+\/adeverinta(?:[/?]|$)/.test(url);
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
 * iOS a pachetelor instalate — niciun rezultat pentru „dismiss"). Mitigarea
 * posibilă (o alertă nativă care iese deasupra pe iOS, prin propria
 * `UIWindow` a `Alert.alert`; fără echivalent pe Android) trăiește în
 * `App.tsx`, lângă restul logicii de `AppState` — vezi comentariul de acolo
 * pentru detalii și verificările din sursă.
 */
export async function salveazaPdf(nume: string, dataUri: string): Promise<void> {
  const base64 = dataUri.split(",")[1] ?? "";
  const cale = `${FileSystem.cacheDirectory}${numeSigur(nume)}`;
  await FileSystem.writeAsStringAsync(cale, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(cale, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
  }
}

/** Vezi comentariul de la `salveazaPdf` despre fereastra nativă de tipărire. */
export async function tipareste(html: string): Promise<void> {
  await Print.printAsync({ html });
}
