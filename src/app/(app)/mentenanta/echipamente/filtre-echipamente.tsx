// src/app/(app)/mentenanta/echipamente/filtre-echipamente.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { STATUS_ECHIPAMENT, type FiltreEchipamente } from "@/schemas/maintenance";

import { ETICHETE_STATUS_ECHIPAMENT } from "../etichete";

/**
 * Cheile pe care le administrează bara — exact cele pe care le scria vechiul
 * `aplica()`, nici una în plus, nici una în minus.
 *
 * Vechiul `aplica()` pornea din `new URLSearchParams()` GOL și repopula doar
 * `cauta` și `status`, deci orice apăsare pe „Filtrează” arunca `sort` și
 * `limita` — ordinea aleasă din antetul tabelului și mărimea de pagină
 * dispăreau tăcut. Aici nu mai apar: bara pleacă din parametrii existenți și
 * nu poate șterge decât ce i s-a declarat.
 */
const CHEI_PROPRII = ["cauta", "status"] as const;

export type PropsFiltreEchipamente = Readonly<{
  /** Filtrele DEJA validate de pagină, ca pastilele să nu arate valori inventate. */
  filtre: Pick<FiltreEchipamente, "cauta" | "status">;
}>;

/**
 * Fișierul n-are `"use client"` și nu mai are ce căuta: fără `aplica()`, fără
 * `useRouter`/`usePathname`/`useSearchParams` și fără `useTransition`, nu-i
 * rămâne nici stare, nici handler. Valorile curente vin ca prop de la pagină,
 * deci formularul se randează pe server și pleacă din pachetul rutei.
 */
export function FiltreEchipamenteForm({ filtre }: PropsFiltreEchipamente): ReactElement {
  const active: FiltruActiv[] = [];
  if (filtre.cauta !== null) {
    active.push({ cheie: "cauta", eticheta: `Cod sau denumire: ${filtre.cauta}` });
  }
  if (filtre.status !== null) {
    active.push({
      cheie: "status",
      eticheta: `Stare: ${ETICHETE_STATUS_ECHIPAMENT[filtre.status]}`,
    });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII}>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-echipamente-cauta" className="text-corp font-medium">
          Cod sau denumire
        </label>
        <input
          // `key` legat de valoarea din adresă: ștergerea unei pastile schimbă
          // adresa fără să atingă formularul, iar un control NECONTROLAT și-ar
          // păstra în DOM valoarea veche, deja scoasă din listă.
          key={filtre.cauta ?? ""}
          id="filtru-echipamente-cauta"
          name="cauta"
          type="search"
          defaultValue={filtre.cauta ?? ""}
          placeholder="Ex. CMP-014"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-echipamente-status" className="text-corp font-medium">
          Stare
        </label>
        <select
          key={filtre.status ?? ""}
          id="filtru-echipamente-status"
          name="status"
          defaultValue={filtre.status ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {STATUS_ECHIPAMENT.map((s) => (
            <option key={s} value={s}>
              {ETICHETE_STATUS_ECHIPAMENT[s]}
            </option>
          ))}
        </select>
      </div>
    </BaraFiltre>
  );
}
