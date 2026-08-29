// src/schemas/employee.ts
// Validările de intrare pentru angajați, contracte și încetare. CNP/IBAN vin din @/domain/hr.

import { z } from "zod";
import { enumOptional, numarCuImplicit, numarObligatoriu, numarOptional } from "./comun";

import { normalizeazaCnp, validateazaCnp } from "@/domain/hr/cnp";
import { normalizeazaIban, validateazaIban } from "@/domain/hr/iban";
import { TIPURI_ACT_IDENTITATE } from "@/domain/reges/operatii";
import { REZULTATE_EXAMEN, TIPURI_EXAMEN } from "@/schemas/ssm";

/** Actele de identitate ROMÂNEȘTI, din vocabularul REGES. */
export const ACTE_ROMANESTI = [
  "CarteIdentitate",
  "BuletinIdentitate",
  "AltActIdentitateRomanesc",
] as const satisfies readonly (typeof TIPURI_ACT_IDENTITATE)[number][];

export const STATUSURI_ANGAJAT = [
  "candidat",
  "activ",
  "suspendat",
  "preaviz",
  "incetat",
  "arhivat",
] as const;
export const GENURI = ["masculin", "feminin", "nedeclarat"] as const;
export const CONDITII_MUNCA = ["normale", "deosebite", "speciale"] as const;
export const DURATE_CONTRACT = ["nedeterminat", "determinat"] as const;
export const MODURI_LUCRU = ["sediu", "telemunca", "domiciliu", "mixt"] as const;
export const REGIMURI_SPECIALE = ["ucenicie", "internship", "zilier"] as const;
/** Oglinda enum-ului public.stare_civila din 0033_inrolare_unificata.sql. */
export const STARI_CIVILE = ["necasatorit", "casatorit", "divortat", "vaduv"] as const;

export type StatusAngajat = (typeof STATUSURI_ANGAJAT)[number];

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;

/** Text opțional: cheia rămâne mereu prezentă (null), ca să nu lovim exactOptionalPropertyTypes. */
const textOptional = (maxim: number) =>
  z
    .string()
    .trim()
    .max(maxim, `Textul nu poate depăși ${String(maxim)} de caractere.`)
    .nullable()
    .default(null)
    .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare));

const textObligatoriu = (minim: number, maxim: number, camp: string) =>
  z
    .string()
    .trim()
    .min(minim, `Câmpul „${camp}” este obligatoriu.`)
    .max(maxim, `Câmpul „${camp}” nu poate depăși ${String(maxim)} de caractere.`);

const dataOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || RE_DATA.test(valoare),
    "Data trebuie scrisă în formatul AAAA-LL-ZZ.",
  );

const dataObligatorie = (camp: string) =>
  z.string().trim().regex(RE_DATA, `Câmpul „${camp}” trebuie completat în formatul AAAA-LL-ZZ.`);

const uuidOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || z.uuid().safeParse(valoare).success,
    "Identificatorul selectat nu este valid.",
  );

const cnpOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) =>
    valoare === null || valoare.length === 0 ? null : normalizeazaCnp(valoare),
  )
  .refine(
    (valoare) => valoare === null || validateazaCnp(valoare).valid,
    "CNP-ul introdus nu este valid.",
  );

/**
 * CNP obligatoriu — folosit doar la înrolare.
 *
 * Golul se prinde ÎNAINTE de normalizare, cu mesajul lui: „nu e valid" pe un
 * câmp pe care omul nu l-a atins deloc e o acuzație greșită. Aceeași distincție
 * pe care o fac `numarObligatoriu` și `numarOptional` din `./comun`.
 */
const cnpObligatoriu = z
  .string()
  .trim()
  .min(1, "Câmpul „CNP” este obligatoriu.")
  .transform((valoare) => normalizeazaCnp(valoare))
  .refine((valoare) => validateazaCnp(valoare).valid, "CNP-ul introdus nu este valid.");

const emailOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => (valoare === null || valoare.length === 0 ? null : valoare))
  .refine(
    (valoare) => valoare === null || z.email().safeParse(valoare).success,
    "Adresa de e-mail nu este validă.",
  );

const ibanOptional = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) =>
    valoare === null || valoare.length === 0 ? null : normalizeazaIban(valoare),
  )
  .refine(
    (valoare) => valoare === null || validateazaIban(valoare).valid,
    "IBAN-ul introdus nu este valid.",
  );

// ── Filtre de listare (paginare keyset) ───────────────────────────────────────

/**
 * Coloanele după care lista de angajați se poate sorta.
 *
 * Lista e ÎNCHISĂ, nu o validare de formă: numele coloanei ajunge într-un
 * `.order()` și într-un predicat de cursor construit ca text, deci nu poate
 * veni liber din query string. `sortareCeruta` din `lib/queries/cursor.ts` cade
 * tăcut pe implicit pentru orice altceva — un URL copiat greșit nu strică
 * ecranul, doar îl arată sortat implicit.
 */
export const SORTARI_ANGAJATI = ["nume", "marca", "angajat_din"] as const;
export type SortareAngajati = (typeof SORTARI_ANGAJATI)[number];

