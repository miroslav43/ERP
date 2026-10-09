// src/app/(app)/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { reimprospateazaAplicatia } from "@/lib/actions/reimprospatare";
import { createServerSupabase } from "@/lib/supabase/server";
import { listUserOrganizations } from "@/lib/queries/organizations";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { setOrganizationCookie, clearOrganizationCookie } from "@/lib/tenant/organization-cookie";
import { POARTA_PORTAL_ACTIVA, RUTA_PUBLICA, rutaDupaAutentificare } from "@/config/routes";
import type { AppRole } from "@/lib/tenant/types";
import type { StareComutare } from "./actions-types";
type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

const schemaComutare = z.object({
  organizationId: z.uuid("Organizația selectată nu este validă."),
});

// Tipurile și constantele au fost mutate în `./actions-types` — un modul
// `"use server"` poate exporta doar funcții async.

type ContextCerere = Readonly<{
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}>;

async function citesteContextCerere(): Promise<ContextCerere> {
  const antete = await headers();
  const brut = antete.get("x-forwarded-for")?.split(",")[0]?.trim() ?? antete.get("x-real-ip");
  return {
    ip: brut !== null && brut !== undefined && brut.length > 0 ? brut : null,
    userAgent: antete.get("user-agent"),
    requestId: crypto.randomUUID(),
  };
}

/**
 * Jurnalizare append-only (S6). Nu aruncă: o eroare de audit nu trebuie să blocheze
 * comutarea deja validată, dar este raportată explicit în logurile serverului.
 */
async function jurnalizeazaComutarea(
  supabase: Supabase,
  ctx: ContextCerere,
  actiune: "tenant_switch" | "tenant_forged",
  organizationIdSolicitat: string,
  esteMembru: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("log_audit_event", {
    p_action: actiune,
    p_status: esteMembru ? "success" : "denied",
    p_organization_id: esteMembru ? organizationIdSolicitat : null,
    p_entity_type: "organization_members",
    p_entity_id: organizationIdSolicitat,
    // ALLOW-LIST explicit (S7): doar identificatorul organizației țintă.
    p_after: { organization_id_solicitat: organizationIdSolicitat },
    p_ip: ctx.ip,
    p_user_agent: ctx.userAgent,
    p_request_id: ctx.requestId,
  });
  if (error !== null) {
    console.error("[audit] Nu s-a putut scrie evenimentul de comutare", {
      actiune,
      requestId: ctx.requestId,
      mesaj: error.message,
    });
  }
}

type RezultatComutare =
  Readonly<{ ok: true; rol: AppRole }> | Readonly<{ ok: false; eroare: string }>;

/**
 * Sursa unică de adevăr pentru comutare. Cookie-ul rezultat rămâne un HINT NEÎNCREZUT:
 * resolveTenant() îl revalidează la fiecare cerere.
 */
async function comutaNucleu(valoareBruta: unknown): Promise<RezultatComutare> {
  const analiza = schemaComutare.safeParse({ organizationId: valoareBruta });
  if (!analiza.success) {
    return { ok: false, eroare: "Organizația selectată nu este validă." };
  }
  const { organizationId } = analiza.data;

  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: eroareAuth,
  } = await supabase.auth.getUser();

  if (eroareAuth !== null || user === null) {
    return { ok: false, eroare: "Sesiunea a expirat. Autentificați-vă din nou." };
  }

  const ctx = await citesteContextCerere();

  // Apartenența se verifică server-side, pe lista validată de Faza 1a (S1).
  const organizatii = await listUserOrganizations();
  const tinta = organizatii.find((organizatie) => organizatie.id === organizationId);

  if (tinta === undefined) {
    await jurnalizeazaComutarea(supabase, ctx, "tenant_forged", organizationId, false);
    return {
      ok: false,
      eroare: "Nu aveți acces la organizația selectată.",
    };
  }

  await setOrganizationCookie(tinta.id);
  await jurnalizeazaComutarea(supabase, ctx, "tenant_switch", tinta.id, true);
  // Rolul din organizația ȚINTĂ, nu din cea curentă: cine e `org_admin` aici
  // poate fi `employee` dincolo, iar destinația se alege după unde ajunge.
  return { ok: true, rol: tinta.role };
}

