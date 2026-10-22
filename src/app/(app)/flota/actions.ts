// src/app/(app)/flota/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, forbidden, invalidInput, notFound } from "@/lib/actions/errors";
import { verificaJeton, type PropunereSemnata } from "@/lib/fleet/jeton-bon";
import { masoaraObiectul } from "@/lib/storage/masoara-obiectul";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { BUCKET_FLOTA, caleFlotaValida, verificaFisierFlota } from "@/domain/fleet/fisiere";
import {
  actualizeazaAlimentareSchema,
  actualizeazaDocumentSchema,
  actualizeazaFoaieSchema,
  actualizeazaVehiculSchema,
  alimentareSchema,
  alocareSchema,
  incheieAlocareSchema,
  stergeAlocareSchema,
  confirmaAnomalieSchema,
  corecteazaKilometrajSchema,
  decizieFoaieSchema,
  documentVehiculSchema,
  foaieNouaSchema,
  redeschideFoaieSchema,
  retrageFoaieSchema,
  stergeAlimentareSchema,
  stergeDocumentSchema,
  stergeFoaieSchema,
  stergeVehiculSchema,
  trimiteFoaieSchema,
  vehiculNouSchema,
} from "@/schemas/fleet";

import { traduEroare, traduEroareAlocare } from "./erori";

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
      "masa_maxima_kg",
      "km_curent",
      "department_id",
      "pool",
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
 * Modificarea unui vehicul. Ieșirea din parc NU mai trece pe aici: din 0218,
 * garda `vehicles_iesire_garda` refuză cu P0001 orice trecere a statusului spre
 * sau dinspre `vandut`/`casat` în afara fluxului `scoateDinParc` /
 * `anuleazaIesirea` (`flota/[id]/iesire/actions.ts`).
 *
 * ── DE CE `minScope: "all"` ȘI NU „team" ─────────────────────────────────────
 * `vehicule_update` cere literal `app.has_permission(…,'vehicles','update') =
 * 'all'`. O poartă mai largă în aplicație ar lăsa un rol să treacă de acțiune și
 * să fie respins tăcut de `USING` — zero rânduri, fără eroare, cu mesaj de
 * reușită pe ecran. Poarta aplicației trebuie să fie EXACT cea a bazei.
 *
 * ── CE NU SE TRIMITE ─────────────────────────────────────────────────────────
 * `km_curent` (îl ridică triggerul de aprobare a foilor), `data_iesire` (o pune
 * `internal.vehicles_normalizeaza` din `status`), `deleted_at` și, din 0173,
 * `employee_id`: șoferul se schimbă doar prin `alocaVehicul`, iar baza refuză
 * scrierea directă.
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
      "masa_maxima_kg",
      "department_id",
      "pool",
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
 * Corectura kilometrajului de bord.
 *
 * Singurul drum prin care `km_curent` se schimbă din aplicație. Altfel îl
 * ridică doar aprobarea foilor (`internal.foi_parcurs_dupa`). Motivul nu se
 * scrie în bază: nu există coloană pentru el. Rămâne în audit, alături de
 * cifra nouă, iar „cine a mutat kilometrajul și de ce” se citește de acolo.
 *
 * Coborârea e permisă: corectura e tocmai pentru cifra greșită de la creare.
 * Nu deschide nicio portiță la foi, fiindcă triggerul de regres compară cu
 * `greatest(ultima foaie aprobată, km_curent)`. Kilometrajul unei foi aprobate
 * rămâne prag, oricât de jos s-ar pune `km_curent`.
 */
