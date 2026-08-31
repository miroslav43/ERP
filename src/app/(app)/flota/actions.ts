// src/app/(app)/flota/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaDocumentSchema,
  actualizeazaVehiculSchema,
  alimentareSchema,
  confirmaAnomalieSchema,
  decizieFoaieSchema,
  documentVehiculSchema,
  foaieNouaSchema,
  stergeDocumentSchema,
  stergeVehiculSchema,
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
 * Modificarea unui vehicul, inclusiv ieșirea lui din parc.
 *
 * ── DE CE `minScope: "all"` ȘI NU „team" ─────────────────────────────────────
 * `vehicule_update` cere literal `app.has_permission(…,'vehicles','update') =
 * 'all'`. O poartă mai largă în aplicație ar lăsa un rol să treacă de acțiune și
 * să fie respins tăcut de `USING` — zero rânduri, fără eroare, cu mesaj de
 * reușită pe ecran. Poarta aplicației trebuie să fie EXACT cea a bazei.
 *
 * ── CE NU SE TRIMITE ─────────────────────────────────────────────────────────
 * `km_curent` (îl ridică triggerul de aprobare a foilor), `data_iesire` (o pune
 * `internal.vehicles_normalizeaza` din `status`) și `deleted_at`.
 *
 * `updated_by` se trimite EXPLICIT: pe `vehicles` nu există trigger de actor —
 * singurul atașat e `vehicles_set_updated_at` — iar `WITH CHECK` îl cere
 * nominal. Omiterea lui dă 42501, adică „Nu aveți dreptul…", care trimite
 * investigația exact în direcția greșită (capcana #23).
 */
export const actualizeazaVehicul = createAction({
  name: "fleet.vehicle.update",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: actualizeazaVehiculSchema,
  audit: {
    action: "update",
    entityType: "vehicle",
    entityId: (input) => input.id,
    allow: [
      "id",
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
      "status",
      "motiv_iesire",
    ],
  },
  revalidate: (input) => ["/flota", `/flota/${input.id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;

    const { data, error } = await db
      .from("vehicles")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound(
        "Vehiculul nu a fost găsit sau nu aveți dreptul de a-l modifica. Reîncărcați parcul auto.",
      );
    }

    return { id: data.id };
  },
});

/**
 * Ștergerea vehiculului. Logică, prin `deleted_at` — nu există politică DELETE
 * și niciun grant de DELETE pe tabelă (0012, secțiunea 11).
 *
 * ── DE CE MERGE, DEȘI PARE CĂ N-AR TREBUI ────────────────────────────────────
 * `vehicule_update` are `deleted_at is null` în `USING`, dar NU în `WITH CHECK`:
 * rândul dinainte trebuie să fie viu, cel de după poate fi mort. Iar `0018` §F2
 * a scos `deleted_at is null` din `vehicule_select` tocmai fiindcă Postgres
 * reverifică vizibilitatea rândului NOU prin politicile de SELECT — rândul
 * tocmai șters devenea invizibil pentru propria politică și UPDATE-ul pica cu
 * 42501, pentru orice rol.
 *
 * Ce se întâmplă în urmă: `internal.vehicles_dupa` vede că `deleted_at` s-a
 * schimbat și cheamă `flota_resincronizeaza_vehicul`, care scoate scadențele
 * vehiculului din semafor (`is_active = false` în `expirables`) fără să șteargă
 * istoricul. Foile de parcurs și documentele rămân în bază.
 *
 * `vehicles:delete` NU e cheia folosită, deși seed-ul din 0002 o acordă lui
 * `super_admin` și `org_admin`: nicio politică RLS nu o consultă, deci un rol
 * care ar avea-o fără `vehicles:update` ar trece de poartă și ar fi respins
 * tăcut de bază. Poarta e cea pe care o verifică efectiv Postgres.
 */
export const stergeVehicul = createAction({
  name: "fleet.vehicle.remove",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: stergeVehiculSchema,
  audit: {
    action: "delete",
    entityType: "vehicle",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/flota"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();

    const { data, error } = await db
      .from("vehicles")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      // Garda contra dublei ștergeri: fără ea, un al doilea clic ar suprascrie
      // data ștergerii și ar raporta din nou reușită.
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Vehiculul nu a fost șters: fusese deja scos din parc sau nu aveți dreptul de a-l administra. Reîncărcați parcul auto.",
      );
    }

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
    allow: ["vehicle_id", "document_type_id", "emitent", "valabil_de_la", "expira_la"],
  },
  revalidate: (input) => ["/flota", `/flota/${input.vehicle_id}`],
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

/**
 * Corectarea unui document deja introdus.
 *
 * ── ASTA NU E REÎNNOIRE ──────────────────────────────────────────────────────
 * Reînnoirea rămâne `adaugaDocument`: polița nouă e un rând nou, cel vechi
 * rămâne ca istoric. Acțiunea de aici e pentru cifra greșită — data pusă
 * anapoda, emitentul scris pe jumătate, costul uitat.
 *
 * `este_curent` nu se trimite nici aici. `internal.vdoc_inainte` îl păstrează pe
 * cel vechi la UPDATE (`new.este_curent := old.este_curent`), iar `vdoc_dupa`
 * recalculează pe urmă tot grupul: dacă tocmai ai mutat data de expirare mai
 * departe decât a documentului curent, acesta devine curent singur.
 *
 * `document_type_id` E modificabil — cine a ales „RCA" în loc de „CASCO" trebuie
 * să poată repara fără să șteargă și să reintroducă. `vdoc_dupa` resincronizează
 * AMÂNDOUĂ grupurile în cazul ăsta, vechiul și noul.
 */
export const actualizeazaDocument = createAction({
  name: "fleet.document.update",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: actualizeazaDocumentSchema,
  audit: {
    action: "update",
    entityType: "vehicle_document",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id", "document_type_id", "emitent", "valabil_de_la", "expira_la"],
  },
  revalidate: (input) => ["/flota", `/flota/${input.vehicle_id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // `vehicle_id` NU se scrie: e în schemă doar ca `revalidate` să poată
    // compune calea fișei. Mutarea unui document de pe o mașină pe alta nu e o
    // corectură, e o altă operațiune.
    const { id, vehicle_id: _vehicul, ...campuri } = input;

    const { data, error } = await db
      .from("vehicle_documents")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound(
        "Documentul nu a fost găsit sau nu aveți dreptul de a-l modifica. Reîncărcați fișa vehiculului.",
      );
    }

    return { id: data.id };
  },
});

/**
 * Ștergerea logică a unui document.
 *
 * Efectul cel mai important nu se vede în codul de aici: `vdoc_dupa` rulează pe
 * UPDATE și cheamă `flota_sincronizeaza_grup`, care recalculează documentul
 * curent din rândurile RĂMASE. Ștergi RCA-ul curent, iar cel de anul trecut îi
 * ia locul automat, cu semaforul și rândul din `expirables` mutate odată cu el.
 * Dacă nu mai rămâne niciunul, scadența se închide logic — istoricul nu se
 * pierde.
 *
 * `0018` §F5 a reparat aici un defect subtil: steagul `este_curent` rămânea
 * agățat pe rândul șters, fiindcă UPDATE-ul de stingere din funcție filtra pe
 * `deleted_at is null`. Rezultau două rânduri cu `este_curent = true`, pe care
 * indexul unic parțial nu le prindea.
 */
export const stergeDocument = createAction({
  name: "fleet.document.remove",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: stergeDocumentSchema,
  audit: {
    action: "delete",
    entityType: "vehicle_document",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => ["/flota", `/flota/${input.vehicle_id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();

    const { data, error } = await db
      .from("vehicle_documents")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Documentul nu a fost șters: fusese deja scos sau nu aveți dreptul de a administra parcul auto. Reîncărcați fișa vehiculului.",
      );
    }

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
    // A vedea o anomalie și a o confirma sunt două drepturi diferite:
    // `anomalii_select` (rescrisă în 0018) cere doar `app.poate_vedea_vehicul`,
    // deci `vehicles:read`, pe când `anomalii_update` cere
    // `app.can(org,'vehicles','update','team')`. Cine o vede și n-o poate
    // confirma e respins de `USING` — zero rânduri, fără eroare — iar lista ar
    // rămâne cu anomalia neconfirmată după un mesaj de reușită.
    const { data: anomalieConfirmata, error } = await db
      .from("odometer_anomalies")
      .update({ confirmat_la: new Date().toISOString(), nota: input.nota })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (anomalieConfirmata === null) {
      throw businessRule(
        "Confirmarea nu a fost înregistrată: anomalia a fost ștearsă între timp sau nu aveți dreptul de a opera vehiculele acestei echipe. Reîncărcați lista de anomalii.",
      );
    }

    return { id: input.id };
  },
});
