// src/lib/storage/masoara-obiectul.ts
import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * Mărimea și tipul REALE ale unui obiect deja urcat în Storage.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Fluxul de încărcare are trei pași: acțiunea semnează calea, browserul urcă
 * octeții direct în Storage, a treia acțiune scrie rândul. Pasul al treilea
 * primea până acum `mime` și `dimensiune` DE LA CLIENT și le scria ca atare —
 * adică exact valorile pe care le declarase browserul înainte să urce ceva.
 *
 * Consecințele, din auditul din 21 sept 2026 (F44): tokenul semnat nu fixează
 * nici tipul, nici mărimea, deci după el se putea urca orice conținut, de orice
 * mărime până la limita bucket-ului; iar metadatele salvate puteau minți —
 * „certificat medical.pdf, 200 KB" pentru un fișier care e altceva.
 *
 * Funcția asta citește ce a ajuns ACOLO, de la Storage: `size` și `content_type`
 * calculate de server la scriere, nu declarate de client.
 *
 * ── CE NU FACE ─────────────────────────────────────────────────────────────
 * Nu citește primii octeți. `content_type` e antetul cu care s-a urcat
 * fișierul, deci un client determinat poate încă minți tipul — dar nu și
 * mărimea. Pentru materialele de curs, unde tipul chiar contează (un „film"
 * care nu e film se vede abia la redare), verificarea de semnătură prin magic
 * bytes rămâne cea din `src/lib/media/cale.ts`.
 */
export async function masoaraObiectul(
  supabase: ServerSupabase,
  bucket: string,
  cale: string,
): Promise<Readonly<{ octeti: number; mime: string }> | null> {
  const { data, error } = await supabase.storage.from(bucket).info(cale);
  if (error !== null || data === null) return null;
  return {
    octeti: typeof data.size === "number" ? data.size : 0,
    mime: typeof data.contentType === "string" ? data.contentType : "",
  };
}
