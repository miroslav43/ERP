import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Ecran opac peste WebView, deblocat cu Face ID sau amprentă.
 *
 * NU atinge sesiunea. Biometrie eșuată înseamnă ecran acoperit, nu
 * deconectare — un lacăt care ar șterge sesiunea ar transforma un deget umed
 * într-o reautentificare cu parolă, pe un telefon de șantier.
 *
 * Dacă telefonul n-are biometrie înregistrată, lacătul nu se aplică deloc:
 * altfel aplicația ar deveni imposibil de deschis pe un telefon fără PIN
 * biometric configurat.
 *
 * ── CE SE ÎNTÂMPLĂ DACĂ BIOMETRIA DISPARE CÂT APLICAȚIA E ÎN FUNDAL ─────────
 * Omul poate dezactiva amprenta din Setările telefonului exact cât aplicația
 * stă blocată în fundal. Dacă am cere atunci o autentificare imposibilă, omul
 * ar rămâne închis definitiv în afara propriei aplicații — exact defectul pe
 * care lacătul n-are voie să-l producă. De-aia disponibilitatea se
 * REVERIFICĂ, nu doar la pornire: o dată la fiecare revenire în prim-plan
 * (`stare === "active"`, mai jos) și încă o dată chiar înainte de a cere
 * autentificarea (`deblocheaza`). Dacă biometria nu mai e disponibilă în
 * niciunul din aceste momente, vălul se ridică fără nicio cerere de
 * autentificare — regula „fără biometrie, fără lacăt" se aplică pe tot
 * parcursul sesiunii, nu doar la deschiderea aplicației.
 *
 * ── PORTIȚA DE SIGURANȚĂ, DACĂ TOT CE-I MAI SUS AR DA GREȘ ──────────────────
 * `blocat` e stare React simplă, ținută doar în memorie — niciodată scrisă pe
 * disc. Dacă un om ar rămâne totuși blocat (bug neprevăzut, eroare nativă
 * repetată), închiderea completă a aplicației și redeschiderea o repornesc
 * de la zero: `blocat` pornește mereu `false` la montare. Ieșirea există
 * mereu, chiar dacă biometria însăși e complet stricată.
 */
export function Lacat({ copil }: { readonly copil: React.ReactNode }) {
  const [blocat, setBlocat] = useState(false);
  // Ultima disponibilitate cunoscută. Ref, nu stare: nu are nevoie să
  // redeseneze nimic — e citită doar în reacție la evenimente (schimbare de
  // `AppState`, tap pe văl), niciodată direct în JSX.
  const disponibil = useRef(false);

  const verificaDisponibilitatea = useCallback(async () => {
    try {
      const are = await LocalAuthentication.hasHardwareAsync();
      const inregistrat = are ? await LocalAuthentication.isEnrolledAsync() : false;
      disponibil.current = are && inregistrat;
    } catch {
      // Eroare nativă neașteptată la interogarea hardware-ului — tratăm ca
      // „nu e disponibil", nu ca „aplicația nu pornește".
      disponibil.current = false;
    }
    return disponibil.current;
  }, []);

  useEffect(() => {
    void verificaDisponibilitatea();
  }, [verificaDisponibilitatea]);

  useEffect(() => {
    const abonament = AppState.addEventListener("change", (stare) => {
      if (stare === "background") {
        // Doar dacă biometria era disponibilă la ultima verificare — altfel
        // am acoperi ecranul unui telefon fără nicio cale de a-l debloca.
        if (disponibil.current) setBlocat(true);
        return;
      }
      if (stare === "active") {
        // Revenire în prim-plan: reverificăm ÎNAINTE ca omul să apuce să
        // atingă vălul, ca să nu-i cerem o autentificare care nu mai poate
        // reuși niciodată (vezi comentariul de sus).
        void verificaDisponibilitatea().then((disp) => {
          if (!disp) setBlocat(false);
        });
      }
    });
    return () => abonament.remove();
  }, [verificaDisponibilitatea]);

  const deblocheaza = useCallback(async () => {
    // A doua reverificare, chiar înainte de cerere: fereastra dintre
    // revenirea în prim-plan și tap-ul pe văl e mică, dar tot există.
    const disponibilAcum = await verificaDisponibilitatea();
    if (!disponibilAcum) {
      setBlocat(false);
      return;
    }
    try {
      const rezultat = await LocalAuthentication.authenticateAsync({
        promptMessage: "Deblocați Administrativo",
        cancelLabel: "Anulează",
      });
      if (rezultat.success) setBlocat(false);
      // La eșec (deget greșit, anulare, timeout) nu facem nimic altceva:
      // vălul rămâne, iar butonul e tot acolo pentru o nouă încercare.
    } catch {
      // Eroare nativă neașteptată — omul rămâne în spatele vălului și poate
      // atinge din nou; nu blocăm nimic definitiv, nu prăbușim aplicația.
    }
  }, [verificaDisponibilitatea]);

  return (
    <View style={stiluri.plin}>
      {copil}
      {blocat ? (
        <Pressable style={stiluri.valul} onPress={() => void deblocheaza()}>
          <Text style={stiluri.text}>Atingeți pentru a debloca</Text>
          <Text style={stiluri.subtext}>Confirmați cu amprenta sau Face ID</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const stiluri = StyleSheet.create({
  plin: { flex: 1 },
  valul: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0f1e3d",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  text: { color: "#faf7f0", fontSize: 17, fontWeight: "600" },
  subtext: { color: "#faf7f0", fontSize: 14, opacity: 0.8 },
});
