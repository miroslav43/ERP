// src/domain/import/validare.ts
// Validare pe rând: adunăm TOATE erorile rândului (nu ne oprim la prima),
// iar rândurile corecte rămân importabile chiar dacă altele sunt respinse.
import { z } from "zod";
import type { CampImport, RandMapat } from "./mapare";

export type EroareRand = { readonly rand: number; readonly camp: string; readonly mesaj: string };
export type RezultatValidare = {
  readonly valide: readonly AngajatValidat[];
  readonly invalide: readonly EroareRand[];
};

const PONDERI_CNP = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9] as const;

export function areCnpCifraControlValida(cnp: string): boolean {
  if (!/^\d{13}$/.test(cnp)) return false;
  const suma = PONDERI_CNP.reduce((acc, pondere, i) => acc + Number(cnp[i] ?? "0") * pondere, 0);
  const rest = suma % 11;
  return (rest === 10 ? 1 : rest) === Number(cnp[12] ?? "-1");
}

export function dataNasteriiDinCnp(cnp: string): string | null {
  const s = Number(cnp[0] ?? "0");
  const secol =
    s === 1 || s === 2 ? 1900 : s === 3 || s === 4 ? 1800 : s === 5 || s === 6 ? 2000 : null;
  const an = Number(cnp.slice(1, 3));
  const luna = Number(cnp.slice(3, 5));
  const zi = Number(cnp.slice(5, 7));
  const judet = Number(cnp.slice(7, 9));
  if (luna < 1 || luna > 12 || zi < 1 || zi > 31) return null;
  if (!((judet >= 1 && judet <= 52) || judet === 70)) return null;
  if (secol === null) return ""; // rezident/cetățean străin: secolul nu e determinabil
  const data = new Date(Date.UTC(secol + an, luna - 1, zi));
  if (data.getUTCMonth() !== luna - 1 || data.getUTCDate() !== zi) return null;
  return data.toISOString().slice(0, 10);
}

export function esteIbanValid(iban: string): boolean {
  const curat = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(curat)) return false;
  if (curat.startsWith("RO") && curat.length !== 24) return false;
  const rearanjat = curat.slice(4) + curat.slice(0, 4);
  const numeric = [...rearanjat]
    .map((c) => (/\d/.test(c) ? c : String(c.charCodeAt(0) - 55)))
    .join("");
  let rest = 0;
  for (const cifra of numeric) rest = (rest * 10 + Number(cifra)) % 97;
  return rest === 1;
}

function normalizeazaData(text: string): string | null {
  const curat = text.trim().replace(/\s+/g, "");
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(curat);
  const ro = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(curat);
  const parti = iso
    ? { an: iso[1], luna: iso[2], zi: iso[3] }
    : ro
      ? { an: ro[3], luna: ro[2], zi: ro[1] }
      : null;
  if (!parti || !parti.an || !parti.luna || !parti.zi) return null;
  const an = Number(parti.an);
  const luna = Number(parti.luna);
  const zi = Number(parti.zi);
  const data = new Date(Date.UTC(an, luna - 1, zi));
  if (data.getUTCFullYear() !== an || data.getUTCMonth() !== luna - 1 || data.getUTCDate() !== zi)
    return null;
  return `${parti.an}-${String(luna).padStart(2, "0")}-${String(zi).padStart(2, "0")}`;
}

function normalizeazaNumar(text: string): number | null {
  const curat = text.replace(/[\s\u00a0]|lei|RON/gi, "");
  const cuPunct = curat.includes(",") ? curat.replace(/\./g, "").replace(",", ".") : curat;
  if (!/^-?\d+(\.\d+)?$/.test(cuPunct)) return null;
  const valoare = Number(cuPunct);
  return Number.isFinite(valoare) ? valoare : null;
}

function normalizeazaGen(text: string): "masculin" | "feminin" | "nedeclarat" {
  const cheie = text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim();
  if (["m", "b", "masculin", "barbat", "bărbat"].includes(cheie)) return "masculin";
  if (["f", "feminin", "femeie"].includes(cheie)) return "feminin";
  return "nedeclarat";
}

function desparteNumeComplet(text: string): { nume: string; prenume: string } | null {
  const parti = text.split(/\s+/).filter((p) => p.length > 0);
  const [primul, ...restul] = parti;
  if (primul === undefined || restul.length === 0) return null;
  // Convenție românească pentru state de plată: primul token e numele de familie.
  return { nume: primul, prenume: restul.join(" ") };
}

