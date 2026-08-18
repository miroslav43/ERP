// src/app/(app)/concedii/aprobari/decizie-aprobare.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import { decideCerere } from "../actions";

const LUNGIME_MINIMA_MOTIV = 5;

export function DecizieAprobare({ taskId }: { readonly taskId: string }) {
  const router = useRouter();
  const [panou, setPanou] = useState<"inchis" | "aprobare" | "respingere">("inchis");
  const [comentariu, setComentariu] = useState("");
  const [motivRespingere, setMotivRespingere] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const idComentariu = useId();
  const idMotiv = useId();

  function decide(decizie: "aprobata" | "respinsa"): void {
    if (decizie === "respinsa" && motivRespingere.trim().length < LUNGIME_MINIMA_MOTIV) {
      setEroare(
        `Motivul respingerii trebuie să aibă cel puțin ${String(LUNGIME_MINIMA_MOTIV)} caractere.`,
      );
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await decideCerere({
        taskId,
        decizie,
        comentariu: comentariu.length === 0 ? null : comentariu,
        motivRespingere: decizie === "respinsa" ? motivRespingere : null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setPanou("inchis");
      router.refresh();
    });
  }

  if (panou === "inchis") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setPanou("aprobare");
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          <Check aria-hidden="true" className="size-4" />
          Aprobă
        </button>
        <button
          type="button"
          onClick={() => {
            setPanou("respingere");
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger hover:text-danger-foreground"
        >
          <X aria-hidden="true" className="size-4" />
          Respinge
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div>
        <label htmlFor={idComentariu} className="block text-xs font-medium">
          Comentariu (opțional)
        </label>
        <input
          id={idComentariu}
          value={comentariu}
          onChange={(eveniment) => {
            setComentariu(eveniment.target.value);
          }}
          className="mt-1 w-full rounded-md border border-foreground/60 px-2 py-1.5 text-sm"
        />
      </div>

      {panou === "respingere" ? (
        <div>
          <label htmlFor={idMotiv} className="block text-xs font-medium">
            Motivul respingerii *
          </label>
          <input
            id={idMotiv}
            value={motivRespingere}
            onChange={(eveniment) => {
              setMotivRespingere(eveniment.target.value);
            }}
            className="mt-1 w-full rounded-md border border-foreground/60 px-2 py-1.5 text-sm"
          />
        </div>
      ) : null}

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="text-xs text-danger">{eroare}</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            decide(panou === "respingere" ? "respinsa" : "aprobata");
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground ${
            panou === "respingere"
              ? "bg-danger hover:bg-danger"
              : "bg-primary hover:bg-primary-hover"
          }`}
        >
          {inCurs
            ? "Se salvează…"
            : panou === "respingere"
              ? "Confirmă respingerea"
              : "Confirmă aprobarea"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPanou("inchis");
            setEroare(null);
          }}
          className="rounded-md border border-foreground/60 px-3 py-1.5 text-sm font-medium hover:bg-surface"
        >
          Renunță
        </button>
      </div>
    </div>
  );
}
