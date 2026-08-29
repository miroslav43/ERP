// src/components/incarcare/rotita.tsx
"use client";

import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Rotița, într-un singur loc.
 *
 * Până acum `<Loader2 className="size-4 animate-spin" />` era scris de mână în
 * șase fișiere, cu mărimi diferite și fără `aria-hidden` peste tot. Nu e o
 * problemă de estetică: un `<svg>` fără `aria-hidden` intră în arborele de
 * accesibilitate ca nod anonim, iar cititorul de ecran îl anunță în mijlocul
 * propoziției.
 *
 * ── MIȘCAREA REDUSĂ ───────────────────────────────────────────────────────
 * `globals.css:498-507` taie GLOBAL `animation-iteration-count: 1`. Sub
 * `prefers-reduced-motion`, rotița face o tură și se oprește — arată exact ca o
 * interfață blocată. De aceea rotița nu are voie să fie singurul semn: peste tot
 * unde apare, textul de lângă ea trebuie să spună ce se întâmplă. Aici nu
 * încercăm să ocolim regula globală; o compensăm cu cuvinte.
 */
export function Rotita({
  className,
  marime = "mica",
}: Readonly<{ className?: string; marime?: "mica" | "mare" }>): ReactElement {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("animate-spin", marime === "mare" ? "size-8" : "size-4", className)}
    />
  );
}
