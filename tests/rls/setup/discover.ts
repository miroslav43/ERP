// tests/rls/setup/discover.ts
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Descoperirea schemei DIRECT din catalogul Postgres.
 *
 * Testul de izolare nu are voie să se uite la ce credem noi că am scris în
 * migrări, ci la ce există efectiv în baza de date. De aceea totul aici se
 * citește din `pg_class`, `pg_policy`, `pg_proc` și `information_schema`.
 *
 * DE CE psql ȘI NU PostgREST: schema `app` este deliberat NEexpusă prin
 * PostgREST, iar `pg_catalog` / `information_schema` nu sunt expuse deloc. Fără
 * o conexiune Postgres directă, testul ar putea verifica doar ce se vede prin
 * API — adică exact partea despre care nu are nimeni dubii. `psql` este deja
 * dependența de bază a proiectului (CI-ul aplică migrările cu el, NOTES.md §1),
 * deci nu introducem nicio bibliotecă nouă.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABILE DE MEDIU (toate obligatorii; lipsa oricăreia oprește testele imediat)
 *
 *   TEST_SUPABASE_URL              https://<ref>.supabase.co — proiectul DEDICAT
 *                                  testelor. NICIODATĂ cel de dezvoltare/producție.
 *   TEST_SUPABASE_ANON_KEY         cheia publică; cu ea se construiesc clienții
 *                                  „atacatori", exact ca în browser.
 *   TEST_SUPABASE_SERVICE_ROLE_KEY ocolește RLS; folosită EXCLUSIV de fixture
 *                                  pentru a semăna date și a verifica rezultatul.
 *   TEST_SUPABASE_PROJECT_REF      ref-ul proiectului; verificat față de lista
 *                                  albă înainte de orice reset (vezi reset.ts).
 *   TEST_SUPABASE_DB_URL           conexiune Postgres directă către ACELAȘI
 *                                  proiect: postgresql://postgres:<parolă>@db.<ref>
 *                                  .supabase.co:5432/postgres?sslmode=require
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CUM RULEAZĂ ÎN CI (job separat, serializat — baza de test e partajată):
 *
 *   rls:
 *     name: Izolarea între tenanți
 *     runs-on: ubuntu-latest
 *     concurrency: { group: rls-test-project, cancel-in-progress: false }
 *     env:
 *       TEST_SUPABASE_URL:              ${{ secrets.TEST_SUPABASE_URL }}
 *       TEST_SUPABASE_ANON_KEY:         ${{ secrets.TEST_SUPABASE_ANON_KEY }}
 *       TEST_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_ROLE_KEY }}
 *       TEST_SUPABASE_PROJECT_REF:      ${{ secrets.TEST_SUPABASE_PROJECT_REF }}
 *       TEST_SUPABASE_DB_URL:           ${{ secrets.TEST_SUPABASE_DB_URL }}
 *     steps:
 *       - uses: actions/checkout@v4
 *       - uses: pnpm/action-setup@v4
 *       - uses: actions/setup-node@v4
 *         with: { node-version: "22", cache: pnpm }
 *       - run: pnpm install --frozen-lockfile
 *       - run: bash scripts/reset-test-db.sh
 *       - run: pnpm test:rls
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const executaProces = promisify(execFile);

/**
 * LISTA ALBĂ pentru `FORCE ROW LEVEL SECURITY`, cu motivul scris pentru fiecare
 * intrare. Ține sincron cu `scripts/checks/rls-enabled.sql` — verificarea e
 * dublă intenționat: bariera din CI rulează pe Postgres gol, testul de aici pe
 * proiectul Supabase real.
 *
 * Motivul comun: tabelele sunt citite de helperii `SECURITY DEFINER`. Cu FORCE,
 * helperul declanșează chiar politica ce îl apelează ⇒ recursiune infinită.
 */
export const TABELE_FARA_FORCE_RLS: Readonly<Record<string, string>> = {
  organization_members: "citită de app.is_member / app.current_org_ids — FORCE ⇒ recursiune",
  platform_admins: "citită de app.is_platform_admin — FORCE ⇒ recursiune",
  role_permissions: "citită de app.has_permission — FORCE ⇒ recursiune",
  features: "citită de app.feature_on — FORCE ⇒ recursiune",
};

