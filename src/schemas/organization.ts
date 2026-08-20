// src/schemas/organization.ts
// Reguli identice pe client (react-hook-form + zodResolver) și pe server (createPlatformAction).
import { z } from "zod";
import { normalizeazaCui, validateazaCui } from "@/domain/organization/cui";
import { validateazaCnp } from "@/domain/hr/cnp";
import { validateazaIban } from "@/domain/hr/iban";

export const JUDETE = [
  "Alba",
  "Arad",
  "Argeș",
  "Bacău",
  "Bihor",
  "Bistrița-Năsăud",
  "Botoșani",
  "Brăila",
  "Brașov",
  "București",
  "Buzău",
  "Călărași",
  "Caraș-Severin",
  "Cluj",
  "Constanța",
  "Covasna",
  "Dâmbovița",
  "Dolj",
  "Galați",
  "Giurgiu",
  "Gorj",
  "Harghita",
  "Hunedoara",
  "Ialomița",
  "Iași",
  "Ilfov",
  "Maramureș",
  "Mehedinți",
  "Mureș",
  "Neamț",
  "Olt",
  "Prahova",
  "Sălaj",
  "Satu Mare",
  "Sibiu",
  "Suceava",
  "Teleorman",
  "Timiș",
  "Tulcea",
  "Vâlcea",
  "Vaslui",
  "Vrancea",
] as const;

export const FORME_JURIDICE = [
  "SRL",
  "SRL-D",
  "SA",
  "PFA",
  "II",
  "IF",
  "SCS",
  "SNC",
  "ONG",
  "RA",
] as const;
export const PLANURI = ["trial", "starter", "professional", "enterprise"] as const;
export const STATUSURI_ORGANIZATIE = ["pending", "active", "suspended", "archived"] as const;

/** Identificatori care intră în conflict cu rutele aplicației sau cu subdomenii de infrastructură. */
const SLUG_REZERVATE: ReadonlySet<string> = new Set([
  "api",
  "app",
  "www",
  "admin",
  "super-admin",
  "platforma",
  "autentificare",
  "panou",
  "cont",
  "setari",
  "invitatie",
  "alege-organizatia",
  "cere-demo",
  "demo",
  "suport",
  "blog",
  "docs",
  "static",
  "assets",
  "public",
  "next",
  "mail",
  "status",
  "test",
  "nou",
]);

const textOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Textul nu poate depăși ${max} de caractere.`)
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : v));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Identificatorul trebuie să aibă cel puțin 3 caractere.")
  .max(40, "Identificatorul nu poate depăși 40 de caractere.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Folosiți doar litere mici, cifre și cratime (ex. firma-mea).",
  )
  .refine((v) => !SLUG_REZERVATE.has(v), "Acest identificator este rezervat. Alegeți altul.");

export const cuiSchema = z
  .string()
  .trim()
  .superRefine((valoare, ctx) => {
    const rezultat = validateazaCui(valoare);
    if (!rezultat.valid) ctx.addIssue({ code: "custom", message: rezultat.mesaj });
  })
  .transform((valoare) => normalizeazaCui(valoare));

export const emailSchema = z
  .email("Introduceți o adresă de email validă (ex. contact@firma.ro).")
  .trim()
  .toLowerCase()
  .max(160, "Adresa de email este prea lungă.");

const TELEFON_RO = /^(?:\+40|0040|0)[237]\d{8}$/;

export const telefonSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.()\-]/g, ""))
  .refine(
    (v) => TELEFON_RO.test(v),
    "Introduceți un număr de telefon românesc valid (ex. 0721 234 567).",
  );

export const judetSchema = z.enum(JUDETE, "Alegeți județul din listă.");
export const planSchema = z.enum(PLANURI, "Alegeți un plan valid.");
export const statusOrganizatieSchema = z.enum(STATUSURI_ORGANIZATIE);

export const SECTOARE_BUCURESTI = ["1", "2", "3", "4", "5", "6"] as const;
export const FURNIZORI_TICHETE = ["edenred", "pluxee", "up", "sodexo", "altul"] as const;

const opțional = <T extends z.ZodType>(schema: T) =>
  schema.optional().or(z.literal("").transform(() => undefined));

export const capitalSocialSchema = opțional(
  z.coerce
    .number("Capitalul social trebuie să fie o sumă.")
    .min(0, "Capitalul social nu poate fi negativ."),
);

export const codCaenSchema = opțional(
  z
    .string()
    .trim()
    .regex(/^[0-9]{4}$/, "Codul CAEN are 4 cifre (ex. 6201)."),
);

export const sectorSchema = opțional(z.enum(SECTOARE_BUCURESTI, "Alegeți sectorul."));

export const functieReprezentantSchema = textOptional(120);

export const ibanOrganizatieSchema = z
  .string()
  .trim()
  .transform((valoare, ctx) => {
    const rezultat = validateazaIban(valoare);
    if (!rezultat.valid) {
      ctx.addIssue({ code: "custom", message: rezultat.motiv });
      return z.NEVER;
    }
    return rezultat.iban;
  });

export const cnpReprezentantSchema = opțional(
  z
    .string()
    .trim()
    .transform((valoare, ctx) => {
      const rezultat = validateazaCnp(valoare);
      if (!rezultat.valid) {
        ctx.addIssue({ code: "custom", message: rezultat.motiv });
        return z.NEVER;
      }
      return rezultat.cnp;
    }),
);

export const ticheteFurnizorSchema = opțional(z.enum(FURNIZORI_TICHETE));

export const ziuaLuniiSchema = opțional(
  z.coerce.number().int("Ziua trebuie să fie un număr întreg.").min(1).max(31),
);

const zileConcediuImplicitBaza = z.coerce
  .number("Numărul de zile trebuie să fie o cifră.")
  .int()
  .min(0)
  .max(60);

/**
 * Cu `.default(20)` — corect DOAR la înrolare (organizație nouă, fără
 * valoare încă). La editare (`actualizeazaOrganizatieSchema`) folosește
 * `zileConcediuImplicitBaza` prin `opțional(...)`, NU acest export: un
 * `.default()` aplicat de Zod ajunge în `handler` deja substituit — câmpul
 * omis din formular nu mai poate fi distins de „utilizatorul a scris 20”,
 * deci garda `=== undefined ? {} : {...}` de la restul câmpurilor opționale
 * n-ar avea niciun efect (bug confirmat: editarea oricărui alt câmp din
 * fișa organizației reseta tăcut politica de concediu la 20 de zile).
 */
export const zileConcediuImplicitSchema = zileConcediuImplicitBaza.default(20);

export const seatsLimitSchema = z.coerce
  .number("Numărul de locuri trebuie să fie o cifră.")
  .int("Numărul de locuri trebuie să fie un număr întreg.")
  .min(1, "Organizația are nevoie de cel puțin un loc.")
  .max(1000, "Pentru mai mult de 1000 de locuri contactați echipa de vânzări.");

export const creeazaOrganizatieSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.")
    .max(120, "Denumirea este prea lungă."),
  legal_name: textOptional(160),
  forma_juridica: z.enum(FORME_JURIDICE, "Alegeți forma juridică."),
  cui: cuiSchema,
  platitor_tva: z.boolean().default(false),
  reg_com: textOptional(40),
  slug: slugSchema,
  email_contact: emailSchema,
  telefon_contact: telefonSchema,
  judet: judetSchema,
  oras: z
    .string()
    .trim()
    .min(2, "Introduceți localitatea.")
    .max(80, "Localitatea este prea lungă."),
  adresa: textOptional(240),
  cod_postal: textOptional(10),
  website: z
    .url("Introduceți o adresă web validă (ex. https://firma.ro).")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  reprezentant_legal: textOptional(120),
  plan: planSchema,
  seats_limit: seatsLimitSchema,
});

export type CreeazaOrganizatieInput = z.input<typeof creeazaOrganizatieSchema>;
export type CreeazaOrganizatieOutput = z.output<typeof creeazaOrganizatieSchema>;

/**
 * Wizard-ul de înrolare: superset peste `creeazaOrganizatieSchema` — un singur
 * `useForm` pentru toți pașii, validare parțială per pas via `trigger([...])`
 * din react-hook-form. Contul bancar și punctul de lucru sunt UNUL singur aici
 * (nu un array): la înrolare e suficient primul; restul se adaugă ulterior din
 * ecranele dedicate. Un rând se creează doar dacă utilizatorul a completat
 * câmpurile lui — decizia se ia în acțiune, nu în schemă.
 */
export const onboardeazaOrganizatieSchema = creeazaOrganizatieSchema.extend({
  capital_social: capitalSocialSchema,
  cod_caen: codCaenSchema,
  sector: sectorSchema,
  functie_reprezentant_legal: functieReprezentantSchema,
  reprezentant_cnp: cnpReprezentantSchema,

  banca_nume: textOptional(160),
  banca_iban: opțional(ibanOrganizatieSchema),

  plata_avans: z.boolean().default(false),
  ziua_plata_avans: ziuaLuniiSchema,
  ziua_plata_lichidare: ziuaLuniiSchema,
  tichete_furnizor: ticheteFurnizorSchema,

  punct_lucru_denumire: textOptional(160),
  punct_lucru_adresa: textOptional(240),
  punct_lucru_judet: opțional(judetSchema),
  punct_lucru_oras: textOptional(80),
  punct_lucru_cod_postal: textOptional(10),

  zile_concediu_anual_implicit: zileConcediuImplicitSchema,

  ssm_furnizor_extern: textOptional(200),
  ssm_persoana_responsabila: textOptional(160),

  owner_nume: z.string().trim().min(1, "Introduceți numele proprietarului.").max(120),
  owner_prenume: z.string().trim().min(1, "Introduceți prenumele proprietarului.").max(120),
  owner_email: emailSchema,
  owner_telefon: telefonSchema,
});

export type OnboardeazaOrganizatieInput = z.input<typeof onboardeazaOrganizatieSchema>;
export type OnboardeazaOrganizatieOutput = z.output<typeof onboardeazaOrganizatieSchema>;

export const actualizeazaOrganizatieSchema = z.object({
  orgId: z.uuid("Organizație invalidă."),
  name: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(120),
  legal_name: textOptional(160),
  email_contact: emailSchema,
  telefon_contact: telefonSchema,
  judet: judetSchema,
  oras: z.string().trim().min(2, "Introduceți localitatea.").max(80),
  adresa: textOptional(240),
  cod_postal: textOptional(10),
  website: z
    .url("Introduceți o adresă web validă.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  reprezentant_legal: textOptional(120),
  plan: planSchema,
  seats_limit: seatsLimitSchema,
  capital_social: capitalSocialSchema,
  cod_caen: codCaenSchema,
  sector: sectorSchema,
  functie_reprezentant_legal: functieReprezentantSchema,
  ssm_furnizor_extern: textOptional(200),
  ssm_persoana_responsabila: textOptional(160),
  zile_concediu_anual_implicit: opțional(zileConcediuImplicitBaza),
});

export const idOrganizatieSchema = z.object({ orgId: z.uuid("Organizație invalidă.") });

export const suspendaOrganizatieSchema = z.object({
  orgId: z.uuid("Organizație invalidă."),
  motiv: z
    .string()
    .trim()
    .min(10, "Descrieți motivul suspendării în cel puțin 10 caractere.")
    .max(500, "Motivul nu poate depăși 500 de caractere."),
});

export const listaOrganizatiiSchema = z.object({
  cautare: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : v)),
  status: statusOrganizatieSchema.optional(),
  pagina: z.coerce.number().int().min(1).max(500).default(1),
  pePagina: z.coerce.number().int().min(10).max(100).default(20),
});

export type ListaOrganizatiiInput = z.input<typeof listaOrganizatiiSchema>;
