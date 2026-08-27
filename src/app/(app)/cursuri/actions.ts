"use server";

// src/app/(app)/cursuri/actions.ts
// Scrierile modulului de cursuri, dinspre administrator / HR / manager.
//
// `revalidate:` se DECLARĂ; niciun handler nu cheamă `revalidatePath()`.
// Fiecare tranziție face `.select()` după `.update()` și tratează rezultatul
// gol drept CONFLICT: un UPDATE respins de clauza `USING` a unei politici
// afectează ZERO RÂNDURI, FĂRĂ EROARE (capcana 17 din `capcane.md`).

import { z } from "zod";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import type { ActionContext } from "@/lib/actions/types";
import {
  BUCKET_CURSURI,
  construiesteCaleMaterial,
  potrivesteSemnatura,
  prefixCaleMaterial,
  verificaMaterial,
  verificaSubtitrare,
} from "@/lib/media/cale";
import { analizeazaLink } from "@/lib/media/link-extern";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import {
  actualizeazaCursSchema,
  actualizeazaLectieSchema,
  actualizeazaMaterialSchema,
  adaugaLectieSchema,
  anuleazaInrolareSchema,
  atribuieCursSchema,
  creeazaCursSchema,
  creeazaMaterialSchema,
  dezactiveazaCursSchema,
  mutaLectieSchema,
  pregatesteIncarcareSchema,
  publicaCursSchema,
  salveazaVersiuneFisierSchema,
  aplicaRegulileSchema,
  creeazaRegulaSchema,
  salveazaTestSchema,
  salveazaVersiuneLinkSchema,
  stergeLectieSchema,
  stergeRegulaSchema,
  stergeMaterialSchema,
} from "@/schemas/cursuri";

import { traduEroare } from "./erori";

const FEATURE = "courses" as const;
const RUTE = ["/cursuri", "/portal/cursurile-mele", "/portal"] as const;

/** Plafonul de ordine: parcarea din reordonare are nevoie de loc deasupra. */
const LIMITA_ORDINE = 500;

// ═══════════════════════════════════════════════════════════════════════════
// Cursuri
// ═══════════════════════════════════════════════════════════════════════════

