// src/schemas/maintenance.ts
// Validările modulului de mentenanță — echipamente, contoare, planuri,
// intervenții, sesizări, autorizații ISCIR. Valorile enumerate vin din
// `0011_ssm.sql` (tipurile `equipment_status`, `meter_kind`,
// `maintenance_kind`, `maintenance_result`, `fault_urgency`, `fault_status`),
// scrise aici ca uniuni literale — nu importate din tipurile generate — ca
// schemele să poată valida și intrarea brută din URL, unde totul e `string`.

import { z } from "zod";

export const STATUS_ECHIPAMENT = [
  "in_functiune",
  "in_reparatie",
  "in_conservare",
  "casat",
] as const;
export type StatusEchipament = (typeof STATUS_ECHIPAMENT)[number];

export const TIPURI_CONTOR = ["ore", "km", "cicluri"] as const;
export type TipContor = (typeof TIPURI_CONTOR)[number];

export const TIPURI_MENTENANTA = ["preventiva", "predictiva", "corectiva"] as const;
export type TipMentenanta = (typeof TIPURI_MENTENANTA)[number];

export const REZULTATE_INTERVENTIE = ["reusita", "partiala", "esuata", "amanata"] as const;
export type RezultatInterventie = (typeof REZULTATE_INTERVENTIE)[number];

export const URGENTE_SESIZARE = ["scazuta", "medie", "ridicata", "critica"] as const;
export type UrgentaSesizare = (typeof URGENTE_SESIZARE)[number];

export const STATUSURI_SESIZARE = ["nou", "in_analiza", "in_lucru", "rezolvat", "respins"] as const;
export type StatusSesizare = (typeof STATUSURI_SESIZARE)[number];

/** Statusurile pe care le poate atribui triajul — nu „nou” (stare inițială) și nu „rezolvat” (are flux propriu). */
export const STATUSURI_TRIAJ = ["in_analiza", "in_lucru", "respins"] as const;
export type StatusTriaj = (typeof STATUSURI_TRIAJ)[number];

const RE_ORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/u;

// ── Filtre din URL (paginare keyset) ────────────────────────────────────────
//
// Fiecare câmp opțional are `.default(...)`: `filtreDinUrl()` revine la
// `schema.safeParse({})` când query string-ul e nevalid, iar fără implicite
// peste tot revenirea ar eșua și ea (vezi `lib/rute/parametri.ts`).

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .default(null as never);

/**
 * Coloanele după care se pot sorta cele trei liste de mentenanță.
 *
 * Listele sunt ÎNCHISE, nu o validare de formă: numele coloanei ajunge într-un
 * `.order()` ȘI într-un predicat de cursor construit ca text, deci nu poate
 * veni liber din query string. `sortareCeruta` din `lib/queries/cursor.ts` cade
 * tăcut pe implicit pentru orice altceva.
 *
 * Numai coloane `not null`: cu una care admite NULL, predicatul keyset compară
 * cu NULL, iar rândurile fără valoare dispar tăcut de la a doua pagină. `cost`
 * e sortabil tocmai fiindcă `cost_total` e generată din două coloane `not null
 * default 0`, deci nu e niciodată NULL; `locatie`, în schimb, nu e.
 */
export const SORTARI_ECHIPAMENTE = ["cod", "denumire", "stare"] as const;
export type SortareEchipamente = (typeof SORTARI_ECHIPAMENTE)[number];

export const SORTARI_INTERVENTII = ["data", "tip", "cost", "rezultat"] as const;
export type SortareInterventii = (typeof SORTARI_INTERVENTII)[number];

export const SORTARI_SESIZARI = ["raportat", "urgenta", "stare"] as const;
export type SortareSesizari = (typeof SORTARI_SESIZARI)[number];

