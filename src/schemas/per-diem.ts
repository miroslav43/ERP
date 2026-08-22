// src/schemas/per-diem.ts
// Validările de intrare pentru modulul de diurnă: deplasări, etape, cheltuieli, filtre.

import { z } from "zod";

// ── Enumerări în oglindă cu tipurile din 0015_per_diem.sql ───────────────────

export const STATUSURI_DEPLASARE = [
  "ciorna",
  "in_aprobare",
  "aprobata",
  "respinsa",
  "anulata",
  "incheiata",
  "decontata",
] as const;
export type StatusDeplasare = (typeof STATUSURI_DEPLASARE)[number];

export const MIJLOACE_TRANSPORT = [
  "auto_serviciu",
  "auto_personal",
  "tren",
  "avion",
  "autocar",
  "naval",
  "mixt",
  "altul",
] as const;
export type MijlocTransport = (typeof MIJLOACE_TRANSPORT)[number];

export const TIPURI_CHELTUIALA = [
  "cazare",
  "transport",
  "combustibil",
  "taxa_drum",
  "parcare",
  "alta",
] as const;
export type TipCheltuiala = (typeof TIPURI_CHELTUIALA)[number];

export const REGULI_TRECERE_FRONTIERA = [
  "tara_plecare",
  "tara_sosire",
  "tara_cu_valoare_mai_mare",
  "durata_maxima",
] as const;
export type RegulaTrecereFrontiera = (typeof REGULI_TRECERE_FRONTIERA)[number];

// ── Helpere de câmp ────────────────────────────────────────────────────────

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v));

const uuidOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((v) => (v === null || v.length === 0 ? null : v))
  .refine(
    (v) => v === null || z.uuid().safeParse(v).success,
    "Identificatorul selectat nu este valid.",
  );

const numarOptional = (min: number, max: number) =>
  z.coerce
    .number()
    .refine((v) => Number.isFinite(v), "Valoarea trebuie să fie un număr.")
    .refine(
      (v) => v >= min && v <= max,
      `Valoarea trebuie să fie între ${String(min)} și ${String(max)}.`,
    )
    .nullable()
    .default(null);

/**
 * Fiecare câmp are `.default(...)` — `filtreDinUrl()` revine la
 * `schema.safeParse({})` când query string-ul e nevalid, iar fără valori
 * implicite peste tot, revenirea ar eșua și ea.
 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .default(null as never);

export const filtreDeplasariSchema = z.object({
  status: optional(z.enum(STATUSURI_DEPLASARE)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
});
export type FiltreDeplasari = z.output<typeof filtreDeplasariSchema>;

// ── Deplasare nouă ────────────────────────────────────────────────────────

const ANUL_MINIM = 1900;
const ANUL_MAXIM = 2199;

function anInInterval(dataISO: string): boolean {
  const an = Number(dataISO.slice(0, 4));
  return Number.isInteger(an) && an >= ANUL_MINIM && an <= ANUL_MAXIM;
}

/**
 * `employee_id` NULL = deplasarea e pentru mine însumi — rezolvat în acțiune,
 * cu clientul admin, exact ca la cererile de concediu (`employees:read =
 * none` pentru rolul `employee` blochează orice altă cale).
 *
 * `vehicle_id` nu apare aici: legarea de un vehicul din flotă e opțională și
 * modulul de flotă poate fi dezactivat — pragul de implementare al acestei
 * faze lasă câmpul mereu `null`, coloană nullable care nu blochează nimic.
 */
export const deplasareNouaSchema = z
  .object({
    employee_id: uuidOptional,
    scop: z.string().trim().min(3, "Scopul trebuie să aibă cel puțin 3 caractere.").max(500),
    country_id: uuidOptional,
    localitate: textOptional(200),
    plecare_la: z.iso.datetime({ local: true }),
    sosire_la: z.iso.datetime({ local: true }),
    mijloc_transport: z.enum(MIJLOACE_TRANSPORT),
    km_parcursi: numarOptional(0, 1_000_000),
    avans_acordat: z.coerce.number().min(0).default(0),
    moneda_avans: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/u, "Moneda trebuie scrisă din 3 litere, ex. RON.")
      .transform((v) => v.toUpperCase())
      .nullable()
      .default(null),
    curs_diurna: numarOptional(0.000001, 1_000_000),
    observatii: textOptional(2000),
    detasare_transnationala: z.coerce.boolean().default(false),
    stat_gazda_country_id: uuidOptional,
    salariu_minim_stat_gazda: numarOptional(0, 100_000_000),
    moneda_salariu_minim: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/u, "Moneda trebuie scrisă din 3 litere.")
      .transform((v) => v.toUpperCase())
      .nullable()
      .default(null),
  })
  .superRefine((valoare, ctx) => {
    if (!anInInterval(valoare.plecare_la)) {
      ctx.addIssue({
        code: "custom",
        path: ["plecare_la"],
        message: "Anul plecării este în afara intervalului acceptat.",
      });
      return;
    }
    if (valoare.sosire_la <= valoare.plecare_la) {
      ctx.addIssue({
        code: "custom",
        path: ["sosire_la"],
        message: "Data de sosire trebuie să fie după data de plecare.",
      });
    }
    if (valoare.avans_acordat > 0 && valoare.moneda_avans === null) {
      ctx.addIssue({
        code: "custom",
        path: ["moneda_avans"],
        message: "Dacă acordați un avans, moneda avansului este obligatorie.",
      });
    }
    if (
      valoare.detasare_transnationala &&
      (valoare.stat_gazda_country_id === null ||
        valoare.salariu_minim_stat_gazda === null ||
        valoare.moneda_salariu_minim === null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["stat_gazda_country_id"],
        message:
          "Detașarea transnațională cere statul gazdă, salariul minim aplicabil acolo și moneda lui, toate trei.",
      });
    }
  });
