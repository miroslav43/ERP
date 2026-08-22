// src/app/(app)/ssm/accidente/error.tsx
"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function EroareAccidente({
  error,
  retry,
}: {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}) {
  useEffect(() => {
    console.error("[ssm/accidente] eroare de randare", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div className="border-border bg-surface rounded-lg border p-8 text-center">
        <TriangleAlert aria-hidden="true" className="text-warning mx-auto size-6" />
        <h1 className="text-foreground mt-3 text-lg font-semibold">
          Registrul de accidente nu a putut fi afișat
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A apărut o eroare neașteptată. Reîncercați — dacă problema persistă, notați codul de
          referință{" "}
          {error.digest !== undefined ? <span className="font-mono">{error.digest}</span> : null} și
          contactați administratorul.
        </p>
        <button
          type="button"
          onClick={() => {
            retry();
          }}
          className="bg-primary text-primary-foreground hover:bg-primary-hover mt-6 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Încearcă din nou
        </button>
      </div>
    </main>
  );
}
