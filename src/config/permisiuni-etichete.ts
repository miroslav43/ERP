// src/config/permisiuni-etichete.ts
/**
 * Ce înseamnă, în cuvinte, fiecare cheie de permisiune `resursa:acțiune`.
 *
 * Ecranul de permisiuni per angajat afișa cheile brute — `announcements`,
 * `read`, `trip_sheets` — unui administrator care nu are de unde ști ce sunt
 * (QA UX-016, ADM-012). Aici stă singurul dicționar care le traduce.
 *
 * `Record` pe uniunile derivate din `PermissionKey`: o resursă sau o acțiune nouă
 * în `permissions.ts` face typecheck-ul roșu până primește etichetă aici — o
 * omisiune nu se poate scrie, deci ecranul nu poate afișa din nou o cheie brută.
 *
 * Numele MODULELOR nu se repetă aici: grupul vine din `FEATURES[modul].denumire`,
 * ca să existe un singur glosar. Legătura resursă→modul e verificată în test
 * contra registrului porților de rută (`porti-ruta.ts`), adică după modulul care
 * păzește efectiv paginile, nu din memorie.
 *
 * Fișierul e PUR (fără `server-only`, fără `"use client"`): îl folosește pagina
 * de server, care trimite componentei client doar șirurile gata calculate.
 */
import { FEATURES, type FeatureKey } from "@/config/features";
import { PERMISSION_KEYS, type PermissionKey } from "@/config/permissions";

type Resursa<K> = K extends `${infer R}:${string}` ? R : never;
type Actiune<K> = K extends `${string}:${infer A}` ? A : never;

export type ResursaPermisiune = Resursa<PermissionKey>;
export type ActiunePermisiune = Actiune<PermissionKey>;

export type EtichetaResursa = Readonly<{
  nume: string;
  /** O frază despre CE păzește resursa, afișată sub titlul secțiunii. */
  descriere: string;
  /** Modulul care trebuie activ ca dreptul să aibă efect; `null` = nucleul. */
  modul: FeatureKey | null;
  /**
   * Nicio pagină și nicio acțiune din aplicație nu citește resursa: un drept
   * acordat aici n-ar schimba nimic pe ecran. Testul cere ca steagul să cadă
   * odată cu primul consumator.
   */
  ascunsa?: true;
}>;

