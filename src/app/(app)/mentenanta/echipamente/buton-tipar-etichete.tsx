"use client";

import { Printer } from "lucide-react";

import { Buton } from "@/components/ui/buton";

/** Singurul motiv pentru care pagina de etichete are o componentă client: `window.print()`. */
export function ButonTiparEtichete({ cate }: Readonly<{ cate: number }>) {
  return (
    <Buton
      varianta="primar"
      className="print:hidden"
      onClick={() => {
        window.print();
      }}
    >
      <Printer aria-hidden="true" className="size-4" />
      {cate === 1 ? "Tipărește eticheta" : `Tipărește ${String(cate)} etichete`}
    </Buton>
  );
}
