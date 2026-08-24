// src/components/layout/sidebar-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";

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

function potriveste(cale: string, href: string): boolean {
  return href === "/" ? cale === "/" : cale === href || cale.startsWith(`${href}/`);
}

/**
 * Calea activă e A UNEI SINGURE intrări: cea cu cel mai lung `href` care se
 * potrivește.
 *
 * Potrivirea pe prefix, luată intrare cu intrare, aprindea două rânduri
 * deodată. Trei perechi din `NAV_ITEMS` sunt fiecare prefixul celeilalte:
 * „Salarizare" (`/salarizare`) cu „Sporuri și prime" (`/salarizare/componente`)
 * și cu „Popriri" (`/salarizare/popriri`). Pe `/salarizare/popriri` se
 * randau două bare aurii una sub alta și — mai grav — DOUĂ elemente cu
 * `aria-current="page"`, adică un cititor de ecran anunța două pagini curente
 * pe același ecran.
 *
 * Nu se compară doar în interiorul grupului: „Salarizare" și „Popriri" sunt
 * amândouă în „Financiar" azi, dar regula nu trebuie să depindă de asta.
 */
function hrefulActiv(groups: readonly NavGroupView[], cale: string): string | null {
  let castigator: string | null = null;
  for (const grup of groups) {
    for (const element of grup.items) {
      if (!potriveste(cale, element.href)) continue;
      if (castigator === null || element.href.length > castigator.length) {
        castigator = element.href;
      }
    }
  }
  return castigator;
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
  const { colapsat, setMobilDeschis } = useSidebar();
  const activHref = useMemo(() => hrefulActiv(groups, cale), [groups, cale]);

  /*
   * Pe telefon, sertarul se închide la atingerea unei destinații. Nimic nu-l
   * închidea: pagina cerută se încărca DEDESUBT, iar meniul rămânea peste ea —
   * trebuia încă o atingere pe voal sau pe X ca să vezi ce ai cerut.
   *
   * Se închide de aici, din handlerul de clic, nu dintr-un `useEffect` pe
   * `usePathname()`: regula `react-hooks/set-state-in-effect` (compilatorul
   * React) interzice `setState` sincron în corpul unui efect, și pe bună
   * dreptate — ar fi o randare în cascadă la fiecare navigare din tot produsul,
   * ca să repare un caz care are un declanșator direct.
   */
  const laNavigare = (): void => setMobilDeschis(false);

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
              const activ = element.href === activHref;
              const contor = element.badgeCount;
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
                    onClick={laNavigare}
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
                    {contor !== undefined && contor > 0 ? (
                      /*
                        Pastila NU e aurie, deși a fost. Două motive, în ordinea
                        importanței:
                        1. auriul marchează pagina curentă, la doi pixeli
                           distanță, pe același rând — două lucruri cu același
                           semnal înseamnă zero semnale;
                        2. `docs/design/stari-de-interactiune.md:149` o interzice
                           explicit („auriu în badge — niciodată").
                        Cât timp `badges: {}` era literal gol, defectul nu se
                        vedea. Insignele sunt cablate acum, deci se vede.

                        Când railul e restrâns, cifra NU dispare: se mută peste
                        pictogramă. O coadă de aprobat care se ascunde odată cu
                        eticheta e o coadă pe care nimeni n-o mai golește, iar
                        starea restrânsă e persistată în cookie — cine a
                        restrâns o dată o găsește așa la fiecare sesiune.
                      */
                      <span
                        className={cn(
                          "text-nota shrink-0 rounded-full bg-white/15 px-1.5 font-mono font-semibold text-white tabular-nums",
                          colapsat
                            ? "md:absolute md:top-0.5 md:right-0.5 md:px-1 md:text-[0.625rem] md:leading-4"
                            : "",
                        )}
                      >
                        {contor > 99 ? "99+" : contor}
                        <span className="sr-only"> de rezolvat</span>
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
                              onClick={laNavigare}
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
