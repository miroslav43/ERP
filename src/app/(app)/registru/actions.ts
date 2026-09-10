"use server";

// src/app/(app)/registru/actions.ts
//
// ── DE CE TOATE TREC PRIN RPC, NU PRIN `.from(...).insert(...)` ─────────────
// Grantul de INSERT pe `registru_documente` s-a revocat în 0135. Motivul e OMFP
// 2634/2015 pct. 58 lit. o): dacă numărul ar veni din client, s-ar putea fabrica
// sau repeta. Numerele se alocă exclusiv în bază, într-un singur
// `insert … on conflict … returning`, fără fereastră între citire și scriere.
//
// Consecința pentru cine scrie cod aici: un `.insert()` pe registru nu dă o
// eroare de tip, ci 42501 la execuție. `erori.ts` îl traduce într-un mesaj care
// spune ce să folosești în loc.

import { createAction } from "@/lib/actions/create-action";
import { notFound } from "@/lib/actions/errors";
import {
  anExercitiuSchema,
  avizNomenclatorSchema,
  dosarNomenclatorSchema,
  inregistrareManualaSchema,
  redeschidereExercitiuSchema,
} from "@/schemas/registru";

import { traduEroare } from "./erori";

const CAI_REVALIDARE = ["/registru"] as const;

/**
 * Înregistrarea manuală a unui document primit pe hârtie — Ordin 217/1996 art. 8.
 *
 * Fără ea registrul e structural incomplet: o demisie, o adresă de la
 * inspectorat sau o citație nu au rând în nicio tabelă, deci niciun trigger nu
 * le poate prinde. Codul muncii art. 81 obligă expres la înregistrarea demisiei,
 * iar refuzul dă salariatului dreptul s-o dovedească prin orice mijloc de probă.
 *
 * Fluxul de demisie NU există azi în aplicație. Până se construiește, pe aici trece.
 */
