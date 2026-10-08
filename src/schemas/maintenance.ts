// src/schemas/maintenance.ts
// Validările modulului de mentenanță — echipamente, contoare, planuri,
// intervenții, sesizări, autorizații ISCIR. Valorile enumerate vin din
// `0011_ssm.sql` (tipurile `equipment_status`, `meter_kind`,
// `maintenance_kind`, `maintenance_result`, `fault_urgency`, `fault_status`),
// scrise aici ca uniuni literale — nu importate din tipurile generate — ca
// schemele să poată valida și intrarea brută din URL, unde totul e `string`.

import { z } from "zod";
import { enumOptional, optional } from "./comun";

export const STATUS_ECHIPAMENT = [
  "in_functiune",
  "in_reparatie",
  "in_conservare",
  "casat",
] as const;
export type StatusEchipament = (typeof STATUS_ECHIPAMENT)[number];

/** Marcajul CE al utilajului (0182): „nu se aplică” pentru ce e dinainte de 1995 sau în afara directivelor. */
export const MARCAJE_CE = ["da", "nu", "nu_se_aplica"] as const;
export type MarcajCe = (typeof MARCAJE_CE)[number];

export const TIPURI_CONTOR = ["ore", "km", "cicluri"] as const;
export type TipContor = (typeof TIPURI_CONTOR)[number];

/** `verificare_legala` (0181): VTP ISCIR, PRAM, verificările periodice cerute de lege — planuri cu temei legal. */
export const TIPURI_MENTENANTA = [
  "preventiva",
  "predictiva",
  "corectiva",
  "verificare_legala",
] as const;
export type TipMentenanta = (typeof TIPURI_MENTENANTA)[number];

export const REZULTATE_INTERVENTIE = ["reusita", "partiala", "esuata", "amanata"] as const;
export type RezultatInterventie = (typeof REZULTATE_INTERVENTIE)[number];

export const URGENTE_SESIZARE = ["scazuta", "medie", "ridicata", "critica"] as const;
export type UrgentaSesizare = (typeof URGENTE_SESIZARE)[number];

/**
 * Ordinea e cea a enum-ului din bază (0011 + 0181): sortarea pe „stare” o
 * folosește. `in_asteptare` = așteaptă piese sau furnizor; `inchis` = raportorul a
 * confirmat rezolvarea (sau s-a închis automat); `retrasa` = raportorul a renunțat.
 */
export const STATUSURI_SESIZARE = [
  "nou",
  "in_analiza",
  "in_lucru",
  "in_asteptare",
  "rezolvat",
  "inchis",
  "respins",
  "retrasa",
] as const;
export type StatusSesizare = (typeof STATUSURI_SESIZARE)[number];

/**
 * Statusurile pe care le poate atribui triajul — nu „nou” (stare inițială), nu
 * „rezolvat” (cere intervenție, are acțiune proprie), nu „inchis”/„retrasa”
 * (ale raportorului). Garda din bază (`fault_reports_garda`) e judecătorul final.
 */
export const STATUSURI_TRIAJ = ["in_analiza", "in_lucru", "in_asteptare", "respins"] as const;
export type StatusTriaj = (typeof STATUSURI_TRIAJ)[number];

/** Motivul respingerii, din listă — raportorul află ce să facă diferit (0181). */
export const MOTIVE_RESPINGERE = [
  "informatii_insuficiente",
  "nu_tine_de_mentenanta",
  "duplicat",
  "prioritate_scazuta",
  "altul",
] as const;
export type MotivRespingere = (typeof MOTIVE_RESPINGERE)[number];

/** Felul unei opriri din jurnalul `equipment_opriri` (0181). */
export const TIPURI_OPRIRE = ["neplanificata", "planificata", "legala"] as const;
export type TipOprire = (typeof TIPURI_OPRIRE)[number];

