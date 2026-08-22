// src/config/features.ts
/**
 * Catalogul de module, în oglindă cu seed-ul `public.features` din 0001_kernel.sql.
 *
 * Baza rămâne sursa de adevăr pentru CE e activ la o organizație
 * (`organization_features`); fișierul acesta este sursa pentru uniunea de tipuri
 * și pentru pictograme, care nu pot fi importate dinamic dintr-un șir din DB.
 * Dacă cele două diverg, `isFeatureKey` taie cheile necunoscute la citire.
 */
import {
  CalendarDays,
  Car,
  ClipboardCheck,
  Clock,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  Package,
  Plane,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const FEATURE_GROUPS = [
  "core",
  "hr",
  "operations",
  "finance",
  "communication",
  "portal",
] as const;
export type FeatureGroup = (typeof FEATURE_GROUPS)[number];

export const FEATURE_KEYS = [
  "nucleu",
  "attendance",
  "leave",
  "onboarding",
  "payroll",
  "per_diem",
  "fleet",
  "maintenance",
  "inventory",
  "ssm",
  "announcements",
  "employee_portal",
  "evaluations",
  "ticketing",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureMeta = Readonly<{
  denumire: string;
  icon: LucideIcon;
  grup: FeatureGroup;
  /** `nucleu` nu se poate dezactiva: fără el nu există aplicație. */
  isCore: boolean;
  sortOrder: number;
}>;

export const FEATURES: Readonly<Record<FeatureKey, FeatureMeta>> = {
  nucleu: { denumire: "Nucleu", icon: LayoutDashboard, grup: "core", isCore: true, sortOrder: 10 },
  attendance: { denumire: "Pontaj", icon: Clock, grup: "hr", isCore: false, sortOrder: 20 },
  leave: { denumire: "Concedii", icon: CalendarDays, grup: "hr", isCore: false, sortOrder: 30 },
  onboarding: {
    denumire: "Integrare angajați",
    icon: UserPlus,
    grup: "hr",
    isCore: false,
    sortOrder: 40,
  },
  payroll: { denumire: "Salarizare", icon: Wallet, grup: "finance", isCore: false, sortOrder: 50 },
  per_diem: {
    denumire: "Diurne și deplasări",
    icon: Plane,
    grup: "finance",
    isCore: false,
    sortOrder: 60,
  },
  fleet: { denumire: "Parc auto", icon: Car, grup: "operations", isCore: false, sortOrder: 70 },
  maintenance: {
    denumire: "Mentenanță",
    icon: Wrench,
    grup: "operations",
    isCore: false,
    sortOrder: 80,
  },
  inventory: {
    denumire: "Inventar",
    icon: Package,
    grup: "operations",
    isCore: false,
    sortOrder: 90,
  },
  ssm: {
    denumire: "SSM și PSI",
    icon: ShieldCheck,
    grup: "operations",
    isCore: false,
    sortOrder: 100,
  },
  announcements: {
    denumire: "Anunțuri",
    icon: Megaphone,
    grup: "communication",
    isCore: false,
    sortOrder: 110,
  },
  employee_portal: {
    denumire: "Portal angajat",
    icon: Smartphone,
    grup: "portal",
    isCore: false,
    sortOrder: 120,
  },
  evaluations: {
    denumire: "Evaluări angajați",
    icon: ClipboardCheck,
    grup: "hr",
    isCore: false,
    sortOrder: 130,
  },
  ticketing: {
    denumire: "Ticketing IT",
    icon: LifeBuoy,
    grup: "operations",
    isCore: false,
    sortOrder: 140,
  },
};

export const isFeatureKey = (value: string): value is FeatureKey =>
  (FEATURE_KEYS as readonly string[]).includes(value);

/**
 * Împarte cheile citite din bază în cunoscute și necunoscute.
 *
 * Baza și codul se mișcă separat, iar asta e normal: un modul se seedează în
 * `public.features` înainte să existe paginile lui. Întrebarea e ce face
 * cititorul cu o cheie pe care încă nu o cunoaște.
 *
 * Răspunsul e „o taie", nu „aruncă". `organization_features` se citește pe
 * FIECARE pagină din spatele autentificării, deci o excepție acolo nu strică
 * modulul necunoscut — face 500 pe toată aplicația. Exact asta s-a întâmplat
 * pe 2026-08-21, când `ticketing` a apărut în bază înaintea codului.
 *
 * Necunoscutele se întorc separat tocmai ca driftul să nu treacă TĂCUT:
 * apelantul le scrie în log. Un modul care nu apare în meniu fără nicio urmă
 * în jurnal e la fel de greu de diagnosticat ca o cădere.
 */
export function imparteCheiDeModul(chei: readonly string[]): Readonly<{
  cunoscute: readonly FeatureKey[];
  necunoscute: readonly string[];
}> {
  const cunoscute: FeatureKey[] = [];
  const necunoscute: string[] = [];
  for (const cheie of chei) {
    if (isFeatureKey(cheie)) {
      cunoscute.push(cheie);
    } else if (!necunoscute.includes(cheie)) {
      // Deduplicat: un log care repetă aceeași cheie de zeci de ori pe request
      // ascunde restul jurnalului în loc să ajute.
      necunoscute.push(cheie);
    }
  }
  return { cunoscute, necunoscute };
}
