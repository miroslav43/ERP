// src/app/(platform)/super-admin/organizatii/[orgId]/module/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import type { ActionResult } from "@/lib/actions/types";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

import {
  campuriInvalide,
  doarCampuri,
  esuat,
  idCerere,
  reusit,
  scrieAudit,
  traduEroareBd,
} from "../../../_lib/platform";

/**
 * `organizationId` provine din segmentul de rută al panoului de super-admin.
 * Dreptul de a-l folosi NU vine din valoarea trimisă, ci din
 * `requirePlatformAdmin()` + existența organizației (S1, S2).
 */
const schemaComutare = z.object({
  organizationId: z.uuid({ error: "Organizație invalidă." }),
  featureKey: z
    .string({ error: "Modul invalid." })
    .min(1, { error: "Modul invalid." })
    .max(64, { error: "Modul invalid." }),
  enabled: z.boolean({ error: "Valoare invalidă pentru comutator." }),
});

const CAMPURI_AUDIT = ["feature_key", "enabled"] as const;

export type RezultatComutare = Readonly<{
  featureKey: string;
  enabled: boolean;
  schimbat: boolean;
  mesaj: string;
}>;

export async function comutaModul(raw: unknown): Promise<ActionResult<RezultatComutare>> {
  const requestId = idCerere();

  const parsare = schemaComutare.safeParse(raw);
  if (!parsare.success) {
    return esuat(
      "VALIDARE",
      "Datele trimise nu sunt valide.",
      requestId,
      campuriInvalide(z.flattenError(parsare.error).fieldErrors),
    );
  }
  const input = parsare.data;

  const actor = await requirePlatformAdmin().catch(() => null);
  if (!actor) {
    return esuat("INTERZIS", "Nu ai dreptul să administrezi modulele organizațiilor.", requestId);
  }

  const admin = createAdminSupabase();

  const [rezModul, rezOrg] = await Promise.all([
    admin
      .from("features")
      .select("feature_key, denumire, is_core")
      .eq("feature_key", input.featureKey)
      .maybeSingle(),
    admin
      .from("organizations")
      .select("id, name, status, deleted_at")
      .eq("id", input.organizationId)
      .maybeSingle(),
  ]);

  if (rezModul.error || rezOrg.error) {
    const mesaj = rezModul.error?.message ?? rezOrg.error?.message ?? "";
    const tradus = traduEroareBd(mesaj);
    return esuat(tradus.code, tradus.message, requestId);
  }

  const modul = rezModul.data;
  const org = rezOrg.data;
  if (!modul) return esuat("NEGASIT", "Modulul cerut nu există.", requestId);
  if (!org || org.deleted_at !== null) {
    return esuat("NEGASIT", "Organizația nu a fost găsită.", requestId);
  }

  if (modul.is_core) {
    return esuat(
      "CONFLICT",
      `Modulul „${modul.denumire}” face parte din nucleul platformei și este activ pentru toate organizațiile.`,
      requestId,
    );
  }

  const { data: existent, error: erExistent } = await admin
    .from("organization_features")
    .select("enabled")
    .eq("organization_id", org.id)
    .eq("feature_key", modul.feature_key)
    .maybeSingle();

  if (erExistent) {
    const tradus = traduEroareBd(erExistent.message);
    return esuat(tradus.code, tradus.message, requestId);
  }

  const inainte = existent?.enabled ?? false;
  if (inainte === input.enabled) {
    return reusit({
      featureKey: modul.feature_key,
      enabled: inainte,
      schimbat: false,
      mesaj: `Modulul „${modul.denumire}” era deja ${inainte ? "activ" : "inactiv"}.`,
    });
  }

  const acum = new Date().toISOString();
  const rand = {
    organization_id: org.id,
    feature_key: modul.feature_key,
    enabled: input.enabled,
    // Datele de activare se scriu doar la activare, ca istoricul „activat de” să rămână vizibil.
    ...(input.enabled ? { activated_at: acum, activated_by: actor.id } : {}),
  };

  const server = await createServerSupabase();
  const { error: erScriere } = await admin
    .from("organization_features")
    .upsert(rand, { onConflict: "organization_id,feature_key" });

  if (erScriere) {
    const tradus = traduEroareBd(erScriere.message);
    await scrieAudit(server, {
      actiune: "feature_toggled",
      status: "failure",
      organizationId: org.id,
      entityType: "organization_features",
      entityId: modul.feature_key,
      before: doarCampuri({ enabled: inainte }, CAMPURI_AUDIT),
      after: doarCampuri({ feature_key: modul.feature_key, enabled: input.enabled }, CAMPURI_AUDIT),
      requestId,
      errorCode: tradus.code,
    });
    return esuat(tradus.code, tradus.message, requestId);
  }

  await scrieAudit(server, {
    actiune: "feature_toggled",
    status: "success",
    organizationId: org.id,
    entityType: "organization_features",
    entityId: modul.feature_key,
    before: doarCampuri({ enabled: inainte }, CAMPURI_AUDIT),
    after: doarCampuri({ feature_key: modul.feature_key, enabled: input.enabled }, CAMPURI_AUDIT),
    requestId,
  });

  revalidatePath(`/super-admin/organizatii/${org.id}/module`);

  return reusit({
    featureKey: modul.feature_key,
    enabled: input.enabled,
    schimbat: true,
    mesaj: `Modulul „${modul.denumire}” a fost ${input.enabled ? "activat" : "dezactivat"}.`,
  });
}
