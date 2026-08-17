// src/components/layout/topbar.tsx
import Link from "next/link";
import { Bell, ChevronDown, LogOut, UserRound } from "lucide-react";

import { deconecteaza } from "@/app/(app)/actions";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CommandPalette, type ElementPaleta } from "@/components/layout/command-palette";
import { OrgSwitcher, type OrganizatieComutator } from "@/components/layout/org-switcher";
import { buildNavigation } from "@/lib/navigation/build-navigation";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { listUserOrganizations } from "@/lib/queries/organizations";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
function esteObiect(valoare: unknown): valoare is Readonly<Record<string, unknown>> {
  return typeof valoare === "object" && valoare !== null;
}

/** Aplatizează rezultatul lui buildNavigation fără a presupune o formă rigidă și fără `any`. */
function aplatizeazaNavigatie(nod: unknown, grup: string, acumulator: ElementPaleta[]): void {
  if (Array.isArray(nod)) {
    for (const copil of nod) {
      aplatizeazaNavigatie(copil, grup, acumulator);
    }
    return;
  }
  if (!esteObiect(nod)) {
    return;
  }
  const eticheta =
    typeof nod["label"] === "string"
      ? nod["label"]
      : typeof nod["title"] === "string"
        ? nod["title"]
        : null;
  const href = typeof nod["href"] === "string" ? nod["href"] : null;

  if (eticheta !== null && href !== null && !acumulator.some((element) => element.href === href)) {
    acumulator.push({ id: href, eticheta, grup, href });
  }
  const copii = nod["items"] ?? nod["children"] ?? nod["sections"];
  if (copii !== undefined) {
    aplatizeazaNavigatie(copii, eticheta ?? grup, acumulator);
  }
}

async function numaraNotificariNecitite(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  organizationId: string,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("read_at", null);

  if (error !== null) {
    console.error("[notificari] Numărul de necitite nu a putut fi calculat", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function Topbar() {
  const rezolvare = await resolveTenant();
  if (rezolvare.status !== "ok") {
    return null;
  }
  const { tenant } = rezolvare;

  const supabase = await createServerSupabase();
  const [{ data: sesiune }, organizatii, module, permisiuni] = await Promise.all([
    supabase.auth.getUser(),
    listUserOrganizations(),
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, tenant.role),
  ]);

  const utilizator = sesiune.user;
  const necitite =
    utilizator === null
      ? 0
      : await numaraNotificariNecitite(supabase, tenant.organizationId, utilizator.id);

  // `buildNavigation` cere setul de chei, nu harta de scope-uri; refuzul explicit
  // (`none`) se elimină, ca o intrare refuzată să nu apară în meniu.
  const cheiPermisiuni: ReadonlySet<string> = new Set(
    Array.from(permisiuni.entries())
      .filter(([, scope]) => scope !== "none")
      .map(([cheie]) => cheie),
  );

  const navigatie = buildNavigation({ features: module, permissions: cheiPermisiuni, badges: {} });
  const elementePaleta: ElementPaleta[] = [];
  aplatizeazaNavigatie(navigatie, "Navigare", elementePaleta);

  const organizatiiComutator: readonly OrganizatieComutator[] = organizatii.map((organizatie) => ({
    id: organizatie.id,
    slug: organizatie.slug,
    name: organizatie.name,
    role: organizatie.role,
  }));

  return (
    <header className="border-border bg-surface flex h-14 items-center gap-3 border-b px-4">
      <Breadcrumb />

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette elemente={elementePaleta} organizatii={organizatiiComutator} />

        <OrgSwitcher
          organizatii={organizatiiComutator}
          organizatiaCurentaId={tenant.organizationId}
        />

        <Link
          href="/notificari"
          aria-label={
            necitite > 0 ? `Notificări: ${necitite} necitite` : "Notificări: niciuna necitită"
          }
          className="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring relative inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
          {necitite > 0 ? (
            <span className="bg-danger text-primary-foreground absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold">
              {necitite > 99 ? "99+" : necitite}
            </span>
          ) : null}
        </Link>

        <details className="relative">
          <summary className="text-foreground hover:bg-background focus-visible:ring-ring flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-sm focus-visible:ring-2 focus-visible:outline-none">
            <UserRound aria-hidden="true" className="text-muted-foreground h-4 w-4" />
            <span className="max-w-40 truncate">{utilizator?.email ?? "Contul meu"}</span>
            <ChevronDown aria-hidden="true" className="text-muted-foreground h-4 w-4" />
          </summary>
          <div className="border-border bg-surface absolute right-0 z-20 mt-1 w-56 rounded-md border p-1 shadow-lg">
            <Link
              href="/setari/profil"
              className="text-foreground hover:bg-background focus-visible:ring-ring flex items-center gap-2 rounded px-2 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <UserRound aria-hidden="true" className="h-4 w-4" />
              Profilul meu
            </Link>
            <form action={deconecteaza}>
              <button
                type="submit"
                className="text-danger hover:bg-background focus-visible:ring-ring flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                Deconectare
              </button>
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
