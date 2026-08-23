// src/app/(portal)/portal/in-primirea-mea/page.tsx
import type { Metadata } from "next";
import { PackageCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { inPrimireaMea } from "@/lib/queries/inventory";
import { fisaMea } from "@/lib/queries/portal";
import { ButonConfirmare } from "@/app/(app)/inventar/in-primire/buton-confirmare";
import { ETICHETE_STARE } from "@/app/(app)/inventar/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "În primirea mea" };

export default async function PaginaInPrimireaMea() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "inventory");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "inventory:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta obiectele din primire." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  // Fișa se trimite ÎNTOTDEAUNA, spre deosebire de ecranul din `(app)`, care o
  // omite pentru scope `own` și lasă RLS să îngusteze. Aici, `.eq("employee_id",
  // …)` e strict mai îngust decât ramura `own` a politicii — deci nu poate
  // deschide nimic — și rămâne corect pentru orice cititor, indiferent de scope.
  const randuri = await inPrimireaMea(tenant.organizationId, stare.fisa.id);
  const neconfirmate = randuri.filter((r) => r.confirmat_de_angajat_la === null).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header>
        <h1 className="text-foreground text-xl font-semibold">În primirea mea</h1>
        <p className="text-muted-foreground text-sm">
          {neconfirmate > 0
            ? `${neconfirmate.toLocaleString("ro-RO")} ${neconfirmate === 1 ? "obiect așteaptă" : "obiecte așteaptă"} confirmarea dumneavoastră.`
            : "Obiectele pe care le aveți acum în primire. Cele returnate dispar din listă."}
        </p>
      </header>

      {randuri.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Nu aveți obiecte în primire"
          description="Momentan nu vă este predat niciun obiect de inventar."
        />
      ) : (
        <ul className="space-y-2">
          {randuri.map((rand) => (
            <li key={rand.id} className="bg-surface border-border rounded-lg border p-4">
              <p className="text-foreground text-sm font-medium">{rand.obiect.denumire}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Nr. inventar <span className="font-mono">{rand.obiect.numar_inventar}</span>
                {rand.obiect.serie === null ? null : ` · seria ${rand.obiect.serie}`}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Predat {formatDateTime(rand.predat_la)} · stare la predare:{" "}
                {ETICHETE_STARE[rand.stare_la_predare]}
              </p>
              {rand.observatii === null ? null : (
                <p className="text-muted-foreground mt-1 text-sm">{rand.observatii}</p>
              )}

              <div className="mt-3">
                {rand.confirmat_de_angajat_la === null ? (
                  <ButonConfirmare alocareId={rand.id} />
                ) : (
                  <span className="border-success text-success inline-block rounded border px-2 py-0.5 text-xs">
                    Confirmat la {formatDateTime(rand.confirmat_de_angajat_la)}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
