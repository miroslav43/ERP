"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { confirmaPrimirea } from "../actions";

interface Proprietati {
  readonly alocareId: string;
}

export function ButonConfirmare({ alocareId }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function confirma(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await confirmaPrimirea({ id: alocareId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={confirma}
        disabled={inCurs}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
      >
        {inCurs ? "Se confirmă…" : "Confirmă primirea"}
      </button>
      {eroare !== null ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {eroare}
        </p>
      ) : null}
    </div>
  );
}
