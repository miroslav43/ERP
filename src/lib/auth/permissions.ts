// src/lib/auth/permissions.ts
import "server-only";

import { cache } from "react";
import { z } from "zod";

import { createServerSupabase } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/tenant/types";

export const PERMISSION_SCOPES = ["none", "own", "team", "all"] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

/** `none` = REFUZ EXPLICIT (rang 0), nu absența rândului. */
export const SCOPE_RANK: Readonly<Record<PermissionScope, number>> = {
  none: 0,
  own: 1,
  team: 2,
  all: 3,
};

/** Cheie „resource:action”, ex. „leave_requests:approve”. */
export type PermissionKey = string;
export type PermissionMap = ReadonlyMap<PermissionKey, PermissionScope>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const randSchema = z.object({
  organization_id: z.uuid().nullable(),
  resource: z.string(),
  action: z.string(),
  scope: z.enum(PERMISSION_SCOPES),
});

/**
 * Matricea de permisiuni efective pentru (organizație, rol).
 *
 * Argumente primitive, obligatoriu: `React.cache()` compară prin identitate,
 * iar un obiect ca parametru ar rata memoizarea la fiecare apel.
 *
 * Rolul vine din `resolveTenant()` (adică din baza de date), nu de la client.
 */
export const getPermissionMap = cache(
  async (organizationId: string, role: AppRole): Promise<PermissionMap> => {
    // Valoarea intră într-un filtru PostgREST `or=(...)`, unde virgula și
    // parantezele sunt sintaxă, nu date. Nu se interpolează niciodată text
    // nevalidat într-un filtru.
    if (!UUID_RE.test(organizationId)) {
      throw new Error("organizationId nu este un UUID valid.");
    }

    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from("role_permissions")
      .select("organization_id, resource, action, scope")
      .eq("role", role)
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .is("deleted_at", null);

    if (error !== null) {
      throw new Error(`Nu s-au putut citi permisiunile: ${error.message}`);
    }

    const randuri = z.array(randSchema).parse(data ?? []);

    // Suprascriere: rândul organizației bate implicitul global
    // (`organization_id is null`), indiferent de ordinea în care vin rândurile.
    const globale = new Map<PermissionKey, PermissionScope>();
    const locale = new Map<PermissionKey, PermissionScope>();
    for (const rand of randuri) {
      const cheie = `${rand.resource}:${rand.action}`;
      (rand.organization_id === null ? globale : locale).set(cheie, rand.scope);
    }
    const rezolvate = new Map<PermissionKey, PermissionScope>([...globale, ...locale]);

    // Abia DUPĂ rezolvare scoatem `none`: un `none` local trebuie să șteargă un
    // `all` global, dar în harta finală refuzul explicit și absența înseamnă
    // același lucru. Altfel, orice consumator care testează `map.has(cheie)`
    // (inclusiv construirea meniului) ar citi refuzul drept permisiune.
    return new Map([...rezolvate].filter(([, scope]) => scope !== "none"));
  },
);

/** `minScope` = scope-ul minim cerut de acțiune. Absența = refuz. */
export function can(
  map: PermissionMap,
  key: PermissionKey,
  minScope: PermissionScope = "own",
): boolean {
  const scope = map.get(key);
  return scope !== undefined && SCOPE_RANK[scope] >= SCOPE_RANK[minScope];
}

/** Scope-ul acordat, pentru filtrarea rândurilor (own / team / all) în query-uri. */
export function scopeFor(map: PermissionMap, key: PermissionKey): PermissionScope | null {
  return map.get(key) ?? null;
}
