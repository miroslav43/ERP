"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { REZULTATE_INTERVENTIE, TIPURI_MENTENANTA } from "@/schemas/maintenance";
import { ETICHETE_REZULTAT_INTERVENTIE, ETICHETE_TIP_MENTENANTA } from "../etichete";

export function FiltreInterventiiForm() {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idTip = useId();
  const idRezultat = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const tip = String(formular.get("tip") ?? "");
    const rezultat = String(formular.get("rezultat") ?? "");
    if (tip.length > 0) noi.set("tip", tip);
    if (rezultat.length > 0) noi.set("rezultat", rezultat);
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
        <label htmlFor={idTip} className="text-sm font-medium">
          Tip
        </label>
        <select
          id={idTip}
          name="tip"
          defaultValue={parametri.get("tip") ?? ""}
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        >
          <option value="">Toate</option>
          {TIPURI_MENTENANTA.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_MENTENANTA[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idRezultat} className="text-sm font-medium">
          Rezultat
        </label>
        <select
          id={idRezultat}
          name="rezultat"
          defaultValue={parametri.get("rezultat") ?? ""}
          className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
        >
          <option value="">Toate</option>
          {REZULTATE_INTERVENTIE.map((r) => (
            <option key={r} value={r}>
              {ETICHETE_REZULTAT_INTERVENTIE[r]}
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
