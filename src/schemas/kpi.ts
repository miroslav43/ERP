// src/schemas/kpi.ts
import { z } from "zod";

import {
  enumOptional,
  jsonDinFormData,
  numarObligatoriu,
  numarOptional,
  textOptional,
} from "./comun";

import { SENSURI_KPI, TIPURI_INDICATOR_KPI } from "@/domain/evaluations/kpi-vocabular";

/** Aceleași patru scale ca la evaluarea anuală — vezi `criteriuSablonSchema`. */
export const SCALE_KPI = [3, 4, 5, 10] as const;

/**
 * Plafonul de indicatori pe set.
 *
 * Nu e o limită tehnică, ci una de citit: formularul lunii se completează de un
 * manager pe telefon, iar un set de 40 de linii nu se completează niciodată
 * până la capăt. Constrângerea de bază (`kpi_indicatori_cod_uniq`) n-o impune;
 * dacă cineva o ocolește, singurul efect e un ecran greu, nu date stricate.
 */
export const MAXIM_INDICATORI_KPI = 20;

/**
 * Un indicator din set.
 *
 * Forma e discriminată pe `tip`, EXACT ca `kpi_indicatori_forma` din
 * `0119_kpi_lunar.sql`. Câmpurile care nu aparțin tipului se anulează prin
 * `transform`, nu prin validare: un client care trimite `scala_max` pe un
 * indicator măsurat n-a greșit nimic ce ar putea repara un utilizator — a
 * trimis doar o valoare rămasă în formular la comutarea tipului. Ce NU se poate
 * deduce (sensul, ținta, scala) se cere, cu mesaj pe câmpul lui.
 */
export const indicatorKpiSchema = z
  .object({
    // `null`, nu `undefined`: `exactOptionalPropertyTypes` face distincția, iar
    // `completeazaCoduri` cere `cod?: string | null`. Aceeași formă ca
    // `enumOptional` din `comun.ts` — golul se normalizează, nu se propagă.
    cod: z
      .union([
        z.string().regex(/^[a-z0-9_]{2,60}$/, "Codul indicatorului nu este valid."),
        z.literal(""),
        z.null(),
        z.undefined(),
      ])
      .transform((v): string | null => (v === "" || v === undefined || v === null ? null : v))
      .default(null as never),
    denumire: z
      .string()
      .trim()
      .min(2, "Denumirea indicatorului are cel puțin 2 caractere.")
      .max(160, "Denumirea indicatorului are cel mult 160 de caractere."),
    descriere: textOptional(1000),
    tip: z.enum(TIPURI_INDICATOR_KPI, "Alegeți tipul indicatorului."),
    unitate: textOptional(24),
    sens: enumOptional(SENSURI_KPI, "Sensul indicatorului nu este valid."),
    tinta_implicita: numarOptional({
      mesaj: "Ținta trebuie să fie un număr.",
      interval: "Ținta este în afara intervalului acceptat.",
      min: -1_000_000_000,
      max: 1_000_000_000,
    }),
    scala_max: numarOptional({
      mesaj: "Scala trebuie să fie un număr.",
      interval: "Scala poate fi 3, 4, 5 sau 10.",
      min: 3,
      max: 10,
      intreg: true,
    }),
    pondere: numarObligatoriu({
      mesaj: "Ponderea trebuie să fie un număr.",
      lipsa: "Puneți o pondere.",
      interval: "Ponderea este între 0 și 100.",
      min: 0,
      max: 100,
    }),
  })
  .superRefine((v, ctx) => {
    if (v.tip === "masurat") {
      if (v.sens === null) {
        ctx.addIssue({ code: "custom", path: ["sens"], message: "Alegeți sensul indicatorului." });
      }
      if (v.tinta_implicita === null) {
        ctx.addIssue({
          code: "custom",
          path: ["tinta_implicita"],
          message: "Puneți o țintă implicită pentru funcție.",
        });
      }
      return;
    }
    if (v.scala_max === null) {
      ctx.addIssue({ code: "custom", path: ["scala_max"], message: "Alegeți scala de notare." });
      return;
    }
    if (!(SCALE_KPI as readonly number[]).includes(v.scala_max)) {
      ctx.addIssue({
        code: "custom",
        path: ["scala_max"],
        message: "Scala poate fi 3, 4, 5 sau 10.",
      });
    }
  })
  .transform((v) =>
    v.tip === "masurat"
      ? { ...v, scala_max: null }
      : { ...v, sens: null, tinta_implicita: null, unitate: null },
  );

export type IndicatorKpiIntrare = z.infer<typeof indicatorKpiSchema>;

