// src/app/(app)/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { signTenantCookie } from "@/lib/tenant/tenant-cookie";
import { TENANT_COOKIE } from "@/lib/tenant/tenant-cookie";

/**
 * Comutatorul de organizație. Cookie-ul se scrie DUPĂ validarea apartenenței:
 * el rămâne un hint neîncrezut, dar nu are rost să scriem unul despre care
 * știm deja că e greșit. Filtrul `eq` nu este autorizare — RLS decide.
 */
export async function switchOrganization(formData: FormData): Promise<void> {
  const validat = z.uuid().safeParse(formData.get("organizationId"));
  if (!validat.success) redirect("/alege-organizatia?eroare=acces");

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", validat.data)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) redirect("/alege-organizatia?eroare=acces");

  (await cookies()).set(TENANT_COOKIE, signTenantCookie(validat.data), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  (await cookies()).delete(TENANT_COOKIE);
  revalidatePath("/", "layout");
  redirect("/autentificare");
}
