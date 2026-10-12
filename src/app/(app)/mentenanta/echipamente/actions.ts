// src/app/(app)/mentenanta/echipamente/actions.ts
"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { OptiuneSelect } from "@/lib/queries/maintenance";
import {
  anuleazaCitireSchema,
  citiriLotSchema,
  corecteazaCitireSchema,
  schimbaStareEchipamentSchema,
  stergeEchipamentSchema,
} from "@/schemas/maintenance";

import { traduEroare } from "../erori";

// ── Ce e în fișierul ăsta ────────────────────────────────────────────────────
//
// Ciclul de viață al echipamentului (0182): starea (casare, conservare,
// repunere), ștergerea logică, corecția și anularea citirilor de contor,
// citirile în lot și selectorul de puncte de lucru. Crearea și editarea fișei
// rămân în `../actions.ts`.
//
// Numele exact `actions.ts` e singurul în care ESLint admite clientul admin —
// folosit aici o singură dată, la punctele de lucru (vezi acolo DE CE).

const CAI_ECHIPAMENT = (id: string): readonly string[] => [
  "/mentenanta",
  "/mentenanta/echipamente",
  `/mentenanta/echipamente/${id}`,
  "/mentenanta/contoare",
];

// ── Starea ───────────────────────────────────────────────────────────────────

/**
 * Casare, conservare, repunere în funcțiune. Regulile stau în
 * `internal.equipment_stare_guard`: casarea cere motiv și refuză cât există
 * sesizări deschise; planurile se dezactivează; conservarea scoate planurile din
 * scadențe. Aici doar UPDATE-ul condiționat pe starea curentă (capcana #17).
 */
export const schimbaStareEchipament = createAction({
  name: "maintenance.equipment.status",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: schimbaStareEchipamentSchema,
  audit: {
    action: "update",
    entityType: "equipment",
    entityId: (input) => input.id,
    allow: ["id", "status", "casat_la"],
  },
  revalidate: (input) => CAI_ECHIPAMENT(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string; status: string }>> => {
    const db = await createServerSupabase();
    const casare = input.status === "casat";
    const { data, error } = await db
      .from("equipment")
      .update({
        status: input.status,
        casat_la: casare ? input.casat_la : null,
        motiv_casare: casare ? input.motiv_casare : null,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .neq("status", input.status)
      .select("id, status")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Echipamentul nu a fost găsit, nu vă este accesibil sau e deja în starea aleasă. Reîncărcați pagina.",
      );
    }
    return { id: data.id, status: data.status };
  },
});

/**
 * Ștergerea logică, cu codul tastat. `maintenance:delete`/all: numai
 * administratorul organizației. Garda refuză cât există sesizări deschise și
 * șterge logic planurile și contoarele; componentele se dezleagă.
 *
 * `equipment_select` NU filtrează `deleted_at`, deci UPDATE-ul pe `deleted_at`
 * întoarce rândul (capcana #48 nu mușcă aici).
 */
export const stergeEchipament = createAction({
  name: "maintenance.equipment.delete",
  feature: "maintenance",
  permission: "maintenance:delete",
  minScope: "all",
  input: stergeEchipamentSchema,
  audit: {
    action: "delete",
    entityType: "equipment",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/mentenanta", "/mentenanta/echipamente", "/mentenanta/contoare"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data: echipament, error: eroareCitire } = await db
      .from("equipment")
      .select("id, cod")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;
    if (echipament === null) throw notFound("Echipamentul nu a fost găsit sau e deja șters.");
    if (echipament.cod.trim().toLowerCase() !== input.confirmare.trim().toLowerCase()) {
      throw invalidInput("Codul tastat nu se potrivește cu codul echipamentului.", {
        confirmare: ["Tastați exact codul echipamentului, așa cum apare pe fișă."],
      });
    }

    const { data, error } = await db
      .from("equipment")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Echipamentul nu a fost găsit sau e deja șters.");
    return { id: data.id };
  },
});

// ── Citirile de contor: corecție, anulare, lot ───────────────────────────────