const listaIndicatori = jsonDinFormData(
  z
    .array(indicatorKpiSchema)
    .min(1, "Setul are nevoie de cel puțin un indicator.")
    .max(MAXIM_INDICATORI_KPI, `Un set are cel mult ${String(MAXIM_INDICATORI_KPI)} indicatori.`),
);

// ── Seturi ────────────────────────────────────────────────────────────────────

export const creeazaSetKpiSchema = z.object({
  // Text, nu uuid: funcția stă pe fișă ca text din 0110 (`employees.functie`).
  functie: z
    .string()
    .trim()
    .min(2, "Scrieți funcția pentru care se face setul.")
    .max(160, "Funcția are cel mult 160 de caractere."),
  denumire: z
    .string()
    .trim()
    .min(2, "Denumirea setului are cel puțin 2 caractere.")
    .max(160, "Denumirea setului are cel mult 160 de caractere."),
  descriere: textOptional(2000),
  indicatori: listaIndicatori,
});

/**
 * Funcția nu se schimbă la editare.
 *
 * Mutarea unui set de pe „Agent vânzări" pe „Șofer" ar fi rescris retroactiv
 * cine e măsurat cu el, iar lunile deja deschise ar fi rămas legate de un set
 * care nu mai descrie postul lor. Se face un set nou pe funcția nouă.
 */
export const actualizeazaSetKpiSchema = z.object({
  id: z.uuid("Setul selectat nu este valid."),
  denumire: z
    .string()
    .trim()
    .min(2, "Denumirea setului are cel puțin 2 caractere.")
    .max(160, "Denumirea setului are cel mult 160 de caractere."),
  descriere: textOptional(2000),
  indicatori: listaIndicatori,
});

export const arhiveazaSetKpiSchema = z.object({
  id: z.uuid("Setul selectat nu este valid."),
});

// ── Ținte per angajat ─────────────────────────────────────────────────────────

export const seteazaTintaKpiSchema = z.object({
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  indicator_id: z.uuid("Indicatorul selectat nu este valid."),
  tinta: numarObligatoriu({
    mesaj: "Ținta trebuie să fie un număr.",
    lipsa: "Puneți o țintă.",
    interval: "Ținta este în afara intervalului acceptat.",
    min: -1_000_000_000,
    max: 1_000_000_000,
  }),
  motiv: textOptional(500),
});

export const stergeTintaKpiSchema = z.object({
  id: z.uuid("Ținta selectată nu este validă."),
});

// ── Luna ──────────────────────────────────────────────────────────────────────

export const deschideLunaKpiSchema = z.object({
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  an: numarObligatoriu({
    mesaj: "Anul trebuie să fie un număr.",
    lipsa: "Alegeți anul.",
    interval: "Anul este în afara intervalului acceptat.",
    min: 2000,
    max: 2100,
    intreg: true,
  }),
  luna: numarObligatoriu({
    mesaj: "Luna trebuie să fie un număr.",
    lipsa: "Alegeți luna.",
    interval: "Luna este între 1 și 12.",
    min: 1,
    max: 12,
    intreg: true,
  }),
});

/**
 * O linie completată.
 *
 * Se trimite `cod`, nu `id`: liniile sunt identificate în cadrul lunii prin
 * codul înghețat (`kpi_valori_uniq` e pe `evaluare_id, cod`), iar un id de rând
 * ar fi obligat clientul să știe ce s-a scris în bază la deschiderea lunii.
 *
 * `realizat` și `nota` sunt amândouă opționale la nivel de schemă: care dintre
 * ele se aplică depinde de tipul liniei DIN BAZĂ, pe care clientul n-are cum
 * să-l garanteze. Acțiunea alege, după instantaneul rândului.
 */
export const valoareKpiSchema = z.object({
  cod: z.string().regex(/^[a-z0-9_]{2,60}$/, "Codul indicatorului nu este valid."),
  realizat: numarOptional({
    mesaj: "Valoarea realizată trebuie să fie un număr.",
    interval: "Valoarea realizată este în afara intervalului acceptat.",
    min: -1_000_000_000,
    max: 1_000_000_000,
  }),
  nota: numarOptional({
    mesaj: "Nota trebuie să fie un număr.",
    interval: "Nota este în afara scalei.",
    min: 0,
    max: 10,
    intreg: true,
  }),
  comentariu: textOptional(1000),
});

export const salveazaLunaKpiSchema = z.object({
  id: z.uuid("Luna selectată nu este validă."),
  valori: jsonDinFormData(z.array(valoareKpiSchema).max(MAXIM_INDICATORI_KPI)),
  concluzie: textOptional(4000),
});

export const finalizeazaLunaKpiSchema = z.object({
  id: z.uuid("Luna selectată nu este validă."),
});
