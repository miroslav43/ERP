import { z } from "zod";

import { cuiSchema, emailSchema } from "@/schemas/organization";

/**
 * Formularul de înregistrare. Șase câmpuri, dintre care unul opțional.
 *
 * ── DE CE ATÂT DE PUȚIN ───────────────────────────────────────────────────
 * Asistentul de configurare din `(onboarding)` cere deja tot ce trebuie unei
 * firme — sediu, CAEN, reprezentant legal, conturi, puncte de lucru. Cerute
 * AICI, ar fi un zid între cineva care abia s-a hotărât și contul lui. Ce
 * rămâne e strictul necesar ca să existe o organizație și o invitație: cine e
 * firma, cine ești tu, unde primești linkul.
 *
 * ── DE CE TOTUȘI CUI-UL ───────────────────────────────────────────────────
 * E singura cheie care împiedică aceeași firmă să apară de două ori
 * (`unique (cui_normalizat)` în 0001). Fără el, al doilea coleg care se
 * înregistrează creează o firmă paralelă în loc să ceară o invitație, iar datele
 * se despart tăcut în două conturi.
 *
 * `cuiSchema` NU verifică doar forma: rulează cifra de control românească prin
 * `validateazaCui`. O greșeală de tastare cade aici, nu peste trei ecrane.
 */
export const schemaInregistrare = z.object({
  firma: z
    .string()
    .trim()
    .min(2, "Scrie denumirea firmei.")
    .max(200, "Denumirea firmei poate avea cel mult 200 de caractere."),
  cui: cuiSchema,
  prenume: z
    .string()
    .trim()
    .min(2, "Scrie-ți prenumele.")
    .max(120, "Prenumele poate avea cel mult 120 de caractere."),
  nume: z
    .string()
    .trim()
    .min(2, "Scrie-ți numele de familie.")
    .max(120, "Numele poate avea cel mult 120 de caractere."),
  email: emailSchema,
  telefon: z
    .string()
    .trim()
    .max(32, "Numărul de telefon poate avea cel mult 32 de caractere.")
    .refine(
      (valoare) => valoare.length === 0 || /^[0-9+()\s.-]{6,32}$/.test(valoare),
      "Numărul de telefon poate conține doar cifre, spații și semnele + ( ) - .",
    ),
  /*
   * Acceptul e un câmp, nu o notă de subsol.
   *
   * `z.literal(true)` respinge valoarea `false` cu mesaj propriu — o bifă
   * opțională care se validează „oricum" n-ar fi un accept, ar fi un decor.
   * `FormData` trimite bifele ca „on" sau deloc, deci conversia se face în
   * formular, înainte de parsare.
   */
  acceptTermeni: z.literal(true, {
    error: "Trebuie să accepți termenii ca să putem crea contul.",
  }),
});

export type InregistrareInput = z.input<typeof schemaInregistrare>;

export const CAMPURI_INREGISTRARE = [
  "firma",
  "cui",
  "prenume",
  "nume",
  "email",
  "telefon",
  "acceptTermeni",
] as const;
