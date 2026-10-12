// src/app/(app)/mentenanta/rapoarte/csv-raport.ts
//
// Liniile CSV ale raportului de mentenanță (M8), pure: un rând pe echipament,
// cu aceleași cifre ca tabelul de pe ecran. Separatorul e `;` și zecimala e
// virgula — Excel-ul în limba română le citește așa; un `.` ar transforma
// „12.5” într-o dată calendaristică. O valoare fără numitor rămâne celulă GOALĂ,
// nu „—”: în foaia de calcul „—” e text și strică orice sumă pe coloană.
import type { EchipamentRaport, RaportMentenanta } from "@/domain/maintenance/indicatori";

export const ANTET_CSV_RAPORT = [
  "Cod",
  "Denumire",
  "Intervenții",
  "Cost preventiv (lei)",
  "Cost corectiv (lei)",
  "Cost verificări legale (lei)",
  "Cost intern (lei)",
  "Cost extern (lei)",
  "Acoperit de garanție (lei)",
  "Cost suportat (lei)",
  "Cost ultimele 12 luni (lei)",
  "Valoare de achiziție (lei)",
  "Cost / valoare (%)",
  "Semnal de înlocuire",
  "Sesizări",
  "Opriri neplanificate",
  "Ore de program",
  "Ore de oprire",
  "Disponibilitate (%)",
  "MTBF (ore)",
  "Costul opririlor (lei)",
] as const;

const NUMAR = new Intl.NumberFormat("ro-RO", {
  maximumFractionDigits: 2,
  useGrouping: false,
});

function numar(valoare: number | null): string {
  return valoare === null ? "" : NUMAR.format(valoare);
}

function procent(rata: number | null): string {
  return rata === null ? "" : NUMAR.format(Math.round(rata * 1000) / 10);
}

/** Excel interpretează „=", „+", „-", „@" ca formule: le prefixăm cu apostrof. */
export function celulaCsv(valoare: string): string {
  const curat = valoare.replace(/\r?\n/g, " ");
  const protejat = /^[=+\-@\t]/.test(curat) ? `'${curat}` : curat;
  return `"${protejat.replace(/"/g, '""')}"`;
}

export function liniiCsvRaport(
  raport: RaportMentenanta,
  echipamente: ReadonlyMap<string, EchipamentRaport>,
): readonly (readonly string[])[] {
  return raport.echipamente.map((r) => {
    const e = echipamente.get(r.equipmentId);
    return [
      e?.cod ?? "",
      e?.denumire ?? "Echipament indisponibil",
      String(r.numarInterventii),
      numar(r.costuri.preventiv),
      numar(r.costuri.corectiv),
      numar(r.costuri.legal),
      numar(r.costuri.intern),
      numar(r.costuri.extern),
      numar(r.costuri.garantie),
      numar(r.costuri.suportat),
      numar(r.cost12Luni),
      numar(e?.valoare_achizitie ?? null),
      procent(r.raportCostValoare),
      r.semnalInlocuire ? "da" : "nu",
      String(r.sesizari),
      String(r.opririNeplanificate),
      numar(r.oreProgram),
      numar(r.oreOprire),
      procent(r.disponibilitate),
      numar(r.mtbfOre === null ? null : Math.round(r.mtbfOre * 10) / 10),
      numar(r.costOpriri),
    ];
  });
}

/** Conținutul fișierului: antet + linii, `\r\n`, cu BOM ca Excel să citească UTF-8. */
export function continutCsvRaport(
  raport: RaportMentenanta,
  echipamente: ReadonlyMap<string, EchipamentRaport>,
): string {
  const linii = [ANTET_CSV_RAPORT, ...liniiCsvRaport(raport, echipamente)];
  return `﻿${linii.map((l) => l.map(celulaCsv).join(";")).join("\r\n")}`;
}
