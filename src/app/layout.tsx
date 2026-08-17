import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Subsetul `latin-ext` este obligatoriu, nu opțional.
 *
 * Româna corectă folosește ș și ț cu VIRGULĂ dedesubt (U+0219, U+021B), nu cu
 * sedilă (ş, ţ — U+015F, U+0163, care aparțin alfabetului turc). Fără
 * `latin-ext`, browserul cade pe un font de rezervă exact pentru aceste litere,
 * iar textul apare cu grosimi amestecate în mijlocul cuvintelor.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Administrativo",
    template: "%s · Administrativo",
  },
  description:
    "Sistem de administrare a personalului pentru firme din România: pontaj, concedii, salarii, SSM, flotă și inventar.",
};

export const viewport: Viewport = {
  themeColor: "#0F1E3D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
