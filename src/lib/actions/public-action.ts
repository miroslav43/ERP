// src/lib/actions/public-action.ts
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { readRequestMeta, type RequestMeta } from "./audit";
import { ActionDenied, isPostgrestError, mapPostgrestError } from "./errors";
import type { ActionError, ActionResult } from "./types";

const esec = (error: ActionError): ActionResult<never> => ({ ok: false, error });

export type PublicActionContext = Readonly<{
  /** Client anon, fără sesiune. Scrierile trec prin funcții SECURITY DEFINER. */
  supabase: ServerSupabase;
  meta: RequestMeta;
  requestId: string;
  now: Date;
}>;

export type PublicActionDefinition<TSchema extends z.ZodType, TData> = Readonly<{
  name: string;
  input: TSchema;
  /** Fereastră glisantă, contorizată în Postgres. */
  rateLimit: Readonly<{ max: number; windowSeconds: number }>;
  handler: (ctx: PublicActionContext, input: z.output<TSchema>) => Promise<TData>;
}>;

/**
 * Varianta fără tenant, pentru formularele publice („Cere demo").
 *
 * Diferențele față de `createAction` nu sunt scutiri, ci consecințe: nu există
 * utilizator, deci nici organizație, modul sau permisiune. Rămân două straturi —
 * limitarea de rată și validarea — plus regula de aur: pe calea publică NU se
 * folosește niciodată `service_role`. Scrierea se face printr-o funcție
 * SECURITY DEFINER apelabilă de rolul `anon`, care își scrie singură rândul de
 * audit (`anon` nu are INSERT pe `audit_logs`).
 *
 * Contorul stă în tabela `rate_limits`, nu în memorie: runtime-ul serverless are
 * N instanțe, iar un contor în proces nu limitează nimic.
 */
export function createPublicAction<TSchema extends z.ZodType, TData>(
  def: PublicActionDefinition<TSchema, TData>,
): (rawInput: unknown) => Promise<ActionResult<TData>> {
  return async (rawInput: unknown): Promise<ActionResult<TData>> => {
    const requestId = randomUUID();
    const meta = await readRequestMeta();
    const supabase = await createServerSupabase();

    // ── 1. LIMITARE DE RATĂ ───────────────────────────────────────────────
    // Înaintea validării: un flood nu trebuie să ne coste nici măcar parsarea.
    // `consume_rate_limit` e restricționată la `service_role` (0002_authz.sql) —
    // clientul anon al vizitatorului nu are GRANT pe ea, deci contorul trece
    // obligatoriu prin `consumeRateLimit()`, nu prin `supabase.rpc(...)` direct.
    const cheie = `${def.name}:${meta.ip ?? "necunoscut"}`;
    const { allowed: permis } = await consumeRateLimit({
      key: cheie,
      limit: def.rateLimit.max,
      windowSeconds: def.rateLimit.windowSeconds,
    });

    if (permis !== true) {
      // Rândul `rate_limited` din audit e scris de funcția SECURITY DEFINER.
      return esec({
        code: "LIMITA_DEPASITA",
        message: "Ați trimis prea multe cereri. Reîncercați peste câteva minute.",
        fieldErrors: null,
        requestId,
      });
    }

    // ── 2. VALIDARE ───────────────────────────────────────────────────────
    const parsed = def.input.safeParse(rawInput);
    if (!parsed.success) {
      // `flattenError` peste o schemă generică întoarce valori lărgite; le
      // îngustăm o singură dată, aici, în loc să presărăm `as` prin cod.
      const flat = z.flattenError(parsed.error) as {
        formErrors: readonly string[];
        fieldErrors: Record<string, readonly string[] | undefined>;
      };
      const fieldErrors: Record<string, readonly string[]> = {};
      for (const [camp, mesaje] of Object.entries(flat.fieldErrors)) {
        if (mesaje !== undefined && mesaje.length > 0) fieldErrors[camp] = mesaje;
      }
      return esec({
        code: "VALIDARE",
        message: flat.formErrors[0] ?? "Datele introduse nu sunt valide.",
        fieldErrors,
        requestId,
      });
    }

    // ── 3. EXECUȚIE ───────────────────────────────────────────────────────
    try {
      const data = await def.handler(
        { supabase, meta, requestId, now: new Date() },
        parsed.data as z.output<TSchema>,
      );
      return { ok: true, data };
    } catch (err: unknown) {
      if (err instanceof ActionDenied) {
        return esec({
          code: err.code,
          message: err.message,
          fieldErrors: err.fieldErrors,
          requestId,
        });
      }
      if (isPostgrestError(err)) {
        console.warn("[public] respins de bază", { name: def.name, requestId, pg: err.code });
        return esec(mapPostgrestError(err, requestId));
      }
      console.error("[public] eroare internă", { name: def.name, requestId }, err);
      return esec({
        code: "EROARE_INTERNA",
        message: `A apărut o eroare neașteptată. Cod de referință: ${requestId}`,
        fieldErrors: null,
        requestId,
      });
    }
  };
}
