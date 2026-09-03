// src/app/api/push/livreaza/route.ts
import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/config/env";
import { golesteCoada } from "@/lib/push/coada";
// ⚠ OCOLEȘTE COMPLET RLS. Livrarea rulează fără niciun utilizator autentificat,
// pentru toți destinatarii deodată: nu există sesiune din care RLS să deducă
// ceva. `push_livrari` n-are nicio politică — e închisă și pentru
// `authenticated` — iar selecția o face `public.push_ia_din_coada`, cu
// `for update skip locked`.
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Golește coada de notificări push.
 *
 * CINE O CHEAMĂ
 * Un systemd timer de pe VM, la un minut — `deploy/push-livrare.{service,timer}`.
 *
 * DE CE NU pg_cron + pg_net
 * `pg_net` nu e activat pe instanța noastră; vezi comentariul din
 * `api/reges/reconciliere/route.ts`. Un job SQL n-are cum să iasă pe HTTP.
 *
 * DE CE E SIGUR CU DOUĂ REPLICI
 * Nu ruta decide, ci baza: `push_ia_din_coada` ia rândurile cu
 * `for update skip locked`. A doua replică primește alt lot, sau niciunul.
 */
function secretPotrivit(antet: string | null): boolean {
  const asteptat = serverEnv.PUSH_CRON_SECRET;
  // Secret gol = ruta e OPRITĂ. O instalare fără secret nu livrează.
  if (asteptat === "") return false;
  if (antet === null) return false;

  const primit = antet.startsWith("Bearer ") ? antet.slice(7) : antet;
  const a = Buffer.from(primit);
  const b = Buffer.from(asteptat);
  // Lungimile întâi: `timingSafeEqual` ARUNCĂ pe buffere inegale, iar excepția
  // ar fi ea însăși un canal lateral (și un 500 în loc de 404).
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(cerere: Request): Promise<Response> {
  if (!secretPotrivit(cerere.headers.get("authorization"))) {
    // 404, nu 401: o rută de serviciu nu-și confirmă existența unui apelant fără
    // secret. Tiparul e cel din `api/reges/reconciliere`.
    return new Response("Not found", { status: 404 });
  }

  const db = createAdminSupabase();
  try {
    const raport = await golesteCoada(db);
    return Response.json(raport, { status: 200 });
  } catch (eroare) {
    const mesaj = eroare instanceof Error ? eroare.message : "Eroare necunoscută.";
    console.error("[push-livreaza]", mesaj);
    return Response.json({ ok: false, error: mesaj }, { status: 500 });
  }
}
