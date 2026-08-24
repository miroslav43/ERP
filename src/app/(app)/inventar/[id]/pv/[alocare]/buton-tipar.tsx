"use client";

import { Printer } from "lucide-react";

import { Buton } from "@/components/ui/buton";

/**
 * Singurul motiv pentru care procesul-verbal are o componentă client:
 * `window.print()`. Aceeași formă ca la decontul de deplasare — dacă ar fi
 * fost un `<a download>`, învelișul de artefacte l-ar fi făcut inert, iar aici
 * n-avem ce descărca: documentul E pagina.
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