/** Pe ce stă un atașament (`maintenance_attachments.entity_type`, 0181). */
export const ENTITATI_ATASAMENT = [
  "fault_report",
  "equipment",
  "intervention",
  "iscir_authorization",
] as const;
export type EntitateAtasament = (typeof ENTITATI_ATASAMENT)[number];

export const TIPURI_ATASAMENT = [
  "foto",
  "carte_tehnica",
  "certificat_ce",
  "manual",
  "contract",
  "autorizatie",
  "pv",
  "buletin",
  "factura",
  "altele",
] as const;
export type TipAtasament = (typeof TIPURI_ATASAMENT)[number];

const RE_ORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/u;

// ── Filtre din URL (paginare keyset) ────────────────────────────────────────
//
// Fiecare câmp opțional are `.default(...)`: `filtreDinUrl()` revine la
// `schema.safeParse({})` când query string-ul e nevalid, iar fără implicite
// peste tot revenirea ar eșua și ea (vezi `lib/rute/parametri.ts`).

/**
 * Coloanele după care se pot sorta cele trei liste de mentenanță.
 *
 * Listele sunt ÎNCHISE, nu o validare de formă: numele coloanei ajunge într-un
 * `.order()` ȘI într-un predicat de cursor construit ca text, deci nu poate
 * veni liber din query string. `sortareCeruta` din `lib/queries/cursor.ts` cade
 * tăcut pe implicit pentru orice altceva.
 *
 * Numai coloane `not null`: cu una care admite NULL, predicatul keyset compară
 * cu NULL, iar rândurile fără valoare dispar tăcut de la a doua pagină. `cost`
 * e sortabil tocmai fiindcă `cost_total` e generată din două coloane `not null
 * default 0`, deci nu e niciodată NULL; `locatie`, în schimb, nu e.
 */
export const SORTARI_ECHIPAMENTE = ["cod", "denumire", "stare"] as const;
export type SortareEchipamente = (typeof SORTARI_ECHIPAMENTE)[number];

export const SORTARI_INTERVENTII = ["data", "tip", "cost", "rezultat"] as const;
export type SortareInterventii = (typeof SORTARI_INTERVENTII)[number];

export const SORTARI_PLANURI = ["scadenta", "denumire"] as const;
export type SortarePlanuri = (typeof SORTARI_PLANURI)[number];

/** Modul de calcul al scadenței pe zile (0183): flotant = de la ultima execuție; fix = pe grilă, de la ancoră. */
export const MODURI_CALCUL = ["flotant", "fix"] as const;
export type ModCalcul = (typeof MODURI_CALCUL)[number];

/** Filtrul de scadență al listei de planuri — pe data calendaristică, în SQL. */
export const FILTRE_SCADENTA_PLAN = ["depasita", "curand", "luna"] as const;
export type FiltruScadentaPlan = (typeof FILTRE_SCADENTA_PLAN)[number];

export const SORTARI_SESIZARI = ["raportat", "urgenta", "stare"] as const;
export type SortareSesizari = (typeof SORTARI_SESIZARI)[number];

export const filtreEchipamenteSchema = z.object({
  status: optional(z.enum(STATUS_ECHIPAMENT)),
  cauta: optional(z.string().max(80)),
  categorie: optional(z.string().max(80)),
  punct_lucru: optional(z.uuid()),
  /** `da` = doar echipamentele sub incidența ISCIR. */
  iscir: optional(z.literal("da")),
  responsabil: optional(z.uuid()),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  /** Forma din URL: `cod` crescător, `-cod` descrescător. */
  sort: optional(z.string().max(40)),
});
export type FiltreEchipamente = z.output<typeof filtreEchipamenteSchema>;

export const filtreInterventiiSchema = z.object({
  tip: optional(z.enum(TIPURI_MENTENANTA)),
  rezultat: optional(z.enum(REZULTATE_INTERVENTIE)),
  echipament: optional(z.uuid()),
  plan: optional(z.uuid()),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: optional(z.string().max(40)),
});
export type FiltreInterventii = z.output<typeof filtreInterventiiSchema>;

