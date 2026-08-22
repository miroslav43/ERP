import { NextResponse } from "next/server";

/**
 * Sondă de liveness pentru healthcheck-ul Docker Swarm (vezi `docker-stack.yml`).
 *
 * Rolling update-ul `start-first` promovează replica nouă abia după ce ruta asta
 * răspunde 200. Deci trebuie să fie rapidă, deterministă și să nu depindă de
 * nimic extern: dacă ar atinge Supabase, o indisponibilitate de la ei ar bloca
 * deploy-ul și, mai rău, ar face Swarm-ul să omoare la nesfârșit replici perfect
 * sănătoase.
 *
 * `force-static`: serverul standalone răspunde din cache, fără să invoce
 * randarea React. Fără ea, ruta ar fi dinamică și fiecare healthcheck (la 10s,
 * ×2 replici) ar porni un render complet.
 *
 * Exclusă din matcher-ul din `src/proxy.ts` — altfel `updateSession()` ar rula
 * la fiecare sondă și ar lega liveness-ul de disponibilitatea GoTrue.
 */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