export const inregistreazaDocumentManual = createAction({
  name: "registru.manual",
  feature: "nucleu",
  permission: "registru:update",
  minScope: "all",
  input: inregistrareManualaSchema,
  audit: {
    action: "create",
    entityType: "registru_document",
    allow: ["sens", "tip_document", "continut_rezumat", "numar_document_emitent", "emitent"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase.rpc("inregistreaza_document_manual", {
      p_organization_id: ctx.tenant.organizationId,
      p_sens: input.sens,
      p_tip_document: input.tip_document,
      p_continut_rezumat: input.continut_rezumat,
      p_numar_document_emitent: input.numar_document_emitent,
      p_data_document_emitent: input.data_document_emitent,
      p_emitent: input.emitent,
      p_numar_file: input.numar_file,
      p_numar_anexe: input.numar_anexe,
      p_punct_lucru_id: input.punct_lucru_id,
    });
    if (error !== null) traduEroare(error);

    return { numarAfisat: data };
  },
});

/**
 * Închiderea exercițiului — OMFP 2634/2015 pct. 58 lit. h): „să nu permită
 * inserări, modificări sau eliminări de date pentru o perioadă închisă".
 *
 * Funcția din bază calculează și amprenta SHA-256 peste registrul anului. Pct. 58
 * lit. d) interzice adăugările ulterioare; amprenta le face DETECTABILE, ceea ce
 * e singurul lucru pe care un program îl poate garanta.
 */
export const inchideExercitiu = createAction({
  name: "registru.close_year",
  feature: "nucleu",
  permission: "registru:update",
  minScope: "all",
  input: anExercitiuSchema,
  audit: { action: "update", entityType: "registru_exercitiu", allow: ["an"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase.rpc("inchide_exercitiu_registru", {
      p_organization_id: ctx.tenant.organizationId,
      p_an: input.an,
    });
    if (error !== null) traduEroare(error);

    return { amprenta: data };
  },
});

/**
 * Redeschiderea, cu prag mai sus decât închiderea: rupe o listare care poate fi
 * deja la un control. Cere `organizations:update`, adică `org_admin`.
 *
 * Amprenta veche NU se șterge la redeschidere — cicatricea rămâne permanentă, ca
 * diferența față de registrul listat să fie demonstrabilă. Varianta „imposibil de
 * redeschis" se rezolvă în practică prin cineva care umblă direct în bază, unde
 * nu se mai vede nimic.
 */
export const redeschideExercitiu = createAction({
  name: "registru.reopen_year",
  feature: "nucleu",
  permission: "organizations:update",
  minScope: "all",
  input: redeschidereExercitiuSchema,
  audit: { action: "update", entityType: "registru_exercitiu", allow: ["an", "motiv"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx, input) => {
    const { error } = await ctx.supabase.rpc("redeschide_exercitiu_registru", {
      p_organization_id: ctx.tenant.organizationId,
      p_an: input.an,
      p_motiv: input.motiv,
    });
    if (error !== null) traduEroare(error);

    return null;
  },
});

/* ---------------------------- nomenclatorul ------------------------------ */

const CAI_NOMENCLATOR = ["/registru", "/registru/nomenclator"] as const;

/**
 * Adaptarea unui dosar din nomenclatorul implicit.
 *
 * Nomenclatorul livrat de aplicație e un punct de plecare generat din module, nu
 * un aviz: art. 11 spune că se întocmește „de către fiecare creator pentru
 * documentele proprii". Firma îi schimbă conținutul dosarelor și termenele de
 * păstrare, apoi îl supune confirmării Arhivelor Naționale.
 *
 * Indicativul lipsește deliberat din câmpurile editabile: e o coloană GENERATĂ
 * din cifra romană, literă și cifra arabă. Un UPDATE peste ea ar fi respins de
 * bază, nu ignorat tăcut.
 */
export const actualizeazaDosarNomenclator = createAction({
  name: "registru.nomenclator_dosar",
  feature: "nucleu",
  permission: "registru:update",
  minScope: "all",
  input: dosarNomenclatorSchema,
  audit: {
    action: "update",
    entityType: "nomenclator_dosar",
    allow: ["id", "termen_pastrare"],
  },
  revalidate: CAI_NOMENCLATOR,
  handler: async (ctx, input) => {
    const { data, error } = await ctx.supabase
      .from("nomenclator_dosare")
      .update({ continut: input.continut, termen_pastrare: input.termen_pastrare })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      // `.select()` după `.update()`: un UPDATE respins de clauza `USING` a
      // politicii afectează ZERO rânduri, fără nicio eroare.
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Dosarul nu a fost găsit în nomenclator.");

    return null;
  },
});

/**
 * Confirmarea nomenclatorului la Arhivele Naționale — art. 5 lit. a) și art. 11.
 *
 * Aplicația nu poate obține avizul; îl poate doar consemna, ca ecranul să spună
 * cinstit dacă nomenclatorul e confirmat sau doar întocmit.
 */
export const actualizeazaAvizNomenclator = createAction({
  name: "registru.nomenclator_aviz",
  feature: "nucleu",
  permission: "registru:update",
  minScope: "all",
  input: avizNomenclatorSchema,
  audit: {
    action: "update",
    entityType: "nomenclator_config",
    allow: ["avizat_la", "numar_aviz", "directia_judeteana"],
  },
  revalidate: CAI_NOMENCLATOR,
  handler: async (ctx, input) => {
    // `upsert` pe cheia unică de firmă: 0135 creează rândul la semănare, dar o
    // firmă restaurată dintr-o copie mai veche poate să nu-l aibă.
    const { error } = await ctx.supabase.from("nomenclator_config").upsert(
      {
        organization_id: ctx.tenant.organizationId,
        avizat_la: input.avizat_la,
        numar_aviz: input.numar_aviz,
        directia_judeteana: input.directia_judeteana,
        observatii: input.observatii,
      },
      { onConflict: "organization_id" },
    );
    if (error !== null) traduEroare(error);

    return null;
  },
});
