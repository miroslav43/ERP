// src/schemas/employee.ts
// Validările de intrare pentru angajați, contracte și încetare. CNP/IBAN vin din @/domain/hr.

import { z } from "zod";

import { normalizeazaCnp, validateazaCnp } from "@/domain/hr/cnp";
import { normalizeazaIban, validateazaIban } from "@/domain/hr/iban";

export const STATUSURI_ANGAJAT = [
  "candidat",
  "activ",
  "suspendat",
  "preaviz",
  "incetat",
  "arhivat",
] as const;
export const GENURI = ["masculin", "feminin", "nedeclarat"] as const;
export const CONDITII_MUNCA = ["normale", "deosebite", "speciale"] as const;
export const DURATE_CONTRACT = ["nedeterminat", "determinat"] as const;
export const MODURI_LUCRU = ["sediu", "telemunca", "domiciliu", "mixt"] as const;
export const REGIMURI_SPECIALE = ["ucenicie", "internship", "zilier"] as const;

export type StatusAngajat = (typeof STATUSURI_ANGAJAT)[number];

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;

/** Text opțional: cheia rămâne mereu prezentă (null), ca să nu lovim exactOptionalPropertyTypes. */
const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

const textObligatoriu = (minim: number, maxim: number, camp: string) =>
  z
    .string()
    .trim()
    .min(minim, `Câmpul „${camp}” este obligatoriu.`)
    .max(maxim, `Câmpul „${camp}” nu poate depăși ${String(maxim)} de caractere.`);

const dataOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || RE_DATA.test(valoare),
    "Data trebuie scrisă în formatul AAAA-LL-ZZ.",
  );

const dataObligatorie = (camp: string) =>
  z.string().trim().regex(RE_DATA, `Câmpul „${camp}” trebuie completat în formatul AAAA-LL-ZZ.`);

const uuidOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || z.uuid().safeParse(valoare).success,
    "Identificatorul selectat nu este valid.",
  );

const numarOptional = (minim: number, maxim: number) =>
  z
    .union([z.coerce.number(), z.null()])
    .default(null)
    .refine(
      (valoare) =>
        valoare === null || (Number.isFinite(valoare) && valoare >= minim && valoare <= maxim),
      `Valoarea trebuie să fie între ${String(minim)} și ${String(maxim)}.`,
    );

const cnpOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) =>
    valoare === null || valoare.length === 0 ? null : normalizeazaCnp(valoare),
  )
  .refine(
    (valoare) => valoare === null || validateazaCnp(valoare).valid,
    "CNP-ul introdus nu este valid.",
  );

const ibanOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) =>
    valoare === null || valoare.length === 0 ? null : normalizeazaIban(valoare),
  )
  .refine(
    (valoare) => valoare === null || validateazaIban(valoare).valid,
    "IBAN-ul introdus nu este valid.",
  );

// ── Filtre de listare (paginare keyset) ───────────────────────────────────────

export const filtreAngajatiSchema = z.object({
  q: textOptional(80),
  department_id: uuidOptional,
  job_position_id: uuidOptional,
  status: z.enum(STATUSURI_ANGAJAT).nullable().default(null),
  cursor: textOptional(400),
  limita: z.coerce.number().int().min(5).max(100).default(25),
});

export type FiltreAngajati = z.infer<typeof filtreAngajatiSchema>;

// ── Angajat ───────────────────────────────────────────────────────────────────

export const creeazaAngajatSchema = z.object({
  marca: textObligatoriu(1, 32, "Marcă"),
  last_name: textObligatoriu(1, 80, "Nume"),
  first_name: textObligatoriu(1, 80, "Prenume"),
  email_personal: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
    .refine(
      (valoare) => valoare === null || z.email().safeParse(valoare).success,
      "Adresa de e-mail nu este validă.",
    ),
  telefon: textOptional(32),
  adresa_strada: textOptional(200),
  adresa_oras: textOptional(120),
  adresa_judet: textOptional(80),
  adresa_cod_postal: textOptional(12),
  data_nasterii: dataOptionala,
  gen: z.enum(GENURI).default("nedeclarat"),
  cetatenie: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/u, "Cetățenia se completează cu codul de țară din două litere (ex. RO).")
    .default("RO"),
  tip_act_identitate: textOptional(40),
  serie_act: textOptional(10),
  numar_act: textOptional(20),
  act_valabil_pana: dataOptionala,
  department_id: uuidOptional,
  job_position_id: uuidOptional,
  manager_employee_id: uuidOptional,
  hired_on: dataOptionala,
  conditii_munca: z.enum(CONDITII_MUNCA).default("normale"),
  grad_handicap: textOptional(20),
  nr_persoane_intretinere: z.coerce.number().int().min(0).max(20).default(0),
  optiune_pilon_ii: z.coerce.boolean().default(true),
  is_primary: z.coerce.boolean().default(true),
  contact_urgenta_nume: textOptional(120),
  contact_urgenta_telefon: textOptional(32),
  contact_urgenta_relatie: textOptional(60),
  observatii: textOptional(2000),
  cnp: cnpOptional,
  iban: ibanOptional,
  banca: textOptional(80),
});

