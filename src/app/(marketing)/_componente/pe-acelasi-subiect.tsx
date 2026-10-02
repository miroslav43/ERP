// src/app/(marketing)/_componente/pe-acelasi-subiect.tsx
import Link from "next/link";

import type { Legatura } from "@/content/landing/tipuri";

/**
 * „Pe același subiect" — legăturile interne de la finalul unei pagini.
 *
 * Existase de două ori, copiată: în pagina de modul și în pagina-lege. A treia
 * copie (uneltele, domeniile, pontajul pe telefon) a fost momentul extragerii.
 */
export function PeAcelasiSubiect({ legaturi }: { legaturi: readonly Legatura[] | undefined }) {
  if (legaturi === undefined || legaturi.length === 0) return null;
  return (
    <div className="mt-10">
      <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
        Pe același subiect
      </p>
      <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
        {legaturi.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-[0.9375rem] underline underline-offset-4">
              {l.eticheta}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