export const filtreAngajatiSchema = z.object({
  q: textOptional(80),
  department_id: uuidOptional,
  job_position_id: uuidOptional,
  status: enumOptional(STATUSURI_ANGAJAT, "Statusul din filtru nu este valid."),
  cursor: textOptional(400),
  limita: numarCuImplicit({
    min: 5,
    max: 100,
    implicit: 25,
    intreg: true,
    mesaj: "Limita trebuie să fie un număr.",
    interval: "Limita este între 5 și 100 de rânduri.",
  }),
  /** Forma din URL: `marca` crescător, `-marca` descrescător. */
  sort: textOptional(40),
});

export type FiltreAngajati = z.infer<typeof filtreAngajatiSchema>;

// ── Angajat ───────────────────────────────────────────────────────────────────

export const creeazaAngajatSchema = z.object({
  last_name: textObligatoriu(1, 80, "Nume"),
  first_name: textObligatoriu(1, 80, "Prenume"),
  email_personal: emailOptional,
  telefon: textOptional(32),
  adresa_strada: textOptional(200),
  adresa_oras: textOptional(120),
  adresa_judet: textOptional(80),
  adresa_cod_postal: textOptional(12),
  // Reședința se completează doar dacă diferă de domiciliul de mai sus.
  adresa_resedinta_strada: textOptional(200),
  adresa_resedinta_oras: textOptional(120),
  adresa_resedinta_judet: textOptional(80),
  adresa_resedinta_cod_postal: textOptional(12),
  email_serviciu: emailOptional,
  telefon_serviciu: textOptional(32),
  stare_civila: enumOptional(STARI_CIVILE, "Alegeți o stare civilă din listă."),
  data_nasterii: dataOptionala,
  gen: z.enum(GENURI).default("nedeclarat"),
  cetatenie: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/u, "Cetățenia se completează cu codul de țară din două litere (ex. RO).")
    .default("RO"),
  /**
   * Textul tipărit pe documente („carte de identitate"). Rămâne LIBER, fiindcă
   * importul în masă primește ce a scris cineva în Excel, iar fișele vechi au
   * deja valori proprii. Forma structurată e `reges_tip_act`, de mai jos.
   */
  tip_act_identitate: textOptional(40),
  /**
   * Aceeași informație, în vocabularul REGES.
   *
   * Coloana există din `0087_reges_online.sql:482` și NU era completată
   * niciodată: `src/domain/reges/compune.ts:128` cădea pe „CarteIdentitate"
   * pentru toată lumea, inclusiv pentru un cetățean străin cu pașaport.
   * Formularul scrie de acum amândouă, dintr-un singur `<select>`.
   */
  reges_tip_act: enumOptional(TIPURI_ACT_IDENTITATE, "Alegeți tipul actului de identitate."),
  serie_act: textOptional(10),
  numar_act: textOptional(20),
  act_eliberat_de: textOptional(120),
  act_eliberat_la: dataOptionala,
  act_valabil_pana: dataOptionala,
  department_id: uuidOptional,
  job_position_id: uuidOptional,
  manager_employee_id: uuidOptional,
  hired_on: dataOptionala,
  conditii_munca: z.enum(CONDITII_MUNCA).default("normale"),
  grad_handicap: textOptional(20),
  nr_persoane_intretinere: numarCuImplicit({
    min: 0,
    max: 20,
    implicit: 0,
    intreg: true,
    mesaj: "Numărul persoanelor în întreținere trebuie să fie un număr.",
    interval: "Numărul persoanelor în întreținere este între 0 și 20.",
  }),
  optiune_pilon_ii: z.coerce.boolean().default(true),
  is_primary: z.coerce.boolean().default(true),
  contact_urgenta_nume: textOptional(120),
  contact_urgenta_telefon: textOptional(32),
  contact_urgenta_relatie: textOptional(60),
  observatii: textOptional(2000),
  cnp: cnpOptional,
  iban: ibanOptional,
  banca: textOptional(80),
});

export type CreeazaAngajatInput = z.infer<typeof creeazaAngajatSchema>;

/**
 * `.pick()`, NU `.omit()`: formularul de editare atinge doar aceste 12 câmpuri.
 * Un `creeazaAngajatSchema.omit({...})` ar fi moștenit implicit orice câmp
 * viitor adăugat acolo (inclusiv unele cu `.default(...)`) — exact mecanismul
 * care a provocat bug-ul găsit aici: `manager_employee_id` (și, la fel,
 * `cetatenie`, `conditii_munca`, `nr_persoane_intretinere`, `optiune_pilon_ii`,
 * adresa/actul de identitate, contactul de urgență, observațiile) erau
 * ABSENTE din payload-ul trimis de client, Zod le aplica `.default(...)` la
 * parsare, iar handler-ul le trimitea mai departe la `.update(...)` — deci
 * FIECARE salvare din acest formular reseta silențios acele câmpuri, chiar și
 * când angajatul modifica doar telefonul. `.pick()` e sigur implicit: un câmp
 * nou adăugat la `creeazaAngajatSchema` NU ajunge aici decât dacă e listat
 * explicit, deci formularul trebuie extins înainte ca schema să-l accepte.
 */
