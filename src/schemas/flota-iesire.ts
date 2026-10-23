// src/schemas/flota-iesire.ts
//
// Ieșirea vehiculului din parc (0218, F12h): asistentul „Scoate din parc”,
// anularea ieșirii și bifarea termenelor ei.
//
// Fișier propriu, nu adăugiri în `fleet.ts`: celelalte extensii ale flotei îl
// editează în paralel (F12h, Decizia 11). `superRefine` oglindește CHECK-urile
// din `vehicle_exits`, ca refuzul să ajungă pe câmp înainte de bază.
import { z } from "zod";

import { enumOptional, numarOptional, optional, textOptional } from "./comun";

/**
 * Valorile enumerate vin din `0218_flota_iesire_din_parc.sql`. Uniuni literale,
 * ca în `fleet.ts`: schemele validează și intrarea venită ca text.
 */
export const TIPURI_IESIRE = [
  "vanzare",
  "casare",
  "dauna_totala",
  "radiere",
  "restituire_leasing",
] as const;
export type TipIesire = (typeof TIPURI_IESIRE)[number];

/** Doar la `dauna_totala`: epava s-a vândut (vehiculul iese `vandut`) sau s-a casat. */
export const DESTINATII_EPAVA = ["instrainata", "casata"] as const;
export type DestinatieEpava = (typeof DESTINATII_EPAVA)[number];

/** Doar la `radiere`. */
export const MOTIVE_RADIERE = ["export", "furt", "retragere_depozitare"] as const;
export type MotivRadiere = (typeof MOTIVE_RADIERE)[number];

export const NATURI_TERMEN = ["legal", "recomandat"] as const;
export type NaturaTermen = (typeof NATURI_TERMEN)[number];

/** Vehiculul trece la altcineva: cumpărătorul și prețul au sens doar aici (`vexit_cumparator_ck`). */
export function eInstrainare(tip: TipIesire, destinatie: DestinatieEpava | null): boolean {
  return tip === "vanzare" || (tip === "dauna_totala" && destinatie === "instrainata");
}

/**
 * Păstrarea numărului are sens unde numărul rămâne al firmei: vânzare, casare,
 * daună totală, export (`vexit_pastreaza_ck`). La furt plăcuțele sunt furate,
 * la depozitare și la leasing nu se cere.
 */
export function permitePastrareaNumarului(tip: TipIesire, motiv: MotivRadiere | null): boolean {
  return (
    tip === "vanzare" ||
    tip === "casare" ||
    tip === "dauna_totala" ||
    (tip === "radiere" && motiv === "export")
  );
}

const motivText = (ce: string) =>
  z
    .string(`Scrieți ${ce}.`)
    .trim()
    .min(5, `Scrieți ${ce}, în cel puțin 5 caractere.`)
    .max(500, "Textul are cel mult 500 de caractere.");

/**
 * Scoaterea din parc. Data, tipul și kilometrajul nu se mai schimbă după
 * salvare (baza refuză): o greșeală se anulează și se reface.
 *
 * `km_iesire` gol rămâne `null`, nu `0` (`numarOptional`, nu `z.coerce`).
 */
export const iesireDinParcSchema = z
  .object({
    vehicle_id: z.uuid(),
    tip: z.enum(TIPURI_IESIRE, "Alegeți felul ieșirii din parc."),
    destinatie_epava: enumOptional(DESTINATII_EPAVA, "Alegeți ce s-a întâmplat cu epava."),
    motiv_radiere: enumOptional(MOTIVE_RADIERE, "Alegeți motivul radierii."),
    data_iesire: z.iso.date("Alegeți data ieșirii din parc."),
    km_iesire: numarOptional({
      min: 0,
      max: 5_000_000,
      intreg: true,
      mesaj: "Kilometrajul se scrie în cifre.",
      interval: "Kilometrajul se scrie în km întregi, între 0 și 5.000.000.",
    }),
    motiv: motivText("motivul ieșirii din parc"),
    cumparator: textOptional(200),
    pret: numarOptional({
      min: 0,
      max: 100_000_000,
      mesaj: "Prețul se scrie în cifre.",
      interval: "Prețul e între 0 și 100.000.000 de lei.",
    }),
    nr_document: textOptional(60),
    pastreaza_numarul: z.boolean().default(false),
    observatii: textOptional(1000),
    /**
     * Incidentul (F11) care a dus la dauna totală. Opțional; `vexit_incident_ck`
     * îl permite doar la `dauna_totala`, iar `internal.iesire_inainte` cere să
     * fie al aceluiași vehicul (P0001 „Incidentul ales…”).
     */
    incident_id: optional(z.uuid("Alegeți incidentul din listă.")),
  })
  .superRefine((v, ctx) => {
    if (v.tip !== "dauna_totala" && v.incident_id !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["incident_id"],
        message: "Incidentul se leagă doar la daună totală.",
      });
    }
    if (v.tip === "dauna_totala" && v.destinatie_epava === null) {
      ctx.addIssue({
        code: "custom",
        path: ["destinatie_epava"],
        message: "Alegeți ce s-a întâmplat cu epava.",
      });
    }
    if (v.tip !== "dauna_totala" && v.destinatie_epava !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["destinatie_epava"],
        message: "Destinația epavei se alege doar la daună totală.",
      });
    }
    if (v.tip === "radiere" && v.motiv_radiere === null) {
      ctx.addIssue({
        code: "custom",
        path: ["motiv_radiere"],
        message: "Alegeți motivul radierii.",
      });
    }
    if (v.tip !== "radiere" && v.motiv_radiere !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["motiv_radiere"],
        message: "Motivul radierii se alege doar la radiere.",
      });
    }
    const instrainare = eInstrainare(v.tip, v.destinatie_epava);
    if (!instrainare && v.cumparator !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["cumparator"],
        message: "Cumpărătorul se completează doar când vehiculul se vinde.",
      });
    }
    if (!instrainare && v.pret !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["pret"],
        message: "Prețul se completează doar când vehiculul se vinde.",
      });
    }
    if (v.pastreaza_numarul && !permitePastrareaNumarului(v.tip, v.motiv_radiere)) {
      ctx.addIssue({
        code: "custom",
        path: ["pastreaza_numarul"],
        message: "Păstrarea numărului nu se cere la acest fel de ieșire.",
      });
    }
  });
export type IesireDinParc = z.output<typeof iesireDinParcSchema>;

/**
 * Anularea ieșirii: vehiculul revine în parc, termenele ies din alerte.
 * `vehicle_id` e aici doar pentru `revalidate`; handlerul nu-l scrie.
 */
export const anuleazaIesireaSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
  motiv_anulare: motivText("de ce anulați ieșirea"),
});

/** „Făcut la …” sau „Nu se aplică”, pe un termen deschis. */
export const finalizeazaObligatiaSchema = z
  .object({
    id: z.uuid(),
    vehicle_id: z.uuid(),
    stare: z.enum(["facut", "nu_se_aplica"], "Alegeți dacă pasul s-a făcut sau nu se aplică."),
    finalizat_la: optional(z.iso.date("Alegeți data la care s-a făcut pasul.")),
    nota: textOptional(1000),
  })
  .superRefine((v, ctx) => {
    if (v.stare === "facut" && v.finalizat_la === null) {
      ctx.addIssue({
        code: "custom",
        path: ["finalizat_la"],
        message: "Alegeți data la care s-a făcut pasul.",
      });
    }
  });
export type FinalizeazaObligatia = z.output<typeof finalizeazaObligatiaSchema>;

export const redeschideObligatiaSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
});
