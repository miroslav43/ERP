// src/components/asistent/zona-asistent.tsx
"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactElement } from "react";

import { aboneaza, comutaAsistent, stareCurenta } from "@/lib/asistent/depozit";
import { cn } from "@/lib/ui/cn";

import { PanouAsistent } from "./panou-asistent";

/**
 * Frunza montată în cele două layout-uri. Bula plus panoul ei.
 *
 * ── DE CE `popover="manual"` ȘI NU DOAR `z-plutitor` ─────────────────────────
 * Un `<dialog>` deschis cu `showModal()` intră în TOP LAYER, deasupra oricărui
 * `z-index`, oricât de mare. Aplicația e plină de dialoguri. Fără popover, bula
 * ar dispărea sub fundalul întunecat al primului formular deschis — și ar
 * reapărea la închiderea lui, ceea ce arată ca un defect intermitent, dintre
 * cele care nu se reproduc niciodată când te uiți. Tiparul e copiat din
 * `ZonaToast`, care a rezolvat deja aceeași problemă.
 *
 * ── DE CE COLȚUL A TREBUIT NEGOCIAT ──────────────────────────────────────────
 * Colțul din dreapta-jos era deja ocupat: `ZonaToast` stă la
 * `md:right-0 md:bottom-0`, iar în portal `BaraPortal` ține toată baza
 * ecranului pe telefon. Banda de notificări a urcat cu o bulă (vezi
 * `toast.tsx`), iar bula de aici se ridică peste bara portalului.
 */
export function ZonaAsistent({ zona }: Readonly<{ zona: "app" | "portal" }>): ReactElement {
  const [stare, setStare] = useState(stareCurenta);
  const invelis = useRef<HTMLDivElement | null>(null);

  useEffect(() => aboneaza(setStare), []);

  useEffect(() => {
    const el = invelis.current;
    if (el === null || typeof el.showPopover !== "function") return;
    try {
      el.showPopover();
    } catch {
      // Aruncă dacă e deja deschis. Benign — vezi `ZonaToast`.
    }
  }, []);

  return (
    <div
      ref={invelis}
      // Nu apare la tipărire: o pagină printată cu un buton rotund în colț arată
      // ca un accident.
      data-tipar="ascunde"
      popover="manual"
      className={cn(
        /*
         * `h-full w-full` NU e redundant lângă `inset-0`, și asta a costat o
         * captură ca să se vadă.
         *
         * Foaia de stil a browserului dă oricărui popover deschis
         * `width: fit-content; height: fit-content`, iar acelea bat un `inset-0`
         * care n-are dimensiune explicită lângă el: învelișul se strânge la
         * 0×0 în colțul din stânga-sus, cu bulă cu tot. Măsurat în
         * headless_shell: `inset:0` singur ⇒ `0×0`; cu `width/height:100%` ⇒
         * `360×780`.
         *
         * Nu se vede din cod, nu se vede din teste — se vede doar deschizând
         * pagina.
         */
        "z-plutitor pointer-events-none fixed inset-0 m-0 h-full w-full",
        "flex flex-col items-end justify-end border-0 bg-transparent p-0",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full flex-col items-end gap-2 md:w-auto",
          "p-3 md:p-6",
          // În portal, bara de jos ocupă 3.5rem plus zona sigură a telefonului.
          zona === "portal"
            ? "pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-6"
            : "pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-6",
        )}
      >
        {stare.deschis ? <PanouAsistent stare={stare} zona={zona} /> : null}
        <BulaAsistent deschis={stare.deschis} />
      </div>
    </div>
  );
}

function BulaAsistent({ deschis }: Readonly<{ deschis: boolean }>): ReactElement {
  return (
    <button
      type="button"
      onClick={comutaAsistent}
      aria-expanded={deschis}
      aria-label={deschis ? "Închide asistentul" : "Deschide asistentul"}
      className={cn(
        "bg-primary text-primary-foreground shadow-plutitor flex size-12 items-center justify-center rounded-full",
        "hover:bg-primary-hover active:bg-primary-active transition-colors",
        "shrink-0",
      )}
    >
      {deschis ? (
        <X aria-hidden="true" className="size-5" />
      ) : (
        <Sparkles aria-hidden="true" className="size-5" />
      )}
    </button>
  );
}
