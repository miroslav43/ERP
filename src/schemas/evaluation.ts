// src/schemas/evaluation.ts
import { z } from "zod";
import { jsonDinFormData, textOptional } from "./comun";

import { MAXIM_CRITERII, SCALE_PERMISE, TIPURI_CRITERIU } from "@/domain/evaluations/criterii";

export const STATUSURI_EVALUARE = ["draft", "finalizat"] as const;
export type StatusEvaluare = (typeof STATUSURI_EVALUARE)[number];

// ── Șabloane ──────────────────────────────────────────────────────────────────

/**
 * Un criteriu de șablon.
 *
 * `scala_max` NU e liber: constructorul oferă 3, 4, 5 sau 10, fiindcă o scală
 * arbitrară (17?) face imposibilă compararea a două evaluări din aceeași firmă
 * și nu încape ca grup de butoane pe un telefon. `da_nu` e forțat pe 1 și
 * `text` pe 0 prin transformare, nu prin validare, ca un client mai vechi care
 * trimite altceva să nu primească o eroare de câmp pe care n-o poate repara.
 */
export const criteriuSablonSchema = z
  .object({
    cod: z
      .string()
      .trim()
      .max(80)
      .nullable()
      .default(null)
      .transform((v) => (v === null || v.length === 0 ? null : v)),
    denumire: z
      .string()
      .trim()
      .min(2, "Denumirea criteriului trebuie să aibă cel puțin 2 caractere.")
      .max(160, "Denumirea criteriului nu poate depăși 160 de caractere."),
    descriere: textOptional(500),
    tip: z.enum(TIPURI_CRITERIU).default("scala"),
    scala_max: z.coerce
      .number()
      .int()
      .refine((v) => (SCALE_PERMISE as readonly number[]).includes(v), "Scala nu este permisă.")
      .default(5),
    pondere: z.coerce
      .number()
      .int("Ponderea se scrie în procente întregi.")
      .min(0, "Ponderea nu poate fi negativă.")
      .max(100, "Ponderea nu poate depăși 100.")
      .nullable()
      .default(null),
  })
  .transform((c) => ({
    ...c,
    scala_max: c.tip === "da_nu" ? 1 : c.tip === "text" ? 0 : c.scala_max,
    // Un criteriu de tip text nu se punctează, deci nu poate purta pondere.
    pondere: c.tip === "text" ? null : c.pondere,
  }));

export type CriteriuSablonIntrare = z.output<typeof criteriuSablonSchema>;

/**
 * Lista de criterii, cu cele două reguli care nu se pot exprima pe un câmp.
 *
 * Ponderile sunt „tot sau nimic": un șablon cu trei criterii din care doar unul
 * poartă 40 % n-are interpretare evidentă. Ori zero ponderi, ori toate,
 * însumând 100.
 */
export const criteriiSablonSchema = z
  .array(criteriuSablonSchema)
  .min(1, "Adăugați cel puțin un criteriu.")
  .max(MAXIM_CRITERII, `Un șablon nu poate avea mai mult de ${String(MAXIM_CRITERII)} de criterii.`)
  .superRefine((criterii, ctx) => {
    const vazute = new Set<string>();
    criterii.forEach((c, i) => {
      const cheie = c.denumire.toLocaleLowerCase("ro-RO");
      if (vazute.has(cheie)) {
        ctx.addIssue({
          code: "custom",
          path: [i, "denumire"],
          message: "Criteriul apare de două ori în șablon.",
        });
      }
      vazute.add(cheie);
      if (c.cod !== null && criterii.filter((alt) => alt.cod === c.cod).length > 1) {
        ctx.addIssue({
          code: "custom",
          path: [i, "cod"],
          message: "Două criterii nu pot avea același cod.",
        });
      }
    });

    const punctabile = criterii.filter((c) => c.tip !== "text");
    const cuPondere = punctabile.filter((c) => c.pondere !== null);
    if (cuPondere.length === 0) return;
    if (cuPondere.length !== punctabile.length) {
      ctx.addIssue({
        code: "custom",
        path: ["ponderi"],
        message:
          "Ponderile sunt „tot sau nimic”: completați-le pe toate sau ștergeți-le pe cele puse.",
      });
      return;
    }
    const total = cuPondere.reduce((s, c) => s + (c.pondere ?? 0), 0);
    if (total !== 100) {
      ctx.addIssue({
        code: "custom",
        path: ["ponderi"],
        message: `Ponderile trebuie să însumeze 100. Acum însumează ${String(total)}.`,
      });
    }
  });

