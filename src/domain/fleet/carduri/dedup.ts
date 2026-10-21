// src/domain/fleet/carduri/dedup.ts
//
// Cheia de dedup a unei tranzacții de card (F12b, Decizia 9), în două trepte:
//
//   · `id:<id-ul emitentului>` când extrasul are coloana de ID;
//   · altfel `h:<sha256(emitent|cifre|minut UTC|cantitate|valoare|produs|stație)>#<n>`,
//     unde `n` e AL CÂTELEA rând identic din ACELAȘI fișier: două alimentări
//     identice în același minut rămân două, iar reimportul aceluiași fișier dă
//     aceleași ordinale, deci aceleași chei.
//
// Indexul unic parțial `fctx_dedup_uq (organization_id, emitent, cheie_dedup)`
// face reimportul inofensiv. `node:crypto`: fișierul se importă DOAR din
// acțiuni (server), niciodată dintr-o componentă client.

import { createHash } from "node:crypto";

import { rotunjeste } from "./numere";
import { normalizeazaText } from "./text";

export type DateDedup = Readonly<{
  idTranzactie: string | null;
  /** Cifrele finale din extras, cum apar (max. 6); `null` dacă extrasul n-are card. */
  cifreCard: string | null;
  /** Numărul de înmatriculare normalizat, folosit doar când lipsește cardul. */
  nrInmatriculare: string | null;
  /** Momentul ISO în UTC. */
  moment: string;
  cantitate: number | null;
  valoare: number;
  produs: string;
  statie: string | null;
}>;

function minutUtc(moment: string): string {
  const d = new Date(moment);
  return Number.isNaN(d.getTime()) ? moment : `${d.toISOString().slice(0, 16)}Z`;
}

function cuvant(text: string | null): string {
  return text === null ? "" : normalizeazaText(text).toLowerCase();
}

/** Baza cheii, fără ordinal. Exportată pentru teste și pentru `atribuieOrdinale`. */
export function bazaCheii(rand: DateDedup, emitent: string): string {
  if (rand.idTranzactie !== null && rand.idTranzactie.trim().length > 0) {
    return `id:${normalizeazaText(rand.idTranzactie).slice(0, 190)}`;
  }
  const card =
    rand.cifreCard ?? (rand.nrInmatriculare === null ? "" : `nr:${rand.nrInmatriculare}`);
  const parti = [
    emitent,
    card,
    minutUtc(rand.moment),
    rand.cantitate === null ? "" : rotunjeste(rand.cantitate, 2).toFixed(2),
    rotunjeste(rand.valoare, 2).toFixed(2),
    cuvant(rand.produs),
    cuvant(rand.statie),
  ];
  return `h:${createHash("sha256").update(parti.join("|"), "utf8").digest("hex")}`;
}

/**
 * Cheile finale ale rândurilor unui fișier, în ordinea lor: cele `id:` ca
 * atare (un ID repetat în același fișier e un duplicat real, prins de index),
 * cele `h:` cu ordinalul rândului identic (`#1`, `#2`…).
 */
export function atribuieOrdinale(baze: readonly string[]): string[] {
  const vazute = new Map<string, number>();
  return baze.map((baza) => {
    if (baza.startsWith("id:")) return baza;
    const n = (vazute.get(baza) ?? 0) + 1;
    vazute.set(baza, n);
    return `${baza}#${String(n)}`;
  });
}

/** Cheia unui singur rând, cu ordinalul dat (implicit primul). */
export function cheieDedup(rand: DateDedup, emitent: string, ordinal = 1): string {
  const baza = bazaCheii(rand, emitent);
  return baza.startsWith("id:") ? baza : `${baza}#${String(ordinal)}`;
}
