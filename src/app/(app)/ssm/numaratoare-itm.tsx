"use client";

import { useEffect, useState, type ReactElement, type ReactNode } from "react";

import { Callout } from "@/components/ui/callout";
import { cn } from "@/lib/ui/cn";
import {
  formuleazaRestTermenItm,
  oraLimitaInCuvinte,
  restTermenItm,
} from "@/domain/ssm/termen-itm";

/**
 * Numărătoarea inversă până la termenul de comunicare a unui accident la ITM.
 *
 * ── CE ÎNLOCUIEȘTE ────────────────────────────────────────────────────────
 * Două locuri randau `oreRamasePanaLaTermen(...).toFixed(1)`: „Mai sunt 11.5
 * ore până la termenul legal." Două defecte într-o singură propoziție. Întâi,
 * ore ZECIMALE: nimeni nu transformă „11,5 ore" în „la ce oră trebuie să sun",
 * iar asta e singura întrebare pe care o are omul care citește. Apoi, valoarea
 * era calculată pe server, la randare, și rămânea acolo — o filă lăsată
 * deschisă peste noapte arăta la 7 dimineața cifra de la 22:00.
 *
 * ── DE CE PRIMEȘTE `acumInitial` DE LA SERVER ─────────────────────────────
 * Prima randare de client trebuie să producă EXACT textul trimis de server,
 * altfel React semnalează nepotrivire de hidratare și rescrie nodul. Ceasul
 * real se citește abia în `useEffect`, adică după montare — de acolo încolo
 * componenta e vie.
 *
 * Pasul e de 30 de secunde, nu de o secundă: afișarea e în minute, deci un ceas
 * pe secundă ar face 60 de randări pentru fiecare schimbare vizibilă.
 */
function useCeas(acumInitial: string): Date {
  const [acum, setAcum] = useState(() => new Date(acumInitial));

  useEffect(() => {
    const sincronizeaza = (): void => {
      setAcum(new Date());
    };
    // Prima citire a ceasului REAL se face pe tick-ul următor, nu sincron în
    // corpul efectului: sincron ar fi o randare în cascadă imediat după montare
    // (`react-hooks/set-state-in-effect`). Diferența e de câteva milisecunde,
    // iar afișarea e în minute.
    const pornire = setTimeout(sincronizeaza, 0);
    const ceas = setInterval(sincronizeaza, 30_000);
    return () => {
      clearTimeout(pornire);
      clearInterval(ceas);
    };
  }, []);

  return acum;
}

export function NumaratoareItm({
  momentLimita,
  acumInitial,
  fel = "propozitie",
  className,
}: {
  /** Momentul-limită, ISO. Vine din `momentLimitaComunicareItm`, pe server. */
  readonly momentLimita: string;
  /** Ceasul serverului la randare, ISO — vezi nota despre hidratare. */
  readonly acumInitial: string;
  /** `compact` — doar restul, pentru o celulă de tabel sau un rând de bandă. */
  readonly fel?: "propozitie" | "compact";
  readonly className?: string;
}): ReactElement {
  const acum = useCeas(acumInitial);
  const rest = restTermenItm(new Date(momentLimita), acum);
  const durata = formuleazaRestTermenItm(rest);
  const oraLimita = oraLimitaInCuvinte(new Date(momentLimita), acum);

  if (fel === "compact") {
    return (
      <span
        className={cn(
          "whitespace-nowrap",
          rest.depasit ? "text-danger font-medium" : "",
          className,
        )}
      >
        {rest.depasit ? `depășit cu ${durata}` : `mai sunt ${durata}`}
        <span className="text-muted-foreground"> · {oraLimita}</span>
      </span>
    );
  }

  return (
    <span className={className}>
      {rest.depasit
        ? `Termenul legal de comunicare la ITM e depășit cu ${durata} — expira ${oraLimita}.`
        : `Mai sunt ${durata} până la termenul legal de comunicare la ITM — până ${oraLimita}.`}
    </span>
  );
}

/**
 * Banda de stare a fișei de accident.
 *
 * E client, deși `<Callout>` nu e, tocmai ca SEVERITATEA să se miște odată cu
 * textul: cu tonul calculat pe server, o filă deschisă înainte de termen ar fi
 * spus „e depășit cu 40 de minute" într-un cadru de avertisment blând.
 *
 * `actiune` e butonul care oprește ceasul. Numărătoarea și butonul care o
 * încheie trebuie să stea în același câmp vizual — pe ecranul vechi, formularul
 * de comunicare era ultimul lucru de pe pagină, sub împrejurări.
 */
export function BandaTermenItm({
  momentLimita,
  acumInitial,
  actiune,
}: {
  readonly momentLimita: string;
  readonly acumInitial: string;
  readonly actiune?: ReactNode;
}): ReactElement {
  const acum = useCeas(acumInitial);
  const rest = restTermenItm(new Date(momentLimita), acum);

  return (
    <Callout
      fel={rest.depasit ? "eroare" : "atentie"}
      titlu="Accidentul nu a fost comunicat la ITM"
      {...(actiune === undefined ? {} : { actiune })}
    >
      <NumaratoareItm momentLimita={momentLimita} acumInitial={acumInitial} />
    </Callout>
  );
}
