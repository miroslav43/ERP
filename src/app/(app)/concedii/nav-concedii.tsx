// src/app/(app)/concedii/nav-concedii.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Fila {
  readonly href: string;
  readonly eticheta: string;
  readonly contor?: number;
}

interface Proprietati {
  readonly poateVedeaEchipa: boolean;
  readonly poateAproba: boolean;
  readonly poateVedeaCalendar: boolean;
  readonly poateConfigura: boolean;
  /** Sarcini în așteptarea deciziei celui care se uită. `0` nu se afișează. */
  readonly deAprobat?: number;
}

function esteActiv(cale: string, href: string): boolean {
  return cale === href;
}

/**
 * Tab-uri în pagină, nu intrări noi de meniu: `src/config/navigation.ts` cere
 * deja `/concedii` și `/concedii/sold` — un rând nou de meniu ar însemna un
 * fișier partajat cu celălalt agent și o rulare a `permisiuni.test.ts`.
 *
 * `/concedii` = cererile PROPRII, `/concedii/echipa` = ale subalternilor.
 * Separarea stă în rută, nu într-un comutator de filtru: un filtru se pierde
 * când aplici celelalte filtre, nu se poate pune la favorite și nu poate
 * schimba nici antetul paginii, nici setul de coloane.
 *
 * Ascunderea filelor „Echipa”/„Aprobări”/„Calendar” pentru cine nu are dreptul
 * NU e bariera de securitate: fiecare pagină verifică din nou permisiunea, iar
 * RLS respinge rândurile chiar dacă cineva tastează URL-ul direct.
 */
export function NavConcedii({
  poateVedeaEchipa,
  poateAproba,
  poateVedeaCalendar,
  poateConfigura,
  deAprobat = 0,
}: Proprietati) {
  const cale = usePathname();

  const file: readonly Fila[] = [
    { href: "/concedii", eticheta: "Cererile mele" },
    ...(poateVedeaEchipa ? [{ href: "/concedii/echipa", eticheta: "Echipa" }] : []),
    { href: "/concedii/sold", eticheta: "Soldul meu" },
    ...(poateAproba
      ? [{ href: "/concedii/aprobari", eticheta: "Aprobări", contor: deAprobat }]
      : []),
    ...(poateVedeaCalendar ? [{ href: "/concedii/calendar", eticheta: "Calendar echipă" }] : []),
    ...(poateConfigura ? [{ href: "/concedii/setari", eticheta: "Setări" }] : []),
  ];

  return (
    <nav aria-label="Navigare concedii" className="border-border flex flex-wrap gap-1 border-b">
      {file.map((fila) => {
        const activ = esteActiv(cale, fila.href);
        const contor = fila.contor ?? 0;
        return (
          <Link
            key={fila.href}
            href={fila.href}
            aria-current={activ ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
              activ
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {fila.eticheta}
            {contor > 0 ? (
              <>
                <span
                  aria-hidden="true"
                  className="bg-primary text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs leading-none tabular-nums"
                >
                  {contor}
                </span>
                {/* Cifra singură nu spune nimic unui cititor de ecran. */}
                <span className="sr-only">
                  {contor === 1 ? "o cerere în așteptare" : `${String(contor)} cereri în așteptare`}
                </span>
              </>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
