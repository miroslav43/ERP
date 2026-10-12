// src/schemas/fleet-service.ts
import { z } from "zod";

import { LIMITE_SERVICE as L } from "@/domain/fleet/service";

import {
  enumOptional,
  numarCuImplicit,
  numarObligatoriu,
  numarOptional,
  optional,
  textOptional,
} from "./comun";
import { ANVELOPE_MONTATE } from "./fleet";

/**
 * Service, costuri și anvelope (0203). Valorile enumerate vin din migrare
 * (`vehicle_service_type`, `vehicle_expense_category`); sunt scrise aici ca
 * uniuni literale, iar `etichete-service.test.ts` le lipește de hărțile de text.
 *
 * Limitele (km, intervale, lungimi) sunt `LIMITE_SERVICE` din domeniu — aceleași
 * cifre ca CHECK-urile bazei, lipite de migrare printr-un test: o schemă care
 * le-ar depăși ar da 23514 în loc de un mesaj pe câmp.
 *
 * Fiecare scriere poartă `vehicle_id`, chiar și ștergerea: `revalidate` are
 * nevoie de el ca să compună calea fișei (`/flota/<vehicul>`), iar acțiunea
 * primește doar `input`, nu și rândul din bază. Filtrarea scrierii se face pe
 * `id` + `organization_id`, nu pe `vehicle_id`.
 */

export const TIPURI_SERVICE = ["revizie", "reparatie", "anvelope", "dauna", "altele"] as const;
export type TipService = (typeof TIPURI_SERVICE)[number];

export const CATEGORII_CHELTUIALA = [
  "combustibil_fara_foaie",
  "parcare",
  "spalatorie",
  "taxa_drum",
  "taxa_pod",
  "tollro",
  "altele",
] as const;
export type CategorieCheltuiala = (typeof CATEGORII_CHELTUIALA)[number];

export type { AnvelopeMontate } from "./fleet";

const KM_MAX = L.kmMax.toLocaleString("ro-RO");

/** Kilometrajul de bord, în km întregi. */
const kilometri = (lipsa: string) =>
  numarObligatoriu({
    min: 0,
    max: L.kmMax,
    intreg: true,
    lipsa,
    mesaj: "Kilometrajul se scrie în cifre.",
    interval: `Kilometrajul se scrie în km întregi, între 0 și ${KM_MAX}.`,
  });

/** Zile dintr-un formular (`<input type="date">`): `YYYY-MM-DD`, nimic altceva. */
const zi = (lipsa: string) =>
  z
    .string({ error: lipsa })
    .trim()
    .min(1, lipsa)
    .pipe(z.iso.date({ error: "Data nu există în calendar. Scrieți ziua, luna și anul." }));

/**
 * Lei cu cel mult două zecimale: coloanele sunt `numeric(12,2)`, iar Postgres
 * ROTUNJEȘTE tăcut la inserare — omul ar vedea altă sumă decât a scris.
 */
const DOUA_ZECIMALE = (v: number): boolean => Math.abs(v * 100 - Math.round(v * 100)) < 1e-7;
const MESAJ_ZECIMALE = "Suma se scrie în lei, cu cel mult două zecimale.";

const lei = (lipsa: string) =>
  numarObligatoriu({
    min: 0.01,
    max: 9_999_999,
    lipsa,
    mesaj: "Suma se scrie în cifre, în lei.",
    interval: "Suma e între 0,01 și 9.999.999 lei.",
  }).refine(DOUA_ZECIMALE, MESAJ_ZECIMALE);

/** O cifră de cost care poate lipsi: lăsată goală înseamnă 0 lei. */
const leiImplicit0 = () =>
  numarCuImplicit({
    min: 0,
    max: 9_999_999,
    implicit: 0,
    mesaj: "Costul se scrie în cifre, în lei.",
    interval: "Costul e între 0 și 9.999.999 lei.",
  }).refine(DOUA_ZECIMALE, MESAJ_ZECIMALE);

const intervalKm = () =>
  numarOptional({
    min: L.intervalKmMin,
    max: L.intervalKmMax,
    intreg: true,
    mesaj: "Intervalul în km se scrie în cifre.",
    interval: `Intervalul e între ${String(L.intervalKmMin)} și ${L.intervalKmMax.toLocaleString("ro-RO")} km.`,
  });

const intervalLuni = () =>
  numarOptional({
    min: L.intervalLuniMin,
    max: L.intervalLuniMax,
    intreg: true,
    mesaj: "Intervalul în luni se scrie în cifre.",
    interval: `Intervalul e între ${String(L.intervalLuniMin)} și ${String(L.intervalLuniMax)} de luni.`,
  });

const denumire = z
  .string({ error: "Scrieți denumirea planului." })
  .trim()
  .min(L.denumireMin, "Scrieți denumirea planului (cel puțin 2 caractere).")
  .max(L.denumireMax, `Denumirea are cel mult ${String(L.denumireMax)} de caractere.`);

const campuriPlan = {
  denumire,
  tip: z.enum(TIPURI_SERVICE, "Alegeți tipul lucrării.").default("revizie"),
  interval_km: intervalKm(),
  interval_luni: intervalLuni(),
  baza_data: zi("Scrieți data ultimei intervenții (sau azi, dacă planul începe acum)."),
  baza_km: kilometri("Scrieți kilometrajul de la ultima intervenție (sau cel de azi)."),
  prag_avertizare_km: numarCuImplicit({
    min: 0,
    max: L.pragAvertizareKmMax,
    implicit: L.pragAvertizareKmImplicit,
    intreg: true,
    mesaj: "Pragul de avertizare se scrie în km, în cifre.",
    interval: `Pragul de avertizare e între 0 și ${L.pragAvertizareKmMax.toLocaleString("ro-RO")} km.`,
  }),
  observatii: textOptional(L.observatiiMax),
};