export const ETICHETE_RESURSE: Readonly<Record<ResursaPermisiune, EtichetaResursa>> = {
  announcements: {
    nume: "Anunțuri",
    descriere: "Anunțurile interne publicate către angajați.",
    modul: "announcements",
  },
  attendance: {
    nume: "Pontaj",
    descriere: "Foaia de pontaj: orele lucrate, zilele libere și aprobarea lor.",
    modul: "attendance",
  },
  audit: {
    nume: "Jurnal de audit",
    descriere: "Istoricul modificărilor făcute în aplicație: cine, ce și când.",
    modul: null,
  },
  branding: {
    nume: "Șabloane și identitate vizuală",
    descriere:
      "Șabloanele documentelor emise din fișa angajatului și elementele vizuale ale firmei.",
    modul: null,
  },
  checklists: {
    nume: "Parcursuri",
    descriere: "Parcursurile de integrare a angajaților noi și de plecare din firmă, cu pașii lor.",
    modul: "onboarding",
  },
  // Ascunsă fiindcă AZI nicio pagină nu citește tabelele pe care le păzește —
  // dar păzește mai mult decât sugerează numele, iar testul (e) caută doar
  // literalul `"compliance:`. În bază, `compliance:read` e condiție pentru TOATĂ
  // tabela `expirables` (0008, `expirabile_select`), deci și pentru
  // `compliance_alerts` și `alert_notifications`; `compliance:update` păzește
  // `expirabile_update`/`alerte_update`; `compliance:create/update` păzesc
  // `retention_policies` (0002) și `alert_rules`. Un viitor `from("expirables")`
  // (azi ocolit explicit în ssm.ts, fleet.ts, panou.ts) depinde de
  // `compliance:read` fără să conțină literalul: atunci steagul trebuie scos.
  compliance: {
    nume: "Conformitate",
    descriere: "Parametrii legali și autorizațiile de mediu.",
    modul: null,
    ascunsa: true,
  },
  courses: {
    nume: "Cursuri",
    descriere: "Cursurile de formare și participarea angajaților la ele.",
    modul: "courses",
  },
  departments: {
    nume: "Departamente",
    descriere: "Structura firmei pe departamente și șefii lor.",
    modul: null,
  },
  driver_licenses: {
    nume: "Permise de conducere",
    descriere: "Permisele de conducere ale angajaților: categoriile lor și data la care expiră.",
    modul: "fleet",
  },
  employees: {
    nume: "Angajați",
    descriere: "Fișele de personal ale angajaților.",
    modul: null,
  },
  evaluations: {
    nume: "Evaluări angajați",
    descriere: "Evaluările periodice ale performanței.",
    modul: "evaluations",
  },
  features: {
    nume: "Module ale firmei",
    descriere: "Modulele activate pentru firmă.",
    modul: null,
    ascunsa: true,
  },
  inventory: {
    nume: "Inventar",
    descriere: "Bunurile firmei și predarea lor către angajați.",
    modul: "inventory",
  },
  leave: {
    nume: "Concedii",
    descriere: "Cererile de concediu și soldurile de zile.",
    modul: "leave",
  },
  maintenance: {
    nume: "Mentenanță",
    descriere: "Echipamentele, planurile de mentenanță și sesizările de defecte.",
    modul: "maintenance",
  },
  organizations: {
    nume: "Datele firmei",
    descriere: "Datele de identificare și setările firmei.",
    modul: null,
  },
  payroll: {
    nume: "Salarizare",
    descriere: "Statele de plată, salariile și reținerile.",
    modul: "payroll",
  },
  per_diem: {
    nume: "Deplasări și diurne",
    descriere: "Deplasările în interes de serviciu și decontul diurnelor.",
    modul: "per_diem",
  },
  reges: {
    nume: "REGES-Online",
    descriere: "Registrul general de evidență a salariaților, transmis la Inspecția Muncii.",
    modul: "reges",
  },
  registru: {
    nume: "Registrul documentelor",
    descriere: "Registrul de intrare-ieșire al documentelor firmei.",
    modul: null,
  },
  reports: {
    nume: "Rapoarte",
    descriere: "Rapoartele agregate ale firmei.",
    modul: null,
    ascunsa: true,
  },
  // Pagina de permisiuni n-o arată niciodată (politica din 0063 refuză acordarea
  // ei prin interpuși), dar `Record` cere intrarea — și e corect să existe.
  roles: {
    nume: "Roluri și permisiuni",
    descriere: "Rolurile membrilor și drepturile suplimentare acordate fiecăruia.",
    modul: null,
  },
  ssm: {
    nume: "SSM și PSI",
    descriere:
      "Securitatea și sănătatea în muncă: instruiri, controale medicale, echipament de protecție.",
    modul: "ssm",
  },
  tickets: {
    nume: "Tichete IT",
    descriere: "Solicitările de asistență IT și rezolvarea lor.",
    modul: "ticketing",
  },
  trip_sheets: {
    nume: "Foi de parcurs",
    descriere: "Foile de parcurs ale vehiculelor firmei.",
    modul: "fleet",
  },
  users: {
    nume: "Conturi și membri",
    descriere: "Conturile de acces în aplicație și invitațiile.",
    modul: null,
  },
  vehicle_fines: {
    nume: "Amenzi pe vehicule",
    descriere: "Amenzile primite pe vehiculele firmei, cu termenul de răspuns și șoferul desemnat.",
    modul: "fleet",
  },
  vehicle_incidents: {
    nume: "Incidente și daune",
    descriere:
      "Accidentele, avariile, furturile și vandalismul de pe vehicule, cu dosarul de daună.",
    modul: "fleet",
  },
  vehicles: {
    nume: "Parc auto",
    descriere: "Vehiculele firmei și documentele lor cu termen.",
    modul: "fleet",
  },
};

export const ETICHETE_ACTIUNI: Readonly<Record<ActiunePermisiune, string>> = {
  read: "Citire",
  create: "Creare",
  update: "Modificare",
  delete: "Ștergere",
  approve: "Aprobare",
  export: "Export",
  invite: "Invitare în aplicație",
  transmit: "Transmitere la ITM",
  configure: "Configurare",
};

