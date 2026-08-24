// src/app/(app)/concedii/setari/tabel-tipuri-reglementate.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { Tabel, type Coloana } from "@/components/ui/tabel";
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

  const coloane: readonly Coloana<TipConcediuConfigurabil>[] = [
    {
      cheie: "tip",
      antet: "Tip de concediu",
      peTelefon: "titlu",
      celula: (tip) => (
        <>
          <span
            className="mr-2 inline-block size-2.5 rounded-full align-middle"
            style={{ backgroundColor: tip.culoare }}
            aria-hidden="true"
          />
          {tip.denumire}
          <Lock aria-hidden="true" className="text-muted-foreground ml-2 inline size-3.5" />
        </>
      ),
    },
    {
      cheie: "zile",
      antet: "Zile",
      numeric: true,
      peTelefon: "meta",
      celula: (tip) => formatAmount(tip.zile_implicite),
    },
    {
      cheie: "temei",
      antet: "Temei legal",
      peTelefon: "meta",
      celula: (tip) => <span className="text-muted-foreground">{tip.temei_legal ?? "—"}</span>,
    },
    {
      cheie: "activ",
      antet: "Activ",
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (tip) => (
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
      ),
    },
  ];

  return (
    <Tabel
      caption="Tipurile de concediu reglementate legal."
      coloane={coloane}
      randuri={tipuri}
      cheieRand={(tip) => tip.id}
      densitate="compact"
      gol={<p className="text-muted-foreground text-corp">Niciun tip reglementat configurat.</p>}
    />
  );
}
