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
  plugins: ["expo-notifications", "expo-camera", "expo-local-authentication"],
  extra: { urlPortal: URL_PORTAL, eas: { projectId: "" } },
};

export default config;
