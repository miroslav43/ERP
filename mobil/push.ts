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
 * Timpul maxim cât așteptăm întregul flux de cerere a jetonului (canal +
 * permisiune + token) înainte să presupunem că o promisiune nativă nu se mai
 * termină NICIODATĂ (rundă 3 de revizuire — găsit prin căutare proprie, nu
 * semnalat de revizor).
 *
 * Mult mai generos decât timeout-ul de 4s din `lacat.tsx`
 * (`TIMP_LIMITA_VERIFICARE_MS`), care păzește doar interogări pur hardware:
 * fluxul de-aici include `requestPermissionsAsync`, care așteaptă o
 * interacțiune UMANĂ (dialogul de permisiune) — un timeout scurt ar tăia un
 * om care pur și simplu se gândește o clipă înainte să apese Permite/Refuz.
 * Fără NICIUN timeout însă, o promisiune nativă blocată ar ține
 * `inCurs.current` din `App.tsx` `true` PE VIAȚĂ: nimic nu-l eliberează —
 * garda de recuperare de-acolo (`timpRecuperare`) pornește abia DUPĂ ce
 * `cereJeton()` s-a rezolvat, nu în timp ce așteaptă. Exact tiparul reparat
 * în `lacat.tsx` la runda 2, aici neatins până acum.
 */
const TIMP_LIMITA_CERERE_JETON_MS = 2 * 60 * 1000;

/**
 * Cere jetonul de push, cu permisiunea necesară.
 *
 * Întoarce `null`, niciodată nu aruncă: fiecare cale de refuz e o cale
 * normală de folosire a aplicației, nu o eroare de-a fi tratată de apelant.
 * Patru motive distincte duc la `null`:
 * - emulatorul (`Device.isDevice` fals) — nu există jeton de cerut;
 * - omul refuză permisiunea — cerută o singură dată, niciodată insistent;
 * - `getExpoPushTokenAsync` ARUNCĂ dacă `extra.eas.projectId` din
 *   `app.config.ts` e gol (verificat: proiectul îl are `""` azi, până la
 *   configurarea EAS din altă sarcină) — fără try/catch, asta ar opri
 *   întreaga înregistrare cu o respingere de promisiune netratată;
 * - fluxul nu s-a decis în `TIMP_LIMITA_CERERE_JETON_MS` — vezi comentariul
 *   de la constantă.
 */
export async function cereJeton(): Promise<string | null> {
  // Emulatoarele nu primesc jetoane. Fără ramura asta, dezvoltarea locală pare
  // ruptă când de fapt e doar un emulator.
  if (!Device.isDevice) return null;

  try {
    let idTemporizator: ReturnType<typeof setTimeout> | null = null;
    const rezultat = await Promise.race([
      (async () => {
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
      })(),
      new Promise<null>((rezolva) => {
        idTemporizator = setTimeout(() => rezolva(null), TIMP_LIMITA_CERERE_JETON_MS);
      }),
    ]);
    // Curățenie: fără ea, temporizatorul rămâne programat degeaba și atunci
    // când interogarea reală câștigă cursa — efect zero, dar murdărie
    // (vezi aceeași reparație în `lacat.tsx`, rundă 3).
    if (idTemporizator !== null) clearTimeout(idTemporizator);
    return rezultat;
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
 * VERIFICAREA DE MAI JOS E DECISIVĂ, NU DECORATIVĂ — DAR TREBUIE SĂ VERIFICE
 * ȘI ORIGINEA, NU DOAR CALEA (corectare rundă 3 de revizuire — comentariul
 * ăsta afirma până acum „verificarea `location.pathname` e decisivă", ceea
 * ce era EXACT jumătate de adevăr: verifica UNDE pe site, nu CARE site)
 * Partea nativă decide CÂND injectează scriptul pe baza unui eveniment de
 * navigare al WebView-ului — dar (verificat empiric, pe cursa descrisă în
 * `App.tsx`, secțiunea „MOMENTUL ÎNREGISTRĂRII") evenimentul ăla poate purta
 * încă URL-ul dinaintea unui redirect server-side, nu URL-ul unde pagina
 * chiar aterizează. Scriptul ăsta rulează ÎN pagină, exact la momentul în
 * care execută `fetch`-ul — e singurul cod din tot lanțul care știe sigur pe
 * ce pagină e, chiar atunci.
 *
 * DOAR calea („e pe /portal?") NU ajunge: `WebView` n-are `originWhitelist`
 * (implicitul pachetului e orice `http(s)://`), `onShouldStartLoadWithRequest`
 * din `App.tsx` lasă să treacă orice navigare care nu e descărcare sau
 * tipărire, iar portalul chiar are un link către un site din afară — deci
 * pagina curentă poate fi legitim pe alt origin. Un site străin cu o cale
 * care conține `/portal` (banal de construit) ar fi trecut de o verificare
 * doar pe cale — scriptul ar fi injectat un `fetch` relativ
 * (`"/api/dispozitive"`), care s-ar fi rezolvat pe ORIGINEA ACELUI SITE, nu
 * pe a noastră — jetonul de push (un secret real: cu el se pot trimite
 * notificări pe telefonul omului) ar fi plecat printr-un POST către
 * originea străină. Verificarea de mai jos cere ACUM origine + cale,
 * ambele, iar `fetch`-ul folosește un URL ABSOLUT construit din origine —
 * niciodată o cale relativă rezolvată pe orice s-ar întâmpla să fie
 * încărcat.
 *
 * RAPORTAREA ÎNAPOI, PRIN `postMessage`
 * Fără ea, partea nativă n-ar afla NICIODATĂ dacă injectarea a nimerit pe
 * pagina greșită — ar bloca reîncercarea crezând, greșit, că a reușit. Mesajul
 * are câmpul `fel: "jeton"` ca să poată coexista cu alte mesaje pe același
 * canal (Task 9: descărcări, tipărire) — `onMessage` din `App.tsx` e un
 * dispecer pe `fel`, nu un singur consumator.
 */
export function scriptDeInregistrare(
  jeton: string,
  platforma: "ios" | "android",
  origineaPortalului: string,
): string {
  const corp = JSON.stringify({ jeton, platforma });
  const origineJson = JSON.stringify(origineaPortalului);
  const urlJson = JSON.stringify(`${origineaPortalului}/api/dispozitive`);
  return `
    (function () {
      if (location.origin !== ${origineJson} || !location.pathname.startsWith("/portal")) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ fel: "jeton", ok: false }));
        return;
      }
      fetch(${urlJson}, {
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
