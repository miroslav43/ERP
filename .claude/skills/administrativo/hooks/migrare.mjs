#!/usr/bin/env node
// PreToolUse pe supabase/migrations/*.sql. Doar avertizează.
// Două variante: migrare EXISTENTĂ (forward-only) vs. migrare NOUĂ (schelet).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RADACINA = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
if (!existsSync(join(RADACINA, "supabase/migrations"))) process.exit(0);

let ev;
try {
  ev = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
const cale = ev?.tool_input?.file_path ?? "";
if (!/supabase\/migrations\/.*\.sql$/.test(cale)) process.exit(0);

const m = existsSync(cale)
  ? "MIGRARE EXISTENTĂ. Migrările sunt FORWARD-ONLY (NOTES.md §1): nu se editează una deja aplicată pe cloud — se scrie una nouă. Reamintiri: orice SECURITY DEFINER cere SET search_path = '' plus nume complet calificate; NICIO tabelă nu are politică DELETE (ștergerea e update deleted_at); `WITH CHECK` vede valoarea scrisă de triggerul BEFORE, nu ce a trimis clientul (capcana 6 — defectul a reapărut de două ori); indexurile unice sunt PARȚIALE (where deleted_at is null); granturile se dau per tabelă în bucla do $$, fiindcă `grant on all tables` dintr-o migrare veche NU acoperă tabelele create ulterior."
  : "MIGRARE NOUĂ. Scheletul canonic e supabase/migrations/0013_attendance.sql (16 secțiuni numerotate, în ordine). Obligatoriu: enable + force RLS; trio de politici _select/_insert/_update, NICIODATĂ o politică DELETE; `WITH CHECK` la INSERT pinuiește coloanele de stare inițială pe valorile lor implicite; SET search_path = '' pe orice SECURITY DEFINER; `(select app.current_org_ids())::uuid[]` ca SUBQUERY (InitPlan, o evaluare per instrucțiune); indexuri unice PARȚIALE `where deleted_at is null`; bucla do $$ pentru trg_<t>_actor + internal.attach_audit + revoke/grant per tabelă; coada REVOKE ALL ... FROM public, anon + GRANT EXECUTE ... TO authenticated pe fiecare funcție; secțiunea „Note de proiectare” la final. Verifică apoi cu banc-migrare.sh.";

process.stdout.write(
  JSON.stringify({
    systemMessage: m,
    hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: m },
  }),
);
