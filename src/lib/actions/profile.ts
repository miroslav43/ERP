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
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { BUCKET_AVATARE, caleAvatar, verificaAvatar } from "@/lib/avatar/cale";
import { createServerSupabase } from "@/lib/supabase/server";
import { schemaParolaNoua, schemaProfilPropriu } from "@/schemas/profile";
import { isPostgrestError, mapPostgrestError } from "./errors";
import type { ActionError, ActionResult } from "./types";

const esec = (error: ActionError): ActionResult<never> => ({ ok: false, error });

const RUTE_PROFIL_PROPRIU = ["/profil", "/portal/profilul-meu"] as const;

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

  for (const cale of RUTE_PROFIL_PROPRIU) revalidatePath(cale);
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

const schemaPregatireAvatar = z.object({
  numeFisier: z.string().min(1).max(255),
  dimensiune: z.number().int().positive(),
  mime: z.string().min(3).max(120),
});

/**
 * Pas 1/2 al încărcării propriei fotografii: doar pregătește URL-ul semnat.
 * Bytes-urile fișierului urcă direct din browser spre Storage (vezi
 * `getBrowserSupabase().storage...uploadToSignedUrl`), nu trec prin acțiune —
 * la fel ca la documentele de personal, ca să nu treacă imaginea prin server.
 */
export async function pregatesteIncarcareAvatarulPropriu(
  rawInput: unknown,
): Promise<ActionResult<{ cale: string; token: string }>> {
  const requestId = randomUUID();
  const user = await requireUser();

  const parsat = schemaPregatireAvatar.safeParse(rawInput);
  if (!parsat.success) {
    return esec({
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors: parsat.error.flatten().fieldErrors,
      requestId,
    });
  }

  const problema = verificaAvatar(parsat.data.mime, parsat.data.dimensiune);
  if (problema !== null) {
    return esec({ code: "VALIDARE", message: problema, fieldErrors: null, requestId });
  }

  const cale = caleAvatar(user.id, parsat.data.numeFisier);
  const db = await createServerSupabase();
  const { data, error } = await db.storage.from(BUCKET_AVATARE).createSignedUploadUrl(cale);
  if (error !== null || data === null) {
    return esec({
      code: "EROARE_INTERNA",
      message: `Nu am putut pregăti încărcarea fotografiei. Cod de referință: ${requestId}`,
      fieldErrors: null,
      requestId,
    });
  }

  return { ok: true, data: { cale, token: data.token } };
}

const schemaSalveazaAvatar = z.object({ cale: z.string().min(1).max(400) });

/** Pas 2/2: fișierul e deja în Storage — doar reține calea pe profil. */
export async function salveazaAvatarulPropriu(rawInput: unknown): Promise<ActionResult<null>> {
  const requestId = randomUUID();
  const user = await requireUser();

  const parsat = schemaSalveazaAvatar.safeParse(rawInput);
  if (!parsat.success || !parsat.data.cale.startsWith(`${user.id}/`)) {
    return esec({
      code: "VALIDARE",
      message: "Calea fișierului nu este validă.",
      fieldErrors: null,
      requestId,
    });
  }

  const db = await createServerSupabase();
  const { error } = await db
    .from("profiles")
    .update({ avatar_path: parsat.data.cale })
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

  for (const cale of RUTE_PROFIL_PROPRIU) revalidatePath(cale);
  return { ok: true, data: null };
}
