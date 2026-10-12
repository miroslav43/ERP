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
  type AlimentareFoaie,
  type CursaFoaie,
  type IntrareFoaieParcurs,
  type ModelFoaieParcurs,
} from "@/domain/fleet/foaie";
import { formatDate, formatDateTime, oraInBucharest } from "@/lib/format/date";
import type { CategorieVehicul, Combustibil } from "@/schemas/fleet";

import { ETICHETE_CATEGORIE, ETICHETE_COMBUSTIBIL } from "@/app/(app)/flota/etichete";

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
    curse: readonly CursaFoaie[];
    alimentari: readonly AlimentareFoaie[];
  }>,
): ModelFoaieParcurs {
  const { foaie, vehicul } = p;
  const categorie = foaie.vehicul_categorie ?? vehicul?.categorie ?? null;
  const combustibil = foaie.vehicul_combustibil ?? vehicul?.tip_combustibil ?? null;
  const areInstantaneu = foaie.vehicul_nr !== null;

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
    ora: (moment) => oraInBucharest(new Date(moment)),
    dataSiOra: (moment) => formatDateTime(new Date(moment)),
    ziua: formatDate,
  });
}
