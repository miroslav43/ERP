// src/lib/actions/create-action.ts
import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RANK } from "@/config/permissions";
import { getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { readRequestMeta, redactPayload, writeAuditLog } from "./audit";
import { ActionDenied, isPostgrestError, mapPostgrestError } from "./errors";
import type {
  ActionContext,
  ActionDefinition,
  ActionError,
  ActionErrorCode,
  ActionResult,
  AuditStatus,
} from "./types";

const esec = (error: ActionError): ActionResult<never> => ({ ok: false, error });

/**
 * Refuz de autorizare ⇒ `denied`. Eșec de execuție ⇒ `failure`. Distincția
 * contează la citirea jurnalului: `denied` repetat înseamnă cineva care încearcă
 * ce nu are voie; `failure` repetat înseamnă că e stricat ceva la noi.
 */
const STATUS_AUDIT: Readonly<Record<ActionErrorCode, AuditStatus>> = {
  NEAUTENTIFICAT: "denied",
  FARA_ORGANIZATIE: "denied",
  MODUL_DEZACTIVAT: "denied",
  INTERZIS: "denied",
  VALIDARE: "denied",
  LIMITA_DEPASITA: "denied",
  CONFLICT: "failure",
  NEGASIT: "failure",
  EROARE_INTERNA: "failure",
};

/**
 * `redirect()` și `notFound()` din Next semnalizează prin excepție cu `digest`.
 * Fără această verificare, un handler care redirecționează ar fi raportat ca
 * eroare internă, iar navigarea nu s-ar mai produce.
 */
function esteControlNext(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("digest" in err)) return false;
  const digest = (err as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest === "NEXT_NOT_FOUND" ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}

/**
 * Wrapperul obligatoriu al oricărei Server Action cu tenant. Opt straturi, în
 * ordine fixă:
 *
 *   1. autentificare
 *   2. organizația activă, rezolvată SERVER-SIDE (clientul nu o trimite)
 *   3. modulul activ pentru organizație
 *   4. permisiunea, cu prag de scope
 *   5. validarea Zod
 *   6. execuția
 *   7. auditul (success / denied / failure)
 *   8. revalidarea rutelor
 *
 * Validarea vine DUPĂ autorizare intenționat: unui apelant fără drept nu i se
 * spune ce câmpuri așteaptă acțiunea.
 *
 * Un layout nu protejează o Server Action — de aceea `resolveTenant()` se
 * apelează aici din nou, independent de `(app)/layout.tsx`. `React.cache()` face
 * ca al doilea apel din același request să nu coste încă un query.
 */
export function createAction<TSchema extends z.ZodType, TData>(
  def: ActionDefinition<TSchema, TData>,
): (rawInput: unknown) => Promise<ActionResult<TData>> {
  return async (rawInput: unknown): Promise<ActionResult<TData>> => {
    const requestId = randomUUID();
    const meta = await readRequestMeta();

    // ── 1. AUTENTIFICARE ──────────────────────────────────────────────────
    const resolution = await resolveTenant();
    if (resolution.status === "neautentificat") {
      // `log_audit_event` are GRANT doar către `authenticated`; fără sesiune nu
      // există apelant care să scrie rândul. Refuzul rămâne în log-ul serverului.
      console.warn("[action] refuz fără sesiune", { name: def.name, requestId, ip: meta.ip });
      return esec({
        code: "NEAUTENTIFICAT",
        message: "Sesiunea a expirat. Autentificați-vă din nou.",
        fieldErrors: null,
        requestId,
      });
    }

    const supabase = await createServerSupabase();
    const user = resolution.user;

    const refuza = async (
      code: ActionErrorCode,
      message: string,
      organizationId: string | null,
      fieldErrors: Readonly<Record<string, readonly string[]>> | null = null,
    ): Promise<ActionResult<never>> => {
      await writeAuditLog(supabase, {
        organizationId,
        action: def.audit.action,
        status: STATUS_AUDIT[code],
        entityType: def.audit.entityType,
        entityId: null,
        before: null,
        after: redactPayload(rawInput, def.audit.allow),
        errorCode: code,
        requestId,
        meta,
      });
      return esec({ code, message, fieldErrors, requestId });
    };

    // ── 2. ORGANIZAȚIA ACTIVĂ ─────────────────────────────────────────────
    if (resolution.status !== "ok") {
      return refuza(
        "FARA_ORGANIZATIE",
        "Selectați o organizație activă înainte de a continua.",
        null,
      );
    }
    const tenant = resolution.tenant;

    // ── 3. MODULUL ACTIV (verificat pe server, nu doar ascuns în meniu) ───
    const features = await getEnabledFeatures(tenant.organizationId);
    if (def.feature !== undefined && !features.has(def.feature)) {
      return refuza(
        "MODUL_DEZACTIVAT",
        "Modulul necesar acestei operațiuni nu este activ pentru organizația dvs.",
        tenant.organizationId,
      );
    }

    // ── 4. PERMISIUNEA ────────────────────────────────────────────────────
    // Absența cheii se tratează ca `none`: refuz. `none` explicit din
    // role_permissions bate implicitul global al platformei.
    const permissions = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
    const scope = permissions.get(def.permission) ?? "none";
    if (RANK[scope] < RANK[def.minScope]) {
      return refuza(
        "INTERZIS",
        "Nu aveți permisiunea necesară pentru această acțiune.",
        tenant.organizationId,
      );
    }

    // ── 5. VALIDAREA ──────────────────────────────────────────────────────
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
      return refuza(
        "VALIDARE",
        flat.formErrors[0] ?? "Datele introduse nu sunt valide.",
        tenant.organizationId,
        fieldErrors,
      );
    }
    const input = parsed.data as z.output<TSchema>;
    const ctx: ActionContext = {
      supabase,
      user,
      tenant,
      scope,
      features,
      requestId,
      now: new Date(),
    };

    // ── 6. EXECUȚIA ───────────────────────────────────────────────────────
    let data: TData;
    try {
      data = await def.handler(ctx, input);
    } catch (err: unknown) {
      if (esteControlNext(err)) throw err;

      const error: ActionError =
        err instanceof ActionDenied
          ? { code: err.code, message: err.message, fieldErrors: err.fieldErrors, requestId }
          : isPostgrestError(err)
            ? mapPostgrestError(err, requestId)
            : {
                code: "EROARE_INTERNA",
                message: `A apărut o eroare neașteptată. Cod de referință: ${requestId}`,
                fieldErrors: null,
                requestId,
              };

      // Stiva și mesajul brut rămân pe server. Clientul primește doar requestId.
      if (error.code === "EROARE_INTERNA") {
        console.error("[action] eroare internă", { name: def.name, requestId }, err);
      } else if (isPostgrestError(err)) {
        console.warn("[action] respins de bază", {
          name: def.name,
          requestId,
          pg: err.code,
          detaliu: err.message,
        });
      }

      await writeAuditLog(supabase, {
        organizationId: tenant.organizationId,
        action: def.audit.action,
        status: STATUS_AUDIT[error.code],
        entityType: def.audit.entityType,
        entityId: null,
        before: null,
        after: redactPayload(input, def.audit.allow),
        errorCode: error.code,
        requestId,
        meta,
      });
      return esec(error);
    }

    // ── 7. AUDITUL DE SUCCES ──────────────────────────────────────────────
    await writeAuditLog(supabase, {
      organizationId: tenant.organizationId,
      action: def.audit.action,
      status: "success",
      entityType: def.audit.entityType,
      entityId: def.audit.entityId?.(input, data) ?? null,
      before: null,
      after: redactPayload(input, def.audit.allow),
      errorCode: null,
      requestId,
      meta,
    });

    // ── 8. REVALIDAREA ────────────────────────────────────────────────────
    const cai =
      typeof def.revalidate === "function" ? def.revalidate(input, data) : (def.revalidate ?? []);
    for (const cale of cai) revalidatePath(cale);

    return { ok: true, data };
  };
}