/**
 * Editarea fișei — PARITATE cu înrolarea, din 0069.
 *
 * Până acum acoperea 12 câmpuri din ~40: adresa de reședință, contactul de
 * muncă, starea civilă, actul de identitate, managerul direct și contactul de
 * urgență nu se puteau modifica DELOC după înrolare. O mutare sau o căsătorie
 * însemnau fie o corecție direct în bază, fie o fișă rămasă greșită.
 *
 * `nr_persoane_intretinere` rămâne DELIBERAT în afară: din 0069 e recalculat de
 * trigger din `employee_dependents`. Lăsându-l editabil, cele două valori s-ar
 * fi putut despărți, iar deducerea personală ar fi rămas pe un număr care nu
 * mai corespunde nimănui.
 *
 * `is_primary` rămâne și el în afară: schimbă care fișă e cea principală a unui
 * utilizator cu mai multe, ceea ce e o operațiune de administrare, nu o
 * corecție de date.
 */
/**
 * Aceleași chei ca `.pick()`-ul de mai jos, ca listă parcurgibilă.
 *
 * ── DE CE EXISTĂ ──────────────────────────────────────────────────────────
 * Câmpurile picate își păstrează `.default(...)` din `creeazaAngajatSchema`.
 * Pentru un UPDATE, asta înseamnă că o cheie LIPSĂ din obiectul trimis nu se
 * citește „nu schimba", ci „scrie implicitul". Formularul de editare trimitea
 * 12 chei din 34; celelalte 22 se scriau ca `null` (sau reveneau la „RO",
 * „normale", `true`) la fiecare salvare, fără nicio eroare — `UPDATE`-ul
 * reușea perfect, doar că golea coloane pe care ecranul nici măcar nu le
 * arătase.
 *
 * `formular-angajat.tsx` construiește payload-ul parcurgând lista asta, iar
 * `employee.test.ts` verifică faptul că lista și `.pick()` conțin exact
 * aceleași chei. Un câmp adăugat într-un singur loc pică testul, în loc să
 * șteargă date în tăcere.
 */
export const CAMPURI_EDITABILE_ANGAJAT = [
  "last_name",
  "first_name",
  "email_personal",
  "telefon",
  "email_serviciu",
  "telefon_serviciu",
  "adresa_strada",
  "adresa_oras",
  "adresa_judet",
  "adresa_cod_postal",
  "adresa_resedinta_strada",
  "adresa_resedinta_oras",
  "adresa_resedinta_judet",
  "adresa_resedinta_cod_postal",
  "stare_civila",
  "data_nasterii",
  "gen",
  "cetatenie",
  "tip_act_identitate",
  "reges_tip_act",
  "serie_act",
  "numar_act",
  "act_eliberat_de",
  "act_eliberat_la",
  "act_valabil_pana",
  "department_id",
  "job_position_id",
  "manager_employee_id",
  "hired_on",
  "conditii_munca",
  "grad_handicap",
  "optiune_pilon_ii",
  "contact_urgenta_nume",
  "contact_urgenta_telefon",
  "contact_urgenta_relatie",
  "observatii",
  "cnp",
  "iban",
  "banca",
] as const;

export const actualizeazaAngajatSchema = creeazaAngajatSchema
  .pick({
    last_name: true,
    first_name: true,
    email_personal: true,
    telefon: true,
    email_serviciu: true,
    telefon_serviciu: true,
    adresa_strada: true,
    adresa_oras: true,
    adresa_judet: true,
    adresa_cod_postal: true,
    adresa_resedinta_strada: true,
    adresa_resedinta_oras: true,
    adresa_resedinta_judet: true,
    adresa_resedinta_cod_postal: true,
    stare_civila: true,
    data_nasterii: true,
    gen: true,
    cetatenie: true,
    tip_act_identitate: true,
    reges_tip_act: true,
    serie_act: true,
    numar_act: true,
    act_eliberat_de: true,
    act_eliberat_la: true,
    act_valabil_pana: true,
    department_id: true,
    job_position_id: true,
    manager_employee_id: true,
    hired_on: true,
    conditii_munca: true,
    grad_handicap: true,
    optiune_pilon_ii: true,
    contact_urgenta_nume: true,
    contact_urgenta_telefon: true,
    contact_urgenta_relatie: true,
    observatii: true,
    cnp: true,
    iban: true,
    banca: true,
  })
  .extend({ id: z.uuid("Angajatul selectat nu este valid.") });

