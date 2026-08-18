"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { CATEGORII_VEHICUL, STATUS_VEHICUL } from "@/schemas/fleet";
import { ETICHETE_CATEGORIE, ETICHETE_STATUS_VEHICUL } from "./etichete";

export function FiltreVehicule() {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idCauta = useId();
  const idStatus = useId();
  const idCategorie = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const cauta = String(formular.get("cauta") ?? "").trim();
    const status = String(formular.get("status") ?? "");
    const categorie = String(formular.get("categorie") ?? "");
    if (cauta.length > 0) noi.set("cauta", cauta);
    if (status.length > 0) noi.set("status", status);
    if (categorie.length > 0) noi.set("categorie", categorie);
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
        <label htmlFor={idCauta} className="text-sm font-medium">
          Număr de înmatriculare
        </label>
        <input
          id={idCauta}
          name="cauta"
          type="search"
          defaultValue={parametri.get("cauta") ?? ""}
          placeholder="B 123 ABC"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Toate</option>
          {STATUS_VEHICUL.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_VEHICUL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCategorie} className="text-sm font-medium">
          Categorie
        </label>
        <select
          id={idCategorie}
          name="categorie"
          defaultValue={parametri.get("categorie") ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Toate</option>
          {CATEGORII_VEHICUL.map((c) => (
            <option key={c} value={c}>
              {ETICHETE_CATEGORIE[c]}
            </option>
          ))}
        </select>
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
