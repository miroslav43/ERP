// src/app/(app)/angajati/[id]/formular-modifica-salariu.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

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
      <Buton
        varianta="secundar"
        className="mt-3"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Modifică salariul
      </Buton>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border rounded-control mt-3 flex flex-wrap items-end gap-3 border p-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idSalariu} className="text-corp">
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
          className="border-foreground/60 rounded-control text-corp w-40 border px-3 py-2"
        />
        <p className="text-muted-foreground text-nota">
          Actual: {formatLei(salariuActual)}. Se aplică din următoarea perioadă calculată —
          fluturașii deja calculați rămân neschimbați.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Salvează
        </Buton>
        <Buton
          varianta="link"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
        >
          Renunță
        </Buton>
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-corp w-full">
          {eroare}
        </p>
      )}
    </form>
  );
}
