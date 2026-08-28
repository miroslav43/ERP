// src/components/ui/rezumat-erori.tsx
"use client";

import type { ReactElement } from "react";

import { Callout } from "./callout";

/**
 * Lista erorilor de validare, lângă butoane.
 *
 * ── PROBLEMA PE CARE O REZOLVĂ ────────────────────────────────────────────
 * Asistentul de înrolare are 72 de câmpuri pe șase pași. Când „Continuă” nu
 * avansa, ecranul nu spunea nimic: `mergiInainte()` n-avea ramură de eșec,
 * `handleSubmit` era chemat fără `onInvalid`, iar `formState.errors` nu era
 * citit nicăieri. Chiar și cu fiecare câmp care își arată mesajul, un formular
 * lung îl poate ține sub linia de plutire — omul apasă butonul și pare că
 * aplicația a înghețat.
 *
 * De aceea rezumatul stă LÂNGĂ BUTON, nu în capul paginii: acolo se uită omul
 * în clipa în care apasă.
 *
 * ── DE CE FIECARE RÂND E UN BUTON ─────────────────────────────────────────
 * „Trei câmpuri trebuie corectate” fără cale către ele e o pedeapsă, nu un
 * ajutor. Rândul duce la câmp; cine sare acolo cu tastatura ajunge exact în
 * control, nu lângă el.
 *
 * Săritura NU se face aici. Într-un asistent, câmpul vinovat poate fi pe un
 * pas nemontat, iar `focus()` pe un element inexistent nu face nimic —
 * apelantul trebuie să schimbe întâi pasul, apoi să focuseze. De aceea
 * `laSelectare` e obligatoriu: componenta nu poate ști ce înseamnă „du-mă
 * acolo” în formularul care o folosește.
 *
 * ── ANUNȚUL ───────────────────────────────────────────────────────────────
 * `role="alert"` vine din `Callout fel="eroare"`, nu se scrie de mână. Când
 * lista se schimbă (alt pas, alte erori), cititorul de ecran o reia — exact ce
 * trebuie, fiindcă focusul e pe butonul apăsat, nu pe listă.
 */
export type EroareRezumat = Readonly<{
  /** Numele câmpului, așa cum îl cunoaște formularul. Se trimite lui `laSelectare`. */
  camp: string;
  /** Eticheta OMENEASCĂ. „Regim special”, nu `special_regime`. */
  eticheta: string;
  mesaj: string;
}>;

/**
 * Titlul, cu acordul corect în română.
 *
 * De la 20 în sus numeralul cere „de” („20 de câmpuri”). Regula nu e o
 * subtilitate de stil: „20 câmpuri” se citește greșit și trădează un text
 * tradus, într-un produs în care tot restul e scris în română.
 */
function titlul(numar: number): string {
  if (numar === 1) return "Un câmp trebuie corectat";
  if (numar < 20) return `${String(numar)} câmpuri trebuie corectate`;
  return `${String(numar)} de câmpuri trebuie corectate`;
}

export type PropsRezumatErori = Readonly<{
  erori: readonly EroareRezumat[];
  /** Duce omul la câmp: schimbă pasul dacă e nevoie, apoi focusează. */
  laSelectare: (camp: string) => void;
  className?: string;
}>;

export function RezumatErori({
  erori,
  laSelectare,
  className,
}: PropsRezumatErori): ReactElement | null {
  if (erori.length === 0) return null;

  return (
    <Callout
      fel="eroare"
      titlu={titlul(erori.length)}
      // `exactOptionalPropertyTypes`: o proprietate opțională nu primește
      // `undefined` explicit — se omite cheia, ca peste tot în proiect.
      {...(className === undefined ? {} : { className })}
    >
      <ul className="mt-1 space-y-1">
        {erori.map((eroare) => (
          <li key={eroare.camp}>
            <button
              type="button"
              onClick={() => {
                laSelectare(eroare.camp);
              }}
              className="text-left underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              <span className="font-medium">{eroare.eticheta}</span>
              {": "}
              {eroare.mesaj}
            </button>
          </li>
        ))}
      </ul>
    </Callout>
  );
}
