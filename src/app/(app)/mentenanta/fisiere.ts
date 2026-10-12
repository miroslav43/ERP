// src/app/(app)/mentenanta/fisiere.ts
//
// Regulile de fișier ale modulului, PURE, într-un singur loc: le aplică și
// `sesizari/actions.ts` (pregătirea și confirmarea încărcării), și
// `actions.ts` (procesul-verbal urcat înaintea intervenției, M6). Un fișier
// `"use server"` nu poate exporta altceva decât funcții async (capcana 39),
// deci regula comună nu putea sta într-unul dintre ele.

import {
  LIMITA_DOCUMENT_MENTENANTA_BYTES,
  LIMITA_FOTO_BYTES,
  MIME_DOCUMENT_MENTENANTA,
  MIME_FOTO,
} from "@/schemas/maintenance";

/**
 * Ce e greșit la fișier, ca propoziție pentru om, sau `null`. Pe o sesizare se
 * pun doar fotografii (≤ 5 MB); pe echipament, intervenție și autorizație —
 * documente (PDF, Word, fotografii, ≤ 25 MB).
 */
export function problemaFisier(
  entityType: string,
  mime: string,
  dimensiune: number,
): string | null {
  const ePoza = entityType === "fault_report";
  const acceptate: readonly string[] = ePoza ? MIME_FOTO : MIME_DOCUMENT_MENTENANTA;
  if (!acceptate.includes(mime)) {
    return ePoza
      ? "Pe o sesizare se pun fotografii: JPG, PNG, WEBP sau HEIC."
      : "Acceptăm fotografii (JPG, PNG, WEBP, HEIC), PDF sau Word.";
  }
  if (dimensiune <= 0) return "Fișierul selectat este gol.";
  const limita = ePoza ? LIMITA_FOTO_BYTES : LIMITA_DOCUMENT_MENTENANTA_BYTES;
  if (dimensiune > limita) {
    return ePoza ? "Fotografia depășește 5 MB." : "Documentul depășește 25 MB.";
  }
  return null;
}

/** `{org}/{entity_type}/{entity_id}/` — forma cerută de `app.mentenanta_poate_fisier`. */
export function prefixCaleMentenanta(
  organizationId: string,
  entityType: string,
  entityId: string,
): string {
  return `${organizationId}/${entityType}/${entityId}/`;
}

/**
 * Anti-traversal: calea stă EXACT sub prefixul entității, fără `..` și fără
 * subfoldere. Fără asta, un client ar putea lega un rând de obiectul altei
 * entități.
 */
export function caleSubEntitate(cale: string, prefix: string): boolean {
  if (!cale.startsWith(prefix)) return false;
  const rest = cale.slice(prefix.length);
  return rest.length > 0 && !rest.includes("/") && !rest.includes("..");
}
