// src/app/(portal)/portal/integrarea-mea/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { listeazaInstante, progresInstante } from "@/lib/queries/checklist";
import { fisaMea } from "@/lib/queries/portal";
import { ETICHETE_STATUS_INSTANTA, ETICHETE_TIP } from "@/app/(app)/onboarding/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Integrarea mea" };

export default async function PaginaIntegrareaMea() {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta parcursul de integrare." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  // `angajat` se trimite EXPLICIT. `listeazaInstante` are parametrul, dar
  // decizia e a apelantului: nesetat, un cont cu `checklists:read = all` ar
  // primi toate parcursurile firmei sub eticheta „al meu".
  const { randuri } = await listeazaInstante(tenant.organizationId, {
    tip: null,
    status: null,
    angajat: stare.fisa.id,
    de_la: null,
    pana_la: null,
    cursor: null,
    limita: 25,
  });

  const progres =
    randuri.length === 0 ? new Map() : await progresInstante(randuri.map((r) => r.id));

  return (
    <div className={`${LATIMI.lista} space-y-4 p-4`}>
      <AntetPagina
        titlu="Integrarea mea"
        descriere="Pașii de parcurs la angajare, la schimbarea funcției sau la plecare."
      />

      {randuri.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={ClipboardList}
          titlu="Niciun parcurs pornit"
          descriere="Pașii de integrare îi pornește departamentul de resurse umane; apar aici imediat ce încep."
        />
      ) : (
        <ul className="space-y-2">
          {randuri.map((instanta) => {
            const p = progres.get(instanta.id);
            const total = p?.total ?? 0;
            const facute = p?.facute ?? 0;
            return (
              <li key={instanta.id}>
                <Link
                  href={`/portal/integrarea-mea/${instanta.id}`}
                  className="bg-surface border-border hover:border-ring rounded-panou block border p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground text-corp font-medium">
                        {ETICHETE_TIP[instanta.tip]}
                      </p>
                      <p className="text-muted-foreground text-corp mt-0.5">
                        Din {formatDate(instanta.data_referinta)}
                      </p>
                    </div>
                    <span className="border-border text-muted-foreground text-nota shrink-0 rounded border px-2 py-0.5">
                      {ETICHETE_STATUS_INSTANTA[instanta.status]}
                    </span>
                  </div>
                  {total === 0 ? null : (
                    <p className="text-muted-foreground text-nota mt-2 tabular-nums">
                      {facute.toLocaleString("ro-RO")} din {total.toLocaleString("ro-RO")} pași
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
