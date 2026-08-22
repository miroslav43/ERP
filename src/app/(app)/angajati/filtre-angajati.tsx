// src/app/(app)/angajati/filtre-angajati.tsx
"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { STATUSURI_ANGAJAT } from "@/schemas/employee";
import { ETICHETE_STATUS } from "./etichete";

export function FiltreAngajati() {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idCautare = useId();
  const idStatus = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const q = String(formular.get("q") ?? "").trim();
    const status = String(formular.get("status") ?? "");
    if (q.length > 0) noi.set("q", q);
    if (status.length > 0) noi.set("status", status);
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <form
      action={aplica}
      role="search"
      aria-label="Filtrare angajați"
      className="border-border flex flex-wrap items-end gap-4 rounded-lg border p-4"
    >
      <div className="min-w-56 flex-1">
        <label htmlFor={idCautare} className="block text-sm font-medium">
          Caută după nume
        </label>
        <div className="border-foreground/60 mt-1 flex items-center gap-2 rounded-md border px-2 focus-within:outline-2">
          <Search aria-hidden="true" className="text-muted-foreground size-4" />
          <input
            id={idCautare}
            name="q"
            type="search"
            defaultValue={parametri.get("q") ?? ""}
            placeholder="Ex. Popescu"
            className="w-full bg-transparent py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor={idStatus} className="block text-sm font-medium">
          Stare
        </label>
        <select
          id={idStatus}
          name="status"
          defaultValue={parametri.get("status") ?? ""}
          className="border-foreground/60 mt-1 rounded-md border px-2 py-2 text-sm"
        >
          <option value="">Toate</option>
          {STATUSURI_ANGAJAT.map((status) => (
            <option key={status} value={status}>
              {ETICHETE_STATUS[status]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="bg-primary text-primary-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
      >
        {inCurs ? "Se filtrează…" : "Aplică filtrele"}
      </button>
      <p aria-live="polite" className="sr-only">
        {inCurs ? "Se aplică filtrele." : "Filtre aplicate."}
      </p>
    </form>
  );
}
