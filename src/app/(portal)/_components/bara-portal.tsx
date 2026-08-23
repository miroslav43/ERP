"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";

import type { IntrarePortalView } from "@/lib/navigation/build-portal-navigation";

import { ICONITE, IconitaImplicita, esteActiva } from "./iconite";

/**
 * Navigarea portalului pe telefon: bară fixă jos, la degetul mare.
 *
 * Sus, în colț, degetul nu ajunge fără să schimbe priza pe telefon. Jos ajunge
 * fără să miște mâna — de aceea navigarea stă acolo, iar antetul rămâne pentru
 * identitate și notificări.
 *
 * `pb-[env(safe-area-inset-bottom)]` ține bara deasupra indicatorului de gesturi
 * de pe iPhone. A fost multă vreme fără efect: `env()` evaluează 0 până când
 * documentul declară `viewport-fit=cover`, ceea ce `src/app/layout.tsx` nu făcea.
 */
export function BaraPortal({
  primare,
  secundare,
}: {
  readonly primare: readonly IntrarePortalView[];
  readonly secundare: readonly IntrarePortalView[];
}) {
  const cale = usePathname();
  const areMaiMulte = secundare.length > 0;

  return (
    <nav
      aria-label="Navigare portal"
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-2xl">
        {primare.map((intrare) => {
          const activ = esteActiva(cale, intrare.href, intrare.exact);
          const Iconita = ICONITE[intrare.id] ?? IconitaImplicita;
          return (
            <li key={intrare.id} className="flex-1">
              <Link
                href={intrare.href}
                aria-current={activ ? "page" : undefined}
                className={
                  "text-nota flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 " +
                  (activ ? "text-primary font-medium" : "text-muted-foreground")
                }
              >
                <Iconita aria-hidden="true" className="size-5 shrink-0" />
                <span className="text-center leading-tight">{intrare.label}</span>
              </Link>
            </li>
          );
        })}

        {areMaiMulte ? (
          <li className="flex-1">
            {/*
              `key={cale}` remontează `<details>` la fiecare navigare, deci
              sertarul se închide singur. Fără el, DOM-ul supraviețuiește
              navigării client-side și panoul rămâne deschis peste pagina nouă.

              `<details>` și nu un panou scris de mână: e tiparul deja folosit în
              `components/layout/topbar.tsx` — zero JavaScript propriu, tastatură
              și cititor de ecran gratis. Limitarea acceptată e că nu are
              închidere la atingere în afară; se închide la re-apăsare sau la
              navigare.
            */}
            <details key={cale} className="group">
              <summary className="text-muted-foreground text-nota flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-1 px-1 py-2 [&::-webkit-details-marker]:hidden">
                <Ellipsis aria-hidden="true" className="size-5 shrink-0" />
                <span className="text-center leading-tight">Mai multe</span>
              </summary>

              <div className="border-border bg-surface shadow-plutitor fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 max-h-[60dvh] overflow-y-auto overscroll-contain rounded-t-lg border-t p-2">
                <ul className="grid grid-cols-2 gap-1">
                  {secundare.map((intrare) => {
                    const activ = esteActiva(cale, intrare.href, intrare.exact);
                    const Iconita = ICONITE[intrare.id] ?? IconitaImplicita;
                    return (
                      <li key={intrare.id}>
                        <Link
                          href={intrare.href}
                          aria-current={activ ? "page" : undefined}
                          className={
                            "hover:bg-background rounded-control text-corp flex min-h-11 items-center gap-2.5 px-3 py-2 " +
                            (activ ? "text-primary font-medium" : "text-foreground")
                          }
                        >
                          <Iconita aria-hidden="true" className="size-4 shrink-0" />
                          <span className="min-w-0 truncate">{intrare.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
