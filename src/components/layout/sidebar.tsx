// src/components/layout/sidebar.tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Building2, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

const COOKIE_SIDEBAR = "adm_sidebar";

type StareSidebar = Readonly<{
  colapsat: boolean;
  comuta: () => void;
  mobilDeschis: boolean;
  setMobilDeschis: (valoare: boolean) => void;
}>;

const ContextSidebar = createContext<StareSidebar | null>(null);

export function useSidebar(): StareSidebar {
  const context = useContext(ContextSidebar);
  if (context === null) throw new Error("useSidebar folosit în afara SidebarProvider.");
  return context;
}

/**
 * Starea de colapsare vine din cookie, citit pe server și transmis ca
 * `defaultCollapsed`: fără el, primul paint ar arăta sidebar-ul extins și ar
 * sări la lățimea corectă după hidratare.
 */
export function SidebarProvider({
  defaultCollapsed,
  children,
}: {
  defaultCollapsed: boolean;
  children: ReactNode;
}) {
  const [colapsat, setColapsat] = useState(defaultCollapsed);
  const [mobilDeschis, setMobilDeschis] = useState(false);

  const comuta = (): void => {
    const urmator = !colapsat;
    setColapsat(urmator);
    document.cookie = `${COOKIE_SIDEBAR}=${urmator ? "colapsat" : "extins"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <ContextSidebar.Provider value={{ colapsat, comuta, mobilDeschis, setMobilDeschis }}>
      <div className="flex min-h-dvh">{children}</div>
    </ContextSidebar.Provider>
  );
}

/**
 * Butonul care deschide sertarul pe ecran îngust.
 *
 * `size-11` (44 px), nu `p-2` în jurul unei iconițe de `size-5` (36 px): e un
 * buton care există DOAR pe telefon, iar ținta tactilă minimă a proiectului e
 * `min-h-11`. Sub prag exact acolo unde contează.
 */
export function SidebarTrigger() {
  const { mobilDeschis, setMobilDeschis } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setMobilDeschis(true)}
      aria-controls="meniu-principal"
      aria-expanded={mobilDeschis}
      className="hover:bg-surface inline-flex size-11 items-center justify-center rounded-md md:hidden"
    >
      <Menu className="size-5" aria-hidden />
      <span className="sr-only">Deschide meniul</span>
    </button>
  );
}

export function Sidebar({
  organizationName,
  children,
}: {
  organizationName: string;
  children: ReactNode;
}) {
  const { colapsat, comuta, mobilDeschis, setMobilDeschis } = useSidebar();

  return (
    <>
      {mobilDeschis && (
        <button
          type="button"
          onClick={() => setMobilDeschis(false)}
          className="bg-foreground/40 fixed inset-0 z-30 md:hidden"
        >
          <span className="sr-only">Închide meniul</span>
        </button>
      )}

      <aside
        id="meniu-principal"
        aria-label="Meniu principal"
        className={`bg-surface border-border fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r transition-transform duration-150 md:static md:translate-x-0 ${
          mobilDeschis ? "translate-x-0" : "-translate-x-full"
        } ${colapsat ? "md:w-16" : "md:w-64"}`}
      >
        <div className="border-border flex h-14 items-center gap-2 border-b px-3">
          <Building2 className="text-primary size-5 shrink-0" aria-hidden />
          <span
            className={`min-w-0 flex-1 truncate text-sm font-semibold ${colapsat ? "md:sr-only" : ""}`}
          >
            {organizationName}
          </span>
          <button
            type="button"
            onClick={() => setMobilDeschis(false)}
            className="hover:bg-background rounded-md p-1.5 md:hidden"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Închide meniul</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>

        <div className="border-border hidden border-t p-2 md:block">
          <button
            type="button"
            onClick={comuta}
            aria-pressed={colapsat}
            className="text-muted-foreground hover:bg-background flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm"
          >
            {colapsat ? (
              <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" aria-hidden />
            )}
            <span className={colapsat ? "sr-only" : ""}>Restrânge meniul</span>
          </button>
        </div>
      </aside>
    </>
  );
}
