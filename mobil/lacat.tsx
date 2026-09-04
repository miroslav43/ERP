import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Cât așteptăm `hasHardwareAsync`/`isEnrolledAsync` înainte să presupunem că
 * n-o să răspundă niciodată — vezi comentariul din `verificaDisponibilitatea`.
 */
const TIMP_LIMITA_VERIFICARE_MS = 4000;

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
 *    „BACKGROUND" REAL (a doua reparație de la aceeași revizuire — declarată
 *    mai precis la runda 2, vezi cele două paragrafe de mai jos) ───────────
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
 * DOUĂ LIMITĂRI REALE ALE ACOPERIRII DE MAI SUS — declarate exact, nu doar
 * „nu putem închide fereastra" (rundă 2 de revizuire, ambele verificate în
 * sursă, nu presupuse):
 *
 * 1. PE ANDROID, „inactive" NU EXISTĂ. `AppStateModule.kt` (React Native
 *    instalat) definește exact două stări — `APP_STATE_ACTIVE = "active"` și
 *    `APP_STATE_BACKGROUND = "background"` — `onHostPause()` trece direct pe
 *    `"background"`, fără nicio stare intermediară. Condiția
 *    `stare === "inactive" || stare === "background"` de mai jos e deci, pe
 *    Android, echivalentă cu `stare === "background"`: acoperirea suplimentară
 *    n-are efect acolo. Miniatura din „Recente" pe Android rămâne apărată
 *    DOAR de `setBlocat(true)` din ramura „background" de mai jos — un
 *    `setState` React simplu, declanșat direct de `onHostPause()`, FĂRĂ
 *    tranziția intermediară „inactive" pe care se bazează punctul 2 de mai
 *    jos (ăla e specific iOS: `applicationWillResignActive:`, care Android
 *    n-o are). Nu e aceeași cursă — corectare de exactitate, rundă 3 de
 *    revizuire, care greșise citând punctul 2 aici.
 * 2. CHIAR ȘI PE iOS, acoperirea pe „inactive" MĂREȘTE fereastra de risc, nu
 *    o ÎNCHIDE determinist. Vălul se desenează printr-un `setState` React,
 *    livrat spre partea nativă prin puntea JSI — asincron. Instantaneul
 *    pentru cardul din switcher se face pe firul principal, imediat în jurul
 *    lui `applicationWillResignActive:`/`applicationDidEnterBackground:`. Nu
 *    există nicio garanție că randarea vălului apucă să se termine ÎNAINTE
 *    ca sistemul să facă instantaneul — e o cursă ATENUATĂ (fereastra de
 *    expunere s-a micșorat față de „doar pe background"), nu o reparație
 *    determinist corectă. Nedovedit dacă pierde vreodată cursa asta pe un
 *    telefon real — vezi „Ce rămâne de probat".
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
  // Contor de generație — reparație rundă 3 de revizuire (mărunțiș semnalat
  // de revizor): `verificaDisponibilitatea` poate expira (la timeout) exact
  // CĂLARE PE o tranziție de `AppState` mai nouă. Fără marcaj, o verificare
  // VECHE ar rezolva DUPĂ ce tranziția nouă a pus deja starea corectă — iar
  // fiindcă răspunsul ei ar fi `false` (timeout, nu un refuz real), ar ȘTERGE
  // `necesitaAutentificare`/`blocat` peste starea corectă abia pusă, lăsând
  // conținutul vizibil fără văl la revenire. Incrementat la ÎNCEPUTUL
  // fiecărui eveniment `AppState` ȘI la începutul fiecărei `deblocheaza()` —
  // orice verificare pornită înaintea celei mai recente tranziții/tap își
  // ignoră singură rezultatul, oricând ar veni el.
  const generatie = useRef(0);

  const verificaDisponibilitatea = useCallback(async () => {
    try {
      // `Promise.race` cu un timeout — reparație rundă 2 de revizuire.
      // `try/catch` de mai jos prindea deja o interogare care ARUNCĂ, dar nu
      // și una care nu se termină NICIODATĂ: `blocat` pornește `null`
      // (vezi mai sus) și rămâne `null` la infinit dacă promisiunea asta nu
      // se decide — ecran navy plin, fără text, cu `Pressable` dezactivat
      // (`disabled={blocat !== true}`), deci `deblocheaza` nici nu poate fi
      // apelat manual. Restart-ul ar reintra pe exact aceeași cale
      // nedeterminată. Impact maxim, probabilitate mică — dar „PIN-ul
      // telefonului deblochează întotdeauna" (mai sus) NU acoperă starea
      // asta: promisiunea aia trăiește în `authenticateAsync`, la care nu se
      // ajunge niciodată din `null`. La expirarea temporizatorului tratăm ca
      // „indisponibil" — consecventă cu „fără biometrie, fără lacăt": în
      // incertitudine, alegem să NU blocăm omul definitiv afară.
      let idTemporizator: ReturnType<typeof setTimeout> | null = null;
      const rezultat = await Promise.race([
        (async () => {
          const are = await LocalAuthentication.hasHardwareAsync();
          return are ? await LocalAuthentication.isEnrolledAsync() : false;
        })(),
        new Promise<boolean>((rezolva) => {
          idTemporizator = setTimeout(() => rezolva(false), TIMP_LIMITA_VERIFICARE_MS);
        }),
      ]);
      // Curățenie — mărunțiș semnalat de revizor: fără asta, temporizatorul
      // tot pornește chiar dacă interogarea reală câștigă cursa, și rămâne
      // programat degeaba (efect zero, dar murdărie).
      if (idTemporizator !== null) clearTimeout(idTemporizator);
      disponibil.current = rezultat;
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
      // Orice tranziție invalidează o verificare mai veche încă în zbor —
      // vezi comentariul de la `generatie`, sus.
      generatie.current += 1;
      const generatieLaEveniment = generatie.current;
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
          if (generatie.current !== generatieLaEveniment) return; // vezi „generatie", sus
          if (!disp) {
            setBlocat(false);
            necesitaAutentificare.current = false;
            return;
          }
          if (necesitaAutentificare.current) {
            // O trecere reală în fundal a avut loc ȘI biometria e
            // disponibilă ACUM — vălul trebuie să fie sus, indiferent ce
            // era pus la momentul lui „background". Reparație rundă 2 de
            // revizuire: până acum, ramura asta nu făcea NIMIC — presupunea
            // că `blocat` era deja `true` de la „background". Fals dacă
            // biometria nu era disponibilă ATUNCI (deci `setBlocat(true)`
            // nu se apucase să ruleze) și a devenit disponibilă exact cât
            // aplicația era în fundal (înrolată din Setări) — omul revenea
            // direct în portal, fără văl, la prima întoarcere după înrolare.
            setBlocat(true);
          } else {
            // Am acoperit ecranul doar pentru o tranziție scurtă prin
            // „inactive" — n-a existat niciodată o trecere reală în fundal,
            // deci nu cerem biometrie.
            setBlocat(false);
          }
        });
      }
    });
    return () => abonament.remove();
  }, [verificaDisponibilitatea]);

  const deblocheaza = useCallback(async () => {
    if (autentificareInCurs.current) return;
    autentificareInCurs.current = true;
    // Un tap e tot o „tranziție" din perspectiva `generatie` — invalidează o
    // verificare de fundal încă în zbor, și se auto-invalidează dacă
    // aplicația trece în fundal CÂT dialogul nativ de autentificare e pe
    // ecran (rar, dar posibil): în cazul ăla nu vrem ca un succes întârziat
    // să ridice vălul peste o trecere în fundal mai nouă, care CERE din nou
    // autentificare.
    generatie.current += 1;
    const generatieLaTap = generatie.current;
    try {
      // A doua reverificare, chiar înainte de cerere: fereastra dintre
      // revenirea în prim-plan și tap-ul pe văl e mică, dar tot există.
      const disponibilAcum = await verificaDisponibilitatea();
      if (generatie.current !== generatieLaTap) return; // vezi „generatie", sus
      if (!disponibilAcum) {
        setBlocat(false);
        necesitaAutentificare.current = false;
        return;
      }
      const rezultat = await LocalAuthentication.authenticateAsync({
        promptMessage: "Deblocați Administrativo",
        cancelLabel: "Anulează",
      });
      if (generatie.current !== generatieLaTap) return; // idem, verificat din nou după autentificare
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
