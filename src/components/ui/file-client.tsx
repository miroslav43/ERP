// src/components/ui/file-client.tsx
"use client";

import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

import { caleaDin } from "@/config/porti-ruta";

import { BandaFile, Fila } from "./file";

export type FilaModul = Readonly<{
  href: string;
  eticheta: string;
  /** Absent sau zero = fără pastilă. */
  contor?: number;
}>;

/**
 * Fila activă e cea cu CEL MAI LUNG `href` care e prefix al căii curente, pe
 * graniță de segment. „Vehicule" (`/flota`) nu se aprinde pe `/flota/foi`,
 * fiindcă „Foi de parcurs" (`/flota/foi`) e potrivirea mai lungă; dar
 * `/flota/foi/<id>` aprinde tot „Foi de parcurs".
 */
export function filaActiva(cale: string, file: readonly FilaModul[]): string | null {
  const curenta = caleaDin(cale);
  let activa: string | null = null;
  for (const fila of file) {
    const href = caleaDin(fila.href);
    const potrivire = curenta === href || curenta.startsWith(`${href}/`);
    if (potrivire && (activa === null || href.length > activa.length)) activa = href;
  }
  return activa;
}

export function FileClient({
  eticheta,
  file,
}: Readonly<{ eticheta: string; file: readonly FilaModul[] }>): ReactElement {
  const cale = usePathname();
  const activa = filaActiva(cale, file);
  return (
    <BandaFile eticheta={eticheta}>
      {file.map((fila) => (
        <Fila
          key={fila.href}
          href={fila.href}
          activ={caleaDin(fila.href) === activa}
          {...(fila.contor === undefined ? {} : { contor: fila.contor })}
        >
          {fila.eticheta}
        </Fila>
      ))}
    </BandaFile>
  );
}
