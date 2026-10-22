import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

/**
 * Auditul acțiunilor (`.claude/skills/administrativo/scripts/audit-actiuni.mjs`),
 * rulat pe un depozit minimal scris într-un dosar temporar (`--radacina`), ca să
 * nu depindă de starea depozitului.
 *
 * Până pe 22 oct 2026 auditul citea DOAR fișierele numite exact `actions.ts`.
 * Flota își scrisese acțiunile în zece fișiere `actions-*.ts`, iar revizuirea
 * automată a semnalat „authorization” exact într-unul dintre ele
 * (`flota/actions-amenzi.ts`): niciuna dintre regulile auditului nu ajungea acolo.
 */

const SCRIPT = join(process.cwd(), ".claude/skills/administrativo/scripts/audit-actiuni.mjs");

let dosare: string[] = [];

afterEach(() => {
  for (const d of dosare) rmSync(d, { recursive: true, force: true });
  dosare = [];
});

const ESLINT = `const eslintConfig = defineConfig([
  {
    name: "administrativo/securitate-exceptii",
    files: [
      "src/lib/supabase/admin.ts",
      "src/**/actions.ts",
      "src/app/(app)/reges/actiuni-api.ts",
      "src/app/api/**/route.ts",
    ],
    rules: { "no-restricted-imports": "off" },
  },
]);
`;

/** Un depozit minimal: ce citește auditul, plus fișierele testului (căi sub `src/`). */
function proiect(fisiere: Readonly<Record<string, string>>): string {
  const radacina = mkdtempSync(join(tmpdir(), "audit-actiuni-"));
  dosare.push(radacina);
  const toate: Record<string, string> = {
    "src/lib/actions/create-action.ts": "export function createAction() {}\n",
    "src/config/features.ts":
      'export const FEATURE_KEYS = [\n  "nucleu",\n  "fleet",\n  "maintenance",\n  "kpi",\n  "evaluations",\n] as const;\n',
    "src/config/porti-ruta.ts": [
      'p("/flota", "fleet", "vehicles:read"),',
      'p("/flota/amenzi", "fleet", "vehicle_fines:read", "all"),',
      'p("/evaluari", "evaluations", "evaluations:read"),',
      'p("/evaluari/kpi", "kpi", "kpi:read"),',
      "",
    ].join("\n"),
    "eslint.config.mjs": ESLINT,
  };
  for (const [cale, continut] of Object.entries(fisiere)) toate[`src/${cale}`] = continut;
  for (const [cale, continut] of Object.entries(toate)) {
    const tinta = join(radacina, cale);
    mkdirSync(dirname(tinta), { recursive: true });
    writeFileSync(tinta, continut);
  }
  return radacina;
}

interface Constatare {
  readonly nivel: "EROARE" | "AVERT";
  readonly regula: string;
  readonly unde: string;
}

function ruleaza(radacina: string): { cod: number | null; constatari: readonly Constatare[] } {
  const r = spawnSync(process.execPath, [SCRIPT, "--radacina", radacina, "--json"], {
    encoding: "utf8",
    // Sesiunile Claude Code exportă CLAUDE_PROJECT_DIR spre depozitul real: aici
    // se suprascrie, ca un script fără `--radacina` să nu auditeze altceva.
    env: { ...process.env, CLAUDE_PROJECT_DIR: radacina },
  });
  const json = JSON.parse(r.stdout) as { constatari: Constatare[] };
  return { cod: r.status, constatari: json.constatari };
}

const regula = (cs: readonly Constatare[], r: string): readonly Constatare[] =>
  cs.filter((c) => c.regula === r);

/** O acțiune cu tranziție de stadiu fără `.select()` după UPDATE (capcana 17). */
const TRANZITIE_FARA_SELECT = `"use server";
import { createAction } from "@/lib/actions/create-action";
export const stergeAmenda = createAction({
  name: "fleet.fine.delete",
  feature: "fleet",
  permission: "vehicle_fines:update",
  minScope: "all",
  handler: async (ctx, input) => {
    const { error } = await ctx.supabase
      .from("vehicle_fines")
      .update({ stadiu: "anulata" })
      .eq("id", input.id)
      .eq("organization_id", ctx.tenant.organizationId);
    if (error !== null) throw error;
  },
});
`;

