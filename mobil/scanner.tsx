import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Scanner de coduri QR pentru pontarea la punctul de lucru.
 *
 * Afișul poartă un URL `https://administrativo.ro/portal/ponteaza/<cod>`
 * (vezi `src/app/(app)/puncte-lucru/[id]/afis/page.tsx` — `NEXT_PUBLIC_APP_URL`
 * din `.env.production`, plus `/ponteaza/<cod>`, `<cod>` fiind
 * `randomBytes(24).toString("base64url")`, alfabetul folosit mai jos).
 *
 * ── SCANNERUL ACCEPTĂ DOAR CODUL NOSTRU ─────────────────────────────────────
 * Un cod QR e text scris de oricine. Un afiș lipit peste al nostru n-are voie
 * să ducă aplicația semnată nicăieri altundeva — de-aia potrivirea de mai jos
 * cere: domeniul EXACT (dintre cele din `DOMENII_PERMISE`), urmat IMEDIAT de
 * forma exactă a căii, ancorată la sfârșit (`$`) — nu doar „conține
 * administrativo.ro undeva în șir". Orice altă potrivire (alt domeniu, altă
 * cale, sau pur și simplu alt text) e respinsă: `onBarcodeScanned` doar
 * iese, fără navigare — camera rămâne deschisă, gata să citească următorul
 * cod. Testat separat, pe două runde de revizuire, cu zeci de variante
 * ostile — subdomeniu fals, autoritate cu `@`, majuscule, port explicit,
 * punct final de FQDN, slash dublu, backslash, homoglife, `%2F`, newline
 * final, plus liste `DOMENII_PERMISE` malformate (fără schemă, goale,
 * protocol-relative — vezi `domeniuValid`, mai jos) — toate respinse; doar
 * forma exactă e acceptată. Numărul exact nu se ține aici, ca să nu
 * îmbătrânească tăcut.
 *
 * Domeniile sunt scrise literal într-un TABLOU, NU derivate din configurarea
 * portalului: e o listă albă de securitate (ce poate naviga o aplicație
 * semnată), nu o valoare care se schimbă des — trebuie să rămână lizibilă
 * dintr-o privire la audit, fără să depindă de ce a fost injectat în build la
 * un moment dat. Tabloul, nu un singur literal: proiectul a mutat deja
 * domeniul o dată (vezi nota din `erp-mutare-domeniu`) — un afiș tipărit sub
 * domeniul anterior nu trebuie să devină brusc inutilizabil; adăugarea unui
 * domeniu vechi aici, cât timp mai există afișe cu el pe pereți, costă un
 * rând.
 *
 * Codul NU e o dovadă în sine — acțiunea din `/portal/ponteaza/[cod]` îl
 * rezolvă din nou pe server, cu filtru pe organizație (vezi comentariul de
 * acolo: un cod al altei firme dă „nu aparține firmei", identic cu un cod
 * inventat). Aici doar se transportă calea către WebView, exact ca pe web.
 *
 * ── URL-UL ABSOLUT SE TRANSPORTĂ MAI DEPARTE, NU DOAR CALEA (reparație rundă
 *    1 de revizuire) ──────────────────────────────────────────────────────
 * Prima formă extrăgea doar calea (`/portal/ponteaza/<cod>`) și o dădea lui
 * `location.assign` din `App.tsx`. O cale RELATIVĂ se rezolvă pe originea
 * DOCUMENTULUI curent din WebView, nu pe cea validată aici — iar la data
 * scrierii, interceptarea din `App.tsx` (`onShouldStartLoadWithRequest`)
 * lăsa să treacă orice navigare care nu era descărcare sau tipărire, deci
 * WebView-ul putea ajunge legitim pe alt domeniu (un link extern din portal).
 * Un cod BUN scanat cât pagina era pe alt domeniu i-ar fi trimis ACELUI
 * domeniu codul de pontaj. `laScanare`, mai jos, transportă acum un URL
 * ABSOLUT, nu grupul de cale.
 *
 * ── CE ACCEPTĂM ȘI UNDE MERGEM SUNT DOUĂ LUCRURI DIFERITE (rundă 5) ─────────
 * Până acum, URL-ul absolut transportat era chiar șirul de pe afiș. Asta lega
 * tăcut destinația de `DOMENII_PERMISE` — o listă al cărei comentariu invită
 * EXPLICIT la adăugarea unui domeniu vechi „cât timp mai există afișe cu el pe
 * pereți". Din clipa în care lista ar fi avut o a doua intrare, un cod scanat
 * de pe un afiș vechi ar fi trecut validarea, ar fi ajuns la poarta de origine
 * din `App.tsx` — și, nefiind originea portalului, ar fi plecat DIN sesiune
 * (în browser, pe iOS; blocat, pe Android). Adică exact codul de pontaj,
 * scos afară. Aceeași capcană se declanșa în orice build cu `URL_PORTAL`
 * diferit de producție. Dormant azi (un singur domeniu, egal cu implicitul) —
 * dar fix în locul în care fișierul îți spune să scrii.
 *
 * Despărțirea: `DOMENII_PERMISE` rămâne lista a CE ACCEPTĂM de pe un afiș
 * (literală, lizibilă la audit, extensibilă cu domenii vechi), iar DESTINAȚIA
 * e întotdeauna `originePortal` — portalul configurat al buildului. Calea
 * validată se remontează pe el. Proprietatea de securitate e neschimbată
 * (cale ancorată, domeniu din listă albă), dar navigarea e garantat
 * pe-originea-noastră, deci nu poate ieși niciodată din sesiune.
 *
 * ── „BONUSUL" DE LA RUNDA 5 ERA FALS; SE RETRAGE (revizuirea finală) ────────
 * Comentariul de-aici a susținut o vreme că, prin remontare, „un afiș de
 * producție devine scanabil și pe un build de dezvoltare". Nu devine. Pe un
 * build cu `URL_PORTAL` pe `http://` — adică orice build îndreptat spre un Next
 * local — `urlPontareValidat` iese pe PRIMA linie: `domeniuValid(originePortal)`
 * cere `https://`, deci `http://localhost:3000` nu trece, iar funcția întoarce
 * `null` pentru ORICE cod, inclusiv pentru un afiș de producție perfect valid.
 * Scannerul e INERT acolo, iar singurul semnal e indiciul generic de după opt
 * rateuri — omul ar concluziona că e stricat scannerul, sau afișul. Nota 18 din
 * runda 1 („proba de scanare nu e executabilă pe un build de dezvoltare")
 * rămâne deci adevărată și a fost retrasă greșit; proba se face pe un build cu
 * `URL_PORTAL=https://administrativo.ro/portal`.
 *
 * Nu e un defect de reparat aici: fail-closed pe o origine care nu e `https` e
 * exact comportamentul dorit pentru codul de pontaj. E o limitare de mediu, de
 * declarat — nu un beneficiu de anunțat.
 */
const DOMENII_PERMISE = ["https://administrativo.ro"];
const CALE_PONTARE = /^\/portal\/ponteaza\/[A-Za-z0-9_-]+$/;

/**
 * O intrare din `DOMENII_PERMISE` trebuie să fie EXACT schemă+host, nimic în
 * plus. Fără verificarea asta (rundă 2 de revizuire — testat cu unsprezece
 * liste malformate, trei au eșuat DESCHIS), o intrare fără schemă
 * (`"administrativo.ro"`), goală (`""`) sau protocol-relativă
 * (`"//administrativo.ro"`) ar face `data.startsWith(domeniu)` să accepte
 * un șir FĂRĂ nicio origine reală — `location.assign` cu așa ceva se
 * rezolvă pe originea curentă a documentului, exact defectul închis la
 * IMPORTANT 2 din runda 1, reintrodus de o singură intrare greșită
 * într-un tablou al cărui comentariu invită explicit la completare.
 *
 * Regexul de la runda 2 (`/^https:\/\/[^/]+$/`) verifica FORMA, nu
 * PARSAREA — o intrare cu autoritate `@` (`"https://administrativo.ro@evil.
 * example"`) trecea de el (nu conține „/"), dar un `URL` real ar citi-o ca
 * userinfo `administrativo.ro` PE HOST-UL `evil.example` (rundă 3 de
 * revizuire). Reparație: cere ȘI rotund-trip prin `URL` — `new
 * URL(domeniu).origin` trebuie să dea ÎNAPOI exact același șir. O intrare cu
 * `@` (sau orice altă formă care „arată" ca hostul nostru dar se PARSEAZĂ
 * diferit) nu supraviețuiește rotund-trip-ului.
 */
function domeniuValid(domeniu: string): boolean {
  if (!domeniu.startsWith("https://")) return false;
  try {
    return new URL(domeniu).origin === domeniu;
  } catch {
    return false;
  }
}

if (__DEV__) {
  // Santinelă doar în dezvoltare: o intrare malformată aici e un bug de cod,
  // nu o stare de rulare posibilă — crapă cât mai devreme (la pornirea
  // aplicației), nu la primul scan, cu un mesaj care spune exact ce e greșit.
  for (const domeniu of DOMENII_PERMISE) {
    if (!domeniuValid(domeniu)) {
      throw new Error(`DOMENII_PERMISE conține o intrare nevalidă: ${JSON.stringify(domeniu)}`);
    }
  }
}

/**
 * `null` dacă `data` nu se potrivește exact cu niciun domeniu din lista albă.
 * Altfel, calea validată REMONTATĂ pe `originePortal` — vezi „CE ACCEPTĂM ȘI
 * UNDE MERGEM", sus.
 */
function urlPontareValidat(data: string, originePortal: string): string | null {
  // Fail-closed, ca peste tot în fișierul ăsta: dacă originea configurată n-ar
  // fi o origine adevărată, mai bine nu navigăm deloc decât să compunem un șir
  // fără origine, pe care `location.assign` l-ar rezolva pe documentul curent
  // (exact defectul închis la IMPORTANT 2, runda 1). Prin construcție nu se
  // poate întâmpla — `ORIGINEA_PORTALULUI` din `App.tsx` vine dintr-un
  // `new URL(...).origin` — dar verificarea costă un rând.
  if (!domeniuValid(originePortal)) return null;
  for (const domeniu of DOMENII_PERMISE) {
    // A doua verificare, ȘI ÎN PRODUCȚIE — nu doar santinela de mai sus —
    // ca o intrare malformată să nu poată deveni niciodată un prefix
    // acceptat, indiferent de ce s-a întâmplat cu verificarea de dezvoltare.
    if (!domeniuValid(domeniu)) continue;
    if (!data.startsWith(domeniu)) continue;
    const rest = data.slice(domeniu.length);
    if (CALE_PONTARE.test(rest)) return `${originePortal}${rest}`;
  }
  return null;
}

/** După câte coduri nepotrivite la rând arătăm un indiciu — nu la primul, ca
 * să nu clipească pentru un cadru tremurat, dar nici după minute de tăcere. */
const RATEURI_PENTRU_INDICIU = 8;

export function Scanner({
  deschis,
  inchide,
  mergiLa,
  originePortal,
}: {
  readonly deschis: boolean;
  readonly inchide: () => void;
  readonly mergiLa: (url: string) => void;
  /** Originea portalului configurat — DESTINAȚIA, nu filtrul de acceptare. */
  readonly originePortal: string;
}) {
  const [permisiune, cerePermisiune] = useCameraPermissions();
  // GARDĂ DE REINTRARE: `onBarcodeScanned` se poate declanșa de mai multe ori
  // pentru același cadru cât timp `inchide()` nu și-a produs încă efectul
  // (Modal-ul se ascunde asincron, la următorul desen). Fără garda asta, un
  // cod bun ar putea porni `mergiLa` de două ori — inofensiv pe fond
  // (`location.assign` cu aceeași adresă de două ori nu face nimic în plus),
  // dar inutil. Se eliberează pe SINGURA cale posibilă — timpul, mai jos —
  // fiindcă nu există niciun „mesaj de confirmare" de așteptat aici, spre
  // deosebire de gărzile din `App.tsx`.
  const [prins, setPrins] = useState(false);
  const eliberarePrins = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Indiciu tăcut → vizibil: numărul de coduri NEpotrivite citite la rând.
  // Cost zero pentru cineva care ține un afiș greșit sau vechi.
  //
  // Contorul trăiește într-un REF, nu în stare — reparație rundă 2 de
  // revizuire. `onBarcodeScanned` se declanșează la rata camerei cât un cod
  // (potrivit sau nu) stă în cadru: throttle-ul din `expo-camera` sare doar
  // evenimente identice, dar rezultatul poartă `bounds` (colțurile
  // detectate), care tremură la fiecare cadru — deci practic FIECARE cadru e
  // „diferit" pentru throttle. Un `setState` la fiecare rateu ar redesena
  // ecranul de zeci de ori pe secundă cât camera stă îndreptată spre un cod
  // greșit — cale gratuită înainte, cost real acum. `setState`
  // (`setArataIndiciu`) se cheamă o SINGURĂ dată, exact la trecerea
  // pragului — nu la fiecare rateu de după.
  const rateuriConsecutive = useRef(0);
  const [arataIndiciu, setArataIndiciu] = useState(false);

  useEffect(
    () => () => {
      if (eliberarePrins.current !== null) clearTimeout(eliberarePrins.current);
    },
    [],
  );

  useEffect(() => {
    // La fiecare deschidere pornim de la zero — un indiciu rămas de la o
    // sesiune anterioară de scanare n-are ce căuta pe una nouă.
    if (deschis) {
      rateuriConsecutive.current = 0;
      setArataIndiciu(false);
    }
  }, [deschis]);

  useEffect(() => {
    // Camera se OPREȘTE efectiv la trecerea în fundal — verificat în sursa
    // instalată, pe ambele platforme: Android leagă sesiunea de ciclul de
    // viață al activității (`ExpoCameraView.kt`,
    // `cameraProvider.bindToLifecycle`, care se dezleagă singur la `ON_STOP`
    // al CameraX); iOS oprește explicit `AVCaptureSession`
    // (`CameraView.swift`, `onAppBackgrounded` → `session.stopRunning()`).
    // Motivul închiderii de mai jos NU e deci „camera ar rămâne pornită" —
    // e faptul că `Modal`-ul ăsta e o fereastră nativă SEPARATĂ, deasupra
    // oricărui conținut din arborele React normal (`lacat.tsx`), indiferent
    // dacă sesiunea camerei din interiorul lui mai rulează sau nu. Ar rămâne
    // vizibilă — fereastra goală sau cu ultimul cadru înghețat — PESTE vălul
    // biometric, adică exact ocolirea lacătului prin simpla lăsare a
    // scanner-ului deschis la ieșirea din aplicație.
    if (!deschis) return;
    const abonament = AppState.addEventListener("change", (stare) => {
      if (stare === "background") inchide();
    });
    return () => abonament.remove();
  }, [deschis, inchide]);

  const solicitaPermisiune = () => {
    void cerePermisiune();
  };

  const laScanare = ({ data }: { readonly data: string }) => {
    if (prins) return;
    const url = urlPontareValidat(data, originePortal);
    if (url === null) {
      rateuriConsecutive.current += 1;
      // Doar la trecerea EXACTĂ a pragului — nu `>=` — ca `setState` să nu
      // se cheme din nou la fiecare rateu de după (deja `true`, ar fi un
      // no-op redundant, dar tot o comparație/re-randare evitabilă).
      if (rateuriConsecutive.current === RATEURI_PENTRU_INDICIU) setArataIndiciu(true);
      return;
    }
    rateuriConsecutive.current = 0;
    setArataIndiciu(false);
    setPrins(true);
    // URL absolut, pe originea portalului configurat — nu șirul de pe afiș.
    // Vezi comentariul de la începutul fișierului.
    mergiLa(url);
    inchide();
    if (eliberarePrins.current !== null) clearTimeout(eliberarePrins.current);
    eliberarePrins.current = setTimeout(() => {
      eliberarePrins.current = null;
      setPrins(false);
    }, 1000);
  };

  // `permisiune` e `null` până se termină prima interogare a stării —
  // ecranul rămâne gol (culoarea de fundal a containerului) cât timp nu
  // știm încă răspunsul, ca să nu clipească „atingeți pentru a permite"
  // pentru o fracțiune de secundă chiar când permisiunea era deja acordată.
  const permisReal = permisiune?.granted === true;
  const seMaiPoateCere = permisiune !== null && permisiune.canAskAgain;

  return (
    <Modal visible={deschis} animationType="slide" onRequestClose={inchide}>
      <View style={stiluri.plin}>
        {/*
          Cale de ieșire explicită, pe ecran, indiferent de stare
          (permisiune, cameră activă) — nu doar gestul de „back" (Android) sau
          swipe (iOS), care nu funcționează identic pe toate ecranele de tip
          `Modal`. Fără buton vizibil, un om căruia i s-a refuzat definitiv
          accesul la cameră ar rămâne fără nicio cale evidentă de a închide
          fereastra.
        */}
        <Pressable style={stiluri.butonInchide} onPress={inchide} hitSlop={12}>
          <Text style={stiluri.butonInchideText}>Închide</Text>
        </Pressable>

        {permisiune === null ? null : permisReal ? (
          <>
            <CameraView
              style={stiluri.plin}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={laScanare}
            />
            {arataIndiciu ? (
              <View style={stiluri.indiciu} pointerEvents="none">
                <Text style={stiluri.indiciuText}>
                  Nu recunosc acest cod. Verificați dacă e afișul de pontare al firmei.
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={stiluri.centru}>
            {seMaiPoateCere ? (
              <Pressable onPress={solicitaPermisiune}>
                <Text style={stiluri.text}>Atingeți pentru a permite accesul la cameră</Text>
              </Pressable>
            ) : (
              <>
                <Text style={stiluri.text}>
                  Accesul la cameră a fost refuzat. Activați-l din Setările telefonului ca să
                  puteți scana codul de pontare de la punctul de lucru.
                </Text>
                <Pressable
                  style={stiluri.butonSetari}
                  onPress={() => void Linking.openSettings()}
                >
                  <Text style={stiluri.butonSetariText}>Deschide Setările</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const stiluri = StyleSheet.create({
  plin: { flex: 1, backgroundColor: "#0f1e3d" },
  centru: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  text: { color: "#faf7f0", fontSize: 16, textAlign: "center" },
  butonInchide: {
    position: "absolute",
    top: 56,
    left: 16,
    zIndex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(250, 247, 240, 0.16)",
  },
  butonInchideText: { color: "#faf7f0", fontSize: 15, fontWeight: "600" },
  butonSetari: {
    backgroundColor: "#faf7f0",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  butonSetariText: { color: "#0f1e3d", fontSize: 15, fontWeight: "600" },
  indiciu: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 48,
    backgroundColor: "rgba(15, 30, 61, 0.85)",
    borderRadius: 12,
    padding: 12,
  },
  indiciuText: { color: "#faf7f0", fontSize: 14, textAlign: "center" },
});
