// src/schemas/leave.ts
// Validările de intrare pentru modulul de concedii: cereri, decizii de aprobare, filtre.

import { z } from "zod";

// ── Enumerări în oglindă cu tipurile din 0009_leave.sql ──────────────────────

export const PORTIUNI_ZI = ["zi_intreaga", "prima_jumatate", "a_doua_jumatate"] as const;
export type PortiuneZi = (typeof PORTIUNI_ZI)[number];

export const STATUSURI_CERERE = [
  "ciorna",
  "trimisa",
  "in_aprobare",
  "aprobata",
  "respinsa",
  "anulata",
  "intrerupta",
] as const;
export type StatusCerere = (typeof STATUSURI_CERERE)[number];

export const STATUSURI_SARCINA_APROBARE = [
  "in_asteptare",
  "aprobata",
  "respinsa",
  "delegata",
  "expirata",
  "anulata",
] as const;
export type StatusSarcinaAprobare = (typeof STATUSURI_SARCINA_APROBARE)[number];

export const EVENIMENTE_SOLD = [
  "drept_initial",
  "acumulare_lunara",
  "reportare",
  "expirare_reportate",
  "consum",
  "restituire",
  "ajustare_manuala",
  "corectie_incadrare",
] as const;
export type EvenimentSold = (typeof EVENIMENTE_SOLD)[number];

export const TIPURI_ZI_ORGANIZATIE = ["liber_suplimentar", "zi_recuperare"] as const;
export type TipZiOrganizatie = (typeof TIPURI_ZI_ORGANIZATIE)[number];

export const MODURI_ROTUNJIRE_ACUMULARE = [
  "fara_rotunjire",
  "jumatate_in_sus",
  "jumatate_in_jos",
  "zi_in_sus",
  "zi_in_jos",
  "matematic",
] as const;
export type ModRotunjireAcumulare = (typeof MODURI_ROTUNJIRE_ACUMULARE)[number];

/** Oglinda enum-ului public.leave_rule_criterion din 0035_reguli_concediu.sql. */
export const CRITERII_GRILA = [
  "vechime",
  "conditii_munca",
  "grad_handicap",
  "varsta_sub_18",
  "departament",
  "functie",
] as const;
export type CriteriuGrila = (typeof CRITERII_GRILA)[number];

/** Valorile acceptate de `ler_criteriu_ck` pentru `valoare_text`, în funcție de criteriu. */
export const VALORI_CONDITII_MUNCA_GRILA = ["deosebite", "speciale"] as const;
export const VALORI_GRAD_HANDICAP_GRILA = ["accentuat", "grav"] as const;

// ── Helpere de câmp (copii locale — schemas/employee.ts nu le exportă) ───────

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/u;

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

const listaStatusuriOptionala = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .transform((valoare) => {
    if (valoare === null || valoare.length === 0) return null;
    const bucati = valoare
      .split(",")
      .map((bucata) => bucata.trim())
      .filter((bucata) => bucata.length > 0);
    return bucati.length === 0 ? null : bucati;
  })
  .pipe(z.array(z.enum(STATUSURI_CERERE)).nullable());

// ── Filtre de listare (paginare keyset) ───────────────────────────────────────

/**
 * Un manager are DOUĂ feluri de cereri: ale lui și ale subalternilor.
 * Amestecate, lista nu răspunde la niciuna dintre întrebările pe care le pune
 * de fapt — „unde e cererea mea?” și „ce am de aprobat?”.
 *
 * Separarea NU e un filtru: e ruta. `/concedii` arată cererile proprii,
 * `/concedii/echipa` pe ale subalternilor. Vizualizarea nu mai apare deci în
 * query-string și nu se validează aici — o dă pagina, ca argument explicit
 * către `listeazaCereri`. Ca filtru de URL era o stare invizibilă: se pierdea
 * la aplicarea celorlalte filtre, iar antetul paginii rămânea al listei mari.
 *
 * `mele` / `echipa` se traduc tot într-un filtru pe `employee_id`, nu într-o a
 * doua interogare: RLS-ul decide oricum ce rânduri există, iar filtrul doar
 * alege dintre ele.
 */
export const VIZUALIZARI_CERERI = ["mele", "echipa", "toate"] as const;
export type VizualizareCereri = (typeof VIZUALIZARI_CERERI)[number];

export const filtreCereriSchema = z.object({
  status: listaStatusuriOptionala,
  leave_type_id: uuidOptional,
  employee_id: uuidOptional,
  de_la: dataOptionala,
  pana_la: dataOptionala,
  cursor: textOptional(400),
  limita: z.coerce.number().int().min(5).max(100).default(25),
});

export type FiltreCereri = z.infer<typeof filtreCereriSchema>;

// ── Cerere de concediu ────────────────────────────────────────────────────────

const ANUL_MINIM_CERERE = 2000;
const ANUL_MAXIM_CERERE = 2199;

