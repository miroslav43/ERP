// src/lib/pdf/foaie-din-date.ts
//
// Modelul PDF al unei foi de parcurs, din datele citite. Locul UNIC unde rândurile
// bazei devin intrarea lui `modelFoaieParcurs`: ruta foii singure și pachetul lunar
// (F8) generează același document, iar două copii ale regulii „instantaneul bate
// vehiculul de azi” ar diverge la prima corectură.
//
// ── INSTANTANEUL BATE VEHICULUL DE AZI ──────────────────────────────────────
// Numărul, categoria, combustibilul și norma se iau din instantaneul de la
// trimitere (`vehicul_nr`, `vehicul_categorie`, `vehicul_combustibil`,
// `norma_l_100km`): foaia aprobată nu se schimbă retroactiv dacă mașina își
// schimbă norma mâine. Pe o ciornă instantaneul nu există încă (`vehicul_nr` nul),
// deci se ia vehiculul de azi.
import {
  modelFoaieParcurs,
  ordoneazaCurse,
  type AlimentareFoaie,
  type CursaFoaie,
  type IntrareFoaieParcurs,
  type LiniaETransport,
  type ModelFoaieParcurs,
} from "@/domain/fleet/foaie";
import {
  avertismenteCursa,
  grupeazaUit,
  type EIncadrare,
  type UitPentruAvertisment,
} from "@/domain/fleet/uit";
import { formatDate, formatDateTime, oraInBucharest } from "@/lib/format/date";
import type { CategorieVehicul, Combustibil } from "@/schemas/fleet";

import {
  ETICHETE_CATEGORIE,
  ETICHETE_COMBUSTIBIL,
  ETICHETE_E_TRANSPORT_SCURT,
  textAvertismentETransport,
} from "@/app/(app)/flota/etichete";

/** Un cod UIT, cum îl cere documentul (0217, F12f). */
export type UitPdf = UitPentruAvertisment & Readonly<{ cursa_id: string }>;

/** Cursa citită, cu încadrarea e-Transport când citirea o are (0217). */
export type CursaPdf = CursaFoaie & Readonly<{ e_transport?: EIncadrare }>;

/**
 * Liniile e-Transport ale foii și avertismentele lor, pentru PDF. Nota de prag
 * de vehicul NU intră: cere masa vehiculului, iar documentul aprobat se citește
 * din instantaneu, care nu o are. Același motiv ca în coada de aprobări.
 */
export function eTransportPentruPdf(
  curse: readonly CursaPdf[],
  uituri: readonly UitPdf[],
  ziuaFoii: string,
): Readonly<{ linii: ReadonlyMap<string, LiniaETransport>; avertismente: readonly string[] }> {
  const linii = new Map<string, LiniaETransport>();
  const avertismente: string[] = [];
  ordoneazaCurse(curse).forEach((c, i) => {
    const aleCursei = uituri.filter((u) => u.cursa_id === c.id);
    const incadrare = c.e_transport ?? "neaplicabil";
    if (incadrare === "neaplicabil" && aleCursei.length === 0) return;
    linii.set(c.id, {
      eticheta: incadrare === "neaplicabil" ? null : ETICHETE_E_TRANSPORT_SCURT[incadrare],
      uituri: aleCursei.map((u) => grupeazaUit(u.uit)),
    });
    for (const a of avertismenteCursa({ e_transport: incadrare }, aleCursei, ziuaFoii, null)) {
      avertismente.push(`Cursa ${String(i + 1)}: ${textAvertismentETransport(a)}`);
    }
  });
  return { linii, avertismente };
}

export interface DateFoaiePdf {
  readonly numar: string | null;
  readonly data: string;
  readonly status: IntrareFoaieParcurs["status"];
  readonly vehicul_nr: string | null;
  readonly vehicul_categorie: CategorieVehicul | null;
  readonly vehicul_combustibil: Combustibil | null;
  readonly norma_l_100km: number | null;
  readonly km_plecare: number | null;
  readonly km_sosire: number | null;
  readonly observatii: string | null;
  readonly trimis_la: string | null;
  readonly aprobat_la: string | null;
}

export interface VehiculPdf {
  readonly nr_inmatriculare: string;
  readonly categorie: CategorieVehicul;
  readonly tip_combustibil: Combustibil;
  readonly consum_mediu_declarat: number | null;
}

export function modelFoaieDinDate(
  p: Readonly<{
    foaie: DateFoaiePdf;
    /** Vehiculul de azi; `undefined` când nu se mai vede (șters). */
    vehicul: VehiculPdf | undefined;
    /** Numele șoferului, deja rezolvat de apelant („—” când lipsește). */
    sofer: string;
    aprobator: string | null;
    curse: readonly CursaPdf[];
    alimentari: readonly AlimentareFoaie[];
    /** Codurile UIT vii ale foii (0217). Lipsă = niciunul. */
    uituri?: readonly UitPdf[];
  }>,
): ModelFoaieParcurs {
  const { foaie, vehicul } = p;
  const categorie = foaie.vehicul_categorie ?? vehicul?.categorie ?? null;
  const combustibil = foaie.vehicul_combustibil ?? vehicul?.tip_combustibil ?? null;
  const areInstantaneu = foaie.vehicul_nr !== null;
  const eTransport = eTransportPentruPdf(p.curse, p.uituri ?? [], foaie.data);

  return modelFoaieParcurs({
    numar: foaie.numar,
    data: foaie.data,
    status: foaie.status,
    vehiculNr: foaie.vehicul_nr ?? vehicul?.nr_inmatriculare ?? "—",
    vehiculCategorie: categorie === null ? null : ETICHETE_CATEGORIE[categorie],
    vehiculCombustibil: combustibil === null ? null : ETICHETE_COMBUSTIBIL[combustibil],
    normaL100km: areInstantaneu ? foaie.norma_l_100km : (vehicul?.consum_mediu_declarat ?? null),
    unitate: combustibil === "electric" ? "kWh" : "l",
    sofer: p.sofer,
    kmPlecare: foaie.km_plecare,
    kmSosire: foaie.km_sosire,
    observatii: foaie.observatii,
    trimisLa: foaie.trimis_la,
    aprobatDe: p.aprobator,
    aprobatLa: foaie.aprobat_la,
    curse: p.curse,
    alimentari: p.alimentari,
    eTransport: eTransport.linii,
    avertismenteETransport: eTransport.avertismente,
    ora: (moment) => oraInBucharest(new Date(moment)),
    dataSiOra: (moment) => formatDateTime(new Date(moment)),
    ziua: formatDate,
  });
}
