// src/app/(app)/ticketing/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { cereAprobare, statusInitial } from "@/domain/ticketing/stari";
import { macroDupaCod } from "@/domain/ticketing/macrouri";
import {
  aplicaMacroSchema,
  asigneazaSchema,
  comentariuSchema,
  creeazaTichetSchema,
  decideTichetSchema,
  marcheazaDuplicatSchema,
  schimbaStatusSchema,
  suprascriePrioritateaSchema,
  urmaresteSchema,
  type CreeazaTichetInput,
} from "@/schemas/ticketing";

const CAI_DE_REIMPROSPATAT = ["/ticketing", "/panou"];

/**
 * Fișa de angajat a utilizatorului curent. Tichetele se leagă de angajat, nu de
 * cont: un cont fără fișă activă nu poate deschide tichete, la fel ca la
 * sesizările de mentenanță.
 */
async function fisaMea(organizationId: string, userId: string): Promise<string> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("employees")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  if (data === null) {
    throw businessRule(
      "Contul dvs. nu este legat de o fișă de angajat activă în această organizație. Contactați administratorul.",
    );
  }
  return data.id;
}

/** Coloanele specifice fiecărui tip. Ce nu apare aici rămâne NULL în bază. */
function campuriSpecifice(input: CreeazaTichetInput): Record<string, unknown> {
  switch (input.tip) {
    case "software":
      return {
        aplicatie: input.aplicatie,
        numar_licente: input.numar_licente,
        ...(input.motiv_necesitate === undefined
          ? {}
          : { motiv_necesitate: input.motiv_necesitate }),
      };
    case "hardware":
      return {
        denumire_hardware: input.denumire_hardware,
        loc_livrare: input.loc_livrare,
        ...(input.adresa_livrare === undefined ? {} : { adresa_livrare: input.adresa_livrare }),
      };
    case "defectiune":
      return {
        inventory_item_id: input.inventory_item_id,
        blocheaza_activitatea: input.blocheaza_activitatea,
        ...(input.locatie === undefined ? {} : { locatie: input.locatie }),
      };
    case "bug_erp":
      return {
        modul: input.modul,
        pasi_efectuati: input.pasi_efectuati,
        rezultat_asteptat: input.rezultat_asteptat,
        rezultat_obtinut: input.rezultat_obtinut,
        ...(input.context === undefined ? {} : { context: input.context }),
      };
  }
}

export const creeazaTichet = createAction({
  name: "ticketing.create",
  feature: "ticketing",
  permission: "tickets:create",
  minScope: "own",
  input: creeazaTichetSchema,
  audit: {
    action: "create",
    entityType: "ticket",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    // Fără conținutul liber al descrierii în audit: poate conține date
    // personale, iar `audit_logs` are altă durată de păstrare.
    allow: ["tip", "titlu", "inventory_item_id", "loc_livrare", "numar_licente"],
  },
  revalidate: CAI_DE_REIMPROSPATAT,
  handler: async (ctx, input): Promise<Readonly<{ id: string; numar: string }>> => {
    const solicitantId = await fisaMea(ctx.tenant.organizationId, ctx.user.id);
    const db = await createServerSupabase();

    // Numărul se rezervă înaintea inserării, printr-o funcție atomică. Poate
    // rămâne o gaură în secvență dacă inserarea eșuează — acceptat deliberat,
    // ca la inventar: golurile sunt tolerabile, repetarea nu.
    const { data: numar, error: eroareNumar } = await db.rpc("aloca_numar_tichet", {
      p_organization_id: ctx.tenant.organizationId,
    });
    if (eroareNumar !== null) throw eroareNumar;

    // `department_id` se completează din fișa angajatului, nu din formular:
    // e o proprietate a lui, nu o alegere.
    const admin = createAdminSupabase();
    const { data: fisa } = await admin
      .from("employees")
      .select("department_id")
      .eq("id", solicitantId)
      .maybeSingle();

    const { data, error } = await db
      .from("tickets")
      .insert({
        organization_id: ctx.tenant.organizationId,
        numar_afisat: numar,
        tip: input.tip,
        titlu: input.titlu,
        descriere: input.descriere,
        solicitant_employee_id: solicitantId,
        ...(fisa?.department_id == null ? {} : { department_id: fisa.department_id }),
        status: statusInitial(input.tip),
        aprobare_ceruta: cereAprobare(input.tip),
        ...campuriSpecifice(input),
      })
      .select("id, numar_afisat")
      .single();
    if (error !== null) throw error;

    return { id: data.id, numar: data.numar_afisat };
  },
});

