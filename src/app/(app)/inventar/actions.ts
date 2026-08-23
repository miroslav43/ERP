// src/app/(app)/inventar/actions.ts
"use server";

import { createAction } from "@/lib/actions/create-action";
import { businessRule, notFound } from "@/lib/actions/errors";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format/date";
import {
  actualizeazaObiectSchema,
  caseazaObiectSchema,
  confirmaPrimireaSchema,
  creeazaObiectSchema,
  predaObiectSchema,
  returneazaObiectSchema,
} from "@/schemas/inventory";

import { traduEroare } from "./erori";

export const creeazaObiect = createAction({
  name: "inventory.item.create",
  feature: "inventory",
  permission: "inventory:update",
  minScope: "all",
  input: creeazaObiectSchema,
  audit: {
    action: "create",
    entityType: "inventory_item",
    entityId: (_input, data: Readonly<{ id: string; denumire: string }>) => data.id,
    allow: [
      "denumire",
      "numar_inventar",
      "serie",
      "model",
      "producator",
      "category_id",
      "data_achizitie",
      "valoare",
      "garantie_expira",
      "stare",
      "locatie",
      "observatii",
    ],
  },
  revalidate: ["/inventar", "/portal", "/portal/in-primirea-mea"],
  handler: async (ctx, input): Promise<Readonly<{ id: string; denumire: string }>> => {
    const db = await createServerSupabase();
    // `status` explicit: politica INSERT îl cere fix pe „in_stoc” — un obiect
    // nou nu poate intra direct „alocat” fără o predare-primire înregistrată.
    const { data, error } = await db
      .from("inventory_items")
      .insert({
        ...input,
        organization_id: ctx.tenant.organizationId,
        status: "in_stoc",
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, denumire")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id, denumire: data.denumire };
  },
});

export const actualizeazaObiect = createAction({
  name: "inventory.item.update",
  feature: "inventory",
  permission: "inventory:update",
  minScope: "all",
  input: actualizeazaObiectSchema,
  audit: {
    action: "update",
    entityType: "inventory_item",
    entityId: (input) => input.id,
    allow: [
      "id",
      "denumire",
      "numar_inventar",
      "serie",
      "model",
      "producator",
      "category_id",
      "data_achizitie",
      "valoare",
      "garantie_expira",
      "stare",
      "locatie",
      "observatii",
    ],
  },
  revalidate: (input) => ["/inventar", `/inventar/${input.id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { id, ...campuri } = input;

    // Nu se trimit `organization_id`/`created_at`: triggerul `inventory_items_biu`
    // le rescrie oricum din OLD, dar câmpul nu trebuie nici oferit la scriere.
    const { data, error } = await db
      .from("inventory_items")
      .update({ ...campuri, updated_by: ctx.user.id })
      .eq("id", id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Obiectul de inventar nu a fost găsit sau nu vă este accesibil.");
    }

    return { id: data.id };
  },
});

export const predaObiect = createAction({
  name: "inventory.allocation.create",
  feature: "inventory",
  permission: "inventory:update",
  minScope: "all",
  input: predaObiectSchema,
  audit: {
    action: "create",
    entityType: "inventory_allocation",
    entityId: (_input, data: Readonly<{ id: string; item_id: string }>) => data.id,
    allow: [
      "item_id",
      "employee_id",
      "predat_la",
      "stare_la_predare",
      "observatii",
      "pv_document_path",
    ],
  },
  revalidate: (input) => ["/inventar", `/inventar/${input.item_id}`, "/inventar/in-primire"],
  handler: async (ctx, input): Promise<Readonly<{ id: string; item_id: string }>> => {
    const db = await createServerSupabase();

    // Pre-verificare obligatorie: fără ea, o predare peste alta ar cădea cu
    // 23P01 brut, cu uuid-ul celeilalte alocări în DETAIL.
    const { data: obiect, error: eroareObiect } = await db
      .from("inventory_items")
      .select("id, denumire, status")
      .eq("id", input.item_id)
      .eq("organization_id", ctx.tenant.organizationId)
      .maybeSingle();
    if (eroareObiect !== null) traduEroare(eroareObiect);
    if (obiect === null) {
      throw notFound("Obiectul de inventar nu a fost găsit sau nu vă este accesibil.");
    }
    if (obiect.status === "casat") {
      throw businessRule("Obiectul este casat și nu mai poate fi predat unui angajat.");
    }

    const { data: alocareDeschisa, error: eroareAlocare } = await db
      .from("inventory_allocations")
      .select("employee_id, predat_la")
      .eq("organization_id", ctx.tenant.organizationId)
      .eq("item_id", input.item_id)
      .is("returnat_la", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareAlocare !== null) traduEroare(eroareAlocare);
    if (alocareDeschisa !== null) {
      const { data: detinator } = await db
        .from("employees")
        .select("full_name")
        .eq("id", alocareDeschisa.employee_id)
        .maybeSingle();
      // `predat_la` e un MOMENT (timestamptz), nu o zi calendaristică — de
      // aceea `formatDateTime`, nu `formatDate` (care ar arunca pe un șir cu oră).
      throw businessRule(
        `Obiectul „${obiect.denumire}” este deja predat lui ${detinator?.full_name ?? "un alt angajat"} din ${formatDateTime(alocareDeschisa.predat_la)}. Înregistrați mai întâi returnarea.`,
      );
    }

    // FĂRĂ returnat_la / stare_la_returnare / confirmat_de_angajat_la: politica
    // INSERT le cere NULL. `internal.inventory_alloc_propaga` mută singur
    // `inventory_items.status` pe „alocat” — nu se scrie de mână aici.
    const { data, error } = await db
      .from("inventory_allocations")
      .insert({
        organization_id: ctx.tenant.organizationId,
        item_id: input.item_id,
        employee_id: input.employee_id,
        ...(input.predat_la === null ? {} : { predat_la: input.predat_la }),
        stare_la_predare: input.stare_la_predare,
        observatii: input.observatii,
        pv_document_path: input.pv_document_path,
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, item_id")
      .single();
    if (error !== null) traduEroare(error);

    return { id: data.id, item_id: data.item_id };
  },
});

export const returneazaObiect = createAction({
  name: "inventory.allocation.return",
  feature: "inventory",
  permission: "inventory:update",
  minScope: "all",
  input: returneazaObiectSchema,
  audit: {
    action: "update",
    entityType: "inventory_allocation",
    entityId: (input) => input.id,
    allow: ["id", "returnat_la", "stare_la_returnare", "observatii"],
  },
  // `data` anotat explicit: proprietatea `revalidate` apare, în acest obiect,
  // ÎNAINTEA lui `handler` — TypeScript nu a inferat încă `TData` din
  // `handler` în momentul verificării acestei funcții, deci fără adnotare
  // `data` ar rămâne `unknown`.
  revalidate: (_input: unknown, data: Readonly<{ id: string; item_id: string }>) => [
    "/inventar",
    `/inventar/${data.item_id}`,
    "/inventar/in-primire",
  ],
  handler: async (ctx, input): Promise<Readonly<{ id: string; item_id: string }>> => {
    const db = await createServerSupabase();

    const { data: alocare, error: eroareCitire } = await db
      .from("inventory_allocations")
      .select("id, item_id, returnat_la")
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (eroareCitire !== null) traduEroare(eroareCitire);
    if (alocare === null) {
      throw notFound("Predarea-primirea nu a fost găsită sau nu vă este accesibilă.");
    }
    if (alocare.returnat_la !== null) {
      throw businessRule("Această predare-primire a fost deja returnată.");
    }

    // `internal.inventory_alloc_imutabile` acceptă exact aceste coloane la
    // UPDATE. Returnare cu starea „defect” mută obiectul în „in_reparatie”,
    // nu în „in_stoc” (0019/V1b) — mesajul de succes trebuie să o spună.
    // Citirea de mai sus vede STRICT mai mult decât poate scrie UPDATE-ul:
    // `inventory_allocations_select_checklist` (0014) deschide alocările oricui
    // are `checklists:update=team` — cine conduce offboardingul citește aloca-
    // rea, dar `inventory_allocations_update` îi cere `inventory:update=all` sau
    // să fie chiar angajatul de pe rând. Refuzul e ZERO rânduri, FĂRĂ eroare, iar
    // fără `.select()` ecranul ar anunța obiectul returnat în timp ce baza îl
    // ține mai departe în primirea angajatului.
    const { data: alocareInchisa, error } = await db
      .from("inventory_allocations")
      .update({
        returnat_la: input.returnat_la ?? ctx.now.toISOString(),
        stare_la_returnare: input.stare_la_returnare,
        observatii: input.observatii,
        updated_by: ctx.user.id,
      })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (alocareInchisa === null) {
      throw businessRule(
        "Returnarea nu a fost înregistrată: predarea-primirea a fost închisă de altcineva între timp sau nu aveți dreptul de a opera inventarul. Reîncărcați pagina și verificați cine are obiectul în primire.",
      );
    }

    return { id: input.id, item_id: alocare.item_id };
  },
});

export const confirmaPrimirea = createAction({
  name: "inventory.allocation.confirm",
  feature: "inventory",
  // Permisiune de CITIRE care autorizează o scriere, fiindcă politica RLS de
  // UPDATE e literalmente `app.can(org,'inventory','read','own')` pe ramura
  // proprie — un angajat confirmă primirea cu dreptul de a-și vedea alocările.
  permission: "inventory:read",
  minScope: "own",
  input: confirmaPrimireaSchema,
  audit: {
    action: "update",
    entityType: "inventory_allocation",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: ["/inventar/in-primire", "/portal", "/portal/in-primirea-mea"],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    const { data, error } = await db
      .from("inventory_allocations")
      .update({ confirmat_de_angajat_la: ctx.now.toISOString(), updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .is("returnat_la", null)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Predarea nu a fost găsită sau a fost deja returnată.");
    }

    return { id: data.id };
  },
});

export const caseazaObiect = createAction({
  name: "inventory.item.decommission",
  feature: "inventory",
  permission: "inventory:update",
  minScope: "all",
  input: caseazaObiectSchema,
  audit: {
    action: "update",
    entityType: "inventory_item",
    entityId: (input) => input.id,
    allow: ["id"],
  },
  revalidate: (input) => ["/inventar", `/inventar/${input.id}`],
  handler: async (ctx, input): Promise<Readonly<{ id: string }>> => {
    const db = await createServerSupabase();
    // Nicio pre-verificare separată: `internal.inventory_items_valideaza`
    // respinge deja trecerea pe „casat” cât timp există o alocare deschisă, cu
    // mesajul „Obiectul este predat unui angajat…” — tradus mai jos prin P0001.
    const { data, error } = await db
      .from("inventory_items")
      .update({ status: "casat", updated_by: ctx.user.id })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId)
      .select("id")
      .maybeSingle();
    if (error !== null) traduEroare(error);
    if (data === null) {
      throw notFound("Obiectul de inventar nu a fost găsit sau nu vă este accesibil.");
    }

    return { id: data.id };
  },
});
