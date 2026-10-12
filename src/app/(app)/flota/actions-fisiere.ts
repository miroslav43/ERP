// src/app/(app)/flota/actions-fisiere.ts
"use server";

/**
 * Fișierele flotei (0199), în bucketul privat `org-flota`: scanarea unui
 * document de vehicul și poza bonului unei alimentări. Trei pași, ca la
 * documentele de personal (`angajati/[id]/documente/actions.ts`):
 *
 *   1. `pregateste…` semnează calea, pe clientul UTILIZATORULUI — deci
 *      `createSignedUploadUrl` trece prin `flota_objects_insert`, iar cine n-are
 *      voie nu primește URL;
 *   2. browserul urcă octeții direct (`urcaPeUrlSemnat`);
 *   3. `confirma…` măsoară ce a ajuns CHIAR în Storage (`masoaraObiectul`) și
 *      leagă calea de rând, cu `.select()` după UPDATE: zero rânduri = CONFLICT.
 *
 * Porțile: scanarea cere `vehicles:update = all` (politica `vdoc_update`), bonul
 * `trip_sheets:update` own (politica `alimentari_update`), iar baza mai cere
 * foaia în ciornă (0197 §D1) și calea în folderul entității (0199 §4, §6).
 *
 * „use server”: se exportă DOAR funcții async (capcana 39).
 */

import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import { masoaraObiectul } from "@/lib/storage/masoara-obiectul";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  BUCKET_FLOTA,
  caleFlotaValida,
  construiesteCaleFlota,
  verificaFisierFlota,
} from "@/domain/fleet/fisiere";
import {
  confirmaBonSchema,
  confirmaScanareSchema,
  pregatesteBonSchema,
  pregatesteScanareSchema,
} from "@/schemas/fleet";

import { traduEroare } from "./erori";

const MESAJ_PREGATIRE =
  "Nu am putut pregăti încărcarea fișierului. Verificați că aveți dreptul de a adăuga fișiere aici și încercați din nou.";

// ── Scanarea documentului de vehicul ────────────────────────────────────────

export const pregatesteScanareDocument = createAction({
  name: "fleet.document.scan_prepare",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: pregatesteScanareSchema,
  audit: {
    action: "import",
    entityType: "vehicle_document",
    entityId: (input) => input.document_id,
    allow: ["document_id", "vehicle_id", "numeFisier", "dimensiune", "mime"],
  },
  handler: async (ctx, input): Promise<Readonly<{ cale: string; urlSemnat: string }>> => {
    const problema = verificaFisierFlota(input.mime, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, {});

    const db = await createServerSupabase();
    const { data: documentul, error } = await db
      .from("vehicle_documents")
      .select("id")
      .eq("id", input.document_id)
      .eq("vehicle_id", input.vehicle_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error !== null) throw error;
    if (documentul === null) {
      throw notFound("Documentul nu mai există pe acest vehicul. Reîncărcați fișa vehiculului.");
    }

    const cale = construiesteCaleFlota(
      ctx.tenant.organizationId,
      "vehicles",
      input.vehicle_id,
      input.numeFisier,
    );
    const { data, error: eroareSemnare } = await db.storage
      .from(BUCKET_FLOTA)
      .createSignedUploadUrl(cale);
    if (eroareSemnare !== null) throw businessRule(MESAJ_PREGATIRE);
    return { cale, urlSemnat: data.signedUrl };
  },
});

