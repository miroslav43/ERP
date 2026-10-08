import { formatLei } from "@/lib/format/money";

/** Norma întreagă față de care se proporționează salariul minim. */
const NORMA_INTREAGA_ORE_ZI = 8;

export type VerificareSalariuMinim = Readonly<{
  /** Salariul de bază lunar brut cerut pentru contract sau act adițional. */
  salariuBaza: number;
  /**
   * `payroll_settings.salariu_minim_brut` al firmei, valabil la data
   * contractului. `0` sau `null` = neconfigurat (⚠️ valoare de confirmat de
   * contabil, vezi 0055): atunci nu există prag, doar regula „mai mare decât zero".
   */
  salariuMinimBrut: number | null;
  /** Norma zilnică a contractului; sub 8 h pragul scade proporțional. */
  normaOreZi: number;
}>;

/**
 * Regula de bun-simț a contractului de muncă, pe care baza n-o impune: salariul
 * de bază e pozitiv și, când firma și-a configurat salariul minim, nu coboară
 * sub el (proporțional cu norma, pentru timp parțial).
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

  const norma =
    Number.isFinite(v.normaOreZi) && v.normaOreZi > 0 ? v.normaOreZi : NORMA_INTREAGA_ORE_ZI;
  const fractiune = Math.min(norma, NORMA_INTREAGA_ORE_ZI) / NORMA_INTREAGA_ORE_ZI;
  // Doi zecimali, ca orice sumă din salarizare; evită 2024,999… din împărțire.
  const prag = Math.round(minim * fractiune * 100) / 100;
  if (v.salariuBaza >= prag) return null;

  const normaText = fractiune < 1 ? ` pentru norma de ${String(norma)} ore pe zi` : "";
  return `Salariul de bază (${formatLei(v.salariuBaza)}) este sub salariul minim brut configurat în Setări → Salarizare (${formatLei(prag)}${normaText}).`;
}
