// src/schemas/fleet-carduri.ts
// Validările de intrare pentru cardurile de combustibil și importul extraselor
// (0214, F12b).
//
// Fișier separat de `fleet.ts`, pe care îl scriu și fazele paralele ale
// flotei. Regulile de formă le repetă pe cele ale bazei (CHECK-urile `fcard_*`,
// `fcip_*`, `fctx_*`), ca omul să afle pe câmp, înainte de bază, ce nu se
// potrivește. Numărul întreg al cardului trece prin schemă DOAR ca să i se
// calculeze amprenta în acțiune: nu se salvează și nu intră în audit.

import { z } from "zod";

import {
  STATUSURI_CARD,
  cifreDeSalvat,
  cifreFinaleCard,
  ultimaZiALunii,
} from "@/domain/fleet/carduri/card";
import { CATEGORII_TRANZACTIE } from "@/domain/fleet/carduri/categorii";
import { CAMPURI_EXTRAS } from "@/domain/fleet/carduri/coloane";
import { FORMATE_DATA } from "@/domain/fleet/carduri/date";
import { EMITENTI_CARD } from "@/domain/fleet/carduri/emitenti";
import { STARI_POTRIVIRE } from "@/domain/fleet/carduri/potrivire";
import { lunaValida } from "@/domain/fleet/rapoarte";

import { enumOptional, numarOptional, optional, textOptional } from "./comun";

const MESAJ_EMITENT = "Alegeți emitentul cardului.";
const MESAJ_ID = "Identificatorul nu este valid.";

const id = z.uuid(MESAJ_ID);
const vehiculOptional = optional(z.uuid("Vehiculul ales nu este valid."));
const soferOptional = optional(z.uuid("Șoferul ales nu este valid."));

const emitent = z.enum(EMITENTI_CARD, MESAJ_EMITENT);

/**
 * Numărul tastat: ultimele 4–6 cifre sau numărul întreg (12–19 cifre), cu
 * spații sau cratime. Ieșirea e deja despărțită: cifrele de salvat și numărul
 * întreg (doar pentru amprentă, în memorie).
 */
const numarCard = z
  .string("Scrieți ultimele cifre sau numărul întreg al cardului.")
  .trim()
  .min(1, "Scrieți ultimele cifre sau numărul întreg al cardului.")
  .refine((v) => /^[0-9\s-]+$/u.test(v), "Numărul cardului are doar cifre, spații sau cratime.")
  .refine((v) => {
    const n = v.replace(/\D/gu, "").length;
    return (n >= 4 && n <= 6) || (n >= 12 && n <= 19);
  }, "Scrieți ultimele 4–6 cifre de pe card sau numărul întreg (12–19 cifre).")
  .transform((v) => {
    const cifre = cifreFinaleCard(v);
    // Refinarea de mai sus garantează cel puțin 4 cifre.
    const sigur = cifre ?? {
      finale: v.replace(/\D/gu, "").slice(-6),
      intreg: null,
    };
    return { ultimeleCifre: cifreDeSalvat(sigur), numarIntreg: sigur.intreg };
  });

const luna = numarOptional({
  min: 1,
  max: 12,
  intreg: true,
  mesaj: "Luna valabilității trebuie să fie un număr.",
  interval: "Luna valabilității e între 1 și 12.",
});
const an = numarOptional({
  min: 2000,
  max: 2100,
  intreg: true,
  mesaj: "Anul valabilității trebuie să fie un număr.",
  interval: "Anul valabilității e între 2000 și 2100.",
});

/** Câmpurile comune cardului nou și corecturii. */
const campuriCard = {
  denumire: textOptional(80),
  vehicle_id: vehiculOptional,
  employee_id: soferOptional,
  valabil_luna: luna,
  valabil_an: an,
  observatii: textOptional(1000),
};

type CuValabilitate = {
  readonly vehicle_id: string | null;
  readonly employee_id: string | null;
  readonly valabil_luna: number | null;
  readonly valabil_an: number | null;
};

function verificaCard(v: CuValabilitate, ctx: z.RefinementCtx): void {
  if (v.vehicle_id !== null && v.employee_id !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["tinta"],
      message: "Cardul e pe un vehicul sau pe un șofer, nu pe amândoi.",
    });
  }
  if ((v.valabil_luna === null) !== (v.valabil_an === null)) {
    ctx.addIssue({
      code: "custom",
      path: [v.valabil_luna === null ? "valabil_luna" : "valabil_an"],
      message: "Completați luna și anul valabilității împreună, sau niciunul.",
    });
  }
}

function valabilPana(v: CuValabilitate): string | null {
  return v.valabil_luna === null || v.valabil_an === null
    ? null
    : ultimaZiALunii(v.valabil_an, v.valabil_luna);
}

export const cardNouSchema = z
  .object({ emitent, numar: numarCard, ...campuriCard })
  .superRefine(verificaCard)
  .transform((v) => ({
    emitent: v.emitent,
    ultimeleCifre: v.numar.ultimeleCifre,
    numarIntreg: v.numar.numarIntreg,
    denumire: v.denumire,
    vehicle_id: v.vehicle_id,
    employee_id: v.employee_id,
    valabil_pana: valabilPana(v),
    observatii: v.observatii,
  }));
export type CardNou = z.output<typeof cardNouSchema>;

export const actualizeazaCardSchema = z
  .object({
    id,
    ...campuriCard,
    status: z.enum(STATUSURI_CARD, "Alegeți starea cardului."),
  })
  .superRefine(verificaCard)
  .transform((v) => ({
    id: v.id,
    denumire: v.denumire,
    vehicle_id: v.vehicle_id,
    employee_id: v.employee_id,
    valabil_pana: valabilPana(v),
    status: v.status,
    observatii: v.observatii,
  }));

