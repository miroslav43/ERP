// src/components/ui/stare-goala.tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { buton } from "./buton";

/**
 * Starea goală, într-un singur exemplar. Înainte existau TREI tratamente
 * concurente: `EmptyState` (51 de fișiere), o `StareGoala` locală în fișa
 * angajatului și, în 36 de fișiere, câte un `<p className="text-muted-foreground">`
 * scris pe loc.
 *
 * ── DE CE `fel` E OBLIGATORIU ─────────────────────────────────────────────
 * „Nu există încă nimic” și „filtrele tale n-au găsit nimic” sunt două
 * situații diferite, cu două acțiuni diferite, și ambele sunt diferite de „nu
 * ai voie să vezi". Modulul de flotă face deja distincția corect și e cel mai
 * bun exemplu din depozit; restul aplicației o pierdea. Un tip obligatoriu o
 * face imposibil de uitat.
 *
 * ── DE CE ACȚIUNEA POATE FI ȘI `onClick` ──────────────────────────────────
 * `EmptyState` accepta doar `{ label, href }`. CINCISPREZECE stări goale din
 * aplicație RECOMANDĂ în text „ștergeți filtrele” — o acțiune care nu are href, fiindcă
 * înseamnă „curăță parametrii de căutare”. Fără varianta cu `onClick`, sfatul
 * rămânea un text pe care utilizatorul trebuia să-l execute manual.
 */
export type FelStareGoala = "initiala" | "filtrata" | "restrictionata";

export type ActiuneStareGoala =
  | Readonly<{ eticheta: string; href: string }>
  | Readonly<{ eticheta: string; onClick: () => void }>;

export type PropsStareGoala = Readonly<{
  fel: FelStareGoala;
  pictograma?: LucideIcon;
  titlu: string;
  descriere: string;
  actiune?: ActiuneStareGoala;
  /** Pentru o secțiune dintr-o fișă: un card nu suportă 16rem de spațiu gol. */
  compact?: boolean;
  children?: ReactNode;
  className?: string;
}>;

export function StareGoala({
  fel,
  pictograma: Pictograma = Inbox,
  titlu,
  descriere,
  actiune,
  compact,
  children,
  className,
}: PropsStareGoala): ReactElement {
  return (
    <div
      className={cn(
        "border-border bg-surface rounded-panou flex flex-col items-center justify-center border border-dashed text-center",
        compact === true ? "px-4 py-8" : "px-6 py-16",
        className,
      )}
    >
      <Pictograma
        aria-hidden="true"
        className={cn("text-muted-foreground", compact === true ? "mb-2 size-6" : "mb-4 size-10")}
      />
      <p
        className={cn(
          "text-foreground font-semibold",
          compact === true ? "text-corp" : "text-sectiune",
        )}
      >
        {titlu}
      </p>
      <p className="text-muted-foreground text-corp mt-1 max-w-prose text-pretty">{descriere}</p>

      {actiune === undefined ? null : "href" in actiune ? (
        <Link href={actiune.href} className={cn(buton({ varianta: "primar" }), "mt-6")}>
          {actiune.eticheta}
        </Link>
      ) : (
        <button
          type="button"
          onClick={actiune.onClick}
          className={cn(buton({ varianta: "secundar" }), "mt-6")}
        >
          {actiune.eticheta}
        </button>
      )}

      {/* `fel` nu schimbă aspectul, ci obligă apelantul să se întrebe CARE gol
          e. Rămâne în DOM ca să se poată verifica de afară — inclusiv într-un
          test — că un ecran cu filtre active nu arată golul inițial. */}
      <span hidden data-fel-gol={fel} />
      {children}
    </div>
  );
}
