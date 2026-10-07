import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Sigla } from "@/components/sigla";
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
      {/*
        Ieșirea din demonstrație. Gândită pentru un `<iframe>`, pagina n-avea
        niciun `<a>`, dar azi se deschide direct, din pagina de start („Încearcă
        ecranul, fără cont") — iar vizitatorul care a încercat-o nu mai avea
        unde să meargă (auditul din 7 oct 2026). Stă în LAYOUT, nu în pagină:
        `error.tsx` înlocuiește doar pagina, deci bara rămâne și peste o eroare.
      */}
      <header className="border-border flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Administrativo, pagina de start" className="text-foreground">
          <Sigla clasa="block h-4 w-auto" />
        </Link>
        <nav aria-label="Ieșirea din demonstrație" className="flex items-center gap-5 text-sm">
          <Link href="/module" className="underline underline-offset-4">
            Toate modulele
          </Link>
          <Link
            href="/inregistrare"
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-medium"
          >
            Creează cont
          </Link>
        </nav>
      </header>
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
