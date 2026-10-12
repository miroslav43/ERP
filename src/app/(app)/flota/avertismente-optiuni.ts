// src/app/(app)/flota/avertismente-optiuni.ts
import "server-only";

import { avertismenteSofer, rezumatScurt, type VehiculPentruPermis } from "@/domain/fleet/soferi";
import { verificariSoferi } from "@/lib/queries/soferi";

/**
 * Selectoarele de șofer (predarea vehiculului, foaia nouă) cu eticheta scurtă
 * a verificărilor lângă nume: „Ana Pop (12) — permis expirat, aviz lipsă”
 * (0204, F9). Avertizează, nu ascunde și nu blochează: omul rămâne în listă.
 *
 * Un singur apel `verificari_soferi` pentru toată lista (plafonul funcției e
 * 500 de id-uri, cât citește și selectorul).
 */
export async function cuAvertismente<T extends Readonly<{ id: string }>>(
  organizationId: string,
  optiuni: readonly T[],
  zi: string,
  vehicul: VehiculPentruPermis | null = null,
): Promise<readonly (T & Readonly<{ avertisment: string | null }>)[]> {
  if (optiuni.length === 0) return [];
  const fapte = await verificariSoferi(
    organizationId,
    optiuni.map((o) => o.id),
    zi,
  );
  return optiuni.map((o) => {
    const aleLui = fapte.get(o.id);
    return {
      ...o,
      avertisment:
        aleLui === undefined
          ? null
          : rezumatScurt(avertismenteSofer({ fapte: aleLui, zi, momentul: "azi", vehicul })),
    };
  });
}
