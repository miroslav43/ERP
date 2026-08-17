// src/app/(auth)/parola-noua/actions.ts
"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { parolaNouaSchema } from "@/schemas/auth";
import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";

export async function seteazaParolaNoua(formData: FormData): Promise<void> {
  const validat = parolaNouaSchema.safeParse({
    parola: formData.get("parola"),
    confirmare: formData.get("confirmare"),
  });
  if (!validat.success) {
    const primul = validat.error.issues[0];
    const cod = primul?.path[0] === "confirmare" ? "confirmare" : "parola";
    redirect(`/parola-noua?eroare=${cod}`);
  }

  const supabase = await createServerSupabase();

  // Sesiunea de recuperare a fost deja stabilită în /auth/callback. Fără ea,
  // `updateUser` ar schimba parola altcuiva dacă am accepta un identificator
  // din formular — de aceea utilizatorul nu se trimite niciodată din client.
  const { data: sesiune } = await supabase.auth.getUser();
  if (!sesiune.user) redirect("/autentificare?eroare=sesiune");

  const { error } = await supabase.auth.updateUser({ password: validat.data.parola });
  if (error) redirect("/parola-noua?eroare=refuzata");

  redirect(RUTA_DUPA_AUTENTIFICARE);
}