/** Un plan fără niciun interval n-ar avea când să se scadă: baza îl refuză (`vsp_interval_ck`). */
function cereUnInterval(
  v: { interval_km: number | null; interval_luni: number | null },
  ctx: z.RefinementCtx,
): void {
  if (v.interval_km === null && v.interval_luni === null) {
    const mesaj = "Alegeți cel puțin un interval: în kilometri sau în luni.";
    ctx.addIssue({ code: "custom", path: ["interval_km"], message: mesaj });
    ctx.addIssue({ code: "custom", path: ["interval_luni"], message: mesaj });
  }
}

export const planServiceSchema = z
  .object({ vehicle_id: z.uuid(), ...campuriPlan })
  .superRefine(cereUnInterval);
export type PlanService = z.output<typeof planServiceSchema>;

/**
 * `activ` apare doar la modificare: un plan oprit iese din scadențe și din
 * alerte, dar rămâne în istoric. `vehicle_id` NU se scrie (baza refuză mutarea).
 */
export const actualizeazaPlanServiceSchema = z
  .object({
    id: z.uuid(),
    vehicle_id: z.uuid(),
    ...campuriPlan,
    activ: z.boolean(),
  })
  .superRefine(cereUnInterval);
export type ActualizeazaPlanService = z.output<typeof actualizeazaPlanServiceSchema>;

const campuriIntrare = {
  data_interventiei: zi("Scrieți data intervenției."),
  km: kilometri("Scrieți kilometrajul de la bord la intervenție."),
  tip: z.enum(TIPURI_SERVICE, "Alegeți tipul lucrării."),
  descriere: z
    .string({ error: "Descrieți lucrarea făcută." })
    .trim()
    .min(L.descriereMin, "Descrieți lucrarea făcută (cel puțin 2 caractere).")
    .max(L.descriereMax, `Descrierea are cel mult ${String(L.descriereMax)} de caractere.`),
  furnizor: textOptional(L.furnizorMax),
  numar_factura: textOptional(L.facturaMax),
  cost_piese: leiImplicit0(),
  cost_manopera: leiImplicit0(),
  anvelope_montate: enumOptional(
    ANVELOPE_MONTATE,
    "Alegeți anvelopele montate: vară, iarnă sau all-season.",
  ),
  observatii: textOptional(L.observatiiMax),
};

/**
 * Intervenția făcută. `plan_id` leagă intervenția de un plan, care se mută
 * singur (ultima, următoarea). Anvelopele montate au sens doar la tipul
 * „anvelope” — baza are CHECK-ul (`vse_anvelope_ck`), schema spune de ce, pe câmp.
 */
export const intrareServiceSchema = z
  .object({
    vehicle_id: z.uuid(),
    plan_id: optional(z.uuid()),
    ...campuriIntrare,
  })
  .superRefine((v, ctx) => {
    if (v.anvelope_montate !== null && v.tip !== "anvelope") {
      ctx.addIssue({
        code: "custom",
        path: ["anvelope_montate"],
        message: "Anvelopele montate se aleg doar la o intervenție de tip „Anvelope”.",
      });
    }
  });
export type IntrareService = z.output<typeof intrareServiceSchema>;

/**
 * Intervenția nu se modifică după salvare (baza refuză cu P0001): se șterge
 * logic și se adaugă din nou, ca un plan să nu poată fi mutat de o corectură
 * tăcută.
 */
export const stergeIntrareServiceSchema = z.object({ id: z.uuid(), vehicle_id: z.uuid() });

export const cheltuialaSchema = z
  .object({
    vehicle_id: z.uuid(),
    categorie: z.enum(CATEGORII_CHELTUIALA, "Alegeți categoria cheltuielii."),
    data_cheltuielii: zi("Scrieți data cheltuielii."),
    suma: lei("Scrieți suma, în lei."),
    litri: numarOptional({
      min: 0.01,
      max: 99_999,
      mesaj: "Litrii se scriu în cifre.",
      interval: "Litrii sunt între 0,01 și 99.999.",
    }).refine(
      (v) => v === null || Math.abs(v * 100 - Math.round(v * 100)) < 1e-7,
      "Litrii se scriu cu cel mult două zecimale.",
    ),
    km_bord: numarOptional({
      min: 0,
      max: L.kmMax,
      intreg: true,
      mesaj: "Kilometrajul se scrie în cifre.",
      interval: `Kilometrajul se scrie în km întregi, între 0 și ${KM_MAX}.`,
    }),
    numar_document: textOptional(L.documentMax),
    observatii: textOptional(L.observatiiMax),
  })
  .superRefine((v, ctx) => {
    if (v.litri !== null && v.categorie !== "combustibil_fara_foaie") {
      ctx.addIssue({
        code: "custom",
        path: ["litri"],
        message: "Litrii se completează doar la „Combustibil fără foaie”.",
      });
    }
  });
export type Cheltuiala = z.output<typeof cheltuialaSchema>;

export const stergeCheltuialaSchema = z.object({ id: z.uuid(), vehicle_id: z.uuid() });

/** Perioada ecranului „Costuri”: ultimele N luni sau tot istoricul. Din URL: orice altceva cade pe implicit. */
export const PERIOADE_COSTURI = ["3", "6", "12", "tot"] as const;
export type PerioadaCosturi = (typeof PERIOADE_COSTURI)[number];

export const filtreServiceSchema = z.object({
  fila: optional(z.enum(["service", "costuri"])),
  perioada: z.enum(PERIOADE_COSTURI).default("12"),
  cursor: optional(z.string().max(256)),
});
export type FiltreService = z.output<typeof filtreServiceSchema>;
