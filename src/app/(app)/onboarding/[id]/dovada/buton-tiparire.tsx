"use client";

import { Printer } from "lucide-react";

export function ButonTiparire() {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className="print:hidden inline-flex items-center gap-2 rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface"
    >
      <Printer aria-hidden="true" className="size-4" />
      Tipărește
    </button>
  );
}
