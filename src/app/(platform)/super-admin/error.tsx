// src/app/(platform)/super-admin/error.tsx
"use client";

import { RotateCcw } from "lucide-react";

export default function EroarePlatforma({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="border-border bg-surface rounded-lg border p-6">
      <h2 className="text-foreground text-lg font-semibold">Nu am putut încărca această pagină</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Datele platformei nu au putut fi citite. Verificați conexiunea și încercați din nou.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring mt-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        Reîncearcă
      </button>
    </div>
  );
}