/**
 * Mutarea între departamente — o schemă ÎNGUSTĂ, cu două câmpuri.
 *
 * ── DE CE NU SE REFOLOSEȘTE `actualizeazaAngajatSchema` ───────────────────
 * Aceea are 36 de câmpuri, aproape toate cu `.default(...)`. Un payload
 * `{ id, department_id }` ar trece de validare, iar handler-ul ar trimite 34 de
 * coloane la `.update()`: adresa, reședința, actul de identitate, contactul de
 * urgență, CNP-ul și IBAN-ul s-ar scrie `null`, iar `gen`, `cetatenie`,
 * `conditii_munca` și `optiune_pilon_ii` ar reveni la implicit. Exact defectul
 * pe care îl apără poarta din `employee.test.ts`, de la câțiva pași mai sus.
 *
 * Cea mai scumpă pierdere ar fi `manager_employee_id → null`: declanșează
 * `tg_employees_manager_path`, care rescrie `manager_path` la TOȚI subordonații.
 * Cum scope-ul „team" se rezolvă peste tot pe `manager_path`, o singură salvare
 * parțială ar face o ramură întreagă invizibilă pentru managerul ei — fără
 * eroare, și fără urmă în jurnalul aplicației, fiindcă `manager_employee_id` nu
 * e în lista de câmpuri auditate.
 *
 * Cu două câmpuri, schema asta n-are ce goli.
 *
 * Plafonul de 200 nu e o limită de produs, e o plasă: cea mai mare firmă din
 * sistem are opt angajați.
 */
export const mutaAngajatiSchema = z.object({
  employee_ids: z
    .array(z.uuid("Angajatul selectat nu este valid."))
    .min(1, "Selectați cel puțin o persoană.")
    .max(200, "Se pot muta cel mult 200 de persoane deodată.")
    // Deduplicarea NU e cosmetică. Handler-ul compară numărul de rânduri
    // întoarse de `.in("id", …)` cu lungimea listei, ca să prindă un refuz
    // parțial al politicii. Cu `["X","X"]`, baza întoarce UN rând iar lungimea
    // e doi, deci o scriere perfect reușită ar fi raportată drept refuz. Din
    // interfață nu se poate întâmpla (selecția e un `Set`), dar acțiunea e un
    // endpoint POST invocabil direct.
    .transform((identificatori) => [...new Set(identificatori)]),
  /** `null` = scoaterea din departament, o stare legitimă. */
  department_id: z.uuid("Departamentul selectat nu este valid.").nullable().default(null),
});

export type MutaAngajatiInput = z.infer<typeof mutaAngajatiSchema>;

/**
 * Funcția unei singure persoane — schemă îngustă, din exact aceleași motive ca
 * `mutaAngajatiSchema` de mai sus: `actualizeazaAngajatSchema` are 36 de câmpuri
 * cu `.default(...)`, iar un payload parțial i-ar goli fișa. Nota lungă de
 * acolo se aplică literal și aici, inclusiv partea cea mai scumpă —
 * `manager_employee_id → null` rescrie `manager_path` la toți subordonații și
 * ascunde o ramură întreagă de managerul ei, fără eroare.
 *
 * Cu două câmpuri, schema asta n-are ce goli.
 */
export const atribuieFunctiaSchema = z.object({
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  /** `null` = scoaterea funcției, o stare legitimă (fișă nouă, funcție desființată). */
  job_position_id: z.uuid("Funcția selectată nu este validă.").nullable().default(null),
});

export type AtribuieFunctiaInput = z.infer<typeof atribuieFunctiaSchema>;

// ── Contract ──────────────────────────────────────────────────────────────────

const corpContractSchema = z.object({
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  parent_contract_id: uuidOptional,
  este_act_aditional: z.coerce.boolean().default(false),
  numar: textObligatoriu(1, 40, "Număr contract"),
  data_contract: dataObligatorie("Data contractului"),
  valabil_de_la: dataObligatorie("Valabil de la"),
  valabil_pana: dataOptionala,
  contract_duration: z.enum(DURATE_CONTRACT).default("nedeterminat"),
  motiv_determinat: textOptional(200),
  norma_ore_saptamana: numarCuImplicit({
    min: 0.5,
    max: 48,
    implicit: 40,
    mesaj: "Norma săptămânală trebuie să fie un număr.",
    interval: "Norma săptămânală este între 0,5 și 48 de ore.",
  }),
  norma_ore_zi: numarCuImplicit({
    min: 0.5,
    max: 12,
    implicit: 8,
    mesaj: "Norma zilnică trebuie să fie un număr.",
    interval: "Norma zilnică este între 0,5 și 12 ore.",
  }),
  work_mode: z.enum(MODURI_LUCRU).default("sediu"),
  special_regime: enumOptional(REGIMURI_SPECIALE, "Alegeți un regim special din listă."),
  loc_telemunca: textOptional(200),
  loc_munca: textOptional(200),
  /**
   * Punctul de lucru unde se prestează munca (0097).
   *
   * NULL = sediul social sau o locație ocazională, al cărei text stă în
   * `loc_munca`. Se scriu AMÂNDOUĂ: denumirea rezolvată rămâne corectă în
   * documentele deja emise chiar dacă punctul de lucru e redenumit ulterior.
   */
  punct_lucru_id: uuidOptional,
  department_id: uuidOptional,
  job_position_id: uuidOptional,
  conditii_munca: z.enum(CONDITII_MUNCA).default("normale"),
  salariu_baza: numarObligatoriu({
    min: 0,
    max: 100_000_000,
    lipsa: "Salariul de bază este obligatoriu.",
    mesaj: "Salariul de bază trebuie să fie un număr.",
    interval: "Salariul de bază este între 0 și 100.000.000.",
  }),
  moneda: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/u, "Moneda se scrie cu trei litere (ex. RON).")
    .default("RON"),
  zile_concediu_anual: numarCuImplicit({
    min: 0,
    max: 60,
    implicit: 21,
    intreg: true,
    mesaj: "Zilele de concediu trebuie să fie un număr.",
    interval: "Zilele de concediu anual sunt între 0 și 60.",
  }),
  perioada_proba_zile: numarOptional({
    min: 0,
    max: 365,
    intreg: true,
    mesaj: "Perioada de probă trebuie să fie un număr de zile.",
    interval: "Perioada de probă este între 0 și 365 de zile.",
  }),
  preaviz_zile: numarOptional({
    min: 0,
    max: 365,
    intreg: true,
    mesaj: "Preavizul trebuie să fie un număr de zile.",
    interval: "Preavizul este între 0 și 365 de zile.",
  }),
});

