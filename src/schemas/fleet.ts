// src/schemas/fleet.ts
import { z } from "zod";
import { dataOraRomania, numarObligatoriu, numarOptional, optional } from "./comun";

/**
 * Kilometrajul de bord, obligatoriu.
 *
 * NU `z.coerce.number()`: pe `""` și pe `null` acela dă `0`, adică exact
 * vehiculul „cu 0 km” pe care regula asta îl închide. `numarObligatoriu` scoate
 * golul ÎNAINTE de coerciție și îl raportează ca lipsă.
 */
const kmBord = numarObligatoriu({
  min: 0,
  max: 5_000_000,
  intreg: true,
  lipsa: "Scrieți kilometrajul de la bord, în km.",
  mesaj: "Kilometrajul se scrie în cifre.",
  interval: "Kilometrajul se scrie în km întregi, între 0 și 5.000.000.",
});

/**
 * Valorile enumerate vin din `0012_fleet.sql`. Sunt scrise aici ca uniuni
 * literale, nu importate din tipurile generate, fiindcă schemele Zod trebuie să
 * poată valida și intrarea din URL — unde totul e `string`.
 */
export const STATUS_VEHICUL = ["activ", "in_service", "vandut", "casat"] as const;
export type StatusVehicul = (typeof STATUS_VEHICUL)[number];

export const CATEGORII_VEHICUL = [
  "autoturism",
  "autoutilitara",
  "camion",
  "autobuz",
  "microbuz",
  "remorca",
  "semiremorca",
  "utilaj",
  "motocicleta",
  "altele",
] as const;
export type CategorieVehicul = (typeof CATEGORII_VEHICUL)[number];

export const COMBUSTIBILI = [
  "benzina",
  "motorina",
  "gpl",
  "gnc",
  "electric",
  "hibrid",
  "hibrid_plugin",
  "altul",
] as const;
export type Combustibil = (typeof COMBUSTIBILI)[number];

export const STATUS_FOAIE = ["draft", "trimis", "aprobat", "respins"] as const;
export type StatusFoaie = (typeof STATUS_FOAIE)[number];

/**
 * Fiecare câmp are `.default(...)`.
 *
 * `filtreDinUrl()` revine la `schema.safeParse({})` când query string-ul e
 * nevalid; fără valori implicite peste tot, revenirea ar eșua și ea, iar
 * utilizatorul ar primi ecranul de eroare pentru un `?limita=abc` — exact
 * defectul reparat în modulele de concedii și inventar.
 */

/**
 * Coloanele după care se pot sorta cele două liste de flotă.
 *
 * Listele sunt ÎNCHISE, nu o validare de formă: numele coloanei ajunge într-un
 * `.order()` ȘI într-un predicat de cursor construit ca text, deci nu poate
 * veni liber din query string. `sortareCeruta` din `lib/queries/cursor.ts` cade
 * tăcut pe implicit pentru orice altceva — un URL copiat greșit nu strică
 * ecranul, doar îl arată sortat implicit.
 *
 * Numai coloane `not null`: cu una care admite NULL, predicatul keyset compară
 * cu NULL, iar rândurile fără valoare dispar tăcut de la a doua pagină. De aceea
 * `km_parcursi` (generată din `km_sosire - km_plecare`, deci NULL pe o cursă în
 * desfășurare) NU e sortabilă.
 */
export const SORTARI_VEHICULE = ["numar", "marca", "km", "stare"] as const;
export type SortareVehicule = (typeof SORTARI_VEHICULE)[number];

export const SORTARI_FOI = ["plecare", "stare"] as const;
export type SortareFoi = (typeof SORTARI_FOI)[number];

export const filtreVehiculeSchema = z.object({
  status: optional(z.enum(STATUS_VEHICUL)),
  categorie: optional(z.enum(CATEGORII_VEHICUL)),
  cauta: optional(z.string().max(32)),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  /** Forma din URL: `km` crescător, `-km` descrescător. */
  sort: optional(z.string().max(40)),
});
export type FiltreVehicule = z.output<typeof filtreVehiculeSchema>;

