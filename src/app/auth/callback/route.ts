// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/config/env";
import { POARTA_PORTAL_ACTIVA, rutaDupaAutentificare } from "@/config/routes";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { isAppRole } from "@/lib/tenant/types";
import { createServerSupabase } from "@/lib/supabase/server";
import { caleInterna } from "@/schemas/auth";

export const dynamic = "force-dynamic";

/**
 * Schimbă codul PKCE pe o sesiune și duce utilizatorul mai departe.
 *
 * Baza redirecționărilor este `NEXT_PUBLIC_APP_URL`, NU `request.url`: antetul
 * `Host` este controlat de client, deci ar permite fabricarea unei origini.
 * `next` este validat ca fiind cale internă — `//evil.com` este URL absolut.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const baza = clientEnv.NEXT_PUBLIC_APP_URL;
  const next = caleInterna(url.searchParams.get("next"));

  if (url.searchParams.get("error") !== null) {
    return NextResponse.redirect(new URL("/autentificare?eroare=link", baza));
  }

  const code = url.searchParams.get("code");
  if (code === null || code.length === 0 || code.length > 512) {
    return NextResponse.redirect(new URL("/autentificare?eroare=link", baza));
  }

  const supabase = await createServerSupabase();
  const { data: sesiune, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/autentificare?eroare=link", baza));
  }

  // `next` explicit înseamnă link profund (invitație, resetare de parolă) și se
  // respectă. `caleInterna` întoarce "/" când parametrul lipsește — exact cazul
  // în care avem voie să decidem noi destinația.
  if (next !== "/") {
    return NextResponse.redirect(new URL(next, baza));
  }

  // Clientul de sesiune, nu service_role. Filtrul pe `user_id` NU e redundant cu
  // RLS: politicile lasă un administrator de platformă să citească apartenențele
  // tuturor, deci fără el numărătoarea ar fi a întregii platforme, iar rolul citit
  // ar fi al altcuiva.
  const [estePlatformAdmin, apartenente] = await Promise.all([
    isPlatformAdmin(),
    supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", sesiune.user.id)
      .eq("status", "active")
      .is("deleted_at", null)
      // Doi ajunge: unul înseamnă „știm rolul", doi sau mai mulți înseamnă „decide
      // ecranul de alegere". Câți sunt peste doi nu schimbă nimic.
      .limit(2),
  ]);

  const randuri = apartenente.data ?? [];
  const singura = randuri.length === 1 ? randuri[0] : undefined;

  const destinatie = rutaDupaAutentificare({
    estePlatformAdmin,
    areOrganizatii: randuri.length > 0,
    // Cu două sau mai multe apartenențe, organizația activă o stabilește
    // `resolveTenant()` din cookie-ul-hint sau ecranul de alegere — deci rolul
    // de aici ar fi o presupunere.
    // Ramura de portal se aprinde odată cu `POARTA_PORTAL_ACTIVA`. Cât timp e
    // stinsă, angajatul aterizează unde a aterizat dintotdeauna: portalul încă
    // nu acoperă tot ce poate face în aplicația mare, iar a-l trimite acolo mai
    // devreme i-ar lua cererea de concediu fără să-i dea nimic în schimb.
    // `rutaDupaAutentificare` rămâne pură și testată pe ambele ramuri —
    // comutatorul stă la apelant, nu în ea.
    rol:
      POARTA_PORTAL_ACTIVA && singura !== undefined && isAppRole(singura.role)
        ? singura.role
        : null,
  });

  return NextResponse.redirect(new URL(destinatie, baza));
}
