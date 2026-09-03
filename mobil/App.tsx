import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, SafeAreaView, StyleSheet, Text } from "react-native";
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

  // Navigarea către calea de pontare validată de `Scanner` (deja verificată
  // acolo, cu regex ancorat pe domeniul nostru) — același idiom ca la
  // deep link-ul de notificare, mai jos: `location.assign` injectat, nu un
  // apel nativ, ca sesiunea din cookie jar-ul WebView-ului să rămână intactă.
  const mergiLa = useCallback((cale: string) => {
    webview.current?.injectJavaScript(`location.assign(${JSON.stringify(cale)}); true;`);
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
    const abonament = Notifications.addNotificationResponseReceivedListener((raspuns) => {
      const cale = raspuns.notification.request.content.data?.cale;
      if (esteCaleInterna(cale)) {
        webview.current?.injectJavaScript(`location.assign(${JSON.stringify(cale)}); true;`);
      }
    });
    return () => abonament.remove();
  }, []);

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
              if (eDescarcare(cerere.url)) {
                porneșteAducerea(cerere.url, "pdf");
                return false;
              }
              if (eTiparire(cerere.url)) {
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
