// src/app/(app)/angajati/sabloane-documente/nou/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { VARIABILE_TOATE } from "@/lib/documents/variabile";

import { FormularSablon } from "../formular-sablon";

export const metadata: Metadata = { title: "Șablon nou" };

/**
 * Textul de pornire: un schelet, nu o pagină goală.
 *
 * Arată din prima cum arată o variabilă în text — altfel omul vede un editor
 * gol și o paletă de 28 de chip-uri, fără să știe că trebuie doar să dea clic.
 */
const SCHELET = [
  "<h2>Titlul secțiunii</h2>",
  "<p>Subsemnatul/Subsemnata {{angajat_nume}}, angajat/ă al/a {{organizatie_denumire}} în funcția de {{functie}}, ...</p>",
  "<p>Data: {{data_document}}</p>",
].join("");

export default async function PaginaSablonNou() {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // Aceeași poartă ca `creeazaSablonPersonalizat` și ca `hr_templates_insert`.
  if (!can(permisiuni, "employees:create", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a crea șabloane de documente." />
      </div>
    );
  }

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <AntetPagina
        titlu="Șablon nou"
        descriere="Un document propriu al firmei — o cerere, o notificare, o decizie. După creare îl emiteți din fișa oricărui angajat, cu datele lui completate automat."
        firimituri={[
          { eticheta: "Angajați", href: "/angajati" },
          { eticheta: "Șabloane", href: "/angajati/sabloane-documente" },
          { eticheta: "Șablon nou" },
        ]}
      />

      <Callout fel="informativ" titlu="Toate variabilele sunt disponibile">
        Un document al firmei poate folosi orice dată din fișa angajatului și din contractul lui de
        bază. La emitere, angajatul trebuie să aibă un contract activ. Datele lipsă din fișă apar pe
        document ca „nespecificat”, nu blochează emiterea.
      </Callout>

      <FormularSablon
        cod={null}
        denumire=""
        continutInitial={SCHELET}
        variabile={VARIABILE_TOATE}
        esteClona={false}
      />
    </div>
  );
}
