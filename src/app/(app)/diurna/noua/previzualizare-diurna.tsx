"use client";

import { useMemo } from "react";

import { calculeazaZileDiurna } from "@/domain/per-diem/ferestre";
import { calculeazaSume, type BaremTara } from "@/domain/per-diem/sume";
import { formatAmount, formatLei } from "@/lib/format/money";
import type { PoliticaRand } from "@/lib/queries/per-diem";

/**
 * Previzualizarea „N zile × valoare = total”, ÎNAINTE de trimitere.
 *
 * Recalculează la fiecare schimbare de dată/țară, cu politica și baremele
 * încărcate O DATĂ de pe server (componenta părinte) ca props serializabile.
 * Fără etape reale: o etapă (`business_trip_legs`) cere `business_trip_id`,
 * care nu există încă la crearea deplasării — traseul multi-țară se
 * introduce DUPĂ salvare, pe fișa deplasării, unde recalculul folosește
 * exact același motor cu datele reale.
 */
export function PrevizualizareDiurna({
  plecareLa,
  sosireLa,
  countryId,
  cursDiurna,
  politica,
  baremuri,
}: {
  readonly plecareLa: string;
  readonly sosireLa: string;
  readonly countryId: string | null;
  readonly cursDiurna: number | null;
  readonly politica: PoliticaRand;
  readonly baremuri: readonly BaremTara[];
}) {
  const rezultat = useMemo(() => {
    if (plecareLa.length === 0 || sosireLa.length === 0) return null;
    const plecare = new Date(plecareLa);
    const sosire = new Date(sosireLa);
    if (Number.isNaN(plecare.getTime()) || Number.isNaN(sosire.getTime())) return null;

    const taraFereastra = countryId ?? politica.country_id_intern;
    const ferestre = calculeazaZileDiurna({
      plecare,
      sosire,
      pragOreMinim: politica.prag_ore_minim,
      pragOreZiIntreaga: politica.prag_ore_zi_intreaga,
      fractiuneZiPartiala: politica.fractiune_zi_partiala,
      acordaZiuaTrecerii: politica.acorda_diurna_ziua_trecerii,
      regulaTrecere: politica.regula_tara_trecere,
      taraImplicitaId: taraFereastra,
      etape: [],
      // O singură țară pe toată previzualizarea (fără etape) — departajarea de
      // trecere de frontieră nu se declanșează niciodată aici.
      cautaValoareBarem: () => null,
    });
    const durataOre = Math.max(0, (sosire.getTime() - plecare.getTime()) / 3_600_000);
    const sume = calculeazaSume(
      ferestre,
      {
        countryIdIntern: politica.country_id_intern,
        monedaInterna: politica.moneda_interna,
        diurnaInternaZi: politica.diurna_interna_zi,
        diurnaBazaLegalaInterna: politica.diurna_baza_legala_interna,
        multiploPlafonNeimpozabil: politica.multiplu_plafon_neimpozabil,
        multiploDiurnaExterna: politica.multiplu_diurna_externa,
        categorieBarem: politica.categorie_barem,
      },
      baremuri,
      cursDiurna,
    );
    return { durataOre, sume };
  }, [plecareLa, sosireLa, countryId, cursDiurna, politica, baremuri]);

  if (rezultat === null) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Completați data de plecare și data de sosire pentru a vedea previzualizarea diurnei.
      </p>
    );
  }

  const { durataOre, sume } = rezultat;

  if (sume.zileTotal === 0) {
    return (
      <p className="text-sm text-zinc-700 dark:text-zinc-200">
        <strong>0 zile de diurnă</strong> — deplasarea durează {formatAmount(durataOre)} ore, sub
        pragul de {formatAmount(politica.prag_ore_minim)} ore din politică.
      </p>
    );
  }

  const primaFereastra = sume.detalii.find((d) => d.stare === "ok");

  return (
    <div className="space-y-1 text-sm text-zinc-700 dark:text-zinc-200">
      {sume.baremLipsa ? (
        <p>
          <strong>{formatAmount(sume.zileTotal)} zile</strong> — lipsește baremul de diurnă pentru
          țara aleasă la această dată; suma nu poate fi calculată.
        </p>
      ) : sume.cursIncomplet ? (
        <p>
          <strong>{formatAmount(sume.zileTotal)} zile</strong> calculate; suma în lei necesită
          cursul valutar (curs diurnă).
        </p>
      ) : sume.valoareLei !== null ? (
        <>
          <p>
            {formatAmount(sume.zileTotal)} zile
            {primaFereastra?.valoareZi !== null && primaFereastra?.valoareZi !== undefined
              ? ` × ${formatLei(primaFereastra.valoareZi)}`
              : ""}{" "}
            = <strong>{formatLei(sume.valoareLei)}</strong>
          </p>
          {sume.parteImpozabilaLei !== null && sume.parteImpozabilaLei > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              din care neimpozabil {formatLei(sume.parteNeimpozabilaLei ?? 0)}, impozabil{" "}
              {formatLei(sume.parteImpozabilaLei)} (peste plafonul legal).
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
