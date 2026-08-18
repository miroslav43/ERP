"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { STATUS_STINGATOR } from "@/schemas/ssm";

import { ETICHETE_STATUS_STINGATOR } from "../etichete";

export function FiltreStingatoare() {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idCauta = useId();
  const idStatus = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const cauta = String(formular.get("cauta") ?? "").trim();
    const status = String(formular.get("status") ?? "");
    if (cauta.length > 0) noi.set("cauta", cauta);
    if (status.length > 0) noi.set("status", status);
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <form
      action={aplica}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idCauta} className="text-sm font-medium">
          Cod stingător
        </label>
        <input
          id={idCauta}
          name="cauta"
          type="search"
          defaultValue={parametri.get("cauta") ?? ""}
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idStatus} className="text-sm font-medium">
          Stare
        </label>
        <select
          id={idStatus}
          name="status"
          defaultValue={parametri.get("status") ?? ""}
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        >
          <option value="">Toate</option>
          {STATUS_STINGATOR.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_STINGATOR[s]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="inline-flex items-center gap-2 rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
      >
        <Search aria-hidden="true" className="size-4" />
        {inCurs ? "Se filtrează…" : "Filtrează"}
      </button>
    </form>
  );
}
