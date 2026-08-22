"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check } from "lucide-react";

import { anuleazaInstanta, finalizeazaInstanta } from "../actions";

const LUNGIME_MINIMA_MOTIV = 5;

export function ActiuniInstanta({ instantaId }: { readonly instantaId: string }) {
  const router = useRouter();
  const [panou, setPanou] = useState<"inchis" | "anulare">("inchis");
  const [motiv, setMotiv] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();
  const idMotiv = useId();

  function finalizeaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await finalizeazaInstanta({ id: instantaId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  function anuleaza(): void {
    if (motiv.trim().length < LUNGIME_MINIMA_MOTIV) {
      setEroare(`Motivul trebuie să aibă cel puțin ${String(LUNGIME_MINIMA_MOTIV)} caractere.`);
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await anuleazaInstanta({ id: instantaId, motiv_anulare: motiv });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setPanou("inchis");
      router.refresh();
    });
  }

  return (
    <section aria-label="Acțiuni" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={finalizeaza}
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          <Check aria-hidden="true" className="size-4" />
          {inCurs ? "Se finalizează…" : "Finalizează checklistul"}
        </button>
        {panou === "inchis" ? (
          <button
            type="button"
            onClick={() => {
              setPanou("anulare");
            }}
            className="border-danger text-danger hover:bg-danger hover:text-danger-foreground inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium"
          >
            <Ban aria-hidden="true" className="size-4" />
            Anulează checklistul
          </button>
        ) : null}
      </div>

      {panou === "anulare" ? (
        <div className="border-border space-y-2 rounded-md border p-3">
          <label htmlFor={idMotiv} className="block text-xs font-medium">
            Motivul anulării *
          </label>
          <input
            id={idMotiv}
            value={motiv}
            onChange={(e) => {
              setMotiv(e.target.value);
            }}
            className="border-foreground/60 w-full rounded-md border px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={anuleaza}
              disabled={inCurs}
              className="bg-danger text-primary-foreground hover:bg-danger disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
            >
              {inCurs ? "Se anulează…" : "Confirmă anularea"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPanou("inchis");
                setEroare(null);
              }}
              className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5 text-sm font-medium"
            >
              Renunță
            </button>
          </div>
        </div>
      ) : null}

      {/* Persistent, nu toast care dispare: mesajul de business enumeră
          bunurile sau pașii care blochează finalizarea, iar omul are nevoie
          de timp să-l citească și să acționeze. */}
      {eroare === null ? null : (
        <p
          role="alert"
          className="border-danger/40 bg-danger/8 text-danger rounded-lg border p-3 text-sm"
        >
          {eroare}
        </p>
      )}
    </section>
  );
}
