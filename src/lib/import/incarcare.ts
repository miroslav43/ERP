// src/lib/import/incarcare.ts
//
// Registrul încărcărilor de import (`public.import_uploads`, 0226).
//
// ── DE CE ───────────────────────────────────────────────────────────────────
// Importurile (angajați, extrase de card) urcă fișierul în
// `{org}/{employees|vehicles}/{batchId}/…`, iar analiza îl ȘTERGE cu clientul de
// serviciu, fiindcă `storage.objects` n-are politică DELETE. `batchId` și calea
// veneau din client, verificate doar ca prefix al firmei. Segmentul 3 al unei
// căi `employees`/`vehicles` e însă, de obicei, id-ul unei FIȘE sau al unui
// VEHICUL: cu `batchId` = id-ul unui angajat, analiza ar fi șters, ocolind orice
// politică, contractul sau buletinul scanat al acelui angajat.
//
// Acum lotul e o chitanță emisă de SERVER: pregătirea scrie rândul (id-ul și
// calea le construiește serverul), iar analiza îl CONSUMĂ — o singură dată,
// doar cel care l-a creat, doar pe calea înregistrată — ÎNAINTE de ștergere.
// Consumul e un UPDATE condiționat cu `.select()`: zero rânduri înseamnă „nu e
// lotul tău / nu există / a fost deja folosit”, iar atunci nu se șterge nimic.
//
// Funcții libere, fără directivă: le importă două fișiere „use server”, care
// au voie să exporte doar funcții async (capcana 39).

import type { ActionContext } from "@/lib/actions/types";

export type ResursaIncarcare = "employees" | "vehicles";

/** Pregătirea: înregistrează lotul emis de server. `false` = refuzat (drept, formă). */
export async function inregistreazaIncarcarea(
  ctx: ActionContext,
  resursa: ResursaIncarcare,
  batchId: string,
  cale: string,
): Promise<boolean> {
  const { error } = await ctx.supabase.from("import_uploads").insert({
    id: batchId,
    organization_id: ctx.tenant.organizationId,
    resursa,
    cale,
    created_by: ctx.user.id,
    updated_by: ctx.user.id,
  });
  return error === null;
}

/**
 * Analiza: consumă lotul, atomic. `true` doar dacă rândul există în firma
 * sesiunii, pe resursa și pe calea date, l-a creat apelantul și n-a mai fost
 * consumat. Doar atunci fișierul se poate șterge cu clientul de serviciu.
 */
export async function consumaIncarcarea(
  ctx: ActionContext,
  resursa: ResursaIncarcare,
  batchId: string,
  cale: string,
): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from("import_uploads")
    .update({ consumat_la: ctx.now.toISOString(), updated_by: ctx.user.id })
    .eq("id", batchId)
    .eq("organization_id", ctx.tenant.organizationId)
    .eq("resursa", resursa)
    .eq("cale", cale)
    .eq("created_by", ctx.user.id)
    .is("consumat_la", null)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error !== null) throw error;
  return data !== null;
}

/** Aplicarea: lotul a fost emis de server, pentru apelant, și deja analizat. */
export async function incarcareAnalizata(
  ctx: ActionContext,
  resursa: ResursaIncarcare,
  batchId: string,
): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from("import_uploads")
    .select("id")
    .eq("id", batchId)
    .eq("organization_id", ctx.tenant.organizationId)
    .eq("resursa", resursa)
    .eq("created_by", ctx.user.id)
    .not("consumat_la", "is", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error !== null) throw error;
  return data !== null;
}
