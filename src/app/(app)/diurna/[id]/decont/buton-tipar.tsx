"use client";

import { Buton } from "@/components/ui/buton";

/** Singurul motiv pentru care decontul are o componentă client: `window.print()`. */
export function ButonTipar() {
  return (
    <Buton
      varianta="primar"
      onClick={() => {
        window.print();
      }}
    >
      Tipărește
    </Buton>
  );
}
