// src/app/(app)/concedii/setari/tabel-reguli.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatAmount } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import type {
  OptiuneNomenclator,
  RegulaConcediuRand,
  TipConcediuConfigurabil,
} from "@/lib/queries/leave";

import { dezactiveazaRegulaConcediu } from "./actions";
import {
  ETICHETE_CRITERIU_GRILA,
  ETICHETE_VALOARE_CONDITII_MUNCA,
  ETICHETE_VALOARE_GRAD_HANDICAP,
} from "../etichete";

function descrieCriteriu(
  regula: RegulaConcediuRand,
  hartaDepartamente: ReadonlyMap<string, string>,
  hartaFunctii: ReadonlyMap<string, string>,
): string {
  switch (regula.tip_criteriu) {
    case "vechime":
      return `Vechime ≥ ${String(regula.vechime_ani_min ?? 0)} ani`;
    case "conditii_munca":
      return ETICHETE_VALOARE_CONDITII_MUNCA[regula.valoare_text ?? ""] ?? "Condiții de muncă";
    case "grad_handicap":
      return ETICHETE_VALOARE_GRAD_HANDICAP[regula.valoare_text ?? ""] ?? "Grad de handicap";
    case "varsta_sub_18":
      return "Sub 18 ani";
    case "departament":
      return `Departament: ${hartaDepartamente.get(regula.department_id ?? "") ?? "—"}`;
    case "functie":
      return `Funcție: ${hartaFunctii.get(regula.job_position_id ?? "") ?? "—"}`;
    default:
      return ETICHETE_CRITERIU_GRILA[regula.tip_criteriu];
  }
}

export function TabelReguli({
  reguli,
  tipuri,
  departamente,
  functii,
}: {
  readonly reguli: readonly RegulaConcediuRand[];
  readonly tipuri: readonly TipConcediuConfigurabil[];
  readonly departamente: readonly OptiuneNomenclator[];
  readonly functii: readonly OptiuneNomenclator[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  const hartaTipuri = new Map(tipuri.map((t) => [t.id, t.denumire]));
  const hartaDepartamente = new Map(departamente.map((d) => [d.id, d.denumire]));
  const hartaFunctii = new Map(functii.map((f) => [f.id, f.denumire]));

  function dezactiveaza(id: string): void {
    porneste(async () => {
      await dezactiveazaRegulaConcediu({ id });
      router.refresh();
    });
  }

  const reguliActive = reguli.filter((r) => r.activ);

  if (reguliActive.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nicio grilă configurată încă — toți angajații primesc doar baza tipului de concediu.
      </p>
    );
  }

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Grilele de zile suplimentare configurate.</caption>
        <thead className="bg-surface text-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Tip de concediu
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Denumire
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Criteriu
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Zile suplimentare
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Valabilă de la
            </th>
            <th scope="col" className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {reguliActive.map((regula) => (
            <tr key={regula.id}>
              <td className="px-4 py-2">{hartaTipuri.get(regula.leave_type_id) ?? "—"}</td>
              <td className="px-4 py-2">{regula.denumire}</td>
              <td className="text-muted-foreground px-4 py-2">
                {descrieCriteriu(regula, hartaDepartamente, hartaFunctii)}
              </td>
              <td className="px-4 py-2 font-medium tabular-nums">
                +{formatAmount(regula.zile_suplimentare)}
              </td>
              <td className="text-muted-foreground px-4 py-2">
                {formatDate(regula.valabil_de_la)}
                {regula.valabil_pana_la === null ? "" : ` – ${formatDate(regula.valabil_pana_la)}`}
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  type="button"
                  disabled={inCurs}
                  onClick={() => {
                    dezactiveaza(regula.id);
                  }}
                  className="text-danger text-xs disabled:opacity-40"
                >
                  Dezactivează
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
