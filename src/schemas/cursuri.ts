// src/schemas/cursuri.ts
// Validările modulului de cursuri: filtre de listare, intrări ale Server
// Actions și oglinda în cod a CHECK-urilor din 0075_cursuri.sql.
//
// Regula pe care o respectă fiecare `superRefine` de aici: dacă baza refuză o
// combinație, formularul trebuie s-o refuze ÎNAINTE, cu mesaj pe câmp. O eroare
// P0001 ajunsă în interfață e o poartă lipsă, nu o validare.

import { z } from "zod";
import { optional, textOptional } from "./comun";

import { FURNIZORI_LINK } from "@/lib/media/link-extern";

// ── Enumerări în oglindă cu tipurile din 0075_cursuri.sql ───────────────────

export const CURS_MATERIAL_FEL = ["pdf", "video"] as const;
export type CursMaterialFel = (typeof CURS_MATERIAL_FEL)[number];

export const CURS_MATERIAL_SURSA = ["fisier", "link"] as const;
export type CursMaterialSursa = (typeof CURS_MATERIAL_SURSA)[number];

/**
 * Enum-ul din bază are patru valori; `test` NU se oferă încă în interfață,
 * pentru că ecranele testului grilă nu există. Un material salvat cu treapta
 * `test` ar fi imposibil de închis de angajat — exact tiparul `acces_revocat`
 * din 0014, unde o valoare fără implementare blochează parcursul.
 * Când testul ajunge, valoarea se mută aici și enum-ul din bază rămâne neatins.
 */
/** TOATE valorile din `public.curs_treapta_dovada`. Ce poate întoarce baza. */
export const CURS_TREAPTA_DOVADA_TOATE = ["bifa", "parcurgere", "test", "declaratie"] as const;
export type CursTreaptaDovada = (typeof CURS_TREAPTA_DOVADA_TOATE)[number];

/**
 * Ce se poate ALEGE în formular. A fost o submulțime strictă cât timp testul
 * grilă n-avea ecrane: un material salvat cu treapta `test` ar fi fost imposibil
 * de închis de angajat. De la 0077, toate patru sunt reale.
 */
export const CURS_TREAPTA_DOVADA = [
  "bifa",
  "parcurgere",
  "test",
  "declaratie",
] as const satisfies readonly CursTreaptaDovada[];
export type CursTreaptaOferita = (typeof CURS_TREAPTA_DOVADA)[number];

export const CURS_STATUS = ["neinceput", "in_curs", "finalizat", "expirat", "anulat"] as const;
export type CursStatus = (typeof CURS_STATUS)[number];

export const CURS_ITEM_STATUS = ["neinceput", "in_curs", "finalizat"] as const;
export type CursItemStatus = (typeof CURS_ITEM_STATUS)[number];

export const CURS_CRITERIU = ["toti", "departament", "functie", "rol", "angajat"] as const;
export type CursCriteriu = (typeof CURS_CRITERIU)[number];

export const CURS_MOTIV = ["manual", "regula", "recertificare"] as const;
export type CursMotiv = (typeof CURS_MOTIV)[number];

// ── Ajutoare, aceleași ca în `schemas/checklist.ts` ─────────────────────────

const cod = z
  .string()
  .trim()
  .min(2, "Codul are cel puțin 2 caractere.")
  .max(40, "Codul are cel mult 40 de caractere.")
  .regex(/^[a-z][a-z0-9_]*$/, "Codul poate conține doar litere mici, cifre și liniuță jos.");

// ── Filtre de listare ──────────────────────────────────────────────────────

export const SORTARI_CURSURI = ["denumire", "cod", "creat"] as const;
export type SortareCursuri = (typeof SORTARI_CURSURI)[number];

export const SORTARI_MATERIALE = ["titlu", "cod", "fel"] as const;
export type SortareMateriale = (typeof SORTARI_MATERIALE)[number];

export const SORTARI_INROLARI = ["termen", "stare", "angajat"] as const;
export type SortareInrolari = (typeof SORTARI_INROLARI)[number];