export const stergeCardSchema = z.object({ id });

// ── Importul extraselor ────────────────────────────────────────────────────

export const pregatesteExtrasSchema = z.object({
  numeFisier: z.string().trim().min(1).max(255),
  dimensiune: z.number().int().positive(),
});

const coloanaFisier = z.string().trim().min(1).max(200);

/** Formatele și maparea alese de om în pasul „Mapare coloane”, sau salvate per firmă. */
export const profilExtrasSchema = z.object({
  mapare: z.partialRecord(z.enum(CAMPURI_EXTRAS), coloanaFisier),
  format_data: z.enum(FORMATE_DATA).default("auto"),
  separator_zecimal: z.enum(["auto", ",", "."]).default("auto"),
  delimitator: z.enum(["auto", ";", ",", "tab"]).default("auto"),
  codificare: z.enum(["auto", "utf-8", "windows-1250"]).default("auto"),
  rand_antet: z
    .number()
    .int()
    .min(1, "Rândul antetului e între 1 și 30.")
    .max(30, "Rândul antetului e între 1 și 30.")
    .default(1),
});
export type ProfilExtras = z.output<typeof profilExtrasSchema>;

export const analizeazaExtrasSchema = z.object({
  batchId: z.uuid(),
  cale: z.string().min(1).max(400),
  emitent,
  profil: profilExtrasSchema.nullable().default(null),
});

export const salveazaProfilSchema = z.object({
  emitent,
  profil: profilExtrasSchema,
});

export const aplicaExtrasSchema = z.object({
  batchId: z.uuid(),
  offset: z.number().int().min(0).max(1000),
});

export const anuleazaImportSchema = z.object({ id });

/**
 * Un rând al lotului validat, așa cum stă în Storage între previzualizare și
 * aplicare. Conținutul din Storage e tratat ca date externe: se revalidează la
 * graniță. FĂRĂ numere întregi de card: doar cifrele finale și amprenta HMAC.
 */
export const randLotSchema = z.object({
  rand: z.number().int().min(1),
  cheie: z.string().min(4).max(200),
  idTranzactie: z.string().max(100).nullable(),
  cifreCard: z
    .string()
    .regex(/^[0-9]{4,6}$/u)
    .nullable(),
  amprentaCard: z
    .string()
    .regex(/^[0-9a-f]{64}$/u)
    .nullable(),
  nrInmatriculare: z.string().max(20).nullable(),
  efectuatLa: z.iso.datetime(),
  dataRo: z.iso.date(),
  areOra: z.boolean(),
  produs: z.string().min(1).max(120),
  categorie: z.enum(CATEGORII_TRANZACTIE),
  // Nu e câmp de formular: lotul din Storage, scris de server.
  tipCombustibil: z.union([z.enum(["benzina", "motorina", "gpl", "gnc"]), z.null()]),
  cantitate: z.number().min(-5000).max(5000).nullable(),
  pretUnitar: z.number().nullable(),
  valoareBruta: z.number(),
  valoareNeta: z.number().nullable(),
  tva: z.number().nullable(),
  moneda: z.string().regex(/^[A-Z]{3}$/u),
  statie: z.string().max(200).nullable(),
  localitate: z.string().max(120).nullable(),
  tara: z
    .string()
    .regex(/^[A-Z]{2}$/u)
    .nullable(),
  kmDeclarat: z.number().int().min(0).nullable(),
  numarBon: z.string().max(60).nullable(),
});
export type RandLot = z.output<typeof randLotSchema>;

export const lotExtrasSchema = z.object({
  versiune: z.literal(1),
  emitent,
  fisierNume: z.string().min(1).max(255),
  fisierSha256: z.string().regex(/^[0-9a-f]{64}$/u),
  perioadaDeLa: z.iso.date(),
  perioadaPanaLa: z.iso.date(),
  randuriFisier: z.number().int().min(0).max(1000),
  respinse: z.number().int().min(0),
  randuri: z.array(randLotSchema).max(1000),
});
export type LotExtras = z.output<typeof lotExtrasSchema>;

// ── Tranzacțiile ───────────────────────────────────────────────────────────

const lunaSchema = z
  .string("Alegeți luna.")
  .refine((v) => lunaValida(v), "Luna se scrie AAAA-LL, de exemplu 2026-09.");

export const filtreTranzactiiSchema = z.object({
  luna: lunaSchema,
  stare: enumOptional(STARI_POTRIVIRE, "Starea aleasă nu există."),
  card: z.uuid().nullable().default(null),
  vehicul: z.uuid().nullable().default(null),
  cursor: z.string().max(400).nullable().default(null),
  limita: z.union([z.literal(25), z.literal(50), z.literal(100)]).default(50),
});
export type FiltreTranzactii = z.output<typeof filtreTranzactiiSchema>;

export const leagaTranzactieSchema = z.object({
  id,
  fuel_entry_id: z.uuid("Alegeți alimentarea de pe foaie."),
});

export const ignoraTranzactieSchema = z.object({
  id,
  nota: z
    .string("Spuneți de ce ignorați tranzacția.")
    .trim()
    .min(3, "Spuneți de ce ignorați tranzacția, în cel puțin 3 caractere.")
    .max(1000, "Nota are cel mult 1000 de caractere."),
});

export const repotrivesteSchema = z.object({ luna: lunaSchema });
