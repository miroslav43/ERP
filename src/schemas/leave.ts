// src/schemas/leave.ts
// Validările de intrare pentru modulul de concedii: cereri, decizii de aprobare, filtre.

import { z } from "zod";

// ── Enumerări în oglindă cu tipurile din 0009_leave.sql ──────────────────────

export const PORTIUNI_ZI = ["zi_intreaga", "prima_jumatate", "a_doua_jumatate"] as const;
export type PortiuneZi = (typeof PORTIUNI_ZI)[number];

export const STATUSURI_CERERE = [
  "ciorna",
  "trimisa",
  "in_aprobare",
  "aprobata",
  "respinsa",
  "anulata",
  "intrerupta",
] as const;
export type StatusCerere = (typeof STATUSURI_CERERE)[number];

export const STATUSURI_SARCINA_APROBARE = [
  "in_asteptare",
  "aprobata",
  "respinsa",
  "delegata",
  "expirata",
  "anulata",
] as const;
export type StatusSarcinaAprobare = (typeof STATUSURI_SARCINA_APROBARE)[number];

export const EVENIMENTE_SOLD = [
  "drept_initial",
  "acumulare_lunara",
  "reportare",
  "expirare_reportate",
  "consum",
  "restituire",
  "ajustare_manuala",
  "corectie_incadrare",
] as const;
export type EvenimentSold = (typeof EVENIMENTE_SOLD)[number];

export const TIPURI_ZI_ORGANIZATIE = ["liber_suplimentar", "zi_recuperare"] as const;
export type TipZiOrganizatie = (typeof TIPURI_ZI_ORGANIZATIE)[number];

// ── Helpere de câmp (copii locale — schemas/employee.ts nu le exportă) ───────

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

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

const listaStatusuriOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => {
    if (valoare === null || valoare.length === 0) return null;
    const bucati = valoare
      .split(",")
      .map((bucata) => bucata.trim())
      .filter((bucata) => bucata.length > 0);
    return bucati.length === 0 ? null : bucati;
  })
  .pipe(z.array(z.enum(STATUSURI_CERERE)).nullable());

// ── Filtre de listare (paginare keyset) ───────────────────────────────────────

export const filtreCereriSchema = z.object({
  status: listaStatusuriOptionala,
  leave_type_id: uuidOptional,
  employee_id: uuidOptional,
  de_la: dataOptionala,
  pana_la: dataOptionala,
  cursor: textOptional(400),
  limita: z.coerce.number().int().min(5).max(100).default(25),
});

export type FiltreCereri = z.infer<typeof filtreCereriSchema>;

// ── Cerere de concediu ────────────────────────────────────────────────────────

const ANUL_MINIM_CERERE = 2000;
const ANUL_MAXIM_CERERE = 2199;

export const creeazaCerereSchema = z
  .object({
    /** `null` = cererea e pentru mine însumi. */
    employee_id: uuidOptional,
    leave_type_id: z.uuid("Tipul de concediu selectat nu este valid."),
    data_inceput: dataObligatorie("Data de început"),
    data_sfarsit: dataObligatorie("Data de sfârșit"),
    portiune_inceput: z.enum(PORTIUNI_ZI).default("zi_intreaga"),
    portiune_sfarsit: z.enum(PORTIUNI_ZI).default("zi_intreaga"),
    motiv: textOptional(1000),
    atasament_path: textOptional(500),
    trimite: z.coerce.boolean().default(false),
  })
  .superRefine((valoare, ctx) => {
    const anInceput = Number(valoare.data_inceput.slice(0, 4));
    const anSfarsit = Number(valoare.data_sfarsit.slice(0, 4));
    if (Number.isNaN(anInceput) || anInceput < ANUL_MINIM_CERERE || anInceput > ANUL_MAXIM_CERERE) {
      ctx.addIssue({
        code: "custom",
        path: ["data_inceput"],
        message: "Anul datei de început este în afara intervalului acceptat.",
      });
      return;
    }
    if (valoare.data_sfarsit < valoare.data_inceput) {
      ctx.addIssue({
        code: "custom",
        path: ["data_sfarsit"],
        message: "Data de sfârșit nu poate fi anterioară datei de început.",
      });
      return;
    }
    if (anInceput !== anSfarsit) {
      ctx.addIssue({
        code: "custom",
        path: ["data_sfarsit"],
        message:
          "Cererea nu poate traversa doi ani calendaristici — soldul se calculează separat pe fiecare an. Depuneți două cereri distincte, câte una pentru fiecare an.",
      });
    }
  });

export type CreeazaCerereInput = z.infer<typeof creeazaCerereSchema>;

export const anuleazaCerereSchema = z.object({
  id: z.uuid("Cererea selectată nu este validă."),
});

// ── Decizia de aprobare ───────────────────────────────────────────────────────

const LUNGIME_MINIMA_MOTIV_RESPINGERE = 5;

export const decideCerereSchema = z
  .object({
    taskId: z.uuid("Sarcina de aprobare selectată nu este validă."),
    decizie: z.enum(["aprobata", "respinsa"]),
    comentariu: textOptional(1000),
    motivRespingere: textOptional(500),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.decizie !== "respinsa") return;
    const lungime = (valoare.motivRespingere ?? "").trim().length;
    if (lungime < LUNGIME_MINIMA_MOTIV_RESPINGERE) {
      ctx.addIssue({
        code: "custom",
        path: ["motivRespingere"],
        message: `Motivul respingerii trebuie să aibă cel puțin ${String(LUNGIME_MINIMA_MOTIV_RESPINGERE)} caractere.`,
      });
    }
  });

export type DecideCerereInput = z.infer<typeof decideCerereSchema>;
