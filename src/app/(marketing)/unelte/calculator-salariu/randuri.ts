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
      ...(r.tichete > 0
        ? [rand("Din tichete de masă, în baza CASS și a impozitului", r.tichete, "info")]
        : []),
      rand(
        r.tichete > 0 ? "CASS — sănătate, 10%, cu tichetele" : "CASS — sănătate, 10%",
        r.cass,
        "minus",
      ),
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
      rand(
        r.impozitScutit
          ? "Impozit pe venit — scutit, Codul fiscal art. 60 pct. 1"
          : "Impozit pe venit, 10%",
        r.impozit,
        "minus",
      ),
      rand("Salariu net", r.net, "total"),
      ...(r.tichete > 0
        ? [
            rand("Tichete de masă, pe card", r.tichete, "plus"),
            rand("Net și tichete, împreună", r.net + r.tichete, "total"),
          ]
        : []),
    ],
    angajator: [
      rand("Salariu brut", r.brut, "plus"),
      rand("CAM — contribuția asiguratorie pentru muncă, 2,25%", r.cam, "plus"),
      ...(r.casSuportatAngajator > 0
        ? [rand("CAS până la baza minimă, plătit de firmă", r.casSuportatAngajator, "plus")]
        : []),
      ...(r.cassSuportatAngajator > 0
        ? [rand("CASS până la baza minimă, plătit de firmă", r.cassSuportatAngajator, "plus")]
        : []),
      ...(r.tichete > 0 ? [rand("Tichete de masă", r.tichete, "plus")] : []),
      rand("Cost total pentru firmă", r.costTotal, "total"),
    ],
  };
}

export type ImpartireCost = Readonly<{ net: number; tichete: number; stat: number }>;

/**
 * Din fiecare 100 de lei pe care îi plătește firma: cât ajunge la angajat în cont,
 * cât pe cardul de tichete și cât la stat (CAS, CASS, impozit, CAM și diferențele
 * de la timpul parțial). Procente întregi; partea statului e restul până la 100,
 * ca cele trei să facă mereu exact 100.
 */
export function impartireaCostului(r: RezultatSalariu): ImpartireCost {
  if (r.costTotal <= 0) return { net: 0, tichete: 0, stat: 0 };
  const net = Math.round((r.net / r.costTotal) * 100);
  const tichete = Math.round((r.tichete / r.costTotal) * 100);
  return { net, tichete, stat: 100 - net - tichete };
}
