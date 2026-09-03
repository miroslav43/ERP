// src/lib/auth/current-user.ts
import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";
import type { AuthUser } from "@/lib/tenant/types";

/**
 * Singurul loc din aplicație care întreabă „cine e utilizatorul?”.
 * Memoizat cu `React.cache()`: apelat de N ori într-un render, face un singur
 * drum — iar de la trecerea la `getClaims()`, de cele mai multe ori niciunul.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createServerSupabase();

  // getClaims(), nu getUser(). AMÂNDOUĂ sunt de încredere pe server; diferă
  // unde se face verificarea. getUser() întreabă GoTrue peste rețea — ~90 ms de
  // pe VM, plătiți la FIECARE randare. getClaims() verifică semnătura ES256
  // local, cu JWKS-ul cache-uit la nivel de modul (TTL 10 min): 1,7 ms măsurat.
  //
  // Nu slăbește nicio graniță reală. PostgREST verifică și el tot local, cu
  // același JWKS, deci baza accepta oricum același token până la `exp`; iar
  // apartenența la firmă și permisiunile se citesc din bază la fiecare cerere,
  // deci o excludere sau o permisiune retrasă se aplică imediat. Ce se lățește
  // e strict fereastra pentru un cont BLOCAT în GoTrue: până la expirarea
  // access-tokenului. Decizie explicită, luată în specul de latență.
  //
  // FĂRĂ ARGUMENT, deliberat: `getClaims(token)` sare complet peste
  // `getSession()` (GoTrueClient.js:5320-5326) și pierde reînnoirea automată a
  // sesiunii. Nu pasa niciodată jwt-ul.
  const { data, error } = await supabase.auth.getClaims();

  // TREI variante de retur, nu două. A treia — `{ data: null, error: null }` —
  // e vizitatorul fără sesiune, și e singura pe care o gardă scrisă doar pe
  // `error` o lasă să treacă spre un TypeError.
  if (error !== null || data === null) return null;

  const claims = data.claims;

  // `user_metadata` e `{ [key: string]: any }`. Anotarea `unknown` nu e stil:
  // e singurul lucru care ține `any` afară din tipul dedus, iar regulile ESLint
  // tipate (`no-unsafe-*`) nu sunt pornite în acest proiect.
  const numeBrut: unknown = claims.user_metadata?.["full_name"];
  const nume = typeof numeBrut === "string" ? numeBrut.trim() : "";

  return {
    id: claims.sub,
    // `email` e opțional în JwtPayload (types.d.ts:1679), iar `AuthUser.email`
    // e `string`. Conturile fără e-mail nu sunt suportate în Faza 1a (vezi
    // `internal.handle_new_user`), dar tipul le permite.
    email: claims.email ?? "",
    fullName: nume.length > 0 ? nume : null,
  };
});

/** Pentru pagini/layout-uri RSC. În Server Actions se folosește `resolveTenant()`. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (user === null) redirect("/autentificare");
  return user;
}
