// src/schemas/attendance.ts
import { z } from "zod";
import { enumOptional, numarObligatoriu, optional, textOptional } from "./comun";

import { todayInBucharest } from "@/lib/format/date";

/**
 * Valorile enumerate vin din `0013_attendance.sql`, scrise ca uniuni literale
 * (nu importate din tipurile generate) fiindcă schemele Zod trebuie să poată
 * valida și intrarea din URL, unde totul e `string`.
 */
export const TIPURI_ZI = [
  "lucratoare",
  "weekend",
  "sarbatoare",
  "concediu",
  "medical",
  "absenta_nemotivata",
  "delegatie",
] as const;
export type TipZi = (typeof TIPURI_ZI)[number];

/** Subset ALES DE UTILIZATOR în formular: restul se derivă din calendar (vezi `etichete.ts`). */
export const TIPURI_ZI_ALEGERE = [
  "concediu",
  "medical",
  "absenta_nemotivata",
  "delegatie",
] as const;

export const STATUS_PERIOADA = ["deschisa", "in_aprobare", "blocata"] as const;

/** Cele patru moduri de pontare rapidă (0096). `oprit` = numai formularul vechi. */
export const MODURI_PONTARE_RAPIDA = ["oprit", "confirmare", "ceas", "ambele"] as const;
export type ModPontareRapida = (typeof MODURI_PONTARE_RAPIDA)[number];

/*
 * `MOD_PONTARE_IMPLICIT` a stat aici, ca valoare de rezervă pentru firmele fără
 * niciun rând de setări. A plecat în `src/domain/attendance/pontare-rapida.ts`
 * (`IMPLICIT_PONTARE_RAPIDA`) odată cu 0115, care mută setările pontării rapide
 * în tabela lor. Implicitul stă acum lângă funcția care îl aplică, cu teste, și
 * e o singură sursă — nu două constante care se pot despărți.
 */

/**
 * Cum se verifică prezența la pontarea rapidă (0096, extins de 0115).
 *
 * `optional` e starea care lipsea. `cod_qr` înseamnă OBLIGATORIU: butonul
 * obișnuit de pe ecranul de start nu se mai desenează deloc, deci cine n-are
 * afișul lângă el nu mai poate ponta. Nu exista nicio valoare pentru „afișul
 * merge pentru cine îl scanează, butonul rămâne pentru restul" — adică fix ce
 * vrea o firmă care tocmai și-a tipărit primul afiș.
 */
export const VERIFICARI_PONTARE = ["fara", "optional", "cod_qr"] as const;
export type VerificarePontare = (typeof VERIFICARI_PONTARE)[number];
export type StatusPerioada = (typeof STATUS_PERIOADA)[number];

export const SURSE_INTRARE = [
  "manuala",
  "import",
  "sincronizare_concedii",
  // 0096: ziua pusă de angajat însuși, din portal. Până acum distincția „cine a
  // scris rândul" trăia doar în `audit_logs`, adică nicăieri unde un raport s-o
  // poată număra.
  "pontare_rapida",
] as const;
export type SursaIntrare = (typeof SURSE_INTRARE)[number];

/**
 * Unde s-a lucrat o zi.
 *
 * Stătea mai jos, în secțiunea planului săptămânal, fiindcă acolo s-a născut
 * (0041). Din 0118 îl folosește și `salveazaZiPontajSchema`, care e declarată
 * ÎNAINTE — iar un `const` de modul citit înaintea declarației lui e o
 * ReferenceError la încărcarea modulului, nu o eroare de tip: `tsc` tace, iar
 * pagina cade la prima cerere. De aceea vocabularul urcă lângă celelalte.
 */
export const TIPURI_PREZENTA = ["birou", "homeoffice", "deplasare", "delegatie"] as const;
export type TipPrezenta = (typeof TIPURI_PREZENTA)[number];

/**
 * Fiecare câmp are `.default(...)`.
 *
 * `filtreDinUrl()` revine la `schema.safeParse({})` când query string-ul e
 * nevalid; fără valori implicite peste tot, revenirea ar eșua și ea, iar
 * utilizatorul ar primi ecranul de eroare pentru un `?limita=abc`.
 */

