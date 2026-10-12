// src/app/(app)/mentenanta/iscir/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaAutorizatieSchema,
  idAutorizatieSchema,
  reinnoiesteAutorizatieSchema,
  suspendaAutorizatieSchema,
} from "@/schemas/maintenance";

import { traduEroare } from "../erori";

// Gesturile de pe autorizația ISCIR (0211, M7): corectarea, suspendarea cu
// motiv, ridicarea suspendării, reînnoirea ca rând nou, ștergerea logică.
// Înregistrarea rămâne în `../actions.ts` (`adaugaAutorizatieIscir`).
//
// Toate pe `maintenance:update`/team — aceeași poartă ca politica de UPDATE din
// bucla lui 0011 —, cu `.select()` după UPDATE: zero rânduri = autorizație
// ștearsă, reînnoită ori suspendată între timp, sau inaccesibilă (capcana #17),
// și se întoarce CONFLICT. Ce nu se poate face o spune garda din bază (P0001,
// tradus de `traduEroare`): editarea unui rând înlocuit, mutarea pe alt
// echipament, suspendarea fără motiv sau cu dată în viitor.
//
// Nimic de aici nu blochează un utilaj (cazul 38): avertizare, nu blocare.

type AutorizatieAtinsa = Readonly<{ id: string; equipment_id: string }>;

/**
 * Căile pe care le schimbă o autorizație: panoul (coada de scadențe și alerta
 * RSVTI), lista ISCIR și fișa echipamentului. Datele vin din `.select()`-ul
 * handlerului — adnotarea de pe `revalidate` decide `TData` (memoria
 * „revalidate fixează tipul”).
 */
const CAI_AUTORIZATIE = (d: AutorizatieAtinsa): readonly string[] => [
  "/mentenanta",
  "/mentenanta/iscir",
  `/mentenanta/echipamente/${d.equipment_id}`,
];

const MESAJ_SCHIMBATA =
  "Autorizația a fost ștearsă, reînnoită sau modificată între timp ori nu vă este accesibilă. Reîncărcați pagina.";

/**
 * Corectarea unei autorizații CURENTE. Rândul înlocuit nu se atinge (filtrul
 * `inlocuita_de_id is null`; garda l-ar refuza oricum), echipamentul nu e în
 * schemă. Suspendarea are gest separat: aici `suspendata_la` nu se trimite.
 */
export const actualizeazaAutorizatie = createAction({
  name: "maintenance.iscir.update",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: actualizeazaAutorizatieSchema,
  audit: {
    action: "update",
    entityType: "iscir_authorization",
    entityId: (input) => input.id,
    allow: [
      "id",
      "regim",
      "numar",
      "tip",
      "emitent",
      "emis_la",
      "valabil_pana",
      "scadenta_verificare_tehnica",
    ],
  },
  revalidate: (_input, data: AutorizatieAtinsa) => CAI_AUTORIZATIE(data),
  handler: async (ctx, input): Promise<AutorizatieAtinsa> => {
    const { id, ...campuri } = input;
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("iscir_authorizations")
      .update(campuri)
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .is("inlocuita_de_id", null)
      .select("id, equipment_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule(MESAJ_SCHIMBATA);
    return data;
  },
});

/**
 * Suspendarea, cu motiv (minimum 5 caractere, cerut și de gardă). Scoate
 * autorizația din scadențe și din coada panoului (0182/0211). Tranziția se
 * păzește în UPDATE: o autorizație deja suspendată întoarce zero rânduri.
 */
export const suspendaAutorizatie = createAction({
  name: "maintenance.iscir.suspend",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: suspendaAutorizatieSchema,
  audit: {
    action: "update",
    entityType: "iscir_authorization",
    entityId: (input) => input.id,
    allow: ["id", "suspendata_la", "motiv_suspendare"],
  },
  revalidate: (_input, data: AutorizatieAtinsa) => CAI_AUTORIZATIE(data),
  handler: async (ctx, input): Promise<AutorizatieAtinsa> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("iscir_authorizations")
      .update({ suspendata_la: input.suspendata_la, motiv_suspendare: input.motiv_suspendare })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .is("inlocuita_de_id", null)
      .is("suspendata_la", null)
      .select("id, equipment_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Autorizația e deja suspendată, a fost reînnoită sau ștearsă ori nu vă este accesibilă. Reîncărcați pagina.",
      );
    }
    return data;
  },
});

