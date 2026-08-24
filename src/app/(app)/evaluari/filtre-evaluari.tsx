// src/app/(app)/evaluari/filtre-evaluari.tsx

/**
 * Filtrele listei de evaluări.
 *
 * Server Component: fără stare proprie și fără handler, `"use client"` n-ar
 * avea ce să acopere. `BaraFiltre` face singură navigarea, din `name`-urile
 * câmpurilor.
 */

import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { clasaControl } from "@/components/ui/camp";
import { formatDate } from "@/lib/format/date";
import { STATUSURI_EVALUARE, type FiltreEvaluariUrl } from "@/schemas/evaluation";

import { ETICHETE_STATUS_EVALUARE } from "./etichete";

const CHEI_PROPRII = ["status", "template_id", "de_la", "pana_la"] as const;

export type PropsFiltreEvaluari = Readonly<{
  filtre: Pick<FiltreEvaluariUrl, "status" | "template_id" | "de_la" | "pana_la">;
  sabloane: readonly Readonly<{ id: string; denumire: string }>[];
}>;

export function FiltreEvaluari({ filtre, sabloane }: PropsFiltreEvaluari): ReactElement {
  const active: FiltruActiv[] = [];
  if (filtre.status !== null) {
    active.push({
      cheie: "status",
      eticheta: `Stare: ${ETICHETE_STATUS_EVALUARE[filtre.status]}`,
    });
  }
  if (filtre.template_id !== null) {
    // Denumirea, nu identificatorul: o pastilă cu un UUID nu spune nimic.
    const sablon = sabloane.find((s) => s.id === filtre.template_id);
    active.push({
      cheie: "template_id",
      eticheta: `Șablon: ${sablon?.denumire ?? "necunoscut"}`,
    });
  }
  if (filtre.de_la !== null) {
    active.push({ cheie: "de_la", eticheta: `De la ${formatDate(filtre.de_la)}` });
  }
  if (filtre.pana_la !== null) {
    active.push({ cheie: "pana_la", eticheta: `Până la ${formatDate(filtre.pana_la)}` });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII}>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-evaluari-status" className="text-corp font-medium">
          Stare
        </label>
        <select
          // `key` legat de valoarea din adresă: ștergerea unei pastile schimbă
          // adresa fără să atingă formularul, iar un control necontrolat și-ar
          // păstra în DOM valoarea veche.
          key={filtre.status ?? ""}
          id="filtru-evaluari-status"
          name="status"
          defaultValue={filtre.status ?? ""}
          className={clasaControl({ fel: "select" })}
        >
          <option value="">Toate</option>
          {STATUSURI_EVALUARE.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_EVALUARE[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-evaluari-sablon" className="text-corp font-medium">
          Șablon
        </label>
        <select
          key={filtre.template_id ?? ""}
          id="filtru-evaluari-sablon"
          name="template_id"
          defaultValue={filtre.template_id ?? ""}
          className={clasaControl({ fel: "select" })}
        >
          <option value="">Toate</option>
          {sabloane.map((s) => (
            <option key={s.id} value={s.id}>
              {s.denumire}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-evaluari-de-la" className="text-corp font-medium">
          De la
        </label>
        <input
          key={filtre.de_la ?? ""}
          id="filtru-evaluari-de-la"
          name="de_la"
          type="date"
          defaultValue={filtre.de_la ?? ""}
          className={clasaControl()}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-evaluari-pana-la" className="text-corp font-medium">
          Până la
        </label>
        <input
          key={filtre.pana_la ?? ""}
          id="filtru-evaluari-pana-la"
          name="pana_la"
          type="date"
          defaultValue={filtre.pana_la ?? ""}
          className={clasaControl()}
        />
      </div>
    </BaraFiltre>
  );
}
