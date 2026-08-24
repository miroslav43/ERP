// src/schemas/payroll.ts
import { z } from "zod";

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;

const cota = (eticheta: string) =>
  z.coerce
    .number()
    .min(0, `${eticheta} nu poate fi negativă.`)
    .max(1, `${eticheta} se exprimă ca fracție (0,25 pentru 25%), nu ca procent.`);

export const pragDeducereSchema = z.object({
  nr_persoane_intretinere_min: z.coerce.number().int().min(0).max(20),
  nr_persoane_intretinere_max: z.coerce.number().int().min(0).max(20).nullable(),
  venit_brut_max: z.coerce.number().positive("Venitul brut maxim trebuie să fie pozitiv."),
  valoare: z.coerce.number().min(0, "Valoarea deducerii nu poate fi negativă."),
});
export type IntrarePragDeducere = z.output<typeof pragDeducereSchema>;

export const setariSalarizareSchema = z.object({
  valabil_de_la: z.string().regex(RE_DATA, "Data trebuie să fie în formatul AAAA-LL-ZZ."),
  cota_cas: cota("Cota CAS"),
  cota_cass: cota("Cota CASS"),
  cota_impozit: cota("Cota de impozit"),
  cota_cam_angajator: cota("Cota CAM"),
  norma_zilnica_ore: z.coerce.number().positive("Norma zilnică trebuie să fie pozitivă.").max(24),
  procent_spor_noapte: z.coerce.number().min(0),
  procent_spor_weekend: z.coerce.number().min(0),
  procent_spor_sarbatoare: z.coerce.number().min(0).max(5).default(1),
  /**
   * Codul casei de asigurări de sănătate a angajatorului (D112, câmpul `casaAng`).
   *
   * ANAF cere să COINCIDĂ cu județul sediului social și respinge declarația dacă
   * lipsește. Nu se deduce din `organizations.judet`: e nomenclator CNAS, nu cod
   * de județ — de aceea e un câmp, nu o derivare.
   */
  casa_sanatate_angajator: z
    .string()
    .trim()
    .toUpperCase()
    .max(10, "Codul casei de sănătate nu poate depăși 10 caractere.")
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v)),
  functie_declarant: z
    .string()
    .trim()
    .min(1, "Funcția declarantului este obligatorie.")
    .max(50, "Funcția declarantului nu poate depăși 50 de caractere.")
    .default("Administrator"),
  procent_ore_suplimentare: z.coerce.number().min(0),
  valoare_tichet_masa: z.coerce.number().min(0),
  tichete_impozabile: z.coerce.boolean(),
  tichete_supuse_cass: z.coerce.boolean(),
  salariu_minim_brut: z.coerce.number().min(0, "Salariul minim nu poate fi negativ."),
  aplica_minim_contributii: z.coerce.boolean(),
  rotunjire_lei: z.coerce.boolean(),
  praguri: z.array(pragDeducereSchema).min(1, "Adăugați cel puțin un prag de deducere personală."),
});
export type IntrareSetariSalarizare = z.output<typeof setariSalarizareSchema>;

export const creeazaPerioadaSchema = z.object({
  an: z.coerce.number().int().min(2020).max(2100),
  luna: z.coerce.number().int().min(1).max(12),
});
export type IntrareCreeazaPerioada = z.output<typeof creeazaPerioadaSchema>;

export const idPerioadaSchema = z.object({ id: z.uuid() });

export const primaSchema = z.object({
  period_id: z.uuid(),
  employee_id: z.uuid(),
  tip: z.enum(["prima_performanta", "prima_proiect", "prima_vacanta", "spor_conditii", "alta"]),
  suma: z.coerce.number().positive("Suma trebuie să fie pozitivă."),
  motiv: z.string().trim().min(1, "Motivul este obligatoriu.").max(500),
  impozabil: z.coerce.boolean().default(true),
  supus_contributii: z.coerce.boolean().default(true),
});
export type IntrarePrima = z.output<typeof primaSchema>;

export const retinereSchema = z.object({
  period_id: z.uuid(),
  employee_id: z.uuid(),
  tip: z.enum(["avans", "poprire", "imputatie", "rata_interna", "retinere_sindicat", "alta"]),
  suma: z.coerce.number().positive("Suma trebuie să fie pozitivă."),
  procent_maxim_din_net: z.coerce.number().min(0).max(1).nullable().default(null),
  motiv: z.string().trim().min(1, "Motivul este obligatoriu.").max(500),
});
export type IntrareRetinere = z.output<typeof retinereSchema>;

