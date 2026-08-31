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
    // Calendarul e PRIMUL pentru cine vede echipa: e ecranul cu care încep
    // managerii, HR-ul și patronul, iar `/concedii` gol îi și trimite acolo
    // (v. redirectarea din `page.tsx`). Pentru `employee`, `poateVedeaCalendar`
    // e fals, fila lipsește, iar prima rămâne „Cererile mele" — exact ce-i
    // trebuie cuiva care nu vede pe nimeni altcineva.
    ...(poateVedeaCalendar
      ? [{ href: `/concedii/calendar${contextLuna}`, eticheta: "Calendar echipă" }]
      : []),
    // `?vedere=cereri` nu e decor: `/concedii` FĂRĂ niciun parametru redirectează
    // spre calendar pentru cine îl vede, deci fila fără parametru s-ar fi
    // redirectat pe ea însăși și lista de cereri ar fi devenit inaccesibilă.
    { href: "/concedii?vedere=cereri", eticheta: "Cererile mele" },
    ...(poateVedeaEchipa ? [{ href: "/concedii/echipa", eticheta: "Echipa" }] : []),
    // Pagina arată soldul PROPRIU doar pentru cine nu vede mai mult de-atât;
    // cu scope „team"/„all" listează toți angajații vizibili, secțiune cu
    // secțiune. Eticheta urmează comportamentul, nu invers.
    { href: "/concedii/sold", eticheta: poateVedeaEchipa ? "Soldul echipei" : "Soldul meu" },
    ...(poateAproba
      ? [{ href: "/concedii/aprobari", eticheta: "Aprobări", contor: deAprobat }]
      : []),
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
