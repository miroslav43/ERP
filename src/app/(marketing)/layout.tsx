// src/app/(marketing)/layout.tsx
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RUTA_AUTENTIFICARE } from "@/config/routes";
export const metadata: Metadata = {
  title: {
    default: "Administrativo — ERP pentru firme mici și mijlocii din România",
    template: "%s · Administrativo",
  },
  description:
    "Administrativo este un ERP pentru IMM-uri din România: organizații, echipă, roluri și module activate exact pe nevoia firmei tale.",
};

const LINKURI_PRODUS = [
  { href: "/#module", eticheta: "Module" },
  { href: "/#incredere", eticheta: "Date și securitate" },
  { href: "/#pasi", eticheta: "Cum începi" },
] as const;

const LINKURI_LEGALE = [
  { href: "/legal/termeni", eticheta: "Termeni și condiții" },
  { href: "/legal/confidentialitate", eticheta: "Politica de confidențialitate" },
] as const;

const FOCUS =
  "   focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function LayoutMarketing({ children }: { children: ReactNode }) {
  const anCurent = new Date().getFullYear();

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <a
        href="#continut"
        className={`focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:px-4 focus:py-2 ${FOCUS}`}
      >
        Sari la conținutul principal
      </a>

      <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className={`flex items-center gap-2.5 rounded-md ${FOCUS}`}
            aria-label="Administrativo — pagina principală"
          >
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold"
            >
              A
            </span>
            <span className="text-base font-semibold tracking-tight">Administrativo</span>
          </Link>

          <nav aria-label="Navigare principală" className="hidden items-center gap-7 md:flex">
            {LINKURI_PRODUS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-muted-foreground hover:text-foreground rounded-md text-sm transition-colors ${FOCUS}`}
              >
                {link.eticheta}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href={RUTA_AUTENTIFICARE}
              className={`text-foreground hover:text-primary rounded-md px-3 py-2 text-sm font-medium transition-colors ${FOCUS}`}
            >
              Autentificare
            </Link>
            <Link
              href="/cere-demo"
              className={`bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium transition-colors ${FOCUS}`}
            >
              Cere demo
            </Link>
          </div>
        </div>
      </header>

      <main id="continut" tabIndex={-1} className="flex-1">
        {children}
      </main>

      <footer className="border-border bg-surface border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div className="max-w-sm">
            <p className="text-base font-semibold tracking-tight">Administrativo</p>
            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
              Administrare de firmă pentru IMM-uri din România. Fiecare organizație are propriul
              spațiu de date, propriile roluri și doar modulele de care are nevoie.
            </p>
          </div>

          <nav aria-label="Produs">
            <h2 className="text-sm font-semibold">Produs</h2>
            <ul className="mt-3 space-y-2">
              {LINKURI_PRODUS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={`text-muted-foreground hover:text-foreground rounded-md text-sm transition-colors ${FOCUS}`}
                  >
                    {link.eticheta}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/cere-demo"
                  className={`text-muted-foreground hover:text-foreground rounded-md text-sm transition-colors ${FOCUS}`}
                >
                  Cere demo
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Informații legale">
            <h2 className="text-sm font-semibold">Legal</h2>
            <ul className="mt-3 space-y-2">
              {LINKURI_LEGALE.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`text-muted-foreground hover:text-foreground rounded-md text-sm transition-colors ${FOCUS}`}
                  >
                    {link.eticheta}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="border-border border-t">
          <p className="text-muted-foreground mx-auto w-full max-w-6xl px-4 py-6 text-xs sm:px-6">
            © {anCurent} Administrativo. Toate drepturile rezervate.
          </p>
        </div>
      </footer>
    </div>
  );
}
