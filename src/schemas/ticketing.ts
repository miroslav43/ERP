// src/schemas/ticketing.ts
// Intrările modulului de ticketing.
//
// Fiecare tip de tichet are formularul lui — nu unul generic cu câmpuri
// opționale. `creeazaTichetSchema` e o uniune discriminată pe `tip`, ceea ce
// face imposibil, la nivel de tipuri, să trimiți un `numar_licente` pe o
// defecțiune sau o `adresa_livrare` pe un bug.
//
// Regulile de aici oglindesc CHECK-urile din 0045_ticketing_it.sql. Baza rămâne
// autoritatea; Zod există ca utilizatorul să primească un mesaj în română, pe
// câmpul potrivit, în loc de o violare de constrângere.
import { z } from "zod";

import { STATUSURI_TICHET, TIPURI_TICHET } from "@/domain/ticketing/stari";
import { PRIORITATI } from "@/domain/ticketing/prioritate";

export const LOCURI_LIVRARE = ["birou", "domiciliu"] as const;
export type LocLivrare = (typeof LOCURI_LIVRARE)[number];

const titlu = z
  .string()
  .trim()
  .min(3, "Titlul trebuie să aibă cel puțin 3 caractere.")
  .max(200, "Titlul poate avea cel mult 200 de caractere.");

const descriere = z
  .string()
  .trim()
  .min(3, "Descrierea trebuie să aibă cel puțin 3 caractere.")
  .max(8000, "Descrierea poate avea cel mult 8000 de caractere.");

const textScurt = (max: number, eticheta: string) =>
  z.string().trim().min(2, `${eticheta} este obligatoriu.`).max(max);

const uuid = z.uuid("Identificator invalid.");

/** Cerere de software: aplicația și de ce e nevoie de ea. */
export const tichetSoftwareSchema = z.object({
  tip: z.literal("software"),
  titlu,
  descriere,
  aplicatie: textScurt(160, "Denumirea aplicației"),
  motiv_necesitate: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  numar_licente: z.coerce
    .number("Numărul de licențe trebuie să fie un număr.")
    .int("Numărul de licențe trebuie să fie întreg.")
    .min(1, "Este nevoie de cel puțin o licență.")
    .max(10000, "Numărul de licențe pare greșit."),
});

/**
 * Cerere de hardware: ceva ce angajatul NU are încă. Nu referă un obiect de
 * inventar — de asta nu există aici `inventory_item_id`.
 */
export const tichetHardwareSchema = z
  .object({
    tip: z.literal("hardware"),
    titlu,
    descriere,
    denumire_hardware: textScurt(200, "Denumirea echipamentului"),
    loc_livrare: z.enum(LOCURI_LIVRARE, "Alegeți locul de livrare."),
    adresa_livrare: z
      .string()
      .trim()
      .max(400)
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
  })
  .superRefine((valori, ctx) => {
    // Echipamentul care pleacă din sediu are nevoie de o adresă. Aceeași regulă
    // e și în `tickets_hardware_ck`; aici doar ajunge pe câmpul potrivit.
    if (valori.loc_livrare === "domiciliu" && (valori.adresa_livrare ?? "").length < 5) {
      ctx.addIssue({
        code: "custom",
        message: "Pentru livrare la domiciliu, adresa este obligatorie.",
        path: ["adresa_livrare"],
      });
    }
  });

/**
 * Defecțiune: obiectul se alege DIN inventarul alocat angajatului, iar
 * explicația merge în `descriere`. Fără text liber pentru obiect — dacă ceva
 * lipsește din inventar, se înregistrează acolo întâi.
 */
