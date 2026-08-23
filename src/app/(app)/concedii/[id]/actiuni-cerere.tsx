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
        className="border-danger text-danger hover:bg-danger hover:text-danger-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-control text-corp inline-flex items-center gap-2 border px-3 py-2 font-medium disabled:cursor-not-allowed"
      >
        <Ban aria-hidden="true" className="size-4" />
        {inCurs ? "Se anulează…" : "Anulează cererea"}
      </button>
      <p aria-live="polite" className="text-danger text-corp">
        {eroare ?? ""}
      </p>
    </div>
  );
}
