// src/app/(app)/mentenanta/interventii/filtre-interventii.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import {
  REZULTATE_INTERVENTIE,
  TIPURI_MENTENANTA,
  type FiltreInterventii,
} from "@/schemas/maintenance";

import { ETICHETE_REZULTAT_INTERVENTIE, ETICHETE_TIP_MENTENANTA } from "../etichete";

/**
 * Cheile administrate de bară — exact cele pe care le scria vechiul `aplica()`.
 *
 * Acela pornea din `new URLSearchParams()` gol și repopula doar `tip` și
 * `rezultat`, deci fiecare apăsare pe „Filtrează” arunca `sort`, `limita` ȘI
 * `echipament` — ultimul e un filtru real, citit de `filtreInterventiiSchema`
 * și de interogare, dar fără câmp în formular: o listă venită dintr-un link pe
 * echipament se lărgea tăcut la toată organizația.
 */
const CHEI_EXTERNE = ["echipament"] as const;

const CHEI_PROPRII = ["tip", "rezultat"] as const;

export type PropsFiltreInterventii = Readonly<{
  /** Filtrele DEJA validate de pagină, ca pastilele să nu arate valori inventate. */
  /** Codul echipamentului filtrat, când filtrul e pus din afara barei. */
  etichetaEchipament?: string;
  filtre: Pick<FiltreInterventii, "tip" | "rezultat">;
}>;

/**
 * Server Component: fără `aplica()`, fără `useRouter`/`usePathname`/
 * `useSearchParams` și fără `useTransition` nu mai rămâne nici stare, nici
 * handler, deci nici motiv de `"use client"`.
 */
export function FiltreInterventiiForm({
  filtre,
  etichetaEchipament,
}: PropsFiltreInterventii): ReactElement {
  const active: FiltruActiv[] = [];
  if (filtre.tip !== null) {
    active.push({ cheie: "tip", eticheta: `Tip: ${ETICHETE_TIP_MENTENANTA[filtre.tip]}` });
  }
  if (filtre.rezultat !== null) {
    active.push({
      cheie: "rezultat",
      eticheta: `Rezultat: ${ETICHETE_REZULTAT_INTERVENTIE[filtre.rezultat]}`,
    });
  }

  /*
   * `echipament` NU e în `CHEI_PROPRII`: n-are câmp în bară, deci prima
   * trimitere l-ar fi șters singură (`FormData.get()` întoarce `null`). Intră
   * în `cheiExterne` — se șterge la „Șterge toate filtrele" și are pastilă
   * proprie, dar nu se citește din formular.
   */
  if (etichetaEchipament !== undefined) {
    active.push({ cheie: "echipament", eticheta: `Echipament: ${etichetaEchipament}` });
  }

  return (
    <BaraFiltre active={active} cheiProprii={CHEI_PROPRII} cheiExterne={CHEI_EXTERNE}>
      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-interventii-tip" className="text-corp font-medium">
          Tip
        </label>
        <select
          // `key` legat de valoarea din adresă: ștergerea unei pastile schimbă
          // adresa fără să atingă formularul, iar un control NECONTROLAT și-ar
          // păstra în DOM valoarea veche, deja scoasă din listă.
          key={filtre.tip ?? ""}
          id="filtru-interventii-tip"
          name="tip"
          defaultValue={filtre.tip ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {TIPURI_MENTENANTA.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_MENTENANTA[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-interventii-rezultat" className="text-corp font-medium">
          Rezultat
        </label>
        <select
          key={filtre.rezultat ?? ""}
          id="filtru-interventii-rezultat"
          name="rezultat"
          defaultValue={filtre.rezultat ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toate</option>
          {REZULTATE_INTERVENTIE.map((r) => (
            <option key={r} value={r}>
              {ETICHETE_REZULTAT_INTERVENTIE[r]}
            </option>
          ))}
        </select>
      </div>
    </BaraFiltre>
  );
}