export const corecteazaKilometraj = createAction({
  name: "fleet.vehicle.odometer",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: corecteazaKilometrajSchema,
  audit: {
    action: "update",
    entityType: "vehicle",
    entityId: (input) => input.id,
    allow: ["id", "km_curent", "motiv"],
  },
  revalidate: (input) => ["/flota", `/flota/${input.id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();

    const { data, error } = await db
      .from("vehicles")
      .update({ km_curent: input.km_curent, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound(
        "Vehiculul nu a fost găsit sau nu aveți dreptul de a-l modifica. Reîncărcați fișa vehiculului.",
      );
    }

    return { id: data.id };
  },
});

// ── Alocări (0173) ──────────────────────────────────────────────────────────

/**
 * Predarea vehiculului unui șofer.
 *
 * Un singur INSERT. Dacă vehiculul avea deja o alocare deschisă,
 * `internal.alocari_inainte` o închide în aceeași instrucțiune, la momentul
 * predării și cu `km_predare` ca restituire. Apoi `alocari_dupa` mută
 * `vehicles.employee_id`, iar odată cu el responsabilul scadențelor din
 * `expirables`. Aplicația nu face niciunul dintre acești pași: două apeluri ar
 * putea lăsa vehiculul pe jumătate predat.
 *
 * `minScope: "all"`, fiindcă `alocari_insert` cere literal
 * `has_permission(…,'vehicles','update') = 'all'`.
 */
export const alocaVehicul = createAction({
  name: "fleet.assignment.create",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: alocareSchema,
  audit: {
    action: "create",
    entityType: "vehicle_assignment",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["vehicle_id", "employee_id", "de_la", "km_predare", "folosinta_personala"],
  },
  revalidate: (input) => ["/flota", `/flota/${input.vehicle_id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_assignments")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareAlocare(error);

    return { id: data.id };
  },
});

/**
 * Restituirea: alocarea deschisă se încheie, iar vehiculul rămâne fără șofer.
 *
 * Filtrul `.is("pana_la", null)` e garda contra dublului clic. O alocare deja
 * încheiată nu se mai mută (o refuză și baza). Zero rânduri înseamnă CONFLICT,
 * nu reușită.
 */
export const incheieAlocarea = createAction({
  name: "fleet.assignment.close",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: incheieAlocareSchema,
  audit: {
    action: "update",
    entityType: "vehicle_assignment",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id", "pana_la", "km_restituire"],
  },
  revalidate: (input) => ["/flota", `/flota/${input.vehicle_id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_assignments")
      .update({
        pana_la: input.pana_la,
        km_restituire: input.km_restituire,
        ...(input.observatii === null ? {} : { observatii: input.observatii }),
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("pana_la", null)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAlocare(error);
    if (data === null) {
      throw businessRule(
        "Alocarea nu a fost încheiată: fusese deja încheiată sau nu aveți dreptul de a administra parcul auto. Reîncărcați fișa vehiculului.",
      );
    }

    return { id: data.id };
  },
});

/**
 * Ștergerea logică a unei alocări GREȘITE: alt șofer, altă zi.
 *
 * Nu e restituire: istoricul pierde rândul. Dacă alocarea era cea deschisă,
 * sincronizarea lasă vehiculul fără șofer.
 */
export const stergeAlocarea = createAction({
  name: "fleet.assignment.remove",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  input: stergeAlocareSchema,
  audit: {
    action: "delete",
    entityType: "vehicle_assignment",
    entityId: (input) => input.id,
    allow: ["id", "vehicle_id"],
  },
  revalidate: (input) => ["/flota", `/flota/${input.vehicle_id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("vehicle_assignments")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAlocare(error);
    if (data === null) {
      throw businessRule(
        "Alocarea nu a fost ștearsă: fusese deja ștearsă sau nu aveți dreptul de a administra parcul auto. Reîncărcați fișa vehiculului.",
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

/**
 * Rutele portalului atinse de orice mișcare pe o foaie (0199, „Mașina mea”).
 *
 * Șoferul își urmărește foile din portal. Fără căile astea, își închide foaia
 * și se întoarce la o listă în care apare tot „în curs”: nu e o eroare, e
 * cache-ul de Router, iar tăcerea lui e felul în care defectul trece de
 * review (aceeași regulă ca `CAI_PORTAL_DIURNA` din `diurna/actions.ts`).
 */
const CAI_PORTAL_MASINA: readonly string[] = ["/portal", "/portal/masina-mea"];

/**
 * Fișa PRINCIPALĂ a apelantului, sau `null` când contul n-are una.
 *
 * Principala, nu prima găsită: `app.current_employee_id` (prin care trec
 * ramurile `own` ale politicilor de flotă) o cere pe ea. O fișă secundară ar
 * trece de acțiune și ar cădea pe `foi_insert` cu 42501, adică „nu aveți
 * dreptul” pentru un om care tocmai a primit dreptul.
 *
 * Citită prin clientul utilizatorului, fără ocolirea RLS: din 0023 angajatul
 * își vede propria fișă (`employees:read = own`), iar echipa managerului îl
 * include pe el însuși.
 */
async function fisaProprieFoaie(organizationId: string, userId: string): Promise<string | null> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("employees")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle<{ readonly id: string }>();
  if (error !== null) throw error;
  return data?.id ?? null;
}

/**
 * Foaia nouă, ca ciornă.
 *
 * ── CINE E ȘOFERUL (0199) ───────────────────────────────────────────────────
 * Cu `trip_sheets:create = all` (administratorul), șoferul se alege din listă.
 * Sub `all` (angajatul și managerul, `own`), nu se alege: e fișa proprie,
 * rezolvată AICI, pe server. Un id trimis din client care nu e chiar fișa
 * apelantului e o foaie în numele altcuiva și se refuză înainte de bază —
 * `foi_insert` ar refuza-o oricum (`app.poate_crea_foaie`), dar cu 42501, adică
 * un „nu aveți dreptul” care nu spune ce anume.
 *
 * Vehiculul îl judecă baza: sub `all`, `internal.foi_parcurs_inainte` cere o
 * mașină `pool` sau una alocată șoferului în ziua plecării (P0001 pe
 * `vehicle_id`, prin `traduEroare`).
 */
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
    allow: [
      "vehicle_id",
      "employee_id",
      "plecare_la",
      "km_plecare",
      "traseu",
      "scop",
      "observatii",
    ],
  },
  revalidate: ["/flota/foi", ...CAI_PORTAL_MASINA],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    let soferId: string;
    if (ctx.scope === "all") {
      if (input.employee_id === null) {
        throw invalidInput("Alegeți șoferul.", { employee_id: ["Alegeți șoferul."] });
      }
      soferId = input.employee_id;
    } else {
      const proprie = await fisaProprieFoaie(ctx.tenant.organizationId, ctx.user.id);
      if (proprie === null) {
        throw businessRule(
          "Contul dumneavoastră nu este legat de o fișă de angajat principală în această organizație. Foaia de parcurs se întocmește pe fișa șoferului; contactați administratorul.",
        );
      }
      if (input.employee_id !== null && input.employee_id !== proprie) {
        throw businessRule(
          "Puteți întocmi foi de parcurs doar pentru dumneavoastră. Foaia unui coleg o întocmește el însuși.",
        );
      }
      soferId = proprie;
    }

    const db = await createServerSupabase();
    // NU se trimit: `status` (WITH CHECK cere „draft"), `numar`, `trimis_la`,
    // `aprobat_de`, `aprobat_la`, `km_parcursi` (GENERATED ALWAYS).
    const { data, error } = await db
      .from("trip_sheets")
      .insert({
        ...input,
        employee_id: soferId,
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

/**
 * Trimiterea foii zilnice spre aprobare.
 *
 * Din 0200 nu se mai trimit ora și kilometrajul de sosire: le dă ultima cursă,
 * iar antetul le agregă în bază. Baza refuză trimiterea unei foi fără curse,
 * cu o cursă neîncheiată sau cu o alimentare rămasă în afara curselor, verifică regresul de kilometraj și pune numărul
 * `FP-AAAA-NNNNN` și instantaneul vehiculului.
 */
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
    allow: ["id", "observatii"],
  },
  revalidate: (input) => [
    "/flota/foi",
    `/flota/foi/${input.id}`,
    "/flota/aprobari",
    ...CAI_PORTAL_MASINA,
    `/portal/masina-mea/foi/${input.id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; anomalie: string | null }>> => {
    const db = await createServerSupabase();
    // `.select()` obligatoriu: `foi_update` cere `poate_scrie_foaie` SAU
    // aprobare pe echipă. Un șofer care încearcă să închidă foaia altcuiva e
    // respins de `USING` — ZERO rânduri, FĂRĂ eroare (capcana 17), iar ecranul
    // ar raporta cursa închisă. `.eq("status", "draft")`: retrimiterea unei
    // foi deja trimise nu e o a doua trimitere, ci un nimic (0200 §D1).
    const { data: foaieInchisa, error } = await db
      .from("trip_sheets")
      .update({
        status: "trimis",
        // Câmp gol la închidere = nimic de adăugat, nu „șterge ce era”. Nota
        // pusă la întocmire rămâne.
        ...(input.observatii === null ? {} : { observatii: input.observatii }),
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (foaieInchisa === null) {
      throw businessRule(
        "Foaia de parcurs nu a putut fi trimisă: nu mai e ciornă sau nu aveți dreptul de a o modifica. Reîncărcați pagina.",
      );
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

/**
 * Foaia respinsă revine în ciornă.
 *
 * ── DE CE O ACȚIUNE SEPARATĂ ────────────────────────────────────────────────
 * `internal.foi_parcurs_inainte` permite din `respins` DOAR tranziția spre
 * `draft`, nu direct spre `trimis`. Ecranul arăta totuși formularul „Trimite
 * spre aprobare” pe o foaie respinsă, iar trimiterea cădea mereu cu P0001
 * („Nu se poate trece foaia din starea «respins»…”). Șoferul rămânea blocat
 * într-un punct mort. Redeschiderea e pasul lipsă și rămâne vizibilă în audit.
 *
 * Motivul respingerii rămâne pe foaie, ca omul să vadă ce are de corectat.
 * `aprobat_de`/`aprobat_la` le golește triggerul la orice stare ≠ `aprobat`.
 */
export const redeschideFoaie = createAction({
  name: "fleet.trip.reopen",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: redeschideFoaieSchema,
  audit: {
    action: "update",
    entityType: "trip_sheet",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => [
    "/flota/foi",
    `/flota/foi/${input.id}`,
    ...CAI_PORTAL_MASINA,
    `/portal/masina-mea/foi/${input.id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("trip_sheets")
      .update({ status: "draft", updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      // Doar o foaie respinsă. Pe una trimisă, „draft” ar fi o retragere din
      // aprobare, adică altă operațiune, nu o corectură.
      .eq("status", "respins")
      // `foi_update` nu are `deleted_at` în USING (0016): fără filtrul ăsta, o
      // foaie ștearsă logic ar fi „redeschisă” invizibil, cu audit de reușită.
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Foaia nu a putut fi redeschisă: nu mai e respinsă sau nu aveți dreptul de a o modifica. Reîncărcați pagina.",
      );
    }

    return { id: data.id };
  },
});

/**
 * Retragerea unei foi TRIMISE în ciornă, ca șoferul s-o corecteze (0200).
 *
 * Pe o foaie trimisă baza nu mai lasă nimic altceva: nici cursele, nici
 * alimentările, nici antetul. Retragerea e singura cale spre o corectură, iar
 * retrimiterea refăcută reface și verificarea de regres a kilometrajului.
 * Numărul foii rămâne același.
 */
export const retrageFoaie = createAction({
  name: "fleet.trip.withdraw",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: retrageFoaieSchema,
  audit: {
    action: "update",
    entityType: "trip_sheet",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => [
    "/flota/foi",
    `/flota/foi/${input.id}`,
    "/flota/aprobari",
    ...CAI_PORTAL_MASINA,
    `/portal/masina-mea/foi/${input.id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("trip_sheets")
      .update({ status: "draft", updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "trimis")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Foaia nu a putut fi retrasă: nu mai e în aprobare (poate a fost deja decisă) sau nu aveți dreptul de a o modifica. Reîncărcați pagina.",
      );
    }
    return { id: data.id };
  },
});

/**
 * Corectura antetului unei ciorne: traseul pe scurt, scopul zilei,
 * observațiile — și, pe o foaie încă FĂRĂ curse, ora și kilometrajul de
 * plecare. Cu curse, baza refuză ora și kilometrajul scrise direct (le dă
 * prima cursă), deci acțiunea nici nu le trimite când sunt `null`.
 */
export const actualizeazaFoaie = createAction({
  name: "fleet.trip.update",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: actualizeazaFoaieSchema,
  audit: {
    action: "update",
    entityType: "trip_sheet",
    entityId: (input) => input.id,
    allow: ["id", "plecare_la", "km_plecare", "traseu", "scop", "observatii"],
  },
  revalidate: (input) => [
    "/flota/foi",
    `/flota/foi/${input.id}`,
    ...CAI_PORTAL_MASINA,
    `/portal/masina-mea/foi/${input.id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("trip_sheets")
      .update({
        traseu: input.traseu,
        scop: input.scop,
        observatii: input.observatii,
        ...(input.plecare_la === null ? {} : { plecare_la: input.plecare_la }),
        ...(input.km_plecare === null ? {} : { km_plecare: input.km_plecare }),
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Foaia nu a putut fi modificată: nu mai e ciornă sau nu aveți dreptul de a o modifica. Reîncărcați pagina.",
      );
    }
    return { id: data.id };
  },
});

/**
 * Ștergerea logică a unei CIORNE. Foaia trimisă se retrage întâi, cea
 * aprobată se stornează doar de responsabilul flotei — iar ștergerea, odată
 * făcută, nu se mai întoarce (0200 §D2).
 *
 * Ciorna care are deja număr (trimisă o dată, apoi retrasă sau respinsă) e un
 * document emis: baza o lasă ștearsă doar sub `trip_sheets:update = all`, ca
 * ANULARE, și anulează atunci și rândul ei din registru (0200 §E4). Scriitorul
 * cu `own` primește refuzul bazei („Foaia are deja numărul …”) prin
 * `traduEroare`, întreg.
 */
export const stergeFoaie = createAction({
  name: "fleet.trip.delete",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: stergeFoaieSchema,
  audit: {
    action: "delete",
    entityType: "trip_sheet",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => [
    "/flota/foi",
    `/flota/foi/${input.id}`,
    ...CAI_PORTAL_MASINA,
    `/portal/masina-mea/foi/${input.id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("trip_sheets")
      .update({ deleted_at: new Date().toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Foaia nu a putut fi ștearsă: doar o ciornă se șterge. O foaie trimisă se retrage întâi în ciornă.",
      );
    }
    return { id: data.id };
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
  revalidate: (input) => [
    "/flota/foi",
    "/flota/aprobari",
    ...CAI_PORTAL_MASINA,
    `/portal/masina-mea/foi/${input.id}`,
  ],
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
    // `ocr_jeton` NU: e un blob opac, iar propunerea ajunge oricum în rând.
    allow: [
      "trip_sheet_id",
      "litri",
      "cost",
      "statie",
      "numar_bon",
      "cui_statie",
      "alimentat_la",
      "plin",
      "observatii",
      "fisier_bon_path",
    ],
  },
  revalidate: (input) => [
    "/flota/foi",
    ...CAI_PORTAL_MASINA,
    `/portal/masina-mea/foi/${input.trip_sheet_id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const org = ctx.tenant.organizationId;
    const { ocr_jeton, ...rest } = input;

    // Jetonul citirii (F12a), verificat ÎNAINTEA oricărei scrieri. E doar
    // transportul propunerii prin browser; garda e în bază (0213).
    let propunere: PropunereSemnata | null = null;
    if (ocr_jeton !== null) {
      const verificare = verificaJeton(ocr_jeton, {
        org,
        user: ctx.user.id,
        foaie: input.trip_sheet_id,
        cale: input.fisier_bon_path,
      });
      if (verificare.stare === "invalid") {
        throw forbidden("Citirea bonului nu se potrivește cu alimentarea. Citiți bonul din nou.");
      }
      // Expirat (formular lăsat deschis peste 2 ore): salvarea merge, fără
      // propunere. Nu e o greșeală a omului, deci nu i se spune nimic.
      if (verificare.stare === "ok") propunere = verificare.propunere;
    }

    const db = await createServerSupabase();
    // Poza urcată înainte de salvare (`pregatesteBonNou`): în folderul foii și
    // CHIAR în Storage, ca la `confirmaBon`. Baza reverifică forma căii
    // (`alimentari_bon_cale`, 0202).
    if (input.fisier_bon_path !== null) {
      if (!caleFlotaValida(input.fisier_bon_path, org, "trip_sheets", input.trip_sheet_id)) {
        throw invalidInput("Calea fișierului nu corespunde acestei foi de parcurs.", {});
      }
      const masura = await masoaraObiectul(db, BUCKET_FLOTA, input.fisier_bon_path);
      if (masura === null) {
        throw businessRule("Poza bonului nu mai este disponibilă. Atașați-o din nou.");
      }
      const problema = verificaFisierFlota(masura.mime, masura.octeti);
      if (problema !== null) throw invalidInput(problema, {});
    }

    // `pret_litru` e GENERATED ALWAYS — nu se trimite. Din 0018 e calculată cu
    // gardă pe zero, deci un litraj zero dă un mesaj de business, nu
    // „division by zero" în engleză. `ocr_propunere` NU intră aici: din
    // sesiunea omului, triggerul `alimentari_ocr_garda` o refuză (P0001).
    const { data, error } = await db
      .from("fuel_entries")
      .insert({
        ...rest,
        organization_id: org,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    if (propunere !== null && input.fisier_bon_path !== null) {
      // Clientul admin, DELIBERAT: `ocr_propunere` o poate scrie doar contextul
      // de serviciu (triggerul din 0213), ca nimeni să nu poată pune o propunere
      // inventată printr-un INSERT direct. Dreptul omului asupra rândului l-a
      // judecat deja RLS-ul, la INSERT-ul de mai sus; aici se scrie o singură
      // coloană, pe rândul abia creat, filtrat explicit pe firmă.
      const { data: scris, error: eroareOcr } = await createAdminSupabase()
        .from("fuel_entries")
        .update({
          ocr_propunere: {
            v: 1,
            ...propunere,
            avertismente: [...propunere.avertismente],
            cale: input.fisier_bon_path,
          },
          updated_by: ctx.user.id,
        })
        .eq("id", data.id)
        .eq("organization_id", org)
        .is("ocr_propunere", null)
        .select("id");
      // Nu se aruncă: omul a salvat corect, iar ce lipsește e doar semnalul.
      // Cele două scrieri nu sunt atomice, asumat (F12a §8.7).
      if (eroareOcr !== null || (scris ?? []).length === 0) {
        console.error("[ocr-bon] propunerea nu s-a salvat", {
          alimentare: data.id,
          cod: eroareOcr?.code ?? "zero_randuri",
        });
      }
    }

    return { id: data.id };
  },
});

/**
 * Corectura unei alimentări. Din 0200 doar pe ciornă: pe o foaie trimisă
 * aprobatorul se uită la litrii ăștia (§D1), iar pe una aprobată sunt document.
 * Mutarea pe altă foaie o refuză baza; `trip_sheet_id` servește doar filtrului.
 */
export const actualizeazaAlimentare = createAction({
  name: "fleet.fuel.update",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: actualizeazaAlimentareSchema,
  audit: {
    action: "update",
    entityType: "fuel_entry",
    entityId: (input) => input.id,
    allow: [
      "id",
      "trip_sheet_id",
      "litri",
      "cost",
      "statie",
      "numar_bon",
      "cui_statie",
      "alimentat_la",
      "plin",
      "observatii",
    ],
  },
  revalidate: (input) => [
    "/flota/foi",
    `/flota/foi/${input.trip_sheet_id}`,
    ...CAI_PORTAL_MASINA,
    `/portal/masina-mea/foi/${input.trip_sheet_id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, trip_sheet_id, ...campuri } = input;
    const { data, error } = await db
      .from("fuel_entries")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("trip_sheet_id", trip_sheet_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Alimentarea nu a putut fi modificată: a fost ștearsă între timp sau nu aveți dreptul de a o modifica.",
      );
    }
    return { id: data.id };
  },
});

/** Ștergerea logică a unei alimentări de pe ciornă. Nu se mai întoarce (0200 §D2). */
export const stergeAlimentare = createAction({
  name: "fleet.fuel.delete",
  feature: "fleet",
  permission: "trip_sheets:update",
  minScope: "own",
  input: stergeAlimentareSchema,
  audit: {
    action: "delete",
    entityType: "fuel_entry",
    entityId: (input) => input.id,
    allow: ["id", "trip_sheet_id"],
  },
  revalidate: (input) => [
    "/flota/foi",
    `/flota/foi/${input.trip_sheet_id}`,
    ...CAI_PORTAL_MASINA,
    `/portal/masina-mea/foi/${input.trip_sheet_id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("fuel_entries")
      .update({ deleted_at: new Date().toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("trip_sheet_id", input.trip_sheet_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Alimentarea nu a putut fi ștearsă: a fost deja ștearsă sau nu aveți dreptul de a o modifica.",
      );
    }
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
    // `anomalii_select` (rescrisă în 0199) cere doar vederea foii pe care s-a
    // produs (sau a vehiculului, pe anomalia fără foaie), pe când `anomalii_update` cere
    // `app.can(org,'vehicles','update','team')`. Cine o vede și n-o poate
    // confirma e respins de `USING` — zero rânduri, fără eroare — iar lista ar
    // rămâne cu anomalia neconfirmată după un mesaj de reușită.
    const { data: anomalieConfirmata, error } = await db
      .from("odometer_anomalies")
      .update({ confirmat_la: new Date().toISOString(), nota: input.nota })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      // Doar o anomalie încă neconfirmată: altfel al doilea manager (alt tab)
      // rescria momentul și nota primului, iar rândul rămânea semnat de primul.
      .is("confirmat_la", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (anomalieConfirmata === null) {
      throw businessRule(
        "Confirmarea nu a fost înregistrată: anomalia a fost deja confirmată de altcineva, a fost ștearsă între timp sau nu aveți dreptul de a opera vehiculele acestei echipe. Reîncărcați lista de anomalii.",
      );
    }

    return { id: input.id };
  },
});
