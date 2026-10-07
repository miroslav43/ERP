// src/app/(vitrina)/error.tsx
"use client";

import { StareEroare } from "@/components/ui/stare-eroare";

/**
 * Limita de eroare a demonstrațiilor.
 *
 * ── DE CE NU E DE AJUNS `global-error.tsx` ────────────────────────────────
 * Fără fișierul ăsta, orice `TypeError` de randare din vitrină urca până la
 * `src/app/global-error.tsx` — adică ecranul de prăbușire al aplicației,
 * desenat ÎNĂUNTRUL chenarului „Ecran real" de pe pagina publică de vânzare.
 * Un prospect ar fi văzut produsul căzând, în cadrul în care i se demonstrează
 * că merge. Cel mai scump loc din tot situl unde poate apărea o eroare.
 *
 * ── DE CE ALT TEXT DECÂT ÎN APLICAȚIE ─────────────────────────────────────
 * `error.tsx`-urile din `(app)` promit că datele n-au putut fi încărcate și
 * invită la reîncercare. Aici nu există date de încărcat: totul e fabricat, în
 * memoria filei. Textul spune ce s-a stricat de fapt — demonstrația, nu firma
 * vizitatorului — și liniștește exact îngrijorarea pe care o naște o eroare pe
 * o pagină de vânzare: că datele au plecat undeva.
 *
 * ── DE CE FĂRĂ PROPUL `inapoi` ────────────────────────────────────────────
 * Demonstrația a fost gândită pentru un `<iframe>`, unde un `<Link>` ar fi
 * încărcat situl întreg ÎNĂUNTRUL chenarului. Azi se deschide direct, iar
 * ieșirea e bara din `layout.tsx` — sigla, „Toate modulele", „Creează cont" —,
 * care rămâne pe ecran și peste eroare, fiindcă eroarea înlocuiește doar pagina.
 */
export default function Eroare({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="p-4">
      <StareEroare
        eroare={error}
        reincearca={retry}
        titlu="Demonstrația s-a oprit"
        descriere="S-a stricat demonstrația, nu produsul. Nimic nu a plecat spre server: tot ce se vede aici e inventat și trăiește doar în fila asta. Încercați din nou."
      />
    </div>
  );
}
