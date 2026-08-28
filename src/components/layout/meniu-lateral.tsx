// src/components/layout/meniu-lateral.tsx
import type { ReactElement } from "react";

import { SidebarNav, type NavGroupView } from "./sidebar-nav";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { buildNavigation } from "@/lib/navigation/build-navigation";
import { contoarePanouPentru, insigneMeniu } from "@/lib/queries/panou";
import type { AppRole } from "@/lib/tenant/types";

/**
 * Meniul lateral, cu insignele lui — scos din corpul layout-ului.
 *
 * ── DE CE EXISTĂ FIȘIERUL ─────────────────────────────────────────────────
 * `contoarePanouPentru` face un fan-out de unsprezece ramuri, adică până la ~21
 * de interogări, unele cu paginare înăuntru. Chemat din corpul lui
 * `(app)/layout.tsx`, ținea PRIMUL PIXEL al aplicației: carcasa nu se randa
 * până nu se știau cifrele din dreptul intrărilor de meniu.
 *
 * Documentația dă exact acest tipar, verbatim
 * (`next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`,
 * secțiunea „Interaction with `loading.js`"): „to ensure instant navigation,
 * either: Wrap runtime data access in your layout in its own `<Suspense>`
 * boundary with a fallback" — cu exemplul `<Suspense fallback={<NavSkeleton />}>`.
 *
 * ── CE NU S-A MUTAT, ȘI DE CE ─────────────────────────────────────────────
 * Porțile de redirect (`employee` → portal, firmă `pending` → configurare) RĂMÂN
 * în corpul layout-ului, obligatoriu. Motivul e scris în documentație:
 * `redirect.md:12` — „When used in a streaming context, this will insert a meta
 * tag to emit the redirect on the client side." Adică un `redirect()` de aici
 * n-ar mai fi un 307, ci un meta-tag dirijat din client, iar utilizatorul ar
 * apuca să vadă o clipă carcasa aplicației de administrare înainte să fie mutat.
 * Nu e o breșă — layout-ul își declară singur că nu e boundary de securitate, iar
 * RLS rămâne ultima linie — dar e o regresie vizibilă.
 *
 * `getEnabledFeatures` și `getPermissionMap` sunt memoizate cu `React.cache()`,
 * deci apelurile de aici nu costă nimic: corpul layout-ului le-a amorsat deja.
 */
export async function MeniuLateral({
  organizationId,
  role,
  memberId,
}: Readonly<{ organizationId: string; role: AppRole; memberId: string }>): Promise<ReactElement> {
  const [features, permissions, contoare] = await Promise.all([
    getEnabledFeatures(organizationId),
    getPermissionMap(organizationId, role, memberId),
    contoarePanouPentru(organizationId, role, memberId),
  ]);

  const grupuri = buildNavigation({
    features,
    permissions,
    badges: insigneMeniu(contoare),
  });

  // Iconițele sunt componente: trec granița server → client ca elemente randate.
  const navigare: readonly NavGroupView[] = grupuri.map((grup) => ({
    id: grup.id,
    label: grup.label,
    items: grup.items.map(({ icon: Icon, ...item }) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      icon: <Icon className="size-4 shrink-0" aria-hidden />,
      // `exactOptionalPropertyTypes`: o cheie absentă nu este același lucru cu
      // una setată pe `undefined`, deci o omitem în loc să o setăm.
      ...(item.badgeCount === undefined ? {} : { badgeCount: item.badgeCount }),
      ...(item.children === undefined
        ? {}
        : {
            children: item.children.map((copil) => ({
              id: copil.id,
              label: copil.label,
              href: copil.href,
            })),
          }),
    })),
  }));

  return <SidebarNav groups={navigare} />;
}
