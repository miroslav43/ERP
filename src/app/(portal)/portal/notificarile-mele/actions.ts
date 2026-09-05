// src/app/(portal)/portal/notificarile-mele/actions.ts
// Retragerea unui telefon din lista celor care primesc notificări.
//
// NU trece prin `createAction`, din aceleași motive ca
// `(app)/notificari/actions.ts`: notificările nu țin de niciun modul și de
// nicio permisiune din `role_permissions` — dreptul e „e al tău", impus de
// `dispozitive_push_update using (user_id = auth.uid())` (0122). Acțiunea
// adaugă autentificare și validare Zod peste RLS, atât.
//
// ── DE CE EXISTĂ FIȘIERUL ĂSTA ────────────────────────────────────────────
// `DELETE /api/dispozitive` face exact retragerea asta, dar cere JETONUL, iar
// jetonul îl are numai aplicația, nu pagina. Până la 2026-09-04 ruta n-avea
// NICIUN apelant: omul își putea porni notificările (aplicația le înregistrează
// singură la prima deschidere) și nu le mai putea opri de nicăieri. Un
// consimțământ care nu se poate retrage nu e consimțământ.
//
// Aici se lucrează pe `id`, nu pe jeton, deliberat: un jeton Expo e o
// CAPACITATE — cine îl are poate trimite notificări pe acel telefon prin
// exp.host, fără nicio autentificare. Randat într-o pagină, ar sta în
// view-source, în istoricul browserului și în orice extensie. `id` e un UUID
// opac, care nu poate face nimic în afara sesiunii proprietarului.
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { createServerSupabase } from "@/lib/supabase/server";
import { isPostgrestError, mapPostgrestError } from "@/lib/actions/errors";
import type { ActionError, ActionResult } from "@/lib/actions/types";

const esec = (error: ActionError): ActionResult<never> => ({ ok: false, error });

const schemaId = z.object({ id: z.uuid("Dispozitivul selectat nu este valid.") });

export async function retrageDispozitivul(rawInput: unknown): Promise<ActionResult<null>> {
  const requestId = randomUUID();
  const user = await requireUser();

  const parsat = schemaId.safeParse(rawInput);
  if (!parsat.success) {
    return esec({
      code: "VALIDARE",
      message: "Dispozitivul selectat nu este valid.",
      fieldErrors: z.flattenError(parsat.error).fieldErrors,
      requestId,
    });
  }

  const db = await createServerSupabase();
  // `deleted_at`, nu DELETE: `dispozitive_push` n-are politică DELETE, prin
  // proiectare, iar jurnalul trebuie să poată spune de ce a încetat omul să
  // primească notificări. Triggerul generic de audit scrie rândul, cu
  // `actor_id = auth.uid()` — aici chiar EXISTĂ un actor uman, spre deosebire
  // de retragerea din `coada.ts`, unde Expo confirmă un telefon mort.
  //
  // Filtrul pe `user_id` e explicit, deși RLS îl impune: ca peste tot în
  // proiect, codul nu se sprijină exclusiv pe politică.
  //
  // Fără `.select()` și fără eroare pe zero rânduri: al doilea clic pe același
  // buton (sau retragerea făcută între timp de `golesteCoada`, la un bilet
  // `DeviceNotRegistered`) nu atinge niciun rând — ceea ce e rezultatul
  // corect, nu un conflict. Aceeași alegere ca la „marchează citit".
  const { error } = await db
    .from("dispozitive_push")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", parsat.data.id)
    .eq("user_id", user.id)
    .is("deleted_at", null);

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

  // Livrările deja puse în coadă pentru telefonul ăsta nu se ating aici: le
  // curăță Pasul 1 din `push_ia_din_coada` (0122), care scoate orice rând al
  // cărui dispozitiv a fost retras, pe oricare din cele două căi de retragere.
  revalidatePath("/portal/notificarile-mele");
  return { ok: true, data: null };
}

/** Formularul din pagină leagă direct la `action`, care cere `Promise<void>`. */
export async function trimiteRetragereDispozitiv(formData: FormData): Promise<void> {
  await retrageDispozitivul({ id: formData.get("id") });
}

