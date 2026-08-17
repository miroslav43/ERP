// src/lib/auth/features.ts
import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { createServerSupabase } from "@/lib/supabase/server";
import { FEATURE_KEYS, type FeatureKey } from "@/config/features";

/**
 * Cheia se validează față de catalogul cunoscut de cod, nu ca simplu `string`.
 *
 * O cheie prezentă în bază dar absentă din `FEATURE_KEYS` înseamnă drift între
 * seed-ul SQL și cod — exact genul de nepotrivire care altfel ar trece tăcut și
 * ar face ca un modul să nu apară niciodată în meniu, fără nicio eroare.
 */
const randSchema = z.object({ feature_key: z.enum(FEATURE_KEYS) });

/**
 * Modulele active ale organizației, un singur query per request.
 *
 * Capcană `React.cache()`: memoizarea compară argumentele prin identitate. Cu
 * un obiect ca parametru (`{ organizationId }`) fiecare apel ar fi un miss.
 * De aceea semnătura primește exclusiv primitive.
 *
 * Notă: modulele `is_core` (ex. `nucleu`) trebuie să primească un rând în
 * `organization_features` la crearea organizației — altfel `requireFeature`
 * dă 404 pe propriul tablou de bord.
 */
export const getEnabledFeatures = cache(
  async (organizationId: string): Promise<ReadonlySet<FeatureKey>> => {
    const supabase = await createServerSupabase();

    const { data, error } = await supabase
      .from("organization_features")
      .select("feature_key")
      // Filtrul explicit pe organizație nu e redundant: un platform admin vede,
      // prin politicile din 0002, rândurile tuturor organizațiilor.
      .eq("organization_id", organizationId)
      .eq("enabled", true)
      .is("deleted_at", null);

    if (error !== null) {
      throw new Error(`Nu s-au putut citi modulele active: ${error.message}`);
    }

    return new Set(
      z
        .array(randSchema)
        .parse(data ?? [])
        .map((r) => r.feature_key),
    );
  },
);

/**
 * Guard pentru pagini RSC. Modul dezactivat ⇒ 404, nu 403: nu divulgăm ce
 * module există și nu confirmăm ce nu a cumpărat clientul.
 *
 * Verificarea se repetă obligatoriu în `createAction` — o pagină ascunsă nu
 * blochează un POST direct către Server Action.
 */
export async function requireFeature(
  organizationId: string,
  featureKey: FeatureKey,
): Promise<void> {
  const active = await getEnabledFeatures(organizationId);
  if (!active.has(featureKey)) notFound();
}
