"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { STATUSURI_DEPLASARE } from "@/schemas/per-diem";
import { ETICHETE_STATUS_DEPLASARE } from "./etichete";

export function FiltreDeplasari() {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idStatus = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const status = String(formular.get("status") ?? "");
    if (status.length > 0) noi.set("status", status);
    // `cursor` se pierde intenționat: un filtru nou înseamnă prima pagină.
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
          {STATUSURI_DEPLASARE.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_DEPLASARE[s]}
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