/** `"08:30"` — format `<input type="time">`. Postgres `time` acceptă șirul ca atare. */
const oraOptionala = z
  .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u), z.literal(""), z.null()])
  .nullable()
  .default(null)
  .transform((v) => (v === "" || v === null ? null : v));

/**
 * Luna curentă e valoarea implicită a filtrului — evaluată LA FIECARE parsare
 * (Zod reapelează funcția, nu o memoizează la definirea schemei), altfel
 * `luna` ar rămâne înghețată la luna în care a pornit procesul serverului.
 */
const lunaImplicita = () => Number(todayInBucharest().slice(5, 7));

export const filtrePontajSchema = z.object({
  luna: z.coerce.number().int().min(1).max(12).default(lunaImplicita),
  departament: optional(z.uuid()),
  cauta: optional(z.string().max(60)),
  cursor: optional(z.string().max(256)),
  // Plafonat la 30, nu la 100 ca în restul aplicației: foaia colectivă
  // încarcă și pontajul lunii pentru fiecare angajat din pagină — max_rows =
  // 1000 în PostgREST, iar 30 angajați × 31 zile = 930 rânduri < 1000.
  limita: z.coerce.number().int().min(5).max(30).default(25),
});
export type FiltrePontaj = z.output<typeof filtrePontajSchema>;

export const filtreAprobareSchema = z.object({
  luna: z.coerce.number().int().min(1).max(12).default(lunaImplicita),
  departament: optional(z.uuid()),
});
export type FiltreAprobare = z.output<typeof filtreAprobareSchema>;

// ── Intrări de scriere ──────────────────────────────────────────────────────

export const deschidePerioadaSchema = z.object({
  an: z.coerce.number().int().min(2000).max(2100),
  luna: z.coerce.number().int().min(1).max(12),
  observatii: textOptional(1000),
});
export type DeschidePerioada = z.output<typeof deschidePerioadaSchema>;

export const idPerioadaSchema = z.object({ id: z.uuid() });

/**
 * `ore_suplimentare`/`ore_noapte` oglindesc CHECK-urile din bază
 * (`attendance_entries_suplimentare_ck`/`_noapte_ck`): nu pot depăși
 * `ore_lucrate`. Verificate și aici, ca omul să afle înainte de round-trip —
 * decizia finală rămâne oricum a bazei.
 */
export const salveazaZiPontajSchema = z
  .object({
    employee_id: z.uuid().nullable().default(null),
    data: z.iso.date(),
    ora_inceput: oraOptionala,
    ora_sfarsit: oraOptionala,
    ore_lucrate: z.coerce.number().min(0).max(24),
    ore_suplimentare: z.coerce.number().min(0).max(24).default(0),
    ore_noapte: z.coerce.number().min(0).max(24).default(0),
    tip_zi: enumOptional(TIPURI_ZI, "Alegeți tipul zilei din listă."),
    /*
     * Unde s-a lucrat ziua — același vocabular ca planul săptămânal (0041),
     * ajuns pe pontajul REAL abia în 0118.
     *
     * `enumOptional`, nu `z.enum`: un `<select>` neatins trimite `""` prin
     * `FormData`, iar coloana e nullable fiindcă toate zilele de dinainte de
     * 0118 și tot ce scrie pontarea rapidă de pe telefon n-au declarat nimic.
     * „Nedeclarat" e o stare, nu o eroare de completare.
     */
    tip_prezenta: enumOptional(TIPURI_PREZENTA, "Alegeți locul de muncă din listă."),
    observatii: textOptional(1000),
    /*
     * Răspunsul la întrebarea „contractul e suspendat pentru absențe
     * nemotivate — generăm decizia de reluare cu data de azi?".
     *
     * `false` implicit, deci o cerere care nu știe de conflict primește
     * conflictul, nu îl calcă. Un `<input type="hidden" value="true">` din
     * dialogul de confirmare e tot ce trebuie pe partea de client.
     */
    confirma_reluare: z.coerce.boolean().default(false),
  })
  .refine((v) => v.ore_suplimentare <= v.ore_lucrate, {
    message: "Orele suplimentare nu pot depăși orele lucrate.",
    path: ["ore_suplimentare"],
  })
  .refine((v) => v.ore_noapte <= v.ore_lucrate, {
    message: "Orele de noapte nu pot depăși orele lucrate.",
    path: ["ore_noapte"],
  });
