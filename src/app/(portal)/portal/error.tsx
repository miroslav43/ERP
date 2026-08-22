"use client";

import Link from "next/link";

import { StareEroare } from "@/components/feedback/stare-eroare";

/**
 * Boundary-ul de eroare al portalului.
 *
 * Fără el, orice excepție dintr-un ecran urcă până la boundary-ul implicit al
 * lui Next și randează un ecran fără antet și FĂRĂ bara de navigare — adică un
 * om cu telefonul în mână, rămas fără niciun drum înapoi. `(app)` are aproape o
 * sută de asemenea fișiere; portalul n-avea niciunul.
 *
 * De aceea are și link explicit spre `/portal`: butonul „Încearcă din nou” nu
 * ajută dacă eroarea e stabilă.
 */
export default function EroarePortal({
  error,
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <StareEroare titlu="Portalul nu a putut fi încărcat" eroare={error} reincearca={reset} />
      <Link href="/portal" className="text-primary text-sm underline-offset-2 hover:underline">
        Înapoi la pagina de start
      </Link>
    </div>
  );
}
