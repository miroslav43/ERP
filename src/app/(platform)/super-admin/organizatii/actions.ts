// src/app/(platform)/super-admin/organizatii/actions.ts
"use server";

import { businessRule, notFound } from "@/lib/actions/errors";
import { createPlatformAction } from "@/lib/actions/platform";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/platform";

import { construiesteSarcini } from "../_lib/sarcini";
import {
  actualizeazaOrganizatieSchema,
  creeazaOrganizatieSchema,
  idOrganizatieSchema,
  listaOrganizatiiSchema,
  suspendaOrganizatieSchema,
  type ListaOrganizatiiInput,
} from "@/schemas/organization";

const CAI_REVALIDATE = ["/super-admin", "/super-admin/organizatii"] as const;
const caiFisa = (orgId: string): readonly string[] => [
  ...CAI_REVALIDATE,
  `/super-admin/organizatii/${orgId}`,
];

/** Coloanele afișate în listă — nu selectăm niciodată `*`. */
const COLOANE_LISTA =
  "id, name, slug, cui, cui_normalizat, status, plan, seats_limit, created_at, deleted_at";

/** Rezultatul creării — declarat explicit ca să fie cunoscut și în callback-urile de audit. */
type OrganizatieCreata = { id: string; name: string; slug: string };

// ——— ACȚIUNI ————————————————————————————————————————————————————————————————

export const creeazaOrganizatie = createPlatformAction<
  typeof creeazaOrganizatieSchema,
  OrganizatieCreata
>({
  name: "platforma.org.create",
  input: creeazaOrganizatieSchema,
  rateLimit: { max: 20, windowSeconds: 3600 },
  audit: {
    action: "org_created",
    entityType: "organizations",
    entityId: (_input, data) => data.id,
    organizationId: (_input, data) => data.id,
    allow: ["id", "name", "slug", "cui", "plan", "seats_limit", "judet", "oras", "forma_juridica"],
  },
  revalidate: CAI_REVALIDATE,
  handler: async (ctx, input) => {
    const admin = createAdminSupabase();

    const { data: existent, error: eroareCautare } = await admin
      .from("organizations")
      .select("id, name, cui, slug")
      .or(`cui_normalizat.eq.${input.cui},slug.eq.${input.slug}`)
      .limit(1)
      .maybeSingle();
    if (eroareCautare) throw eroareCautare;
    if (existent) {
      throw businessRule(
        existent.cui === input.cui
          ? `Există deja o organizație cu CUI-ul ${input.cui}: „${existent.name}”.`
          : `Identificatorul „${input.slug}” este deja folosit de organizația „${existent.name}”.`,
      );
    }

    const { data: organizatie, error } = await admin
      .from("organizations")
      // Câmpurile opționale se omit complet când lipsesc (exactOptionalPropertyTypes).
      .insert({
        name: input.name,
        ...(input.legal_name === undefined ? {} : { legal_name: input.legal_name }),
        forma_juridica: input.forma_juridica,
        cui: input.cui,
        platitor_tva: input.platitor_tva,
        ...(input.reg_com === undefined ? {} : { reg_com: input.reg_com }),
        slug: input.slug,
        email_contact: input.email_contact,
        telefon_contact: input.telefon_contact,
        judet: input.judet,
        oras: input.oras,
        ...(input.adresa === undefined ? {} : { adresa: input.adresa }),
        ...(input.cod_postal === undefined ? {} : { cod_postal: input.cod_postal }),
        // Cod ISO 3166-1 alpha-2 — vezi nota din `nou/actions.ts`: coloana are
        // `check (tara ~ '^[A-Z]{2}$')`, iar „România” pica cu 23514.
        tara: "RO",
        ...(input.website === undefined ? {} : { website: input.website }),
        ...(input.reprezentant_legal === undefined
          ? {}
          : { reprezentant_legal: input.reprezentant_legal }),
        plan: input.plan,
        seats_limit: input.seats_limit,
        status: "pending",
        subscription_status: input.plan === "trial" ? "trialing" : "active",
        timezone: "Europe/Bucharest",
        locale: "ro-RO",
        moneda: "RON",
        created_by: ctx.user.id,
        updated_by: ctx.user.id,
      })
      .select("id, name, slug")
      .single();
    if (error) throw error;

    // Modulele de bază se activează automat; restul se comută din fișa organizației.
    const { data: moduleDeBaza, error: eroareModule } = await admin
      .from("features")
      .select("feature_key")
      .eq("is_core", true);
    if (eroareModule) throw eroareModule;
    if (moduleDeBaza && moduleDeBaza.length > 0) {
      const { error: eroareActivare } = await admin.from("organization_features").insert(
        moduleDeBaza.map((modul) => ({
          organization_id: organizatie.id,
          feature_key: modul.feature_key,
          enabled: true,
          activated_at: ctx.now.toISOString(),
          activated_by: ctx.user.id,
        })),
      );
      if (eroareActivare) throw eroareActivare;
    }

    return { id: organizatie.id, name: organizatie.name, slug: organizatie.slug };
  },
});

