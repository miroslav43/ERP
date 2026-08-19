// src/schemas/organization.ts
// Reguli identice pe client (react-hook-form + zodResolver) și pe server (createPlatformAction).
import { z } from "zod";
import { normalizeazaCui, validateazaCui } from "@/domain/organization/cui";
import { valideazaCnp } from "@/domain/employee/cnp";

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

export const codCaenSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{4}$/, "Codul CAEN are exact 4 cifre (ex. 6201).")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const capitalSocialSchema = z.coerce
  .number("Capitalul social trebuie să fie o sumă.")
  .min(0, "Capitalul social nu poate fi negativ.")
  .max(999_999_999.99, "Valoarea depășește limita acceptată.");

export const cnpReprezentantSchema = z
  .string()
  .trim()
  .optional()
  // La fel ca `textOptional`: golul devine `undefined` DUPĂ parsare, nu prin
  // `.or(z.literal(""))` — acel combinator nu s-ar atinge niciodată aici,
  // pentru că un `z.string().optional()` fără altă constrângere acceptă deja
  // "" ca șir valid, deci a doua ramură a uniunii n-ar mai fi încercată.
  .transform((v) => (v === undefined || v === "" ? undefined : v))
  .refine((v) => v === undefined || valideazaCnp(v).valid, {
    error: "CNP-ul reprezentantului nu este valid.",
  });

export const judetSchema = z.enum(JUDETE, "Alegeți județul din listă.");
export const planSchema = z.enum(PLANURI, "Alegeți un plan valid.");
export const statusOrganizatieSchema = z.enum(STATUSURI_ORGANIZATIE);

export const seatsLimitSchema = z.coerce
  .number("Numărul de locuri trebuie să fie o cifră.")
  .int("Numărul de locuri trebuie să fie un număr întreg.")
  .min(1, "Organizația are nevoie de cel puțin un loc.")
  .max(1000, "Pentru mai mult de 1000 de locuri contactați echipa de vânzări.");

export const inroleazaOrganizatieSchema = z
  .object({
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
    cod_caen: codCaenSchema,
    capital_social: capitalSocialSchema,
    slug: slugSchema,
    email_contact: emailSchema,
    telefon_contact: telefonSchema,
    judet: judetSchema,
    oras: z.string().trim().min(2, "Introduceți localitatea.").max(80, "Localitatea este prea lungă."),
    strada: z.string().trim().min(2, "Introduceți strada.").max(160, "Numele străzii este prea lung."),
    numar: z.string().trim().min(1, "Introduceți numărul.").max(20, "Numărul este prea lung."),
    sector: textOptional(20),
    adresa: textOptional(240),
    cod_postal: textOptional(10),
    website: z
      .url("Introduceți o adresă web validă (ex. https://firma.ro).")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    reprezentant_legal: textOptional(120),
    reprezentant_functie: z
      .string()
      .trim()
      .min(2, "Introduceți funcția reprezentantului.")
      .max(80, "Funcția este prea lungă."),
    reprezentant_cnp: cnpReprezentantSchema,
    plan: planSchema,
    seats_limit: seatsLimitSchema,
    owner_nume: z
      .string()
      .trim()
      .min(2, "Introduceți numele complet al proprietarului.")
      .max(160, "Numele este prea lung."),
    owner_email: emailSchema,
    owner_telefon: telefonSchema,
  })
  .superRefine((valori, ctx) => {
    if (valori.judet === "București" && (valori.sector === undefined || valori.sector.trim() === "")) {
      ctx.addIssue({
        code: "custom",
        path: ["sector"],
        message: "Sectorul este obligatoriu pentru sediile din București.",
      });
    }
  });

export type InroleazaOrganizatieInput = z.input<typeof inroleazaOrganizatieSchema>;
export type InroleazaOrganizatieOutput = z.output<typeof inroleazaOrganizatieSchema>;

export const cautaCuiAnafSchema = z.object({ cui: cuiSchema });
export type CautaCuiAnafInput = z.input<typeof cautaCuiAnafSchema>;

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
