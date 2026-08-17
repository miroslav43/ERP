// src/lib/actions/types.ts
/**
 * Contractul tipizat al Server Actions.
 *
 * Fișierul NU este marcat `server-only`, deliberat: `ActionResult` și
 * `ActionError` se citesc și în componentele client, care afișează `message` și
 * mapează `fieldErrors` pe câmpurile formularului. Nu conține nicio valoare de
 * rulare — doar tipuri, deci `import type` îl șterge complet din bundle.
 */
import type { z } from "zod";
import type { FeatureKey } from "@/config/features";
import type { MinScope, PermissionKey, PermissionScope } from "@/config/permissions";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { AuthUser, Tenant } from "@/lib/tenant/types";

/** Uniune închisă: interfața poate face `switch` exhaustiv pe ea. */
export type ActionErrorCode =
  | "NEAUTENTIFICAT"
  | "FARA_ORGANIZATIE"
  | "MODUL_DEZACTIVAT"
  | "INTERZIS"
  | "VALIDARE"
  | "CONFLICT"
  | "NEGASIT"
  | "LIMITA_DEPASITA"
  | "EROARE_INTERNA";

/** Oglinda enum-ului `public.audit_action` din 0001_kernel.sql. */
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "view"
  | "export"
  | "import"
  | "login"
  | "logout"
  | "login_failed"
  | "password_reset"
  | "invite_sent"
  | "invite_accepted"
  | "invite_revoked"
  | "member_added"
  | "member_removed"
  | "role_changed"
  | "permission_changed"
  | "feature_toggled"
  | "org_created"
  | "org_activated"
  | "org_suspended"
  | "tenant_switch"
  | "tenant_forged"
  | "rate_limited"
  | "email_sent"
  | "demo_requested"
  | "impersonation_start"
  | "impersonation_end";

/** `public.audit_status`. Atenție: `failure`, nu `error`. */
export type AuditStatus = "success" | "failure" | "denied";

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = Record<string, JsonValue>;

/**
 * `fieldErrors` este `| null`, nu opțional: cu `exactOptionalPropertyTypes`,
 * un câmp opțional nu acceptă `undefined` explicit, iar constructorii de erori
 * ar trebui să compună obiectul condiționat la fiecare apel.
 */
export type ActionError = Readonly<{
  code: ActionErrorCode;
  /** Română, afișabil ca atare. Nu conține niciodată detalii tehnice. */
  message: string;
  fieldErrors: Readonly<Record<string, readonly string[]>> | null;
  /** Singurul lucru care leagă ecranul utilizatorului de stiva din log. */
  requestId: string;
}>;

export type ActionResult<TData> =
  Readonly<{ ok: true; data: TData }> | Readonly<{ ok: false; error: ActionError }>;

export type ActionContext = Readonly<{
  supabase: ServerSupabase;
  user: AuthUser;
  /** Rezolvat server-side. Clientul nu trimite niciodată `organization_id`. */
  tenant: Tenant;
  /** Scope-ul EFECTIV acordat pentru `permission` — garantat ≥ `minScope`. */
  scope: PermissionScope;
  features: ReadonlySet<FeatureKey>;
  requestId: string;
  now: Date;
}>;

export type ActionAudit<TSchema extends z.ZodType, TData> = Readonly<{
  action: AuditAction;
  /** Numele tabelei atinse: `audit_logs.entity_type`. */
  entityType: string;
  entityId?: (input: z.output<TSchema>, data: TData) => string | null;
  /**
   * ALLOW-LIST de câmpuri auditate. Nume simplu (`startDate`) sau cale
   * (`perioada.start`). Tot ce nu e enumerat aici NU ajunge în `audit_logs`.
   * O deny-list uită întotdeauna câmpul adăugat luna viitoare; o allow-list
   * uită doar să audite ceva — greșeala ieftină, nu cea care scurge un CNP.
   */
  allow: readonly string[];
}>;

export type ActionDefinition<TSchema extends z.ZodType, TData> = Readonly<{
  /** `leave.request.create` — apare în log-uri, nu în `audit_logs.action`. */
  name: string;
  input: TSchema;
  /** Absent = acțiune de nucleu, disponibilă indiferent de modulele activate. */
  feature?: FeatureKey;
  permission: PermissionKey;
  /** OBLIGATORIU. Fără prag, `own` ar trece drept `all`. */
  minScope: MinScope;
  audit: ActionAudit<TSchema, TData>;
  revalidate?: readonly string[] | ((input: z.output<TSchema>, data: TData) => readonly string[]);
  handler: (ctx: ActionContext, input: z.output<TSchema>) => Promise<TData>;
}>;
