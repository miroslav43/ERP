// src/app/(app)/pontaj/alerta-absente.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import type { SerieAbsenteNemotivate } from "@/lib/queries/attendance";

import { emiteSuspendareAbsente } from "./actions";

/**
 * Seriile de absențe nemotivate care încă n-au o decizie de suspendare.
 *
 * NU suspendă singură nimic. Absența nemotivată suspendă contractul de drept,
 * dar declararea ei la Inspecția Muncii e un act pe care îl semnează un om — o
 * suspendare transmisă și apoi retrasă e o corecție de registru pe care o vede
 * toată lumea. Panoul semnalează de la a doua zi consecutivă și oferă butonul;
 * intervalul rămâne al celui care decide.
 *
 * Sfârșitul se lasă gol în mod normal: suspendarea se închide singură când
 * pontajul primește ore lucrate, adică atunci când aplicația află, prima, că
 * omul s-a întors.
 */
export function AlertaAbsente({ serii }: { readonly serii: readonly SerieAbsenteNemotivate[] }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState<string | null>(null);
  const [sfarsit, setSfarsit] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const idSfarsit = useId();

  if (serii.length === 0) return null;

  function emite(serie: SerieAbsenteNemotivate): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await emiteSuspendareAbsente({
        employee_id: serie.employeeId,
        data_inceput: serie.dataInceput,
        data_sfarsit: sfarsit.length === 0 ? null : sfarsit,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(null);
      setSfarsit("");
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="alerta-absente-titlu"
      className="border-warning/40 bg-warning/12 rounded-control flex flex-col gap-3 border p-4"
    >
      <h2 id="alerta-absente-titlu" className="text-corp flex items-center gap-2 font-semibold">
        <TriangleAlert aria-hidden="true" className="size-4" />
        Absențe nemotivate fără decizie de suspendare
      </h2>
      <p className="text-corp-mic text-secundar">
        Absența nemotivată suspendă contractul, iar suspendarea se transmite în REGES în cel mult 3
        zile lucrătoare de la prima zi. Verificați fiecare caz înainte de a emite decizia.
      </p>

      <ul className="flex flex-col gap-2">
        {serii.map((serie) => (
          <li
            key={`${serie.employeeId}-${serie.dataInceput}`}
            className="border-hairline bg-suprafata rounded-control flex flex-col gap-2 border p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-corp font-medium">{serie.numeAngajat}</span>
              <span className="text-corp-mic text-secundar tabular-nums">
                {serie.zile} zile · {serie.dataInceput} → {serie.dataSfarsit}
              </span>
            </div>

            {deschis === serie.employeeId ? (
              <div className="flex flex-col gap-2">
                <label className="text-corp-mic text-secundar" htmlFor={idSfarsit}>
                  Sfârșitul suspendării — lăsați gol dacă salariatul încă lipsește
                </label>
                <input
                  id={idSfarsit}
                  type="date"
                  value={sfarsit}
                  min={serie.dataInceput}
                  onChange={(e) => {
                    setSfarsit(e.target.value);
                  }}
                  className="border-hairline rounded-control text-corp border px-2 py-1"
                />
                <div className="flex flex-wrap gap-2">
                  <Buton
                    varianta="primar"
                    inCurs={inCurs}
                    textInCurs="Se emite…"
                    onClick={() => {
                      emite(serie);
                    }}
                  >
                    Emite decizia
                  </Buton>
                  <Buton
                    varianta="secundar"
                    onClick={() => {
                      setDeschis(null);
                    }}
                  >
                    Renunță
                  </Buton>
                </div>
              </div>
            ) : (
              <div>
                <Buton
                  varianta="secundar"
                  onClick={() => {
                    setDeschis(serie.employeeId);
                    setSfarsit("");
                    setEroare(null);
                  }}
                >
                  Emite decizie suspendare
                </Buton>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div aria-live="polite">
        {eroare === null ? null : <p className="text-danger text-corp">{eroare}</p>}
      </div>
    </section>
  );
}
