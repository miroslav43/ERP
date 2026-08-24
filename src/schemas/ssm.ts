// src/schemas/ssm.ts
import { z } from "zod";

/**
 * Valorile enumerate vin din `0011_ssm.sql`, scrise ca uniuni literale — nu
 * importate din tipurile generate — fiindcă schemele Zod validează și
 * intrarea din URL, unde totul e `string`.
 */
export const DOMENII_SSM = ["ssm", "psi"] as const;
export type SsmDomain = (typeof DOMENII_SSM)[number];

export const TIPURI_ACCIDENT = ["usor", "grav", "mortal", "colectiv"] as const;
export type TipAccident = (typeof TIPURI_ACCIDENT)[number];

export const TIPURI_EXAMEN = ["angajare", "periodic", "reluare", "adaptare"] as const;
export type TipExamen = (typeof TIPURI_EXAMEN)[number];

export const REZULTATE_EXAMEN = ["apt", "apt_conditionat", "inapt_temporar", "inapt"] as const;
export type RezultatExamen = (typeof REZULTATE_EXAMEN)[number];

export const STATUS_STINGATOR = ["activ", "in_service", "casat"] as const;
export type StatusStingator = (typeof STATUS_STINGATOR)[number];

export const TIPURI_VERIFICARE_STINGATOR = ["verificare", "reincarcare", "proba_presiune"] as const;
export type TipVerificareStingator = (typeof TIPURI_VERIFICARE_STINGATOR)[number];

export const REZULTATE_VERIFICARE_STINGATOR = ["conform", "neconform", "remediat"] as const;
export type RezultatVerificareStingator = (typeof REZULTATE_VERIFICARE_STINGATOR)[number];

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

// ── Filtre de listare ───────────────────────────────────────────────────────

/**
 * Filtrele matricei de instruiri. `domeniu` NU e opțional în sensul „poate
 * lipsi din ecran" — ecranul are un tab obligatoriu SSM/PSI — dar tot are
 * `.default("ssm")`, ca un URL fără parametru să nu pice pe eroare de schemă.
 */
