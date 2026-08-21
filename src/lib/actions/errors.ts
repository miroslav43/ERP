// src/lib/actions/errors.ts
import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ActionError, ActionErrorCode } from "./types";

/**
 * Singura excepție care ajunge tradusă la utilizator. Orice altceva aruncat
 * dintr-un handler devine `EROARE_INTERNA` și nu iese din server.
 */
export class ActionDenied extends Error {
  readonly code: ActionErrorCode;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>> | null;

  constructor(
    code: ActionErrorCode,
    message: string,
    fieldErrors: Readonly<Record<string, readonly string[]>> | null = null,
  ) {
    super(message);
    this.name = "ActionDenied";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const forbidden = (m = "Nu aveți dreptul să efectuați această operațiune.") =>
  new ActionDenied("INTERZIS", m);
export const notFound = (m = "Înregistrarea nu a fost găsită.") => new ActionDenied("NEGASIT", m);
/** Regulă de business încălcată: starea curentă intră în conflict cu cererea. */
export const businessRule = (m: string) => new ActionDenied("CONFLICT", m);
export const limitExceeded = (m: string) => new ActionDenied("LIMITA_DEPASITA", m);
export const invalidInput = (m: string, fieldErrors: Readonly<Record<string, readonly string[]>>) =>
  new ActionDenied("VALIDARE", m, fieldErrors);

/**
 * Traducerea codurilor Postgres. Mesajele sunt fixe și scrise aici: textul din
 * bază poate conține numele constrângerii, valori din alte rânduri sau
 * fragmente de SQL — informație de reconnaissance pentru un atacator.
 *
 * Nuanță RLS: la SELECT, RLS nu aruncă eroare, ci filtrează rânduri. Un
 * `.single()` pe un rând invizibil dă `PGRST116`, mapat la NEGASIT, nu la
 * INTERZIS: nu confirmăm existența datelor altei organizații. Doar scrierile
 * respinse produc `42501`.
 */
const PG_ERRORS: Readonly<Record<string, Readonly<{ code: ActionErrorCode; message: string }>>> = {
  "42501": { code: "INTERZIS", message: "Nu aveți dreptul să efectuați această operațiune." },
  "23505": { code: "CONFLICT", message: "Există deja o înregistrare cu aceste date." },
  "23503": { code: "NEGASIT", message: "Înregistrarea la care se face referire nu există." },
  "23514": { code: "VALIDARE", message: "Datele nu respectă regulile de validare." },
  "23502": { code: "VALIDARE", message: "Un câmp obligatoriu lipsește." },
  "22001": { code: "VALIDARE", message: "Una dintre valori depășește lungimea permisă." },
  "22P02": { code: "VALIDARE", message: "Una dintre valori are un format nepermis." },
  // RAISE EXCEPTION din triggerele de regulă (R7). Mesajul din bază este scris
  // în română, dar NU se propagă: se mapează pe cod, iar textul rămâne în
  // `audit_logs` și în log-ul serverului.
  P0001: { code: "CONFLICT", message: "Operațiunea a fost respinsă de o regulă a sistemului." },
  "40001": { code: "CONFLICT", message: "Datele au fost modificate între timp. Reîncercați." },
  "40P01": { code: "CONFLICT", message: "Operațiune concurentă. Reîncercați." },
  "57014": { code: "EROARE_INTERNA", message: "Operațiunea a durat prea mult și a fost oprită." },
  PGRST116: { code: "NEGASIT", message: "Înregistrarea nu există sau nu aveți acces la ea." },
  PGRST301: { code: "NEAUTENTIFICAT", message: "Sesiunea a expirat. Autentificați-vă din nou." },
};

/**
 * Coduri al căror mesaj fix nu-i spune utilizatorului ce anume să corecteze:
 * „Datele nu respectă regulile de validare” e adevărat, dar neacționabil.
 * Pentru ele atașăm codul de referință, ca omul să aibă ce cita, iar noi să
 * putem găsi în log linia `respins de bază` cu acel `requestId` și cauza
 * exactă. Restul codurilor (CONFLICT, INTERZIS, NEGASIT) au mesaje care spun
 * deja ce s-a întâmplat, deci rămân curate.
 */
const CODURI_PG_NEACTIONABILE: ReadonlySet<string> = new Set([
  "23514", // violare de CHECK
  "23502", // NOT NULL
  "22001", // valoare prea lungă
  "22P02", // format nepermis
]);

export function mapPostgrestError(error: PostgrestError, requestId: string): ActionError {
  const hit = PG_ERRORS[error.code];
  if (hit !== undefined) {
    const message = CODURI_PG_NEACTIONABILE.has(error.code)
      ? `${hit.message} Cod de referință: ${requestId}`
      : hit.message;
    return { ...hit, message, fieldErrors: null, requestId };
  }
  return {
    code: "EROARE_INTERNA",
    message: `A apărut o eroare neașteptată. Cod de referință: ${requestId}`,
    fieldErrors: null,
    requestId,
  };
}

export function isPostgrestError(value: unknown): value is PostgrestError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { code?: unknown; message?: unknown };
  return (
    typeof candidate.code === "string" &&
    typeof candidate.message === "string" &&
    "details" in value
  );
}
