// src/app/(app)/evaluari/_components/file-evaluari.tsx

/**
 * Banda de file a modulului.
 *
 * Stă într-un fișier propriu fiindcă o poartă amândouă paginile, iar o copie
 * ar diverge la prima filă adăugată — exact felul de divergență care a produs
 * `122 de <header> scrise de mână` înainte de redesign.
 *
 * Contorul e absent, nu zero, când nu e nimic de arătat: `Fila` nu randează
 * pastila pentru zero, fiindcă un „0" afișat e zgomot, nu informație.
 */

import type { ReactElement } from "react";

import { BandaFile, Fila } from "@/components/ui/file";

export type FilaEvaluari = "evaluari" | "kpi" | "sabloane";

export function FileEvaluari({
  activa,
  nrEvaluari,
  nrKpi,
  nrSabloane,
}: Readonly<{
  activa: FilaEvaluari;
  nrEvaluari?: number;
  nrKpi?: number;
  nrSabloane?: number;
}>): ReactElement {
  return (
    <BandaFile eticheta="Secțiunile modulului de evaluări">
      <Fila
        href="/evaluari"
        activ={activa === "evaluari"}
        {...(nrEvaluari === undefined ? {} : { contor: nrEvaluari })}
      >
        Evaluări
      </Fila>
      <Fila
        href="/evaluari/kpi"
        activ={activa === "kpi"}
        {...(nrKpi === undefined ? {} : { contor: nrKpi })}
      >
        KPI lunar
      </Fila>
      <Fila
        href="/evaluari/sabloane"
        activ={activa === "sabloane"}
        {...(nrSabloane === undefined ? {} : { contor: nrSabloane })}
      >
        Șabloane
      </Fila>
    </BandaFile>
  );
}
