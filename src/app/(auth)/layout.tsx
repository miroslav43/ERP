// src/app/(auth)/layout.tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Niciun ecran de autentificare nu are ce căuta într-un index de căutare.
 *
 * Cel mai neplăcut e `/invitatie/[token]`: URL-uri care poartă un token de acces
 * pot ajunge în index dacă cineva le lipește undeva public. Regula stă pe layout,
 * nu pe cele cinci pagini, fiindcă metadata se moștenește — o pagină nouă în
 * `(auth)` e protejată din clipa în care e creată, fără să-și amintească cineva.
 *
 * `noindex`, NU `Disallow` în robots.txt. O cale interzisă în robots.txt nu poate
 * fi citită, deci robotul nu ajunge niciodată să vadă `noindex`, iar URL-ul poate
 * rămâne în index fără conținut. Ca să scoți ceva din index, trebuie să-l lași să
 * intre.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Shell-ul ecranelor publice de autentificare. Sobru și îngust: singura sarcină
 * a acestor pagini este să ducă utilizatorul într-o sesiune validă.
 *
 * ── DE CE RĂMÂNE CREM ─────────────────────────────────────────────────────
 * Învelișul de firmă a devenit navy, dar zona asta NU-l urmează. Navy-ul e
 * semnalul „ești înăuntru, într-o firmă anume"; aici încă nu s-a ales nicio
 * firmă — `alege-organizatia` e chiar ecranul care o alege. Singurul navy de
 * pe aceste cinci ecrane e butonul principal, adică acțiunea care te duce
 * înăuntru.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    /*
      `data-zona="auth"` există pentru regula `@media (pointer: coarse)` din
      `globals.css`, care ridică la 16px `font-size`-ul câmpurilor: sub pragul
      ăsta, iOS Safari MĂREȘTE pagina la fiecare atingere într-un câmp și nu o
      micșorează la loc. Regula era legată doar de `[data-zona="portal"]`, deși
      ecranele de autentificare se completează de pe telefon mai des decât
      orice altceva din produs; selectorul e acum `[data-zona]`, deci prinde
      toate zonele care poartă atributul — și numai ele, ca `(marketing)`, cu
      geometria lui proprie, să rămână în afară.

      Câmpurile poartă în plus `pointer-coarse:text-sectiune`, deliberat redundant:
      spune același lucru la nivel de element, deci un ecran care ar ajunge
      vreodată în afara unei zone nu regresează tăcut. Vezi și
      `pointer-coarse:text-sectiune` pe `CLASA_CAMP` din fiecare ecran. Când
      selectorul primește și `auth`, cele două spun același lucru și nu se
      contrazic.
    */
    <div
      data-zona="auth"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
    >
      {/*
        Zona asta era singura fără „Sari la conținut" și fără `id="continut"` pe
        landmark — `(app)` și `(portal)` le au pe amândouă. Forma e copiată din
        `(app)/layout.tsx`, ca să nu existe două variante ale aceleiași scurtături.
      */}
      <a
        href="#continut"
        className="bg-primary text-primary-foreground rounded-control focus:z-plutitor text-corp sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:px-3 focus:py-2"
      >
        Sari la conținut
      </a>

      {/* `max-w-lg`, nu `max-w-md`: ecranul de alegere a firmei e o LISTĂ, nu un
          formular, iar la 28rem numele lungi de societăți se rupeau pe două
          rânduri. Lățimea aparține zonei, nu paginii — altfel fiecare ecran o
          cere din nou și se ajunge la patru valori. */}
      <main id="continut" className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <Link href="/" className="text-primary text-titlu rounded font-semibold tracking-tight">
            Administrativo
          </Link>
          <p className="text-muted-foreground text-corp mt-1">
            Administrarea personalului, într-un singur loc.
          </p>
        </div>

        <div className="bg-surface border-border rounded-panou shadow-ridicat border p-6 sm:p-8">
          {children}
        </div>

        <p className="text-muted-foreground text-nota mt-6 text-center text-balance">
          Angajații intră pe invitație, de la administratorul firmei lor. Dacă înregistrezi o firmă
          nouă, contul îl creezi singur.
        </p>
      </main>
    </div>
  );
}
