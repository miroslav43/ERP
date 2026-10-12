// src/app/(app)/flota/rapoarte/acces.ts
import { can, type PermissionMap } from "@/lib/auth/permissions";

/**
 * Cine vede rapoartele flotei (F8): `vehicles:read` ȘI `trip_sheets:read`, ambele
 * la `all`.
 *
 * Rapoartele sunt agregate pe TOATĂ flota. La `team`, RLS taie tăcut vehiculele și
 * foile la echipa managerului, iar un consum sau un cost pe km calculat pe
 * jumătate din foi iese greșit fără nicio eroare — exact ce fișa vehiculului
 * evită ascunzând cifrele derivate din foi (`vedeToateFoile`). Aici, în loc să
 * ascundem coloane, nu deschidem ecranul: un raport pe jumătate nu e raport.
 */
export function poateVedeaRapoarte(permisiuni: PermissionMap): boolean {
  return can(permisiuni, "vehicles:read", "all") && can(permisiuni, "trip_sheets:read", "all");
}

/** Descărcarea (Excel și pachet lunar) cere în plus cheia `vehicles:export`, seedată din 0002. */
export function poateExportaFlota(permisiuni: PermissionMap): boolean {
  return poateVedeaRapoarte(permisiuni) && can(permisiuni, "vehicles:export", "all");
}
