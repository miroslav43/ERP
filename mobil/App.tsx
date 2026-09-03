import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useRef } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

/**
 * Portalul de angajat, într-un WebView.
 *
 * Aplicația NU rescrie niciun ecran: conținutul e `administrativo.ro/portal`,
 * deci fiecare livrare web apare instantaneu și în aplicație, fără review de
 * magazin. Ce se adaugă aici e strict ce browserul de pe telefon nu poate da.
 */
const URL_PORTAL =
  (Constants.expoConfig?.extra?.urlPortal as string) ?? "https://administrativo.ro/portal";

export default function App() {
  const webview = useRef<WebView>(null);
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
      />
    </SafeAreaView>
  );
}

const stiluri = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: "#0f1e3d" },
});
