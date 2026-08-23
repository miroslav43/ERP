"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check } from "lucide-react";

import { anuleazaInstanta, finalizeazaInstanta } from "../actions";
import { Buton } from "@/components/ui/buton";

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
        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se finalizează…" onClick={finalizeaza}>
          <Check aria-hidden="true" className="size-4" />
          Finalizează checklistul
        </Buton>
        {panou === "inchis" ? (
          <Buton
            varianta="distructiv"
            onClick={() => {
              setPanou("anulare");
            }}
          >
            <Ban aria-hidden="true" className="size-4" />
            Anulează checklistul
          </Buton>
        ) : null}
      </div>

      {panou === "anulare" ? (
        <div className="border-border rounded-control space-y-2 border p-3">
          <label htmlFor={idMotiv} className="text-nota block font-medium">
            Motivul anulării *
          </label>
          <input
            id={idMotiv}
            value={motiv}
            onChange={(e) => {
              setMotiv(e.target.value);
            }}
            className="border-foreground/60 rounded-control text-corp w-full border px-2 py-1.5"
          />
          <div className="flex gap-2">
            <Buton
              varianta="distructiv"
              inCurs={inCurs}
              textInCurs="Se anulează…"
              onClick={anuleaza}
            >
              Confirmă anularea
            </Buton>
            <Buton
              varianta="secundar"
              onClick={() => {
                setPanou("inchis");
                setEroare(null);
              }}
            >
              Renunță
            </Buton>
          </div>
        </div>
      ) : null}

      {/* Persistent, nu toast care dispare: mesajul de business enumeră
          bunurile sau pașii care blochează finalizarea, iar omul are nevoie
          de timp să-l citească și să acționeze. */}
      {eroare === null ? null : (
        <p
          role="alert"
          className="border-danger/40 bg-danger/8 text-danger rounded-panou text-corp border p-3"
        >
          {eroare}
        </p>
      )}
    </section>
  );
}