/**
 * Toate felurile de notificare din `public.notification_kind` (`0001:89-91`).
 *
 * Enumerate explicit, nu citite din bază: `notification_preferences` are un rând
 * PE FEL, iar „oprește notificările pe telefon" înseamnă toate. Dacă cineva
 * adaugă un fel nou în enum și uită lista asta, felul nou rămâne PORNIT — de
 * aceea există `preferinte-feluri.test.ts`, care compară lista cu tipul generat
 * și cade la prima divergență.
 */
export const FELURI_NOTIFICARE = [
  "info",
  "success",
  "warning",
  "error",
  "task",
  "reminder",
  "approval",
  "announcement",
] as const;

const schemaComutare = z.object({
  pornit: z.boolean(),
  organizationId: z.uuid("Organizația selectată nu este validă."),
});

/**
 * Pornește sau oprește notificările push, DURABIL.
 *
 * ── DE CE NU E DE-AJUNS RETRAGEREA DISPOZITIVULUI ─────────────────────────
 * `inregistrat` din `mobil/App.tsx:302` e un `useRef`: se pierde la fiecare
 * pornire a aplicației, deci telefonul își reînregistrează jetonul de fiecare
 * dată. Retragerea singură ține exact până la următoarea deschidere. Coloana
 * asta e cea pe care o citește triggerul `internal.push_pune_in_coada`
 * (`0122:146-152`), înainte să pună ceva în coadă — deci e singurul „nu" care
 * rezistă.
 *
 * ── DE CE NU `.upsert()` ──────────────────────────────────────────────────
 * `notification_preferences_uq` e un index unic PARȚIAL
 * (`where deleted_at is null`, `0001:414-415`). PostgREST cere o constrângere
 * unică reală pentru `ON CONFLICT`; pe un index parțial răspunde 42P10, „there
 * is no unique or exclusion constraint matching the ON CONFLICT specification".
 * Capcană cunoscută a proiectului — de-aia se citește întâi și se scrie apoi,
 * exact ca la jetoane în `api/dispozitive/route.ts`.
 */
export async function comutaNotificarilePush(
  rawInput: unknown,
): Promise<ActionResult<{ pornit: boolean }>> {
  const requestId = randomUUID();
  const user = await requireUser();

  const parsat = schemaComutare.safeParse(rawInput);
  if (!parsat.success) {
    return esec({
      code: "VALIDARE",
      message: "Cererea nu este validă.",
      fieldErrors: z.flattenError(parsat.error).fieldErrors,
      requestId,
    });
  }
  const { pornit, organizationId } = parsat.data;

  const db = await createServerSupabase();
  const intern = (error: unknown): ActionResult<never> =>
    esec(
      isPostgrestError(error)
        ? mapPostgrestError(error, requestId)
        : {
            code: "EROARE_INTERNA",
            message: `A apărut o eroare neașteptată. Cod de referință: ${requestId}`,
            fieldErrors: null,
            requestId,
          },
    );

  const { data: existente, error: eroareCitire } = await db
    .from("notification_preferences")
    .select("kind")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  if (eroareCitire !== null) return intern(eroareCitire);

  const cunoscute = new Set((existente ?? []).map((r) => r.kind));
  const lipsa = FELURI_NOTIFICARE.filter((fel) => !cunoscute.has(fel));

  if (cunoscute.size > 0) {
    const { error } = await db
      .from("notification_preferences")
      .update({ push: pornit })
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null);
    if (error !== null) return intern(error);
  }

  if (lipsa.length > 0) {
    // `in_app` și `email` primesc implicitele coloanei (true / false): rândul
    // se naște aici doar ca să poarte `push`, nu ca să decidă în locul omului
    // pe canalele pe care n-a fost întrebat.
    const { error } = await db.from("notification_preferences").insert(
      lipsa.map((fel) => ({
        user_id: user.id,
        organization_id: organizationId,
        kind: fel,
        push: pornit,
      })),
    );
    if (error !== null) return intern(error);
  }

  revalidatePath("/portal/notificarile-mele");
  return { ok: true, data: { pornit } };
}

/** Formularul din pagină leagă direct la `action`, care cere `Promise<void>`. */
export async function trimiteComutarePush(formData: FormData): Promise<void> {
  await comutaNotificarilePush({
    pornit: formData.get("pornit") === "1",
    organizationId: formData.get("organizationId"),
  });
}
