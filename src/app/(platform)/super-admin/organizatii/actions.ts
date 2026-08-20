// src/app/(platform)/super-admin/organizatii/actions.ts
"use server";

import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { businessRule, invalidInput, notFound } from "@/lib/actions/errors";
import { createPlatformAction } from "@/lib/actions/platform";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { cautaFirmaAnaf } from "@/lib/anaf/cauta-firma";
import { cautaCuiAnafSchema } from "@/schemas/organization";
import { pregatestePayloadCnp, EroareCnpReprezentant } from "@/lib/crypto/organization-sensitive-data";
import type { RezultatAnafGasit } from "@/domain/organization/anaf";
import {
  actualizeazaOrganizatieSchema,
  idOrganizatieSchema,
  inroleazaOrganizatieSchema,
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

// ——— ACȚIUNI ————————————————————————————————————————————————————————————————

export type RezultatCautareCui = Readonly<{
  cui: string;
  anaf: RezultatAnafGasit | null;
}>;

/**
 * Verifică unicitatea CUI ÎNAINTE de a apela ANAF: dacă organizația există
 * deja, nu are rost să interogăm un API extern. Rezultatul e mereu "ok" din
 * perspectiva Ecranului 1 — un CUI negăsit sau un ANAF indisponibil întorc
 * `anaf: null`, nu eroare, pentru ca formularul să treacă la completare manuală.
 */
export const cautaCuiAnaf = createPlatformAction<typeof cautaCuiAnafSchema, RezultatCautareCui>({
  name: "platforma.org.cauta_cui",
  input: cautaCuiAnafSchema,
  rateLimit: { max: 30, windowSeconds: 3600 },
  audit: {
    action: "view",
    entityType: "organizations",
    allow: ["cui"],
  },
  handler: async (_ctx, input) => {
    const admin = createAdminSupabase();
    const { data: existent, error } = await admin
      .from("organizations")
      .select("id, name")
      .eq("cui_normalizat", input.cui)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (existent) {
      throw businessRule(`Există deja o organizație cu CUI-ul ${input.cui}: „${existent.name}”.`);
    }

    const cautare = await cautaFirmaAnaf(input.cui);
    return {
      cui: input.cui,
      anaf: cautare.stare === "gasit" ? cautare.rezultat : null,
    };
  },
});

export type OrganizatieInrolata = Readonly<{
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  /** Afișată o singură dată în UI (Task 10) — NU se loghează, NU intră în audit. */
  parolaTemporara: string;
}>;

function genereazaParolaTemporara(): string {
  // 18 octeți -> 24 caractere base64url; peste minimul de 12 din parolaSchema.
  return randomBytes(18).toString("base64url");
}

export const inroleazaOrganizatie = createPlatformAction<
  typeof inroleazaOrganizatieSchema,
  OrganizatieInrolata
>({
  name: "platforma.org.inroleaza",
  input: inroleazaOrganizatieSchema,
  rateLimit: { max: 20, windowSeconds: 3600 },
  audit: {
    action: "org_created",
    entityType: "organizations",
    entityId: (_input, data) => data.id,
    organizationId: (_input, data) => data.id,
    allow: [
      "id",
      "name",
      "slug",
      "cui",
      "plan",
      "seats_limit",
      "judet",
      "oras",
      "forma_juridica",
      "cod_caen",
      "ownerEmail",
    ],
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

    // Validăm CNP-ul reprezentantului ÎNAINTE de orice scriere: un CNP greșit
    // nu trebuie să lase în urmă o organizație pe jumătate creată.
    let payloadCnp: ReturnType<typeof pregatestePayloadCnp>;
    try {
      payloadCnp = pregatestePayloadCnp(input.reprezentant_cnp ?? null);
    } catch (eroare) {
      if (eroare instanceof EroareCnpReprezentant) {
        throw invalidInput(eroare.message, { reprezentant_cnp: [eroare.message] });
      }
      throw eroare;
    }

    const { data: organizatie, error } = await admin
      .from("organizations")
      .insert({
        name: input.name,
        ...(input.legal_name === undefined ? {} : { legal_name: input.legal_name }),
        forma_juridica: input.forma_juridica,
        cui: input.cui,
        platitor_tva: input.platitor_tva,
        ...(input.reg_com === undefined ? {} : { reg_com: input.reg_com }),
        ...(input.cod_caen === undefined ? {} : { cod_caen: input.cod_caen }),
        capital_social: input.capital_social,
        slug: input.slug,
        email_contact: input.email_contact,
        telefon_contact: input.telefon_contact,
        judet: input.judet,
        oras: input.oras,
        strada: input.strada,
        numar: input.numar,
        ...(input.sector === undefined ? {} : { sector: input.sector }),
        ...(input.adresa === undefined ? {} : { adresa: input.adresa }),
        ...(input.cod_postal === undefined ? {} : { cod_postal: input.cod_postal }),
        ...(input.website === undefined ? {} : { website: input.website }),
        ...(input.reprezentant_legal === undefined
          ? {}
          : { reprezentant_legal: input.reprezentant_legal }),
        reprezentant_functie: input.reprezentant_functie,
        plan: input.plan,
        seats_limit: input.seats_limit,
        // Spre deosebire de fluxul vechi: înrolarea e completă, nu un lead —
        // organizația iese din acest flux activă, nu "pending".
        status: "active",
        activated_at: ctx.now.toISOString(),
        subscription_status: input.plan === "trial" ? "trialing" : "active",
        timezone: "Europe/Bucharest",
        locale: "ro-RO",
        moneda: "RON",
        // NU seta `tara: "România"` (bug preexistent copiat din handler-ul
        // vechi): coloana are `check (tara ~ '^[A-Z]{2}$')` — "România" ar
        // respinge inserarea. Se omite complet, rămâne pe default-ul 'RO'.
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

    if (payloadCnp.cnp_ciphertext !== null || input.reprezentant_legal !== undefined) {
      const { error: eroareReprezentant } = await admin
        .from("organization_legal_representative")
        .insert({
          organization_id: organizatie.id,
          nume: input.reprezentant_legal ?? null,
          functie: input.reprezentant_functie,
          ...payloadCnp,
          created_by: ctx.user.id,
          updated_by: ctx.user.id,
        });
      if (eroareReprezentant) throw eroareReprezentant;
    }

    const parolaTemporara = genereazaParolaTemporara();
    const { data: userNou, error: eroareUser } = await admin.auth.admin.createUser({
      email: input.owner_email,
      password: parolaTemporara,
      email_confirm: true,
      phone: input.owner_telefon,
      user_metadata: { full_name: input.owner_nume },
    });

    if (eroareUser || !userNou.user) {
      // Compensare: CUI-ul/slug-ul nu rămân blocate de o înrolare eșuată pe
      // jumătate. `organization_legal_representative` cade automat prin
      // `on delete cascade`.
      await admin.from("organizations").delete().eq("id", organizatie.id);
      throw businessRule(
        `Organizația nu a putut fi înrolată: contul proprietarului nu a putut fi creat (${eroareUser?.message ?? "motiv necunoscut"}). Reîncearcă.`,
      );
    }

    const { error: eroareMembru } = await admin.from("organization_members").insert({
      organization_id: organizatie.id,
      user_id: userNou.user.id,
      role: "org_admin",
      status: "active",
      created_by: ctx.user.id,
      updated_by: ctx.user.id,
    });
    if (eroareMembru) throw eroareMembru;

    const { error: eroareProfil } = await admin
      .from("profiles")
      .update({ phone: input.owner_telefon, must_change_password: true })
      .eq("id", userNou.user.id);
    if (eroareProfil) throw eroareProfil;

    // Audit separat pentru crearea membrului — allow-list exclude parola.
    const antete = await headers();
    await ctx.supabase.rpc("log_audit_event", {
      p_action: "member_added",
      p_status: "success",
      p_organization_id: organizatie.id,
      p_entity_type: "organization_members",
      p_entity_id: userNou.user.id,
      p_before: null,
      p_after: { email: input.owner_email, role: "org_admin" },
      p_ip: antete.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      p_user_agent: antete.get("user-agent"),
      p_request_id: ctx.requestId,
      p_error_code: null,
    });

    return {
      id: organizatie.id,
      name: organizatie.name,
      slug: organizatie.slug,
      ownerEmail: input.owner_email,
      parolaTemporara,
    };
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
    allow: ["orgId", "name", "plan", "seats_limit", "judet", "oras", "email_contact"],
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

/** Reactivarea este aceeași tranziție ca activarea, dar auditată din starea „suspendată”. */
export const reactiveazaOrganizatie = activeazaOrganizatie;

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
  if (idOrganizatii.length > 0) {
    const { data: membri, error: eroareMembri } = await admin
      .from("organization_members")
      .select("organization_id")
      .in("organization_id", idOrganizatii)
      .eq("status", "active");
    if (eroareMembri) throw eroareMembri;
    for (const membru of membri ?? []) {
      membriPeOrganizatie.set(
        membru.organization_id,
        (membriPeOrganizatie.get(membru.organization_id) ?? 0) + 1,
      );
    }
  }

  const total = count ?? 0;
  return {
    randuri: randuri.map((rand) => ({
      ...rand,
      membriActivi: membriPeOrganizatie.get(rand.id) ?? 0,
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
      "id, name, legal_name, forma_juridica, cui, platitor_tva, reg_com, slug, status, plan, seats_limit, subscription_status, trial_ends_at, email_contact, telefon_contact, adresa, judet, oras, cod_postal, website, reprezentant_legal, timezone, created_at, activated_at, suspended_at, suspended_reason, deleted_at",
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
