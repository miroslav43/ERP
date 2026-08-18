"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

interface Departament {
  readonly id: string;
  readonly denumire: string;
}

interface Proprietati {
  readonly an: number;
  readonly departamente: readonly Departament[];
}

const LUNI_ETICHETE = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

/**
 * Filtrele foii colective: an, lună, departament, căutare după nume.
 *
 * `departamente` goală (rolul curent nu are `departments:read`, sau
 * organizația nu are niciunul activ) ⇒ selectul de departament nu se
 * randează deloc — un filtru care nu ar întoarce niciodată o alegere e mai
 * rău decât lipsa lui.
 */
export function FiltrePontaj({ an, departamente }: Proprietati) {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idAn = useId();
  const idLuna = useId();
  const idDepartament = useId();
  const idCauta = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const anAles = String(formular.get("an") ?? "");
    const luna = String(formular.get("luna") ?? "");
    const departament = String(formular.get("departament") ?? "");
    const cauta = String(formular.get("cauta") ?? "").trim();
    if (anAles.length > 0) noi.set("an", anAles);
    if (luna.length > 0) noi.set("luna", luna);
    if (departament.length > 0) noi.set("departament", departament);
    if (cauta.length > 0) noi.set("cauta", cauta);
    // `cursor` se pierde intenționat: filtre noi înseamnă prima pagină.
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
        <label htmlFor={idAn} className="text-sm font-medium">
          An
        </label>
        <input
          id={idAn}
          name="an"
          type="number"
          min={2000}
          max={2100}
          defaultValue={an}
          className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idLuna} className="text-sm font-medium">
          Luna
        </label>
        <select
          id={idLuna}
          name="luna"
          defaultValue={parametri.get("luna") ?? ""}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {LUNI_ETICHETE.map((eticheta, index) => (
            <option key={eticheta} value={index + 1}>
              {eticheta}
            </option>
          ))}
        </select>
      </div>

      {departamente.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor={idDepartament} className="text-sm font-medium">
            Departament
          </label>
          <select
            id={idDepartament}
            name="departament"
            defaultValue={parametri.get("departament") ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Toate</option>
            {departamente.map((d) => (
              <option key={d.id} value={d.id}>
                {d.denumire}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={idCauta} className="text-sm font-medium">
          Angajat
        </label>
        <input
          id={idCauta}
          name="cauta"
          type="search"
          defaultValue={parametri.get("cauta") ?? ""}
          placeholder="Nume angajat"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
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
