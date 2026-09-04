// src/app/api/reges/reconciliere/route.ts
import { timingSafeEqual } from "node:crypto";
import { hostname } from "node:os";

import { serverEnv } from "@/config/env";
import { ruleazaCiclu } from "@/lib/reges/reconciliere";
// ⚠ OCOLEȘTE COMPLET RLS. Ciclul rulează fără niciun utilizator autentificat, pe
// toate firmele-client deodată: nu există sesiune din care RLS să deducă
// organizația. Izolarea o dau interogările din `lib/reges/*`, care filtrează
// EXPLICIT pe `organization_id`, luat din lista de firme cu REGES activ.
// `reges_credentiale` n-are oricum nicio politică — e închisă și pentru
// utilizatorii autentificați.
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pornește un ciclu de reconciliere REGES.
 *
 * CINE O CHEAMĂ
 * Un systemd timer de pe VM, la câteva minute —
 * `deploy/reges-reconciliere.service`, care e sursa de adevăr pentru comandă:
 *
 *   printf 'oauth2-bearer = %s\n' "$REGES_CRON_SECRET" \
 *     | curl -sS -K - --resolve administrativo.ro:443:127.0.0.1 \
 *            -X POST https://administrativo.ro/api/reges/reconciliere
 *
 * NU cu `-H "Authorization: Bearer $REGES_CRON_SECRET"`, cum scria aici până la
 * 2026-09-04: shell-ul substituie variabila înainte de `exec`, deci secretul
 * ajunge în argv-ul lui `curl` și în `/proc/<pid>/cmdline`, lizibil de orice
 * utilizator local. `-K -` îl trece prin pipe. Antetul produs e identic, deci
 * `secretPotrivit` de mai jos nu se schimbă.
 *
 * DE CE NU `pg_cron`
 * Proiectul are deja pg_cron și trei joburi pe el, dar acelea rulează PL/pgSQL
 * în interiorul Postgres-ului. Ciclul REGES trebuie să iasă pe HTTP către
 * Inspecția Muncii, iar `pg_net` nu e activat pe instanța noastră. Un job SQL
 * n-are cum să facă apelul.
 *
 * DE CE E SIGUR CU DOUĂ REPLICI
 * Nu ruta decide, ci baza: `ruleazaCiclu` ia întâi o închiriere din
 * `reges_inchiriere`, printr-un `insert … on conflict … where expira_la < now()`
 * atomic. A doua replică — sau o a doua apăsare de buton — primește `false` și
 * se retrage. Fără asta, două cicluri ar consuma fiecare jumătate din coada
 * Inspecției Muncii și fiecare ar crede că le-a văzut pe toate.
 */
function secretPotrivit(antet: string | null): boolean {
  const asteptat = serverEnv.REGES_CRON_SECRET;
  // Secret gol = ruta e OPRITĂ. O instalare fără secret nu are ciclu deschis.
  if (asteptat === "") return false;
  if (antet === null) return false;

  const primit = antet.startsWith("Bearer ") ? antet.slice(7) : antet;
  const a = Buffer.from(primit);
  const b = Buffer.from(asteptat);
  // Comparație în timp constant, cu lungimile verificate întâi: `timingSafeEqual`
  // ARUNCĂ dacă bufferele diferă ca lungime, iar excepția ar fi ea însăși un
  // canal lateral (și un 500 în loc de 401).
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(cerere: Request): Promise<Response> {
  if (!secretPotrivit(cerere.headers.get("authorization"))) {
    // 404, nu 401: o rută de serviciu n-are de ce să-și confirme existența unui
    // apelant care n-are secretul.
    return new Response("Not found", { status: 404 });
  }

  const db = createAdminSupabase();
  const detinator = `${hostname()}:${process.pid}`;

  try {
    const raport = await ruleazaCiclu(db, detinator);
    if (!raport.rulat) {
      // 409, nu 500: „altcineva lucrează deja" e o stare normală, nu o pană.
      // Timerul o poate ignora în loc s-o raporteze ca eșec.
      return Response.json(raport, { status: 409 });
    }
    return Response.json(raport, { status: 200 });
  } catch (eroare) {
    console.error("[reges] ciclul de reconciliere a căzut", eroare);
    return Response.json(
      { rulat: false, motiv: "Ciclul de reconciliere a eșuat.", organizatii: [] },
      { status: 500 },
    );
  }
}
