// src/lib/asistent/unelte/index.ts
/**
 * Registrul uneltelor și dispecerul lor.
 *
 * Adăugarea unei unelte noi înseamnă un fișier și un rând în `TOATE_UNELTELE`.
 * Restul — descrierea trimisă modelului, poarta de permisiune, traducerea în
 * schema OpenRouter, tratarea eșecului — vine din tipul comun.
 */
import "server-only";

import { z } from "zod";

import { unealtaCautaOm } from "./cauta-om";
import { unealtaDeAprobat } from "./de-aprobat";
import { unealtaSoldConcediu } from "./sold-concediu";
import { verificaAcces } from "./poarta";
import type { ContextUnealta, RezultatUnealta, Unealta } from "./tip";

export { uneltelePermise, verificaAcces } from "./poarta";
export type { ContextUnealta, RezultatUnealta, Unealta } from "./tip";

export const TOATE_UNELTELE: readonly Unealta[] = [
  unealtaSoldConcediu,
  unealtaDeAprobat,
  unealtaCautaOm,
];

/** Forma pe care o cere OpenRouter în câmpul `tools`. */
export type DeclaratieUnealta = Readonly<{
  type: "function";
  function: Readonly<{ name: string; description: string; parameters: unknown }>;
}>;

export function declaraPentruModel(unelte: readonly Unealta[]): readonly DeclaratieUnealta[] {
  return unelte.map((unealta) => ({
    type: "function",
    function: {
      name: unealta.nume,
      description: unealta.descriere,
      // `target: "draft-2020-12"` e ce înțelege Gemini prin OpenRouter; fără el,
      // Zod emite `$schema` și referințe pe care validatorul din amonte le taie.
      parameters: z.toJSONSchema(unealta.parametri, { target: "draft-2020-12" }),
    },
  }));
}

/**
 * Cheamă o unealtă și întoarce ÎNTOTDEAUNA un rezultat, niciodată o excepție.
 *
 * Motivul e că rezultatul se întoarce modelului ca text, iar bucla trebuie să
 * continue. O interogare picată nu are voie să lase conversația fără răspuns:
 * modelul primește „nu am putut citi", spune asta omului și viața merge mai
 * departe. Excepția e totuși scrisă în jurnal, ca defectul să nu treacă tăcut.
 */
export async function executaUnealta(
  nume: string,
  context: ContextUnealta,
  argument: unknown,
): Promise<RezultatUnealta> {
  const unealta = TOATE_UNELTELE.find((u) => u.nume === nume);
  if (unealta === undefined) {
    return { text: `Unealta „${nume}” nu există.` };
  }

  const acces = verificaAcces(unealta, context);
  if (!acces.permis) {
    // Refuzul se întoarce ca text, ca modelul să-l poată explica omenește, nu ca
    // eroare care rupe fluxul. Ce NU se face aici: nu se spune ce ar fi conținut
    // răspunsul dacă ar fi avut dreptul.
    return { text: acces.motiv };
  }

  try {
    return await unealta.executa(context, argument);
  } catch (eroare) {
    console.error(`[asistent] unealta ${nume} a eșuat`, eroare);
    return { text: "Nu am putut citi datele acestea acum." };
  }
}