export const filtrePlanuriSchema = z.object({
  echipament: optional(z.uuid()),
  tip: optional(z.enum(TIPURI_MENTENANTA)),
  responsabil: optional(z.uuid()),
  /**
   * `da` = doar active, `nu` = doar inactive, `toate` = fără filtru. Lipsa din
   * adresă o tratează ECRANUL ca `da` — lista de planuri se deschide pe cele
   * active — iar citirea tratează `null` ca „toate” (pagina îi dă mereu o valoare).
   */
  activ: optional(z.union([z.literal("da"), z.literal("nu"), z.literal("toate")])),
  scadenta: optional(z.enum(FILTRE_SCADENTA_PLAN)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: optional(z.string().max(40)),
});
export type FiltrePlanuri = z.output<typeof filtrePlanuriSchema>;

/**
 * `atribuit`: `mie` (sesizările tehnicianului curent), `nimeni` (neatribuite —
 * coada de triaj) sau fișa unui angajat. `deschise`: scurtătura „tot ce e încă
 * de făcut" (nou, în analiză, în lucru, în așteptare), fiindcă filtrul pe o
 * singură stare ascunde restul cozii.
 */
export const filtreSesizariSchema = z.object({
  status: optional(z.enum(STATUSURI_SESIZARE)),
  urgenta: optional(z.enum(URGENTE_SESIZARE)),
  echipament: optional(z.uuid()),
  atribuit: optional(z.union([z.literal("mie"), z.literal("nimeni"), z.uuid()])),
  deschise: optional(z.literal("da")),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: optional(z.string().max(40)),
});
export type FiltreSesizari = z.output<typeof filtreSesizariSchema>;

// ── Echipamente ──────────────────────────────────────────────────────────

/**
 * `derogare_acordata_de` și `derogare_acordata_la` NU apar aici: `equipment_iscir_guard`
 * (BEFORE) le calculează singur din `auth.uid()`/`now()` când derogarea e acordată, și
 * le golește singur când nu mai e nevoie de ea. Trimise din client, ar fi fie ignorate
 * (golite de trigger dacă responsabilul are deja autorizație), fie ar declanșa P0001
 * (garda nu are cum să valideze un `derogare_acordata_de` scris manual).
 */
export const echipamentSchema = z.object({
  cod: z.string().trim().min(1).max(60),
  denumire: z.string().trim().min(1).max(200),
  serie: z.string().trim().max(120).nullable().default(null),
  producator: z.string().trim().max(120).nullable().default(null),
  model: z.string().trim().max(120).nullable().default(null),
  an_fabricatie: z.coerce.number().int().min(1900).max(2200).nullable().default(null),
  locatie: z.string().trim().max(200).nullable().default(null),
  department_id: z.uuid().nullable().default(null),
  responsabil_employee_id: z.uuid().nullable().default(null),
  status: z.enum(STATUS_ECHIPAMENT).default("in_functiune"),
  este_iscir: z.boolean().default(false),
  tip_autorizare_necesara: z.string().trim().max(80).nullable().default(null),
  valoare_achizitie: z.coerce.number().min(0).nullable().default(null),
  data_punerii_in_functiune: z.iso.date().nullable().default(null),
  // ── 0182: ciclul de viață ──
  categorie: z.string().trim().max(80).nullable().default(null),
  punct_lucru_id: z.uuid().nullable().default(null),
  garantie_expira: z.iso.date().nullable().default(null),
  service_garantie: z.string().trim().max(200).nullable().default(null),
  parent_equipment_id: z.uuid().nullable().default(null),
  marcaj_ce: z.enum(MARCAJE_CE).default("nu_se_aplica"),
  risc_specific: z.boolean().default(false),
  folosit_in_afara_sediului: z.boolean().default(false),
  observatii: z.string().trim().max(2000).nullable().default(null),
  // Minimum 20 de caractere contează efectiv doar când `equipment_iscir_guard`
  // ajunge pe ramura de derogare (este_iscir=true, fără responsabil autorizat,
  // apelant org_admin/super_admin) — dar garda îl cere exact așa, iar fără
  // validarea de aici omul afla abia după un P0001 de 247 de caractere. Un
  // câmp lăsat gol devine `null` (nu „"”), ca să nu declanșeze regula.
  derogare_motiv: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v))
    .refine(
      (v) => v === null || v.length >= 20,
      "Motivul derogării are cel puțin 20 de caractere — spuneți cine răspunde de echipament și până când.",
    ),
});
export type EchipamentInput = z.output<typeof echipamentSchema>;

