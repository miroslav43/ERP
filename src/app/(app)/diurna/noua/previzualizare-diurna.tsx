"use client";

import { useMemo } from "react";

import { calculeazaZileDiurna } from "@/domain/per-diem/ferestre";
import { calculeazaSume, type BaremTara } from "@/domain/per-diem/sume";
import { Callout } from "@/components/ui/callout";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { formatOre } from "@/lib/format/ore";

import { textZile } from "../etichete";
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
 *
 * `politica` poate fi `null`: politica firmei e VERSIONATĂ, iar versiunea care
 * contează e cea valabilă la data plecării, nu cea de azi. Când data aleasă
 * cade în afara oricărei versiuni, nu există cifră de arătat — și nici salvare
 * posibilă, fiindcă `internal.valideaza_deplasare` refuză inserarea cu P0001.
 * Spus aici, înainte de completarea celorlalte câmpuri.
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
  readonly politica: PoliticaRand | null;
  readonly baremuri: readonly BaremTara[];
}) {
  const rezultat = useMemo(() => {
    if (politica === null) return null;
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

  if (politica === null) {
    return (
      <Callout fel="atentie" titlu="Nicio politică valabilă la data plecării">
        Politica de diurnă e versionată, iar la data aleasă nu se aplică nicio versiune. Salvarea va
        fi refuzată de bază — alegeți altă dată de plecare sau cereți administratorului o versiune
        valabilă atunci.
      </Callout>
    );
  }

  if (rezultat === null) {
    return (
      <p className="text-muted-foreground text-corp">
        Completați data de plecare și data de sosire pentru a vedea previzualizarea diurnei.
      </p>
    );
  }

  const { durataOre, sume } = rezultat;

  if (sume.zileTotal === 0) {
    return (
      <div className="text-foreground text-corp space-y-1">
        <LiniePolitica politica={politica} />
        <p>
          <strong>0 zile de diurnă</strong> — deplasarea durează {formatOre(durataOre)} h, sub
          pragul de {formatOre(politica.prag_ore_minim)} h din politică.
        </p>
      </div>
    );
  }

  const primaFereastra = sume.detalii.find((d) => d.stare === "ok");

  return (
    <div className="text-foreground text-corp space-y-1">
      <LiniePolitica politica={politica} />
      {sume.baremLipsa ? (
        <p>
          <strong>{textZile(sume.zileTotal)}</strong> — lipsește baremul de diurnă pentru țara
          aleasă la această dată; suma nu poate fi calculată.
        </p>
      ) : sume.cursIncomplet ? (
        <p>
          <strong>{textZile(sume.zileTotal)}</strong> calculate; suma în lei necesită cursul valutar
          (curs diurnă).
        </p>
      ) : sume.valoareLei !== null ? (
        <>
          <p>
            {textZile(sume.zileTotal)}
            {primaFereastra?.valoareZi !== null && primaFereastra?.valoareZi !== undefined
              ? ` × ${formatLei(primaFereastra.valoareZi)}`
              : ""}{" "}
            = <strong>{formatLei(sume.valoareLei)}</strong>
          </p>
          {sume.parteImpozabilaLei !== null && sume.parteImpozabilaLei > 0 ? (
            <p className="text-foreground text-nota">
              din care neimpozabil {formatLei(sume.parteNeimpozabilaLei ?? 0)}, impozabil{" "}
              {formatLei(sume.parteImpozabilaLei)} (peste plafonul legal).
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Cu ce s-a calculat cifra de deasupra.
 *
 * Fără ea, previzualizarea era o cutie neagră: aceeași deplasare putea da alt
 * număr azi și altul mâine, dacă între timp intra în vigoare o versiune nouă,
 * fără ca ecranul să spună de ce.
 */
function LiniePolitica({ politica }: { readonly politica: PoliticaRand }) {
  return (
    <p className="text-muted-foreground text-nota">
      Calculat cu politica „{politica.denumire}”, valabilă de la{" "}
      {formatDate(politica.valabil_de_la)}
      {politica.valabil_pana === null ? "" : ` până la ${formatDate(politica.valabil_pana)}`}.
    </p>
  );
}
