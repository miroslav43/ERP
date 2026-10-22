// src/app/(app)/angajati/nou/_components/program-saptamanal.tsx
"use client";

import { useWatch, type Control } from "react-hook-form";

import {
  programSubCinciZile,
  textZilePeSaptamana,
  ZILE_SAPTAMANA_STANDARD,
  zilePeSaptamana,
} from "@/domain/payroll/program-saptamanal";
import { formatNumar } from "@/lib/format/numar";
import type { InroleazaAngajatInput } from "@/schemas/employee";

/**
 * Zilele pe săptămână deduse din cele două norme, sub câmpurile lor.
 *
 * Contractul nu are un câmp pentru zile: salarizarea le deduce exact așa
 * (`domain/payroll/program-saptamanal.ts`), iar sub cinci zile împarte salariul
 * la zilele programului. Garda „L4” din campania QA: „8 h/zi, 20 h/săpt.” se
 * scrie ușor din greșeală — asistentul pornește de la 40/8, se schimbă doar
 * săptămâna, iar schema îl primește (din 573b2d31 cere doar „zi ≤ săptămână”) —
 * și iese un program de 2,5 zile pe care nimeni nu l-a ales. Aici HR-ul vede ce
 * a ales, înainte de salvare.
 */
export function ProgramSaptamanal({
  control,
}: Readonly<{ control: Control<InroleazaAngajatInput> }>) {
  const saptamana = Number(useWatch({ control, name: "norma_ore_saptamana" }));
  const zi = Number(useWatch({ control, name: "norma_ore_zi" }));
  const zile = zilePeSaptamana(zi, saptamana);

  return (
    <p aria-live="polite" className="text-muted-foreground text-nota sm:col-span-2">
      {zile === null ? (
        "Zilele pe săptămână se deduc după ce completați ambele norme."
      ) : programSubCinciZile(zile) ? (
        <span className="text-warning">
          Program: <strong>{textZilePeSaptamana(zile)}</strong>, adică mai puțin de cinci.
          Salarizarea împarte salariul la zilele programului. Dacă omul lucrează cinci zile pe
          săptămână, norma pe zi este {formatNumar(saptamana / ZILE_SAPTAMANA_STANDARD)} ore.
        </span>
      ) : (
        <>
          Program: <strong>{textZilePeSaptamana(zile)}</strong>.
        </>
      )}
    </p>
  );
}
