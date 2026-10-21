// src/lib/fleet/citire-bon.ts
import "server-only";

import { serverEnv } from "@/config/env";
import type { FeatureKey } from "@/config/features";
import { can, type PermissionMap } from "@/lib/auth/permissions";

/**
 * Butonul „Citește bonul” apare (F12a §8.11) doar când toate trei sunt
 * adevărate: cheia OpenRouter există, firma are modulul `asistent` (decizia 2
 * a lui Miro: același sub-împuternicit ca bula) și omul scrie foi. Valoarea
 * pleacă în client ca boolean; `serverEnv` nu ajunge niciodată acolo. Acțiunea
 * `citesteBonul` reverifică totul, plus proprietarul foii.
 */
export function citireaBonuluiDisponibila(
  features: ReadonlySet<FeatureKey>,
  permisiuni: PermissionMap,
): boolean {
  return (
    serverEnv.OPENROUTER_API_KEY !== "" &&
    features.has("asistent") &&
    can(permisiuni, "trip_sheets:update", "own")
  );
}