export const actualizeazaOrganizatie = createPlatformAction({
  name: "platforma.org.update",
  input: actualizeazaOrganizatieSchema,
  audit: {
    action: "update",
    entityType: "organizations",
    entityId: (input) => input.orgId,
    organizationId: (input) => input.orgId,
    allow: [
      "orgId",
      "name",
      "plan",
      "seats_limit",
      "judet",
      "oras",
      "email_contact",
      "cod_caen",
      "cod_caen_secundare",
    ],
  },
  revalidate: (input) => caiFisa(input.orgId),
  handler: async (ctx, input) => {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("organizations")
      // Câmpurile opționale se omit complet când lipsesc (exactOptionalPropertyTypes).
      .update({
        name: input.name,
        ...(input.legal_name === undefined ? {} : { legal_name: input.legal_name }),
        email_contact: input.email_contact,
        telefon_contact: input.telefon_contact,
        judet: input.judet,
        oras: input.oras,
        ...(input.adresa === undefined ? {} : { adresa: input.adresa }),
        ...(input.cod_postal === undefined ? {} : { cod_postal: input.cod_postal }),
        ...(input.website === undefined ? {} : { website: input.website }),
        ...(input.reprezentant_legal === undefined
          ? {}
          : { reprezentant_legal: input.reprezentant_legal }),
        plan: input.plan,
        seats_limit: input.seats_limit,
        ...(input.capital_social === undefined ? {} : { capital_social: input.capital_social }),
        ...(input.cod_caen === undefined ? {} : { cod_caen: input.cod_caen }),
        cod_caen_secundare: input.cod_caen_secundare,
        ...(input.sector === undefined ? {} : { sector: input.sector }),
        ...(input.functie_reprezentant_legal === undefined
          ? {}
          : { functie_reprezentant_legal: input.functie_reprezentant_legal }),
        ...(input.ssm_furnizor_extern === undefined
          ? {}
          : { ssm_furnizor_extern: input.ssm_furnizor_extern }),
        ...(input.ssm_persoana_responsabila === undefined
          ? {}
          : { ssm_persoana_responsabila: input.ssm_persoana_responsabila }),
        ...(input.zile_concediu_anual_implicit === undefined
          ? {}
          : { zile_concediu_anual_implicit: input.zile_concediu_anual_implicit }),
        updated_by: ctx.user.id,
      })
      .eq("id", input.orgId)
      .select("id, name")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound("Organizația nu a fost găsită.");
    return { id: data.id, name: data.name };
  },
});

