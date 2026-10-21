"use client";

// src/components/flota/buton-citeste-bonul.tsx

import { ScanText } from "lucide-react";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { citesteBonul } from "@/app/(app)/flota/bon/actions";
import type { PropunereBon } from "@/domain/fleet/bon-ocr";

export type PropunereCitita = Readonly<{
  propunere: PropunereBon;
  avertismente: readonly string[];
  jeton: string;
}>;

type Props = Readonly<{
  tripSheetId: string;
  /** Calea bonului deja urcat; `null` ⇒ butonul nu apare. */
  cale: string | null;
  onPropunere: (rezultat: PropunereCitita) => void;
}>;

/**
 * „Citește bonul” (F12a): trimite poza deja urcată la citirea automată și
 * predă formularului propunerea. NU salvează nimic — omul vede câmpurile
 * completate, le corectează și apasă el „Adaugă alimentarea”.
 *
 * Clicul e consimțământul omului: fiecare citire costă și trimite poza la un
 * terț (OpenRouter), deci nu se citește singur la urcare.
 *
 * Importă DOAR acțiunea și tipuri din domeniu: `pnpm check:server` prinde un
 * import de valoare dintr-un modul `server-only`.
 */
export function ButonCitesteBonul({ tripSheetId, cale, onPropunere }: Props): ReactElement | null {
  const [inCurs, porneste] = useTransition();
  const [problema, setProblema] = useState<string | null>(null);
  const [avertismente, setAvertismente] = useState<readonly string[]>([]);

  if (cale === null) return null;

  function citeste(caleBon: string): void {
    setProblema(null);
    setAvertismente([]);
    porneste(async () => {
      const rezultat = await citesteBonul({ trip_sheet_id: tripSheetId, cale: caleBon });
      if (!rezultat.ok) {
        setProblema(rezultat.error.message);
        return;
      }
      if (rezultat.data.propunere === null) {
        setProblema(rezultat.data.motivGol);
        return;
      }
      setAvertismente(rezultat.data.avertismente);
      onPropunere({
        propunere: rezultat.data.propunere,
        avertismente: rezultat.data.avertismente,
        jeton: rezultat.data.jeton,
      });
    });
  }

  return (
    <div className="space-y-2">
      <Buton
        type="button"
        varianta="secundar"
        inCurs={inCurs}
        textInCurs="Se citește bonul…"
        onClick={() => {
          citeste(cale);
        }}
      >
        <ScanText className="size-4" aria-hidden="true" />
        Citește bonul
      </Buton>
      <div aria-live="polite" className="text-nota space-y-2">
        {problema === null ? null : (
          <p role="alert" className="text-danger">
            {problema}
          </p>
        )}
        {avertismente.length === 0 ? null : (
          <ul className="border-warning/40 bg-warning/12 text-foreground rounded-panou list-disc border p-3 pl-6">
            {avertismente.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
