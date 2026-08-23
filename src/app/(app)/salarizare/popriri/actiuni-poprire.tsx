// src/app/(app)/salarizare/popriri/actiuni-poprire.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { inchidePoprire } from "./actions";

export function ActiuniPoprire({ id, activa }: { readonly id: string; readonly activa: boolean }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function comuta(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await inchidePoprire({ id, activa: !activa });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={comuta}
        disabled={inCurs}
        className="border-border rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
      >
        {inCurs ? "Se salvează…" : activa ? "Închide dosarul" : "Redeschide dosarul"}
      </button>
      {eroare !== null ? (
        <p role="alert" className="text-danger text-sm">
          {eroare}
        </p>
      ) : null}
    </div>
  );
}
