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

export function Breadcrumb() {
  const cale = usePathname();
  const segmente = cale.split("/").filter((segment) => segment.length > 0);

  if (segmente.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Firimituri de navigare" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {segmente.map((segment, indice) => {
          const href = `/${segmente.slice(0, indice + 1).join("/")}`;
          const esteUltim = indice === segmente.length - 1;
          return (
            <li key={href} className="flex min-w-0 items-center gap-1">
              {indice > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground h-4 w-4 shrink-0"
                />
              ) : null}
              {esteUltim ? (
                <span aria-current="page" className="text-foreground truncate font-medium">
                  {tradu(segment)}
                </span>
              ) : (
                <Link
                  href={href}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring truncate focus-visible:ring-2 focus-visible:outline-none"
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
