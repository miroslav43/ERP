// src/app/(onboarding)/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Zona de înrolare e vizibilă doar cu sesiune validă și nu are conținut public.
 * `noindex` din același motiv ca în `(auth)`, și pe layout din același motiv:
 * metadata se moștenește, deci o pagină nouă e acoperită fără să ceară nimănui
 * să-și amintească.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Shell-ul zonei de înrolare: cele două ecrane pe care le vede cineva care
 * tocmai a primit acces, dar a cărui firmă nu e încă utilizabilă.
 *
 * ── DE CE N-A EXISTAT PÂNĂ ACUM ───────────────────────────────────────────
 * Grupul `(onboarding)` era singurul din produs FĂRĂ layout propriu, iar cele
 * două pagini își randau fiecare propriul `<main>` cu propria lățime și
 * propriul padding. Consecințele nu se vedeau la citirea codului:
 *
 *   · nicio scurtătură „Sari la conținut" — pe cel mai lung formular din
 *     produs, cine navighează cu tastatura parcurgea totul de sus;
 *   · niciun `data-zona`, deci regula `@media (pointer: coarse)` din
 *     `globals.css` nu se aplica. Sub 16px, iOS Safari MĂREȘTE pagina la
 *     fiecare atingere într-un câmp și n-o micșorează la loc. Formularul de
 *     înrolare se completează des de pe telefon: e primul lucru pe care îl
 *     face cineva după ce primește invitația;
 *   · două lățimi maxime scrise în două pagini, fiecare regăsibilă doar acolo.
 *
 * ── DE CE RĂMÂNE CREM, CA `(auth)` ────────────────────────────────────────
 * Navy-ul e semnalul „ești înăuntru, într-o firmă care funcționează". Aici
 * firma încă nu funcționează — chiar ecranul de aici o face să funcționeze.
 * Culoarea spune adevărul despre starea în care ești.
 *
 * ── DE CE NU SE ÎNCARCĂ FONTUL DE CIFRE ───────────────────────────────────
 * `(app)`, `(portal)` și `(platform)` montează `monoCifre`. Aici nu apare
 * niciun `font-mono` — verificat, nu presupus — iar `next/font` descarcă
 * fișierul din clipa în care variabila e pusă pe un element. Un font nefolosit
 * pe primul ecran văzut vreodată de un client nou e exact costul care nu
 * trebuie plătit. Când apare primul `font-mono` aici, se adaugă atunci.
 */
export default function LayoutInrolare({ children }: { children: ReactNode }) {
  return (
    <div data-zona="inrolare" className="flex min-h-dvh flex-col">
      {/* Aceeași formă ca în `(app)`, `(portal)` și `(auth)`: o singură variantă
          a scurtăturii în tot produsul. */}
      <a
        href="#continut"
        className="bg-primary text-primary-foreground rounded-control focus:z-plutitor text-corp sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:px-3 focus:py-2"
      >
        Sari la conținut
      </a>

      {/* Lățimea aparține ZONEI, nu paginii. Ecranul de așteptare își strânge
          singur conținutul mai mult; asistentul folosește toată lățimea. */}
      <main id="continut" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
