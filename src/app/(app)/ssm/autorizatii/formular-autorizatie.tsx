"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { adaugaAutorizatieNominala } from "../actions";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

export function FormularAutorizatie({ angajati }: { readonly angajati: readonly AngajatOptiune[] }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const id = {
    angajat: useId(),
    tip: useId(),
    grupa: useId(),
    numar: useId(),
    emitent: useId(),
    emis: useId(),
    valabil: useId(),
  };

  function trimite(formular: FormData): void {
    setEroare(null);
    const text = (cheie: string) => {
      const v = String(formular.get(cheie) ?? "").trim();
      return v.length === 0 ? null : v;
    };

    porneste(async () => {
      const rezultat = await adaugaAutorizatieNominala({
        employee_id: String(formular.get("employee_id") ?? ""),
        tip: String(formular.get("tip") ?? ""),
        grupa: text("grupa"),
        numar: String(formular.get("numar") ?? ""),
        emitent: String(formular.get("emitent") ?? ""),
        emis_la: text("emis_la"),
        valabil_pana: String(formular.get("valabil_pana") ?? ""),
        suspendata_la: null,
        observatii: text("observatii"),
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
      <p className="text-sm font-medium sm:col-span-3">Adaugă o autorizație nominală</p>

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
        <label htmlFor={id.tip} className="text-sm">
          Tip
        </label>
        <input
          id={id.tip}
          name="tip"
          required
          maxLength={80}
          placeholder="stivuitorist, macaragiu, fochist…"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.grupa} className="text-sm">
          Grupă (opțional)
        </label>
        <input
          id={id.grupa}
          name="grupa"
          maxLength={40}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.numar} className="text-sm">
          Număr
        </label>
        <input
          id={id.numar}
          name="numar"
          required
          maxLength={64}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.emitent} className="text-sm">
          Emitent
        </label>
        <input
          id={id.emitent}
          name="emitent"
          required
          maxLength={160}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.emis} className="text-sm">
          Emisă la (opțional)
        </label>
        <input
          id={id.emis}
          name="emis_la"
          type="date"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.valabil} className="text-sm">
          Valabilă până la
        </label>
        <input
          id={id.valabil}
          name="valabil_pana"
          type="date"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCurs}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {inCurs ? "Se salvează…" : "Adaugă autorizația"}
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
