// src/app/(portal)/portal/concediile-mele/page.tsx
import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { anDinUrl } from "@/lib/rute/parametri";
import { idFisaProprie } from "@/lib/queries/employees";
import { cererileMele, soldurileMele, tipuriConcediu } from "@/lib/queries/portal";

import { CLASE_STATUS_CERERE, ETICHETE_STATUS_CERERE } from "../etichete";

export const metadata: Metadata = { title: "Concediile mele" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaConcediileMele({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "leave");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "leave:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta concediile. Cereți-i administratorului organizației dreptul necesar." />
      </div>
    );
  }

  const propriaFisaId = await idFisaProprie(tenant.organizationId, user.id);
  if (propriaFisaId === null) {
    return (
      <div className="p-4">
        <div className="bg-surface border-border rounded-lg border p-6 text-center">
          <h1 className="text-foreground text-lg font-semibold">
            Nu aveți încă o fișă de personal
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Concediile se leagă de un angajat. Cereți resurselor umane să vă completeze fișa.
          </p>
        </div>
      </div>
    );
  }

  const parametri = await searchParams;
  const an = anDinUrl(parametri["an"], Number(todayInBucharest().slice(0, 4)));

  const [solduri, cereri, tipuri] = await Promise.all([
    soldurileMele(tenant.organizationId, an, propriaFisaId),
    cererileMele(tenant.organizationId, propriaFisaId, 100),
    tipuriConcediu(tenant.organizationId),
  ]);

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-foreground text-xl font-semibold">Concediile mele</h1>

      <section aria-labelledby="solduri" className="space-y-2">
        <h2 id="solduri" className="text-foreground text-sm font-semibold">
          Soldul pe {an}
        </h2>
        {solduri.length === 0 ? (
          <p className="bg-surface border-border text-muted-foreground rounded-lg border p-4 text-sm">
            Nu aveți încă niciun sold înregistrat pentru {an}. Apare după prima cerere sau după ce
            resursele umane vă stabilesc dreptul anual.
          </p>
        ) : (
          <ul className="space-y-2">
            {solduri.map((s) => (
              <li key={s.leave_type_id} className="bg-surface border-border rounded-lg border p-4">
                <p className="text-foreground text-sm font-medium">
                  {tipuri.get(s.leave_type_id)?.denumire ?? "Concediu"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <Valoare eticheta="Rămase" valoare={s.ramase ?? 0} accent />
                  <Valoare eticheta="Drept anual" valoare={s.drept_anual} />
                  <Valoare eticheta="Folosite" valoare={s.folosite} />
                  {s.in_asteptare > 0 ? (
                    <Valoare eticheta="În așteptare" valoare={s.in_asteptare} />
                  ) : null}
                  {s.reportate > 0 ? <Valoare eticheta="Reportate" valoare={s.reportate} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cereri" className="space-y-2">
        <h2 id="cereri" className="text-foreground text-sm font-semibold">
          Cererile mele
        </h2>
        {cereri.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nicio cerere de concediu"
            description="Cererile pe care le depuneți apar aici, împreună cu răspunsul primit."
          />
        ) : (
          <ul className="space-y-2">
            {cereri.map((c) => (
              <li key={c.id} className="bg-surface border-border rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {tipuri.get(c.leave_type_id)?.denumire ?? "Concediu"}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatDate(c.data_inceput)} – {formatDate(c.data_sfarsit)}
                      {c.zile_lucratoare === null
                        ? null
                        : ` · ${c.zile_lucratoare.toLocaleString("ro-RO")} zile lucrătoare`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-2 py-0.5 text-xs ${
                      CLASE_STATUS_CERERE[c.status] ?? "border-border text-muted-foreground"
                    }`}
                  >
                    {ETICHETE_STATUS_CERERE[c.status] ?? c.status}
                  </span>
                </div>
                {/* Motivul respingerii se afișează ÎNTOTDEAUNA când există: un
                    refuz fără explicație îl lasă pe om să depună aceeași cerere
                    a doua oară. */}
                {c.motiv_respingere === null ? null : (
                  <p className="border-danger text-foreground mt-3 border-l-2 pl-3 text-sm">
                    {c.motiv_respingere}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Valoare({
  eticheta,
  valoare,
  accent = false,
}: {
  readonly eticheta: string;
  readonly valoare: number;
  readonly accent?: boolean;
}) {
  return (
    <span>
      <span className="text-muted-foreground block text-xs">{eticheta}</span>
      <span
        className={
          accent
            ? "text-foreground block text-lg font-semibold tabular-nums"
            : "text-foreground block tabular-nums"
        }
      >
        {valoare.toLocaleString("ro-RO")}
      </span>
    </span>
  );
}