/** Comune contractului de bază și fluxului unificat de înrolare (fără employee_id fix). */
function valideazaReguliContract(
  valoare: Readonly<{
    contract_duration: string;
    valabil_pana: string | null;
    valabil_de_la: string;
    work_mode: string;
    loc_telemunca: string | null;
  }>,
  ctx: z.core.$RefinementCtx,
): void {
  if (valoare.contract_duration === "determinat" && valoare.valabil_pana === null) {
    ctx.addIssue({
      code: "custom",
      path: ["valabil_pana"],
      message: "Un contract pe durată determinată are nevoie de dată de sfârșit.",
    });
  }
  if (valoare.valabil_pana !== null && valoare.valabil_pana < valoare.valabil_de_la) {
    ctx.addIssue({
      code: "custom",
      path: ["valabil_pana"],
      message: "Data de sfârșit nu poate fi anterioară datei de început.",
    });
  }
  if (
    (valoare.work_mode === "telemunca" || valoare.work_mode === "domiciliu") &&
    valoare.loc_telemunca === null
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["loc_telemunca"],
      message:
        "Pentru telemuncă sau muncă la domiciliu, locul desfășurării activității este obligatoriu.",
    });
  }
}

export const creeazaContractSchema = corpContractSchema
  .superRefine(valideazaReguliContract)
  .superRefine((valoare, ctx) => {
    if (valoare.este_act_aditional && valoare.parent_contract_id === null) {
      ctx.addIssue({
        code: "custom",
        path: ["parent_contract_id"],
        message: "Un act adițional trebuie legat de contractul de bază.",
      });
    }
  });

// ── Înrolare unificată (angajat + primul contract + fișa postului) ────────────
// Etapa 1 din foaia de parcurs: un singur formular pentru fișa de personal și
// contractul inițial. `marca` nu e aici — se generează server-side
// (`internal.urmatoarea_marca`); `employee_id`/`parent_contract_id`/
// `este_act_aditional` nu au sens la o primă angajare.

