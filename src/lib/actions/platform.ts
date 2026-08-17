// src/lib/actions/platform.ts
// Super-adminul NU este membru al vreunei organizații, deci nu are `tenant`, iar createAction
// îl cere obligatoriu. În loc să slăbim createAction (ar deschide o gaură pentru acțiunile de
// organizație), definim un frate al lui: createPlatformAction. Refolosește TOT ce se poate —
// aceleași tipuri ActionResult/ActionError, aceiași ActionDenied, același audit prin RPC
// log_audit_event, aceeași disciplină de allow-list — și schimbă doar poarta de intrare:
// requirePlatformAdmin() în loc de resolveTenant() + can() + requireFeature().
// Fișierul NU importă clientul service_role (nu are voie); handlerele din actions.ts îl creează.
import "server-only";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ActionDenied } from "@/lib/actions/errors";
import type {
  ActionError,
  ActionErrorCode,
  ActionResult,
  AuditAction,
  JsonObject,
  JsonValue,
} from "@/lib/actions/types";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase, type ServerSupabase } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import type { AuthUser } from "@/lib/tenant/types";
export type PlatformActionContext = Readonly<{
  supabase: ServerSupabase;
  user: AuthUser;
  requestId: string;
  now: Date;
}>;

export type PlatformAudit<TInput, TData> = Readonly<{
  action: AuditAction;
  entityType: string;
  entityId?: (input: TInput, data: TData) => string | null;
  /** Organizația vizată de acțiune; audit_logs.organization_id. */
  organizationId?: (input: TInput, data: TData) => string | null;
  /** ALLOW-LIST: doar aceste chei ajung în audit_logs.after. */
  allow: readonly string[];
}>;

export type PlatformActionDefinition<TSchema extends z.ZodType, TData> = Readonly<{
  name: string;
  input: TSchema;
  audit: PlatformAudit<z.output<TSchema>, TData>;
  rateLimit?: Readonly<{ max: number; windowSeconds: number }>;
  revalidate?: readonly string[] | ((input: z.output<TSchema>, data: TData) => readonly string[]);
  handler: (ctx: PlatformActionContext, input: z.output<TSchema>) => Promise<TData>;
}>;

type EroarePostgres = Readonly<{ code: string; message: string; details?: string | null }>;

function estePostgres(eroare: unknown): eroare is EroarePostgres {
  return (
    typeof eroare === "object" &&
    eroare !== null &&
    "code" in eroare &&
    typeof (eroare as { code: unknown }).code === "string"
  );
}

/** 23505 nu este un mesaj pentru oameni. Îl traducem după constrângerea încălcată. */
function mesajConflict(eroare: EroarePostgres): string {
  const text = `${eroare.message} ${eroare.details ?? ""}`.toLowerCase();
  if (text.includes("cui")) return "Există deja o organizație înregistrată cu acest CUI.";
  if (text.includes("slug")) return "Identificatorul ales este deja folosit de altă organizație.";
  if (text.includes("email")) return "Există deja o organizație cu această adresă de email.";
  return "Datele introduse intră în conflict cu o înregistrare existentă.";
}

/** `unknown` nu este atribuibil lui `Json`; îngustăm valoarea la ce poate trece prin RPC. */
function caJson(valoare: unknown): JsonValue | undefined {
  if (valoare === null) return null;
  if (typeof valoare === "string" || typeof valoare === "boolean") return valoare;
  if (typeof valoare === "number") return Number.isFinite(valoare) ? valoare : null;
  if (valoare instanceof Date) return valoare.toISOString();
  if (Array.isArray(valoare)) {
    return valoare
      .map((element: unknown) => caJson(element))
      .filter((element): element is JsonValue => element !== undefined);
  }
  if (typeof valoare === "object") {
    const iesire: JsonObject = {};
    for (const [cheie, val] of Object.entries(valoare as Record<string, unknown>)) {
      const curatata = caJson(val);
      if (curatata !== undefined) iesire[cheie] = curatata;
    }
    return iesire;
  }
  // function, symbol, bigint, undefined — nu sunt JSON.
  return undefined;
}

function pastreazaPermise(sursa: unknown, permise: readonly string[]): JsonObject | null {
  if (typeof sursa !== "object" || sursa === null) return null;
  const iesire: JsonObject = {};
  for (const [cheie, valoare] of Object.entries(sursa as Record<string, unknown>)) {
    if (!permise.includes(cheie)) continue;
    const curatata = caJson(valoare);
    if (curatata !== undefined) iesire[cheie] = curatata;
  }
  return Object.keys(iesire).length === 0 ? null : iesire;
}

/** Elimină cheile `undefined` — obligatoriu sub exactOptionalPropertyTypes. */
export function faraNedefinite<T extends Record<string, unknown>>(obiect: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obiect).filter(([, valoare]) => valoare !== undefined),
  ) as Partial<T>;
}

function eroare(
  cod: ActionErrorCode,
  mesaj: string,
  requestId: string,
  fieldErrors: Record<string, readonly string[]> | null = null,
): ActionError {
  return { code: cod, message: mesaj, fieldErrors, requestId };
}

