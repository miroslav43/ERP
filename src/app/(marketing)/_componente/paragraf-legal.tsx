import type { ReactNode } from "react";

/**
 * Un paragraf de text legal în care „secțiunea N” trimite la clauza N de pe
 * aceeași pagină (`ancoraClauza` din `src/content/legal/cuprins.ts`).
 *
 * Politica de confidențialitate spunea de două ori „descrise la secțiunea 8”,
 * fără legătură (auditul din 7 oct 2026). Textul rămâne cel scris în
 * conținut; doar trimiterea devine clicabilă.
 */
export function cuTrimiteriLaSectiuni(text: string): ReactNode {
  const bucati = text.split(/(secțiunea \d+)/u);
  if (bucati.length === 1) return text;
  return bucati.map((bucata, index) => {
    const numar = /^secțiunea (\d+)$/u.exec(bucata)?.[1];
    return numar === undefined ? (
      bucata
    ) : (
      <a
        key={`${bucata}-${String(index)}`}
        href={`#sectiunea-${numar}`}
        className="underline underline-offset-2"
      >
        {bucata}
      </a>
    );
  });
}
