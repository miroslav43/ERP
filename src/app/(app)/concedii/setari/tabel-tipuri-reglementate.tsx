// src/app/(app)/concedii/setari/tabel-tipuri-reglementate.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { formatAmount } from "@/lib/format/money";
import type { TipConcediuConfigurabil } from "@/lib/queries/leave";

import { comutaActivTipConcediu } from "./actions";

/**
 * Doar comutatorul `activ` scrie ceva — orice altă schimbare e respinsă de
 * `internal.leave_types_protejeaza_reglementat` (0035_reguli_concediu.sql),
 * de aceea celelalte coloane sunt text simplu, nu câmpuri de formular.
 */
export function TabelTipuriReglementate({
  tipuri,
}: {
  readonly tipuri: readonly TipConcediuConfigurabil[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  function comuta(id: string, activ: boolean): void {
    porneste(async () => {
      await comutaActivTipConcediu({ id, activ });
      router.refresh();
    });
  }

  if (tipuri.length === 0) {
    return <p className="text-muted-foreground text-sm">Niciun tip reglementat configurat.</p>;
  }

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Tipurile de concediu reglementate legal.</caption>
        <thead className="bg-surface text-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Tip de concediu
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Zile
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Temei legal
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Activ
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {tipuri.map((tip) => (
            <tr key={tip.id}>
              <td className="px-4 py-2">
                <span
                  className="mr-2 inline-block size-2.5 rounded-full align-middle"
                  style={{ backgroundColor: tip.culoare }}
                  aria-hidden="true"
                />
                {tip.denumire}
                <Lock aria-hidden="true" className="text-muted-foreground ml-2 inline size-3.5" />
              </td>
              <td className="px-4 py-2 tabular-nums">{formatAmount(tip.zile_implicite)}</td>
              <td className="text-muted-foreground px-4 py-2">{tip.temei_legal ?? "—"}</td>
              <td className="px-4 py-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tip.activ}
                    disabled={inCurs}
                    onChange={(e) => {
                      comuta(tip.id, e.target.checked);
                    }}
                  />
                  <span className="sr-only">Activ pentru {tip.denumire}</span>
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
