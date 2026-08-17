// src/lib/tenant/resolve-tenant.ts
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";

import { readTenantHint } from "./tenant-hint";
import {
  APP_ROLES,
  type AuthUser,
  type OrgSummary,
  type Tenant,
  type TenantResolution,
} from "./types";

/**
 * Rândul de apartenență, validat la graniță. Clientul Supabase este încă
 * negeneric (`src/types/database.ts` se generează abia după prima migrare
 * aplicată), deci schema Zod ține locul tipurilor: o coloană redenumită în
 * bază cade aici, zgomotos, nu peste trei ecrane mai încolo.
 */
const membershipSchema = z.object({
  id: z.uuid(),
  role: z.enum(APP_ROLES),
  organizations: z.object({
    id: z.uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    timezone: z.string().nullable(),
  }),
});
type Membership = z.output<typeof membershipSchema>;

const SELECT_APARTENENTE = "id, role, organizations!inner(id, slug, name, timezone)";

const FUS_IMPLICIT = "Europe/Bucharest";

/**
 * SINGURUL loc care decide organizația activă.
 *
 * Memoizat cu `React.cache()`: layout-ul, paginile și `createAction` îl pot
 * apela de câte ori vor în același request — un singur query.
 *
 * Fluxul: sesiune → apartenențe (RLS) → hint neîncrezut → validare → alegere.
 * Nu primește niciodată `organization_id` ca argument; dacă l-ar primi, orice
 * Server Action ar deveni un punct de comutare a organizației.
 */
export const resolveTenant = cache(async (): Promise<TenantResolution> => {
  const user = await getCurrentUser();
  if (user === null) return { status: "neautentificat" };

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("organization_members")
    .select(SELECT_APARTENENTE)
    // Filtrul pe user_id NU e redundant cu RLS: politicile din 0002 permit unui
    // platform admin să citească TOATE apartenențele. Fără el, un membru al
    // echipei Administrativo ar primi aici lista tuturor firmelor-client.
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("deleted_at", null)
    // Organizație ștearsă logic ⇒ apartenența nu mai contează (`!inner`).
    .is("organizations.deleted_at", null)
    .order("created_at", { ascending: true });

  if (error !== null) {
    throw new Error(`Nu s-au putut citi apartenențele utilizatorului: ${error.message}`);
  }

  const apartenente = z.array(membershipSchema).parse(data ?? []);
  if (apartenente.length === 0) return { status: "fara_organizatie", user };

  const organizations: readonly OrgSummary[] = apartenente.map((m) => ({
    id: m.organizations.id,
    slug: m.organizations.slug,
    name: m.organizations.name,
    role: m.role,
  }));

  const hint = await readTenantHint();

  // Semnătură invalidă: cineva a scris cookie-ul de mână. Nu schimbă nimic
  // funcțional (hintul e ignorat), dar încercarea trebuie să lase urmă.
  if (hint.tampered) {
    await auditIncercare(supabase, user, "COOKIE_SEMNATURA_INVALIDA", null);
  }

  const potrivire =
    hint.slugOrId === null
      ? undefined
      : apartenente.find(
          (m) => m.organizations.id === hint.slugOrId || m.organizations.slug === hint.slugOrId,
        );

  // Semnătură validă, dar organizația nu e printre apartenențele active:
  // cookie preluat de la alt cont, ori membru exclus/suspendat între timp.
  // RLS l-ar fi oprit oricum; noi doar consemnăm încercarea.
  if (hint.slugOrId !== null && potrivire === undefined) {
    await auditIncercare(supabase, user, "HINT_FARA_APARTENENTA", hint.slugOrId);
  }

  // O singură organizație ⇒ alegere automată, fără ecran intermediar.
  const aleasa = potrivire ?? (apartenente.length === 1 ? apartenente[0] : undefined);
  if (aleasa === undefined) return { status: "alegere_necesara", user, organizations };

  return { status: "ok", user, tenant: construiesteTenant(aleasa) };
});

function construiesteTenant(m: Membership): Tenant {
  return {
    organizationId: m.organizations.id,
    slug: m.organizations.slug,
    name: m.organizations.name,
    role: m.role,
    memberId: m.id,
    timezone: m.organizations.timezone ?? FUS_IMPLICIT,
  };
}

/**
 * `audit_logs` are INSERT revocat pentru rolul `authenticated` (append-only),
 * deci scrierea trece obligatoriu prin funcția SECURITY DEFINER expusă în 0002.
 * Nu folosim clientul service_role: ESLint îl interzice pe această cale, și pe
 * bună dreptate — o citire de tenant nu are nevoie de privilegii de platformă.
 */
async function auditIncercare(
  supabase: ServerSupabase,
  user: AuthUser,
  motiv: string,
  organizatieCeruta: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("log_audit_event", {
    p_organization_id: null,
    p_action: "tenant_forged",
    p_status: "denied",
    p_entity_type: "organization",
    p_entity_id: null,
    p_after: { motiv, organizatie_ceruta: organizatieCeruta, user_id: user.id },
    p_error_code: motiv,
  });

  // Un audit ratat nu are voie să blocheze requestul, dar nici să dispară tăcut.
  if (error !== null) {
    console.error("[tenant] scrierea în audit a eșuat", {
      motiv,
      code: error.code,
    });
  }
}

/**
 * Guard pentru layout-uri și pagini RSC. NU se folosește în Server Actions:
 * acolo `redirect()` ar arunca peste rezultatul acțiunii, iar apelantul are
 * nevoie de un `ActionResult` cu eroare, nu de o navigare.
 */
export async function requireTenant(): Promise<Readonly<{ user: AuthUser; tenant: Tenant }>> {
  const rezolvare = await resolveTenant();
  switch (rezolvare.status) {
    case "ok":
      return { user: rezolvare.user, tenant: rezolvare.tenant };
    case "neautentificat":
      redirect("/autentificare");
    case "fara_organizatie":
      redirect("/fara-acces");
    case "alegere_necesara":
      redirect("/alege-organizatia");
  }
}
