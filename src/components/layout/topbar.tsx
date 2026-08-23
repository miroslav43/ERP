// src/components/layout/topbar.tsx
import { contoarePanouPentru, insigneMeniu } from "@/lib/queries/panou";
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
  // Aceleași insigne ca în meniul lateral, din aceeași funcție memoizată: două
  // surse pentru același număr ar diverge în prima săptămână.
  const contoare = await contoarePanouPentru(tenant.organizationId, tenant.role, tenant.memberId);
  const navigatie = buildNavigation({
    features: module,
    permissions: permisiuni,
    badges: insigneMeniu(contoare),
  });
  const elementePaleta: ElementPaleta[] = [];
  aplatizeazaNavigatie(navigatie, "Navigare", elementePaleta);

  const organizatiiComutator: readonly OrganizatieComutator[] = organizatii.map((organizatie) => ({
    id: organizatie.id,
    slug: organizatie.slug,
    name: organizatie.name,
    role: organizatie.role,
  }));

  return (
    /*
      Antetul e navy, ca railul, și e LIPIT: pe o listă lungă, comutatorul de
      organizație și clopoțelul trebuie să rămână la îndemână fără derulare
      înapoi. `z-antet` (40) îl ține peste antetul lipit al unui tabel
      (`z-antet-tabel`, 20) — înainte foaia colectivă de pontaj folosea tot
      z-20, iar la egalitate ar fi câștigat ea, fiind mai jos în DOM.
    */
    <header
      data-tipar="ascunde"
      className="bg-primary z-antet sticky top-0 flex h-14 items-center gap-3 border-b border-white/10 px-4"
    >
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
          className="rounded-control relative inline-flex size-9 items-center justify-center text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
          {necitite > 0 ? (
            <span className="bg-danger text-primary-foreground absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 font-mono text-[10px] leading-4 font-semibold tabular-nums">
              {necitite > 99 ? "99+" : necitite}
            </span>
          ) : null}
        </Link>

        <details className="relative">
          <summary className="rounded-control text-corp flex h-9 cursor-pointer list-none items-center gap-1.5 px-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white">
            <UserRound aria-hidden="true" className="size-4 opacity-80" />
            <span className="max-w-40 truncate">{utilizator?.email ?? "Contul meu"}</span>
            <ChevronDown aria-hidden="true" className="size-4 opacity-80" />
          </summary>
          {/* Panoul cade pe pânză, deci revine la paleta crem. `z-meniu` (30) îl
              ține peste conținut, dar sub antetul care l-a deschis. */}
          <div className="border-border bg-background rounded-panou shadow-plutitor z-meniu absolute right-0 mt-1 w-56 border p-1">
            <Link
              href="/profil"
              className="text-foreground rounded-control hover:bg-surface text-corp flex items-center gap-2 px-2 py-2 transition-colors"
            >
              <UserRound aria-hidden="true" className="h-4 w-4" />
              Profilul meu
            </Link>
            <form action={deconecteaza}>
              <button
                type="submit"
                className="text-danger rounded-control hover:bg-surface text-corp flex w-full items-center gap-2 px-2 py-2 text-left transition-colors"
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
