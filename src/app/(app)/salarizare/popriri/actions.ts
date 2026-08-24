// src/app/(app)/salarizare/popriri/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { inchidePoprireSchema, poprireSchema } from "@/schemas/payroll";

import { traduEroare } from "../erori";

const CAI_REVALIDARE = ["/salarizare/popriri", "/salarizare"];

/**
 * Deschide un dosar de urmărire silită.
 *
 * Tabela, politicile RLS, plafoanele legale (1/3 pentru o poprire, 1/2 pentru
 * popriri concurente) și motorul de calcul cu 37 de teste există din 0059 —
 * lipsea EXACT asta: o cale prin care un dosar să ajungă în bază. Până acum se
 * putea insera doar direct în Postgres, deci în practică popririle nu existau
 * pentru niciun utilizator al aplicației.
 *
 * `suma_recuperata` nu se trimite: e derivată din reținerile efectiv operate și
 * o recalculează triggerul din 0065.
 */
export const creeazaPoprire = createAction({
  name: "payroll.garnishment.create",
  feature: "payroll",
  permission: "payroll:create",
  minScope: "all",
  input: poprireSchema,
  audit: {
    action: "create",
    entityType: "payroll_garnishment",
    // `creditor` și `observatii` rămân în afara jurnalului: pot descrie situația
    // personală a angajatului (pensie alimentară, datorie bancară), iar
    // jurnalul e citibil de oricine are `audit:read`.
    allow: ["employee_id", "dosar", "tip_creanta", "prioritate", "data_inceput", "data_sfarsit"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("payroll_garnishments")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: input.employee_id,
        dosar: input.dosar,
        creditor: input.creditor,
        executor: input.executor,
        tip_creanta: input.tip_creanta,
        suma_totala: input.suma_totala,
        suma_lunara: input.suma_lunara,
        prioritate: input.prioritate,
        data_inceput: input.data_inceput,
        data_sfarsit: input.data_sfarsit,
        observatii: input.observatii,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Dosarul de poprire nu a putut fi creat.");
    }
    return { id: data.id };
  },
});

/**
 * Închide sau redeschide manual un dosar.
 *
 * Stingerea NORMALĂ e automată: triggerul din 0065 pune `activa = false` când
 * suma recuperată atinge datoria. Acțiunea asta e pentru celelalte cazuri — o
 * poprire ridicată de executor înainte de achitare, sau una închisă din greșeală.
 */
export const inchidePoprire = createAction({
  name: "payroll.garnishment.close",
  feature: "payroll",
  permission: "payroll:update",
  minScope: "all",
  input: inchidePoprireSchema,
  audit: {
    action: "update",
    entityType: "payroll_garnishment",
    entityId: (input) => input.id,
    allow: ["id", "activa"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    // Capcana 17: un UPDATE respins de clauza USING afectează ZERO rânduri,
    // FĂRĂ eroare. `.select()` e singura dovadă că s-a schimbat ceva.
    const { data, error } = await ctx.supabase
      .from("payroll_garnishments")
      .update({ activa: input.activa })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Dosarul nu a fost găsit sau nu aveți dreptul să îl modificați.");
    }
    return null;
  },
});
