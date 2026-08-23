// src/schemas/fleet.ts
import { z } from "zod";

/**
 * Valorile enumerate vin din `0012_fleet.sql`. Sunt scrise aici ca uniuni
 * literale, nu importate din tipurile generate, fiindcă schemele Zod trebuie să
 * poată valida și intrarea din URL — unde totul e `string`.
 */
export const STATUS_VEHICUL = ["activ", "in_service", "vandut", "casat"] as const;
export type StatusVehicul = (typeof STATUS_VEHICUL)[number];

export const CATEGORII_VEHICUL = [
  "autoturism",
  "autoutilitara",
  "camion",
  "autobuz",
  "microbuz",
  "remorca",
  "semiremorca",
  "utilaj",
  "motocicleta",
  "altele",
] as const;
export type CategorieVehicul = (typeof CATEGORII_VEHICUL)[number];

export const COMBUSTIBILI = [
  "benzina",
  "motorina",
  "gpl",
  "gnc",
  "electric",
  "hibrid",
  "hibrid_plugin",
  "altul",
] as const;
export type Combustibil = (typeof COMBUSTIBILI)[number];

export const STATUS_FOAIE = ["draft", "trimis", "aprobat", "respins"] as const;
export type StatusFoaie = (typeof STATUS_FOAIE)[number];

/**
 * Fiecare câmp are `.default(...)`.
 *
 * `filtreDinUrl()` revine la `schema.safeParse({})` când query string-ul e
 * nevalid; fără valori implicite peste tot, revenirea ar eșua și ea, iar
 * utilizatorul ar primi ecranul de eroare pentru un `?limita=abc` — exact
 * defectul reparat în modulele de concedii și inventar.
 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .default(null as never);

/**
 * Coloanele după care se pot sorta cele două liste de flotă.
 *
 * Listele sunt ÎNCHISE, nu o validare de formă: numele coloanei ajunge într-un
 * `.order()` ȘI într-un predicat de cursor construit ca text, deci nu poate
 * veni liber din query string. `sortareCeruta` din `lib/queries/cursor.ts` cade
 * tăcut pe implicit pentru orice altceva — un URL copiat greșit nu strică
 * ecranul, doar îl arată sortat implicit.
 *
 * Numai coloane `not null`: cu una care admite NULL, predicatul keyset compară
 * cu NULL, iar rândurile fără valoare dispar tăcut de la a doua pagină. De aceea
 * `km_parcursi` (generată din `km_sosire - km_plecare`, deci NULL pe o cursă în
 * desfășurare) NU e sortabilă.
 */
export const SORTARI_VEHICULE = ["numar", "marca", "km", "stare"] as const;
export type SortareVehicule = (typeof SORTARI_VEHICULE)[number];

export const SORTARI_FOI = ["plecare", "stare"] as const;
export type SortareFoi = (typeof SORTARI_FOI)[number];