export const filtreCursuriSchema = z.object({
  cauta: optional(z.string().max(160)),
  doar_publicate: optional(z.enum(["da", "nu"])),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: z.string().max(40).optional(),
});
export type FiltreCursuri = z.output<typeof filtreCursuriSchema>;

export const filtreMaterialeSchema = z.object({
  cauta: optional(z.string().max(160)),
  fel: optional(z.enum(CURS_MATERIAL_FEL)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: z.string().max(40).optional(),
});
export type FiltreMateriale = z.output<typeof filtreMaterialeSchema>;

export const filtreInrolariSchema = z.object({
  status: optional(z.enum(CURS_STATUS)),
  angajat: optional(z.uuid()),
  curs: optional(z.uuid()),
  doar_restante: optional(z.enum(["da", "nu"])),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(50).default(25),
  sort: z.string().max(40).optional(),
});
export type FiltreInrolari = z.output<typeof filtreInrolariSchema>;

// ── Cursuri ────────────────────────────────────────────────────────────────

const campuriCurs = {
  cod,
  denumire: z
    .string()
    .trim()
    .min(2, "Denumirea are cel puțin 2 caractere.")
    .max(160, "Denumirea are cel mult 160 de caractere."),
  descriere: textOptional(2000),
  obligatoriu: z.coerce.boolean().default(true),
  valabilitate_luni: optional(
    z.coerce
      .number()
      .int()
      .min(1, "Valabilitatea are cel puțin o lună.")
      .max(120, "Valabilitatea are cel mult 120 de luni."),
  ),
  /*
   * Gol = FĂRĂ TERMEN. `FormData.get()` pe un câmp randat dar golit întoarce
   * șirul gol, niciodată `null`, iar `.default(30)` se aplică doar peste
   * `undefined` — de aceea vechea formă refuza exact gestul pe care textul de
   * ajutor de pe ecran îl recomanda. `courses.termen_zile` acceptă NULL de la
   * migrarea 0085.
   */
  termen_zile: optional(
    z.coerce
      .number()
      .int()
      .min(1, "Termenul are cel puțin o zi.")
      .max(365, "Termenul are cel mult 365 de zile."),
  ),
  /*
   * Preavizul, în schimb, rămâne `not null` în bază: e o preferință de afișare,
   * nu o proprietate a cursului. Golit, revine la 30 — dar prin `optional()`,
   * nu prin `.default()`, ca șirul gol să nu mai ajungă la coerciție.
   */
  prag_avertizare_zile: optional(
    z.coerce
      .number()
      .int()
      .min(1, "Preavizul are cel puțin o zi.")
      .max(180, "Preavizul are cel mult 180 de zile."),
  ).transform((v) => v ?? 30),
};

export const creeazaCursSchema = z.object(campuriCurs);
export type CreeazaCursInput = z.output<typeof creeazaCursSchema>;

export const actualizeazaCursSchema = z.object({ id: z.uuid(), ...campuriCurs });
export type ActualizeazaCursInput = z.output<typeof actualizeazaCursSchema>;

export const publicaCursSchema = z.object({
  id: z.uuid(),
  publicat: z.coerce.boolean(),
});

export const dezactiveazaCursSchema = z.object({ id: z.uuid(), activ: z.coerce.boolean() });

// ── Materiale ──────────────────────────────────────────────────────────────

/**
 * Oglinda lui `course_materials_treapta_ck`, `_link_ck`, `_parcurgere_ck` și
 * `_pdf_ck`. Fiecare ramură e o combinație pe care baza o refuză cu 23514, un
 * cod pe care nu-l poți traduce într-un mesaj de câmp — de aceea se prinde aici.
 */
function validareMaterial(
  v: {
    fel: CursMaterialFel;
    sursa: CursMaterialSursa;
    treapta_dovada: CursTreaptaOferita;
    procent_minim: number | null;
    prag_test: number | null;
    declaratie_text: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (v.fel === "pdf" && v.sursa === "link") {
    ctx.addIssue({
      code: "custom",
      path: ["sursa"],
      message: "Un document PDF se încarcă în aplicație, nu se leagă printr-un link.",
    });
  }

  if (v.treapta_dovada === "parcurgere") {
    if (v.fel !== "video") {
      ctx.addIssue({
        code: "custom",
        path: ["treapta_dovada"],
        message: "Parcurgerea măsurată se poate folosi doar la filme.",
      });
    }
    if (v.sursa === "link") {
      ctx.addIssue({
        code: "custom",
        path: ["treapta_dovada"],
        message: "La un film extern nu putem măsura parcurgerea. Alegeți bifa sau declarația.",
      });
    }
    if (v.procent_minim === null) {
      ctx.addIssue({
        code: "custom",
        path: ["procent_minim"],
        message: "Alegeți ce procent din film trebuie urmărit.",
      });
    }
  } else if (v.procent_minim !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["procent_minim"],
      message: "Procentul minim se completează doar la parcurgerea măsurată.",
    });
  }

  if (v.treapta_dovada === "test") {
    if (v.prag_test === null) {
      ctx.addIssue({
        code: "custom",
        path: ["prag_test"],
        message: "Alegeți nota minimă de trecere.",
      });
    }
  } else if (v.prag_test !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["prag_test"],
      message: "Nota minimă se completează doar la testul grilă.",
    });
  }

  if (v.treapta_dovada === "declaratie") {
    if (v.declaratie_text === null) {
      ctx.addIssue({
        code: "custom",
        path: ["declaratie_text"],
        message: "Scrieți textul pe care angajatul îl va asuma.",
      });
    }
  } else if (v.declaratie_text !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["declaratie_text"],
      message: "Textul declarației se completează doar la treapta cu declarație.",
    });
  }
}