export const schemaAngajatValidat = z.object({
  rand: z.number().int().positive(),
  /**
   * OPȚIONALĂ din 0069 — gol înseamnă „atribuie contorul organizației".
   *
   * Cerând-o, importul avea propriul regim de numerotare, paralel cu contorul
   * pe care îl avansează `urmatoarea_marca` la înrolare. Un import cu mărcile
   * 0001–0200, urmat de o înrolare, producea „0001" a doua oară și lovea
   * `employees_org_marca_uniq`.
   */
  marca: z
    .string()
    .trim()
    .max(32, "Marca poate avea cel mult 32 de caractere.")
    .optional()
    .transform((v) => (v === undefined || v.length === 0 ? undefined : v)),
  last_name: z
    .string()
    .trim()
    .min(1, "Numele este obligatoriu.")
    .max(80, "Numele poate avea cel mult 80 de caractere."),
  first_name: z
    .string()
    .trim()
    .min(1, "Prenumele este obligatoriu.")
    .max(80, "Prenumele poate avea cel mult 80 de caractere."),
  hired_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data angajării este obligatorie."),
  cnp: z
    .string()
    .regex(/^\d{13}$/, "CNP-ul trebuie să aibă exact 13 cifre.")
    .refine(areCnpCifraControlValida, "CNP-ul nu trece verificarea cifrei de control.")
    .optional(),
  email_personal: z
    .email("Adresa de e-mail nu este validă.")
    .max(160, "Adresa de e-mail este prea lungă.")
    .optional(),
  telefon: z
    .string()
    .regex(/^\+?\d{7,15}$/, "Numărul de telefon trebuie să conțină între 7 și 15 cifre.")
    .optional(),
  data_nasterii: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data nașterii nu este o dată calendaristică validă.")
    .optional(),
  gen: z.enum(["masculin", "feminin", "nedeclarat"]).optional(),
  cetatenie: z
    .string()
    .regex(/^[A-Z]{2}$/, "Cetățenia se completează cu codul de țară din două litere (ex. RO).")
    .optional(),
  adresa_strada: z.string().max(200, "Adresa este prea lungă.").optional(),
  adresa_oras: z.string().max(120, "Localitatea este prea lungă.").optional(),
  adresa_judet: z.string().max(60, "Județul este prea lung.").optional(),
  adresa_cod_postal: z
    .string()
    .regex(/^\d{6}$/, "Codul poștal are 6 cifre.")
    .optional(),
  departament: z.string().max(160, "Denumirea departamentului este prea lungă.").optional(),
  functie: z.string().max(160, "Denumirea funcției este prea lungă.").optional(),
  manager_marca: z.string().max(32, "Marca managerului este prea lungă.").optional(),
  numar_contract: z
    .string()
    .max(40, "Numărul contractului poate avea cel mult 40 de caractere.")
    .optional(),
  data_contract: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data contractului nu este validă.")
    .optional(),
  tip_contract: z.enum(["nedeterminat", "determinat"]).optional(),
  contract_pana_la: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de expirare a contractului nu este validă.")
    .optional(),
  salariu: z
    .number()
    .min(0, "Salariul nu poate fi negativ.")
    .max(1_000_000, "Salariul depășește plafonul acceptat.")
    .optional(),
  norma_ore: z
    .number()
    .gt(0, "Norma trebuie să fie mai mare decât zero.")
    .max(48, "Norma nu poate depăși 48 de ore pe săptămână.")
    .optional(),
  zile_concediu: z
    .number()
    .int()
    .min(0)
    .max(60, "Zilele de concediu trebuie să fie între 0 și 60.")
    .optional(),
  persoane_intretinere: z
    .number()
    .int()
    .min(0)
    .max(20, "Numărul persoanelor în întreținere trebuie să fie între 0 și 20.")
    .optional(),
  iban: z
    .string()
    .refine(esteIbanValid, "IBAN-ul nu trece verificarea cifrei de control.")
    .optional(),
  banca: z.string().max(80, "Denumirea băncii este prea lungă.").optional(),
});

export type AngajatValidat = z.infer<typeof schemaAngajatValidat>;

/**
 * Forma unei valori sensibile după criptare.
 *
 * `bytea` circulă prin PostgREST ca text hexazecimal `\x…`, iar versiunea cheii
 * este `int` în schemă. Amprenta este un HMAC, nu un hash simplu: peste 13 cifre
 * cu structură cunoscută, un hash fără cheie se sparge prin dicționar.
 */
export const schemaValoareProtejata = z.object({
  ciphertext: z.string().regex(/^\\x[0-9a-f]+$/, "Criptotext invalid."),
  iv: z.string().regex(/^\\x[0-9a-f]+$/, "Vector de inițializare invalid."),
  tag: z.string().regex(/^\\x[0-9a-f]+$/, "Etichetă de autentificare invalidă."),
  keyVersion: z.number().int().positive(),
  last4: z.string().max(4),
  hash: z.string().min(1),
});