export const decideTichet = createAction({
  name: "ticketing.decide",
  feature: "ticketing",
  permission: "tickets:approve",
  minScope: "team",
  input: decideTichetSchema,
  audit: {
    action: "update",
    entityType: "ticket",
    entityId: (input) => input.ticket_id,
    allow: ["ticket_id", "aprobat", "motiv"],
  },
  revalidate: CAI_DE_REIMPROSPATAT,
  handler: async (_ctx, input): Promise<Readonly<{ status: string }>> => {
    const db = await createServerSupabase();
    const { data: tichet, error: eroareCitire } = await db
      .from("tickets")
      .select("id, status, aprobare_ceruta")
      .eq("id", input.ticket_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;
    if (tichet === null) throw notFound("Tichetul nu există sau nu aveți acces la el.");
    if (!tichet.aprobare_ceruta) {
      throw businessRule("Acest tip de tichet nu trece prin aprobare.");
    }
    if (tichet.status !== "in_aprobare") {
      throw businessRule("Cererea nu mai este în așteptarea unei decizii.");
    }

    // Aprobatorul și data se scriu de trigger, nu de aici — vezi
    // `internal.tickets_valideaza_tranzitia`. Tot acolo se verifică dreptul:
    // managerul direct sau patronul, și niciodată solicitantul însuși.
    const { error } = await db
      .from("tickets")
      .update({
        status: input.aprobat ? "in_lucru" : "respins",
        ...(input.motiv === undefined ? {} : { motiv_respingere: input.motiv }),
      })
      .eq("id", input.ticket_id);
    if (error !== null) throw error;

    return { status: input.aprobat ? "in_lucru" : "respins" };
  },
});

export const schimbaStatusul = createAction({
  name: "ticketing.status",
  feature: "ticketing",
  permission: "tickets:update",
  minScope: "own",
  input: schimbaStatusSchema,
  audit: {
    action: "update",
    entityType: "ticket",
    entityId: (input) => input.ticket_id,
    allow: ["ticket_id", "status"],
  },
  revalidate: CAI_DE_REIMPROSPATAT,
  handler: async (_ctx, input): Promise<Readonly<{ status: string }>> => {
    const db = await createServerSupabase();
    // Tranziția și dreptul de a o face sunt validate în bază. Aici nu le
    // dublăm: o a doua listă de reguli ar începe să difere de prima.
    const { error } = await db
      .from("tickets")
      .update({ status: input.status })
      .eq("id", input.ticket_id);
    if (error !== null) throw error;
    return { status: input.status };
  },
});

export const comenteaza = createAction({
  name: "ticketing.comment",
  feature: "ticketing",
  permission: "tickets:read",
  minScope: "own",
  input: comentariuSchema,
  audit: {
    action: "create",
    entityType: "ticket_comment",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["ticket_id", "intern"],
  },
  revalidate: CAI_DE_REIMPROSPATAT,
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const autorId = await fisaMea(ctx.tenant.organizationId, ctx.user.id);
    const db = await createServerSupabase();
    // Dreptul de a scrie o notă internă e verificat în politica de insert;
    // un solicitant care ar trimite `intern: true` primește refuz din bază.
    const { data, error } = await db
      .from("ticket_comments")
      .insert({
        organization_id: ctx.tenant.organizationId,
        ticket_id: input.ticket_id,
        autor_employee_id: autorId,
        continut: input.continut,
        intern: input.intern,
      })
      .select("id")
      .single();
    if (error !== null) throw error;
    return { id: data.id };
  },
});

export const suprascriePrioritatea = createAction({
  name: "ticketing.priority",
  feature: "ticketing",
  permission: "tickets:update",
  minScope: "all",
  input: suprascriePrioritateaSchema,
  audit: {
    action: "update",
    entityType: "ticket",
    entityId: (input) => input.ticket_id,
    allow: ["ticket_id", "prioritate", "motiv"],
  },
  revalidate: CAI_DE_REIMPROSPATAT,
  handler: async (ctx, input): Promise<Readonly<{ prioritate: string }>> => {
    const db = await createServerSupabase();
    const { error } = await db
      .from("tickets")
      .update({
        prioritate: input.prioritate,
        prioritate_manuala: true,
        prioritate_motiv: input.motiv,
      })
      .eq("id", input.ticket_id);
    if (error !== null) throw error;

    // Justificarea rămâne în istoricul tichetului, nu doar în `audit_logs`:
    // e informație de care are nevoie cine deschide fișa, nu un auditor.
    const admin = createAdminSupabase();
    await admin.from("ticket_history").insert({
      organization_id: ctx.tenant.organizationId,
      ticket_id: input.ticket_id,
      actor_user_id: ctx.user.id,
      camp: "prioritate",
      valoare_noua: input.prioritate,
      motiv: input.motiv,
    });

    return { prioritate: input.prioritate };
  },
});

