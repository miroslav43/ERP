"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { STARI_OBIECT, STATUSURI_OBIECT } from "@/schemas/inventory";
import { ETICHETE_STARE, ETICHETE_STATUS } from "./etichete";

interface OptiuneCategorie {
  readonly id: string;
  readonly denumire: string;
}

interface Proprietati {
  readonly categorii: readonly OptiuneCategorie[];
}

export function FiltreInventar({ categorii }: Proprietati) {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idCautare = useId();
  const idNumar = useId();
  const idStatus = useId();
  const idStare = useId();
  const idCategorie = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const q = String(formular.get("q") ?? "").trim();
    const numar = String(formular.get("numar") ?? "").trim();
    const status = String(formular.get("status") ?? "");
    const stare = String(formular.get("stare") ?? "");
    const categoryId = String(formular.get("category_id") ?? "");
    if (q.length > 0) noi.set("q", q);
    if (numar.length > 0) noi.set("numar", numar);
    if (status.length > 0) noi.set("status", status);
    if (stare.length > 0) noi.set("stare", stare);
    if (categoryId.length > 0) noi.set("category_id", categoryId);
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <form
      action={aplica}
      role="search"
      aria-label="Filtrare inventar"
      className="flex flex-wrap items-end gap-4 rounded-lg border border-border p-4"
    >
      <div className="min-w-56 flex-1">
        <label htmlFor={idCautare} className="block text-sm font-medium">
          Caută după denumire
        </label>
        <div className="mt-1 flex items-center gap-2 rounded-md border border-foreground/60 px-2 focus-within:outline-2">
          <Search aria-hidden="true" className="size-4 text-muted-foreground" />
          <input
            id={idCautare}
            name="q"
            type="search"
            defaultValue={parametri.get("q") ?? ""}
            placeholder="Ex. Laptop Dell"
            className="w-full bg-transparent py-2 text-sm"
          />
        </div>
      </div>

      <div className="min-w-40">
        <label htmlFor={idNumar} className="block text-sm font-medium">
          Număr de inventar
        </label>
        <input
          id={idNumar}
          name="numar"
          type="search"
          defaultValue={parametri.get("numar") ?? ""}
          placeholder="Ex. INV-0042"
          className="mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor={idStatus} className="block text-sm font-medium">
          Stare de circuit
        </label>
        <select
          id={idStatus}
          name="status"
          defaultValue={parametri.get("status") ?? ""}
          className="mt-1 rounded-md border border-foreground/60 px-2 py-2 text-sm"
        >
          <option value="">Toate</option>
          {STATUSURI_OBIECT.map((status) => (
            <option key={status} value={status}>
              {ETICHETE_STATUS[status]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={idStare} className="block text-sm font-medium">
          Stare fizică
        </label>
        <select
          id={idStare}
          name="stare"
          defaultValue={parametri.get("stare") ?? ""}
          className="mt-1 rounded-md border border-foreground/60 px-2 py-2 text-sm"
        >
          <option value="">Toate</option>
          {STARI_OBIECT.map((stare) => (
            <option key={stare} value={stare}>
              {ETICHETE_STARE[stare]}
            </option>
          ))}
        </select>
      </div>

      {categorii.length > 0 ? (
        <div>
          <label htmlFor={idCategorie} className="block text-sm font-medium">
            Categorie
          </label>
          <select
            id={idCategorie}
            name="category_id"
            defaultValue={parametri.get("category_id") ?? ""}
            className="mt-1 rounded-md border border-foreground/60 px-2 py-2 text-sm"
          >
            <option value="">Toate</option>
            {categorii.map((optiune) => (
              <option key={optiune.id} value={optiune.id}>
                {optiune.denumire}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={inCurs}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
      >
        {inCurs ? "Se filtrează…" : "Aplică filtrele"}
      </button>
      <p aria-live="polite" className="sr-only">
        {inCurs ? "Se aplică filtrele." : "Filtre aplicate."}
      </p>
    </form>
  );
}
