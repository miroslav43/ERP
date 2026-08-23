// src/app/(portal)/portal/diurna-mea/noua/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import { baremeleTarilor, politicaLaData, tari } from "@/lib/queries/per-diem";
import { FormularDeplasare } from "@/app/(app)/diurna/noua/formular-deplasare";

export const metadata: Metadata = { title: "Deplasare nouă" };

export default async function PaginaDeplasareNouaPortal() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a înregistra deplasări." />
      </div>
    );
  }

  const politica = await politicaLaData(tenant.organizationId, todayInBucharest());

  if (politica === null) {
    return (
      <div className={`${LATIMI.formular} space-y-4 p-4`}>
        <AntetPagina titlu="Deplasare nouă" />
        {/* Fără buton de configurare: `per_diem:update = all` e al
            administratorului. Un buton care duce la refuz e mai rău decât
            absența lui. */}
        <StareGoala
          fel="initiala"
          pictograma={Settings}
          titlu="Politica de diurnă nu este configurată"
          descriere="Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Cereți administratorului organizației să configureze politica firmei."
        />
      </div>
    );
  }

  const listaTari = await tari();
  const baremuri = await baremeleTarilor(listaTari.map((t) => t.id));

  return (
    <div className={`${LATIMI.formular} space-y-4 p-4`}>
      <AntetPagina
        titlu="Deplasare nouă"
        descriere="Zilele și suma se calculează pe măsură ce completați. Suma finală se stabilește pe fișa deplasării, după ce adăugați etapele reale ale traseului."
      />

      {/* `angajati: null` — în portal deplasarea e mereu a mea. Acțiunea rezolvă
          fișa pe server, din sesiune. */}
      <FormularDeplasare
        tari={listaTari}
        politica={politica}
        baremuri={baremuri}
        angajati={null}
        prefixCale="/portal/diurna-mea"
      />

      <p>
        <Link href="/portal/diurna-mea" className={buton({ varianta: "link" })}>
          Înapoi la diurna mea
        </Link>
      </p>
    </div>
  );
}
