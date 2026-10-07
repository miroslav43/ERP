// src/app/api/export/mentenanta/echipamente/route.ts
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { filtreDinUrl } from "@/lib/rute/parametri";
import {
  angajatiDupaId,
  listeazaEchipamente,
  optiuniDepartamente,
  type RandEchipament,
} from "@/lib/queries/maintenance";
import { filtreEchipamenteSchema } from "@/schemas/maintenance";
import { ETICHETE_STATUS_ECHIPAMENT } from "@/app/(app)/mentenanta/etichete";

export const dynamic = "force-dynamic";

/** Plafonul exportului: lista filtrată, nu tot parcul la nesfârșit. */
const MAX_RANDURI = 2000;

const ANTET: readonly string[] = [
  "Cod",
  "Denumire",
  "Categorie",
  "Serie",
  "Producător",
  "Model",
  "An fabricație",
  "Locație",
  "Departament",
  "Responsabil",
  "Stare",
  "ISCIR",
  "Tip autorizare",
  "Pus în funcțiune",
  "Garanție până la",
  "Casat la",
];

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** Excel interpretă „=", „+", „-", „@" ca formule: le prefixăm cu apostrof. */
const celula = (valoare: string): string => {
  const curat = valoare.replace(/\r?\n/g, " ");
  const protejat = /^[=+\-@\t]/.test(curat) ? `'${curat}` : curat;
  return `"${protejat.replace(/"/g, '""')}"`;
};

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    return raspunsText("Trebuie să vă autentificați.", 401);
  }
  if (rezolvare.status !== "ok") return raspunsText("Alegeți mai întâi o organizație.", 403);
  const { tenant } = rezolvare;
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  if (!can(permisiuni, "maintenance:export", "team")) {
    return raspunsText("Nu aveți dreptul de a exporta echipamentele.", 403);
  }

  // Organizația vine din tenant, nu din parametrii cererii; filtrele, din URL,
  // validate de aceeași schemă ca lista.
  const filtre = filtreDinUrl(
    filtreEchipamenteSchema,
    Object.fromEntries(url.searchParams.entries()),
  );
  const randuri: RandEchipament[] = [];
  let cursor: string | null = null;
  let trunchiat = false;
  for (let pagina = 0; pagina < 20; pagina += 1) {
    const rezultat = await listeazaEchipamente(tenant.organizationId, {
      ...filtre,
      cursor,
      limita: 100,
    });
    randuri.push(...rezultat.randuri);
    cursor = rezultat.urmatorulCursor;
    if (cursor === null) break;
    if (randuri.length >= MAX_RANDURI) {
      trunchiat = true;
      break;
    }
  }

  const [departamente, nume] = await Promise.all([
    optiuniDepartamente(tenant.organizationId),
    angajatiDupaId(
      tenant.organizationId,
      randuri.map((r) => r.responsabil_employee_id).filter((v): v is string => v !== null),
    ),
  ]);
  const numeDepartament = new Map(departamente.map((d) => [d.id, d.nume]));

  const linie = (e: RandEchipament): string =>
    [
      e.cod,
      e.denumire,
      e.categorie ?? "",
      e.serie ?? "",
      e.producator ?? "",
      e.model ?? "",
      e.an_fabricatie === null ? "" : String(e.an_fabricatie),
      e.locatie ?? "",
      e.department_id === null ? "" : (numeDepartament.get(e.department_id) ?? ""),
      e.responsabil_employee_id === null
        ? ""
        : (nume.get(e.responsabil_employee_id)?.full_name ?? ""),
      ETICHETE_STATUS_ECHIPAMENT[e.status],
      e.este_iscir ? "da" : "nu",
      e.tip_autorizare_necesara ?? "",
      e.data_punerii_in_functiune ?? "",
      e.garantie_expira ?? "",
      e.casat_la ?? "",
    ]
      .map(celula)
      .join(";");

  const continut = [ANTET.map(celula).join(";"), ...randuri.slice(0, MAX_RANDURI).map(linie)].join(
    "\r\n",
  );
  const numeFisier = `echipamente-${new Date().toISOString().slice(0, 10)}.csv`;

  // Exportul e un eveniment auditabil, ca la jurnalul de audit.
  const client = await createServerSupabase();
  const { error } = await client.rpc("log_audit_event", {
    p_action: "export",
    p_status: "success",
    p_organization_id: tenant.organizationId,
    p_entity_type: "equipment",
    p_after: {
      randuri: Math.min(randuri.length, MAX_RANDURI),
      trunchiat,
      filtre: {
        status: filtre.status,
        categorie: filtre.categorie,
        punct_lucru: filtre.punct_lucru,
        iscir: filtre.iscir,
        responsabil: filtre.responsabil,
        cauta: filtre.cauta,
      },
    },
    p_user_agent: request.headers.get("user-agent"),
  });
  if (error !== null) {
    console.error("[mentenanță] nu am putut înregistra evenimentul de export", error);
  }

  return new Response(`﻿${continut}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${numeFisier}"`,
      "cache-control": "no-store",
    },
  });
}
