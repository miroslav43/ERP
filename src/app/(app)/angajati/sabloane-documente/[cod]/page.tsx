// src/app/(app)/angajati/sabloane-documente/[cod]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { citesteSablonDocument } from "@/lib/queries/sabloane-documente";
import { ETICHETE_SABLON, VARIABILE_PER_COD, esteCodInrolare } from "@/lib/documents/variabile";

import { FormularSablon } from "../formular-sablon";

export const metadata: Metadata = { title: "Editare șablon" };

export default async function PaginaEditareSablon({
  params,
}: Readonly<{ params: Promise<{ cod: string }> }>) {
  const { cod } = await params;
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "employees:update", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a modifica șabloanele de documente." />
      </div>
    );
  }

  // Ruta e deschisă pentru orice text: fără garda asta, un `cod` inventat ar
  // ajunge la `VARIABILE_PER_COD[cod]` și ar da o paletă goală, adică un editor
  // în care nicio variabilă nu e permisă — un ecran fără nicio explicație.
  if (!esteCodInrolare(cod)) notFound();

  const supabase = await createServerSupabase();
  const sablon = await citesteSablonDocument(supabase, tenant.organizationId, cod);
  if (sablon === null) notFound();

  const esteClona = sablon.organization_id === null;

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <AntetPagina
        titlu={ETICHETE_SABLON[cod]}
        descriere="Modificarea se aplică documentelor emise de acum înainte. Documentele deja emise păstrează textul cu care au fost emise."
        firimituri={[
          { eticheta: "Angajați", href: "/angajati" },
          { eticheta: "Șabloane", href: "/angajati/sabloane-documente" },
          { eticheta: ETICHETE_SABLON[cod] },
        ]}
      />

      <Callout fel="atentie" titlu="Textul nu este avizat juridic">
        Verificați cu un jurist orice modificare pe care o faceți aici înainte de a o folosi la
        contracte reale. Formatarea disponibilă e cea care ajunge efectiv în PDF: titluri de
        secțiune, paragrafe, text îngroșat și liste.
      </Callout>

      <FormularSablon
        cod={cod}
        denumire={sablon.denumire}
        continutInitial={sablon.continut_html}
        variabile={VARIABILE_PER_COD[cod]}
        esteClona={esteClona}
      />
    </div>
  );
}
