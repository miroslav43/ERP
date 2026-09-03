// src/app/(portal)/portal/tichetele-mele/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { formatDateTime } from "@/lib/format/date";
import { citesteTichetul, listeazaComentariile } from "@/lib/queries/ticketing";
import { fisaMea } from "@/lib/queries/portal";
import { FormularComentariu } from "@/app/(app)/ticketing/[id]/actiuni-tichet";
import {
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
  TONURI_PRIORITATE,
  TONURI_STATUS,
} from "@/app/(app)/ticketing/etichete";

import { FaraFisa } from "../../fara-fisa";

export const metadata: Metadata = { title: "Tichetul meu" };

export default async function PaginaTichetulMeu({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const tichetId = idDinRuta(id);

  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "ticketing"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "tickets:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta tichetele de suport." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const tichet = await citesteTichetul(tichetId);
  if (tichet === null) notFound();

  // Garda de proprietate, ca la cererea de concediu: politica de SELECT are
  // ramuri legitime pentru echipa de suport și pentru manageri, dar sub eticheta
  // „tichetul meu" ele ar însemna că o rută de portal deschide tichetul oricui.
  if (tichet.solicitant?.id !== stare.fisa.id) notFound();

  const comentarii = await listeazaComentariile(tichet.id);

  return (
    <div className={`${LATIMI.detaliu} space-y-4 p-4`}>
      <AntetPagina
        titlu={tichet.titlu}
        descriere={`${tichet.numar_afisat} · ${ETICHETE_TIP[tichet.tip]} · deschis ${formatDateTime(
          tichet.created_at,
        )}`}
        actiuni={
          <Badge ton={TONURI_STATUS[tichet.status]} className="shrink-0">
            {ETICHETE_STATUS[tichet.status]}
          </Badge>
        }
      />

      <section className="bg-surface border-border rounded-panou space-y-3 border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge ton={TONURI_PRIORITATE[tichet.prioritate]}>
            {ETICHETE_PRIORITATE[tichet.prioritate]}
          </Badge>
          <span className="text-muted-foreground text-nota">
            {tichet.asignat === null
              ? "Neatribuit încă"
              : `În lucru la ${tichet.asignat.full_name}`}
          </span>
        </div>

        {tichet.descriere === null || tichet.descriere === "" ? null : (
          <p className="text-foreground text-corp whitespace-pre-wrap">{tichet.descriere}</p>
        )}

        {tichet.obiect === null ? null : (
          <p className="text-muted-foreground border-border text-corp border-t pt-3">
            Echipament: {tichet.obiect.denumire}
            {tichet.obiect.numar_inventar === null
              ? null
              : ` · nr. inventar ${tichet.obiect.numar_inventar}`}
          </p>
        )}
      </section>

      <section aria-labelledby="discutie" className="space-y-2">
        <h2 id="discutie" className="text-foreground text-corp font-semibold">
          Discuție
        </h2>
        {comentarii.length === 0 ? (
          <p className="bg-surface border-border text-muted-foreground rounded-panou text-corp border p-4">
            Încă nimic. Scrieți mai jos dacă aveți de adăugat ceva.
          </p>
        ) : (
          <ul className="space-y-2">
            {comentarii.map((comentariu) => (
              <li key={comentariu.id} className="bg-surface border-border rounded-panou border p-3">
                <p className="text-muted-foreground text-nota">
                  {comentariu.autor?.full_name ?? "Echipa de suport"} ·{" "}
                  {formatDateTime(comentariu.created_at)}
                </p>
                <p className="text-foreground text-corp mt-1 whitespace-pre-wrap">
                  {comentariu.continut}
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* `poateNotaInterna` fals: notele interne sunt ale echipei de suport, iar
            solicitantul nici nu le vede — politica `ticket_comments_select` le
            ascunde. Un comutator pe care nu-l poate folosi ar fi doar confuzie. */}
        <FormularComentariu ticketId={tichet.id} poateNotaInterna={false} />
      </section>

      <p>
        <Link href="/portal/tichetele-mele" className={buton({ varianta: "link" })}>
          Înapoi la tichetele mele
        </Link>
      </p>
    </div>
  );
}
