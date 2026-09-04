import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
} from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";

import { cereJeton, scriptDeInregistrare } from "./push";
import { eDescarcare, eTiparire, scriptDeAducere, salveazaPdf, tipareste } from "./fisiere";
import { Lacat } from "./lacat";
import { Scanner } from "./scanner";

/**
 * Portalul de angajat, într-un WebView.
 *
 * Aplicația NU rescrie niciun ecran: conținutul e `administrativo.ro/portal`,
 * deci fiecare livrare web apare instantaneu și în aplicație, fără review de
 * magazin. Ce se adaugă aici e strict ce browserul de pe telefon nu poate da.
 */
const URL_PORTAL =
  (Constants.expoConfig?.extra?.urlPortal as string) ?? "https://administrativo.ro/portal";

/**
 * Doar schema+host-ul din `URL_PORTAL`, calculat o singură dată — folosit la
 * deep link-ul de notificare, mai jos, ca să construim un URL ABSOLUT în loc
 * de o cale relativă (rundă 2 de revizuire: reparația de la scanner nu se
 * propagase aici, deși comentariul deep link-ului îl citează pe cel de
 * acolo ca referință). `try/catch` fiindcă `URL_PORTAL` trece printr-un
 * `as string` pe o valoare de configurare (`extra.urlPortal`) — dacă ar
 * ajunge vreodată malformată, o excepție necaptată AICI, la nivel de modul,
 * ar opri pornirea întregii aplicații; fallback-ul e domeniul de producție.
 */
const ORIGINEA_PORTALULUI = (() => {
  try {
    return new URL(URL_PORTAL).origin;
  } catch {
    return "https://administrativo.ro";
  }
})();

/**
 * Cât așteptăm confirmarea din pagină înainte să presupunem că n-a mai venit
 * și eliberăm garda temporară `inCurs`. Vezi RECUPERAREA DIN „ÎN CURS" din
 * `App`: scriptul injectat răspunde întotdeauna PRIN EL ÎNSUȘI, dar o
 * navigare hard (ex. tap pe notificare → `location.assign`) distruge realm-ul
 * JS al paginii curente și, cu el, promisiunea `fetch` în zbor — răspunsul nu
 * mai pleacă niciodată. 8 secunde e generos față de o cerere JSON mică, dar
 * fără cost real dacă întârzie: reîncercarea e idempotentă pe server
 * (`POST /api/dispozitive` face UPSERT pe jeton, nu poate dubla rândul).
 */
const TIMP_RECUPERARE_MS = 8000;

/**
 * Aceeași idee de recuperare ca mai sus, pentru descărcare/tipărire
 * (`porneșteAducerea`, mai jos): dacă scriptul injectat de `scriptDeAducere`
 * nu răspunde deloc — pagina a navigat peste `fetch`-ul în zbor, exact cursa
 * descrisă mai sus — omul rămâne cu un ecran mort, fără mesaj. 20 de secunde,
 * nu 8: un PDF de fluturaș se citește ca `data:` URI (`FileReader`, în pagină)
 * înainte de `postMessage`, pe lângă cererea de rețea propriu-zisă — mai lent
 * decât cererea JSON mică de la înregistrarea jetonului.
 */
const TIMP_RECUPERARE_FISIER_MS = 20000;

// Notificarea primită cât aplicația e deschisă trebuie să se afișeze oricum —
// altfel un om care stă în aplicație nu vede că i s-a aprobat o cerere decât
// dacă navighează singur în portal ca s-o verifice.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowList: true,
  }),
});

/**
 * Aceeași formă ca `check (link ~ '^/[^/\\]')` de pe `notifications.link`
 * (0001_kernel.sql) și ca `caleDeDeschis` din `src/lib/push/mesaj.ts`: o cale
 * relativă simplă, nu un URL absolut sau protocol-relativ ascuns într-un
 * șir care începe din întâmplare cu `/`. Verificăm din nou aici pentru că
 * ăsta e singurul proces care chiar navighează.
 *
 * CERE ACUM ȘI „/portal" (revizuirea finală). Verificarea de FORMĂ, singură,
 * accepta orice cale de aplicație mare — iar exact aia scriau, la revizuirea
 * finală, toate cele 67 de notificări cu link din baza vie. Serverul le traduce
 * de-acum prin `caleaDePortal` înainte să le pună în mesaj, deci calea sosită
 * aici e întotdeauna de portal; poarta asta e a doua, pentru un server rămas în
 * urmă sau o notificare fabricată. Ce nu trece nu navighează nicăieri: aplicația
 * rămâne pe portal, unde a pornit — niciodată în ERP-ul de birou, în învelișul
 * de telefon, fără cale de întoarcere.
 */
function esteCaleDePortal(cale: unknown): cale is string {
  return typeof cale === "string" && /^\/[^/\\]/.test(cale) && /^\/portal(?:\/|$)/.test(cale);
}

/**
 * `url` vine de pe originea portalului — atât, fără nicio pretenție despre
 * cale. `try/catch` fiindcă `url` vine din evenimente native (navigare,
 * `postMessage`), nu dintr-o sursă controlată de noi — un URL malformat nu
 * trebuie să arunce, doar să respingă.
 *
 * FUNCȚIA ASTA, NU `esteUrlPortal`, E CEA POTRIVITĂ PENTRU MESAJE (rundă 4).
 * `nativeEvent.url` de pe un mesaj NU e același lucru pe cele două platforme,
 * verificat în sursa instalată a `react-native-webview`:
 * · iOS — `RNCWebViewImpl.m:788` pune URL-ul ÎNTREG al cadrului
 *   (`message.frameInfo.request.URL`);
 * · Android — `RNCWebView.java:256` pune `sourceOrigin.toString()`, adică
 *   DOAR originea (`https://administrativo.ro`, fără cale), fiindcă puntea
 *   modernă e un `WebMessageListener`, nu un `JavascriptInterface`. Doar
 *   varianta de rezervă (`:449`, dispozitive fără `WEB_MESSAGE_LISTENER`)
 *   trimite `getUrl()`, adică un URL întreg.
 * O verificare care cere și calea „/portal" ar respinge deci TOATE mesajele pe
 * Android modern — jeton, fluturaș, adeverință — adică ar rupe aplicația în
 * loc s-o apere.
 */
function esteOrigineaPortalului(url: string): boolean {
  try {
    return new URL(url).origin === ORIGINEA_PORTALULUI;
  } catch {
    return false;
  }
}

/**
 * `url` e chiar portalul nostru — origine EXACTĂ, nu doar o cale care
 * conține „/portal" (rundă 3 de revizuire — un site străin poate avea orice
 * cale își dorește). Se folosește acolo unde URL-ul e sigur întreg: filtrul de
 * navigare pentru înregistrarea jetonului.
 */
function esteUrlPortal(url: string): boolean {
  try {
    const parsat = new URL(url);
    return parsat.origin === ORIGINEA_PORTALULUI && /\/portal(?:\/|$)/.test(parsat.pathname);
  } catch {
    return false;
  }
}

/**
 * ÎNCORPORĂRILE DE CURS — singurele origini străine care au voie să se încarce
 * ÎN aplicație, și numai ca subcadru (`<iframe>`).
 *
 * Oglindesc EXACT `adresaIncorporare()` din `src/lib/media/link-extern.ts`
 * (lecțiile cu film extern: YouTube, Vimeo, Loom). Dacă lista de acolo se
 * schimbă, asta trebuie schimbată împreună cu ea — altfel filmul lecției nu se
 * mai încarcă în aplicație, deși pe web merge.
 *
 * Calea e ancorată la începutul formei de ÎNCORPORARE, nu doar originea:
 * pentru Loom, adresa publică (`/share/<id>`, deschisă de linkul „Deschideți la
 * sursă") stă pe ACELAȘI host ca încorporarea (`/embed/<id>`) — fără verificarea
 * de cale, linkul public ar rămâne în aplicație în loc să plece în browser,
 * exact ce vrem să nu se mai întâmple.
 */
