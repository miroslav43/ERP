// src/app/(app)/flota/anomalii/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
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

  // Fără sortare și fără paginare: citirea nu are cursor keyset — anomaliile
  // neconfirmate se citesc întregi, cu o limită fixă. Un antet care pare
  // sortabil și nu face nimic e mai rău decât unul care nu pare.
  const coloane: readonly Coloana<(typeof anomalii)[number]>[] = [
    {
      cheie: "constatata",
      antet: "Constatată",
      latime: "ingusta",
      peTelefon: "meta",
      celula: (a) => formatDateTime(new Date(a.created_at)),
    },
    {
      cheie: "vehicul",
      antet: "Vehicul",
      peTelefon: "titlu",
      celula: (a) => vehicule.get(a.vehicle_id)?.nr_inmatriculare ?? "—",
    },
    {
      cheie: "asteptat",
      antet: "Așteptat",
      numeric: true,
      peTelefon: "meta",
      celula: (a) => `${a.km_asteptat.toLocaleString("ro-RO")} km`,
    },
    {
      cheie: "declarat",
      antet: "Declarat",
      numeric: true,
      peTelefon: "meta",
      celula: (a) => (
        <>
          {a.km_declarat.toLocaleString("ro-RO")} km
          <span className="text-foreground text-nota ml-2">
            +{(a.km_declarat - a.km_asteptat).toLocaleString("ro-RO")}
          </span>
        </>
      ),
    },
    {
      cheie: "explicatie",
      antet: "Explicație",
      peTelefon: "meta",
      celula: (a) => <ConfirmaAnomalie id={a.id} />,
    },
  ];

  return (
    <Tabel
      caption="Discontinuități de kilometraj constatate automat, în așteptarea unei explicații."
      coloane={coloane}
      randuri={anomalii}
      cheieRand={(a) => a.id}
      gol={null}
    />
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
