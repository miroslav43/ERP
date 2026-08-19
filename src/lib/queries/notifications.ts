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

const LIMITA_LISTA = 100;

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
    .limit(LIMITA_LISTA)
    .returns<RandNotificare[]>();
  if (error !== null) throw error;
  return data ?? [];
}
