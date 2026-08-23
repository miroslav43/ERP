// src/app/(app)/flota/anomalii/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { anomaliiNeconfirmate, vehiculeDupaId } from "@/lib/queries/fleet";

import { NavFlota } from "../nav-flota";
import { ConfirmaAnomalie } from "./confirma-anomalie";

export const metadata: Metadata = { title: "Anomalii de kilometraj" };

async function TabelAnomalii({ organizationId }: { readonly organizationId: string }) {
  const anomalii = await anomaliiNeconfirmate(organizationId);

  if (anomalii.length === 0) {
    // Lista goală e o stare BUNĂ aici, nu o lipsă de date — textul trebuie să
    // spună asta, altfel omul caută ce a greșit.
    return (
      <StareGoala
        fel="initiala"
        pictograma={CheckCircle2}
        titlu="Nicio anomalie neconfirmată"
        descriere="Kilometrajul tuturor vehiculelor este continuu. Diferențele apar aici automat, când o foaie de parcurs sare peste kilometri."
      />
    );
  }

  const vehicule = await vehiculeDupaId(
    organizationId,
    anomalii.map((a) => a.vehicle_id),
  );

  return (
    <div className="border-border rounded-panou overflow-x-auto border">
      <table className="text-corp w-full">
        <caption className="sr-only">
          Discontinuități de kilometraj constatate automat, în așteptarea unei explicații.
        </caption>
        <thead className="bg-surface text-left">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Constatată
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Vehicul
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Așteptat
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Declarat
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Explicație
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {anomalii.map((a) => (
            <tr key={a.id} className="hover:bg-surface">
              <td className="px-4 py-3 whitespace-nowrap">
                {formatDateTime(new Date(a.created_at))}
              </td>
              <td className="px-4 py-3">{vehicule.get(a.vehicle_id)?.nr_inmatriculare ?? "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {a.km_asteptat.toLocaleString("ro-RO")} km
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {a.km_declarat.toLocaleString("ro-RO")} km
                <span className="text-foreground text-nota ml-2">
                  +{(a.km_declarat - a.km_asteptat).toLocaleString("ro-RO")}
                </span>
              </td>
              <td className="px-4 py-3">
                <ConfirmaAnomalie id={a.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PaginaAnomalii() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "fleet");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "vehicles:update", "team")) {
    return (
      <AccesRestrictionat mesaj="Anomaliile de kilometraj pot fi consultate de cei care administrează parcul auto. Solicitați administratorului organizației dreptul necesar." />
    );
  }

  return (
    <div className="space-y-6">
      {/* Textul explicativ rămâne JSX (are `<strong>` și un al doilea bloc), deci
          nu încape în prop-ul `descriere`, care e string. Trece prin `file`, ca
          să stea în același bloc de antet, deasupra benzii de file. */}
      <AntetPagina
        titlu="Anomalii de kilometraj"
        file={
          <>
            <p className="text-muted-foreground text-corp max-w-3xl">
              Un kilometraj care sare peste o diferență neobișnuită nu blochează salvarea foii — cea
              mai frecventă explicație e o cursă necompletată, iar un refuz l-ar împinge pe șofer să
              potrivească cifra. Diferența ajunge aici, ca cineva să o explice.
              <span className="mt-1 block">
                Un <strong>regres</strong> de kilometraj, în schimb, e refuzat din start: un
                odometru nu poate da înapoi.
              </span>
            </p>
            <NavFlota
              poateVedeaFoi={can(permisiuni, "trip_sheets:read", "own")}
              poateAproba={can(permisiuni, "trip_sheets:approve", "team")}
              poateVedeaAnomalii={can(permisiuni, "vehicles:update", "team")}
            />
          </>
        }
      />

      <Suspense fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelAnomalii organizationId={tenant.organizationId} />
      </Suspense>
    </div>
  );
}
