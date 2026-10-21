// src/app/(app)/flota/amenzi/sectiune-vehicul.tsx
//
// Componentă de SERVER: citește amenzile și incidentele unui vehicul (ultimele
// `RANDURI_PE_FISA`, cu totalul) și le dă prezentării. Fiecare parte se citește
// DOAR pentru cine are dreptul ei de citire la `all` — poarta politicilor
// `vehicle_fines_select` / `vehicle_incidents_select` din 0206. Altfel baza ar
// întoarce zero rânduri (sau, la incidente, doar declarațiile proprii ale
// șoferului) și ecranul ar spune, fals, „nicio amendă”. HR nu are cheile
// (decizia 3 a planului): nu vede nici parcul, nici amenzile.

import type { ReactElement } from "react";

import { listeazaAmenzi, listeazaIncidente } from "@/lib/queries/flota-amenzi";

import { PrezentareAmenziVehicul, RANDURI_PE_FISA } from "./prezentare-vehicul";

interface Proprietati {
  readonly organizationId: string;
  readonly vehiculId: string;
  readonly vedeAmenzi: boolean;
  readonly vedeIncidente: boolean;
  /** `AAAA-LL-ZZ`, ziua României. */
  readonly azi: string;
}

export async function SectiuneAmenziVehicul({
  organizationId,
  vehiculId,
  vedeAmenzi,
  vedeIncidente,
  azi,
}: Proprietati): Promise<ReactElement | null> {
  if (!vedeAmenzi && !vedeIncidente) return null;
  const pagina = { cursor: null, limita: RANDURI_PE_FISA } as const;
  const [amenzi, incidente] = await Promise.all([
    vedeAmenzi
      ? listeazaAmenzi(organizationId, { stadiu: null, vehicul: vehiculId, ...pagina })
      : Promise.resolve(null),
    vedeIncidente
      ? listeazaIncidente(organizationId, { stadiu: null, vehicul: vehiculId, ...pagina })
      : Promise.resolve(null),
  ]);
  return (
    <PrezentareAmenziVehicul
      vehiculId={vehiculId}
      azi={azi}
      amenzi={amenzi === null ? null : { randuri: amenzi.randuri, total: amenzi.total }}
      incidente={incidente === null ? null : { randuri: incidente.randuri, total: incidente.total }}
    />
  );
}
