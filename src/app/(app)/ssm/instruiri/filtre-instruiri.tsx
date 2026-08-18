"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DOMENII_SSM } from "@/schemas/ssm";

import { ETICHETE_DOMENIU } from "../etichete";

/**
 * Tab obligatoriu SSM/PSI — implicit „ssm" — plus căutare după numele
 * angajatului. Niciun ecran nu amestecă cele două domenii: sunt obligații
 * legale distincte, cu periodicități proprii.
 */
export function FiltreInstruiri() {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idCauta = useId();

  const domeniuCurent = parametri.get("domeniu") === "psi" ? "psi" : "ssm";

  function schimbaDomeniu(domeniu: string): void {
    const noi = new URLSearchParams(parametri.toString());
    noi.set("domeniu", domeniu);
    noi.delete("cursor");
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    noi.set("domeniu", domeniuCurent);
    const q = String(formular.get("q") ?? "").trim();
    if (q.length > 0) noi.set("q", q);
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Domeniu" className="inline-flex rounded-md border border-foreground/60">
        {DOMENII_SSM.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={domeniuCurent === d}
            onClick={() => {
              schimbaDomeniu(d);
            }}
            className={
              domeniuCurent === d
                ? "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                : "px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {ETICHETE_DOMENIU[d]}
          </button>
        ))}
      </div>

      <form
        action={aplica}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={idCauta} className="text-sm font-medium">
            Caută angajat
          </label>
          <input
            id={idCauta}
            name="q"
            type="search"
            defaultValue={parametri.get("q") ?? ""}
            placeholder="Nume angajat"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={inCurs}
          className="rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          {inCurs ? "Se filtrează…" : "Filtrează"}
        </button>
      </form>
    </div>
  );
}
