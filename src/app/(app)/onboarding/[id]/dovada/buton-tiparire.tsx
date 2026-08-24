"use client";

import { Printer } from "lucide-react";

import { Buton } from "@/components/ui/buton";

export function ButonTiparire() {
  return (
    <Buton
      varianta="secundar"
      className="print:hidden"
      onClick={() => {
        window.print();
      }}
    >
      <Printer aria-hidden="true" className="size-4" />
      Tipărește
    </Buton>
  );
}
