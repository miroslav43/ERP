import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Obținerea jetonului de push și scriptul care îl injectează în WebView.
 *
 * DE CE INJECTARE ȘI NU UN APEL NATIV
 * Un `fetch` din partea nativă n-ar purta cookie-urile sesiunii — acelea trăiesc
 * în cookie jar-ul WebView-ului. Injectat, apelul pleacă DIN pagină, deci e
 * autentificat fără ca aplicația să atingă vreodată un token de sesiune —
 * exact contractul lui `POST /api/dispozitive` (src/app/api/dispozitive/route.ts):
 * ruta citește sesiunea din cookie, la fel ca orice altă rută.
 */

/**
 * Canalul e obligatoriu pe Android 8+; fără el, notificarea nu se afișează, iar
 * expeditorul nu primește nicio eroare (livrarea rămâne "trimisă" în bază).
 * Numele trebuie să fie EXACT "implicit" — `channelId` din
 * `src/lib/push/mesaj.ts` (`construiesteMesaj`) e cablat pe el.
 */
const CANAL = "implicit";

/**
 * Cere jetonul de push, cu permisiunea necesară.
 *
 * Întoarce `null`, niciodată nu aruncă: fiecare cale de refuz e o cale
 * normală de folosire a aplicației, nu o eroare de-a fi tratată de apelant.
 * Trei motive distincte duc la `null`:
 * - emulatorul (`Device.isDevice` fals) — nu există jeton de cerut;
 * - omul refuză permisiunea — cerută o singură dată, niciodată insistent;
 * - `getExpoPushTokenAsync` ARUNCĂ dacă `extra.eas.projectId` din
 *   `app.config.ts` e gol (verificat: proiectul îl are `""` azi, până la
 *   configurarea EAS din altă sarcină) — fără try/catch, asta ar opri
 *   întreaga înregistrare cu o respingere de promisiune netratată.
 */
export async function cereJeton(): Promise<string | null> {
  // Emulatoarele nu primesc jetoane. Fără ramura asta, dezvoltarea locală pare
  // ruptă când de fapt e doar un emulator.
  if (!Device.isDevice) return null;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CANAL, {
        name: "Notificări",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existent } = await Notifications.getPermissionsAsync();
    let status = existent;
    if (status !== "granted") {
      // Android 13+ cere POST_NOTIFICATIONS la execuție; iOS cere întotdeauna.
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return null;

    const { data } = await Notifications.getExpoPushTokenAsync();
    return data;
  } catch {
    // Vezi comentariul de mai sus: proiectul fără `projectId` real e cazul
    // cunoscut, dar orice altă eroare nativă tratăm la fel — fără jeton,
    // aplicația continuă normal, doar fără notificări push.
    return null;
  }
}

/**
 * Scriptul rulat ÎN pagină, prin `injectJavaScript`. Se termină cu `true;`
 * pentru că altfel `injectJavaScript` avertizează pe iOS despre o valoare de
 * retur nesincronizată (WebKit cere o expresie, nu o instrucțiune `fetch(...)`
 * simplă, ca ultimă linie).
 *
 * `credentials: "same-origin"` e explicit deși e implicitul lui `fetch`:
 * documentează intenția — cererea trebuie să poarte cookie-ul de sesiune al
 * paginii, nu să pornească fără el.
 *
 * VERIFICAREA `location.pathname` E DECISIVĂ, NU DECORATIVĂ
 * Partea nativă decide CÂND injectează scriptul pe baza unui eveniment de
 * navigare al WebView-ului — dar (verificat empiric, pe cursa descrisă în
 * `App.tsx`, secțiunea „MOMENTUL ÎNREGISTRĂRII") evenimentul ăla poate purta
 * încă URL-ul dinaintea unui redirect server-side, nu URL-ul unde pagina
 * chiar aterizează. Scriptul ăsta rulează ÎN pagină, exact la momentul în
 * care execută `fetch`-ul — e singurul cod din tot lanțul care știe sigur pe
 * ce pagină e, chiar atunci. Dacă nu e pe `/portal`, nu încearcă deloc
 * fetch-ul (ar fi oricum respins cu 401, fără sesiune) și raportează eșecul.
 *
 * RAPORTAREA ÎNAPOI, PRIN `postMessage`
 * Fără ea, partea nativă n-ar afla NICIODATĂ dacă injectarea a nimerit pe
 * pagina greșită — ar bloca reîncercarea crezând, greșit, că a reușit. Mesajul
 * are câmpul `fel: "jeton"` ca să poată coexista cu alte mesaje pe același
 * canal (Task 9: descărcări, tipărire) — `onMessage` din `App.tsx` e un
 * dispecer pe `fel`, nu un singur consumator.
 */
export function scriptDeInregistrare(jeton: string, platforma: "ios" | "android"): string {
  const corp = JSON.stringify({ jeton, platforma });
  return `
    (function () {
      if (!location.pathname.startsWith("/portal")) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ fel: "jeton", ok: false }));
        return;
      }
      fetch("/api/dispozitive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: ${JSON.stringify(corp)},
        credentials: "same-origin"
      }).then(function (raspuns) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ fel: "jeton", ok: raspuns.ok }));
      }).catch(function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({ fel: "jeton", ok: false }));
      });
    })();
    true;
  `;
}