export const actualizeazaEchipamentSchema = echipamentSchema.extend({
  id: z.uuid("Echipamentul selectat nu este valid."),
});
export type ActualizeazaEchipamentInput = z.output<typeof actualizeazaEchipamentSchema>;

/**
 * Schimbarea stării cu un gest propriu (0182): casarea cere motiv, conservarea
 * și repunerea în funcțiune nu. `casat_la` lipsă = azi (o pune garda).
 */
export const schimbaStareEchipamentSchema = z
  .object({
    id: z.uuid("Echipamentul selectat nu este valid."),
    status: z.enum(STATUS_ECHIPAMENT),
    casat_la: z.iso.date().nullable().default(null),
    motiv_casare: z.string().trim().max(1000).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.status === "casat" && (v.motiv_casare === null || v.motiv_casare.length < 5)) {
      ctx.addIssue({
        code: "custom",
        path: ["motiv_casare"],
        message: "Casarea cere un motiv scris, de cel puțin 5 caractere.",
      });
    }
  });
export type SchimbaStareEchipamentInput = z.output<typeof schimbaStareEchipamentSchema>;

/** Ștergerea logică cere codul tastat — un utilaj șters dispare cu planurile și contoarele lui. */
export const stergeEchipamentSchema = z.object({
  id: z.uuid("Echipamentul selectat nu este valid."),
  confirmare: z.string().trim().min(1, "Tastați codul echipamentului."),
});
export type StergeEchipamentInput = z.output<typeof stergeEchipamentSchema>;

/** Text de căutare pentru selectorul de echipament din formularul de sesizare. */
export const cautaEchipamentSchema = z.object({
  q: z.string().trim().max(80).default(""),
});
export type CautaEchipamentInput = z.output<typeof cautaEchipamentSchema>;

// ── Contoare ────────────────────────────────────────────────────────────

export const contorNouSchema = z.object({
  equipment_id: z.uuid("Echipamentul selectat nu este valid."),
  tip: z.enum(TIPURI_CONTOR),
  citire: z.coerce.number().min(0),
  data_citirii: z.iso.date(),
  resetare_contor: z.boolean().default(false),
  sursa: z.string().trim().min(1).max(60).default("manual"),
  citit_de_employee_id: z.uuid().nullable().default(null),
  observatii: z.string().trim().max(500).nullable().default(null),
});
export type ContorNouInput = z.output<typeof contorNouSchema>;

/** Corecția unei citiri deja înregistrate: valoarea, data, observația. Garda verifică vecinii. */
export const corecteazaCitireSchema = z.object({
  id: z.uuid("Citirea selectată nu este validă."),
  citire: z.coerce.number().min(0),
  data_citirii: z.iso.date(),
  observatii: z.string().trim().max(500).nullable().default(null),
});
export type CorecteazaCitireInput = z.output<typeof corecteazaCitireSchema>;

/** Anularea logică a unei citiri greșite; motivul rămâne pe rând. */
export const anuleazaCitireSchema = z.object({
  id: z.uuid("Citirea selectată nu este validă."),
  motiv: z.string().trim().min(3, "Spuneți de ce anulați citirea.").max(500),
});
export type AnuleazaCitireInput = z.output<typeof anuleazaCitireSchema>;

