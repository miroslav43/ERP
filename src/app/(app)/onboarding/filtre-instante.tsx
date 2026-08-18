"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { CHECKLIST_INSTANTA_STATUS, CHECKLIST_TIP } from "@/schemas/checklist";

import { ETICHETE_STATUS_INSTANTA, ETICHETE_TIP } from "./etichete";

interface AngajatOptiune {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

interface Proprietati {
  /**
   * `null` = viewerul nu are `employees:read ≥ team`: filtrul pe angajat nu
   * se afișează deloc, în loc de un `<select>` gol și inutilizabil.
   */
  readonly angajati: readonly AngajatOptiune[] | null;
}

export function FiltreInstante({ angajati }: Proprietati) {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();

  const id = {
    tip: useId(),
    status: useId(),
    angajat: useId(),
    deLa: useId(),
    panaLa: useId(),
  };

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    for (const cheie of ["tip", "status", "angajat", "de_la", "pana_la"]) {
      const valoare = String(formular.get(cheie) ?? "").trim();
      if (valoare.length > 0) noi.set(cheie, valoare);
    }
    // `cursor` se pierde intenționat: filtrele noi înseamnă prima pagină.
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <form
      action={aplica}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={id.tip} className="text-sm font-medium">
          Tip
        </label>
        <select
          id={id.tip}
          name="tip"
          defaultValue={parametri.get("tip") ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Toate</option>
          {CHECKLIST_TIP.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.status} className="text-sm font-medium">
          Stare
        </label>
        <select
          id={id.status}
          name="status"
          defaultValue={parametri.get("status") ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Toate</option>
          {CHECKLIST_INSTANTA_STATUS.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_INSTANTA[s]}
            </option>
          ))}
        </select>
      </div>

      {angajati === null ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor={id.angajat} className="text-sm font-medium">
            Angajat
          </label>
          <select
            id={id.angajat}
            name="angajat"
            defaultValue={parametri.get("angajat") ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Toți</option>
            {angajati.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name ?? a.marca} ({a.marca})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={id.deLa} className="text-sm font-medium">
          De la
        </label>
        <input
          id={id.deLa}
          name="de_la"
          type="date"
          defaultValue={parametri.get("de_la") ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.panaLa} className="text-sm font-medium">
          Până la
        </label>
        <input
          id={id.panaLa}
          name="pana_la"
          type="date"
          defaultValue={parametri.get("pana_la") ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        <Search aria-hidden="true" className="size-4" />
        {inCurs ? "Se filtrează…" : "Filtrează"}
      </button>
    </form>
  );
}
