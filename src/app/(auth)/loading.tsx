// src/app/(auth)/loading.tsx
import type { ReactElement } from "react";

import { Schelet } from "@/components/ui/schelet";

/**
 * Zona `(auth)` n-avea niciun `loading.tsx` — cinci ecrane, toate pe drumul de
 * intrare, toate rămâneau pe pagina precedentă cât se randau.
 *
 * Boundary-ul ăsta NU se suprapune cu voalul global din `zona-incarcare.tsx`,
 * ci acoperă cazul disjunct: navigarea DURĂ — prima încărcare, F5, sosirea
 * dintr-un link de e-mail — unde documentul e înlocuit și niciun component
 * client nu supraviețuiește ca să arate ceva.
 *
 * Layout-ul zonei e sincron (`(auth)/layout.tsx:16` — `export default function`,
 * fără `async`), deci fallback-ul chiar apare; într-un layout care citește date
 * runtime n-ar apărea deloc, cum se întâmplă în `(app)`.
 */
export default function Incarcare(): ReactElement {
  return (
    <div className="w-full max-w-sm">
      <Schelet forma="formular" randuri={3} />
    </div>
  );
}
