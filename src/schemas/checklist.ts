// src/schemas/checklist.ts
// Validările modulului de onboarding: filtre de listare, intrări ale
// Server Actions și schema conținutului json din dovada de parcurgere.

import { z } from "zod";

// ── Enumerări în oglindă cu tipurile din 0014_checklist.sql ──────────────────

export const CHECKLIST_TIP = ["onboarding", "offboarding", "transfer", "altul"] as const;
export type ChecklistTip = (typeof CHECKLIST_TIP)[number];

export const CHECKLIST_RESPONSABIL_TIP = ["rol", "angajat", "manager_direct"] as const;
export type ChecklistResponsabilTip = (typeof CHECKLIST_RESPONSABIL_TIP)[number];

export const CHECKLIST_TIP_DOVADA = ["niciuna", "bifa", "document", "semnatura"] as const;
export type ChecklistTipDovada = (typeof CHECKLIST_TIP_DOVADA)[number];

export const CHECKLIST_VERIFICARE = [
  "inventar_returnat",
  "acces_revocat",
  "documente_semnate",
] as const;
export type ChecklistVerificare = (typeof CHECKLIST_VERIFICARE)[number];

export const CHECKLIST_INSTANTA_STATUS = ["in_curs", "finalizata", "anulata"] as const;
export type ChecklistInstantaStatus = (typeof CHECKLIST_INSTANTA_STATUS)[number];

export const CHECKLIST_ITEM_STATUS = ["de_facut", "in_lucru", "bifat", "neaplicabil"] as const;
export type ChecklistItemStatus = (typeof CHECKLIST_ITEM_STATUS)[number];

/**
 * Copie locală a `public.app_role`, nu un import din `@/lib/tenant/types`.
 *
 * `formular-pas.tsx` (client) are nevoie de listă pentru selectorul de rol
 * responsabil. O componentă client nu poate importa `@/lib/tenant` — trage
 * după el `server-only`. Fișierele din `src/schemas` sunt granița sigură,
 * exact ca `schemas/fleet.ts`, care copiază la fel enumerările din SQL.
 */
export const ROLURI_RESPONSABIL = [
  "super_admin",
  "org_admin",
  "manager",
  "hr",
  "employee",
] as const;
export type RolResponsabil = (typeof ROLURI_RESPONSABIL)[number];

// ── Helpere de câmp ────────────────────────────────────────────────────────

/**
 * Fiecare câmp opțional de filtru are `.default(...)`.
 *
 * `filtreDinUrl()` revine la `schema.safeParse({})` când query string-ul e
 * nevalid; fără valori implicite peste tot, revenirea ar eșua și ea.
 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z
    .union([schema, z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .default(null as never);

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v));

const listaStatusuriOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((v) => {
    if (v === null || v.length === 0) return null;
    const bucati = v
      .split(",")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
    return bucati.length === 0 ? null : bucati;
  })
  .pipe(z.array(z.enum(CHECKLIST_INSTANTA_STATUS)).nullable());

// ── Filtre de listare (paginare keyset) ───────────────────────────────────────

export const filtreInstanteSchema = z.object({
  tip: optional(z.enum(CHECKLIST_TIP)),
  status: listaStatusuriOptionala,
  angajat: optional(z.uuid()),
  de_la: optional(z.iso.date()),
  pana_la: optional(z.iso.date()),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(50).default(25),
});
export type FiltreInstante = z.output<typeof filtreInstanteSchema>;

export const filtreSabloaneSchema = z.object({
  tip: optional(z.enum(CHECKLIST_TIP)),
  cauta: optional(z.string().max(160)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
});
export type FiltreSabloane = z.output<typeof filtreSabloaneSchema>;

// ── Instanțe ───────────────────────────────────────────────────────────────

export const pornesteInstantaSchema = z.object({
  template_id: z.uuid("Șablonul selectat nu este valid."),
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  data_referinta: z.iso.date("Data de referință trebuie completată."),
  observatii: textOptional(2000),
});
export type PornesteInstantaInput = z.output<typeof pornesteInstantaSchema>;

export const bifeazaPasSchema = z.object({
  id: z.uuid(),
  status: z.enum(["de_facut", "in_lucru", "bifat", "neaplicabil"]),
  dovada: textOptional(2000),
  dovada_document_id: optional(z.uuid()),
  observatii: textOptional(1000),
});
export type BifeazaPasInput = z.output<typeof bifeazaPasSchema>;

export const finalizeazaInstantaSchema = z.object({
  id: z.uuid(),
});

export const anuleazaInstantaSchema = z.object({
  id: z.uuid(),
  motiv_anulare: z
    .string()
    .trim()
    .min(5, "Motivul anulării trebuie să aibă cel puțin 5 caractere.")
    .max(500),
});

// ── Șabloane ───────────────────────────────────────────────────────────────

const sablonCampuriSchema = z.object({
  denumire: z.string().trim().min(2).max(160),
  tip: z.enum(CHECKLIST_TIP),
  descriere: textOptional(2000),
  department_id: optional(z.uuid()),
  job_position_id: optional(z.uuid()),
  activ: z.coerce.boolean().default(true),
  // Necesar, nu opțional: coloana e `not null` fără implicit acceptabil din
  // client — vezi nota din `noua/formular-sablon.tsx`. Formularul îl
  // prepopulează cu ziua curentă.
  valabil_de_la: z.iso.date("Data de început a valabilității trebuie completată."),
  valabil_pana_la: optional(z.iso.date()),
});

/** Oglindă a `checklist_templates_valabilitate_ck`: sfârșitul e strict după început. */
function validareValabilitate(
  valoare: Readonly<{ valabil_de_la: string; valabil_pana_la: string | null }>,
  ctx: z.RefinementCtx,
): void {
  if (valoare.valabil_pana_la !== null && valoare.valabil_pana_la <= valoare.valabil_de_la) {
    ctx.addIssue({
      code: "custom",
      path: ["valabil_pana_la"],
      message: "Data de sfârșit a valabilității trebuie să fie după data de început.",
    });
  }
}

