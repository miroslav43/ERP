// src/app/(portal)/portal/concediile-mele/[id]/page.tsx
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
import { formatDate, formatDateTime } from "@/lib/format/date";
import { citesteCerere, zileleCererii } from "@/lib/queries/leave";
import { fisaMea, tipuriConcediu } from "@/lib/queries/portal";
import { ActiuniCerere } from "@/app/(app)/concedii/[id]/actiuni-cerere";
import { ETICHETE_PORTIUNE } from "@/app/(app)/concedii/etichete";

import { FaraFisa } from "../../fara-fisa";
import { ETICHETE_STATUS_CERERE, TONURI_STATUS_CERERE } from "../../etichete";

export const metadata: Metadata = { title: "Cererea mea" };

/** Statusurile în care cererea mai poate fi retrasă de autorul ei. */
const SE_POATE_ANULA: ReadonlySet<string> = new Set(["ciorna", "trimisa"]);

export default async function PaginaCerereaMea({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const cerereId = idDinRuta(id);

  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "leave:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cererile de concediu." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const cerere = await citesteCerere(tenant.organizationId, cerereId);
  if (cerere === null) notFound();

  // Garda de proprietate. NU e redundantă cu RLS: `leave_requests_select`
  // (`0009_leave.sql:987`) are ramuri și pentru manager, și pentru
  // `leave:read = all` — legitime în aplicația mare, dar sub eticheta „cererea
  // mea" ar însemna că o rută de portal deschide cererea oricui. 404, nu 403:
  // pentru cine n-o deține, cererea altcuiva nu există.
  if (cerere.employee_id !== stare.fisa.id) notFound();

  const [zile, tipuri] = await Promise.all([
    zileleCererii(cerere.id),
    tipuriConcediu(tenant.organizationId),
  ]);

  const denumireTip = tipuri.get(cerere.leave_type_id)?.denumire ?? "Concediu";
  const poateAnula = SE_POATE_ANULA.has(cerere.status) && can(permisiuni, "leave:update", "own");

  return (
    <div className={`${LATIMI.detaliu} space-y-4 p-4`}>
      <AntetPagina
        titlu={denumireTip}
        descriere={`${formatDate(cerere.data_inceput)} – ${formatDate(cerere.data_sfarsit)}`}
        actiuni={
          <Badge className="shrink-0" ton={TONURI_STATUS_CERERE[cerere.status] ?? "neutru"}>
            {ETICHETE_STATUS_CERERE[cerere.status] ?? cerere.status}
          </Badge>
        }
      />

      {/* Motivul respingerii, primul lucru după antet: e singura informație
          pentru care omul a deschis ecranul, iar notificarea care l-a adus aici
          nu-l conține. */}
      {cerere.motiv_respingere === null ? null : (
        <section className="border-danger/40 bg-danger/10 rounded-panou border p-4">
          <h2 className="text-foreground text-corp font-semibold">Motivul respingerii</h2>
          <p className="text-foreground text-corp mt-1">{cerere.motiv_respingere}</p>
        </section>
      )}

      <section className="bg-surface border-border rounded-panou border p-4">
        <dl className="text-corp grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <dt className="text-muted-foreground text-nota">Zile lucrătoare</dt>
            <dd className="text-foreground font-medium tabular-nums">
              {cerere.zile_lucratoare.toLocaleString("ro-RO")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-nota">Zile calendaristice</dt>
            <dd className="text-foreground font-medium tabular-nums">
              {cerere.zile_calendaristice.toLocaleString("ro-RO")}
            </dd>
          </div>
          {cerere.portiune_inceput === "zi_intreaga" &&
          cerere.portiune_sfarsit === "zi_intreaga" ? null : (
            <>
              <div>
                <dt className="text-muted-foreground text-nota">Prima zi</dt>
                <dd className="text-foreground">{ETICHETE_PORTIUNE[cerere.portiune_inceput]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-nota">Ultima zi</dt>
                <dd className="text-foreground">{ETICHETE_PORTIUNE[cerere.portiune_sfarsit]}</dd>
              </div>
            </>
          )}
          {cerere.trimisa_la === null ? null : (
            <div>
              <dt className="text-muted-foreground text-nota">Trimisă</dt>
              <dd className="text-foreground">{formatDateTime(cerere.trimisa_la)}</dd>
            </div>
          )}
          {cerere.decis_la === null ? null : (
            <div>
              <dt className="text-muted-foreground text-nota">Decisă</dt>
              <dd className="text-foreground">{formatDateTime(cerere.decis_la)}</dd>
            </div>
          )}
        </dl>

        {cerere.motiv === null ? null : (
          <div className="border-border mt-3 border-t pt-3">
            <p className="text-muted-foreground text-nota">Motivul dumneavoastră</p>
            <p className="text-foreground text-corp mt-1">{cerere.motiv}</p>
          </div>
        )}
      </section>

      {zile.length === 0 ? null : (
        <section aria-labelledby="zile" className="space-y-2">
          <h2 id="zile" className="text-foreground text-corp font-semibold">
            Zilele cererii
          </h2>
          <ul className="divide-border border-border bg-surface rounded-panou divide-y border">
            {zile.map((zi) => (
              <li key={zi.data} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-foreground text-corp">{formatDate(zi.data)}</span>
                <span className="text-muted-foreground text-nota">
                  {zi.este_lucratoare
                    ? ETICHETE_PORTIUNE[zi.portiune]
                    : "Nelucrătoare — nu se scade"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* `esteCiorna` deschide butonul „Trimite spre aprobare”. Portalul e locul
          unde ciorna se creează cel mai des (formularul de aici are aceleași
          două butoane), deci era și locul unde fundătura se atingea cel mai des. */}
      {poateAnula ? (
        <ActiuniCerere cerereId={cerere.id} esteCiorna={cerere.status === "ciorna"} />
      ) : null}

      <p>
        <Link href="/portal/concediile-mele" className={buton({ varianta: "link" })}>
          Înapoi la concediile mele
        </Link>
      </p>
    </div>
  );
}
