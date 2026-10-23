// src/app/(app)/flota/actions-amenzi.ts
"use server";

/**
 * Amenzile primite pe vehicul și incidentele / dauna (0206, F11).
 *
 * Fișier separat de `actions.ts`, pe care îl scriu și fazele paralele. „use
 * server”: se exportă DOAR funcții async (capcana 39, `pnpm check:server`).
 *
 * ── CINE SCRIE ──────────────────────────────────────────────────────────────
 * Amenzile: `vehicle_fines:create/update = all`; incidentele:
 * `vehicle_incidents:create/update = all`. EXACT poarta politicilor
 * (`has_permission(...) = 'all'`). Cheile sunt seedate doar pentru `org_admin`
 * și `super_admin`; decizia 3 a planului (HR doar permisele) rămâne în
 * picioare, iar o firmă poate acorda cheile lui HR printr-o suprascriere.
 * Un UPDATE respins de USING întoarce ZERO rânduri: CONFLICT.
 *
 * ── TRANZIȚIILE ─────────────────────────────────────────────────────────────
 * Le judecă baza (`internal.amenzi_inainte`, `internal.incidente_inainte`).
 * Fiecare tranziție de aici adaugă și `.eq/.in("stadiu", …)` pe stadiul de
 * plecare + `.select()`: două clicuri, sau o pagină rămasă deschisă pe un
 * stadiu depășit, dau CONFLICT cu un mesaj omenesc, nu o suprascriere tăcută.
 *
 * ── CE NU FACE ──────────────────────────────────────────────────────────────
 * Nu recuperează nimic de la șofer și nu scrie nimic pe statul de plată:
 * Codul muncii art. 169 alin. (2) și art. 254. Nu trimite scrisoarea către
 * autoritate: o generează o rută de export (`hr_read_sensitive`), iar omul o
 * trimite și apoi marchează „răspuns trimis”.
 */

import { randomUUID } from "node:crypto";

import { STADII_AMENDA, STADII_INCIDENT, poateTrece } from "@/domain/fleet/amenzi";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput } from "@/lib/actions/errors";
import {
  actualizeazaAmendaSchema,
  actualizeazaIncidentSchema,
  amendaNouaSchema,
  declaratieIncidentSchema,
  desemneazaSoferSchema,
  incidentNouSchema,
  retrageDesemnareaSchema,
  schimbaStadiulAmenziiSchema,
  schimbaStadiulIncidentuluiSchema,
  stergeAmendaSchema,
  stergeIncidentSchema,
  trimiteRaspunsSchema,
} from "@/schemas/flota-amenzi";

import { traduEroareAmenzi } from "./erori";

/** Unde se vede o amendă: lista și fișa ei. */
function caiAmenda(id: string): readonly string[] {
  return ["/flota/amenzi", `/flota/amenzi/${id}`];
}

/** Unde se vede un incident: lista și fișa lui. */
function caiIncident(id: string): readonly string[] {
  return ["/flota/incidente", `/flota/incidente/${id}`];
}

const MESAJ_STADIU_AMENDA =
  "Amenda s-a schimbat între timp: nu mai e în stadiul din care se putea face această operațiune, sau nu aveți dreptul s-o modificați. Reîncărcați pagina.";
const MESAJ_STADIU_INCIDENT =
  "Incidentul s-a schimbat între timp: nu mai e în stadiul din care se putea face această operațiune, sau nu aveți dreptul să-l modificați. Reîncărcați pagina.";
/** Același text ca refuzul din `internal.incidente_inainte` (0206). */
const MESAJ_CERCETARE_NEVAZUTA =
  "Cercetarea SSM aleasă nu există în organizația dumneavoastră sau nu o puteți consulta.";

// ── Amenzi ──────────────────────────────────────────────────────────────────

