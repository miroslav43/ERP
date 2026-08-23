import { NextResponse } from "next/server";

import { esteTermenDepasit, fetchCuTermen, TERMEN_SONDA_MS } from "@/lib/supabase/fetch-cu-termen";

/**
 * Sondă de DISPONIBILITATE (readiness), perechea lui `/healthz`.
 *
 * `/healthz` răspunde din cache static și nu atinge nimic. E corect pentru ce a
 * fost gândit — poarta de promovare a unei replici noi la `start-first` — dar pe
 * 23 august 2026 a răspuns 200 douăsprezece minute la rând, timp în care
 * aplicația returna 504 la fiecare cerere reală. Swarm n-a repornit nimic;
 * replicile blocate au dispărut abia când le-a înlocuit un deploy manual.
 *
 * Ruta asta acoperă golul: face un apel de rețea ADEVĂRAT către Supabase, cu
 * termen scurt, și măsoară întârzierea buclei de evenimente.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * REGULA CARE FACE SONDA UTILIZABILĂ ÎN PRODUCȚIE
 *
 * Eșuează DOAR când apelul nu se mai întoarce — semnătura exactă a blocajului.
 * Dacă Supabase răspunde 500, sau refuză conexiunea, sonda întoarce tot 200:
 * asta e o pană la ei, iar a omorî replici sănătoase în timpul unei pene
 * externe transformă o degradare într-o oprire totală. Distincția e exact
 * motivul pentru care `fetch-cu-termen.ts` aruncă un tip propriu de eroare în
 * loc de un `DOMException` generic.
 *
 * Cu `retries: 6` la `interval: 10s` din `docker-stack.yml`, o replică trebuie
 * să tacă un minut întreg înainte să fie declarată moartă.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Exclusă din matcher-ul din `src/proxy.ts` (ca `/healthz`) și întoarsă 404 de
 * nginx: e diagnostic intern, nu are ce căuta public.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Deliberat din `process.env`, nu din `@/config/env`: acela validează la import
 * ȘI secretele de server. O cheie de criptare lipsă ar face sonda să arunce, iar
 * Swarm ar reporni la nesfârșit o replică al cărei singur defect e o variabilă
 * de mediu — exact genul de buclă pe care o sondă trebuie să o evite.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Peste atât, bucla de evenimente e blocată, nu doar încărcată. */
const PRAG_INTARZIERE_BUCLA_MS = 2_000;

/** Cât așteptăm intenționat, ca să măsurăm întârzierea peste valoarea cerută. */
const SOMN_DE_CONTROL_MS = 50;

type Verdict = Readonly<{
  stare: "ok" | "blocat";
  supabase: "raspunde" | "eroare-retea" | "fara-raspuns";
  supabaseMs: number;
  intarziereBuclaMs: number;
  motiv?: string;
}>;

async function masoaraIntarziereaBuclei(): Promise<number> {
  const inceput = performance.now();
  await new Promise((rezolva) => setTimeout(rezolva, SOMN_DE_CONTROL_MS));
  return Math.max(0, Math.round(performance.now() - inceput - SOMN_DE_CONTROL_MS));
}

async function sondeazaSupabase(): Promise<Pick<Verdict, "supabase" | "supabaseMs">> {
  if (SUPABASE_URL === "") {
    // Fără URL nu există ce sonda; nu e blocaj, deci nu omorâm replica.
    return { supabase: "eroare-retea", supabaseMs: 0 };
  }

  const inceput = performance.now();
  try {
    // `/auth/v1/health` fără cheie întoarce 401 — perfect: ne interesează dacă
    // vine UN răspuns, nu care e conținutul lui.
    await fetchCuTermen(TERMEN_SONDA_MS)(`${SUPABASE_URL}/auth/v1/health`, {
      cache: "no-store",
    });
    return { supabase: "raspunde", supabaseMs: Math.round(performance.now() - inceput) };
  } catch (eroare) {
    const durata = Math.round(performance.now() - inceput);
    // Termenul depășit = apelul nu s-a mai întors. Orice altă eroare de rețea
    // înseamnă că procesul ȘTIE să iasă în exterior, doar că nu are cu cine
    // vorbi — o pană la Supabase, nu un defect al replicii.
    return {
      supabase: esteTermenDepasit(eroare) ? "fara-raspuns" : "eroare-retea",
      supabaseMs: durata,
    };
  }
}

export async function GET(): Promise<NextResponse<Verdict>> {
  const [supabase, intarziereBuclaMs] = await Promise.all([
    sondeazaSupabase(),
    masoaraIntarziereaBuclei(),
  ]);

  const buclaBlocata = intarziereBuclaMs > PRAG_INTARZIERE_BUCLA_MS;
  const supabaseTace = supabase.supabase === "fara-raspuns";

  const motiv = supabaseTace
    ? `Supabase nu a răspuns în ${TERMEN_SONDA_MS} ms.`
    : buclaBlocata
      ? `Bucla de evenimente întârzie cu ${intarziereBuclaMs} ms.`
      : undefined;

  const verdict: Verdict = {
    stare: motiv === undefined ? "ok" : "blocat",
    ...supabase,
    intarziereBuclaMs,
    ...(motiv === undefined ? {} : { motiv }),
  };

  return NextResponse.json(verdict, {
    status: verdict.stare === "ok" ? 200 : 503,
    // Un 200 cache-uit de oriunde ar face sonda oarbă exact când contează.
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
