// src/domain/fleet/fisiere.ts

/**
 * Fișierele flotei (0202): scanarea documentului de vehicul și poza bonului de
 * alimentare, în bucketul privat `org-flota`. Funcții pure, folosite și de
 * acțiuni, și de componentele de încărcare — fără directivă, ca o constantă de
 * aici să nu devină proxy când o importă serverul (memoria „Constantă client
 * importată în server”).
 *
 * Forma căii e contractul cu `app.flota_poate_fisier` și cu triggerele de rând
 * (`internal.flota_cale_valida`): exact patru segmente,
 *
 *   {org}/vehicles/{vehicle_id}/{uuid}-{fișier}      — scanarea documentului
 *   {org}/trip_sheets/{trip_sheet_id}/{uuid}-{fișier} — poza bonului
 *
 * Segmentul 3 e entitatea, NU utilizatorul: poarta nu folosește `app.can_path`.
 */

import { caleInPrefix, slugFisier } from "@/lib/documents/cale";

export const BUCKET_FLOTA = "org-flota";

/** 20 MB: limita bucketului din 0202 (`file_size_limit = 20971520`). */
export const LIMITA_FISIER_FLOTA_BYTES = 20 * 1024 * 1024;

/** Tipurile acceptate de bucket. HEIC/HEIF: poza bonului făcută cu un iPhone. */
export const MIME_FLOTA = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type ResursaFisierFlota = "vehicles" | "trip_sheets";

export function prefixCaleFlota(
  organizationId: string,
  resursa: ResursaFisierFlota,
  entitateId: string,
): string {
  return `${organizationId}/${resursa}/${entitateId}/`;
}

export function construiesteCaleFlota(
  organizationId: string,
  resursa: ResursaFisierFlota,
  entitateId: string,
  numeFisier: string,
): string {
  return `${prefixCaleFlota(organizationId, resursa, entitateId)}${crypto.randomUUID()}-${slugFisier(numeFisier)}`;
}

/**
 * Calea primită de la client stă exact sub prefixul entității, fără subfoldere
 * și fără `..`. Aceeași regulă o aplică baza pe rând; aici refuzul ajunge pe
 * câmp, nu ca P0001 brut.
 */
export function caleFlotaValida(
  cale: string,
  organizationId: string,
  resursa: ResursaFisierFlota,
  entitateId: string,
): boolean {
  const prefix = prefixCaleFlota(organizationId, resursa, entitateId);
  if (!caleInPrefix(cale, prefix)) return false;
  const rest = cale.slice(prefix.length);
  return rest.length > 0 && !rest.includes("/") && cale.length <= 400;
}

/**
 * Scanul semnat al unui proces-verbal de predare (0215): în folderul
 * vehiculului, dar cu numele LEGAT de PV — `pv-{id PV}-{uuid}-{fișier}`.
 * Poarta bucketului îl dă și celor care văd doar PV-ul (fostul șofer), deci
 * calea nu poate fi a altui fișier din folder (RCA, talon). Baza cere aceeași
 * formă pe rând (`internal.pv_vehicul_inainte`, X2).
 */
function prefixScanPv(organizationId: string, vehiculId: string, pvId: string): string {
  return `${prefixCaleFlota(organizationId, "vehicles", vehiculId)}pv-${pvId}-`;
}

export function construiesteCaleScanPv(
  organizationId: string,
  vehiculId: string,
  pvId: string,
  numeFisier: string,
): string {
  return `${prefixScanPv(organizationId, vehiculId, pvId)}${crypto.randomUUID()}-${slugFisier(numeFisier)}`;
}

export function caleScanPvValida(
  cale: string,
  organizationId: string,
  vehiculId: string,
  pvId: string,
): boolean {
  const prefix = prefixScanPv(organizationId, vehiculId, pvId);
  return (
    caleFlotaValida(cale, organizationId, "vehicles", vehiculId) &&
    cale.startsWith(prefix) &&
    cale.length > prefix.length
  );
}

export function verificaFisierFlota(mime: string, dimensiune: number): string | null {
  if (!MIME_FLOTA.some((acceptat) => acceptat === mime)) {
    return "Acceptăm doar PDF sau fotografii (JPG, PNG, WEBP, HEIC).";
  }
  if (dimensiune <= 0) return "Fișierul selectat este gol.";
  if (dimensiune > LIMITA_FISIER_FLOTA_BYTES) return "Fișierul depășește 20 MB.";
  return null;
}