describe("audit-actiuni — ce fișiere citește", () => {
  it("auditează și `actions-*.ts`, nu doar `actions.ts`", () => {
    const r = ruleaza(proiect({ "app/(app)/flota/actions-amenzi.ts": TRANZITIE_FARA_SELECT }));
    expect(r.cod).toBe(1);
    expect(regula(r.constatari, "A4")).toEqual([
      expect.objectContaining({
        nivel: "EROARE",
        unde: "src/app/(app)/flota/actions-amenzi.ts:11",
      }),
    ]);
  });

  it('auditează orice fișier cu `"use server"` la nivel de modul (`*-actions.ts`, `actiuni-*.ts`)', () => {
    const r = ruleaza(
      proiect({
        "app/(app)/angajati/[id]/avatar-actions.ts": TRANZITIE_FARA_SELECT,
        "app/(app)/reges/actiuni-api.ts": TRANZITIE_FARA_SELECT,
      }),
    );
    expect(regula(r.constatari, "A4").map((c) => c.unde)).toEqual([
      "src/app/(app)/angajati/[id]/avatar-actions.ts:11",
      "src/app/(app)/reges/actiuni-api.ts:11",
    ]);
  });

  it("nu citește testele și nici fișierele fără directivă care nu se numesc `actions.ts`", () => {
    const fara = TRANZITIE_FARA_SELECT.replace('"use server";\n', "");
    const r = ruleaza(
      proiect({
        "app/(app)/flota/actions-amenzi.test.ts": TRANZITIE_FARA_SELECT,
        "app/(app)/flota/ajutor.ts": fara,
      }),
    );
    expect(r.cod).toBe(0);
    expect(r.constatari).toEqual([]);
  });

  it("prinde scrierea dintr-o funcție ajutătoare, în afara lui `createAction({ … })`", () => {
    const r = ruleaza(
      proiect({
        "app/(app)/flota/actions-service.ts": `"use server";
async function inchide(ctx, id) {
  await ctx.supabase
    .from("vehicle_services")
    .update({ status: "finalizat" })
    .eq("id", id)
    .eq("organization_id", ctx.tenant.organizationId);
}
`,
      }),
    );
    expect(regula(r.constatari, "A4")).toEqual([
      expect.objectContaining({
        nivel: "EROARE",
        unde: "src/app/(app)/flota/actions-service.ts:5",
      }),
    ]);
  });
});

describe("audit-actiuni — A2: modulul se ia din porti-ruta.ts", () => {
  const FARA_FEATURE = `"use server";
export const x = createAction({
  name: "x",
  permission: "vehicles:update",
  minScope: "all",
  handler: async () => undefined,
});
`;

  it("o acțiune din `flota/` fără `feature:` primește avertisment pe `fleet`", () => {
    const r = ruleaza(proiect({ "app/(app)/flota/actions-tipuri.ts": FARA_FEATURE }));
    expect(regula(r.constatari, "A2")).toEqual([
      expect.objectContaining({ nivel: "AVERT", unde: "src/app/(app)/flota/actions-tipuri.ts:2" }),
    ]);
    expect(JSON.stringify(regula(r.constatari, "A2"))).toContain("fleet");
  });

  it("cel mai lung prefix câștigă: `evaluari/kpi/` e `kpi`, nu `evaluations`", () => {
    const r = ruleaza(proiect({ "app/(app)/evaluari/kpi/actions.ts": FARA_FEATURE }));
    expect(JSON.stringify(regula(r.constatari, "A2"))).toContain("„kpi”");
  });
});

