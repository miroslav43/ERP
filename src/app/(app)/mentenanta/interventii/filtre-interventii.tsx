"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Buton } from "@/components/ui/buton";
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
      className="border-border rounded-panou flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idTip} className="text-corp font-medium">
          Tip
        </label>
        <select
          id={idTip}
          name="tip"
          defaultValue={parametri.get("tip") ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
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
        <label htmlFor={idRezultat} className="text-corp font-medium">
          Rezultat
        </label>
        <select
          id={idRezultat}
          name="rezultat"
          defaultValue={parametri.get("rezultat") ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {REZULTATE_INTERVENTIE.map((r) => (
            <option key={r} value={r}>
              {ETICHETE_REZULTAT_INTERVENTIE[r]}
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
