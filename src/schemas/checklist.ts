// src/schemas/checklist.ts
// Validările modulului de onboarding: filtre de listare, intrări ale
// Server Actions și schema conținutului json din dovada de parcurgere.

import { z } from "zod";
import { optional, textOptional } from "./comun";

// ── Enumerări în oglindă cu tipurile din 0014_checklist.sql ──────────────────

export const CHECKLIST_TIP = ["onboarding", "offboarding", "transfer", "altul"] as const;
export type ChecklistTip = (typeof CHECKLIST_TIP)[number];

/**
 * Cine răspunde de un pas.
 *
 * `subiect` (0089) = chiar angajatul pentru care s-a pornit parcursul. Există
 * fiindcă un șablon REUTILIZABIL nu poate ști dinainte pe cine angajezi:
 * `angajat` cere un UUID fix, ales la scrierea șablonului, iar `rol` lasă
 * `responsabil_employee_id` NULL, adică pe nimeni. Se rezolvă într-o persoană
 * la materializare, în `internal.checklist_copiaza_pasii`.
 */
export const CHECKLIST_RESPONSABIL_TIP = ["subiect", "rol", "angajat", "manager_direct"] as const;
export type ChecklistResponsabilTip = (typeof CHECKLIST_RESPONSABIL_TIP)[number];

export const CHECKLIST_TIP_DOVADA = ["niciuna", "bifa", "document", "semnatura"] as const;
export type ChecklistTipDovada = (typeof CHECKLIST_TIP_DOVADA)[number];

export const CHECKLIST_VERIFICARE = [
  "inventar_returnat",
  "acces_revocat",
  "documente_semnate",
  // 0076: pasul se bifează singur când angajatul termină cursul din `curs_id`.
  // Spre deosebire de `acces_revocat` și `documente_semnate` — seedate în enum
  // din 0014 și fără nicio implementare, deci pași imposibil de închis — asta
  // are trigger, index și ecran. Vezi `internal.cursuri_sincronizeaza_checklist`.
  "curs_finalizat",
] as const;
export type ChecklistVerificare = (typeof CHECKLIST_VERIFICARE)[number];

/**
 * Verificările automate care CHIAR au implementare.
 *
 * `acces_revocat` și `documente_semnate` stau în enumul din `0014:19` fără
 * niciun trigger care să le bifeze vreodată. Prin `_automat_ck`, un pas pus pe
 * ele e obligatoriu prin construcție — deci nu se bifează nici automat, nici
 * manual, iar instanța devine imposibil de finalizat.
 *
 * Interfața le arăta `disabled` (`formular-pas.tsx:338`), dar asta e o
 * politețe, nu o poartă: schema accepta enumul ÎNTREG, deci un apel direct la
 * Server Action trecea. Migrarea 0088 le închide și în bază, cu un CHECK.
 */
export const CHECKLIST_VERIFICARE_IMPLEMENTATE = [
  "inventar_returnat",
  "curs_finalizat",
] as const satisfies readonly ChecklistVerificare[];
export type ChecklistVerificareImplementata = (typeof CHECKLIST_VERIFICARE_IMPLEMENTATE)[number];

export const CHECKLIST_INSTANTA_STATUS = ["in_curs", "finalizata", "anulata"] as const;
export type ChecklistInstantaStatus = (typeof CHECKLIST_INSTANTA_STATUS)[number];

export const CHECKLIST_ITEM_STATUS = ["de_facut", "in_lucru", "bifat", "neaplicabil"] as const;
export type ChecklistItemStatus = (typeof CHECKLIST_ITEM_STATUS)[number];

/**
 * Felul unui pas — discriminantul folosit de asistent.
 *
 * În bază e o coloană GENERATĂ (0089), derivată din `tip_dovada` și
 * `verificare_automata` de `app.checklist_fel_derivat`. Nu se scrie niciodată:
 * se alege punând cele două coloane din care se naște. Aici e doar pentru
 * citire și pentru etichete.
 */
export const CHECKLIST_FEL_PAS = [
  "bifa",
  "fisier",
  "semnatura",
  "curs",
  "citire",
  "automat",
] as const;
export type ChecklistFelPas = (typeof CHECKLIST_FEL_PAS)[number];

/**
 * „Pasul e gata” — o singură definiție, pentru toate ecranele și toate cifrele.
 *
 * `neaplicabil` INTRĂ: e o decizie luată, nu o restanță, iar poarta de
 * finalizare din `0014:490` îl tratează exact la fel (`not in ('bifat',
 * 'neaplicabil')`). `in_lucru` NU intră.
 *
 * Există fiindcă existau două definiții care nu se potriveau: `progresInstante`
 * (`queries/checklist.ts:264`) număra `bifat || neaplicabil`, iar ecranul de
 * detaliu din portal număra `!== "de_facut"` — deci un pas „în lucru” apărea
 * gata pe un ecran și restanță pe celălalt, pentru aceeași instanță.
 */
