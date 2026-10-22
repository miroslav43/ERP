// src/app/(app)/flota/rapoarte/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { FileModul } from "@/components/ui/file-modul";
import { Schelet } from "@/components/ui/schelet";
import { FILE_FLOTA } from "@/config/file-module";
import { poateDeschide } from "@/config/porti-ruta";
import { lunaDinZi, lunaMutata } from "@/domain/fleet/rapoarte";
import { requireFeature, getEnabledFeatures } from "@/lib/auth/features";
import { getPermissionMap } from "@/lib/auth/permissions";
import { todayInBucharest } from "@/lib/format/date";
import { optiuniVehicule } from "@/lib/queries/fleet-rapoarte";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreRaportSchema } from "@/schemas/fleet-rapoarte";

import { poateExportaFlota, poateVedeaRapoarte } from "./acces";
import { ContinutRaport } from "./continut-raport";
import { ExportContabil } from "./export-contabil";
import { NavigareLuna } from "./navigare-luna";

export const metadata: Metadata = { title: "Rapoarte parc auto" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Rapoartele flotei pe o LUNĂ (F8): costul pe vehicul, consumul față de normă și
 * kilometrii pe șofer, toate din foile APROBATE. Luna e mereu în filtru.
 *
 * Poarta e `vehicles:read = all` ȘI `trip_sheets:read = all` (`poateVedeaRapoarte`).
 * Rapoartele sunt agregate pe toată flota: la `team`, RLS ar tăia tăcut vehiculele
 * și foile la echipă, iar o cifră parțială arată la fel ca una întreagă. Managerul
 * nu are deci ecranul, în loc să primească jumătate de raport. Descărcările cer în
 * plus `vehicles:export`; tot ele deschid exportul pentru contabilitate (F12g),
 * care primește implicit luna trecută când pagina stă pe luna curentă.
 */
export default async function PaginaRapoarteFlota({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!poateVedeaRapoarte(permisiuni)) {
    return (
      <AccesRestrictionat mesaj="Rapoartele parcului auto cer dreptul de a vedea toate vehiculele și toate foile de parcurs. Le consultă administratorul organizației." />
    );
  }

  const { luna, vehicul } = filtreDinUrl(filtreRaportSchema, await searchParams);
  const [vehicule, moduleActive] = await Promise.all([
    optiuniVehicule(tenant.organizationId),
    getEnabledFeatures(tenant.organizationId),
  ]);

  const azi = todayInBucharest();
  const poateExporta = poateExportaFlota(permisiuni);
  const lunaContabil = luna === lunaDinZi(azi) ? lunaMutata(luna, -1) : luna;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Rapoarte parc auto"
        descriere="Cât a costat flota, cât a consumat față de norma proprie și câți kilometri a făcut fiecare șofer, pe luna aleasă."
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
      />
      <NavigareLuna luna={luna} vehicul={vehicul} azi={azi} vehicule={vehicule} />
      {poateExporta ? (
        <ExportContabil
          organizationId={tenant.organizationId}
          azi={azi}
          lunaImplicita={lunaContabil}
        />
      ) : null}
      <Suspense key={`${luna}|${vehicul ?? ""}`} fallback={<Schelet forma="tabel" coloane={6} />}>
        <ContinutRaport
          organizationId={tenant.organizationId}
          luna={luna}
          vehicul={vehicul}
          poateExporta={poateExporta}
          poateAproba={poateDeschide("/flota/aprobari", {
            features: moduleActive,
            permissions: permisiuni,
          })}
        />
      </Suspense>
    </div>
  );
}