export const creeazaSablonSchema = sablonCampuriSchema.superRefine(validareValabilitate);
export type CreeazaSablonInput = z.output<typeof creeazaSablonSchema>;

export const actualizeazaSablonSchema = sablonCampuriSchema
  .extend({ id: z.uuid() })
  .superRefine(validareValabilitate);
export type ActualizeazaSablonInput = z.output<typeof actualizeazaSablonSchema>;

// ── Pașii șablonului ───────────────────────────────────────────────────────

const pasCampuriSchema = z.object({
  titlu: z.string().trim().min(2).max(200),
  descriere: textOptional(2000),
  responsabil_tip: z.enum(CHECKLIST_RESPONSABIL_TIP).default("rol"),
  responsabil_rol: optional(z.enum(ROLURI_RESPONSABIL)),
  responsabil_employee_id: optional(z.uuid()),
  // Poate fi negativ: laptopul se pregătește ÎNAINTE de prima zi.
  termen_zile_relativ: z.coerce.number().int().min(-365).max(365).default(0),
  obligatoriu: z.coerce.boolean().default(true),
  tip_dovada: z.enum(CHECKLIST_TIP_DOVADA).default("bifa"),
  verificare_automata: optional(z.enum(CHECKLIST_VERIFICARE)),
});

/**
 * Oglindă a două CHECK-uri din `checklist_template_items`:
 *  - `..._responsabil_ck` — combinația responsabil_tip / rol / angajat.
 *  - `..._automat_ck` — verificarea automată cere obligatoriu + dovadă „bifă”.
 */
function validareResponsabilSiAutomat(
  valoare: Readonly<{
    responsabil_tip: ChecklistResponsabilTip;
    responsabil_rol: RolResponsabil | null;
    responsabil_employee_id: string | null;
    obligatoriu: boolean;
    tip_dovada: ChecklistTipDovada;
    verificare_automata: ChecklistVerificare | null;
  }>,
  ctx: z.RefinementCtx,
): void {
  const combinatieValida =
    (valoare.responsabil_tip === "rol" &&
      valoare.responsabil_rol !== null &&
      valoare.responsabil_employee_id === null) ||
    (valoare.responsabil_tip === "angajat" &&
      valoare.responsabil_employee_id !== null &&
      valoare.responsabil_rol === null) ||
    (valoare.responsabil_tip === "manager_direct" &&
      valoare.responsabil_rol === null &&
      valoare.responsabil_employee_id === null);

  if (!combinatieValida) {
    ctx.addIssue({
      code: "custom",
      path: ["responsabil_tip"],
      message:
        "Alegeți un rol pentru tipul «rol», un angajat pentru tipul «angajat», sau lăsați ambele goale pentru «manager direct».",
    });
  }

  if (
    valoare.verificare_automata !== null &&
    !(valoare.obligatoriu && valoare.tip_dovada === "bifa")
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["verificare_automata"],
      message:
        "Un pas cu verificare automată trebuie să fie obligatoriu și cu dovadă de tip «bifă».",
    });
  }
}

export const adaugaPasSchema = pasCampuriSchema
  .extend({ template_id: z.uuid() })
  .superRefine(validareResponsabilSiAutomat);
export type AdaugaPasInput = z.output<typeof adaugaPasSchema>;

export const actualizeazaPasSchema = pasCampuriSchema
  .extend({ id: z.uuid() })
  .superRefine(validareResponsabilSiAutomat);
export type ActualizeazaPasInput = z.output<typeof actualizeazaPasSchema>;

export const mutaPasSchema = z.object({
  id: z.uuid(),
  directie: z.enum(["sus", "jos"]),
});

export const stergePasSchema = z.object({
  id: z.uuid(),
});

// ── Dovada de parcurgere (conținutul jsonb, validat la graniță) ─────────────

export const pasDovadaSchema = z.object({
  ordine: z.number(),
  titlu: z.string(),
  obligatoriu: z.boolean(),
  status: z.enum(CHECKLIST_ITEM_STATUS),
  tip_dovada: z.enum(CHECKLIST_TIP_DOVADA),
  verificare_automata: z.enum(CHECKLIST_VERIFICARE).nullable(),
  dovada: z.string().nullable(),
  dovada_document_id: z.string().nullable(),
  bifat_de: z.string().nullable(),
  bifat_la: z.string().nullable(),
  bifat_automat: z.boolean(),
  observatii: z.string().nullable(),
});
export type PasDovada = z.output<typeof pasDovadaSchema>;

export const continutDovadaSchema = z.array(pasDovadaSchema);
