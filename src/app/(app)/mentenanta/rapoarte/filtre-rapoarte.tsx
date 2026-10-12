// src/app/(app)/mentenanta/rapoarte/filtre-rapoarte.tsx
import Link from "next/link";
import type { ReactElement } from "react";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { formatDate } from "@/lib/format/date";
import { plusZile, plusLuni, type Perioada } from "@/domain/maintenance/indicatori";

const CHEI_PROPRII = ["de_la", "pana_la"] as const;

/** Adresa raportului pe o perioadă. */
export function hrefPerioada(perioada: Perioada): string {
  return `/mentenanta/rapoarte?de_la=${perioada.deLa}&pana_la=${perioada.panaLa}`;
}

/** Scurtăturile: perioadele cerute cel mai des, fără tastat date. */
export function perioadeRapide(
  azi: string,
): readonly { readonly eticheta: string; readonly perioada: Perioada }[] {
  const [an, luna] = azi.split("-") as [string, string];
  const inceputLuna = `${an}-${luna}-01`;
  return [
    {
      eticheta: "Ultimele 12 luni",
      perioada: { deLa: plusZile(plusLuni(azi, -12), 1), panaLa: azi },
    },
    { eticheta: "Anul curent", perioada: { deLa: `${an}-01-01`, panaLa: azi } },
    { eticheta: "Luna curentă", perioada: { deLa: inceputLuna, panaLa: azi } },
    {
      eticheta: "Luna trecută",
      perioada: { deLa: plusLuni(inceputLuna, -1), panaLa: plusZile(inceputLuna, -1) },
    },
  ];
}

/**
 * Bara de perioadă a raportului (M8). Server Component, ca bara intervențiilor:
 * fără stare și fără handler. Perioada arătată e cea NORMALIZATĂ — cea pentru
 * care sunt calculate cifrele —, nu neapărat cea tastată.
 */
export function FiltreRapoarteForm({
  perioada,
  azi,
}: Readonly<{ perioada: Perioada; azi: string }>): ReactElement {
  const active: FiltruActiv[] = [
    { cheie: "de_la", eticheta: `De la ${formatDate(perioada.deLa)}` },
    { cheie: "pana_la", eticheta: `Până la ${formatDate(perioada.panaLa)}` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <BaraFiltre active={active} cheiProprii={CHEI_PROPRII} textAplica="Calculează">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtru-raport-de-la" className="text-corp font-medium">
            De la
          </label>
          <input
            key={perioada.deLa}
            id="filtru-raport-de-la"
            name="de_la"
            type="date"
            max={azi}
            defaultValue={perioada.deLa}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtru-raport-pana-la" className="text-corp font-medium">
            Până la
          </label>
          <input
            key={perioada.panaLa}
            id="filtru-raport-pana-la"
            name="pana_la"
            type="date"
            max={azi}
            defaultValue={perioada.panaLa}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
      </BaraFiltre>
      <nav aria-label="Perioade rapide" className="text-nota flex flex-wrap gap-x-4 gap-y-1">
        {perioadeRapide(azi).map(({ eticheta, perioada: p }) => {
          const curenta = p.deLa === perioada.deLa && p.panaLa === perioada.panaLa;
          return (
            <Link
              key={eticheta}
              href={hrefPerioada(p)}
              aria-current={curenta ? "true" : undefined}
              className={
                curenta
                  ? "text-primary font-semibold"
                  : "text-primary underline-offset-2 hover:underline"
              }
            >
              {eticheta}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
