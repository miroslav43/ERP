// src/app/(app)/concedii/nav-concedii.tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { BandaFile, Fila } from "@/components/ui/file";

interface IntrareFila {
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
    { href: "/concedii", eticheta: "Cererile mele" },
    ...(poateVedeaEchipa ? [{ href: "/concedii/echipa", eticheta: "Echipa" }] : []),
    { href: "/concedii/sold", eticheta: "Soldul meu" },
    ...(poateAproba
      ? [{ href: "/concedii/aprobari", eticheta: "Aprobări", contor: deAprobat }]
      : []),
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
          // `exactOptionalPropertyTypes`: proprietatea opțională trebuie să
          // LIPSEASCĂ, nu să fie `undefined`.
          <Fila
            key={fila.href}
            href={fila.href}
            activ={activ}
            {...(fila.contor === undefined ? {} : { contor: fila.contor })}
          >
            {fila.eticheta}
          </Fila>
        );
      })}
    </BandaFile>
  );
}
