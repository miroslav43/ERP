// src/app/(portal)/portal/sesizari/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { numeleEchipamentelorMele } from "@/app/(app)/mentenanta/actions";
import {
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
} from "@/app/(app)/mentenanta/etichete";

export const metadata: Metadata = { title: "Sesizările mele" };

export default async function PaginaSesizariPortal() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

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
    <div className={`${LATIMI.lista} space-y-4 p-4`}>
      <AntetPagina
        titlu="Sesizările mele"
        descriere="Defecțiunile pe care le-ați raportat și starea lor."
        {...(poateRaporta
          ? {
              actiuni: (
                <Link href="/portal/sesizari/noua" className={buton({ varianta: "primar" })}>
                  <Plus aria-hidden="true" className="size-4" />
                  Sesizare nouă
                </Link>
              ),
            }
          : {})}
      />

      {!rezultat.ok ? (
        <p
          role="alert"
          aria-live="assertive"
          className="border-danger/40 bg-danger/10 text-foreground rounded-control text-corp border p-4"
        >
          {rezultat.error.message}
        </p>
      ) : sesizari.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Wrench}
          titlu="Nu ați trimis nicio sesizare"
          descriere="Dacă un utilaj s-a defectat, raportați-l — durează un minut. Puteți scana și codul QR de pe echipament."
        />
      ) : (
        <ul className="space-y-2">
          {sesizari.map((sesizare) => (
            <li key={sesizare.id} className="bg-surface border-border rounded-panou border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-foreground text-corp font-medium">
                    {sesizare.echipament === null
                      ? "Echipament indisponibil"
                      : `${sesizare.echipament.cod} · ${sesizare.echipament.denumire}`}
                  </p>
                  <p className="text-muted-foreground text-nota mt-0.5">
                    Raportată {formatDateTime(sesizare.raportat_la)}
                  </p>
                </div>
                <Badge className="shrink-0" ton={TONURI_STATUS_SESIZARE[sesizare.status]}>
                  {ETICHETE_STATUS_SESIZARE[sesizare.status]}
                </Badge>
              </div>

              <p className="text-foreground text-corp mt-2">{sesizare.descriere}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge ton={TONURI_URGENTA_SESIZARE[sesizare.urgenta]}>
                  {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
                </Badge>
                {sesizare.opreste_functionarea ? (
                  <span className="border-danger text-danger text-nota rounded border px-2 py-0.5">
                    Oprește funcționarea
                  </span>
                ) : null}
                {sesizare.rezolvat_la === null ? null : (
                  <span className="text-muted-foreground text-nota">
                    Rezolvată {formatDateTime(sesizare.rezolvat_la)}
                  </span>
                )}
              </div>

              {/* Motivul respingerii, întotdeauna vizibil: fără el, omul
                  raportează a doua oară aceeași defecțiune. */}
              {sesizare.motiv_respingere === null ? null : (
                <p className="border-danger text-foreground text-corp mt-3 border-l-2 pl-3">
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