export const creeazaCerereSchema = z
  .object({
    /** `null` = cererea e pentru mine însumi. */
    employee_id: uuidOptional,
    leave_type_id: z.uuid("Tipul de concediu selectat nu este valid."),
    data_inceput: dataObligatorie("Data de început"),
    data_sfarsit: dataObligatorie("Data de sfârșit"),
    portiune_inceput: z.enum(PORTIUNI_ZI).default("zi_intreaga"),
    portiune_sfarsit: z.enum(PORTIUNI_ZI).default("zi_intreaga"),
    motiv: textOptional(1000),
    atasament_path: textOptional(500),
    trimite: z.coerce.boolean().default(false),
  })
  .superRefine((valoare, ctx) => {
    const anInceput = Number(valoare.data_inceput.slice(0, 4));
    const anSfarsit = Number(valoare.data_sfarsit.slice(0, 4));
    if (Number.isNaN(anInceput) || anInceput < ANUL_MINIM_CERERE || anInceput > ANUL_MAXIM_CERERE) {
      ctx.addIssue({
        code: "custom",
        path: ["data_inceput"],
        message: "Anul datei de început este în afara intervalului acceptat.",
      });
      return;
    }
    if (valoare.data_sfarsit < valoare.data_inceput) {
      ctx.addIssue({
        code: "custom",
        path: ["data_sfarsit"],
        message: "Data de sfârșit nu poate fi anterioară datei de început.",
      });
      return;
    }
    if (anInceput !== anSfarsit) {
      ctx.addIssue({
        code: "custom",
        path: ["data_sfarsit"],
        message:
          "Cererea nu poate traversa doi ani calendaristici — soldul se calculează separat pe fiecare an. Depuneți două cereri distincte, câte una pentru fiecare an.",
      });
    }
  });

export type CreeazaCerereInput = z.infer<typeof creeazaCerereSchema>;

export const anuleazaCerereSchema = z.object({
  id: z.uuid("Cererea selectată nu este validă."),
});

// ── Decizia de aprobare ───────────────────────────────────────────────────────

const LUNGIME_MINIMA_MOTIV_RESPINGERE = 5;

export const decideCerereSchema = z
  .object({
    taskId: z.uuid("Sarcina de aprobare selectată nu este validă."),
    decizie: z.enum(["aprobata", "respinsa"]),
    comentariu: textOptional(1000),
    motivRespingere: textOptional(500),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.decizie !== "respinsa") return;
    const lungime = (valoare.motivRespingere ?? "").trim().length;
    if (lungime < LUNGIME_MINIMA_MOTIV_RESPINGERE) {
      ctx.addIssue({
        code: "custom",
        path: ["motivRespingere"],
        message: `Motivul respingerii trebuie să aibă cel puțin ${String(LUNGIME_MINIMA_MOTIV_RESPINGERE)} caractere.`,
      });
    }
  });

export type DecideCerereInput = z.infer<typeof decideCerereSchema>;

// ── Setări concedii: tipuri de concediu ───────────────────────────────────────
// `leave_types.reglementat = true` (medical, maternitate, creștere copil,
// paternal, îngrijitor, donator de sânge) e blocat la scriere de
// internal.leave_types_protejeaza_reglementat (0035) — schema de mai jos NU
// repetă acea gardă, doar validează forma datelor; refuzul real vine din
// bază, cu mesaj în română, prin PostgrestError → mapPostgrestError.

const ANUL_MINIM_AN = 2000;
const ANUL_MAXIM_AN = 2199;

export const actualizeazaTipConcediuSchema = z.object({
  id: z.uuid("Tipul de concediu selectat nu este valid."),
  zile_implicite: z.coerce
    .number("Numărul de zile trebuie să fie o cifră.")
    .min(0, "Numărul de zile nu poate fi negativ.")
    .max(1100, "Numărul de zile este neobișnuit de mare."),
  se_reporteaza: z.coerce.boolean().default(false),
  termen_reportare: z.coerce.number().int().min(1).max(60).nullable().default(null),
  plafon_reportare_zile: z.coerce.number().min(0).max(1100).nullable().default(null),
  necesita_document: z.coerce.boolean().default(false),
  mod_rotunjire_acumulare: z.enum(MODURI_ROTUNJIRE_ACUMULARE).default("jumatate_in_sus"),
  culoare: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/iu, "Culoarea trebuie scrisă ca un cod hexazecimal, ex. #2563EB."),
});

export type ActualizeazaTipConcediuInput = z.infer<typeof actualizeazaTipConcediuSchema>;

export const comutaActivTipConcediuSchema = z.object({
  id: z.uuid("Tipul de concediu selectat nu este valid."),
  activ: z.coerce.boolean(),
});

// ── Setări concedii: grile de zile suplimentare ───────────────────────────────

