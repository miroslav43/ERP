// src/app/(app)/setari/audit/loading.tsx
import type { ReactElement } from "react";

import { ScheletAudit } from "@/components/audit/schelet-audit";

/**
 * Singurul ecran din Setări fără `loading.tsx`, deși ambii frați îl au — iar
 * `setari/` n-are unul de segment, deci ruta nu moștenea nimic de nicăieri.
 *
 * Folosește ACELAȘI schelet ca fallback-ul `<Suspense>` din propria pagină
 * (`page.tsx`), nu unul generic: două schelete diferite unul după altul se văd
 * ca două încărcări, nu ca una.
 */
export default function Incarcare(): ReactElement {
  return <ScheletAudit />;
}
