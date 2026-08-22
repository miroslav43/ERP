// src/app/(app)/notificari/actions.ts
// NU trec prin `createAction`: notificările nu țin de niciun modul sau
// permisiune — dreptul de a le citi/marca e „e a ta", nu un rând din
// `role_permissions`. Sursa de adevăr rămâne RLS (`notifications_update
// using (user_id = auth.uid())`); acțiunea adaugă doar autentificare și
// validare Zod, la fel ca `lib/actions/profile.ts`.
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { isPostgrestError, mapPostgrestError } from "@/lib/actions/errors";
import type { ActionError, ActionResult } from "@/lib/actions/types";

const esec = (error: ActionError): ActionResult<never> => ({ ok: false, error });

const schemaId = z.object({ id: z.uuid("Notificarea selectată nu este validă.") });

/**
 * Ambele cutii poștale, nu doar cea din aplicația mare.
 *
 * Angajatul își citește notificările din `/portal/notificarile-mele`, iar
 * pastila de necitite trăiește în antetul portalului — deci și `/portal`. Fără
 * căile astea, omul marchează o notificare drept citită și o vede tot
 * nemarcată: nu e o eroare, e cache-ul de Router, iar tăcerea lui e exact
 * felul în care defectul trece de review.
 */
function reimprospateazaCutiaPostala(): void {
  revalidatePath("/notificari");
  revalidatePath("/portal/notificarile-mele");
  revalidatePath("/portal");
}

export async function marcheazaNotificareaCitita(rawInput: unknown): Promise<ActionResult<null>> {
  const requestId = randomUUID();
  const user = await requireUser();

  const parsat = schemaId.safeParse(rawInput);
  if (!parsat.success) {
    return esec({
      code: "VALIDARE",
      message: "Notificarea selectată nu este validă.",
      fieldErrors: z.flattenError(parsat.error).fieldErrors,
      requestId,
    });
  }

  const db = await createServerSupabase();
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsat.data.id)
    .eq("user_id", user.id)
    .is("read_at", null);

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

  reimprospateazaCutiaPostala();
  return { ok: true, data: null };
}

/** Formularul simplu din pagină leagă direct la `action`, care cere `Promise<void>`. */
export async function trimiteMarcheazaToateCitite(): Promise<void> {
  await marcheazaToateNotificarileCitite();
}

export async function marcheazaToateNotificarileCitite(): Promise<ActionResult<null>> {
  const requestId = randomUUID();
  const user = await requireUser();

  const db = await createServerSupabase();
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

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

  reimprospateazaCutiaPostala();
  return { ok: true, data: null };
}
