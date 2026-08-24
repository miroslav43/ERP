// src/components/layout/sidebar.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Building2, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { cn } from "@/lib/ui/cn";

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
  className,
  children,
}: {
  defaultCollapsed: boolean;
  /** Clase pentru învelișul exterior — folosit ca să atașeze variabila de font. */
  className?: string;
  children: ReactNode;
}) {
  const [colapsat, setColapsat] = useState(defaultCollapsed);
  const [mobilDeschis, setMobilDeschis] = useState(false);

  /*
   * Escape închide. Un panou modal care acoperă tot ecranul și nu răspunde la
   * Escape e singurul element din produs care nu respectă convenția; sertarul
   * nu e `<dialog>`, deci comportamentul se scrie de mână.
   */
  useEffect(() => {
    if (!mobilDeschis) return;
    function laTasta(eveniment: KeyboardEvent): void {
      if (eveniment.key === "Escape") setMobilDeschis(false);
    }
    window.addEventListener("keydown", laTasta);
    return () => window.removeEventListener("keydown", laTasta);
  }, [mobilDeschis]);

  const comuta = (): void => {
    const urmator = !colapsat;
    setColapsat(urmator);
    document.cookie = `${COOKIE_SIDEBAR}=${urmator ? "colapsat" : "extins"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <ContextSidebar.Provider value={{ colapsat, comuta, mobilDeschis, setMobilDeschis }}>
      <div className={cn("flex min-h-dvh", className)}>{children}</div>
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
      className="rounded-control inline-flex size-11 items-center justify-center text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
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
          className="bg-foreground/50 z-scrim fixed inset-0 md:hidden"
        >
          <span className="sr-only">Închide meniul</span>
        </button>
      )}

      <aside
        data-tipar="ascunde"
        id="meniu-principal"
        aria-label="Meniu principal"
        className={cn(
          "bg-primary z-sertar fixed inset-y-0 left-0 flex w-64 flex-col border-r border-white/10",
          "durata-lent transition-[transform,visibility] md:sticky md:top-0 md:h-dvh md:translate-x-0",
          /*
            `invisible`, nu doar `-translate-x-full`. Translatat în afara
            ecranului, sertarul rămâne în ordinea de tabulare: pe telefon,
            Tab-ul de după antet parcurgea toate cele ~20 de destinații
            invizibile înainte să ajungă la conținut, iar focusul „dispărea"
            fără nicio explicație vizuală.

            `visibility: hidden` scoate întregul subarbore din focus, spre
            deosebire de `opacity` sau de transform, și se animă discret: cu
            `visibility` în lista de tranziție, elementul rămâne vizibil pe
            toată durata alunecării și abia apoi se stinge. `md:visible` îl
            readuce pe laptop, unde railul e permanent.

            Nu `inert`: acela n-are variantă responsivă, iar sub `md` și peste
            el același element joacă două roluri diferite.
          */
          mobilDeschis ? "translate-x-0" : "invisible -translate-x-full md:visible",
          colapsat ? "md:w-16" : "md:w-64",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-3">
          {/* Auriul e interzis pe crem (2,26:1) și trece confortabil pe navy
              (6,82:1). Aici marchează marca firmei; în listă, pagina activă. */}
          <Building2 className="text-accent size-5 shrink-0" aria-hidden />
          <span
            className={cn(
              "text-corp min-w-0 flex-1 truncate font-semibold text-white",
              colapsat ? "md:sr-only" : "",
            )}
          >
            {organizationName}
          </span>
          <button
            type="button"
            onClick={() => setMobilDeschis(false)}
            className="rounded-control p-1.5 text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          >
            <X className="size-4" aria-hidden />
            <span className="sr-only">Închide meniul</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>

        <div className="hidden border-t border-white/10 p-2 md:block">
          <button
            type="button"
            onClick={comuta}
            className="rounded-control text-corp flex w-full items-center gap-2 px-2 py-2 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            {colapsat ? (
              <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" aria-hidden />
            )}
            {/*
              Eticheta urmează starea. Cu `aria-pressed={colapsat}` și un nume
              fix, cititorul de ecran anunța „Restrânge meniul, apăsat" pentru
              un buton care EXTINDE meniul — exact inversul acțiunii. Două nume
              distincte sunt mai clare aici decât o stare apăsată, deci
              `aria-pressed` a fost scos odată cu ambiguitatea.
            */}
            <span className={colapsat ? "sr-only" : ""}>
              {colapsat ? "Extinde meniul" : "Restrânge meniul"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
