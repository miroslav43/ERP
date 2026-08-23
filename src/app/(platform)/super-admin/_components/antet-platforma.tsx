import Link from "next/link";
import { ArrowLeftRight, ShieldCheck } from "lucide-react";

import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";

type Props = Readonly<{
  titlu: string;
  email: string;
  /** Are și apartenență la vreo firmă? Doar atunci arătăm comutatorul. */
  areFirme: boolean;
}>;

/**
 * Antetul consolei de platformă.
 *
 * Comutatorul spre aplicația de firmă apare DOAR pentru cine chiar are o firmă.
 * Pentru un super-admin pur, un link către `/panou` ar fi o promisiune falsă:
 * l-ar duce prin `resolveTenant()` în starea `fara_organizatie` și înapoi la
 * ecranul de alegere — un drum dus-întors care nu duce nicăieri.
 *
 * Înlocuiește vechiul „Înapoi în aplicație", care sugera că platforma e o
 * abatere de la aplicație. Sunt două planuri egale; între ele se comută.
 */
export function AntetPlatforma({ titlu, email, areFirme }: Props) {
  return (
    <header className="bg-primary flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-5 py-2.5">
      <ShieldCheck aria-hidden="true" className="text-accent size-4 shrink-0" />
      <span className="text-corp font-semibold text-white">{titlu}</span>

      <div className="ms-auto flex items-center gap-4">
        {areFirme ? (
          <Link
            href={RUTA_DUPA_AUTENTIFICARE}
            className="rounded-control text-nota flex items-center gap-1.5 px-2 py-1 font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeftRight aria-hidden="true" className="size-3.5" />
            Treci în firmă
          </Link>
        ) : null}
        <span className="text-nota font-mono text-white/50">{email}</span>
      </div>
    </header>
  );
}
