// src/app/(app)/flota/setari/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { FileModul } from "@/components/ui/file-modul";
import { FILE_FLOTA } from "@/config/file-module";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import {
  candidatiResponsabiliFlota,
  PLAFON_CANDIDATI_RESPONSABILI,
  setariFlota,
} from "@/lib/queries/fleet";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
// F12d (0216): setările rezervărilor și cererile încă nedecise.
import { todayInBucharest } from "@/lib/format/date";
import { numarRezervariDeAprobat, setarileRezervarilor } from "@/lib/queries/fleet-rezervari";

import { FormularSetariFlota } from "./formular-setari-flota";

export const metadata: Metadata = { title: "Setări parc auto" };

/**
 * Setările flotei (0201, `fleet_settings`): responsabilii de flotă, pragurile
 * de alertă la scadență și pragul de salt al kilometrajului.
 *
 * Poarta e `vehicles:update = all`, EXACT poarta bazei (`fleet_settings_insert`/
 * `_update`). Managerul și angajatul citesc setările (pragul de salt explică
 * anomaliile), dar un formular arătat lor ar cădea tăcut pe USING.
 */
export default async function PaginaSetariFlota() {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "vehicles:update", "all")) {
    return (
      <AccesRestrictionat mesaj="Setările parcului auto le schimbă administratorul organizației." />
    );
  }

  const [setari, rezervari, rezervariInAsteptare] = await Promise.all([
    setariFlota(tenant.organizationId),
    setarileRezervarilor(tenant.organizationId),
    numarRezervariDeAprobat(tenant.organizationId, null, todayInBucharest()),
  ]);
  const candidati = await candidatiResponsabiliFlota(tenant.organizationId, setari.responsabili);

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Setări parc auto"
        descriere="Cine primește alertele de scadență și foile de aprobat, cu câte zile înainte de expirare pleacă alertele și când un kilometraj e un salt de verificat."
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
      />
      <div className={LATIMI.formular}>
        <FormularSetariFlota
          setari={setari}
          candidati={candidati}
          rezervari={rezervari}
          rezervariInAsteptare={rezervariInAsteptare}
        />
        {candidati.length >= PLAFON_CANDIDATI_RESPONSABILI ? (
          <p className="text-muted-foreground text-corp mt-3">
            Se arată primii {PLAFON_CANDIDATI_RESPONSABILI} de angajați, în ordinea numelui.
          </p>
        ) : null}
      </div>
    </div>
  );
}
