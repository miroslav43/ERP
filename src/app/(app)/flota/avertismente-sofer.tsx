// src/app/(app)/flota/avertismente-sofer.tsx
import type { ReactElement } from "react";

import { Callout } from "@/components/ui/callout";
import {
  avertismenteSofer,
  type CursaPentruVerificare,
  type VehiculPentruPermis,
} from "@/domain/fleet/soferi";
import { orasulFirmei, verificariSoferi } from "@/lib/queries/soferi";

/**
 * Verificările încrucișate ale șoferului (0204, F9), ca avertisment pe ecran:
 * pe foaia de parcurs (în aplicație și în portal) și pe fișa vehiculului,
 * pentru șoferul curent. Componentă de SERVER: își citește singură faptele
 * (`public.verificari_soferi`), deci paginile o pun cu un singur rând.
 *
 * NU blochează nimic. Apelantul care n-are dreptul să afle starea șoferului
 * primește zero fapte, iar componenta nu randează nimic — nici un „totul e în
 * regulă” fals.
 */
interface Proprietati {
  readonly organizationId: string;
  readonly employeeId: string | null;
  /** Ziua judecată, `AAAA-LL-ZZ`. */
  readonly zi: string;
  readonly momentul?: "foaie" | "azi";
  readonly vehicul?: VehiculPentruPermis | null;
  /** Cursele foii; fără ele, verificarea de delegație nu rulează. */
  readonly curse?: readonly CursaPentruVerificare[];
  readonly legataDeDeplasare?: boolean;
  readonly titlu?: string;
}

export async function AvertismenteSofer({
  organizationId,
  employeeId,
  zi,
  momentul = "foaie",
  vehicul = null,
  curse,
  legataDeDeplasare = false,
  titlu = "De verificat la șofer",
}: Proprietati): Promise<ReactElement | null> {
  if (employeeId === null) return null;
  const [fapte, oras] = await Promise.all([
    verificariSoferi(organizationId, [employeeId], zi),
    curse === undefined || curse.length === 0
      ? Promise.resolve(null)
      : orasulFirmei(organizationId),
  ]);
  const aleLui = fapte.get(employeeId);
  if (aleLui === undefined) return null;

  const avertismente = avertismenteSofer({
    fapte: aleLui,
    zi,
    momentul,
    vehicul,
    ...(curse === undefined ? {} : { curse }),
    orasFirma: oras,
    legataDeDeplasare,
  });
  if (avertismente.length === 0) return null;

  return (
    <Callout fel="atentie" titlu={titlu}>
      <ul className="list-disc space-y-0.5 pl-5">
        {avertismente.map((a) => (
          <li key={a.cod}>{a.mesaj}</li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-1">
        {momentul === "azi"
          ? "Avertismentele nu blochează folosirea vehiculului: sunt pentru cine îl predă și pentru responsabilul de flotă."
          : "Avertismentele nu blochează foaia: sunt pentru cine o întocmește și pentru cine o aprobă."}
      </p>
    </Callout>
  );
}