/**
 * Citirile în lot, de pe pagina „Contoare”: o dată, mai multe utilaje. Fiecare
 * rând se trimite separat în bază (garda judecă fiecare citire), iar raportul
 * spune pe nume ce a intrat și ce a fost refuzat.
 */
export const citiriLotSchema = z.object({
  data_citirii: z.iso.date(),
  citiri: z
    .array(
      z.object({
        equipment_id: z.uuid(),
        tip: z.enum(TIPURI_CONTOR),
        citire: z.coerce.number().min(0),
      }),
    )
    .min(1, "Completați cel puțin o citire.")
    .max(200),
});
export type CitiriLotInput = z.output<typeof citiriLotSchema>;

// ── Planuri de mentenanță ──────────────────────────────────────────────────

/**
 * `urmatoarea_scadenta` și `urmatoarea_scadenta_contor` NU apar aici:
 * `maintenance_plans_calc` (BEFORE) le rescrie necondiționat la fiecare insert
 * și update, din `ultima_executie`/`periodicitate_zile` respectiv
 * `ultima_citire_contor`/`periodicitate_contor`. Trimise din client, ar fi pur
 * și simplu ignorate — dar tot nu se trimit, ca formularul să nu sugereze o
 * cifră pe care baza o rescrie oricum.
 */
const campuriPlan = z.object({
  equipment_id: z.uuid("Echipamentul selectat nu este valid."),
  denumire: z.string().trim().min(1).max(200),
  tip: z.enum(TIPURI_MENTENANTA).default("preventiva"),
  periodicitate_zile: z.coerce.number().int().min(1).nullable().default(null),
  periodicitate_contor: z.coerce.number().min(0.01).nullable().default(null),
  tip_contor: enumOptional(TIPURI_CONTOR, "Alegeți tipul de contor din listă."),
  ultima_executie: z.iso.date().nullable().default(null),
  ultima_citire_contor: z.coerce.number().min(0).nullable().default(null),
  responsabil_employee_id: z.uuid().nullable().default(null),
  instructiuni: z.string().trim().max(2000).nullable().default(null),
  activ: z.boolean().default(true),
  // ── 0183 ──
  mod_calcul: z.enum(MODURI_CALCUL).default("flotant"),
  data_ancora: z.iso.date().nullable().default(null),
  durata_estimata_ore: z.coerce.number().min(0).nullable().default(null),
  cost_estimat: z.coerce.number().min(0).nullable().default(null),
  oprire_necesara: z.boolean().default(false),
  temei_legal: z.string().trim().max(300).nullable().default(null),
  categorie_legala: z
    .string()
    .regex(/^[a-z][a-z0-9_]{1,59}$/u, "Categoria legală nu este validă.")
    .nullable()
    .default(null),
});

/** Oglindește `maintenance_plans_periodicitate_ck` și `..._contor_ck` din bază — verificare front-loaded. */
function valideazaPeriodicitatePlan(
  valoare: Readonly<{
    periodicitate_zile: number | null;
    periodicitate_contor: number | null;
    tip_contor: TipContor | null;
  }>,
  ctx: z.RefinementCtx,
): void {
  if (valoare.periodicitate_zile === null && valoare.periodicitate_contor === null) {
    ctx.addIssue({
      code: "custom",
      path: ["periodicitate_zile"],
      message: "Planul are nevoie de o periodicitate: în zile, în unități de contor, sau ambele.",
    });
  }
  if (valoare.periodicitate_contor !== null && valoare.tip_contor === null) {
    ctx.addIssue({
      code: "custom",
      path: ["tip_contor"],
      message: "O periodicitate pe contor cere și tipul contorului (ore, km sau cicluri).",
    });
  }
}

export const planNouSchema = campuriPlan.superRefine(valideazaPeriodicitatePlan);
export type PlanNouInput = z.output<typeof planNouSchema>;

