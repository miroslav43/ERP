"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { pornesteInstanta } from "../actions";
import { ETICHETE_TIP } from "../etichete";

interface SablonOptiune {
  readonly id: string;
  readonly denumire: string;
  readonly tip: "onboarding" | "offboarding" | "transfer" | "altul";
}

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

interface Proprietati {
  readonly sabloane: readonly SablonOptiune[];
  /** `null` = viewerul nu are `employees:read ≥ team`: input de identificator. */
  readonly angajati: readonly AngajatOptiune[] | null;
  readonly astazi: string;
}

export function FormularInstanta({ sabloane, angajati, astazi }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  const id = {
    sablon: useId(),
    angajat: useId(),
    data: useId(),
    observatii: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const observatii = String(formular.get("observatii") ?? "").trim();

    porneste(async () => {
      const rezultat = await pornesteInstanta({
        template_id: String(formular.get("template_id") ?? ""),
        employee_id: String(formular.get("employee_id") ?? "").trim(),
        data_referinta: String(formular.get("data_referinta") ?? ""),
        observatii: observatii.length === 0 ? null : observatii,
      });

      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/onboarding/${rezultat.data.id}`);
    });
  }

  return (
    <form action={trimite} className="space-y-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={id.sablon} className="text-sm font-medium">
          Șablon
        </label>
        <select
          id={id.sablon}
          name="template_id"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {sabloane.map((s) => (
            <option key={s.id} value={s.id}>
              {s.denumire} ({ETICHETE_TIP[s.tip]})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.angajat} className="text-sm font-medium">
          Angajat
        </label>
        {angajati === null ? (
          <>
            <input
              id={id.angajat}
              name="employee_id"
              required
              placeholder="id-ul angajatului"
              aria-describedby={`${id.angajat}-ajutor`}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p id={`${id.angajat}-ajutor`} className="text-xs text-zinc-500 dark:text-zinc-400">
              Nu aveți acces la lista de angajați; introduceți identificatorul angajatului (îl
              găsiți pe fișa lui, în modulul Personal).
            </p>
          </>
        ) : (
          <select
            id={id.angajat}
            name="employee_id"
            required
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {angajati.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name ?? a.marca} ({a.marca})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.data} className="text-sm font-medium">
          Data de referință
        </label>
        <input
          id={id.data}
          name="data_referinta"
          type="date"
          required
          defaultValue={astazi}
          aria-describedby={`${id.data}-ajutor`}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <p id={`${id.data}-ajutor`} className="text-xs text-zinc-500 dark:text-zinc-400">
          Prima zi de lucru (integrare) sau ultima zi (ieșire) — termenele pașilor se calculează
          de la ea.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.observatii} className="text-sm font-medium">
          Observații
        </label>
        <textarea
          id={id.observatii}
          name="observatii"
          rows={3}
          maxLength={2000}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {inCurs ? "Se pornește…" : "Pornește checklistul"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
