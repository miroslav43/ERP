// src/components/ui/paginare.tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

import { buton } from "./buton";

/**
 * Paginarea unei liste. Înlocuiește ~18 copii ale aceluiași link „Pagina
 * următoare”, fiecare cu propria formulare pentru ultima pagină — una spunea
 * „Aceasta este ultima pagină.”, alta nu randa nimic.
 *
 * ── CE E NOU FAȚĂ DE ÎNAINTE ──────────────────────────────────────────────
 * **Numărătoarea.** Nicio listă nu spunea câte rânduri are. „Pagina următoare”
 * fără un total e o ușă fără indicație: nu știi dacă mai urmează un ecran sau
 * o sută.
 *
 * **Mărimea paginii.** `limita` există în ~8 scheme Zod (5..30, 5..50, 5..100)
 * și n-avea NICIUN control în interfață, în niciun modul. Cine voia să vadă mai
 * mult trebuia să scrie parametrul de mână în URL.
 *
 * ── DE CE NU EXISTĂ „PAGINA ANTERIOARĂ” ───────────────────────────────────
 * Paginarea e keyset, nu `OFFSET` — decizie de proiect, fiindcă `OFFSET` face
 * ca un rând inserat între două pagini să reapară, iar unul șters să fie sărit.
 * Întoarcerea cu keyset cere ori inversarea sortării și o a doua interogare,
 * ori o stivă de cursoare în URL. Amândouă sunt muncă în stratul de citiri, nu
 * în componentă, și n-au intrat în această rundă. Butonul „înapoi” al
 * browserului funcționează corect: fiecare pagină e o adresă proprie.
 */
export type PropsPaginare = Readonly<{
  /** Câte rânduri se văd acum. */
  afisate: number;
  /** Totalul din bază, dacă e cunoscut. `null` când n-a fost cerut. */
  total?: number | null;
  /** Cursorul paginii următoare, sau `null` la ultima pagină. */
  cursorUrmator: string | null;
  /** Adresa pentru o pagină nouă. `cursor: null` înseamnă „de la început”. */
  construiesteHref: (x: Readonly<{ cursor: string | null; limita: number }>) => string;
  limita: number;
  marimiPosibile?: readonly number[];
  className?: string;
}>;

const MARIMI_IMPLICITE = [25, 50, 100] as const;

export function Paginare({
  afisate,
  total,
  cursorUrmator,
  construiesteHref,
  limita,
  marimiPosibile = MARIMI_IMPLICITE,
  className,
}: PropsPaginare): ReactElement {
  const stieTotalul = total !== undefined && total !== null;

  return (
    <nav
      aria-label="Paginare"
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
    >
      <p className="text-muted-foreground text-corp">
        <span className="font-mono tabular-nums">{afisate}</span>
        {stieTotalul ? (
          <>
            {" din "}
            <span className="text-foreground font-mono font-medium tabular-nums">{total}</span>
          </>
        ) : null}
        {afisate === 1 ? " rând" : " de rânduri"}
        {cursorUrmator === null && stieTotalul === false ? " · ultima pagină" : null}
      </p>

      <div className="flex items-center gap-3">
        {/* Mărimea paginii ca linkuri, nu ca `<select>`: e stare de URL, deci
            nu are nevoie de JavaScript, iar valoarea curentă rămâne vizibilă. */}
        <span className="flex items-center gap-1">
          <span className="text-muted-foreground text-nota">Pe pagină:</span>
          {marimiPosibile.map((m) => (
            <Link
              key={m}
              href={construiesteHref({ cursor: null, limita: m })}
              aria-current={m === limita ? "true" : undefined}
              className={cn(
                "rounded-control text-nota px-2 py-1 font-mono tabular-nums transition-colors",
                m === limita
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {m}
            </Link>
          ))}
        </span>

        {cursorUrmator === null ? null : (
          <Link
            href={construiesteHref({ cursor: cursorUrmator, limita })}
            className={buton({ varianta: "secundar" })}
          >
            Pagina următoare
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
    </nav>
  );
}