export type DeplasareNoua = z.output<typeof deplasareNouaSchema>;

export const trimiteDeplasareSchema = z.object({
  id: z.uuid("Deplasarea selectată nu este validă."),
});
export const stergeCiornaDeplasareSchema = z.object({
  id: z.uuid("Deplasarea selectată nu este validă."),
});

export const decizieDeplasareSchema = z.object({
  id: z.uuid("Deplasarea selectată nu este validă."),
  decizie: z.enum(["aprobata", "respinsa"]),
});
export type DecizieDeplasare = z.output<typeof decizieDeplasareSchema>;

export const deconteazaDeplasareSchema = z.object({
  id: z.uuid("Deplasarea selectată nu este validă."),
});

// ── Etapă (business_trip_legs) ────────────────────────────────────────────

export const etapaNouaSchema = z
  .object({
    business_trip_id: z.uuid(),
    from_country_id: z.uuid("Țara de plecare a etapei este obligatorie."),
    to_country_id: z.uuid("Țara de sosire a etapei este obligatorie."),
    plecare_la: z.iso.datetime({ local: true }),
    sosire_la: z.iso.datetime({ local: true }),
    mijloc_transport: z.enum(MIJLOACE_TRANSPORT).nullable().default(null),
    localitate_sosire: textOptional(200),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.sosire_la < valoare.plecare_la) {
      ctx.addIssue({
        code: "custom",
        path: ["sosire_la"],
        message: "Sosirea etapei nu poate fi înainte de plecarea ei.",
      });
    }
    if (valoare.from_country_id === valoare.to_country_id) {
      ctx.addIssue({
        code: "custom",
        path: ["to_country_id"],
        message: "O etapă trebuie să lege două țări diferite.",
      });
    }
  });
export type EtapaNoua = z.output<typeof etapaNouaSchema>;

// ── Cheltuială (trip_expenses) ────────────────────────────────────────────

export const cheltuialaNouaSchema = z.object({
  business_trip_id: z.uuid(),
  tip: z.enum(TIPURI_CHELTUIALA),
  descriere: textOptional(500),
  data_cheltuielii: z
    .string()
    .trim()
    .regex(RE_DATA, "Data cheltuielii trebuie scrisă în formatul AAAA-LL-ZZ."),
  suma: z.coerce.number().positive("Suma trebuie să fie mai mare decât zero."),
  moneda: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/u, "Moneda trebuie scrisă din 3 litere, ex. RON.")
    .transform((v) => v.toUpperCase()),
  curs_valutar: z.coerce.number().positive("Cursul valutar trebuie să fie mai mare decât zero."),
  document_tip: textOptional(60),
  document_numar: textOptional(60),
  document_cale: textOptional(500),
});
export type CheltuialaNoua = z.output<typeof cheltuialaNouaSchema>;

export const decizieCheltuialaSchema = z.object({
  id: z.uuid("Cheltuiala selectată nu este validă."),
  decizie: z.enum(["aproba", "respinge"]),
  motiv_respingere: textOptional(500),
});
export type DecizieCheltuiala = z.output<typeof decizieCheltuialaSchema>;

// ── Politica de diurnă (per_diem_policies) ────────────────────────────────

export const politicaNouaSchema = z
  .object({
    denumire: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(200),
    country_id_intern: z.uuid("Țara internă este obligatorie."),
    moneda_interna: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/u, "Moneda trebuie scrisă din 3 litere.")
      .transform((v) => v.toUpperCase()),
    diurna_interna_zi: z.coerce.number().min(0),
    diurna_baza_legala_interna: z.coerce.number().min(0),
    multiplu_plafon_neimpozabil: z.coerce.number().min(1),
    multiplu_diurna_externa: z.coerce.number().min(0),
    categorie_barem: z.enum(["I", "II"]).default("II"),
    prag_ore_minim: z.coerce.number().positive(),
    prag_ore_zi_intreaga: z.coerce.number().positive().max(24),
    fractiune_zi_partiala: z.coerce.number().min(0).max(1),
    acorda_diurna_ziua_trecerii: z.coerce.boolean().default(true),
    regula_tara_trecere: z.enum(REGULI_TRECERE_FRONTIERA).default("tara_sosire"),
    tarif_km_auto_personal: z.coerce.number().min(0),
    moneda_tarif_km: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/u, "Moneda trebuie scrisă din 3 litere.")
      .transform((v) => v.toUpperCase()),
    plafon_salarii_baza_luna: z.coerce.number().positive(),
    valabil_de_la: z.string().trim().regex(RE_DATA, "Data trebuie scrisă în formatul AAAA-LL-ZZ."),
    observatii: textOptional(2000),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.prag_ore_minim > valoare.prag_ore_zi_intreaga) {
      ctx.addIssue({
        code: "custom",
        path: ["prag_ore_zi_intreaga"],
        message: "Pragul pentru zi întreagă trebuie să fie cel puțin cât pragul minim.",
      });
    }
  });
export type PoliticaNoua = z.output<typeof politicaNouaSchema>;