export const inroleazaAngajatSchema = creeazaAngajatSchema
  .merge(
    corpContractSchema.omit({
      employee_id: true,
      parent_contract_id: true,
      este_act_aditional: true,
    }),
  )
  .extend({
    /*
     * ── CE DEVINE OBLIGATORIU DOAR AICI ───────────────────────────────────
     *
     * Câmpurile de mai jos rămân OPȚIONALE în `creeazaAngajatSchema`, deci în
     * ecranul de editare și în importul în masă. Motivul e măsurat, nu de
     * principiu: toate cele 11 fișe din baza reală n-au nici serie, nici număr
     * de act, nici emitent, nici adresă. Făcute obligatorii peste tot, o
     * corecție de număr de telefon pe un angajat vechi ar cere găsirea
     * buletinului lui.
     *
     * La ÎNROLARE însă e singurul moment în care omul are documentele în față,
     * iar fără ele nu iese nici contractul (textul cere seria, numărul,
     * emitentul și data eliberării), nici transmiterea la REGES (care cere CNP
     * valid și adresă de domiciliu — `src/domain/reges/validare.ts:32-67`).
     */
    reges_tip_act: z.enum(TIPURI_ACT_IDENTITATE, "Alegeți tipul actului de identitate."),
    // Seria NU e obligatorie aici: un pașaport n-are serie. Regula, condiționată
    // de cetățenie, e în `superRefine`-ul de mai jos.
    numar_act: textObligatoriu(1, 20, "Numărul actului de identitate"),
    act_eliberat_de: textObligatoriu(2, 120, "Emitentul actului de identitate"),
    act_eliberat_la: dataObligatorie("Data eliberării actului"),
    cnp: cnpObligatoriu,
    adresa_strada: textObligatoriu(3, 200, "Adresa de domiciliu"),
    adresa_oras: textObligatoriu(2, 120, "Localitatea de domiciliu"),
    adresa_judet: textObligatoriu(2, 80, "Județul de domiciliu"),

    /**
     * Vechimea în unitate.
     *
     * Devine obligatorie fiindcă din ea se calculează vechimea
     * (`src/domain/leave/drepturi.ts:14`), iar `src/lib/documents/adeverinte.ts:59`
     * REFUZĂ să emită adeverința de vechime când e goală — adică un câmp sărit
     * la înrolare rupe tăcut o funcție de peste un an mai târziu.
     *
     * Formularul o precompletează din „Angajat de la"; diferă doar la
     * reangajare, la contract nou care înlocuiește unul vechi și la preluare
     * prin transfer.
     */
    hired_on: dataObligatorie("Vechimea în unitate"),

    /**
     * Numărul contractului, ACUM OPȚIONAL.
     *
     * Gol, îl alocă `public.aloca_numar_contract` (0098), atomic, cu resetare
     * anuală: „42/2026". Completat, se folosește ca atare — un contract preluat
     * prin transfer sau importat istoric își păstrează numărul propriu.
     */
    numar: textOptional(40),

    // Fișa postului: opțională — dacă nu se completează, nu se generează documentul.
    subordonare: textOptional(160),
    atributii: textOptional(4000),
    competente: textOptional(4000),

    /**
     * Bunurile de inventar predate la înrolare.
     *
     * LISTĂ din 0069, nu un singur obiect: un angajat nou primește tipic
     * laptop, telefon și monitor deodată, iar limita de unul singur însemna că
     * restul se predau manual, din alt ecran — exact munca în plus pe care
     * asistentul de înrolare o elimină.
     *
     * Mașina de serviciu rămâne în afară: flota n-are azi o acțiune de
     * realocare a unui vehicul EXISTENT, doar de creare cu șofer.
     */
    inventory_item_ids: z
      .array(z.uuid("Bunul selectat nu este valid."))
      .max(20, "Cel mult 20 de bunuri la înrolare.")
      .default([]),

    // Fișă de aptitudine (medicina muncii) deja existentă — opțională;
    // completarea datei examinării declanșează înregistrarea.
    examen_data: dataOptionala,
    examen_tip: z.enum(TIPURI_EXAMEN).default("angajare"),
    examen_rezultat: z.enum(REZULTATE_EXAMEN).default("apt"),
    examen_valabil_pana: dataOptionala,
    examen_medic: textOptional(120),
    examen_unitate_medicala: textOptional(160),
    examen_numar_fisa: textOptional(64),

    /**
     * Permisul de muncă, pentru cetățenii non-UE.
     *
     * Tabela `work_permits` există din `0004_hr.sql:498`, cu politici RLS și
     * index de expirare — și NICIO referință în tot `src/`. Era o tabelă moartă:
     * un angajat din afara UE se înrola fără aviz de angajare, iar termenul de
     * expirare nu apărea nicăieri, deși munca fără permis valabil e contravenție
     * pentru angajator.
     *
     * `cetatenie` de pe fișă e discriminantul: câmpurile astea se completează
     * doar când nu e „RO". Acțiunea verifică asta, nu doar formularul.
     */
    permis_tip: textOptional(80),
    permis_numar: textOptional(64),
    permis_emis_de: textOptional(160),
    permis_valabil_de_la: dataOptionala,
    permis_valabil_pana: dataOptionala,
    numar_pasaport: textOptional(64),

    /**
     * Autorizațiile nominale deja existente (ISCIR, lucru la înălțime,
     * electrician autorizat…).
     *
     * LISTĂ din 0069. Un stivuitorist care e și electrician autorizat avea
     * până acum loc pentru o singură autorizație, iar a doua se pierdea — deși
     * amândouă expiră și amândouă condiționează desemnarea pe echipamente.
     */
    autorizatii: z
      .array(
        z.object({
          tip: z.string().trim().min(1, "Tipul autorizației e obligatoriu.").max(80),
          numar: z.string().trim().min(1, "Numărul autorizației e obligatoriu.").max(64),
          emitent: z.string().trim().min(1, "Emitentul e obligatoriu.").max(160),
          valabil_pana: z
            .string()
            .trim()
            .regex(RE_DATA, "Data de expirare trebuie scrisă AAAA-LL-ZZ."),
        }),
      )
      .max(10, "Cel mult 10 autorizații la înrolare.")
      .default([]),
  })
  .superRefine(valideazaReguliContract)
  .superRefine((valoare, ctx) => {
    /*
     * Actul de identitate trebuie să se potrivească cu cetățenia.
     *
     * Un cetățean român cu „Pașaport" ca act de identitate la angajare, sau un
     * cetățean străin cu „Carte de identitate" românească, sunt amândouă
     * greșeli care ies abia la transmiterea către REGES — unde `tipActIdentitate`
     * e verificat de server, nu de noi.
     */
    const esteRoman = valoare.cetatenie.trim().toUpperCase() === "RO";
    const actRomanesc = (ACTE_ROMANESTI as readonly string[]).includes(valoare.reges_tip_act);

    if (esteRoman && !actRomanesc) {
      ctx.addIssue({
        code: "custom",
        path: ["reges_tip_act"],
        message: "Pentru un cetățean român, actul de identitate este cartea sau buletinul.",
      });
    }
    if (!esteRoman && actRomanesc) {
      ctx.addIssue({
        code: "custom",
        path: ["reges_tip_act"],
        message:
          "Pentru un cetățean străin alegeți pașaportul, permisul de ședere sau cartea de rezidență.",
      });
    }
    // Seria există doar pe actele românești; un pașaport are numai număr.
    if (actRomanesc && valoare.serie_act === null) {
      ctx.addIssue({
        code: "custom",
        path: ["serie_act"],
        message: "Seria actului de identitate este obligatorie.",
      });
    }
    if (valoare.act_eliberat_la > valoare.data_contract) {
      ctx.addIssue({
        code: "custom",
        path: ["act_eliberat_la"],
        message: "Actul de identitate nu poate fi eliberat după data contractului.",
      });
    }

    /*
     * Vechimea în unitate, între limitele pe care le impune baza.
     *
     * `public.tg_employees_validari` (`0004_hr.sql:877`) respinge un `hired_on`
     * la mai mult de un an în viitor, cu P0001. `valabil_de_la` NU are aceeași
     * limită, iar formularul precompletează prima din a doua — deci un contract
     * programat la 14 luni ar trece de formular și ar cădea în bază, cu un
     * mesaj care nu spune care câmp e vinovat.
     */
    const anViitor = new Date();
    anViitor.setFullYear(anViitor.getFullYear() + 1);
    if (valoare.hired_on > anViitor.toISOString().slice(0, 10)) {
      ctx.addIssue({
        code: "custom",
        path: ["hired_on"],
        message: "Vechimea în unitate nu poate începe la mai mult de un an în viitor.",
      });
    }

    // Validarea „autorizația are nevoie de dată de expirare" nu mai e nevoie ca
    // `superRefine`: din 0069 `valabil_pana` e obligatoriu în forma fiecărei
    // autorizații din listă. Rămâne verificarea unicității numerelor, care
    // înainte nu se putea face — era o singură autorizație.
    const numere = new Set<string>();
    valoare.autorizatii.forEach((autorizatie, index) => {
      const cheie = autorizatie.numar.trim().toLowerCase();
      if (numere.has(cheie)) {
        ctx.addIssue({
          code: "custom",
          path: ["autorizatii", index, "numar"],
          message: `Autorizația „${autorizatie.numar}" apare de două ori.`,
        });
      }
      numere.add(cheie);
    });

    // Permisul de muncă: dacă s-a început completarea lui, trebuie dus până la
    // capăt. Un permis cu număr dar fără dată de expirare n-ar apărea niciodată
    // în tabloul de expirabile — adică exact ce trebuie să facă.
    if (valoare.permis_numar !== null) {
      if (valoare.permis_tip === null) {
        ctx.addIssue({
          code: "custom",
          path: ["permis_tip"],
          message: "Alegeți tipul permisului (aviz de angajare, permis unic, detașare).",
        });
      }
      if (valoare.permis_valabil_de_la === null || valoare.permis_valabil_pana === null) {
        ctx.addIssue({
          code: "custom",
          path: ["permis_valabil_pana"],
          message: "Un permis de muncă are nevoie de intervalul de valabilitate.",
        });
      }
      if (valoare.cetatenie === null || valoare.cetatenie.toUpperCase() === "RO") {
        ctx.addIssue({
          code: "custom",
          path: ["permis_numar"],
          message: "Permisul de muncă se completează doar pentru cetățenii străini.",
        });
      }
    }

    const bunuri = new Set<string>();
    valoare.inventory_item_ids.forEach((id, index) => {
      if (bunuri.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["inventory_item_ids", index],
          message: "Același bun a fost selectat de două ori.",
        });
      }
      bunuri.add(id);
    });
  });

