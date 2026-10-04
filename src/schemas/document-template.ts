// src/schemas/document-template.ts
// Schemele pentru editarea șabloanelor de documente HR.
//
// Validarea de CONȚINUT (etichete permise, variabile existente) nu stă aici:
// curățarea rescrie HTML-ul, deci trebuie să ruleze pe server, înainte de
// scriere, iar rezultatul ei e cel care se verifică. Zod păzește doar forma.
import { z } from "zod";

import { SERII_REZERVATE, esteCodPersonalizat, esteCodPlatforma } from "@/lib/documents/variabile";

/**
 * Codul șablonului: unul dintre cele cinci ale înrolării, sau un document creat
 * de firmă (`doc_…`).
 *
 * Tabela mai conține trei adeverințe, dar `genereazaAdeverinta` n-are niciun
 * apelant în `src/app/`, iar variabilele lor nu sunt acoperite de
 * `VARIABILE_PER_COD` — un editor peste ele ar accepta variabile pe care nimic
 * nu le poate verifica, adică exact capcana pe care validarea o închide pentru
 * celelalte.
 */
export const codSablonDocument = z
  .string()
  .refine((cod) => esteCodPlatforma(cod) || esteCodPersonalizat(cod), {
    message: "Tipul de document nu este cunoscut.",
  });

const denumireSablon = z
  .string()
  .trim()
  .min(3, "Scrie denumirea documentului.")
  .max(120, "Denumirea e prea lungă.");

/**
 * Plafon generos, dar prezent: `continut_html` e `text`, deci baza n-ar refuza
 * nimic, iar HTML-ul lipit dintr-un editor de birou poate aduce sute de
 * kiloocteți de marcaj care oricum se aruncă la curățare.
 */
const continutSablon = z
  .string()
  .min(1, "Documentul nu poate fi gol.")
  .max(200_000, "Documentul e prea lung.");

export const salveazaSablonDocumentSchema = z.object({
  cod: codSablonDocument,
  denumire: denumireSablon,
  continut_html: continutSablon,
});

export const restabilesteSablonDocumentSchema = z.object({ cod: codSablonDocument });

/**
 * Seria de numerotare a unui document al firmei: „CER 2026/000001”.
 *
 * Doar majuscule, ca seriile livrate (CIM, FP, NDA). Seriile acelora sunt
 * refuzate: numerotarea e pe `(organization_id, serie)`, deci o cerere pe seria
 * CIM ar lua numere din registrul contractelor de muncă.
 */
export const serieSablon = z
  .string()
  .trim()
  .transform((serie) => serie.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{2,8}$/, "Seria are între 2 și 8 litere, fără cifre sau spații.")
      .refine((serie) => !(SERII_REZERVATE as readonly string[]).includes(serie), {
        message: `Seriile ${SERII_REZERVATE.join(", ")} sunt ale documentelor livrate cu aplicația. Alege alta.`,
      }),
  );

export const creeazaSablonPersonalizatSchema = z.object({
  denumire: denumireSablon,
  serie: serieSablon,
  continut_html: continutSablon,
});

/**
 * Emiterea din caseta „Emite documente”: orice combinație de documente ale
 * angajării și documente ale firmei, alese prin bife.
 */
export const emiteDocumenteSchema = z.object({
  employeeId: z.uuid(),
  coduri: z
    .array(codSablonDocument)
    .min(1, "Alege cel puțin un document.")
    .max(50, "Prea multe documente deodată.")
    .refine((coduri) => new Set(coduri).size === coduri.length, {
      message: "Un document apare de două ori.",
    }),
});

export type CreeazaSablonPersonalizat = z.infer<typeof creeazaSablonPersonalizatSchema>;

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