export type MediuTest = Readonly<{
  url: string;
  anonKey: string;
  serviceKey: string;
  projectRef: string;
  dbUrl: string;
}>;

function cerVariabila(nume: string): string {
  const valoare = process.env[nume];
  if (valoare === undefined || valoare.trim() === "") {
    throw new Error(
      `Variabila de mediu ${nume} lipsește. Testele de izolare rulează exclusiv ` +
        "pe proiectul Supabase DEDICAT testelor; vezi antetul din tests/rls/setup/discover.ts.",
    );
  }
  return valoare;
}

let mediuMemoizat: MediuTest | null = null;

export function mediuTest(): MediuTest {
  if (mediuMemoizat !== null) return mediuMemoizat;
  mediuMemoizat = {
    url: cerVariabila("TEST_SUPABASE_URL"),
    anonKey: cerVariabila("TEST_SUPABASE_ANON_KEY"),
    serviceKey: cerVariabila("TEST_SUPABASE_SERVICE_ROLE_KEY"),
    projectRef: cerVariabila("TEST_SUPABASE_PROJECT_REF"),
    dbUrl: cerVariabila("TEST_SUPABASE_DB_URL"),
  };
  return mediuMemoizat;
}

function stderrDin(eroare: unknown): string {
  if (typeof eroare === "object" && eroare !== null && "stderr" in eroare) {
    const brut = (eroare as { stderr: unknown }).stderr;
    if (typeof brut === "string") return brut;
  }
  return eroare instanceof Error ? eroare.message : String(eroare);
}

async function ruleazaPsql(sqlText: string): Promise<string> {
  const { dbUrl } = mediuTest();
  try {
    const { stdout } = await executaProces(
      "psql",
      [dbUrl, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sqlText],
      {
        timeout: 60_000,
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, PGCONNECT_TIMEOUT: "15" },
      },
    );
    return stdout.trim();
  } catch (eroare: unknown) {
    throw new Error(`psql a eșuat.\nSQL: ${sqlText.slice(0, 400)}\n${stderrDin(eroare)}`);
  }
}

const faraPunctSiVirgula = (s: string): string => s.trim().replace(/;+$/, "");

/** Rulează o interogare ca proprietar al bazei și validează rezultatul cu Zod. */
export async function interogheazaSql<T>(
  schema: z.ZodType<T>,
  sqlText: string,
): Promise<readonly T[]> {
  const brut = await ruleazaPsql(
    `select coalesce(json_agg(t), '[]'::json)::text from (${faraPunctSiVirgula(sqlText)}) t`,
  );
  const rezultat = z.array(schema).safeParse(JSON.parse(brut === "" ? "[]" : brut));
  if (!rezultat.success) {
    throw new Error(`Răspuns SQL neașteptat:\n${z.prettifyError(rezultat.error)}`);
  }
  return rezultat.data;
}

/** DDL/DML de întreținere pentru fixture și curățare. Rulează ca proprietar. */
export async function executaSql(sqlText: string): Promise<void> {
  await ruleazaPsql(sqlText);
}

/**
 * Rulează o interogare SUB IDENTITATEA unui utilizator: `role authenticated` +
 * `request.jwt.claims`, exact ce pune PostgREST pe conexiune. Singura cale de a
 * apela helperii din schema `app`, care nu este expusă prin API.
 *
 * GUC-ul se setează ÎNAINTE de `set local role`, ca să nu depindem de dreptul
 * rolului `authenticated` de a-l scrie.
 */
export async function interogheazaCaUtilizator<T>(
  schema: z.ZodType<T>,
  userId: string,
  sqlText: string,
): Promise<readonly T[]> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" }).replace(/'/g, "''");
  const brut = await ruleazaPsql(
    `begin; set local request.jwt.claims = '${claims}'; set local role authenticated; ` +
      `select coalesce(json_agg(t), '[]'::json)::text from (${faraPunctSiVirgula(sqlText)}) t; commit;`,
  );
  const rezultat = z.array(schema).safeParse(JSON.parse(brut === "" ? "[]" : brut));
  if (!rezultat.success) {
    throw new Error(`Răspuns SQL neașteptat (ca utilizator):\n${z.prettifyError(rezultat.error)}`);
  }
  return rezultat.data;
}

