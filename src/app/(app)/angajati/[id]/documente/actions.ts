// src/app/(app)/angajati/[id]/documente/actions.ts
"use server";
import { z } from "zod";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import { readRequestMeta, writeAuditLog } from "@/lib/actions/audit";
import {
  BUCKET_DOCUMENTE,
  construiesteCaleDocument,
  prefixCaleDocument,
  verificaDocument,
} from "@/lib/documents/cale";
import type { ActionContext } from "@/lib/actions/types";

const idAngajat = z.object({ employeeId: z.uuid() });

async function verificaAngajatul(ctx: ActionContext, employeeId: string): Promise<void> {
  const { data } = await ctx.supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (data === null) throw notFound("Fișa de angajat nu există sau nu îți este accesibilă.");
}

export const pregatesteIncarcareDocument = createAction({
  name: "angajati.documente.pregateste",
  permission: "employees:update",
  minScope: "team",
  audit: {
    entityType: "employee_documents",
    action: "import",
    allow: ["employeeId", "numeFisier", "dimensiune", "mime"],
  },
  input: idAngajat.extend({
    numeFisier: z.string().min(1).max(255),
    dimensiune: z.number().int().positive(),
    mime: z.string().min(3).max(120),
  }),
  handler: async (ctx: ActionContext, input) => {
    const problema = verificaDocument(input.mime, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, {});
    await verificaAngajatul(ctx, input.employeeId);
    const cale = construiesteCaleDocument({
      organizationId: ctx.tenant.organizationId,
      entitate: "employees",
      entitateId: input.employeeId,
      numeFisier: input.numeFisier,
    });
    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null)
      throw businessRule("Nu am putut pregăti încărcarea documentului.");
    return { cale, token: data.token };
  },
});

export const salveazaDocument = createAction({
  name: "angajati.documente.salveaza",
  permission: "employees:update",
  minScope: "team",
  audit: {
    entityType: "employee_documents",
    action: "create",
    allow: [
      "employeeId",
      "documentTypeId",
      "titlu",
      "numeFisier",
      "dimensiune",
      "mime",
      "numarDocument",
      "dataDocument",
      "valabilPanaLa",
      "confidential",
      "vizibilAngajatului",
    ],
  },
  input: idAngajat.extend({
    documentTypeId: z.uuid(),
    titlu: z.string().trim().min(2, "Titlul are minimum 2 caractere.").max(200),
    cale: z.string().min(1).max(400),
    numeFisier: z.string().min(1).max(255),
    dimensiune: z.number().int().min(0).max(52_428_800),
    mime: z.string().min(3).max(120),
    numarDocument: z.string().max(60).optional(),
    dataDocument: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    valabilPanaLa: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    confidential: z.boolean(),
    vizibilAngajatului: z.boolean(),
  }),
  handler: async (ctx: ActionContext, input) => {
    await verificaAngajatul(ctx, input.employeeId);
    const prefix = prefixCaleDocument(ctx.tenant.organizationId, "employees", input.employeeId);
    if (!input.cale.startsWith(prefix)) {
      const mesaj = "Calea fișierului nu corespunde acestui angajat.";
      throw invalidInput(mesaj, { cale: [mesaj] });
    }

    const { data, error } = await ctx.supabase
      .from("employee_documents")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: input.employeeId,
        document_type_id: input.documentTypeId,
        titlu: input.titlu,
        fisier_path: input.cale,
        fisier_nume: input.numeFisier,
        fisier_marime_bytes: input.dimensiune,
        fisier_mime: input.mime,
        confidential: input.confidential,
        vizibil_angajatului: input.vizibilAngajatului,
        ...(input.numarDocument === undefined ? {} : { numar_document: input.numarDocument }),
        ...(input.dataDocument === undefined ? {} : { data_document: input.dataDocument }),
        ...(input.valabilPanaLa === undefined ? {} : { valabil_pana: input.valabilPanaLa }),
      })
      .select("id")
      .single();
    if (error !== null || data === null)
      throw businessRule("Documentul nu a putut fi înregistrat. Încearcă din nou.");
    return { id: data.id };
  },
});

export const linkDescarcareDocument = createAction({
  name: "angajati.documente.descarca",
  permission: "employees:read",
  minScope: "team",
  audit: { entityType: "employee_documents", action: "export", allow: ["documentId"] },
  input: z.object({ documentId: z.uuid() }),
  handler: async (ctx: ActionContext, input) => {
    const { data } = await ctx.supabase
      .from("employee_documents")
      .select("id, employee_id, fisier_path, fisier_nume, confidential")
      .eq("id", input.documentId)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (data === null) throw notFound("Documentul nu există sau nu îți este accesibil.");

    const { data: semnat, error } = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUrl(data.fisier_path, 120, { download: data.fisier_nume });
    if (error !== null || semnat === null)
      throw businessRule("Fișierul nu mai este disponibil în arhivă.");

    // Accesul la documentele confidențiale se auditează explicit, cu rând vizibil în jurnal.
    if (data.confidential) {
      await writeAuditLog(ctx.supabase, {
        organizationId: ctx.tenant.organizationId,
        action: "export",
        status: "success",
        entityType: "employee_documents",
        entityId: data.id,
        before: null,
        after: { employeeId: data.employee_id, motiv: "descarcare_document_confidential" },
        errorCode: null,
        requestId: ctx.requestId,
        meta: await readRequestMeta(),
      });
    }
    return { url: semnat.signedUrl, expiraSecunde: 120 };
  },
});

export const stergeDocument = createAction({
  name: "angajati.documente.sterge",
  permission: "employees:delete",
  minScope: "all",
  audit: { entityType: "employee_documents", action: "delete", allow: ["documentId", "motiv"] },
  input: z.object({
    documentId: z.uuid(),
    motiv: z.string().trim().min(3, "Scrie motivul ștergerii.").max(200),
  }),
  handler: async (ctx: ActionContext, input) => {
    // Ștergere logică: nu există politici DELETE, iar dosarul de personal trebuie păstrat.
    const { data, error } = await ctx.supabase
      .from("employee_documents")
      .update({ deleted_at: new Date().toISOString(), observatii: input.motiv })
      .eq("id", input.documentId)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw businessRule("Documentul nu a putut fi retras din dosar.");
    if (data === null) throw notFound("Documentul nu există sau a fost deja retras.");
    return { id: data.id };
  },
});
