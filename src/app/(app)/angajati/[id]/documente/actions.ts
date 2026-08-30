// src/app/(app)/angajati/[id]/documente/actions.ts
"use server";
import { z } from "zod";
import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import { readRequestMeta, writeAuditLog } from "@/lib/actions/audit";
import {
  BUCKET_DOCUMENTE,
  construiesteCaleDocument,
  prefixCaleDocument,
  verificaDocument,
} from "@/lib/documents/cale";
import { adunaContextInrolare } from "@/lib/documents/context-angajat";
import { coduriEligibile, genereazaDocumenteInrolare } from "@/lib/documents/inrolare";
import { CODURI_INROLARE } from "@/lib/documents/variabile";
import type { ActionContext } from "@/lib/actions/types";

import { ETICHETE_MOD_LUCRU } from "../../etichete";

const idAngajat = z.object({ employeeId: z.uuid() });

/**
 * Documentele ACTIVE ale unui angajat, pe cod de șablon.
 *
 * „Activ" înseamnă neanulat: după o regenerare, cel vechi rămâne în dosar cu
 * `anulat_la` completat, dar nu mai contează nici ca document existent (pentru
 * „emite ce lipsește"), nici ca predecesor de anulat (pentru regenerare).
 */
async function documenteActive(
  ctx: ActionContext,
  employeeId: string,
): Promise<ReadonlyMap<string, { readonly id: string; readonly numarAfisat: string }>> {
  const { data } = await ctx.supabase
    .from("hr_issued_documents")
    .select("id, numar_afisat, hr_document_templates(cod)")
    .eq("employee_id", employeeId)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("anulat_la", null)
    .is("deleted_at", null);

  const peCod = new Map<string, { id: string; numarAfisat: string }>();
  for (const rand of data ?? []) {
    const cod = rand.hr_document_templates?.cod;
    // Cel mai recent câștigă: dacă două documente active împart un cod (se poate
    // întâmpla dacă o anulare a eșuat tăcut), se anulează ultimul emis.
    if (typeof cod === "string") peCod.set(cod, { id: rand.id, numarAfisat: rand.numar_afisat });
  }
  return peCod;
}