/**
 * `ultima_citire_contor` NU se poate edita: e punctul de pornire al scadenței pe
 * contor și îl mută DOAR o intervenție reușită (`maintenance_interventions_apply`).
 * Formularul de editare îl trimitea mereu `null`, iar `maintenance_plans_calc`
 * recalcula `urmatoarea_scadenta_contor = 0 + periodicitate` — o simplă
 * redenumire a planului îi aducea scadența pe contor înapoi la zero, fără nicio
 * eroare. Omis din schemă, UPDATE-ul nu mai atinge coloana deloc.
 */
export const actualizeazaPlanSchema = campuriPlan
  .omit({ ultima_citire_contor: true })
  .extend({ id: z.uuid("Planul selectat nu este valid.") })
  .superRefine(valideazaPeriodicitatePlan);
export type ActualizeazaPlanInput = z.output<typeof actualizeazaPlanSchema>;

/** Amânarea unui plan (0183): până la o dată, cu motiv; execuția reușită o șterge. */
export const amanaPlanSchema = z.object({
  id: z.uuid("Planul selectat nu este valid."),
  amanat_pana: z.iso.date(),
  motiv_amanare: z
    .string()
    .trim()
    .min(5, "Spuneți de ce se amână, în cel puțin 5 caractere.")
    .max(1000),
});
export type AmanaPlanInput = z.output<typeof amanaPlanSchema>;

export const comutaPlanActivSchema = z.object({
  id: z.uuid("Planul selectat nu este valid."),
  activ: z.boolean(),
});
export type ComutaPlanActivInput = z.output<typeof comutaPlanActivSchema>;

export const stergePlanSchema = z.object({ id: z.uuid("Planul selectat nu este valid.") });

// ── Intervenții ──────────────────────────────────────────────────────────

/**
 * `cost_total` NU apare aici: e `generated always as (cost_piese + cost_manopera)
 * stored` — Postgres respinge cu 428C9 orice INSERT/UPDATE care îl atinge.
 */
const campuriInterventie = z.object({
  tip: z.enum(TIPURI_MENTENANTA).default("corectiva"),
  data: z.iso.date(),
  ora_start: z
    .string()
    .trim()
    .nullable()
    .default(null)
    .refine((v) => v === null || v.length === 0 || RE_ORA.test(v), "Ora trebuie scrisă HH:MM.")
    .transform((v) => (v === null || v.length === 0 ? null : v)),
  durata_ore: z.coerce.number().min(0).nullable().default(null),
  executant_employee_id: z.uuid().nullable().default(null),
  executant_extern: z.string().trim().max(200).nullable().default(null),
  descriere: z.string().trim().min(3).max(2000),
  piese: z.string().trim().max(2000).nullable().default(null),
  cost_piese: z.coerce.number().min(0).default(0),
  cost_manopera: z.coerce.number().min(0).default(0),
  rezultat: z.enum(REZULTATE_INTERVENTIE).default("reusita"),
  oprire_minute: z.coerce.number().int().min(0).nullable().default(null),
  citire_contor: z.coerce.number().min(0).nullable().default(null),
  observatii: z.string().trim().max(2000).nullable().default(null),
});

export const interventieNouaSchema = campuriInterventie.extend({
  plan_id: z.uuid().nullable().default(null),
  equipment_id: z.uuid("Echipamentul selectat nu este valid."),
});
export type InterventieNouaInput = z.output<typeof interventieNouaSchema>;

// ── Sesizări ────────────────────────────────────────────────────────────

export const sesizareNouaSchema = z.object({
  equipment_id: z.uuid("Selectați echipamentul defect."),
  descriere: z
    .string()
    .trim()
    .min(10, "Descrieți defecțiunea în cel puțin 10 caractere.")
    .max(2000),
  urgenta: z.enum(URGENTE_SESIZARE).default("medie"),
  opreste_functionarea: z.boolean().default(false),
});
export type SesizareNouaInput = z.output<typeof sesizareNouaSchema>;