export type CreeazaAngajatInput = z.infer<typeof creeazaAngajatSchema>;

/**
 * `.pick()`, NU `.omit()`: formularul de editare atinge doar aceste 12 câmpuri.
 * Un `creeazaAngajatSchema.omit({...})` ar fi moștenit implicit orice câmp
 * viitor adăugat acolo (inclusiv unele cu `.default(...)`) — exact mecanismul
 * care a provocat bug-ul găsit aici: `manager_employee_id` (și, la fel,
 * `cetatenie`, `conditii_munca`, `nr_persoane_intretinere`, `optiune_pilon_ii`,
 * adresa/actul de identitate, contactul de urgență, observațiile) erau
 * ABSENTE din payload-ul trimis de client, Zod le aplica `.default(...)` la
 * parsare, iar handler-ul le trimitea mai departe la `.update(...)` — deci
 * FIECARE salvare din acest formular reseta silențios acele câmpuri, chiar și
 * când angajatul modifica doar telefonul. `.pick()` e sigur implicit: un câmp
 * nou adăugat la `creeazaAngajatSchema` NU ajunge aici decât dacă e listat
 * explicit, deci formularul trebuie extins înainte ca schema să-l accepte.
 */
export const actualizeazaAngajatSchema = creeazaAngajatSchema
  .pick({
    last_name: true,
    first_name: true,
    email_personal: true,
    telefon: true,
    data_nasterii: true,
    gen: true,
    department_id: true,
    job_position_id: true,
    hired_on: true,
    cnp: true,
    iban: true,
    banca: true,
  })
  .extend({ id: z.uuid("Angajatul selectat nu este valid.") });

// ── Contract ──────────────────────────────────────────────────────────────────

export const creeazaContractSchema = z
  .object({
    employee_id: z.uuid("Angajatul selectat nu este valid."),
    parent_contract_id: uuidOptional,
    este_act_aditional: z.coerce.boolean().default(false),
    numar: textObligatoriu(1, 40, "Număr contract"),
    data_contract: dataObligatorie("Data contractului"),
    valabil_de_la: dataObligatorie("Valabil de la"),
    valabil_pana: dataOptionala,
    contract_duration: z.enum(DURATE_CONTRACT).default("nedeterminat"),
    motiv_determinat: textOptional(200),
    norma_ore_saptamana: z.coerce.number().min(0.5).max(48).default(40),
    norma_ore_zi: z.coerce.number().min(0.5).max(12).default(8),
    work_mode: z.enum(MODURI_LUCRU).default("sediu"),
    special_regime: z.enum(REGIMURI_SPECIALE).nullable().default(null),
    loc_telemunca: textOptional(200),
    loc_munca: textOptional(200),
    department_id: uuidOptional,
    job_position_id: uuidOptional,
    conditii_munca: z.enum(CONDITII_MUNCA).default("normale"),
    salariu_baza: z.coerce.number().min(0, "Salariul de bază nu poate fi negativ."),
    moneda: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/u, "Moneda se scrie cu trei litere (ex. RON).")
      .default("RON"),
    zile_concediu_anual: z.coerce.number().int().min(0).max(60).default(21),
    perioada_proba_zile: numarOptional(0, 365),
    preaviz_zile: numarOptional(0, 365),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.contract_duration === "determinat" && valoare.valabil_pana === null) {
      ctx.addIssue({
        code: "custom",
        path: ["valabil_pana"],
        message: "Un contract pe durată determinată are nevoie de dată de sfârșit.",
      });
    }
    if (valoare.valabil_pana !== null && valoare.valabil_pana < valoare.valabil_de_la) {
      ctx.addIssue({
        code: "custom",
        path: ["valabil_pana"],
        message: "Data de sfârșit nu poate fi anterioară datei de început.",
      });
    }
    if (
      (valoare.work_mode === "telemunca" || valoare.work_mode === "domiciliu") &&
      valoare.loc_telemunca === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["loc_telemunca"],
        message:
          "Pentru telemuncă sau muncă la domiciliu, locul desfășurării activității este obligatoriu.",
      });
    }
    if (valoare.este_act_aditional && valoare.parent_contract_id === null) {
      ctx.addIssue({
        code: "custom",
        path: ["parent_contract_id"],
        message: "Un act adițional trebuie legat de contractul de bază.",
      });
    }
  });

export const incetareContractSchema = z.object({
  contract_id: z.uuid("Contractul selectat nu este valid."),
  incetat_la: dataObligatorie("Data încetării"),
  temei_incetare: textObligatoriu(2, 120, "Temei legal"),
  motiv_incetare: textObligatoriu(3, 500, "Motivul încetării"),
  arhiveaza_fisa: z.coerce.boolean().default(false),
});

export const modificaSalariuContractSchema = z.object({
  contract_id: z.uuid("Contractul selectat nu este valid."),
  salariu_baza: z.coerce.number().min(0, "Salariul de bază nu poate fi negativ."),
});

// ── Dezvăluirea datelor sensibile ─────────────────────────────────────────────

export const dezvaluieDateSensibileSchema = z.object({
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  camp: z.enum(["cnp", "iban"]),
  motiv: textObligatoriu(5, 200, "Motivul consultării"),
});