export type SalveazaZiPontaj = z.output<typeof salveazaZiPontajSchema>;

export const stergeZiPontajSchema = z.object({ id: z.uuid() });

export const aprobaPontajBlocSchema = z.object({
  period_id: z.uuid(),
  department_id: z.uuid().nullable().default(null),
  observatii: textOptional(1000),
});
export type AprobaPontajBloc = z.output<typeof aprobaPontajBlocSchema>;

/**
 * Decizia pe O SINGURĂ zi de pontaj.
 *
 * Până în 0067 exista doar aprobarea în bloc, pe toată luna, și NICIO cale de
 * respingere: aprobatorul care găsea o zi greșită într-o lună de 200 de
 * angajați putea aproba tot, inclusiv greșeala, sau nimic.
 */
export const decideZiPontajSchema = z
  .object({
    entry_id: z.uuid("Ziua de pontaj selectată nu este validă."),
    aproba: z.coerce.boolean(),
    motiv: z
      .string()
      .trim()
      .max(500, "Motivul nu poate depăși 500 de caractere.")
      .nullable()
      .default(null)
      .transform((v) => (v === null || v.length === 0 ? null : v)),
  })
  .superRefine((valoare, ctx) => {
    // Oglindă a CHECK-ului `attendance_entries_respingere_ck` din 0067.
    if (!valoare.aproba && (valoare.motiv ?? "").trim().length < 5) {
      ctx.addIssue({
        code: "custom",
        path: ["motiv"],
        message: "Respingerea cere un motiv de cel puțin 5 caractere.",
      });
    }
  });
export type DecideZiPontaj = z.output<typeof decideZiPontajSchema>;

export const sincronizeazaConcediileSchema = z.object({
  an: z.coerce.number().int().min(2000).max(2100),
  luna: z.coerce.number().int().min(1).max(12),
});
export type SincronizeazaConcediile = z.output<typeof sincronizeazaConcediileSchema>;

// ── Plan săptămânal (prezență + ore, aprobare individuală) ─────────────────
// `TIPURI_PREZENTA` s-a mutat sus, lângă celelalte vocabulare — îl folosește
// acum și ziua de pontaj real, declarată înaintea acestei secțiuni.

export const STARI_SAPTAMANA_PONTAJ = ["ciorna", "trimisa", "aprobata", "respinsa"] as const;
export type StareSaptamanaPontaj = (typeof STARI_SAPTAMANA_PONTAJ)[number];

/**
 * O zi din plan se declară ca INTERVAL (0081), nu ca număr de ore.
 *
 * `ore_planificate` rămâne în formă, dar e o valoare de tranzit: acțiunea o
 * RESCRIE din interval, prin `oreleZilei`, înainte de a apela RPC-ul. Ce
 * trimite clientul aici nu ajunge niciodată în bază ca atare — la fel ca la
 * ziua individuală.
 *
 * Intervalul e opțional fiindcă o zi nelucrată (weekend debifat, sărbătoare)
 * n-are ce interval să poarte; oglindește `_interval_ck` din 0075, care cere
 * ori amândouă orele, ori niciuna.
 */
const ziPlanificataSchema = z
  .object({
    data: z.iso.date(),
    tip_prezenta: z.enum(TIPURI_PREZENTA),
    ora_inceput: oraOptionala,
    ora_sfarsit: oraOptionala,
    ore_planificate: z.coerce.number().min(0).max(24),
    observatii: textOptional(500),
  })
  .refine((v) => (v.ora_inceput === null) === (v.ora_sfarsit === null), {
    message: "Completați ambele ore, sau niciuna.",
    path: ["ora_sfarsit"],
  });
