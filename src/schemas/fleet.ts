// src/schemas/fleet.ts
import { z } from "zod";
import { LIMITE_SETARI_FLOTA, pragurileDinText } from "@/domain/fleet/setari";

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
  /**
   * Filtru de INTRARE (de pe panou/insignă): `expira` = cu un document curent
   * care expiră în fereastra panoului; `lipsa` = fără niciun document curent.
   */
  conformitate: optional(z.enum(["expira", "lipsa"])),
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
  /**
   * Filtru de INTRARE (din fișa angajatului): foile unui șofer. Este filtrul
   * pe `employee_id` cerut de F4; numele scurt din URL rămâne cel de până acum.
   */
  sofer: optional(z.uuid()),
  /** Intervalul de ZILE (0197, `trip_sheets.data`), inclusiv capetele. */
  de_la: optional(z.iso.date()),
  pana_la: optional(z.iso.date()),
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
  /**
   * Șoferul foii. `null` = „eu”: din 0196, cine are `trip_sheets:create` sub
   * `all` (angajatul, managerul) nu alege șoferul, `creeazaFoaie` îl rezolvă pe
   * server ca fișa proprie. Un id trimis de un asemenea rol trebuie să fie chiar
   * fișa lui; altfel acțiunea refuză înainte de bază. Cu scope `all`, câmpul e
   * obligatoriu, verificat tot în acțiune.
   */
  employee_id: z.uuid("Alegeți șoferul.").nullable().default(null),
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

/**
 * Trimiterea foii zilnice spre aprobare (0197).
 *
 * Fără sosire și kilometraj: din 0197 le dau CURSELE, iar antetul le
 * agregă în bază. O sosire trimisă aici ar fi refuzată („Orele și
 * kilometrajul foii se scriu pe curse”).
 */
export const trimiteFoaieSchema = z.object({
  id: z.uuid(),
  // Observațiile de la închidere: ce s-a întâmplat pe drum. Gol = nimic de
  // adăugat, nu „șterge ce era”.
  observatii: z.string().trim().max(1000).nullable().default(null),
});

/**
 * Corectura antetului unei ciorne: traseul pe scurt, scopul zilei și
 * observațiile. Ora și kilometrajul de plecare se schimbă doar pe o foaie
 * FĂRĂ curse — cu curse, le dă prima cursă, iar baza refuză scrierea directă.
 */
export const actualizeazaFoaieSchema = z.object({
  id: z.uuid(),
  plecare_la: dataOraRomania("plecării").nullable().default(null),
  km_plecare: numarOptional({
    min: 0,
    max: 5_000_000,
    intreg: true,
    mesaj: "Kilometrajul se scrie în cifre.",
    interval: "Kilometrajul se scrie în km întregi.",
  }),
  traseu: z.string().trim().max(500).nullable().default(null),
  scop: z.string().trim().max(500).nullable().default(null),
  observatii: z.string().trim().max(1000).nullable().default(null),
});
export type ActualizeazaFoaie = z.output<typeof actualizeazaFoaieSchema>;

/** Ștergerea logică a unei ciorne. Baza refuză orice altă stare (0197 §D1). */
export const stergeFoaieSchema = z.object({ id: z.uuid() });

/** Retragerea unei foi trimise în ciornă, ca șoferul s-o corecteze (0197). */
export const retrageFoaieSchema = z.object({ id: z.uuid() });

// ── Cursele foii zilnice (0197) ─────────────────────────────────────────────

const textCursa = (lipsa: string, maxim: number) =>
  z
    .string({ error: lipsa })
    .trim()
    .min(1, lipsa)
    .max(maxim, `Cel mult ${String(maxim)} de caractere.`);

/**
 * O cursă: ora, de unde, până unde, scopul și kilometrii (HG 1/2016 pct. 16
 * alin. (2): „scopul și locul deplasării”). Sosirea se completează întreagă —
 * ora ȘI kilometrajul — sau deloc (cursă în desfășurare); regula e și în bază.
 */
const campuriCursa = {
  plecare_la: dataOraRomania("plecării"),
  sosire_la: z
    .union([z.literal(""), z.null(), dataOraRomania("sosirii")])
    .transform((v) => (v === "" ? null : v))
    .default(null),
  de_la_loc: textCursa("Scrieți locul de plecare al cursei.", 200),
  pana_la_loc: textCursa("Scrieți locul de sosire al cursei.", 200),
  scop: textCursa("Scrieți scopul cursei.", 500),
  km_plecare: numarObligatoriu({
    min: 0,
    max: 5_000_000,
    intreg: true,
    lipsa: "Scrieți kilometrajul la plecare, în km.",
    mesaj: "Kilometrajul se scrie în cifre.",
    interval: "Kilometrajul se scrie în km întregi.",
  }),
  km_sosire: numarOptional({
    min: 0,
    max: 5_000_000,
    intreg: true,
    mesaj: "Kilometrajul se scrie în cifre.",
    interval: "Kilometrajul se scrie în km întregi.",
  }),
  observatii: z.string().trim().max(1000).nullable().default(null),
} as const;