export const inregistreazaAmenda = createAction({
  name: "fleet.fine.create",
  feature: "fleet",
  permission: "vehicle_fines:create",
  minScope: "all",
  input: amendaNouaSchema,
  audit: {
    action: "create",
    entityType: "vehicle_fine",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "vehicle_id",
      "numar_pv",
      "data_pv",
      "constatata_la",
      "locul",
      "fapta",
      "autoritate",
      "suma",
      "primita_la",
      "termen_raspuns",
    ],
  },
  revalidate: ["/flota/amenzi"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("vehicle_fines")
      .insert({
        organization_id: ctx.tenant.organizationId,
        vehicle_id: input.vehicle_id,
        numar_pv: input.numar_pv,
        data_pv: input.data_pv,
        constatata_la: input.constatata_la,
        locul: input.locul,
        fapta: input.fapta,
        autoritate: input.autoritate,
        suma: input.suma,
        primita_la: input.primita_la,
        termen_raspuns: input.termen_raspuns,
        observatii: input.observatii,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareAmenzi(error);
    return { id: data.id };
  },
});

export const actualizeazaAmenda = createAction({
  name: "fleet.fine.update",
  feature: "fleet",
  permission: "vehicle_fines:update",
  minScope: "all",
  input: actualizeazaAmendaSchema,
  audit: {
    action: "update",
    entityType: "vehicle_fine",
    entityId: (input) => input.id,
    allow: [
      "id",
      "numar_pv",
      "data_pv",
      "constatata_la",
      "locul",
      "fapta",
      "autoritate",
      "suma",
      "primita_la",
      "termen_raspuns",
    ],
  },
  revalidate: (input) => caiAmenda(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Stadiul nu se atinge aici. O amendă închisă o refuză baza, cu mesajul ei.
    const { data, error } = await ctx.supabase
      .from("vehicle_fines")
      .update({
        numar_pv: input.numar_pv,
        data_pv: input.data_pv,
        constatata_la: input.constatata_la,
        locul: input.locul,
        fapta: input.fapta,
        autoritate: input.autoritate,
        suma: input.suma,
        primita_la: input.primita_la,
        termen_raspuns: input.termen_raspuns,
        observatii: input.observatii,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAmenzi(error);
    if (data === null) throw businessRule(MESAJ_STADIU_AMENDA);
    return { id: data.id };
  },
});

export const desemneazaSofer = createAction({
  name: "fleet.fine.designate",
  feature: "fleet",
  permission: "vehicle_fines:update",
  minScope: "all",
  input: desemneazaSoferSchema,
  audit: {
    action: "update",
    entityType: "vehicle_fine",
    entityId: (input) => input.id,
    allow: ["id", "employee_id"],
  },
  revalidate: (input) => caiAmenda(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // „Primită” sau „șofer desemnat” (schimbarea desemnatului, cât răspunsul n-a
    // plecat). După răspuns, baza refuză oricum schimbarea.
    const { data, error } = await ctx.supabase
      .from("vehicle_fines")
      .update({
        stadiu: "sofer_desemnat",
        sofer_desemnat_id: input.employee_id,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("stadiu", ["primita", "sofer_desemnat"])
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAmenzi(error);
    if (data !== null) return { id: data.id };

    // Amenda contestată ÎNAINTE ca răspunsul să fi plecat: termenul rămâne în
    // scadențe (`internal.amenzi_scadenta`), deci omul trebuie să poată încă
    // desemna șoferul. Stadiul „contestată” nu se pierde: se scrie doar șoferul.
    const contestata = await ctx.supabase
      .from("vehicle_fines")
      .update({ sofer_desemnat_id: input.employee_id, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stadiu", "contestata")
      .is("raspuns_trimis_la", null)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (contestata.error !== null) traduEroareAmenzi(contestata.error);
    if (contestata.data === null) throw businessRule(MESAJ_STADIU_AMENDA);
    return { id: contestata.data.id };
  },
});

export const retrageDesemnarea = createAction({
  name: "fleet.fine.undesignate",
  feature: "fleet",
  permission: "vehicle_fines:update",
  minScope: "all",
  input: retrageDesemnareaSchema,
  audit: {
    action: "update",
    entityType: "vehicle_fine",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => caiAmenda(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("vehicle_fines")
      .update({ stadiu: "primita", sofer_desemnat_id: null, updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stadiu", "sofer_desemnat")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAmenzi(error);
    if (data === null) throw businessRule(MESAJ_STADIU_AMENDA);
    return { id: data.id };
  },
});

export const trimiteRaspuns = createAction({
  name: "fleet.fine.answer",
  feature: "fleet",
  permission: "vehicle_fines:update",
  minScope: "all",
  input: trimiteRaspunsSchema,
  audit: {
    action: "update",
    entityType: "vehicle_fine",
    entityId: (input) => input.id,
    allow: ["id", "raspuns_trimis_la", "raspuns_numar"],
  },
  revalidate: (input) => caiAmenda(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("vehicle_fines")
      .update({
        stadiu: "raspuns_trimis",
        raspuns_trimis_la: input.raspuns_trimis_la,
        raspuns_numar: input.raspuns_numar,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stadiu", "sofer_desemnat")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAmenzi(error);
    if (data !== null) return { id: data.id };

    // Amenda contestată ÎNAINTE de răspuns: obligația față de autoritate rămâne
    // (art. 39 alin. (1)), deci răspunsul se poate marca și așa. Stadiul rămâne
    // „contestată”; data răspunsului scoate termenul din scadențe. Dacă n-are
    // șofer desemnat, baza refuză (P0001), iar mesajul ajunge pe `employee_id`.
    const contestata = await ctx.supabase
      .from("vehicle_fines")
      .update({
        raspuns_trimis_la: input.raspuns_trimis_la,
        raspuns_numar: input.raspuns_numar,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stadiu", "contestata")
      .is("raspuns_trimis_la", null)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (contestata.error !== null) traduEroareAmenzi(contestata.error);
    if (contestata.data === null) {
      throw businessRule(
        "Răspunsul nu s-a putut marca: amenda nu mai are un răspuns în așteptare, sau nu aveți dreptul s-o modificați. Reîncărcați pagina.",
      );
    }
    return { id: contestata.data.id };
  },
});

export const schimbaStadiulAmenzii = createAction({
  name: "fleet.fine.stage",
  feature: "fleet",
  permission: "vehicle_fines:update",
  minScope: "all",
  input: schimbaStadiulAmenziiSchema,
  audit: {
    action: "update",
    entityType: "vehicle_fine",
    entityId: (input) => input.id,
    allow: ["id", "stadiu", "motiv"],
  },
  revalidate: (input) => caiAmenda(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Stadiile din care se poate ajunge aici, din aceeași matrice ca a bazei.
    const plecari = STADII_AMENDA.filter((s) => poateTrece(s, input.stadiu));
    const { data, error } = await ctx.supabase
      .from("vehicle_fines")
      .update({
        stadiu: input.stadiu,
        ...(input.stadiu === "anulata" ? { motiv: input.motiv } : {}),
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("stadiu", plecari)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAmenzi(error);
    if (data === null) throw businessRule(MESAJ_STADIU_AMENDA);
    return { id: data.id };
  },
});

export const stergeAmenda = createAction({
  name: "fleet.fine.delete",
  feature: "fleet",
  permission: "vehicle_fines:update",
  minScope: "all",
  input: stergeAmendaSchema,
  audit: {
    action: "delete",
    entityType: "vehicle_fine",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/flota/amenzi"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Doar amenda neatinsă („primită”): una aflată în lucru se anulează, cu motiv.
    const { data, error } = await ctx.supabase
      .from("vehicle_fines")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stadiu", "primita")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAmenzi(error);
    if (data === null) {
      throw businessRule(
        "Amenda nu a fost ștearsă: nu mai e neatinsă (o amendă aflată în lucru se anulează, cu motiv) sau nu aveți dreptul s-o modificați.",
      );
    }
    return { id: data.id };
  },
});

// ── Incidente ───────────────────────────────────────────────────────────────

export const raporteazaIncident = createAction({
  name: "fleet.incident.create",
  feature: "fleet",
  permission: "vehicle_incidents:create",
  minScope: "all",
  input: incidentNouSchema,
  audit: {
    action: "create",
    entityType: "vehicle_incident",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["vehicle_id", "tip", "produs_la", "locul", "sofer_id", "cost_estimat"],
  },
  revalidate: ["/flota/incidente"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const { data, error } = await ctx.supabase
      .from("vehicle_incidents")
      .insert({
        organization_id: ctx.tenant.organizationId,
        vehicle_id: input.vehicle_id,
        tip: input.tip,
        produs_la: input.produs_la,
        locul: input.locul,
        descriere: input.descriere,
        sofer_id: input.sofer_id,
        cost_estimat: input.cost_estimat,
        observatii: input.observatii,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroareAmenzi(error);
    return { id: data.id };
  },
});

/**
 * Declarația șoferului din portal („Mașina mea”, 0206 §F).
 *
 * Poarta e `vehicle_incidents:create = own` (seed-ul lui `employee`). Restul îl
 * judecă baza: triggerul pune declarantul și șoferul (fișa principală,
 * `app.fisa_mea`) și refuză cu P0001 vehiculul care nu-i era alocat în ziua
 * incidentului (și nu e pool); politica refuză costurile și asigurătorul.
 * Acțiunea trimite oricum fișa proprie: un administrator-șofer (`create = all`)
 * care declară din portal rămâne declarant, deci responsabilul e notificat.
 *
 * Fișa e citită prin clientul utilizatorului (`employees:read = own`, din 0023):
 * cea PRINCIPALĂ, singura pe care o recunoaște ramura `own` a politicii de
 * INSERT (și `incidente_declarate_de_mine`, la citire).
 */
export const declaraIncident = createAction({
  name: "fleet.incident.declare",
  feature: "fleet",
  permission: "vehicle_incidents:create",
  minScope: "own",
  input: declaratieIncidentSchema,
  audit: {
    action: "create",
    entityType: "vehicle_incident",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["vehicle_id", "tip", "produs_la", "locul"],
  },
  revalidate: ["/portal/masina-mea", "/flota/incidente"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const fisa = await ctx.supabase
      .from("employees")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("user_id", ctx.user.id)
      .eq("is_primary", true)
      .is("deleted_at", null)
      .maybeSingle<{ readonly id: string }>();
    if (fisa.error !== null) traduEroareAmenzi(fisa.error);
    if (fisa.data === null) {
      throw businessRule(
        "Contul dumneavoastră nu e legat de o fișă de angajat, deci nu puteți declara un incident. Anunțați responsabilul de flotă.",
      );
    }
    // X1: id-ul îl pune acțiunea și NU se cere `.select()`. Șoferul nu citește
    // rândul incidentului (`vehicle_incidents_select` e doar `read = all`: rândul
    // are costurile și observațiile responsabilului), iar `RETURNING` cere
    // rândul vizibil — ar cădea cu 42501 pe fiecare declarație.
    const id = randomUUID();
    const { error } = await ctx.supabase.from("vehicle_incidents").insert({
      id,
      organization_id: ctx.tenant.organizationId,
      vehicle_id: input.vehicle_id,
      tip: input.tip,
      produs_la: input.produs_la,
      locul: input.locul,
      descriere: input.descriere,
      declarat_de_employee_id: fisa.data.id,
      sofer_id: fisa.data.id,
      created_by: ctx.user.id,
      updated_by: ctx.user.id,
    });
    if (error !== null) traduEroareAmenzi(error);
    return { id };
  },
});

export const actualizeazaIncident = createAction({
  name: "fleet.incident.update",
  feature: "fleet",
  permission: "vehicle_incidents:update",
  minScope: "all",
  input: actualizeazaIncidentSchema,
  audit: {
    action: "update",
    entityType: "vehicle_incident",
    entityId: (input) => input.id,
    allow: [
      "id",
      "tip",
      "produs_la",
      "locul",
      "sofer_id",
      "cost_estimat",
      "despagubire",
      "asigurator",
      "dosar_numar",
      "work_accident_id",
    ],
  },
  revalidate: (input) => caiIncident(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // ── Legătura cu cercetarea SSM: o pune doar cine VEDE cercetarea ──────────
    // Se citește prin clientul SESIUNII, deci prin RLS-ul SSM (modulul `ssm`
    // activ și `ssm:read` pe angajatul accidentat). Triggerul `incidente_inainte`
    // rulează cu drepturile bazei și, singur, verifica doar că rândul e al
    // firmei: cine scria incidente fără acces SSM (sau cu modulul SSM oprit)
    // putea lega orice cercetare a firmei și afla, din refuz, ce id-uri există.
    // O legătură DEJA pusă, pe care apelantul n-o vede, se poate PĂSTRA
    // (formularul o retrimite neschimbată), nu schimba: UPDATE-ul cere atunci
    // ca rândul s-o aibă deja. Dezlegarea („fără legătură”) rămâne permisă.
    let legaturaNevazuta: string | null = null;
    if (input.work_accident_id !== null) {
      const cercetare = await ctx.supabase
        .from("work_accidents")
        .select("id")
        .eq("id", input.work_accident_id)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (cercetare.error !== null) traduEroareAmenzi(cercetare.error);
      if (cercetare.data === null) legaturaNevazuta = input.work_accident_id;
    }

    // Stadiul nu se atinge aici. Un incident închis îl refuză baza, cu mesajul ei.
    // `.match({})` nu adaugă niciun filtru; cu o cercetare nevăzută, cere ca
    // rândul s-o aibă deja. O singură instrucțiune, cu `.select()` în ea.
    const { data, error } = await ctx.supabase
      .from("vehicle_incidents")
      .update({
        tip: input.tip,
        produs_la: input.produs_la,
        locul: input.locul,
        descriere: input.descriere,
        sofer_id: input.sofer_id,
        cost_estimat: input.cost_estimat,
        despagubire: input.despagubire,
        asigurator: input.asigurator,
        dosar_numar: input.dosar_numar,
        work_accident_id: input.work_accident_id,
        observatii: input.observatii,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .match(legaturaNevazuta === null ? {} : { work_accident_id: legaturaNevazuta })
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAmenzi(error);
    if (data === null) {
      // Zero rânduri cu o cercetare nevăzută = legătura NU era deja pusă (sau
      // incidentul a dispărut între timp): refuz pe câmp, același mesaj ca al
      // bazei, ca să nu deosebească „nu există” de „nu o puteți consulta”.
      if (legaturaNevazuta !== null) {
        throw invalidInput(MESAJ_CERCETARE_NEVAZUTA, {
          work_accident_id: [MESAJ_CERCETARE_NEVAZUTA],
        });
      }
      throw businessRule(MESAJ_STADIU_INCIDENT);
    }
    return { id: data.id };
  },
});

export const schimbaStadiulIncidentului = createAction({
  name: "fleet.incident.stage",
  feature: "fleet",
  permission: "vehicle_incidents:update",
  minScope: "all",
  input: schimbaStadiulIncidentuluiSchema,
  audit: {
    action: "update",
    entityType: "vehicle_incident",
    entityId: (input) => input.id,
    allow: ["id", "stadiu", "cost_final", "despagubire", "asigurator", "dosar_numar"],
  },
  revalidate: (input) => caiIncident(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Stadiile de plecare: orice stadiu deschis, în afară de cel de destinație.
    const plecari = STADII_INCIDENT.filter((s) => s !== "inchis" && s !== input.stadiu);
    // Un câmp lăsat gol NU șterge ce era scris: se trimite doar ce are valoare.
    const { data, error } = await ctx.supabase
      .from("vehicle_incidents")
      .update({
        stadiu: input.stadiu,
        ...(input.cost_final === null ? {} : { cost_final: input.cost_final }),
        ...(input.despagubire === null ? {} : { despagubire: input.despagubire }),
        ...(input.asigurator === null ? {} : { asigurator: input.asigurator }),
        ...(input.dosar_numar === null ? {} : { dosar_numar: input.dosar_numar }),
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .in("stadiu", plecari)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAmenzi(error);
    if (data === null) throw businessRule(MESAJ_STADIU_INCIDENT);
    return { id: data.id };
  },
});

export const stergeIncident = createAction({
  name: "fleet.incident.delete",
  feature: "fleet",
  permission: "vehicle_incidents:update",
  minScope: "all",
  input: stergeIncidentSchema,
  audit: {
    action: "delete",
    entityType: "vehicle_incident",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/flota/incidente"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Doar incidentul doar raportat; unul în lucru se închide, cu costul final.
    const { data, error } = await ctx.supabase
      .from("vehicle_incidents")
      .update({ deleted_at: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("stadiu", "raportat")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroareAmenzi(error);
    if (data === null) {
      throw businessRule(
        "Incidentul nu a fost șters: nu mai e doar raportat (unul în lucru se închide, cu costul final) sau nu aveți dreptul să-l modificați.",
      );
    }
    return { id: data.id };
  },
});
