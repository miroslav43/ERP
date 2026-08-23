// src/app/(app)/salarizare/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { listeazaPerioade, type RandPerioada } from "@/lib/queries/payroll";
import { Wallet } from "lucide-react";

import {
  AVERTISMENT_SALARIZARE,
  TONURI_STATUS_PERIOADA,
  ETICHETE_STATUS_PERIOADA,
  numeLuna,
} from "./etichete";
import { FormularPerioadaNoua } from "./formular-perioada-noua";

export const metadata: Metadata = { title: "Salarizare" };

export default async function PaginaSalarizare() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:read", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a administra salarizarea. Solicitați administratorului organizației rolul potrivit." />
      </div>
    );
  }

  const poateCrea = can(permisiuni, "payroll:create", "all");
  const perioade = await listeazaPerioade(tenant.organizationId);

  /*
   * Lista se citește întreagă (fără cursor keyset), deci antetele nu pretind că
   * sortează: un antet care pare apăsabil și nu face nimic e mai rău decât unul
   * care nu pare. Cifrele sunt însă `numeric`, ca să se compare pe verticală —
   * într-un tabel de bani, coloana nealiniată e o capcană de citire.
   */
  const coloane: readonly Coloana<RandPerioada>[] = [
    {
      cheie: "perioada",
      antet: "Perioadă",
      peTelefon: "titlu",
      celula: (p) => `${numeLuna(p.luna)} ${String(p.an)}`,
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (p) => (
        <Badge ton={TONURI_STATUS_PERIOADA[p.status] ?? "neutru"}>
          {ETICHETE_STATUS_PERIOADA[p.status] ?? p.status}
        </Badge>
      ),
    },
    {
      cheie: "total_brut",
      antet: "Total brut",
      numeric: true,
      peTelefon: "meta",
      celula: (p) => formatLei(p.total_brut),
    },
    {
      cheie: "total_net",
      antet: "Total net",
      numeric: true,
      peTelefon: "meta",
      celula: (p) => formatLei(p.total_net),
    },
    {
      cheie: "cost_angajator",
      antet: "Cost angajator",
      numeric: true,
      peTelefon: "meta",
      celula: (p) => formatLei(p.total_cost_angajator),
    },
  ];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Salarizare"
        descriere="Perioadele de salarizare ale organizației."
        actiuni={
          <>
            <Link href="/salarizare/istoric-venituri" className={buton({ varianta: "secundar" })}>
              Istoric venituri
            </Link>
            <Link href="/salarizare/setari" className={buton({ varianta: "secundar" })}>
              Setări
            </Link>
          </>
        }
      />

      <div
        role="note"
        className="border-warning/40 bg-warning/8 rounded-panou text-corp border p-4"
      >
        {AVERTISMENT_SALARIZARE}
      </div>

      {poateCrea ? <FormularPerioadaNoua /> : null}

      <Tabel
        caption="Perioadele de salarizare ale organizației"
        coloane={coloane}
        randuri={perioade}
        cheieRand={(p) => p.id}
        href={(p) => `/salarizare/${p.id}`}
        gol={
          <StareGoala
            fel="initiala"
            pictograma={Wallet}
            titlu="Nicio perioadă de salarizare"
            descriere="Configurați setările, apoi creați prima perioadă pentru o lună cu pontajul deschis."
          />
        }
      />
    </div>
  );
}
