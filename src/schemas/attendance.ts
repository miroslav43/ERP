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

/**
 * Decizia pe O SINGURĂ zi de pontaj.
 *
 * Până în 0067 exista doar aprobarea în bloc, pe toată luna, și NICIO cale de
 * respingere: aprobatorul care găsea o zi greșită într-o lună de 200 de
 * angajați putea aproba tot, inclusiv greșeala, sau nimic.
 */
export const decideZiPontajSchema = z
  .object({
    entry_id: z.uuid("Ziua de pontaj selectată nu este validă."),
    aproba: z.coerce.boolean(),
    motiv: z
      .string()
      .trim()
      .max(500, "Motivul nu poate depăși 500 de caractere.")
      .nullable()
      .default(null)
      .transform((v) => (v === null || v.length === 0 ? null : v)),
  })
  .superRefine((valoare, ctx) => {
    // Oglindă a CHECK-ului `attendance_entries_respingere_ck` din 0067.
    if (!valoare.aproba && (valoare.motiv ?? "").trim().length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["motiv"],
        message: "Respingerea cere un motiv de cel puțin 5 caractere.",
      });
    }
  });
export type DecideZiPontaj = z.output<typeof decideZiPontajSchema>;

export const sincronizeazaConcediileSchema = z.object({
  an: z.coerce.number().int().min(2000).max(2100),
  luna: z.coerce.number().int().min(1).max(12),
});
export type SincronizeazaConcediile = z.output<typeof sincronizeazaConcediileSchema>;

// ── Plan săptămânal (prezență + ore, aprobare individuală) ─────────────────

export const TIPURI_PREZENTA = ["birou", "homeoffice", "deplasare", "delegatie"] as const;
export type TipPrezenta = (typeof TIPURI_PREZENTA)[number];

export const STARI_SAPTAMANA_PONTAJ = ["ciorna", "trimisa", "aprobata", "respinsa"] as const;
export type StareSaptamanaPontaj = (typeof STARI_SAPTAMANA_PONTAJ)[number];

const ziPlanificataSchema = z.object({
  data: z.iso.date(),
  tip_prezenta: z.enum(TIPURI_PREZENTA),
  ore_planificate: z.coerce.number().min(0).max(24),
  observatii: textOptional(500),
});
export type ZiPlanificata = z.output<typeof ziPlanificataSchema>;

/**
 * `saptamana_start` trebuie să fie luni — oglindește constrângerea din
 * `attendance_week_submissions_luni_ck` (0040), verificată și aici ca omul
 * să afle înainte de round-trip, nu doar din eroarea bazei.
 */
export const trimiteSaptamanaPontajSchema = z.object({
  saptamana_start: z.iso.date().refine((v) => new Date(`${v}T00:00:00Z`).getUTCDay() === 1, {
    message: "Săptămâna trebuie să înceapă luni.",
  }),
  status: z.enum(["ciorna", "trimisa"]),
  zile: z.array(ziPlanificataSchema).min(1).max(7),
});
export type TrimiteSaptamanaPontaj = z.output<typeof trimiteSaptamanaPontajSchema>;

const LUNGIME_MINIMA_MOTIV_RESPINGERE_SAPTAMANA = 5;

export const decideSaptamanaPontajSchema = z
  .object({
    taskId: z.uuid("Sarcina de aprobare selectată nu este validă."),
    decizie: z.enum(["aprobata", "respinsa"]),
    comentariu: textOptional(1000),
    motivRespingere: textOptional(500),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.decizie !== "respinsa") return;
    const lungime = (valoare.motivRespingere ?? "").trim().length;
    if (lungime < LUNGIME_MINIMA_MOTIV_RESPINGERE_SAPTAMANA) {
      ctx.addIssue({
        code: "custom",
        path: ["motivRespingere"],
        message: `Motivul respingerii trebuie să aibă cel puțin ${String(LUNGIME_MINIMA_MOTIV_RESPINGERE_SAPTAMANA)} caractere.`,
      });
    }
  });
export type DecideSaptamanaPontaj = z.output<typeof decideSaptamanaPontajSchema>;

/**
 * Parametrii de dreptul muncii ai organizației.
 *
 * ⚠️ TOATE valorile de aici trebuie confirmate de jurist înainte de a fi
 * folosite la o plată reală. Tabela `attendance_settings` a fost creată
 * DELIBERAT fără valori implicite (migrarea 0013, secțiunea 2, cu un
 * `comment ... 'DE VERIFICAT DE JURIST'` pe fiecare coloană) — tocmai ca
 * nimeni să nu poată calcula un salariu pe niște implicite inventate.
 *
 * Consecința e că, până acum, tabela a rămas complet goală în toate
 * organizațiile: nu exista niciun ecran care s-o scrie. Sporurile de noapte,
 * de weekend și de sărbătoare, intervalul nocturn și termenele de compensare
 * nu erau configurate nicăieri, iar salarizarea cădea tăcut pe cele din
 * `payroll_settings`.
 */
export const setariPontajSchema = z.object({
  valabil_de_la: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "Data trebuie să fie AAAA-LL-ZZ."),
  ore_pe_zi: z.coerce.number().positive("Norma zilnică trebuie să fie pozitivă.").max(24),
  ore_pe_saptamana: z.coerce.number().positive().max(168),
  ore_maxime_saptamanale: z.coerce.number().positive().max(168),
  perioada_referinta_luni: z.coerce.number().int().min(1).max(12),
  repaus_zilnic_minim_ore: z.coerce.number().min(0).max(24),
  repaus_saptamanal_minim_ore: z.coerce.number().min(0).max(168),
  // Procente 0-100, nu fracții: scara e cea din `attendance_settings`, diferită
  // de cea din `payroll_settings`. Confuzia dintre ele ar înmulți sau împărți
  // sporurile cu o sută.
  spor_suplimentare_procent: z.coerce.number().min(0).max(300),
  spor_noapte_procent: z.coerce.number().min(0).max(300),
  spor_weekend_procent: z.coerce.number().min(0).max(300),
  spor_sarbatoare_procent: z.coerce.number().min(0).max(300),
  noapte_start: z.string().regex(/^\d{2}:\d{2}$/u, "Ora trebuie să fie HH:MM."),
  noapte_sfarsit: z.string().regex(/^\d{2}:\d{2}$/u, "Ora trebuie să fie HH:MM."),
  prag_ore_noapte: z.coerce.number().min(0).max(12),
  termen_compensare_suplimentare_zile: z.coerce.number().int().min(0).max(365),
  termen_compensare_sarbatoare_zile: z.coerce.number().int().min(0).max(365),
  pauza_masa_minute: z.coerce.number().int().min(0).max(240),
  pauza_masa_inclusa_in_program: z.coerce.boolean(),
  pauza_obligatorie_peste_ore: z.coerce.number().min(0).max(24),
  observatii_juridice: z.string().trim().max(2000).nullable().default(null),
});
export type IntrareSetariPontaj = z.output<typeof setariPontajSchema>;
