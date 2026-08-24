// src/app/(app)/panou/_components/rand-coada.tsx
import Link from "next/link";
import type { ReactElement } from "react";

import { buton } from "@/components/ui/buton";
import { cn } from "@/lib/ui/cn";

/**
 * Un rând din coada de lucru a panoului.
 *
 * ── DOUĂ REGULI, AMÂNDOUĂ VERIFICABILE ────────────────────────────────────
 * **1. Rândul duce la ecranul care îl REZOLVĂ, nu la modul.** „Aprobă" deschide
 * coada de aprobări cu filtrul pus, nu lista de concedii din care ar mai trebui
 * căutată cererea. Un panou care te duce „prin apropiere" te obligă să cauți de
 * două ori.
 *
 * **2. Ținta e tot rândul.** Pe telefon, un buton de 44px la capătul unui rând
 * de 360px înseamnă că 87% din suprafață nu face nimic. Linkul acoperă rândul;
 * butonul din dreapta rămâne ca semnal vizual, nu ca singură cale.
 */
export type PropsRandCoada = Readonly<{
  titlu: string;
  detaliu: string;
  numar: number;
  href: string;
  etichetaActiune: string;
  /** Termen legal cu ceas — urcă peste rutină și primește bulină de alarmă. */
  urgent?: boolean;
}>;

export function RandCoada({
  titlu,
  detaliu,
  numar,
  href,
  etichetaActiune,
  urgent,
}: PropsRandCoada): ReactElement {
  return (
    <li className="border-border relative border-b last:border-b-0">
      <div className="flex min-h-14 items-center gap-3 px-4 py-3">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full",
            urgent === true ? "bg-danger ring-danger/20 ring-4" : "bg-muted-foreground/50",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-corp font-medium">
            {/*
              Linkul acoperă tot rândul prin `after:absolute inset-0` — un
              singur element apăsabil, deci un singur oprire de tabulare și o
              țintă de dimensiunea rândului. Butonul din dreapta e decor peste
              aceeași suprafață.
            */}
            <Link href={href} className="after:absolute after:inset-0 hover:underline">
              {titlu}
            </Link>
          </p>
          <p className="text-muted-foreground text-nota">
            <span className="font-mono tabular-nums">{numar}</span> · {detaliu}
          </p>
        </div>
        <span aria-hidden="true" className={cn(buton({ varianta: "secundar" }), "shrink-0")}>
          {etichetaActiune}
        </span>
      </div>
    </li>
  );
}
