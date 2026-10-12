// src/lib/actions/public-action.ts
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
// Harta globală a mesajelor Zod în română (vezi `src/schemas/mesaje-zod.ts`).
import "@/schemas/mesaje-zod";
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
 * validarea, apoi limitarea de rată — plus regula de aur: pe calea publică NU se
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

    // ── 1. VALIDARE ───────────────────────────────────────────────────────
    // ÎNAINTEA contorului de rată, nu după — ordinea a fost inversă până pe 12
    // oct 2026 (ONB-001), cu argumentul „un flood nu trebuie să ne coste nici
    // măcar parsarea”. Argumentul era invers:
    //
    //   · Limita există ca frână în fața căii SCUMPE — `inregistreaza_organizatie`
    //     + e-mail, respectiv `submit_demo_request`. Fiecare cerere care ajunge
    //     la handler consumă în continuare exact un slot, iar 0145 a scos
    //     contorul din funcția din bază, deci poarta asta rămâne singura și
    //     rămâne în fața handler-ului. Nimic nu s-a slăbit.
    //   · Ce se pierde e doar NUMĂRAREA cererilor malformate — care nu ating
    //     nici baza, nici e-mailul. Costul uneia pentru noi scade: înainte,
    //     `readRequestMeta` + un RPC care SCRIE un rând în `rate_limits`; acum,
    //     o parsare Zod în proces, fără I/O, peste ≤7 șiruri cu `.max()` de
    //     32–254 de caractere, pe un corp oricum plafonat de Next
    //     (`serverActions.bodySizeLimit`). Parsarea unui obiect mic nu e o gaură
    //     anti-flood: e mai ieftină decât contorul pe care îl ocolește.
    //   · Validarea e pură peste intrare: nu citește baza și nu dezvăluie stare
    //     (unicitatea CUI-ului se verifică în handler, DUPĂ limită), iar schema
    //     e oricum livrată browserului, care o rulează primul.
    //
    // Ce cumpără ordinea asta: un om care greșește de trei ori cifra de control
    // a CUI-ului nu mai e blocat o oră — împreună cu colegii din spatele
    // aceluiași NAT — pentru niște cereri care n-au costat nimic.
    const parsed = def.input.safeParse(rawInput);
    if (!parsed.success) {
      // `flattenError` peste o schemă generică întoarce valori lărgite; le
      // îngustăm o singură dată, aici, în loc să presărăm `as` prin cod.
      // Formularul de înregistrare repetă aceleași linii pe client
      // (`inregistrare/schema.ts`, `eroriPeCamp`), ca mesajele să fie identice.
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

    // ── 2. LIMITARE DE RATĂ ───────────────────────────────────────────────
    // `consume_rate_limit` e restricționată la `service_role` (0002_authz.sql) —
    // clientul anon al vizitatorului nu are GRANT pe ea, deci contorul trece
    // obligatoriu prin `consumeRateLimit()`, nu prin `supabase.rpc(...)` direct.
    // Contorul eșuează DESCHIS (`rate-limit.ts`): dacă baza nu răspunde, cererea
    // trece — nici înainte nu era o garanție absolută, ci o frână pe calea
    // scumpă, și exact acolo rămâne.
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