export type ValoareProtejata = z.infer<typeof schemaValoareProtejata>;

/**
 * Lotul persistat între previzualizare și aplicare.
 *
 * CNP-ul și IBAN-ul apar EXCLUSIV în formă criptată. Câmpurile `cnp` și `iban`
 * în clar sunt omise deliberat: lotul ajunge într-un fișier în Storage, iar un
 * import uitat acolo ar fi fost o breșă completă, fără să atingă nicio politică
 * RLS.
 */
export const schemaAngajatProtejat = schemaAngajatValidat.omit({ cnp: true, iban: true }).extend({
  cnpProtejat: schemaValoareProtejata.optional(),
  ibanProtejat: schemaValoareProtejata.optional(),
});

export type AngajatProtejat = z.infer<typeof schemaAngajatProtejat>;

export const schemaLotImport = z.array(schemaAngajatProtejat).max(1000);

const ETICHETE: Readonly<Record<string, string>> = {
  marca: "Marcă",
  last_name: "Nume",
  first_name: "Prenume",
  hired_on: "Data angajării",
  cnp: "CNP",
  email_personal: "E-mail personal",
  telefon: "Telefon",
  data_nasterii: "Data nașterii",
  gen: "Gen",
  cetatenie: "Cetățenie",
  adresa_strada: "Stradă",
  adresa_oras: "Localitate",
  adresa_judet: "Județ",
  adresa_cod_postal: "Cod poștal",
  departament: "Departament",
  functie: "Funcție",
  manager_marca: "Marca managerului",
  numar_contract: "Număr contract",
  data_contract: "Data contractului",
  tip_contract: "Tip contract",
  contract_pana_la: "Contract valabil până la",
  salariu: "Salariu de bază",
  norma_ore: "Normă (ore/săptămână)",
  zile_concediu: "Zile de concediu",
  persoane_intretinere: "Persoane în întreținere",
  iban: "IBAN",
  banca: "Banca",
};

type Candidat = Record<string, unknown>;

function construiesteCandidat(
  valori: Readonly<Partial<Record<CampImport, string>>>,
  rand: number,
  erori: EroareRand[],
): Candidat {
  const candidat: Candidat = { rand };
  const text = (camp: CampImport): string | undefined => valori[camp];
  const adaugaEroare = (camp: string, mesaj: string): void => {
    erori.push({ rand, camp: ETICHETE[camp] ?? camp, mesaj });
  };

  const numeComplet = text("nume_complet");
  const nume = text("nume");
  const prenume = text("prenume");
  if (nume !== undefined && prenume !== undefined) {
    candidat["last_name"] = nume;
    candidat["first_name"] = prenume;
  } else if (numeComplet !== undefined) {
    const despartit = desparteNumeComplet(numeComplet);
    if (despartit === null) {
      adaugaEroare(
        "last_name",
        "Numele complet trebuie să conțină numele de familie și prenumele.",
      );
    } else {
      candidat["last_name"] = despartit.nume;
      candidat["first_name"] = despartit.prenume;
    }
  }

  const simple: readonly (readonly [CampImport, string])[] = [
    ["marca", "marca"],
    ["email", "email_personal"],
    ["adresa_strada", "adresa_strada"],
    ["adresa_oras", "adresa_oras"],
    ["adresa_judet", "adresa_judet"],
    ["adresa_cod_postal", "adresa_cod_postal"],
    ["departament", "departament"],
    ["functie", "functie"],
    ["manager_marca", "manager_marca"],
    ["numar_contract", "numar_contract"],
    ["banca", "banca"],
  ];
  for (const [sursa, tinta] of simple) {
    const valoare = text(sursa);
    if (valoare !== undefined) candidat[tinta] = valoare;
  }

  const telefon = text("telefon");
  if (telefon !== undefined) candidat["telefon"] = telefon.replace(/[\s.()\-/]/g, "");
  const cnp = text("cnp");
  if (cnp !== undefined) candidat["cnp"] = cnp.replace(/\s+/g, "");
  const iban = text("iban");
  if (iban !== undefined) candidat["iban"] = iban.replace(/\s+/g, "").toUpperCase();
  const cetatenie = text("cetatenie");
  if (cetatenie !== undefined) candidat["cetatenie"] = cetatenie.trim().toUpperCase().slice(0, 2);
  const gen = text("gen");
  if (gen !== undefined) candidat["gen"] = normalizeazaGen(gen);
  const tip = text("tip_contract");
  if (tip !== undefined) {
    candidat["tip_contract"] = normalizeazaAntetSimplu(tip).startsWith("determinat")
      ? "determinat"
      : "nedeterminat";
  }

  const date: readonly (readonly [CampImport, string])[] = [
    ["data_angajarii", "hired_on"],
    ["data_nasterii", "data_nasterii"],
    ["data_contract", "data_contract"],
    ["contract_pana_la", "contract_pana_la"],
  ];
  for (const [sursa, tinta] of date) {
    const valoare = text(sursa);
    if (valoare === undefined) continue;
    const normalizata = normalizeazaData(valoare);
    if (normalizata === null) {
      adaugaEroare(
        tinta,
        `„${valoare}" nu este o dată validă. Folosește zz.ll.aaaa sau aaaa-ll-zz.`,
      );
    } else {
      candidat[tinta] = normalizata;
    }
  }

  const numere: readonly (readonly [CampImport, string])[] = [
    ["salariu", "salariu"],
    ["norma_ore", "norma_ore"],
    ["zile_concediu", "zile_concediu"],
    ["persoane_intretinere", "persoane_intretinere"],
  ];
  for (const [sursa, tinta] of numere) {
    const valoare = text(sursa);
    if (valoare === undefined) continue;
    const numar = normalizeazaNumar(valoare);
    if (numar === null) {
      adaugaEroare(
        tinta,
        `„${valoare}" nu este un număr. Scrie doar cifre, cu virgulă pentru zecimale.`,
      );
    } else {
      candidat[tinta] = numar;
    }
  }
  return candidat;
}

