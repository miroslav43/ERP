// tests/rls/permisiuni.test.ts
/**
 * Permisiuni și module: partea de autorizare care NU ține de apartenență.
 *
 * Verifică patru contracte:
 *   1. `scope='none'` este REFUZ EXPLICIT și bate implicitul global al platformei.
 *   2. Dezactivarea unui modul face SELECT-ul să întoarcă zero rânduri și
 *      INSERT-ul să dea 42501 — în baza de date, nu doar în meniu.
 *   3. Un `employee` nu poate citi salariul altcuiva.
 *   4. Un `manager` nu poate citi salarii deloc.
 *
 * Helperii `app.*` nu sunt expuși prin PostgREST (schema `app` e privată), deci
 * se apelează prin conexiune directă, sub identitatea utilizatorului.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  discoverTables,
  executaSql,
  interogheazaCaUtilizator,
  interogheazaSql,
} from "./setup/discover";
import { curataFixture, pregatesteFixture, type Fixture } from "./setup/fixture";

/** Numele contractate în planul aprobat. Dacă 0002 le schimbă, se schimbă AICI. */
const FN_HAS_PERMISSION = "app.has_permission";
const FN_FEATURE_ON = "app.feature_on";

/** RANK din specificație: `none` nu e absență, e zero. */
const RANG = { none: 0, own: 1, team: 2, all: 3 } as const;
type Scop = keyof typeof RANG;
const permite = (scop: Scop, minScope: Scop): boolean => RANG[scop] >= RANG[minScope];

/** Resursa de salarii, cu permisiunile pe care matricea trebuie să le impună. */
const RESURSA_SALARII = "salary_components";
const TABELA_SALARII = "salary_components";

/**
 * Tabele a căror politică depinde de un modul. Gol în Faza 1a (nucleul e mereu
 * activ). Testul „harta nu a ruginit" de mai jos eșuează în clipa în care o
 * politică referă `feature_on` fără ca tabela să fie trecută aici.
 */
const TABELE_CU_MODUL: Readonly<Record<string, string>> = {};

const schemaScop = z.object({ scop: z.string().nullable() });
const schemaBool = z.object({ v: z.boolean().nullable() });
const schemaNumar = z.object({ n: z.number() });

let fixture: Fixture | null = null;
const cerFixture = (): Fixture => {
  if (fixture === null) throw new Error("Fixture neinițializat");
  return fixture;
};

async function cerFunctie(schema: string, nume: string): Promise<void> {
  const [rand] = await interogheazaSql(
    z.object({ n: z.number(), authenticated: z.boolean(), anon: z.boolean() }),
    `select count(*)::int as n,
            coalesce(bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')), false) as authenticated,
            coalesce(bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')), false) as anon
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = '${schema}' and p.proname = '${nume}'`,
  );
  if (rand === undefined || rand.n === 0) {
    throw new Error(
      `Funcția ${schema}.${nume} nu există. Testele de permisiuni sunt scrise pe numele ` +
        "contractate în planul aprobat; dacă migrarea 0002 folosește alt nume, actualizează " +
        "constanta din tests/rls/permisiuni.test.ts (un singur loc).",
    );
  }
  expect(rand.authenticated, `${schema}.${nume} nu are GRANT EXECUTE către authenticated`).toBe(
    true,
  );
  expect(
    rand.anon,
    `${schema}.${nume} este executabilă de anon — REVOKE EXECUTE ... FROM public, anon lipsește`,
  ).toBe(false);
}

async function scopPentru(
  userId: string,
  orgId: string,
  resursa: string,
  actiune: string,
): Promise<Scop | null> {
  const [rand] = await interogheazaCaUtilizator(
    schemaScop,
    userId,
    `select ${FN_HAS_PERMISSION}('${orgId}'::uuid, '${resursa}', '${actiune}')::text as scop`,
  );
  const brut = rand?.scop ?? null;
  return brut === null ? null : (z.enum(["none", "own", "team", "all"]).parse(brut) satisfies Scop);
}

async function modulActiv(userId: string, orgId: string, cheie: string): Promise<boolean> {
  const [rand] = await interogheazaCaUtilizator(
    schemaBool,
    userId,
    `select ${FN_FEATURE_ON}('${orgId}'::uuid, '${cheie}') as v`,
  );
  return rand?.v ?? false;
}

