// src/schemas/fleet-contabil.ts
//
// Parametrii exportului contabil al flotei (F12g), din adresa unei cereri GET.
//
// ── DE CE O CONFIGURARE GREȘITĂ DĂ 400, NU VALOAREA IMPLICITĂ (L17) ─────────
// Un filtru greșit poate cădea pe implicit (`filtreDinUrl`); un cont greșit nu:
// ar intra tăcut în balanța contabilului. Implicitele se aplică doar unui
// parametru ABSENT; unul prezent și invalid oprește cererea, cu motivul.
//
// ── CAPCANA BIFEI NEBIFATE ──────────────────────────────────────────────────
// Un checkbox nebifat LIPSEȘTE din cerere. Cu `.default("da")`, debifarea ar
// ajunge la rută ca absență, adică „da”. De aceea câmpurile da/nu sunt perechi
// de radio în formular (una mereu bifată), iar aici rămân enumuri explicite.
import { z } from "zod";

import { lunaValida } from "@/domain/fleet/rapoarte";
import { CONFIGURARE_IMPLICITA, type ConfigurareExport } from "@/domain/fleet/contabil/configurare";
import type { OptiuniCsv } from "@/domain/fleet/contabil/csv";
import { FORMATE_EXPORT } from "@/domain/fleet/contabil/formate";
import type { DateString } from "@/lib/format/date";

import "./mesaje-zod";

const cont = z
  .string()
  .trim()
  .max(20, "Contul are cel mult 20 de caractere.")
  .regex(/^[0-9]{3,6}(\.[0-9A-Za-z]{1,10})*$/u, "Contul se scrie ca 6022 sau 6022.01.");

const daNu = z.enum(["da", "nu"], { error: "Se alege „da” sau „nu”." });

const C = CONFIGURARE_IMPLICITA;

/** Câmpurile formularului, cu valorile implicite din `CONFIGURARE_IMPLICITA`. */
const campuri = {
  luna: z.string({ error: "Alegeți luna." }).refine(lunaValida, "Luna se scrie AAAA-LL."),
  format: z.enum(FORMATE_EXPORT, { error: "Alegeți formatul fișierului." }),
  doar_aprobate: daNu.default(C.doarAprobate ? "da" : "nu"),
  include_service: daNu.default(C.includeService ? "da" : "nu"),
  cont_combustibil: cont.default(C.conturi.combustibil),
  cont_revizie_reparatii: cont.default(C.conturi.revizie_reparatii),
  cont_anvelope: cont.default(C.conturi.anvelope),
  cont_daune: cont.default(C.conturi.daune),
  cont_parcare: cont.default(C.conturi.parcare),
  cont_spalatorie: cont.default(C.conturi.spalatorie),
  cont_taxe_drum: cont.default(C.conturi.taxe_drum),
  cont_altele: cont.default(C.conturi.altele),
  cont_decontare: cont.default(C.contDecontare),
  cont_tva_deductibil: cont.default(C.contTvaDeductibil),
  tva_nedeductibila: z
    .enum(["pe_cheltuiala", "cont_separat"], { error: "Alegeți unde merge TVA-ul nedeductibil." })
    .default(C.tvaNedeductibila),
  cont_tva_nedeductibila: cont.default(C.contTvaNedeductibila),
  regim_implicit: z
    .enum(["limitat_50", "integral"], { error: "Alegeți regimul implicit." })
    .default(C.regimImplicit),
  wm_partener_dupa_cui: daNu.default("da"),
  csv_separator: z
    .enum(["punct_si_virgula", "virgula"], { error: "Alegeți separatorul." })
    .default("punct_si_virgula"),
  csv_zecimale: z
    .enum(["virgula", "punct"], { error: "Alegeți separatorul zecimal." })
    .default("virgula"),
};

/** Numele câmpurilor, în ordinea formularului (și a memoriei din browser). */
export const CAMPURI_EXPORT_CONTABIL = Object.keys(campuri) as readonly (keyof typeof campuri)[];

/**
 * Schema la o zi dată: luna nu poate fi în viitor față de `azi` (ziua din
 * România, primită ca parametru, ca testul să nu depindă de ceas).
 */
export function schemaExportLa(azi: DateString) {
  return z.object(campuri).superRefine((v, ctx) => {
    if (v.luna > azi.slice(0, 7)) {
      ctx.addIssue({ code: "custom", path: ["luna"], message: "Luna aleasă e în viitor." });
    }
    if (v.csv_separator === "virgula" && v.csv_zecimale === "virgula") {
      ctx.addIssue({
        code: "custom",
        path: ["csv_zecimale"],
        message: "Cu virgula ca separator de coloane, zecimalele se scriu cu punct.",
      });
    }
  });
}

export type ExportContabilFlota = z.output<ReturnType<typeof schemaExportLa>>;

/** Parametrii validați → configurarea modelului. */
export function configurareDinCerere(v: ExportContabilFlota): ConfigurareExport {
  return {
    conturi: {
      combustibil: v.cont_combustibil,
      revizie_reparatii: v.cont_revizie_reparatii,
      anvelope: v.cont_anvelope,
      daune: v.cont_daune,
      parcare: v.cont_parcare,
      spalatorie: v.cont_spalatorie,
      taxe_drum: v.cont_taxe_drum,
      altele: v.cont_altele,
    },
    contDecontare: v.cont_decontare,
    contTvaDeductibil: v.cont_tva_deductibil,
    tvaNedeductibila: v.tva_nedeductibila,
    contTvaNedeductibila: v.cont_tva_nedeductibila,
    regimImplicit: v.regim_implicit,
    doarAprobate: v.doar_aprobate === "da",
    includeService: v.include_service === "da",
    coeficientTva: CONFIGURARE_IMPLICITA.coeficientTva,
  };
}

export function optiuniCsvDinCerere(v: ExportContabilFlota): OptiuniCsv {
  return {
    separator: v.csv_separator === "virgula" ? "," : ";",
    zecimale: v.csv_zecimale === "punct" ? "." : ",",
  };
}

/** Motivele unei validări picate, câte unul pe linie, cu numele câmpului. */
export function motiveZod(eroare: z.ZodError): string {
  return eroare.issues
    .map((i) => `${i.path.length > 0 ? `${i.path.join(".")}: ` : ""}${i.message}`)
    .join("\n");
}