const INCORPORARI_CURS: readonly { readonly origine: string; readonly cale: RegExp }[] = [
  { origine: "https://www.youtube-nocookie.com", cale: /^\/embed\// },
  { origine: "https://player.vimeo.com", cale: /^\/video\// },
  { origine: "https://www.loom.com", cale: /^\/embed\// },
];

function esteIncorporareDeCurs(url: string): boolean {
  try {
    const parsat = new URL(url);
    return INCORPORARI_CURS.some(
      (permis) => parsat.origin === permis.origine && permis.cale.test(parsat.pathname),
    );
  } catch {
    return false;
  }
}

/**
 * Linkul extern pleacă în browserul telefonului, nu în aplicația semnată cu
 * numele firmei. `Linking.openURL` poate respinge (schemă necunoscută, niciun
 * browser instalat) — omul trebuie să afle, nu să atingă un link care pare
 * mort.
 *
 * ── DOAR PE iOS, ȘI ĂSTA E UN FAPT DESPRE ANDROID, NU O PREFERINȚĂ (rundă 5)
 * Pe Android, un `target="_blank"` NU ajunge niciodată aici — verificat în
 * sursa instalată: `RNCWebViewManagerImpl.kt:79` pune
 * `setSupportMultipleWindows(true)`, iar `WebView.android.tsx:298` trimite
 * `hasOnOpenWindowEvent = false` fiindcă nu dăm prop-ul `onOpenWindow`; deci
 * `RNCWebChromeClient.java:88-114` creează un WebView ORFAN, FĂRĂ să-i pună
 * vreun client, și îi predă navigarea. `shouldOverrideUrlLoading`-ul nostru
 * nu-l vede.
 *
 * Consecința: pe Android, singurele navigări care ar ajunge aici sunt, în
 * practică, SUBCADRELE playerului de film — portalul nu are AZI nicio navigare
 * de prim-cadru către altă origine. Cu
 * alte cuvinte, `Linking.openURL` s-ar declanșa acolo EXACT pe cazurile în
 * care greșește: omul se uită la lecție, playerul își navighează un subcadru
 * (`googleads.g.doubleclick.net`, pe un film monetizat), și browserul
 * telefonului sare peste el în mijlocul lecției. Pe Android blocăm deci tăcut
 * — proprietatea de securitate e aceeași (navigarea nu se face), fără saltul
 * în browser. Linkul „Deschideți la sursă" era deja mort acolo, dinainte de
 * poarta asta.
 *
 * ── „AZI", NU „PRIN CONSTRUCȚIE" (corectat la revizuirea finală) ────────────
 * Fraza de mai sus a citat o vreme `src/app/(portal)/legaturi-portal.test.ts`
 * drept garanție că portalul n-are navigări de prim-cadru către altă origine.
 * Nu ține atât. Testul e o capcană pe TEXTUL SURSEI — o spune și el, în capul
 * lui — și vede doar `href`-uri LITERALE (`href="…"`, `href={`…`}`); un
 * `href={variabila}` îi e invizibil, iar exact așa e scris singurul link extern
 * de azi din portal (`vizualizator-simplu.tsx:132`, „Deschideți la sursă"). Pe
 * deasupra, tiparul lui cerea până acum ca href-ul să înceapă cu `/`, deci nu
 * vedea nici măcar un `https://` literal — adică fix forma pe care ar fi trebuit
 * s-o prindă. Tiparul e lărgit la revizuirea finală (vede acum orice href
 * literal, cu excepția ancorelor `#`), ceea ce închide cazul copierii unui ecran
 * din `(app)`; dar rămâne o capcană, nu o dovadă. Afirmația onestă e cea de mai
 * sus: portalul nu are AZI o astfel de navigare.
 */
function deschideInBrowser(url: string): void {
  if (Platform.OS !== "ios") return;
  void Linking.openURL(url).catch(() => {
    Alert.alert(
      "Nu am putut deschide linkul",
      "Copiați adresa și deschideți-o în browserul telefonului.",
    );
  });
}

/**
 * Mesajele venite din pagină, prin `window.ReactNativeWebView.postMessage`.
 * Câmpul `fel` le deosebește — vezi dispecerul din `primesteMesaj`. Valorile de
 * azi: `"jeton"` (înregistrarea push-ului, `push.ts`), `"pdf"` și `"html"`
 * (descărcarea/tipărirea, `fisiere.ts`). `nume`/`date` sunt tipate lax
 * (`unknown`) fiindcă doar `"pdf"`/`"html"` le populează — verificate cu
 * `typeof` la locul de folosire, ca la `esteCaleDePortal`, nu presupuse.
 */
type MesajDinPagina = {
  readonly fel: string;
  readonly ok?: boolean;
  readonly nume?: unknown;
  readonly date?: unknown;
};

function parseazaMesaj(dateBrute: string): MesajDinPagina | null {
  try {
    const valoare: unknown = JSON.parse(dateBrute);
    if (
      typeof valoare === "object" &&
      valoare !== null &&
      "fel" in valoare &&
      typeof (valoare as { fel: unknown }).fel === "string"
    ) {
      return valoare as MesajDinPagina;
    }
  } catch {
    // Mesaj nevalid — îl ignorăm, nu blocăm nimic.
  }
  return null;
}

export default function App() {
  const webview = useRef<WebView>(null);
  // PERMANENTĂ. Devine `true` DOAR când pagina a confirmat, prin
  // `postMessage`, că fetch-ul spre `/api/dispozitive` chiar a plecat de pe
  // `/portal` (vezi `primesteMesaj`, mai jos). Niciodată pusă înainte de
  // confirmare — motivul e cursa descrisă la MOMENTUL ÎNREGISTRĂRII.
  const inregistrat = useRef(false);
  // TEMPORARĂ. Previne pornirea a două încercări în paralel (`onLoadEnd` și
  // `onNavigationStateChange` se pot declanșa aproape simultan pentru
  // aceeași navigare). Se eliberează la ORICE ieșire — succes sau eșec — ca
  // o navigare ulterioară relevantă să poată reîncerca. Vezi RECUPEREAZĂ DIN
  // „ÎN CURS" mai jos: ieșirile NU sunt doar `cereJeton` → `null` și mesajul
  // din pagină — mai e și temporizatorul din `timpRecuperare`.
  const inCurs = useRef(false);
  // Temporizatorul de recuperare pentru încercarea curentă — vezi
  // RECUPEREAZĂ DIN „ÎN CURS", mai jos. `null` când nu e nimic în zbor.
  const timpRecuperare = useRef<ReturnType<typeof setTimeout> | null>(null);
  // GARDĂ DE REINTRARE, pentru descărcare/tipărire — vezi `porneșteAducerea`
  // și ramurile `"pdf"`/`"html"` din `primesteMesaj`, mai jos. Oglindește
  // `inCurs` de mai sus, dar ȚINUTĂ PE FEL, nu comună: `"pdf"` (fluturaș) și
  // `"html"` (adeverință) pornesc de pe ecrane diferite ale portalului, ca
  // acțiuni ale omului complet independente — un fluturaș încă în curs n-are
  // niciun motiv să blocheze o adeverință cerută separat. Ce blochează garda
  // e strict UN AL DOILEA tap PE ACELAȘI fel cât primul e încă în zbor:
  // fără ea, dublu-tap pe „Descarcă fluturașul" (interacțiunea firească pe o
  // rețea lentă, când omul nu vede nimic mișcând) pornește DOUĂ `fetch`-uri
  // spre aceeași rută, în același realm — dacă ambele reușesc, ramura `"pdf"`
  // din `primesteMesaj` rulează de două ori, deci `Sharing.shareAsync` e
  // chemat de două ori; pe iOS, o a doua prezentare de share sheet peste una
  // încă pe ecran e instabilă și ARUNCĂ — omul ar vedea alerta de eroare deși
  // fișierul chiar a fost adus și prima foaie chiar a pornit. Exact confuzia
  // pe care sarcina asta există s-o elimine, pe cea mai obișnuită interacțiune
  // de eșec posibilă.
  const inCursFisier = useRef<{ pdf: boolean; html: boolean }>({ pdf: false, html: false });
  // Temporizatoarele de recuperare, tot pe fel — aceeași motivație ca la
  // `timpRecuperare`: dacă pagina navighează peste `fetch`-ul în zbor (realm-ul
  // moare), niciun mesaj nu mai vine NICIODATĂ, deci garda de mai sus ar rămâne
  // `true` la nesfârșit fără un temporizator care s-o elibereze singur.
  const timpRecuperareFisier = useRef<{
    pdf: ReturnType<typeof setTimeout> | null;
    html: ReturnType<typeof setTimeout> | null;
  }>({ pdf: null, html: null });
  // Gardă de reintrare pentru alerta de „fereastră de partajare/tipărire
  // rămasă deschisă", mai jos (Task 10, rundă de revizuire) — vezi
  // comentariul de la efectul care o folosește.
  const alertaFisierAratata = useRef(false);
  // ADEVĂRATUL semnal pentru „fereastra nativă (foaia de partajare/
  // previzualizarea de tipărire) e efectiv PE ECRAN" — rundă 2 de revizuire.
  // `inCursFisier` (mai sus) e `true` din momentul injectării scriptului, cu
  // mult ÎNAINTE ca fereastra nativă să existe: acoperă și cererea de rețea
  // (`fetch` în pagină, până la `TIMP_RECUPERARE_FISIER_MS` = 20s) și
  // conversia `FileReader`/base64. Folosirea lui `inCursFisier` ca semnal
  // pentru alertă ar declanșa-o și pentru o simplă întârziere de rețea, fără
  // nicio fereastră deschisă — un mesaj FALS. Ref-ul ăsta devine `true`
  // abia chiar înainte de `salveazaPdf`/`tipareste` (unde chiar se prezintă
  // fereastra) și `false` în `finally`, o dată cu `inCursFisier`.
  const ferestraFisierDeschisa = useRef<{ pdf: boolean; html: boolean }>({
    pdf: false,
    html: false,
  });
  // DEEP LINK ÎN AȘTEPTARE — vezi efectul de la sfârșitul componentei.
  // `null` când nu e nimic de deschis. Devine o cale de portal când o
  // notificare a fost atinsă ÎNAINTE ca WebView-ul să aibă un document în care
  // să se poată injecta `location.assign` — cazul cel mai obișnuit al funcției,
  // pornirea la rece.
  const caleInAsteptare = useRef<string | null>(null);
  // `true` din clipa în care WebView-ul a TERMINAT o încărcare (orice URL, deci
  // și ecranul de login). Sub el, `mergiLa` ar injecta într-un document care
  // abia se încarcă, iar încărcarea inițială ar câștiga cursa — tap-ul ar
  // părea fără efect.
  const webviewIncarcat = useRef(false);

  // MOMENTUL ÎNREGISTRĂRII
  //
  // Jetonul trebuie trimis când pagina e efectiv `/portal` și omul e
  // autentificat. `onLoadEnd` singur nu ajunge: la prima încărcare, dacă omul
  // nu era încă autentificat, layout-ul portalului face `redirect()`
  // server-side spre `/autentificare` (`src/app/(portal)/layout.tsx`) — deci
  // `onLoadEnd` s-ar declanșa PE ecranul de login. Login-ul e o Server Action
  // Next.js (`src/app/(auth)/autentificare/actions.ts`) care duce spre
  // `/portal` printr-o tranziție de client (`history.pushState`, fără
  // reîncărcare completă) — deci NICI `onLoadEnd` nu se mai declanșează a
  // doua oară, la sosire. De-aia funcția e cablată și pe
  // `onNavigationStateChange`: pe iOS, `react-native-webview` injectează un
  // shim peste `history.pushState`/`replaceState` tocmai ca să prindă
  // navigarea de tip SPA (verificat în sursa pachetului instalat,
  // `RNCWebViewImpl.m`) — fără el, tranziția de login n-ar declanșa NIMIC.
  //
  // CURSA GĂSITĂ LA REVIZUIRE (verificată în sursă, nu presupusă)
  // Pe iOS, `onNavigationStateChange` mai e alimentat și de
  // `decidePolicyForNavigationAction` (`RNCWebViewImpl.m`, prin
  // `onLoadingStart` → `updateNavigationState`) — care se declanșează O DATĂ
  // PER ACȚIUNE DE NAVIGARE, deci și pentru cererea ORIGINALĂ, ÎNAINTE ca
  // redirectul HTTP spre `/autentificare` să fie urmat. La primul login al
  // unui om fără sesiune: (1) WebView cere `/portal`, evenimentul se
  // declanșează CU `/portal`, deși omul nu e autentificat; (2) dacă am pune
  // garda permanentă aici, ÎNAINTE de `cereJeton()` (care așteaptă un dialog
  // de permisiune — interacțiune umană, una-două secunde), redirectul spre
  // `/autentificare` s-ar termina între timp; (3) `injectJavaScript` ar rula
  // `fetch` în pagina CURENTĂ, care e acum `/autentificare` — 401, înghițit
  // de `.catch`; (4) garda permanentă ar rămâne pusă, iar la autentificarea
  // reală, funcția ar ieși imediat, fără să mai încerce.
  // Pe Android, verificat în sursă (`RNCWebViewClient.java`): evenimentul
  // echivalent (`TopLoadingStartEvent`) se declanșează dintr-un SINGUR loc,
  // `doUpdateVisitedHistory` — care reflectă intrarea COMISĂ în istoric, nu
  // fiecare cerere de rețea. Un lanț de redirect HTTP pe aceeași navigare nu
  // adaugă o intrare separată pentru URL-ul intermediar (comportament
  // standard de browser) — deci cursa de mai sus n-ar trebui să existe pe
  // Android. N-am putut verifica asta rulând pe un telefon real, doar citind
  // sursa: dacă se dovedește greșit, reparația de mai jos rămâne oricum
  // corectă pe ambele platforme, fiindcă nu se bazează pe ordinea
  // evenimentelor native.
  //
  // REPARAȚIA: garda permanentă se pune DUPĂ confirmare, nu înainte de munca
  // asincronă. Filtrul de URL de mai jos rămâne — e ieftin și evită cererea
  // de permisiune când evenimentul evident nu e de la `/portal` — dar NU mai
  // e garda finală. Garda finală e ÎN scriptul injectat
  // (`scriptDeInregistrare`, în `push.ts`): singurul cod care rulează în
  // pagină știe sigur pe ce URL a aterizat WebView-ul CHIAR ATUNCI, nu la
  // momentul (posibil depășit de redirect) al acestui eveniment. Scriptul
  // raportează înapoi prin `postMessage`, iar `primesteMesaj` (mai jos) pune
  // garda permanentă doar la confirmarea `ok: true`.
  //
  // FILTRUL VERIFICĂ ȘI ORIGINEA, NU DOAR CALEA (corectare rundă 3 de
  // revizuire) — `esteUrlPortal`, mai jos, cere `ORIGINEA_PORTALULUI` EXACT,
  // nu doar o cale care conține „/portal". Fără asta, un site străin cu o
  // cale potrivită (banal de construit) ar fi trecut acest filtru ieftin —
  // inofensiv de unul singur (garda finală din `push.ts` era gândită să
  // prindă exact asta), dar garda finală verifica ȘI EA doar calea, nu
  // originea, până la aceeași rundă de revizuire. Cele două filtre — ăsta și
  // cel din `scriptDeInregistrare` — trebuie să verifice originea AMÂNDOUĂ,
  // fiindcă niciunul nu știe că celălalt a fost reparat.
  //
  // RECUPEREAZĂ DIN „ÎN CURS" (a doua reparație, rundă separată de revizuire)
  // Comentariul de-aici spunea inițial că `inCurs` „nu poate rămâne blocată
  // la nesfârșit" pentru că scriptul injectat răspunde întotdeauna. Era GREȘIT:
  // un `injectJavaScript('location.assign(...); true;')` — exact ce face
  // ascultătorul de tap-pe-notificare, mai jos — e o navigare HARD, care
  // distruge realm-ul JS al paginii curente. Dacă tap-ul ăla survine cât
  // `fetch("/api/dispozitive")` e în zbor (fereastră lărgită pe rețea slabă:
  // `fetch` n-are timeout implicit), promisiunea e abandonată ODATĂ CU
  // realm-ul — `.then`/`.catch` nu mai rulează NICIODATĂ, `postMessage` nu
  // mai pleacă, iar fără altă cale de ieșire, `inCurs.current` ar rămâne
  // `true` PERMANENT: efectul practic identic cu cursa originală — jetonul nu
  // se mai înregistrează niciodată în sesiunea aia. Un back-gesture sau un al
  // doilea redirect de la server ar produce aceeași tăcere.
  // Reparația: `timpRecuperare`, un `setTimeout` pornit exact când injectăm
  // scriptul. Dacă `primesteMesaj` nu anulează timer-ul înainte să expire,
  // presupunem că răspunsul nu mai vine și eliberăm garda noi înșine.
  const inregistreazaDacaPePortal = useCallback((url: string) => {
    if (inregistrat.current || inCurs.current) return;
    if (!esteUrlPortal(url)) return;
    inCurs.current = true;
    void (async () => {
      const jeton = await cereJeton();
      if (jeton === null) {
        // Emulator, refuz de permisiune, sau `getExpoPushTokenAsync` a
        // aruncat (vezi `push.ts`) — eliberăm garda temporară ca o navigare
        // ulterioară în portal să poată reîncerca (de exemplu dacă omul
        // acordă permisiunea din Setările telefonului între timp).
        inCurs.current = false;
        return;
      }
      const platforma = Platform.OS === "ios" ? "ios" : "android";
      webview.current?.injectJavaScript(
        scriptDeInregistrare(jeton, platforma, ORIGINEA_PORTALULUI),
      );
      // De-acum, DOUĂ căi eliberează `inCurs` — niciodată zero:
      // (a) confirmarea din pagină, prin `onMessage` (`primesteMesaj`, mai
      //     jos), care anulează și temporizatorul de mai jos; sau
      // (b) temporizatorul, dacă (a) nu vine până la urmă — pagina a navigat
      //     hard peste `fetch`-ul în zbor, sau conexiunea a murit fără să mai
      //     declanșeze `.catch` (realm-ul a dispărut odată cu ea).
      if (timpRecuperare.current !== null) clearTimeout(timpRecuperare.current);
      timpRecuperare.current = setTimeout(() => {
        inCurs.current = false;
        timpRecuperare.current = null;
      }, TIMP_RECUPERARE_MS);
    })();
  }, []);

  // DESCĂRCARE / TIPĂRIRE (Task 9)
  //
  // Pornește aducerea unui fișier din pagină, cf. `fisiere.ts`. Apelată din
  // `onShouldStartLoadWithRequest`, mai jos, DUPĂ ce interceptarea a decis să
  // blocheze navigarea (`return false`) — deci `injectJavaScript` rulează în
  // continuare pe pagina PE CARE OMUL A APĂSAT butonul, nu pe una nouă.
  //
  // GARDA DE REINTRARE (rundă de revizuire — vezi `inCursFisier`, mai sus):
  // dacă operația pentru ACEST fel e deja în curs, al doilea tap nu mai
  // pornește un al doilea `fetch` — doar iese. Garda rămâne `true` pe TOATĂ
  // durata operației, inclusiv partea nativă (`salveazaPdf`/`tipareste`),
  // eliberată abia în `primesteMesaj`, mai jos — niciodată aici, la pornire.
  //
  // Temporizatorul de recuperare pornește AICI, nu doar la eșec — pentru că
  // singura cale prin care aflăm dacă `fetch`-ul din pagină a murit tăcut
  // (navigare peste el) este ABSENȚA oricărui mesaj, niciodată un eveniment
  // explicit de eșec. Fără temporizator, cazul ăla ar lăsa omul cu ecranul
  // neschimbat, la nesfârșit, fără nicio explicație — exact defectul pe care
  // sarcina asta trebuie să-l închidă, nu să-l reproducă sub altă formă. La
  // expirare, temporizatorul eliberează și garda de mai sus — altfel un
  // `fetch` mort ar bloca PERMANENT orice încercare ulterioară pe același fel.
  const porneșteAducerea = useCallback((url: string, fel: "pdf" | "html") => {
    if (inCursFisier.current[fel]) return;
    inCursFisier.current[fel] = true;
    webview.current?.injectJavaScript(scriptDeAducere(url, fel));
    const activ = timpRecuperareFisier.current[fel];
    if (activ !== null) clearTimeout(activ);
    timpRecuperareFisier.current[fel] = setTimeout(() => {
      timpRecuperareFisier.current[fel] = null;
      inCursFisier.current[fel] = false;
      Alert.alert(
        "Nu am primit răspuns",
        fel === "pdf"
          ? "Descărcarea fluturașului a durat prea mult. Încearcă din nou."
          : "Deschiderea adeverinței a durat prea mult. Încearcă din nou.",
      );
    }, TIMP_RECUPERARE_FISIER_MS);
  }, []);

  // Dispecer pe `fel` — vezi `MesajDinPagina`. `"pdf"`/`"html"` (Task 9) merg
  // pe lângă `"jeton"`, fără să-l rescrie.
  //
  // ── CINE A TRIMIS MESAJUL, ÎNAINTE DE CE SPUNE MESAJUL (rundă 4) ──────────
  // Până acum, dispecerul se uita DOAR la `nativeEvent.data` — niciodată la
  // `nativeEvent.url`. Puntea `window.ReactNativeWebView.postMessage` nu e
  // filtrată pe origine de niciuna din platforme, verificat în sursa
  // instalată: iOS o injectează ca `WKUserScript` la `documentStart` în
  // ORICE document ajuns în cadrul principal (`RNCWebViewImpl.m:1770-1790` —
  // `forMainFrameOnly:YES` limitează CADRUL, nu ORIGINEA); Android o
  // înregistrează cu `Set.of("*")`, adică pentru toate originile, și
  // transmite mai departe fără să se uite măcar la `isMainFrame`
  // (`RNCWebView.java:250-266`) — deci acolo poate scrie și un `<iframe>`.
  //
  // O pagină străină ajunsă în WebView putea deci trimite:
  // · `{fel:"pdf", ok:true, date:"data:application/pdf;base64,…"}` → scriam
  //   octeți controlați de ea în cache și deschideam foaia de partajare a
  //   sistemului, SUB IDENTITATEA APLICAȚIEI SEMNATE;
  // · `{fel:"html"}` → `Print.printAsync` randa HTML străin;
  // · `{fel:"jeton", ok:true}` → `inregistrat.current` rămânea `true` pe toată
  //   sesiunea, deci jetonul de push nu se mai înregistra deloc.
  //
  // Poarta de navigare de mai jos (`onShouldStartLoadWithRequest`) face acum
  // ca pagina de sus să nu mai POATĂ fi străină — verificarea de aici rămâne
  // fiindcă e apărare în adâncime, nu redundanță: pe Android puntea e
  // deschisă și subcadrelor (filmul de curs!), iar acelea CHIAR sunt pe altă
  // origine, cu tot cu drept legitim de a rula acolo.
  const primesteMesaj = useCallback((eveniment: WebViewMessageEvent) => {
    if (!esteOrigineaPortalului(eveniment.nativeEvent.url)) return;
    const mesaj = parseazaMesaj(eveniment.nativeEvent.data);
    if (mesaj === null) return;
    switch (mesaj.fel) {
      case "jeton":
        // Confirmarea a venit la timp — anulăm temporizatorul de recuperare
        // ca să nu elibereze garda peste o încercare deja lămurită.
        if (timpRecuperare.current !== null) {
          clearTimeout(timpRecuperare.current);
          timpRecuperare.current = null;
        }
        inCurs.current = false;
        if (mesaj.ok === true) inregistrat.current = true;
        // La `ok: false` nu facem nimic altceva: fie pagina nu era încă
        // `/portal` (cursa de mai sus), fie fetch-ul a eșuat pe rețea —
        // ambele se rezolvă singure la o navigare ulterioară relevantă.
        break;
      case "pdf":
      case "html": {
        // Îngustat de `switch` la `"pdf" | "html"` — indexează sigur în
        // refs-urile pe fel, de mai sus.
        const fel = mesaj.fel;
        // Mesajul a sosit — indiferent de `ok` — deci recuperarea de mai sus
        // nu mai are ce recupera.
        const activ = timpRecuperareFisier.current[fel];
        if (activ !== null) {
          clearTimeout(activ);
          timpRecuperareFisier.current[fel] = null;
        }
        if (mesaj.ok !== true) {
          // `raspuns.ok` fals în pagină (401/403/404/409/500 — vezi rutele
          // reale în `fisiere.ts`) sau `fetch`/`FileReader` a aruncat. Omul
          // primește un motiv, nu tăcere. Operația s-a încheiat (cu eșec) —
          // eliberăm garda de reintrare, ca un tap următor să poată porni
          // una nouă.
          inCursFisier.current[fel] = false;
          Alert.alert(
            "Nu s-a putut termina",
            fel === "pdf"
              ? "Fluturașul nu a putut fi descărcat. Verifică dacă luna e aprobată și încearcă din nou."
              : "Adeverința nu a putut fi deschisă pentru tipărire.",
          );
          break;
        }
        // Conținutul chiar a ajuns — restul e nativ (`expo-file-system`,
        // `expo-sharing`, `expo-print`), deci poate arunca independent de
        // orice a mers bine până aici. Prins separat, cu mesaj propriu: omul
        // nu trebuie să priceapă diferența, doar să știe că ceva a eșuat.
        //
        // Garda de reintrare (`inCursFisier`) rămâne `true` pe toată durata
        // blocului de mai jos — eliberată abia în `finally`, NU la sosirea
        // mesajului: cât `Sharing.shareAsync`/`Print.printAsync` e încă pe
        // ecran, un al doilea tap pe același buton ar porni o a doua
        // prezentare peste prima — exact instabilitatea (share sheet dublu pe
        // iOS) pe care garda există s-o evite, nu doar dublarea `fetch`-ului.
        void (async () => {
          try {
            if (fel === "pdf") {
              if (typeof mesaj.nume === "string" && typeof mesaj.date === "string") {
                // Din acest punct chiar se scrie fișierul și se prezintă
                // foaia de partajare — vezi `ferestraFisierDeschisa`, sus.
                ferestraFisierDeschisa.current.pdf = true;
                await salveazaPdf(mesaj.nume, mesaj.date);
              } else {
                // `ok: true`, dar scriptul n-a populat `nume`/`date` cum ar
                // fi trebuit (n-ar trebui să se întâmple azi, cf.
                // `scriptDeAducere`) — rămâne totuși o ramură care poate fi
                // atinsă, deci nu are voie să fie mută.
                Alert.alert(
                  "Nu s-a putut termina",
                  "Fluturașul a fost adus într-o formă neașteptată.",
                );
              }
            } else if (typeof mesaj.date === "string") {
              // Din acest punct chiar se prezintă previzualizarea de
              // tipărire — vezi `ferestraFisierDeschisa`, sus.
              ferestraFisierDeschisa.current.html = true;
              await tipareste(mesaj.date);
            } else {
              Alert.alert(
                "Nu s-a putut termina",
                "Adeverința a fost adusă într-o formă neașteptată.",
              );
            }
          } catch {
            // `expo-sharing`/`expo-print` au aruncat — de exemplu foaia de
            // partajare nu e disponibilă pe acest dispozitiv. Fișierul PDF
            // tot a fost scris în cache, la `salveazaPdf`, dar omul n-are de
            // unde ști asta fără o alertă explicită.
            Alert.alert(
              "Nu s-a putut termina",
              fel === "pdf"
                ? "Fluturașul a fost adus, dar nu s-a putut trimite mai departe."
                : "Adeverința a fost adusă, dar tipărirea nu a putut porni.",
            );
          } finally {
            inCursFisier.current[fel] = false;
            ferestraFisierDeschisa.current[fel] = false;
          }
        })();
        break;
      }
      default:
        break;
    }
  }, []);

  // SCANNER QR (Task 10)
  //
  // Stare ținută în `App`, nu în `Scanner` însuși: `mergiLa` are nevoie de
  // `webview`, iar lacătul (`Lacat`, în `lacat.tsx`) trebuie să poată acoperi
  // ecranul indiferent dacă scanner-ul e deschis — motiv pentru care butonul
  // și `Scanner` stau amândoi ÎN interiorul `copil`-ului dat lui `Lacat`, mai
  // jos: vălul biometric se desenează PESTE ele.
  const [scannerDeschis, setScannerDeschis] = useState(false);
  const inchideScanner = useCallback(() => setScannerDeschis(false), []);

  // Navigarea către URL-ul de pontare validat de `Scanner` (deja verificat
  // acolo, pe lista albă de domenii) — același idiom ca la deep link-ul de
  // notificare, mai jos: `location.assign` injectat, nu un apel nativ, ca
  // sesiunea din cookie jar-ul WebView-ului să rămână intactă.
  //
  // Primește URL-ul ÎNTREG (absolut), NU doar o cale relativă — reparație de
  // la revizuire: `location.assign("/portal/...")` s-ar fi rezolvat pe
  // ORIGINEA DOCUMENTULUI curent din WebView, nu pe cea validată de
  // `Scanner`. O cale relativă ar fi trimis codul de pontaj scanat către
  // originea pe care s-ar fi întâmplat să fie pagina. Cu URL-ul absolut,
  // `location.assign` navighează unde a fost validat, indiferent de originea
  // curentă a documentului. Poarta de origine de pe `WebView` (rundă 4, mai
  // jos) face ca documentul de sus să nu mai poată fi străin — dar reparația
  // rămâne: e ieftină, iar o poartă e o singură linie de cod care poate fi
  // ștearsă din greșeală.
  //
  // ── VERIFICAREA STĂ ACUM ÎN CHIUVETĂ, NU DOAR LA APELANȚI (revizuirea finală)
  // Clasa „navigare fără verificarea originii" a fost închisă de PATRU ori, de
  // fiecare dată la câte un apelant (scanner, deep link, `push.ts`,
  // `fisiere.ts`) — niciodată AICI, unde `location.assign` chiar se execută.
  // Comentariul de mai sus recunoștea singur riscul („o poartă e o singură linie
  // de cod care poate fi ștearsă din greșeală") și tot lăsa chiuveta deschisă.
  // Linia de mai jos face ca al cincilea apelant, oricare ar fi el, să nu mai
  // POATĂ reintroduce clasa: un URL care nu e pe originea portalului nu
  // navighează, indiferent cine cheamă și ce a verificat el înainte. Nu
  // înlocuiește verificările de la apelanți — acelea știu și CALEA, nu doar
  // originea — le face doar imposibil de ratat pe toate deodată.
  const mergiLa = useCallback((url: string) => {
    if (!esteOrigineaPortalului(url)) return;
    webview.current?.injectJavaScript(`location.assign(${JSON.stringify(url)}); true;`);
  }, []);

  // ACOPERIREA (PARȚIALĂ) A FOII DE PARTAJARE / PREVIZUALIZĂRII DE TIPĂRIRE
  // LĂSATE DESCHISE PESTE O TRECERE ÎN FUNDAL (Task 9 + Task 10, reparație de
  // la revizuire — același principiu ca la `Scanner`, aplicat unde se poate)
  //
  // `Sharing.shareAsync`/`Print.printAsync` (`fisiere.ts`) prezintă
  // `UIActivityViewController`/`UIPrintInteractionController` — aceeași
  // clasă de fereastră nativă separată ca `Modal`-ul din `scanner.tsx`. Dacă
  // omul trimite aplicația în fundal cât una din ele e deschisă și revine,
  // vălul biometric (`lacat.tsx`) se desenează dedesubt — la fel ca la
  // scanner — DAR spre deosebire de `Scanner`, nu există nicio cale să le
  // ÎNCHIDEM: nici `expo-sharing`, nici `expo-print` nu expun un `dismiss`
  // (verificat: căutare în sursa iOS a ambelor pachete instalate, niciun
  // rezultat), iar propriul nostru `<Modal>` n-ar reuși nici el să se
  // arate PESTE una deja prezentată — pe iOS se prezintă din
  // `[self reactViewController]`, care urcă lanțul de responderi până la
  // controller-ul RĂDĂCINĂ al aplicației, nu până la cel AFIȘAT curent
  // (verificat în sursa instalată a React Native:
  // `RCTModalHostViewManager.m:69`, `RCTModalHostViewComponentView.mm:154`)
  // — deci ar eșua exact ca orice altă încercare de a presenta peste o
  // fereastră deja prezentată.
  //
  // LIMITAREA REALĂ, declarată EXACT (rundă 2 de revizuire — varianta de
  // mai jos era prea îngustă): partea GRAVĂ a expunerii e INSTANTANEUL DIN
  // SWITCHER (iOS) / MINIATURA DIN „RECENTE" (Android), nu interacțiunea de
  // DUPĂ revenire. Alerta de mai jos se declanșează pe `"active"` — adică
  // DUPĂ ce instantaneul a fost deja făcut, cu fereastra nativă (fluturaș
  // sau adeverință, nemascate) pe ecran. Vălul nu ajută nici el: fereastra
  // e prezentată de controller-ul RĂDĂCINĂ, deasupra întregului arbore
  // React, deci și deasupra oricărui văl am desena noi. NU EXISTĂ nicio
  // mitigare din JavaScript pentru instantaneul în sine — nici pe iOS, nici
  // pe Android. Ce rămâne, mai jos, e strict pentru fereastra de
  // INTERACȚIUNE de după revenire (cineva care ține telefonul ar putea
  // altfel atinge direct foaia de partajare, fără să treacă vreodată prin
  // lacăt) — nu pentru ce a apucat să fie fotografiat înainte.
  //
  // Singurul mecanism din trusa asta care iese deasupra ACELEI ferestre de
  // interacțiune: `Alert.alert`. `RCTAlertController` își creează propria
  // `UIWindow`, cu `windowLevel = UIWindowLevelAlert + 1` (verificat în
  // `RCTAlertController.mm:32`) — mai sus decât fereastra normală a
  // aplicației, deci și decât orice foaie de partajare sau previzualizare de
  // tipărire prezentată acolo. NU e o închidere: fereastra nativă rămâne
  // prezentă dedesubt, doar acoperită (fundalul întunecat al alertei) și
  // netangibilă cât alerta e pe ecran.
  //
  // PE ANDROID NU EXISTĂ ECHIVALENT NICI PENTRU ATÂT — verificat, nu
  // presupus: `shareAsync` pornește un CHOOSER printr-un `Intent` separat
  // (`SharingModule.kt`, `startActivityForResult`), iar tipărirea trece prin
  // `PrintManager` (`PrintModule.kt`) — ambele sunt ACTIVITĂȚI/procese
  // separate de a noastră, nu ferestre în interiorul ei. O alertă RN pe
  // Android e legată de `FragmentManager`-ul PROPRIEI Activity
  // (`DialogModule.kt`) și nu poate apărea peste o Activity străină. Nici
  // fereastra de interacțiune de după revenire nu are deci vreo mitigare pe
  // Android — doar instantaneul e comun cu iOS, restul e mai rău. Rămâne o
  // limitare cunoscută a platformei, nerezolvabilă din `mobil/` fără cod
  // nativ propriu — semnalată în raport, nu ascunsă.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const abonament = AppState.addEventListener("change", (stare) => {
      if (stare !== "active") return;
      // `ferestraFisierDeschisa`, NU `inCursFisier`: cel din urmă e `true`
      // din momentul injectării scriptului, cu mult înainte să existe vreo
      // fereastră nativă (cerere de rețea + citire `FileReader`, până la
      // `TIMP_RECUPERARE_FISIER_MS` = 20s) — folosit ca semnal, alerta ar fi
      // apărut și pentru un simplu fluturaș care se descarcă mai greu pe o
      // rețea slabă, cu mesajul „o fereastră a rămas deschisă", FALS.
      if (!ferestraFisierDeschisa.current.pdf && !ferestraFisierDeschisa.current.html) return;
      // Gardă: „active" poate reveni de mai multe ori înainte ca omul să
      // apuce să atingă „OK" (de exemplu o tranziție scurtă prin
      // „inactive"→„active" imediat după cea care a declanșat deja alerta) —
      // fără gardă, ar apărea o a doua alertă suprapusă peste prima.
      if (alertaFisierAratata.current) return;
      alertaFisierAratata.current = true;
      // Un singur buton („OK") pe iOS: nu are nici gest de swipe, nici tap
      // în afara casetei care s-o închidă — practic necancelabilă oricum,
      // deci `cancelable` (opțiune gândită pentru Android, unde efectul ăsta
      // n-are cum să ruleze — vezi garda de mai sus) n-ar fi adăugat nimic
      // real; omisă intenționat, nu o garanție care sugerează mai mult decât
      // există.
      Alert.alert(
        "Reveniți în aplicație",
        "O fereastră de partajare sau tipărire a rămas deschisă cât aplicația era în fundal.",
        [{ text: "OK", onPress: () => { alertaFisierAratata.current = false; } }],
      );
    });
    return () => abonament.remove();
  }, []);

  useEffect(() => {
    // Curățenie la demontare: dacă `App` ar fi vreodată demontată cu o
    // recuperare încă programată, n-o lăsăm să scrie într-un ref al unei
    // instanțe dispărute. Doar temporizatoarele — `inCursFisier`/`inCurs` nu
    // au nevoie de resetare explicită aici: sunt simple `ref`-uri, nu stare
    // reactivă, deci mor o dată cu obiectul `App` demontat; o eventuală
    // scriere ulterioară dintr-un `finally` încă în zbor (vezi `primesteMesaj`)
    // ar cădea pe un obiect pe care nimeni nu-l mai citește, fără efect.
    return () => {
      if (timpRecuperare.current !== null) clearTimeout(timpRecuperare.current);
      if (timpRecuperareFisier.current.pdf !== null) {
        clearTimeout(timpRecuperareFisier.current.pdf);
      }
      if (timpRecuperareFisier.current.html !== null) {
        clearTimeout(timpRecuperareFisier.current.html);
      }
    };
  }, []);

  // Deep link la atingerea unei notificări. Calea vine în `data.cale`, deja
  // validată de bază ȘI de `construiesteMesaj` — a treia verificare
  // (`esteCaleDePortal`, mai sus) e aici pentru că e singura care rulează în
  // procesul care chiar navighează.
  //
  // Construim un URL ABSOLUT (`ORIGINEA_PORTALULUI` + calea validată), nu
  // navigăm cu o cale relativă (reparație rundă 2 de revizuire — scăpată
  // la reparația inițială a lui `mergiLa`, deși comentariul de-atunci
  // trimitea EXACT aici drept referință). Motivul de-atunci: documentul din
  // WebView putea fi legitim pe alt origin (un link extern din portal), deci
  // o cale relativă s-ar fi rezolvat pe ORIGINEA DOCUMENTULUI curent, nu pe
  // a noastră. Poarta de origine adăugată la rundă 4 (vezi
  // `onShouldStartLoadWithRequest`, mai jos) închide premisa aia — linkurile
  // externe pleacă acum în browser, nu în WebView — dar URL-ul absolut
  // rămâne: nu depindem de o singură poartă pentru o corectitudine care ne
  // costă zero.
  //
  // ── NAVIGAREA SE AMÂNĂ PÂNĂ CÂND EXISTĂ UN DOCUMENT (revizuirea finală) ────
  // `mergiLa` injectează `location.assign` în documentul CURENT al WebView-ului.
  // La pornirea la rece, în clipa în care ascultătorul se declanșează, acel
  // document abia se încarcă din `source={{ uri: URL_PORTAL }}` — iar încărcarea
  // inițială câștigă cursa: assign-ul se pierde, aplicația rămâne pe `/portal`,
  // tap-ul pare fără efect. De-aia calea nu se navighează direct, ci se pune în
  // `caleInAsteptare` și se consumă la prima încărcare TERMINATĂ pe portal (vezi
  // `deschideCaleInAsteptare` și cablajul de pe `onLoadEnd`/
  // `onNavigationStateChange`, mai jos). Dacă acea primă încărcare se termină pe
  // ecranul de login (om fără sesiune), calea rămâne în așteptare: `(portal)/
  // layout.tsx` redirecționează spre un `/autentificare` FĂRĂ parametru de
  // destinație, deci un assign de-acolo s-ar întoarce tot la login. Se consumă
  // la tranziția de după autentificare, când URL-ul e în sfârșit `/portal`.
  const trateazaRaspunsulLaNotificare = useCallback(
    (raspuns: Notifications.NotificationResponse) => {
      const cale = raspuns.notification.request.content.data?.cale;
      if (!esteCaleDePortal(cale)) return;
      if (!webviewIncarcat.current) {
        caleInAsteptare.current = cale;
        return;
      }
      mergiLa(`${ORIGINEA_PORTALULUI}${cale}`);
    },
    [mergiLa],
  );

  // ── RĂSPUNSUL SOSIT ÎNAINTE DE ABONARE (revizuirea finală) ─────────────────
  // `addNotificationResponseReceivedListener` e un simplu `emitter.addListener`
  // (verificat în sursa instalată, `expo-notifications@57.0.16`,
  // `build/NotificationsEmitter.js:79`): NU reia un răspuns sosit înainte de
  // abonare. La pornirea la rece — aplicația închisă, omul atinge notificarea —
  // răspunsul e pus de codul NATIV la pornire (`NotificationsEmitter.kt`:
  // `onNotificationResponseIntentReceived` scrie
  // `lastNotificationResponseBundle` și emite evenimentul), cu mult înainte ca
  // JS-ul nostru să existe. Adică fix cazul cel mai obișnuit al funcției se
  // pierdea în întregime.
  //
  // DE CE `getLastNotificationResponse()` + ascultător, ȘI NU
  // `useLastNotificationResponse()`: hook-ul pachetului rezolvă aceeași
  // problemă (îl citim ca referință — `build/useLastNotificationResponse.js:
  // 42-48`, cu `useLayoutEffect` „ensures the listener is registered as soon as
  // possible" și citirea inițială „in case it was set earlier, even in native
  // code on startup"), dar DEDUPLICĂ pe identificatorul cererii
  // (`determineNextResponse`): un al doilea tap pe ACEEAȘI notificare întoarce
  // exact obiectul dinainte, deci nu declanșează niciun efect nou. Omul care
  // atinge notificarea, se plimbă prin portal și o atinge din nou ar primi un
  // buton mort. Cu perechea de mai jos, fiecare tap navighează.
  //
  // `useLayoutEffect`, nu `useEffect`, din același motiv ca în hook-ul
  // pachetului: abonarea trebuie să se facă cât mai devreme, înaintea primei
  // vopsiri, ca fereastra în care un răspuns s-ar putea pierde să fie minimă.
  useLayoutEffect(() => {
    // Singura dublare posibilă: evenimentul nativ sosește DUPĂ abonare pentru
    // răspunsul pe care `getLastNotificationResponse` tocmai ni l-a dat. Îl
    // sărim O SINGURĂ DATĂ — un al doilea tap real pe aceeași notificare vine
    // mai târziu, cu garda deja consumată.
    let identificatorInitial: string | null = null;
    try {
      const initial = Notifications.getLastNotificationResponse();
      if (initial !== null) {
        identificatorInitial = initial.notification.request.identifier;
        trateazaRaspunsulLaNotificare(initial);
      }
    } catch {
      // `getLastNotificationResponse` ARUNCĂ `UnavailabilityError` dacă modulul
      // nativ nu expune funcția (verificat în sursa instalată,
      // `NotificationsEmitter.js`). Nu e motiv să rămânem și fără ascultător:
      // pornirea la rece se pierde, dar tap-urile cu aplicația deschisă merg.
    }
    const abonament = Notifications.addNotificationResponseReceivedListener((raspuns) => {
      if (identificatorInitial !== null) {
        const acelasi = raspuns.notification.request.identifier === identificatorInitial;
        identificatorInitial = null;
        if (acelasi) return;
      }
      trateazaRaspunsulLaNotificare(raspuns);
    });
    return () => abonament.remove();
  }, [trateazaRaspunsulLaNotificare]);

  // Consumă deep link-ul în așteptare, dar NUMAI pe o încărcare TERMINATĂ și
  // NUMAI pe portal (nu pe ecranul de login — vezi mai sus). Întoarce `true`
  // dacă a consumat evenimentul: apelantul nu mai pornește atunci
  // înregistrarea jetonului, fiindcă `location.assign` e o navigare HARD care
  // i-ar ucide `fetch`-ul din pagină. Înregistrarea se face oricum la
  // încărcarea următoare — cea a destinației, tot pe portal.
  const deschideCaleInAsteptare = useCallback(
    (url: string): boolean => {
      const cale = caleInAsteptare.current;
      if (cale === null) return false;
      if (!esteUrlPortal(url)) return false;
      caleInAsteptare.current = null;
      mergiLa(`${ORIGINEA_PORTALULUI}${cale}`);
      return true;
    },
    [mergiLa],
  );

  return (
    <Lacat
      copil={
        <SafeAreaView style={stiluri.ecran}>
          <StatusBar style="light" />
          <WebView
            ref={webview}
            source={{ uri: URL_PORTAL }}
            // Sesiunea trăiește în cookie jar-ul propriu al aplicației, separat de
            // Safari și Chrome. De aceea login-ul de aici e o sesiune NOUĂ, nu o
            // copie — iar rotația refresh token-ului Supabase o tratează normal.
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            // Fără asta, un `history.back()` din portal închide aplicația.
            allowsBackForwardNavigationGestures
            // `webviewIncarcat` se pune AICI, nu în `onNavigationStateChange`:
            // ăsta e singurul eveniment care înseamnă „documentul e gata", pe
            // ambele platforme. Vezi deep link-ul de mai sus — sub el,
            // `location.assign` s-ar injecta într-o pagină care abia se încarcă.
            onLoadEnd={(eveniment) => {
              webviewIncarcat.current = true;
              if (deschideCaleInAsteptare(eveniment.nativeEvent.url)) return;
              inregistreazaDacaPePortal(eveniment.nativeEvent.url);
            }}
            // `loading === false` e obligatoriu înainte de a consuma deep
            // link-ul de-aici: pe iOS, evenimentul ăsta e alimentat ȘI de
            // `decidePolicyForNavigationAction`, adică la ÎNCEPUTUL navigării
            // (vezi MOMENTUL ÎNREGISTRĂRII, mai sus) — un assign de-atunci ar
            // rula în documentul VECHI, iar navigarea în curs l-ar călca.
            // Înregistrarea jetonului rămâne cablată necondiționat, ca înainte:
            // ea are nevoie tocmai de evenimentul de tip SPA (login prin Server
            // Action, fără reîncărcare completă), pe care `onLoadEnd` nu-l dă.
            onNavigationStateChange={(stare: WebViewNavigation) => {
              if (!stare.loading) {
                webviewIncarcat.current = true;
                if (deschideCaleInAsteptare(stare.url)) return;
              }
              inregistreazaDacaPePortal(stare.url);
            }}
            // Fluturașul (`eDescarcare`) e o navigare directă spre `/api/export/`,
            // dintr-un `<a>` simplu — se vede imediat aici. Adeverința
            // (`eTiparire`) pleacă dintr-un `<Link>` (next/link) către un Route
            // Handler fără pagină RSC de preluat: Next încearcă întâi o preluare
            // RSC internă (invizibilă pentru WebView, e doar un `fetch` de
            // pagină), primește HTML în loc de payload RSC, și cade pe o
            // navigare grea de browser — ACEEA e ce prindem aici, nu click-ul
            // însuși. Verificat DIRECT în sursa Next.js instalată (rundă de
            // revizuire, nu doar în documentație): `next/dist/client/components/
            // router-reducer/fetch-server-response.js:130-141` cade pe
            // `doMpaNavigation`, care duce la `completeHardNavigation` — navigarea
            // grea reală. URL-ul folosit acolo e cel canonic, cu marcatorul
            // `_rsc` explicit șters (iar proiectul n-are `trailingSlash`), deci
            // regexul tolerant din `eTiparire` (`/`/`?` opțional după
            // `adeverinta`) nu era strict necesar — rămâne totuși ca marjă
            // ieftină, nu maschează nimic: interceptarea chiar se declanșează.
            //
            // Prima încărcare, din `source={{ uri: URL_PORTAL }}`, TRECE și ea
            // prin acest handler — dar `URL_PORTAL` nu conține `/api/export/` și
            // nu se potrivește cu regexul din `eTiparire`, deci ambele predicate
            // sunt false și `return true` o lasă să navigheze normal.
            //
            // ── POARTA DE ORIGINE (rundă 4) ────────────────────────────────
            // Handler-ul ăsta întorcea `true` pentru ORICE nu era descărcare
            // sau tipărire. Aia era cauza STRUCTURALĂ a patru reparații
            // separate din rundele 1-3 (scanner, deep link, `push.ts`,
            // `fisiere.ts`): fiecare compensa, în punctul ei, faptul că
            // documentul din WebView putea fi legitim pe alt origin. Cât timp
            // poarta rămâne deschisă, fiecare consumator NOU de URL sau de
            // mesaj e o instanță viitoare a aceleiași clase de defect.
            //
            // DE CE NU `originWhitelist` (prop-ul pachetului), deși e uneltea
            // evidentă — două motive, ambele verificate în sursa instalată:
            // 1. E ORB LA CADRE. Filtrul rulează în
            //    `WebViewShared.tsx:39-70`, ÎNAINTEA handler-ului nostru, pe
            //    fiecare eveniment de navigare — iar evenimentele includ și
            //    subcadrele (iOS: `RNCWebViewImpl.m:1364-1404` trimite
            //    evenimentul indiferent de `isTopFrame`; Android:
            //    `RNCWebViewClient.java:144-146` transmite
            //    `shouldOverrideUrlLoading(view, request)` mai departe fără
            //    să se uite la `isForMainFrame()`). Cu originea portalului ca
            //    listă albă, `<iframe src="https://www.youtube-nocookie.com/
            //    embed/…">` din lecția cu film (vezi `vizualizator-simplu.
            //    tsx`) ar fi fost anulat ȘI deschis în browser — filmul rupt,
            //    plus un browser care sare de la sine.
            // 2. E O POTRIVIRE DE PREFIX, FĂRĂ ANCORĂ LA SFÂRȘIT.
            //    `originWhitelistToRegex` (`WebViewShared.tsx:27-28`)
            //    construiește `^https://administrativo\.ro` — care se
            //    potrivește și cu originea `https://administrativo.ro.evil.
            //    example`. Ca poartă de securitate ar fi fost, în același
            //    timp, prea grosolană ȘI prea slabă.
            // Poarta stă deci AICI, unde avem URL-ul întreg, `URL` adevărat
            // (egalitate de origine, nu prefix) și, pe iOS, `isTopFrame`.
            //
            // SCHIMBARE DE COMPORTAMENT VIZIBILĂ, DAR NUMAI PE iOS (precizat
            // la rundă 5): acolo, „Deschideți la sursă" se deschide de-acum în
            // browserul telefonului în loc de aplicație — intenția, nu un
            // efect secundar. Pe Android linkul ăla nu trecea și nu trece prin
            // poarta asta (vezi `deschideInBrowser` pentru de ce), deci acolo
            // nu se schimbă nimic pentru om.
            //
            // CÂT DE ÎNCHISĂ E POARTA, EXACT: pentru CADRUL PRINCIPAL. Trei
            // căi rămân deschise, toate limitări ale bibliotecii, declarate
            // aici ca să nu se creadă mai mult decât e:
            // · subcadrele pe iOS trec necondiționat (regula de mai jos) —
            //   deliberat, altfel filmul de curs nu s-ar încărca;
            // · puntea de rezervă de pe Android (`RNCWebView.java:449`,
            //   dispozitive fără `WEB_MESSAGE_LISTENER`, adică WebView < 88)
            //   raportează URL-ul paginii DE SUS, nu al cadrului care a scris
            //   — deci acolo un `<iframe>` poate încă forja un mesaj care
            //   trece de verificarea din `primesteMesaj`;
            // · pe Android poarta CEDEAZĂ DESCHIS: `RNCWebViewClient.java:42`
            //   dă 250 ms firului JS să răspundă, iar la expirare
            //   `:111-113` scrie „defaulting to allow loading" și lasă
            //   navigarea să treacă — exact la pornire, sub congestie.
            // Închiderea completă ar cere `onOpenWindow` plus cod nativ
            // propriu; e altă amploare decât o rundă de reparații.
            onShouldStartLoadWithRequest={(cerere) => {
              // Ambele verifică ACUM și originea, nu doar calea — rundă 3 de
              // revizuire, vezi comentariul din `fisiere.ts`.
              if (eDescarcare(cerere.url, ORIGINEA_PORTALULUI)) {
                porneșteAducerea(cerere.url, "pdf");
                return false;
              }
              if (eTiparire(cerere.url, ORIGINEA_PORTALULUI)) {
                porneșteAducerea(cerere.url, "html");
                return false;
              }
              // SUBCADRU (iOS): pagina noastră a ales să încorporeze ceva, iar
              // `<iframe sandbox>` de acolo îi ține lesa (fără
              // `allow-top-navigation`, fără `allow-popups` — verificat în
              // `vizualizator-simplu.tsx`). Nu-l scoatem în browser: ar
              // însemna un browser care se deschide singur la fiecare
              // încărcare de film. Câmpul EXISTĂ doar pe iOS
              // (`RNCWebViewImpl.m:1398`); pe Android `createWebViewEvent`
              // (`RNCWebViewClient.java:314-325`) nu-l trimite deloc, deci
              // acolo rămâne `undefined` — de-aia mai jos vine și lista de
              // încorporări, care nu depinde de el.
              if (cerere.isTopFrame === false) return true;
              if (esteOrigineaPortalului(cerere.url)) return true;
              // `about:blank` — cadru gol, nu o destinație. `new URL` îi dă
              // originea „null", deci ar fi căzut pe ramura de browser.
              if (cerere.url === "about:blank") return true;
              // ANDROID, unde nu știm dacă e cadru principal: lăsăm să treacă
              // strict cele trei adrese de încorporare pe care le poate
              // produce portalul, în forma lor de încorporare. Un `isTopFrame`
              // adevărat (iOS) nu ajunge aici oricum — acolo linkul public
              // Loom pleacă în browser, ca și celelalte.
              if (cerere.isTopFrame !== true && esteIncorporareDeCurs(cerere.url)) return true;
              deschideInBrowser(cerere.url);
              return false;
            }}
            onMessage={primesteMesaj}
          />
          {/*
            Butonul stă DEASUPRA WebView-ului, nu în portal: pe web n-are ce
            căuta — acolo scanarea o face aplicația de cameră a telefonului
            (vezi `src/app/(portal)/portal/ponteaza/page.tsx`). E frate cu
            `WebView`, nu copil al lui, deci rămâne vizibil pe orice ecran al
            portalului, indiferent unde a navigat omul înăuntru.
          */}
          <Pressable style={stiluri.butonScanner} onPress={() => setScannerDeschis(true)}>
            <Text style={stiluri.butonScannerText}>Scanează codul</Text>
          </Pressable>
          {/*
            `originePortal` e DESTINAȚIA, nu filtrul de acceptare (rundă 5):
            scanner-ul își păstrează lista albă literală de domenii de pe afiș,
            dar remontează calea validată pe originea portalului configurat.
            Fără asta, o a doua intrare în `DOMENII_PERMISE` (un domeniu vechi,
            exact ce invită comentariul de acolo) ar fi trimis codul de pontaj
            prin poarta de mai sus, adică AFARĂ din sesiune.
          */}
          <Scanner
            deschis={scannerDeschis}
            inchide={inchideScanner}
            mergiLa={mergiLa}
            originePortal={ORIGINEA_PORTALULUI}
          />
        </SafeAreaView>
      }
    />
  );
}

const stiluri = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: "#0f1e3d" },
  butonScanner: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#0f1e3d",
    borderColor: "#faf7f0",
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  butonScannerText: { color: "#faf7f0", fontSize: 15, fontWeight: "600" },
});