async function verificaAngajatul(ctx: ActionContext, employeeId: string): Promise<void> {
  const { data } = await ctx.supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("organization_id", ctx.tenant.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (data === null) throw notFound("Fișa de angajat nu există sau nu îți este accesibilă.");
}

export const pregatesteIncarcareDocument = createAction({
  name: "angajati.documente.pregateste",
  permission: "employees:update",
  minScope: "team",
  audit: {
    entityType: "employee_documents",
    action: "import",
    allow: ["employeeId", "numeFisier", "dimensiune", "mime"],
  },
  input: idAngajat.extend({
    numeFisier: z.string().min(1).max(255),
    dimensiune: z.number().int().positive(),
    mime: z.string().min(3).max(120),
  }),
  handler: async (ctx: ActionContext, input) => {
    const problema = verificaDocument(input.mime, input.dimensiune);
    if (problema !== null) throw invalidInput(problema, {});
    await verificaAngajatul(ctx, input.employeeId);
    const cale = construiesteCaleDocument({
      organizationId: ctx.tenant.organizationId,
      entitate: "employees",
      entitateId: input.employeeId,
      numeFisier: input.numeFisier,
    });
    const { data, error } = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUploadUrl(cale);
    if (error !== null || data === null)
      throw businessRule("Nu am putut pregăti încărcarea documentului.");
    return { cale, token: data.token };
  },
});

export const salveazaDocument = createAction({
  name: "angajati.documente.salveaza",
  permission: "employees:update",
  minScope: "team",
  audit: {
    entityType: "employee_documents",
    action: "create",
    allow: [
      "employeeId",
      "documentTypeId",
      "titlu",
      "numeFisier",
      "dimensiune",
      "mime",
      "numarDocument",
      "dataDocument",
      "valabilPanaLa",
      "confidential",
      "vizibilAngajatului",
    ],
  },
  input: idAngajat.extend({
    documentTypeId: z.uuid(),
    titlu: z.string().trim().min(2, "Titlul are minimum 2 caractere.").max(200),
    cale: z.string().min(1).max(400),
    numeFisier: z.string().min(1).max(255),
    dimensiune: z.number().int().min(0).max(52_428_800),
    mime: z.string().min(3).max(120),
    numarDocument: z.string().max(60).optional(),
    dataDocument: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    valabilPanaLa: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    confidential: z.boolean(),
    vizibilAngajatului: z.boolean(),
  }),
  handler: async (ctx: ActionContext, input) => {
    await verificaAngajatul(ctx, input.employeeId);
    const prefix = prefixCaleDocument(ctx.tenant.organizationId, "employees", input.employeeId);
    if (!input.cale.startsWith(prefix)) {
      const mesaj = "Calea fișierului nu corespunde acestui angajat.";
      throw invalidInput(mesaj, { cale: [mesaj] });
    }

    const { data, error } = await ctx.supabase
      .from("employee_documents")
      .insert({
        organization_id: ctx.tenant.organizationId,
        employee_id: input.employeeId,
        document_type_id: input.documentTypeId,
        titlu: input.titlu,
        fisier_path: input.cale,
        fisier_nume: input.numeFisier,
        fisier_marime_bytes: input.dimensiune,
        fisier_mime: input.mime,
        confidential: input.confidential,
        vizibil_angajatului: input.vizibilAngajatului,
        ...(input.numarDocument === undefined ? {} : { numar_document: input.numarDocument }),
        ...(input.dataDocument === undefined ? {} : { data_document: input.dataDocument }),
        ...(input.valabilPanaLa === undefined ? {} : { valabil_pana: input.valabilPanaLa }),
      })
      .select("id")
      .single();
    if (error !== null || data === null)
      throw businessRule("Documentul nu a putut fi înregistrat. Încearcă din nou.");
    return { id: data.id };
  },
});

export const linkDescarcareDocument = createAction({
  name: "angajati.documente.descarca",
  permission: "employees:read",
  minScope: "team",
  audit: { entityType: "employee_documents", action: "export", allow: ["documentId"] },
  input: z.object({ documentId: z.uuid() }),
  handler: async (ctx: ActionContext, input) => {
    const { data } = await ctx.supabase
      .from("employee_documents")
      .select("id, employee_id, fisier_path, fisier_nume, confidential")
      .eq("id", input.documentId)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (data === null) throw notFound("Documentul nu există sau nu îți este accesibil.");

    const { data: semnat, error } = await ctx.supabase.storage
      .from(BUCKET_DOCUMENTE)
      .createSignedUrl(data.fisier_path, 120, { download: data.fisier_nume });
    if (error !== null || semnat === null)
      throw businessRule("Fișierul nu mai este disponibil în arhivă.");

    // Accesul la documentele confidențiale se auditează explicit, cu rând vizibil în jurnal.
    if (data.confidential) {
      await writeAuditLog(ctx.supabase, {
        organizationId: ctx.tenant.organizationId,
        action: "export",
        status: "success",
        entityType: "employee_documents",
        entityId: data.id,
        before: null,
        after: { employeeId: data.employee_id, motiv: "descarcare_document_confidential" },
        errorCode: null,
        requestId: ctx.requestId,
        meta: await readRequestMeta(),
      });
    }
    return { url: semnat.signedUrl, expiraSecunde: 120 };
  },
});

export const stergeDocument = createAction({
  name: "angajati.documente.sterge",
  permission: "employees:delete",
  minScope: "all",
  audit: { entityType: "employee_documents", action: "delete", allow: ["documentId", "motiv"] },
  input: z.object({
    documentId: z.uuid(),
    motiv: z.string().trim().min(3, "Scrie motivul ștergerii.").max(200),
  }),
  handler: async (ctx: ActionContext, input) => {
    // Ștergere logică: nu există politici DELETE, iar dosarul de personal trebuie păstrat.
    const { data, error } = await ctx.supabase
      .from("employee_documents")
      .update({ deleted_at: new Date().toISOString(), observatii: input.motiv })
      .eq("id", input.documentId)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error !== null) throw businessRule("Documentul nu a putut fi retras din dosar.");
    if (data === null) throw notFound("Documentul nu există sau a fost deja retras.");
    return { id: data.id };
  },
});

/**
 * Emite documentele care LIPSESC din dosarul unui angajat.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Fiecare avertisment al înrolării spunea „Îl puteți emite din fișa
 * angajatului, secțiunea Documente" — o cale care NU exista: singurul apelant
 * al generatorului era acțiunea de înrolare. Textul trimitea omul către un
 * buton imaginar, exact în situația în care avea nevoie de el.
 *
 * ── DE CE „LIPSĂ", NU „DIN NOU" ────────────────────────────────────────────
 * Fiecare emitere consumă un număr din registrul seriei, iar
 * `hr_issued_documents` nu are politică DELETE: un al doilea contract de muncă
 * pentru același om nu se poate șterge din interfață, doar anula. Acțiunea
 * calculează deci ce lipsește și emite exact atât. Rulată de două ori la rând,
 * a doua oară nu face nimic.
 */
export const emiteDocumenteLipsa = createAction({
  name: "angajati.documente.emite_lipsa",
  permission: "employees:create",
  minScope: "all",
  audit: { entityType: "hr_issued_documents", action: "create", allow: ["employeeId"] },
  input: idAngajat,
  revalidate: ["/angajati"],
  handler: async (ctx: ActionContext, input) => {
    const context = await adunaContextInrolare(ctx.supabase, {
      organizationId: ctx.tenant.organizationId,
      employeeId: input.employeeId,
      etichetaModLucru: ETICHETE_MOD_LUCRU,
    });

    const active = await documenteActive(ctx, input.employeeId);
    const eligibile = coduriEligibile(context.codModLucru, context.fisaPostului !== null);
    const lipsa = eligibile.filter((cod) => !active.has(cod));
    if (lipsa.length === 0) {
      throw businessRule("Toate documentele au fost deja emise pentru acest angajat.");
    }

    const rezultat = await genereazaDocumenteInrolare(ctx.supabase, {
      ...context,
      emisDe: ctx.user.id,
      doarCodurile: lipsa,
    });

    return { documente: rezultat.documente, avertismente: rezultat.avertismente };
  },
});