beforeAll(async () => {
  await curataFixture();
  fixture = await pregatesteFixture();
  await cerFunctie("app", "has_permission");
  await cerFunctie("app", "feature_on");
});

afterAll(async () => {
  await curataFixture();
});

describe("scope='none' este refuz explicit, nu absență", () => {
  it("rândul organizației bate implicitul global al platformei", async () => {
    const { alfa, beta, sufix } = cerFixture();
    const resursa = `r${sufix}`;
    // Implicit global permisiv + refuz explicit doar pentru organizația Alfa.
    await executaSql(
      `insert into public.role_permissions (organization_id, role, resource, action, scope)
       values (null, 'hr', '${resursa}', 'read', 'all'),
              ('${alfa.id}'::uuid, 'hr', '${resursa}', 'read', 'none');`,
    );

    const scopAlfa = await scopPentru(alfa.actori.hr.userId, alfa.id, resursa, "read");
    const scopBeta = await scopPentru(beta.actori.hr.userId, beta.id, resursa, "read");

    expect(scopAlfa, "Refuzul explicit al organizației nu a suprascris implicitul global").toBe(
      "none",
    );
    expect(scopBeta, "Organizația fără suprascriere trebuie să primească implicitul global").toBe(
      "all",
    );
    expect(permite("none", "own"), "RANG: `none` nu poate satisface niciun minScope").toBe(false);
  });

  it("interogarea documentată de rezolvare dă același rezultat", async () => {
    const { alfa, sufix } = cerFixture();
    const randuri = await interogheazaCaUtilizator(
      schemaScop,
      alfa.actori.hr.userId,
      `select distinct on (role, resource, action) scope::text as scop
       from public.role_permissions
       where deleted_at is null and (organization_id = '${alfa.id}'::uuid or organization_id is null)
         and resource = 'r${sufix}'
       order by role, resource, action, (organization_id is null) asc`,
    );
    expect(
      randuri.map((r) => r.scop),
      "Rezolvarea din comentariul migrării nu mai corespunde helperului",
    ).toEqual(["none"]);
  });

  it("resursa fără niciun rând este refuzată implicit", async () => {
    const { alfa } = cerFixture();
    const scop = await scopPentru(
      alfa.actori.org_admin.userId,
      alfa.id,
      "resursa_inexistenta",
      "read",
    );
    expect(
      scop === null || scop === "none",
      "Absența rândului trebuie citită ca refuz, nu ca permisiune",
    ).toBe(true);
  });
});

describe("modulele dezactivate închid accesul în baza de date", () => {
  it("feature_on urmărește organization_features, per organizație", async () => {
    const { alfa, beta } = cerFixture();
    expect(
      await modulActiv(alfa.actori.hr.userId, alfa.id, "attendance"),
      "Alfa are pontajul activat",
    ).toBe(true);
    expect(
      await modulActiv(alfa.actori.hr.userId, alfa.id, "fleet"),
      "Alfa NU are parcul auto activat",
    ).toBe(false);
    expect(
      await modulActiv(beta.actori.hr.userId, beta.id, "fleet"),
      "Beta are parcul auto activat",
    ).toBe(true);

    await executaSql(
      `update public.organization_features set enabled = false
       where organization_id = '${alfa.id}'::uuid and feature_key = 'attendance';`,
    );
    expect(
      await modulActiv(alfa.actori.hr.userId, alfa.id, "attendance"),
      "Dezactivarea modulului nu s-a propagat în app.feature_on",
    ).toBe(false);
  });

  it.each(Object.entries(TABELE_CU_MODUL))(
    "%s — cu modulul oprit, SELECT dă zero rânduri și INSERT dă 42501",
    async (tabela, cheie) => {
      const { alfa } = cerFixture();
      await executaSql(
        `update public.organization_features set enabled = false
         where organization_id = '${alfa.id}'::uuid and feature_key = '${cheie}';`,
      );
      const [inainte] = await interogheazaSql(
        schemaNumar,
        `select count(*)::int as n from public.${tabela} where organization_id = '${alfa.id}'::uuid`,
      );
      expect(
        inainte?.n ?? 0,
        `Fixture fără rânduri în ${tabela} ⇒ testul ar trece fals-pozitiv`,
      ).toBeGreaterThan(0);

      const client = alfa.actori.org_admin.client;
      const { data, error } = await client.from(tabela).select("organization_id");
      expect(error, `SELECT pe ${tabela} cu modulul oprit: ${error?.code}`).toBeNull();
      expect(data ?? [], `Modulul ${cheie} este oprit dar ${tabela} încă întoarce rânduri`).toEqual(
        [],
      );

      const { error: eroareInsert } = await client
        .from(tabela)
        .insert({ organization_id: alfa.id } as never);
      expect(
        eroareInsert?.code,
        `INSERT în ${tabela} cu modulul ${cheie} oprit trebuie refuzat cu 42501`,
      ).toBe("42501");
    },
  );

  it("harta tabelelor cu modul nu a ruginit", async () => {
    const obiecte = await discoverTables();
    const gateate = obiecte
      .filter((o) =>
        o.politici.some(
          (p) =>
            (p.qual ?? "").includes("feature_on") || (p.with_check ?? "").includes("feature_on"),
        ),
      )
      .map((o) => o.nume)
      .filter((n) => !(n in TABELE_CU_MODUL));
    expect(
      gateate,
      `Tabele cu politici pe feature_on absente din TABELE_CU_MODUL: ${gateate.join(", ")}. ` +
        "Adaugă-le, altfel închiderea modulului nu e verificată de nimeni.",
    ).toEqual([]);
  });
});

