// src/app/(app)/angajati/sabloane-documente/actions.ts
"use server";

import { randomUUID } from "node:crypto";

import { businessRule, notFound } from "@/lib/actions/errors";
import { createAction } from "@/lib/actions/create-action";
import { BUCKET_BRANDING } from "@/lib/pdf/antet-organizatie";
import { masoaraObiectul } from "@/lib/storage/masoara-obiectul";
import { curataHtml, variabileFolosite } from "@/lib/documents/curata-html";
import {
  VARIABILE_TOATE,
  codDinDenumire,
  esteCodPersonalizat,
  variabilePentruCod,
} from "@/lib/documents/variabile";
import {
  SIGLA_MIME_ACCEPTAT,
  SIGLA_OCTETI_MAXIM,
  creeazaSablonPersonalizatSchema,
  pregatesteSiglaSchema,
  restabilesteSablonDocumentSchema,
  salveazaAntetDocumenteSchema,
  salveazaSablonDocumentSchema,
  salveazaSiglaSchema,
  stergeSiglaSchema,
} from "@/schemas/document-template";
import type { ActionContext } from "@/lib/actions/types";

type SablonIdentificat = Readonly<{ id: string }>;

const CAI_REVALIDARE = ["/angajati/sabloane-documente", "/angajati"] as const;

/** HTML-ul curățat, sau refuz dacă n-a rămas nimic. Vezi nota din `salveazaSablonDocument`. */
function curataSauRefuza(brut: string): string {
  const curat = curataHtml(brut);
  if (curat === "") {
    throw businessRule(
      "După curățare nu a rămas niciun text. Verifică dacă documentul are conținut, nu doar formatare.",
    );
  }
  return curat;
}

/**
 * Poarta care apără emiterea.
 *
 * `genereazaDocument` aruncă `businessRule` la PRIMA variabilă fără valoare
 * (`generator.ts:84-88`). O variabilă inventată aici n-ar strica o emitere, ci
 * pe TOATE emiterile viitoare ale acestui document, pentru toți angajații
 * firmei — iar defectul s-ar vedea abia la următoarea emitere, ca „documentul nu
 * a putut fi generat".
 */
