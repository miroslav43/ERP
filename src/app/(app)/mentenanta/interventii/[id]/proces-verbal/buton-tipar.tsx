"use client";

import { Printer } from "lucide-react";

import { Buton } from "@/components/ui/buton";

/**
 * Singurul motiv pentru care procesul-verbal are o componentă client:
 * `window.print()`. Aceeași formă ca PV-ul de predare din inventar — documentul
 * E pagina, nu un fișier de descărcat.
 */
export function ButonTiparPv() {
  return (
    <Buton
      varianta="primar"
      onClick={() => {
        window.print();
      }}
    >
      <Printer aria-hidden="true" className="size-4" />
      Tipărește
    </Buton>
  );
}
