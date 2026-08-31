// src/schemas/asistent.ts
import { z } from "zod";

/**
 * Plafoanele nu sunt în schemă din exces de precauție, ci pentru că fiecare
 * dintre ele are un preț măsurabil.
 *
 * Istoricul se trimite ÎNTREG la fiecare întrebare — așa funcționează un model
 * fără stare — deci o conversație lăsată să crească nemărginit ar plăti la a
 * cincizecea întrebare de cincizeci de ori mai mult decât la prima. Douăsprezece
 * mesaje înseamnă șase schimburi, adică mai mult decât ține un fir de „unde e
 * X?”.
 *
 * Validarea stă în schemă, nu în rută, ca plafonul să fie un fapt al tipului:
 * o rută viitoare care uită să verifice lungimea nu poate exista.
 */
export const MAX_MESAJE = 12;
export const MAX_CARACTERE_MESAJ = 2000;

export const ROLURI_MESAJ = ["om", "asistent"] as const;
export type RolMesaj = (typeof ROLURI_MESAJ)[number];

export const mesajAsistentSchema = z.object({
  rol: z.enum(ROLURI_MESAJ),
  text: z
    .string()
    .trim()
    .min(1, "Mesajul este gol.")
    .max(MAX_CARACTERE_MESAJ, `Mesajul depășește ${MAX_CARACTERE_MESAJ} de caractere.`),
});

export const cerereAsistentSchema = z.object({
  /**
   * Zona o declară clientul, dar NU e crezută pe cuvânt: ruta o verifică față de
   * rolul din tenant. Un `employee` care ar trimite `zona: "app"` ar primi
   * oricum lista de destinații filtrată pe permisiunile lui, adică aproape
   * goală; verificarea explicită există ca să nu depindem de acel „aproape”.
   */
  zona: z.enum(["app", "portal"]),
  mesaje: z
    .array(mesajAsistentSchema)
    .min(1, "Nu ai trimis niciun mesaj.")
    .max(MAX_MESAJE, "Conversația e prea lungă. Începe una nouă."),
});

export type CerereAsistent = z.infer<typeof cerereAsistentSchema>;
export type MesajAsistent = z.infer<typeof mesajAsistentSchema>;
