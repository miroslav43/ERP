// src/app/(portal)/portal/evaluarile-mele/page.tsx

/**
 * Evaluările proprii, în portal: fiecare evaluare finalizată și evoluția lor.
 *
 * Până la 6 oct 2026 portalul n-avea niciun ecran de evaluări: un angajat
 * evaluat nu era anunțat și nu-și putea vedea evaluarea. Baza era pregătită —
 * `evaluations:read = own` din 0070, iar politica SELECT îi arată doar
 * evaluările FINALIZATE, nu ciornele managerului. Lipseau ecranul și
 * notificarea (`evaluari/anunta-evaluarea.ts`, care duce aici).
 *
 * Conținutul e comun cu `/evaluari/ale-mele` (rolurile care nu intră în
 * portal): `EvaluarileMele`.
 *
 * ── DE CE SE FILTREAZĂ ȘI AICI PE `finalizat` ─────────────────────────────
 * Apărare în adâncime: RLS ascunde deja ciorna proprie (0119, 0170), dar o
 * concluzie pe jumătate scrisă nu e „evaluarea mea”, oricum ar arăta politica
 * peste un an.
 */

import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EvaluarileMele } from "@/components/evaluari/evaluarile-mele";
import { requireFeature } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { evaluariAngajat } from "@/lib/queries/evaluari";
import { fisaMea } from "@/lib/queries/portal";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Evaluările mele" };

export default async function PaginaEvaluarileMele() {
  const { tenant, user } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "evaluations"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "evaluations:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evaluările." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const evaluari = (await evaluariAngajat(tenant.organizationId, stare.fisa.id)).filter(
    (e) => e.status === "finalizat",
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Evaluările mele</h1>
        <p className="text-muted-foreground text-nota">
          Evaluările finalizate de manager, cu nota pe fiecare criteriu și concluzia lui. O evaluare
          apare aici în clipa în care e finalizată.
        </p>
      </header>
      <EvaluarileMele evaluari={evaluari} />
    </div>
  );
}
