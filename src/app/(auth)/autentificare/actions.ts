// src/app/(auth)/autentificare/actions.ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendEmail } from "@/lib/email/send";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { autentificareSchema, caleInterna, linkMagicSchema } from "@/schemas/auth";

/**
 * Prag de timp identic pentru TOATE răspunsurile de autentificare.
 * Fără el, „e-mail inexistent" răspunde măsurabil mai repede decât „parolă
 * greșită", iar formularul devine un oracol de enumerare a conturilor.
 */
const DURATA_MINIMA_MS = 700;

async function raspunsUniform(inceput: number): Promise<void> {
  const ramas = DURATA_MINIMA_MS - (Date.now() - inceput);
  if (ramas > 0) await new Promise((rezolva) => setTimeout(rezolva, ramas));
}

async function ipClient(): Promise<string> {
  const antet = await headers();
  return antet.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "necunoscut";
}

function inapoi(cod: string, catre: string): string {
  const parametri = new URLSearchParams({ eroare: cod });
  if (catre !== "/") parametri.set("redirect", catre);
  return `/autentificare?${parametri.toString()}`;
}

/** Limitare pe IP ȘI pe identificator: una singură se ocolește trivial. */
async function limitaAtinsa(actiune: string, email: string): Promise<boolean> {
  const ip = await ipClient();
  const rezultate = await Promise.all([
    consumeRateLimit({ key: `${actiune}:ip:${ip}`, limit: 20, windowSeconds: 900 }),
    consumeRateLimit({ key: `${actiune}:cont:${email}`, limit: 5, windowSeconds: 900 }),
  ]);
  return rezultate.some((r) => !r.allowed);
}

export async function autentificarePrinParola(formData: FormData): Promise<void> {
  const inceput = Date.now();
  const catre = caleInterna(formData.get("redirect"));

  const validat = autentificareSchema.safeParse({
    email: formData.get("email"),
    parola: formData.get("parola"),
  });
  if (!validat.success) {
    await raspunsUniform(inceput);
    redirect(inapoi("date", catre));
  }

  if (await limitaAtinsa("login", validat.data.email)) {
    await raspunsUniform(inceput);
    redirect(inapoi("limita", catre));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: validat.data.email,
    password: validat.data.parola,
  });
  await raspunsUniform(inceput);

  // Mesaj IDENTIC pentru „cont inexistent" și „parolă greșită".
  if (error) redirect(inapoi("credentiale", catre));
  redirect(catre);
}

export async function trimiteLinkMagic(formData: FormData): Promise<void> {
  const inceput = Date.now();
  const catre = caleInterna(formData.get("redirect"));

  const validat = linkMagicSchema.safeParse({ email: formData.get("email") });
  if (!validat.success) {
    await raspunsUniform(inceput);
    redirect(inapoi("email", catre));
  }
  if (await limitaAtinsa("magic", validat.data.email)) {
    await raspunsUniform(inceput);
    redirect(inapoi("limita", catre));
  }

  /*
   * `generateLink`, nu `signInWithOtp`: al doilea lasă Supabase să compună și
   * să trimită mesajul, din `Site URL`-ul proiectului — de acolo veneau
   * linkurile către `localhost:3000`. Primul produce doar tokenul; e-mailul îl
   * trimitem noi, prin Resend, cu link compus din `NEXT_PUBLIC_APP_URL`.
   *
   * `magiclink` (nu `signup`) păstrează regula de dinainte: linkul magic NU
   * creează conturi noi. Pentru o adresă fără cont, `generateLink` dă eroare —
   * pe care o înghițim, ca răspunsul să rămână identic.
   */
  const admin = createAdminSupabase();
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: validat.data.email,
  });

  if (link.error === null && link.data.user !== null) {
    await sendEmail({
      db: admin,
      to: validat.data.email,
      entityId: link.data.user.id,
      template: "link-magic",
      data: {
        tokenHash: link.data.properties.hashed_token,
        // `catre` a trecut deja prin `caleInterna`, deci nu poate fi absolut.
        next: catre,
        valabilMinute: 60,
      },
    });
  }

  // Răspuns identic indiferent dacă adresa există: rezultatul nu se comunică.
  await raspunsUniform(inceput);
  redirect("/autentificare?stare=link-trimis");
}
