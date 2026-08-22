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
  Briefcase,
  CalendarDays,
  Car,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  FolderTree,
  HardHat,
  House,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Megaphone,
  Network,
  Package,
  Percent,
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
    id: "evaluari",
    label: "Evaluări",
    href: "/evaluari/sabloane",
    icon: ClipboardCheck,
    group: "personal",
    featureKey: "evaluations",
    permission: "employees:read",
    minScope: "team",
    order: 48,
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
    id: "ticketing",
    label: "Ticketing IT",
    href: "/ticketing",
    icon: LifeBuoy,
    group: "resurse",
    featureKey: "ticketing",
    permission: "tickets:read",
    // `own`: orice angajat își vede tichetele proprii. Cine are drepturi mai
    // largi vede mai mult, dar intrarea de meniu nu trebuie ascunsă nimănui.
    minScope: "own",
    order: 105,
    children: [
      {
        id: "ticketing-toate",
        label: "Tichetele mele",
        href: "/ticketing",
        featureKey: "ticketing",
        permission: "tickets:read",
        minScope: "own",
      },
      {
        id: "ticketing-nou",
        label: "Tichet nou",
        href: "/ticketing/nou",
        featureKey: "ticketing",
        permission: "tickets:create",
        minScope: "own",
      },
      {
        id: "ticketing-coada",
        label: "Coada echipei",
        href: "/ticketing/coada",
        featureKey: "ticketing",
        permission: "tickets:read",
        minScope: "team",
      },
    ],
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
    id: "componente-salariale",
    label: "Sporuri și prime",
    href: "/salarizare/componente",
    icon: Percent,
    group: "financiar",
    featureKey: "payroll",
    permission: "payroll:read",
    minScope: "team",
    order: 111,
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
    featureKey: "payroll",
    permission: "payroll:read",
    // "all", nu "team" ca la salarizare: date agregate pe toată organizația
    // (venit, concediu, tichete per angajat) — prag de proprietar, nu de manager.
    minScope: "all",
    order: 115,
  },
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

/**
 * Meniul portalului angajatului.
 *
 * Separat de `NAV_ITEMS` fiindcă e alt produs, nu un subset: rutele diferă
 * (`/portal/...`), etichetele sunt scrise la persoana întâi („Concediile mele",
 * nu „Concedii"), iar gruparea urmează felul în care un om își împarte ziua, nu
 * organigrama firmei.
 *
 * Portalul e SINGURA aplicație a unui `employee` — de aceea „Acasă" are
 * `featureKey: null`. Dacă ar depinde de `employee_portal`, un angajat dintr-o
 * firmă care n-a pornit modulul (azi, majoritatea: modulul nu e `is_core`, iar
 * înrolarea activează doar modulele de nucleu) ar primi un portal cu meniul gol.
 * Restul intrărilor sunt păzite de modulele lor proprii, deci se aprind exact
 * când firma le folosește.
 */
export type PortalNavGroupId = "munca" | "bani" | "firma";

export const PORTAL_NAV_GROUPS: readonly Readonly<{ id: PortalNavGroupId; label: string }>[] = [
  { id: "munca", label: "Munca mea" },
  { id: "bani", label: "Banii și actele mele" },
  { id: "firma", label: "Firma" },
];

export type PortalNavItem = NavLink &
  Readonly<{
    icon: LucideIcon;
    group: PortalNavGroupId;
    order: number;
    /**
     * Potrivire exactă a căii pentru starea „pagină curentă".
     *
     * Numai „Acasă" o cere: `/portal` e prefix pentru absolut toate celelalte
     * rute, deci cu potrivire pe prefix ar apărea activă peste tot.
     */
    exact: boolean;
    /**
     * Prioritatea pentru cele patru sloturi principale ale barei de jos.
     * `null` = niciodată în bară, doar sub „Mai multe".
     *
     * Prioritate, nu poziție fixă: modulele diferă de la o firmă la alta. Cu
     * `payroll` stins, un slot fix ar rămâne gol; așa, următoarea intrare urcă
     * în locul lui și bara are mereu patru ținte pline.
     */
    prioritateBara: number | null;
  }>;

