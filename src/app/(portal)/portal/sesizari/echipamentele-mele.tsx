// src/app/(portal)/portal/sesizari/echipamentele-mele.tsx
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format/date";
import { cheieContor, echipamenteleMele, ultimeleCitiriCuData } from "@/lib/queries/maintenance";
import { TIPURI_CONTOR, type TipContor } from "@/schemas/maintenance";
import {
  ETICHETE_STATUS_ECHIPAMENT,
  ETICHETE_TIP_CONTOR,
  TONURI_STATUS_ECHIPAMENT,
  formatContor,
} from "@/app/(app)/mentenanta/etichete";

import { DialogCitireRapida } from "./dialog-citire-rapida";

/**
 * „Echipamentele în grija mea”: utilajele pe care angajatul e responsabil
 * (0182 i le arată prin RLS), cu ultima citire pe fiecare contor și caseta de
 * citire rapidă. Fără niciun utilaj, secțiunea nu apare.
 */
export async function EchipamenteleMele({
  organizationId,
  fisaId,
  azi,
}: Readonly<{
  organizationId: string;
  fisaId: string;
  azi: string;
}>): Promise<ReactElement | null> {
  const echipamente = await echipamenteleMele(organizationId, fisaId);
  if (echipamente.length === 0) return null;
  const ultimele = await ultimeleCitiriCuData(
    organizationId,
    echipamente.map((e) => e.id),
  );

  return (
    <section aria-labelledby="echipamentele-mele" className="space-y-2">
      <h2 id="echipamentele-mele" className="text-corp font-semibold">
        Echipamentele în grija mea
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {echipamente.map((e) => {
          const citiri = TIPURI_CONTOR.map((tip) => ({
            tip,
            u: ultimele.get(cheieContor(e.id, tip)),
          })).filter((c): c is { tip: TipContor; u: NonNullable<typeof c.u> } => c.u !== undefined);
          const tipImplicit: TipContor = citiri[0]?.tip ?? "ore";
          return (
            <li key={e.id} className="bg-surface border-border rounded-panou space-y-2 border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-foreground text-corp font-medium">
                    {e.cod} · {e.denumire}
                  </p>
                  {e.locatie === null ? null : (
                    <p className="text-muted-foreground text-nota">{e.locatie}</p>
                  )}
                </div>
                <Badge className="shrink-0" ton={TONURI_STATUS_ECHIPAMENT[e.status]}>
                  {ETICHETE_STATUS_ECHIPAMENT[e.status]}
                </Badge>
              </div>
              {citiri.length === 0 ? (
                <p className="text-muted-foreground text-nota">Niciun contor citit încă.</p>
              ) : (
                <ul className="text-nota text-muted-foreground space-y-0.5">
                  {citiri.map((c) => (
                    <li key={c.tip}>
                      {ETICHETE_TIP_CONTOR[c.tip]}: {formatContor(c.u.citire, c.tip)} ·{" "}
                      {formatDate(c.u.data_citirii)}
                    </li>
                  ))}
                </ul>
              )}
              <DialogCitireRapida
                echipament={{ id: e.id, cod: e.cod, denumire: e.denumire }}
                fisaId={fisaId}
                tipImplicit={tipImplicit}
                azi={azi}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
