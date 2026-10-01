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

/**
 * Antetul documentelor: unde stă blocul de identificare a firmei și dacă sigla
 * îl însoțește.
 *
 * Poziția e o alegere liberă — Legea 31/1990 art. 74 cere ca datele să fie ÎN
 * document, nu în capul lui (vezi `src/lib/documents/bloc-firma.ts`).
 */
export const salveazaAntetDocumenteSchema = z.object({
  pozitie: z.enum(["antet", "subsol"]),
  arata_logo: z.boolean(),
});

export type SalveazaAntetDocumente = z.infer<typeof salveazaAntetDocumenteSchema>;

/**
 * Sigla: PNG sau JPEG, cel mult 512 KB.
 *
 * Nu e o preferință estetică. `pdf-lib` încorporează DOAR PNG și JPEG
 * (`embedPng`/`embedJpg`) — un SVG sau un WebP ar trece de bucket, care le
 * acceptă din 0002, și ar dispărea tăcut din PDF. Plafonul e cu mult sub cel de
 * 2 MB al bucket-ului fiindcă sigla se încorporează în FIECARE document emis,
 * iar varianta HTML o duce în plus ca `data:` URI, cu +33% din base64.
 */
export const SIGLA_MIME_ACCEPTAT = ["image/png", "image/jpeg"] as const;
export const SIGLA_OCTETI_MAXIM = 512 * 1024;

export const pregatesteSiglaSchema = z.object({
  numeFisier: z.string().trim().min(1).max(255),
  dimensiune: z.number().int().positive().max(SIGLA_OCTETI_MAXIM, "Sigla nu poate depăși 512 KB."),
  mime: z.enum(SIGLA_MIME_ACCEPTAT, "Sigla trebuie să fie PNG sau JPEG."),
});

export const salveazaSiglaSchema = z.object({ cale: z.string().trim().min(1).max(400) });

/** Ștergerea siglei n-are nimic de validat, dar `createAction` cere o schemă. */
export const stergeSiglaSchema = z.object({});
