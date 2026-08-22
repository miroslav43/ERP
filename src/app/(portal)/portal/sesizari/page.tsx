// src/app/(portal)/portal/sesizari/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { numeleEchipamentelorMele } from "@/app/(app)/mentenanta/actions";
import {
  CLASE_STATUS_SESIZARE,
  CLASE_URGENTA_SESIZARE,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
} from "@/app/(app)/mentenanta/etichete";

export const metadata: Metadata = { title: "Sesizările mele" };

export default async function PaginaSesizariPortal() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "maintenance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune." />
      </div>
    );
  }

  const poateRaporta = can(permisiuni, "maintenance:create", "own");

  // Acțiune, nu citire: `equipment` are coloană de scope `null` în bucla de
  // politici din `0011_ssm.sql`, deci cere `maintenance:read >= team` — un
  // angajat nu poate citi denumirea utilajului pe care chiar el l-a sesizat.
  // Acțiunea rezolvă denumirile cu client admin, filtrat pe organizație, și e
  // păzită de `maintenance:read` / `own`.
  const rezultat = await numeleEchipamentelorMele({});
  const sesizari = rezultat.ok ? rezultat.data : [];

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold">Sesizările mele</h1>
          <p className="text-muted-foreground text-sm">
            Defecțiunile pe care le-ați raportat și starea lor.
          </p>
        </div>
        {poateRaporta ? (
          <Link
            href="/portal/sesizari/noua"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors"
          >
            <Plus aria-hidden="true" className="size-4" />
            Sesizare nouă
          </Link>
        ) : null}
      </header>

      {!rezultat.ok ? (
        <p
          role="alert"
          aria-live="assertive"
          className="border-danger/40 bg-danger/10 text-foreground rounded-md border p-4 text-sm"
        >
          {rezultat.error.message}
        </p>
      ) : sesizari.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nu ați trimis nicio sesizare"
          description="Dacă un utilaj s-a defectat, raportați-l — durează un minut. Puteți scana și codul QR de pe echipament."
        />
      ) : (
        <ul className="space-y-2">
          {sesizari.map((sesizare) => (
            <li key={sesizare.id} className="bg-surface border-border rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-medium">
                    {sesizare.echipament === null
                      ? "Echipament indisponibil"
                      : `${sesizare.echipament.cod} · ${sesizare.echipament.denumire}`}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Raportată {formatDateTime(sesizare.raportat_la)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-xs ${CLASE_STATUS_SESIZARE[sesizare.status]}`}
                >
                  {ETICHETE_STATUS_SESIZARE[sesizare.status]}
                </span>
              </div>

              <p className="text-foreground mt-2 text-sm">{sesizare.descriere}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 text-xs ${CLASE_URGENTA_SESIZARE[sesizare.urgenta]}`}
                >
                  {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
                </span>
                {sesizare.opreste_functionarea ? (
                  <span className="border-danger text-danger rounded border px-2 py-0.5 text-xs">
                    Oprește funcționarea
                  </span>
                ) : null}
                {sesizare.rezolvat_la === null ? null : (
                  <span className="text-muted-foreground text-xs">
                    Rezolvată {formatDateTime(sesizare.rezolvat_la)}
                  </span>
                )}
              </div>

              {/* Motivul respingerii, întotdeauna vizibil: fără el, omul
                  raportează a doua oară aceeași defecțiune. */}
              {sesizare.motiv_respingere === null ? null : (
                <p className="border-danger text-foreground mt-3 border-l-2 pl-3 text-sm">
                  {sesizare.motiv_respingere}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
