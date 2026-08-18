"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { predaEip } from "../actions";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/** NU trimite `data_inlocuirii`: triggerul BEFORE `internal.ssm_ppe_calc` o calculează. */
export function FormularEip({ angajati }: { readonly angajati: readonly AngajatOptiune[] }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const id = {
    angajat: useId(),
    articol: useId(),
    cod: useId(),
    cantitate: useId(),
    unitate: useId(),
    predare: useId(),
    durata: useId(),
    valoare: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };
    const durata = text("durata_utilizare_luni");
    const valoare = text("valoare");

    porneste(async () => {
      const rezultat = await predaEip({
        employee_id: String(formular.get("employee_id") ?? ""),
        articol: String(formular.get("articol") ?? ""),
        cod_articol: text("cod_articol"),
        cantitate: Number(formular.get("cantitate") ?? 1),
        unitate: String(formular.get("unitate") ?? "buc"),
        data_predarii: String(formular.get("data_predarii") ?? ""),
        durata_utilizare_luni: durata === null ? null : Number(durata),
        valoare: valoare === null ? null : Number(valoare),
        semnatura_confirmata: false,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form
      action={trimite}
      className="grid gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-3 dark:border-zinc-800"
    >
      <p className="text-sm font-medium sm:col-span-3">Predă echipament</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.angajat} className="text-sm">
          Angajat
        </label>
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
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.articol} className="text-sm">
          Articol
        </label>
        <input
          id={id.articol}
          name="articol"
          required
          maxLength={160}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.cod} className="text-sm">
          Cod articol
        </label>
        <input
          id={id.cod}
          name="cod_articol"
          maxLength={64}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.cantitate} className="text-sm">
          Cantitate
        </label>
        <input
          id={id.cantitate}
          name="cantitate"
          type="number"
          min="0.01"
          step="1"
          defaultValue={1}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.unitate} className="text-sm">
          Unitate
        </label>
        <input
          id={id.unitate}
          name="unitate"
          defaultValue="buc"
          maxLength={20}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.predare} className="text-sm">
          Data predării
        </label>
        <input
          id={id.predare}
          name="data_predarii"
          type="date"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.durata} className="text-sm">
          Durată utilizare (luni, opțional)
        </label>
        <input
          id={id.durata}
          name="durata_utilizare_luni"
          type="number"
          min="1"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.valoare} className="text-sm">
          Valoare (lei)
        </label>
        <input
          id={id.valoare}
          name="valoare"
          type="number"
          min="0"
          step="0.01"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {inCurs ? "Se salvează…" : "Predă echipamentul"}
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
