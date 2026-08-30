// src/app/(app)/concedii/setari/tabel-reguli.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { formatAmount } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import { ocupatiaDupaCod } from "@/domain/hr/cor-nomenclator";
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
      if (regula.cod_cor === null) return "Funcție: —";
      return `Funcție: ${ocupatiaDupaCod(regula.cod_cor)?.denumire ?? regula.cod_cor}`;
    default:
      return ETICHETE_CRITERIU_GRILA[regula.tip_criteriu];
  }
}

export function TabelReguli({
  reguli,
  tipuri,
  departamente,
}: {
  readonly reguli: readonly RegulaConcediuRand[];
  readonly tipuri: readonly TipConcediuConfigurabil[];
  readonly departamente: readonly OptiuneNomenclator[];
}) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  const hartaTipuri = new Map(tipuri.map((t) => [t.id, t.denumire]));
  const hartaDepartamente = new Map(departamente.map((d) => [d.id, d.denumire]));

  function dezactiveaza(id: string): void {
    porneste(async () => {
      await dezactiveazaRegulaConcediu({ id });
      router.refresh();
    });
  }

  const reguliActive = reguli.filter((r) => r.activ);

  const coloane: readonly Coloana<RegulaConcediuRand>[] = [
    {
      cheie: "tip",
      antet: "Tip de concediu",
      peTelefon: "meta",
      celula: (regula) => hartaTipuri.get(regula.leave_type_id) ?? "—",
    },
    {
      cheie: "denumire",
      antet: "Denumire",
      peTelefon: "titlu",
      celula: (regula) => regula.denumire,
    },
    {
      cheie: "criteriu",
      antet: "Criteriu",
      peTelefon: "meta",
      celula: (regula) => (
        <span className="text-muted-foreground">{descrieCriteriu(regula, hartaDepartamente)}</span>
      ),
    },
    {
      cheie: "zile",
      antet: "Zile suplimentare",
      numeric: true,
      peTelefon: "meta",
      celula: (regula) => (
        <span className="font-medium">+{formatAmount(regula.zile_suplimentare)}</span>
      ),
    },
    {
      cheie: "valabil",
      antet: "Valabilă de la",
      peTelefon: "meta",
      celula: (regula) => (
        <span className="text-muted-foreground">
          {formatDate(regula.valabil_de_la)}
          {regula.valabil_pana_la === null ? "" : ` – ${formatDate(regula.valabil_pana_la)}`}
        </span>
      ),
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      antetAscuns: true,
      latime: "ingusta",
      peTelefon: "insigna",
      celula: (regula) => (
        <Buton
          varianta="distructiv"
          disabled={inCurs}
          onClick={() => {
            dezactiveaza(regula.id);
          }}
        >
          Dezactivează
        </Buton>
      ),
    },
  ];

  return (
    <Tabel
      caption="Grilele de zile suplimentare configurate."
      coloane={coloane}
      randuri={reguliActive}
      cheieRand={(regula) => regula.id}
      densitate="compact"
      gol={
        <p className="text-muted-foreground text-corp">
          Nicio grilă configurată încă — toți angajații primesc doar baza tipului de concediu.
        </p>
      }
    />
  );
}
