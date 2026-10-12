// src/app/(app)/mentenanta/interventii/filtre-interventii.tsx
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { formatDate } from "@/lib/format/date";
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
const CHEI_EXTERNE = ["echipament", "plan"] as const;

const CHEI_PROPRII = ["tip", "rezultat", "executant", "de_la", "pana_la"] as const;

export type PropsFiltreInterventii = Readonly<{
  /** Filtrele DEJA validate de pagină, ca pastilele să nu arate valori inventate. */
  /** Codul echipamentului filtrat, când filtrul e pus din afara barei. */
  etichetaEchipament?: string;
  /** Denumirea planului filtrat — linkul „Vezi toate intervențiile planului” de pe fișa planului. */
  etichetaPlan?: string;
  filtre: Pick<FiltreInterventii, "tip" | "rezultat" | "executant" | "de_la" | "pana_la">;
  /** Angajații pentru filtrul „Executant” (M6); executanții externi n-au fișă. */
  executanti?: readonly Readonly<{ id: string; nume: string }>[];
}>;

/**
 * Server Component: fără `aplica()`, fără `useRouter`/`usePathname`/
 * `useSearchParams` și fără `useTransition` nu mai rămâne nici stare, nici
 * handler, deci nici motiv de `"use client"`.
 */
export function FiltreInterventiiForm({
  filtre,
  etichetaEchipament,
  etichetaPlan,
  executanti = [],
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

  if (filtre.executant !== null) {
    const nume = executanti.find((a) => a.id === filtre.executant)?.nume ?? "angajat";
    active.push({ cheie: "executant", eticheta: `Executant: ${nume}` });
  }
  if (filtre.de_la !== null) {
    active.push({ cheie: "de_la", eticheta: `De la ${formatDate(filtre.de_la)}` });
  }
  if (filtre.pana_la !== null) {
    active.push({ cheie: "pana_la", eticheta: `Până la ${formatDate(filtre.pana_la)}` });
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
  if (etichetaPlan !== undefined) {
    active.push({ cheie: "plan", eticheta: `Plan: ${etichetaPlan}` });
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

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-interventii-executant" className="text-corp font-medium">
          Executant
        </label>
        <select
          key={filtre.executant ?? ""}
          id="filtru-interventii-executant"
          name="executant"
          defaultValue={filtre.executant ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">Toți</option>
          {executanti.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-interventii-de-la" className="text-corp font-medium">
          De la
        </label>
        <input
          key={filtre.de_la ?? ""}
          id="filtru-interventii-de-la"
          name="de_la"
          type="date"
          defaultValue={filtre.de_la ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtru-interventii-pana-la" className="text-corp font-medium">
          Până la
        </label>
        <input
          key={filtre.pana_la ?? ""}
          id="filtru-interventii-pana-la"
          name="pana_la"
          type="date"
          defaultValue={filtre.pana_la ?? ""}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
    </BaraFiltre>
  );
}
