// src/app/(app)/ticketing/error.tsx
"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function EroareTicketing({
  error,
  retry,
}: {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}) {
  useEffect(() => {
    console.error("[ticketing] eroare de randare", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className="border-border bg-surface rounded-lg border p-8 text-center">
        <TriangleAlert aria-hidden="true" className="text-danger mx-auto h-8 w-8" />
        <p className="text-foreground mt-3 text-sm font-medium">
          Tichetele nu au putut fi încărcate
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Reîncercați — dacă problema persistă, notați codul de referință{" "}
          <span className="font-mono text-xs">{error.digest ?? "necunoscut"}</span>.
        </p>
        <button
          type="button"
          onClick={retry}
          className="border-border hover:bg-background mt-4 rounded-md border px-4 py-2 text-sm font-medium"
        >
          Reîncearcă
        </button>
      </div>
    </main>
  );
}
