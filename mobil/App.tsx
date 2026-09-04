import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Platform, Pressable, SafeAreaView, StyleSheet, Text } from "react-native";
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
 * (0001_kernel.sql) și ca `caleInterna` din `src/lib/push/mesaj.ts`: o cale
 * relativă simplă, nu un URL absolut sau protocol-relativ ascuns într-un
 * șir care începe din întâmplare cu `/`. Verificăm din nou aici pentru că
 * ăsta e singurul proces care chiar navighează.
 */
function esteCaleInterna(cale: unknown): cale is string {
  return typeof cale === "string" && /^\/[^/\\]/.test(cale);
}

/**
 * `url` e chiar portalul nostru — origine EXACTĂ, nu doar o cale care
 * conține „/portal" (rundă 3 de revizuire — un site străin poate avea orice
 * cale își dorește). `try/catch` fiindcă `url` vine dintr-un eveniment de
 * navigare al WebView-ului, nu dintr-o sursă controlată de noi — un URL
 * malformat nu trebuie să arunce, doar să respingă.
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
 * Mesajele venite din pagină, prin `window.ReactNativeWebView.postMessage`.
 * Câmpul `fel` le deosebește — vezi dispecerul din `primesteMesaj`. Valorile de
 * azi: `"jeton"` (înregistrarea push-ului, `push.ts`), `"pdf"` și `"html"`
 * (descărcarea/tipărirea, `fisiere.ts`). `nume`/`date` sunt tipate lax
 * (`unknown`) fiindcă doar `"pdf"`/`"html"` le populează — verificate cu
 * `typeof` la locul de folosire, ca la `esteCaleInterna`, nu presupuse.
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
  const primesteMesaj = useCallback((eveniment: WebViewMessageEvent) => {
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
  // `Scanner`. Dacă pagina din WebView ar fi navigat vreodată în afara
  // domeniului nostru (interceptarea de mai jos lasă să treacă orice
  // navigare care nu e descărcare sau tipărire), o cale relativă ar fi
  // trimis codul de pontaj scanat către acel alt domeniu. Cu URL-ul absolut,
  // `location.assign` navighează unde a fost validat, indiferent de originea
  // curentă a documentului.
  const mergiLa = useCallback((url: string) => {
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

  useEffect(() => {
    // Deep link la atingerea unei notificări. Calea vine în `data.cale`, deja
    // validată de bază ȘI de `construiesteMesaj` — a treia verificare
    // (`esteCaleInterna`, mai sus) e aici pentru că e singura care rulează în
    // procesul care chiar navighează.
    //
    // Construim un URL ABSOLUT (`ORIGINEA_PORTALULUI` + calea validată), nu
    // navigăm cu o cale relativă (reparație rundă 2 de revizuire — scăpată
    // la reparația inițială a lui `mergiLa`, deși comentariul de-atunci
    // trimitea EXACT aici drept referință). `originWhitelist` nu e setat pe
    // `WebView`, iar `onShouldStartLoadWithRequest` lasă să treacă orice
    // navigare care nu e descărcare sau tipărire — deci WebView-ul poate fi
    // legitim pe alt origin (un link extern din portal, de exemplu) în
    // momentul în care omul atinge notificarea. O cale relativă s-ar fi
    // rezolvat pe ORIGINEA DOCUMENTULUI curent, nu pe a noastră. Impactul e
    // mai mic decât la codul QR — calea de notificare nu poartă un secret,
    // doar o rută — dar forma defectului e identică, deci reparația e
    // identică: `mergiLa`, care primește deja un URL absolut.
    const abonament = Notifications.addNotificationResponseReceivedListener((raspuns) => {
      const cale = raspuns.notification.request.content.data?.cale;
      if (esteCaleInterna(cale)) {
        mergiLa(`${ORIGINEA_PORTALULUI}${cale}`);
      }
    });
    return () => abonament.remove();
  }, [mergiLa]);

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
            onLoadEnd={(eveniment) => inregistreazaDacaPePortal(eveniment.nativeEvent.url)}
            onNavigationStateChange={(stare: WebViewNavigation) =>
              inregistreazaDacaPePortal(stare.url)
            }
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
              return true;
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
          <Scanner deschis={scannerDeschis} inchide={inchideScanner} mergiLa={mergiLa} />
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
