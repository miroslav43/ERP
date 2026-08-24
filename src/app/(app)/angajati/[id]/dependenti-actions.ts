// src/app/(app)/angajati/[id]/dependenti-actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, mapPostgrestError } from "@/lib/actions/errors";
import { persoanaIntretinereSchema, stergePersoanaIntretinereSchema } from "@/schemas/employee";

/**
 * Adaugă o persoană în întreținere.
 *
 * Contorul `employees.nr_persoane_intretinere` — cel care hrănește deducerea
 * personală (`payroll_personal_deduction_brackets`) — se RECALCULEAZĂ singur,
 * prin triggerul din 0069. Acțiunea nu-l atinge: dacă l-ar scrie, cele două
 * valori s-ar putea despărți la prima scriere ratată, iar deducerea ar rămâne
 * calculată pe un număr care nu mai corespunde nimănui.
 */
export const adaugaPersoanaIntretinere = createAction({
  name: "employees.dependent.create",
  permission: "employees:update",
  minScope: "all",
  input: persoanaIntretinereSchema,
  audit: {
    action: "create",
    entityType: "employee_dependent",
    // `nume` și `data_nasterii` NU intră în jurnal: descriu o persoană care nu e
    // angajat — de multe ori un minor — și n-are ce căuta într-un registru
    // citibil de oricine are `audit:read`.
    allow: ["employee_id", "relatie", "in_intretinere_de_la", "in_intretinere_pana_la"],
  },
  revalidate: (input) => [`/angajati/${input.employee_id}`, "/salarizare"],
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("employee_dependents")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: input.employee_id,
        nume: input.nume,
        relatie: input.relatie,
        data_nasterii: input.data_nasterii,
        in_intretinere_de_la: input.in_intretinere_de_la,
        in_intretinere_pana_la: input.in_intretinere_pana_la,
        observatii: input.observatii,
      })
      .select("id")
      .single();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule("Persoana în întreținere nu a putut fi adăugată.");
    }
    return { id: data.id };
  },
});

/**
 * Scoate o persoană din întreținere.
 *
 * Ștergere LOGICĂ, ca peste tot în proiect: dosarul fiscal al anilor anteriori
 * trebuie să rămână explicabil, iar o deducere acordată în 2025 se justifică
 * prin persoana care era atunci în întreținere, chiar dacă azi nu mai e.
 */
export const stergePersoanaIntretinere = createAction({
  name: "employees.dependent.delete",
  permission: "employees:update",
  minScope: "all",
  input: stergePersoanaIntretinereSchema,
  audit: {
    action: "delete",
    entityType: "employee_dependent",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/salarizare"],
  handler: async (ctx, input) => {
    // Capcana 17: un UPDATE respins de `USING` afectează zero rânduri, tăcut.
    const { data, error } = await ctx.supabase
      .from("employee_dependents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, employee_id")
      .maybeSingle<{ id: string; employee_id: string }>();
    if (error !== null) throw mapPostgrestError(error, ctx.requestId);
    if (data === null) {
      throw businessRule("Persoana nu a fost găsită sau nu aveți dreptul să o modificați.");
    }
    return { employeeId: data.employee_id };
  },
});