export type ZiPlanificata = z.output<typeof ziPlanificataSchema>;

/**
 * `saptamana_start` trebuie să fie luni — oglindește constrângerea din
 * `attendance_week_submissions_luni_ck` (0040), verificată și aici ca omul
 * să afle înainte de round-trip, nu doar din eroarea bazei.
 */
export const trimiteSaptamanaPontajSchema = z.object({
  saptamana_start: z.iso.date().refine((v) => new Date(`${v}T00:00:00Z`).getUTCDay() === 1, {
    message: "Săptămâna trebuie să înceapă luni.",
  }),
  status: z.enum(["ciorna", "trimisa"]),
  /*
   * `lucreaza_weekend` NU mai vine de la client (0081 → azi).
   *
   * Se salvează în continuare pe submisie, fiindcă aprobatorul care deschide o
   * săptămână veche trebuie să vadă ce regulă era ATUNCI — dar regula e a
   * FIRMEI, nu a celui care completează formularul. Venind de aici, o cerere
   * fabricată putea declara „la noi se lucrează în weekend" la o firmă de
   * birou, iar sâmbăta lucrată apărea în fața aprobatorului drept program
   * obișnuit. `trimiteSaptamanaPontaj` îl citește acum din
   * `attendance_settings`, exact ca orele, care se rederivă din același rând.
   */
  /**
   * Fișa pentru care se completează săptămâna (0084). `null` = a mea, adică
   * exact comportamentul de dinainte.
   *
   * Nu e o poartă de securitate: `trimite_saptamana_pontaj` o dă mai departe
   * lui `app.poate_scrie_pontaj`, care refuză cu 42501 dacă apelantul n-are
   * `attendance:create` peste angajatul ăla — `all` pentru oricine, `team`
   * doar pentru subalterni, `own` niciodată pentru altcineva.
   */
  employee_id: z.uuid("Angajatul selectat nu este valid.").nullable().default(null),
  zile: z.array(ziPlanificataSchema).min(1).max(7),
});
export type TrimiteSaptamanaPontaj = z.output<typeof trimiteSaptamanaPontajSchema>;

const LUNGIME_MINIMA_MOTIV_RESPINGERE_SAPTAMANA = 5;

export const decideSaptamanaPontajSchema = z
  .object({
    taskId: z.uuid("Sarcina de aprobare selectată nu este validă."),
    decizie: z.enum(["aprobata", "respinsa"]),
    comentariu: textOptional(1000),
    motivRespingere: textOptional(500),
  })
  .superRefine((valoare, ctx) => {
    if (valoare.decizie !== "respinsa") return;
    const lungime = (valoare.motivRespingere ?? "").trim().length;
    if (lungime < LUNGIME_MINIMA_MOTIV_RESPINGERE_SAPTAMANA) {
      ctx.addIssue({
        code: "custom",
        path: ["motivRespingere"],
        message: `Motivul respingerii trebuie să aibă cel puțin ${String(LUNGIME_MINIMA_MOTIV_RESPINGERE_SAPTAMANA)} caractere.`,
      });
    }
  });
export type DecideSaptamanaPontaj = z.output<typeof decideSaptamanaPontajSchema>;

/**
 * Parametrii de dreptul muncii ai organizației.
 *
 * ⚠️ TOATE valorile de aici trebuie confirmate de jurist înainte de a fi
 * folosite la o plată reală. Tabela `attendance_settings` a fost creată
 * DELIBERAT fără valori implicite (migrarea 0013, secțiunea 2, cu un
 * `comment ... 'DE VERIFICAT DE JURIST'` pe fiecare coloană) — tocmai ca
 * nimeni să nu poată calcula un salariu pe niște implicite inventate.
 *
 * Consecința e că, până acum, tabela a rămas complet goală în toate
 * organizațiile: nu exista niciun ecran care s-o scrie. Sporurile de noapte,
 * de weekend și de sărbătoare, intervalul nocturn și termenele de compensare
 * nu erau configurate nicăieri, iar salarizarea cădea tăcut pe cele din
 * `payroll_settings`.
 */
