// src/lib/actions/profile.ts
"use server";
// Acțiunile pentru profilul propriu.
//
// NU trec prin `createAction`: acela cere organizație, modul și permisiune —
// niciuna nu are sens aici. `profiles` nu ține de nicio organizație, iar
// dreptul de a-l edita e „ești tu”, nu un rând din `role_permissions`. Sursa de
// adevăr rămâne RLS (`profiles_update using (id = auth.uid())`); acțiunea
// adaugă doar autentificare și validare Zod.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/current-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { schemaParolaNoua, schemaProfilPropriu } from "@/schemas/profile";
import { isPostgrestError, mapPostgrestError } from "./errors";
import type { ActionError, ActionResult } from "./types";

const esec = (error: ActionError): ActionResult<never> => ({ ok: false, error });

export async function actualizeazaProfilul(rawInput: unknown): Promise<ActionResult<null>> {
  const requestId = randomUUID();
  const user = await requireUser();

  const parsat = schemaProfilPropriu.safeParse(rawInput);
  if (!parsat.success) {
    return esec({
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors: parsat.error.flatten().fieldErrors,
      requestId,
    });
  }

  const db = await createServerSupabase();
  const { error } = await db
    .from("profiles")
    .update({ full_name: parsat.data.full_name, phone: parsat.data.phone })
    .eq("id", user.id);

  if (error !== null) {
    return esec(
      isPostgrestError(error)
        ? mapPostgrestError(error, requestId)
        : {
            code: "EROARE_INTERNA",
            message: `A apărut o eroare neașteptată. Cod de referință: ${requestId}`,
            fieldErrors: null,
            requestId,
          },
    );
  }

  revalidatePath("/profil");
  revalidatePath("/portal/profilul-meu");
  return { ok: true, data: null };
}

/**
 * Schimbarea parolei din cont, nu resetarea ei.
 *
 * `auth.updateUser` operează pe sesiunea curentă — a fost deja dovedită la
 * login, deci nu se mai cere parola veche. E același API pe care GoTrue îl
 * expune pentru „schimbă parola cât ești logat”, distinct de fluxul de
 * resetare prin e-mail din `(auth)/resetare-parola`.
 */
export async function schimbaParola(rawInput: unknown): Promise<ActionResult<null>> {
  const requestId = randomUUID();
  await requireUser();

  const parsat = schemaParolaNoua.safeParse(rawInput);
  if (!parsat.success) {
    return esec({
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors: parsat.error.flatten().fieldErrors,
      requestId,
    });
  }

  const db = await createServerSupabase();
  const { error } = await db.auth.updateUser({ password: parsat.data.parola_noua });

  if (error !== null) {
    return esec({
      code: "VALIDARE",
      message: "Parola nu a putut fi schimbată. Verificați cerințele de complexitate.",
      fieldErrors: null,
      requestId,
    });
  }

  return { ok: true, data: null };
}
