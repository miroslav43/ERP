// src/lib/storage/primii-octeti.ts
import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";

/**
 * Primii octeți ai unui obiect DEJA urcat în Storage.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Fratele lui `masoaraObiectul`: acela întoarce mărimea și `content-type`-ul,
 * dar tipul e tot antetul cu care S-A DECLARAT fișierul la urcare. Un client
 * determinat (sau un om cinstit cu un `.docx` redenumit `.pdf`) trece de el.
 * Conținutul real se vede abia în primii octeți, comparați cu semnătura tipului
 * (`potrivesteSemnatura`, `./semnatura.ts`).
 *
 * ── DE CE NU `download()` ──────────────────────────────────────────────────
 * Ar trage tot obiectul prin server — 20 MB pentru un dosar, 200 MB pentru un
 * film — ca să se uite la 16 octeți. Un URL semnat și un `fetch` cu `Range`
 * aduc doar primii 4 KiB.
 *
 * ── DE CE SUB SESIUNEA APELANTULUI ─────────────────────────────────────────
 * `createSignedUrl` se face cu clientul utilizatorului, nu cu service_role:
 * RLS-ul de pe `storage.objects` decide dacă apelantul are voie să CITEASCĂ ce
 * tocmai a urcat. Un rol care poate urca pe o cale dar nu o poate citi înapoi
 * primește `null` aici — adică refuz la salvare —, ceea ce e corect: un rând
 * care trimite spre un fișier pe care autorul lui nu-l poate deschide n-are ce
 * căuta în bază.
 *
 * `null` la orice eșec (semnare refuzată, obiect lipsă, HTTP neizbutit):
 * apelantul tratează „nu pot citi” la fel ca „nu e ce pretinde”.
 */
export async function citestePrimiiOcteti(
  supabase: ServerSupabase,
  bucket: string,
  cale: string,
): Promise<Uint8Array | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cale, 60);
  if (error !== null || data === null) return null;
  const raspuns = await fetch(data.signedUrl, { headers: { Range: "bytes=0-4095" } });
  if (!raspuns.ok) return null;
  return new Uint8Array(await raspuns.arrayBuffer());
}
