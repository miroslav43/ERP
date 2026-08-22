import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { stareFirmei } from "@/lib/tenant/stare-firma";
import { createServerSupabase } from "@/lib/supabase/server";
import type { OnboardeazaOrganizatieInput } from "@/schemas/organization";

import { AsistentFirma } from "./asistent-firma";

export const metadata: Metadata = {
  title: "Bun venit",
  description: "Completați datele firmei pentru a începe.",
};

export const dynamic = "force-dynamic";

/**
 * Prima intrare a administratorului într-o firmă pe care super-adminul a
 * creat-o doar cu minimul: denumire, CUI și adresa lui de e-mail.
 *
 * Stă în `(onboarding)`, NU în `(app)`. Dacă ar fi acolo, ar trece prin
 * layout-ul aplicației — același layout care redirectează aici firmele
 * `pending` — și pagina s-ar chema pe sine la nesfârșit. Bucla nu s-ar vedea la
 * citirea codului, doar la rulare, ca o pagină care nu se mai încarcă.
 */
export default async function PaginaBunVenit() {
  const rezolvare = await resolveTenant();
  if (rezolvare.status !== "ok") redirect("/autentificare");
  const { tenant } = rezolvare;

  // Cine nu poate completa nu are ce căuta aici: un `hr` n-are cum să știe
  // capitalul social, iar RLS i-ar refuza oricum scrierea.
  if (tenant.role !== "org_admin") redirect("/firma-in-configurare");

  // Firma e deja configurată — nu ținem pe nimeni într-un formular fără obiect.
  const stare = await stareFirmei(tenant.organizationId);
  if (stare !== "pending") redirect(RUTA_DUPA_AUTENTIFICARE);

  const supabase = await createServerSupabase();
  const { data: firma } = await supabase
    .from("organizations")
    .select(
      "name, slug, cui, legal_name, forma_juridica, reg_com, platitor_tva, email_contact, telefon_contact, judet, oras, sector",
    )
    .eq("id", tenant.organizationId)
    .maybeSingle();

  // Doar câmpurile deja completate de super-admin se pre-umplu. Cheia lipsă
  // lasă `defaultValues` din asistent să decidă, în loc să scrie `null` peste ele.
  //
  // Tipul e afirmat, nu dedus: coloanele sunt `string | null` în bază, dar
  // `judet`, `forma_juridica` și `sector` sunt uniuni literale în schemă. Baza
  // le garantează prin `check`-uri, iar aici doar le transmitem mai departe.
  const valoriInitiale = {
    ...(firma?.name ? { name: firma.name } : {}),
    ...(firma?.slug ? { slug: firma.slug } : {}),
    ...(firma?.cui ? { cui: firma.cui } : {}),
    ...(firma?.legal_name ? { legal_name: firma.legal_name } : {}),
    ...(firma?.forma_juridica ? { forma_juridica: firma.forma_juridica } : {}),
    ...(firma?.reg_com ? { reg_com: firma.reg_com } : {}),
    ...(typeof firma?.platitor_tva === "boolean" ? { platitor_tva: firma.platitor_tva } : {}),
    ...(firma?.email_contact ? { email_contact: firma.email_contact } : {}),
    ...(firma?.telefon_contact ? { telefon_contact: firma.telefon_contact } : {}),
    ...(firma?.judet ? { judet: firma.judet } : {}),
    ...(firma?.oras ? { oras: firma.oras } : {}),
    ...(firma?.sector ? { sector: firma.sector } : {}),
  } as Partial<OnboardeazaOrganizatieInput>;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <AsistentFirma numeFirma={tenant.name} valoriInitiale={valoriInitiale} />
    </main>
  );
}
