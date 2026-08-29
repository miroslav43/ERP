// src/components/incarcare/use-incarcare.ts
"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { porneste } from "@/lib/incarcare/depozit";

/**
 * Leagă o stare de „în curs" din React de voalul global.
 *
 * Folosire tipică, peste `useTransition`-ul care există deja în 101 fișiere:
 *
 *   const [inCurs, incepe] = useTransition();
 *   useSemnalIncarcare(inCurs, "lista de angajați");
 *
 * Curățarea din `useEffect` chemă `opreste()` și la demontare, nu doar la
 * schimbarea lui `activ`. Contează: componenta care pornește o navigare este
 * exact componenta pe care navigarea o demontează, deci fără curățarea asta
 * fiecare navigare ar lăsa o sursă aprinsă în urmă.
 */
export function useSemnalIncarcare(activ: boolean, eticheta?: string | undefined): void {
  useEffect(() => {
    if (!activ) return;
    return porneste(eticheta);
  }, [activ, eticheta]);
}

/**
 * Semnalează o așteptare care se încheie când se schimbă ruta.
 *
 * Există pentru un gol foarte concret: `<Formular>` (`components/ui/formular.tsx`)
 * cheamă `laReusita` dintr-un `useEffect`, DUPĂ ce `useActionState` a lăsat deja
 * `inCurs` pe `false`. Iar `laReusita` e, în unsprezece formulare, un
 * `router.push` către altă pagină. Rezultatul: acțiunea reușea, butonul redevenea
 * activ, și urma o navigare întreagă în care nimic nu se mișca pe ecran.
 *
 * Sursa se stinge la schimbarea căii sau la demontare — curățarea unui efect cu
 * `[cale]` în dependențe le acoperă pe amândouă. `PLAFON_TARE` din depozitar
 * rămâne plasa pentru cazul în care navigarea nu se mai întâmplă deloc.
 */
export function useSemnalPanaLaRuta(): (eticheta?: string) => void {
  const cale = usePathname();
  const opreste = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      opreste.current?.();
      opreste.current = null;
    };
  }, [cale]);

  return useCallback((eticheta?: string) => {
    opreste.current?.();
    opreste.current = porneste(eticheta);
  }, []);
}