function normalizeazaAntetSimplu(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim();
}

export function valideazaRanduri(randuri: readonly RandMapat[]): RezultatValidare {
  const valide: AngajatValidat[] = [];
  const invalide: EroareRand[] = [];
  const marciVazute = new Map<string, number>();
  const cnpVazute = new Map<string, number>();

  for (const { rand, valori } of randuri) {
    const eroriRand: EroareRand[] = [];
    const candidat = construiesteCandidat(valori, rand, eroriRand);
    const campuriCuEroare = new Set(eroriRand.map((e) => e.camp));

    const rezultat = schemaAngajatValidat.safeParse(candidat);
    if (!rezultat.success) {
      const { fieldErrors } = z.flattenError(rezultat.error);
      for (const [camp, mesaje] of Object.entries(fieldErrors)) {
        const eticheta = ETICHETE[camp] ?? camp;
        const primul = mesaje?.[0];
        // Nu dublăm eroarea: dacă formatul a picat deja la normalizare, zod vede câmpul lipsă.
        if (primul !== undefined && !campuriCuEroare.has(eticheta)) {
          eroriRand.push({ rand, camp: eticheta, mesaj: primul });
        }
      }
    }

    if (eroriRand.length > 0 || !rezultat.success) {
      invalide.push(...eroriRand);
      continue;
    }

    const angajat = rezultat.data;
    // Dedublarea privește DOAR mărcile scrise în fișier. Cele lăsate goale le
    // atribuie contorul organizației la inserție, iar el nu poate produce
    // duplicate: `urmatoarea_marca` face un singur INSERT … ON CONFLICT DO
    // UPDATE … RETURNING, deci n-are fereastră de cursă.
    if (angajat.marca !== undefined) {
      const cheieMarca = angajat.marca.toLowerCase();
      const randAnterior = marciVazute.get(cheieMarca);
      if (randAnterior !== undefined) {
        invalide.push({
          rand,
          camp: "Marcă",
          mesaj: `Marca „${angajat.marca}" apare deja la rândul ${randAnterior}.`,
        });
        continue;
      }
    }
    if (angajat.cnp !== undefined) {
      const randCnp = cnpVazute.get(angajat.cnp);
      if (randCnp !== undefined) {
        invalide.push({ rand, camp: "CNP", mesaj: `Același CNP apare deja la rândul ${randCnp}.` });
        continue;
      }
      const dinCnp = dataNasteriiDinCnp(angajat.cnp);
      if (dinCnp === null) {
        invalide.push({
          rand,
          camp: "CNP",
          mesaj: "CNP-ul conține o dată de naștere sau un cod de județ imposibil.",
        });
        continue;
      }
      if (
        dinCnp !== "" &&
        angajat.data_nasterii !== undefined &&
        angajat.data_nasterii !== dinCnp
      ) {
        invalide.push({
          rand,
          camp: "Data nașterii",
          mesaj: "Data nașterii nu corespunde cu cea codificată în CNP.",
        });
        continue;
      }
      cnpVazute.set(angajat.cnp, rand);
    }
    if (angajat.marca !== undefined) marciVazute.set(angajat.marca.toLowerCase(), rand);
    valide.push(angajat);
  }

  return { valide, invalide };
}
