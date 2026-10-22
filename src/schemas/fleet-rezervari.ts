// src/schemas/fleet-rezervari.ts
//
// Schemele rezervărilor mașinilor de pool (0216, F12d).
//
// Fișier propriu, nu adăugiri în `fleet.ts`: celelalte extensii ale flotei
// editează fișierul mare în paralel (decizia 12 a specificației).
//
// NICIO schemă nu poartă coloanele pe care le scrie baza: `status` la creare
// (îl pune triggerul), `decis_de`/`decis_la`, `anulat_de`/`anulat_la`.
// `vehicle_id` apare în tranziții doar ca să se poată declara `revalidate`.
// Durata maximă NU se verifică aici: e setare de firmă, o spune baza (P0001),
// iar caseta o arată din `setarileRezervarilor`.
import { z } from "zod";

import { REZERVARI_MAX_ZILE, STATUS_REZERVARE } from "@/domain/fleet/rezervari";

import { numarObligatoriu, optional, textOptional } from "./comun";

export { STATUS_REZERVARE, type StatusRezervare } from "@/domain/fleet/rezervari";

const MESAJ_INTERVAL = "Ultima zi nu poate fi înaintea primei zile.";

export const rezervareNouaSchema = z
  .object({
    vehicle_id: z.uuid("Alegeți mașina."),
    /**
     * `null` = „eu”: sub `vehicle_reservations:create = all` acțiunea rezolvă
     * fișa proprie pe server; sub `all`, un id trimis e fișa altcuiva și se
     * refuză înainte de bază (decizia 13).
     */
    employee_id: z.uuid("Alegeți angajatul.").nullable().default(null),
    de_la: z.iso.date("Alegeți prima zi."),
    pana_la: z.iso.date("Alegeți ultima zi."),
    scop: z
      .string("Scrieți scopul deplasării.")
      .trim()
      .min(3, "Scrieți scopul deplasării (cel puțin 3 caractere).")
      .max(300, "Scopul are cel mult 300 de caractere."),
    destinatie: textOptional(300),
    observatii: textOptional(1000),
  })
  .superRefine((v, ctx) => {
    if (v.pana_la < v.de_la) {
      ctx.addIssue({ code: "custom", path: ["pana_la"], message: MESAJ_INTERVAL });
    }
  });
export type RezervareNoua = z.output<typeof rezervareNouaSchema>;

export const decizieRezervareSchema = z
  .object({
    id: z.uuid(),
    vehicle_id: z.uuid(),
    decizie: z.enum(["confirmata", "respinsa"], "Alegeți decizia."),
    motiv: textOptional(500),
  })
  .superRefine((v, ctx) => {
    if (v.decizie === "respinsa" && v.motiv === null) {
      ctx.addIssue({
        code: "custom",
        path: ["motiv"],
        message: "Scrieți motivul respingerii; angajatul îl primește în notificare.",
      });
    }
  });
export type DecizieRezervare = z.output<typeof decizieRezervareSchema>;

export const anuleazaRezervareSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
  /** Obligatoriu când rezervarea nu e a ta: o cere baza (P0001 pe `motiv`). */
  motiv: textOptional(500),
});
export type AnuleazaRezervare = z.output<typeof anuleazaRezervareSchema>;

export const scurteazaRezervareSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
  pana_la: z.iso.date("Alegeți noua ultimă zi."),
});
export type ScurteazaRezervare = z.output<typeof scurteazaRezervareSchema>;

/**
 * Cele trei setări ale rezervărilor din `fleet_settings` (0216), adăugate la
 * `salveazaSetariFlota` (F5, `/flota/setari`), nu o acțiune nouă. OBLIGATORII,
 * nu cu implicit: o salvare a setărilor care le-ar omite le-ar readuce tăcut la
 * valorile implicite.
 */
export const campuriSetariRezervari = {
  rezervari_cu_aprobare: z.boolean(),
  rezervare_obligatorie: z.boolean(),
  rezervari_max_zile: numarObligatoriu({
    min: REZERVARI_MAX_ZILE.min,
    max: REZERVARI_MAX_ZILE.max,
    intreg: true,
    lipsa: "Scrieți durata maximă a unei rezervări, în zile.",
    mesaj: "Durata maximă se scrie în cifre.",
    interval: `Durata maximă e între ${String(REZERVARI_MAX_ZILE.min)} și ${String(REZERVARI_MAX_ZILE.max)} de zile.`,
  }),
} as const;

/** Filtrele listei, din URL. `stare` lipsă = toate. */
export const filtreRezervariSchema = z.object({
  stare: optional(z.enum(STATUS_REZERVARE)),
  vehicul: optional(z.uuid()),
  angajat: optional(z.uuid()),
  cursor: optional(z.string().max(256)),
});
export type FiltreRezervari = z.output<typeof filtreRezervariSchema>;
