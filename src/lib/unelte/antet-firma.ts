import { validateazaCui } from "@/domain/organization/cui";

import { curataText } from "./document-tabelar";

/**
 * Antetul de firmă al documentelor de pontaj: unitatea, CUI-ul, compartimentul.
 *
 * ── DE CE ─────────────────────────────────────────────────────────────────
 * Auditul din 8 oct 2026: foaia de pontaj n-avea niciun câmp de antet, iar
 * condica doar „firma”. O foaie pusă pe masa inspectorului trebuie să spună
 * singură al cui e — papervee și modelele Word gratuite au rubrica.
 *
 * CUI-ul se VERIFICĂ (cifra de control, `validateazaCui`), dar nu BLOCHEAZĂ
 * documentul: o greșeală de tastare în antet nu e un motiv să refuzi foaia.
 * Se trece cum a fost scris, iar pagina spune că nu trece verificarea.
 *
 * Curățarea e cea comună (`curataText`, secțiunea B): un U+000C lipit dintr-un
 * editor devine spațiu, un spațiu de lățime zero dispare.
 */

export type AntetFirma = Readonly<{
  firma: string;
  cui: string;
  compartiment: string;
}>;

export const MAX_FIRMA = 120;
/** „RO 1234567890”: prefixul, un spațiu și cele zece cifre maxime ale unui CUI. */
export const MAX_CUI = 14;
export const MAX_COMPARTIMENT = 60;

function camp(q: URLSearchParams, cheie: string, maxim: number): string {
  return curataText(q.get(cheie) ?? "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxim)
    .trim();
}

export function antetFirmaDinParametri(q: URLSearchParams): AntetFirma {
  return {
    firma: camp(q, "firma", MAX_FIRMA),
    cui: camp(q, "cui", MAX_CUI),
    compartiment: camp(q, "compartiment", MAX_COMPARTIMENT),
  };
}

/** „Construct SRL · CUI 14399840 · Compartiment: Producție”, sau `null` când nu e nimic. */
export function randAntetFirma(a: AntetFirma): string | null {
  const parti = [
    a.firma,
    a.cui === "" ? "" : `CUI ${a.cui}`,
    a.compartiment === "" ? "" : `Compartiment: ${a.compartiment}`,
  ].filter((p) => p !== "");
  return parti.length === 0 ? null : parti.join(" · ");
}

/** Mesajul de sub formular când CUI-ul nu trece verificarea. Nu oprește documentul. */
export function avertismentCui(a: AntetFirma): string | null {
  if (a.cui === "") return null;
  const rezultat = validateazaCui(a.cui);
  return rezultat.valid ? null : `${rezultat.mesaj} L-am trecut în document așa cum l-ai scris.`;
}
