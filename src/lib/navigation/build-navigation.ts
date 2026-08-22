import {
  NAV_GROUPS,
  NAV_ITEMS,
  type BadgeSource,
  type NavGroupId,
  type NavItem,
  type NavLink,
} from "@/config/navigation";
import type { FeatureKey } from "@/config/features";
import { meetsScope, type PermissionScope } from "@/config/permissions";

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
  /**
   * Harta `resursă:acțiune` → scope, exact cum o întoarce `getPermissionMap`.
   *
   * A fost un `Set` de chei, iar asta a fost un defect: un `Set` poate răspunde
   * doar „are cheia", nu și „o are destul de larg". `NAV_ITEMS` declară pentru
   * fiecare intrare un `minScope`, care era pur decorativ — un `employee`, care
   * are `payroll:read = own`, vedea în meniu „Salarizare" (`minScope: "team"`),
   * „Rapoarte" (`"all"`), „Angajați", „Flotă", „Mentenanță" și „Onboarding", și
   * lovea `AccesRestricționat` la fiecare. Layout-ul portalului filtra corect de
   * la bun început, cu `can(...)`; aici pragul se pierdea.
   */
  permissions: ReadonlyMap<string, PermissionScope>;
  /** Contoare de notificare, calculate într-un singur query, nu per intrare. */
  badges?: Partial<Record<BadgeSource, number>>;
}>;

export type NavGroupResult = Readonly<{
  id: NavGroupId;
  label: string;
  items: readonly (NavItem & Readonly<{ badgeCount?: number }>)[];
}>;

function esteVizibil(item: NavLink, input: NavigationInput): boolean {
  // `featureKey === null` marchează nucleul, mereu disponibil.
  const modulActiv = item.featureKey === null || input.features.has(item.featureKey);
  // `permission === null` = vizibil oricărui membru activ (tabloul de bord).
  // Altfel: cheia trebuie să existe ȘI să atingă pragul declarat de intrare.
  // `meetsScope` tratează absența identic cu `none` — refuz.
  const arePermisiune =
    item.permission === null || meetsScope(input.permissions.get(item.permission), item.minScope);
  return modulActiv && arePermisiune;
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
        // Sub-intrările se filtrează separat, cu ACEEAȘI regulă. Până acum treceau
        // întregi: se verifica doar părintele, iar un copil cu prag mai strict se
        // vedea oricui vedea părintele. „Setări" cere `organizations:update`, dar
        // copilul „Membri și invitații" cere `users:update` — cine are doar primul
        // vedea un link pe care pagina i-l refuză.
        const copii =
          item.children === undefined
            ? undefined
            : item.children.filter((copil) => esteVizibil(copil, input));

        const count = item.badge === undefined ? undefined : badges[item.badge];
        // Un badge cu valoarea 0 este zgomot: se afișează doar dacă are conținut.
        const cuBadge =
          count !== undefined && count > 0 ? { ...item, badgeCount: count } : { ...item };

        // Un `children: []` ar randa un submeniu gol; cheia se omite cu totul
        // (`exactOptionalPropertyTypes` distinge absența de `undefined`).
        if (copii === undefined || copii.length === 0) {
          const { children: _ignorat, ...faraCopii } = cuBadge;
          return faraCopii;
        }
        return { ...cuBadge, children: copii };
      });

    return { id: grup.id, label: grup.label, items };
  }).filter((grup) => grup.items.length > 0);
}
