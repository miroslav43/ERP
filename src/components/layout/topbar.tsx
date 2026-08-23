// src/components/layout/topbar.tsx
import Link from "next/link";
import { Bell, ChevronDown, LogOut, UserRound } from "lucide-react";

import { deconecteaza } from "@/app/(app)/actions";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CommandPalette, type ElementPaleta } from "@/components/layout/command-palette";
import { OrgSwitcher, type OrganizatieComutator } from "@/components/layout/org-switcher";
import { SidebarTrigger } from "@/components/layout/sidebar";
import { buildNavigation } from "@/lib/navigation/build-navigation";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { numaraNecitite } from "@/lib/queries/notifications";
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
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  const utilizator = sesiune.user;
  const necitite =
    utilizator === null ? 0 : await numaraNecitite(tenant.organizationId, utilizator.id);

  // Harta se predă întreagă: `buildNavigation` aplică și `scope = 'none'` (refuz
  // explicit) și pragul `minScope` al fiecărei intrări. Paleta de comenzi trebuie
  // să ofere exact ce oferă meniul — o rută găsibilă la ⌘K dar refuzată la
  // deschidere e mai rea decât una ascunsă.
  const navigatie = buildNavigation({ features: module, permissions: permisiuni, badges: {} });
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
      {/*
        Butonul care deschide sertarul pe telefon. `SidebarTrigger` exista de la
        început, cu `md:hidden` pe el, dar nu era montat nicăieri — iar
        `Sidebar` ține `<aside>` la `-translate-x-full` până când cineva îi
        schimbă starea. Rezultatul: pe ecran îngust, meniul aplicației mari nu
        se putea deschide deloc.

        Merge deși `Topbar` e Server Component: `SidebarTrigger` e client și
        consumă `useSidebar()`, iar `SidebarProvider` îl învelește în arborele
        randat de `(app)/layout.tsx`. Contextul curge prin copiii randați pe
        server.
      */}
      <SidebarTrigger />
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
          className="text-muted-foreground hover:bg-background hover:text-foreground relative inline-flex h-9 w-9 items-center justify-center rounded-md"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
          {necitite > 0 ? (
            <span className="bg-danger text-primary-foreground absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-[10px] leading-4 font-semibold">
              {necitite > 99 ? "99+" : necitite}
            </span>
          ) : null}
        </Link>

        <details className="relative">
          <summary className="text-foreground hover:bg-background flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-sm">
            <UserRound aria-hidden="true" className="text-muted-foreground h-4 w-4" />
            <span className="max-w-40 truncate">{utilizator?.email ?? "Contul meu"}</span>
            <ChevronDown aria-hidden="true" className="text-muted-foreground h-4 w-4" />
          </summary>
          <div className="border-border bg-surface absolute right-0 z-20 mt-1 w-56 rounded-md border p-1 shadow-lg">
            <Link
              href="/profil"
              className="text-foreground hover:bg-background flex items-center gap-2 rounded px-2 py-2 text-sm"
            >
              <UserRound aria-hidden="true" className="h-4 w-4" />
              Profilul meu
            </Link>
            <form action={deconecteaza}>
              <button
                type="submit"
                className="text-danger hover:bg-background flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm"
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
