#!/usr/bin/env node
/**
 * Generează `src/types/database.ts` prin introspecția unei baze Postgres.
 *
 * De ce nu `supabase gen types --db-url`: acela pornește un container Docker, pe
 * care nu îl folosim. Varianta `--linked` merge prin API-ul Supabase, fără
 * Docker, și rămâne calea preferată odată ce proiectul este conectat
 * (`pnpm db:types`). Scriptul de față acoperă intervalul până atunci și rămâne
 * util pentru a genera tipurile din schema locală, înainte ca migrarea să
 * ajungă în cloud.
 *
 * Folosire:
 *   node scripts/gen-types.mjs "postgresql://user@localhost:5433/adm_v" > src/types/database.ts
 */

import { execFileSync } from "node:child_process";

const dbUrl = process.argv[2];
if (!dbUrl) {
  console.error("Folosire: node scripts/gen-types.mjs <postgres-url>");
  process.exit(1);
}

const psql = process.env.PSQL ?? "psql";

/** Rulează o interogare și întoarce rezultatul ca JSON. */
function query(sql) {
  const out = execFileSync(
    psql,
    [dbUrl, "-tAc", `select coalesce(json_agg(t), '[]') from (${sql}) t`],
    {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  return JSON.parse(out.trim());
}

/** Tipurile Postgres → TypeScript. Necunoscutele devin `unknown`, nu `any`. */
const SCALARE = {
  bool: "boolean",
  int2: "number",
  int4: "number",
  int8: "number",
  float4: "number",
  float8: "number",
  numeric: "number",
  text: "string",
  varchar: "string",
  bpchar: "string",
  citext: "string",
  uuid: "string",
  date: "string",
  timestamp: "string",
  timestamptz: "string",
  time: "string",
  timetz: "string",
  interval: "string",
  inet: "string",
  cidr: "string",
  macaddr: "string",
  json: "Json",
  jsonb: "Json",
  bytea: "string",
  void: "undefined",
  record: "unknown",
};

const enums = query(`
  select t.typname as name,
         array_agg(e.enumlabel order by e.enumsortorder) as valori
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
  order by t.typname
`);

const enumNames = new Set(enums.map((e) => e.name));

function tsType(udt, notNull) {
  let baza;
  if (udt.startsWith("_")) {
    const inner = udt.slice(1);
    baza = `${tsBase(inner)}[]`;
  } else {
    baza = tsBase(udt);
  }
  return notNull ? baza : `${baza} | null`;
}

function tsBase(udt) {
  if (enumNames.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
  return SCALARE[udt] ?? "unknown";
}

const coloane = query(`
  select c.relname as tabela,
         a.attname as coloana,
         format_type(a.atttypid, null) as tip_afisat,
         t.typname as udt,
         a.attnotnull as not_null,
         (pg_get_expr(d.adbin, d.adrelid) is not null) as are_default,
         a.attidentity <> '' as e_identity,
         a.attgenerated <> '' as e_generat
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  join pg_type t on t.oid = a.atttypid
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind in ('r','v')
  order by c.relname, a.attnum
`);

// Funcțiile care aparțin unei EXTENSII sunt excluse deliberat: instalarea unei
// extensii în `public` ar adăuga zeci de intrări străine în tipurile noastre și
// le-ar face să difere între medii, după cum e sau nu instalată extensia acolo.
// `pg_depend` cu deptype 'e' este legătura care marchează apartenența.
const functii = query(`
  select p.proname as nume,
         pg_get_function_arguments(p.oid) as argumente,
         t.typname as tip_retur,
         p.proretset as returneaza_set
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type t on t.oid = p.prorettype
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (
      select 1 from pg_depend d
      where d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e'
    )
  order by p.proname
`);

const peTabela = new Map();
for (const c of coloane) {
  if (!peTabela.has(c.tabela)) peTabela.set(c.tabela, []);
  peTabela.get(c.tabela).push(c);
}

const linii = [];
linii.push("// GENERAT AUTOMAT — nu edita manual.");
linii.push("//");
linii.push("// Regenerare din schema locală:");
linii.push(
  '//   node scripts/gen-types.mjs "postgresql://$USER@localhost:5433/adm_v" > src/types/database.ts',
);
linii.push("//");
linii.push("// Odată ce proiectul Supabase este conectat, calea preferată devine:");
linii.push("//   pnpm db:types");
linii.push("");
linii.push(
  "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];",
);
linii.push("");
linii.push("export type Database = {");
linii.push("  public: {");

// ── Tables ──
linii.push("    Tables: {");
for (const [tabela, cols] of [...peTabela.entries()].sort()) {
  linii.push(`      ${tabela}: {`);
  linii.push("        Row: {");
  for (const c of cols) linii.push(`          ${c.coloana}: ${tsType(c.udt, c.not_null)};`);
  linii.push("        };");
  linii.push("        Insert: {");
  for (const c of cols) {
    const optional = !c.not_null || c.are_default || c.e_identity || c.e_generat;
    if (c.e_generat) continue; // coloanele GENERATED nu se pot scrie
    linii.push(`          ${c.coloana}${optional ? "?" : ""}: ${tsType(c.udt, c.not_null)};`);
  }
  linii.push("        };");
  linii.push("        Update: {");
  for (const c of cols) {
    if (c.e_generat) continue;
    linii.push(`          ${c.coloana}?: ${tsType(c.udt, c.not_null)};`);
  }
  linii.push("        };");
  linii.push("        Relationships: [];");
  linii.push("      };");
}
linii.push("    };");

linii.push("    Views: {");
linii.push("      [_ in never]: never;");
linii.push("    };");

// ── Functions ──
linii.push("    Functions: {");
for (const f of functii) {
  const args = String(f.argumente ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      // "p_key text DEFAULT NULL::text" → { nume, udt, optional }
      const fdefault = / default /i.test(decl);
      const curat = decl.replace(/ default .*/i, "").trim();
      const parti = curat.split(/\s+/);
      const nume = parti.shift() ?? "";
      const tipSql = parti.join(" ");
      return { nume, tipSql, optional: fdefault };
    })
    .filter((a) => a.nume.length > 0 && !/^(out|inout|variadic)$/i.test(a.nume));

  linii.push(`      ${f.nume}: {`);
  if (args.length === 0) {
    linii.push("        Args: Record<PropertyKey, never>;");
  } else {
    linii.push("        Args: {");
    for (const a of args) {
      const udt =
        a.tipSql
          .replace(/\[\]$/, "")
          .replace(/^public\./, "")
          .split(/\s+/)[0] ?? "text";
      const arr = a.tipSql.endsWith("[]");
      const base = enumNames.has(udt)
        ? `Database["public"]["Enums"]["${udt}"]`
        : (SCALARE[udt] ?? "unknown");
      const tip = arr ? `${base}[]` : base;
      // Un parametru cu DEFAULT poate primi explicit `null` — Postgres îl acceptă,
      // iar apelanții chiar trimit `null` pentru câmpurile absente. Fără `| null`,
      // `exactOptionalPropertyTypes` respinge exact apelul corect.
      linii.push(
        `          ${a.nume}${a.optional ? "?" : ""}: ${tip}${a.optional ? " | null" : ""};`,
      );
    }
    linii.push("        };");
  }
  const retur = tsBase(f.tip_retur);
  linii.push(`        Returns: ${f.returneaza_set ? `${retur}[]` : retur};`);
  linii.push("      };");
}
linii.push("    };");

// ── Enums ──
linii.push("    Enums: {");
for (const e of enums) {
  linii.push(`      ${e.name}: ${e.valori.map((v) => JSON.stringify(v)).join(" | ")};`);
}
linii.push("    };");

linii.push("    CompositeTypes: {");
linii.push("      [_ in never]: never;");
linii.push("    };");
linii.push("  };");
linii.push("};");
linii.push("");
linii.push('export type Tables<T extends keyof Database["public"]["Tables"]> =');
linii.push('  Database["public"]["Tables"][T]["Row"];');
linii.push('export type Enums<T extends keyof Database["public"]["Enums"]> =');
linii.push('  Database["public"]["Enums"][T];');
linii.push("");

process.stdout.write(linii.join("\n"));
