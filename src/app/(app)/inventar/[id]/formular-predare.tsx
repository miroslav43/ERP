"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { STARI_OBIECT } from "@/schemas/inventory";
import { ETICHETE_STARE } from "../etichete";
import { predaObiect } from "../actions";

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

interface Proprietati {
  readonly itemId: string;
  readonly angajati: readonly OptiuneAngajat[];
}

interface ValoriFormular {
  employee_id: string;
  stare_la_predare: string;
  observatii: string;
}

const CLASA_CAMP = "mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm";

export function FormularPredare({ itemId, angajati }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ValoriFormular>();

  function trimite(valori: ValoriFormular): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await predaObiect({ item_id: itemId, ...valori });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (angajati.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nu există angajați activi cărora să le puteți preda acest obiect.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(trimite)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="employee_id" className="block text-sm font-medium">
            Predat către <span aria-hidden="true">*</span>
          </label>
          <select
            id="employee_id"
            aria-required="true"
            className={CLASA_CAMP}
            {...register("employee_id", { required: "Selectați angajatul." })}
          >
            <option value="">Alegeți un angajat</option>
            {angajati.map((angajat) => (
              <option key={angajat.id} value={angajat.id}>
                {angajat.full_name ?? "Angajat fără nume"} ({angajat.marca})
              </option>
            ))}
          </select>
          {formState.errors.employee_id !== undefined ? (
            <p className="text-danger mt-1 text-xs">{formState.errors.employee_id.message}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="stare_la_predare" className="block text-sm font-medium">
            Stare la predare
          </label>
          <select
            id="stare_la_predare"
            defaultValue="bun"
            className={CLASA_CAMP}
            {...register("stare_la_predare")}
          >
            {STARI_OBIECT.map((valoare) => (
              <option key={valoare} value={valoare}>
                {ETICHETE_STARE[valoare]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="observatii" className="block text-sm font-medium">
          Observații
        </label>
        <textarea id="observatii" rows={2} className={CLASA_CAMP} {...register("observatii")} />
      </div>

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="border-danger bg-danger/8 text-danger rounded-md border p-3 text-sm">
            {eroare}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
      >
        {inCurs ? "Se înregistrează…" : "Înregistrează predarea"}
      </button>
    </form>
  );
}
