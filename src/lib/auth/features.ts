// src/lib/auth/features.ts
import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { createServerSupabase } from "@/lib/supabase/server";
import { imparteCheiDeModul, type FeatureKey } from "@/config/features";

/**
 * Forma rândului, nu și apartenența cheii la catalog.
 *
 * Aici s-a aflat un defect scump: schema era `z.enum(FEATURE_KEYS)`, iar
 * `z.array(...).parse()` ARUNCĂ la prima cheie necunoscută. Intenția era bună —
 * driftul între seed-ul SQL și cod să nu treacă tăcut — dar prețul era greșit:
 * `organization_features` se citește pe FIECARE pagină din spatele
 * autentificării, deci o cheie în plus în bază nu ascundea un modul, ci dădea
 * 500 pe toată aplicația. S-a întâmplat pe 2026-08-21 cu `ticketing`, seedat în
 * bază înaintea codului.
 *
 * Acum cheile necunoscute se taie (`imparteCheiDeModul`) și se scriu în log:
 * driftul rămâne vizibil, fără să mai coste disponibilitatea.
 */
const randSchema = z.object({ feature_key: z.string() });

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

    const { cunoscute, necunoscute } = imparteCheiDeModul(
      z
        .array(randSchema)
        .parse(data ?? [])
        .map((r) => r.feature_key),
    );

    if (necunoscute.length > 0) {
      // Nu e eroare: baza poate merge legitim înaintea codului. E însă un semnal
      // care trebuie să lase urmă — altfel modulul lipsește din meniu fără ca
      // nimeni să poată spune de ce.
      console.warn(
        `[features] Organizația ${organizationId} are module active pe care codul nu le cunoaște: ` +
          `${necunoscute.join(", ")}. Adaugă-le în FEATURE_KEYS din src/config/features.ts sau ` +
          "dezactivează-le din Super-Admin → Module.",
      );
    }

    return new Set(cunoscute);
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
