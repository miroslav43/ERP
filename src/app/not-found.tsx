// src/app/not-found.tsx
import { cookies } from "next/headers";
import Link from "next/link";

import { PaginaNegasita } from "@/components/feedback/pagina-negasita";
import { CarcasaApp, COOKIE_SIDEBAR } from "@/components/layout/carcasa-app";
import { POARTA_PORTAL_ACTIVA, RUTA_PORTAL } from "@/config/routes";
import { getEnabledFeatures } from "@/lib/auth/features";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";

/**
 * 404-ul rădăcină: prinde adresele fără nicio rută și orice `notFound()` care
 * n-are un `not-found.tsx` mai apropiat (aplicația și portalul au câte unul).
 * Randează în layout-ul rădăcină, deci carcasa, dacă e cazul, o pune el.
 *
 * ── TREI PUBLICURI (UX-043) ───────────────────────────────────────────────
 * Cine are sesiune într-o firmă și nu e angajat primește corpul 404 ÎN
 * carcasa aplicației (`CarcasaApp`, extrasă din `(app)/layout.tsx`), cu meniul
 * și antetul la locul lor: o adresă greșită nu-l mai scoate din aplicație.
 * Angajatul nu vede carcasa de administrare — layout-ul `(app)` îl mută oricum
 * în portal —, deci primește drumul spre `/portal`. Restul primesc ecranul
 * public de mai jos.
 *
 * `resolveTenant` e cel „moale”: întoarce o stare, nu redirectează. Pentru
 * vizitatorul fără sesiune iese înainte de orice citire din bază, deci 404-ul
 * unui scaner (`/wp-login.php`) nu costă nicio interogare. O eroare la
 * rezolvare cade pe ecranul public: un 404 nu are voie să devină 500.
 *
 * ── DE CE DOUĂ LINKURI PE ECRANUL PUBLIC, ȘI DE CE ÎN ORDINEA ASTA ────────
 * Drumul înapoi era un singur link, către `/panou`. Dar 404-ul ăsta prinde și
 * rutele PUBLICE: un vizitator nelogat care greșește adresa sau urmează un link
 * mort din indexul de căutare ajunge aici. `/panou` cere sesiune, deci
 * `src/proxy.ts` îl trimite la `/autentificare` — omul care căuta o pagină de
 * prezentare primește un ecran de login și pleacă.
 *
 * Pagina de start funcționează pentru amândoi: nelogatul aterizează unde voia,
 * iar cine are sesiune are `/panou` la un rând distanță.
 */
export default async function Negasit() {
  const rezolvare = await resolveTenant().catch((eroare: unknown) => {
    console.error("[404] rezolvarea firmei a eșuat; arăt ecranul public", eroare);
    return null;
  });

  if (rezolvare?.status === "ok") {
    const { user, tenant } = rezolvare;

    if (POARTA_PORTAL_ACTIVA && tenant.role === "employee") {
      return (
        <div className="flex w-full flex-1 flex-col justify-center px-4 py-16">
          <PaginaNegasita inapoi={{ href: RUTA_PORTAL, eticheta: "Înapoi la pagina de start" }} />
        </div>
      );
    }

    const carcasa = await Promise.all([getEnabledFeatures(tenant.organizationId), cookies()]).catch(
      (eroare: unknown) => {
        console.error("[404] modulele firmei nu s-au putut citi; arăt ecranul public", eroare);
        return null;
      },
    );
    if (carcasa !== null) {
      const [features, store] = carcasa;
      return (
        <CarcasaApp
          user={user}
          tenant={tenant}
          features={features}
          colapsat={store.get(COOKIE_SIDEBAR)?.value === "colapsat"}
        >
          <PaginaNegasita inapoi={{ href: "/panou", eticheta: "Înapoi la panou" }} />
        </CarcasaApp>
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <p className="text-muted-foreground text-sm font-medium">Eroare 404</p>
      <h1 className="text-foreground mt-2 text-xl font-semibold">Pagina nu există</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Fie adresa e greșită, fie pagina a fost mutată ori ștearsă.
      </p>
      <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/" className="text-primary text-sm underline-offset-2 hover:underline">
          Înapoi la pagina de start
        </Link>
        <Link
          href="/panou"
          className="text-muted-foreground text-sm underline-offset-2 hover:underline"
        >
          Panoul firmei
        </Link>
      </p>
    </div>
  );
}
