// src/app/(platform)/super-admin/_lib/platform.ts
import { headers } from "next/headers";

import type { ActionError, ActionErrorCode, ActionResult } from "@/lib/actions/types";
import { createServerSupabase } from "@/lib/supabase/server";

type ClientServer = Awaited<ReturnType<typeof createServerSupabase>>;

/** Un singur loc în care este scrisă lista de coloane citite din `profiles`. */
export const SELECT_PROFIL = "id, email, full_name";

export type RandProfil = Readonly<{
  id: string;
  email: string | null;
  full_name: string | null;
}>;

export function numeAfisat(profil: RandProfil | undefined): string {
  const nume = profil?.full_name?.trim();
  if (nume) return nume;
  const email = profil?.email?.trim();
  if (email) return email;
  return "Utilizator necunoscut";
}

export function idCerere(): string {
  return crypto.randomUUID();
}

export function reusit<TData>(data: TData): ActionResult<TData> {
  return { ok: true, data };
}

export function esuat<TData = never>(
  code: ActionErrorCode,
  message: string,
  requestId: string,
  fieldErrors: Readonly<Record<string, readonly string[]>> | null = null,
): ActionResult<TData> {
  const error: ActionError = { code, message, fieldErrors, requestId };
  return { ok: false, error };
}

export function campuriInvalide(
  brute: Readonly<Record<string, readonly string[] | undefined>>,
): Readonly<Record<string, readonly string[]>> {
  const rezultat: Record<string, readonly string[]> = {};
  for (const [cheie, mesaje] of Object.entries(brute)) {
    if (mesaje && mesaje.length > 0) rezultat[cheie] = [...mesaje];
  }
  return rezultat;
}

type EroareTradusa = Readonly<{ code: ActionErrorCode; message: string }>;

/**
 * Regulile sunt impuse de trigger-e în bază de date. Aici doar traducem
 * mesajul tehnic într-unul pentru oameni — nu dublăm regula.
 */
const TRADUCERI: readonly Readonly<{ tipar: RegExp; code: ActionErrorCode; message: string }>[] = [
  {
    tipar: /seats?[_ ]?limit|locuri|plafon/i,
    code: "LIMITA_DEPASITA",
    message:
      "Planul curent nu mai permite utilizatori noi. Mărește plafonul de locuri din pagina organizației sau eliberează un loc.",
  },
  {
    tipar: /ultim|last[_ ]?admin|org_admin/i,
    code: "CONFLICT",
    message:
      "Organizația trebuie să rămână cu cel puțin un administrator activ. Promovează pe altcineva înainte de această modificare.",
  },
  {
    // ÎNAINTEA regulii de duplicat: 42P10 („there is no unique or exclusion
    // constraint matching the ON CONFLICT specification”) conține cuvântul
    // „unique”, deci era raportat drept duplicat și trimitea diagnosticul pe o
    // pistă greșită. Nu e un conflict de date, ci o interogare greșită.
    tipar: /no unique or exclusion constraint/i,
    code: "EROARE_INTERNA",
    message: "Operațiunea nu a putut fi finalizată din cauza unei erori interne.",
  },
  {
    tipar: /duplicate key|already exists|unique/i,
    code: "CONFLICT",
    message: "Există deja o înregistrare cu aceste date.",
  },
  {
    tipar: /check constraint|violates/i,
    code: "CONFLICT",
    message: "Modificarea nu respectă regulile organizației.",
  },
  {
    tipar: /permission denied|row-level security/i,
    code: "INTERZIS",
    message: "Nu ai dreptul să faci această modificare.",
  },
];

export function traduEroareBd(mesaj: string): EroareTradusa {
  for (const traducere of TRADUCERI) {
    if (traducere.tipar.test(mesaj)) return { code: traducere.code, message: traducere.message };
  }
  return {
    code: "EROARE_INTERNA",
    message: "Operațiunea nu a putut fi finalizată. Încearcă din nou peste câteva momente.",
  };
}

export type ValoareAudit = string | number | boolean | null;
export type PayloadAudit = Readonly<Record<string, ValoareAudit>>;
export type ActiuneAudit =
  "feature_toggled" | "invite_sent" | "invite_revoked" | "role_changed" | "update";

/** S7: ALLOW-LIST. Doar cheile enumerate ajung în `audit_logs`. */
export function doarCampuri(
  sursa: PayloadAudit,
  permise: readonly string[],
): Record<string, ValoareAudit> {
  const rezultat: Record<string, ValoareAudit> = {};
  for (const cheie of permise) {
    const valoare = sursa[cheie];
    if (valoare !== undefined) rezultat[cheie] = valoare;
  }
  return rezultat;
}

const TIPAR_IP = /^[0-9a-fA-F.:]{3,45}$/;

function ipClient(antet: string | null): string | null {
  const prima = antet?.split(",")[0]?.trim();
  if (!prima || !TIPAR_IP.test(prima)) return null;
  return prima;
}

export type IntrareAudit = Readonly<{
  actiune: ActiuneAudit;
  status: "success" | "failure" | "denied";
  organizationId: string;
  entityType: string;
  entityId: string | null;
  before: Record<string, ValoareAudit> | null;
  after: Record<string, ValoareAudit> | null;
  requestId: string;
  errorCode?: string | null;
}>;

/**
 * S6: `audit_logs` este append-only și se scrie exclusiv prin RPC.
 * Folosim clientul de sesiune (nu service_role) ca `auth.uid()` să rămână
 * actorul real, nu NULL.
 */
export async function scrieAudit(client: ClientServer, intrare: IntrareAudit): Promise<void> {
  const antete = await headers();
  const { error } = await client.rpc("log_audit_event", {
    p_action: intrare.actiune,
    p_status: intrare.status,
    p_organization_id: intrare.organizationId,
    p_entity_type: intrare.entityType,
    p_entity_id: intrare.entityId,
    p_before: intrare.before,
    p_after: intrare.after,
    p_ip: ipClient(antete.get("x-forwarded-for")),
    p_user_agent: antete.get("user-agent"),
    p_request_id: intrare.requestId,
    p_error_code: intrare.errorCode ?? null,
  });
  if (error) {
    console.error("[audit] înregistrarea în jurnal a eșuat", {
      requestId: intrare.requestId,
      actiune: intrare.actiune,
      mesaj: error.message,
    });
  }
}

export const ETICHETE_SCOPE: Readonly<Record<"none" | "own" | "team" | "all", string>> = {
  none: "fără acces",
  own: "proprii",
  team: "echipă",
  all: "toate",
};

export const CULORI_SCOPE: Readonly<Record<"none" | "own" | "team" | "all", string>> = {
  none: "text-danger",
  own: "text-warning",
  team: "text-accent",
  all: "text-success",
};
