import type { RezultatSalariu } from "@/lib/unelte/salariu";

/**
 * Rândurile desfășurătorului, ca date: pagina le desenează, testele verifică
 * că se închid. La angajat, brut − rândurile „minus” = net; la firmă, suma
 * rândurilor „plus” = costul total. Un rând nou care strică închiderea pică
 * în `randuri.test.ts`, nu pe ecranul cuiva.
 */

export type FelRand = "plus" | "minus" | "total" | "info";
export type RandDesfasurator = Readonly<{ eticheta: string; valoare: number; fel: FelRand }>;
export type Desfasurare = Readonly<{
  angajat: readonly RandDesfasurator[];
  angajator: readonly RandDesfasurator[];
}>;

const rand = (eticheta: string, valoare: number, fel: FelRand): RandDesfasurator => ({
  eticheta,
  valoare,
  fel,
});

function etichetaDeducere(r: RezultatSalariu): string {
  const calculata = r.deducereDeBaza + r.deducereSub26 + r.deducereCopii;
  if (r.deducerePersonala < calculata) return "Deducere personală, în limita venitului";
  return r.deducereSub26 > 0 || r.deducereCopii > 0
    ? "Deducere personală, total"
    : "Deducere personală";
}

export function randuriDesfasurator(r: RezultatSalariu): Desfasurare {
  return {
    angajat: [
      rand("Salariu brut", r.brut, "plus"),
      ...(r.sumaNeimpozabila > 0
        ? [rand("Din care neimpozabil (OUG 89/2025)", r.sumaNeimpozabila, "info")]
        : []),
      rand("CAS — pensie, 25%", r.cas, "minus"),
      rand("CASS — sănătate, 10%", r.cass, "minus"),
      ...(r.deducereSub26 > 0 || r.deducereCopii > 0
        ? [
            rand("Deducere de bază", r.deducereDeBaza, "info"),
            ...(r.deducereSub26 > 0
              ? [rand("Deducere sub 26 de ani", r.deducereSub26, "info")]
              : []),
            ...(r.deducereCopii > 0
              ? [rand("Deducere pentru copiii înscriși la școală", r.deducereCopii, "info")]
              : []),
          ]
        : []),
      rand(etichetaDeducere(r), r.deducerePersonala, "info"),
      rand("Impozit pe venit, 10%", r.impozit, "minus"),
      rand("Salariu net", r.net, "total"),
    ],
    angajator: [
      rand("Salariu brut", r.brut, "plus"),
      rand("CAM — contribuția asiguratorie pentru muncă, 2,25%", r.cam, "plus"),
      rand("Cost total pentru firmă", r.costTotal, "total"),
    ],
  };
}
