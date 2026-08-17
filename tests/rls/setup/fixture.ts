// tests/rls/setup/fixture.ts
/**
 * Fixture-ul de izolare: DOUĂ organizații complete, cu patru utilizatori reali
 * fiecare (org_admin, manager, hr, employee), module DIFERITE activate și — cel
 * mai important — CEL PUȚIN UN RÂND PENTRU FIECARE ORGANIZAȚIE ÎN FIECARE
 * TABELĂ CU `organization_id`.
 *
 * Ultima condiție este esențială: pe o tabelă goală, „userul din A nu vede
 * rânduri din B" trece fals-pozitiv, pentru că nu există nimic de văzut. De
 * aceea acoperirea nu e opțională — dacă o tabelă descoperită nu are șablon sau
 * rămâne goală, `pregatesteFixture()` ARUNCĂ, cu numele tabelei în mesaj.
 *
 * Șabloanele din `SABLOANE` sunt folosite în două locuri: aici, cu
 * `service_role`, ca să semene datele legitime, și în testul de izolare, cu
 * JWT-ul unui utilizator din cealaltă organizație, ca încercare de INSERT
 * cross-tenant. Un singur set de șabloane ⇒ nu pot diverge.
 *
 * Variabilele de mediu cerute sunt documentate în `discover.ts`.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { discoverTables, executaSql, interogheazaSql, mediuTest } from "./discover";

export const ROLURI_TEST = ["org_admin", "manager", "hr", "employee"] as const;
export type RolTest = (typeof ROLURI_TEST)[number];

/** Domeniul rezervat testelor. Curățarea șterge exclusiv utilizatorii de aici. */
export const DOMENIU_TEST = "rls-test.invalid";
export const PREFIX_SLUG = "rls";

/**
 * `organizations` nu are `organization_id` — coloana ei de tenant este `id`.
 * Fără această hartă, tabela ar cădea din toate verificările de izolare.
 */
export const COLOANA_TENANT_SPECIALA: Readonly<Record<string, string>> = { organizations: "id" };

export function coloanaTenant(tabela: string): string {
  return COLOANA_TENANT_SPECIALA[tabela] ?? "organization_id";
}

export function esteTabelaTenant(nume: string, areOrganizationId: boolean): boolean {
  return areOrganizationId || nume in COLOANA_TENANT_SPECIALA;
}

export type Rand = Readonly<Record<string, unknown>>;

export type ContextSablon = Readonly<{
  organizationId: string;
  userId: string;
  featureKey: string;
  sufix: string;
}>;

export type Sablon = Readonly<{
  /** Rând minim VALID pentru tabelă. Valorile unice poartă `sufix`, ca INSERT-ul
   *  cross-tenant să fie respins de RLS (42501), nu de un UNIQUE (23505). */
  rand: (c: ContextSablon) => Rand;
  /** Patch de UPDATE cu o valoare care NU apare în fixture ⇒ orice apariție a ei
   *  după tentativa cross-tenant înseamnă că politica UPDATE e găurită. */
  actualizare: Rand;
}>;

const hex = (): string => randomUUID().replace(/-/g, "");
const sha256Fals = (): string => `${hex()}${hex()}`.slice(0, 64);

export const SABLOANE: Readonly<Record<string, Sablon>> = {
  organizations: {
    rand: (c) => ({
      slug: `intrus-${c.sufix}`,
      name: `Intrus SRL ${c.sufix}`,
      cui: `${Math.floor(1e7 + Math.random() * 8.9e7)}`,
      status: "pending",
    }),
    actualizare: { name: "Preluată de atacator" },
  },
  organization_branding: {
    rand: (c) => ({ organization_id: c.organizationId, denumire_afisata: `Marcă ${c.sufix}` }),
    actualizare: { denumire_afisata: "Preluată de atacator" },
  },
  invitations: {
    rand: (c) => ({
      organization_id: c.organizationId,
      email: `invitat-${c.sufix}@${DOMENIU_TEST}`,
      role: "employee",
      token_hash: sha256Fals(),
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    }),
    actualizare: { status: "revoked" },
  },
  organization_members: {
    rand: (c) => ({
      organization_id: c.organizationId,
      user_id: c.userId,
      role: "employee",
      status: "active",
      job_title: `Post ${c.sufix}`,
    }),
    actualizare: { job_title: "Atacator" },
  },
  organization_features: {
    rand: (c) => ({ organization_id: c.organizationId, feature_key: c.featureKey, enabled: true }),
    actualizare: { enabled: false },
  },
  role_permissions: {
    rand: (c) => ({
      organization_id: c.organizationId,
      role: "hr",
      resource: `t${c.sufix}`,
      action: "read",
      scope: "none",
    }),
    actualizare: { scope: "all" },
  },
  audit_logs: {
    rand: (c) => ({
      organization_id: c.organizationId,
      action: "create",
      status: "success",
      entity_type: "rls_fixture",
    }),
    actualizare: { status: "failure" },
  },
  notifications: {
    rand: (c) => ({
      organization_id: c.organizationId,
      user_id: c.userId,
      kind: "info",
      title: `Notificare ${c.sufix}`,
    }),
    actualizare: { title: "Preluată de atacator" },
  },
  notification_preferences: {
    rand: (c) => ({
      organization_id: c.organizationId,
      user_id: c.userId,
      kind: "info",
      in_app: true,
      email: false,
    }),
    actualizare: { in_app: false },
  },
  document_sequences: {
    rand: (c) => ({
      organization_id: c.organizationId,
      document_type: `t${c.sufix}`,
      year: new Date().getFullYear(),
      prefix: "",
    }),
    actualizare: { prefix: "X" },
  },
  retention_policies: {
    rand: (c) => ({
      organization_id: c.organizationId,
      entity_type: `t${c.sufix}`,
      retention_months: 24,
      enabled: true,
    }),
    actualizare: { retention_months: 1 },
  },
  email_log: {
    rand: (c) => ({
      organization_id: c.organizationId,
      destinatar: `dest-${c.sufix}@${DOMENIU_TEST}`,
      subiect: `RLS fixture ${c.sufix}`,
      template: "rls_fixture",
      status: "queued",
    }),
    actualizare: { subiect: "Preluat de atacator" },
  },
};

