// src/schemas/document-template.ts
// Schemele pentru editarea șabloanelor de documente HR.
//
// Validarea de CONȚINUT (etichete permise, variabile existente) nu stă aici:
// curățarea rescrie HTML-ul, deci trebuie să ruleze pe server, înainte de
// scriere, iar rezultatul ei e cel care se verifică. Zod păzește doar forma.
import { z } from "zod";

import { CODURI_INROLARE } from "@/lib/documents/variabile";

/**
 * Codul șablonului.
 *
 * Doar cele cinci coduri ale înrolării. Tabela mai conține trei adeverințe, dar
 * `genereazaAdeverinta` n-are niciun apelant în `src/app/`, iar variabilele lor
 * nu sunt acoperite de `VARIABILE_PER_COD` — un editor peste ele ar accepta
 * variabile pe care nimic nu le poate verifica, adică exact capcana pe care
 * validarea o închide pentru celelalte.
 */
export const codSablonDocument = z.enum(CODURI_INROLARE);

export const salveazaSablonDocumentSchema = z.object({
  cod: codSablonDocument,
  denumire: z
    .string()
    .trim()
    .min(3, "Scrie denumirea documentului.")
    .max(120, "Denumirea e prea lungă."),
  /**
   * Plafon generos, dar prezent: `continut_html` e `text`, deci baza n-ar
   * refuza nimic, iar HTML-ul lipit dintr-un editor de birou poate aduce sute
   * de kiloocteți de marcaj care oricum se aruncă la curățare.
   */
  continut_html: z
    .string()
    .min(1, "Documentul nu poate fi gol.")
    .max(200_000, "Documentul e prea lung."),
});

export const restabilesteSablonDocumentSchema = z.object({ cod: codSablonDocument });

export type SalveazaSablonDocument = z.infer<typeof salveazaSablonDocumentSchema>;