export const filtreFoiSchema = z.object({
  status: optional(z.enum(STATUS_FOAIE)),
  vehicul: optional(z.uuid()),
  cursor: optional(z.string().max(256)),
  limita: z.coerce.number().int().min(5).max(100).default(25),
  sort: optional(z.string().max(40)),
});
export type FiltreFoi = z.output<typeof filtreFoiSchema>;

// ── Intrări de scriere ──────────────────────────────────────────────────────

/**
 * Numărul de înmatriculare NU se normalizează aici.
 *
 * `internal.vehicles_normalizeaza` îl trece prin `upper()` și scoate ce nu e
 * alfanumeric. Dacă l-am curăța și în client, cele două reguli ar putea diverge
 * tăcut la prima modificare — iar cea care contează e a bazei, fiindcă indexul
 * unic se aplică peste valoarea normalizată de ea.
 */
const campuriVehicul = {
  nr_inmatriculare: z.string().trim().min(3).max(16),
  marca: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  // VIN-ul nu conține I, O sau Q — au fost scoase din standard tocmai ca să nu
  // se confunde cu 1 și 0.
  vin: z
    .union([
      z
        .string()
        .trim()
        .regex(/^[A-HJ-NPR-Z0-9]{11,17}$/iu),
      z.literal(""),
    ])
    .transform((v) => (v === "" ? null : v.toUpperCase()))
    .nullable()
    .default(null),
  categorie: z.enum(CATEGORII_VEHICUL).default("autoturism"),
  tip_combustibil: z.enum(COMBUSTIBILI).default("motorina"),
  an_fabricatie: z.coerce.number().int().min(1900).max(2200).nullable().default(null),
  culoare: z.string().trim().max(40).nullable().default(null),
  consum_mediu_declarat: z.coerce.number().min(0).max(300).nullable().default(null),
  // Masa maximă autorizată decide ce documente se cer: rovinieta privește doar
  // vehiculele de până la 3,5 t, peste se plătește TollRo.
  capacitate_cilindrica: numarOptional({
    min: 0,
    max: 30_000,
    intreg: true,
    mesaj: "Scrieți capacitatea cilindrică în cm³.",
    interval: "Capacitatea cilindrică se scrie în cm³ întregi, cel mult 30.000.",
  }),
  masa_maxima_kg: numarOptional({
    min: 1,
    max: 100_000,
    intreg: true,
    mesaj: "Scrieți masa maximă autorizată în kg.",
    interval: "Masa se scrie în kg întregi, între 1 și 100.000.",
  }),
  numar_locuri: numarOptional({
    min: 1,
    max: 200,
    intreg: true,
    mesaj: "Scrieți numărul de locuri.",
    interval: "Numărul de locuri e un întreg între 1 și 200.",
  }),
  // `employee_id` NU e aici din 0173: șoferul se schimbă doar prin alocare
  // (`alocaVehicul`), iar baza refuză scrierea directă cu P0001.
  department_id: z.uuid().nullable().default(null),
  pool: z.boolean().default(false),
  data_achizitie: z.iso.date().nullable().default(null),
  valoare_achizitie: z.coerce.number().min(0).nullable().default(null),
  prag_salt_km: z.coerce.number().int().min(10).max(100000).nullable().default(null),
  observatii: z.string().trim().max(2000).nullable().default(null),
};

/**
 * `km_curent` e OBLIGATORIU la creare și există DOAR aici.
 *
 * Coloana are `default 0`. Cât timp formularul nu o trimitea, orice vehicul
 * intra cu 0 km. Prima foaie de parcurs trecea atunci de orice verificare:
 * triggerul de regres compară cu `greatest(ultima foaie aprobată, km_curent)`,
 * iar cel de salt cere o bază strict pozitivă. O mașină cumpărată la 87.000 km
 * accepta pe prima foaie orice cifră.
 *
 * La MODIFICARE nu apare. Kilometrajul îl ridică aprobarea foilor, iar
 * corectura stă în `corecteazaKilometrajSchema`, cu motiv auditat.
 */
export const vehiculNouSchema = z.object({
  ...campuriVehicul,
  km_curent: kmBord,
});
export type VehiculNou = z.output<typeof vehiculNouSchema>;

