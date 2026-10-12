// src/domain/maintenance/iscir.ts
/**
 * Autorizațiile ISCIR (M7, 0193): lista de tipuri, semaforul, legătura cu
 * categoriile de verificări legale și alerta RSVTI. Funcții pure, fără I/O.
 *
 * ── AVERTIZARE, NU BLOCARE ────────────────────────────────────────────────
 * O autorizație sau un VTP expirat pe un utilaj în funcțiune se arată ROȘU pe
 * panou, pe lista ISCIR și pe fișa echipamentului (cazul 38) — dar nimic nu se
 * refuză: utilajul se oprește din hală, nu din aplicație, iar aplicația nu poate
 * ști dacă PV-ul nou e deja în sertar.
 *
 * ── `tip` RĂMÂNE TEXT ─────────────────────────────────────────────────────
 * Rândurile dinainte de 0193 au tipul scris liber („Macara capră 5t”), iar
 * coloana nu are CHECK. Lista de mai jos e cea pe care o oferă formularul;
 * `etichetaTipIscir` arată textul vechi așa cum e.
 */

import { formatDate } from "@/lib/format/date";
import type { TreaptaScadenta } from "@/domain/scadente";

import { PRAG_MENTENANTA_AVERTIZARE_ZILE } from "./scadente";
import { categorieLegala, depasesteMaximulLegal, type CategorieLegala } from "./legal";

export const TIPURI_ISCIR = [
  "ascensor",
  "platforma_ridicatoare",
  "stivuitor",
  "macara",
  "pod_rulant",
  "cazan",
  "recipient_sub_presiune",
  "instalatie_gpl",
  "compresor",
  "altele",
] as const;
export type TipIscir = (typeof TIPURI_ISCIR)[number];

export const ETICHETE_TIP_ISCIR: Readonly<Record<TipIscir, string>> = {
  ascensor: "Ascensor",
  platforma_ridicatoare: "Platformă ridicătoare",
  stivuitor: "Stivuitor",
  macara: "Macara",
  pod_rulant: "Pod rulant",
  cazan: "Cazan",
  recipient_sub_presiune: "Recipient sub presiune",
  instalatie_gpl: "Instalație GPL",
  compresor: "Compresor",
  altele: "Altele",
};

export function esteTipIscir(tip: string): tip is TipIscir {
  return (TIPURI_ISCIR as readonly string[]).includes(tip);
}

/** Eticheta tipului din listă; un tip liber (rânduri vechi) se arată așa cum e scris. */
export function etichetaTipIscir(tip: string): string {
  return esteTipIscir(tip) ? ETICHETE_TIP_ISCIR[tip] : tip;
}

export const REGIMURI_ISCIR = ["inregistrat", "neinregistrat_rsvti"] as const;
export type RegimIscir = (typeof REGIMURI_ISCIR)[number];

export const ETICHETE_REGIM_ISCIR: Readonly<Record<RegimIscir, string>> = {
  inregistrat: "Înregistrat la ISCIR",
  neinregistrat_rsvti: "Neînregistrat — în evidența RSVTI",
};

/** Ce categorie legală acoperă VTP-ul unui tip ISCIR — pentru maximul legal (cazul 40). */
const CATEGORIE_PE_TIP: Readonly<Partial<Record<TipIscir, string>>> = {
  ascensor: "vtp_ascensor",
  platforma_ridicatoare: "vtp_masini_ridicat",
  stivuitor: "vtp_masini_ridicat",
  macara: "vtp_masini_ridicat",
  pod_rulant: "vtp_masini_ridicat",
  cazan: "vtp_cazan",
  recipient_sub_presiune: "vtp_recipient",
  compresor: "vtp_recipient",
  instalatie_gpl: "verificare_gpl",
};

export function categoriePentruTipIscir(tip: string): CategorieLegala | null {
  if (!esteTipIscir(tip)) return null;
  return categorieLegala(CATEGORIE_PE_TIP[tip] ?? null);
}

export type StareAutorizatie =
  "inlocuita" | "suspendata" | "expirata" | "expira_curand" | "valabila";

