// src/components/ui/pastile-filtre.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useTransition, type ReactElement } from "react";

import type { FiltruActiv } from "./bara-filtre";

/**
 * Pastilele unui filtru „de intrare" pe o listă FĂRĂ bară de filtre.
 *
 * `?angajat=<id>` ajunge pe /ssm/eip, /evaluari/kpi sau /ticketing/coada
 * dintr-un link de pe fișa angajatului. Lista trebuie să SPUNĂ că e filtrată
 * și să lase omul să scoată filtrul cu un clic — altfel o listă scurtă pare
 * o listă goală. Aceeași pastilă ca în `BaraFiltre`, fără formular: aici nu
 * există câmp de completat, doar ceva de șters.
 */
export function PastileFiltre({
  active,
}: Readonly<{ active: readonly FiltruActiv[] }>): ReactElement | null {
  const parametri = useSearchParams();
  const cale = usePathname();
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  if (active.length === 0) return null;

  function sterge(cheie: string): void {
    const p = new URLSearchParams(parametri.toString());
    p.delete(cheie);
    p.delete("cursor");
    porneste(() => {
      router.replace(p.size === 0 ? cale : `${cale}?${p.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-live="polite">
      <span className="text-muted-foreground text-nota">Filtre active:</span>
      {active.map((f) => (
        <button
          key={f.cheie}
          type="button"
          disabled={inCurs}
          onClick={() => {
            sterge(f.cheie);
          }}
          className="border-foreground/30 text-foreground hover:bg-surface active:bg-border text-nota rounded-full border px-2.5 py-0.5 font-medium transition-colors disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-1.5">
            {f.eticheta}
            <X aria-hidden="true" className="size-3" />
            <span className="sr-only">Șterge filtrul</span>
          </span>
        </button>
      ))}
    </div>
  );
}