/**
 * Regenerează documente deja emise: emite variante noi și le anulează pe cele vechi.
 *
 * ── DE CE ANULARE, NU SUPRASCRIERE ─────────────────────────────────────────
 * Un document emis poartă un număr alocat pe serie, o amprentă SHA-256 și un
 * cod public de verificare. Poate fi deja tipărit și semnat. Rescrierea lui pe
 * loc ar schimba hârtia sub semnătură, iar amprenta n-ar mai dovedi nimic —
 * exact lucrul pe care `din-html.ts:4-9` îl numește al doilea izvor de adevăr.
 * Vechiul rămâne deci în dosar, marcat `anulat_la` + `motiv_anulare`, iar cel
 * nou ia următorul număr din serie.
 *
 * ── DE CE ÎNTÂI EMITE, APOI ANULEAZĂ ───────────────────────────────────────
 * Ordinea inversă e tentantă (dosarul n-ar avea niciodată două active), dar
 * lasă angajatul FĂRĂ document valid dacă emiterea cade — și cade previzibil:
 * `genereazaDocument` aruncă la prima variabilă fără valoare, adică exact când
 * i s-a golit între timp un câmp din fișă. Ordinea de aici poate lăsa, în cel
 * mai rău caz, două documente active pentru o clipă. Asta se repară dintr-o
 * privire; un dosar gol, nu.
 */
export const regenereazaDocumente = createAction({
  name: "angajati.documente.regenereaza",
  permission: "employees:create",
  minScope: "all",
  audit: { entityType: "hr_issued_documents", action: "update", allow: ["employeeId", "coduri"] },
  input: z.object({
    employeeId: z.uuid(),
    coduri: z
      .array(z.enum(CODURI_INROLARE))
      .min(1, "Alege cel puțin un document de regenerat.")
      .max(CODURI_INROLARE.length),
    motiv: z
      .string()
      .trim()
      .min(3, "Scrie de ce regenerezi documentele.")
      .max(200, "Motivul e prea lung."),
  }),
  revalidate: ["/angajati"],
  handler: async (ctx: ActionContext, input) => {
    const context = await adunaContextInrolare(ctx.supabase, {
      organizationId: ctx.tenant.organizationId,
      employeeId: input.employeeId,
      etichetaModLucru: ETICHETE_MOD_LUCRU,
    });

    const eligibile = coduriEligibile(context.codModLucru, context.fisaPostului !== null);
    const cerute = input.coduri.filter((cod) => eligibile.includes(cod));
    if (cerute.length === 0) {
      throw businessRule(
        "Niciunul dintre documentele alese nu se poate emite pentru acest angajat.",
      );
    }

    const active = await documenteActive(ctx, input.employeeId);

    // Un singur apel pentru toate codurile: `genereazaDocumenteInrolare`
    // citește organizația o dată și decriptează CNP-ul o dată, iar decriptarea
    // scrie și un rând de audit. Cinci apeluri ar fi însemnat cinci consultări
    // auditate ale aceluiași CNP, pentru o singură apăsare de buton.
    const rezultat = await genereazaDocumenteInrolare(ctx.supabase, {
      ...context,
      emisDe: ctx.user.id,
      doarCodurile: cerute,
    });

    const avertismente = [...rezultat.avertismente];
    const anulate: string[] = [];

    // Se anulează DOAR predecesorii documentelor emise cu succes. Fiecare
    // document eșuează singur în `genereazaDocumenteInrolare`, deci un eșec pe
    // contract nu are voie să anuleze contractul vechi.
    for (const emis of rezultat.documente) {
      const precedent = active.get(emis.cod);
      if (precedent === undefined) continue;

      const { data } = await ctx.supabase
        .from("hr_issued_documents")
        .update({ anulat_la: new Date().toISOString(), motiv_anulare: input.motiv })
        .eq("id", precedent.id)
        .eq("organization_id", ctx.tenant.organizationId)
        .is("anulat_la", null)
        .select("id")
        .maybeSingle();

      /*
       * `.select()` după `.update()` nu e decorativ.
       *
       * Acțiunea declară `employees:create`, dar politica `hr_issued_update`
       * cere `employees:update`. Un UPDATE respins de clauza `USING` afectează
       * ZERO rânduri și NU întoarce nicio eroare — fără verificarea asta,
       * documentul vechi ar rămâne activ lângă cel nou, iar dosarul ar arăta
       * două contracte valabile fără ca nimeni să afle.
       */
      if (data === null) {
        avertismente.push(
          `Documentul ${precedent.numarAfisat} a fost înlocuit, dar nu a putut fi marcat ca anulat. Anulează-l manual — altfel dosarul arată două documente valabile.`,
        );
        continue;
      }
      anulate.push(precedent.numarAfisat);
    }

    return { documente: rezultat.documente, anulate, avertismente };
  },
});
