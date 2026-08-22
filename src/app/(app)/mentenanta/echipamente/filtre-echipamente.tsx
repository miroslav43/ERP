"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { STATUS_ECHIPAMENT } from "@/schemas/maintenance";
import { ETICHETE_STATUS_ECHIPAMENT } from "../etichete";

export function FiltreEchipamenteForm() {
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
    // `cursor` se pierde intenționat: filtrele noi înseamnă prima pagină.
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <form
      action={aplica}
      className="border-border flex flex-wrap items-end gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idCauta} className="text-sm font-medium">
          Cod sau denumire
        </label>
        <input
          id={idCauta}
          name="cauta"
          type="search"
          defaultValue={parametri.get("cauta") ?? ""}
          placeholder="Ex. CMP-014"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
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
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Toate</option>
          {STATUS_ECHIPAMENT.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_ECHIPAMENT[s]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={inCurs}
        className="border-foreground/60 hover:bg-surface disabled:border-border disabled:bg-surface disabled:text-muted-foreground inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
      >
        <Search aria-hidden="true" className="size-4" />
        {inCurs ? "Se filtrează…" : "Filtrează"}
      </button>
    </form>
  );
}
