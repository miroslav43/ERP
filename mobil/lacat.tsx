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
 * ── PORNIREA LA RECE SE BLOCHEAZĂ ȘI EA (reparație rundă 1 de revizuire) ────
 * Prima formă a acestui fișier pornea `blocat` pe `false` — deci repornirea
 * completă a aplicației (scoasă din switcher, redeschisă) ocolea lacătul în
 * întregime: cine ținea telefonul vedea portalul întreg, fără nicio
 * biometrie. Nu era un caz-limită, era prima mișcare a oricui vrea să
 * ocolească un ecran de deblocare — și contrazicea direct textul din
 * `app.config.ts` despre motivul pentru care Face ID există aici.
 *
 * `blocat` pornește acum NEDETERMINAT (`null`), nu `false`. Cât e
 * nedeterminat, ecranul rămâne acoperit — fără text de acțiune, ca să nu
 * clipească portalul înainte să știm dacă lacătul chiar se aplică — până se
 * termină prima verificare de hardware. Verificarea îl fixează pe `true`
 * (dacă biometria e disponibilă — omul trebuie să se autentifice) sau
 * `false` (altfel — ecranul se descoperă direct, ca înainte).
 *
 * ── DE CE ASTA NU MAI ARE NEVOIE DE O „PORTIȚĂ DE SIGURANȚĂ" ────────────────
 * Varianta anterioară ținea repornirea drept supapă: „dacă biometria se
 * strică, omul tot poate ieși închizând aplicația". Motivul nu mai e nevoie:
 * `authenticateAsync` de mai jos NU dezactivează fallback-ul pe PIN-ul
 * telefonului (`disableDeviceFallback` rămâne `false`) — iOS evaluează
 * `LAPolicy.deviceOwnerAuthentication` (nu doar biometria), iar Android
 * adaugă `DEVICE_CREDENTIAL` la autentificatorii acceptați (verificat direct
 * în sursa modulului instalat: `LocalAuthenticationModule.swift:87`,
 * `LocalAuthenticationModule.kt:209-212`). PIN-ul telefonului deblochează
 * întotdeauna — nu există nicio fundătură biometrică din care omul să aibă
 * nevoie să scape prin repornire.
 *
 * ── CE SE ÎNTÂMPLĂ DACĂ BIOMETRIA DISPARE CÂT APLICAȚIA E ÎN FUNDAL ─────────
 * Omul poate dezactiva amprenta din Setările telefonului exact cât aplicația
 * stă blocată în fundal. Dacă am cere atunci o autentificare imposibilă, omul
 * ar rămâne închis definitiv în afara propriei aplicații. De-aia
 * disponibilitatea se REVERIFICĂ, nu doar la pornire: o dată la fiecare
 * revenire în prim-plan (`stare === "active"`, mai jos) și încă o dată chiar
 * înainte de a cere autentificarea (`deblocheaza`). Dacă biometria nu mai e
 * disponibilă în niciunul din aceste momente, vălul se ridică fără nicio
 * cerere de autentificare.
 *
 * ── VĂLUL APARE ȘI PE „INACTIVE", DAR AUTENTIFICAREA SE CERE DOAR DUPĂ UN
 *    „BACKGROUND" REAL (a doua reparație de la aceeași revizuire) ──────────
 * Pe iOS, `AppState` trece prin „inactive" ÎNAINTEA lui „background" — iar
 * instantaneul folosit la cardul din switcher se face în jurul acelei
 * tranziții. Dacă am acoperi ecranul abia la „background", instantaneul ar
 * prinde portalul nemascat (fluturașul, dacă acolo era omul). De-aia vălul
 * se desenează și pe „inactive" — dar `necesitaAutentificare` (ref, mai jos)
 * devine `true` DOAR la „background". Un apel primit sau Control Center trec
 * prin „inactive" fără să ajungă niciodată la „background" (dacă omul nu
 * chiar părăsește aplicația) — la revenire, vălul dispare SINGUR, fără să
 * ceară biometrie, ca să nu transforme orice notificare într-o
 * reautentificare.
 *
 * ── PORTIȚA DE SIGURANȚĂ, DACĂ TOT CE-I MAI SUS AR DA GREȘ ──────────────────
 * `blocat` e stare React simplă, ținută doar în memorie — niciodată scrisă pe
 * disc. Chiar dacă un bug neprevăzut ar bloca fluxul de mai sus, PIN-ul
 * telefonului (vezi mai sus) rămâne calea garantată de ieșire — nu repornirea
 * aplicației.
 */