/**
 * Tipul de INTRARE, nu de ieșire: câmpurile `.optional().transform(...)` devin
 * chei opționale doar în forma de intrare — `useForm` + `zodResolver` trebuie
 * tipate pe forma pe care o completează utilizatorul (vezi tiparul identic din
 * wizard-ul de înrolare a companiei, `src/schemas/membership.ts`).
 */
export type InroleazaAngajatInput = z.input<typeof inroleazaAngajatSchema>;

export const incetareContractSchema = z.object({
  contract_id: z.uuid("Contractul selectat nu este valid."),
  incetat_la: dataObligatorie("Data încetării"),
  temei_incetare: textObligatoriu(2, 120, "Temei legal"),
  motiv_incetare: textObligatoriu(3, 500, "Motivul încetării"),
  arhiveaza_fisa: z.coerce.boolean().default(false),
});

export const modificaSalariuContractSchema = z.object({
  contract_id: z.uuid("Contractul selectat nu este valid."),
  salariu_baza: numarObligatoriu({
    min: 0,
    max: 100_000_000,
    lipsa: "Salariul de bază este obligatoriu.",
    mesaj: "Salariul de bază trebuie să fie un număr.",
    interval: "Salariul de bază este între 0 și 100.000.000.",
  }),
});

// ── Dezvăluirea datelor sensibile ─────────────────────────────────────────────

