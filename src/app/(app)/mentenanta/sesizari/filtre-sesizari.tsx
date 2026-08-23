"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { STATUSURI_SESIZARE, URGENTE_SESIZARE } from "@/schemas/maintenance";
import { ETICHETE_STATUS_SESIZARE, ETICHETE_URGENTA_SESIZARE } from "../etichete";

export function FiltreSesizariForm() {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idStatus = useId();
  const idUrgenta = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const status = String(formular.get("status") ?? "");
    const urgenta = String(formular.get("urgenta") ?? "");
    if (status.length > 0) noi.set("status", status);
    if (urgenta.length > 0) noi.set("urgenta", urgenta);
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
          {STATUSURI_SESIZARE.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_SESIZARE[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idUrgenta} className="text-corp font-medium">
          Urgență
        </label>
        <select
          id={idUrgenta}
          name="urgenta"
          defaultValue={parametri.get("urgenta") ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {URGENTE_SESIZARE.map((u) => (
            <option key={u} value={u}>
              {ETICHETE_URGENTA_SESIZARE[u]}
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