export const activeazaOrganizatie = createPlatformAction({
  name: "platforma.org.activate",
  input: idOrganizatieSchema,
  audit: {
    action: "org_activated",
    entityType: "organizations",
    entityId: (input) => input.orgId,
    organizationId: (input) => input.orgId,
    allow: ["orgId", "status"],
  },
  revalidate: (input) => caiFisa(input.orgId),
  handler: async (ctx, input) => {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("organizations")
      .update({
        status: "active",
        activated_at: ctx.now.toISOString(),
        suspended_at: null,
        suspended_reason: null,
        updated_by: ctx.user.id,
      })
      .eq("id", input.orgId)
      .in("status", ["pending", "suspended"])
      .select("id, name, status")
      .maybeSingle();
    if (error) throw error;
    if (!data)
      throw businessRule(
        "Organizația nu poate fi activată din starea curentă. Reîncărcați pagina.",
      );
    return { id: data.id, name: data.name, status: data.status };
  },
});

export const suspendaOrganizatie = createPlatformAction({
  name: "platforma.org.suspend",
  input: suspendaOrganizatieSchema,
  audit: {
    action: "org_suspended",
    entityType: "organizations",
    entityId: (input) => input.orgId,
    organizationId: (input) => input.orgId,
    allow: ["orgId", "motiv", "membriAfectati"],
  },
  revalidate: (input) => caiFisa(input.orgId),
  handler: async (ctx, input) => {
    const admin = createAdminSupabase();
    const { count } = await admin
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", input.orgId)
      .eq("status", "active");

    const { data, error } = await admin
      .from("organizations")
      .update({
        status: "suspended",
        suspended_at: ctx.now.toISOString(),
        suspended_reason: input.motiv,
        updated_by: ctx.user.id,
      })
      .eq("id", input.orgId)
      .in("status", ["pending", "active"])
      .select("id, name")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw businessRule("Organizația este deja suspendată sau arhivată.");
    return { id: data.id, name: data.name, membriAfectati: count ?? 0 };
  },
});

export const arhiveazaOrganizatie = createPlatformAction({
  name: "platforma.org.archive",
  input: suspendaOrganizatieSchema,
  audit: {
    action: "delete",
    entityType: "organizations",
    entityId: (input) => input.orgId,
    organizationId: (input) => input.orgId,
    allow: ["orgId", "motiv"],
  },
  revalidate: (input) => caiFisa(input.orgId),
  handler: async (ctx, input) => {
    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from("organizations")
      .update({
        status: "archived",
        deleted_at: ctx.now.toISOString(),
        suspended_reason: input.motiv,
        updated_by: ctx.user.id,
      })
      .eq("id", input.orgId)
      .neq("status", "archived")
      .select("id, name")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw businessRule("Organizația este deja arhivată.");
    return { id: data.id, name: data.name };
  },
});

// ——— CITIRI (folosite de Server Components) ——————————————————————————————————
// Trăiesc în actions.ts pentru că doar aici este permis importul clientului service_role;
// fiecare începe cu requirePlatformAdmin(), deci expunerea lor ca endpoint „use server” e sigură.

