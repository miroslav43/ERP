// src/domain/payroll/d112/coduri.ts
//
// ⚠️ CODURILE DE OBLIGAȚIE ȘI CELE BUGETARE — DE CONFIRMAT DE CONTABIL.
//
// Nomenclatorul 3 din specificația D112 („Obligații de plată la BS și BASFS")
// are câteva zeci de intrări, se publică separat de structura XML și se schimbă
// prin ordin. Valorile de mai jos sunt cele uzuale pentru un angajator obișnuit,
// dar NU au putut fi verificate în nomenclatorul oficial.
//
// De aceea sunt aici, într-un singur loc, cu numele lor explicite, și nu
// împrăștiate prin generator: contabilul le confirmă o dată, la prima depunere,
// și se corectează într-un singur fișier dacă s-au schimbat.
//
// Aceeași disciplină ca la conturile din nota contabilă (migrarea 0061): o
// valoare legală despre care nu suntem siguri se declară ca atare, nu se
// strecoară în cod ca și cum ar fi verificată.

export interface CodObligatie {
  /** `A_codOblig` — N3. */
  readonly cod: string;
  /** `A_codBugetar` — C10, se completează automat la selecția codului. */
  readonly codBugetar: string;
  readonly denumire: string;
}

/**
 * Cele patru obligații pe care le poate calcula aplicația.
 *
 * Restul (fond de risc, comisioane ITM, contribuții pentru persoane cu
 * handicap) nu se derivă din statul de plată, deci nu se declară de aici.
 */
export const CODURI_OBLIGATIE = {
  impozitSalarii: {
    cod: "602",
    codBugetar: "20A010101",
    denumire: "Impozit pe veniturile din salarii",
  },
  casAngajat: {
    cod: "412",
    codBugetar: "20A020101",
    denumire: "Contribuția de asigurări sociale datorată de asigurat (CAS)",
  },
  cassAngajat: {
    cod: "432",
    codBugetar: "20A030101",
    denumire: "Contribuția de asigurări sociale de sănătate datorată de asigurat (CASS)",
  },
  camAngajator: {
    cod: "484",
    codBugetar: "20A470600",
    denumire: "Contribuția asiguratorie pentru muncă (CAM)",
  },
} as const satisfies Readonly<Record<string, CodObligatie>>;

export type CheieObligatie = keyof typeof CODURI_OBLIGATIE;

/**
 * Tipul de asigurat implicit: `1` = salariat cu contract individual de muncă.
 *
 * Nomenclatorul 5 are peste treizeci de valori (militari, pensionari, ucenici,
 * zilieri, persoane în concediu de creștere copil…). Aplicația declară doar
 * salariați obișnuiți; restul cazurilor cer o clasificare pe care n-o avem în
 * date și pe care n-o ghicim.
 */
export const TIP_ASIGURAT_SALARIAT = 1;

/**
 * `A_3` — tipul contractului din perspectiva timpului de lucru.
 *
 * `"N"` pentru normă întreagă. Pentru timp parțial, `"P" + numărul de ore`,
 * unde orele sunt mai puține decât norma zilnică a postului (`A_4`).
 * Specificația acceptă `P1`…`P7`.
 */
export function tipContractD112(oreEfectivePeZi: number, normaZilnica: number): string {
  const ore = Math.round(oreEfectivePeZi);
  if (ore >= normaZilnica) return "N";
  const limitat = Math.min(7, Math.max(1, ore));
  return `P${String(limitat)}`;
}

/**
 * `A_4` — norma zilnică, pe care ANAF o acceptă DOAR ca 6, 7 sau 8.
 *
 * O normă de 4 ore e legală ca timp de muncă, dar în D112 se declară prin
 * `A_3` (contract cu timp parțial), nu prin `A_4`. Rotunjim în sus la cea mai
 * apropiată valoare acceptată, ca generatorul să nu producă un fișier respins;
 * dacă valoarea reală era alta, validarea din `genereaza.ts` o semnalează.
 */
export function normaZilnicaD112(oreNormaZilnica: number): number {
  if (oreNormaZilnica >= 8) return 8;
  if (oreNormaZilnica > 6) return 7;
  return 6;
}
