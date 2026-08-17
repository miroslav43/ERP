// src/app/(auth)/invitatie/[token]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientEnv } from "@/config/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { signTenantCookie } from "@/lib/tenant/tenant-cookie";
import { TENANT_COOKIE } from "@/lib/tenant/tenant-cookie";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { emailSchema, tokenInvitatieSchema } from "@/schemas/auth";
import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";

const rezultatAcceptare = z.object({
  organization_id: z.uuid(),
  organization_name: z.string().min(1),
});

async function ipClient(): Promise<string> {
  const antet = await headers();
  return antet.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "necunoscut";
}

/**
 * Trimite un link de autentificare pe adresa introdusă.
 *
 * Aici — și DOAR aici — `shouldCreateUser` este `true`: destinatarul unei
 * invitații nu are încă un cont. Nu este self-signup: contul nou nu primește
 * nicio apartenență, iar `accept_invitation` compară adresa confirmată cu cea
 * din invitație. Un e-mail greșit produce un cont fără acces la nimic.
 */
export async function trimiteLinkInvitatie(formData: FormData): Promise<void> {
  const token = tokenInvitatieSchema.safeParse(formData.get("token"));
  if (!token.success) redirect("/autentificare?eroare=link");

  const email = emailSchema.safeParse(formData.get("email"));
  const catre = `/invitatie/${token.data}`;
  if (!email.success) redirect(`${catre}?eroare=email`);

  const limita = await consumeRateLimit({
    key: `invitatie-otp:ip:${await ipClient()}`,
    limit: 10,
    windowSeconds: 900,
  });
  if (!limita.allowed) redirect(`${catre}?eroare=limita`);

  const supabase = await createServerSupabase();
  await supabase.auth.signInWithOtp({
    email: email.data,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(catre)}`,
    },
  });

  redirect(`${catre}?stare=link-trimis`);
}

export async function acceptaInvitatia(formData: FormData): Promise<void> {
  const token = tokenInvitatieSchema.safeParse(formData.get("token"));
  if (!token.success) redirect("/autentificare?eroare=link");
  const catre = `/invitatie/${token.data}`;

  const supabase = await createServerSupabase();
  const { data: sesiune } = await supabase.auth.getUser();
  if (!sesiune.user) redirect(`${catre}?eroare=sesiune`);

  const limita = await consumeRateLimit({
    key: `invitatie-accept:user:${sesiune.user.id}`,
    limit: 10,
    windowSeconds: 900,
  });
  if (!limita.allowed) redirect(`${catre}?eroare=limita`);

  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token.data });
  if (error) {
    // Singura distincție utilă pentru cineva care deține deja tokenul.
    const cod = /EMAIL/i.test(error.message) ? "alta-adresa" : "invalida";
    redirect(`${catre}?eroare=${cod}`);
  }

  const rezultat = rezultatAcceptare.safeParse(data);
  if (!rezultat.success) redirect(`${catre}?eroare=invalida`);

  (await cookies()).set(TENANT_COOKIE, signTenantCookie(rezultat.data.organization_id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
  redirect(RUTA_DUPA_AUTENTIFICARE);
}