/**
 * `status` apare la MODIFICARE, nu la creare.
 *
 * `vehicule_insert` cere literal `status = 'activ'`, `data_iesire is null` și
 * `motiv_iesire is null`: un vehicul nu poate intra direct „vândut” fără să fi
 * existat vreodată în parc. `vehicule_update` nu are restricția, deci ieșirea
 * din parc se face de aici.
 *
 * `data_iesire` NU e în schemă deliberat: `internal.vehicles_normalizeaza()` o
 * pune singură la `vandut`/`casat` și o golește la orice altă stare. Trimisă și
 * din client, ar fi a doua sursă pentru aceeași dată.
 */
export const actualizeazaVehiculSchema = z
  .object({
    id: z.uuid(),
    ...campuriVehicul,
    status: z.enum(STATUS_VEHICUL),
    motiv_iesire: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((v, ctx) => {
    // Baza acceptă un vehicul casat fără motiv. Noi nu: peste un an, „de ce a
    // ieșit mașina asta din parc?” e singura întrebare care se mai pune despre
    // ea, iar răspunsul nu se mai poate reconstitui din nimic altceva.
    if ((v.status === "vandut" || v.status === "casat") && v.motiv_iesire === null) {
      ctx.addIssue({
        code: "custom",
        path: ["motiv_iesire"],
        message: "Scrieți de ce iese vehiculul din parc.",
      });
    }
  });
export type ActualizeazaVehicul = z.output<typeof actualizeazaVehiculSchema>;

export const stergeVehiculSchema = z.object({ id: z.uuid() });

/**
 * Corectura kilometrajului: cifra greșită de la creare sau un bord schimbat.
 *
 * Motivul e obligatoriu și ajunge în audit. Kilometrajul e baza verificării
 * foilor de parcurs, deci cine îl mută trebuie să spună de ce.
 */
export const corecteazaKilometrajSchema = z.object({
  id: z.uuid(),
  km_curent: kmBord,
  motiv: z
    .string()
    .trim()
    .min(5, "Scrieți de ce se corectează kilometrajul.")
    .max(300, "Motivul are cel mult 300 de caractere."),
});

/**
 * `numar` a fost scos din formular și din tabel.
 *
 * Seria poliței sau numărul procesului-verbal de ITP nu se folosea la nimic:
 * nu se caută după el, nu intră în niciun raport și nu ajunge în `expirables`.
 * Coloana rămâne în bază cu valorile deja scrise — o coloană scoasă din
 * interfață nu e un motiv să ștergi date.
 */
const campuriDocument = {
  document_type_id: z.uuid(),
  emitent: z.string().trim().max(120).nullable().default(null),
  valabil_de_la: z.iso.date().nullable().default(null),
  expira_la: z.iso.date().nullable().default(null),
  cost: z.coerce.number().min(0).nullable().default(null),
  observatii: z.string().trim().max(1000).nullable().default(null),
};

export const documentVehiculSchema = z.object({
  vehicle_id: z.uuid(),
  ...campuriDocument,
});
export type DocumentVehicul = z.output<typeof documentVehiculSchema>;

/**
 * `vehicle_id` călătorește prin schemele de modificare și de ștergere fără să
 * fie scris niciodată: `revalidate` are nevoie de el ca să compună calea fișei
 * (`/flota/<vehicul>`), iar acțiunea primește doar `input`, nu și rândul din
 * bază. Filtrarea scrierii se face pe `id` + `organization_id`, nu pe el.
 */
export const actualizeazaDocumentSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
  ...campuriDocument,
});
export type ActualizeazaDocument = z.output<typeof actualizeazaDocumentSchema>;

export const stergeDocumentSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
});

/**
 * `employee_id` și `km_plecare` sunt OBLIGATORII, deși planul le dădea ca
 * opționale.
 *
 * Verificat în bază: amândouă sunt `not null` fără valoare implicită. Un trigger
 * BEFORE chiar prepopulează kilometrajul, deci un INSERT cu NULL ar trece — dar
 * atunci șoferul află cifra abia după salvare, din ecranul următor. Formularul o
 * cere prepopulată din `kmDePlecareSugerat()`, ca omul să o vadă și să o poată
 * corecta ÎNAINTE, nu după.
 */
