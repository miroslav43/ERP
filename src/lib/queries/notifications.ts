// src/lib/queries/notifications.ts
// Notificările sunt strict per-utilizator — RLS (`notifications_select`,
// `user_id = auth.uid()`) e sursa de adevăr, nu un filtru reprodus aici.

import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type TipNotificare = Database["public"]["Enums"]["notification_kind"];

export interface RandNotificare {
  readonly id: string;
  readonly kind: TipNotificare;
  readonly title: string;
  readonly body: string | null;
  readonly link: string | null;
  readonly read_at: string | null;
  readonly created_at: string;
}

/**
 * Câte notificări aduce ecranul într-o pagină. Exportată fiindcă ecranul are
 * nevoie să ȘTIE unde s-a oprit: altfel `notificari.length` trece drept total
 * și lista tăcut tăiată devine „atât ai”.
 */
export const LIMITA_LISTA_NOTIFICARI = 100;

/**
 * Numărul de notificări necitite, pentru pastila din antet.
 *
 * A trăit ca funcție privată în `components/layout/topbar.tsx`. Odată cu
 * portalul, antetul lui are nevoie de exact aceeași cifră — iar o a doua copie
 * a aceleiași interogări e felul în care două antete ajung să afișeze numere
 * diferite după prima modificare.
 *
 * O eroare nu se propagă: pastila e un ornament, iar o excepție aici ar doborî
 * întregul antet — deci și navigarea. Zero e răspunsul corect când nu știm.
 */
export async function numaraNecitite(organizationId: string, userId: string): Promise<number> {
  const db = await createServerSupabase();
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("read_at", null);

  if (error !== null) {
    console.error("[notificari] Numărul de necitite nu a putut fi calculat", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function listeazaNotificarile(
  organizationId: string,
  userId: string,
): Promise<readonly RandNotificare[]> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(LIMITA_LISTA_NOTIFICARI)
    .returns<RandNotificare[]>();
  if (error !== null) throw error;
  return data ?? [];
}
