// src/app/(app)/flota/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  alimentareSchema,
  confirmaAnomalieSchema,
  decizieFoaieSchema,
  documentVehiculSchema,
  foaieNouaSchema,
  trimiteFoaieSchema,
  vehiculNouSchema,
} from "@/schemas/fleet";

import { traduEroare } from "./erori";

export const creeazaVehicul = createAction({
  name: "fleet.vehicle.create",
  feature: "fleet",
  permission: "vehicles:create",
  minScope: "all",
  input: vehiculNouSchema,
  audit: {
    action: "create",
    entityType: "vehicle",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "nr_inmatriculare",
      "marca",
      "model",
      "vin",
      "categorie",
      "tip_combustibil",
      "an_fabricatie",
      "employee_id",
      "department_id",
      "data_achizitie",
    ],
  },
  revalidate: ["/flota"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `status: "activ"` explicit — politica de INSERT îl cere. Un vehicul nou nu
    // poate intra direct „vândut" fără să fi existat vreodată în parc.
    // `created_by` ȘI `updated_by` sunt cerute nominal de WITH CHECK.
    const { data, error } = await db
      .from("vehicles")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        status: "activ",
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

/**
 * Adăugarea ȘI reînnoirea unui document — o singură acțiune, un singur INSERT.
 *
 * Reînnoirea NU e un UPDATE pe rândul vechi și nici o ștergere urmată de
 * inserare. Polița veche rămâne, ca istoric, iar `internal.vdoc_dupa` recalculează
 * care e cea curentă: cea cu `expira_la` MAXIM, nu ultima inserată. Distincția
 * contează la introducerea retroactivă a unui document vechi, care nu are voie să
 * devină curent.
 *
 * De aceea `este_curent` nu se trimite niciodată de client: triggerul îl forțează
 * pe `false` la intrare și apoi îl recalculează pe tot grupul.
 */
export const adaugaDocument = createAction({
  name: "fleet.document.add",
  feature: "fleet",
  permission: "vehicles:create",
  minScope: "all",
  input: documentVehiculSchema,
  audit: {
    action: "create",
    entityType: "vehicle_document",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["vehicle_id", "document_type_id", "numar", "emitent", "valabil_de_la", "expira_la"],
  },
  revalidate: ["/flota"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_documents")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const creeazaFoaie = createAction({
  name: "fleet.trip.create",
  feature: "fleet",
  permission: "trip_sheets:create",
  minScope: "own",
  input: foaieNouaSchema,
  audit: {
    action: "create",
    entityType: "trip_sheet",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["vehicle_id", "employee_id", "plecare_la", "km_plecare", "traseu", "scop"],
  },
  revalidate: ["/flota/foi"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // NU se trimit: `status` (WITH CHECK cere „draft"), `numar`, `trimis_la`,
    // `aprobat_de`, `aprobat_la`, `km_parcursi` (GENERATED ALWAYS).
    const { data, error } = await db
      .from("trip_sheets")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        status: "draft",
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const trimiteFoaie = createAction({
  name: "fleet.trip.submit",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: trimiteFoaieSchema,
  audit: {
    action: "update",
    entityType: "trip_sheet",
    entityId: (input) => input.id,
    allow: ["id", "sosire_la", "km_sosire"],
  },
  revalidate: ["/flota/foi", "/flota/aprobari"],
  handler: async (ctx, input): Promise<Readonly<{ id: string; anomalie: string | null }>> => {
    const db = await createServerSupabase();
    // `.select()` obligatoriu: `foi_update` cere `poate_scrie_foaie` SAU
    // aprobare pe echipă. Un șofer care încearcă să închidă foaia altcuiva e
    // respins de `USING` — ZERO rânduri, FĂRĂ eroare (capcana 17), iar ecranul
    // ar raporta cursa închisă.
    const { data: foaieInchisa, error } = await db
      .from("trip_sheets")
      .update({
        status: "trimis",
        sosire_la: input.sosire_la,
        km_sosire: input.km_sosire,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (foaieInchisa === null) {
      throw businessRule("Foaia de parcurs nu a putut fi închisă. Verificați dreptul de acces.");
    }

    // Un REGRES de kilometraj a fost deja refuzat de trigger, cu P0001 — nu
    // ajungem aici. Un SALT însă trece, și e corect că trece: cea mai frecventă
    // explicație e o foaie de parcurs necompletată, iar a bloca salvarea l-ar
    // împinge pe șofer să falsifice cifra ca să poată salva. Îl semnalăm.
    const { data: anomalii } = await db
      .from("odometer_anomalies")
      .select("tip, km_asteptat, km_declarat")
      .eq("trip_sheet_id", input.id)
      .eq("tip", "salt")
      .is("confirmat_la", null)
      .limit(1);

    const salt = anomalii?.[0];
    return {
      id: input.id,
      anomalie:
        salt === undefined
          ? null
          : `Kilometrajul declarat (${salt.km_declarat} km) este cu ${salt.km_declarat - salt.km_asteptat} km peste ultimul cunoscut (${salt.km_asteptat} km). Foaia a fost salvată, dar diferența apare la anomalii până când cineva o confirmă.`,
    };
  },
});

export const decideFoaie = createAction({
  name: "fleet.trip.decide",
  feature: "fleet",
  permission: "trip_sheets:approve",
  minScope: "team",
  input: decizieFoaieSchema,
  audit: {
    // `audit_action` nu are valoarea „approve"; decizia asupra unei foi e un
    // UPDATE, iar ce anume s-a decis stă în payload-ul auditat.
    action: "update",
    entityType: "trip_sheet",
    entityId: (input) => input.id,
    allow: ["id", "decizie", "motiv_respingere"],
  },
  revalidate: ["/flota/foi", "/flota/aprobari"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    if (input.decizie === "respins" && (input.motiv_respingere ?? "").trim().length === 0) {
      throw businessRule(
        "Respingerea are nevoie de un motiv: șoferul trebuie să știe ce anume să corecteze.",
      );
    }

    const db = await createServerSupabase();
    // `aprobat_de` și `aprobat_la` NU se trimit — le pune triggerul din auth.uid().
    // Autoaprobarea e refuzată tot acolo, indiferent de scope: într-o firmă mică
    // administratorul chiar e și șofer, iar foaia e document justificativ pentru
    // consumul de combustibil dedus fiscal.
    const { data: foaieDecisa, error } = await db
      .from("trip_sheets")
      .update({
        status: input.decizie,
        motiv_respingere: input.decizie === "respins" ? input.motiv_respingere : null,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    // Managerul are `trip_sheets:approve = team`: foaia unui angajat din afara
    // echipei lui trece de `WITH CHECK`, dar cade pe `USING` — zero rânduri,
    // fără eroare. Fără verificarea asta, aprobarea ar părea făcută.
    if (foaieDecisa === null) {
      throw businessRule(
        "Decizia nu a fost înregistrată. Foaia nu vă aparține sau a fost deja decisă.",
      );
    }

    return { id: input.id };
  },
});

export const adaugaAlimentare = createAction({
  name: "fleet.fuel.add",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: alimentareSchema,
  audit: {
    action: "create",
    entityType: "fuel_entry",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["trip_sheet_id", "litri", "cost", "statie", "numar_bon", "alimentat_la", "plin"],
  },
  revalidate: ["/flota/foi"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `pret_litru` e GENERATED ALWAYS — nu se trimite. Din 0018 e calculată cu
    // gardă pe zero, deci un litraj zero dă un mesaj de business, nu
    // „division by zero" în engleză.
    const { data, error } = await db
      .from("fuel_entries")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

/**
 * Confirmarea unei anomalii de kilometraj.
 *
 * Se trimit DOAR `confirmat_la` și `nota`. Cifrele constatate — km așteptat, km
 * declarat, diferența — rămân neatinse: `internal.anomalii_protejeaza` le
 * respinge modificarea, fiindcă o anomalie e o constatare, nu o opinie. Cine o
 * confirmă adaugă explicația, nu rescrie faptul.
 */
export const confirmaAnomalie = createAction({
  name: "fleet.anomaly.confirm",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "team",
  input: confirmaAnomalieSchema,
  audit: {
    action: "update",
    entityType: "odometer_anomaly",
    entityId: (input) => input.id,
    allow: ["id", "nota"],
  },
  revalidate: ["/flota/anomalii"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { error } = await db
      .from("odometer_anomalies")
      .update({ confirmat_la: new Date().toISOString(), nota: input.nota })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (error !== null) traduEroare(error);

    return { id: input.id };
  },
});
