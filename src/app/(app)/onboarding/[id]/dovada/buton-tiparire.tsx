"use client";

import { Printer } from "lucide-react";

export function ButonTiparire() {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className="border-foreground/60 hover:bg-surface inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium print:hidden"
    >
      <Printer aria-hidden="true" className="size-4" />
      Tipărește
    </button>
  );
}
