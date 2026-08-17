// tests/rls/izolare.test.ts
/**
 * TESTUL DE IZOLARE ÎNTRE TENANȚI — cel mai important test din proiect.
 *
 * Este PARAMETRIZAT peste tabelele descoperite în catalog, nu peste o listă
 * scrisă de mână: o tabelă adăugată într-o migrare viitoare intră automat în
 * test, iar dacă îi lipsește șablonul de fixture, suita cade cu numele ei.
 *
 * Verifică, în ordine: (a) RLS activat · (b) FORCE RLS în afara listei albe ·
 * (c) citire cross-tenant · (d) INSERT cross-tenant · (e) UPDATE cross-tenant ·
 * (f) politici și privilegii de DELETE · (g) `security_invoker` pe view-uri ·
 * (h) `search_path = ''` pe funcțiile SECURITY DEFINER.
 *
 * Mediu: vezi antetul din tests/rls/setup/discover.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  discoverFunctiiDefiner,
  discoverTables,
  interogheazaSql,
  TABELE_FARA_FORCE_RLS,
  type ObiectDb,
} from "./setup/discover";
import {
  coloanaTenant,
  curataFixture,
  esteTabelaTenant,
  pregatesteFixture,
  sablonPentru,
  type Fixture,
} from "./setup/fixture";

/** Descoperirea rulează la încărcarea modulului: `it.each` are nevoie de date la
 *  colectare, nu la execuție. Este doar citire din catalog, deci e ieftină. */
const obiecte: readonly ObiectDb[] = await discoverTables();
const tabele = obiecte.filter((o) => o.fel === "tabela");
const viewuri = obiecte.filter((o) => o.fel !== "tabela");
const tabeleTenant = tabele.filter(
  (t) => t.schema === "public" && esteTabelaTenant(t.nume, t.areOrganizationId),
);

if (tabele.length < 10) {
  throw new Error(
    `Doar ${tabele.length} tabele descoperite — migrările nu s-au aplicat pe baza de test.`,
  );
}
if (tabeleTenant.length === 0) {
  throw new Error("Nicio tabelă de tenant descoperită — testul ar trece fals-pozitiv.");
}

/** Coduri acceptabile la refuz. Orice altceva ascunde un test care nu a testat
 *  nimic (ex. PGRST205 = cache PostgREST vechi ⇒ tabela nici nu a fost atinsă). */
const COD_REFUZ = "42501";

let fixture: Fixture | null = null;
const cerFixture = (): Fixture => {
  if (fixture === null) throw new Error("Fixture neinițializat");
  return fixture;
};

beforeAll(async () => {
  await curataFixture();
  fixture = await pregatesteFixture();
});

afterAll(async () => {
  await curataFixture();
});

describe("(a) RLS activat pe FIECARE tabelă", () => {
  it.each(tabele)("$schema.$nume are row level security", (t) => {
    expect(
      t.rlsActivat,
      `${t.schema}.${t.nume} NU are RLS activat. Corecție: alter table ${t.schema}.${t.nume} enable row level security;`,
    ).toBe(true);
  });

  it.each(tabele)("$schema.$nume are cel puțin o politică", (t) => {
    expect(
      t.politici.length,
      `${t.schema}.${t.nume} are RLS activat dar nicio politică — blochează totul, semn de migrare incompletă.`,
    ).toBeGreaterThan(0);
  });
});

describe("(b) FORCE RLS peste tot, minus lista albă comisă", () => {
  it.each(tabele)("$schema.$nume are FORCE RLS sau motiv scris", (t) => {
    if (t.rlsFortat) return;
    const motiv = TABELE_FARA_FORCE_RLS[t.nume];
    expect(
      motiv,
      `${t.schema}.${t.nume} nu are FORCE RLS și nu e în lista albă din discover.ts. ` +
        "Fie adaugi `force row level security`, fie o treci în listă CU MOTIVUL SCRIS.",
    ).toBeTypeOf("string");
  });

  it("lista albă nu conține intrări moarte", () => {
    const numeTabele = new Set(tabele.map((t) => t.nume));
    const moarte = Object.keys(TABELE_FARA_FORCE_RLS).filter((n) => !numeTabele.has(n));
    expect(
      moarte,
      `Intrări din lista albă fără tabelă corespondentă: ${moarte.join(", ")}`,
    ).toEqual([]);
  });
});

describe("(c) niciun rând al organizației B nu e vizibil din organizația A", () => {
  it.each(tabeleTenant)(
    "$nume — SELECT cross-tenant întoarce zero rânduri și count 0",
    async (t) => {
      const { alfa, beta } = cerFixture();
      const col = coloanaTenant(t.nume);
      const { data, error, count } = await alfa.actori.org_admin.client
        .from(t.nume)
        .select(col, { count: "exact" })
        .eq(col, beta.id);

      if (error !== null) {
        expect(
          error.code,
          `${t.nume}: eroare neașteptată la SELECT — ${error.code} ${error.message}`,
        ).toBe(COD_REFUZ);
        return;
      }
      expect(data ?? [], `SCURGERE: ${t.nume} a întors rânduri din organizația B`).toEqual([]);
      // `count` separat: un `data` gol cu `count > 0` ar însemna filtrare doar la paginare.
      expect(count ?? 0, `SCURGERE: ${t.nume} raportează count=${count} pentru organizația B`).toBe(
        0,
      );
    },
  );

  it.each(tabeleTenant)("$nume — SELECT nefiltrat nu conține rânduri străine", async (t) => {
    const { alfa, beta } = cerFixture();
    const col = coloanaTenant(t.nume);
    const { data, error } = await alfa.actori.employee.client.from(t.nume).select(col).limit(1000);
    if (error !== null) {
      expect(error.code, `${t.nume}: eroare neașteptată — ${error.code} ${error.message}`).toBe(
        COD_REFUZ,
      );
      return;
    }
    const straine = (data ?? []).filter(
      (r) => (r as unknown as Record<string, unknown>)[col] === beta.id,
    );
    expect(
      straine,
      `SCURGERE: ${t.nume} a întors ${straine.length} rânduri ale organizației B`,
    ).toEqual([]);
  });
});