export async function listaOrganizatii(parametri: ListaOrganizatiiInput) {
  await requirePlatformAdmin();
  const filtru = listaOrganizatiiSchema.parse(parametri);
  const admin = createAdminSupabase();
  const de_la = (filtru.pagina - 1) * filtru.pePagina;

  let interogare = admin.from("organizations").select(COLOANE_LISTA, { count: "exact" });
  if (filtru.status) interogare = interogare.eq("status", filtru.status);
  if (filtru.cautare) {
    // Curățăm caracterele care ar sparge sintaxa filtrului `or`.
    const text = filtru.cautare.replace(/[,()\\%]/g, " ").trim();
    const cifre = text.replace(/\D+/g, "");
    const conditii = [
      `name.ilike.%${text}%`,
      ...(cifre ? [`cui_normalizat.ilike.%${cifre}%`] : []),
    ];
    interogare = interogare.or(conditii.join(","));
  }

  const { data, count, error } = await interogare
    .order("created_at", { ascending: false })
    .range(de_la, de_la + filtru.pePagina - 1);
  if (error) throw error;

  const randuri = data ?? [];
  const idOrganizatii = randuri.map((rand) => rand.id);
  const membriPeOrganizatie = new Map<string, number>();
  const modulePeOrganizatie = new Map<string, number>();
  if (idOrganizatii.length > 0) {
    // Ambele numărători pe pagina curentă, în paralel: sunt independente, iar
    // secvențial ar adăuga un dus-întors către eu-west-1 la fiecare afișare.
    const [{ data: membri, error: eroareMembri }, { data: module, error: eroareModule }] =
      await Promise.all([
        admin
          .from("organization_members")
          .select("organization_id")
          .in("organization_id", idOrganizatii)
          .eq("status", "active"),
        admin
          .from("organization_features")
          .select("organization_id")
          .in("organization_id", idOrganizatii)
          .eq("enabled", true)
          .is("deleted_at", null),
      ]);
    if (eroareMembri) throw eroareMembri;
    if (eroareModule) throw eroareModule;
    for (const membru of membri ?? []) {
      membriPeOrganizatie.set(
        membru.organization_id,
        (membriPeOrganizatie.get(membru.organization_id) ?? 0) + 1,
      );
    }
    for (const modul of module ?? []) {
      modulePeOrganizatie.set(
        modul.organization_id,
        (modulePeOrganizatie.get(modul.organization_id) ?? 0) + 1,
      );
    }
  }

  const total = count ?? 0;
  return {
    randuri: randuri.map((rand) => ({
      ...rand,
      membriActivi: membriPeOrganizatie.get(rand.id) ?? 0,
      moduleActive: modulePeOrganizatie.get(rand.id) ?? 0,
    })),
    total,
    pagina: filtru.pagina,
    pePagina: filtru.pePagina,
    pagini: Math.max(1, Math.ceil(total / filtru.pePagina)),
  };
}

export async function fisaOrganizatiei(orgId: string) {
  await requirePlatformAdmin();
  const { orgId: id } = idOrganizatieSchema.parse({ orgId });
  const admin = createAdminSupabase();

  const { data: organizatie, error } = await admin
    .from("organizations")
    .select(
      "id, name, legal_name, forma_juridica, cui, platitor_tva, reg_com, slug, status, plan, seats_limit, subscription_status, trial_ends_at, email_contact, telefon_contact, adresa, judet, oras, cod_postal, website, reprezentant_legal, timezone, created_at, activated_at, suspended_at, suspended_reason, deleted_at, capital_social, cod_caen, cod_caen_secundare, sector, functie_reprezentant_legal, ssm_furnizor_extern, ssm_persoana_responsabila, zile_concediu_anual_implicit",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!organizatie) return null;

  // Între `organization_features` și `features` nu există cheie străină, deci PostgREST nu poate
  // face join implicit: citim catalogul separat și îmbinăm în TypeScript.
  const [
    { data: membri },
    { data: module },
    { data: catalogModule },
    { count: invitatiiInAsteptare },
  ] = await Promise.all([
    admin
      .from("organization_members")
      .select("id, user_id, role, status, job_title, joined_at")
      .eq("organization_id", id)
      .order("joined_at", { ascending: true })
      .limit(50),
    admin.from("organization_features").select("feature_key, enabled").eq("organization_id", id),
    admin.from("features").select("feature_key, denumire, grup"),
    admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id)
      .eq("status", "pending"),
  ]);

  const catalogDupaCheie = new Map(
    (catalogModule ?? []).map((modul) => [modul.feature_key, modul] as const),
  );

  const idUtilizatori = (membri ?? []).map((membru) => membru.user_id);
  const profileDupaId = new Map<string, { nume: string | null; email: string | null }>();
  if (idUtilizatori.length > 0) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", idUtilizatori);
    for (const profil of profile ?? [])
      profileDupaId.set(profil.id, { nume: profil.full_name, email: profil.email });
  }

  return {
    organizatie,
    membri: (membri ?? []).map((membru) => ({
      ...membru,
      nume: profileDupaId.get(membru.user_id)?.nume ?? null,
      email: profileDupaId.get(membru.user_id)?.email ?? null,
    })),
    module: (module ?? []).map((modul) => ({
      cheie: modul.feature_key,
      denumire: catalogDupaCheie.get(modul.feature_key)?.denumire ?? modul.feature_key,
      grup: catalogDupaCheie.get(modul.feature_key)?.grup ?? "core",
      activ: modul.enabled,
    })),
    membriActivi: (membri ?? []).filter((membru) => membru.status === "active").length,
    invitatiiInAsteptare: invitatiiInAsteptare ?? 0,
  };
}

