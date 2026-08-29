// src/app/(onboarding)/loading.tsx
import type { ReactElement } from "react";

import { Schelet } from "@/components/ui/schelet";

/**
 * `/bun-venit` e primul ecran pe care îl vede vreodată un administrator nou, iar
 * `/firma-in-configurare` e ecranul de așteptare al colegilor lui. Amândouă
 * făceau interogări secvențiale fără niciun indicator — un început de produs
 * care arată ca o pagină care nu se încarcă.
 */
export default function Incarcare(): ReactElement {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Schelet forma="formular" randuri={4} />
    </div>
  );
}
