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
  Briefcase,
  CalendarDays,
  Car,
  ClipboardList,
  Clock,
  FileText,
  FolderTree,
  HardHat,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Network,
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
  /**
   * `null` = vizibil oricărui membru activ.
   *
   * Tabloul de bord nu are resursă proprie în `role_permissions` și nici nu
   * trebuie să aibă: nu afișează date proprii, ci doar ce vine din modulele
   * active. O permisiune inventată pentru el ar fi un rând fals în matrice.
   */
  permission: PermissionKey | null;
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
    permission: null,
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
    permission: "leave:read",
    minScope: "own",
    badge: "leave_pending",
    order: 30,
    children: [
      {
        id: "concedii-cereri",
        label: "Cereri",
        href: "/concedii",
        featureKey: "leave",
        permission: "leave:read",
        minScope: "own",
      },
      {
        id: "concedii-sold",
        label: "Soldul zilelor",
        href: "/concedii/sold",
        featureKey: "leave",
        permission: "leave:read",
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
    id: "functii",
    label: "Funcții",
    href: "/functii",
    icon: Briefcase,
    group: "personal",
    featureKey: null,
    permission: "departments:read",
    minScope: "all",
    order: 44,
  },
  {
    id: "departamente",
    label: "Departamente",
    href: "/departamente",
    icon: FolderTree,
    group: "personal",
    featureKey: null,
    permission: "departments:read",
    minScope: "all",
    order: 45,
  },
  {
    id: "puncte-lucru",
    label: "Puncte de lucru",
    href: "/puncte-lucru",
    icon: MapPin,
    group: "personal",
    featureKey: null,
    permission: "departments:read",
    minScope: "all",
    order: 47,
  },
  {
    id: "organigrama",
    label: "Organigramă",
    href: "/organigrama",
    icon: Network,
    group: "personal",
    featureKey: null,
    permission: "employees:read",
    minScope: "own",
    order: 46,
  },
  {
    id: "onboarding",
    label: "Integrare angajați",
    href: "/onboarding",
    icon: ClipboardList,
    group: "personal",
    featureKey: "onboarding",
    permission: "checklists:read",
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
    permission: "ssm:read",
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
    children: [
      {
        id: "inventar-obiecte",
        label: "Obiecte",
        href: "/inventar",
        featureKey: "inventory",
        permission: "inventory:read",
        minScope: "own",
      },
      {
        // Pagina exista și era complet funcțională, dar nu avea NICIUN link
        // către ea — nici în meniu, nici din lista de obiecte. Iar ea e singurul
        // loc unde trăiește confirmarea primirii, deci acțiunea `confirmaPrimirea`
        // era cod mort din punctul de vedere al utilizatorului: angajatul nu avea
        // cum să ajungă la ecranul unde își confirmă bunurile.
        id: "inventar-in-primire",
        label: "Ce am în primire",
        href: "/inventar/in-primire",
        featureKey: "inventory",
        permission: "inventory:read",
        minScope: "own",
      },
    ],
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
  // „Rapoarte" (/rapoarte) a fost scos din meniu: intrarea exista, pagina nu.
  // Era vizibilă pentru hr și org_admin și ducea garantat în 404 — verificat cu
  // sesiune reală. O intrare de meniu care nu duce nicăieri e mai rea decât
  // absența ei: îl pune pe om să creadă că aplicația e stricată, nu neterminată.
  // Se pune la loc odată cu ecranul, în Faza 11.
  {
    id: "setari",
    label: "Setări",
    href: "/setari/organizatie",
    icon: Settings,
    group: "administrare",
    featureKey: null,
    permission: "organizations:update",
    minScope: "all",
    order: 140,
    children: [
      {
        id: "setari-org",
        label: "Organizație",
        href: "/setari/organizatie",
        featureKey: null,
        permission: "organizations:update",
        minScope: "all",
      },
      {
        id: "setari-membri",
        label: "Membri și invitații",
        href: "/setari/membri",
        featureKey: null,
        permission: "users:update",
        minScope: "all",
      },
      // „Roluri și permisiuni" (/setari/roluri) și „Module active"
      // (/setari/module) sunt scoase din același motiv: intrări fără pagină,
      // vizibile pentru org_admin, 404 garantat.
      //
      // Matricea de roluri rămâne pe deplin funcțională fără ecran — se
      // modifică în `role_permissions`, iar efectul apare la reîncărcare, fără
      // deploy. Ecranul doar o face vizibilă; absența lui nu blochează nimic.
      // Modulele organizației se comută azi din Super-Admin, pe fișa firmei.
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
    permission: null,
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
    permission: "leave:read",
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
  {
    id: "portal-salariul",
    label: "Salariul meu",
    href: "/portal/salariul-meu",
    icon: Wallet,
    group: "operatiuni",
    featureKey: "payroll",
    permission: "payroll:read",
    minScope: "own",
    order: 50,
  },
];
