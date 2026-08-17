// src/app/(app)/actions.ts
"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabase } from "@/lib/supabase/server";
import { listUserOrganizations } from "@/lib/queries/organizations";
import { setOrganizationCookie, clearOrganizationCookie } from "@/lib/tenant/organization-cookie";
import { RUTA_AUTENTIFICARE, RUTA_DUPA_AUTENTIFICARE, RUTA_PUBLICA } from "@/config/routes";
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

type RezultatComutare = Readonly<{ ok: true }> | Readonly<{ ok: false; eroare: string }>;

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
  return { ok: true };
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
  revalidatePath("/", "layout");
  redirect(RUTA_DUPA_AUTENTIFICARE);
}

/** Variantă pentru formulare simple (ecranul de alegere, paleta de comenzi). */
export async function comutaOrganizatiaDirect(formData: FormData): Promise<void> {
  const rezultat = await comutaNucleu(formData.get("organizationId"));
  if (!rezultat.ok) {
    redirect("/alege-organizatia?eroare=acces");
  }
  revalidatePath("/", "layout");
  redirect(RUTA_DUPA_AUTENTIFICARE);
}

export async function deconecteaza(): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signOut();
  if (error !== null) {
    console.error("[auth] Deconectare eșuată", error.message);
  }
  await clearOrganizationCookie();
  revalidatePath("/", "layout");
  redirect(RUTA_PUBLICA);
}

export async function cereAutentificare(): Promise<void> {
  redirect(RUTA_AUTENTIFICARE);
}
