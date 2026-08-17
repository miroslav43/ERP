// src/app/(auth)/resetare-parola/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientEnv } from "@/config/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { resetareParolaSchema } from "@/schemas/auth";

const DURATA_MINIMA_MS = 700;

export async function cereResetareParola(formData: FormData): Promise<void> {
  const inceput = Date.now();
  const asteapta = async (): Promise<void> => {
    const ramas = DURATA_MINIMA_MS - (Date.now() - inceput);
    if (ramas > 0) await new Promise((rezolva) => setTimeout(rezolva, ramas));
  };

  const validat = resetareParolaSchema.safeParse({ email: formData.get("email") });
  if (!validat.success) {
    await asteapta();
    redirect("/resetare-parola?eroare=email");
  }

  const antet = await headers();
  const ip = antet.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "necunoscut";
  const limite = await Promise.all([
    consumeRateLimit({ key: `reset:ip:${ip}`, limit: 20, windowSeconds: 900 }),
    consumeRateLimit({ key: `reset:cont:${validat.data.email}`, limit: 3, windowSeconds: 900 }),
  ]);
  if (limite.some((l) => !l.allowed)) {
    await asteapta();
    redirect("/resetare-parola?eroare=limita");
  }

  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(validat.data.email, {
    redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=%2Fparola-noua`,
  });

  // Același mesaj și același timp, cont existent sau nu.
  await asteapta();
  redirect("/resetare-parola?stare=trimis");
}