export const asigneaza = createAction({
  name: "ticketing.assign",
  feature: "ticketing",
  permission: "tickets:update",
  minScope: "all",
  input: asigneazaSchema,
  audit: {
    action: "update",
    entityType: "ticket",
    entityId: (input) => input.ticket_id,
    allow: ["ticket_id", "asignat_employee_id"],
  },
  revalidate: CAI_DE_REIMPROSPATAT,
  handler: async (_ctx, input): Promise<Readonly<{ ok: true }>> => {
    const db = await createServerSupabase();
    const { error } = await db
      .from("tickets")
      .update({ asignat_employee_id: input.asignat_employee_id })
      .eq("id", input.ticket_id);
    if (error !== null) throw error;
    return { ok: true };
  },
});

export const marcheazaDuplicat = createAction({
  name: "ticketing.duplicate",
  feature: "ticketing",
  permission: "tickets:update",
  minScope: "all",
  input: marcheazaDuplicatSchema,
  audit: {
    action: "update",
    entityType: "ticket",
    entityId: (input) => input.ticket_id,
    allow: ["ticket_id", "parent_ticket_id"],
  },
  revalidate: CAI_DE_REIMPROSPATAT,
  handler: async (_ctx, input): Promise<Readonly<{ ok: true }>> => {
    if (input.ticket_id === input.parent_ticket_id) {
      throw businessRule("Un tichet nu poate fi duplicatul lui însuși.");
    }

    const db = await createServerSupabase();
    const { data: parinte, error: eroareParinte } = await db
      .from("tickets")
      .select("id, tip, parent_ticket_id")
      .eq("id", input.parent_ticket_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareParinte !== null) throw eroareParinte;
    if (parinte === null) throw notFound("Tichetul-părinte nu există sau nu aveți acces la el.");
    // Fără lanțuri de duplicate: altfel „rezolvarea părintelui” ar trebui să
    // urce recursiv, iar notificarea raportorilor ar deveni ambiguă.
    if (parinte.parent_ticket_id !== null) {
      throw businessRule("Tichetul-părinte este el însuși un duplicat. Alegeți originalul.");
    }

    const { error } = await db
      .from("tickets")
      .update({ parent_ticket_id: input.parent_ticket_id })
      .eq("id", input.ticket_id);
    if (error !== null) throw error;
    return { ok: true };
  },
});

export const aplicaMacro = createAction({
  name: "ticketing.macro",
  feature: "ticketing",
  permission: "tickets:update",
  minScope: "all",
  input: aplicaMacroSchema,
  audit: {
    action: "update",
    entityType: "ticket",
    entityId: (input) => input.ticket_id,
    allow: ["ticket_id", "cod"],
  },
  revalidate: CAI_DE_REIMPROSPATAT,
  handler: async (ctx, input): Promise<Readonly<{ status: string }>> => {
    const macro = macroDupaCod(input.cod);
    if (macro === undefined) throw notFound("Răspunsul predefinit nu există.");

    const autorId = await fisaMea(ctx.tenant.organizationId, ctx.user.id);
    const db = await createServerSupabase();

    // Comentariul întâi: dacă tranziția e respinsă de bază, solicitantul nu
    // rămâne cu un mesaj care anunță o schimbare ce nu s-a produs.
    const { error: eroareComentariu } = await db.from("ticket_comments").insert({
      organization_id: ctx.tenant.organizationId,
      ticket_id: input.ticket_id,
      autor_employee_id: autorId,
      continut: macro.text,
      intern: false,
    });
    if (eroareComentariu !== null) throw eroareComentariu;

    const { error } = await db
      .from("tickets")
      .update({ status: macro.status })
      .eq("id", input.ticket_id);
    if (error !== null) throw error;

    return { status: macro.status };
  },
});

export const urmareste = createAction({
  name: "ticketing.watch",
  feature: "ticketing",
  permission: "tickets:read",
  minScope: "own",
  input: urmaresteSchema,
  audit: {
    action: "create",
    entityType: "ticket_watcher",
    entityId: (input) => input.ticket_id,
    allow: ["ticket_id", "employee_id"],
  },
  revalidate: CAI_DE_REIMPROSPATAT,
  handler: async (ctx, input): Promise<Readonly<{ ok: true }>> => {
    const db = await createServerSupabase();
    const { error } = await db.from("ticket_watchers").insert({
      organization_id: ctx.tenant.organizationId,
      ticket_id: input.ticket_id,
      employee_id: input.employee_id,
    });
    // Urmărirea e idempotentă din perspectiva utilizatorului: dacă apeși de
    // două ori, a doua oară nu e o eroare, e deja făcut.
    if (error !== null && error.code !== "23505") throw error;
    return { ok: true };
  },
});
