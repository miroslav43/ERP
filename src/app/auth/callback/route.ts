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

  const supabase = await createServerSupabase();

  /*
   * Două drumuri, fiindcă e-mailurile nu mai vin de la Supabase.
   *
   * `code` e drumul PKCE clasic, pentru linkurile pe care le trimitea mailerul
   * intern. `token_hash` + `type` e drumul e-mailurilor NOASTRE: acțiunea cere
   * `auth.admin.generateLink()`, care produce hash-ul FĂRĂ să trimită nimic,
   * iar șablonul îl împachetează într-un link pe domeniul aplicației. Aici se
   * schimbă pe o sesiune.
   *
   * Ambele rămân: linkurile deja plecate trebuie să funcționeze până expiră.
   */
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tip = url.searchParams.get("type");

  let sesiune: { user: { id: string } } | null = null;

  if (tokenHash !== null && tokenHash.length > 0 && tokenHash.length <= 512) {
    // Lista e închisă deliberat: `type` vine din URL, deci din mâna
    // utilizatorului. `email_change` și `invite` nu au drum în aplicație.
    const tipuri = ["magiclink", "recovery", "email", "signup"] as const;
    const tipVerificat = (tipuri as readonly string[]).includes(tip ?? "")
      ? (tip as (typeof tipuri)[number])
      : null;
    if (tipVerificat === null) {
      return NextResponse.redirect(new URL("/autentificare?eroare=link", baza));
    }
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tipVerificat,
    });
    if (error || data.user === null) {
      return NextResponse.redirect(new URL("/autentificare?eroare=link", baza));
    }
    sesiune = { user: { id: data.user.id } };
  } else {
    if (code === null || code.length === 0 || code.length > 512) {
      return NextResponse.redirect(new URL("/autentificare?eroare=link", baza));
    }
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/autentificare?eroare=link", baza));
    }
    sesiune = { user: { id: data.user.id } };
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
