// src/schemas/comun.ts
// Ajutoarele de validare folosite de toate schemele. Un singur exemplar,
// deliberat: aici a stat cel mai scump defect al proiectului.
//
// ── CE S-A ÎNTÂMPLAT ────────────────────────────────────────────────────────
// `optional()` a trăit copiat în ȘAPTE fișiere de scheme, octet cu octet
// identic. Uniunea lui accepta `""` și `undefined`, dar NU `null`:
//
//     z.union([schema, z.literal(""), z.undefined()])
//
// Formularele proiectului trimit însă `null` — e valoarea firească pentru „acest
// câmp nu se aplică”, iar `exactOptionalPropertyTypes` face ca omiterea cheii să
// fie mai greu de scris decât trimiterea ei ca `null`. Rezultatul, măsurat:
//
//   · modulul de cursuri era MORT la scriere pe toate drumurile lui — material,
//     versiune de fișier, atribuire, regulă. Zero rânduri, întotdeauna.
//   · `bifeazaPas` din modulul de integrare respingea orice pas fără document
//     atașat, fiindcă `dovada_document_id` e `string | null` în bază și pleca
//     spre `optional(z.uuid())` ca `null`.
//
// Și era TĂCUT. `z.coerce.number()` pe `null` dă `Number(null) === 0`, deci
// mesajul care ieșea era plafonul câmpului („Termenul are cel puțin o zi.”), pe
// un câmp adesea nerandat — iar `Formular` nu are unde să-l pună.
//
// ── DE CE UN SINGUR FIȘIER ─────────────────────────────────────────────────
// Capcana fusese deja descoperită o dată, documentată la locul faptei și
// ocolită prin disciplină (`onboarding/sabloane/nou/formular-sablon.tsx` trimite
// `""` cu un comentariu care explică de ce). Modulul următor a copiat ajutorul
// fără să copieze disciplina. Un al treilea l-ar copia pe cel reparat de aici,
// sau pe cel stricat de dincolo — la noroc.
//
// `comun.test.ts` refuză declararea unui `const optional` local oriunde în
// `src/schemas/`. Fără poarta aia, nimic din ce scrie mai sus nu ține.

import { z } from "zod";

/**
 * Un câmp opțional venit dintr-un formular sau dintr-un query string.
 *
 * Cele TREI forme ale absenței, toate acceptate și toate normalizate la `null`:
 *   · `undefined` — cheia lipsește din obiect (câmp absent din `FormData`)
 *   · `""`        — controlul există dar e golit (`FormData.get()` pe un input
 *                   randat întoarce ȘIRUL GOL, niciodată `null`)
 *   · `null`      — apelantul spune explicit „nu se aplică”
 *
 * `.default(null as never)` se aplică doar peste `undefined`; celelalte două
 * trec prin uniune și apoi prin `transform`. Ordinea din uniune contează:
 * `schema` prima, ca o valoare validă să nu fie înghițită de o ramură laxă.
 */
export const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === undefined || v === null ? null : v))
    .default(null as never);

/**
 * Text opțional venit dintr-un formular (nu din URL): șirul gol devine `null`.
 *
 * `.nullable()` acceptă deja `null`, deci ajutorul ăsta n-a fost niciodată
 * stricat. Trăiește aici ca să nu se mai copieze, nu ca să se repare.
 */
export const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v));
