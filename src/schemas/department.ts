// src/schemas/department.ts
import { z } from "zod";

const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

const uuidOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || z.uuid().safeParse(valoare).success,
    "Departamentul superior selectat nu este valid.",
  );

/**
 * Consimțământul pentru mutarea managerului în departamentul pe care îl preia.
 *
 * ── DE CE IMPLICITUL E `false`, DEȘI BIFA APARE PORNITĂ ───────────────────
 * Bifa din formular vine pornită, fiindcă asta așteaptă omul: cine conduce un
 * departament face parte din el. Dar implicitul SCHEMEI e opusul, și diferența
 * nu e o scăpare.
 *
 * Câmpul dezleagă o scriere pe fișa ALTCUIVA — un angajat pleacă dintr-un
 * departament și intră în altul, iar efectivul vechi scade. Un apelant care
 * omite câmpul (un POST direct către acțiune, un test, codul de peste șase luni)
 * n-are voie să declanșeze mutarea din tăcere. Consimțământul se TRIMITE, nu se
 * presupune; interfața îl trimite explicit, după ce a arătat unde e omul acum.
 *
 * Cazul „manager nerepartizat" nu trece pe aici deloc: acolo nu se pierde nicio
 * apartenență, deci `decideApartenentaManagerului` repartizează fără să întrebe.
 */
const consimtamantMutareManager = z
  .union([z.boolean(), z.literal("on"), z.literal("")])
  .default(false)
  .transform((valoare) => valoare === true || valoare === "on");

export const creeazaDepartamentSchema = z.object({
  cod: z.string().trim().min(1, "Codul departamentului este obligatoriu.").max(32),
  denumire: z.string().trim().min(2, "Denumirea trebuie să aibă cel puțin 2 caractere.").max(160),
  descriere: textOptional(1000),
  parent_id: uuidOptional,
  manager_employee_id: uuidOptional,
  cost_center: textOptional(40),
  muta_managerul_in_departament: consimtamantMutareManager,
});

export const actualizeazaDepartamentSchema = creeazaDepartamentSchema
  .omit({ cod: true })
  .extend({ id: z.uuid("Departamentul selectat nu este valid.") });

export const mutaDepartamentSchema = z.object({
  id: z.uuid("Departamentul selectat nu este valid."),
  parent_id: uuidOptional,
});

export const dezactiveazaDepartamentSchema = z.object({
  id: z.uuid("Departamentul selectat nu este valid."),
});