/*
 * ── DE CE `numarObligatoriu` ȘI NU `z.coerce.number()` ─────────────────────
 * Fiindcă `Number("")` e `0`. Șapte dintre câmpurile de mai jos au plafonul de
 * jos chiar 0 — repausurile, pragul de noapte, cele două termene de compensare
 * și cele două de pauză — deci o casetă lăsată goală trecea validarea și se
 * SALVA ca zero, fără niciun mesaj. „Repaus zilnic minim: 0 ore" e o afirmație
 * juridică pe care n-a făcut-o nimeni, iar `app.verifica_pontaj` o folosește
 * apoi ca să nu mai avertizeze niciodată.
 *
 * Pentru celelalte patru, mesajul exista dar era al lui zod, în engleză („Too
 * small: expected number to be >0"), și ajungea într-un `fieldErrors` pe care
 * formularul nu-l citea. Omul citea sub buton „Datele introduse nu sunt
 * valide." — pe un ecran cu cincisprezece casete.
 *
 * `numarObligatoriu` (comun.ts) scoate golul ÎNAINTE de coerciție și cere trei
 * mesaje distincte: lipsă, „nu e număr", „în afara intervalului". Ajutorul a
 * fost scris pentru exact același defect pe salariul de bază; ecranul ăsta nu
 * apucase să treacă pe el. — `schemas/attendance.test.ts`
 */
