// src/schemas/salary-component.ts
import { z } from "zod";

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

const dataObligatorie = (camp: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, `Câmpul „${camp}” trebuie completat în formatul AAAA-LL-ZZ.`);

const dataOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || /^\d{4}-\d{2}-\d{2}$/u.test(valoare),
    "Data trebuie scrisă în formatul AAAA-LL-ZZ.",
  );

/** Oglinda enum-ului public.salary_component_kind din 0004_hr.sql. */
export const TIPURI_COMPONENTA_SALARIALA = [
  "spor_procent",
  "spor_suma",
  "indemnizatie",
  "prima_recurenta",
  "beneficiu_natura",
] as const;
export type TipComponentaSalariala = (typeof TIPURI_COMPONENTA_SALARIALA)[number];

// ── Șabloane (salary_component_types) — reutilizabile la nivel de organizație ──

export const creeazaSablonComponentaSchema = z.object({
  cod: z.string().trim().min(1, "Codul este obligatoriu.").max(40),
  denumire: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(160),
  kind: z.enum(TIPURI_COMPONENTA_SALARIALA, "Alegeți tipul componentei."),
  impozabil: z.coerce.boolean().default(true),
  intra_in_baza_cas: z.coerce.boolean().default(true),
  intra_in_baza_cass: z.coerce.boolean().default(true),
  cod_revisal: textOptional(40),
});

export const actualizeazaSablonComponentaSchema = creeazaSablonComponentaSchema
  .omit({ cod: true, kind: true })
  .extend({ id: z.uuid("Șablonul selectat nu este valid.") });

export const dezactiveazaSablonComponentaSchema = z.object({
  id: z.uuid("Șablonul selectat nu este valid."),
});

// ── Asocierea unui șablon unui angajat (salary_components) ─────────────────────

export const asociazaComponentaSchema = z
  .object({
    employee_id: z.uuid("Angajatul selectat nu este valid."),
    component_type_id: z.uuid("Alegeți un șablon de componentă."),
    kind: z.enum(TIPURI_COMPONENTA_SALARIALA, "Alegeți tipul componentei."),
    procent: z.coerce.number().min(0).max(300).nullable().default(null),
    suma: z.coerce.number().min(0).nullable().default(null),
    valabil_de_la: dataObligatorie("Valabil de la"),
    valabil_pana: dataOptionala,
    observatii: textOptional(500),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.kind === "spor_procent") {
      if (valoare.procent === null) {
        ctx.addIssue({
          code: "custom",
          path: ["procent"],
          message: "Un spor procentual are nevoie de procent.",
        });
      }
      if (valoare.suma !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["suma"],
          message: "Un spor procentual nu are sumă fixă.",
        });
      }
    } else {
      if (valoare.suma === null) {
        ctx.addIssue({
          code: "custom",
          path: ["suma"],
          message: "Această componentă are nevoie de o sumă fixă.",
        });
      }
      if (valoare.procent !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["procent"],
          message: "Doar sporul procentual folosește procent.",
        });
      }
    }
    if (valoare.valabil_pana !== null && valoare.valabil_pana < valoare.valabil_de_la) {
      ctx.addIssue({
        code: "custom",
        path: ["valabil_pana"],
        message: "Data de sfârșit nu poate fi înainte de data de început.",
      });
    }
  });

/**
 * `salary_components` nu are coloană `activ` — valabilitatea e un interval de
 * date. „Dezactivarea” înseamnă încheierea intervalului azi, nu un boolean.
 */
export const incheieComponentaAngajatSchema = z.object({
  id: z.uuid("Componenta selectată nu este validă."),
  employee_id: z.uuid("Angajatul selectat nu este valid."),
});
