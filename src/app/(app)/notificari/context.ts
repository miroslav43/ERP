// src/app/(app)/notificari/context.ts
import "server-only";

import type { ServerSupabase } from "@/lib/supabase/server";

import {
  CONTEXT_APLICATIE_GOL,
  type InrolareNotificata,
  type NotificareDeTradus,
  type SaptamanaNotificata,
} from "./legaturi";

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const TIPAR_CURS_PORTAL = new RegExp(`^/portal/cursurile-mele/(${UUID})$`, "u");
const TIPAR_ANUNT = new RegExp(`^/(?:portal/)?anunturi/(${UUID})$`, "u");
const TIPURI_SAPTAMANA = new Set([
  "attendance_week_submission",
  "attendance_week_submission_fara_pontaj",
]);

/**
 * Ce are nevoie `caleaInAplicatie` din bază, citit O DATĂ pentru tot lotul,
 * sub RLS (clientul serverului): săptămânile de pontaj din spatele
 * notificărilor, înrolările din linkurile de portal, anunțurile care se mai
 * văd. O citire picată nu oprește pagina: contextul iese gol, iar rândurile
 * respective rămân pe linkul lor de bază, trecut prin poartă.
 */
export async function contextAplicatie(
  db: ServerSupabase,
  organizationId: string,
  randuri: readonly NotificareDeTradus[],
): Promise<typeof CONTEXT_APLICATIE_GOL> {
  const idSaptamani = [
    ...new Set(
      randuri
        .filter((r) => r.entity_type !== null && TIPURI_SAPTAMANA.has(r.entity_type))
        .map((r) => r.entity_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const idInrolari = [
    ...new Set(
      randuri
        .map((r) => (r.link === null ? undefined : TIPAR_CURS_PORTAL.exec(r.link)?.[1]))
        .filter((id): id is string => id !== undefined),
    ),
  ];
  const idAnunturi = [
    ...new Set(
      randuri
        .map((r) => (r.link === null ? undefined : TIPAR_ANUNT.exec(r.link)?.[1]))
        .filter((id): id is string => id !== undefined),
    ),
  ];
  if (idSaptamani.length === 0 && idInrolari.length === 0 && idAnunturi.length === 0) {
    return CONTEXT_APLICATIE_GOL;
  }

  const [saptamani, inrolari, anunturi] = await Promise.all([
    idSaptamani.length === 0
      ? null
      : db
          .from("attendance_week_submissions")
          .select("id, saptamana_start, employee_id")
          .eq("organization_id", organizationId)
          .in("id", idSaptamani)
          .is("deleted_at", null),
    idInrolari.length === 0
      ? null
      : db
          .from("course_enrollments")
          .select("id, course_id, employee_id")
          .eq("organization_id", organizationId)
          .in("id", idInrolari)
          .is("deleted_at", null),
    idAnunturi.length === 0
      ? null
      : db
          .from("announcements")
          .select("id")
          .eq("organization_id", organizationId)
          .in("id", idAnunturi)
          .is("deleted_at", null),
  ]);
  for (const [nume, r] of [
    ["săptămânilor", saptamani],
    ["înrolărilor", inrolari],
    ["anunțurilor", anunturi],
  ] as const) {
    if (r?.error != null) {
      console.error(`[notificari] citirea ${nume} pentru legături a eșuat: ${r.error.message}.`);
    }
  }
  return {
    saptamani: new Map<string, SaptamanaNotificata>(
      (saptamani?.data ?? []).map((s) => [
        s.id,
        { saptamanaStart: s.saptamana_start, employeeId: s.employee_id },
      ]),
    ),
    inrolari: new Map<string, InrolareNotificata>(
      (inrolari?.data ?? []).map((i) => [
        i.id,
        { courseId: i.course_id, employeeId: i.employee_id },
      ]),
    ),
    anunturiVizibile: new Set((anunturi?.data ?? []).map((a) => a.id)),
  };
}
