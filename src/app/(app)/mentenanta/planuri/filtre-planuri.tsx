// src/app/(app)/mentenanta/planuri/filtre-planuri.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { FILTRE_SCADENTA_PLAN, TIPURI_MENTENANTA, type FiltrePlanuri } from "@/schemas/maintenance";

import { ETICHETE_FILTRU_SCADENTA_PLAN, ETICHETE_TIP_MENTENANTA } from "../etichete";

/**
 * Cheile administrate de bară. `sort`, `limita` și `cursor` NU sunt aici: bara
 * pleacă din parametrii existenți și nu poate șterge decât ce i s-a declarat,
 * deci ordinea aleasă din antetul tabelului supraviețuiește unei filtrări.
 */
const CHEI_PROPRII = ["echipament", "tip", "responsabil", "activ", "scadenta"] as const;

export interface OptiuneFiltruPlan {
  readonly id: string;
  readonly nume: string;
}

export type PropsFiltrePlanuri = Readonly<{
  /** Filtrele DEJA validate de pagină, ca pastilele să nu arate valori inventate. */
  filtre: Pick<FiltrePlanuri, "echipament" | "tip" | "responsabil" | "activ" | "scadenta">;
  echipamente: readonly OptiuneFiltruPlan[];
  responsabili: readonly OptiuneFiltruPlan[];
}>;

const CLASA_CONTROL = "border-foreground/60 rounded-control text-corp border px-3 py-2";

const ETICHETE_ACTIV = { da: "Active", nu: "Inactive", toate: "Toate" } as const;

/**
 * Server Component: fără stare și fără handler, deci fără `"use client"`.
 *
 * `activ` lipsă din adresă înseamnă „active” (implicitul ecranului), nu „toate”
 * — de aceea pastila pentru `da` NU apare: ar fi o pastilă permanentă, cu un
 * „×” care nu schimbă nimic vizibil. Apare doar pentru `nu` și `toate`.
 */
export function FiltrePlanuriForm({
  filtre,
  echipamente,
  responsabili,
}: PropsFiltrePlanuri): ReactElement {
  const active: FiltruActiv[] = [];
  if (filtre.echipament !== null) {
    const nume = echipamente.find((e) => e.id === filtre.echipament)?.nume ?? "ales";
    active.push({ cheie: "echipament", eticheta: `Echipament: ${nume}` });
  }
  if (filtre.tip !== null) {
    active.push({ cheie: "tip", eticheta: `Tip: ${ETICHETE_TIP_MENTENANTA[filtre.tip]}` });
  }
  if (filtre.responsabil !== null) {
    const nume = responsabili.find((r) => r.id === filtre.responsabil)?.nume ?? "ales";
    active.push({ cheie: "responsabil", eticheta: `Responsabil: ${nume}` });
  }
  if (filtre.activ !== null && filtre.activ !== "da") {
    active.push({ cheie: "activ", eticheta: `Planuri: ${ETICHETE_ACTIV[filtre.activ]}` });
  }
  if (filtre.scadenta !== null) {
    active.push({
      cheie: "scadenta",
      eticheta: `Scadență: ${ETICHETE_FILTRU_SCADENTA_PLAN[filtre.scadenta]}`,
    });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII}>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-planuri-echipament" className="text-corp font-medium">
          Echipament
        </label>
        <select
          // `key` legat de valoarea din adresă: ștergerea unei pastile schimbă
          // adresa fără să atingă formularul, iar un control NECONTROLAT și-ar
          // păstra în DOM valoarea veche, deja scoasă din listă.
          key={filtre.echipament ?? ""}
          id="filtru-planuri-echipament"
          name="echipament"
          defaultValue={filtre.echipament ?? ""}
          className={CLASA_CONTROL}
        >
          <option value="">Toate</option>
          {echipamente.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-planuri-tip" className="text-corp font-medium">
          Tip
        </label>
        <select
          key={filtre.tip ?? ""}
          id="filtru-planuri-tip"
          name="tip"
          defaultValue={filtre.tip ?? ""}
          className={CLASA_CONTROL}
        >
          <option value="">Toate</option>
          {TIPURI_MENTENANTA.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_MENTENANTA[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-planuri-responsabil" className="text-corp font-medium">
          Responsabil
        </label>
        <select
          key={filtre.responsabil ?? ""}
          id="filtru-planuri-responsabil"
          name="responsabil"
          defaultValue={filtre.responsabil ?? ""}
          className={CLASA_CONTROL}
        >
          <option value="">Oricine</option>
          {responsabili.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-planuri-scadenta" className="text-corp font-medium">
          Scadență pe zile
        </label>
        <select
          key={filtre.scadenta ?? ""}
          id="filtru-planuri-scadenta"
          name="scadenta"
          defaultValue={filtre.scadenta ?? ""}
          className={CLASA_CONTROL}
        >
          <option value="">Oricare</option>
          {FILTRE_SCADENTA_PLAN.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_FILTRU_SCADENTA_PLAN[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-planuri-activ" className="text-corp font-medium">
          Planuri
        </label>
        <select
          key={filtre.activ ?? "da"}
          id="filtru-planuri-activ"
          name="activ"
          defaultValue={filtre.activ ?? "da"}
          className={CLASA_CONTROL}
        >
          <option value="da">{ETICHETE_ACTIV.da}</option>
          <option value="nu">{ETICHETE_ACTIV.nu}</option>
          <option value="toate">{ETICHETE_ACTIV.toate}</option>
        </select>
      </div>
    </BaraFiltre>
  );
}
