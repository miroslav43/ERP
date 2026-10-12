// src/schemas/fleet-rapoarte.ts
import { z } from "zod";

import { lunaDinZi, lunaValida } from "@/domain/fleet/rapoarte";
import { todayInBucharest } from "@/lib/format/date";

/**
 * Filtrele rapoartelor flotei (F8), din adresă.
 *
 * Luna e OBLIGATORIE în sensul că nu lipsește niciodată: o adresă fără ea, cu o
 * lună inventată sau cu parametrul repetat cade pe luna curentă. Fără o lună, o
 * citire ar fi cerut tot istoricul, iar `max_rows = 1000` l-ar fi tăiat tăcut.
 * Ziua „de azi” se citește la FIECARE parsare, nu la încărcarea modulului: un
 * server pornit în septembrie nu are voie să arate septembrie în octombrie.
 *
 * Fiecare câmp are propriul `.catch`: un `vehicul` stricat nu aruncă luna
 * bună, iar `filtreDinUrl` ar fi dat altfel toate valorile implicite.
 */
export const filtreRaportSchema = z.object({
  luna: z
    .string()
    .refine(lunaValida)
    .catch(() => lunaDinZi(todayInBucharest())),
  vehicul: z.uuid().nullable().catch(null),
});
export type FiltreRaport = z.output<typeof filtreRaportSchema>;
