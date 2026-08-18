// src/app/(app)/concedii/[id]/actiuni-cerere.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";

import { anuleazaCerere } from "../actions";

export function ActiuniCerere({ cerereId }: { readonly cerereId: string }) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  function anuleaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await anuleazaCerere({ id: cerereId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={anuleaza}
        disabled={inCurs}
        className="inline-flex items-center gap-2 rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950"
      >
        <Ban aria-hidden="true" className="size-4" />
        {inCurs ? "Se anulează…" : "Anulează cererea"}
      </button>
      <p aria-live="polite" className="text-sm text-rose-700 dark:text-rose-300">
        {eroare ?? ""}
      </p>
    </div>
  );
}
