import type { ExpoConfig } from "expo/config";

/**
 * URL-ul portalului e singura valoare care se schimbă între medii. Nu se scrie
 * literal în App.tsx: la trecerea pe subdomenii per firmă, aici e locul unde se
 * schimbă, o dată.
 */
const URL_PORTAL = process.env.URL_PORTAL ?? "https://administrativo.ro/portal";

/**
 * `google-services.json` — calea vine din MEDIU, nu e scrisă literal.
 *
 * Fișierul înregistrează aplicația la Firebase, ca `getExpoPushTokenAsync()` să
 * primească vreun jeton pe Android. Fără el, jetonul pur și simplu nu se
 * obține — nicio eroare explicită, doar o cerere care nu ajunge la „ok".
 *
 * DE CE PRIN VARIABILĂ DE MEDIU, ȘI NU O CALE FIXĂ
 * Fișierul e în `mobil/.gitignore`, iar EAS Build încarcă proiectul
 * RESPECTÂND `.gitignore` (în lipsa unui `.easignore`). O cale scrisă fix ar
 * arăta corect local și ar produce pe EAS ori un build căzut, ori — mai rău —
 * un build reușit care nu primește niciodată jeton de push. Tiparul suportat
 * de EAS pentru exact cazul ăsta e o variabilă de mediu de tip „file": EAS
 * scrie fișierul pe mașina de build și pune CALEA lui în variabilă.
 *
 *   eas env:create --name GOOGLE_SERVICES_JSON --type file \
 *     --value ./google-services.json --scope project --visibility secret
 *
 * Local, pentru un `expo prebuild` de probă:
 *   GOOGLE_SERVICES_JSON=./google-services.json npx expo prebuild -p android
 *
 * NESETATĂ, cheia lipsește cu totul din configurare — build-ul trece, iar
 * push-ul pe Android nu funcționează. E starea corectă pentru oricine
 * construiește fără Firebase (iOS, sau doar ca să vadă că se compilează), și
 * `expo-doctor` o semnalează, deci nu e o tăcere totală.
 */
const caleGoogleServices = process.env.GOOGLE_SERVICES_JSON;

const config: ExpoConfig = {
  name: "Administrativo",
  slug: "administrativo",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "administrativo",
  userInterfaceStyle: "automatic",
  backgroundColor: "#faf7f0",
  ios: {
    bundleIdentifier: "ro.administrativo.portal",
    supportsTablet: false,
    infoPlist: {
      // Textele apar în dialogul de permisiune. Formulate pentru un angajat,
      // nu pentru un dezvoltator — magazinele resping textele generice.
      NSCameraUsageDescription:
        "Camera se folosește doar pentru scanarea codului de pontare afișat la punctul de lucru.",
      NSFaceIDUsageDescription:
        "Face ID deblochează aplicația, ca datele dumneavoastră de salariu și pontaj să nu fie vizibile dacă telefonul ajunge în altă mână.",
    },
  },
  android: {
    package: "ro.administrativo.portal",
    ...(caleGoogleServices !== undefined && caleGoogleServices !== ""
      ? { googleServicesFile: caleGoogleServices }
      : {}),
    adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: "#0f1e3d" },
    permissions: ["CAMERA", "USE_BIOMETRIC", "POST_NOTIFICATIONS"],
  },
  // `expo-file-system`, `expo-print`, `expo-sharing`, `expo-device`,
  // `expo-constants`, `expo-linking` și `expo-status-bar` NU apar aici,
  // deliberat: fiecare își aduce singur, prin AndroidManifest.xml propriu
  // (merge automat la `prebuild`, verificat în
  // `node_modules/<pachet>/android/.../AndroidManifest.xml`), tot ce-i
  // trebuie — INTERNET și un FileProvider la `expo-file-system`, FileProvider
  // + intent SEND la `expo-sharing`, nimic la `expo-print`/`expo-device`/
  // `expo-constants`/`expo-status-bar` (manifest gol la toate patru).
  // TREI dintre cele șase AU `app.plugin.js` — `expo-status-bar`,
  // `expo-file-system` și `expo-sharing` — dar toate trei sunt opt-in: nu fac
  // nimic cât nu apar în `plugins`. Verificat în sursa instalată, nu în
  // documentație (corectat la valul de curățenie din 2026-09-04, unde nota
  // veche spunea că „niciunul n-are `ios.infoPlist` de scris" — fals pentru
  // două din ele):
  //
  //   `expo-status-bar` (`withStatusBar.js:resolveProps`) — fără `style` sau
  //     `hidden`, întoarce config-ul neatins. Stilul barei se dă la runtime,
  //     din `App.tsx`.
  //   `expo-file-system` (`withFileSystem.js`) — NELISTAREA LUI E O DECIZIE,
  //     nu o omisiune: listat, adaugă NECONDIȚIONAT
  //     `READ_EXTERNAL_STORAGE` și `WRITE_EXTERNAL_STORAGE` pe Android.
  //     `salveazaPdf` (fisiere.ts) scrie doar în `FileSystem.cacheDirectory` —
  //     director privat al aplicației — deci ar fi două permisiuni cerute
  //     degeaba, exact ce riscă întrebări la revizuirea magazinului. Partea
  //     de iOS scrie `LSSupportsOpeningDocumentsInPlace` /
  //     `UIFileSharingEnabled` doar dacă primește opțiunile.
  //   `expo-sharing` (`withShareExtension.js`) — construiește o EXTENSIE DE
  //     PARTAJARE iOS, cu target Xcode, entitlements și app group. Deci ARE
  //     configurare iOS de scris; e doar dezactivată implicit
  //     (`props?.ios?.enabled ?? false`). Extensia ar face aplicația o
  //     DESTINAȚIE de partajare din alte aplicații — noi vrem opusul: să
  //     trimitem un fluturaș AFARĂ. Nelistat, deliberat.
  //
  // `expo-print`, `expo-device` și `expo-constants` n-au deloc `app.plugin.js`
  // (manifest gol la toate trei).
  plugins: [
    // `recordAudioAndroid: false` + `microphonePermission: false`: implicitul
    // pachetului CERE microfon (permisiune RECORD_AUDIO pe Android,
    // NSMicrophoneUsageDescription pe iOS) pentru filmare — `scanner.tsx`
    // scanează doar coduri QR, nu filmează și nu înregistrează sunet. Fără
    // asta, aplicația ar cere o permisiune nefolosită, cu text generic în
    // engleză (nu textele scrise pentru angajat, ca la cameră/Face ID mai
    // jos) — exact ce riscă respingere la revizuirea magazinului.
    ["expo-camera", { recordAudioAndroid: false, microphonePermission: false }],
    "expo-notifications",
    "expo-local-authentication",
  ],
  extra: { urlPortal: URL_PORTAL, eas: { projectId: "" } },
};

export default config;
