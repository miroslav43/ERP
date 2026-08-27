"use server";

// src/app/(portal)/portal/cursurile-mele/actions.ts
// Scrierile dinspre ANGAJAT. Trei acțiuni, atât: raportarea progresului,
// încheierea unei lecții și semnarea declarației.
//
// ── DE CE ATÂT DE PUȚIN ───────────────────────────────────────────────────
// Starea înrolării și dovada de parcurgere NU se scriu de aici. Le calculează
// baza, din itemi, prin triggere `security definer` (0075). Angajatul n-are
// nici politică, nici `grant` pe `course_enrollments` și pe
// `course_completion_records` — deci nu există niciun drum prin care să-și
// declare singur cursul terminat, nici măcar prin PostgREST direct.
//
// Pe `course_enrollment_items` are `grant update` DOAR pe coloanele de progres.
// Contractul pedagogic (treaptă, prag, durată, versiune) nu e în grant, iar
// triggerul îl restaurează oricum din OLD. Două bariere, independente.

import { headers } from "next/headers";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, forbidden, notFound } from "@/lib/actions/errors";
import type { ActionContext } from "@/lib/actions/types";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { fisaMea } from "@/lib/queries/portal";
import {
  incheieLectieSchema,
  raporteazaProgresSchema,
  semneazaLectieSchema,
  trimiteTestSchema,
} from "@/schemas/cursuri";

import { traduEroare } from "@/app/(app)/cursuri/erori";

const FEATURE = "courses" as const;
const RUTE = ["/portal/cursurile-mele", "/portal"] as const;

const FORMAT_IP = /^[0-9a-fA-F.:]{3,45}$/;

async function ipCererii(): Promise<string | null> {
  const h = await headers();
  const brut = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  return FORMAT_IP.test(brut) ? brut : null;
}

/**
 * Fișa proprie, cerută explicit.
 *
 * Chiar dacă RLS ar restrânge oricum, un cont cu `courses:read = all` care
 * intră în portal ar vedea altfel lecțiile altcuiva sub „ale mele". Aceeași
 * grijă ca la `/portal/integrarea-mea`.
 */
async function fisaProprie(ctx: ActionContext): Promise<string> {
  const stare = await fisaMea(ctx.tenant.organizationId, ctx.user.id);
  if (stare.stare !== "ok") {
    throw forbidden("Nu aveți o fișă de angajat în această organizație.");
  }
  return stare.fisa.id;
}

/**
 * Bătaia de inimă a vizionării.
 *
 * Secundele trimise sunt o PROPUNERE: triggerul le clampează pe ceasul
 * serverului, deci un client care trimite +3600 la fiecare bătaie rămâne cu
 * diferența reală. Nu e o dovadă rezistentă la falsificare și nici nu pretinde
 * să fie — greutatea probatorie stă în treptele `test` și `declaratie`.
 */
