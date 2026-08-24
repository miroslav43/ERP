// src/schemas/permisiuni-membru.ts
import { z } from "zod";

import { PERMISSION_KEYS, PERMISSION_SCOPES } from "@/config/permissions";

/**
 * Suprascrierea unei permisiuni pentru UN membru.
 *
 * `scope: null` înseamnă „retrage suprascrierea" — se revine la implicitul
 * rolului. Nu e același lucru cu `"none"`, care e refuz EXPLICIT: acela ia un
 * drept pe care rolul îl dă, și e util în sine.
 */
export const suprascriePermisiuneSchema = z.object({
  memberId: z.uuid("Membrul selectat nu este valid."),
  /**
   * Cheia se validează pe uniunea din cod, nu ca text liber: o resursă inventată
   * ar crea un rând pe care nicio politică nu-l citește — drept acordat pe
   * hârtie, refuz în realitate.
   */
  cheie: z.enum(PERMISSION_KEYS),
  scope: z.enum(PERMISSION_SCOPES).nullable(),
});
export type SuprascriePermisiune = z.output<typeof suprascriePermisiuneSchema>;
