// src/app/(app)/angajati/[id]/permisiuni/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { suprascriePermisiuneSchema } from "@/schemas/permisiuni-membru";

/**
 * Acordă, restrânge sau retrage o permisiune pentru un membru anume.
 *
 * Trei operații într-o singură acțiune, fiindcă din perspectiva celui care
 * apasă sunt aceeași: alege o valoare din listă. `scope: null` = „ca la rol".
 *
 * Poarta reală NU e aici. `role_permissions_insert` / `_update` (0063) verifică,
 * în bază: că rândul e de MEMBRU, că resursa nu e `roles`, că ținta nu e chiar
 * apelantul, și că el are `roles:update` la `all` (toată firma) sau la `team`
 * plus subordonare. Fără ultimele două, un manager s-ar regăsi în propria echipă
 * — `app.is_manager_of` include deliberat fișa proprie — și și-ar putea acorda
 * orice, inclusiv dreptul de a acorda.
 */
export const suprascriePermisiunea = createAction({
  name: "authz.member_permission.set",
  permission: "roles:update",
  minScope: "team",
  input: suprascriePermisiuneSchema,
  audit: {
    action: "update",
    entityType: "role_permission",
    entityId: (input) => input.memberId,
    allow: ["memberId", "cheie", "scope"],
  },
  // Ruta ecranului e pe id-ul FIȘEI, nu al apartenenței, iar acțiunea primește
  // apartenența. Nu compunem calea din ce n-avem: se revalidează secțiunea, iar
  // componenta client cheamă `router.refresh()` pentru pagina curentă.
  revalidate: ["/angajati"],
  handler: async (ctx, input): Promise<Readonly<{ memberId: string }>> => {
    const [resource, action] = input.cheie.split(":");
    if (resource === undefined || action === undefined) {
      throw businessRule("Cheia de permisiune nu are forma «resursă:acțiune».");
    }

    // Actualizare-apoi-inserare, NU `.upsert()`: `role_permissions_uq` e index
    // PARȚIAL (`where deleted_at is null`), iar `on conflict` nu poate ținti un
    // index parțial decât repetându-i predicatul exact. Aceeași capcană a oprit
    // deja seed-ul de demonstrație și patch-ul din 0023.
    const existent = await ctx.supabase
      .from("role_permissions")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("member_id", input.memberId)
      .eq("resource", resource)
      .eq("action", action)
      .is("deleted_at", null)
      .maybeSingle();
    if (existent.error !== null) throw existent.error;

    if (input.scope === null) {
      // Retragere = ștergere logică. Nicio politică DELETE în tot proiectul.
      if (existent.data === null) return { memberId: input.memberId };
      const { data, error } = await ctx.supabase
        .from("role_permissions")
        .update({ deleted_at: ctx.now.toISOString() })
        .eq("id", existent.data.id)
        .select("id");
      if (error !== null) throw error;
      // `.select()` după `.update()`: un UPDATE respins de clauza `USING` nu dă
      // eroare, afectează zero rânduri și tace.
      if (data === null || data.length === 0) {
        throw businessRule(
          "Suprascrierea nu a putut fi retrasă. Verificați dacă mai aveți dreptul asupra acestui membru.",
        );
      }
      return { memberId: input.memberId };
    }

    if (existent.data !== null) {
      const { data, error } = await ctx.supabase
        .from("role_permissions")
        .update({ scope: input.scope })
        .eq("id", existent.data.id)
        .select("id");
      if (error !== null) throw error;
      if (data === null || data.length === 0) {
        throw businessRule(
          "Permisiunea nu a putut fi modificată. Verificați dacă mai aveți dreptul asupra acestui membru.",
        );
      }
      return { memberId: input.memberId };
    }

    // `role` e `not null` în schemă, dar irelevant pe un rând de membru:
    // precedența îl ignoră (`rp.member_id = m.id` nu compară rolul). Se scrie
    // rolul membrului doar ca rândul să rămână lizibil în baza de date.
    const membru = await ctx.supabase
      .from("organization_members")
      .select("role")
      .eq("id", input.memberId)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (membru.error !== null) throw membru.error;
    if (membru.data === null) {
      throw businessRule("Membrul nu a fost găsit în această organizație.");
    }

    const { data, error } = await ctx.supabase
      .from("role_permissions")
      .insert({
        organization_id: ctx.tenant.organizationId,
        member_id: input.memberId,
        role: membru.data.role,
        resource,
        action,
        scope: input.scope,
      })
      .select("id");
    if (error !== null) throw error;
    if (data === null || data.length === 0) {
      throw businessRule("Permisiunea nu a putut fi acordată.");
    }
    return { memberId: input.memberId };
  },
});