export const filtreVehiculeSchema = z.object({
  status: optional(z.enum(STATUS_VEHICUL)),
  categorie: optional(z.enum(CATEGORII_VEHICUL)),
  cauta: optional(z.string().max(32)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  /** Forma din URL: `km` crescător, `-km` descrescător. */
  sort: optional(z.string().max(40)),
});
export type FiltreVehicule = z.output<typeof filtreVehiculeSchema>;

export const filtreFoiSchema = z.object({
  status: optional(z.enum(STATUS_FOAIE)),
  vehicul: optional(z.uuid()),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: optional(z.string().max(40)),
});
export type FiltreFoi = z.output<typeof filtreFoiSchema>;

// ── Intrări de scriere ──────────────────────────────────────────────────────

/**
 * Numărul de înmatriculare NU se normalizează aici.
 *
 * `internal.vehicles_normalizeaza` îl trece prin `upper()` și scoate ce nu e
 * alfanumeric. Dacă l-am curăța și în client, cele două reguli ar putea diverge
 * tăcut la prima modificare — iar cea care contează e a bazei, fiindcă indexul
 * unic se aplică peste valoarea normalizată de ea.
 */
export const vehiculNouSchema = z.object({
  nr_inmatriculare: z.string().trim().min(3).max(16),
  marca: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  // VIN-ul nu conține I, O sau Q — au fost scoase din standard tocmai ca să nu
  // se confunde cu 1 și 0.
  vin: z
    .union([
      z
        .string()
        .trim()
        .regex(/^[A-HJ-NPR-Z0-9]{11,17}$/iu),
      z.literal(""),
    ])
    .transform((v) => (v === "" ? null : v.toUpperCase()))
    .nullable()
    .default(null),
  categorie: z.enum(CATEGORII_VEHICUL).default("autoturism"),
  tip_combustibil: z.enum(COMBUSTIBILI).default("motorina"),
  an_fabricatie: z.coerce.number().int().min(1900).max(2200).nullable().default(null),
  culoare: z.string().trim().max(40).nullable().default(null),
  consum_mediu_declarat: z.coerce.number().min(0).max(300).nullable().default(null),
  employee_id: z.uuid().nullable().default(null),
  department_id: z.uuid().nullable().default(null),
  data_achizitie: z.iso.date().nullable().default(null),
  valoare_achizitie: z.coerce.number().min(0).nullable().default(null),
  prag_salt_km: z.coerce.number().int().min(10).max(100000).nullable().default(null),
  observatii: z.string().trim().max(2000).nullable().default(null),
});
export type VehiculNou = z.output<typeof vehiculNouSchema>;

export const documentVehiculSchema = z.object({
  vehicle_id: z.uuid(),
  document_type_id: z.uuid(),
  numar: z.string().trim().max(64).nullable().default(null),
  emitent: z.string().trim().max(120).nullable().default(null),
  valabil_de_la: z.iso.date().nullable().default(null),
  expira_la: z.iso.date().nullable().default(null),
  cost: z.coerce.number().min(0).nullable().default(null),
  observatii: z.string().trim().max(1000).nullable().default(null),
});
export type DocumentVehicul = z.output<typeof documentVehiculSchema>;

/**
 * `employee_id` și `km_plecare` sunt OBLIGATORII, deși planul le dădea ca
 * opționale.
 *
 * Verificat în bază: amândouă sunt `not null` fără valoare implicită. Un trigger
 * BEFORE chiar prepopulează kilometrajul, deci un INSERT cu NULL ar trece — dar
 * atunci șoferul află cifra abia după salvare, din ecranul următor. Formularul o
 * cere prepopulată din `kmDePlecareSugerat()`, ca omul să o vadă și să o poată
 * corecta ÎNAINTE, nu după.
 */
export const foaieNouaSchema = z.object({
  vehicle_id: z.uuid(),
  employee_id: z.uuid(),
  plecare_la: z.iso.datetime({ local: true }),
  km_plecare: z.coerce.number().int().min(0),
  traseu: z.string().trim().max(500).nullable().default(null),
  scop: z.string().trim().max(500).nullable().default(null),
  observatii: z.string().trim().max(1000).nullable().default(null),
});
export type FoaieNoua = z.output<typeof foaieNouaSchema>;

export const trimiteFoaieSchema = z.object({
  id: z.uuid(),
  sosire_la: z.iso.datetime({ local: true }),
  km_sosire: z.coerce.number().int().min(0),
});

export const decizieFoaieSchema = z.object({
  id: z.uuid(),
  decizie: z.enum(["aprobat", "respins"]),
  // Un refuz fără motiv îl lasă pe șofer să ghicească ce anume să corecteze.
  motiv_respingere: z.string().trim().max(500).nullable().default(null),
});

export const alimentareSchema = z.object({
  trip_sheet_id: z.uuid(),
  litri: z.coerce.number().positive().max(2000),
  cost: z.coerce.number().min(0),
  statie: z.string().trim().max(120).nullable().default(null),
  numar_bon: z.string().trim().max(64).nullable().default(null),
  alimentat_la: z.iso.datetime({ local: true }),
  plin: z.boolean().default(false),
  observatii: z.string().trim().max(500).nullable().default(null),
});

export const confirmaAnomalieSchema = z.object({
  id: z.uuid(),
  nota: z.string().trim().max(500).nullable().default(null),
});
