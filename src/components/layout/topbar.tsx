// src/components/layout/topbar.tsx
import { contoarePanouPentru, insigneMeniu } from "@/lib/queries/panou";
import Link from "next/link";
import { Bell } from "lucide-react";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CommandPalette, type ElementPaleta } from "@/components/layout/command-palette";
import { MeniuCont, type OrganizatieComutator } from "@/components/layout/meniu-cont";
import { SidebarTrigger } from "@/components/layout/sidebar";
import { buildNavigation, type NavGroupResult } from "@/lib/navigation/build-navigation";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { numaraNecitite } from "@/lib/queries/notifications";
import { listUserOrganizations } from "@/lib/queries/organizations";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";

/**
 * Aplatizează meniul pentru paleta de comenzi.
 *
 * Era o traversare prin reflexie — `esteObiect(valoare)`, apoi `nod["label"]`,
 * `nod["title"]`, `nod["items"] ?? nod["children"] ?? nod["sections"]` — peste o
 * valoare care are tip explicit (`readonly NavGroupResult[]`). `title` și
 * `sections` nu există în niciun tip din proiect: erau câmpuri inventate, deci
 * ramuri moarte care ascundeau faptul că forma e cunoscută la compilare. Dacă
 * `NavGroupResult` se schimbă, varianta de mai jos NU compilează; cea prin
 * reflexie ar fi tăcut și ar fi întors o paletă goală.
 *
 * Dedublarea pe `href` rămâne: „Concedii" e și părinte, și copil („Cereri"),
 * spre aceeași rută.
 */
function elementePentruPaleta(grupuri: readonly NavGroupResult[]): readonly ElementPaleta[] {
  const acumulator: ElementPaleta[] = [];
  const adauga = (eticheta: string, href: string, grup: string): void => {
    if (acumulator.some((element) => element.href === href)) return;
    acumulator.push({ id: href, eticheta, grup, href });
  };
  for (const grup of grupuri) {
    for (const element of grup.items) {
      adauga(element.label, element.href, grup.label);
      for (const copil of element.children ?? []) {
        adauga(copil.label, copil.href, element.label);
      }
    }
  }
  return acumulator;
}

export async function Topbar() {
  const rezolvare = await resolveTenant();
  if (rezolvare.status !== "ok") {
    return null;
  }
  const { tenant, user: utilizator } = rezolvare;

  /*
   * Utilizatorul vine din `resolveTenant()`, nu dintr-un al doilea
   * `supabase.auth.getUser()`. `AuthUser` are deja `id`, `email` și `fullName`
   * — exact cele trei câmpuri folosite aici — iar `getCurrentUser()` e memoizat
   * pe cerere, deci apelul separat era un drum în plus la GoTrue pe FIECARE
   * navigare, doar ca să afle ce era deja în mână. În plus, ramura
   * `utilizator === null` era moartă: `rezolvare.status === "ok"` o exclude.
   */
  /*
   * `numaraNecitite` era un `await` separat, imediat după acest `Promise.all` —
   * deci un val de rețea propriu, pe fiecare randare de înveliș, pentru un
   * număr care nu depinde de niciunul dintre rezultatele de aici: îi trebuie
   * doar `tenant.organizationId` și `utilizator.id`, amândouă în mână de la
   * `resolveTenant()`. Mutat înăuntru, costă zero.
   */
  const [organizatii, module, permisiuni, necitite] = await Promise.all([
    listUserOrganizations(),
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    numaraNecitite(tenant.organizationId, utilizator.id),
  ]);

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
  const elementePaleta = elementePentruPaleta(navigatie);

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

      ── CE ÎNCAPE PE 375 px ────────────────────────────────────────────────
      Antetul avea șase controale și nu ascundea decât unul. Numai comutatorul
      de organizație (un `<select max-w-56>` plus un buton „Comută") lua ~314
      px, peste declanșatorul sertarului, firimituri, clopoțel și e-mail: suma
      depășea lățimea ecranului, iar ce era la dreapta se tăia. Acum, sub `md`
      rămân patru ținte: sertar, lupa de căutare, clopoțel, cont. Firimiturile
      se ascund (railul spune deja unde ești), iar comutarea de firmă a intrat
      în meniul de cont, unde e o alegere rară.
    */
    <header
      data-tipar="ascunde"
      className="bg-primary z-antet sticky top-0 flex h-14 items-center gap-2 border-b border-white/10 px-2 sm:gap-3 sm:px-4"
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
      {/* Firimiturile repetă pe telefon ceea ce `<h1>`-ul paginii spune 40 px
          mai jos, și consumă exact lățimea care lipsește. */}
      <div className="hidden min-w-0 md:flex">
        <Breadcrumb />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <CommandPalette elemente={elementePaleta} organizatii={organizatiiComutator} />

        <Link
          href="/notificari"
          aria-label={
            necitite > 0 ? `Notificări: ${necitite} necitite` : "Notificări: niciuna necitită"
          }
          className="rounded-control relative inline-flex size-11 items-center justify-center text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Bell aria-hidden="true" className="h-5 w-5" />
          {necitite > 0 ? (
            /* `text-danger-foreground`, nu `text-primary-foreground`: cele două
               au azi aceeași valoare (#faf7f0), deci greșeala nu se vedea — dar
               tokenul spune pe ce fundal stă textul, iar acesta stă pe roșu. */
            <span className="bg-danger text-danger-foreground absolute top-1.5 right-1.5 min-w-4 rounded-full px-1 font-mono text-[10px] leading-4 font-semibold tabular-nums">
              {necitite > 99 ? "99+" : necitite}
            </span>
          ) : null}
        </Link>

        <MeniuCont
          utilizator={utilizator}
          rol={tenant.role}
          organizatii={organizatiiComutator}
          organizatiaCurentaId={tenant.organizationId}
        />
      </div>
    </header>
  );
}