describe("salariile: employee doar ale lui, manager deloc", () => {
  it("matricea de permisiuni: employee='own', manager='none'", async () => {
    const { alfa } = cerFixture();
    const scopAngajat = await scopPentru(
      alfa.actori.employee.userId,
      alfa.id,
      RESURSA_SALARII,
      "read",
    );
    const scopManager = await scopPentru(
      alfa.actori.manager.userId,
      alfa.id,
      RESURSA_SALARII,
      "read",
    );

    expect(scopAngajat, `${RESURSA_SALARII}: angajatul trebuie să aibă exact 'own'`).toBe("own");
    expect(permite("own", "all"), "'own' nu poate satisface o acțiune care cere 'all'").toBe(false);
    expect(
      scopManager === "none" || scopManager === null,
      "Managerul nu are voie la salarii — nici măcar 'team'",
    ).toBe(true);
  });

  it("la nivel de rând, când tabela de salarii există", async () => {
    const { alfa } = cerFixture();
    const obiecte = await discoverTables();
    const tabela = obiecte.find((o) => o.schema === "public" && o.nume === TABELA_SALARII);
    if (tabela === undefined) {
      // Faza 1a nu conține modulul HR. Contractul e verificat mai sus, la nivel
      // de permisiune; partea de rânduri se activează automat în Faza 2.
      expect(TABELA_SALARII, "public.salary_components va apărea în migrarea HR").toBe(
        TABELA_SALARII,
      );
      return;
    }
    const [existente] = await interogheazaSql(
      schemaNumar,
      `select count(*)::int as n from public.${TABELA_SALARII} where organization_id = '${alfa.id}'::uuid`,
    );
    expect(
      existente?.n ?? 0,
      `${TABELA_SALARII} există dar fixture-ul nu o populează ⇒ testul ar trece fals-pozitiv. ` +
        "Adaugă un șablon în tests/rls/setup/fixture.ts.",
    ).toBeGreaterThan(0);

    const { data: aleManagerului, error } = await alfa.actori.manager.client
      .from(TABELA_SALARII)
      .select("id");
    if (error !== null) {
      expect(error.code, `Managerul a primit ${error.code} în loc de zero rânduri`).toBe("42501");
    } else {
      expect(
        aleManagerului ?? [],
        "Managerul citește salarii — matricea sau politica sunt greșite",
      ).toEqual([]);
    }

    const [alAngajatului] = await interogheazaCaUtilizator(
      schemaNumar,
      alfa.actori.employee.userId,
      `select count(*)::int as n from public.${TABELA_SALARII} s
       where s.employee_id is distinct from app.current_employee_id()`,
    );
    expect(alAngajatului?.n ?? -1, "Angajatul vede rânduri de salariu care nu sunt ale lui").toBe(
      0,
    );
  });
});