export const tichetDefectiuneSchema = z.object({
  tip: z.literal("defectiune"),
  titlu,
  descriere,
  inventory_item_id: uuid,
  blocheaza_activitatea: z.boolean(),
  locatie: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

/**
 * Bug în ERP. Cele trei câmpuri sunt separate deliberat: „ce ai făcut / ce te
 * așteptai / ce s-a întâmplat” produce rapoarte utilizabile, un singur câmp
 * liber produce „nu merge”.
 */
export const tichetBugSchema = z.object({
  tip: z.literal("bug_erp"),
  titlu,
  descriere,
  modul: textScurt(80, "Modulul"),
  pasi_efectuati: z.string().trim().min(3, "Descrieți ce ați făcut.").max(4000),
  rezultat_asteptat: z.string().trim().min(3, "Descrieți ce vă așteptați.").max(4000),
  rezultat_obtinut: z.string().trim().min(3, "Descrieți ce s-a întâmplat.").max(4000),
  // Capturat automat de client, invizibil pentru angajat. Nu e „de încredere”:
  // e context de diagnostic, nu bază pentru vreo decizie.
  context: z
    .object({
      url: z.string().max(2000).optional(),
      user_agent: z.string().max(500).optional(),
      versiune: z.string().max(50).optional(),
    })
    .optional(),
});

export const creeazaTichetSchema = z.discriminatedUnion("tip", [
  tichetSoftwareSchema,
  tichetHardwareSchema,
  tichetDefectiuneSchema,
  tichetBugSchema,
]);
export type CreeazaTichetInput = z.infer<typeof creeazaTichetSchema>;

/** Decizia pe o cerere. Respingerea cere motiv — cerință explicită. */
export const decideTichetSchema = z
  .object({
    ticket_id: uuid,
    aprobat: z.boolean(),
    motiv: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
  })
  .superRefine((valori, ctx) => {
    if (!valori.aprobat && (valori.motiv ?? "").length < 3) {
      ctx.addIssue({
        code: "custom",
        message: "Respingerea cere un motiv.",
        path: ["motiv"],
      });
    }
  });
export type DecideTichetInput = z.infer<typeof decideTichetSchema>;

export const schimbaStatusSchema = z.object({
  ticket_id: uuid,
  status: z.enum(STATUSURI_TICHET, "Status necunoscut."),
});

export const comentariuSchema = z.object({
  ticket_id: uuid,
  continut: z
    .string()
    .trim()
    .min(1, "Comentariul nu poate fi gol.")
    .max(8000, "Comentariul e prea lung."),
  /** Nota internă nu e vizibilă solicitantului — separarea e impusă în RLS. */
  intern: z.boolean().default(false),
});
export type ComentariuInput = z.infer<typeof comentariuSchema>;

/** Suprascrierea priorității de către IT. Cere justificare, ca să rămână în istoric. */
export const suprascriePrioritateaSchema = z.object({
  ticket_id: uuid,
  prioritate: z.enum(PRIORITATI, "Prioritate necunoscută."),
  motiv: z.string().trim().min(3, "Suprascrierea priorității cere o justificare.").max(2000),
});

export const asigneazaSchema = z.object({
  ticket_id: uuid,
  asignat_employee_id: uuid.nullable(),
});

export const marcheazaDuplicatSchema = z.object({
  ticket_id: uuid,
  parent_ticket_id: uuid,
});

export const filtreTicheteSchema = z.object({
  tip: z.enum(TIPURI_TICHET).optional(),
  status: z.enum(STATUSURI_TICHET).optional(),
  prioritate: z.enum(PRIORITATI).optional(),
  asignat_employee_id: uuid.optional(),
  department_id: uuid.optional(),
  cauta: z.string().trim().max(200).optional(),
});
export type FiltreTichete = z.infer<typeof filtreTicheteSchema>;

/** Aplicarea unui macro: scrie răspunsul și mută starea, dintr-un click. */
export const aplicaMacroSchema = z.object({
  ticket_id: uuid,
  cod: z.string().trim().min(2).max(40),
});

export const urmaresteSchema = z.object({
  ticket_id: uuid,
  employee_id: uuid,
});