export const filtreInstruiriSchema = z.object({
  domeniu: z
    .union([z.enum(DOMENII_SSM), z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? "ssm" : v))
    .default("ssm"),
  q: optional(z.string().max(80)),
  cursor: optional(z.string().max(400)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
});
export type FiltreInstruiri = z.output<typeof filtreInstruiriSchema>;

/**
 * Coloanele după care se poate sorta fiecare listă SSM.
 *
 * Listele sunt ÎNCHISE, nu validări de formă: numele coloanei ajunge într-un
 * `.order()` și într-un predicat de cursor construit ca text, deci nu poate
 * veni liber din query string. `sortareCeruta` din `lib/queries/cursor.ts` cade
 * tăcut pe implicit pentru orice altceva.
 *
 * Nicio coloană care poate fi NULL nu e sortabilă: valoarea ei ar trebui să
 * intre și în cursorul keyset, unde `null` n-are cum să fie comparat, iar
 * paginarea ar sări rânduri fără nicio eroare. La fel, coloanele „Angajat" nu
 * sunt sortabile: numele vine dintr-o a doua citire (vezi `angajatiDupaId`),
 * nu din tabela listată, deci baza n-are după ce ordona.
 */
export const SORTARI_FISE = ["data", "tip", "rezultat"] as const;
export type SortareFise = (typeof SORTARI_FISE)[number];

export const SORTARI_ACCIDENTE = ["data", "tip"] as const;
export type SortareAccidente = (typeof SORTARI_ACCIDENTE)[number];

export const SORTARI_STINGATOARE = ["cod", "locatie", "stare"] as const;
export type SortareStingatoare = (typeof SORTARI_STINGATOARE)[number];

export const SORTARI_EIP = ["articol", "predat"] as const;
export type SortareEip = (typeof SORTARI_EIP)[number];

/** Forma din URL: `data` crescător, `-data` descrescător. */
const sortOptional = optional(z.string().max(40));

export const filtreFiseSchema = z.object({
  rezultat: optional(z.enum(REZULTATE_EXAMEN)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: sortOptional,
});
export type FiltreFise = z.output<typeof filtreFiseSchema>;

export const filtreAccidenteSchema = z.object({
  tip: optional(z.enum(TIPURI_ACCIDENT)),
  necomunicate: optional(z.enum(["1"])),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: sortOptional,
});
export type FiltreAccidente = z.output<typeof filtreAccidenteSchema>;

export const filtreStingatoareSchema = z.object({
  status: optional(z.enum(STATUS_STINGATOR)),
  cauta: optional(z.string().max(32)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: sortOptional,
});
export type FiltreStingatoare = z.output<typeof filtreStingatoareSchema>;

export const filtreEipSchema = z.object({
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: sortOptional,
});
export type FiltreEip = z.output<typeof filtreEipSchema>;

// ── Intrări de scriere ──────────────────────────────────────────────────────

const textOptional = (maxim: number) =>
  z
    .union([z.string().trim().max(maxim), z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .nullable()
    .default(null);

const uuidOptional = z
  .union([z.uuid(), z.literal(""), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : v))
  .nullable()
  .default(null);

const dataOptionala = z
  .union([z.iso.date(), z.literal(""), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : v))
  .nullable()
  .default(null);

const numarOptional = (min: number, max: number) =>
  z.coerce
    .number()
    .min(min)
    .max(max)
    .nullable()
    .default(null)
    .or(z.literal("").transform(() => null));

/**
 * Înregistrarea în bloc a unei instruiri: un tip, o dată, N angajați.
 *
 * NU conține `urmatoarea_scadenta`: triggerul `internal.ssm_training_calc` o
 * calculează, DOAR când primește `null` — trimisă de client, ar bloca
 * periodicitatea legală configurată în `ssm_training_type_periods`.
 */
export const instruireBlocSchema = z.object({
  training_type_id: z.uuid(),
  data_instruirii: z.iso.date(),
  durata_ore: z.coerce.number().min(0).max(999),
  lector_employee_id: uuidOptional,
  lector_extern: textOptional(120),
  tematica: textOptional(2000),
  materiale: textOptional(500),
  test_punctaj: numarOptional(0, 100),
  observatii: textOptional(1000),
  employee_ids: z.array(z.uuid()).min(1, "Alegeți cel puțin un angajat.").max(200),
});
export type InstruireBloc = z.output<typeof instruireBlocSchema>;

/**
 * Fișa de aptitudine. NU are câmp de diagnostic și NU trimite `observatii` —
 * art. 9 GDPR: se stochează doar rezultatul aptitudinii, niciodată motivul.
 */
export const fisaAptitudineSchema = z.object({
  employee_id: z.uuid(),
  tip: z.enum(TIPURI_EXAMEN),
  data_examinarii: z.iso.date(),
  medic: textOptional(120),
  unitate_medicala: textOptional(160),
  rezultat: z.enum(REZULTATE_EXAMEN),
  valabil_pana: dataOptionala,
  numar_fisa: textOptional(64),
  cost: numarOptional(0, 1_000_000),
});
export type FisaAptitudine = z.output<typeof fisaAptitudineSchema>;

/** NU conține `termen_comunicare_ore`: triggerul îl completează din parametrii legali. */
export const accidentNouSchema = z.object({
  numar_intern: textOptional(64),
  employee_id: uuidOptional,
  data_producerii: z.iso.date(),
  ora_producerii: z
    .union([z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/u), z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .nullable()
    .default(null),
  locul: z.string().trim().min(1, "Locul este obligatoriu.").max(200),
  imprejurari: z.string().trim().min(1, "Împrejurările sunt obligatorii.").max(4000),
  tip: z.enum(TIPURI_ACCIDENT),
  zile_incapacitate: z.coerce.number().int().min(0).max(3650).default(0),
});
export type AccidentNou = z.output<typeof accidentNouSchema>;

export const comunicaItmSchema = z.object({
  id: z.uuid(),
  comunicat_la_itm_la: z.iso.datetime({ local: true }),
  numar_proces_verbal: textOptional(64),
});
export type ComunicaItm = z.output<typeof comunicaItmSchema>;

export const finalizeazaCercetareSchema = z.object({
  id: z.uuid(),
  cercetare_finalizata_la: z.iso.date(),
  urmari: textOptional(2000),
  zile_incapacitate: z.coerce.number().int().min(0).max(3650),
});
export type FinalizeazaCercetare = z.output<typeof finalizeazaCercetareSchema>;

/**
 * Adăugarea UNUI stingător. NU conține cele trei `scadenta_*`: triggerul
 * `internal.ssm_extinguisher_calc` le rescrie integral la fiecare INSERT/UPDATE.
 */
export const stingatorSchema = z.object({
  cod: z.string().trim().min(1, "Codul este obligatoriu.").max(40),
  tip: z.string().trim().min(1, "Tipul este obligatoriu.").max(60),
  masa_kg: numarOptional(0.1, 200),
  cladire: textOptional(120),
  locatie: z.string().trim().min(1, "Locația este obligatorie.").max(200),
  producator: textOptional(120),
  serie: textOptional(64),
  data_punerii_in_functiune: dataOptionala,
  ultima_verificare: dataOptionala,
  ultima_reincarcare: dataOptionala,
  ultima_proba_presiune: dataOptionala,
  status: z.enum(STATUS_STINGATOR).default("activ"),
});
export type StingatorInput = z.output<typeof stingatorSchema>;

export const actualizeazaStingatorSchema = stingatorSchema.extend({ id: z.uuid() });
export type ActualizeazaStingator = z.output<typeof actualizeazaStingatorSchema>;

/**
 * O verificare/reîncărcare/probă de presiune. Se inserează DOAR aici;
 * triggerul `internal.ssm_check_apply` actualizează singur `ultima_*` (și,
 * prin el, scadențele) pe `fire_extinguishers` — fără un al doilea UPDATE.
 */
export const verificareStingatorSchema = z.object({
  extinguisher_id: z.uuid(),
  tip_verificare: z.enum(TIPURI_VERIFICARE_STINGATOR),
  data: z.iso.date(),
  executant: textOptional(120),
  firma_autorizata: textOptional(160),
  rezultat: z.enum(REZULTATE_VERIFICARE_STINGATOR).default("conform"),
  cost: numarOptional(0, 100_000),
  observatii: textOptional(1000),
});
export type VerificareStingator = z.output<typeof verificareStingatorSchema>;

/** NU conține `data_inlocuirii`: triggerul `internal.ssm_ppe_calc` o calculează. */
export const eipSchema = z.object({
  employee_id: z.uuid(),
  articol: z.string().trim().min(1, "Articolul este obligatoriu.").max(160),
  cod_articol: textOptional(64),
  cantitate: z.coerce.number().positive().max(1000).default(1),
  unitate: z.string().trim().min(1).max(20).default("buc"),
  data_predarii: z.iso.date(),
  durata_utilizare_luni: z.coerce
    .number()
    .int()
    .positive()
    .max(240)
    .nullable()
    .default(null)
    .or(z.literal("").transform(() => null)),
  valoare: numarOptional(0, 100_000),
  semnatura_confirmata: z.coerce.boolean().default(false),
});
export type EipInput = z.output<typeof eipSchema>;

export const autorizatieNominalaSchema = z.object({
  employee_id: z.uuid(),
  tip: z.string().trim().min(1, "Tipul autorizației este obligatoriu.").max(80),
  grupa: textOptional(40),
  numar: z.string().trim().min(1, "Numărul autorizației este obligatoriu.").max(64),
  emitent: z.string().trim().min(1, "Emitentul este obligatoriu.").max(160),
  emis_la: dataOptionala,
  valabil_pana: z.iso.date(),
  suspendata_la: dataOptionala,
  observatii: textOptional(1000),
});
export type AutorizatieNominala = z.output<typeof autorizatieNominalaSchema>;
