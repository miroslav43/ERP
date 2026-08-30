// src/app/(app)/concedii/buton-setari.tsx
import Link from "next/link";
import type { ReactElement } from "react";

import { buton } from "@/components/ui/buton";

/**
 * Butonul de configurare al modulului de concedii, pentru colțul din dreapta
 * sus al oricărui ecran din `/concedii`.
 *
 * ── DE CE ÎN DREAPTA SUS, NU CA FILĂ ──────────────────────────────────────
 * Configurarea stă unde stă și la pontaj și la salarizare. Banda de file e
 * pentru VIZUALIZĂRI ale acelorași cereri — „ale mele", „ale echipei", sold,
 * aprobări, calendar; o filă către un ecran de administrare ar sta în același
 * rând cu ele și s-ar citi ca o a șasea vizualizare.
 *
 * ── DE CE O COMPONENTĂ, NU UN `Link` SCRIS DE CINCI ORI ───────────────────
 * Butonul a trăit scris de mână doar în `page.tsx`, deci dispărea la orice pas
 * în lateral: intrai pe „Echipa" și configurarea nu mai exista. Pentru cel care
 * administrează firma, un buton care se evaporă când schimbă fila nu se citește
 * ca o alegere de așezare, ci ca „nu am dreptul".
 *
 * `poateConfigura` rămâne calculat de fiecare pagină, din `leave:update` pe
 * scope `all`. Ascunderea butonului NU e bariera: ecranul de setări își verifică
 * din nou permisiunea, iar RLS respinge scrierile chiar dacă cineva tastează
 * ruta direct.
 */
export function ButonSetariConcedii({
  poateConfigura,
}: {
  readonly poateConfigura: boolean;
}): ReactElement | null {
  if (!poateConfigura) return null;

  return (
    <Link href="/concedii/setari" className={buton({ varianta: "secundar" })}>
      Setări
    </Link>
  );
}
