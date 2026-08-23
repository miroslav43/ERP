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
  member_id: z.uuid().nullable(),
});

/**
 * Matricea de permisiuni efective pentru (organizație, rol, membru).
 *
 * Argumente primitive, obligatoriu: `React.cache()` compară prin identitate,
 * iar un obiect ca parametru ar rata memoizarea la fiecare apel.
 *
 * Rolul vine din `resolveTenant()` (adică din baza de date), nu de la client.
 *
 * ⚠️ Funcția asta REIMPLEMENTEAZĂ în TypeScript precedența din
 * `app.has_permission` (0002, extinsă de 0063). Cele două trebuie să spună
 * același lucru: baza decide ce se poate scrie, aceasta decide ce se vede pe
 * ecran. Când diverg, nu apare nicio eroare — apare un buton care duce în refuz,
 * sau un modul deblocat pe care omul nu-l vede în meniu. Orice nivel adăugat
 * dincolo se scrie în AMBELE locuri.
 */
export const getPermissionMap = cache(
  async (
    organizationId: string,
    role: AppRole,
    /**
     * Rândul propriu din `organization_members` (`tenant.memberId`).
     *
     * Opțional ca să nu rupă apelanții care nu-l au la îndemână — dar fără el,
     * suprascrierile per angajat sunt INVIZIBILE ecranului, deși baza le
     * respectă. Efectul: administratorul deblochează un modul, iar meniul
     * angajatului rămâne neschimbat până la reîncărcare cu memberId. Se trimite
     * peste tot unde există un tenant.
     */
    memberId?: string,
  ): Promise<PermissionMap> => {
    // Valoarea intră într-un filtru PostgREST `or=(...)`, unde virgula și
    // parantezele sunt sintaxă, nu date. Nu se interpolează niciodată text
    // nevalidat într-un filtru.
    if (!UUID_RE.test(organizationId)) {
      throw new Error("organizationId nu este un UUID valid.");
    }

    const supabase = await createServerSupabase();

    // Două interogări, nu una cu `or` peste rol ȘI membru: filtrul PostgREST
    // ar deveni o expresie imbricată greu de citit, iar rândul de membru nu se
    // potrivește pe rol — se potrivește pe apartenență, indiferent de rol.
    const [peRol, peMembru] = await Promise.all([
      supabase
        .from("role_permissions")
        .select("organization_id, resource, action, scope, member_id")
        .eq("role", role)
        .is("member_id", null)
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .is("deleted_at", null),
      memberId === undefined
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("role_permissions")
            .select("organization_id, resource, action, scope, member_id")
            .eq("organization_id", organizationId)
            .eq("member_id", memberId)
            .is("deleted_at", null),
    ]);

    const { data, error } = peRol;

    if (error !== null) {
      throw new Error(`Nu s-au putut citi permisiunile: ${error.message}`);
    }

    if (peMembru.error !== null) {
      throw new Error(`Nu s-au putut citi suprascrierile: ${peMembru.error.message}`);
    }

    const randuri = z.array(randSchema).parse(data ?? []);
    const suprascrieri = z.array(randSchema).parse(peMembru.data ?? []);

    // Precedență, de la cel mai general la cel mai specific — ordinea de
    // îmbinare a hărților ESTE regula: membrul bate organizația, organizația
    // bate implicitul global. Aceeași ordine ca `order by (member_id is null),
    // (organization_id is null)` din `app.has_permission`.
    const globale = new Map<PermissionKey, PermissionScope>();
    const locale = new Map<PermissionKey, PermissionScope>();
    for (const rand of randuri) {
      const cheie = `${rand.resource}:${rand.action}`;
      (rand.organization_id === null ? globale : locale).set(cheie, rand.scope);
    }
    const aleMele = new Map<PermissionKey, PermissionScope>(
      suprascrieri.map((rand) => [`${rand.resource}:${rand.action}`, rand.scope]),
    );
    const rezolvate = new Map<PermissionKey, PermissionScope>([...globale, ...locale, ...aleMele]);

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