export function pasEsteGata(status: ChecklistItemStatus): boolean {
  return status === "bifat" || status === "neaplicabil";
}

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

/**
 * Coloanele după care listele de checklist se pot sorta.
 *
 * Listele sunt ÎNCHISE, nu validări de formă: numele coloanei ajunge într-un
 * `.order()` și într-un predicat de cursor construit ca text, deci nu poate
 * veni liber din query string. `sortareCeruta` din `lib/queries/cursor.ts` cade
 * tăcut pe implicit pentru orice altceva — un URL copiat greșit nu strică
 * ecranul, doar îl arată sortat implicit.
 */
export const SORTARI_INSTANTE = ["data", "tip", "stare"] as const;
export type SortareInstante = (typeof SORTARI_INSTANTE)[number];

export const SORTARI_SABLOANE = ["denumire", "tip", "valabil"] as const;
export type SortareSabloane = (typeof SORTARI_SABLOANE)[number];

export const filtreInstanteSchema = z.object({
  tip: optional(z.enum(CHECKLIST_TIP)),
  status: listaStatusuriOptionala,
  angajat: optional(z.uuid()),
  de_la: optional(z.iso.date()),
  pana_la: optional(z.iso.date()),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(50).default(25),
  /**
   * Forma din URL: `data` crescător, `-data` descrescător. Rămâne OPȚIONAL și în
   * tipul de ieșire: portalul construiește filtrele în cod, cu obiect literal.
   */
  sort: z.string().max(40).optional(),
});
export type FiltreInstante = z.output<typeof filtreInstanteSchema>;