describe("(d) INSERT cu organization_id-ul altei organizații este refuzat", () => {
  it.each(tabeleTenant)("$nume — INSERT cross-tenant dă 42501", async (t) => {
    const { alfa, beta, sufix } = cerFixture();
    const atacator = alfa.actori.org_admin;
    const col = coloanaTenant(t.nume);
    const rand = sablonPentru(t.nume).rand({
      organizationId: beta.id,
      userId: atacator.userId,
      featureKey: "payroll",
      sufix: `atac${sufix}`,
    });
    const { data, error } = await atacator.client
      .from(t.nume)
      .insert(rand as never)
      .select(col);

    expect(
      error,
      `BREȘĂ: INSERT în ${t.nume} cu ${col}=${beta.id} a REUȘIT din organizația A. ` +
        `Lipsește WITH CHECK. Rând inserat: ${JSON.stringify(data)}`,
    ).not.toBeNull();
    expect(
      error?.code,
      `${t.nume}: refuzul a venit cu ${error?.code} („${error?.message}"), nu cu 42501. ` +
        "Un refuz din UNIQUE/CHECK/FK înseamnă că politica RLS nici nu a fost evaluată.",
    ).toBe(COD_REFUZ);
  });
});

describe("(e) UPDATE pe rândurile altei organizații nu modifică nimic", () => {
  it.each(tabeleTenant)("$nume — UPDATE cross-tenant lasă datele neatinse", async (t) => {
    const { alfa, beta } = cerFixture();
    const col = coloanaTenant(t.nume);
    const patch = sablonPentru(t.nume).actualizare;
    const [cheie] = Object.keys(patch);
    if (cheie === undefined) throw new Error(`Șablonul ${t.nume} nu are patch de UPDATE`);
    const valoare = String(patch[cheie]);

    await alfa.actori.org_admin.client
      .from(t.nume)
      .update(patch as never)
      .eq(col, beta.id);

    // Verdictul îl dă baza, nu răspunsul API-ului: numărăm rândurile lui B care
    // au ajuns la valoarea injectată.
    const [rezultat] = await interogheazaSql(
      z.object({ n: z.number() }),
      `select count(*)::int as n from public.${t.nume} t
       where t.${col} = '${beta.id}'::uuid and (to_jsonb(t) ->> '${cheie}') = '${valoare}'`,
    );
    expect(
      rezultat?.n ?? -1,
      `BREȘĂ: UPDATE din organizația A a modificat ${rezultat?.n} rânduri ale organizației B în ${t.nume}.`,
    ).toBe(0);
  });
});

describe("(f) DELETE — nici politică, nici privilegiu", () => {
  it("nu există nicio politică DELETE (soft delete peste tot)", () => {
    const gasite = obiecte
      .flatMap((o) => o.politici)
      .filter((p) => p.comanda === "DELETE" || p.comanda === "ALL")
      .map((p) => `${p.schema}.${p.tabela}.${p.nume} (${p.comanda})`);
    expect(
      gasite,
      `Politici care deschid calea DELETE (ALL include DELETE): ${gasite.join(", ")}. ` +
        "Regula este soft delete + absența politicii, nu o politică permisivă.",
    ).toEqual([]);
  });

  it("DELETE este revocat de la authenticated și anon pe fiecare tabelă", () => {
    const cuDelete = tabele
      .filter((t) => t.deletePentruAuthenticated || t.deletePentruAnon)
      .map((t) => `${t.schema}.${t.nume}`);
    expect(
      cuDelete,
      `Tabele cu privilegiu DELETE acordat: ${cuDelete.join(", ")}. ` +
        "Corecție: revoke delete on ... from authenticated, anon;",
    ).toEqual([]);
  });
});

describe("(g) view-urile rulează cu drepturile apelantului", () => {
  it.each(viewuri)("$schema.$nume are security_invoker=true", (v) => {
    expect(
      v.fel,
      `${v.schema}.${v.nume} este MATERIALIZED VIEW: nu suportă security_invoker și nu poate purta politici. ` +
        "Interzis pe date multi-tenant.",
    ).toBe("view");
    expect(
      v.securityInvoker,
      `${v.schema}.${v.nume} rulează cu drepturile creatorului și ocolește RLS-ul tabelelor sursă. ` +
        `Corecție: alter view ${v.schema}.${v.nume} set (security_invoker = true);`,
    ).toBe(true);
  });
});

describe("(h) funcțiile SECURITY DEFINER au search_path gol", () => {
  it("nicio funcție fără SET search_path = ''", async () => {
    const functii = await discoverFunctiiDefiner();
    const vinovate = functii
      .filter((f) => f.search_path !== 'search_path=""')
      .map((f) => `${f.schema}.${f.nume}(${f.argumente}) → ${f.search_path ?? "(nesetat)"}`);
    expect(
      vinovate,
      `Funcții SECURITY DEFINER fără search_path = '': ${vinovate.join(" · ")}. ` +
        "`search_path = public` NU e sigur: pg_temp e căutat înaintea lui ⇒ escaladare de privilegii.",
    ).toEqual([]);
  });
});