/**
 * Ridicarea suspendării. `reactivata_la` o pune garda (azi, ziua României),
 * nu acțiunea. Motivul ultimei suspendări rămâne pe rând, ca istoric.
 */
export const reactiveazaAutorizatie = createAction({
  name: "maintenance.iscir.reactivate",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: idAutorizatieSchema,
  audit: {
    action: "update",
    entityType: "iscir_authorization",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (_input, data: AutorizatieAtinsa) => CAI_AUTORIZATIE(data),
  handler: async (ctx, input): Promise<AutorizatieAtinsa> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("iscir_authorizations")
      .update({ suspendata_la: null })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .is("inlocuita_de_id", null)
      .not("suspendata_la", "is", null)
      .select("id, equipment_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Autorizația nu mai e suspendată, a fost reînnoită sau ștearsă ori nu vă este accesibilă. Reîncărcați pagina.",
      );
    }
    return data;
  },
});

/**
 * Reînnoirea (cazul 40): rând nou, legat de cel vechi prin `inlocuita_de_id`.
 * Trece prin `public.reinnoieste_autorizatie_iscir` (SECURITY INVOKER, 0211):
 * doar așa rândul vechi se marchează ÎNAINTEA inserării celui nou, ceea ce
 * permite păstrarea numărului de înregistrare. Politicile apelantului se aplică
 * întocmai; funcția întoarce id-ul rândului nou.
 */
export const reinnoiesteAutorizatie = createAction({
  name: "maintenance.iscir.renew",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: reinnoiesteAutorizatieSchema,
  audit: {
    action: "create",
    entityType: "iscir_authorization",
    entityId: (_input, data: AutorizatieAtinsa) => data.id,
    allow: ["id", "numar", "emitent", "emis_la", "valabil_pana", "scadenta_verificare_tehnica"],
  },
  revalidate: (_input, data: AutorizatieAtinsa) => CAI_AUTORIZATIE(data),
  handler: async (ctx, input): Promise<AutorizatieAtinsa> => {
    const db = await createServerSupabase();
    const { data: veche, error: eroareCitire } = await db
      .from("iscir_authorizations")
      .select("id, equipment_id")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;
    if (veche === null) {
      throw notFound("Autorizația nu a fost găsită, a fost ștearsă sau nu vă este accesibilă.");
    }

    const { data: idNou, error } = await db.rpc("reinnoieste_autorizatie_iscir", {
      p_autorizatie: input.id,
      p_valabil_pana: input.valabil_pana,
      p_numar: input.numar,
      p_emitent: input.emitent,
      p_emis_la: input.emis_la,
      p_scadenta_verificare_tehnica: input.scadenta_verificare_tehnica,
      p_conditii: input.conditii,
    });
    if (error !== null) traduEroare(error);
    return { id: idNou, equipment_id: veche.equipment_id };
  },
});

/**
 * Ștergerea logică a unei autorizații curente (introdusă din greșeală). Dacă
 * ea era reînnoirea altui rând, garda din bază îl readuce pe cel vechi în
 * scadențe — „am reînnoit greșit” se repară de aici. Rândul din registru
 * rămâne: registrul e append-only.
 */
export const stergeAutorizatie = createAction({
  name: "maintenance.iscir.delete",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: idAutorizatieSchema,
  audit: {
    action: "delete",
    entityType: "iscir_authorization",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (_input, data: AutorizatieAtinsa) => CAI_AUTORIZATIE(data),
  handler: async (ctx, input): Promise<AutorizatieAtinsa> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("iscir_authorizations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .is("inlocuita_de_id", null)
      .select("id, equipment_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule(MESAJ_SCHIMBATA);
    return data;
  },
});