export const dezvaluieDateSensibileSchema = z.object({
  employee_id: z.uuid("Angajatul selectat nu este valid."),
  camp: z.enum(["cnp", "iban"]),
  motiv: textObligatoriu(5, 200, "Motivul consultării"),
});

// ── Scutiri fiscale ────────────────────────────────────────────────────────────
// Oglinda enum-ului public.exemption_type din 0004_hr.sql.

export const TIPURI_SCUTIRE = [
  "it",
  "constructii",
  "agricultura",
  "industrie_alimentara",
  "persoana_handicap",
  "cercetare_dezvoltare",
] as const;
export type TipScutire = (typeof TIPURI_SCUTIRE)[number];

export const creeazaScutireFiscalaSchema = z
  .object({
    employee_id: z.uuid("Angajatul selectat nu este valid."),
    exemption_type: z.enum(TIPURI_SCUTIRE, "Alegeți tipul de scutire."),
    valabil_de_la: dataObligatorie("Valabil de la"),
    valabil_pana: dataOptionala,
    procent_scutire: numarOptional({
      min: 0,
      max: 100,
      mesaj: "Procentul de scutire trebuie să fie un număr.",
      interval: "Procentul de scutire este între 0 și 100.",
    }),
    plafon_lunar: numarOptional({
      min: 0,
      max: 1_000_000,
      mesaj: "Plafonul lunar trebuie să fie un număr.",
      interval: "Plafonul lunar este între 0 și 1.000.000.",
    }),
    temei_legal: textOptional(500),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.valabil_pana !== null && valoare.valabil_pana < valoare.valabil_de_la) {
      ctx.addIssue({
        code: "custom",
        path: ["valabil_pana"],
        message: "Data de sfârșit nu poate fi înainte de data de început.",
      });
    }
  });

// ── Persoane în întreținere ───────────────────────────────────────────────────

export const RELATII_INTRETINERE = ["copil", "sot_sotie", "parinte", "alta_ruda"] as const;
export type RelatieIntretinere = (typeof RELATII_INTRETINERE)[number];

/**
 * O persoană în întreținere.
 *
 * FĂRĂ CNP, deliberat: deducerea personală depinde de NUMĂRUL persoanelor, nu
 * de identitatea lor, iar CNP-urile unor minori n-ar servi niciunui calcul.
 * Vezi nota de proiectare din migrarea 0069.
 */
export const persoanaIntretinereSchema = z
  .object({
    employee_id: z.uuid("Angajatul selectat nu este valid."),
    nume: z
      .string()
      .trim()
      .min(2, "Numele trebuie să aibă cel puțin 2 caractere.")
      .max(200, "Numele nu poate depăși 200 de caractere."),
    relatie: z.enum(RELATII_INTRETINERE),
    data_nasterii: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .transform((v) => (v === null || v.length === 0 ? null : v))
      .refine((v) => v === null || RE_DATA.test(v), "Data nașterii trebuie scrisă AAAA-LL-ZZ."),
    in_intretinere_de_la: z
      .string()
      .trim()
      .regex(RE_DATA, "Data de la care e în întreținere trebuie scrisă AAAA-LL-ZZ."),
    in_intretinere_pana_la: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .transform((v) => (v === null || v.length === 0 ? null : v))
      .refine((v) => v === null || RE_DATA.test(v), "Data de sfârșit trebuie scrisă AAAA-LL-ZZ."),
    observatii: z.string().trim().max(500).nullable().default(null),
  })
  .superRefine((valoare, ctx) => {
    if (
      valoare.in_intretinere_pana_la !== null &&
      valoare.in_intretinere_pana_la < valoare.in_intretinere_de_la
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["in_intretinere_pana_la"],
        message: "Data de sfârșit nu poate fi anterioară celei de început.",
      });
    }
  });
export type IntrarePersoanaIntretinere = z.output<typeof persoanaIntretinereSchema>;

export const stergePersoanaIntretinereSchema = z.object({
  id: z.uuid("Persoana selectată nu este validă."),
});

/**
 * Invitarea unui angajat existent din fișa lui.
 *
 * Nu primește adresa: o ALEGE serverul, din fișă, prin
 * `src/lib/invitatii/adresa.ts`. O adresă venită din formular ar putea fi a
 * altcuiva, iar invitația poartă drept de acces la fișa asta.
 */
export const invitaAngajatulSchema = z.object({
  id: z.uuid("Angajatul selectat nu este valid."),
});

/**
 * Ștergerea unei fișe de angajat.
 *
 * Un singur câmp, deliberat: piedicile NU vin din formular. Le renumără
 * serverul la fiecare apel, fiindcă între randarea paginii și apăsarea
 * butonului altcineva poate încheia un contract sau muta un subordonat — iar o
 * piedică trimisă de client ar fi o piedică pe care clientul o poate omite.
 */
export const stergeAngajatSchema = z.object({
  id: z.uuid("Angajatul selectat nu este valid."),
});
