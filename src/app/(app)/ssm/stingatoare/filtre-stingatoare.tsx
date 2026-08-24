import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { Camp } from "@/components/ui/camp";
import { STATUS_STINGATOR, type StatusStingator } from "@/schemas/ssm";

import { ETICHETE_STATUS_STINGATOR } from "../etichete";

/**
 * Filtrele listei de stingătoare.
 *
 * ── CE PIERDEA VECHIUL `aplica()` ─────────────────────────────────────────
 * Pornea din `new URLSearchParams()` GOL și scria înapoi doar `cauta` și
 * `status`. Din clipa în care lista a primit antete sortabile și mărime de
 * pagină, orice apăsare pe „Filtrează” arunca `sort` ȘI `limita`: omul sorta
 * după locație, cerea 100 de rânduri, apoi filtra după stare — și primea
 * înapoi ordinea implicită, 25 de rânduri, fără nicio explicație.
 *
 * `<BaraFiltre>` pornește din `useSearchParams()` și atinge numai
 * `cheiProprii`, deci `sort` și `limita` supraviețuiesc prin construcție, iar
 * `cursor` cade la fiecare schimbare de filtru — ar fi continuat de la un rând
 * ieșit din rezultat.
 *
 * ── DE CE NU MAI E COMPONENTĂ DE CLIENT ───────────────────────────────────
 * Nu mai are nici stare, nici handler, nici `useSearchParams`: valorile curente
 * vin ca proprietăți, deja validate de `filtreStingatoareSchema` în pagină —
 * deci o valoare inventată în adresă nu mai poate ajunge nici în `defaultValue`,
 * nici pe o pastilă. Fără `"use client"`, fișierul iese din pachetul de
 * JavaScript al rutei.
 */
export function FiltreStingatoare({
  status,
  cauta,
}: {
  readonly status: StatusStingator | null;
  readonly cauta: string | null;
}): ReactElement {
  // Pastilele poartă DENUMIREA stării, nu valoarea din bază: „Stare: În
  // service”, nu „status=in_service”.
  const active: readonly FiltruActiv[] = [
    ...(cauta === null ? [] : [{ cheie: "cauta", eticheta: `Cod: ${cauta}` }]),
    ...(status === null
      ? []
      : [{ cheie: "status", eticheta: `Stare: ${ETICHETE_STATUS_STINGATOR[status]}` }]),
  ];

  return (
    <BaraFiltre active={active} cheiProprii={["cauta", "status"]}>
      <Camp nume="cauta" eticheta="Cod stingător" className="w-full sm:w-56">
        {(atribute) => (
          <input {...atribute} key={cauta ?? ""} type="search" defaultValue={cauta ?? ""} />
        )}
      </Camp>

      <Camp nume="status" eticheta="Stare" fel="select" className="w-full sm:w-48">
        {(atribute) => (
          <select {...atribute} key={status ?? ""} defaultValue={status ?? ""}>
            {/* NU „Toate": fără filtru, citirea exclude stingătoarele casate,
                exact ca `contorStingatoare`. Eticheta spune ce se vede. */}
            <option value="">În uz (activ și în service)</option>
            {STATUS_STINGATOR.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STATUS_STINGATOR[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>
    </BaraFiltre>
  );
}