const campuriMaterial = {
  cod,
  titlu: z
    .string()
    .trim()
    .min(2, "Titlul are cel puțin 2 caractere.")
    .max(200, "Titlul are cel mult 200 de caractere."),
  descriere: textOptional(2000),
  fel: z.enum(CURS_MATERIAL_FEL),
  sursa: z.enum(CURS_MATERIAL_SURSA),
  treapta_dovada: z.enum(CURS_TREAPTA_DOVADA).default("bifa"),
  procent_minim: optional(
    z.coerce
      .number()
      .int()
      .min(1, "Procentul are cel puțin 1.")
      .max(100, "Procentul are cel mult 100."),
  ),
  prag_test: optional(
    z.coerce.number().min(1, "Nota minimă e cel puțin 1.").max(100, "Nota minimă e cel mult 100."),
  ),
  /*
   * Aceeași formă ca `optional()`, nu `.min(10)` urmat de `.transform()`:
   * transformarea în `null` se aplică DUPĂ validare, deci un câmp gol — cazul
   * normal la orice treaptă în afară de „declarație" — pica pe lungimea minimă.
   * Prins de `cursuri.test.ts`, nu de un utilizator.
   */
  declaratie_text: z
    .union([
      z
        .string()
        .trim()
        .min(10, "Textul declarației are cel puțin 10 caractere.")
        .max(4000, "Textul declarației are cel mult 4000 de caractere."),
      z.literal(""),
      z.undefined(),
    ])
    .transform((v) => (v === "" || v === undefined ? null : v))
    .default(null as never),
  transcriere: textOptional(50000),
};

export const creeazaMaterialSchema = z.object(campuriMaterial).superRefine(validareMaterial);
export type CreeazaMaterialInput = z.output<typeof creeazaMaterialSchema>;

export const actualizeazaMaterialSchema = z
  .object({ id: z.uuid(), ...campuriMaterial })
  .superRefine(validareMaterial);
export type ActualizeazaMaterialInput = z.output<typeof actualizeazaMaterialSchema>;

export const stergeMaterialSchema = z.object({ id: z.uuid() });

// ── Versiuni ───────────────────────────────────────────────────────────────

export const pregatesteIncarcareSchema = z.object({
  material_id: z.uuid(),
  fel: z.enum(CURS_MATERIAL_FEL),
  nume_fisier: z.string().trim().min(1).max(255),
  dimensiune: z.coerce.number().int().positive(),
  mime: z.string().trim().min(3).max(120),
  /** Subtitrarea urcă pe aceeași cale, dar cu alte plafoane și alt MIME. */
  este_subtitrare: z.coerce.boolean().default(false),
});
export type PregatesteIncarcareInput = z.output<typeof pregatesteIncarcareSchema>;