export const trieazaSesizareSchema = z
  .object({
    id: z.uuid("Sesizarea selectată nu este validă."),
    status: z.enum(STATUSURI_TRIAJ),
    motiv_respingere: z.string().trim().max(500).nullable().default(null),
    motiv_respingere_tip: enumOptional(MOTIVE_RESPINGERE, "Alegeți motivul din listă."),
    /** Sesizarea originală, cerută când motivul e „duplicat”. */
    duplicat_al_id: z.uuid().nullable().default(null),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.status !== "respins") return;
    if (valoare.motiv_respingere === null || valoare.motiv_respingere.length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["motiv_respingere"],
        message: "Respingerea are nevoie de un motiv scris, de cel puțin 5 caractere.",
      });
    }
    if (valoare.motiv_respingere_tip === "duplicat" && valoare.duplicat_al_id === null) {
      ctx.addIssue({
        code: "custom",
        path: ["duplicat_al_id"],
        message: "Respingerea ca duplicat cere sesizarea originală.",
      });
    }
  });
export type TriazaSesizareInput = z.output<typeof trieazaSesizareSchema>;

/**
 * Rezolvarea unei sesizări creează întâi intervenția care a rezolvat-o, deci
 * schema poartă aceleași câmpuri ca `interventieNouaSchema`, fără `plan_id`
 * (o sesizare nu vine niciodată dintr-un plan) — `equipment_id` se ia din
 * sesizarea deja citită în handler, nu din formular.
 *
 * `repus_in_functiune_la` închide oprirea din jurnal (dacă sesizarea a oprit
 * utilajul): momentul în care echipamentul a funcționat din nou. `null` =
 * acum. `nota_rezolvare` e ce vede raportorul în notificare.
 */
export const rezolvaSesizareSchema = campuriInterventie.extend({
  id: z.uuid("Sesizarea selectată nu este validă."),
  repus_in_functiune_la: z.iso.datetime({ offset: true }).nullable().default(null),
  nota_rezolvare: z.string().trim().max(2000).nullable().default(null),
});
export type RezolvaSesizareInput = z.output<typeof rezolvaSesizareSchema>;

// ── Sesizări: fluxul complet (0181) ─────────────────────────────────────────

const idSesizare = z.uuid("Sesizarea selectată nu este validă.");

/** `atribuit_employee_id` null = se ia atribuirea înapoi; „eu” se rezolvă în handler. */
export const atribuieSesizareSchema = z.object({
  id: idSesizare,
  atribuit_employee_id: z.uuid("Alegeți tehnicianul din listă.").nullable().default(null),
  /** Adevărat când apelantul se atribuie pe sine („Preiau eu”); handlerul îi caută fișa. */
  eu: z.boolean().default(false),
});
export type AtribuieSesizareInput = z.output<typeof atribuieSesizareSchema>;

export const redeschideSesizareSchema = z.object({
  id: idSesizare,
  motiv_redeschidere: z
    .string()
    .trim()
    .min(5, "Spuneți de ce redeschideți sesizarea, în cel puțin 5 caractere.")
    .max(1000),
});
export type RedeschideSesizareInput = z.output<typeof redeschideSesizareSchema>;

export const inchideSesizareSchema = z.object({ id: idSesizare });
export const retrageSesizareSchema = z.object({ id: idSesizare });

export const actualizeazaSesizareSchema = z.object({
  id: idSesizare,
  descriere: z
    .string()
    .trim()
    .min(10, "Descrieți defecțiunea în cel puțin 10 caractere.")
    .max(2000),
  urgenta: z.enum(URGENTE_SESIZARE),
});
export type ActualizeazaSesizareInput = z.output<typeof actualizeazaSesizareSchema>;

export const comentariuSesizareSchema = z.object({
  fault_report_id: idSesizare,
  continut: z.string().trim().min(1, "Scrieți ceva.").max(4000),
  intern: z.boolean().default(false),
});
export type ComentariuSesizareInput = z.output<typeof comentariuSesizareSchema>;

// ── Atașamente (poze, documente) ────────────────────────────────────────────