describe("audit-actiuni — A6: clientul admin doar în `actions.ts`", () => {
  const CU_ADMIN = `"use server";
import { createAdminSupabase } from "@/lib/supabase/admin";
export async function f() { return createAdminSupabase(); }
`;

  it("`createAdminSupabase` într-un `actions-*.ts` = EROARE", () => {
    const r = ruleaza(proiect({ "app/(app)/flota/actions-amenzi.ts": CU_ADMIN }));
    expect(r.cod).toBe(1);
    expect(regula(r.constatari, "A6")).toEqual([
      expect.objectContaining({ nivel: "EROARE", unde: "src/app/(app)/flota/actions-amenzi.ts:2" }),
    ]);
  });

  it("în `actions.ts` și în calea enumerată în excepțiile ESLint: permis", () => {
    const r = ruleaza(
      proiect({
        "app/(app)/flota/actions.ts": CU_ADMIN,
        "app/(app)/reges/actiuni-api.ts": CU_ADMIN,
      }),
    );
    expect(regula(r.constatari, "A6")).toEqual([]);
  });

  // ESLint (`no-restricted-imports`) nu vede `import()`, iar un `eslint-disable`
  // îl tace și pe `import * as`: oglinda trebuie să le prindă pe amândouă.
  it("`import * as` și `import()` dinamic al modulului admin = EROARE", () => {
    const r = ruleaza(
      proiect({
        "app/(app)/flota/actions-amenzi.ts": `"use server";
import * as admin from "@/lib/supabase/admin";
export async function f() { return admin.createAdminSupabase(); }
`,
        "app/(app)/flota/actions-service.ts": `"use server";
export async function g() {
  const { createAdminSupabase } = await import("@/lib/supabase/admin");
  return createAdminSupabase();
}
`,
      }),
    );
    expect(r.cod).toBe(1);
    expect(regula(r.constatari, "A6").map((c) => c.unde)).toEqual([
      "src/app/(app)/flota/actions-amenzi.ts:2",
      "src/app/(app)/flota/actions-service.ts:3",
    ]);
  });

  it("`import type { AdminSupabase }` nu construiește nimic: permis", () => {
    const r = ruleaza(
      proiect({
        "app/(app)/flota/actions-amenzi.ts": `"use server";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { type AdminSupabase as A } from "@/lib/supabase/admin";
export async function f(db: AdminSupabase, d: A) { return [db, d]; }
`,
      }),
    );
    expect(regula(r.constatari, "A6")).toEqual([]);
  });
});

describe("audit-actiuni — A7: clientul admin cere filtru pe organizație", () => {
  const scriere = (filtru: string) => `"use server";
import { createAdminSupabase } from "@/lib/supabase/admin";
export const x = createAction({
  name: "x",
  feature: "fleet",
  permission: "vehicles:update",
  minScope: "all",
  handler: async (ctx, input) => {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("vehicles")
      .update({ nota: input.nota })
      .eq("id", input.id)${filtru}
      .select("id")
      .maybeSingle();
    return data;
  },
});
`;

  it("UPDATE pe service_role fără `organization_id`: EROARE", () => {
    const r = ruleaza(proiect({ "app/(app)/flota/actions.ts": scriere("") }));
    expect(r.cod).toBe(1);
    expect(regula(r.constatari, "A7")).toEqual([
      expect.objectContaining({ nivel: "EROARE", unde: "src/app/(app)/flota/actions.ts:12" }),
    ]);
  });

  it('cu `.eq("organization_id", …)`: curat', () => {
    const r = ruleaza(
      proiect({
        "app/(app)/flota/actions.ts": scriere(
          '\n      .eq("organization_id", ctx.tenant.organizationId)',
        ),
      }),
    );
    expect(r.constatari).toEqual([]);
  });

  // `organization_id` doar în DATELE scrise nu filtrează nimic: rândul oricărei
  // firme cu id-ul ăla primește valoarea. Contează doar un filtru pe coloană.
  it("`organization_id` doar în datele scrise, nu în filtru: tot EROARE", () => {
    const r = ruleaza(
      proiect({
        "app/(app)/flota/actions.ts": scriere("").replace(
          "{ nota: input.nota }",
          "{ nota: input.nota, organization_id: ctx.tenant.organizationId }",
        ),
      }),
    );
    expect(regula(r.constatari, "A7")).toEqual([
      expect.objectContaining({ nivel: "EROARE", unde: "src/app/(app)/flota/actions.ts:12" }),
    ]);
  });

  it('cu `.match({ organization_id: … })` sau `.in("organization_id", …)`: curat', () => {
    const r = ruleaza(
      proiect({
        "app/(app)/flota/actions.ts": scriere(
          "\n      .match({ organization_id: ctx.tenant.organizationId })",
        ),
        "app/(app)/flota/x/actions.ts": scriere(
          '\n      .in("organization_id", [ctx.tenant.organizationId])',
        ),
      }),
    );
    expect(regula(r.constatari, "A7")).toEqual([]);
  });

  it("clientul utilizatorului (sub RLS) nu intră sub A7", () => {
    const r = ruleaza(
      proiect({
        "app/(app)/flota/actions.ts": scriere("").replace("await admin", "await ctx.supabase"),
      }),
    );
    expect(regula(r.constatari, "A7")).toEqual([]);
  });
});