export const salveazaVersiuneFisierSchema = z.object({
  material_id: z.uuid(),
  cale: z.string().trim().min(1).max(1024),
  nume_fisier: z.string().trim().min(1).max(255),
  mime: z.string().trim().min(3).max(120),
  subtitrare_cale: optional(z.string().trim().max(1024)),
  /**
   * Durata o introduce ADMINISTRATORUL, nu clientul la redare. Altfel numitorul
   * dovezii măsurate ar fi ales chiar de cel măsurat — vezi comentariul de pe
   * coloană în 0075.
   */
  durata_secunde: optional(
    z.coerce
      .number()
      .int()
      .min(1, "Durata are cel puțin o secundă.")
      .max(86400, "Durata are cel mult 24 de ore."),
  ),
  numar_pagini: optional(z.coerce.number().int().min(1).max(5000)),
  nota_versiune: textOptional(500),
});
export type SalveazaVersiuneFisierInput = z.output<typeof salveazaVersiuneFisierSchema>;

export const salveazaVersiuneLinkSchema = z.object({
  material_id: z.uuid(),
  adresa: z.string().trim().min(8).max(2048),
  durata_secunde: optional(z.coerce.number().int().min(1).max(86400)),
  nota_versiune: textOptional(500),
});
export type SalveazaVersiuneLinkInput = z.output<typeof salveazaVersiuneLinkSchema>;

export const FURNIZOR_LINK_SCHEMA = z.enum(FURNIZORI_LINK);

// ── Lecții (course_items) ──────────────────────────────────────────────────

export const adaugaLectieSchema = z.object({
  course_id: z.uuid(),
  material_id: z.uuid("Alegeți un material din bibliotecă."),
  obligatoriu: z.coerce.boolean().default(true),
});

export const actualizeazaLectieSchema = z.object({
  id: z.uuid(),
  obligatoriu: z.coerce.boolean(),
});

export const mutaLectieSchema = z.object({
  id: z.uuid(),
  directie: z.enum(["sus", "jos"]),
});

export const stergeLectieSchema = z.object({ id: z.uuid() });

// ── Înrolări ───────────────────────────────────────────────────────────────

export const atribuieCursSchema = z.object({
  course_id: z.uuid(),
  employee_ids: z
    .array(z.uuid())
    .min(1, "Alegeți cel puțin o persoană.")
    .max(200, "Alegeți cel mult 200 de persoane deodată."),
  termen: optional(z.iso.date()),
});
export type AtribuieCursInput = z.output<typeof atribuieCursSchema>;

export const anuleazaInrolareSchema = z.object({
  id: z.uuid(),
  motiv: z
    .string()
    .trim()
    .min(5, "Motivul anulării are cel puțin 5 caractere.")
    .max(500, "Motivul anulării are cel mult 500 de caractere."),
});

// ── Parcurgere (ce trimite angajatul) ──────────────────────────────────────

export const raporteazaProgresSchema = z.object({
  id: z.uuid(),
  secunde_vizionate: z.coerce.number().int().min(0).max(86400),
  pozitie_secunde: z.coerce.number().int().min(0).max(86400),
});
export type RaporteazaProgresInput = z.output<typeof raporteazaProgresSchema>;

export const incheieLectieSchema = z.object({ id: z.uuid() });

export const semneazaLectieSchema = z.object({
  id: z.uuid(),
  nume: z
    .string()
    .trim()
    .min(3, "Scrieți numele complet.")
    .max(160, "Numele are cel mult 160 de caractere."),
  confirmare: z.literal(true, "Bifați confirmarea pentru a semna."),
});
export type SemneazaLectieInput = z.output<typeof semneazaLectieSchema>;

// ── Testul grilă (0077) ────────────────────────────────────────────────────