export const filtreEchipamenteSchema = z.object({
  status: optional(z.enum(STATUS_ECHIPAMENT)),
  cauta: optional(z.string().max(80)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  /** Forma din URL: `cod` crescător, `-cod` descrescător. */
  sort: optional(z.string().max(40)),
});
export type FiltreEchipamente = z.output<typeof filtreEchipamenteSchema>;

export const filtreInterventiiSchema = z.object({
  tip: optional(z.enum(TIPURI_MENTENANTA)),
  rezultat: optional(z.enum(REZULTATE_INTERVENTIE)),
  echipament: optional(z.uuid()),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: optional(z.string().max(40)),
});
export type FiltreInterventii = z.output<typeof filtreInterventiiSchema>;

export const filtreSesizariSchema = z.object({
  status: optional(z.enum(STATUSURI_SESIZARE)),
  urgenta: optional(z.enum(URGENTE_SESIZARE)),
  echipament: optional(z.uuid()),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: optional(z.string().max(40)),
});
export type FiltreSesizari = z.output<typeof filtreSesizariSchema>;

// ── Echipamente ──────────────────────────────────────────────────────────

/**
 * `derogare_acordata_de` și `derogare_acordata_la` NU apar aici: `equipment_iscir_guard`
 * (BEFORE) le calculează singur din `auth.uid()`/`now()` când derogarea e acordată, și
 * le golește singur când nu mai e nevoie de ea. Trimise din client, ar fi fie ignorate
 * (golite de trigger dacă responsabilul are deja autorizație), fie ar declanșa P0001
 * (garda nu are cum să valideze un `derogare_acordata_de` scris manual).
 */
export const echipamentSchema = z.object({
  cod: z.string().trim().min(1).max(60),
  denumire: z.string().trim().min(1).max(200),
  serie: z.string().trim().max(120).nullable().default(null),
  producator: z.string().trim().max(120).nullable().default(null),
  model: z.string().trim().max(120).nullable().default(null),
  an_fabricatie: z.coerce.number().int().min(1900).max(2200).nullable().default(null),
  locatie: z.string().trim().max(200).nullable().default(null),
  department_id: z.uuid().nullable().default(null),
  responsabil_employee_id: z.uuid().nullable().default(null),
  status: z.enum(STATUS_ECHIPAMENT).default("in_functiune"),
  este_iscir: z.boolean().default(false),
  tip_autorizare_necesara: z.string().trim().max(80).nullable().default(null),
  valoare_achizitie: z.coerce.number().min(0).nullable().default(null),
  data_punerii_in_functiune: z.iso.date().nullable().default(null),
  // Minimum 20 de caractere doar contează efectiv când `equipment_iscir_guard`
  // ajunge pe ramura de derogare (este_iscir=true, fără responsabil autorizat,
  // apelant org_admin/super_admin) — validarea de lungime minimă e front-loaded
  // aici ca omul să afle imediat, nu după un P0001.
  derogare_motiv: z.string().trim().max(500).nullable().default(null),
});
export type EchipamentInput = z.output<typeof echipamentSchema>;

export const actualizeazaEchipamentSchema = echipamentSchema.extend({
  id: z.uuid("Echipamentul selectat nu este valid."),
});
export type ActualizeazaEchipamentInput = z.output<typeof actualizeazaEchipamentSchema>;

/** Text de căutare pentru selectorul de echipament din formularul de sesizare. */
export const cautaEchipamentSchema = z.object({
  q: z.string().trim().max(80).default(""),
});
export type CautaEchipamentInput = z.output<typeof cautaEchipamentSchema>;

// ── Contoare ────────────────────────────────────────────────────────────

export const contorNouSchema = z.object({
  equipment_id: z.uuid("Echipamentul selectat nu este valid."),
  tip: z.enum(TIPURI_CONTOR),
  citire: z.coerce.number().min(0),
  data_citirii: z.iso.date(),
  resetare_contor: z.boolean().default(false),
  sursa: z.string().trim().min(1).max(60).default("manual"),
  citit_de_employee_id: z.uuid().nullable().default(null),
  observatii: z.string().trim().max(500).nullable().default(null),
});
export type ContorNouInput = z.output<typeof contorNouSchema>;

// ── Planuri de mentenanță ──────────────────────────────────────────────────

/**
 * `urmatoarea_scadenta` și `urmatoarea_scadenta_contor` NU apar aici:
 * `maintenance_plans_calc` (BEFORE) le rescrie necondiționat la fiecare insert
 * și update, din `ultima_executie`/`periodicitate_zile` respectiv
 * `ultima_citire_contor`/`periodicitate_contor`. Trimise din client, ar fi pur
 * și simplu ignorate — dar tot nu se trimit, ca formularul să nu sugereze o
 * cifră pe care baza o rescrie oricum.
 */
const campuriPlan = z.object({
  equipment_id: z.uuid("Echipamentul selectat nu este valid."),
  denumire: z.string().trim().min(1).max(200),
  tip: z.enum(TIPURI_MENTENANTA).default("preventiva"),
  periodicitate_zile: z.coerce.number().int().min(1).nullable().default(null),
  periodicitate_contor: z.coerce.number().min(0.01).nullable().default(null),
  tip_contor: z.enum(TIPURI_CONTOR).nullable().default(null),
  ultima_executie: z.iso.date().nullable().default(null),
  ultima_citire_contor: z.coerce.number().min(0).nullable().default(null),
  responsabil_employee_id: z.uuid().nullable().default(null),
  instructiuni: z.string().trim().max(2000).nullable().default(null),
  activ: z.boolean().default(true),
});

/** Oglindește `maintenance_plans_periodicitate_ck` și `..._contor_ck` din bază — verificare front-loaded. */
function valideazaPeriodicitatePlan(
  valoare: Readonly<{
    periodicitate_zile: number | null;
    periodicitate_contor: number | null;
    tip_contor: TipContor | null;
  }>,
  ctx: z.RefinementCtx,
): void {
  if (valoare.periodicitate_zile === null && valoare.periodicitate_contor === null) {
    ctx.addIssue({
      code: "custom",
      path: ["periodicitate_zile"],
      message: "Planul are nevoie de o periodicitate: în zile, în unități de contor, sau ambele.",
    });
  }
  if (valoare.periodicitate_contor !== null && valoare.tip_contor === null) {
    ctx.addIssue({
      code: "custom",
      path: ["tip_contor"],
      message: "O periodicitate pe contor cere și tipul contorului (ore, km sau cicluri).",
    });
  }
}

export const planNouSchema = campuriPlan.superRefine(valideazaPeriodicitatePlan);
export type PlanNouInput = z.output<typeof planNouSchema>;

export const actualizeazaPlanSchema = campuriPlan
  .extend({ id: z.uuid("Planul selectat nu este valid.") })
  .superRefine(valideazaPeriodicitatePlan);
export type ActualizeazaPlanInput = z.output<typeof actualizeazaPlanSchema>;

// ── Intervenții ──────────────────────────────────────────────────────────

/**
 * `cost_total` NU apare aici: e `generated always as (cost_piese + cost_manopera)
 * stored` — Postgres respinge cu 428C9 orice INSERT/UPDATE care îl atinge.
 */
const campuriInterventie = z.object({
  tip: z.enum(TIPURI_MENTENANTA).default("corectiva"),
  data: z.iso.date(),
  ora_start: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .refine((v) => v === null || v.length === 0 || RE_ORA.test(v), "Ora trebuie scrisă HH:MM.")
    .transform((v) => (v === null || v.length === 0 ? null : v)),
  durata_ore: z.coerce.number().min(0).nullable().default(null),
  executant_employee_id: z.uuid().nullable().default(null),
  executant_extern: z.string().trim().max(200).nullable().default(null),
  descriere: z.string().trim().min(3).max(2000),
  piese: z.string().trim().max(2000).nullable().default(null),
  cost_piese: z.coerce.number().min(0).default(0),
  cost_manopera: z.coerce.number().min(0).default(0),
  rezultat: z.enum(REZULTATE_INTERVENTIE).default("reusita"),
  oprire_minute: z.coerce.number().int().min(0).nullable().default(null),
  citire_contor: z.coerce.number().min(0).nullable().default(null),
  observatii: z.string().trim().max(2000).nullable().default(null),
});

export const interventieNouaSchema = campuriInterventie.extend({
  plan_id: z.uuid().nullable().default(null),
  equipment_id: z.uuid("Echipamentul selectat nu este valid."),
});
export type InterventieNouaInput = z.output<typeof interventieNouaSchema>;

// ── Sesizări ────────────────────────────────────────────────────────────

export const sesizareNouaSchema = z.object({
  equipment_id: z.uuid("Selectați echipamentul defect."),
  descriere: z
    .string()
    .trim()
    .min(10, "Descrieți defecțiunea în cel puțin 10 caractere.")
    .max(2000),
  urgenta: z.enum(URGENTE_SESIZARE).default("medie"),
  opreste_functionarea: z.boolean().default(false),
});
export type SesizareNouaInput = z.output<typeof sesizareNouaSchema>;

export const trieazaSesizareSchema = z
  .object({
    id: z.uuid("Sesizarea selectată nu este validă."),
    status: z.enum(STATUSURI_TRIAJ),
    motiv_respingere: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((valoare, ctx) => {
    if (
      valoare.status === "respins" &&
      (valoare.motiv_respingere === null || valoare.motiv_respingere.length < 5)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["motiv_respingere"],
        message: "Respingerea are nevoie de un motiv scris, de cel puțin 5 caractere.",
      });
    }
  });
export type TriazaSesizareInput = z.output<typeof trieazaSesizareSchema>;

/**
 * Rezolvarea unei sesizări creează întâi intervenția care a rezolvat-o, deci
 * schema poartă aceleași câmpuri ca `interventieNouaSchema`, fără `plan_id`
 * (o sesizare nu vine niciodată dintr-un plan) — `equipment_id` se ia din
 * sesizarea deja citită în handler, nu din formular.
 */
export const rezolvaSesizareSchema = campuriInterventie.extend({
  id: z.uuid("Sesizarea selectată nu este validă."),
});
export type RezolvaSesizareInput = z.output<typeof rezolvaSesizareSchema>;

// ── Autorizații ISCIR ──────────────────────────────────────────────────────

export const autorizatieIscirNouaSchema = z.object({
  equipment_id: z.uuid("Echipamentul selectat nu este valid."),
  numar: z.string().trim().min(1).max(80),
  tip: z.string().trim().min(1).max(80),
  emitent: z.string().trim().min(1).max(120).default("ISCIR"),
  emis_la: z.iso.date().nullable().default(null),
  valabil_pana: z.iso.date(),
  scadenta_verificare_tehnica: z.iso.date().nullable().default(null),
  conditii: z.string().trim().max(1000).nullable().default(null),
});
export type AutorizatieIscirNouaInput = z.output<typeof autorizatieIscirNouaSchema>;
