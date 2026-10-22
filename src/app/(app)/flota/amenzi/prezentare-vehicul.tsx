// src/app/(app)/flota/amenzi/prezentare-vehicul.tsx
//
// Amenzile și incidentele UNUI vehicul, ca secțiune a fișei lui (/flota/[id]).
// Componentă PURĂ (fără citiri), ca să se poată proba într-un DOM; datele le
// aduce `SectiuneAmenziVehicul`. `null` pe o parte = apelantul n-are dreptul de
// citire pe ea (`vehicle_fines:read` / `vehicle_incidents:read` = all, poarta
// politicilor din 0206): partea lipsește cu totul, nu apare goală — un tabel gol
// ar spune „vehiculul n-a avut amenzi”, ceea ce omul nu are de unde ști.

import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import {
  ETICHETE_STADIU_AMENDA,
  ETICHETE_STADIU_INCIDENT,
  ETICHETE_TIP_INCIDENT,
  verdictTermen,
} from "@/domain/fleet/amenzi";
import { formatDate, formatDateTime } from "@/lib/format/date";
import type { RandAmenda, RandIncident } from "@/lib/queries/flota-amenzi";

import { TON_STADIU_AMENDA, TON_STADIU_INCIDENT } from "./etichete";

/** Câte rânduri din fiecare parte se văd pe fișă; restul, în lista filtrată. */
export const RANDURI_PE_FISA = 5;

type Parte<T> = Readonly<{ randuri: readonly T[]; total: number }> | null;

interface Proprietati {
  readonly vehiculId: string;
  /** `AAAA-LL-ZZ`, ziua României: de ea depinde verdictul termenului. */
  readonly azi: string;
  readonly amenzi: Parte<RandAmenda>;
  readonly incidente: Parte<RandIncident>;
}

function textToate(total: number, singular: string, plural: string): string {
  if (total === 1) return `Singura ${singular} a vehiculului`;
  const de = total >= 20 && (total % 100 === 0 || total % 100 >= 20) ? "de " : "";
  return `Toate cele ${String(total)} ${de}${plural} ale vehiculului`;
}

const LEGATURA = "text-primary text-corp underline-offset-2 hover:underline";

export function PrezentareAmenziVehicul({
  vehiculId,
  azi,
  amenzi,
  incidente,
}: Proprietati): ReactElement | null {
  if (amenzi === null && incidente === null) return null;
  const vehicul = encodeURIComponent(vehiculId);

  return (
    <div className="space-y-6">
      {amenzi === null ? null : (
        <section aria-labelledby="amenzi-vehicul" className="space-y-3">
          <h2 id="amenzi-vehicul" className="text-sectiune font-semibold">
            Amenzi
          </h2>
          {amenzi.randuri.length === 0 ? (
            <p className="text-muted-foreground text-corp">
              Nicio amendă înregistrată pe acest vehicul.
            </p>
          ) : (
            <ul className="divide-border border-border rounded-panou divide-y border">
              {amenzi.randuri.map((a) => {
                const v = verdictTermen(a.termen_raspuns, a.stadiu, azi, a.raspuns_trimis_la);
                return (
                  <li key={a.id} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <Link href={`/flota/amenzi/${a.id}`} className={`${LEGATURA} font-medium`}>
                        {a.numar_pv}
                      </Link>
                      <p className="text-muted-foreground text-nota mt-0.5">
                        {formatDateTime(a.constatata_la)} · {a.fapta}
                      </p>
                      {v.stare === "nu_se_aplica" ? null : (
                        <p
                          className={
                            v.ton === "pericol"
                              ? "text-danger text-nota mt-0.5 font-medium"
                              : "text-muted-foreground text-nota mt-0.5"
                          }
                        >
                          {a.termen_raspuns === null
                            ? v.eticheta
                            : `Răspuns până la ${formatDate(a.termen_raspuns)}: ${v.eticheta}`}
                        </p>
                      )}
                    </div>
                    <Badge className="shrink-0" ton={TON_STADIU_AMENDA[a.stadiu]}>
                      {ETICHETE_STADIU_AMENDA[a.stadiu]}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
          {amenzi.total === 0 ? null : (
            <Link href={`/flota/amenzi?vehicul=${vehicul}`} className={LEGATURA}>
              {textToate(amenzi.total, "amendă", "amenzi")}
            </Link>
          )}
        </section>
      )}

      {incidente === null ? null : (
        <section aria-labelledby="incidente-vehicul" className="space-y-3">
          <h2 id="incidente-vehicul" className="text-sectiune font-semibold">
            Incidente și daune
          </h2>
          {incidente.randuri.length === 0 ? (
            <p className="text-muted-foreground text-corp">
              Niciun incident înregistrat pe acest vehicul.
            </p>
          ) : (
            <ul className="divide-border border-border rounded-panou divide-y border">
              {incidente.randuri.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <Link href={`/flota/incidente/${i.id}`} className={`${LEGATURA} font-medium`}>
                      {ETICHETE_TIP_INCIDENT[i.tip]} · {formatDateTime(i.produs_la)}
                    </Link>
                    <p className="text-muted-foreground text-nota mt-0.5 line-clamp-2">
                      {i.descriere}
                      {i.declarat_de_employee_id === null ? "" : " · declarat de șofer, din portal"}
                    </p>
                  </div>
                  <Badge className="shrink-0" ton={TON_STADIU_INCIDENT[i.stadiu]}>
                    {ETICHETE_STADIU_INCIDENT[i.stadiu]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {incidente.total === 0 ? null : (
            <Link href={`/flota/incidente?vehicul=${vehicul}`} className={LEGATURA}>
              Lista incidentelor vehiculului ({String(incidente.total)})
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
