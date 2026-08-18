"use client";

import { Printer } from "lucide-react";

export function ButonTiparire() {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className="print:hidden inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
    >
      <Printer aria-hidden="true" className="size-4" />
      Tipărește
    </button>
  );
}
