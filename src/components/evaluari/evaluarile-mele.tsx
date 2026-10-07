// src/components/evaluari/evaluarile-mele.tsx

/**
 * Evaluările finalizate ale unui om: evoluția în timp și fiecare evaluare, cu
 * nota pe criteriu, comentariile și concluzia.
 *
 * Folosit de DOUĂ pagini, cu același conținut: `/portal/evaluarile-mele`
 * (rolul `employee`, singurul care intră în portal) și `/evaluari/ale-mele`
 * (manager, HR, administrator — evaluați și ei, dar fără portal). O singură
 * randare, ca cele două să nu spună lucruri diferite despre aceeași evaluare.
 *
 * Primește DOAR evaluări finalizate; filtrarea e la pagină.
 *
 * Diferența față de evaluarea precedentă se arată doar când AMÂNDOUĂ sunt pe
 * același șablon: 80 % pe patru criterii și 70 % pe zece nu se scad între ele.
 */

import { ClipboardCheck } from "lucide-react";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Nivel } from "@/components/ui/nivel";
import { StareGoala } from "@/components/ui/stare-goala";
import type { CriteriuSablon } from "@/domain/evaluations/criterii";
import type { RaspunsCriteriu } from "@/domain/evaluations/scor";
import { formatDate } from "@/lib/format/date";
import type { EvaluareAngajat } from "@/lib/queries/evaluari";

import { tonPunctaj } from "@/app/(app)/evaluari/etichete";

/** Ce s-a răspuns la un criteriu, în cuvinte. Nenotat e „—”, nu „0”. */
function raspunsInCuvinte(criteriu: CriteriuSablon, raspuns: RaspunsCriteriu): string {
  if (criteriu.tip === "text") return raspuns.raspuns_text ?? "—";
  if (raspuns.scor === null) return "—";
  if (criteriu.tip === "da_nu") return raspuns.scor > 0 ? "Da" : "Nu";
  return `${String(raspuns.scor)} din ${String(criteriu.scala_max)}`;
}

/** „+6 pp” / „−4 pp” față de precedenta pe același șablon; altfel nimic. */
function diferenta(
  curenta: EvaluareAngajat,
  precedenta: EvaluareAngajat | undefined,
): Readonly<{ text: string; ton: "bun" | "rau" | "neutru" }> | null {
  if (precedenta === undefined || precedenta.sablon !== curenta.sablon) return null;
  const a = curenta.punctaj.procent;
  const b = precedenta.punctaj.procent;
  if (a === null || b === null) return null;
  const d = a - b;
  if (d === 0) return { text: "la fel ca data trecută", ton: "neutru" };
  return {
    text: `${d > 0 ? "+" : "−"}${String(Math.abs(d))} puncte față de data trecută`,
    ton: d > 0 ? "bun" : "rau",
  };
}