export function Lacat({ copil }: { readonly copil: React.ReactNode }) {
  // `null` = încă nedeterminat (verificarea de hardware n-a terminat).
  // `true` = vălul e desenat. `false` = descoperit.
  const [blocat, setBlocat] = useState<boolean | null>(null);
  // Ultima disponibilitate cunoscută. Ref, nu stare: nu are nevoie să
  // redeseneze nimic — e citită doar în reacție la evenimente (schimbare de
  // `AppState`, tap pe văl), niciodată direct în JSX.
  const disponibil = useRef(false);
  // Dacă vălul curent CERE autentificare ca să se ridice (trecere reală în
  // fundal) sau doar acoperă temporar un „inactive" care s-ar putea termina
  // fără să fi părăsit niciodată aplicația. Pornește `true`: la pornirea la
  // rece, dacă biometria e disponibilă, se cere autentificare reală — vezi
  // comentariul de sus.
  const necesitaAutentificare = useRef(true);
  // Gardă de reintrare pentru `deblocheaza`: un al doilea tap cât prima
  // verificare/autentificare e încă în zbor nu trebuie să deschidă un al
  // doilea dialog nativ. Se eliberează pe SINGURA cale de ieșire —
  // `finally`, mai jos — indiferent de succes, eșec sau eroare.
  const autentificareInCurs = useRef(false);

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
    void verificaDisponibilitatea().then((disp) => setBlocat(disp));
  }, [verificaDisponibilitatea]);

  useEffect(() => {
    const abonament = AppState.addEventListener("change", (stare) => {
      if (stare === "inactive" || stare === "background") {
        // Acoperim la AMBELE tranziții — vezi comentariul de sus despre
        // instantaneul din switcher — dar cerem autentificare doar la o
        // trecere reală în fundal.
        if (disponibil.current) setBlocat(true);
        if (stare === "background") necesitaAutentificare.current = true;
        return;
      }
      if (stare === "active") {
        void verificaDisponibilitatea().then((disp) => {
          if (!disp) {
            setBlocat(false);
            necesitaAutentificare.current = false;
            return;
          }
          if (!necesitaAutentificare.current) {
            // Am acoperit ecranul doar pentru o tranziție scurtă prin
            // „inactive" — n-a existat niciodată o trecere reală în fundal,
            // deci nu cerem biometrie.
            setBlocat(false);
          }
          // Altfel vălul rămâne, cu text de acțiune, așteptând tap + autentificare.
        });
      }
    });
    return () => abonament.remove();
  }, [verificaDisponibilitatea]);

  const deblocheaza = useCallback(async () => {
    if (autentificareInCurs.current) return;
    autentificareInCurs.current = true;
    try {
      // A doua reverificare, chiar înainte de cerere: fereastra dintre
      // revenirea în prim-plan și tap-ul pe văl e mică, dar tot există.
      const disponibilAcum = await verificaDisponibilitatea();
      if (!disponibilAcum) {
        setBlocat(false);
        necesitaAutentificare.current = false;
        return;
      }
      const rezultat = await LocalAuthentication.authenticateAsync({
        promptMessage: "Deblocați Administrativo",
        cancelLabel: "Anulează",
      });
      if (rezultat.success) {
        setBlocat(false);
        necesitaAutentificare.current = false;
      }
      // La eșec (deget greșit, anulare, timeout) nu facem nimic altceva:
      // vălul rămâne, iar butonul e tot acolo pentru o nouă încercare. Dacă
      // biometria e blocată temporar (prea multe eșecuri), fallback-ul pe
      // PIN descris mai sus preia automat, fără cod suplimentar aici.
    } catch {
      // Eroare nativă neașteptată — omul rămâne în spatele vălului și poate
      // atinge din nou; nu blocăm nimic definitiv, nu prăbușim aplicația.
    } finally {
      autentificareInCurs.current = false;
    }
  }, [verificaDisponibilitatea]);

  return (
    <View style={stiluri.plin}>
      {copil}
      {blocat === false ? null : (
        <Pressable
          style={stiluri.valul}
          disabled={blocat !== true}
          onPress={() => void deblocheaza()}
        >
          {blocat === true ? (
            <>
              <Text style={stiluri.text}>Atingeți pentru a debloca</Text>
              <Text style={stiluri.subtext}>Confirmați cu amprenta sau Face ID</Text>
            </>
          ) : null}
        </Pressable>
      )}
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