export async function sumarPlatforma() {
  await requirePlatformAdmin();
  const admin = createAdminSupabase();
  const numara = async (status: "pending" | "active" | "suspended" | "archived") => {
    const { count } = await admin
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    return count ?? 0;
  };
  const [pending, active, suspended, archived, cereriNoi, invitatii] = await Promise.all([
    numara("pending"),
    numara("active"),
    numara("suspended"),
    numara("archived"),
    admin
      .from("demo_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .then((r) => r.count ?? 0),
    admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then((r) => r.count ?? 0),
  ]);
  return {
    organizatii: { pending, active, suspended, archived },
    cereriDemoNoi: cereriNoi,
    invitatiiInAsteptare: invitatii,
  };
}

/**
 * Tot ce afișează panoul de platformă, într-o singură trecere.
 *
 * `createAdminSupabase()` ocolește RLS deliberat: citirile de platformă sunt
 * prin definiție cross-organizație, iar un administrator de platformă nu e
 * membru nicăieri — politicile per-tenant i-ar întoarce zero rânduri. Poarta e
 * `requirePlatformAdmin()` de mai jos, nu RLS-ul.
 *
 * Stă aici, în `actions.ts`, și nu în `src/lib/queries/` ca restul citirilor din
 * aplicație, pentru că ESLint permite `createAdminSupabase()` doar în
 * `actions.ts`, `api/**` , `rate-limit.ts`, `scripts/**` și `tests/**`.
 *
 * O singură trecere, cu `Promise.all`: cinci interogări secvențiale ar face
 * panoul să se încarce în cinci dus-întorsuri către eu-west-1.
 */
export async function datePanou() {
  await requirePlatformAdmin();
  const admin = createAdminSupabase();

  const [sumar, organizatii, module, membri, activitate] = await Promise.all([
    sumarPlatforma(),
    admin
      .from("organizations")
      .select("id, name, cui, oras, status, plan, seats_limit, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    admin
      .from("organization_features")
      .select("organization_id")
      .eq("enabled", true)
      .is("deleted_at", null),
    admin.from("organization_members").select("organization_id, role").eq("status", "active"),
    admin
      .from("audit_logs")
      .select("id, action, entity_type, created_at, status")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const numaraPeOrganizatie = (randuri: readonly { organization_id: string }[]) => {
    const harta = new Map<string, number>();
    for (const rand of randuri) {
      harta.set(rand.organization_id, (harta.get(rand.organization_id) ?? 0) + 1);
    }
    return harta;
  };

  const moduleP = numaraPeOrganizatie(module.data ?? []);
  const adminiP = numaraPeOrganizatie(
    (membri.data ?? []).filter((m) => m.role === "org_admin"),
  );

  const randuri = (organizatii.data ?? []).map((o) => ({
    ...o,
    moduleActive: moduleP.get(o.id) ?? 0,
    administratori: adminiP.get(o.id) ?? 0,
  }));

  return {
    sumar,
    organizatii: randuri,
    sarcini: construiesteSarcini({
      cereriDemoNoi: sumar.cereriDemoNoi,
      organizatii: randuri,
    }),
    activitate: activitate.data ?? [],
  };
}