/** Variantă pentru useActionState (comutatorul din topbar). */
export async function comutaOrganizatia(
  _stareAnterioara: StareComutare,
  formData: FormData,
): Promise<StareComutare> {
  const rezultat = await comutaNucleu(formData.get("organizationId"));
  if (!rezultat.ok) {
    return { eroare: rezultat.eroare };
  }
  reimprospateazaAplicatia();
  redirect(
    rutaDupaAutentificare({
      estePlatformAdmin: false,
      areOrganizatii: true,
      // Vezi `POARTA_PORTAL_ACTIVA`: cât timp e stinsă, comutarea duce în
      // aplicație pentru toată lumea, ca până acum.
      rol: POARTA_PORTAL_ACTIVA ? rezultat.rol : null,
    }),
  );
}

/** Variantă pentru formulare simple (ecranul de alegere, paleta de comenzi). */
export async function comutaOrganizatiaDirect(formData: FormData): Promise<void> {
  const rezultat = await comutaNucleu(formData.get("organizationId"));
  if (!rezultat.ok) {
    redirect("/alege-organizatia?eroare=acces");
  }
  reimprospateazaAplicatia();
  redirect(
    rutaDupaAutentificare({
      estePlatformAdmin: false,
      areOrganizatii: true,
      // Vezi `POARTA_PORTAL_ACTIVA`: cât timp e stinsă, comutarea duce în
      // aplicație pentru toată lumea, ca până acum.
      rol: POARTA_PORTAL_ACTIVA ? rezultat.rol : null,
    }),
  );
}

export async function deconecteaza(): Promise<void> {
  const supabase = await createServerSupabase();
  /*
   * `scope: "local"` — deconectează DISPOZITIVUL acesta, nu contul de peste tot.
   *
   * Implicitul lui auth-js e `global`: revocă refresh-tokenurile tuturor
   * sesiunilor utilizatorului. Cât timp singurul mod de folosire era laptopul de
   * la birou, nu se vedea. Din clipa în care aplicația stă pe ecranul de start al
   * telefonului, „mă deconectez de pe calculatorul de la serviciu" ar închide și
   * telefonul omului — iar el ar descoperi asta luni dimineață, la poartă.
   *
   * ONESTITATE DESPRE CE **NU** REZOLVĂ: pe iPhone, adăugarea pe ecranul de start
   * COPIAZĂ cookie-urile, deci Safari și aplicația instalată ajung să împartă
   * ACEEAȘI sesiune — același refresh token, același id de sesiune. Acolo, până
   * și `local` le închide pe amândouă, fiindcă sunt una singură. Nu e o scăpare a
   * liniei ăsteia, e felul în care iOS separă (și copiază) depozitele.
   */
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error !== null) {
    console.error("[auth] Deconectare eșuată", error.message);
  }
  await clearOrganizationCookie();
  reimprospateazaAplicatia();
  redirect(RUTA_PUBLICA);
}

/**
 * Căutarea de angajați din paleta Ctrl+K.
 *
 * Paleta căuta DOAR meniul și firmele; „deschide fișa lui Popescu" însemna
 * meniu → Angajați → filtru. Aici: numele (sau marca) → `/angajati/<id>`.
 *
 * Organizația vine din tenant, niciodată din client. Permisiunea e
 * `employees:read` la orice scope — RLS (`employees_select`) restrânge
 * singură la echipă sau la fișa proprie, deci un manager primește doar
 * oamenii lui, iar un cont fără drept primește lista goală, nu o eroare.
 * Fără `createAdminSupabase`: exact RLS-ul e ce vrem aici.
 */
export async function cautaAngajatiPaleta(
  interogare: string,
): Promise<readonly Readonly<{ id: string; eticheta: string; href: string }>[]> {
  const termen = interogare
    .trim()
    .replace(/[%_\\]/gu, " ")
    .slice(0, 60);
  if (termen.length < 2) return [];
  const rezolvare = await resolveTenant();
  if (rezolvare.status !== "ok") return [];
  const { tenant } = rezolvare;
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "employees:read");
  if (scope === null || scope === "none") return [];
  const db = await createServerSupabase();
  const { data } = await db
    .from("employees")
    .select("id, full_name, marca, functie")
    .eq("organization_id", tenant.organizationId)
    .is("deleted_at", null)
    .or(`full_name.ilike.%${termen}%,marca.ilike.%${termen}%`)
    .order("full_name")
    .limit(8);
  return (data ?? []).map((r) => ({
    id: r.id,
    eticheta: `${r.full_name}${r.functie === null ? "" : ` · ${r.functie}`}`,
    href: `/angajati/${r.id}`,
  }));
}
