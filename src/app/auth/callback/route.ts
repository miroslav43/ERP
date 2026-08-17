// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/config/env";
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

  return NextResponse.redirect(new URL(next, baza));
}
