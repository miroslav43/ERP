// src/app/(app)/evaluari/ale-mele/page.tsx

/**
 * „Evaluările mele” pentru cei care NU intră în portal.
 *
 * Portalul e doar al rolului `employee` (`(portal)/layout.tsx`); un manager,
 * un HR sau un administrator e și el evaluat de cineva, dar nu avea unde să-și
 * vadă evaluarea. Conținutul e cel din portal (`EvaluarileMele`); aici doar
 * învelișul aplicației și fila din modul.
 *
 * Fără poartă de permisiune pe `evaluations:read`: evaluarea PROPRIE
 * finalizată se vede pentru orice rol (ramura din 0170), iar RLS o întoarce
 * doar pe ea. Modulul trebuie însă să fie activ.
 */

import type { Metadata } from "next";

import { EvaluarileMele } from "@/components/evaluari/evaluarile-mele";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { requireFeature } from "@/lib/auth/features";
import { evaluariAngajat } from "@/lib/queries/evaluari";
import { idFisaProprie } from "@/lib/queries/employees";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { FileEvaluari } from "../_components/file-evaluari";

export const metadata: Metadata = { title: "Evaluările mele" };

export default async function PaginaEvaluarileMeleAplicatie() {
  const { user, tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "evaluations");

  const fisa = await idFisaProprie(tenant.organizationId, user.id);
  const evaluari =
    fisa === null
      ? []
      : (await evaluariAngajat(tenant.organizationId, fisa)).filter(
          (e) => e.status === "finalizat",
        );

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Evaluările mele"
        descriere="Evaluările dumneavoastră finalizate, cu nota pe fiecare criteriu, concluzia evaluatorului și evoluția în timp."
        file={<FileEvaluari activa="ale-mele" />}
      />
      {fisa === null ? (
        <p className="text-muted-foreground text-corp">
          Contul dumneavoastră nu are o fișă de angajat în această firmă, deci nu are evaluări.
        </p>
      ) : (
        <div className="max-w-2xl space-y-6">
          <EvaluarileMele evaluari={evaluari} />
        </div>
      )}
    </div>
  );
}