function verificaVariabilele(curat: string, cunoscute: readonly string[]): void {
  const necunoscute = variabileFolosite(curat).filter((v) => !cunoscute.includes(v));
  if (necunoscute.length > 0) {
    throw businessRule(
      `Documentul folosește variabile care nu există: ${necunoscute.map((v) => `{{${v}}}`).join(", ")}. ` +
        `Disponibile pentru acest document: ${cunoscute.map((v) => `{{${v}}}`).join(", ")}.`,
    );
  }
}

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
    const curat = curataSauRefuza(input.continut_html);
    verificaVariabilele(curat, variabilePentruCod(input.cod) ?? []);

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

    // Un document creat de firmă nu are seed: dacă rândul firmei lipsește, a
    // fost șters între deschiderea editorului și salvare. Nu se recreează din
    // senin, cu o serie pe care nimeni n-a ales-o.
    if (esteCodPersonalizat(input.cod)) {
      throw notFound("Șablonul nu mai există. A fost șters între timp?");
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

/** Câte sufixe numerice se încearcă pentru un cod ocupat (`doc_cerere_2` …). */
const INCERCARI_COD = 50;

/**
 * Creează un document NOU al firmei — unul care nu există în catalogul
 * platformei (o cerere, o decizie internă, o notificare).
 *
 * ── CODUL SE DEDUCE, NU SE CERE ────────────────────────────────────────────
 * Omul scrie o denumire; codul (`doc_cerere_de_concediu`) e cheia tehnică după
 * care îl găsesc emiterea și registrul. Dacă e ocupat — două documente cu
 * aceeași denumire, sau unul șters cu același nume — se adaugă un sufix. Indexul
 * `hr_templates_org_uniq` e PARȚIAL, deci un rând șters nu ocupă codul; o
 * coliziune la inserare (23505, altă sesiune a luat codul între citire și
 * scriere) se reia cu următorul sufix.
 *
 * ── DE CE `employees:create` ───────────────────────────────────────────────
 * E o inserare, iar `hr_templates_insert` (0005_hr_rls.sql:846) cere
 * `employees:create = all`. Poarta acțiunii e aceeași cu a bazei: altfel un rol
 * cu `update` dar fără `create` ar fi trecut de acțiune și ar fi lovit RLS-ul.
 */
export const creeazaSablonPersonalizat = createAction<
  typeof creeazaSablonPersonalizatSchema,
  SablonIdentificat & Readonly<{ cod: string }>
>({
  name: "hr_document_templates.create",
  permission: "employees:create",
  minScope: "all",
  input: creeazaSablonPersonalizatSchema,
  audit: {
    action: "create",
    entityType: "hr_document_templates",
    entityId: (_input, data) => data.id,
    allow: ["denumire", "serie"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx: ActionContext, input) => {
    const curat = curataSauRefuza(input.continut_html);
    verificaVariabilele(curat, VARIABILE_TOATE);

    const radacina = codDinDenumire(input.denumire);
    const { data: ocupate, error: eroareCitire } = await ctx.supabase
      .from("hr_document_templates")
      .select("cod")
      .eq("organization_id", ctx.tenant.organizationId)
      .like("cod", `${radacina}%`)
      .is("deleted_at", null);
    if (eroareCitire !== null) throw businessRule("Șablonul nu a putut fi creat.");
    const folosite = new Set((ocupate ?? []).map((r) => r.cod));

    for (let i = 1; i <= INCERCARI_COD; i += 1) {
      const cod = i === 1 ? radacina : `${radacina}_${String(i)}`;
      if (folosite.has(cod)) continue;

      const { data, error } = await ctx.supabase
        .from("hr_document_templates")
        .insert({
          organization_id: ctx.tenant.organizationId,
          cod,
          denumire: input.denumire,
          descriere: null,
          continut_html: curat,
          serie: input.serie,
          variabile: [...variabileFolosite(curat)],
          activ: true,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })
        .select("id, cod")
        .single();

      if (error === null) return { id: data.id, cod: data.cod };
      if (error.code !== "23505") throw businessRule("Șablonul nu a putut fi creat.");
      folosite.add(cod);
    }
    throw businessRule("Există deja prea multe documente cu această denumire. Alege alta.");
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

// ────────────────────────────────────────────────────────────────────────────
// ANTETUL DOCUMENTELOR — datele de identificare ale firmei și sigla
// ────────────────────────────────────────────────────────────────────────────
//
// ── DE CE `branding:update`, ȘI NU `employees:update` CA RESTUL PAGINII ─────
// Scrierea merge în `organization_branding`, a cărei politică `_update` cere
// `app.can(organization_id, 'branding', 'update', 'all')` — adică `org_admin`.
// O acțiune cerută cu `employees:update` ar fi trecut de cele opt straturi ale
// lui `createAction` și ar fi lovit RLS-ul, care ar fi întors ZERO RÂNDURI FĂRĂ
// EROARE: butonul s-ar fi purtat ca și cum ar fi salvat. Poarta din acțiune e
// aceeași cu poarta din bază, deliberat.
//
// ── DE CE SE CITEȘTE ÎNTÂI, ÎN LOC DE `.upsert()` ──────────────────────────
// Tabela e 1:1 pe `organization_id`, deci un upsert ar fi fost legal aici
// (cheia primară nu e un index parțial, spre deosebire de șabloane). Dar
// rândul poate exista ȘTERS logic, iar `organization_branding_select` filtrează
// `deleted_at is null`: upsert-ul ar fi lovit cheia primară pe un rând pe care
// citirea nu-l vede, adică 23505 pe un rând „inexistent". Se citește fără
// filtrul de ștergere, apoi se ramifică.

type BrandingSalvat = Readonly<{ organizationId: string }>;

/** Rândul de branding al firmei, ignorând ștergerea logică. Vezi nota de mai sus. */
async function randBranding(ctx: ActionContext): Promise<boolean> {
  const { data } = await ctx.supabase
    .from("organization_branding")
    .select("organization_id")
    .eq("organization_id", ctx.tenant.organizationId)
    .maybeSingle();
  return data !== null;
}

async function scrieBranding(
  ctx: ActionContext,
  valori: Record<string, unknown>,
  esec: string,
): Promise<BrandingSalvat> {
  const exista = await randBranding(ctx);

  const { data, error } = exista
    ? await ctx.supabase
        .from("organization_branding")
        .update({ ...valori, deleted_at: null, updated_by: ctx.user.id })
        .eq("organization_id", ctx.tenant.organizationId)
        .select("organization_id")
        .maybeSingle()
    : await ctx.supabase
        .from("organization_branding")
        .insert({
          organization_id: ctx.tenant.organizationId,
          ...valori,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        })
        .select("organization_id")
        .maybeSingle();

  if (error !== null) throw businessRule(esec);
  // `.select()` după `.update()`: un UPDATE respins de clauza `USING` afectează
  // zero rânduri și NU produce eroare. Fără verificarea asta, refuzul ar arăta
  // exact ca o salvare reușită.
  if (data === null) throw businessRule(esec);
  return { organizationId: data.organization_id };
}

/** Unde se tipărește blocul de identificare și dacă sigla îl însoțește. */
export const salveazaAntetDocumente = createAction<
  typeof salveazaAntetDocumenteSchema,
  BrandingSalvat
>({
  name: "organization_branding.antet",
  permission: "branding:update",
  minScope: "all",
  input: salveazaAntetDocumenteSchema,
  audit: {
    action: "update",
    entityType: "organization_branding",
    entityId: (_input, data) => data.organizationId,
    allow: ["pozitie", "arata_logo"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx: ActionContext, input) =>
    scrieBranding(
      ctx,
      { antet_pozitie: input.pozitie, antet_arata_logo: input.arata_logo },
      "Antetul documentelor nu a putut fi salvat.",
    ),
});

/**
 * Pas 1/2 al încărcării siglei: doar semnează calea.
 *
 * Octeții urcă direct din browser spre Storage (`urcaPeUrlSemnat`), ca la
 * avatare și la documentele de personal — imaginea nu trece prin server.
 *
 * Calea are patru segmente pentru că `app.path_resource` cere minimum atâtea:
 * `{org}/branding/logo/{uuid}.{ext}`. Segmentul 2 e resursa pe care o verifică
 * `app.can_path`, deci trebuie să fie exact `branding`.
 */
export const pregatesteSigla = createAction<
  typeof pregatesteSiglaSchema,
  Readonly<{ cale: string; urlSemnat: string }>
>({
  name: "organization_branding.sign_logo",
  permission: "branding:update",
  minScope: "all",
  input: pregatesteSiglaSchema,
  audit: { action: "update", entityType: "organization_branding", allow: ["mime"] },
  handler: async (ctx: ActionContext, input) => {
    const extensie = input.mime === "image/png" ? "png" : "jpg";
    const cale = `${ctx.tenant.organizationId}/branding/logo/${randomUUID()}.${extensie}`;

    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_BRANDING)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null) {
      throw businessRule("Încărcarea siglei nu a putut fi pregătită. Încearcă din nou.");
    }
    return { cale, urlSemnat: data.signedUrl };
  },
});

/**
 * Pas 2/2: fișierul e deja în Storage — se verifică ce a ajuns acolo și se
 * reține calea.
 *
 * Se măsoară obiectul REAL, nu ce a declarat browserul la pasul 1: tokenul
 * semnat nu fixează nici tipul, nici mărimea, deci după el se putea urca orice
 * (defectul F44 din auditul din 21 sept 2026). Aici contează dublu — un fișier
 * care nu e PNG sau JPEG ar dispărea tăcut din PDF, fiindcă `pdf-lib` nu-l
 * poate încorpora.
 */
export const salveazaSigla = createAction<typeof salveazaSiglaSchema, BrandingSalvat>({
  name: "organization_branding.save_logo",
  permission: "branding:update",
  minScope: "all",
  input: salveazaSiglaSchema,
  audit: {
    action: "update",
    entityType: "organization_branding",
    entityId: (_input, data) => data.organizationId,
    allow: ["cale"],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx: ActionContext, input) => {
    // Calea trebuie să fie sub prefixul organizației apelantului. Fără garda
    // asta, un `org_admin` ar fi putut înregistra pe firma lui calea siglei
    // altei firme — pe care RLS-ul de Storage nu i-ar servi-o oricum, dar
    // documentele lui ar fi rămas fără siglă, fără nicio explicație.
    if (!input.cale.startsWith(`${ctx.tenant.organizationId}/branding/logo/`)) {
      throw businessRule("Calea fișierului nu este validă.");
    }

    const masurat = await masoaraObiectul(ctx.supabase, BUCKET_BRANDING, input.cale);
    if (masurat === null) {
      throw notFound("Sigla nu a ajuns în depozit. Încearcă încărcarea din nou.");
    }
    if (masurat.octeti > SIGLA_OCTETI_MAXIM) {
      throw businessRule("Sigla nu poate depăși 512 KB.");
    }
    if (!(SIGLA_MIME_ACCEPTAT as readonly string[]).includes(masurat.mime)) {
      throw businessRule("Sigla trebuie să fie PNG sau JPEG.");
    }

    return scrieBranding(
      ctx,
      { logo_light_path: input.cale, antet_arata_logo: true },
      "Sigla nu a putut fi salvată.",
    );
  },
});

/**
 * Scoate sigla de pe documente.
 *
 * Fișierul rămâne în bucket: nu există politică DELETE pe `storage.objects`,
 * din 0002, iar ștergerea trece prin service_role după înregistrarea în audit.
 * Aceeași alegere ca la poza de profil veche (0029).
 */
export const stergeSigla = createAction<typeof stergeSiglaSchema, BrandingSalvat>({
  name: "organization_branding.remove_logo",
  permission: "branding:update",
  minScope: "all",
  input: stergeSiglaSchema,
  audit: {
    action: "update",
    entityType: "organization_branding",
    entityId: (_input, data) => data.organizationId,
    allow: [],
  },
  revalidate: CAI_REVALIDARE,
  handler: async (ctx: ActionContext) =>
    scrieBranding(
      ctx,
      { logo_light_path: null, antet_arata_logo: false },
      "Sigla nu a putut fi scoasă.",
    ),
});
