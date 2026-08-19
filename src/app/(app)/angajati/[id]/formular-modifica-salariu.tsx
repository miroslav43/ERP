// src/app/(app)/angajati/[id]/formular-modifica-salariu.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatLei } from "@/lib/format/money";
import { modificaSalariulContractului } from "../actions";

interface Proprietati {
  readonly contractId: string;
  readonly salariuActual: number;
}

export function FormularModificaSalariu({ contractId, salariuActual }: Proprietati) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idSalariu = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await modificaSalariulContractului({
        contract_id: contractId,
        salariu_baza: Number(formular.get("salariu_baza")),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      router.refresh();
    });
  }

  if (!deschis) {
    return (
      <button
        type="button"
        onClick={() => {
          setDeschis(true);
        }}
        className="border-foreground/60 hover:bg-surface mt-3 rounded-md border px-3 py-1.5 text-sm font-medium"
      >
        Modifică salariul
      </button>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border mt-3 flex flex-wrap items-end gap-3 rounded-md border p-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idSalariu} className="text-sm">
          Salariu de bază nou (lei)
        </label>
        <input
          id={idSalariu}
          name="salariu_baza"
          type="number"
          step="0.01"
          min={0}
          required
          defaultValue={salariuActual}
          className="border-foreground/60 w-40 rounded-md border px-3 py-2 text-sm"
        />
        <p className="text-muted-foreground text-xs">
          Actual: {formatLei(salariuActual)}. Se aplică din următoarea perioadă calculată — fluturașii deja calculați rămân neschimbați.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Salvează"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Renunță
        </button>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger w-full text-sm">
          {eroare}
        </p>
      )}
    </form>
  );
}
