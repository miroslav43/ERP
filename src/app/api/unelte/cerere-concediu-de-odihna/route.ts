import type { NextRequest } from "next/server";

import { GET as descarcaCererea } from "../cerere-concediu/route";

/**
 * Adresa cu slug-ul PAGINII (`/unelte/cerere-concediu-de-odihna`) dădea 404,
 * deși toate celelalte unelte au API-ul la același slug ca pagina (auditul
 * transversal din 8 oct 2026). Aceeași descărcare, sub ambele adrese.
 */
export const dynamic = "force-dynamic";

export function GET(cerere: NextRequest): Promise<Response> {
  return descarcaCererea(cerere);
}