/**
 * Un rând de venit anterior punerii în funcțiune a aplicației.
 *
 * Fără el, baza de calcul a concediului medical (media pe șase luni) și cea a
 * indemnizației de concediu de odihnă (media pe trei) rămân incomplete, iar
 * indemnizațiile ies mai mici decât cele legale — fără nicio eroare.
 */
export const istoricVenitSchema = z.object({
  employee_id: z.uuid(),
  an: z.coerce.number().int().min(2000).max(2100),
  luna: z.coerce.number().int().min(1).max(12),
  venit_brut: z.coerce.number().min(0, "Venitul brut nu poate fi negativ."),
  drepturi_salariale: z.coerce.number().min(0, "Drepturile salariale nu pot fi negative."),
  zile_lucrate: z.coerce
    .number()
    .min(0, "Zilele lucrate nu pot fi negative.")
    .max(31, "O lună are cel mult 31 de zile."),
  sursa: z.string().trim().max(200).nullable().default(null),
});
export type IntrareIstoricVenit = z.output<typeof istoricVenitSchema>;

// ── Dosare de poprire ─────────────────────────────────────────────────────────

export const TIPURI_CREANTA_POPRIRE = ["intretinere", "alta"] as const;
export type TipCreantaPoprire = (typeof TIPURI_CREANTA_POPRIRE)[number];

/**
 * Un dosar de urmărire silită.
 *
 * Tabela `payroll_garnishments` există din 0059, cu politici RLS, plafoane
 * legale în `payroll_settings` și un motor de calcul complet
 * (`etape/retineri-popriri.ts`, 37 de teste) — dar nicio schemă și nicio Server
 * Action care să insereze un rând. Dosarele se puteau crea doar direct în bază.
 *
 * `suma_recuperata` NU e aici: din 0065 e derivată din reținerile efectiv
 * operate și recalculată de trigger. Dacă ar fi editabilă, un dosar ar putea
 * arăta o datorie stinsă fără ca banii să fi fost vreodată reținuți.
 */
export const poprireSchema = z
  .object({
    employee_id: z.uuid("Angajatul selectat nu este valid."),
    dosar: z
      .string()
      .trim()
      .min(1, "Numărul dosarului este obligatoriu.")
      .max(100, "Numărul dosarului nu poate depăși 100 de caractere."),
    creditor: z
      .string()
      .trim()
      .min(1, "Creditorul este obligatoriu.")
      .max(200, "Numele creditorului nu poate depăși 200 de caractere."),
    executor: z.string().trim().max(200).nullable().default(null),
    tip_creanta: z.enum(TIPURI_CREANTA_POPRIRE).default("alta"),
    suma_totala: z.coerce.number().positive("Suma totală de recuperat trebuie să fie pozitivă."),
    suma_lunara: z.coerce.number().positive("Suma lunară de reținut trebuie să fie pozitivă."),
    prioritate: z.coerce.number().int().min(1).max(1000).default(100),
    data_inceput: z.string().trim().regex(RE_DATA, "Data de început trebuie scrisă AAAA-LL-ZZ."),
    data_sfarsit: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .transform((v) => (v === null || v.length === 0 ? null : v))
      .refine((v) => v === null || RE_DATA.test(v), "Data de sfârșit trebuie scrisă AAAA-LL-ZZ."),
    observatii: z.string().trim().max(1000).nullable().default(null),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.data_sfarsit !== null && valoare.data_sfarsit < valoare.data_inceput) {
      ctx.addIssue({
        code: "custom",
        path: ["data_sfarsit"],
        message: "Data de sfârșit nu poate fi anterioară datei de început.",
      });
    }
    if (valoare.suma_lunara > valoare.suma_totala) {
      ctx.addIssue({
        code: "custom",
        path: ["suma_lunara"],
        message: "Suma lunară nu poate depăși datoria totală.",
      });
    }
  });
export type IntrarePoprire = z.output<typeof poprireSchema>;

export const inchidePoprireSchema = z.object({
  id: z.uuid("Dosarul selectat nu este valid."),
  activa: z.coerce.boolean(),
});
export type IntrareInchidePoprire = z.output<typeof inchidePoprireSchema>;
