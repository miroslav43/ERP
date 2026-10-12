// src/app/(app)/mentenanta/sesizari/actions.ts
"use server";

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import type { ActionContext } from "@/lib/actions/types";
import { createServerSupabase } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database";
import { masoaraObiectul } from "@/lib/storage/masoara-obiectul";
import { slugFisier } from "@/lib/documents/cale";
import { STARI_DESCHISE_SESIZARE } from "@/domain/maintenance/sesizari";
import { BUCKET_MENTENANTA } from "@/lib/queries/maintenance";
import {
  actualizeazaSesizareSchema,
  atribuieSesizareSchema,
  comentariuSesizareSchema,
  confirmaFisierSchema,
  inchideOprireSchema,
  inchideSesizareSchema,
  inregistreazaOprireSchema,
  LIMITA_DOCUMENT_MENTENANTA_BYTES,
  LIMITA_FOTO_BYTES,
  MAXIM_FOTO_PE_SESIZARE,
  MIME_DOCUMENT_MENTENANTA,
  MIME_FOTO,
  pregatesteFisierSchema,
  redeschideSesizareSchema,
  retrageSesizareSchema,
  setariMentenantaSchema,
  stergeFisierSchema,
  type StatusSesizare,
} from "@/schemas/maintenance";

import { traduEroare } from "../erori";

// ── Ce e în fișierul ăsta ────────────────────────────────────────────────────
//
// Gesturile din fluxul complet al sesizării (0181), ale celor trei actori:
//
//   · GESTIONARUL (`maintenance:update` ≥ team): atribuie, înregistrează și
//     corectează opriri, scrie setările.
//   · TEHNICIANUL atribuit: își începe / pune în așteptare sesizarea.
//   · RAPORTORUL: își completează sesizarea cât e nouă, o retrage, confirmă
//     rezolvarea sau o redeschide.
//   · ORICINE o vede: comentează, atașează poze și documente.
//
// Acțiunile actorilor nominali sunt păzite pe `maintenance:read`/`own` — adică
// „e în modul și poate vedea ceva" — iar DECIZIA o ia baza: politica de UPDATE
// a lui `fault_reports` deschide ușa raportorului și tehnicianului, iar garda
// `internal.fault_reports_garda` le dă fiecăruia exact câmpurile lui. Un străin
// trece de poartă și primește din bază zero rânduri (politică) sau P0001
// (gardă) — tradus pentru om, nu ascuns. Așa, regula trăiește într-un singur
// loc, verificat de `tests/rls/proba-sesizari-roluri.sql`, nu în două.
//
// Triajul (`trieazaSesizare`) și rezolvarea (`rezolvaSesizare`) rămân în
// `../actions.ts`; aici nu e nevoie de clientul admin, deci fișierul nu-l
// importă.

const CAI_SESIZARE = (id: string): readonly string[] => [
  "/mentenanta",
  "/mentenanta/sesizari",
  `/mentenanta/sesizari/${id}`,
  "/portal/sesizari",
  `/portal/sesizari/${id}`,
];

/** Fișa proprie a apelantului, prin RLS (`employees:read` ≥ own); `null` fără fișă. */
async function fisaProprie(ctx: ActionContext): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from("employees")
    .select("id")
    .eq("organization_id", ctx.tenant.organizationId)
    .eq("user_id", ctx.user.id)
    .eq("is_primary", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  return data?.id ?? null;
}

/**
 * O tranziție de stare, cu filtrul pe starea curentă ÎN UPDATE și `.select()`
 * după: zero rânduri înseamnă „altcineva a schimbat-o între timp" sau „nu ai
 * dreptul", niciodată succes tăcut (capcana #17).
 */