export type Politica = Readonly<{
  schema: string;
  tabela: string;
  nume: string;
  comanda: string;
  roluri: readonly string[];
  qual: string | null;
  with_check: string | null;
}>;

export type FelObiect = "tabela" | "view" | "view_materializat";

export type ObiectDb = Readonly<{
  schema: string;
  nume: string;
  fel: FelObiect;
  rlsActivat: boolean;
  rlsFortat: boolean;
  areOrganizationId: boolean;
  securityInvoker: boolean;
  deletePentruAuthenticated: boolean;
  deletePentruAnon: boolean;
  politici: readonly Politica[];
}>;

export type FunctieDefiner = Readonly<{
  schema: string;
  nume: string;
  argumente: string;
  search_path: string | null;
}>;

const schemaObiect = z.object({
  schema: z.string(),
  nume: z.string(),
  fel: z.enum(["tabela", "view", "view_materializat"]),
  rls_activat: z.boolean(),
  rls_fortat: z.boolean(),
  are_organization_id: z.boolean(),
  security_invoker: z.boolean(),
  delete_authenticated: z.boolean(),
  delete_anon: z.boolean(),
});

const schemaPolitica = z.object({
  schema: z.string(),
  tabela: z.string(),
  nume: z.string(),
  comanda: z.string(),
  roluri: z.array(z.string()),
  qual: z.string().nullable(),
  with_check: z.string().nullable(),
});

const schemaFunctie = z.object({
  schema: z.string(),
  nume: z.string(),
  argumente: z.string(),
  search_path: z.string().nullable(),
});

/**
 * TOATE tabelele și view-urile din `public` și `app`, cu tot ce contează pentru
 * izolare: RLS, FORCE, politici pe comenzi, prezența lui `organization_id`,
 * `security_invoker` și dreptul de DELETE.
 */
export async function discoverTables(): Promise<readonly ObiectDb[]> {
  const [obiecte, politici] = await Promise.all([
    interogheazaSql(
      schemaObiect,
      `select n.nspname as schema,
              c.relname  as nume,
              case c.relkind when 'v' then 'view' when 'm' then 'view_materializat' else 'tabela' end as fel,
              c.relrowsecurity      as rls_activat,
              c.relforcerowsecurity as rls_fortat,
              exists (select 1 from pg_attribute a
                      where a.attrelid = c.oid and a.attname = 'organization_id'
                        and a.attnum > 0 and not a.attisdropped) as are_organization_id,
              coalesce((select true from unnest(coalesce(c.reloptions, '{}'::text[])) o
                        where o = 'security_invoker=true'), false) as security_invoker,
              case when c.relkind in ('r','p')
                   then has_table_privilege('authenticated', c.oid, 'DELETE') else false end as delete_authenticated,
              case when c.relkind in ('r','p')
                   then has_table_privilege('anon', c.oid, 'DELETE') else false end as delete_anon
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('public', 'app')
         and c.relkind in ('r', 'p', 'v', 'm')
         and left(c.relname, 3) <> 'pg_'
       order by n.nspname, c.relname`,
    ),
    interogheazaSql(
      schemaPolitica,
      `select schemaname as schema, tablename as tabela, policyname as nume,
              cmd as comanda, coalesce(roles::text[], '{}'::text[]) as roluri, qual, with_check
       from pg_policies
       where schemaname in ('public', 'app')`,
    ),
  ]);

  return obiecte.map((o) => ({
    schema: o.schema,
    nume: o.nume,
    fel: o.fel,
    rlsActivat: o.rls_activat,
    rlsFortat: o.rls_fortat,
    areOrganizationId: o.are_organization_id,
    securityInvoker: o.security_invoker,
    deletePentruAuthenticated: o.delete_authenticated,
    deletePentruAnon: o.delete_anon,
    politici: politici.filter((p) => p.schema === o.schema && p.tabela === o.nume),
  }));
}

/** Toate funcțiile SECURITY DEFINER din public/app/internal, cu `search_path`-ul lor. */
export function discoverFunctiiDefiner(): Promise<readonly FunctieDefiner[]> {
  return interogheazaSql(
    schemaFunctie,
    `select n.nspname as schema, p.proname as nume,
            pg_get_function_identity_arguments(p.oid) as argumente,
            (select c from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%') as search_path
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'app', 'internal') and p.prosecdef
     order by 1, 2`,
  );
}
