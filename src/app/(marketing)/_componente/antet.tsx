import Link from "next/link";

import { RUTA_AUTENTIFICARE } from "@/config/routes";
import type { ContinutLanding } from "@/content/landing/tipuri";

import { Marca } from "./marca";

/**
 * Antetul.
 *
 * Meniul de pe ecran mic e un `<details>` nativ: se deschide fără JavaScript, e
 * navigabil de la tastatură din construcție și nu cere nicio stare de client.
 * Butonul „Autentificare" e SINGURUL element navy de pe toată pagina — ușa,
 * vopsită în culoarea camerei în care duce.
 */
export function Antet({ text, acasa }: { text: ContinutLanding; acasa: string }) {
  const navigare = text.antet.navigare;

  return (
    <header className="border-mk-rigla bg-mk-hartie/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="max-w-mk mx-auto flex h-16 w-full items-center justify-between gap-4 px-[clamp(1rem,4vw,2.5rem)]">
        <Link
          href={acasa}
          className="flex items-center gap-2.5"
          aria-label={`Administrativo — ${text.limba === "ro" ? "pagina principală" : "home"}`}
        >
          <Marca clasa="h-6 w-6" />
          <span className="font-mk-display text-[1.0625rem] font-semibold tracking-[-0.01em]">
            Administrativo
          </span>
        </Link>

        <nav
          aria-label={text.limba === "ro" ? "Navigare principală" : "Main navigation"}
          className="hidden items-center gap-7 lg:flex"
        >
          {navigare.map((legatura) => (
            <a
              key={legatura.href}
              href={legatura.href}
              className="hover:text-mk-text-slab text-[0.875rem] transition-colors"
            >
              {legatura.eticheta}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={text.cealaltaLimba.href}
            className="font-mk-date text-mk-text-slab hover:text-mk-text px-1 text-[0.6875rem] tracking-[0.14em] uppercase transition-colors"
          >
            {text.cealaltaLimba.eticheta}
          </Link>
          <Link
            href={RUTA_AUTENTIFICARE}
            className="bg-mk-usa text-mk-usa-text hidden h-10 items-center rounded px-4 text-[0.9375rem] font-medium transition-opacity hover:opacity-90 sm:inline-flex"
          >
            {text.antet.autentificare}
          </Link>
          <Link
            href={text.hero.ctaPrimar.href}
            className="bg-mk-cerneala text-mk-text-inv hidden h-10 items-center rounded px-4 text-[0.9375rem] font-medium transition-opacity hover:opacity-90 md:inline-flex"
          >
            {text.antet.demo}
          </Link>

          <details className="relative lg:hidden">
            <summary className="border-mk-rigla font-mk-date flex h-10 cursor-pointer list-none items-center rounded border px-3 text-[0.6875rem] tracking-[0.14em] uppercase">
              {text.antet.meniu}
            </summary>
            <div className="border-mk-rigla bg-mk-hartie absolute top-12 right-0 z-50 w-64 border p-4 shadow-lg">
              <nav aria-label={text.antet.meniu}>
                <ul className="space-y-3">
                  {navigare.map((legatura) => (
                    <li key={legatura.href}>
                      <a href={legatura.href} className="block text-[0.9375rem]">
                        {legatura.eticheta}
                      </a>
                    </li>
                  ))}
                  <li className="border-mk-rigla/40 border-t pt-3">
                    <Link href={RUTA_AUTENTIFICARE} className="block text-[0.9375rem] font-medium">
                      {text.antet.autentificare}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={text.hero.ctaPrimar.href}
                      className="block text-[0.9375rem] font-medium"
                    >
                      {text.antet.demo}
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
