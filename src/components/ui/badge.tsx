// src/components/ui/badge.tsx
import { AlertTriangle } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Pastila de stare. Înlocuiește 27 de hărți `CLASE_*` din 13 fișiere
 * `etichete.ts` — 125 de celule, care foloseau **nouă familii de nuanțe pentru
 * șase stări** (zinc, slate, emerald, amber, rose, red, orange, blue, violet).
 *
 * Două reguli o guvernează, amândouă din `docs/design/stari-de-interactiune.md`:
 *
 * **1. Fundalul e transparent.** O pastilă cu fundal propriu se bate cu starea
 * rândului pe care stă — rândul la hover devine `bg-surface`, iar o pastilă
 * `bg-emerald-100` peste el arată ca o a treia culoare, neintenționată.
 *
 * **2. Culoarea e redundantă, niciodată suficientă.** Înțelesul îl poartă
 * CUVÂNTUL; bulina doar îl repetă. De aceea „În lucru” rămâne `text-foreground`
 * cu bulină chihlimbar, nu `text-warning`: chihlimbarul ca text dă 3,40:1 și e
 * interzis la orice dimensiune sub 18,66px bold. Și de aceea „Expirat” primește
 * o PICTOGRAMĂ — e singurul mod de a-l distinge de „Respinsă” fără culoare, pe
 * o listă tipărită alb-negru.
 *
 * Auriul nu apare niciodată aici: `--color-accent` pe crem dă 2,26:1.
 */
export type TonStare = "succes" | "atentie" | "pericol" | "neutru" | "ciorna";

const TEXT: Readonly<Record<TonStare, string>> = {
  succes: "text-foreground",
  atentie: "text-foreground",
  pericol: "text-danger",
  neutru: "text-muted-foreground",
  ciorna: "text-muted-foreground",
};

const BULINA: Readonly<Record<TonStare, string>> = {
  succes: "bg-success",
  atentie: "bg-warning",
  pericol: "bg-danger",
  neutru: "bg-muted-foreground",
  // Bulină goală = neînceput. Conturul spune „există un loc, nu s-a umplut încă”.
  ciorna: "border border-muted-foreground bg-transparent",
};

export type PropsBadge = Readonly<{
  ton: TonStare;
  children: ReactNode;
  /** Pictogramă de avertisment — rezervată stării „Expirat”. */
  cuAvertisment?: boolean;
  className?: string;
}>;

export function Badge({ ton, children, cuAvertisment, className }: PropsBadge): ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        "border-foreground/30 rounded-full border px-2 py-0.5",
        "text-nota font-medium",
        TEXT[ton],
        className,
      )}
    >
      {cuAvertisment === true ? (
        <AlertTriangle aria-hidden="true" className="size-3 shrink-0" />
      ) : (
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", BULINA[ton])} />
      )}
      {children}
    </span>
  );
}