export const creeazaCurs = createAction({
  name: "cursuri.curs.creeaza",
  feature: FEATURE,
  permission: "courses:create",
  minScope: "team",
  input: creeazaCursSchema,
  audit: {
    action: "create",
    entityType: "courses",
    entityId: (_i, d: { id: string }) => d.id,
    allow: ["cod", "denumire", "obligatoriu", "valabilitate_luni", "termen_zile"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("courses")
      .insert({ organization_id: ctx.tenant.organizationId, ...input })
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule("Cursul nu a putut fi creat.");
    return { id: data.id };
  },
});

export const actualizeazaCurs = createAction({
  name: "cursuri.curs.actualizeaza",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: actualizeazaCursSchema,
  audit: {
    action: "update",
    entityType: "courses",
    entityId: (i) => i.id,
    allow: ["id", "cod", "denumire", "obligatoriu", "valabilitate_luni", "termen_zile"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, { id, ...campuri }) => {
    const { data, error } = await ctx.supabase
      .from("courses")
      .update(campuri)
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Cursul nu a putut fi modificat sau nu vă este accesibil.");
    }
    return { id: data.id };
  },
});

export const publicaCurs = createAction({
  name: "cursuri.curs.publica",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: publicaCursSchema,
  audit: {
    action: "update",
    entityType: "courses",
    entityId: (i) => i.id,
    allow: ["id", "publicat"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    // Un curs fără nicio lecție nu se poate atribui — triggerul de pregătire îl
    // refuză cu P0001. Îl oprim la PUBLICARE, ca refuzul să apară pe ecranul
    // unde omul poate face ceva, nu abia când încearcă să-l dea cuiva.
    if (input.publicat) {
      const { count, error } = await ctx.supabase
        .from("course_items")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.tenant.organizationId)
        .eq("course_id", input.id)
        .is("deleted_at", null);
      if (error !== null) traduEroare(error);
      if ((count ?? 0) === 0) {
        throw businessRule("Adăugați cel puțin o lecție înainte de a publica cursul.");
      }
    }

    const { data, error } = await ctx.supabase
      .from("courses")
      .update({
        publicat: input.publicat,
        publicat_la: input.publicat ? new Date().toISOString() : null,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Cursul nu a putut fi modificat sau nu vă este accesibil.");
    }
    return { id: data.id };
  },
});

export const dezactiveazaCurs = createAction({
  name: "cursuri.curs.dezactiveaza",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: dezactiveazaCursSchema,
  audit: { action: "update", entityType: "courses", entityId: (i) => i.id, allow: ["id", "activ"] },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("courses")
      .update({ activ: input.activ })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Cursul nu a putut fi modificat sau nu vă este accesibil.");
    }
    return { id: data.id };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Materiale
// ═══════════════════════════════════════════════════════════════════════════

export const creeazaMaterial = createAction({
  name: "cursuri.material.creeaza",
  feature: FEATURE,
  permission: "courses:create",
  minScope: "team",
  input: creeazaMaterialSchema,
  audit: {
    action: "create",
    entityType: "course_materials",
    entityId: (_i, d: { id: string }) => d.id,
    allow: ["cod", "titlu", "fel", "sursa", "treapta_dovada", "procent_minim"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("course_materials")
      .insert({ organization_id: ctx.tenant.organizationId, ...input })
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule("Materialul nu a putut fi creat.");
    return { id: data.id };
  },
});

export const actualizeazaMaterial = createAction({
  name: "cursuri.material.actualizeaza",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: actualizeazaMaterialSchema,
  audit: {
    action: "update",
    entityType: "course_materials",
    entityId: (i) => i.id,
    allow: ["id", "cod", "titlu", "fel", "sursa", "treapta_dovada", "procent_minim"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, { id, ...campuri }) => {
    const { data, error } = await ctx.supabase
      .from("course_materials")
      .update(campuri)
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Materialul nu a putut fi modificat sau nu vă este accesibil.");
    }
    return { id: data.id };
  },
});

export const stergeMaterial = createAction({
  name: "cursuri.material.sterge",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: stergeMaterialSchema,
  audit: { action: "delete", entityType: "course_materials", entityId: (i) => i.id, allow: ["id"] },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    // `cursuri_protejeaza_catalogul` refuză ștergerea unui material aflat în
    // curs de parcurgere, cu numărul de persoane scris în mesaj.
    const { data, error } = await ctx.supabase
      .from("course_materials")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Materialul nu a putut fi șters sau nu vă este accesibil.");
    }
    return { id: data.id };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Versiuni — încărcare în doi pași, octeții NU trec prin server
// ═══════════════════════════════════════════════════════════════════════════

export const pregatesteIncarcareMaterial = createAction({
  name: "cursuri.versiune.pregateste",
  feature: FEATURE,
  permission: "courses:create",
  minScope: "team",
  input: pregatesteIncarcareSchema,
  audit: {
    action: "import",
    entityType: "course_material_versions",
    allow: ["material_id", "nume_fisier", "dimensiune", "mime", "este_subtitrare"],
  },
  handler: async (ctx: ActionContext, input) => {
    // Rate-limit pe fluxul de fișiere. Mecanismul exista în proiect
    // (`utils/rate-limit.ts`), dar nu era folosit pe NICIUN flux de fișiere.
    // Cheia pe ORGANIZAȚIE e cea care contează: un cont de admin compromis nu
    // poate umple bucket-ul într-o noapte.
    for (const [cheie, limita] of [
      [`media:incarcare:org:${ctx.tenant.organizationId}`, 30],
      [`media:incarcare:user:${ctx.user.id}`, 15],
    ] as const) {
      const { allowed } = await consumeRateLimit({
        key: cheie,
        limit: limita,
        windowSeconds: 3600,
      });
      if (!allowed) {
        throw businessRule("Prea multe încărcări într-o oră. Reîncercați mai târziu.");
      }
    }

    const problema = input.este_subtitrare
      ? verificaSubtitrare(input.mime, input.dimensiune)
      : verificaMaterial(input.fel, input.mime, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, { fisier: [problema] });

    const { data: material, error: eroareMaterial } = await ctx.supabase
      .from("course_materials")
      .select("id")
      .eq("id", input.material_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareMaterial !== null) traduEroare(eroareMaterial);
    if (material === null) throw notFound("Materialul nu există sau nu vă este accesibil.");

    const { count } = await ctx.supabase
      .from("course_material_versions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("material_id", input.material_id)
      .is("deleted_at", null);

    const cale = construiesteCaleMaterial({
      organizationId: ctx.tenant.organizationId,
      materialId: input.material_id,
      versiune: (count ?? 0) + 1,
      numeFisier: input.nume_fisier,
    });

    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_CURSURI)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null) {
      throw businessRule("Nu am putut pregăti încărcarea fișierului.");
    }
    return { cale, token: data.token };
  },
});

/**
 * Primii octeți ai obiectului DEJA încărcat.
 *
 * MIME-ul din formular e cel declarat de browser — un HTML redenumit `.mp4` îl
 * raportează cum vrea cel care încarcă. Singura verificare care înseamnă ceva
 * se face aici, pe conținutul real, înainte de a scrie rândul.
 */
async function primiiOcteti(ctx: ActionContext, cale: string): Promise<Uint8Array | null> {
  const { data, error } = await ctx.supabase.storage.from(BUCKET_CURSURI).createSignedUrl(cale, 60);
  if (error !== null || data === null) return null;
  const raspuns = await fetch(data.signedUrl, { headers: { Range: "bytes=0-4095" } });
  if (!raspuns.ok) return null;
  return new Uint8Array(await raspuns.arrayBuffer());
}

export const salveazaVersiuneFisier = createAction({
  name: "cursuri.versiune.salveaza_fisier",
  feature: FEATURE,
  permission: "courses:create",
  minScope: "team",
  input: salveazaVersiuneFisierSchema,
  audit: {
    action: "create",
    entityType: "course_material_versions",
    entityId: (_i, d: { id: string }) => d.id,
    allow: ["material_id", "nume_fisier", "mime", "durata_secunde", "numar_pagini"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    // Anti-traversal: calea salvată trebuie să fie chiar cea pe care am semnat-o.
    const prefix = prefixCaleMaterial(ctx.tenant.organizationId, input.material_id);
    if (!input.cale.startsWith(prefix)) {
      const mesaj = "Calea fișierului nu corespunde acestui material.";
      throw invalidInput(mesaj, { cale: [mesaj] });
    }
    if (input.subtitrare_cale !== null && !input.subtitrare_cale.startsWith(prefix)) {
      const mesaj = "Calea subtitrării nu corespunde acestui material.";
      throw invalidInput(mesaj, { subtitrare_cale: [mesaj] });
    }

    const { data: material, error: eroareMaterial } = await ctx.supabase
      .from("course_materials")
      .select("id, fel, treapta_dovada")
      .eq("id", input.material_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareMaterial !== null) traduEroare(eroareMaterial);
    if (material === null) throw notFound("Materialul nu există sau nu vă este accesibil.");

    // Parcurgerea măsurată fără durată e o lecție imposibil de închis.
    if (material.treapta_dovada === "parcurgere" && input.durata_secunde === null) {
      const mesaj = "Completați durata filmului: fără ea, parcurgerea nu se poate măsura.";
      throw invalidInput(mesaj, { durata_secunde: [mesaj] });
    }

    const octeti = await primiiOcteti(ctx, input.cale);
    if (octeti === null || !potrivesteSemnatura(input.mime, octeti)) {
      // Fișierul nu e ce pretinde. Îl scoatem din bucket ca să nu rămână un
      // obiect orfan pe care nimeni nu-l mai revendică.
      //
      // `createAdminSupabase` ocolește RLS deliberat: `storage.objects` NU are
      // politică DELETE (0002:1517), deci ștergerea fizică nu se poate face
      // altfel. Calea e verificată mai sus împotriva prefixului organizației,
      // deci nu poate atinge alt tenant.
      await createAdminSupabase().storage.from(BUCKET_CURSURI).remove([input.cale]);
      throw businessRule("Fișierul încărcat nu are conținutul tipului declarat.");
    }

    const { data: ultima } = await ctx.supabase
      .from("course_material_versions")
      .select("versiune")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("material_id", input.material_id)
      .is("deleted_at", null)
      .order("versiune", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await ctx.supabase
      .from("course_material_versions")
      .insert({
        organization_id: ctx.tenant.organizationId,
        material_id: input.material_id,
        versiune: (ultima?.versiune ?? 0) + 1,
        fisier_path: input.cale,
        fisier_nume: input.nume_fisier,
        fisier_mime: input.mime,
        subtitrare_path: input.subtitrare_cale,
        durata_secunde: input.durata_secunde,
        numar_pagini: input.numar_pagini,
        nota_versiune: input.nota_versiune,
        publicata_la: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule("Versiunea nu a putut fi salvată.");

    const { error: eroareCurenta } = await ctx.supabase
      .from("course_materials")
      .update({ versiune_curenta_id: data.id })
      .eq("id", input.material_id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (eroareCurenta !== null) traduEroare(eroareCurenta);

    return { id: data.id };
  },
});

export const salveazaVersiuneLink = createAction({
  name: "cursuri.versiune.salveaza_link",
  feature: FEATURE,
  permission: "courses:create",
  minScope: "team",
  input: salveazaVersiuneLinkSchema,
  audit: {
    action: "create",
    entityType: "course_material_versions",
    entityId: (_i, d: { id: string }) => d.id,
    allow: ["material_id", "durata_secunde"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const rezultat = analizeazaLink(input.adresa);
    if (!rezultat.ok) throw invalidInput(rezultat.motiv, { adresa: [rezultat.motiv] });

    const { data: ultima } = await ctx.supabase
      .from("course_material_versions")
      .select("versiune")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("material_id", input.material_id)
      .is("deleted_at", null)
      .order("versiune", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await ctx.supabase
      .from("course_material_versions")
      .insert({
        organization_id: ctx.tenant.organizationId,
        material_id: input.material_id,
        versiune: (ultima?.versiune ?? 0) + 1,
        link_furnizor: rezultat.link.furnizor,
        link_id: rezultat.link.id,
        link_cod_privat: rezultat.link.codPrivat,
        durata_secunde: input.durata_secunde,
        nota_versiune: input.nota_versiune,
        publicata_la: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule("Versiunea nu a putut fi salvată.");

    const { error: eroareCurenta } = await ctx.supabase
      .from("course_materials")
      .update({ versiune_curenta_id: data.id })
      .eq("id", input.material_id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (eroareCurenta !== null) traduEroare(eroareCurenta);

    return { id: data.id };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Lecții (course_items)
// ═══════════════════════════════════════════════════════════════════════════

export const adaugaLectie = createAction({
  name: "cursuri.lectie.adauga",
  feature: FEATURE,
  permission: "courses:create",
  minScope: "team",
  input: adaugaLectieSchema,
  audit: {
    action: "create",
    entityType: "course_items",
    entityId: (_i, d: { id: string }) => d.id,
    allow: ["course_id", "material_id", "obligatoriu"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const { data: ultima } = await ctx.supabase
      .from("course_items")
      .select("ordine")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("course_id", input.course_id)
      .is("deleted_at", null)
      .order("ordine", { ascending: false })
      .limit(1)
      .maybeSingle();

    const ordine = (ultima?.ordine ?? 0) + 1;
    if (ordine > LIMITA_ORDINE) {
      throw businessRule(`Un curs poate avea cel mult ${String(LIMITA_ORDINE)} de lecții.`);
    }

    const { data, error } = await ctx.supabase
      .from("course_items")
      .insert({ organization_id: ctx.tenant.organizationId, ...input, ordine })
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule("Lecția nu a putut fi adăugată.");
    return { id: data.id };
  },
});

export const actualizeazaLectie = createAction({
  name: "cursuri.lectie.actualizeaza",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: actualizeazaLectieSchema,
  audit: {
    action: "update",
    entityType: "course_items",
    entityId: (i) => i.id,
    allow: ["id", "obligatoriu"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("course_items")
      .update({ obligatoriu: input.obligatoriu })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Lecția nu a putut fi modificată sau nu vă este accesibilă.");
    }
    return { id: data.id };
  },
});

export const stergeLectie = createAction({
  name: "cursuri.lectie.sterge",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: stergeLectieSchema,
  audit: { action: "delete", entityType: "course_items", entityId: (i) => i.id, allow: ["id"] },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("course_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Lecția nu a putut fi ștearsă sau nu vă este accesibilă.");
    }
    return { id: data.id };
  },
});

/**
 * Reordonarea, în TREI update-uri cu parcare la `max+1`.
 *
 * `course_items_ordine_uk` NU e deferabil, deci un schimb direct între două
 * rânduri ar lovi indexul unic la primul UPDATE. PostgREST nu expune tranzacții,
 * așa că fiecare pas verifică `.select()`, iar dacă un rând lipsește mesajul
 * spune explicit că ordinea a rămas într-o stare intermediară — tăcerea ar fi
 * mai rea. Același mecanism ca `mutaPas` din modulul de integrare.
 */
export const mutaLectie = createAction({
  name: "cursuri.lectie.muta",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: mutaLectieSchema,
  audit: {
    action: "update",
    entityType: "course_items",
    entityId: (i) => i.id,
    allow: ["id", "directie"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const org = ctx.tenant.organizationId;

    const { data: curenta, error: eroareCurenta } = await ctx.supabase
      .from("course_items")
      .select("id, course_id, ordine")
      .eq("id", input.id)
      .eq("organization_id", org)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCurenta !== null) traduEroare(eroareCurenta);
    if (curenta === null) throw notFound("Lecția nu există sau nu vă este accesibilă.");

    const catreSus = input.directie === "sus";
    const vecinaQ = ctx.supabase
      .from("course_items")
      .select("id, ordine")
      .eq("organization_id", org)
      .eq("course_id", curenta.course_id)
      .is("deleted_at", null);
    const { data: vecina, error: eroareVecina } = await (
      catreSus ? vecinaQ.lt("ordine", curenta.ordine) : vecinaQ.gt("ordine", curenta.ordine)
    )
      .order("ordine", { ascending: !catreSus })
      .limit(1)
      .maybeSingle();
    if (eroareVecina !== null) traduEroare(eroareVecina);
    if (vecina === null) {
      throw businessRule(catreSus ? "Lecția este deja prima." : "Lecția este deja ultima.");
    }

    const { data: maxim } = await ctx.supabase
      .from("course_items")
      .select("ordine")
      .eq("organization_id", org)
      .eq("course_id", curenta.course_id)
      .is("deleted_at", null)
      .order("ordine", { ascending: false })
      .limit(1)
      .maybeSingle();
    const parcare = (maxim?.ordine ?? curenta.ordine) + 1;
    if (parcare > LIMITA_ORDINE) {
      throw businessRule("Nu mai există loc de manevră pentru reordonare. Ștergeți o lecție.");
    }

    const pas = async (id: string, ordine: number, mesaj: string): Promise<void> => {
      const { data, error } = await ctx.supabase
        .from("course_items")
        .update({ ordine })
        .eq("id", id)
        .eq("organization_id", org)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error !== null) traduEroare(error);
      if (data === null) throw businessRule(mesaj);
    };

    await pas(curenta.id, parcare, "Reordonarea nu a pornit. Reîncărcați pagina.");
    await pas(
      vecina.id,
      curenta.ordine,
      "Reordonarea s-a oprit la jumătate. Reîncărcați pagina și reluați mutarea.",
    );
    await pas(
      curenta.id,
      vecina.ordine,
      "Reordonarea s-a oprit la ultimul pas. Reîncărcați pagina și reluați mutarea.",
    );

    return { id: curenta.id };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Înrolări
// ═══════════════════════════════════════════════════════════════════════════

export const atribuieCurs = createAction({
  name: "cursuri.inrolare.atribuie",
  feature: FEATURE,
  permission: "courses:create",
  minScope: "team",
  input: atribuieCursSchema,
  audit: {
    action: "create",
    entityType: "course_enrollments",
    allow: ["course_id", "employee_ids", "termen"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    // Câte un INSERT pe persoană, nu unul în bloc: triggerul de pregătire
    // calculează ciclul per rând, iar un eșec pe o singură persoană (deja
    // înrolată la ciclul curent, fișă inactivă) n-are voie să anuleze restul.
    let atribuite = 0;
    let esuate = 0;
    for (const employeeId of input.employee_ids) {
      const { error } = await ctx.supabase.from("course_enrollments").insert({
        organization_id: ctx.tenant.organizationId,
        course_id: input.course_id,
        employee_id: employeeId,
        motiv: "manual" as const,
        ...(input.termen === null ? {} : { termen: input.termen }),
      });
      if (error === null) atribuite += 1;
      else esuate += 1;
    }

    if (atribuite === 0) {
      throw businessRule(
        "Nicio atribuire nu a reușit. Verificați dacă cursul e publicat și are cel puțin o lecție.",
      );
    }
    return { atribuite, esuate };
  },
});

export const anuleazaInrolare = createAction({
  name: "cursuri.inrolare.anuleaza",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: anuleazaInrolareSchema,
  audit: {
    action: "update",
    entityType: "course_enrollments",
    entityId: (i) => i.id,
    allow: ["id", "motiv"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("course_enrollments")
      .update({ status: "anulat" as const, motiv_anulare: input.motiv })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Înrolarea nu a putut fi anulată sau nu vă este accesibilă.");
    }
    return { id: data.id };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Previzualizare pentru administrator
// ═══════════════════════════════════════════════════════════════════════════

export const linkPreviewMaterial = createAction({
  name: "cursuri.versiune.previzualizeaza",
  feature: FEATURE,
  permission: "courses:read",
  minScope: "team",
  input: z.object({ version_id: z.uuid() }),
  audit: {
    action: "view",
    entityType: "course_material_versions",
    entityId: (i) => i.version_id,
    allow: ["version_id"],
  },
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("course_material_versions")
      .select("id, fisier_path, fisier_nume")
      .eq("id", input.version_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null || data.fisier_path === null) {
      throw notFound("Versiunea nu are un fișier încărcat.");
    }
    // TTL scurt, ca la documentele de personal: linkul e pentru fila care se
    // deschide acum, nu pentru a fi trimis mai departe.
    const { data: semnat, error: eroareSemnare } = await ctx.supabase.storage
      .from(BUCKET_CURSURI)
      .createSignedUrl(data.fisier_path, 120);
    if (eroareSemnare !== null || semnat === null) {
      throw businessRule("Nu am putut pregăti previzualizarea.");
    }
    return { url: semnat.signedUrl, expiraSecunde: 120 };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Testul grilă (0077)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Salvează întrebările pe versiune și cheia în tabela ei separată.
 *
 * DOUĂ scrieri, nu una, și ordinea contează: întâi cheia, apoi întrebările.
 * Dacă a doua eșuează, rămâne o cheie fără întrebări — inofensivă, invizibilă.
 * Invers ar rămâne un test fără cheie, iar `curs_evalueaza_test` ar da 0 la
 * toată lumea: toți pică, nimeni nu înțelege de ce.
 */
export const salveazaTest = createAction({
  name: "cursuri.test.salveaza",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: salveazaTestSchema,
  audit: {
    action: "update",
    entityType: "course_material_versions",
    entityId: (i) => i.version_id,
    // Fără `intrebari` în allow-list: cheia de răspuns ar ajunge în jurnalul de
    // audit, care e citibil de `org_admin` — și oricum n-are ce căuta acolo.
    allow: ["version_id"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const org = ctx.tenant.organizationId;

    const { data: versiune, error: eroareVersiune } = await ctx.supabase
      .from("course_material_versions")
      .select("id")
      .eq("id", input.version_id)
      .eq("organization_id", org)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareVersiune !== null) traduEroare(eroareVersiune);
    if (versiune === null) throw notFound("Versiunea nu există sau nu vă este accesibilă.");

    const chei = Object.fromEntries(input.intrebari.map((i) => [i.id, i.corect]));
    const { error: eroareCheie } = await ctx.supabase
      .from("course_answer_keys")
      .upsert(
        { organization_id: org, version_id: input.version_id, chei },
        { onConflict: "version_id" },
      );
    if (eroareCheie !== null) traduEroare(eroareCheie);

    // Întrebările pleacă FĂRĂ `corect`: coloana e citibilă de angajat.
    const intrebari = input.intrebari.map(({ corect: _corect, ...restul }) => restul);
    const { data, error } = await ctx.supabase
      .from("course_material_versions")
      .update({ intrebari })
      .eq("id", input.version_id)
      .eq("organization_id", org)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule("Testul nu a putut fi salvat.");
    return { id: data.id, intrebari: input.intrebari.length };
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// Reguli de atribuire (0078)
// ═══════════════════════════════════════════════════════════════════════════

export const creeazaRegula = createAction({
  name: "cursuri.regula.creeaza",
  feature: FEATURE,
  permission: "courses:create",
  minScope: "team",
  input: creeazaRegulaSchema,
  audit: {
    action: "create",
    entityType: "course_assignment_rules",
    entityId: (_i, d: { id: string }) => d.id,
    allow: ["course_id", "criteriu", "department_id", "job_position_id", "rol", "employee_id"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("course_assignment_rules")
      .insert({ organization_id: ctx.tenant.organizationId, ...input })
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw businessRule("Regula nu a putut fi creată.");
    return { id: data.id };
  },
});

export const stergeRegula = createAction({
  name: "cursuri.regula.sterge",
  feature: FEATURE,
  permission: "courses:update",
  minScope: "team",
  input: stergeRegulaSchema,
  audit: {
    action: "delete",
    entityType: "course_assignment_rules",
    entityId: (i) => i.id,
    allow: ["id"],
  },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("course_assignment_rules")
      .update({ deleted_at: new Date().toISOString(), activ: false })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule("Regula nu a putut fi ștearsă sau nu vă este accesibilă.");
    }
    return { id: data.id };
  },
});

/**
 * Aplică regulile acum, fără să aștepte jobul de noapte.
 *
 * `internal.cursuri_aplica_regulile` e `security definer` și trăiește în schema
 * `internal`, la care PostgREST nu ajunge — `.rpc()` vede doar `public`. Deci
 * aplicarea imediată se face reproducând selecția aici, prin acțiune, cu
 * clientul îngrădit de RLS: exact aceiași oameni pe care i-ar prinde și jobul,
 * dar numai dintre cei pe care apelantul are voie să-i vadă.
 */
export const aplicaRegulile = createAction({
  name: "cursuri.regula.aplica",
  feature: FEATURE,
  permission: "courses:create",
  minScope: "team",
  input: aplicaRegulileSchema,
  audit: { action: "create", entityType: "course_enrollments", allow: ["course_id"] },
  revalidate: RUTE,
  handler: async (ctx: ActionContext, input) => {
    const org = ctx.tenant.organizationId;
    if (input.course_id === null) {
      throw businessRule("Alegeți cursul pentru care se aplică regulile.");
    }

    const [reguli, angajati, membri, existente] = await Promise.all([
      ctx.supabase
        .from("course_assignment_rules")
        .select(
          "criteriu, department_id, job_position_id, rol, employee_id, decalaj_zile, termen_zile",
        )
        .eq("organization_id", org)
        .eq("course_id", input.course_id)
        .eq("activ", true)
        .is("deleted_at", null)
        .limit(200),
      ctx.supabase
        .from("employees")
        .select("id, department_id, job_position_id, hired_on, user_id")
        .eq("organization_id", org)
        .in("status", ["activ", "suspendat", "preaviz"])
        .is("deleted_at", null)
        .limit(500),
      ctx.supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", org)
        .eq("status", "active")
        .is("deleted_at", null)
        .limit(500),
      ctx.supabase
        .from("course_enrollments")
        .select("employee_id")
        .eq("organization_id", org)
        .eq("course_id", input.course_id)
        .is("deleted_at", null)
        .in("status", ["neinceput", "in_curs", "finalizat"])
        .limit(500),
    ]);
    if (reguli.error !== null) traduEroare(reguli.error);
    if (angajati.error !== null) traduEroare(angajati.error);

    const rolPeUtilizator = new Map((membri.data ?? []).map((m) => [m.user_id, m.role as string]));
    const deja = new Set((existente.data ?? []).map((e) => e.employee_id));
    const azi = new Date().toISOString().slice(0, 10);

    const potriviti = new Map<string, number | null>();
    for (const regula of reguli.data ?? []) {
      for (const angajat of angajati.data ?? []) {
        if (deja.has(angajat.id) || potriviti.has(angajat.id)) continue;
        // Decalajul se numără de la angajare. O fișă fără dată intră imediat:
        // altfel n-ar intra niciodată, tăcut.
        if (
          regula.decalaj_zile > 0 &&
          angajat.hired_on !== null &&
          new Date(new Date(angajat.hired_on).getTime() + regula.decalaj_zile * 86_400_000)
            .toISOString()
            .slice(0, 10) > azi
        ) {
          continue;
        }
        const potrivit =
          regula.criteriu === "toti" ||
          (regula.criteriu === "departament" && angajat.department_id === regula.department_id) ||
          (regula.criteriu === "functie" && angajat.job_position_id === regula.job_position_id) ||
          (regula.criteriu === "angajat" && angajat.id === regula.employee_id) ||
          (regula.criteriu === "rol" &&
            angajat.user_id !== null &&
            rolPeUtilizator.get(angajat.user_id) === regula.rol);
        if (potrivit) potriviti.set(angajat.id, regula.termen_zile);
      }
    }

    if (potriviti.size === 0) return { atribuite: 0, esuate: 0 };

    let atribuite = 0;
    let esuate = 0;
    for (const [employeeId, termenZile] of potriviti) {
      const { error } = await ctx.supabase.from("course_enrollments").insert({
        organization_id: org,
        course_id: input.course_id,
        employee_id: employeeId,
        motiv: "regula" as const,
        ...(termenZile === null
          ? {}
          : {
              termen: new Date(Date.now() + termenZile * 86_400_000).toISOString().slice(0, 10),
            }),
      });
      if (error === null) atribuite += 1;
      else esuate += 1;
    }
    return { atribuite, esuate };
  },
});
