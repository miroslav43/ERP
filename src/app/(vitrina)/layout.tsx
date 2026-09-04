import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ZonaToast } from "@/components/ui/toast";
import { monoCifre } from "@/lib/ui/fonturi";

/**
 * Documentul demonstrațiilor.
 *
 * ── DE CE UN DOCUMENT PROPRIU, NU O BUCATĂ DIN PAGINA DE MARKETING ────────
 * Randat direct în `/module/<cheie>`, demo-ul ar fi moștenit cinci lucruri
 * greșite deodată, toate tăcute:
 *
 *   1. `monoCifre` NU e montat în `(marketing)` — cifrele ar fi căzut pe stiva
 *      de sistem, adică alt desen al lui 1 și 7 exact acolo unde promitem
 *      fidelitate;
 *   2. `.mk :focus-visible` ar fi repictat inelul de focus în cerneala sitului;
 *   3. `.mk input:-webkit-autofill` ar fi pictat câmpurile cu hârtia rece;
 *   4. regula de 16px pe atingere e legată de `[data-zona]`, absent acolo, deci
 *      iOS Safari ar fi mărit pagina la fiecare atingere;
 *   5. bundle-ul ar fi intrat în cele nouăsprezece pagini prerandate static,
 *      care azi n-au nicio linie de JavaScript propriu.
 *
 * Un `<iframe>` același origin le rezolvă pe toate cinci, și în plus păstrează
 * starea-din-URL funcțională ÎNĂUNTRU: filele, luna și sortarea sunt `<Link>`
 * și `<form method="get">`, iar montate în pagina de marketing ar fi navigat în
 * AFARA demonstrației, spre o rută protejată.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LayoutVitrina({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${monoCifre.variable} bg-background text-foreground min-h-dvh`}
      data-zona="vitrina"
    >
      {children}
      {/*
        `Formular` (`@/components/ui/formular.tsx:108`) predă mesajul de
        reușită printr-un TOAST, nu printr-un text randat de el însuși.
        `ZonaToast` e montată azi doar în `(app)` și `(portal)` — fără ea aici,
        vizitatorul apasă „Trimite” pe formularul demo, cererea intră în
        `sessionStorage`, și ecranul nu spune nimic.
      */}
      <ZonaToast />
    </div>
  );
}
