// src/app/(app)/concedii/nav-concedii.tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { BandaFile, Fila } from "@/components/ui/file";

interface IntrareFila {
  readonly href: string;
  readonly eticheta: string;
}

interface Proprietati {
  readonly poateAproba: boolean;
  readonly poateVedeaCalendar: boolean;
  readonly poateConfigura: boolean;
}

function esteActiv(cale: string, href: string): boolean {
  // `href` poate purta acum un query string (luna calendarului), iar
  // `usePathname` nu-l întoarce niciodată. Fără tăierea lui, fila de calendar
  // n-ar mai apărea vreodată ca activă.
  const [caleHref] = href.split("?");
  return cale === caleHref;
}

/**
 * Tab-uri în pagină, nu intrări noi de meniu: `src/config/navigation.ts` cere
 * deja `/concedii` și `/concedii/sold` — un rând nou de meniu ar însemna un
 * fișier partajat cu celălalt agent și o rulare a `permisiuni.test.ts`.
 *
 * Ascunderea filelor „Aprobări”/„Calendar” pentru cine nu are dreptul NU e
 * bariera de securitate: fiecare pagină verifică din nou permisiunea, iar RLS
 * respinge rândurile chiar dacă cineva tastează URL-ul direct.
 */
export function NavConcedii({ poateAproba, poateVedeaCalendar, poateConfigura }: Proprietati) {
  const cale = usePathname();
  const parametri = useSearchParams();

  /**
   * Calendarul păstrează corect luna în URL (`calendar/page.tsx:64-66`), dar
   * fila trimitea la `/concedii/calendar` FĂRĂ parametri: orice ieșire și
   * revenire prin file te arunca înapoi pe luna curentă, iar omul care compara
   * două luni pierdea locul la fiecare clic.
   *
   * Se propagă doar `an` și `luna`, nu tot query string-ul: cursoarele de
   * paginare și filtrele listei de cereri n-au sens pe calendar.
   */
  const an = parametri.get("an");
  const luna = parametri.get("luna");
  const contextLuna = an !== null && luna !== null ? `?an=${an}&luna=${luna}` : "";

  const file: readonly IntrareFila[] = [
    { href: "/concedii", eticheta: "Cereri" },
    { href: "/concedii/sold", eticheta: "Soldul meu" },
    ...(poateAproba ? [{ href: "/concedii/aprobari", eticheta: "Aprobări" }] : []),
    ...(poateVedeaCalendar
      ? [{ href: `/concedii/calendar${contextLuna}`, eticheta: "Calendar echipă" }]
      : []),
    ...(poateConfigura ? [{ href: "/concedii/setari", eticheta: "Setări" }] : []),
  ];

  return (
    <BandaFile eticheta="Navigare concedii">
      {file.map((fila) => {
        const activ = esteActiv(cale, fila.href);
        return (
          <Fila key={fila.href} href={fila.href} activ={activ}>
            {fila.eticheta}
          </Fila>
        );
      })}
    </BandaFile>
  );
}