export function sablonPentru(tabela: string): Sablon {
  const sablon = SABLOANE[tabela];
  if (sablon === undefined) {
    throw new Error(
      `Tabela "${tabela}" are coloană de tenant dar NU are șablon în tests/rls/setup/fixture.ts. ` +
        "Adaugă-l: fără el, izolarea acestei tabele nu este verificată de nimeni.",
    );
  }
  return sablon;
}

export type Actor = Readonly<{
  rol: RolTest;
  email: string;
  userId: string;
  organizationId: string;
  client: SupabaseClient;
}>;

export type Organizatie = Readonly<{
  id: string;
  slug: string;
  nume: string;
  module: readonly string[];
  actori: Readonly<Record<RolTest, Actor>>;
}>;

export type Fixture = Readonly<{
  alfa: Organizatie;
  beta: Organizatie;
  anon: SupabaseClient;
  sufix: string;
  tabeleTenant: readonly string[];
}>;

function clientAnonim(): SupabaseClient {
  const { url, anonKey } = mediuTest();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function clientAdmin(): SupabaseClient {
  const { url, serviceKey } = mediuTest();
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Clientul Supabase este NEtipat până când `pnpm db:types` generează
 * `src/types/database.ts`; `as never` este singurul loc unde ocolim asta, ca să
 * nu introducem `any` nicăieri (interzis prin ESLint).
 */
async function insereaza(client: SupabaseClient, tabela: string, rand: Rand): Promise<Rand> {
  const { data, error } = await client
    .from(tabela)
    .insert(rand as never)
    .select("*")
    .single();
  if (error !== null) {
    throw new Error(`Fixture: INSERT în ${tabela} a eșuat (${error.code}): ${error.message}`);
  }
  return data as Rand;
}

async function creeazaActor(
  admin: SupabaseClient,
  organizationId: string,
  rol: RolTest,
  eticheta: string,
  sufix: string,
): Promise<Actor> {
  const email = `${eticheta}-${rol}-${sufix}@${DOMENIU_TEST}`;
  const parola = `Rls!${randomUUID()}`;
  const { data: creat, error: eroareCreare } = await admin.auth.admin.createUser({
    email,
    password: parola,
    email_confirm: true,
    user_metadata: { full_name: `${eticheta} ${rol}` },
  });
  if (eroareCreare !== null || creat.user === null) {
    throw new Error(
      `Fixture: createUser(${email}) a eșuat: ${eroareCreare?.message ?? "fără user"}`,
    );
  }
  const userId = creat.user.id;

  await insereaza(admin, "organization_members", {
    organization_id: organizationId,
    user_id: userId,
    role: rol,
    status: "active",
    job_title: `Funcția ${rol}`,
  });

  const client = clientAnonim();
  const { data: sesiune, error: eroareLogin } = await client.auth.signInWithPassword({
    email,
    password: parola,
  });
  if (eroareLogin !== null || sesiune.session === null) {
    throw new Error(
      `Fixture: signInWithPassword(${email}) a eșuat: ${eroareLogin?.message ?? "fără sesiune"}`,
    );
  }
  return { rol, email, userId, organizationId, client };
}

async function creeazaOrganizatie(
  admin: SupabaseClient,
  eticheta: string,
  module: readonly [string, string],
  sufix: string,
  tabeleTenant: readonly string[],
): Promise<Organizatie> {
  const slug = `${eticheta}-${PREFIX_SLUG}-${sufix}`;
  const organizatie = await insereaza(admin, "organizations", {
    slug,
    name: `${eticheta.toUpperCase()} SRL`,
    cui: `${Math.floor(1e7 + Math.random() * 8.9e7)}`,
    status: "active",
    plan: "professional",
    seats_limit: 50,
    subscription_status: "active",
    activated_at: new Date().toISOString(),
  });
  const id = z.string().parse(organizatie["id"]);

  const actoriIntermediari = await Promise.all(
    ROLURI_TEST.map((rol) => creeazaActor(admin, id, rol, eticheta, sufix)),
  );
  const [admin0] = actoriIntermediari;
  if (admin0 === undefined) throw new Error("Fixture: niciun actor creat");
  const actori = Object.fromEntries(actoriIntermediari.map((a) => [a.rol, a])) as Record<
    RolTest,
    Actor
  >;

  const [modulPrincipal, modulSecundar] = module;
  const ctx: ContextSablon = {
    organizationId: id,
    userId: admin0.userId,
    featureKey: modulPrincipal,
    sufix: `${eticheta.slice(0, 3)}${sufix}`,
  };

  // Toate tabelele de tenant, mai puțin cele create deja explicit mai sus.
  for (const tabela of tabeleTenant) {
    if (tabela === "organizations" || tabela === "organization_members") continue;
    await insereaza(admin, tabela, sablonPentru(tabela).rand(ctx));
  }
  // Al doilea modul: organizațiile trebuie să difere și prin ce au activat.
  await insereaza(admin, "organization_features", {
    organization_id: id,
    feature_key: modulSecundar,
    enabled: true,
  });

  return { id, slug, nume: `${eticheta.toUpperCase()} SRL`, module, actori };
}

/** Acoperirea NU se presupune: se numără rândurile, per tabelă, per organizație. */
async function verificaAcoperirea(
  tabele: readonly string[],
  idAlfa: string,
  idBeta: string,
): Promise<void> {
  const bucati = tabele.map((t) => {
    const col = coloanaTenant(t);
    return `select '${t}'::text as tabela,
                   count(*) filter (where t.${col} = '${idAlfa}'::uuid)::int as alfa,
                   count(*) filter (where t.${col} = '${idBeta}'::uuid)::int as beta
            from public.${t} t`;
  });
  const randuri = await interogheazaSql(
    z.object({ tabela: z.string(), alfa: z.number(), beta: z.number() }),
    bucati.join(" union all "),
  );
  const goale = randuri.filter((r) => r.alfa === 0 || r.beta === 0);
  if (goale.length > 0) {
    const detalii = goale.map((r) => `  ${r.tabela}: alfa=${r.alfa}, beta=${r.beta}`).join("\n");
    throw new Error(
      "FIXTURE INCOMPLET — pe tabelele de mai jos lipsesc rânduri pentru una dintre organizații.\n" +
        `Fără ele, testul de scurgere trece FALS-POZITIV (nu are ce să scurgă):\n${detalii}`,
    );
  }
}

export async function pregatesteFixture(): Promise<Fixture> {
  const admin = clientAdmin();
  const sufix = hex().slice(0, 8);

  const obiecte = await discoverTables();
  const tabeleTenant = obiecte
    .filter(
      (o) =>
        o.fel === "tabela" &&
        o.schema === "public" &&
        esteTabelaTenant(o.nume, o.areOrganizationId),
    )
    .map((o) => o.nume);
  if (tabeleTenant.length === 0) {
    throw new Error(
      "Nicio tabelă cu organization_id descoperită — migrările nu s-au aplicat pe baza de test.",
    );
  }
  // Fail-fast, înainte de a scrie orice: fiecare tabelă descoperită are șablon?
  for (const tabela of tabeleTenant) sablonPentru(tabela);

  const alfa = await creeazaOrganizatie(
    admin,
    "alfa",
    ["attendance", "leave"],
    sufix,
    tabeleTenant,
  );
  const beta = await creeazaOrganizatie(admin, "beta", ["fleet", "inventory"], sufix, tabeleTenant);
  await verificaAcoperirea(tabeleTenant, alfa.id, beta.id);

  return { alfa, beta, anon: clientAnonim(), sufix, tabeleTenant };
}

/**
 * Curățare fizică (nu soft delete): fixture-ul trebuie să dispară complet, ca
 * rulările succesive să nu depindă de un reset între ele.
 */
export async function curataFixture(): Promise<void> {
  await executaSql(
    `delete from public.organizations where slug like '%-${PREFIX_SLUG}-%' or slug like 'intrus-%';
     delete from public.audit_logs where entity_type = 'rls_fixture';
     delete from public.email_log where template = 'rls_fixture';
     delete from auth.users where email like '%@${DOMENIU_TEST}';`,
  );
}
