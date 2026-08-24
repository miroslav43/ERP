// src/app/(app)/angajati/[id]/formular-contract-nou.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

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
      <Buton
        varianta="secundar"
        className="mt-3"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Contract nou
      </Buton>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border rounded-control mt-3 grid gap-3 border p-3 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idNumar} className="text-corp">
          Număr contract
        </label>
        <input
          id={idNumar}
          name="numar"
          type="text"
          required
          maxLength={40}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idDataContract} className="text-corp">
          Data contractului
        </label>
        <input
          id={idDataContract}
          name="data_contract"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idValabilDeLa} className="text-corp">
          Valabil de la
        </label>
        <input
          id={idValabilDeLa}
          name="valabil_de_la"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idSalariu} className="text-corp">
          Salariu de bază (lei)
        </label>
        <input
          id={idSalariu}
          name="salariu_baza"
          type="number"
          step="0.01"
          min={0}
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <p className="text-muted-foreground text-nota sm:col-span-2">
        Restul clauzelor (durată nedeterminată, normă 40 ore/săptămână, loc de muncă sediu, 21 zile
        de concediu anual) se completează cu valorile implicite — le puteți schimba ulterior.
      </p>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Creează contractul
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
        <p role="alert" className="text-danger text-corp sm:col-span-2">
          {eroare}
        </p>
      )}
    </form>
  );
}
