// src/app/(app)/ticketing/actions.ts
//
// ── DE CE FIECARE SCRIERE FILTREAZĂ PE `organization_id` ──────────────────
// Politica `tickets_update` (0045:657) leagă `organization_id = any(
// app.current_org_ids())` — adică mulțimea firmelor din care face parte
// utilizatorul, nu firma pe care o are deschisă. Iar `app.has_permission(
// organization_id, …)` și `app.fisa_mea(organization_id)` se evaluează pe
// organizația RÂNDULUI. Consecința, pentru cineva membru în două firme: având
// contextul pe firma A, un `ticket_id` din firma B trecea de politică, fiindcă
// acolo chiar are dreptul.
//
// Nu e o scurgere între firme străine — omul putea oricum acționa asupra
// tichetului, din firma B. Dar intrarea de audit, revalidarea și
// `ctx.tenant.organizationId` ar fi spus altceva decât ce s-a întâmplat.
// Ticketing-ul era SINGURUL din cele optsprezece module cu scrieri și zero
// filtre de tenant; celelalte șaptesprezece îl pun. Filtrul poate doar să
// refuze mai mult, niciodată mai puțin, iar refuzul se vede acum ca un conflict
// explicit, nu ca tăcere.
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

const CAI_DE_REIMPROSPATAT = [
  "/ticketing",
  "/panou",
  // Solicitantul își urmărește tichetul din portal, iar pagina de start numără
  // ce așteaptă răspuns. Fără căile astea, comentează și nu-și vede comentariul.
  "/portal",
  "/portal/tichetele-mele",
];

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
  handler: async (ctx, input): Promise<Readonly<{ status: string }>> => {
    const db = await createServerSupabase();
    const { data: tichet, error: eroareCitire } = await db
      .from("tickets")
      .select("id, status, aprobare_ceruta")
      .eq("id", input.ticket_id)
      .eq("organization_id", ctx.tenant.organizationId)
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
    // Între citirea de mai sus și scrierea asta, un al doilea aprobator poate
    // decide — iar dreptul de a decide îl verifică tot baza. Un rând care nu
    // trece de clauza USING a politicii `tickets_update` e sărit TĂCUT: zero
    // rânduri, zero erori, iar acțiunea ar raporta „aprobat”. `.select()`
    // transformă tăcerea în conflict.
    const { data: decisa, error } = await db
      .from("tickets")
      .update({
        status: input.aprobat ? "in_lucru" : "respins",
        ...(input.motiv === undefined ? {} : { motiv_respingere: input.motiv }),
      })
      .eq("id", input.ticket_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    if (decisa === null) {
      throw businessRule(
        "Cererea a fost deja decisă de altcineva între timp sau nu aveți dreptul de a decide asupra ei. Reîncărcați pagina.",
      );
    }

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
  handler: async (ctx, input): Promise<Readonly<{ status: string }>> => {
    const db = await createServerSupabase();
    // Tranziția și dreptul de a o face sunt validate în bază. Aici nu le
    // dublăm: o a doua listă de reguli ar începe să difere de prima.
    // Dacă politica refuză rândul, UPDATE-ul atinge zero rânduri fără eroare:
    // utilizatorul ar vedea statusul nou pe ecran și cel vechi în bază.
    const { data: mutat, error } = await db
      .from("tickets")
      .update({ status: input.status })
      .eq("id", input.ticket_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    if (mutat === null) {
      throw businessRule(
        "Tichetul nu a putut fi mutat în starea cerută: a fost schimbat de altcineva între timp sau nu aveți dreptul asupra lui. Reîncărcați pagina.",
      );
    }
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
    // Prioritatea e un câmp păzit — o poate schimba doar cine operează
    // tichetul — iar refuzul politicii `tickets_update` nu produce eroare.
    // Verificarea stă ÎNAINTEA istoricului: altfel `ticket_history` ar
    // consemna o schimbare care nu s-a produs.
    const { data: reprioritizat, error } = await db
      .from("tickets")
      .update({
        prioritate: input.prioritate,
        prioritate_manuala: true,
        prioritate_motiv: input.motiv,
      })
      .eq("id", input.ticket_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    if (reprioritizat === null) {
      throw businessRule(
        "Prioritatea nu a fost schimbată: tichetul nu mai este accesibil sau nu aveți dreptul de a-l prelucra. Reîncărcați pagina.",
      );
    }

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
  handler: async (ctx, input): Promise<Readonly<{ ok: true }>> => {
    const db = await createServerSupabase();
    // `asignat_employee_id` e câmp păzit, iar politica poate sări rândul
    // tăcut: fără `.select()`, ecranul ar arăta tichetul repartizat, iar în
    // bază ar rămâne nerepartizat.
    const { data: asignat, error } = await db
      .from("tickets")
      .update({ asignat_employee_id: input.asignat_employee_id })
      .eq("id", input.ticket_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    if (asignat === null) {
      throw businessRule(
        "Repartizarea nu a fost salvată: tichetul nu mai este accesibil sau nu aveți dreptul de a-l prelucra. Reîncărcați pagina.",
      );
    }
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
  handler: async (ctx, input): Promise<Readonly<{ ok: true }>> => {
    if (input.ticket_id === input.parent_ticket_id) {
      throw businessRule("Un tichet nu poate fi duplicatul lui însuși.");
    }

    const db = await createServerSupabase();
    const { data: parinte, error: eroareParinte } = await db
      .from("tickets")
      .select("id, tip, parent_ticket_id")
      .eq("id", input.parent_ticket_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareParinte !== null) throw eroareParinte;
    if (parinte === null) throw notFound("Tichetul-părinte nu există sau nu aveți acces la el.");
    // Fără lanțuri de duplicate: altfel „rezolvarea părintelui” ar trebui să
    // urce recursiv, iar notificarea raportorilor ar deveni ambiguă.
    if (parinte.parent_ticket_id !== null) {
      throw businessRule("Tichetul-părinte este el însuși un duplicat. Alegeți originalul.");
    }

    // Legătura de duplicat e câmp păzit, iar tichetul-copil poate să fi fost
    // șters sau scos din raza noastră între verificarea părintelui de mai sus
    // și scrierea asta — ambele, zero rânduri fără eroare.
    const { data: marcat, error } = await db
      .from("tickets")
      .update({ parent_ticket_id: input.parent_ticket_id })
      .eq("id", input.ticket_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    if (marcat === null) {
      throw businessRule(
        "Marcarea ca duplicat nu a fost salvată: tichetul nu mai este accesibil sau nu aveți dreptul de a-l prelucra. Reîncărcați pagina.",
      );
    }
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

    // Comentariul e deja publicat, deci tăcerea de aici e cea mai costisitoare
    // din modul: solicitantul ar citi un răspuns care anunță o schimbare de
    // stare ce nu s-a produs. Mesajul spune exact ce a rămas făcut și ce nu.
    const { data: mutatDeMacro, error } = await db
      .from("tickets")
      .update({ status: macro.status })
      .eq("id", input.ticket_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) throw error;
    if (mutatDeMacro === null) {
      throw businessRule(
        "Răspunsul a fost publicat, dar starea tichetului nu a putut fi schimbată: a fost mutat de altcineva între timp sau nu aveți dreptul de a-l prelucra. Reîncărcați pagina.",
      );
    }

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
