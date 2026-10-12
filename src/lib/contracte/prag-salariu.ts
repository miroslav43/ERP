import "server-only";

import { verificaSalariulMinim } from "@/domain/payroll/salariu-minim";
import { invalidInput } from "@/lib/actions/errors";
import { salariulMinimLaData } from "@/lib/queries/payroll";

/**
 * Poarta comună a celor trei scrieri de salariu (contract nou, act adițional,
 * înrolare): citește salariul minim al firmei valabil la data aplicării și
 * refuză PE CÂMP o sumă sub el sau nepozitivă. Nu stă într-un fișier
 * `"use server"`: exportată de acolo, ar fi devenit o Server Action apelabilă
 * direct din browser.
 *
 * Găsit de QA pe 8 oct 2026 (HR-021, HR-030): 100 lei, 0 lei și 12 h/zi
 * treceau fără niciun avertisment.
 */
export async function refuzaSubSalariulMinim(
  organizationId: string,
  valabilDeLa: string,
  salariuBaza: number,
  normaOreZi: number,
): Promise<void> {
  const minim = await salariulMinimLaData(organizationId, valabilDeLa);
  const mesaj = verificaSalariulMinim({ salariuBaza, salariuMinimBrut: minim, normaOreZi });
  if (mesaj !== null) throw invalidInput(mesaj, { salariu_baza: [mesaj] });
}
