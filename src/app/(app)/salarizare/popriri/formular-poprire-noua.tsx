// src/app/(app)/salarizare/popriri/formular-poprire-noua.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { creeazaPoprire } from "./actions";

interface Angajat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

const CLASA_CAMP = "border-foreground/60 rounded-control border px-3 py-2 text-corp";

export function FormularPoprireNoua({ angajati }: { readonly angajati: readonly Angajat[] }) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  const idAngajat = useId();
  const idDosar = useId();
  const idCreditor = useId();
  const idExecutor = useId();
  const idTip = useId();
  const idTotala = useId();
  const idLunara = useId();
  const idPrioritate = useId();
  const idInceput = useId();
  const idSfarsit = useId();
  const idObservatii = useId();

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaPoprire({
        employee_id: String(fd.get("employee_id") ?? ""),
        dosar: String(fd.get("dosar") ?? ""),
        creditor: String(fd.get("creditor") ?? ""),
        executor: String(fd.get("executor") ?? ""),
        tip_creanta: String(fd.get("tip_creanta") ?? "alta"),
        suma_totala: String(fd.get("suma_totala") ?? ""),
        suma_lunara: String(fd.get("suma_lunara") ?? ""),
        prioritate: String(fd.get("prioritate") ?? "100"),
        data_inceput: String(fd.get("data_inceput") ?? ""),
        data_sfarsit: String(fd.get("data_sfarsit") ?? ""),
        observatii: String(fd.get("observatii") ?? ""),
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
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Dosar nou
      </Buton>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border rounded-panou grid w-full gap-3 border p-4 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idAngajat} className="text-corp font-medium">
          Angajat *
        </label>
        <select id={idAngajat} name="employee_id" required className={CLASA_CAMP}>
          <option value="">Alegeți angajatul…</option>
          {angajati.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ?? "—"} ({a.marca})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idDosar} className="text-corp font-medium">
          Număr dosar *
        </label>
        <input
          id={idDosar}
          name="dosar"
          type="text"
          required
          maxLength={100}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCreditor} className="text-corp font-medium">
          Creditor *
        </label>
        <input
          id={idCreditor}
          name="creditor"
          type="text"
          required
          maxLength={200}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idExecutor} className="text-corp font-medium">
          Executor judecătoresc
        </label>
        <input id={idExecutor} name="executor" type="text" maxLength={200} className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-corp font-medium">
          Tipul creanței *
        </label>
        <select id={idTip} name="tip_creanta" defaultValue="alta" className={CLASA_CAMP}>
          <option value="intretinere">Obligație de întreținere (se satisface prima)</option>
          <option value="alta">Altă creanță</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTotala} className="text-corp font-medium">
          Datoria totală (lei) *
        </label>
        <input
          id={idTotala}
          name="suma_totala"
          type="number"
          step="0.01"
          min="0.01"
          required
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idLunara} className="text-corp font-medium">
          Rata lunară de reținut (lei) *
        </label>
        <input
          id={idLunara}
          name="suma_lunara"
          type="number"
          step="0.01"
          min="0.01"
          required
          className={CLASA_CAMP}
        />
        <p className="text-muted-foreground text-nota">
          Plafonată automat la o treime din net pentru un singur dosar, la jumătate când sunt mai
          multe.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idPrioritate} className="text-corp font-medium">
          Prioritate
        </label>
        <input
          id={idPrioritate}
          name="prioritate"
          type="number"
          min="1"
          max="1000"
          defaultValue={100}
          className={CLASA_CAMP}
        />
        <p className="text-muted-foreground text-nota">Numărul mai mic se satisface primul.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idInceput} className="text-corp font-medium">
          Data de început *
        </label>
        <input id={idInceput} name="data_inceput" type="date" required className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idSfarsit} className="text-corp font-medium">
          Data de sfârșit
        </label>
        <input id={idSfarsit} name="data_sfarsit" type="date" className={CLASA_CAMP} />
      </div>

      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idObservatii} className="text-corp font-medium">
          Observații
        </label>
        <textarea
          id={idObservatii}
          name="observatii"
          rows={2}
          maxLength={1000}
          className={CLASA_CAMP}
        />
      </div>

      {eroare !== null ? (
        <p role="alert" className="text-danger text-corp sm:col-span-2">
          {eroare}
        </p>
      ) : null}

      <div className="flex gap-2 sm:col-span-2">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
          Deschide dosarul
        </Buton>
        <Buton
          varianta="secundar"
          onClick={() => {
            setDeschis(false);
          }}
        >
          Renunță
        </Buton>
      </div>
    </form>
  );
}
