import {
  NAV_GROUPS,
  NAV_ITEMS,
  type BadgeSource,
  type NavGroupId,
  type NavItem,
} from "@/config/navigation";
import type { FeatureKey } from "@/config/features";

/**
 * Construiește meniul din `config/navigation.ts`, filtrat pe modulele active și
 * pe permisiunile efective ale utilizatorului.
 *
 * Ascunderea unei intrări NU protejeaza nimic — este doar igienă de interfață.
 * Pagina refuză separat, acțiunea refuză separat prin `createAction`, iar RLS
 * respinge rândul chiar dacă primele trei sunt ocolite. Un element de meniu
 * ascuns și o rută nepăzită rămâne o rută nepăzită.
 *
 * Funcție pură: nu atinge baza de date și nu citește cookie-uri, deci este
 * testabilă direct cu Vitest.
 */

export type NavigationInput = Readonly<{
  /** Modulele active pentru organizație, deja rezolvate server-side. */
  features: ReadonlySet<FeatureKey> | ReadonlySet<string>;
  /** Cheile `resursă:acțiune` pentru care utilizatorul are un scope ≠ `none`. */
  permissions: ReadonlySet<string>;
  /** Contoare de notificare, calculate într-un singur query, nu per intrare. */
  badges?: Partial<Record<BadgeSource, number>>;
}>;

export type NavGroupResult = Readonly<{
  id: NavGroupId;
  label: string;
  items: readonly (NavItem & Readonly<{ badgeCount?: number }>)[];
}>;

function esteVizibil(item: NavItem, input: NavigationInput): boolean {
  // `featureKey === null` marchează nucleul, mereu disponibil.
  const modulActiv = item.featureKey === null || input.features.has(item.featureKey);
  return modulActiv && input.permissions.has(item.permission);
}

export function buildNavigation(input: NavigationInput): readonly NavGroupResult[] {
  const badges = input.badges ?? {};

  const vizibile = NAV_ITEMS.filter((item) => esteVizibil(item, input));

  return NAV_GROUPS.map((grup) => {
    const items = vizibile
      .filter((item) => item.group === grup.id)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((item) => {
        const count = item.badge === undefined ? undefined : badges[item.badge];
        // Un badge cu valoarea 0 este zgomot: se afișează doar dacă are conținut.
        return count !== undefined && count > 0 ? { ...item, badgeCount: count } : item;
      });

    return { id: grup.id, label: grup.label, items };
  }).filter((grup) => grup.items.length > 0);
}
