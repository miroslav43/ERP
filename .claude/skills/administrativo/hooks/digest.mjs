#!/usr/bin/env node
// SessionStart: injectează digest.md în contextul modelului.
// Tace complet dacă nu suntem în repo-ul Administrativo — plugin-ul poate fi
// activat la nivel de cont, iar convențiile ERP n-au ce căuta în alt proiect.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RADACINA = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!existsSync(join(RADACINA, "supabase/migrations/0002_authz.sql"))) process.exit(0);

const aici = dirname(fileURLToPath(import.meta.url));
const f = join(aici, "digest.md");
if (!existsSync(f)) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: readFileSync(f, "utf8"),
    },
  }),
);
