// src/domain/organization/caen-reguli.ts
// Reguli de compoziție a codurilor CAEN pe formă juridică — Legea 31/1990,
// OUG 44/2008, Legea 182/2016. Funcții pure, independente de Zod/React/DB;
// apelate din superRefine-urile din `src/schemas/organization.ts` și din
// `src/app/(app)/setari/organizatie/actions.ts` (schemă locală separată).

/** `null` = nelimitat numeric. */
export function maximSecundare(forma: string): number | null {
  switch (forma) {
    case "PFA":
      return 4;
    case "II":
      return 9;
    default:
      return null; // SRL, SRL-D, SA, SNC, SCS, RA, IF, ONG
  }
}

/**
 * Coduri complet interzise pentru SRL-D — listă dată explicit de utilizator,
 * NU dedusă din secțiuni întregi (excepție: imobiliare, unde lista dată
 * coincide cu toată secțiunea M din nomenclator — verificat, nu presupus).
 * "Intermedieri financiare" e o selecție de bază, NU toată secțiunea L.
 */
export const CODURI_INTERZISE_SRLD: ReadonlySet<string> = new Set([
  "9200", // jocuri de noroc și pariuri
  "2530", // fabricarea armamentului și muniției
  "1200",
  "4635",
  "4726", // tutun: producție, comerț ridicata, comerț amănuntul
  "1101",
  "1102",
  "1105",
  "4634",
  "4725", // alcool: distilare, vin, bere, comerț ridicata/amănuntul
  "6811",
  "6812",
  "6820",
  "6831",
  "6832", // tranzacții imobiliare (toată secțiunea M)
  "6419",
  "6492",
  "6511",
  "6512", // intermedieri financiare/asigurări — selecție de bază
]);

const NUMAR_MAXIM_GRUPE_SRLD = 5;

export type RezultatValidareCaen =
  | Readonly<{ valid: true }>
  | Readonly<{ valid: false; eroare: string }>;

/**
 * `principal` poate lipsi (ecranele de editare îl permit opțional) — atunci
 * nu e nimic de validat împreună cu `secundare`.
 */
export function valideazaSelectieCaen(
  forma: string,
  principal: string | undefined,
  secundare: readonly string[],
): RezultatValidareCaen {
  if (principal === undefined) return { valid: true };

  if (secundare.includes(principal)) {
    return { valid: false, eroare: "Codul principal nu poate apărea și printre cele secundare." };
  }
  if (new Set(secundare).size !== secundare.length) {
    return { valid: false, eroare: "Fiecare cod secundar poate apărea o singură dată." };
  }

  const maxim = maximSecundare(forma);
  if (maxim !== null && secundare.length > maxim) {
    return {
      valid: false,
      eroare: `${forma} permite maxim ${maxim} coduri CAEN secundare (${maxim + 1} în total, cu principalul).`,
    };
  }

  if (forma === "SRL-D") {
    const toate = [principal, ...secundare];
    const interzis = toate.find((cod) => CODURI_INTERZISE_SRLD.has(cod));
    if (interzis !== undefined) {
      return {
        valid: false,
        eroare: `Codul ${interzis} nu este permis pentru SRL-D (activitate exclusă prin lege pentru forma debutant).`,
      };
    }
    const grupe = new Set(toate.map((cod) => cod.slice(0, 3)));
    if (grupe.size > NUMAR_MAXIM_GRUPE_SRLD) {
      return {
        valid: false,
        eroare: `SRL-D: toate codurile CAEN trebuie să facă parte din cel mult ${NUMAR_MAXIM_GRUPE_SRLD} grupe de activitate (cod pe 3 cifre). Ai selectat ${grupe.size}.`,
      };
    }
  }

  return { valid: true };
}
