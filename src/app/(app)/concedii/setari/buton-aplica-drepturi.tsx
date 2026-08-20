// src/app/(app)/concedii/setari/buton-aplica-drepturi.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { aplicaDrepturileConcediu } from "./actions";

export function ButonAplicaDrepturi({
  an,
  nrModificari,
}: {
  readonly an: number;
  readonly nrModificari: number;
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [confirma, setConfirma] = useState(false);

  function aplica(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await aplicaDrepturileConcediu({ an });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        setConfirma(false);
        return;
      }
      setConfirma(false);
      router.refresh();
    });
  }

  if (!confirma) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setConfirma(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium"
        >
          Aplică pe angajați ({String(nrModificari)})
        </button>
      </div>
    );
  }

  return (
    <div className="border-warning/40 bg-warning/8 flex flex-wrap items-center gap-3 rounded-md border p-3">
      <p className="text-sm">
        Se scriu {String(nrModificari)} solduri pentru anul {String(an)}. Confirmați?
      </p>
      <button
        type="button"
        disabled={inCurs}
        onClick={aplica}
        className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
      >
        {inCurs ? "Se aplică…" : "Da, aplică"}
      </button>
      <button
        type="button"
        disabled={inCurs}
        onClick={() => {
          setConfirma(false);
        }}
        className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5 text-sm"
      >
        Anulează
      </button>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