async function tranzitie(
  ctx: ActionContext,
  id: string,
  dinStari: readonly StatusSesizare[],
  valori: TablesUpdate<"fault_reports">,
  mesajZeroRanduri: string,
): Promise<Readonly<{ id: string }>> {
  const db = await createServerSupabase();
  const { data, error } = await db
    .from("fault_reports")
    .update(valori)
    .eq("id", id)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .in("status", dinStari)
    .select("id")
    .maybeSingle();
  if (error !== null) traduEroare(error);
  if (data === null) throw businessRule(mesajZeroRanduri);
  return { id: data.id };
}

// ── Atribuirea ───────────────────────────────────────────────────────────────

export const atribuieSesizare = createAction({
  name: "maintenance.fault.assign",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: atribuieSesizareSchema,
  audit: {
    action: "update",
    entityType: "fault_report",
    entityId: (input) => input.id,
    allow: ["id", "atribuit_employee_id", "eu"],
  },
  revalidate: (input) => CAI_SESIZARE(input.id),
  handler: async (ctx, input): Promise<Readonly<{ id: string; atribuit: string | null }>> => {
    let tehnician = input.atribuit_employee_id;
    if (input.eu) {
      tehnician = await fisaProprie(ctx);
      if (tehnician === null) {
        throw businessRule(
          "Contul dvs. nu e legat de o fișă de angajat, deci nu vă puteți atribui sesizarea. Alegeți un tehnician din listă.",
        );
      }
    }
    // Atribuirea nu schimbă starea: o sesizare „nouă" rămâne nouă până o
    // începe cineva — dar o sesizare NEATRIBUITĂ care era „în lucru" nu există
    // (garda cere tehnician la „în lucru"), deci luarea înapoi a atribuirii
    // merge doar pe stările de dinainte.
    const rezultat = await tranzitie(
      ctx,
      input.id,
      tehnician === null ? ["nou", "in_analiza"] : [...STARI_DESCHISE_SESIZARE],
      { atribuit_employee_id: tehnician },
      tehnician === null
        ? "Atribuirea se poate lua înapoi doar cât sesizarea e nouă sau în analiză."
        : "Sesizarea nu a fost găsită, nu vă este accesibilă sau a fost deja închisă.",
    );
    return { ...rezultat, atribuit: tehnician };
  },
});

// ── Gesturile tehnicianului ──────────────────────────────────────────────────

/**
 * Tehnicianul își începe sesizarea sau o pune în așteptare. Poarta e `read`/own
 * fiindcă dreptul vine din atribuire, nu din rol: baza verifică că apelantul e
 * tehnicianul (garda) și că sesizarea e a lui (politica).
 */
export const tehnicianSchimbaStarea = createAction({
  name: "maintenance.fault.technician_status",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: z.object({
    id: z.uuid("Sesizarea selectată nu este validă."),
    status: z.enum(["in_lucru", "in_asteptare"]),
  }),
  audit: {
    action: "update",
    entityType: "fault_report",
    entityId: (input) => input.id,
    allow: ["id", "status"],
  },
  revalidate: (input) => CAI_SESIZARE(input.id),
  handler: async (ctx, input) =>
    tranzitie(
      ctx,
      input.id,
      input.status === "in_lucru" ? ["nou", "in_analiza", "in_asteptare"] : ["in_lucru"],
      { status: input.status },
      "Sesizarea nu mai e în starea din care ați pornit sau nu vă e atribuită. Reîncărcați pagina.",
    ),
});

// ── Gesturile raportorului ───────────────────────────────────────────────────

