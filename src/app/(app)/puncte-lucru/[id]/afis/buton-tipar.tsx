"use client";

import { Printer } from "lucide-react";

import { Buton } from "@/components/ui/buton";

/**
 * Singurul motiv pentru care afișul are o componentă client: `window.print()`.
 * Aceeași formă ca la decontul de deplasare și la procesul-verbal de predare.
 *
 * Instrucțiunea „Tipăriți cu Ctrl+P" nu ajungea la cine lucrează pe Mac (⌘P),
 * pe tabletă sau pe telefon — exact oamenii care pun afișul pe perete.
 */
export function ButonTiparAfis() {
  return (
    <Buton
      varianta="primar"
      className="print:hidden"
      onClick={() => {
        window.print();
      }}
    >
      <Printer aria-hidden="true" className="size-4" />
      Tipărește afișul
    </Buton>
  );
}
