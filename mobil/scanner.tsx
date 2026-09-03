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
 * e ANCORATĂ la început și sfârșit (`^...$`), pe domeniul exact și pe forma
 * exactă a căii, nu doar „conține administrativo.ro undeva în șir". Orice altă
 * potrivire (alt domeniu, altă cale, sau pur și simplu alt text) e respinsă
 * TĂCUT: `onBarcodeScanned` doar iese, fără alertă, fără navigare — camera
 * rămâne deschisă, gata să citească următorul cod.
 *
 * Domeniul e scris literal, NU derivat din configurarea portalului: e o listă
 * albă de securitate (ce poate naviga o aplicație semnată), nu o valoare care
 * se schimbă des — trebuie să rămână lizibilă dintr-o privire la audit, fără
 * să depindă de ce a fost injectat în build la un moment dat.
 *
 * Codul NU e o dovadă în sine — acțiunea din `/portal/ponteaza/[cod]` îl
 * rezolvă din nou pe server, cu filtru pe organizație (vezi comentariul de
 * acolo: un cod al altei firme dă „nu aparține firmei", identic cu un cod
 * inventat). Aici doar se transportă calea către WebView, exact ca pe web.
 */
const REGEX_COD_PONTARE =
  /^https:\/\/administrativo\.ro(\/portal\/ponteaza\/[A-Za-z0-9_-]+)$/;

export function Scanner({
  deschis,
  inchide,
  mergiLa,
}: {
  readonly deschis: boolean;
  readonly inchide: () => void;
  readonly mergiLa: (cale: string) => void;
}) {
  const [permisiune, cerePermisiune] = useCameraPermissions();
  // GARDĂ DE REINTRARE: `onBarcodeScanned` se poate declanșa de mai multe ori
  // pentru același cadru cât timp `inchide()` nu și-a produs încă efectul
  // (Modal-ul se ascunde asincron, la următorul desen). Fără garda asta, un
  // cod bun ar putea porni `mergiLa` de două ori — inofensiv pe fond
  // (`location.assign` cu aceeași cale de două ori nu face nimic în plus),
  // dar inutil. Se eliberează pe SINGURA cale posibilă — timpul, mai jos —
  // fiindcă nu există niciun „mesaj de confirmare" de așteptat aici, spre
  // deosebire de gărzile din `App.tsx`.
  const [prins, setPrins] = useState(false);
  const eliberarePrins = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (eliberarePrins.current !== null) clearTimeout(eliberarePrins.current);
    },
    [],
  );

  useEffect(() => {
    // Camera rămâne pornită cât scanner-ul e deschis, inclusiv cât aplicația
    // trece în fundal — un apel telefonic sau o notificare n-o opresc
    // singure. Dacă lacătul biometric o acoperă la revenire (`lacat.tsx`),
    // vălul e desenat de `App`, dar `Modal`-ul ăsta e o fereastră nativă
    // SEPARATĂ, deasupra oricărui conținut din arborele React normal — ar
    // rămâne vizibil PESTE văl, ceea ce ar însemna că biometria e ocolită
    // pur și simplu lăsând scanner-ul deschis la ieșirea din aplicație.
    // De-aia scanner-ul se închide singur la trecerea în fundal — nu doar ca
    // igienă a camerei, ci ca să nu existe nicio cale de a ține un scanner
    // deschis peste lacăt.
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
    const potrivire = REGEX_COD_PONTARE.exec(data);
    const cale = potrivire?.[1];
    if (cale === undefined) return;
    setPrins(true);
    mergiLa(cale);
    inchide();
    if (eliberarePrins.current !== null) clearTimeout(eliberarePrins.current);
    eliberarePrins.current = setTimeout(() => {
      eliberarePrins.current = null;
      setPrins(false);
    }, 1000);
  };

  // `permisiune` e `null` până se termină prima interogare a stării — tratat
  // la fel ca „încă nerefuzat", ca omul să nu vadă un ecran gol la deschidere.
  const permisReal = permisiune?.granted === true;
  const seMaiPoateCere = permisiune === null || permisiune.canAskAgain;

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

        {permisReal ? (
          <CameraView
            style={stiluri.plin}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={laScanare}
          />
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
});
