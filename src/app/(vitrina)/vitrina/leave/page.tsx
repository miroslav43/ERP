import type { Metadata } from "next";

import { todayInBucharest } from "@/lib/format/date";

import { VitrinaConcedii } from "./vitrina-leave";

export const metadata: Metadata = { title: "Concedii — demonstrație" };

/**
 * Ancorat la ZIUA CURENTĂ, nu la o lună scrisă în cod. Un demo cu „martie 2026"
 * arată o lună moartă peste trei luni, fără nicio eroare — îmbătrânește tăcut
 * pe pagina publică.
 */
export default function PaginaVitrinaConcedii() {
  return (
    <main>
      <VitrinaConcedii azi={todayInBucharest()} />
    </main>
  );
}
