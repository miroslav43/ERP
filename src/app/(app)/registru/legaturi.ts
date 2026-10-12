// src/app/(app)/registru/legaturi.ts
//
// De la rândul de registru la ecranul documentului-sursă.
//
// ── DE CE O HARTĂ ÎN TYPESCRIPT, NU O COLOANĂ ÎN BAZĂ ─────────────────────
// `entitate_tip` e numele tabelei-sursă (sau un literal — `manual`,
// `payroll_periods_nota`), iar `entitate_id` e rândul ei. Unde locuiește rândul
// ăla în interfață e o decizie de rutare, nu de date: se schimbă când se mută o
// pagină, nu când se schimbă un document. O coloană `url` în registru ar
// îmbătrâni la prima reorganizare a rutelor și ar rămâne greșită pe rândurile
// vechi, tăcut.
//
// ── DE CE NU ARUNCĂ NICIODATĂ ─────────────────────────────────────────────
// Șapte tabele din hartă n-au niciun ecran (evaluări de riscuri, permise de
// lucru cu foc, exerciții de evacuare…), iar un tip nou poate apărea în bază
// înaintea unei rute. `null` înseamnă „n-are ecran propriu" și panoul o SPUNE;
// o excepție ar rupe toată pagina pentru un singur rând.

export type LegaturaDocument = Readonly<{
  href: string;
  eticheta: string;
  /** Un fișier (PDF) se deschide în filă nouă; o pagină a aplicației, nu. */
  inFilaNoua: boolean;
  /** Adresa PDF-ului inline, pentru previzualizare în panou. */
  pdf?: string;
}>;

export type IntrareLegatura = Readonly<{
  entitateTip: string;
  entitateId: string | null;
  /** Rândul-părinte, pentru tipurile din `TIPURI_CU_PARINTE`. `null` = necitit sau ascuns. */
  parinteId: string | null;
  angajatId: string | null;
}>;

/**
 * Sursele al căror ecran e al PĂRINTELUI: un document al vehiculului se vede pe
 * fișa vehiculului, un fluturaș pe perioada lui. Părintele se citește pe server,
 * în `citesteDocumentRegistru`, doar pentru tipurile de aici.
 */
export const TIPURI_CU_PARINTE = [
  "vehicle_documents",
  "fire_extinguisher_checks",
  "iscir_authorizations",
  "inventory_allocations",
  "payroll_entries",
  "per_diem_calculations",
  "course_completion_records",
] as const;

export type TipCuParinte = (typeof TIPURI_CU_PARINTE)[number];

const DESCHIDE = "Deschide documentul";
const DESCHIDE_LISTA = "Deschide lista modulului";

/** Pagină proprie pe id-ul entității. */
const PE_ID: Readonly<Record<string, (id: string) => string>> = {
  leave_requests: (id) => `/concedii/${id}`,
  business_trips: (id) => `/diurna/${id}`,
  trip_sheets: (id) => `/flota/foi/${id}`,
  work_accidents: (id) => `/ssm/accidente/${id}`,
  payroll_periods: (id) => `/salarizare/${id}`,
  payroll_periods_bancar: (id) => `/salarizare/${id}`,
  payroll_periods_nota: (id) => `/salarizare/${id}`,
  payroll_periods_d112: (id) => `/salarizare/${id}`,
  payroll_periods_d112_rect: (id) => `/salarizare/${id}`,
};

/** Pagina părintelui, cu lista modulului drept cădere când părintele nu se vede. */
const CU_PARINTE: Readonly<
  Record<
    TipCuParinte,
    Readonly<{
      pagina: (parinte: string, id: string, angajat: string | null) => string;
      lista: string;
    }>
  >
> = {
  vehicle_documents: { pagina: (p) => `/flota/${p}`, lista: "/flota" },
  fire_extinguisher_checks: { pagina: (p) => `/ssm/stingatoare/${p}`, lista: "/ssm/stingatoare" },
  iscir_authorizations: { pagina: (p) => `/mentenanta/echipamente/${p}`, lista: "/mentenanta" },
  inventory_allocations: { pagina: (p, id) => `/inventar/${p}/pv/${id}`, lista: "/inventar" },
  payroll_entries: { pagina: (p, id) => `/salarizare/${p}/${id}`, lista: "/salarizare" },
  per_diem_calculations: { pagina: (p) => `/diurna/${p}/decont`, lista: "/diurna" },
  // Adeverința de absolvire: ecranul ei e stadiul cursului, pe angajatul ei.
  course_completion_records: {
    pagina: (p, _id, angajat) =>
      angajat === null ? `/cursuri/${p}/stadiu` : `/cursuri/${p}/stadiu?angajat=${angajat}`,
    lista: "/cursuri",
  },
};

/** Documentele care trăiesc în fișa angajatului. Fără angajat cunoscut, n-au țintă. */
const LA_ANGAJAT: Readonly<Record<string, (angajat: string) => string>> = {
  employment_contracts: (a) => `/angajati/${a}/documente`,
  employee_documents: (a) => `/angajati/${a}/documente`,
  job_descriptions: (a) => `/angajati/${a}/documente`,
  employee_evaluations: (a) => `/angajati/${a}`,
};

/** Doar listă, fără pagină pe id. */
const LISTA: Readonly<Record<string, string>> = {
  ssm_trainings: "/ssm/instruiri",
  ppe_issuances: "/ssm/eip",
  occupational_health_exams: "/ssm/medicina-muncii",
  personnel_authorizations: "/ssm/autorizatii",
  payroll_garnishments: "/salarizare/popriri",
  reges_propuneri: "/reges/propuneri",
  maintenance_interventions: "/mentenanta/interventii",
  pontaj_arhive_lunare: "/pontaj/arhiva",
};

const esteCuParinte = (tip: string): tip is TipCuParinte =>
  (TIPURI_CU_PARINTE as readonly string[]).includes(tip);

// `Object.hasOwn`, nu indexare directă: `constructor` e un `entitate_tip` valid
// ca text ȘI o cheie din prototip — citit direct, ar întoarce funcția `Object`.
const din = <T>(harta: Readonly<Record<string, T>>, cheie: string): T | undefined =>
  Object.hasOwn(harta, cheie) ? harta[cheie] : undefined;

export function legaturaDocument({
  entitateTip,
  entitateId,
  parinteId,
  angajatId,
}: IntrareLegatura): LegaturaDocument | null {
  if (entitateId === null) return null;

  if (entitateTip === "hr_issued_documents") {
    const pdf = `/documente/${entitateId}?format=pdf`;
    return { href: pdf, eticheta: "Deschide PDF-ul", inFilaNoua: true, pdf };
  }

  const peId = din(PE_ID, entitateTip);
  if (peId !== undefined) return { href: peId(entitateId), eticheta: DESCHIDE, inFilaNoua: false };

  if (esteCuParinte(entitateTip)) {
    const { pagina, lista } = CU_PARINTE[entitateTip];
    return parinteId === null
      ? { href: lista, eticheta: DESCHIDE_LISTA, inFilaNoua: false }
      : { href: pagina(parinteId, entitateId, angajatId), eticheta: DESCHIDE, inFilaNoua: false };
  }

  const laAngajat = din(LA_ANGAJAT, entitateTip);
  if (laAngajat !== undefined) {
    return angajatId === null
      ? null
      : { href: laAngajat(angajatId), eticheta: DESCHIDE, inFilaNoua: false };
  }

  const lista = din(LISTA, entitateTip);
  if (lista !== undefined) return { href: lista, eticheta: DESCHIDE_LISTA, inFilaNoua: false };

  return null;
}
