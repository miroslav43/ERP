// src/app/(app)/flota/foi/sabloane/page.tsx
import type { Metadata } from "next";
import { Route } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { FileModul } from "@/components/ui/file-modul";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { FILE_FLOTA } from "@/config/file-module";
import type { SablonTraseu } from "@/domain/fleet/foaie";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { PLAFON_SABLOANE, sabloaneTraseu } from "@/lib/queries/fleet";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { ButonStergeSablon } from "./buton-sterge-sablon";
import { DialogSablon } from "./dialog-sablon";

export const metadata: Metadata = { title: "Șabloane de traseu" };

/**
 * Șabloanele de traseu ale firmei (0200): rutele recurente din care șoferii
 * își adaugă cursele.
 *
 * Poarta e `trip_sheets:update = all`, EXACT poarta bazei
 * (`sabloane_traseu_insert`/`_update`): una mai largă ar arăta butoane care
 * cad tăcut pe USING. Șoferii văd șabloanele în caseta „Cursă nouă”, nu aici.
 */
export default async function PaginaSabloane() {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "trip_sheets:update", "all")) {
    return (
      <AccesRestrictionat mesaj="Șabloanele de traseu le administrează responsabilul de flotă. Le găsiți în caseta „Cursă nouă” de pe foaia de parcurs." />
    );
  }

  const sabloane = await sabloaneTraseu(tenant.organizationId);

  const coloane: readonly Coloana<SablonTraseu>[] = [
    {
      cheie: "denumire",
      antet: "Șablon",
      peTelefon: "titlu",
      celula: (s) => <span className="font-medium">{s.denumire}</span>,
    },
    {
      cheie: "ruta",
      antet: "Ruta",
      peTelefon: "meta",
      celula: (s) => `${s.de_la_loc} → ${s.pana_la_loc}`,
    },
    { cheie: "scop", antet: "Scop", peTelefon: "meta", celula: (s) => s.scop },
    {
      cheie: "km",
      antet: "Distanța",
      numeric: true,
      peTelefon: "meta",
      celula: (s) => (s.km_estimat === null ? "—" : `${s.km_estimat.toLocaleString("ro-RO")} km`),
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      peTelefon: "actiuni",
      celula: (s) => (
        <span className="flex justify-end gap-1">
          <DialogSablon sablon={s} />
          <ButonStergeSablon id={s.id} denumire={s.denumire} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Șabloane de traseu"
        descriere="Rutele recurente ale firmei. Șoferul alege una în caseta „Cursă nouă”, iar locurile, scopul și distanța se completează singure."
        actiuni={<DialogSablon sablon={null} />}
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
      />
      {sabloane.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Route}
          titlu="Niciun șablon de traseu"
          descriere="Adăugați rutele pe care mașinile firmei le fac des: sediu — depozit, sediu — client."
        />
      ) : (
        <Tabel
          caption="Șabloanele de traseu ale organizației."
          coloane={coloane}
          randuri={sabloane}
          cheieRand={(s) => s.id}
          gol={null}
        />
      )}
      {sabloane.length >= PLAFON_SABLOANE ? (
        <p className="text-muted-foreground text-corp">
          Se arată primele {PLAFON_SABLOANE} de șabloane, în ordinea numelui.
        </p>
      ) : null}
    </div>
  );
}