export const setariPontajSchema = z.object({
  valabil_de_la: z
    .string("Alegeți data de la care se aplică versiunea.")
    .min(1, "Alegeți data de la care se aplică versiunea.")
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "Data trebuie să fie AAAA-LL-ZZ."),
  ore_pe_zi: numarObligatoriu({
    min: 0.5,
    max: 24,
    lipsa: "Completați norma zilnică.",
    mesaj: "Norma zilnică se scrie în ore, de exemplu 8:00.",
    interval: "Norma zilnică e între 0:30 și 24:00.",
  }),
  ore_pe_saptamana: numarObligatoriu({
    min: 0.5,
    max: 168,
    lipsa: "Completați norma săptămânală.",
    mesaj: "Norma săptămânală se scrie în ore, de exemplu 40:00.",
    interval: "Norma săptămânală e între 0:30 și 168:00.",
  }),
  ore_maxime_saptamanale: numarObligatoriu({
    min: 0.5,
    max: 168,
    lipsa: "Completați maximul săptămânal.",
    mesaj: "Maximul săptămânal se scrie în ore, de exemplu 48:00.",
    interval: "Maximul săptămânal e între 0:30 și 168:00.",
  }),
  perioada_referinta_luni: numarObligatoriu({
    min: 1,
    max: 12,
    intreg: true,
    lipsa: "Alegeți perioada de referință.",
    mesaj: "Perioada de referință se măsoară în luni întregi.",
    interval: "Perioada de referință e între 1 și 12 luni.",
  }),
  repaus_zilnic_minim_ore: numarObligatoriu({
    min: 0,
    max: 24,
    lipsa: "Completați repausul zilnic minim.",
    mesaj: "Repausul zilnic se scrie în ore, de exemplu 12:00.",
    interval: "Repausul zilnic e între 0:00 și 24:00.",
  }),
  repaus_saptamanal_minim_ore: numarObligatoriu({
    min: 0,
    max: 168,
    lipsa: "Completați repausul săptămânal minim.",
    mesaj: "Repausul săptămânal se scrie în ore, de exemplu 48:00.",
    interval: "Repausul săptămânal e între 0:00 și 168:00.",
  }),
  /**
   * Ce feluri de muncă are firma (0080). NU sunt „ce sporuri acord": sporurile
   * din art. 123, 137 alin. (2) și 142 alin. (2) sunt obligatorii CÂND munca
   * s-a prestat. Comutatoarele declară doar dacă se prestează, iar ecranul
   * încetează să ceară parametri juridici care nu se aplică.
   *
   * `.default(true)` păstrează comportamentul de azi pentru orice apel care
   * n-a fost încă adaptat — aceeași alegere ca implicitul coloanei din migrare.
   */
  lucreaza_noaptea: z.coerce.boolean().default(true),
  lucreaza_weekend: z.coerce.boolean().default(true),
  lucreaza_sarbatori: z.coerce.boolean().default(true),
  admite_ore_suplimentare: z.coerce.boolean().default(true),
  // Cele patru `spor_*_procent` NU mai sunt aici (0082). Sporurile care intră pe
  // fluturaș se configurează exclusiv în `/salarizare/setari`, pe
  // `payroll_settings.procent_spor_*`, și se citesc din `domain/payroll/calc.ts`.
  // Coloanele au rămas în tabelă, cu `default 0`, deci INSERT-ul de aici merge
  // fără ele — vezi 0082 pentru de ce nu s-au șters.
  noapte_start: z
    .string("Completați ora la care începe fereastra de noapte.")
    .min(1, "Completați ora la care începe fereastra de noapte.")
    .regex(/^\d{2}:\d{2}$/u, "Ora trebuie să fie HH:MM."),
  noapte_sfarsit: z
    .string("Completați ora la care se termină fereastra de noapte.")
    .min(1, "Completați ora la care se termină fereastra de noapte.")
    .regex(/^\d{2}:\d{2}$/u, "Ora trebuie să fie HH:MM."),
  prag_ore_noapte: numarObligatoriu({
    min: 0,
    max: 12,
    lipsa: "Completați pragul de ore de noapte.",
    mesaj: "Pragul se scrie în ore, de exemplu 3:00.",
    interval: "Pragul de noapte e între 0:00 și 12:00.",
  }),
  termen_compensare_suplimentare_zile: numarObligatoriu({
    min: 0,
    max: 365,
    intreg: true,
    lipsa: "Completați termenul de compensare a orelor suplimentare.",
    mesaj: "Termenul se scrie în zile întregi.",
    interval: "Termenul e între 0 și 365 de zile.",
  }),
  termen_compensare_sarbatoare_zile: numarObligatoriu({
    min: 0,
    max: 365,
    intreg: true,
    lipsa: "Completați termenul de compensare a sărbătorilor lucrate.",
    mesaj: "Termenul se scrie în zile întregi.",
    interval: "Termenul e între 0 și 365 de zile.",
  }),
  pauza_masa_minute: numarObligatoriu({
    min: 0,
    max: 240,
    intreg: true,
    lipsa: "Completați durata pauzei de masă.",
    mesaj: "Pauza se scrie în minute întregi.",
    interval: "Pauza de masă e între 0 și 240 de minute.",
  }),
  pauza_masa_inclusa_in_program: z.coerce.boolean(),
  pauza_obligatorie_peste_ore: numarObligatoriu({
    min: 0,
    max: 24,
    lipsa: "Completați durata zilei de la care pauza devine obligatorie.",
    mesaj: "Durata se scrie în ore, de exemplu 6:00.",
    interval: "Durata e între 0:00 și 24:00.",
  }),
  observatii_juridice: z.string().trim().max(2000).nullable().default(null),
});
export type IntrareSetariPontaj = z.output<typeof setariPontajSchema>;

/*
 * `program_start`, `mod_pontare_rapida` și `verificare_pontare` NU mai sunt în
 * schema de mai sus (0115). Erau trei câmpuri operaționale într-un formular de
 * parametri juridici VERSIONAȚI: ca să pornești un buton de pontare trebuia să
 * reconfirmi optsprezece cifre de dreptul muncii și să alegi o dată de intrare
 * în vigoare. Au trecut în `setariPontareRapidaSchema`, care scrie într-o tabelă
 * fără istoric. Coloanele rămân pe `attendance_settings` cu `default`-urile lor,
 * deci INSERT-ul de aici merge fără ele.
 */

