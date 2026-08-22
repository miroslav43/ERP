// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/config/env";
import { rutaDupaAutentificare } from "@/config/routes";
import { isPlatformAdmin } from "@/lib/auth/platform";
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
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/autentificare?eroare=link", baza));
  }

  // `next` explicit înseamnă link profund (invitație, resetare de parolă) și se
  // respectă. `caleInterna` întoarce "/" când parametrul lipsește — exact cazul
  // în care avem voie să decidem noi destinația.
  if (next !== "/") {
    return NextResponse.redirect(new URL(next, baza));
  }

  // Clientul de sesiune, nu service_role: RLS filtrează singură rândurile
  // utilizatorului curent, deci nu e nevoie de `.eq("user_id", ...)` și nu
  // ocolim nimic.
  const [estePlatformAdmin, apartenente] = await Promise.all([
    isPlatformAdmin(),
    supabase
      .from("organization_members")
      .select("organization_id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const destinatie = rutaDupaAutentificare({
    estePlatformAdmin,
    areOrganizatii: (apartenente.count ?? 0) > 0,
  });

  return NextResponse.redirect(new URL(destinatie, baza));
}