export const confirmaScanareDocument = createAction({
  name: "fleet.document.scan_confirm",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: confirmaScanareSchema,
  audit: {
    action: "update",
    entityType: "vehicle_document",
    entityId: (input) => input.document_id,
    allow: ["document_id", "vehicle_id", "cale", "numeFisier"],
  },
  revalidate: (input) => [`/flota/${input.vehicle_id}`, "/portal/masina-mea"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    if (!caleFlotaValida(input.cale, ctx.tenant.organizationId, "vehicles", input.vehicle_id)) {
      throw invalidInput("Calea fișierului nu corespunde acestui vehicul.", {});
    }
    const db = await createServerSupabase();
    const masura = await masoaraObiectul(db, BUCKET_FLOTA, input.cale);
    if (masura === null) {
      throw businessRule("Fișierul încărcat nu mai este disponibil. Reluați încărcarea.");
    }
    const problema = verificaFisierFlota(masura.mime, masura.octeti);
    if (problema !== null) throw invalidInput(problema, {});

    const { data, error } = await db
      .from("vehicle_documents")
      .update({ fisier_path: input.cale, fisier_nume: input.numeFisier, updated_by: ctx.user.id })
      .eq("id", input.document_id)
      .eq("vehicle_id", input.vehicle_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Scanarea nu a fost legată de document: documentul a fost șters între timp sau nu aveți dreptul de a-l modifica.",
      );
    }
    return { id: data.id };
  },
});

// ── Poza bonului de alimentare ──────────────────────────────────────────────

const caiFoaie = (foaieId: string): string[] => [
  `/flota/foi/${foaieId}`,
  "/portal/masina-mea",
  `/portal/masina-mea/foi/${foaieId}`,
];

export const pregatesteBon = createAction({
  name: "fleet.fuel.receipt_prepare",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: pregatesteBonSchema,
  audit: {
    action: "import",
    entityType: "fuel_entry",
    entityId: (input) => input.alimentare_id,
    allow: ["alimentare_id", "trip_sheet_id", "numeFisier", "dimensiune", "mime"],
  },
  handler: async (ctx, input): Promise<Readonly<{ cale: string; urlSemnat: string }>> => {
    const problema = verificaFisierFlota(input.mime, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, {});

    const db = await createServerSupabase();
    const { data: alimentarea, error } = await db
      .from("fuel_entries")
      .select("id")
      .eq("id", input.alimentare_id)
      .eq("trip_sheet_id", input.trip_sheet_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error !== null) throw error;
    if (alimentarea === null) {
      throw notFound("Alimentarea nu mai există pe această foaie. Reîncărcați foaia.");
    }

    const cale = construiesteCaleFlota(
      ctx.tenant.organizationId,
      "trip_sheets",
      input.trip_sheet_id,
      input.numeFisier,
    );
    // Politica bucketului cere foaia în ciornă și dreptul de scriere pe ea; pe
    // o foaie trimisă semnarea eșuează, deci mesajul spune și cauza probabilă.
    const { data, error: eroareSemnare } = await db.storage
      .from(BUCKET_FLOTA)
      .createSignedUploadUrl(cale);
    if (eroareSemnare !== null) {
      throw businessRule(
        "Nu am putut pregăti încărcarea bonului. Bonul se atașează doar cât foaia e ciornă, de cine o poate modifica.",
      );
    }
    return { cale, urlSemnat: data.signedUrl };
  },
});

export const confirmaBon = createAction({
  name: "fleet.fuel.receipt_confirm",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: confirmaBonSchema,
  audit: {
    action: "update",
    entityType: "fuel_entry",
    entityId: (input) => input.alimentare_id,
    allow: ["alimentare_id", "trip_sheet_id", "cale"],
  },
  revalidate: (input) => caiFoaie(input.trip_sheet_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    if (
      !caleFlotaValida(input.cale, ctx.tenant.organizationId, "trip_sheets", input.trip_sheet_id)
    ) {
      throw invalidInput("Calea fișierului nu corespunde acestei foi de parcurs.", {});
    }
    const db = await createServerSupabase();
    const masura = await masoaraObiectul(db, BUCKET_FLOTA, input.cale);
    if (masura === null) {
      throw businessRule("Poza bonului nu mai este disponibilă. Reluați încărcarea.");
    }
    const problema = verificaFisierFlota(masura.mime, masura.octeti);
    if (problema !== null) throw invalidInput(problema, {});

    const { data, error } = await db
      .from("fuel_entries")
      .update({ fisier_bon_path: input.cale, updated_by: ctx.user.id })
      .eq("id", input.alimentare_id)
      .eq("trip_sheet_id", input.trip_sheet_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Bonul nu a fost atașat: alimentarea a fost ștearsă între timp sau nu aveți dreptul de a o modifica.",
      );
    }
    return { id: data.id };
  },
});
