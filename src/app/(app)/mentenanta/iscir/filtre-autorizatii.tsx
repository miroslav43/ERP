// src/app/(app)/mentenanta/iscir/filtre-autorizatii.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { ETICHETE_REGIM_ISCIR, REGIMURI_ISCIR, etichetaTipIscir } from "@/domain/maintenance/iscir";
import {
  FILTRE_STARE_AUTORIZATIE,
  type FiltreAutorizatii,
  type FiltruStareAutorizatie,
} from "@/schemas/maintenance";

export const ETICHETE_FILTRU_STARE_AUTORIZATIE: Readonly<Record<FiltruStareAutorizatie, string>> = {
  actiune: "Cer acțiune (expirate sau care expiră curând)",
  expirata: "Expirate",
  expira_curand: "Expiră curând",
  valabila: "Valabile",
  suspendata: "Suspendate",
};

/** `echipament` vine din fișa echipamentului; n-are câmp în bară, dar are pastilă. */
const CHEI_EXTERNE = ["echipament"] as const;
const CHEI_PROPRII = ["stare", "regim", "tip"] as const;

/**
 * Bara de filtre a listei ISCIR (M7). Server Component, ca bara intervențiilor:
 * fără stare și fără handler, deci fără `"use client"`. Opțiunile „Tip” sunt
 * tipurile FOLOSITE în firmă — și cele scrise liber înainte de 0193.
 */
export function FiltreAutorizatiiForm({
  filtre,
  tipuri,
  etichetaEchipament,
}: Readonly<{
  filtre: Pick<FiltreAutorizatii, "stare" | "regim" | "tip">;
  tipuri: readonly string[];
  etichetaEchipament?: string;
}>): ReactElement {
  const active: FiltruActiv[] = [];
  if (filtre.stare !== null) {
    active.push({
      cheie: "stare",
      eticheta: `Stare: ${ETICHETE_FILTRU_STARE_AUTORIZATIE[filtre.stare]}`,
    });
  }
  if (filtre.regim !== null) {
    active.push({ cheie: "regim", eticheta: `Regim: ${ETICHETE_REGIM_ISCIR[filtre.regim]}` });
  }
  if (filtre.tip !== null) {
    active.push({ cheie: "tip", eticheta: `Tip: ${etichetaTipIscir(filtre.tip)}` });
  }
  if (etichetaEchipament !== undefined) {
    active.push({ cheie: "echipament", eticheta: `Echipament: ${etichetaEchipament}` });
  }

  // Tipul filtrat rămâne opțiune chiar dacă a dispărut din firmă între timp,
  // altfel selectul ar arăta „Toate” peste o listă filtrată.
  const optiuniTip =
    filtre.tip === null || tipuri.includes(filtre.tip) ? tipuri : [filtre.tip, ...tipuri];

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII} cheiExterne={CHEI_EXTERNE}>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-iscir-stare" className="text-corp font-medium">
          Stare
        </label>
        <select
          // `key` legat de adresă: ștergerea unei pastile nu atinge formularul.
          key={filtre.stare ?? ""}
          id="filtru-iscir-stare"
          name="stare"
          defaultValue={filtre.stare ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {FILTRE_STARE_AUTORIZATIE.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_FILTRU_STARE_AUTORIZATIE[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-iscir-regim" className="text-corp font-medium">
          Regim
        </label>
        <select
          key={filtre.regim ?? ""}
          id="filtru-iscir-regim"
          name="regim"
          defaultValue={filtre.regim ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {REGIMURI_ISCIR.map((r) => (
            <option key={r} value={r}>
              {ETICHETE_REGIM_ISCIR[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-iscir-tip" className="text-corp font-medium">
          Tip
        </label>
        <select
          key={filtre.tip ?? ""}
          id="filtru-iscir-tip"
          name="tip"
          defaultValue={filtre.tip ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {optiuniTip.map((t) => (
            <option key={t} value={t}>
              {etichetaTipIscir(t)}
            </option>
          ))}
        </select>
      </div>
    </BaraFiltre>
  );
}