/**
 * Cum se pontează angajatul de pe telefon.
 *
 * Un rând per firmă, salvat dintr-o apăsare — fără `valabil_de_la`, fiindcă nu
 * există nimic de reconstituit pentru o lună trecută.
 *
 * `program_start` e OPȚIONAL: o firmă fără program fix nu trebuie să inventeze
 * unul. Dar modurile care propun un interval — `confirmare` și `ambele` — n-au
 * ce propune fără el, de unde verificarea încrucișată. Aceeași regulă e scrisă
 * și ca `check` în bază (`setari_pontare_rapida_program_ck`): constrângerea e
 * plasa de SUB filtru, pentru orice cale care ar ocoli schema asta.
 */
export const setariPontareRapidaSchema = z
  .object({
    mod_pontare_rapida: z.enum(MODURI_PONTARE_RAPIDA),
    verificare_pontare: z.enum(VERIFICARI_PONTARE),
    program_start: optional(z.string().regex(/^\d{2}:\d{2}$/u, "Ora trebuie să fie HH:MM.")),
    /*
     * Dacă pontajul trece printr-un pas de aprobare (0118).
     *
     * Polaritate POZITIVĂ, identică cu numele coloanei: bifat = se cere
     * aprobare. O bifă „nu are nevoie de aprobare" ar fi cerut o negație între
     * ecran și bază, adică exact locul unde cineva o repară pe jumătate.
     *
     * `z.coerce.boolean()` e convenția depozitului pentru bifele din
     * `FormData` (`payroll.ts:53`): o casetă nebifată nu trimite deloc cheia,
     * iar `Boolean(undefined)` e `false` — ceea ce e chiar înțelesul ei.
     */
    necesita_aprobare: z.coerce.boolean(),
  })
  .refine(
    (v) => v.program_start !== null || !["confirmare", "ambele"].includes(v.mod_pontare_rapida),
    {
      message: "Completați ora de început a programului: fără ea nu se poate propune un interval.",
      path: ["program_start"],
    },
  );
export type IntrareSetariPontareRapida = z.output<typeof setariPontareRapidaSchema>;

/**
 * Schemele pontării rapide.
 *
 * TOATE sunt goale în afară de codul QR, și asta e ideea: acțiunea nu primește
 * de la client nici ora, nici orele, nici angajatul. Ora vine din ceasul
 * serverului, orele se derivă pe server din setările organizației, iar fișa se
 * rezolvă din sesiune. Singurul lucru pe care omul îl poate declara e că a
 * scanat afișul de la punctul de lucru — și chiar și ăla se verifică pe server.
 */
const codPunctLucru = optional(
  z.string().trim().min(16, "Codul scanat nu e valid.").max(64, "Codul scanat nu e valid."),
);

export const pontezaIntrareaSchema = z.object({ cod_punct_lucru: codPunctLucru });
export const pontezaIesireaSchema = z.object({ cod_punct_lucru: codPunctLucru });
export const confirmaZiuaStandardSchema = z.object({ cod_punct_lucru: codPunctLucru });

/**
 * Decizia de suspendare pentru absențe nemotivate.
 *
 * `data_sfarsit` e nullable ȘI implicit null: decizia se ia de obicei cât timp
 * omul încă lipsește, iar capătul vine abia când se întoarce. Un capăt explicit
 * rămâne posibil, pentru înregistrarea retroactivă a unei perioade încheiate.
 */
export const emiteSuspendareAbsenteSchema = z
  .object({
    employee_id: z.uuid(),
    data_inceput: z.iso.date(),
    data_sfarsit: z
      .union([z.iso.date(), z.literal(""), z.null()])
      .nullable()
      .default(null),
  })
  .transform((v) => ({
    ...v,
    data_sfarsit: v.data_sfarsit === "" ? null : v.data_sfarsit,
  }))
  .refine((v) => v.data_sfarsit === null || v.data_sfarsit >= v.data_inceput, {
    message: "Sfârșitul suspendării nu poate fi înaintea începutului.",
    path: ["data_sfarsit"],
  });
export type EmiteSuspendareAbsente = z.output<typeof emiteSuspendareAbsenteSchema>;
