// src/app/(app)/revisal/constante.ts
// Constante și scheme — separate de `actions.ts`, pentru că un modul "use server"
// poate exporta doar funcții async.
import { z } from "zod";

import type { StatusRevisal, TipEvenimentRevisal } from "@/domain/revisal/evenimente";
import type { FiltruStare } from "@/lib/queries/revisal";

export const ETICHETE_TIP: Record<TipEvenimentRevisal, string> = {
  angajare: "Angajare",
  modificare_salariu: "Modificare salariu",
  modificare_functie: "Modificare funcție",
  modificare_norma: "Modificare normă",
  modificare_durata: "Modificare durată",
  suspendare: "Suspendare",
  reluare_activitate: "Reluare activitate",
  detasare: "Detașare",
  incetare: "Încetare",
  corectie: "Corecție",
};

export const ETICHETE_STATUS: Record<StatusRevisal, string> = {
  de_pregatit: "De pregătit",
  pregatit: "Pregătit",
  transmis: "Transmis",
  confirmat: "Confirmat de ITM",
  respins: "Respins",
  anulat: "Anulat",
};

export const OPTIUNI_STARE: readonly {
  readonly valoare: FiltruStare;
  readonly eticheta: string;
}[] = [
  { valoare: "toate", eticheta: "Toate" },
  { valoare: "intarziate", eticheta: "Întârziate" },
  { valoare: "de_transmis", eticheta: "De transmis" },
  { valoare: "transmise", eticheta: "Transmise" },
];

export const marcheazaTransmisSchema = z.object({
  evenimentId: z.uuid("Evenimentul selectat nu este valid."),
  transmisLa: z.iso.date("Introduceți data transmiterii în formatul AAAA-LL-ZZ."),
  numarInregistrare: z
    .string()
    .trim()
    .min(1, "Introduceți numărul de înregistrare primit de la Inspecția Muncii.")
    .max(60, "Numărul de înregistrare este prea lung."),
  observatii: z.string().trim().max(500, "Observațiile depășesc 500 de caractere.").optional(),
});
export type MarcheazaTransmisInput = z.infer<typeof marcheazaTransmisSchema>;

export const exportaSchema = z.object({
  doarNetransmise: z.boolean().default(true),
});
export type ExportaInput = z.infer<typeof exportaSchema>;
