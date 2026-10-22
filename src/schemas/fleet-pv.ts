// src/schemas/fleet-pv.ts
//
// Schemele procesului-verbal de predare-primire a vehiculului (0215, F12c).
//
// Fișier propriu, nu adăugiri în `fleet.ts`: celelalte extensii ale flotei
// editează fișierul mare în paralel (decizia DL13).
//
// NICIO schemă nu poartă coloanele pe care le scrie baza: `sofer_employee_id`
// (GENERATED: trimis, dă 428C9 — capcana 30), `tip`, `moment`, `data_pv`,
// părțile, `numar`, `numar_registru`, `snapshot`, `finalizat_*`,
// `confirmat_*_de`. `vehicle_id` apare doar ca să se poată declara `revalidate`;
// baza îl rescrie din alocare.
import { z } from "zod";

import {
  ANVELOPE_PV,
  DOCUMENTE_BORD_PV,
  DOTARI_PV,
  MAXIM_DAUNE,
  NIVELURI_REZERVOR,
  STARI_GENERALE,
  ZONE_DAUNA,
} from "@/domain/fleet/proces-verbal";

import { enumOptional, jsonDinFormData, numarOptional } from "./comun";
import { confirmaScanareSchema, pregatesteScanareSchema } from "./fleet";

/** O listă de coduri, fără dubluri (o bifă trimisă de două ori e tot o bifă). */
const coduri = <const T extends readonly [string, ...string[]]>(valori: T) =>
  z
    .array(z.enum(valori, "Codul ales nu e în listă."))
    .max(valori.length)
    .default([])
    .transform((lista) => [...new Set(lista)]);

const daunaSchema = z.object({
  zona: z.enum(ZONE_DAUNA, "Alegeți zona daunei."),
  descriere: z
    .string()
    .trim()
    .min(1, "Descrieți dauna.")
    .max(300, "Descrierea daunei are cel mult 300 de caractere."),
});

/**
 * „S-au constatat daune?” vine din `FormData` ca „da”, „nu” sau lipsește.
 * Absența NU e `false`: pe hârtia semnată, un rând gol nu înseamnă „nu există”
 * (capcana bifei din `valori-vehicul.ts`, în sens invers).
 */
const daDaNu = z
  .union([z.boolean(), z.enum(["da", "nu"]), z.literal(""), z.null(), z.undefined()])
  .transform((v): boolean | null =>
    v === "da" || v === true ? true : v === "nu" || v === false ? false : null,
  )
  .default(null as never);

const constatari = {
  km_bord: numarOptional({
    min: 0,
    max: 5_000_000,
    intreg: true,
    mesaj: "Scrieți kilometrajul de la bord, în km.",
    interval: "Kilometrajul se scrie în km întregi.",
  }),
  nivel_rezervor: enumOptional(NIVELURI_REZERVOR, "Alegeți nivelul din rezervor."),
  numar_chei: numarOptional({
    min: 0,
    max: 10,
    intreg: true,
    mesaj: "Scrieți numărul de chei.",
    interval: "Numărul de chei e între 0 și 10.",
  }),
  stare_generala: enumOptional(STARI_GENERALE, "Alegeți starea generală."),
  anvelope: enumOptional(ANVELOPE_PV, "Alegeți tipul anvelopelor."),
  documente_bord: coduri(DOCUMENTE_BORD_PV),
  dotari: coduri(DOTARI_PV),
  daune_constatate: daDaNu,
  daune: jsonDinFormData(
    z
      .array(daunaSchema)
      .max(MAXIM_DAUNE, `Cel mult ${String(MAXIM_DAUNE)} de daune pe un proces-verbal.`),
  ).default([]),
  observatii: z
    .string()
    .trim()
    .max(2000, "Observațiile au cel mult 2000 de caractere.")
    .nullable()
    .default(null)
    .transform((v) => (v === null || v.length === 0 ? null : v)),
};

type Constatari = Readonly<{
  daune_constatate: boolean | null;
  daune: readonly unknown[];
}>;

/** `false` ⇔ listă goală, `true` ⇔ cel puțin o daună: oglinda lui `pvv_daune_coerente_ck`. */
function daunelePotrivite(date: Constatari, ctx: z.RefinementCtx): void {
  if (date.daune_constatate === false && date.daune.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["daune"],
      message: "Ați ales „fără daune”, dar lista are daune. Ștergeți-le sau alegeți „Da”.",
    });
  }
  if (date.daune_constatate === true && date.daune.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["daune"],
      message: "Ați ales că s-au constatat daune: adăugați cel puțin una.",
    });
  }
}

export const constatariPvSchema = z.object(constatari).superRefine(daunelePotrivite);
export type ConstatariPv = z.output<typeof constatariPvSchema>;

export const pvNouSchema = z
  .object({
    ...constatari,
    alocare_predata_id: z.uuid().nullable().default(null),
    alocare_primita_id: z.uuid().nullable().default(null),
    vehicle_id: z.uuid(),
  })
  .superRefine(daunelePotrivite)
  .refine((v) => v.alocare_predata_id !== null || v.alocare_primita_id !== null, {
    message: "Procesul-verbal se întocmește dintr-o predare sau dintr-o restituire.",
    path: ["alocare_primita_id"],
  })
  .refine((v) => v.alocare_predata_id !== v.alocare_primita_id, {
    message: "Alocarea predată și cea primită nu pot fi aceeași.",
    path: ["alocare_primita_id"],
  });
export type PvNou = z.output<typeof pvNouSchema>;

export const actualizeazaPvSchema = z
  .object({ ...constatari, id: z.uuid(), vehicle_id: z.uuid() })
  .superRefine(daunelePotrivite);
export type ActualizarePv = z.output<typeof actualizeazaPvSchema>;

/**
 * Câmpurile obligatorii la finalizare le cere BAZA (P0001 pe câmp, tradus de
 * `pv/erori.ts`): Zod nu dublează regula, ca să nu poată diverge de ea.
 */
export const finalizeazaPvSchema = z.object({ id: z.uuid(), vehicle_id: z.uuid() });

export const anuleazaPvSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
  motiv_anulare: z
    .string("Scrieți motivul anulării.")
    .trim()
    .min(10, "Motivul anulării are cel puțin 10 caractere.")
    .max(500, "Motivul anulării are cel mult 500 de caractere."),
});

export const stergePvSchema = z.object({ id: z.uuid(), vehicle_id: z.uuid() });

export const confirmaPvSchema = z.object({ id: z.uuid() });

/**
 * Scanul hârtiei semnate (0215, sub-commitul 8.8): aceleași câmpuri declarate
 * ca la scanarea documentelor de vehicul (0202), pe id-ul PV-ului. Fișierul
 * urmează regulile bucketului `org-flota` (`verificaFisierFlota`).
 */
export const pregatesteScanPvSchema = pregatesteScanareSchema
  .omit({ document_id: true })
  .extend({ id: z.uuid() });

export const confirmaScanPvSchema = confirmaScanareSchema
  .omit({ document_id: true })
  .extend({ id: z.uuid() });
