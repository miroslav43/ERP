"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import type { GrupPortalView } from "@/lib/navigation/build-portal-navigation";

import { ICONITE, IconitaImplicita, esteActiva } from "./iconite";

/**
 * Navigarea portalului pe laptop: rail navy, fix în stânga, pânză crem la dreapta.
 *
 * Pe telefon dispare complet (`hidden md:flex`) și îi ia locul `BaraPortal`.
 * Nu sunt aceeași listă la două dimensiuni: railul are loc pentru grupuri cu
 * titluri și pentru toate intrările, bara are patru sloturi și „Mai multe”. O
 * singură componentă care le-ar servi pe amândouă ar fi un `if (mobil)`
 * deghizat în clase utilitare.
 *
 * Culoarea: `bg-primary` (#0f1e3d), NU `--color-navy-abis`. Acela e declarat în
 * `globals.css` ca fiind exclusiv al consolei de platformă, iar regula merită
 * păstrată adevărată — diferența dintre cele două e de cinci nuanțe.
 */
export function RailPortal({
  grupuri,
  numeOrganizatie,
}: {
  readonly grupuri: readonly GrupPortalView[];
  readonly numeOrganizatie: string;
}) {
  const cale = usePathname();

  return (
    <nav
      aria-label="Navigare portal"
      className="bg-primary sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-white/10 p-3 md:flex"
    >
      <div className="flex items-center gap-2 px-2 py-1">
        <Building2 aria-hidden="true" className="text-accent size-4 shrink-0" />
        <span className="min-w-0 truncate text-sm font-semibold text-white">{numeOrganizatie}</span>
      </div>

      {grupuri.map((grup) => (
        <div key={grup.id} className="flex flex-col gap-1">
          <span className="px-2 text-[0.625rem] font-medium tracking-[0.15em] text-white/40 uppercase">
            {grup.label}
          </span>
          <ul className="flex flex-col gap-1">
            {grup.items.map((intrare) => {
              const activ = esteActiva(cale, intrare.href, intrare.exact);
              const Iconita = ICONITE[intrare.id] ?? IconitaImplicita;
              return (
                <li key={intrare.id} className="relative">
                  {/* Singurul auriu din rail: indicatorul de pagină curentă.
                      Accentul e rar prin definiție — dacă marchează două lucruri,
                      nu mai marchează niciunul. */}
                  {activ ? (
                    <span
                      aria-hidden="true"
                      className="bg-accent absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-sm"
                    />
                  ) : null}
                  <Link
                    href={intrare.href}
                    aria-current={activ ? "page" : undefined}
                    className={
                      "flex min-h-11 items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors " +
                      (activ
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white")
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
      ))}
    </nav>
  );
}
