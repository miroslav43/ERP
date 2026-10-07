"use client";

import { useRouter } from "next/navigation";
import { useCallback, useId, type ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { formatDate } from "@/lib/format/date";
import type { TipContor } from "@/schemas/maintenance";

import { inregistreazaCitiri, type RezultatCitireLot } from "../echipamente/actions";
import { ETICHETE_TIP_CONTOR, formatContor } from "../etichete";

export interface RandContor {
  readonly equipment_id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly tip: TipContor;
  readonly ultima: Readonly<{ citire: number; data_citirii: string }> | null;
  /** Peste pragul de zile fără citire din setări. */
  readonly restant: boolean;
  readonly zileDeLaUltima: number | null;
}

type Rezultat = Readonly<{
  reusite: number;
  refuzate: number;
  randuri: readonly RezultatCitireLot[];
}>;

/**
 * Citirile în lot: o dată, un câmp per (echipament, contor), un singur
 * „Salvează citirile”. Câmpurile goale nu se trimit. Raportul vine pe rând:
 * ce a intrat, ce a refuzat garda și de ce — fără ca o valoare greșită să le
 * oprească pe celelalte nouăsprezece.
 */
export function FormularCitiriLot({
  randuri,
  azi,
}: Readonly<{ randuri: readonly RandContor[]; azi: string }>): ReactElement {
  const router = useRouter();
  const id = useId();
  const laReusita = useCallback(() => {
    router.refresh();
  }, [router]);

  async function trimite(date: FormData) {
    const citiri: { equipment_id: string; tip: string; citire: string }[] = [];
    for (const r of randuri) {
      const v = String(date.get(`citire:${r.equipment_id}:${r.tip}`) ?? "").trim();
      if (v.length > 0) citiri.push({ equipment_id: r.equipment_id, tip: r.tip, citire: v });
    }
    return inregistreazaCitiri({ data_citirii: String(date.get("data_citirii") ?? ""), citiri });
  }

  const cheie = (r: RezultatCitireLot): string => `${r.equipment_id}:${r.tip}`;

  return (
    <Formular actiune={trimite} laReusita={laReusita}>
      {(stare) => {
        const rezultat = stare.data as Rezultat | null;
        const raport = new Map((rezultat?.randuri ?? []).map((r) => [cheie(r), r]));
        return (
          // `min-w-0`: copilul unui flex (`Formular`) are `min-width: auto`, deci
          // tabelul lat l-ar fi împins dincolo de ecran în loc să deruleze în
          // containerul lui — pagina întreagă se lărgea cu 55 px pe telefon.
          <div className="min-w-0 space-y-4">
            {rezultat !== null ? (
              <Callout
                fel={rezultat.refuzate === 0 ? "neutru" : "atentie"}
                titlu={
                  rezultat.refuzate === 0
                    ? `${String(rezultat.reusite)} ${rezultat.reusite === 1 ? "citire salvată" : "citiri salvate"}.`
                    : `${String(rezultat.reusite)} salvate, ${String(rezultat.refuzate)} refuzate.`
                }
              >
                {rezultat.refuzate === 0
                  ? "Planurile pe contor și-au recalculat scadențele."
                  : "Rândurile refuzate au motivul scris lângă ele; corectați-le și salvați din nou — cele deja salvate nu se repetă dacă lăsați câmpul gol."}
              </Callout>
            ) : null}

            <div className="max-w-xs">
              <Camp
                nume="data_citirii"
                id={`${id}-data`}
                eticheta="Data citirilor"
                obligatoriu
                erori={stare.erori["data_citirii"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    max={azi}
                    defaultValue={stare.valoriTrimise["data_citirii"] ?? azi}
                  />
                )}
              </Camp>
            </div>

            {/* `relative`: etichetele `sr-only` din celule stau în containerul
                derulabil, altfel ancorele lor târăsc pagina lateral. */}
            <div className="border-border rounded-panou relative max-w-full overflow-x-auto border">
              <table className="text-corp w-full">
                <caption className="sr-only">
                  Contoarele echipamentelor, cu ultima citire și câmpul pentru cea nouă.
                </caption>
                <thead className="bg-surface text-muted-foreground text-nota text-left">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Echipament
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Contor
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Ultima citire
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Citirea nouă
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {randuri.map((r) => {
                    const numeCamp = `citire:${r.equipment_id}:${r.tip}`;
                    const rez = raport.get(`${r.equipment_id}:${r.tip}`);
                    return (
                      <tr
                        key={numeCamp}
                        className={rez !== undefined && !rez.ok ? "bg-danger/8" : ""}
                      >
                        <td className="px-3 py-2">
                          <span className="font-medium">{r.cod}</span>{" "}
                          <span className="text-muted-foreground">{r.denumire}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex flex-wrap items-center gap-1">
                            {ETICHETE_TIP_CONTOR[r.tip]}
                            {r.restant ? (
                              <Badge ton="atentie" cuAvertisment>
                                Necitit de {String(r.zileDeLaUltima ?? 0)} zile
                              </Badge>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.ultima === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              {formatContor(r.ultima.citire, r.tip)}
                              <span className="text-muted-foreground text-nota block">
                                {formatDate(r.ultima.data_citirii)}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <label htmlFor={`${id}-${numeCamp}`} className="sr-only">
                            Citirea nouă pentru {r.cod}, {ETICHETE_TIP_CONTOR[r.tip]}
                          </label>
                          <input
                            id={`${id}-${numeCamp}`}
                            name={numeCamp}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            className="border-foreground/60 rounded-control text-corp w-36 border px-3 py-1.5"
                            defaultValue={
                              rez !== undefined && !rez.ok
                                ? (stare.valoriTrimise[numeCamp] ?? "")
                                : ""
                            }
                            aria-invalid={rez !== undefined && !rez.ok ? true : undefined}
                          />
                          {rez !== undefined && !rez.ok ? (
                            <p role="alert" className="text-danger text-nota mt-1">
                              {rez.mesaj}
                            </p>
                          ) : null}
                          {rez !== undefined && rez.ok ? (
                            <p className="text-success text-nota mt-1">Salvată.</p>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <BaraActiuni aliniere="final">
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                Salvează citirile
              </Buton>
            </BaraActiuni>
          </div>
        );
      }}
    </Formular>
  );
}
