// src/app/(portal)/portal/integrarea-mea/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { pasEsteGata } from "@/schemas/checklist";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { formatDate } from "@/lib/format/date";
import { citesteInstanta, pasiiInstantei } from "@/lib/queries/checklist";
import { fisaMea } from "@/lib/queries/portal";
import { PasChecklist } from "@/app/(app)/onboarding/[id]/pas-checklist";
import { ETICHETE_STATUS_INSTANTA, ETICHETE_TIP } from "@/app/(app)/onboarding/etichete";

import { FaraFisa } from "../../fara-fisa";

export const metadata: Metadata = { title: "Parcursul meu" };

export default async function PaginaParcursulMeu({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const instantaId = idDinRuta(id);

  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "onboarding"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta parcursul de integrare." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const instanta = await citesteInstanta(tenant.organizationId, instantaId);
  if (instanta === null) notFound();
  if (instanta.employee_id !== stare.fisa.id) notFound();

  const pasi = await pasiiInstantei(tenant.organizationId, instanta.id);

  /*
   * Care pași se pot bifa — regula e strictă și vine din politică, nu din bun-simț.
   *
   * `checklist_instance_items_update` (`0014_checklist.sql:856-881`) cere pe ramura
   * `own` ca `responsabil_employee_id` să fie fișa curentă — NU `employee_id`.
   * Într-un parcurs de angajare tipic, majoritatea pașilor au ca responsabil
   * resursele umane. Un control oferit pe unul dintre ei ar produce un UPDATE cu
   * ZERO rânduri, tăcut: acțiunea îl prinde și răspunde „nu aveți dreptul", dar
   * un refuz pe un buton pe care i l-am oferit noi e un defect de ecran.
   *
   * Pașii altcuiva rămân VIZIBILI, fără control: politica de SELECT îi arată
   * (`0014:823`), iar omul trebuie să știe pe cine așteaptă.
   */
  // Un parcurs închis nu primește bife: `checklist_pregateste_pasul` (0014:576)
  // refuză orice modificare cu P0001, iar un buton care nu poate reuși e un
  // defect de ecran.
  const idPasuriBifabile =
    instanta.status !== "in_curs"
      ? []
      : pasi
          .filter(
            (pas) =>
              pas.verificare_automata === null && pas.responsabil_employee_id === stare.fisa.id,
          )
          .map((pas) => pas.id);

  // Același predicat ca `progresInstante`, importat, nu rescris: două
  // definiții ale lui „gata” dădeau cifre diferite pentru aceeași instanță.
  const facute = pasi.filter((pas) => pasEsteGata(pas.status)).length;

  return (
    <div className={`${LATIMI.detaliu} space-y-4 p-4`}>
      <AntetPagina
        titlu={ETICHETE_TIP[instanta.tip]}
        descriere={`Din ${formatDate(instanta.data_referinta)} · ${facute.toLocaleString(
          "ro-RO",
        )} din ${pasi.length.toLocaleString("ro-RO")} pași`}
        actiuni={
          <span className="border-border text-muted-foreground text-nota shrink-0 rounded border px-2 py-0.5">
            {ETICHETE_STATUS_INSTANTA[instanta.status]}
          </span>
        }
      />

      {idPasuriBifabile.length === 0 && pasi.length > 0 ? (
        <p className="bg-surface border-border text-muted-foreground rounded-panou text-corp border p-3">
          Niciun pas nu vă revine acum. Îi puteți urmări mai jos pe cei în lucru la colegi.
        </p>
      ) : null}

      <PasChecklist pasi={pasi} idPasuriBifabile={idPasuriBifabile} />

      {/* Fără buton de finalizare: `checklist.instance.finish` cere
          `checklists:update` la prag `team`, pe care angajatul nu-l are.
          Parcursul îl închide resursele umane. */}

      <p>
        <Link href="/portal/integrarea-mea" className={buton({ varianta: "link" })}>
          Înapoi la integrarea mea
        </Link>
      </p>
    </div>
  );
}
