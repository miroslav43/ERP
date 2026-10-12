// src/app/(app)/angajati/[id]/permisiuni/actions.ts
"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import type { PermissionScope } from "@/config/permissions";
import {
  implicitulRolului,
  incapeInPlafon,
  plafonulAcordarii,
  poateReveniLaRol,
} from "@/domain/permisiuni/plafon-acordare";
import { businessRule, forbidden } from "@/lib/actions/errors";
import type { ActionContext } from "@/lib/actions/types";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { ROLURI_ATRIBUIBILE, schimbaRolul } from "@/lib/membri/schimba-rol";
import { stergeLogic } from "@/lib/supabase/sterge-logic";
import { suprascriePermisiuneSchema } from "@/schemas/permisiuni-membru";

/**
 * Rolul, schimbat de pe fișa omului — nu doar din Setări → Membri.
 *
 * ── DE CE ȘI AICI ─────────────────────────────────────────────────────────
 * Ecranul de membri e o listă de adrese de e-mail: cine schimbă rolul acolo nu
 * vede departamentul, funcția sau contractul omului. Decizia „ce rol are" se ia
 * uitându-te la fișă, deci controlul stă și pe fișă.
 *
 * ── DE CE `users:update` LA `all` ─────────────────────────────────────────
 * Nu e o alegere de prudență, e singura care corespunde bazei:
 * `organization_members_update` (0002_authz.sql:959) cere
 * `app.has_role(org, ['org_admin'])`. Un prag mai mic ar lăsa acțiunea să
 * pornească pentru un manager cu `roles:update = team`, iar refuzul ar veni de
 * la RLS ca UPDATE cu zero rânduri — adică nu ar veni deloc.
 *
 * Restul paginii cere `roles:update` la `team`, fiindcă suprascrierile per
 * membru chiar se pot acorda pe echipă. Cele două praguri diferă pe bună
 * dreptate: una schimbă rolul, cealaltă îl nuanțează.
 */
export const schimbaRolulAngajatului = createAction({
  name: "employees.change_role",
  input: z.object({ memberId: z.uuid(), role: z.enum(ROLURI_ATRIBUIBILE) }),
  permission: "users:update",
  minScope: "all",
  audit: {
    action: "role_changed",
    entityType: "organization_members",
    entityId: (input) => input.memberId,
    allow: ["memberId", "role"],
  },
  // Și lista de membri: rolul afișat acolo tocmai s-a schimbat de aici.
  revalidate: ["/angajati", "/setari/membri"],
  handler: async (ctx, input): Promise<Readonly<{ id: string; role: string }>> =>
    schimbaRolul({
      db: ctx.supabase,
      organizationId: ctx.tenant.organizationId,
      memberId: input.memberId,
      rol: input.role,
      memberIdAutor: ctx.tenant.memberId,
    }),
});

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
 * orice, inclusiv dreptul de a acorda. Din 0197, cine acordă pe `team` dă cel
 * mult ce are el însuși pe aceeași cheie (plafonul, verificat și aici, pentru
 * mesaj).
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

    // Baza refuză oricum (`member_id is distinct from app.membrul_meu`), dar cu
    // 42501 fără context; aici omul află DE CE.
    if (input.memberId === ctx.tenant.memberId) {
      throw businessRule("Nu vă puteți modifica propriile permisiuni.");
    }

    // Plafonul acordării: pe echipă se dă cel mult ce are acordantul pe aceeași
    // cheie, altfel managerul fără `payroll:read` îi deschidea subordonatului
    // toate salariile (v. `plafon-acordare.ts`). Poarta reală e în bază (0197);
    // verificarea de aici dă mesajul. `getPermissionMap` e memorat pe cerere,
    // deci e aceeași hartă pe care a citit-o deja `createAction`.
    const permisiuni = await getPermissionMap(
      ctx.tenant.organizationId,
      ctx.tenant.role,
      ctx.tenant.memberId,
    );
    const plafon = plafonulAcordarii(ctx.scope, scopeFor(permisiuni, input.cheie));
    if (input.scope !== null && !incapeInPlafon(input.scope, plafon)) {
      throw forbidden("Nu puteți acorda pe această permisiune mai mult decât aveți dumneavoastră.");
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
      // Retragerea NU e neutră: membrul cade pe implicitul rolului, deci și
      // „ca la rol” trece prin plafon. Altfel un `payroll:read = none` pus de
      // administrator pe un `hr` (rolul dă `all`), retras de un manager fără
      // salarizare, îi redeschidea subordonatului toate salariile. Poarta reală
      // e WITH CHECK-ul din 0197 (`app.implicitul_rolului_membrului`); aici,
      // mesajul. Fără plafon (`all`) nu e nimic de comparat, deci nici de citit.
      if (plafon !== "all") {
        const implicit = await implicitulMembrului(ctx, input.memberId, resource, action);
        if (!poateReveniLaRol(implicit, plafon)) {
          throw forbidden(
            "Nu puteți readuce această permisiune la valoarea rolului: rolul îi dă mai mult decât aveți dumneavoastră. Restricția o poate retrage un administrator al organizației.",
          );
        }
      }
      // Prin `stergeLogic`, nu `update({ deleted_at })`: politica SELECT ascunde
      // rândul șters, iar UPDATE-ul direct pica mereu cu 42501 (0164).
      const { data, error } = await stergeLogic(ctx.supabase, "role_permissions", [
        existent.data.id,
      ]);
      if (error !== null) throw error;
      // Zero rânduri = USING-ul politicii UPDATE a refuzat, fără eroare.
      if (data.length === 0) {
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

/**
 * Ce ar avea membrul fără suprascrierea lui: rândurile de ROL (fără
 * `member_id`) ale rolului lui, pe cheia dată — al organizației bate globalul
 * (`implicitulRolului`). Aceeași socoteală ca pagina și ca
 * `app.implicitul_rolului_membrului` din 0197.
 */
async function implicitulMembrului(
  ctx: ActionContext,
  memberId: string,
  resource: string,
  action: string,
): Promise<PermissionScope | null> {
  const membru = await ctx.supabase
    .from("organization_members")
    .select("role")
    .eq("id", memberId)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (membru.error !== null) throw membru.error;
  if (membru.data === null) {
    throw businessRule("Membrul nu a fost găsit în această organizație.");
  }

  const randuri = await ctx.supabase
    .from("role_permissions")
    .select("organization_id, scope")
    .eq("role", membru.data.role)
    .is("member_id", null)
    .eq("resource", resource)
    .eq("action", action)
    .or(`organization_id.eq.${ctx.tenant.organizationId},organization_id.is.null`)
    .is("deleted_at", null);
  if (randuri.error !== null) throw randuri.error;
  return implicitulRolului(randuri.data ?? []);
}