export const raporteazaProgres = createAction({
  name: "cursuri.lectie.progres",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "own",
  input: raporteazaProgresSchema,
  // Fără audit pe fiecare bătaie: la o vizionare de 20 de minute ar însemna
  // zeci de rânduri fără nicio valoare de investigație. Ce contează —
  // finalizarea și semnătura — se auditează mai jos.
  audit: {
    action: "update",
    entityType: "course_enrollment_items",
    entityId: (i) => i.id,
    allow: [],
  },
  handler: async (ctx: ActionContext, input) => {
    const fisa = await fisaProprie(ctx);
    const { data, error } = await ctx.supabase
      .from("course_enrollment_items")
      .update({
        secunde_vizionate: input.secunde_vizionate,
        pozitie_secunde: input.pozitie_secunde,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", fisa)
      .is("deleted_at", null)
      .select("id, secunde_vizionate, pozitie_secunde, status")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Progresul nu s-a putut înregistra. Reîncărcați pagina.");
    }
    // Întoarcem valorile REALE, cele clampate de server, nu ce a trimis
    // clientul: altfel bara de progres ar arăta un număr pe care baza l-a refuzat.
    return {
      secundeVizionate: data.secunde_vizionate,
      pozitieSecunde: data.pozitie_secunde,
      status: data.status,
    };
  },
});

export const incheieLectie = createAction({
  name: "cursuri.lectie.incheie",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "own",
  input: incheieLectieSchema,
  audit: {
    action: "update",
    entityType: "course_enrollment_items",
    entityId: (i) => i.id,
    allow: ["id"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const fisa = await fisaProprie(ctx);
    const { data, error } = await ctx.supabase
      .from("course_enrollment_items")
      .update({ status: "finalizat" as const })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", fisa)
      .is("deleted_at", null)
      .select("id, enrollment_id, status")
      .maybeSingle();
    // Triggerul refuză cu P0001 și un mesaj util („Mai aveți de parcurs…”),
    // care ajunge la om prin `traduEroare`.
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Lecția nu s-a putut încheia. Reîncărcați pagina.");
    }
    return { id: data.id, enrollmentId: data.enrollment_id };
  },
});

/**
 * Semnătura electronică simplă a declarației.
 *
 * ── DE CE OCOLEȘTE RLS ────────────────────────────────────────────────────
 * `semnatura_nume`, `semnat_la` și `semnatura_ip` NU sunt în `grant update`
 * pentru `authenticated` (0075, secțiunea 8). Deliberat: dacă angajatul ar
 * putea scrie el coloanele, ar putea scrie și un IP inventat, iar semnătura
 * n-ar mai proba nimic. Aici IP-ul vine din antetul cererii, citit pe server.
 *
 * Filtrele sunt explicite pe organizație ȘI pe fișa proprie, exact fiindcă RLS
 * nu mai apără: fișa se rezolvă din sesiune, nu din intrarea clientului.
 */
export const semneazaLectie = createAction({
  name: "cursuri.lectie.semneaza",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "own",
  input: semneazaLectieSchema,
  audit: {
    action: "update",
    entityType: "course_enrollment_items",
    entityId: (i) => i.id,
    allow: ["id", "nume"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const fisa = await fisaProprie(ctx);

    // Citim sub RLS: dacă lecția nu-i aparține sau nu cere declarație, aflăm
    // aici, cu clientul îngrădit, nu cu cel de serviciu.
    const { data: lectie, error: eroareLectie } = await ctx.supabase
      .from("course_enrollment_items")
      .select("id, treapta_dovada, status, enrollment_id")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", fisa)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareLectie !== null) traduEroare(eroareLectie);
    if (lectie === null) throw notFound("Lecția nu există sau nu vă este accesibilă.");
    if (lectie.treapta_dovada !== "declaratie") {
      throw businessRule("Această lecție nu cere o declarație asumată.");
    }
    if (lectie.status === "finalizat") {
      throw businessRule("Ați semnat deja această declarație.");
    }

    const ip = await ipCererii();
    const { data, error } = await createAdminSupabase()
      .from("course_enrollment_items")
      .update({
        semnatura_nume: input.nume,
        semnat_la: new Date().toISOString(),
        semnatura_ip: ip,
        status: "finalizat" as const,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", fisa)
      .is("deleted_at", null)
      .select("id, enrollment_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule("Declarația nu s-a putut înregistra.");

    return { id: data.id, enrollmentId: data.enrollment_id };
  },
});

/**
 * Trimiterea testului grilă.
 *
 * Clientul trimite DOAR răspunsurile. Nota, numărul încercării și verdictul le
 * scrie triggerul `internal.cursuri_evalueaza_incercarea`, din cheia care stă
 * în `course_answer_keys` — o tabelă la care angajatul n-are nicio politică,
 * deci nu vede zero rânduri „din greșeală", ci prin construcție.
 *
 * Coloanele `scor`, `promovat` și `numar` nici măcar nu sunt în `grant insert`
 * pentru `authenticated`: o încercare de a le trimite eșuează cu 42501,
 * zgomotos. Bariera de privilegiu și cea de trigger sunt independente.
 */
export const trimiteTest = createAction({
  name: "cursuri.test.trimite",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "own",
  input: trimiteTestSchema,
  audit: {
    action: "create",
    entityType: "course_quiz_attempts",
    entityId: (i) => i.enrollment_item_id,
    // Fără `raspunsuri`: ce a bifat omul la fiecare întrebare nu e o informație
    // de investigație, e o urmă în plus despre o persoană.
    allow: ["enrollment_item_id"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const fisa = await fisaProprie(ctx);

    const { data: lectie, error: eroareLectie } = await ctx.supabase
      .from("course_enrollment_items")
      .select("id, version_id, treapta_dovada, status")
      .eq("id", input.enrollment_item_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("employee_id", fisa)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareLectie !== null) traduEroare(eroareLectie);
    if (lectie === null) throw notFound("Lecția nu există sau nu vă este accesibilă.");
    if (lectie.treapta_dovada !== "test") {
      throw businessRule("Această lecție nu are test.");
    }
    if (lectie.version_id === null) {
      throw businessRule("Lecția nu are conținut. Anunțați administratorul.");
    }
    if (lectie.status === "finalizat") {
      throw businessRule("Ați trecut deja acest test.");
    }

    const { data, error } = await ctx.supabase
      .from("course_quiz_attempts")
      .insert({
        organization_id: ctx.tenant.organizationId,
        enrollment_item_id: input.enrollment_item_id,
        employee_id: fisa,
        version_id: lectie.version_id,
        raspunsuri: input.raspunsuri,
      })
      .select("id, scor, promovat, numar")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule("Testul nu s-a putut înregistra.");

    return {
      scor: data.scor,
      promovat: data.promovat,
      numar: data.numar,
    };
  },
});
