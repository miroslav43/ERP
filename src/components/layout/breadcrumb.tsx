// src/components/layout/breadcrumb.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const TRADUCERI: Readonly<Record<string, string>> = {
  panou: "Panou",
  setari: "Setări",
  organizatie: "Organizație",
  membri: "Membri",
  invitatii: "Invitații",
  profil: "Profil",
  notificari: "Notificări",
  "super-admin": "Super-admin",
  organizatii: "Organizații",
  module: "Module",
  permisiuni: "Permisiuni",
  "cereri-demo": "Cereri demo",
  audit: "Jurnal de audit",
  angajati: "Angajați",
  pontaj: "Pontaj",
  concedii: "Concedii",
  documente: "Documente",
  facturi: "Facturi",
  rapoarte: "Rapoarte",
};

const TIPAR_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tradu(segment: string): string {
  const cunoscut = TRADUCERI[segment];
  if (cunoscut !== undefined) {
    return cunoscut;
  }
  if (TIPAR_UUID.test(segment)) {
    return "Detaliu";
  }
  const curatat = segment.replace(/-/g, " ");
  return curatat.charAt(0).toUpperCase() + curatat.slice(1);
}

/**
 * Firimiturile stau ÎN antetul navy, nu în pagină — deci paleta lor e cea de pe
 * navy, nu cea de pe crem. `text-muted-foreground` (#5b6478) pe #0f1e3d dă
 * 1,52:1: era text practic invizibil.
 *
 * Nivelurile sunt calculate, ca peste tot pe navy: `white/60` dă 6,67:1 pentru
 * segmentele parcurse și pentru separatoare, `white` (14,66:1) pentru pagina
 * curentă. Diferența dintre „unde ai fost" și „unde ești" rămâne vizibilă fără
 * să coboare vreo treaptă sub prag.
 */
export function Breadcrumb() {
  const cale = usePathname();
  const segmente = cale.split("/").filter((segment) => segment.length > 0);

  if (segmente.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Firimituri de navigare" className="min-w-0">
      <ol className="text-corp flex min-w-0 items-center gap-1">
        {segmente.map((segment, indice) => {
          const href = `/${segmente.slice(0, indice + 1).join("/")}`;
          const esteUltim = indice === segmente.length - 1;
          return (
            <li key={href} className="flex min-w-0 items-center gap-1">
              {indice > 0 ? (
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-white/60" />
              ) : null}
              {esteUltim ? (
                <span aria-current="page" className="truncate font-medium text-white">
                  {tradu(segment)}
                </span>
              ) : (
                <Link
                  href={href}
                  className="truncate text-white/60 transition-colors hover:text-white"
                >
                  {tradu(segment)}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
