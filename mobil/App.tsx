import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import { Platform, SafeAreaView, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";

import { cereJeton, scriptDeInregistrare } from "./push";

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
 * Mesajele venite din pagină, prin `window.ReactNativeWebView.postMessage`.
 * Câmpul `fel` le deosebește: Task 9 va adăuga alte valori (descărcări,
 * tipărire) fără să rescrie `onMessage` — vezi dispecerul din `primesteMesaj`.
 */
type MesajDinPagina = { readonly fel: string; readonly ok?: boolean };

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
    if (!/\/portal(?:\/|$)/.test(url)) return;
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
      webview.current?.injectJavaScript(scriptDeInregistrare(jeton, platforma));
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

  // Dispecer pe `fel` — vezi `MesajDinPagina`. Task 9 adaugă alte ramuri aici
  // (descărcări, tipărire) fără să rescrie ramura `"jeton"`.
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
      default:
        break;
    }
  }, []);

  useEffect(() => {
    // Curățenie la demontare: dacă `App` ar fi vreodată demontată cu o
    // recuperare încă programată, n-o lăsăm să scrie într-un ref al unei
    // instanțe dispărute.
    return () => {
      if (timpRecuperare.current !== null) clearTimeout(timpRecuperare.current);
    };
  }, []);

  useEffect(() => {
    // Deep link la atingerea unei notificări. Calea vine în `data.cale`, deja
    // validată de bază ȘI de `construiesteMesaj` — a treia verificare
    // (`esteCaleInterna`, mai sus) e aici pentru că e singura care rulează în
    // procesul care chiar navighează.
    const abonament = Notifications.addNotificationResponseReceivedListener((raspuns) => {
      const cale = raspuns.notification.request.content.data?.cale;
      if (esteCaleInterna(cale)) {
        webview.current?.injectJavaScript(`location.assign(${JSON.stringify(cale)}); true;`);
      }
    });
    return () => abonament.remove();
  }, []);

  return (
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
        onMessage={primesteMesaj}
      />
    </SafeAreaView>
  );
}

const stiluri = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: "#0f1e3d" },
});
