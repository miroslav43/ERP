// src/components/layout/sidebar-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
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
 */
export function SidebarNav({ groups }: { groups: readonly NavGroupView[] }) {
  const cale = usePathname();
  const { colapsat } = useSidebar();

  return (
    <nav aria-label="Navigare principală" className="flex flex-col gap-4">
      {groups.map((grup) => (
        <div key={grup.id}>
          <h2
            className={`text-muted-foreground px-3 pb-1 text-xs font-semibold tracking-wide uppercase ${
              colapsat ? "md:sr-only" : ""
            }`}
          >
            {grup.label}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {grup.items.map((element) => {
              const activ = esteActiv(cale, element.href);
              return (
                <li key={element.id}>
                  <Link
                    href={element.href}
                    aria-current={activ ? "page" : undefined}
                    title={colapsat ? element.label : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                      activ
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-foreground hover:bg-background"
                    }`}
                  >
                    {element.icon}
                    <span className={`min-w-0 flex-1 truncate ${colapsat ? "md:sr-only" : ""}`}>
                      {element.label}
                    </span>
                    {element.badgeCount !== undefined && element.badgeCount > 0 && (
                      <span
                        className={`bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          colapsat ? "md:sr-only" : ""
                        }`}
                      >
                        {element.badgeCount}
                      </span>
                    )}
                  </Link>

                  {activ && !colapsat && (element.children?.length ?? 0) > 0 && (
                    <ul className="border-border mt-0.5 ml-6 flex flex-col gap-0.5 border-l pl-2">
                      {element.children?.map((copil) => {
                        const copilActiv = cale === copil.href;
                        return (
                          <li key={copil.id}>
                            <Link
                              href={copil.href}
                              aria-current={copilActiv ? "page" : undefined}
                              className={`block rounded-md px-2 py-1.5 text-sm ${
                                copilActiv
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {copil.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