export const retrageSesizare = createAction({
  name: "maintenance.fault.withdraw",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: retrageSesizareSchema,
  audit: {
    action: "update",
    entityType: "fault_report",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => CAI_SESIZARE(input.id),
  handler: async (ctx, input) =>
    tranzitie(
      ctx,
      input.id,
      ["nou", "in_analiza"],
      { status: "retrasa" },
      "Sesizarea nu se mai poate retrage: cineva a început deja să lucreze la ea sau a fost închisă.",
    ),
});

export const inchideSesizare = createAction({
  name: "maintenance.fault.close",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: inchideSesizareSchema,
  audit: {
    action: "update",
    entityType: "fault_report",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => CAI_SESIZARE(input.id),
  handler: async (ctx, input) =>
    tranzitie(
      ctx,
      input.id,
      ["rezolvat"],
      { status: "inchis" },
      "Sesizarea nu mai e în starea „rezolvată”: a fost închisă sau redeschisă între timp.",
    ),
});

export const redeschideSesizare = createAction({
  name: "maintenance.fault.reopen",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: redeschideSesizareSchema,
  audit: {
    action: "update",
    entityType: "fault_report",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => CAI_SESIZARE(input.id),
  handler: async (ctx, input) =>
    // `intervention_id`, `rezolvat_la` și contorul le scrie garda; aici doar
    // motivul și starea.
    tranzitie(
      ctx,
      input.id,
      ["rezolvat"],
      { status: "in_lucru", motiv_redeschidere: input.motiv_redeschidere },
      "Sesizarea nu mai e în starea „rezolvată”: a fost închisă între timp.",
    ),
});

export const actualizeazaSesizare = createAction({
  name: "maintenance.fault.update",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: actualizeazaSesizareSchema,
  audit: {
    action: "update",
    entityType: "fault_report",
    entityId: (input) => input.id,
    allow: ["id", "urgenta"],
  },
  revalidate: (input) => CAI_SESIZARE(input.id),
  handler: async (ctx, input) =>
    tranzitie(
      ctx,
      input.id,
      // Raportorul doar cât e nouă; gestionarul oricând e deschisă — garda
      // alege, filtrul de aici e doar „încă deschisă".
      [...STARI_DESCHISE_SESIZARE],
      { descriere: input.descriere, urgenta: input.urgenta },
      "Sesizarea nu se mai poate modifica: e închisă, sau a fost preluată și descrierea nu mai e a dvs. de schimbat.",
    ),
});

// ── Comentarii ───────────────────────────────────────────────────────────────

export const comenteazaSesizare = createAction({
  name: "maintenance.fault.comment",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: comentariuSesizareSchema,
  audit: {
    action: "create",
    entityType: "fault_report_comment",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["fault_report_id", "intern"],
  },
  revalidate: (input) => CAI_SESIZARE(input.fault_report_id),
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const autor = await fisaProprie(ctx);
    const db = await createServerSupabase();
    // Dreptul la nota internă e verificat în politica de INSERT: un raportor
    // care ar trimite `intern: true` primește refuz din bază (42501), tradus.
    const { data, error } = await db
      .from("fault_report_comments")
      .insert({
        organization_id: ctx.tenant.organizationId,
        fault_report_id: input.fault_report_id,
        autor_employee_id: autor,
        autor_user_id: autor === null ? ctx.user.id : null,
        continut: input.continut,
        intern: input.intern,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);
    return { id: data.id };
  },
});

// ── Atașamente: poze și documente ────────────────────────────────────────────

function verificaFisier(entityType: string, mime: string, dimensiune: number): string | null {
  const ePoza = entityType === "fault_report";
  const acceptate: readonly string[] = ePoza ? MIME_FOTO : MIME_DOCUMENT_MENTENANTA;
  if (!acceptate.includes(mime)) {
    return ePoza
      ? "Pe o sesizare se pun fotografii: JPG, PNG, WEBP sau HEIC."
      : "Acceptăm fotografii (JPG, PNG, WEBP, HEIC), PDF sau Word.";
  }
  if (dimensiune <= 0) return "Fișierul selectat este gol.";
  const limita = ePoza ? LIMITA_FOTO_BYTES : LIMITA_DOCUMENT_MENTENANTA_BYTES;
  if (dimensiune > limita) {
    return ePoza ? "Fotografia depășește 5 MB." : "Documentul depășește 25 MB.";
  }
  return null;
}

/** `{org}/{entity_type}/{entity_id}/` — forma cerută de `app.mentenanta_poate_fisier`. */
function prefixCale(organizationId: string, entityType: string, entityId: string): string {
  return `${organizationId}/${entityType}/${entityId}/`;
}

/**
 * Pasul 1 din 3: semnează calea de încărcare, pe clientul UTILIZATORULUI.
 * `createSignedUploadUrl` verifică politica bucketului (`mentenanta_objects_insert`)
 * sub sesiunea apelantului, deci un străin nu primește URL. Octeții urcă apoi
 * direct din browser (`urcaPeUrlSemnat`), iar pasul 3 scrie rândul.
 */
export const pregatesteFisier = createAction({
  name: "maintenance.attachment.prepare",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: pregatesteFisierSchema,
  audit: {
    action: "import",
    entityType: "maintenance_attachment",
    allow: ["entity_type", "entity_id", "numeFisier", "dimensiune", "mime"],
  },
  handler: async (ctx, input): Promise<Readonly<{ cale: string; urlSemnat: string }>> => {
    const problema = verificaFisier(input.entity_type, input.mime, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, {});

    if (input.entity_type === "fault_report") {
      // Cinci poze ajung pentru o defecțiune; a șasea e aproape sigur un film
      // de telefon trimis din greșeală. Limita se numără pe rândurile vii.
      const { count, error } = await ctx.supabase
        .from("maintenance_attachments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("entity_type", "fault_report")
        .eq("entity_id", input.entity_id)
        .is("deleted_at", null);
      if (error !== null) throw error;
      if ((count ?? 0) >= MAXIM_FOTO_PE_SESIZARE) {
        throw businessRule(
          `O sesizare poate avea cel mult ${String(MAXIM_FOTO_PE_SESIZARE)} fotografii. Ștergeți una înainte de a adăuga alta.`,
        );
      }
    }

    const cale = `${prefixCale(ctx.tenant.organizationId, input.entity_type, input.entity_id)}${crypto.randomUUID()}-${slugFisier(input.numeFisier)}`;
    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_MENTENANTA)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null) {
      throw businessRule(
        "Nu am putut pregăti încărcarea fișierului. Verificați că aveți dreptul de a adăuga fișiere aici și încercați din nou.",
      );
    }
    return { cale, urlSemnat: data.signedUrl };
  },
});

/**
 * Pasul 3 din 3: rândul din `maintenance_attachments`, cu mărimea și tipul
 * REALE citite din Storage (`masoaraObiectul`), nu cele declarate de client.
 */
export const confirmaFisier = createAction({
  name: "maintenance.attachment.confirm",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: confirmaFisierSchema,
  audit: {
    action: "create",
    entityType: "maintenance_attachment",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["entity_type", "entity_id", "tip", "denumire"],
  },
  revalidate: (input) =>
    input.entity_type === "fault_report"
      ? CAI_SESIZARE(input.entity_id)
      : [`/mentenanta/echipamente/${input.entity_id}`, "/mentenanta/interventii"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Anti-traversal: calea trebuie să stea EXACT sub prefixul entității, fără
    // `..`, fără segmente goale. Fără asta, un client ar putea lega un rând de
    // un obiect din folderul altei entități.
    const prefix = prefixCale(ctx.tenant.organizationId, input.entity_type, input.entity_id);
    const rest = input.cale.startsWith(prefix) ? input.cale.slice(prefix.length) : null;
    if (rest === null || rest.length === 0 || rest.includes("/") || rest.includes("..")) {
      throw invalidInput("Calea fișierului nu corespunde entității.", {});
    }

    const masura = await masoaraObiectul(ctx.supabase, BUCKET_MENTENANTA, input.cale);
    if (masura === null) {
      throw businessRule(
        "Fișierul nu a ajuns în Storage sau nu vă este accesibil. Încercați încărcarea din nou.",
      );
    }
    const problema = verificaFisier(input.entity_type, masura.mime, masura.octeti);
    if (problema !== null) throw invalidInput(problema, {});

    const db = await createServerSupabase();
    const { data, error } = await db
      .from("maintenance_attachments")
      .insert({
        organization_id: ctx.tenant.organizationId,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        storage_path: input.cale,
        denumire: input.denumire,
        tip: input.entity_type === "fault_report" ? "foto" : input.tip,
        mime: masura.mime,
        marime_bytes: masura.octeti,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);
    return { id: data.id };
  },
});

export const stergeFisier = createAction({
  name: "maintenance.attachment.delete",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: stergeFisierSchema,
  audit: {
    action: "delete",
    entityType: "maintenance_attachment",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/mentenanta", "/mentenanta/sesizari", "/portal/sesizari"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Ștergere LOGICĂ a rândului; obiectul din bucket rămâne (documentele
    // legale nu se șterg fizic) și îl curăță jobul zilnic dacă nu mai e legat.
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("maintenance_attachments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Fișierul nu a fost găsit, nu vă aparține sau a fost deja șters.");
    }
    return { id: data.id };
  },
});

// ── Opriri ───────────────────────────────────────────────────────────────────

export const inchideOprire = createAction({
  name: "maintenance.downtime.close",
  feature: "maintenance",
  permission: "maintenance:read",
  minScope: "own",
  input: inchideOprireSchema,
  audit: {
    action: "update",
    entityType: "equipment_oprire",
    entityId: (input) => input.id,
    allow: ["id", "sfarsit"],
  },
  revalidate: ["/mentenanta", "/mentenanta/sesizari", "/mentenanta/echipamente"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    // Politica: gestionarul, sau tehnicianul sesizării legate. `sfarsit >=
    // inceput` îl păzește CHECK-ul tabelei (23514, tradus).
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("equipment_opriri")
      .update({ sfarsit: input.sfarsit ?? new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .is("sfarsit", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Oprirea nu a fost găsită, nu vă este accesibilă sau a fost deja închisă.",
      );
    }
    return { id: data.id };
  },
});

export const inregistreazaOprire = createAction({
  name: "maintenance.downtime.create",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "team",
  input: inregistreazaOprireSchema,
  audit: {
    action: "create",
    entityType: "equipment_oprire",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["equipment_id", "inceput", "sfarsit", "tip"],
  },
  revalidate: (input) => [`/mentenanta/echipamente/${input.equipment_id}`, "/mentenanta"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("equipment_opriri")
      .insert({ ...input, organization_id: ctx.tenant.organizationId })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);
    return { id: data.id };
  },
});

// ── Setări ───────────────────────────────────────────────────────────────────

/**
 * Setările modulului, un rând per organizație: `upsert` pe `organization_id`
 * nu merge (indexul unic e PARȚIAL, `where deleted_at is null` — capcana 7),
 * deci se citește rândul viu și se alege între INSERT și UPDATE.
 */
export const salveazaSetariMentenanta = createAction({
  name: "maintenance.settings.save",
  feature: "maintenance",
  permission: "maintenance:update",
  minScope: "all",
  input: setariMentenantaSchema,
  audit: {
    action: "update",
    entityType: "maintenance_settings",
    allow: [
      "responsabili",
      "rsvti_employee_id",
      "inchidere_automata_zile",
      "prag_avertizare_zile",
      "prag_contor_necitit_zile",
      "ore_functionare_pe_zi",
      "zile_pe_saptamana",
      "cost_ora_oprire",
    ],
  },
  revalidate: ["/mentenanta", "/mentenanta/setari"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data: existent, error: eroareCitire } = await db
      .from("maintenance_settings")
      .select("id")
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) throw eroareCitire;

    if (existent === null) {
      const { data, error } = await db
        .from("maintenance_settings")
        .insert({ ...input, organization_id: ctx.tenant.organizationId })
        .select("id")
        .single();
      if (error !== null) traduEroare(error);
      return { id: data.id };
    }

    const { data, error } = await db
      .from("maintenance_settings")
      .update(input)
      .eq("id", existent.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Setările nu au putut fi salvate. Reîncărcați pagina.");
    return { id: data.id };
  },
});
