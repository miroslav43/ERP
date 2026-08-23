// src/components/ui/bara-filtre.tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useTransition, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { Buton } from "./buton";

/**
 * Panoul de filtre al unei liste.
 *
 * ── DEFECTUL PE CARE ÎL FACE IMPOSIBIL ────────────────────────────────────
 * Șase module porneau din `new URLSearchParams()` GOL și îl repopulau doar cu
 * cheile pe care le administra formularul lor. Consecința: `department_id`,
 * `echipament` sau `limita` puse în adresă dispăreau la prima apăsare pe
 * „Filtrează" — capacități implementate complet pe server, șterse de client.
 *
 * Aici punctul de plecare e ÎNTOTDEAUNA `useSearchParams()`, iar componenta
 * atinge numai cheile pe care le primește. Restul supraviețuiesc prin
 * construcție, nu prin grija fiecărui autor.
 *
 * ── DE CE PASTILE, NU DOAR CÂMPURI ────────────────────────────────────────
 * O listă filtrată arată exact ca o listă goală. Cinci stări goale din produs
 * recomandau în text „Ștergeți filtrele" fără să existe butonul. Pastilele fac
 * filtrul activ VIZIBIL și îi dau fiecăruia o ieșire proprie.
 */
export type FiltruActiv = Readonly<{
  /** Cheia din query string, ca să se poată șterge exact aceea. */
  cheie: string;
  /** Ce scrie pe pastilă: „Departament: Producție". */
  eticheta: string;
}>;

export type PropsBaraFiltre = Readonly<{
  /** Câmpurile de filtrare. Trimiterea se face de formular, cu `<form>`. */
  children: ReactNode;
  active: readonly FiltruActiv[];
  /** Cheile pe care le administrează bara — se șterg la „Șterge tot". */
  cheiProprii: readonly string[];
  className?: string;
}>;

export function BaraFiltre({
  children,
  active,
  cheiProprii,
  className,
}: PropsBaraFiltre): ReactElement {
  const parametri = useSearchParams();
  const cale = usePathname();
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  function navigheaza(schimba: (p: URLSearchParams) => void): void {
    // Pornim de la parametrii EXISTENȚI, nu de la un obiect gol.
    const p = new URLSearchParams(parametri.toString());
    schimba(p);
    // Cursorul de paginare NU supraviețuiește unei schimbări de filtru: ar
    // continua de la un rând care nu mai e în rezultat.
    p.delete("cursor");
    porneste(() => {
      router.replace(p.size === 0 ? cale : `${cale}?${p.toString()}`);
    });
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="border-border bg-surface rounded-panou flex flex-wrap items-end gap-4 border p-4">
        {children}
      </div>

      {active.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          <span className="text-muted-foreground text-nota">Filtre active:</span>
          {active.map((f) => (
            <button
              key={f.cheie}
              type="button"
              disabled={inCurs}
              onClick={() => navigheaza((p) => p.delete(f.cheie))}
              className="border-foreground/30 text-foreground hover:bg-surface active:bg-border text-nota rounded-full border px-2.5 py-0.5 font-medium transition-colors disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-1.5">
                {f.eticheta}
                <X aria-hidden="true" className="size-3" />
                <span className="sr-only">Șterge filtrul</span>
              </span>
            </button>
          ))}
          <Buton
            varianta="link"
            disabled={inCurs}
            onClick={() =>
              navigheaza((p) => {
                for (const c of cheiProprii) p.delete(c);
              })
            }
          >
            Șterge toate filtrele
          </Buton>
        </div>
      )}
    </div>
  );
}
