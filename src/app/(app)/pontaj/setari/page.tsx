// src/app/(app)/pontaj/setari/page.tsx
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { todayInBucharest } from "@/lib/format/date";
import { afiseDePontare, setariPontaj, setariPontareRapida } from "@/lib/queries/attendance";
import { configZiDin } from "@/domain/attendance/calcul-ore";
import { configPontareRapida } from "@/domain/attendance/pontare-rapida";

import { FormularPontareRapida } from "./formular-pontare-rapida";
import { NavSetariPontaj } from "./nav-setari";

export const metadata: Metadata = { title: "Pontarea" };

/**
 * Fila operațională a setărilor de pontaj: cum se pontează de pe telefon.
 *
 * ── DE CE E O PAGINĂ SEPARATĂ DE „REGULILE DE TIMP" ─────────────────────────
 * Cele trei setări de aici stăteau în formularul parametrilor juridici, care e
 * o scriere VERSIONATĂ prin `valabil_de_la`. Pornirea butonului de pontare
 * cerea, deci, reconfirmarea a optsprezece cifre de dreptul muncii și alegerea
 * unei date de intrare în vigoare — pentru o alegere care n-are istoric și
 * n-are ce reconstitui pentru o lună trecută.
 *
 * Fila asta e prima fiindcă e cea care se atinge des; regulile juridice se
 * confirmă o dată pe an, cu un jurist alături.
 */
export default async function PaginaSetariPontare() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "attendance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "attendance:update", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a configura parametrii de pontaj." />
      </div>
    );
  }

  const [randPontare, afise, setari] = await Promise.all([
    setariPontareRapida(tenant.organizationId),
    afiseDePontare(tenant.organizationId),
    setariPontaj(tenant.organizationId, todayInBucharest()),
  ]);

  return (
    <div className={cn(LATIMI.formular, "space-y-6")}>
      <div className="space-y-2">
        <p className="text-muted-foreground text-corp">
          <Link href="/pontaj" className="underline-offset-2 hover:underline">
            Pontaj
          </Link>
        </p>
        <AntetPagina
          titlu="Setări pontaj"
          descriere="Cum își pontează angajații ziua de pe telefon."
          file={<NavSetariPontaj />}
        />
      </div>

      <FormularPontareRapida
        pontare={configPontareRapida(randPontare)}
        afise={afise}
        // Generarea codului scrie în `puncte_lucru`, deci cere cheia ACELUI
        // modul, nu pe a pontajului. Cele două nu se implică una pe alta:
        // ecranul ăsta se deschide cu `attendance:update`, iar un rol care l-ar
        // avea fără `departments:update` ar apăsa un buton pe care politica
        // `puncte_lucru_update` l-ar refuza cu zero rânduri și fără eroare.
        // Azi cele trei roluri care ajung aici le au pe amândouă la `all`;
        // booleanul ține adevărul și dacă mâine n-o mai fac. — capcana #17
        poateGeneraCod={can(permisiuni, "departments:update", "all")}
        // Norma și pauza în vigoare AZI: intervalul propus de butonul de
        // confirmare se derivă din ele, deci ecranul trebuie să arate exact
        // cifra pe care o va scrie serverul.
        config={configZiDin(setari)}
      />
    </div>
  );
}
