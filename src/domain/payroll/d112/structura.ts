// src/domain/payroll/d112/structura.ts
//
// Declarația 112 — obligațiile de plată a contribuțiilor sociale, impozitul pe
// venit și evidența nominală a persoanelor asigurate. Se depune electronic la
// ANAF până pe 25 a lunii următoare.
//
// ─────────────────────────────────────────────────────────────────────────────
// CE E VERIFICAT ȘI CE E PRESUPUS
//
// Structura de mai jos NU e inventată: numele elementelor și ale atributelor
// vin din specificația publicată de ANAF,
// `structura_D112_0719_121219.pdf` (versiunea D112_A7.2.2), capitolul
// „Structura fisier XML". De acolo sunt, verbatim:
//
//   · rădăcina `<declaratieUnica>` cu `luna_r` (N2), `an_r` (N4), `d_rec` (N1:
//     0 = inițială, 1 = rectificativă), `tip_rec`, `nume_declar`,
//     `prenume_declar`, `functie_declar`;
//   · `<angajator>` cu `cif` (N13), `rgCom` (C14, format xxx/xxxxx/xxxx),
//     `caen` (N4), `den` (C200), `adrSoc` (C1000), `casaAng` (C2, nomenclatorul
//     caselor de sănătate), `datCAM` (N1: 0/1);
//   · `<angajatorA>`, 1–41 apariții, cu `A_codOblig` (N3), `A_codBugetar` (C10)
//     și `A_datorat` (N15);
//   · `<asigurat>`, 0–n apariții, cu `cnpAsig` (N13), `idAsig` (N6, contor),
//     `numeAsig` (C75), `prenAsig` (C75), `dataAng` (D10), `dataSf` (D10);
//   · `<asiguratA>` cu `A_1` (tip asigurat), `A_2` (pensionar), `A_3` (tip
//     contract după timpul de lucru: N, P1…P7), `A_4` (ore normă zilnică —
//     validarea ANAF acceptă EXACT 6, 7 sau 8), `A_5` (baza CAM), `A_6` (ore
//     lucrate efectiv în lună), `A_7` (ore suspendate).
//
// CE RĂMÂNE DE CONFIRMAT, și de aceea e configurabil, nu hardcodat:
//
//   ⚠️ CODURILE DE OBLIGAȚIE ȘI CELE BUGETARE. Nomenclatorul 3 („Obligații de
//      plată la BS și BASFS") are câteva zeci de intrări și se schimbă prin
//      ordin, iar specificația îl publică separat. Codurile de mai jos sunt
//      valorile uzuale, dar NU le-am putut verifica în nomenclatorul oficial —
//      contabilul le confirmă o dată, la prima depunere, și rămân în setări.
//   ⚠️ `casaAng` — casa de asigurări de sănătate a angajatorului, care trebuie
//      să coincidă cu județul sediului social. Vine din setări, nu se deduce.
//
// Fișierul rezultat se validează cu DUKIntegrator, aplicația ANAF, ÎNAINTE de
// depunere. Nu pretindem că îl înlocuim: pretindem că scutim contabilul de
// tastarea a câteva sute de cifre.
//
// Aceeași onestitate ca la `src/domain/revisal/export.ts` și la comentariul din
// `bancar/sepa.ts:8` — nu inventăm formate pe care nu le putem verifica.

/** O creanță fiscală: un cod de obligație și suma datorată pe el. */
export interface CreantaD112 {
  /** `A_codOblig` — N3, din Nomenclatorul 3. */
  readonly codObligatie: string;
  /** `A_codBugetar` — C10, se completează automat la selecția codului. */
  readonly codBugetar: string;
  /** `A_datorat` — N15. Întreg, în lei: D112 nu acceptă zecimale la sume. */
  readonly suma: number;
}

/** Un asigurat, cu secțiunea A (contract individual de muncă). */
export interface AsiguratD112 {
  readonly cnp: string;
  readonly nume: string;
  readonly prenume: string;
  /** `dataAng` — data intrării în categoria de asigurat, format AAAA-LL-ZZ. */
  readonly dataAngajarii: string;
  /** `dataSf` — data ieșirii, dacă a ieșit în luna raportată. */
  readonly dataIncetarii: string | null;
  /** `A_1` — tip asigurat din perspectiva contractului. 1 = salariat cu CIM. */
  readonly tipAsigurat: number;
  /** `A_2` — 1 dacă e pensionar, altfel 0. */
  readonly pensionar: boolean;
  /** `A_3` — `"N"` normă întreagă, `"P1"`…`"P7"` parțial cu i ore < `A_4`. */
  readonly tipContract: string;
  /** `A_4` — ore normă zilnică. ANAF acceptă EXACT 6, 7 sau 8. */
  readonly oreNormaZilnica: number;
  /** `A_5` — baza de calcul CAM, în lei întregi. */
  readonly bazaCam: number;
  /** `A_6` — ore lucrate efectiv în lună. */
  readonly oreLucrate: number;
  /** `A_7` — ore suspendate în lună (concediu fără plată, CIC, suspendare). */
  readonly oreSuspendate: number;
}

export interface AngajatorD112 {
  /** `cif` — fără prefixul `RO`, doar cifrele. */
  readonly cif: string;
  readonly denumire: string;
  /** `rgCom` — format `xxx/xxxxx/xxxx`; `null` dacă firma nu are. */
  readonly registruComert: string | null;
  /** `caen` — patru cifre. */
  readonly caen: string | null;
  readonly adresaSediu: string | null;
  /** `casaAng` — codul casei de sănătate, două caractere. ⚠️ din setări. */
  readonly casaSanatate: string | null;
  /** `datCAM` — 1 dacă firma datorează contribuția asiguratorie pentru muncă. */
  readonly datoreazaCam: boolean;
}

export interface IntrareD112 {
  readonly luna: number;
  readonly an: number;
  /** `d_rec` — false = declarație inițială, true = rectificativă. */
  readonly rectificativa: boolean;
  readonly declarantNume: string;
  readonly declarantPrenume: string;
  readonly declarantFunctie: string;
  readonly angajator: AngajatorD112;
  readonly creante: readonly CreantaD112[];
  readonly asigurati: readonly AsiguratD112[];
}

export interface ProblemaD112 {
  readonly camp: string;
  readonly mesaj: string;
  /** `true` = ANAF ar respinge fișierul (ERR); `false` = atenționare (ATT). */
  readonly blocant: boolean;
}

export interface RezultatD112 {
  readonly xml: string;
  readonly probleme: readonly ProblemaD112[];
  readonly nrAsigurati: number;
  readonly totalDatorat: number;
}