export function EvaluarileMele({
  evaluari,
}: Readonly<{ evaluari: readonly EvaluareAngajat[] }>): ReactElement {
  // Cele mai noi întâi; evoluția le întoarce cronologic.
  const cronologic = [...evaluari].reverse();
  return (
    <>
      {evaluari.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={ClipboardCheck}
          titlu="Nicio evaluare finalizată încă"
          descriere="Când managerul finalizează o evaluare a dumneavoastră, primiți o notificare și o găsiți aici."
        />
      ) : (
        <>
          {cronologic.length > 1 ? (
            <section aria-labelledby="titlu-evolutie" className="space-y-2">
              <h2
                id="titlu-evolutie"
                className="text-eticheta text-muted-foreground font-semibold tracking-wide uppercase"
              >
                Evoluția în timp
              </h2>
              <ol className="divide-foreground/10 border-foreground/15 divide-y rounded-lg border">
                {cronologic.map((e, i) => {
                  const d = diferenta(e, cronologic[i - 1]);
                  return (
                    <li key={e.id} className="space-y-1 p-3">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <a href={`#evaluare-${e.id}`} className="font-medium hover:underline">
                          {formatDate(e.data_evaluarii)}
                        </a>
                        <span className="text-muted-foreground text-nota">
                          {e.sablon ?? "Șablon șters"}
                        </span>
                        {d === null ? null : (
                          <span
                            className={
                              d.ton === "bun"
                                ? "text-success text-nota ms-auto"
                                : d.ton === "rau"
                                  ? "text-danger text-nota ms-auto"
                                  : "text-muted-foreground text-nota ms-auto"
                            }
                          >
                            {d.text}
                          </span>
                        )}
                      </div>
                      {e.punctaj.procent === null ? (
                        <p className="text-muted-foreground text-nota">fără note punctate</p>
                      ) : (
                        <Nivel
                          valoare={e.punctaj.procent}
                          din={100}
                          marime="subtire"
                          ton={tonPunctaj(e.punctaj.procent)}
                          eticheta={`Punctajul evaluării din ${formatDate(e.data_evaluarii)}`}
                          text={`${String(e.punctaj.procent)} %`}
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          <section aria-labelledby="titlu-evaluari" className="space-y-3">
            <h2
              id="titlu-evaluari"
              className="text-eticheta text-muted-foreground font-semibold tracking-wide uppercase"
            >
              {evaluari.length === 1
                ? "Evaluarea"
                : `Toate evaluările (${String(evaluari.length)})`}
            </h2>
            <ul className="space-y-4">
              {evaluari.map((e) => {
                const criteriiDupaCod = new Map(e.criterii.map((c) => [c.cod, c]));
                return (
                  <li
                    key={e.id}
                    id={`evaluare-${e.id}`}
                    className="border-foreground/15 bg-card scroll-mt-20 space-y-3 rounded-lg border p-4"
                  >
                    <header className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{e.sablon ?? "Șablon șters"}</h3>
                      <span className="text-muted-foreground text-nota">
                        {formatDate(e.data_evaluarii)}
                      </span>
                      <Badge ton="succes">Finalizată</Badge>
                    </header>

                    {e.punctaj.procent === null ? null : (
                      <div className="space-y-1">
                        <p className="text-2xl font-semibold tabular-nums">{e.punctaj.procent} %</p>
                        <Nivel
                          valoare={e.punctaj.procent}
                          din={100}
                          ton={tonPunctaj(e.punctaj.procent)}
                          eticheta={`Punctajul evaluării din ${formatDate(e.data_evaluarii)}`}
                          text={
                            e.punctaj.necompletate === 0
                              ? `${String(e.punctaj.procent)} %`
                              : `${String(e.punctaj.procent)} % pe ${String(e.punctaj.completate)} din ${String(e.criterii.length)} criterii`
                          }
                        />
                      </div>
                    )}

                    {/* Criteriile vin din INSTANTANEUL evaluării: denumirea și
                        scala sunt cele de la notare, nu din șablonul de azi. */}
                    <ul className="divide-foreground/10 divide-y">
                      {e.raspunsuri.map((r) => {
                        const criteriu = criteriiDupaCod.get(r.criteriu_cod);
                        if (criteriu === undefined) return null;
                        return (
                          <li key={r.criteriu_cod} className="space-y-1 py-2">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-medium">{criteriu.denumire}</span>
                              <span className="ms-auto tabular-nums">
                                {raspunsInCuvinte(criteriu, r)}
                              </span>
                            </div>
                            {r.comentariu === null ? null : (
                              <p className="text-muted-foreground text-nota">{r.comentariu}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {e.concluzie === null ? null : (
                      <div className="border-foreground/15 rounded-lg border p-3">
                        <p className="text-eticheta text-muted-foreground mb-1 font-semibold tracking-wide uppercase">
                          Concluzia evaluatorului
                        </p>
                        <p className="text-corp whitespace-pre-line">{e.concluzie}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
