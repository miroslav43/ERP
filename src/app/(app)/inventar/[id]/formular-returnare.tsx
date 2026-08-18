"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { STARI_OBIECT } from "@/schemas/inventory";
import { ETICHETE_STARE } from "../etichete";
import { returneazaObiect } from "../actions";

interface Proprietati {
  readonly alocareId: string;
}

interface ValoriFormular {
  stare_la_returnare: string;
  observatii: string;
}

const CLASA_CAMP =
  "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-2 dark:border-zinc-600 dark:bg-zinc-900";

export function FormularReturnare({ alocareId }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [mesajSucces, setMesajSucces] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<ValoriFormular>({
    defaultValues: { stare_la_returnare: "bun", observatii: "" },
  });

  function trimite(valori: ValoriFormular): void {
    setEroare(null);
    setMesajSucces(null);
    porneste(async () => {
      const rezultat = await returneazaObiect({ id: alocareId, ...valori });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      // Returnare cu starea „defect” mută obiectul în reparație, nu în stoc —
      // mesajul de succes trebuie să o spună (0019/V1b).
      setMesajSucces(
        valori.stare_la_returnare === "defect"
          ? "Returnarea a fost înregistrată. Obiectul a trecut în starea „În reparație”."
          : "Returnarea a fost înregistrată. Obiectul revine în stoc.",
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(trimite)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="stare_la_returnare" className="block text-sm font-medium">
            Stare la returnare <span aria-hidden="true">*</span>
          </label>
          <select
            id="stare_la_returnare"
            aria-required="true"
            className={CLASA_CAMP}
            {...register("stare_la_returnare", { required: true })}
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
        <label htmlFor="observatii-returnare" className="block text-sm font-medium">
          Observații
        </label>
        <textarea
          id="observatii-returnare"
          rows={2}
          className={CLASA_CAMP}
          {...register("observatii")}
        />
      </div>

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
            {eroare}
          </p>
        ) : null}
        {mesajSucces !== null ? (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
            {mesajSucces}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={inCurs || mesajSucces !== null}
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {inCurs ? "Se înregistrează…" : "Înregistrează returnarea"}
      </button>
    </form>
  );
}
