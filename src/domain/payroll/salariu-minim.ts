import { formatLei } from "@/lib/format/money";

/** Norma întreagă față de care se proporționează salariul minim (art. 112). */
const NORMA_INTREAGA_ORE_ZI = 8;
const NORMA_INTREAGA_ORE_SAPTAMANA = 40;

export type VerificareSalariuMinim = Readonly<{
  /** Salariul de bază lunar brut cerut pentru contract sau act adițional. */
  salariuBaza: number;
  /**
   * `payroll_settings.salariu_minim_brut` al firmei, valabil la data
   * contractului. `0` sau `null` = neconfigurat (⚠️ valoare de confirmat de
   * contabil, vezi 0055): atunci nu există prag, doar regula „mai mare decât zero".
   */
  salariuMinimBrut: number | null;
  /** Norma zilnică a contractului; folosită doar când lipsește cea săptămânală. */
  normaOreZi: number;
  /** Norma săptămânală a contractului; sub 40 h pragul scade proporțional. */
  normaOreSaptamana: number;
}>;

function pozitiv(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/** „16 ore”, „24 de ore”, „3,2 ore” — acordul numeralului, cu virgulă zecimală. */
function oreInText(n: number): string {
  const text = String(n).replace(".", ",");
  const restSuta = n % 100;
  const cuDe = Number.isInteger(n) && (restSuta === 0 || restSuta >= 20);
  return cuDe ? `${text} de ore` : `${text} ore`;
}

/**
 * Regula de bun-simț a contractului de muncă, pe care baza n-o impune: salariul
 * de bază e pozitiv și, când firma și-a configurat salariul minim, nu coboară
 * sub el (proporțional cu norma, pentru timp parțial).
 *
 * Proporția se ia din norma SĂPTĂMÂNALĂ (ore pe săptămână / 40), nu din cea
 * zilnică. Din 12 oct 2026 schema admite timpul parțial lucrat în zile întregi,
 * dar în mai puțin de cinci zile (8 h/zi, 24 h/săpt.); calculat din norma
 * zilnică (8/8), pragul cerea salariul minim întreg și refuza pe `salariu_baza`
 * contractul pe care schema tocmai îl acceptase. Pentru contractele de cinci
 * zile cele două proporții coincid (4 h/zi ↔ 20 h/săpt.). Norma zilnică rămâne
 * doar rezerva pentru o normă săptămânală lipsă sau invalidă.
 *
 * Întoarce mesajul de refuz, pentru câmpul `salariu_baza`, sau `null`.
 *
 * Pură, fără I/O: cine o cheamă citește setările și decide ce face cu mesajul.
 * Găsit de QA pe 8 oct 2026 (HR-021, HR-030): 100 lei, 0 lei și 12 h/zi
 * treceau fără niciun avertisment.
 */
export function verificaSalariulMinim(v: VerificareSalariuMinim): string | null {
  if (!Number.isFinite(v.salariuBaza) || v.salariuBaza <= 0) {
    return "Salariul de bază trebuie să fie mai mare decât zero.";
  }
  const minim = v.salariuMinimBrut ?? 0;
  if (minim <= 0) return null;

  let fractiune: number;
  let normaText: string;
  if (pozitiv(v.normaOreSaptamana)) {
    fractiune =
      Math.min(v.normaOreSaptamana, NORMA_INTREAGA_ORE_SAPTAMANA) / NORMA_INTREAGA_ORE_SAPTAMANA;
    normaText = ` pentru norma de ${oreInText(v.normaOreSaptamana)} pe săptămână`;
  } else {
    const zi = pozitiv(v.normaOreZi) ? v.normaOreZi : NORMA_INTREAGA_ORE_ZI;
    fractiune = Math.min(zi, NORMA_INTREAGA_ORE_ZI) / NORMA_INTREAGA_ORE_ZI;
    normaText = ` pentru norma de ${oreInText(zi)} pe zi`;
  }
  // Doi zecimali, ca orice sumă din salarizare; evită 2024,999… din împărțire.
  const prag = Math.round(minim * fractiune * 100) / 100;
  if (v.salariuBaza >= prag) return null;

  return `Salariul de bază (${formatLei(v.salariuBaza)}) este sub salariul minim brut configurat în Setări → Salarizare (${formatLei(prag)}${fractiune < 1 ? normaText : ""}).`;
}