export const corecteazaCitire = createAction({
  name: "maintenance.meter.update",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: corecteazaCitireSchema,
  audit: {
    action: "update",
    entityType: "equipment_meter",
    entityId: (input) => input.id,
    allow: ["id", "citire", "data_citirii"],
  },
  revalidate: ["/mentenanta", "/mentenanta/echipamente", "/mentenanta/contoare"],
  handler: async (ctx, input): Promise<Readonly<{ id: string; equipment_id: string }>> => {
    // Garda `ssm_meter_guard` verifică ambii vecini (0180): o corecție care ar
    // face citirea următoare „regres” e refuzată cu P0001, tradus.
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("equipment_meters")
      .update({
        citire: input.citire,
        data_citirii: input.data_citirii,
        observatii: input.observatii,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, equipment_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Citirea nu a fost găsită sau a fost deja anulată.");
    return { id: data.id, equipment_id: data.equipment_id };
  },
});

export const anuleazaCitire = createAction({
  name: "maintenance.meter.cancel",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: anuleazaCitireSchema,
  audit: {
    action: "delete",
    entityType: "equipment_meter",
    entityId: (input) => input.id,
    allow: ["id", "motiv"],
  },
  revalidate: ["/mentenanta", "/mentenanta/echipamente", "/mentenanta/contoare"],
  handler: async (ctx, input): Promise<Readonly<{ id: string; equipment_id: string }>> => {
    // Anulare LOGICĂ: rândul iese din serie (garda îl ignoră), iar motivul
    // rămâne pe el. `equipment_meters_select` nu filtrează `deleted_at`.
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("equipment_meters")
      .update({ deleted_at: new Date().toISOString(), observatii: `Anulată: ${input.motiv}` })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id, equipment_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Citirea nu a fost găsită sau a fost deja anulată.");
    return { id: data.id, equipment_id: data.equipment_id };
  },
});

export interface RezultatCitireLot {
  readonly equipment_id: string;
  readonly tip: string;
  readonly ok: boolean;
  readonly mesaj: string | null;
}

/**
 * Citirile în lot, de pe pagina „Contoare”: fiecare rând e un INSERT separat,
 * judecat de gardă pe cont propriu, iar raportul spune ce a intrat și ce nu.
 * Nu e tranzacție (PostgREST nu oferă una peste mai multe cereri): o citire
 * refuzată nu le anulează pe celelalte — exact ce vrea omul care a introdus
 * douăzeci de valori și a greșit una.
 */
export const inregistreazaCitiri = createAction({
  name: "maintenance.meter.batch",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: citiriLotSchema,
  audit: {
    action: "create",
    entityType: "equipment_meter",
    allow: ["data_citirii"],
  },
  revalidate: ["/mentenanta", "/mentenanta/contoare", "/mentenanta/echipamente"],
  handler: async (
    ctx,
    input,
  ): Promise<
    Readonly<{ reusite: number; refuzate: number; randuri: readonly RezultatCitireLot[] }>
  > => {
    const db = await createServerSupabase();
    const randuri: RezultatCitireLot[] = [];
    for (const c of input.citiri) {
      const { error } = await db.from("equipment_meters").insert({
        organization_id: ctx.tenant.organizationId,
        equipment_id: c.equipment_id,
        tip: c.tip,
        citire: c.citire,
        data_citirii: input.data_citirii,
        sursa: "lot",
      });
      if (error === null) {
        randuri.push({ equipment_id: c.equipment_id, tip: c.tip, ok: true, mesaj: null });
        continue;
      }
      // Mesajul gărzii (P0001) merge la om ca atare; 42501 înseamnă „nu e al dvs.”.
      let mesaj = "Citirea a fost refuzată.";
      try {
        traduEroare(error);
      } catch (e) {
        mesaj = e instanceof Error && e.message.length > 0 ? e.message.slice(0, 300) : mesaj;
        if (error.code === "42501") {
          mesaj = "Nu aveți dreptul de a înregistra citiri pe acest echipament.";
        }
      }
      randuri.push({ equipment_id: c.equipment_id, tip: c.tip, ok: false, mesaj });
    }
    const reusite = randuri.filter((r) => r.ok).length;
    return { reusite, refuzate: randuri.length - reusite, randuri };
  },
});

// ── Punctele de lucru pentru selector ────────────────────────────────────────

/**
 * Lista punctelor de lucru pentru fișa echipamentului.
 *
 * `createAdminSupabase()` obligatoriu: `puncte_lucru_select` (0030) cere
 * `departments:read`, pe care `manager` (și orice rol căruia firma îi dă
 * `maintenance:update`) nu-l are — selectorul ar fi tăcut gol, iar echipamentul
 * s-ar salva fără punct de lucru fără ca nimeni să afle de ce. Filtrul pe
 * organizație e explicit; se întorc doar id și denumire.
 */
export const optiuniPuncteLucru = createAction({
  name: "maintenance.equipment.sites",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: z.object({}),
  audit: { action: "view", entityType: "puncte_lucru", allow: [] },
  handler: async (ctx): Promise<readonly OptiuneSelect[]> => {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("puncte_lucru")
      .select("id, denumire")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire", { ascending: true })
      .limit(200);
    if (error !== null) throw error;
    return (data ?? []).map((p) => ({ id: p.id, nume: p.denumire }));
  },
});
