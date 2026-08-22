// src/app/(app)/salarizare/istoric-venituri/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { formatMonthYear, todayInBucharest } from "@/lib/format/date";
import { angajatiActiviCuContract, listeazaIstoricVenit } from "@/lib/queries/payroll";

import { FormularIstoricVenit } from "./formular-istoric-venit";

export const metadata: Metadata = { title: "Istoric venituri" };

export default async function PaginaIstoricVenituri() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "payroll:create", "all")) {
    return (
      <main className="p-6">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a introduce istoricul de venit." />
      </main>
    );
  }

  const azi = todayInBucharest();
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));
  const [personal, randuri] = await Promise.all([
    angajatiActiviCuContract(tenant.organizationId, an, luna),
    listeazaIstoricVenit(tenant.organizationId),
  ]);

  return (
    <main className="max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">
          <Link href="/salarizare" className="underline-offset-2 hover:underline">
            Salarizare
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">Istoric venituri</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Veniturile realizate <strong>înainte</strong> ca firma să folosească aplicația.
          Indemnizația de concediu medical se calculează pe media ultimelor șase luni, iar cea de
          concediu de odihnă pe media ultimelor trei. Fără lunile acestea, mediile ies incomplete și
          indemnizațiile mai mici decât cele legale — fără nicio eroare vizibilă.
        </p>
      </header>

      <FormularIstoricVenit angajati={personal.angajati} />

      <section aria-label="Rânduri introduse" className="border-border rounded-lg border">
        {randuri.length === 0 ? (
          <p className="text-muted-foreground p-4 text-sm">
            Niciun rând încă. Introduceți lunile anterioare pentru angajații care au avut sau ar
            putea avea concediu medical.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground border-border border-b text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Angajat</th>
                <th className="px-4 py-2 font-medium">Luna</th>
                <th className="px-4 py-2 text-right font-medium">Venit brut</th>
                <th className="px-4 py-2 text-right font-medium">Drepturi salariale</th>
                <th className="px-4 py-2 text-right font-medium">Zile lucrate</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {randuri.map((rand) => (
                <tr key={rand.id}>
                  <td className="px-4 py-2">{rand.nume || rand.marca}</td>
                  <td className="px-4 py-2">{formatMonthYear(rand.an, rand.luna)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatLei(rand.venit_brut)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatLei(rand.drepturi_salariale)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{rand.zile_lucrate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
