// src/app/(onboarding)/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { deconecteaza } from "@/app/(app)/actions";
import { ButonTrimite } from "@/components/incarcare/buton-trimite";
import { OpresteAnaliticele } from "@/components/layout/opreste-analiticele";
import { Sigla } from "@/components/sigla";
import { CONTACT } from "@/content/landing/contact";

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
 *
 * ── DE CE ȘI AICI `OpresteAnaliticele` ────────────────────────────────────
 * Plasa din `(app)` nu acoperă zona asta: `(app)/layout.tsx` trimite contul
 * fără firmă configurată spre `/bun-venit` printr-un `redirect()` de server,
 * ÎNAINTE să-și randeze propriul `<OpresteAnaliticele />`. Dacă `gtag.js` a
 * supraviețuit unei navigări soft dinspre pagina publică, raportează mai
 * departe. Văzut în GA4, nu presupus: `/bun-venit` apare pe 30 sept 2026, la
 * șase zile după ce reparația din `7f087c9` ajunsese în producție.
 *
 * ── DE CE ARE ANTET, DIN 12 OCT 2026 ──────────────────────────────────────
 * QA (ONB-021): administratorul blocat în asistent n-avea nici ieșire din
 * cont, nici contact. „Deconectare" exista doar pe `/firma-in-configurare`, la
 * care ajungi doar tastând adresa. Antetul stă pe LAYOUT, nu pe o pagină, ca
 * să fie pe amândouă ecranele și pe orice ecran viitor al zonei; ecranul de
 * așteptare și-a pierdut butonul propriu, altfel ar fi apărut de două ori.
 * Legătura de ajutor e un `mailto:` spre singura adresă de contact din cod.
 */
export default function LayoutInrolare({ children }: { children: ReactNode }) {
  return (
    <div data-zona="inrolare" className="flex min-h-dvh flex-col">
      <OpresteAnaliticele />
      {/* Aceeași formă ca în `(app)`, `(portal)` și `(auth)`: o singură variantă
          a scurtăturii în tot produsul. Rămâne ÎNAINTEA antetului: e primul
          element focusabil, altfel scurtătura nu mai scurtează nimic. */}
      <a
        href="#continut"
        className="bg-primary text-primary-foreground rounded-control focus:z-plutitor text-corp sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:px-3 focus:py-2"
      >
        Sari la conținut
      </a>

      <header className="border-border bg-surface border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          {/* Aceeași siglă ca în `(auth)`: omul vine de acolo, iar un nume scris
              altfel ar arăta ca alt produs. Fără legătură spre `/`: pagina
              publică n-are ce să-i ofere cuiva care încă își configurează firma. */}
          <Sigla clasa="text-primary h-[18px] w-auto" eticheta="Administrativo" />
          <nav aria-label="Cont" className="flex items-center gap-4">
            <a
              href={`mailto:${CONTACT.email}`}
              className="text-muted-foreground hover:text-foreground text-corp underline-offset-4 transition hover:underline"
            >
              Ai nevoie de ajutor?
            </a>
            <form action={deconecteaza}>
              {/* `varianta="tertiar"` + clasele proprii: discret, ca pe ecranul
                  de așteptare de unde a venit; se blochează și spune
                  „Se deconectează…" cât timp GoTrue lucrează. */}
              <ButonTrimite
                varianta="tertiar"
                textInCurs="Se deconectează…"
                className="border-border text-muted-foreground hover:bg-background hover:text-foreground rounded-control text-corp flex items-center gap-2 border px-3 py-1.5 font-medium transition"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Deconectare
              </ButonTrimite>
            </form>
          </nav>
        </div>
      </header>

      {/* Lățimea aparține ZONEI, nu paginii. Ecranul de așteptare își strânge
          singur conținutul mai mult; asistentul folosește toată lățimea. */}
      <main id="continut" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        {children}
      </main>
    </div>
  );
}
