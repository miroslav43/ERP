// src/lib/navigare/fisa.ts
/**
 * Legătura spre fișa unui angajat, decisă PER RÂND.
 *
 * `/angajati/[id]` cere `employees:read` (orice scope) și citește fișa prin
 * RLS: la `team` doar subarborele managerial, la `own` doar fișa proprie, și
 * niciodată una ștearsă logic. Un nume afișat pe un ecran a trecut, de
 * regulă, prin aceeași politică — deci „a venit din bază pentru omul ăsta"
 * înseamnă „fișa i se deschide". Ce rămâne de verificat aici: că rândul chiar
 * există (nu e `null`/`undefined` din embed sau hartă), că nu e șters, și că
 * rolul are cheia.
 *
 * Fișier PUR, fără `server-only`: primește harta de permisiuni ca argument,
 * ca să poată fi testat și folosit și din componente de server, și din cod de
 * domeniu.
 */
import { meetsScope, type PermissionScope } from "@/config/permissions";

export type FisaDinBaza = Readonly<{
  id: string;
  /** Când lipsește din select, se presupune nești: adaugă `deleted_at` în embed ca să nu presupui. */
  deleted_at?: string | null | undefined;
}>;

export type HartaPermisiuni = ReadonlyMap<string, PermissionScope>;

/** `/angajati/<id>` sau `null`. */
export function hrefFisa(
  fisa: FisaDinBaza | null | undefined,
  permisiuni: HartaPermisiuni,
): string | null {
  if (fisa === null || fisa === undefined) return null;
  if (fisa.deleted_at !== undefined && fisa.deleted_at !== null) return null;
  if (!meetsScope(permisiuni.get("employees:read"), "own")) return null;
  return `/angajati/${fisa.id}`;
}

/**
 * Varianta pentru listele care au citit angajații într-o hartă (`angajatiDupaId`,
 * `numeleAngajatilor`): absența din hartă înseamnă rând ascuns de RLS.
 */
export function hrefFisaDinHarta(
  id: string | null | undefined,
  harta: ReadonlyMap<string, FisaDinBaza>,
  permisiuni: HartaPermisiuni,
): string | null {
  if (id === null || id === undefined) return null;
  return hrefFisa(harta.get(id), permisiuni);
}