function sosireIntreaga(
  v: Readonly<{ sosire_la: string | null; km_sosire: number | null; km_plecare: number }>,
  ctx: z.RefinementCtx,
): void {
  if (v.sosire_la === null && v.km_sosire !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["sosire_la"],
      message: "Completați și ora sosirii, sau lăsați sosirea goală.",
    });
  }
  if (v.sosire_la !== null && v.km_sosire === null) {
    ctx.addIssue({
      code: "custom",
      path: ["km_sosire"],
      message: "Completați și kilometrajul la sosire, sau lăsați sosirea goală.",
    });
  }
  if (v.km_sosire !== null && v.km_sosire <= v.km_plecare) {
    ctx.addIssue({
      code: "custom",
      path: ["km_sosire"],
      message: "Kilometrajul la sosire trebuie să fie mai mare decât cel de la plecare.",
    });
  }
}

export const cursaSchema = z
  .object({
    trip_sheet_id: z.uuid(),
    /** Șablonul din care s-a pornit, doar pentru audit. Locurile vin oricum din formular. */
    sablon_id: z.uuid().nullable().default(null),
    ...campuriCursa,
  })
  .superRefine(sosireIntreaga);
export type CursaNoua = z.output<typeof cursaSchema>;

export const actualizeazaCursaSchema = z
  .object({ id: z.uuid(), trip_sheet_id: z.uuid(), ...campuriCursa })
  .superRefine(sosireIntreaga);
export type ActualizeazaCursa = z.output<typeof actualizeazaCursaSchema>;

export const stergeCursaSchema = z.object({ id: z.uuid(), trip_sheet_id: z.uuid() });

// ── Șabloanele de traseu (0197) ─────────────────────────────────────────────

const campuriSablon = {
  denumire: textCursa("Dați un nume șablonului, de exemplu „Sediu — Depozit”.", 120),
  de_la_loc: textCursa("Scrieți locul de plecare.", 200),
  pana_la_loc: textCursa("Scrieți locul de sosire.", 200),
  scop: textCursa("Scrieți scopul cursei.", 500),
  km_estimat: numarOptional({
    min: 1,
    max: 5000,
    intreg: true,
    mesaj: "Distanța se scrie în km întregi.",
    interval: "Distanța estimată e între 1 și 5.000 km.",
  }),
} as const;

export const sablonTraseuSchema = z.object(campuriSablon);
export type SablonTraseuNou = z.output<typeof sablonTraseuSchema>;
export const actualizeazaSablonTraseuSchema = z.object({ id: z.uuid(), ...campuriSablon });
export const stergeSablonTraseuSchema = z.object({ id: z.uuid() });

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

/** Corectura unei alimentări pe ciornă (0197: doar cât foaia e `draft`). */
export const actualizeazaAlimentareSchema = alimentareSchema.extend({ id: z.uuid() });

/** Ștergerea logică a unei alimentări de pe ciornă. Ireversibilă (0197 §D2). */
export const stergeAlimentareSchema = z.object({ id: z.uuid(), trip_sheet_id: z.uuid() });

export const confirmaAnomalieSchema = z.object({
  id: z.uuid(),
  nota: z.string().trim().max(500).nullable().default(null),
});

// ── Setările flotei (0198) ──────────────────────────────────────────────────

const L = LIMITE_SETARI_FLOTA;

/**
 * Pragurile de alertă: textul din formular („30, 14, 7”) sau lista deja
 * făcută. Ordonarea și dublurile le rezolvă `pragurileDinText`, exact ca
 * triggerul din bază; schema spune doar ce n-ar trece de CHECK, pe câmp.
 */
const praguriAlerta = z
  .union([z.string(), z.array(z.number())], "Scrieți zilele, despărțite prin virgulă.")
  .transform((v, ctx): number[] => {
    const zile =
      typeof v === "string" ? pragurileDinText(v) : [...new Set(v)].sort((a, b) => b - a);
    if (zile === null) {
      ctx.addIssue({
        code: "custom",
        message:
          "Scrieți zilele în cifre întregi, despărțite prin virgulă, de exemplu „30, 14, 7”.",
      });
      return z.NEVER;
    }
    return [...zile];
  })
  .pipe(
    z
      .array(
        z
          .number()
          .int("Zilele se scriu în cifre întregi.")
          .min(
            L.pragAlertaMin,
            `Fiecare prag e între ${String(L.pragAlertaMin)} și ${String(L.pragAlertaMax)} de zile.`,
          )
          .max(
            L.pragAlertaMax,
            `Fiecare prag e între ${String(L.pragAlertaMin)} și ${String(L.pragAlertaMax)} de zile.`,
          ),
      )
      .min(1, "Scrieți cel puțin un prag, de exemplu „30, 14, 7”.")
      .max(L.praguriMaxim, `Cel mult ${String(L.praguriMaxim)} praguri.`),
  );

/**
 * Setările flotei, salvate dintr-un singur formular. `responsabili` sunt fișe
 * de angajat (gol = toți administratorii); baza verifică singură că sunt ale
 * aceleiași firme (P0001 pe câmp, prin `traduEroareSetari`).
 */
export const setariFlotaSchema = z.object({
  responsabili: z
    .array(z.uuid("Responsabilul ales nu este valid."))
    .max(L.responsabiliMaxim, `Alegeți cel mult ${String(L.responsabiliMaxim)} de responsabili.`)
    .default([])
    .transform((v) => [...new Set(v)]),
  prag_salt_km: numarObligatoriu({
    min: L.pragSaltMin,
    max: L.pragSaltMax,
    intreg: true,
    lipsa: "Scrieți pragul de salt, în km.",
    mesaj: "Pragul de salt se scrie în cifre.",
    interval: "Pragul de salt e între 50 și 100.000 km, în km întregi.",
  }),
  praguri_alerta_zile: praguriAlerta,
});
export type SetariFlotaInput = z.output<typeof setariFlotaSchema>;
