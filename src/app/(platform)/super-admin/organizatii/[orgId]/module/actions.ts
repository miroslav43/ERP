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

/** Aceleași două câmpuri, pentru comutarea în bloc. */
const schemaComutareTotala = z.object({
  organizationId: z.uuid({ error: "Organizație invalidă." }),
  enabled: z.boolean({ error: "Valoare invalidă pentru comutator." }),
});

const CAMPURI_AUDIT = ["feature_key", "enabled"] as const;
const CAMPURI_AUDIT_TOTAL = ["module", "enabled"] as const;

export type RezultatComutare = Readonly<{
  featureKey: string;
  enabled: boolean;
  schimbat: boolean;
  mesaj: string;
}>;

export type RezultatComutareTotala = Readonly<{
  enabled: boolean;
  schimbate: number;
  neatinse: number;
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

  // `id` și `.is("deleted_at", null)` sunt necesare pentru scrierea de mai jos:
  // unicitatea (organization_id, feature_key) e pe un index PARȚIAL, deci
  // actualizarea se face după cheia primară, nu prin ON CONFLICT.
  const { data: existent, error: erExistent } = await admin
    .from("organization_features")
    .select("id, enabled")
    .eq("organization_id", org.id)
    .eq("feature_key", modul.feature_key)
    .is("deleted_at", null)
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
  // NU `.upsert(..., { onConflict: "organization_id,feature_key" })`: singura
  // unicitate pe aceste coloane e `organization_features_org_key_uq`, un index
  // PARȚIAL (`where deleted_at is null`). PostgREST nu emite predicatul în
  // `ON CONFLICT`, iar Postgres respinge inferența cu 42P10 la PLANIFICARE —
  // deci pica la fiecare apel, nu doar la conflict. Vezi capcana #7 din
  // docs/design/ecrane/capcane.md.
  const { error: erScriere } =
    existent === null
      ? await admin.from("organization_features").insert(rand)
      : await admin.from("organization_features").update(rand).eq("id", existent.id);

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

/**
 * Comută TOATE modulele comutabile ale unei organizații dintr-o singură dată.
 *
 * Modulele de nucleu sunt sărite, nu respinse: `comutaModul` întoarce CONFLICT
 * pentru ele, dar aici un singur modul de nucleu ar face butonul să pară că a
 * eșuat, deși restul s-a aplicat. Ele nu se pot dezactiva prin construcție, deci
 * nu au ce căuta în mulțimea pe care o atinge acțiunea.
 *
 * Scrierile pleacă în DOUĂ instrucțiuni (un `insert` pentru rândurile lipsă, un
 * `update` peste identificatorii existenți), nu într-o buclă de câte un apel per
 * modul. PostgREST nu ne dă o tranzacție peste amândouă, deci atomicitatea NU e
 * garantată — dar fereastra în care starea e pe jumătate aplicată scade de la
 * 15 pași la unul singur, iar fiecare instrucțiune în parte e atomică.
 */
export async function comutaToateModulele(
  raw: unknown,
): Promise<ActionResult<RezultatComutareTotala>> {
  const requestId = idCerere();

  const parsare = schemaComutareTotala.safeParse(raw);
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

  const [rezModule, rezOrg] = await Promise.all([
    admin.from("features").select("feature_key").eq("is_core", false),
    admin
      .from("organizations")
      .select("id, name, status, deleted_at")
      .eq("id", input.organizationId)
      .maybeSingle(),
  ]);

  if (rezModule.error || rezOrg.error) {
    const mesaj = rezModule.error?.message ?? rezOrg.error?.message ?? "";
    const tradus = traduEroareBd(mesaj);
    return esuat(tradus.code, tradus.message, requestId);
  }

  const org = rezOrg.data;
  if (!org || org.deleted_at !== null) {
    return esuat("NEGASIT", "Organizația nu a fost găsită.", requestId);
  }

  const comutabile = rezModule.data ?? [];
  if (comutabile.length === 0) {
    return esuat("NEGASIT", "Catalogul nu conține niciun modul comutabil.", requestId);
  }

  const { data: existente, error: erExistente } = await admin
    .from("organization_features")
    .select("id, feature_key, enabled")
    .eq("organization_id", org.id)
    .is("deleted_at", null);

  if (erExistente) {
    const tradus = traduEroareBd(erExistente.message);
    return esuat(tradus.code, tradus.message, requestId);
  }

  const hartaExistente = new Map((existente ?? []).map((rand) => [rand.feature_key, rand]));

  // Absența rândului înseamnă „inactiv”, deci la oprire nu e nimic de inserat:
  // un rând nou cu `enabled = false` ar fi zgomot în bază și în jurnal.
  const deInserat = input.enabled
    ? comutabile.filter((modul) => !hartaExistente.has(modul.feature_key))
    : [];
  const deActualizat = comutabile.flatMap((modul) => {
    const existent = hartaExistente.get(modul.feature_key);
    return existent && existent.enabled !== input.enabled ? [existent] : [];
  });

  const cheiSchimbate = [
    ...deInserat.map((modul) => modul.feature_key),
    ...deActualizat.map((rand) => rand.feature_key),
  ];

  if (cheiSchimbate.length === 0) {
    return reusit({
      enabled: input.enabled,
      schimbate: 0,
      neatinse: comutabile.length,
      mesaj: `Toate modulele erau deja ${input.enabled ? "active" : "inactive"}.`,
    });
  }

  const acum = new Date().toISOString();
  // Datele de activare se scriu doar la activare, ca istoricul „activat de” să
  // rămână vizibil după o oprire.
  const campuriActivare = input.enabled ? { activated_at: acum, activated_by: actor.id } : {};

  if (deInserat.length > 0) {
    const { error } = await admin.from("organization_features").insert(
      deInserat.map((modul) => ({
        organization_id: org.id,
        feature_key: modul.feature_key,
        enabled: input.enabled,
        ...campuriActivare,
      })),
    );
    if (error) {
      return await esecAuditat(error.message, requestId, org.id, cheiSchimbate, input.enabled);
    }
  }

  if (deActualizat.length > 0) {
    const { error } = await admin
      .from("organization_features")
      .update({ enabled: input.enabled, ...campuriActivare })
      .in(
        "id",
        deActualizat.map((rand) => rand.id),
      );
    if (error) {
      return await esecAuditat(error.message, requestId, org.id, cheiSchimbate, input.enabled);
    }
  }

  const server = await createServerSupabase();
  await scrieAudit(server, {
    actiune: "feature_toggled",
    status: "success",
    organizationId: org.id,
    entityType: "organization_features",
    entityId: null,
    before: doarCampuri(
      { module: cheiSchimbate.join(", "), enabled: !input.enabled },
      CAMPURI_AUDIT_TOTAL,
    ),
    after: doarCampuri(
      { module: cheiSchimbate.join(", "), enabled: input.enabled },
      CAMPURI_AUDIT_TOTAL,
    ),
    requestId,
  });

  revalidatePath(`/super-admin/organizatii/${org.id}/module`);

  const verb = input.enabled ? "activate" : "dezactivate";
  const neatinse = comutabile.length - cheiSchimbate.length;
  return reusit({
    enabled: input.enabled,
    schimbate: cheiSchimbate.length,
    neatinse,
    mesaj:
      neatinse === 0
        ? `${cheiSchimbate.length} module ${verb}.`
        : `${cheiSchimbate.length} module ${verb}; ${neatinse} erau deja așa.`,
  });
}

/** Jurnalizează eșecul comutării în bloc și întoarce eroarea tradusă. */
async function esecAuditat(
  mesajBd: string,
  requestId: string,
  organizationId: string,
  chei: readonly string[],
  enabled: boolean,
): Promise<ActionResult<RezultatComutareTotala>> {
  const tradus = traduEroareBd(mesajBd);
  const server = await createServerSupabase();
  await scrieAudit(server, {
    actiune: "feature_toggled",
    status: "failure",
    organizationId,
    entityType: "organization_features",
    entityId: null,
    before: doarCampuri({ module: chei.join(", "), enabled: !enabled }, CAMPURI_AUDIT_TOTAL),
    after: doarCampuri({ module: chei.join(", "), enabled }, CAMPURI_AUDIT_TOTAL),
    requestId,
    errorCode: tradus.code,
  });
  return esuat(tradus.code, tradus.message, requestId);
}