export const foaieNouaSchema = z.object({
  vehicle_id: z.uuid(),
  employee_id: z.uuid(),
  plecare_la: dataOraRomania("plecării"),
  km_plecare: z.coerce
    .number("Scrieți kilometrajul la plecare, în km.")
    .int("Kilometrajul se scrie în km întregi.")
    .min(0, "Kilometrajul nu poate fi negativ."),
  traseu: z.string().trim().max(500).nullable().default(null),
  scop: z.string().trim().max(500).nullable().default(null),
  observatii: z.string().trim().max(1000).nullable().default(null),
});
export type FoaieNoua = z.output<typeof foaieNouaSchema>;

export const trimiteFoaieSchema = z.object({
  id: z.uuid(),
  sosire_la: dataOraRomania("sosirii"),
  km_sosire: z.coerce
    .number("Scrieți kilometrajul la sosire, în km.")
    .int("Kilometrajul se scrie în km întregi.")
    .min(0, "Kilometrajul nu poate fi negativ."),
  // Observațiile de la închidere: ce s-a întâmplat pe drum. Înainte, coloana
  // exista în bază, dar niciun formular n-o scria.
  observatii: z.string().trim().max(1000).nullable().default(null),
});

// ── Alocări (0173) ──────────────────────────────────────────────────────────

/**
 * Predarea vehiculului unui șofer.
 *
 * `de_la` e ora României, ca la foi. O alocare nu începe în viitor: nimic n-ar
 * activa-o la ora ei, deci baza o refuză. Predarea către alt om închide
 * singură alocarea deschisă, în bază, cu `km_predare` ca restituire.
 */
export const alocareSchema = z.object({
  vehicle_id: z.uuid(),
  employee_id: z.uuid("Alegeți șoferul căruia i se predă vehiculul."),
  de_la: dataOraRomania("predării"),
  km_predare: numarOptional({
    min: 0,
    max: 5_000_000,
    intreg: true,
    mesaj: "Scrieți kilometrajul la predare, în km.",
    interval: "Kilometrajul se scrie în km întregi.",
  }),
  folosinta_personala: z.boolean().default(false),
  observatii: z.string().trim().max(1000).nullable().default(null),
});
export type Alocare = z.output<typeof alocareSchema>;

export const incheieAlocareSchema = z.object({
  id: z.uuid(),
  vehicle_id: z.uuid(),
  pana_la: dataOraRomania("restituirii"),
  km_restituire: numarOptional({
    min: 0,
    max: 5_000_000,
    intreg: true,
    mesaj: "Scrieți kilometrajul la restituire, în km.",
    interval: "Kilometrajul se scrie în km întregi.",
  }),
  observatii: z.string().trim().max(1000).nullable().default(null),
});

export const stergeAlocareSchema = z.object({ id: z.uuid(), vehicle_id: z.uuid() });

/** Foaia respinsă se întoarce în ciornă, ca șoferul s-o corecteze și s-o retrimită. */
export const redeschideFoaieSchema = z.object({ id: z.uuid() });

export const decizieFoaieSchema = z.object({
  id: z.uuid(),
  decizie: z.enum(["aprobat", "respins"]),
  // Un refuz fără motiv îl lasă pe șofer să ghicească ce anume să corecteze.
  motiv_respingere: z.string().trim().max(500).nullable().default(null),
});

export const alimentareSchema = z.object({
  trip_sheet_id: z.uuid(),
  litri: z.coerce
    .number("Scrieți câți litri s-au alimentat.")
    .positive("Cantitatea alimentată trebuie să fie mai mare decât zero.")
    .max(2000, "Cel mult 2.000 de litri la o alimentare."),
  cost: z.coerce
    .number("Scrieți costul alimentării, în lei.")
    .min(0, "Costul nu poate fi negativ."),
  statie: z.string().trim().max(120).nullable().default(null),
  // 60, nu 64: `fuel_bon_len` din bază taie la 60. Diferența dădea 23514 în
  // engleză pentru un bon de 61-64 de caractere.
  numar_bon: z
    .string()
    .trim()
    .max(60, "Numărul bonului are cel mult 60 de caractere.")
    .nullable()
    .default(null),
  alimentat_la: dataOraRomania("alimentării"),
  plin: z.boolean().default(false),
  observatii: z.string().trim().max(500).nullable().default(null),
});

export const confirmaAnomalieSchema = z.object({
  id: z.uuid(),
  nota: z.string().trim().max(500).nullable().default(null),
});
