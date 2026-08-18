// src/app/(app)/concedii/filtre-cereri.tsx
"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { STATUSURI_CERERE } from "@/schemas/leave";
import { ETICHETE_STATUS_CERERE } from "./etichete";

interface OptiuneTip {
  readonly id: string;
  readonly denumire: string;
}

export function FiltreCereri({ tipuri }: { readonly tipuri: readonly OptiuneTip[] }) {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idStatus = useId();
  const idTip = useId();
  const idDeLa = useId();
  const idPanaLa = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const status = String(formular.get("status") ?? "");
    const leaveTypeId = String(formular.get("leave_type_id") ?? "");
    const deLa = String(formular.get("de_la") ?? "");
    const panaLa = String(formular.get("pana_la") ?? "");
    if (status.length > 0) noi.set("status", status);
    if (leaveTypeId.length > 0) noi.set("leave_type_id", leaveTypeId);
    if (deLa.length > 0) noi.set("de_la", deLa);
    if (panaLa.length > 0) noi.set("pana_la", panaLa);
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <form
      action={aplica}
      role="search"
      aria-label="Filtrare cereri de concediu"
      className="flex flex-wrap items-end gap-4 rounded-lg border border-border p-4"
    >
      <div>
        <label htmlFor={idStatus} className="block text-sm font-medium">
          Stare
        </label>
        <select
          id={idStatus}
          name="status"
          defaultValue={parametri.get("status") ?? ""}
          className="mt-1 rounded-md border border-foreground/60 px-2 py-2 text-sm"
        >
          <option value="">Toate</option>
          {STATUSURI_CERERE.map((status) => (
            <option key={status} value={status}>
              {ETICHETE_STATUS_CERERE[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-48">
        <label htmlFor={idTip} className="block text-sm font-medium">
          Tip de concediu
        </label>
        <select
          id={idTip}
          name="leave_type_id"
          defaultValue={parametri.get("leave_type_id") ?? ""}
          className="mt-1 w-full rounded-md border border-foreground/60 px-2 py-2 text-sm"
        >
          <option value="">Toate</option>
          {tipuri.map((tip) => (
            <option key={tip.id} value={tip.id}>
              {tip.denumire}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={idDeLa} className="block text-sm font-medium">
          De la
        </label>
        <input
          id={idDeLa}
          name="de_la"
          type="date"
          defaultValue={parametri.get("de_la") ?? ""}
          className="mt-1 rounded-md border border-foreground/60 px-2 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor={idPanaLa} className="block text-sm font-medium">
          Până la
        </label>
        <input
          id={idPanaLa}
          name="pana_la"
          type="date"
          defaultValue={parametri.get("pana_la") ?? ""}
          className="mt-1 rounded-md border border-foreground/60 px-2 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
      >
        <Search aria-hidden="true" className="size-4" />
        {inCurs ? "Se filtrează…" : "Aplică filtrele"}
      </button>
      <p aria-live="polite" className="sr-only">
        {inCurs ? "Se aplică filtrele." : "Filtre aplicate."}
      </p>
    </form>
  );
}