export const ETICHETE_STARE_AUTORIZATIE: Readonly<Record<StareAutorizatie, string>> = {
  valabila: "Valabilă",
  expira_curand: "Expiră curând",
  expirata: "Expirată",
  suspendata: "Suspendată",
  inlocuita: "Înlocuită prin reînnoire",
};

/**
 * Treapta pastilei `<Scadenta>`. Suspendată = roșu, ca expirată: utilajul nu
 * poate funcționa legal în niciunul dintre cazuri (cazul 38). Înlocuită = fără
 * treaptă: e istoric, nu o scadență.
 */
export const TREPTE_STARE_AUTORIZATIE: Readonly<Record<StareAutorizatie, TreaptaScadenta>> = {
  valabila: "in_regula",
  expira_curand: "curand",
  expirata: "expirat",
  suspendata: "expirat",
  inlocuita: "neaplicabil",
};

export type TermeneAutorizatie = Readonly<{
  valabil_pana: string;
  scadenta_verificare_tehnica: string | null;
}>;

/** Termenul care contează: cel mai apropiat dintre valabilitate și VTP. */
export function termenAutorizatie(a: TermeneAutorizatie): string {
  const vtp = a.scadenta_verificare_tehnica;
  return vtp !== null && vtp < a.valabil_pana ? vtp : a.valabil_pana;
}

/**
 * Semaforul unei autorizații. Ordinea contează: un rând înlocuit e istoric
 * (oricât de vechi ar fi termenul lui), unul suspendat nu mai e „valabil”
 * oricât de departe ar fi data; abia apoi se compară termenul cu ziua de azi.
 * Comparație lexicografică pe ISO, ca în `stareScadentaData`: scadența de AZI
 * e încă „expiră curând”.
 */
export function stareAutorizatie(
  a: TermeneAutorizatie &
    Readonly<{ suspendata_la: string | null; inlocuita_de_id: string | null }>,
  azi: string,
  pragZile: number = PRAG_MENTENANTA_AVERTIZARE_ZILE,
): StareAutorizatie {
  if (a.inlocuita_de_id !== null) return "inlocuita";
  if (a.suspendata_la !== null) return "suspendata";
  const termen = termenAutorizatie(a);
  if (termen < azi) return "expirata";
  const limita = new Date(`${azi}T00:00:00Z`);
  limita.setUTCDate(limita.getUTCDate() + pragZile);
  return termen <= limita.toISOString().slice(0, 10) ? "expira_curand" : "valabila";
}

/** Stările care cer acțiune — exact ce intră în coada panoului. */
export function cereAtentieAutorizatie(stare: StareAutorizatie): boolean {
  return stare === "expirata" || stare === "expira_curand";
}

/**
 * Avertismentul „documentul trece de maximul legal” (cazul 40). Documentul are
 * prioritate: o scadență MAI SCURTĂ decât maximul nu spune nimic; una mai lungă
 * se semnalează, cu maximul ⚠ de confirmat. Se măsoară de la data emiterii.
 */
export function avertismentMaximLegal(
  a: TermeneAutorizatie & Readonly<{ tip: string; emis_la: string | null }>,
): string | null {
  const categorie = categoriePentruTipIscir(a.tip);
  if (categorie === null) return null;
  const termen =
    a.scadenta_verificare_tehnica !== null && a.scadenta_verificare_tehnica > a.valabil_pana
      ? a.scadenta_verificare_tehnica
      : a.valabil_pana;
  const depasire = depasesteMaximulLegal(categorie.maximLuni, a.emis_la, termen);
  if (depasire === null || categorie.maximLuni === null) return null;
  return (
    `Scadența din document (${formatDate(termen)}) trece de maximul legal de ` +
    `${String(categorie.maximLuni)} de luni de la emitere (${formatDate(depasire.dataMaxima)}). ` +
    "Verificați documentul; ⚠ maximul e de confirmat cu RSVTI."
  );
}

/** Alerta de pe panou (cazul 41): echipamente ISCIR fără un RSVTI activ desemnat în setări. */
export function lipsesteRsvti(
  stare: Readonly<{ echipamenteIscir: number; rsvtiActiv: boolean }>,
): boolean {
  return stare.echipamenteIscir > 0 && !stare.rsvtiActiv;
}