export const LIMITA_FOTO_BYTES = 5 * 1024 * 1024;
export const LIMITA_DOCUMENT_MENTENANTA_BYTES = 25 * 1024 * 1024;
export const MAXIM_FOTO_PE_SESIZARE = 5;

export const MIME_FOTO = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export const MIME_DOCUMENT_MENTENANTA = [
  ...MIME_FOTO,
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const pregatesteFisierSchema = z.object({
  entity_type: z.enum(ENTITATI_ATASAMENT),
  entity_id: z.uuid(),
  numeFisier: z.string().trim().min(1).max(255),
  dimensiune: z.number().int().positive(),
  mime: z.string().min(3).max(120),
});
export type PregatesteFisierInput = z.output<typeof pregatesteFisierSchema>;

export const confirmaFisierSchema = z.object({
  entity_type: z.enum(ENTITATI_ATASAMENT),
  entity_id: z.uuid(),
  cale: z.string().min(3).max(400),
  denumire: z.string().trim().min(1).max(200),
  tip: z.enum(TIPURI_ATASAMENT).default("altele"),
});
export type ConfirmaFisierInput = z.output<typeof confirmaFisierSchema>;

export const stergeFisierSchema = z.object({ id: z.uuid("Fișierul selectat nu este valid.") });

// ── Opriri ──────────────────────────────────────────────────────────────────

export const inchideOprireSchema = z.object({
  id: z.uuid("Oprirea selectată nu este validă."),
  /** Momentul repunerii în funcțiune; `null` = acum. */
  sfarsit: z.iso.datetime({ offset: true }).nullable().default(null),
});
export type InchideOprireInput = z.output<typeof inchideOprireSchema>;

export const inregistreazaOprireSchema = z
  .object({
    equipment_id: z.uuid("Echipamentul selectat nu este valid."),
    inceput: z.iso.datetime({ offset: true }),
    sfarsit: z.iso.datetime({ offset: true }).nullable().default(null),
    tip: z.enum(TIPURI_OPRIRE).default("neplanificata"),
    motiv: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.sfarsit !== null && v.sfarsit < v.inceput) {
      ctx.addIssue({
        code: "custom",
        path: ["sfarsit"],
        message: "Repunerea în funcțiune nu poate fi înaintea opririi.",
      });
    }
  });
export type InregistreazaOprireInput = z.output<typeof inregistreazaOprireSchema>;

// ── Setări ──────────────────────────────────────────────────────────────────

export const setariMentenantaSchema = z.object({
  responsabili: z.array(z.uuid()).max(20).default([]),
  rsvti_employee_id: z.uuid().nullable().default(null),
  inchidere_automata_zile: z.coerce.number().int().min(1).max(90).default(5),
  prag_avertizare_zile: z.coerce.number().int().min(1).max(365).default(15),
  prag_contor_necitit_zile: z.coerce.number().int().min(1).max(365).default(30),
  ore_functionare_pe_zi: z.coerce.number().min(0.5).max(24).default(8),
  zile_pe_saptamana: z.coerce.number().int().min(1).max(7).default(5),
  cost_ora_oprire: z.coerce.number().min(0).nullable().default(null),
});
export type SetariMentenantaInput = z.output<typeof setariMentenantaSchema>;

// ── Autorizații ISCIR ──────────────────────────────────────────────────────

export const autorizatieIscirNouaSchema = z.object({
  equipment_id: z.uuid("Echipamentul selectat nu este valid."),
  numar: z.string().trim().min(1).max(80),
  tip: z.string().trim().min(1).max(80),
  emitent: z.string().trim().min(1).max(120).default("ISCIR"),
  emis_la: z.iso.date().nullable().default(null),
  valabil_pana: z.iso.date(),
  scadenta_verificare_tehnica: z.iso.date().nullable().default(null),
  conditii: z.string().trim().max(1000).nullable().default(null),
});
export type AutorizatieIscirNouaInput = z.output<typeof autorizatieIscirNouaSchema>;
