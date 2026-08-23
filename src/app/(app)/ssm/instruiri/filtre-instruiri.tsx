"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { cn } from "@/lib/ui/cn";
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
      <div
        role="tablist"
        aria-label="Domeniu"
        className="border-foreground/60 rounded-control inline-flex border"
      >
        {DOMENII_SSM.map((d) => (
          <Buton
            key={d}
            role="tab"
            aria-selected={domeniuCurent === d}
            varianta={domeniuCurent === d ? "primar" : "tertiar"}
            onClick={() => {
              schimbaDomeniu(d);
            }}
            className={cn(
              "first:rounded-l-control last:rounded-r-control rounded-none",
              domeniuCurent === d ? "" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {ETICHETE_DOMENIU[d]}
          </Buton>
        ))}
      </div>

      <form
        action={aplica}
        className="border-border rounded-panou flex flex-wrap items-end gap-3 border p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={idCauta} className="text-corp font-medium">
            Caută angajat
          </label>
          <input
            id={idCauta}
            name="q"
            type="search"
            defaultValue={parametri.get("q") ?? ""}
            placeholder="Nume angajat"
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <Buton type="submit" varianta="secundar" inCurs={inCurs} textInCurs="Se filtrează…">
          Filtrează
        </Buton>
      </form>
    </div>
  );
}
