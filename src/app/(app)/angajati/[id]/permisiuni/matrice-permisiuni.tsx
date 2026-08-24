"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PermissionScope } from "@/config/permissions";

import { suprascriePermisiunea } from "./actions";

/**
 * Matricea de suprascrieri, un rând per permisiune.
 *
 * Fiecare rând arată DOUĂ lucruri, nu unul: ce dă rolul și ce s-a decis peste el.
 * Fără prima, cine acordă nu poate ști dacă schimbarea lui adaugă ceva sau doar
 * repetă implicitul — iar o suprascriere identică cu rolul e zgomot care va
 * rămâne în urmă când rolul se schimbă.
 */

export interface RandPermisiune {
  readonly cheie: string;
  readonly resursa: string;
  readonly actiune: string;
  /** Ce dă rolul, fără nicio suprascriere. `null` = nimic. */
  readonly implicit: PermissionScope | null;
  /** Ce s-a decis pentru acest membru. `null` = fără suprascriere. */
  readonly suprascris: PermissionScope | null;
}

const ETICHETE_SCOPE: Readonly<Record<PermissionScope, string>> = {
  none: "Refuzat explicit",
  own: "Doar ale lui",
  team: "Echipa lui",
  all: "Toată firma",
};

const OPTIUNI: readonly PermissionScope[] = ["none", "own", "team", "all"];

export function MatricePermisiuni({
  memberId,
  randuri,
  poateScrie,
}: {
  readonly memberId: string;
  readonly randuri: readonly RandPermisiune[];
  readonly poateScrie: boolean;
}) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [inLucru, setInLucru] = useState<string | null>(null);
  const [, porneste] = useTransition();
  const idBaza = useId();

  function schimba(cheie: string, valoare: string): void {
    setEroare(null);
    setInLucru(cheie);
    porneste(async () => {
      const rezultat = await suprascriePermisiunea({
        memberId,
        cheie,
        scope: valoare === "implicit" ? null : (valoare as PermissionScope),
      });
      setInLucru(null);
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  // Grupate pe resursă: nimeni nu caută „inventory:update" printre 68 de rânduri
  // plate, dar toată lumea caută „inventar".
  const peResursa = new Map<string, RandPermisiune[]>();
  for (const rand of randuri) {
    const grup = peResursa.get(rand.resursa) ?? [];
    grup.push(rand);
    peResursa.set(rand.resursa, grup);
  }

  return (
    <div className="space-y-6">
      {eroare === null ? null : (
        <p
          role="alert"
          aria-live="assertive"
          className="border-danger/40 bg-danger/10 text-foreground rounded-control text-corp border p-3"
        >
          {eroare}
        </p>
      )}

      {[...peResursa.entries()].map(([resursa, grup]) => (
        <section key={resursa} className="space-y-2">
          <h2 className="text-foreground text-corp font-semibold">{resursa}</h2>
          <ul className="divide-border border-border rounded-panou divide-y border">
            {grup.map((rand) => {
              const idCamp = `${idBaza}-${rand.cheie}`;
              const valoare = rand.suprascris ?? "implicit";
              const modificat = rand.suprascris !== null;
              return (
                <li
                  key={rand.cheie}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <label htmlFor={idCamp} className="text-foreground text-corp font-medium">
                      {rand.actiune}
                    </label>
                    <p className="text-muted-foreground text-nota">
                      Rolul dă: {rand.implicit === null ? "nimic" : ETICHETE_SCOPE[rand.implicit]}
                      {modificat ? " · suprascris" : null}
                    </p>
                  </div>
                  <select
                    id={idCamp}
                    value={valoare}
                    disabled={!poateScrie || inLucru === rand.cheie}
                    onChange={(e) => {
                      schimba(rand.cheie, e.target.value);
                    }}
                    className={
                      "rounded-control text-corp disabled:bg-surface disabled:text-muted-foreground min-h-11 border px-3 py-2 disabled:cursor-not-allowed " +
                      (modificat ? "border-primary text-foreground" : "border-foreground/40")
                    }
                  >
                    <option value="implicit">Ca la rol</option>
                    {OPTIUNI.map((scope) => (
                      <option key={scope} value={scope}>
                        {ETICHETE_SCOPE[scope]}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
