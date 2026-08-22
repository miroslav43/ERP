// src/lib/actions/audit.ts
import "server-only";
import { headers } from "next/headers";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { AuditAction, AuditStatus, JsonObject, JsonValue } from "./types";

export type RequestMeta = Readonly<{ ip: string | null; userAgent: string | null }>;

/** `audit_logs.ip` este `inet`: un șir invalid ar arunca 22P02 în funcție. */
const FORMAT_IP = /^[0-9a-fA-F.:]{3,45}$/;
const LUNGIME_MAXIMA_UA = 500;

export async function readRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const brut = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
  const ua = h.get("user-agent");
  return {
    ip: FORMAT_IP.test(brut) ? brut : null,
    userAgent: ua === null ? null : ua.slice(0, LUNGIME_MAXIMA_UA),
  };
}

export type AuditEntry = Readonly<{
  organizationId: string | null;
  action: AuditAction;
  status: AuditStatus;
  entityType: string | null;
  entityId: string | null;
  before: JsonObject | null;
  after: JsonObject | null;
  errorCode: string | null;
  requestId: string;
  meta: RequestMeta;
}>;

/**
 * `audit_logs` este append-only și are INSERT revocat pentru `authenticated`
 * (0001 §7), deci scrierea trece obligatoriu printr-o funcție SECURITY DEFINER.
 * `actor_id` NU se trimite: funcția îl ia din `auth.uid()`, altfel apelantul
 * și-ar putea semna acțiunile cu identitatea altcuiva.
 *
 * Eșecul auditului nu întrerupe acțiunea, dar se loghează: un audit mut este
 * mai periculos decât o acțiune eșuată.
 */
export async function writeAuditLog(supabase: ServerSupabase, entry: AuditEntry): Promise<void> {
  const { error } = await supabase.rpc("log_audit_event", {
    p_organization_id: entry.organizationId,
    p_action: entry.action,
    p_status: entry.status,
    p_entity_type: entry.entityType,
    p_entity_id: entry.entityId,
    p_before: entry.before,
    p_after: entry.after,
    p_ip: entry.meta.ip,
    p_user_agent: entry.meta.userAgent,
    p_request_id: entry.requestId,
    p_error_code: entry.errorCode,
  });
  if (error) {
    console.error("[audit] scriere eșuată", { requestId: entry.requestId, code: error.code });
  }
}

/**
 * Plasă de siguranță PESTE allow-list: chiar dacă cineva enumeră din greșeală
 * un câmp sensibil, tiparul îl taie.
 *
 * Trebuie să fie un SUPERSET al tiparelor din triggerul generic de audit al
 * bazei (`internal.audit_forbidden_patterns()`, R9). Nu era: baza redacta
 * `ciphertext`, `hash`, `auth_tag` și sufixul `_iv`, iar partea de TypeScript
 * nu le avea. Din cele 118 câmpuri auditate în cod, niciunul nu e afectat de
 * lărgire — golul era doar pentru viitor, dar exact acolo apar câmpurile
 * criptografice. `audit.test.ts` verifică de acum incluziunea, citind SQL-ul.
 *
 * Cele două liste NU sunt identice, și e corect: baza filtrează NUME DE
 * COLOANE (`cnp_ciphertext`, `cnp_iv`), iar aici filtrăm CHEI DE PAYLOAD
 * (`cnp`, `salariu_brut`) — vocabulare diferite, cu aceeași intenție.
 */
const CAMPURI_INTERZISE =
  /cnp|iban|salar|token|secret|parol|password|ciphertext|auth_tag|hash|_iv$/i;
const ADANCIME_MAXIMA = 4;
const LUNGIME_MAXIMA_TEXT = 500;
const ELEMENTE_MAXIME = 50;

/**
 * Reduce intrarea brută la exact câmpurile permise, recursiv.
 *
 * Cheia se păstrează dacă allow-list-ul conține calea completă (`perioada.start`)
 * sau numele simplu (`start`), la orice adâncime. Restul dispare — inclusiv
 * câmpurile pe care nu le cunoaștem, ceea ce este esențial la validarea eșuată,
 * unde `rawInput` este complet necontrolat.
 *
 * ATENȚIE la structurile imbricate: filtrarea coboară nivel cu nivel, deci un
 * câmp imbricat cere ȘI PĂRINTELE în allow-list. `["perioada.start"]` singur nu
 * păstrează nimic — `perioada` e tăiat înainte să se ajungă la `start`. Forma
 * corectă e `["perioada", "perioada.start"]` sau `["perioada", "start"]`.
 * Toate allow-list-urile din cod sunt azi plate, deci nimic nu depinde de asta;
 * capcana e pentru primul care scrie una imbricată.
 */
export function redactPayload(input: unknown, allow: readonly string[]): JsonObject | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  return filtreazaObiect(input as Record<string, unknown>, new Set(allow), "", 0);
}

function filtreazaObiect(
  sursa: Record<string, unknown>,
  permise: ReadonlySet<string>,
  prefix: string,
  adancime: number,
): JsonObject {
  const iesire: JsonObject = {};
  for (const [cheie, valoare] of Object.entries(sursa)) {
    if (CAMPURI_INTERZISE.test(cheie)) continue;
    const cale = prefix === "" ? cheie : `${prefix}.${cheie}`;
    if (!permise.has(cale) && !permise.has(cheie)) continue;
    const curatata = curataValoare(valoare, permise, cale, adancime + 1);
    if (curatata !== undefined) iesire[cheie] = curatata;
  }
  return iesire;
}

function curataValoare(
  valoare: unknown,
  permise: ReadonlySet<string>,
  cale: string,
  adancime: number,
): JsonValue | undefined {
  if (valoare === null) return null;
  if (typeof valoare === "string") {
    return valoare.length > LUNGIME_MAXIMA_TEXT
      ? `${valoare.slice(0, LUNGIME_MAXIMA_TEXT)}…`
      : valoare;
  }
  if (typeof valoare === "number") return Number.isFinite(valoare) ? valoare : null;
  if (typeof valoare === "boolean") return valoare;
  if (valoare instanceof Date) return valoare.toISOString();
  if (adancime > ADANCIME_MAXIMA) return "«prea adânc»";
  if (Array.isArray(valoare)) {
    return valoare
      .slice(0, ELEMENTE_MAXIME)
      .map((element) => curataValoare(element, permise, cale, adancime + 1))
      .filter((element): element is JsonValue => element !== undefined);
  }
  if (typeof valoare === "object") {
    return filtreazaObiect(valoare as Record<string, unknown>, permise, cale, adancime);
  }
  // function, symbol, bigint, undefined — nu sunt JSON.
  return undefined;
}