/**
 * Cheile al căror înțeles NU e „acțiunea pe resursă”. Textele vin din
 * comentariile de lângă fiecare cheie în `permissions.ts`, nu din intuiție:
 * `checklists:update` bifează, iar `checklists:approve` închide.
 */
export const DESCRIERI_CHEI: Readonly<Partial<Record<PermissionKey, string>>> = {
  "attendance:export": "Descarcă arhiva lunară a pontajului (toată firma).",
  "checklists:update": "Bifează pași din parcursul de integrare.",
  "checklists:approve": "Închide sau anulează un parcurs de integrare.",
  "employees:read": "Vede fișele de personal; CNP-ul și IBAN-ul se văd doar cu „Toată firma”.",
  "employees:invite": "Trimite invitația de cont unui angajat (consumă un loc din abonament).",
  "leave:approve": "Aprobă sau respinge cereri de concediu.",
  "payroll:approve": "Aprobă statul de plată.",
  "per_diem:approve": "Aprobă deplasări și deconturi.",
  "reges:transmit": "Trimite înregistrări în registrul oficial REGES.",
  "reges:configure": "Setează conexiunea REGES a firmei.",
  "registru:update": "Închide sau redeschide exercițiul financiar al registrului.",
  "tickets:approve": "Repartizează și închide tichete.",
  "trip_sheets:approve": "Aprobă foi de parcurs.",
};

export type DescrierePermisiune = Readonly<{
  resursa: ResursaPermisiune;
  actiune: ActiunePermisiune;
  modul: FeatureKey | null;
  /** Denumirea modulului, sau „Nucleu” pentru resursele fără modul. */
  grup: string;
  etichetaResursa: string;
  descriereResursa: string;
  etichetaActiune: string;
  /** Fraza întreagă, terminată cu punct. */
  descriere: string;
  ascunsa: boolean;
}>;

export function descriePermisiunea(cheie: PermissionKey): DescrierePermisiune {
  const [resursa, actiune] = cheie.split(":") as [ResursaPermisiune, ActiunePermisiune];
  const eticheta = ETICHETE_RESURSE[resursa];
  const etichetaActiune = ETICHETE_ACTIUNI[actiune];
  return {
    resursa,
    actiune,
    modul: eticheta.modul,
    grup: FEATURES[eticheta.modul ?? "nucleu"].denumire,
    etichetaResursa: eticheta.nume,
    descriereResursa: eticheta.descriere,
    etichetaActiune,
    // Fără `toLowerCase()` pe nume: „SSM și PSI” și „REGES-Online” sunt
    // acronime, iar minusculele le-ar strica.
    descriere: DESCRIERI_CHEI[cheie] ?? `${etichetaActiune} — ${eticheta.nume}.`,
    ascunsa: eticheta.ascunsa === true,
  };
}

/**
 * Ordinea nucleului: întâi ce se deschide cel mai des (oamenii și structura),
 * la urmă ce ține de administrarea documentelor.
 */
const ORDINE_NUCLEU: readonly ResursaPermisiune[] = [
  "employees",
  "departments",
  "organizations",
  "users",
  "audit",
  "branding",
  "registru",
];

const RESURSE_IN_ORDINEA_CHEILOR: readonly string[] = [
  ...new Set(PERMISSION_KEYS.map((c) => c.split(":")[0] ?? c)),
];

/**
 * Cheie de sortare pentru matrice: nucleul întâi, apoi modulele în ordinea din
 * catalog (`FEATURES[modul].sortOrder`). Acțiunile aceleiași resurse primesc
 * aceeași valoare, deci o sortare stabilă le lasă în ordinea din `permissions.ts`.
 */
export function ordineaPermisiunii(cheie: PermissionKey): number {
  const { resursa, modul } = descriePermisiunea(cheie);
  const indexNucleu = ORDINE_NUCLEU.indexOf(resursa);
  const grup =
    modul === null
      ? indexNucleu === -1
        ? ORDINE_NUCLEU.length
        : indexNucleu
      : 100 + FEATURES[modul].sortOrder;
  return grup * 1000 + RESURSE_IN_ORDINEA_CHEILOR.indexOf(resursa);
}
