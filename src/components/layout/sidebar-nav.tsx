// src/components/layout/sidebar-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { useSidebar } from "./sidebar";

export type NavItemView = Readonly<{
  id: string;
  label: string;
  href: string;
  icon: ReactNode;
  /** Absent sau zero = fără badge. Un „0” afișat este zgomot, nu informație. */
  badgeCount?: number;
  children?: readonly Readonly<{ id: string; label: string; href: string }>[];
}>;

export type NavGroupView = Readonly<{
  id: string;
  label: string;
  items: readonly NavItemView[];
}>;

function esteActiv(cale: string, href: string): boolean {
  return href === "/" ? cale === "/" : cale === href || cale.startsWith(`${href}/`);
}

/**
 * Meniul primește DEJA filtrat ce are voie să vadă utilizatorul (feature flags ×
 * permisiuni, calculate pe server). Ascunderea din UI nu este niciodată singura
 * barieră: pagina și acțiunea refac verificarea, iar RLS respinge rândul.
 *
 * ── CROMATICA ─────────────────────────────────────────────────────────────
 * Railul e navy `--color-primary` (#0f1e3d), pânza rămâne crem. Consola de
 * platformă folosește `--color-navy-abis` (#0a1428) cu IBM Plex; portalul
 * angajatului folosea deja `--color-primary` cu exact acest limbaj. Deci
 * sistemul are DOUĂ planuri, nu trei: firma și platforma.
 *
 * Nivelurile de alb sunt calculate, nu alese: pe #0f1e3d, `white/70` dă 8,61:1
 * și `white/60` dă 6,67:1 — amândouă peste 4,5:1. `white/40`, care era în
 * railul portalului, dă **3,72:1** și pică pentru text; de aceea nu apare aici
 * și a fost ridicat și acolo.
 */
export function SidebarNav({ groups }: { groups: readonly NavGroupView[] }) {
  const cale = usePathname();
  const { colapsat } = useSidebar();

  return (
    <nav aria-label="Navigare principală" className="flex flex-col gap-5">
      {groups.map((grup) => (
        <div key={grup.id}>
          <h2
            className={cn(
              "text-eticheta px-2 pb-1.5 font-semibold tracking-[0.15em] text-white/70 uppercase",
              colapsat ? "md:sr-only" : "",
            )}
          >
            {grup.label}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {grup.items.map((element) => {
              const activ = esteActiv(cale, element.href);
              return (
                <li key={element.id} className="relative">
                  {/*
                    Singurul auriu din rail: indicatorul paginii curente. Accentul
                    e rar prin definiție — dacă marchează două lucruri, nu mai
                    marchează niciunul. Pe navy dă 6,82:1, deci e vizibil; pe crem
                    ar fi dat 2,26:1, motiv pentru care nu poartă stări în pagină.
                  */}
                  {activ ? (
                    <span
                      aria-hidden="true"
                      className="bg-accent absolute top-1.5 bottom-1.5 -left-2 w-[3px] rounded-r-sm"
                    />
                  ) : null}
                  <Link
                    href={element.href}
                    aria-current={activ ? "page" : undefined}
                    title={colapsat ? element.label : undefined}
                    className={cn(
                      "rounded-control text-corp flex min-h-11 items-center gap-2.5 px-2 py-2 transition-colors md:min-h-0",
                      activ
                        ? "bg-white/10 font-medium text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {element.icon}
                    <span className={cn("min-w-0 flex-1 truncate", colapsat ? "md:sr-only" : "")}>
                      {element.label}
                    </span>
                    {element.badgeCount !== undefined && element.badgeCount > 0 ? (
                      <span
                        className={cn(
                          "bg-accent text-accent-foreground text-nota rounded-full px-1.5 font-mono font-semibold tabular-nums",
                          colapsat ? "md:sr-only" : "",
                        )}
                      >
                        {element.badgeCount}
                      </span>
                    ) : null}
                  </Link>

                  {activ && !colapsat && (element.children?.length ?? 0) > 0 ? (
                    <ul className="mt-0.5 ml-6 flex flex-col gap-0.5 border-l border-white/15 pl-2">
                      {element.children?.map((copil) => {
                        const copilActiv = cale === copil.href;
                        return (
                          <li key={copil.id}>
                            <Link
                              href={copil.href}
                              aria-current={copilActiv ? "page" : undefined}
                              className={cn(
                                "rounded-control text-corp block px-2 py-1.5 transition-colors",
                                copilActiv
                                  ? "font-medium text-white"
                                  : "text-white/60 hover:text-white",
                              )}
                            >
                              {copil.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