async function scrieAudit(
  supabase: ServerSupabase,
  args: Readonly<{
    action: AuditAction;
    status: "success" | "failure" | "denied";
    organizationId: string | null;
    entityType: string;
    entityId: string | null;
    after: JsonObject | null;
    requestId: string;
    errorCode: string | null;
  }>,
): Promise<void> {
  const antete = await headers();
  const ipBrut = antete.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { error } = await supabase.rpc("log_audit_event", {
    p_action: args.action,
    p_status: args.status,
    p_organization_id: args.organizationId,
    p_entity_type: args.entityType,
    p_entity_id: args.entityId,
    p_before: null,
    p_after: args.after,
    p_ip: ipBrut,
    p_user_agent: antete.get("user-agent"),
    p_request_id: args.requestId,
    p_error_code: args.errorCode,
  });
  // Auditul nu trebuie să rupă acțiunea, dar nici nu îl înghițim în tăcere.
  if (error)
    console.error("[audit] scriere eșuată", {
      requestId: args.requestId,
      code: error.code,
      message: error.message,
    });
}

export function createPlatformAction<TSchema extends z.ZodType, TData>(
  definitie: PlatformActionDefinition<TSchema, TData>,
): (raw: unknown) => Promise<ActionResult<TData>> {
  return async function executa(raw: unknown): Promise<ActionResult<TData>> {
    const requestId = crypto.randomUUID();
    const supabase = await createServerSupabase();

    let user: AuthUser;
    try {
      user = await requirePlatformAdmin();
    } catch {
      return {
        ok: false,
        error: eroare("INTERZIS", "Nu aveți acces la panoul de platformă.", requestId),
      };
    }

    const parsat = definitie.input.safeParse(raw);
    if (!parsat.success) {
      // `flattenError` peste o schemă generică întoarce valori lărgite; le îngustăm aici.
      const plat = z.flattenError(parsat.error) as {
        formErrors: readonly string[];
        fieldErrors: Record<string, readonly string[] | undefined>;
      };
      const fieldErrors: Record<string, readonly string[]> = {};
      for (const [camp, mesaje] of Object.entries(plat.fieldErrors)) {
        if (mesaje !== undefined && mesaje.length > 0) fieldErrors[camp] = mesaje;
      }
      return {
        ok: false,
        error: eroare("VALIDARE", "Verificați câmpurile marcate.", requestId, fieldErrors),
      };
    }
    const input = parsat.data as z.output<TSchema>;

    if (definitie.rateLimit) {
      const { allowed } = await consumeRateLimit({
        key: `platforma:${definitie.name}:${user.id}`,
        limit: definitie.rateLimit.max,
        windowSeconds: definitie.rateLimit.windowSeconds,
      });
      if (!allowed) {
        await scrieAudit(supabase, {
          action: definitie.audit.action,
          status: "denied",
          organizationId: null,
          entityType: definitie.audit.entityType,
          entityId: null,
          after: null,
          requestId,
          errorCode: "LIMITA_DEPASITA",
        });
        return {
          ok: false,
          error: eroare(
            "LIMITA_DEPASITA",
            "Prea multe încercări. Reîncercați peste câteva minute.",
            requestId,
          ),
        };
      }
    }

    try {
      const data = await definitie.handler({ supabase, user, requestId, now: new Date() }, input);

      const entityId = definitie.audit.entityId?.(input, data) ?? null;
      const organizationId = definitie.audit.organizationId?.(input, data) ?? entityId;
      await scrieAudit(supabase, {
        action: definitie.audit.action,
        status: "success",
        organizationId,
        entityType: definitie.audit.entityType,
        entityId,
        after: pastreazaPermise(
          { ...(input as object), ...(data as object) },
          definitie.audit.allow,
        ),
        requestId,
        errorCode: null,
      });

      const cai =
        typeof definitie.revalidate === "function"
          ? definitie.revalidate(input, data)
          : (definitie.revalidate ?? []);
      for (const cale of cai) revalidatePath(cale);

      return { ok: true, data };
    } catch (exceptie) {
      const eroareActiune: ActionError =
        exceptie instanceof ActionDenied
          ? eroare(exceptie.code, exceptie.message, requestId, exceptie.fieldErrors ?? null)
          : estePostgres(exceptie) && exceptie.code === "23505"
            ? eroare("CONFLICT", mesajConflict(exceptie), requestId)
            : eroare(
                "EROARE_INTERNA",
                "A apărut o eroare neașteptată. Am notificat echipa tehnică.",
                requestId,
              );

      if (eroareActiune.code === "EROARE_INTERNA") {
        console.error("[platform-action]", definitie.name, requestId, exceptie);
      }
      await scrieAudit(supabase, {
        action: definitie.audit.action,
        status: eroareActiune.code === "INTERZIS" ? "denied" : "failure",
        organizationId: null,
        entityType: definitie.audit.entityType,
        entityId: null,
        after: null,
        requestId,
        errorCode: eroareActiune.code,
      });
      return { ok: false, error: eroareActiune };
    }
  };
}
