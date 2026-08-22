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
  procent_ore_suplimentare: z.coerce.number().min(0),
  valoare_tichet_masa: z.coerce.number().min(0),
  tichete_impozabile: z.coerce.boolean(),
  tichete_supuse_cass: z.coerce.boolean(),
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
