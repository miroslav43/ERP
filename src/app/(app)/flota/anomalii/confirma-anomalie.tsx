"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { confirmaAnomalie } from "../actions";

/**
 * Confirmarea unei anomalii — o explicație, nu o corecție.
 *
 * Cifrele constatate rămân neatinse: `internal.anomalii_protejeaza` respinge
 * modificarea lor. Se scrie doar nota și momentul confirmării.
 */
export function ConfirmaAnomalie({ id }: { readonly id: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idNota = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    const nota = String(formular.get("nota") ?? "").trim();
    porneste(async () => {
      const rezultat = await confirmaAnomalie({ id, nota: nota.length > 0 ? nota : null });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={trimite} className="flex flex-wrap items-center gap-2">
      <label htmlFor={idNota} className="sr-only">
        Explicația diferenței de kilometraj
      </label>
      <input
        id={idNota}
        name="nota"
        type="text"
        maxLength={500}
        placeholder="Ex. cursă necompletată pe 14 septembrie"
        className="border-foreground/60 min-w-56 flex-1 rounded-md border px-3 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={inCurs}
        className="border-foreground/60 hover:bg-surface disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
      >
        {inCurs ? "Se salvează…" : "Confirmă"}
      </button>
      {eroare === null ? null : (
        <p role="alert" className="text-danger w-full text-xs">
          {eroare}
        </p>
      )}
    </form>
  );
}
