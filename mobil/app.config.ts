import type { ExpoConfig } from "expo/config";

/**
 * URL-ul portalului e singura valoare care se schimbă între medii. Nu se scrie
 * literal în App.tsx: la trecerea pe subdomenii per firmă, aici e locul unde se
 * schimbă, o dată.
 */
const URL_PORTAL = process.env.URL_PORTAL ?? "https://administrativo.ro/portal";

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
    adaptiveIcon: { foregroundImage: "./assets/icon.png", backgroundColor: "#0f1e3d" },
    permissions: ["CAMERA", "USE_BIOMETRIC", "POST_NOTIFICATIONS"],
  },
  // `expo-file-system`, `expo-print`, `expo-sharing`, `expo-device`,
  // `expo-constants` și `expo-linking` NU apar aici, deliberat: fiecare își
  // aduce singur, prin AndroidManifest.xml propriu (merge automat la
  // `prebuild`, verificat în `node_modules/<pachet>/android/.../AndroidManifest.xml`),
  // tot ce-i trebuie — INTERNET și un FileProvider la `expo-file-system`,
  // FileProvider + intent SEND la `expo-sharing`, nimic la `expo-print`/
  // `expo-device`/`expo-constants`. Niciunul n-are `ios.infoPlist` de scris
  // (nu ating camera rolă foto, nu cer bibliotecă media), deci n-au ce
  // configura prin `plugins`. `salveazaPdf` (fisiere.ts) scrie doar în
  // `FileSystem.cacheDirectory` — director privat al aplicației — nu are
  // nevoie de READ/WRITE_EXTERNAL_STORAGE.
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
