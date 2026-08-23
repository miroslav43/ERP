// src/components/ui/schelet.tsx
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Scheletul de încărcare, într-un singur exemplar.
 *
 * Înainte existau două sisteme cu semantică de accesibilitate **opusă**:
 * `SkeletonTable` (56 de fișiere) se anunța cu `role="status" aria-busy`, iar
 * `ScheletLista`/`ScheletCarduri` (5 fișiere) se ascundeau cu `aria-hidden`.
 * Adică jumătate din aplicație spunea cititorului de ecran „se încarcă”, iar
 * cealaltă jumătate îi lăsa un ecran mut.
 *
 * Aici regula e una singură: **învelișul vorbește, formele tac.** `role="status"`
 * plus un text `sr-only` pe înveliș; `aria-hidden` pe fiecare dreptunghi care
 * pulsează, fiindcă un cititor de ecran n-are ce face cu opt casete goale.
 *
 * Scheletul primește ACELEAȘI metadate de coloane ca tabelul real. Fără ele,
 * `SkeletonTable` desena implicit cinci coloane peste tabele de șapte și
 * producea exact saltul de layout pe care propriul lui comentariu pretindea
 * că-l evită.
 */
export type FormaSchelet = "tabel" | "carduri" | "lista" | "formular" | "detaliu" | "coada";

export type PropsSchelet = Readonly<{
  forma: FormaSchelet;
  /** Rânduri de tabel, elemente de listă sau carduri. */
  randuri?: number;
  /** Numai pentru `forma="tabel"`: câte coloane are tabelul real. */
  coloane?: number;
  className?: string;
}>;

const IMPLICIT: Readonly<Record<FormaSchelet, number>> = {
  tabel: 8,
  carduri: 6,
  lista: 5,
  formular: 6,
  detaliu: 4,
  coada: 4,
};

export function Schelet({ forma, randuri, coloane = 5, className }: PropsSchelet): ReactElement {
  const n = randuri ?? IMPLICIT[forma];

  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        forma === "tabel" ? "border-border rounded-panou overflow-hidden border" : "",
        className,
      )}
    >
      {forma === "tabel" ? <Tabel randuri={n} coloane={coloane} /> : null}
      {forma === "carduri" ? <Carduri carduri={n} /> : null}
      {forma === "lista" ? <Lista randuri={n} /> : null}
      {forma === "formular" ? <Formular campuri={n} /> : null}
      {forma === "detaliu" ? <Detaliu sectiuni={n} /> : null}
      {forma === "coada" ? <Coada randuri={n} /> : null}
      <span className="sr-only">Se încarcă datele…</span>
    </div>
  );
}

/** Pulsul e comun, ca ritmul să fie același pe tot ecranul. */
const PULS = "bg-border/70 animate-pulse rounded";

function Tabel({ randuri, coloane }: { randuri: number; coloane: number }): ReactElement {
  return (
    <div aria-hidden="true">
      <div className="border-border bg-surface flex gap-4 border-b p-3">
        {Array.from({ length: coloane }, (_, c) => (
          <div key={c} className="bg-border h-4 flex-1 animate-pulse rounded" />
        ))}
      </div>
      {Array.from({ length: randuri }, (_, r) => (
        <div key={r} className="border-border flex gap-4 border-b p-3 last:border-0">
          {Array.from({ length: coloane }, (_, c) => (
            // Decalajul face pulsul să curgă pe verticală, nu să clipească tot
            // deodată — mișcarea sugerează că sosesc rânduri, nu că ecranul e stricat.
            <div
              key={c}
              className={cn(PULS, "h-4 flex-1")}
              style={{ animationDelay: `${(r % 4) * 80}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Carduri({ carduri }: { carduri: number }): ReactElement {
  return (
    <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: carduri }, (_, i) => (
        <div key={i} className={cn(PULS, "rounded-panou h-28")} />
      ))}
    </div>
  );
}

function Lista({ randuri }: { randuri: number }): ReactElement {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className={cn(PULS, "h-6 w-48")} />
      {Array.from({ length: randuri }, (_, i) => (
        <div key={i} className={cn(PULS, "rounded-panou h-16")} />
      ))}
    </div>
  );
}

function Formular({ campuri }: { campuri: number }): ReactElement {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {Array.from({ length: campuri }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className={cn(PULS, "h-3 w-28")} />
          <div className={cn(PULS, "rounded-control h-9 w-full")} />
        </div>
      ))}
      <div className={cn(PULS, "rounded-control mt-2 h-9 w-32")} />
    </div>
  );
}

function Detaliu({ sectiuni }: { sectiuni: number }): ReactElement {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className={cn(PULS, "h-7 w-64")} />
      {Array.from({ length: sectiuni }, (_, i) => (
        <div key={i} className="border-border rounded-panou border p-4">
          <div className={cn(PULS, "mb-3 h-4 w-40")} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className={cn(PULS, "h-4")} />
            <div className={cn(PULS, "h-4")} />
            <div className={cn(PULS, "h-4")} />
            <div className={cn(PULS, "h-4")} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Coada({ randuri }: { randuri: number }): ReactElement {
  return (
    <div aria-hidden="true" className="border-border rounded-panou divide-border divide-y border">
      {Array.from({ length: randuri }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className={cn(PULS, "size-2 shrink-0 rounded-full")} />
          <div className="flex-1">
            <div className={cn(PULS, "h-4 w-2/3")} />
            <div className={cn(PULS, "mt-1.5 h-3 w-1/3")} />
          </div>
          <div className={cn(PULS, "rounded-control h-8 w-20 shrink-0")} />
        </div>
      ))}
    </div>
  );
}