export const PORTAL_NAV_ITEMS: readonly PortalNavItem[] = [
  {
    id: "portal-acasa",
    label: "Acasă",
    href: "/portal",
    icon: House,
    group: "munca",
    featureKey: null,
    permission: null,
    minScope: "own",
    order: 10,
    exact: true,
    prioritateBara: 1,
  },
  {
    id: "portal-pontaj",
    label: "Pontajul meu",
    href: "/portal/pontajul-meu",
    icon: Clock,
    group: "munca",
    featureKey: "attendance",
    permission: "attendance:read",
    minScope: "own",
    order: 20,
    exact: false,
    prioritateBara: 2,
  },
  {
    id: "portal-concedii",
    label: "Concediile mele",
    href: "/portal/concediile-mele",
    icon: CalendarDays,
    group: "munca",
    featureKey: "leave",
    permission: "leave:read",
    minScope: "own",
    order: 30,
    exact: false,
    prioritateBara: 3,
  },
  {
    id: "portal-salariul",
    label: "Salariul meu",
    href: "/portal/salariul-meu",
    icon: Wallet,
    group: "bani",
    featureKey: "payroll",
    permission: "payroll:read",
    minScope: "own",
    order: 40,
    exact: false,
    prioritateBara: 4,
  },
  {
    id: "portal-diurna",
    label: "Diurna mea",
    href: "/portal/diurna-mea",
    icon: Receipt,
    group: "munca",
    featureKey: "per_diem",
    permission: "per_diem:read",
    minScope: "own",
    order: 35,
    exact: false,
    prioritateBara: 7,
  },
  {
    id: "portal-integrare",
    label: "Integrarea mea",
    href: "/portal/integrarea-mea",
    icon: ClipboardList,
    group: "munca",
    featureKey: "onboarding",
    permission: "checklists:read",
    minScope: "own",
    order: 38,
    exact: false,
    prioritateBara: null,
  },
  {
    id: "portal-anunturi",
    label: "Anunțuri",
    href: "/portal/anunturi",
    icon: Megaphone,
    group: "firma",
    featureKey: "announcements",
    permission: "announcements:read",
    minScope: "own",
    order: 60,
    exact: false,
    prioritateBara: 6,
  },
  {
    id: "portal-in-primire",
    label: "Ce am în primire",
    href: "/portal/in-primirea-mea",
    icon: Package,
    group: "firma",
    featureKey: "inventory",
    permission: "inventory:read",
    minScope: "own",
    order: 70,
    exact: false,
    prioritateBara: null,
  },
  {
    id: "portal-instruiri",
    label: "Dosarul meu SSM",
    href: "/portal/instruirile-mele",
    icon: HardHat,
    group: "firma",
    featureKey: "ssm",
    permission: "ssm:read",
    minScope: "own",
    order: 80,
    exact: false,
    prioritateBara: null,
  },
  {
    id: "portal-sesizari",
    label: "Sesizări",
    href: "/portal/sesizari",
    icon: Wrench,
    group: "firma",
    featureKey: "maintenance",
    permission: "maintenance:read",
    minScope: "own",
    order: 90,
    exact: false,
    prioritateBara: null,
  },
  {
    id: "portal-tichete",
    label: "Tichetele mele",
    href: "/portal/tichetele-mele",
    icon: LifeBuoy,
    group: "firma",
    featureKey: "ticketing",
    permission: "tickets:read",
    minScope: "own",
    order: 95,
    exact: false,
    prioritateBara: null,
  },
  {
    id: "portal-documente",
    label: "Documentele mele",
    href: "/portal/documentele-mele",
    icon: FileText,
    group: "bani",
    featureKey: "employee_portal",
    permission: "employees:read",
    minScope: "own",
    order: 50,
    exact: false,
    prioritateBara: 5,
  },
];