export const filtreSabloaneSchema = z.object({
  tip: optional(z.enum(CHECKLIST_TIP)),
  cauta: optional(z.string().max(160)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  /** Forma din URL: `denumire` crescător, `-denumire` descrescător. */
  sort: z.string().max(40).optional(),
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
  verificare_automata: optional(z.enum(CHECKLIST_VERIFICARE_IMPLEMENTATE)),
  curs_id: optional(z.uuid()),
  /** Materialul de citit (0093). Cere `obligatoriu` și dovadă „bifă”. */
  material_id: optional(z.uuid()),
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
    curs_id: string | null;
    material_id?: string | null;
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
      valoare.responsabil_employee_id === null) ||
    // `subiect` se rezolvă la materializare, nu în șablon: ambele coloane goale.
    (valoare.responsabil_tip === "subiect" &&
      valoare.responsabil_rol === null &&
      valoare.responsabil_employee_id === null);

  // Oglinda lui `checklist_template_items_material_ck` (0093): un material cere
  // pas obligatoriu, dovadă „bifă” și nicio verificare automată. Fără garda
  // asta, refuzul ar veni ca 23514 brut, fără să spună care câmp e de vină.
  if (valoare.material_id !== null && valoare.material_id !== undefined) {
    if (
      !valoare.obligatoriu ||
      valoare.tip_dovada !== "bifa" ||
      valoare.verificare_automata !== null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["material_id"],
        message:
          "Un pas de citire trebuie să fie obligatoriu, cu dovadă „bifă” și fără verificare automată.",
      });
    }
  }

  if (!combinatieValida) {
    ctx.addIssue({
      code: "custom",
      path: ["responsabil_tip"],
      message:
        "Alegeți un rol pentru tipul «rol», un angajat pentru tipul «angajat», sau lăsați ambele goale pentru «angajatul integrat» și «manager direct».",
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

  /*
   * Oglinda lui `checklist_template_items_curs_ck` (0076). Perechea trebuie să
   * cadă în FORMULAR, nu în bază: un CHECK încălcat iese ca 23514, un cod pe
   * care nu-l poți traduce într-un mesaj pe câmp.
   *
   * Ramura inversă contează la fel de mult: un `curs_id` rămas completat după
   * ce omul schimbă verificarea pe altceva ar fi o legătură care nu declanșează
   * nimic — tipul de defect care se descoperă abia când cineva se întreabă de
   * ce nu s-a bifat pasul.
   */
  if (valoare.verificare_automata === "curs_finalizat" && valoare.curs_id === null) {
    ctx.addIssue({
      code: "custom",
      path: ["curs_id"],
      message: "Alegeți cursul care bifează acest pas.",
    });
  }
  if (valoare.verificare_automata !== "curs_finalizat" && valoare.curs_id !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["curs_id"],
      message: "Cursul se alege doar pentru verificarea «curs finalizat».",
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
  // Cele trei chei de mai jos apar în dovezile scrise DE LA 0089 încolo.
  // Sunt opționale pentru că o dovadă e IMUTABILĂ: cele emise înainte nu le au
  // și nu pot fi rescrise retroactiv — dar trebuie să se deschidă în
  // continuare, altfel `continutDovadaSchema.parse` din pagina de dovadă
  // aruncă pe un document vechi și perfect valid.
  fel: z.enum(CHECKLIST_FEL_PAS).nullish(),
  etapa_titlu: z.string().nullish(),
  etapa_ordine: z.number().nullish(),
});
export type PasDovada = z.output<typeof pasDovadaSchema>;

export const continutDovadaSchema = z.array(pasDovadaSchema);

// ── Salvarea completă a unui șablon (0090) ──────────────────────────────────

/**
 * Un pas, așa cum îl trimite asistentul.
 *
 * `id` prezent ⇒ pasul există și se rescrie; absent ⇒ e nou. Pașii care nu mai
 * apar deloc în încărcătură se șterg LOGIC de `checklist_salveaza_sablon` —
 * instanțele deja pornite își păstrează copia, deci nu se pierde istoric.
 *
 * `fel` NU face parte din încărcătură: e coloană generată în bază (0089),
 * derivată din `tip_dovada` și `verificare_automata`. Asistentul alege un card,
 * iar cardul pune cele două coloane.
 */
export const pasAsistentSchema = pasCampuriSchema
  .extend({ id: optional(z.uuid()) })
  .superRefine(validareResponsabilSiAutomat);
export type PasAsistent = z.output<typeof pasAsistentSchema>;
export type PasAsistentInput = z.input<typeof pasAsistentSchema>;

export const etapaAsistentSchema = z.object({
  id: optional(z.uuid()),
  titlu: z.string().trim().min(2).max(160),
  descriere: optional(z.string().trim().max(2000)),
  // Negativ e cazul principal, nu excepția: „Înainte de prima zi” = -5.
  termen_zile_relativ: z.coerce.number().int().min(-365).max(365).default(0),
  pasi: z.array(pasAsistentSchema).max(200),
});
export type EtapaAsistent = z.output<typeof etapaAsistentSchema>;
export type EtapaAsistentInput = z.input<typeof etapaAsistentSchema>;

export const salveazaSablonSchema = sablonCampuriSchema
  .extend({
    id: optional(z.uuid()),
    // Cel mult 100 de etape: oglinda lui `checklist_template_stages_ordine_ck`.
    etape: z.array(etapaAsistentSchema).max(100).default([]),
    // Pașii unui șablon scris înainte de etape. Asistentul îi arată într-o
    // secțiune „Fără etapă” și îi poate lăsa acolo.
    pasi_fara_etapa: z.array(pasAsistentSchema).max(200).default([]),
  })
  .superRefine(validareValabilitate)
  .superRefine((valoare, ctx) => {
    const total =
      valoare.etape.reduce((suma, e) => suma + e.pasi.length, 0) + valoare.pasi_fara_etapa.length;
    // Oglinda porții din 0088: un șablon fără pași produce o instanță care se
    // finalizează singură și emite o dovadă care nu atestă nimic. Baza o
    // refuză oricum; aici mesajul ajunge pe ecran, nu ca P0001 tradus.
    if (total === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["etape"],
        message: "Un șablon fără niciun pas nu poate fi pornit. Adăugați cel puțin un pas.",
      });
    }
    if (total > 500) {
      ctx.addIssue({
        code: "custom",
        path: ["etape"],
        message: "Un șablon poate avea cel mult 500 de pași.",
      });
    }
  });
export type SalveazaSablonInput = z.input<typeof salveazaSablonSchema>;
export type SalveazaSablon = z.output<typeof salveazaSablonSchema>;

// ── Dovada-fișier (0092) ────────────────────────────────────────────────────

export const pregatesteIncarcareDovadaSchema = z.object({
  /** Pasul de instanță pe care se atașează dovada. */
  id: z.uuid(),
  nume_fisier: z.string().trim().min(1).max(200),
});

export const salveazaDovadaSchema = z.object({
  id: z.uuid(),
  /** Calea semnată la pasul anterior. Se re-verifică pe server, nu se crede. */
  cale: z.string().trim().min(1).max(512),
  nume: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(160),
  marime_bytes: z.coerce.number().int().min(1).max(26214400),
});

export const stergeDovadaSchema = z.object({ id: z.uuid() });
export const linkDovadaSchema = z.object({ id: z.uuid() });

export const confirmaCitireSchema = z.object({
  /** Pasul de instanță al cărui material a fost parcurs. */
  id: z.uuid(),
});
