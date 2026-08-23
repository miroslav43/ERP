// src/app/(app)/salarizare/istoric-venituri/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
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
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:create", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a introduce istoricul de venit." />
      </div>
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
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/salarizare" className="underline-offset-2 hover:underline">
            Salarizare
          </Link>
        </p>
        <AntetPagina titlu="Istoric venituri" />
        {/* Rămâne un `<p>` de sine stătător, nu prop-ul `descriere`: accentul pe
            „înainte” e purtat de `<strong>`, iar `descriere` primește un string. */}
        <p className="text-muted-foreground text-corp mt-2 max-w-prose text-pretty">
          Veniturile realizate <strong>înainte</strong> ca firma să folosească aplicația.
          Indemnizația de concediu medical se calculează pe media ultimelor șase luni, iar cea de
          concediu de odihnă pe media ultimelor trei. Fără lunile acestea, mediile ies incomplete și
          indemnizațiile mai mici decât cele legale — fără nicio eroare vizibilă.
        </p>
      </div>

      <FormularIstoricVenit angajati={personal.angajati} />

      <section aria-label="Rânduri introduse" className="border-border rounded-panou border">
        {randuri.length === 0 ? (
          <p className="text-muted-foreground text-corp p-4">
            Niciun rând încă. Introduceți lunile anterioare pentru angajații care au avut sau ar
            putea avea concediu medical.
          </p>
        ) : (
          <table className="text-corp w-full">
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
    </div>
  );
}
