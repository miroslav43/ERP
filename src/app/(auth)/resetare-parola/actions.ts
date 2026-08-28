// src/app/(auth)/resetare-parola/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendEmail } from "@/lib/email/send";
import { createAdminSupabase } from "@/lib/supabase/admin";
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

  /*
   * ── DE CE NU MAI FOLOSIM `resetPasswordForEmail` ──────────────────────────
   * Aceea lasă Supabase să trimită mesajul: șablon implicit în engleză, fără
   * nimic din firmă, iar linkul construit din `Site URL`-ul proiectului — care
   * arăta către `http://localhost:3000`. Utilizatorul primea un link către
   * calculatorul altcuiva.
   *
   * `generateLink` produce același token, dar NU trimite nimic. E-mailul pleacă
   * prin Resend, cu șablonul care exista deja în proiect și pe care nu-l chema
   * nimeni, iar linkul se compune din `NEXT_PUBLIC_APP_URL`.
   *
   * `createAdminSupabase` e permis aici — fișier `actions.ts` — și e necesar:
   * `generateLink` e API de administrare. Nu ocolim nicio politică RLS; singura
   * atingere de date e citirea numelui, filtrată pe `id`-ul utilizatorului.
   */
  const admin = createAdminSupabase();
  const link = await admin.auth.admin.generateLink({
    type: "recovery",
    email: validat.data.email,
  });

  // Un cont inexistent produce eroare. NU se comunică: mesajul și durata rămân
  // identice, altfel formularul devine un detector de conturi.
  if (link.error === null && link.data.user !== null) {
    const { data: profil } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", link.data.user.id)
      .maybeSingle();

    await sendEmail({
      db: admin,
      to: validat.data.email,
      entityId: link.data.user.id,
      template: "resetare-parola",
      data: {
        nume: profil?.full_name ?? "",
        tokenHash: link.data.properties.hashed_token,
        valabilMinute: 60,
      },
    });
  }

  // Același mesaj și același timp, cont existent sau nu.
  await asteapta();
  redirect("/resetare-parola?stare=trimis");
}
