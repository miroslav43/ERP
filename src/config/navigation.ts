// src/config/navigation.ts
/**
 * SURSA UNICĂ a meniului. Nicăieri altundeva nu se scrie o intrare de meniu.
 *
 * Fiecare intrare declară cele două condiții de vizibilitate — modulul activ și
 * permisiunea cu pragul ei — iar `buildNavigation()` le aplică. Ascunderea din
 * sidebar NU este o barieră de securitate: pagina refuză separat
 * (`requireFeature` + `meetsScope`), acțiunea refuză separat (`createAction`),
 * iar RLS respinge rândul chiar dacă primele trei sunt ocolite.
 */
import {
  BarChart3,
  CalendarDays,
  Car,
  ClipboardList,
  Clock,
  FileText,
  HardHat,
  LayoutDashboard,
  Megaphone,
  Package,
  Receipt,
  Settings,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { FeatureKey } from "./features";
import type { MinScope, PermissionKey } from "./permissions";

export type NavGroupId = "operatiuni" | "personal" | "resurse" | "financiar" | "administrare";

export const NAV_GROUPS: readonly Readonly<{ id: NavGroupId; label: string }>[] = [
  { id: "operatiuni", label: "Operațiuni" },
  { id: "personal", label: "Personal" },
  { id: "resurse", label: "Resurse" },
  { id: "financiar", label: "Financiar" },
  { id: "administrare", label: "Administrare" },
];

/** Contoarele se calculează într-un singur query de dashboard, nu per intrare. */
export type BadgeSource = "leave_pending" | "ssm_expiring" | "fleet_expiring" | "maintenance_due";

export type NavLink = Readonly<{
  id: string;
  label: string;
  href: string;
  /** `null` = nucleu, mereu disponibil. */
  featureKey: FeatureKey | null;
  permission: PermissionKey;
  minScope: MinScope;
}>;

export type NavItem = NavLink &
  Readonly<{
    icon: LucideIcon;
    group: NavGroupId;
    order: number;
    badge?: BadgeSource;
    children?: readonly NavLink[];
  }>;

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "dashboard",
    label: "Panou de control",
    href: "/panou",
    icon: LayoutDashboard,
    group: "operatiuni",
    featureKey: null,
    permission: "dashboard:read",
    minScope: "own",
    order: 10,
  },
  {
    id: "pontaj",
    label: "Pontaj",
    href: "/pontaj",
    icon: Clock,
    group: "operatiuni",
    featureKey: "attendance",
    permission: "attendance:read",
    minScope: "own",
    order: 20,
  },
  {
    id: "concedii",
    label: "Concedii",
    href: "/concedii",
    icon: CalendarDays,
    group: "operatiuni",
    featureKey: "leave",
    permission: "leave_requests:read",
    minScope: "own",
    badge: "leave_pending",
    order: 30,
    children: [
      {
        id: "concedii-cereri",
        label: "Cereri",
        href: "/concedii",
        featureKey: "leave",
        permission: "leave_requests:read",
        minScope: "own",
      },
      {
        id: "concedii-sold",
        label: "Soldul zilelor",
        href: "/concedii/sold",
        featureKey: "leave",
        permission: "leave_balances:read",
        minScope: "own",
      },
    ],
  },
  {
    id: "angajati",
    label: "Angajați",
    href: "/angajati",
    icon: Users,
    group: "personal",
    featureKey: null,
    permission: "employees:read",
    minScope: "team",
    order: 40,
  },
  {
    id: "onboarding",
    label: "Integrare angajați",
    href: "/onboarding",
    icon: ClipboardList,
    group: "personal",
    featureKey: "onboarding",
    permission: "onboarding:read",
    minScope: "team",
    order: 50,
  },
  {
    id: "ssm",
    label: "SSM și PSI",
    href: "/ssm",
    icon: HardHat,
    group: "personal",
    featureKey: "ssm",
    permission: "ssm_trainings:read",
    minScope: "own",
    badge: "ssm_expiring",
    order: 60,
  },
  {
    id: "flota",
    label: "Parc auto",
    href: "/flota",
    icon: Car,
    group: "resurse",
    featureKey: "fleet",
    permission: "vehicles:read",
    minScope: "team",
    badge: "fleet_expiring",
    order: 70,
  },
  {
    id: "mentenanta",
    label: "Mentenanță",
    href: "/mentenanta",
    icon: Wrench,
    group: "resurse",
    featureKey: "maintenance",
    permission: "maintenance:read",
    minScope: "team",
    badge: "maintenance_due",
    order: 80,
  },
  {
    id: "inventar",
    label: "Inventar",
    href: "/inventar",
    icon: Package,
    group: "resurse",
    featureKey: "inventory",
    permission: "inventory:read",
    minScope: "own",
    order: 90,
  },
  {
    id: "anunturi",
    label: "Anunțuri",
    href: "/anunturi",
    icon: Megaphone,
    group: "resurse",
    featureKey: "announcements",
    permission: "announcements:read",
    minScope: "own",
    order: 100,
  },
  {
    id: "salarizare",
    label: "Salarizare",
    href: "/salarizare",
    icon: Wallet,
    group: "financiar",
    featureKey: "payroll",
    permission: "payroll:read",
    minScope: "team",
    order: 110,
  },
  {
    id: "diurna",
    label: "Diurne și deplasări",
    href: "/diurna",
    icon: Receipt,
    group: "financiar",
    featureKey: "per_diem",
    permission: "per_diem:read",
    minScope: "own",
    order: 120,
  },
  {
    id: "rapoarte",
    label: "Rapoarte",
    href: "/rapoarte",
    icon: BarChart3,
    group: "financiar",
    featureKey: null,
    permission: "reports:read",
    minScope: "team",
    order: 130,
  },
  {
    id: "setari",
    label: "Setări",
    href: "/setari/organizatie",
    icon: Settings,
    group: "administrare",
    featureKey: null,
    permission: "organization:update",
    minScope: "all",
    order: 140,
    children: [
      {
        id: "setari-org",
        label: "Organizație",
        href: "/setari/organizatie",
        featureKey: null,
        permission: "organization:update",
        minScope: "all",
      },
      {
        id: "setari-membri",
        label: "Membri și invitații",
        href: "/setari/membri",
        featureKey: null,
        permission: "members:manage",
        minScope: "all",
      },
      {
        id: "setari-roluri",
        label: "Roluri și permisiuni",
        href: "/setari/roluri",
        featureKey: null,
        permission: "roles:manage",
        minScope: "all",
      },
      {
        id: "setari-module",
        label: "Module active",
        href: "/setari/module",
        featureKey: null,
        permission: "features:manage",
        minScope: "all",
      },
    ],
  },
  {
    id: "audit",
    label: "Jurnal de audit",
    href: "/setari/audit",
    icon: FileText,
    group: "administrare",
    featureKey: null,
    permission: "audit:read",
    minScope: "all",
    order: 150,
  },
];

/** Portalul angajatului: UI redus, aceleași două condiții, alt set de rute. */
export const PORTAL_NAV_ITEMS: readonly NavItem[] = [
  {
    id: "portal-acasa",
    label: "Acasă",
    href: "/portal",
    icon: LayoutDashboard,
    group: "operatiuni",
    featureKey: "employee_portal",
    permission: "dashboard:read",
    minScope: "own",
    order: 10,
  },
  {
    id: "portal-concedii",
    label: "Concediile mele",
    href: "/portal/concediile-mele",
    icon: CalendarDays,
    group: "operatiuni",
    featureKey: "leave",
    permission: "leave_requests:read",
    minScope: "own",
    order: 20,
  },
  {
    id: "portal-pontaj",
    label: "Pontajul meu",
    href: "/portal/pontajul-meu",
    icon: Clock,
    group: "operatiuni",
    featureKey: "attendance",
    permission: "attendance:read",
    minScope: "own",
    order: 30,
  },
  {
    id: "portal-documente",
    label: "Documentele mele",
    href: "/portal/documentele-mele",
    icon: FileText,
    group: "operatiuni",
    featureKey: "employee_portal",
    permission: "employees:read",
    minScope: "own",
    order: 40,
  },
];
