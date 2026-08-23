"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Buton } from "@/components/ui/buton";
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
      className="border-border rounded-panou flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idCauta} className="text-corp font-medium">
          Cod stingător
        </label>
        <input
          id={idCauta}
          name="cauta"
          type="search"
          defaultValue={parametri.get("cauta") ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idStatus} className="text-corp font-medium">
          Stare
        </label>
        <select
          id={idStatus}
          name="status"
          defaultValue={parametri.get("status") ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {STATUS_STINGATOR.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_STINGATOR[s]}
            </option>
          ))}
        </select>
      </div>

      <Buton type="submit" varianta="secundar" inCurs={inCurs} textInCurs="Se filtrează…">
        <Search aria-hidden="true" className="size-4" />
        Filtrează
      </Buton>
    </form>
  );
}