// Fără acțiune de EDITARE a unei reguli existente — la fel ca
// `payroll_settings`/`per_diem_policies`, o schimbare de regulă înseamnă o
// regulă NOUĂ (`valabil_de_la` diferit) și, eventual, dezactivarea celei
// vechi, nu o modificare in situ. Simplifică și permisiunea: crearea cere
// `leave:create = all` (politica `ler_insert`), dezactivarea cere
// `leave:update = all` (politica `ler_update`) — două acțiuni, două praguri,
// fără o schemă „upsert” care ar ascunde diferența.
export const creeazaRegulaConcediuSchema = z
  .object({
    leave_type_id: z.uuid("Tipul de concediu selectat nu este valid."),
    tip_criteriu: z.enum(CRITERII_GRILA, "Alegeți un criteriu de grilă."),
    vechime_ani_min: z.coerce.number().int().min(0).max(60).nullable().default(null),
    valoare_text: textOptional(40),
    department_id: uuidOptional,
    job_position_id: uuidOptional,
    zile_suplimentare: z.coerce
      .number("Numărul de zile trebuie să fie o cifră.")
      .min(0, "Numărul de zile suplimentare nu poate fi negativ.")
      .max(60, "Numărul de zile suplimentare este neobișnuit de mare."),
    denumire: textObligatoriu(2, 160, "Denumire"),
    valabil_de_la: dataObligatorie("Valabil de la"),
    valabil_pana_la: dataOptionala,
  })
  .superRefine((valoare, ctx) => {
    // Oglinda EXACTĂ a constrângerii ler_criteriu_ck (0035): exact discriminantul
    // cerut de criteriu, restul rămân goale — o regulă ambiguă nu ajunge la bază
    // doar ca să fie respinsă acolo cu un mesaj mai puțin util.
    const alteCriterii: readonly [string, unknown][] = [
      ["vechime_ani_min", valoare.vechime_ani_min],
      ["valoare_text", valoare.valoare_text],
      ["department_id", valoare.department_id],
      ["job_position_id", valoare.job_position_id],
    ];
    const respingeAltele = (permise: readonly string[]) => {
      for (const [camp, val] of alteCriterii) {
        if (!permise.includes(camp) && val !== null) {
          ctx.addIssue({
            code: "custom",
            path: [camp],
            message: "Acest câmp nu se completează pentru criteriul ales.",
          });
        }
      }
    };

    switch (valoare.tip_criteriu) {
      case "vechime":
        respingeAltele(["vechime_ani_min"]);
        if (valoare.vechime_ani_min === null) {
          ctx.addIssue({
            code: "custom",
            path: ["vechime_ani_min"],
            message: "Pragul de vechime (ani) este obligatoriu.",
          });
        }
        break;
      case "conditii_munca":
        respingeAltele(["valoare_text"]);
        if (
          valoare.valoare_text === null ||
          !(VALORI_CONDITII_MUNCA_GRILA as readonly string[]).includes(valoare.valoare_text)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["valoare_text"],
            message: "Alegeți „condiții deosebite” sau „condiții speciale”.",
          });
        }
        break;
      case "grad_handicap":
        respingeAltele(["valoare_text"]);
        if (
          valoare.valoare_text === null ||
          !(VALORI_GRAD_HANDICAP_GRILA as readonly string[]).includes(valoare.valoare_text)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["valoare_text"],
            message: "Alegeți gradul de handicap „accentuat” sau „grav”.",
          });
        }
        break;
      case "varsta_sub_18":
        respingeAltele([]);
        break;
      case "departament":
        respingeAltele(["department_id"]);
        if (valoare.department_id === null) {
          ctx.addIssue({
            code: "custom",
            path: ["department_id"],
            message: "Departamentul este obligatoriu.",
          });
        }
        break;
      case "functie":
        respingeAltele(["job_position_id"]);
        if (valoare.job_position_id === null) {
          ctx.addIssue({
            code: "custom",
            path: ["job_position_id"],
            message: "Funcția este obligatorie.",
          });
        }
        break;
    }

    if (valoare.valabil_pana_la !== null && valoare.valabil_pana_la < valoare.valabil_de_la) {
      ctx.addIssue({
        code: "custom",
        path: ["valabil_pana_la"],
        message: "Data de sfârșit a valabilității nu poate fi anterioară datei de început.",
      });
    }
  });

export type CreeazaRegulaConcediuInput = z.infer<typeof creeazaRegulaConcediuSchema>;

export const stergeRegulaConcediuSchema = z.object({
  id: z.uuid("Regula selectată nu este validă."),
});

// ── Setări concedii: aplicarea drepturilor pe angajați ────────────────────────

export const aplicaDrepturiSchema = z.object({
  an: z.coerce
    .number("Anul trebuie să fie o cifră.")
    .int()
    .min(ANUL_MINIM_AN, `Anul trebuie să fie cel puțin ${String(ANUL_MINIM_AN)}.`)
    .max(ANUL_MAXIM_AN, `Anul trebuie să fie cel mult ${String(ANUL_MAXIM_AN)}.`),
});

export type AplicaDrepturiInput = z.infer<typeof aplicaDrepturiSchema>;

export const seteazaZileConcediuImplicitSchema = z.object({
  zile: z.coerce
    .number("Numărul de zile trebuie să fie o cifră.")
    .int()
    .min(0, "Numărul de zile nu poate fi negativ.")
    .max(60, "Numărul de zile nu poate depăși 60."),
});