const denumireSablon = z
  .string()
  .trim()
  .min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.")
  .max(160, "Denumirea nu poate depăși 160 de caractere.");

export const creeazaSablonEvaluareSchema = z.object({
  denumire: denumireSablon,
  descriere: textOptional(500),
  criterii: jsonDinFormData(criteriiSablonSchema),
});

export const actualizeazaSablonEvaluareSchema = z.object({
  id: z.uuid("Șablonul selectat nu este valid."),
  denumire: denumireSablon,
  descriere: textOptional(500),
  criterii: jsonDinFormData(criteriiSablonSchema),
});

export const duplicaSablonEvaluareSchema = z.object({
  id: z.uuid("Șablonul selectat nu este valid."),
  denumire: denumireSablon,
});

const doarId = (mesaj: string) => z.object({ id: z.uuid(mesaj) });

export const arhiveazaSablonEvaluareSchema = doarId("Șablonul selectat nu este valid.");
export const reactiveazaSablonEvaluareSchema = doarId("Șablonul selectat nu este valid.");

// ── Evaluări ──────────────────────────────────────────────────────────────────

/**
 * Un răspuns la un criteriu.
 *
 * `scor` e NULLABIL, și asta e o schimbare de fond față de `0038`: acolo
 * formularul trimitea `scor ?? 0` pentru toate criteriile, deci un criteriu
 * neatins pleca drept „0 din 5" — indistinct de o notă de zero, pe o scală
 * unde zero nici măcar nu e o notă validă.
 *
 * Plafonul rămâne 10 aici (maximul scalelor permise); potrivirea fină cu
 * `scala_max` al criteriului se face în acțiune, unde se cunoaște șablonul.
 */
export const raspunsCriteriuSchema = z.object({
  criteriu_cod: z.string().trim().min(1).max(80),
  scor: z.coerce
    .number()
    .int("Nota se dă în numere întregi.")
    .min(0, "Nota nu poate fi negativă.")
    .max(10, "Nota nu poate depăși 10.")
    .nullable()
    .default(null),
  raspuns_text: textOptional(1000),
  comentariu: textOptional(1000),
});

const dataIso = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Data trebuie scrisă în formatul AAAA-LL-ZZ.");

export const creeazaEvaluareSchema = z.object({
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  template_id: z.uuid("Alegeți un șablon de evaluare."),
  data_evaluarii: dataIso,
  raspunsuri: jsonDinFormData(
    z.array(raspunsCriteriuSchema).min(1, "Completați cel puțin un criteriu."),
  ),
  concluzie: textOptional(4000),
  status: z.enum(STATUSURI_EVALUARE).default("draft"),
});

export const actualizeazaEvaluareSchema = z.object({
  id: z.uuid("Evaluarea selectată nu este validă."),
  data_evaluarii: dataIso,
  raspunsuri: jsonDinFormData(
    z.array(raspunsCriteriuSchema).min(1, "Completați cel puțin un criteriu."),
  ),
  concluzie: textOptional(4000),
});

export const finalizeazaEvaluareSchema = doarId("Evaluarea selectată nu este validă.");
export const redeschideEvaluareSchema = doarId("Evaluarea selectată nu este validă.");

// ── Filtrele listei, citite din bara de adrese ────────────────────────────────

/**
 * Ce vine din URL nu e date, e intrare de la un străin: valorile străine cad
 * pe implicit, nu pe un ecran de eroare. Vezi `src/lib/rute/parametri.ts`.
 */
const optionalUrl = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .default(null as never);

export const filtreEvaluariSchema = z.object({
  status: optionalUrl(z.enum(STATUSURI_EVALUARE)),
  template_id: optionalUrl(z.uuid()),
  de_la: optionalUrl(dataIso),
  pana_la: optionalUrl(dataIso),
  cursor: optionalUrl(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: optionalUrl(z.string().max(40)),
});
export type FiltreEvaluariUrl = z.output<typeof filtreEvaluariSchema>;
