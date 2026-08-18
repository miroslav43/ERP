// src/schemas/attendance.ts
import { z } from "zod";

import { todayInBucharest } from "@/lib/format/date";

/**
 * Valorile enumerate vin din `0013_attendance.sql`, scrise ca uniuni literale
 * (nu importate din tipurile generate) fiindcă schemele Zod trebuie să poată
 * valida și intrarea din URL, unde totul e `string`.
 */
export const TIPURI_ZI = [
  "lucratoare",
  "weekend",
  "sarbatoare",
  "concediu",
  "medical",
  "absenta_nemotivata",
  "delegatie",
] as const;
export type TipZi = (typeof TIPURI_ZI)[number];

/** Subset ALES DE UTILIZATOR în formular: restul se derivă din calendar (vezi `etichete.ts`). */
export const TIPURI_ZI_ALEGERE = [
  "concediu",
  "medical",
  "absenta_nemotivata",
  "delegatie",
] as const;

export const STATUS_PERIOADA = ["deschisa", "in_aprobare", "blocata"] as const;
export type StatusPerioada = (typeof STATUS_PERIOADA)[number];

export const SURSE_INTRARE = ["manuala", "import", "sincronizare_concedii"] as const;
export type SursaIntrare = (typeof SURSE_INTRARE)[number];

/**
 * Fiecare câmp are `.default(...)`.
 *
 * `filtreDinUrl()` revine la `schema.safeParse({})` când query string-ul e
 * nevalid; fără valori implicite peste tot, revenirea ar eșua și ea, iar
 * utilizatorul ar primi ecranul de eroare pentru un `?limita=abc`.
 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .default(null as never);

/**
 * Text opțional venit dintr-un formular (nu din URL): șirul gol devine `null`.
 */
const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

/** `"08:30"` — format `<input type="time">`. Postgres `time` acceptă șirul ca atare. */
const oraOptionala = z
  .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u), z.literal(""), z.null()])
  .nullable()
  .default(null)
  .transform((v) => (v === "" || v === null ? null : v));

/**
 * Luna curentă e valoarea implicită a filtrului — evaluată LA FIECARE parsare
 * (Zod reapelează funcția, nu o memoizează la definirea schemei), altfel
 * `luna` ar rămâne înghețată la luna în care a pornit procesul serverului.
 */
const lunaImplicita = () => Number(todayInBucharest().slice(5, 7));

export const filtrePontajSchema = z.object({
  luna: z.coerce.number().int().min(1).max(12).default(lunaImplicita),
  departament: optional(z.uuid()),
  cauta: optional(z.string().max(60)),
  cursor: optional(z.string().max(256)),
  // Plafonat la 30, nu la 100 ca în restul aplicației: foaia colectivă
  // încarcă și pontajul lunii pentru fiecare angajat din pagină — max_rows =
  // 1000 în PostgREST, iar 30 angajați × 31 zile = 930 rânduri < 1000.
  limita: z.coerce.number().int().min(5).max(30).default(25),
});
export type FiltrePontaj = z.output<typeof filtrePontajSchema>;

export const filtreAprobareSchema = z.object({
  luna: z.coerce.number().int().min(1).max(12).default(lunaImplicita),
  departament: optional(z.uuid()),
});
export type FiltreAprobare = z.output<typeof filtreAprobareSchema>;

// ── Intrări de scriere ──────────────────────────────────────────────────────

export const deschidePerioadaSchema = z.object({
  an: z.coerce.number().int().min(2000).max(2100),
  luna: z.coerce.number().int().min(1).max(12),
  observatii: textOptional(1000),
});
export type DeschidePerioada = z.output<typeof deschidePerioadaSchema>;

export const idPerioadaSchema = z.object({ id: z.uuid() });

/**
 * `ore_suplimentare`/`ore_noapte` oglindesc CHECK-urile din bază
 * (`attendance_entries_suplimentare_ck`/`_noapte_ck`): nu pot depăși
 * `ore_lucrate`. Verificate și aici, ca omul să afle înainte de round-trip —
 * decizia finală rămâne oricum a bazei.
 */
export const salveazaZiPontajSchema = z
  .object({
    employee_id: z.uuid().nullable().default(null),
    data: z.iso.date(),
    ora_inceput: oraOptionala,
    ora_sfarsit: oraOptionala,
    ore_lucrate: z.coerce.number().min(0).max(24),
    ore_suplimentare: z.coerce.number().min(0).max(24).default(0),
    ore_noapte: z.coerce.number().min(0).max(24).default(0),
    tip_zi: z.enum(TIPURI_ZI).nullable().default(null),
    observatii: textOptional(1000),
  })
  .refine((v) => v.ore_suplimentare <= v.ore_lucrate, {
    message: "Orele suplimentare nu pot depăși orele lucrate.",
    path: ["ore_suplimentare"],
  })
  .refine((v) => v.ore_noapte <= v.ore_lucrate, {
    message: "Orele de noapte nu pot depăși orele lucrate.",
    path: ["ore_noapte"],
  });
export type SalveazaZiPontaj = z.output<typeof salveazaZiPontajSchema>;

export const stergeZiPontajSchema = z.object({ id: z.uuid() });

export const aprobaPontajBlocSchema = z.object({
  period_id: z.uuid(),
  department_id: z.uuid().nullable().default(null),
  observatii: textOptional(1000),
});
export type AprobaPontajBloc = z.output<typeof aprobaPontajBlocSchema>;

export const sincronizeazaConcediileSchema = z.object({
  an: z.coerce.number().int().min(2000).max(2100),
  luna: z.coerce.number().int().min(1).max(12),
});
export type SincronizeazaConcediile = z.output<typeof sincronizeazaConcediileSchema>;
