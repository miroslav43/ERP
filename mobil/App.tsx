import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef } from "react";
import { Platform, SafeAreaView, StyleSheet } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

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

export default function App() {
  const webview = useRef<WebView>(null);
  // Devine `true` după prima injectare reușită, ca să nu retrimitem jetonul
  // la fiecare navigare din interiorul portalului — orice pagină /portal/*
  // declanșează din nou `onNavigationStateChange`.
  const inregistrat = useRef(false);

  // MOMENTUL ÎNREGISTRĂRII
  // Jetonul se trimite când URL-ul e efectiv sub /portal — adică DUPĂ
  // autentificare. `onLoadEnd` singur nu ajunge: la prima încărcare, dacă omul
  // nu era încă autentificat, layout-ul portalului face `redirect()`
  // server-side spre /autentificare (src/app/(portal)/layout.tsx) — deci
  // `onLoadEnd` s-ar declanșa PE ecranul de login, unde `fetch`-ul din pagină
  // n-ar avea cookie-urile sesiunii (ruta ar răspunde 401, înregistrarea s-ar
  // pierde tăcut). Login-ul e o Server Action Next.js
  // (src/app/(auth)/autentificare/actions.ts) care duce spre /portal printr-o
  // tranziție de client (fără reîncărcare completă a paginii) — deci NICI
  // `onLoadEnd` nu se mai declanșează a doua oară, la sosirea pe /portal.
  // `onNavigationStateChange` prinde și navigarea de tip client, fiindcă
  // urmărește URL-ul din bara de adrese, nu doar încărcările complete — de
  // aceea e verificarea principală. `onLoadEnd` rămâne cablat tot pe funcția
  // asta, ca variantă suplimentară: de exemplu când cookie-ul de sesiune era
  // deja valid dintr-o pornire anterioară și /portal se încarcă direct.
  const inregistreazaDacaPePortal = useCallback((url: string) => {
    if (inregistrat.current) return;
    if (!/\/portal(?:\/|$)/.test(url)) return;
    inregistrat.current = true;
    void (async () => {
      const jeton = await cereJeton();
      if (jeton === null) {
        // Emulator, refuz de permisiune, sau `getExpoPushTokenAsync` a
        // aruncat (vezi `push.ts`) — nu insistăm acum, dar nici nu blocăm o
        // reîncercare la o navigare ulterioară în portal (de exemplu dacă
        // omul acordă permisiunea din Setările telefonului între timp).
        inregistrat.current = false;
        return;
      }
      const platforma = Platform.OS === "ios" ? "ios" : "android";
      webview.current?.injectJavaScript(scriptDeInregistrare(jeton, platforma));
    })();
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
      />
    </SafeAreaView>
  );
}

const stiluri = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: "#0f1e3d" },
});
