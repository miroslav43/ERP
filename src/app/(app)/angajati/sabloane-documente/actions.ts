// src/app/(app)/angajati/sabloane-documente/actions.ts
"use server";

import { businessRule, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { curataHtml, variabileFolosite } from "@/lib/documents/curata-html";
import { VARIABILE_PER_COD } from "@/lib/documents/variabile";
import {
  restabilesteSablonDocumentSchema,
  salveazaSablonDocumentSchema,
} from "@/schemas/document-template";
import type { ActionContext } from "@/lib/actions/types";

type SablonIdentificat = Readonly<{ id: string }>;

const CAI_REVALIDARE = ["/angajati/sabloane-documente", "/angajati"] as const;

/**
 * Salvează șablonul firmei, clonându-l din cel de platformă la prima editare.
 *
 * ── DE CE CLONĂ, ȘI NU EDITARE PE LOC ──────────────────────────────────────
 * Rândul cu `organization_id is null` e seed-ul comun tuturor firmelor.
 * `hr_templates_update` (0005_hr_rls.sql:857-870) îl apără structural: clauza
 * `with check` cere `organization_id is not null`, deci o încercare de editare
 * a lui n-ar da eroare, ci ZERO rânduri. Prima salvare a unei firme creează
 * deci un rând propriu, iar generatorul îl preferă automat
 * (`generator.ts:76-77`), fără nicio migrare.
 *
 * ── DE CE NU `.upsert()` ───────────────────────────────────────────────────
 * `hr_templates_org_uniq` e un index PARȚIAL (`where organization_id is not
 * null and deleted_at is null`). `ON CONFLICT` nu poate ținti un index parțial
 * fără o clauză de inferență care să-i repete predicatul — e capcana 42P10 din
 * registrul proiectului. Se citește explicit, apoi se ramifică.
 */
export const salveazaSablonDocument = createAction<
  typeof salveazaSablonDocumentSchema,
  SablonIdentificat
>({
  name: "hr_document_templates.save",
  permission: "employees:update",
  minScope: "all",
  input: salveazaSablonDocumentSchema,
  audit: {
    action: "update",
    entityType: "hr_document_templates",
    entityId: (_input, data) => data.id,
    allow: ["cod", "denumire"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx: ActionContext, input) => {
    /*
     * ORDINEA CONTEAZĂ: întâi se curăță, apoi se verifică variabilele.
     *
     * Curățarea rescrie HTML-ul dintr-o listă albă de șapte etichete, fără
     * niciun atribut (`curata-html.ts`). Verificarea variabilelor trebuie să
     * ruleze pe rezultat, nu pe intrare: o variabilă ascunsă într-un atribut pe
     * care curățarea îl aruncă nu e o variabilă, iar respingerea ei ar fi un
     * mesaj despre un text care oricum nu se salvează.
     */
    const curat = curataHtml(input.continut_html);
    if (curat === "") {
      throw businessRule(
        "După curățare nu a rămas niciun text. Verifică dacă documentul are conținut, nu doar formatare.",
      );
    }

    /*
     * Poarta care apără emiterea.
     *
     * `genereazaDocument` aruncă `businessRule` la PRIMA variabilă fără valoare
     * (`generator.ts:84-88`). O variabilă inventată aici n-ar strica o emitere,
     * ci pe TOATE emiterile viitoare ale acestui document, pentru toți
     * angajații firmei — iar defectul s-ar vedea abia la următoarea înrolare,
     * ca „documentul nu a putut fi generat".
     */
    const cunoscute = VARIABILE_PER_COD[input.cod];
    const necunoscute = variabileFolosite(curat).filter((v) => !cunoscute.includes(v));
    if (necunoscute.length > 0) {
      throw businessRule(
        `Documentul folosește variabile care nu există: ${necunoscute.map((v) => `{{${v}}}`).join(", ")}. ` +
          `Disponibile pentru acest document: ${cunoscute.map((v) => `{{${v}}}`).join(", ")}.`,
      );
    }

    const { data: alFirmei } = await ctx.supabase
      .from("hr_document_templates")
      .select("id")
      .eq("cod", input.cod)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (alFirmei !== null) {
      const { data, error } = await ctx.supabase
        .from("hr_document_templates")
        .update({
          denumire: input.denumire,
          continut_html: curat,
          updated_by: ctx.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alFirmei.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error !== null) throw businessRule("Șablonul nu a putut fi salvat.");
      // Un UPDATE respins de `USING` afectează zero rânduri, fără eroare.
      if (data === null) throw notFound("Șablonul nu mai există sau nu îți este accesibil.");
      return { id: data.id };
    }

    // Prima editare: seria și descrierea se moștenesc de la seed, ca numerotarea
    // documentelor emise să rămână pe aceeași serie (CIM, NDA, …).
    const { data: platforma } = await ctx.supabase
      .from("hr_document_templates")
      .select("descriere, serie, variabile")
      .eq("cod", input.cod)
      .is("organization_id", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (platforma === null) {
      throw notFound(`Șablonul „${input.cod}” nu există în catalogul platformei.`);
    }

    const { data, error } = await ctx.supabase
      .from("hr_document_templates")
      .insert({
        organization_id: ctx.tenant.organizationId,
        cod: input.cod,
        denumire: input.denumire,
        descriere: platforma.descriere,
        continut_html: curat,
        serie: platforma.serie,
        variabile: platforma.variabile,
        activ: true,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error !== null) throw businessRule("Șablonul nu a putut fi salvat.");
    return { id: data.id };
  },
});

/**
 * Renunță la varianta firmei și revine la textul de platformă.
 *
 * Ștergere logică, ca peste tot: nu există politici DELETE. Indexul
 * `hr_templates_org_uniq` e parțial (`where … deleted_at is null`), deci locul
 * se eliberează și firma își poate scrie mai târziu o altă variantă — fără
 * 23505 pe rândul rămas șters.
 *
 * Documentele deja emise NU se schimbă: fiecare poartă în `continut_html`
 * textul cu care a fost emis. Se schimbă doar ce se va emite de acum înainte.
 */
export const restabilesteSablonPlatforma = createAction<
  typeof restabilesteSablonDocumentSchema,
  SablonIdentificat
>({
  name: "hr_document_templates.restore",
  permission: "employees:update",
  minScope: "all",
  input: restabilesteSablonDocumentSchema,
  audit: { action: "delete", entityType: "hr_document_templates", allow: ["cod"] },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx: ActionContext, input) => {
    const { data, error } = await ctx.supabase
      .from("hr_document_templates")
      .update({ deleted_at: new Date().toISOString(), updated_by: ctx.user.id })
      .eq("cod", input.cod)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw businessRule("Șablonul firmei nu a putut fi retras.");
    if (data === null) {
      throw notFound("Firma nu are o variantă proprie a acestui șablon.");
    }
    return { id: data.id };
  },
});