/**
 * Întrebările NU poartă răspunsul corect. Cheia pleacă separat, către
 * `course_answer_keys`, tabela fără politică pentru `authenticated` — RLS n-are
 * granularitate pe coloană, deci separarea e singura barieră reală.
 */
export const intrebareSchema = z.object({
  id: z.string().trim().min(1).max(40),
  text: z.string().trim().min(3, "Scrieți întrebarea.").max(500),
  optiuni: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        text: z.string().trim().min(1, "Scrieți varianta.").max(300),
      }),
    )
    .min(2, "O întrebare are cel puțin două variante.")
    .max(8, "O întrebare are cel mult opt variante."),
  corect: z.string().trim().min(1, "Alegeți varianta corectă.").max(40),
});
export type Intrebare = z.output<typeof intrebareSchema>;

export const salveazaTestSchema = z.object({
  version_id: z.uuid(),
  intrebari: z
    .array(intrebareSchema)
    .min(1, "Un test are cel puțin o întrebare.")
    .max(50, "Un test are cel mult 50 de întrebări.")
    .superRefine((intrebari, ctx) => {
      const idxDuplicat = new Set<string>();
      for (const [i, intrebare] of intrebari.entries()) {
        if (idxDuplicat.has(intrebare.id)) {
          ctx.addIssue({ code: "custom", path: [i, "id"], message: "Identificator duplicat." });
        }
        idxDuplicat.add(intrebare.id);
        if (!intrebare.optiuni.some((o) => o.id === intrebare.corect)) {
          ctx.addIssue({
            code: "custom",
            path: [i, "corect"],
            message: "Varianta corectă nu se află printre variantele întrebării.",
          });
        }
      }
    }),
});
export type SalveazaTestInput = z.output<typeof salveazaTestSchema>;

export const trimiteTestSchema = z.object({
  enrollment_item_id: z.uuid(),
  raspunsuri: z.record(z.string().max(40), z.string().max(40)),
});
export type TrimiteTestInput = z.output<typeof trimiteTestSchema>;

// ── Reguli de atribuire (0078) ─────────────────────────────────────────────

export const creeazaRegulaSchema = z
  .object({
    course_id: z.uuid(),
    criteriu: z.enum(CURS_CRITERIU),
    department_id: optional(z.uuid()),
    job_position_id: optional(z.uuid()),
    rol: optional(z.enum(["super_admin", "org_admin", "manager", "hr", "employee"])),
    employee_id: optional(z.uuid()),
    decalaj_zile: z.coerce.number().int().min(0).max(365).default(0),
    termen_zile: optional(z.coerce.number().int().min(1).max(365)),
  })
  /**
   * Oglinda lui `course_assignment_rules_criteriu_ck`: EXACT o țintă, potrivită
   * criteriului. Fără ea, o regulă „departament" cu departamentul gol ar prinde
   * toată firma — tăcut, fiindcă baza ar respinge-o cu 23514, un cod pe care
   * formularul nu-l poate arăta pe câmpul potrivit.
   */
  .superRefine((v, ctx) => {
    const tinte = {
      departament: v.department_id,
      functie: v.job_position_id,
      rol: v.rol,
      angajat: v.employee_id,
    } as const;
    for (const [criteriu, valoare] of Object.entries(tinte)) {
      const cheie = criteriu as keyof typeof tinte;
      const camp =
        cheie === "departament"
          ? "department_id"
          : cheie === "functie"
            ? "job_position_id"
            : cheie === "rol"
              ? "rol"
              : "employee_id";
      if (v.criteriu === cheie && valoare === null) {
        ctx.addIssue({ code: "custom", path: [camp], message: "Alegeți ținta regulii." });
      }
      if (v.criteriu !== cheie && valoare !== null) {
        ctx.addIssue({
          code: "custom",
          path: [camp],
          message: "Se completează doar pentru criteriul potrivit.",
        });
      }
    }
  });
export type CreeazaRegulaInput = z.output<typeof creeazaRegulaSchema>;

export const stergeRegulaSchema = z.object({ id: z.uuid() });
export const aplicaRegulileSchema = z.object({ course_id: optional(z.uuid()) });
