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
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
        >
          <Check aria-hidden="true" className="size-4" />
          Aprobă
        </button>
        <button
          type="button"
          onClick={() => {
            setPanou("respingere");
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-800 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950"
        >
          <X aria-hidden="true" className="size-4" />
          Respinge
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
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
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
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
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
        </div>
      ) : null}

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="text-xs text-rose-700 dark:text-rose-300">{eroare}</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            decide(panou === "respingere" ? "respinsa" : "aprobata");
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
            panou === "respingere"
              ? "bg-rose-700 hover:bg-rose-800"
              : "bg-emerald-700 hover:bg-emerald-800"
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
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Renunță
        </button>
      </div>
    </div>
  );
}
