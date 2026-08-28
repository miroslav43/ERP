// src/components/incarcare/rand-trimite.tsx
"use client";

import { useEffect, type ReactElement, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Rotita } from "./rotita";
import { useSemnalIncarcare } from "./use-incarcare";
import { cn } from "@/lib/ui/cn";

/**
 * Rândul-buton dintr-un meniu, cu starea formularului lui.
 *
 * Există în două meniuri de cont — cel al aplicației și cel al portalului — și
 * amândouă aveau exact aceleași două defecte: rândul nu se schimba cu nimic, iar
 * panoul rămânea deschis peste un ecran care încă arăta firma veche.
 *
 * ── DE CE `useFormStatus`, NU `useTransition` + `onClick` ─────────────────
 * Formularele astea funcționează și fără JavaScript, iar comentariile din
 * ambele fișiere numesc asta ca decizie luată („un formular per firmă, fără
 * <select> și fără JS"). `useFormStatus` adaugă starea PESTE trimiterea nativă
 * în loc s-o înlocuiască; un `onClick` ar fi transformat o îmbunătățire de
 * feedback într-o regresie de robustețe.
 *
 * `raporteaza` urcă starea la meniu, fiindcă două lucruri nu se pot face din
 * interiorul unui singur formular: blocarea CELORLALTE rânduri — două comutări
 * pornite deodată scriu amândouă cookie-ul de organizație, iar care rămâne e
 * nedeterminat — și închiderea panoului.
 */
export function RandTrimite({
  children,
  className,
  blocat,
  raporteaza,
  eticheta,
}: Readonly<{
  children: ReactNode;
  className: string;
  blocat: boolean;
  raporteaza: (activ: boolean) => void;
  /** Ce se încarcă, pentru voalul global. */
  eticheta?: string | undefined;
}>): ReactElement {
  const { pending } = useFormStatus();
  useSemnalIncarcare(pending, eticheta);

  useEffect(() => {
    raporteaza(pending);
  }, [pending, raporteaza]);

  return (
    <button
      type="submit"
      disabled={blocat}
      aria-busy={pending ? true : undefined}
      className={cn(className, blocat ? "cursor-default opacity-60" : "")}
    >
      {pending ? <Rotita className="text-primary shrink-0" /> : null}
      {children}
    </button>
  );
}
