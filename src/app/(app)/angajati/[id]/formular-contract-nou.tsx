// src/app/(app)/angajati/[id]/formular-contract-nou.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { creeazaContract } from "../actions";

interface Proprietati {
  readonly employeeId: string;
}

export function FormularContractNou({ employeeId }: Proprietati) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idNumar = useId();
  const idDataContract = useId();
  const idValabilDeLa = useId();
  const idSalariu = useId();

  function trimite(formular: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaContract({
        employee_id: employeeId,
        numar: String(formular.get("numar") ?? ""),
        data_contract: String(formular.get("data_contract") ?? ""),
        valabil_de_la: String(formular.get("valabil_de_la") ?? ""),
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
        Contract nou
      </button>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border mt-3 grid gap-3 rounded-md border p-3 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idNumar} className="text-sm">
          Număr contract
        </label>
        <input
          id={idNumar}
          name="numar"
          type="text"
          required
          maxLength={40}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idDataContract} className="text-sm">
          Data contractului
        </label>
        <input
          id={idDataContract}
          name="data_contract"
          type="date"
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilDeLa} className="text-sm">
          Valabil de la
        </label>
        <input
          id={idValabilDeLa}
          name="valabil_de_la"
          type="date"
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idSalariu} className="text-sm">
          Salariu de bază (lei)
        </label>
        <input
          id={idSalariu}
          name="salariu_baza"
          type="number"
          step="0.01"
          min={0}
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <p className="text-muted-foreground text-xs sm:col-span-2">
        Restul clauzelor (durată nedeterminată, normă 40 ore/săptămână, loc de muncă sediu, 21 zile de
        concediu anual) se completează cu valorile implicite — le puteți schimba ulterior.
      </p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Creează contractul"}
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
        <p role="alert" className="text-danger text-sm sm:col-span-2">
          {eroare}
        </p>
      )}
    </form>
  );
}
