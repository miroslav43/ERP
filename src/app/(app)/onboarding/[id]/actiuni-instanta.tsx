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
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
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
            className="inline-flex items-center gap-1.5 rounded-md border border-danger px-3 py-2 text-sm font-medium text-danger hover:bg-danger hover:text-danger-foreground"
          >
            <Ban aria-hidden="true" className="size-4" />
            Anulează checklistul
          </button>
        ) : null}
      </div>

      {panou === "anulare" ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <label htmlFor={idMotiv} className="block text-xs font-medium">
            Motivul anulării *
          </label>
          <input
            id={idMotiv}
            value={motiv}
            onChange={(e) => {
              setMotiv(e.target.value);
            }}
            className="w-full rounded-md border border-foreground/60 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={anuleaza}
              disabled={inCurs}
              className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-danger disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
            >
              {inCurs ? "Se anulează…" : "Confirmă anularea"}
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
      ) : null}

      {/* Persistent, nu toast care dispare: mesajul de business enumeră
          bunurile sau pașii care blochează finalizarea, iar omul are nevoie
          de timp să-l citească și să acționeze. */}
      {eroare === null ? null : (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger/8 p-3 text-sm text-danger"
        >
          {eroare}
        </p>
      )}
    </section>
  );
}
