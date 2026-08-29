// src/app/(app)/angajati/[id]/date-lipsa.tsx
import Link from "next/link";
import type { ReactElement } from "react";

import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";

/**
 * Ce lipsește din fișă pentru contract și pentru REGES.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Din 0097 încoace, asistentul de înrolare CERE seria și numărul actului de
 * identitate, emitentul, data eliberării, CNP-ul și adresa de domiciliu: fără
 * ele nu iese textul contractului („posesor al … seria … nr. …, eliberat de …
 * la data de …") și nu trece transmiterea la ITM (`verificaSalariat` din
 * `src/domain/reges/validare.ts`).
 *
 * Regula strictă s-a oprit însă la înrolare, deliberat: ecranul de editare și
 * importul în masă rămân permisive, altfel o corecție de număr de telefon pe un
 * angajat vechi ar cere găsirea buletinului. Măsurat pe baza reală: TOATE cele
 * 11 fișe active n-au niciunul dintre câmpurile astea.
 *
 * Consecința fără semnalul de mai jos: fișele vechi rămân incomplete tăcut, iar
 * defectul iese la lumină abia la prima încercare de a emite un contract sau de
 * a transmite la ITM — adică exact când nu mai ai timp.
 *
 * ── DE CE NU BLOCHEAZĂ NIMIC ───────────────────────────────────────────────
 * E un semnal, nu o poartă. Un `hr` care intră să schimbe un telefon trebuie să
 * poată salva. Blocarea editării ar transforma o restanță de date într-o
 * aplicație inutilizabilă pentru fișele vechi.
 */
export type FisaIncompleta = Readonly<{
  serie_act: string | null;
  numar_act: string | null;
  act_eliberat_de: string | null;
  act_eliberat_la: string | null;
  adresa_strada: string | null;
  adresa_oras: string | null;
  adresa_judet: string | null;
  /** Ultimele patru cifre ale CNP-ului; `null` = CNP-ul nu e în fișă. */
  cnpUltimele4: string | null;
  /** Cetățenia decide dacă seria e cerută: un pașaport n-are serie. */
  cetatenie: string;
}>;

/** Textul câmpurilor lipsă, în ordinea în care apar în formularul de editare. */
export function campuriLipsa(fisa: FisaIncompleta): readonly string[] {
  const gol = (valoare: string | null): boolean => valoare === null || valoare.trim() === "";
  const esteRoman = fisa.cetatenie.trim().toUpperCase() === "RO";

  return [
    // Seria există doar pe actele românești. Cerută unui cetățean străin cu
    // pașaport, ar fi o restanță pe care nimeni n-o poate închide.
    esteRoman && gol(fisa.serie_act) ? "seria actului de identitate" : null,
    gol(fisa.numar_act) ? "numărul actului de identitate" : null,
    gol(fisa.act_eliberat_de) ? "emitentul actului" : null,
    gol(fisa.act_eliberat_la) ? "data eliberării actului" : null,
    fisa.cnpUltimele4 === null ? "CNP-ul" : null,
    gol(fisa.adresa_strada) || gol(fisa.adresa_oras) || gol(fisa.adresa_judet)
      ? "adresa de domiciliu"
      : null,
  ].filter((camp): camp is string => camp !== null);
}

export function DateLipsa({
  employeeId,
  fisa,
  poateEdita,
}: {
  readonly employeeId: string;
  readonly fisa: FisaIncompleta;
  readonly poateEdita: boolean;
}): ReactElement | null {
  const lipsa = campuriLipsa(fisa);
  if (lipsa.length === 0) return null;

  return (
    <Callout
      fel="atentie"
      titlu={
        lipsa.length === 1
          ? "Un câmp lipsește pentru contract și REGES"
          : `${String(lipsa.length)} câmpuri lipsesc pentru contract și REGES`
      }
      // `exactOptionalPropertyTypes`: cheia se omite, nu se trimite `undefined`.
      {...(poateEdita
        ? {
            actiune: (
              <Link
                href={`/angajati/${employeeId}/editeaza`}
                className={buton({ varianta: "secundar" })}
              >
                Completează
              </Link>
            ),
          }
        : {})}
    >
      <p>
        Fără ele nu se poate emite contractul de muncă și nu trece transmiterea la ITM. Restul fișei
        se poate edita normal.
      </p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        {lipsa.map((camp) => (
          <li key={camp}>{camp}</li>
        ))}
      </ul>
    </Callout>
  );
}
