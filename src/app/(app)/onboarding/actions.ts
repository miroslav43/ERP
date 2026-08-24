"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  actualizeazaPasSchema,
  actualizeazaSablonSchema,
  adaugaPasSchema,
  anuleazaInstantaSchema,
  bifeazaPasSchema,
  creeazaSablonSchema,
  finalizeazaInstantaSchema,
  mutaPasSchema,
  pornesteInstantaSchema,
  stergePasSchema,
} from "@/schemas/checklist";

import { traduEroare } from "./erori";

// ── Instanțe ───────────────────────────────────────────────────────────────

export const pornesteInstanta = createAction({
  name: "checklist.instance.start",
  feature: "onboarding",
  permission: "checklists:create",
  minScope: "all",
  input: pornesteInstantaSchema,
  audit: {
    action: "create",
    entityType: "checklist_instance",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["template_id", "employee_id", "data_referinta"],
  },
  revalidate: ["/onboarding", "/portal", "/portal/integrarea-mea"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // NU se trimit: ciclu, status, finalizata_la, finalizata_de, anulata_la,
    // motiv_anulare, created_at/updated_at, created_by/updated_by —
    // `internal.checklist_pregateste_instanta` (BEFORE INSERT) le forțează pe
    // toate din șablon și din `auth.uid()`, ÎNAINTE ca WITH CHECK să evalueze
    // rândul final. Pașii sunt copiați separat de un trigger AFTER.
    //
    // `tip` face excepție: coloana e `not null` FĂRĂ implicit, deci tipul
    // `Insert` generat îl cere structural, chiar dacă triggerul îl suprascrie
    // necondiționat cu tipul șablonului. Valoarea de mai jos nu ajunge
    // niciodată în rând — există doar ca să compileze.
    const { data, error } = await db
      .from("checklist_instances")
      .insert({
        organization_id: ctx.tenant.organizationId,
        template_id: input.template_id,
        employee_id: input.employee_id,
        data_referinta: input.data_referinta,
        observatii: input.observatii,
        tip: "altul",
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const bifeazaPas = createAction({
  name: "checklist.item.check",
  feature: "onboarding",
  permission: "checklists:update",
  minScope: "own",
  input: bifeazaPasSchema,
  audit: {
    action: "update",
    entityType: "checklist_instance_item",
    entityId: (input) => input.id,
    allow: ["id", "status"],
  },
  revalidate: (_input, data: Readonly<{ id: string; instance_id: string }>) => [
    `/onboarding/${data.instance_id}`,
    "/onboarding",
    // Bifarea unui pas schimbă și progresul din portal, și contorul de pe
    // pagina de start a angajatului.
    `/portal/integrarea-mea/${data.instance_id}`,
    "/portal/integrarea-mea",
    "/portal",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; instance_id: string }>> => {
    const db = await createServerSupabase();
    const organizationId = ctx.tenant.organizationId;

    const { data: pasCurent, error: eroareCurent } = await db
      .from("checklist_instance_items")
      .select("id, verificare_automata, tip_dovada")
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCurent !== null) traduEroare(eroareCurent);
    if (pasCurent === null) throw notFound("Pasul nu a fost găsit.");

    // Pre-verificări în handler, ca mesajul să fie clar ÎNAINTE de refuzul
    // bazei — triggerul `internal.checklist_pregateste_pasul` ar respinge
    // aceleași cazuri cu P0001, dar abia după round-trip-ul de scriere.
    if (pasCurent.verificare_automata !== null) {
      throw businessRule(
        "Acest pas se bifează automat de sistem, pe baza altor module, și nu poate fi modificat manual.",
      );
    }
    if (input.status === "bifat") {
      if (pasCurent.tip_dovada === "document" && input.dovada_document_id === null) {
        throw invalidInput("Acest pas cere un document justificativ.", {
          dovada_document_id: ["Introduceți identificatorul documentului justificativ."],
        });
      }
      if (pasCurent.tip_dovada === "semnatura" && (input.dovada ?? "").trim().length === 0) {
        throw invalidInput("Acest pas cere o semnătură înregistrată.", {
          dovada: ["Introduceți semnătura."],
        });
      }
    }

    // NU se trimit: titlu, obligatoriu (triggerul ridică P0001 dacă se
    // schimbă), bifat_la, bifat_de, bifat_automat (le pune triggerul), ordine,
    // termen.
    const { data, error } = await db
      .from("checklist_instance_items")
      .update({
        status: input.status,
        dovada: input.dovada,
        dovada_document_id: input.dovada_document_id,
        observatii: input.observatii,
      })
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("id, instance_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    // Un UPDATE respins de USING-ul politicii RLS nu produce eroare — afectează
    // zero rânduri, tăcut (ex.: un colaborator responsabil pentru un pas care
    // nu mai e „în curs”, sau un pas care nu-i aparține). `.select()` face
    // diferența vizibilă în loc de un „succes” fals.
    if (data === null) {
      throw businessRule(
        "Pasul nu a putut fi actualizat: fie nu mai există, fie nu aveți dreptul asupra lui.",
      );
    }

    return { id: data.id, instance_id: data.instance_id };
  },
});

export const finalizeazaInstanta = createAction({
  name: "checklist.instance.finish",
  feature: "onboarding",
  permission: "checklists:update",
  minScope: "team",
  input: finalizeazaInstantaSchema,
  audit: {
    action: "update",
    entityType: "checklist_instance",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => [
    `/onboarding/${input.id}`,
    "/onboarding",
    `/portal/integrarea-mea/${input.id}`,
    "/portal/integrarea-mea",
    "/portal",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // Se trimite DOAR `status`. `finalizata_la`/`finalizata_de` le pune
    // triggerul; regula centrală (bunuri nereturnate, pași obligatorii
    // nebifați) e verificată tot acolo, cu P0001. Dovada din
    // `checklist_completion_records` o scrie un trigger AFTER separat — nu se
    // inserează din cod.
    const { data, error } = await db
      .from("checklist_instances")
      .update({ status: "finalizata" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Checklistul nu a putut fi finalizat: fie nu mai există, fie nu aveți dreptul asupra lui.",
      );
    }

    return { id: data.id };
  },
});

export const anuleazaInstanta = createAction({
  name: "checklist.instance.cancel",
  feature: "onboarding",
  permission: "checklists:update",
  minScope: "team",
  input: anuleazaInstantaSchema,
  audit: {
    action: "update",
    entityType: "checklist_instance",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => [
    `/onboarding/${input.id}`,
    "/onboarding",
    `/portal/integrarea-mea/${input.id}`,
    "/portal/integrarea-mea",
    "/portal",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // NU se trimite `anulata_la` — îl pune triggerul.
    const { data, error } = await db
      .from("checklist_instances")
      .update({ status: "anulata", motiv_anulare: input.motiv_anulare })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw businessRule(
        "Checklistul nu a putut fi anulat: fie nu mai există, fie nu aveți dreptul asupra lui.",
      );
    }

    return { id: data.id };
  },
});

// ── Șabloane ───────────────────────────────────────────────────────────────

export const creeazaSablon = createAction({
  name: "checklist.template.create",
  feature: "onboarding",
  permission: "checklists:create",
  minScope: "all",
  input: creeazaSablonSchema,
  audit: {
    action: "create",
    entityType: "checklist_template",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: [
      "denumire",
      "tip",
      "department_id",
      "job_position_id",
      "activ",
      "valabil_de_la",
      "valabil_pana_la",
    ],
  },
  revalidate: ["/onboarding/sabloane"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("checklist_templates")
      .insert({ ...input, organization_id: ctx.tenant.organizationId })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const actualizeazaSablon = createAction({
  name: "checklist.template.update",
  feature: "onboarding",
  permission: "checklists:update",
  minScope: "all",
  input: actualizeazaSablonSchema,
  audit: {
    action: "update",
    entityType: "checklist_template",
    entityId: (input) => input.id,
    allow: [
      "id",
      "denumire",
      "tip",
      "department_id",
      "job_position_id",
      "activ",
      "valabil_de_la",
      "valabil_pana_la",
    ],
  },
  revalidate: (input) => [`/onboarding/sabloane/${input.id}`, "/onboarding/sabloane"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;
    const { data, error } = await db
      .from("checklist_templates")
      .update(campuri)
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Șablonul nu a fost găsit.");

    return { id: data.id };
  },
});

// ── Pașii șablonului ───────────────────────────────────────────────────────

const LIMITA_ORDINE = 500;

export const adaugaPas = createAction({
  name: "checklist.template_item.add",
  feature: "onboarding",
  permission: "checklists:create",
  minScope: "all",
  input: adaugaPasSchema,
  audit: {
    action: "create",
    entityType: "checklist_template_item",
    entityId: (_input, data: Readonly<{ id: string }>) => data.id,
    allow: ["template_id", "titlu", "obligatoriu", "tip_dovada", "verificare_automata"],
  },
  revalidate: (input) => [`/onboarding/sabloane/${input.template_id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const organizationId = ctx.tenant.organizationId;

    // ordine = max(ordine) + 1, sau 1 dacă șablonul nu are încă pași.
    const { data: maxRand, error: eroareMax } = await db
      .from("checklist_template_items")
      .select("ordine")
      .eq("template_id", input.template_id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("ordine", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eroareMax !== null) traduEroare(eroareMax);
    const ordine = (maxRand?.ordine ?? 0) + 1;
    if (ordine > LIMITA_ORDINE) {
      throw businessRule(
        `Șablonul a atins limita de ${String(LIMITA_ORDINE)} de pași; ștergeți un pas înainte de a mai adăuga altul.`,
      );
    }

    const { data, error } = await db
      .from("checklist_template_items")
      .insert({
        organization_id: organizationId,
        template_id: input.template_id,
        ordine,
        titlu: input.titlu,
        descriere: input.descriere,
        responsabil_tip: input.responsabil_tip,
        responsabil_rol: input.responsabil_rol,
        responsabil_employee_id: input.responsabil_employee_id,
        termen_zile_relativ: input.termen_zile_relativ,
        obligatoriu: input.obligatoriu,
        tip_dovada: input.tip_dovada,
        verificare_automata: input.verificare_automata,
      })
      .select("id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id };
  },
});

export const actualizeazaPas = createAction({
  name: "checklist.template_item.update",
  feature: "onboarding",
  permission: "checklists:update",
  minScope: "all",
  input: actualizeazaPasSchema,
  audit: {
    action: "update",
    entityType: "checklist_template_item",
    entityId: (input) => input.id,
    allow: ["id", "titlu", "obligatoriu", "tip_dovada", "verificare_automata"],
  },
  revalidate: (_input, data: Readonly<{ id: string; template_id: string }>) => [
    `/onboarding/sabloane/${data.template_id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; template_id: string }>> => {
    const db = await createServerSupabase();
    // Ordinea NU se schimbă aici — doar `mutaPas` o atinge, cu parcarea în
    // trei pași cerută de indexul unic `(template_id, ordine)`.
    const { data, error } = await db
      .from("checklist_template_items")
      .update({
        titlu: input.titlu,
        descriere: input.descriere,
        responsabil_tip: input.responsabil_tip,
        responsabil_rol: input.responsabil_rol,
        responsabil_employee_id: input.responsabil_employee_id,
        termen_zile_relativ: input.termen_zile_relativ,
        obligatoriu: input.obligatoriu,
        tip_dovada: input.tip_dovada,
        verificare_automata: input.verificare_automata,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id, template_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Pasul nu a fost găsit.");

    return { id: data.id, template_id: data.template_id };
  },
});

export const stergePas = createAction({
  name: "checklist.template_item.delete",
  feature: "onboarding",
  permission: "checklists:update",
  minScope: "all",
  input: stergePasSchema,
  audit: {
    action: "delete",
    entityType: "checklist_template_item",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (_input, data: Readonly<{ id: string; template_id: string }>) => [
    `/onboarding/sabloane/${data.template_id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; template_id: string }>> => {
    const db = await createServerSupabase();
    // Nu există politică DELETE pe tabelă: ștergerea e întotdeauna soft, prin
    // `deleted_at`. Asta eliberează și slotul de `ordine` pentru un pas nou.
    const { data, error } = await db
      .from("checklist_template_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id, template_id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) throw notFound("Pasul nu a fost găsit.");

    return { id: data.id, template_id: data.template_id };
  },
});

export const mutaPas = createAction({
  name: "checklist.template_item.move",
  feature: "onboarding",
  permission: "checklists:update",
  minScope: "all",
  input: mutaPasSchema,
  audit: {
    action: "update",
    entityType: "checklist_template_item",
    entityId: (input) => input.id,
    allow: ["id", "directie"],
  },
  revalidate: (_input, data: Readonly<{ id: string; template_id: string }>) => [
    `/onboarding/sabloane/${data.template_id}`,
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; template_id: string }>> => {
    const db = await createServerSupabase();
    const organizationId = ctx.tenant.organizationId;

    const { data: curent, error: eroareCurent } = await db
      .from("checklist_template_items")
      .select("id, template_id, ordine")
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCurent !== null) traduEroare(eroareCurent);
    if (curent === null) throw notFound("Pasul nu a fost găsit.");

    // Vecinul din direcția cerută: cel mai apropiat pas rămas, în ordinea
    // vizuală (coloana `ordine`), din același șablon.
    let interogareVecin = db
      .from("checklist_template_items")
      .select("id, ordine")
      .eq("template_id", curent.template_id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null);
    interogareVecin =
      input.directie === "sus"
        ? interogareVecin.lt("ordine", curent.ordine).order("ordine", { ascending: false })
        : interogareVecin.gt("ordine", curent.ordine).order("ordine", { ascending: true });
    const { data: vecin, error: eroareVecin } = await interogareVecin.limit(1).maybeSingle();
    if (eroareVecin !== null) traduEroare(eroareVecin);
    if (vecin === null) {
      throw businessRule(
        input.directie === "sus"
          ? "Pasul este deja primul din listă."
          : "Pasul este deja ultimul din listă.",
      );
    }

    // `checklist_template_items_ordine_uk (template_id, ordine)` nu e amânabil,
    // deci un simplu schimb de valori ar lovi 23505. Se trece printr-o poziție
    // de „parcare” (max + 1), refuzată dacă depășește CHECK-ul de 1..500.
    const { data: maxRand, error: eroareMax } = await db
      .from("checklist_template_items")
      .select("ordine")
      .eq("template_id", curent.template_id)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("ordine", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eroareMax !== null) traduEroare(eroareMax);
    const parcare = (maxRand?.ordine ?? 0) + 1;
    if (parcare > LIMITA_ORDINE) {
      throw businessRule(
        `Șablonul a atins limita de ${String(LIMITA_ORDINE)} de pași; ștergeți un pas înainte de a mai reordona.`,
      );
    }

    // `.select()` pe fiecare dintre cele trei scrieri: un UPDATE respins de
    // clauza USING a politicii (pasul șters între timp, drept de scriere
    // pierdut) atinge ZERO rânduri și NU ridică eroare. Fără el, parcarea
    // „reușea” tăcut, iar mutarea vecinului cădea imediat pe 23505 cu mesajul
    // greșit — sau, mai rău, reordonarea raporta succes fără să miște nimic.
    const { data: parcat, error: eroareParcare } = await db
      .from("checklist_template_items")
      .update({ ordine: parcare })
      .eq("id", curent.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (eroareParcare !== null) traduEroare(eroareParcare);
    if (parcat === null) {
      throw businessRule(
        "Pasul nu a putut fi mutat: fie a fost șters între timp, fie nu mai aveți dreptul asupra acestui șablon. Ordinea listei a rămas neschimbată; reîmprospătați pagina.",
      );
    }

    // Cele trei actualizări NU sunt într-o tranzacție (PostgREST): dacă una
    // din următoarele două eșuează, pasul rămâne la coadă. Mesajul o spune
    // explicit — revalidarea arată starea reală, nu una presupusă.
    const { data: vecinMutat, error: eroareB } = await db
      .from("checklist_template_items")
      .update({ ordine: curent.ordine })
      .eq("id", vecin.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (eroareB !== null) {
      throw businessRule(
        "Pasul a rămas temporar la coada listei: mutarea vecinului a eșuat. Reîmprospătați pagina și încercați din nou.",
      );
    }
    if (vecinMutat === null) {
      throw businessRule(
        "Pasul a rămas la coada listei: pasul vecin nu a putut fi mutat, fiindcă a fost șters între timp sau nu mai aveți dreptul asupra lui. Reîmprospătați pagina și reluați mutarea.",
      );
    }

    const { data: revenit, error: eroareA } = await db
      .from("checklist_template_items")
      .update({ ordine: vecin.ordine })
      .eq("id", curent.id)
      .eq("organization_id", organizationId)
      .select("id")
      .maybeSingle();
    if (eroareA !== null) {
      throw businessRule(
        "Pasul a rămas temporar la coada listei: revenirea pe poziția nouă a eșuat. Reîmprospătați pagina și încercați din nou.",
      );
    }
    if (revenit === null) {
      throw businessRule(
        "Pasul a rămas la coada listei: revenirea pe poziția nouă a fost respinsă. Reîmprospătați pagina și reluați mutarea.",
      );
    }

    return { id: curent.id, template_id: curent.template_id };
  },
});
