// src/schemas/employee.ts
// Validările de intrare pentru angajați, contracte și încetare. CNP/IBAN vin din @/domain/hr.

import { z } from "zod";

import { normalizeazaCnp, validateazaCnp } from "@/domain/hr/cnp";
import { normalizeazaIban, validateazaIban } from "@/domain/hr/iban";
import { REZULTATE_EXAMEN, TIPURI_EXAMEN } from "@/schemas/ssm";

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

const numarOptional = (minim: number, maxim: number) =>
  z
    .union([z.coerce.number(), z.null()])
    .default(null)
    .refine(
      (valoare) =>
        valoare === null || (Number.isFinite(valoare) && valoare >= minim && valoare <= maxim),
      `Valoarea trebuie să fie între ${String(minim)} și ${String(maxim)}.`,
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
  status: z.enum(STATUSURI_ANGAJAT).nullable().default(null),
  cursor: textOptional(400),
  limita: z.coerce.number().int().min(5).max(100).default(25),
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
  stare_civila: z.enum(STARI_CIVILE).nullable().default(null),
  data_nasterii: dataOptionala,
  gen: z.enum(GENURI).default("nedeclarat"),
  cetatenie: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/u, "Cetățenia se completează cu codul de țară din două litere (ex. RO).")
    .default("RO"),
  tip_act_identitate: textOptional(40),
  serie_act: textOptional(10),
  numar_act: textOptional(20),
  act_eliberat_de: textOptional(120),
  act_valabil_pana: dataOptionala,
  department_id: uuidOptional,
  job_position_id: uuidOptional,
  manager_employee_id: uuidOptional,
  hired_on: dataOptionala,
  conditii_munca: z.enum(CONDITII_MUNCA).default("normale"),
  grad_handicap: textOptional(20),
  nr_persoane_intretinere: z.coerce.number().int().min(0).max(20).default(0),
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
  "serie_act",
  "numar_act",
  "act_eliberat_de",
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
    serie_act: true,
    numar_act: true,
    act_eliberat_de: true,
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
    .max(200, "Se pot muta cel mult 200 de persoane deodată."),
  /** `null` = scoaterea din departament, o stare legitimă. */
  department_id: z.uuid("Departamentul selectat nu este valid.").nullable().default(null),
});

export type MutaAngajatiInput = z.infer<typeof mutaAngajatiSchema>;

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
  norma_ore_saptamana: z.coerce.number().min(0.5).max(48).default(40),
  norma_ore_zi: z.coerce.number().min(0.5).max(12).default(8),
  work_mode: z.enum(MODURI_LUCRU).default("sediu"),
  special_regime: z.enum(REGIMURI_SPECIALE).nullable().default(null),
  loc_telemunca: textOptional(200),
  loc_munca: textOptional(200),
  department_id: uuidOptional,
  job_position_id: uuidOptional,
  conditii_munca: z.enum(CONDITII_MUNCA).default("normale"),
  salariu_baza: z.coerce.number().min(0, "Salariul de bază nu poate fi negativ."),
  moneda: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/u, "Moneda se scrie cu trei litere (ex. RON).")
    .default("RON"),
  zile_concediu_anual: z.coerce.number().int().min(0).max(60).default(21),
  perioada_proba_zile: numarOptional(0, 365),
  preaviz_zile: numarOptional(0, 365),
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
  salariu_baza: z.coerce.number().min(0, "Salariul de bază nu poate fi negativ."),
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
    procent_scutire: numarOptional(0, 100),
    plafon_lunar: numarOptional(0, 1_000_000),
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
