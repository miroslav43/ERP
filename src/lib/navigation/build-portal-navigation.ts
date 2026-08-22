import {
  PORTAL_NAV_GROUPS,
  PORTAL_NAV_ITEMS,
  type PortalNavGroupId,
  type PortalNavItem,
} from "@/config/navigation";
import { meetsScope, type PermissionScope } from "@/config/permissions";

/**
 * Construiește cele două forme ale meniului de portal dintr-o singură sursă.
 *
 * Portalul are două învelișuri, nu unul stilizat în două feluri: pe laptop, un
 * rail vertical cu grupuri și titluri de secțiune; pe telefon, o bară de jos cu
 * patru ținte pentru degetul mare plus „Mai multe". Nu sunt aceeași listă la
 * dimensiuni diferite — sunt două arhitecturi informaționale peste aceleași
 * intrări. De aceea funcția întoarce ambele forme deodată, calculate din
 * aceeași filtrare: dacă ar fi calculate separat, ar putea diverge.
 *
 * Funcție pură: nu atinge baza și nu citește cookie-uri. Importă `meetsScope`
 * din `@/config/permissions`, NU `can` din `@/lib/auth/permissions` — acela are
 * `import "server-only"` și ar face fișierul netestabil în Vitest.
 */

export type IntrarePortalView = Readonly<{
  id: string;
  label: string;
  href: string;
  /** Potrivire exactă a căii pentru starea „pagină curentă". Doar „Acasă". */
  exact: boolean;
}>;

export type GrupPortalView = Readonly<{
  id: PortalNavGroupId;
  label: string;
  items: readonly IntrarePortalView[];
}>;

export type PortalNavigationInput = Readonly<{
  /** Modulele active pentru organizație, deja rezolvate pe server. */
  features: ReadonlySet<string>;
  /**
   * Harta `resursă:acțiune` → scope, exact cum o întoarce `getPermissionMap`.
   * Nu un `Set` de chei: un set poate răspunde la „are cheia", nu la „o are
   * destul de larg", iar fiecare intrare declară un `minScope`.
   */
  permissions: ReadonlyMap<string, PermissionScope>;
}>;

export type PortalNavigationResult = Readonly<{
  grupuri: readonly GrupPortalView[];
  bara: Readonly<{
    primare: readonly IntrarePortalView[];
    secundare: readonly IntrarePortalView[];
  }>;
}>;

/**
 * Patru sloturi, nu cinci: al cincilea e „Mai multe".
 *
 * Peste cinci ținte pe lățimea unui telefon, fiecare scade sub pragul tactil de
 * 44 px și eticheta se rupe în două rânduri.
 */
const SLOTURI_PRINCIPALE = 4;

function esteVizibila(item: PortalNavItem, input: PortalNavigationInput): boolean {
  if (item.featureKey !== null && !input.features.has(item.featureKey)) return false;
  if (item.permission === null) return true;
  return meetsScope(input.permissions.get(item.permission), item.minScope);
}

function view(item: PortalNavItem): IntrarePortalView {
  return { id: item.id, label: item.label, href: item.href, exact: item.exact };
}

export function buildPortalNavigation(input: PortalNavigationInput): PortalNavigationResult {
  const vizibile = PORTAL_NAV_ITEMS.filter((item) => esteVizibila(item, input));

  const grupuri = PORTAL_NAV_GROUPS.map((grup) => ({
    id: grup.id,
    label: grup.label,
    items: vizibile
      .filter((item) => item.group === grup.id)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(view),
  })).filter((grup) => grup.items.length > 0);

  // Bara: se aleg după PRIORITATE, nu după poziție. Cu `payroll` stins, slotul
  // patru n-ar trebui să rămână gol — următoarea intrare urcă în locul lui.
  const candidate = vizibile
    .filter((item) => item.prioritateBara !== null)
    .slice()
    .sort((a, b) => (a.prioritateBara ?? 0) - (b.prioritateBara ?? 0));

  const primare = candidate.slice(0, SLOTURI_PRINCIPALE).map(view);
  const idPrimare = new Set(primare.map((i) => i.id));

  // Restul, în ordinea din meniu — inclusiv candidatele care n-au încăput.
  const secundare = vizibile
    .filter((item) => !idPrimare.has(item.id))
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(view);

  return { grupuri, bara: { primare, secundare } };
}
