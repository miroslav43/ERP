// src/app/(portal)/portal/tichetele-mele/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { formatDateTime } from "@/lib/format/date";
import { citesteTichetul, listeazaComentariile } from "@/lib/queries/ticketing";
import { fisaMea } from "@/lib/queries/portal";
import { FormularComentariu } from "@/app/(app)/ticketing/[id]/actiuni-tichet";
import {
  CLASE_PRIORITATE,
  CLASE_STATUS,
  ETICHETE_PRIORITATE,
  ETICHETE_STATUS,
  ETICHETE_TIP,
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
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

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
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-foreground text-xl font-semibold">{tichet.titlu}</h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-mono">{tichet.numar_afisat}</span> · {ETICHETE_TIP[tichet.tip]} ·
            deschis {formatDateTime(tichet.created_at)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs ${CLASE_STATUS[tichet.status]}`}
        >
          {ETICHETE_STATUS[tichet.status]}
        </span>
      </header>

      <section className="bg-surface border-border space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 text-xs ${CLASE_PRIORITATE[tichet.prioritate]}`}
          >
            {ETICHETE_PRIORITATE[tichet.prioritate]}
          </span>
          <span className="text-muted-foreground text-xs">
            {tichet.asignat === null
              ? "Neatribuit încă"
              : `În lucru la ${tichet.asignat.full_name}`}
          </span>
        </div>

        {tichet.descriere === null || tichet.descriere === "" ? null : (
          <p className="text-foreground text-sm whitespace-pre-wrap">{tichet.descriere}</p>
        )}

        {tichet.obiect === null ? null : (
          <p className="text-muted-foreground border-border border-t pt-3 text-sm">
            Echipament: {tichet.obiect.denumire}
            {tichet.obiect.numar_inventar === null
              ? null
              : ` · nr. inventar ${tichet.obiect.numar_inventar}`}
          </p>
        )}
      </section>

      <section aria-labelledby="discutie" className="space-y-2">
        <h2 id="discutie" className="text-foreground text-sm font-semibold">
          Discuție
        </h2>
        {comentarii.length === 0 ? (
          <p className="bg-surface border-border text-muted-foreground rounded-lg border p-4 text-sm">
            Încă nimic. Scrieți mai jos dacă aveți de adăugat ceva.
          </p>
        ) : (
          <ul className="space-y-2">
            {comentarii.map((comentariu) => (
              <li key={comentariu.id} className="bg-surface border-border rounded-lg border p-3">
                <p className="text-muted-foreground text-xs">
                  {comentariu.autor?.full_name ?? "Echipa de suport"} ·{" "}
                  {formatDateTime(comentariu.created_at)}
                </p>
                <p className="text-foreground mt-1 text-sm whitespace-pre-wrap">
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
        <Link
          href="/portal/tichetele-mele"
          className="text-primary text-sm underline-offset-2 hover:underline"
        >
          Înapoi la tichetele mele
        </Link>
      </p>
    </div>
  );
}
