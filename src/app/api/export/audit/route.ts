// src/app/api/export/audit/route.ts
import { comparaPayload, formateazaValoare } from "@/lib/audit/diff";
import { etichetaActiune, etichetaEntitate, etichetaStatus } from "@/lib/audit/etichete";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import {
  MAX_RANDURI_EXPORT,
  colecteazaPentruExport,
  parseazaFiltre,
  type FiltreAudit,
  type RandJurnal,
} from "@/lib/queries/audit";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format/date";
export const dynamic = "force-dynamic";

const ANTET: readonly string[] = [
  "Moment (ora României)",
  "Organizație",
  "Autor",
  "E-mail autor",
  "Acțiune",
  "Rezultat",
  "Tip entitate",
  "Identificator entitate",
  "Cod de eroare",
  "Adresă IP",
  "Identificator cerere",
  "Modificări",
];

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** Excel interpretă „=", „+", „-", „@" ca formule: le prefixăm cu apostrof. */
const celula = (valoare: string): string => {
  const curat = valoare.replace(/\r?\n/g, " ");
  const protejat = /^[=+\-@\t]/.test(curat) ? `'${curat}` : curat;
  return `"${protejat.replace(/"/g, '""')}"`;
};

const rezumatModificari = (rand: RandJurnal): string =>
  comparaPayload(rand.before, rand.after)
    .map(
      (modificare) =>
        `${modificare.cale.join(".")}: ${formateazaValoare(modificare.inainte)} → ${formateazaValoare(modificare.dupa)}`,
    )
    .join(" | ");

const linie = (rand: RandJurnal): string =>
  [
    formatDateTime(new Date(rand.createdAt)),
    rand.organizationName ?? "",
    rand.actorNume ?? "Sistem",
    rand.actorEmail ?? "",
    etichetaActiune(rand.action),
    etichetaStatus(rand.status),
    etichetaEntitate(rand.entityType),
    rand.entityId ?? "",
    rand.errorCode ?? "",
    rand.ip ?? "",
    rand.requestId ?? "",
    rezumatModificari(rand),
  ]
    .map(celula)
    .join(";");

type Autorizare =
  | Readonly<{ ok: true; filtre: FiltreAudit; organizationId: string | null }>
  | Readonly<{ ok: false; raspuns: Response }>;

const autorizeaza = async (url: URL): Promise<Autorizare> => {
  const brute = Object.fromEntries(url.searchParams.entries());
  const filtre = parseazaFiltre(brute);

  if (url.searchParams.get("scope") === "platforma") {
    if (!(await isPlatformAdmin())) {
      return { ok: false, raspuns: raspunsText("Nu ai dreptul să exporți acest jurnal.", 403) };
    }
    return { ok: true, filtre, organizationId: filtre.organizationId };
  }

  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    return { ok: false, raspuns: raspunsText("Trebuie să te autentifici.", 401) };
  }
  if (rezolvare.status !== "ok") {
    return { ok: false, raspuns: raspunsText("Alege mai întâi o organizație.", 403) };
  }
  const { tenant } = rezolvare;
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  if (scopeFor(permisiuni, "audit:read") !== "all") {
    return { ok: false, raspuns: raspunsText("Nu ai dreptul să exporți acest jurnal.", 403) };
  }
  // Organizația vine din tenant, nu din parametrii cererii (S1).
  return {
    ok: true,
    filtre: { ...filtre, organizationId: tenant.organizationId },
    organizationId: tenant.organizationId,
  };
};

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const autorizare = await autorizeaza(url);
  if (!autorizare.ok) return autorizare.raspuns;

  const client = await createServerSupabase();
  const rezultat = await colecteazaPentruExport(
    client,
    { ...autorizare.filtre, cursor: null },
    MAX_RANDURI_EXPORT,
  );
  if (!rezultat.ok) return raspunsText(rezultat.mesaj, 500);

  const continut = [ANTET.map(celula).join(";"), ...rezultat.randuri.map(linie)].join("\r\n");
  const numeFisier = `jurnal-audit-${new Date().toISOString().slice(0, 10)}.csv`;

  // Exportul este el însuși un eveniment auditabil (S6).
  const { error } = await client.rpc("log_audit_event", {
    p_action: "export",
    p_status: "success",
    p_organization_id: autorizare.organizationId,
    p_entity_type: "audit_logs",
    p_after: {
      randuri: rezultat.randuri.length,
      trunchiat: rezultat.cursorUrmator !== null,
      filtre: {
        de_la: autorizare.filtre.deLa,
        pana_la: autorizare.filtre.panaLa,
        actiune: autorizare.filtre.actiune,
        status: autorizare.filtre.status,
        entitate: autorizare.filtre.entitate,
      },
    },
    p_user_agent: request.headers.get("user-agent"),
  });
  if (error !== null) {
    console.error("[audit] nu am putut înregistra evenimentul de export", error);
  }

  return new Response(`\uFEFF${continut}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${numeFisier}"`,
      "cache-control": "no-store",
    },
  });
}
