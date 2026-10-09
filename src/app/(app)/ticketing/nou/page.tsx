// src/app/(app)/ticketing/nou/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { listeazaObiecteleMele } from "@/lib/queries/ticketing";
import { fisaProprie } from "@/lib/queries/portal";

import { FormularTichet } from "./formular-tichet";
import { StareGoala } from "@/components/ui/stare-goala";
import { LifeBuoy } from "lucide-react";

export const metadata: Metadata = { title: "Tichet nou" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaginaTichetNou({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "ticketing"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "tickets:create", "own")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a deschide tichete." />;
  }

  // Fișa proprie, ca să știm ce obiecte are în primire. `fisaProprie` citește
  // prin RLS — politica de pe `employees` îi permite fiecăruia propria fișă,
  // deci nu e nevoie să ocolim nimic.
  const fisa = await fisaProprie(tenant.organizationId, user.id);
  if (fisa === null) {
    // `creeazaTichet` refuză fără fișă (`fisaMea`); formularul complet ar fi
    // fost o promisiune refuzată abia la trimitere.
    return (
      <div className={cn(LATIMI.formular, "space-y-6")}>
        <AntetPagina titlu="Tichet nou" />
        <StareGoala
          fel="restrictionata"
          pictograma={LifeBuoy}
          titlu="Contul nu are fișă de personal"
          descriere="Tichetele se leagă de fișa de angajat a solicitantului, iar contul dumneavoastră nu are una."
          actiune={{ eticheta: "Înapoi la tichete", href: "/ticketing" }}
        />
      </div>
    );
  }

  const obiecte = fisa === null ? [] : await listeazaObiecteleMele(fisa.id);
  const parametri = await searchParams;
  const modul = typeof parametri["modul"] === "string" ? parametri["modul"] : "";
  // `?obiect=<id>`: doar un obiect pe care omul chiar îl are în primire.
  const obiectBrut = parametri["obiect"];
  const obiectImplicit =
    typeof obiectBrut === "string" && obiecte.some((o) => o.id === obiectBrut) ? obiectBrut : null;

  return (
    <div className={cn(LATIMI.formular, "space-y-6")}>
      <AntetPagina
        titlu="Tichet nou"
        descriere="Solicitările merg la managerul tău direct sau la administrator. Problemele din aplicație ajung direct la echipa care o dezvoltă."
      />

      <FormularTichet
        obiecteAlocate={obiecte}
        modulCurent={modul}
        obiectImplicit={obiectImplicit}
      />
    </div>
  );
}
