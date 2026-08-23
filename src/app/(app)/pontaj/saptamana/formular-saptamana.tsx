// src/app/(app)/pontaj/saptamana/formular-saptamana.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { TIPURI_PREZENTA, type TipPrezenta } from "@/schemas/attendance";
import { ETICHETE_TIP_PREZENTA } from "../etichete";
import { trimiteSaptamanaPontaj } from "./actions";

interface ZiFormular {
  readonly data: string;
  readonly tip_prezenta: TipPrezenta;
  readonly ore_planificate: string;
  readonly observatii: string;
}

interface Proprietati {
  readonly saptamanaStart: string;
  readonly zileInitiale: readonly ZiFormular[];
  readonly poateEdita: boolean;
}

const ETICHETE_ZI = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"] as const;

export function FormularSaptamana({ saptamanaStart, zileInitiale, poateEdita }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [zile, setZile] = useState<readonly ZiFormular[]>(zileInitiale);
  const idBaza = useId();

  function actualizeazaZi(index: number, campuri: Partial<ZiFormular>): void {
    setZile((curent) => curent.map((zi, i) => (i === index ? { ...zi, ...campuri } : zi)));
  }

  function trimite(status: "ciorna" | "trimisa"): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await trimiteSaptamanaPontaj({
        saptamana_start: saptamanaStart,
        status,
        zile: zile.map((zi) => ({
          data: zi.data,
          tip_prezenta: zi.tip_prezenta,
          ore_planificate: Number(zi.ore_planificate),
          observatii: zi.observatii.length === 0 ? null : zi.observatii,
        })),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="border-border rounded-panou overflow-x-auto border">
        <table className="text-corp w-full">
          <caption className="sr-only">Planul de prezență pentru săptămâna selectată.</caption>
          <thead className="bg-surface text-left">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Zi
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Cum vin la lucru
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Ore planificate
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Observații
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {zile.map((zi, index) => (
              <tr key={zi.data}>
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {ETICHETE_ZI[index]}
                  <span className="text-muted-foreground ml-1.5 font-normal">
                    {new Date(`${zi.data}T00:00:00Z`).toLocaleDateString("ro-RO", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Mod de prezență — ${ETICHETE_ZI[index]}`}
                    value={zi.tip_prezenta}
                    disabled={!poateEdita || inCurs}
                    onChange={(e) => {
                      actualizeazaZi(index, { tip_prezenta: e.target.value as TipPrezenta });
                    }}
                    className="border-foreground/60 disabled:bg-surface rounded-control text-corp border px-2 py-1.5 disabled:cursor-not-allowed"
                  >
                    {TIPURI_PREZENTA.map((t) => (
                      <option key={t} value={t}>
                        {ETICHETE_TIP_PREZENTA[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Ore planificate — ${ETICHETE_ZI[index]}`}
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={zi.ore_planificate}
                    disabled={!poateEdita || inCurs}
                    onChange={(e) => {
                      actualizeazaZi(index, { ore_planificate: e.target.value });
                    }}
                    className="border-foreground/60 disabled:bg-surface rounded-control text-corp w-20 border px-2 py-1.5 disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Observații — ${ETICHETE_ZI[index]}`}
                    type="text"
                    maxLength={500}
                    value={zi.observatii}
                    disabled={!poateEdita || inCurs}
                    onChange={(e) => {
                      actualizeazaZi(index, { observatii: e.target.value });
                    }}
                    className="border-foreground/60 disabled:bg-surface rounded-control text-corp w-full min-w-32 border px-2 py-1.5 disabled:cursor-not-allowed"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div aria-live="polite">
        {eroare === null ? null : <p className="text-danger text-corp">{eroare}</p>}
      </div>

      {poateEdita ? (
        <div className="flex flex-wrap gap-2">
          <Buton
            varianta="secundar"
            disabled={inCurs}
            onClick={() => {
              trimite("ciorna");
            }}
            id={idBaza}
          >
            Salvează ciornă
          </Buton>
          <Buton
            varianta="primar"
            inCurs={inCurs}
            textInCurs="Se trimite…"
            onClick={() => {
              trimite("trimisa");
            }}
          >
            Trimite spre aprobare
          </Buton>
        </div>
      ) : null}
    </div>
  );
}
