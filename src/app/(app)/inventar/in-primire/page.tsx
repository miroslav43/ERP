// src/app/(app)/inventar/in-primire/page.tsx
import type { Metadata } from "next";
import { PackageCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { idFisaProprie } from "@/lib/queries/employees";
import { inPrimireaMea } from "@/lib/queries/inventory";

import { ETICHETE_STARE } from "../etichete";
import { ButonConfirmare } from "./buton-confirmare";

export const metadata: Metadata = { title: "În primirea mea" };

export default async function PaginaInPrimire() {
  const utilizator = await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "inventory");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);
  const scope = scopeFor(permisiuni, "inventory:read");

  if (scope === null || scope === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta obiectele din primire." />;
  }

  // Pentru `own`, RLS restrânge deja singură la propria fișă — nu se caută
  // `propriaFisaId`. Pentru `team`/`all`, RLS NU restrânge, deci fișa proprie
  // trebuie aflată explicit; fără ea, lista ar arăta tot ce e alocat în firmă.
  let propriaFisaId: string | null = null;
  let araNimic = false;
  if (scope !== "own") {
    propriaFisaId = can(permisiuni, "employees:read", "own")
      ? await idFisaProprie(tenant.organizationId, utilizator.id)
      : null;
    araNimic = propriaFisaId === null;
  }

  const randuri = araNimic ? [] : await inPrimireaMea(tenant.organizationId, propriaFisaId);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">În primirea mea</h1>
        <p className="text-muted-foreground text-sm">
          Obiectele pe care le aveți acum în primire. Un obiect returnat dispare din această listă —
          istoricul complet rămâne pe fișa fiecărui obiect.
        </p>
      </header>

      {randuri.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Nu aveți obiecte în primire"
          description="Momentan nu vă este predat niciun obiect de inventar."
        />
      ) : (
        <ul className="space-y-3">
          {randuri.map((rand) => (
            <li key={rand.id} className="border-border rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{rand.obiect.denumire}</p>
                  <p className="text-muted-foreground text-xs">
                    Nr. inventar <span className="font-mono">{rand.obiect.numar_inventar}</span>
                    {rand.obiect.serie !== null ? ` · Serie ${rand.obiect.serie}` : ""}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Predat la {formatDateTime(rand.predat_la)} · Stare la predare:{" "}
                    {ETICHETE_STARE[rand.stare_la_predare]}
                  </p>
                  {rand.observatii !== null ? (
                    <p className="text-muted-foreground mt-1 text-sm">
                      Observații: {rand.observatii}
                    </p>
                  ) : null}
                </div>
                {rand.confirmat_de_angajat_la === null ? (
                  <ButonConfirmare alocareId={rand.id} />
                ) : (
                  <span className="bg-surface text-foreground rounded-full px-3 py-1 text-xs font-medium">
                    Confirmat la {formatDateTime(rand.confirmat_de_angajat_la)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
