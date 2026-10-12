// src/app/(app)/flota/foi/[id]/soferul-foii.tsx
import Link from "next/link";
import type { ReactElement } from "react";

import { legaturaSigura } from "@/config/porti-ruta";
import { getEnabledFeatures } from "@/lib/auth/features";
import type { PermissionMap } from "@/lib/auth/permissions";
import type { CursaPentruVerificare, VehiculPentruPermis } from "@/domain/fleet/soferi";
import { formatDate, toBucharestDateString } from "@/lib/format/date";
import {
  deplasareaFoii,
  deplasariPentruFoaie,
  vehiculPentruPermis,
  type OptiuneDeplasare,
} from "@/lib/queries/soferi";
import type { CategorieVehicul } from "@/schemas/fleet";
import { ETICHETE_STATUS_DEPLASARE } from "@/app/(app)/diurna/etichete";
import type { StatusDeplasare } from "@/schemas/per-diem";

import { AvertismenteSofer } from "../../avertismente-sofer";
import { LegaturaDeplasare } from "./legatura-deplasare";

/**
 * Șoferul foii (0204, F9), într-un singur loc pentru fișa foii din aplicație și
 * pentru cea din portal: verificările încrucișate (concediu, contract, permis,
 * aviz, deplasare fără delegație) și legătura foii cu deplasarea.
 *
 * Componentă de SERVER, cu citirile ei: paginile foii se schimbă și în alte
 * faze ale flotei, iar aici le atinge un singur rând.
 */
interface Proprietati {
  readonly organizationId: string;
  readonly foaie: Readonly<{
    id: string;
    employee_id: string | null;
    data: string | null;
    plecare_la: string;
    vehicle_id: string;
    vehicul_categorie: CategorieVehicul | null;
  }>;
  readonly curse: readonly CursaPentruVerificare[];
  /** Ciorna pe care apelantul o poate scrie: doar atunci se schimbă legătura. */
  readonly editabil: boolean;
  /** Harta paginii; modulele le citește componenta (cerere memoizată prin `cache`). */
  readonly permisiuni: PermissionMap;
  /** Unde se deschide deplasarea: `/diurna` în aplicație, `/portal/diurna-mea` în portal. */
  readonly bazaDeplasare: "/diurna" | "/portal/diurna-mea";
}

function eticheta(d: OptiuneDeplasare): string {
  const stare = ETICHETE_STATUS_DEPLASARE[d.status as StatusDeplasare] ?? d.status;
  const unde = d.localitate === null ? "" : ` · ${d.localitate}`;
  const cand =
    d.plecare_la === "" ? "" : ` · ${formatDate(toBucharestDateString(new Date(d.plecare_la)))}`;
  return `${d.numar_document ?? d.scop}${unde}${cand}${stare === "" ? "" : ` (${stare.toLowerCase()})`}`;
}

export async function SoferulFoii({
  organizationId,
  foaie,
  curse,
  editabil,
  permisiuni,
  bazaDeplasare,
}: Proprietati): Promise<ReactElement | null> {
  const zi = foaie.data ?? toBucharestDateString(new Date(foaie.plecare_la));
  const moduleActive = await getEnabledFeatures(organizationId);
  const contextPorti = { features: moduleActive, permissions: permisiuni };
  const areDiurna = moduleActive.has("per_diem");

  const [vehiculul, legata, optiuni] = await Promise.all([
    vehiculPentruPermis(organizationId, foaie.vehicle_id),
    areDiurna ? deplasareaFoii(organizationId, foaie.id) : Promise.resolve(null),
    areDiurna && editabil && foaie.employee_id !== null
      ? deplasariPentruFoaie(organizationId, foaie.employee_id, zi)
      : Promise.resolve([]),
  ]);
  // Vehiculul pe care apelantul nu-l mai vede: instantaneul foii dă categoria.
  const vehicul: VehiculPentruPermis | null =
    vehiculul ??
    (foaie.vehicul_categorie === null
      ? null
      : { categorie: foaie.vehicul_categorie, masa_maxima_kg: null, numar_locuri: null });

  const optiuniLegatura = [
    ...(legata !== null && !optiuni.some((o) => o.id === legata.id) ? [legata] : []),
    ...optiuni,
  ].map((d) => ({ id: d.id, eticheta: eticheta(d) }));
  const hrefLegata =
    legata === null ? null : legaturaSigura(`${bazaDeplasare}/${legata.id}`, contextPorti);

  return (
    <>
      <AvertismenteSofer
        organizationId={organizationId}
        employeeId={foaie.employee_id}
        zi={zi}
        vehicul={vehicul}
        curse={curse}
        legataDeDeplasare={legata !== null}
      />

      {!areDiurna || (legata === null && !editabil) ? null : (
        <section aria-label="Deplasarea foii" className="text-corp space-y-2">
          {legata === null ? null : (
            <p>
              <span className="text-muted-foreground">Deplasarea: </span>
              {hrefLegata === null ? (
                eticheta(legata)
              ) : (
                <Link href={hrefLegata} className="underline underline-offset-2">
                  {eticheta(legata)}
                </Link>
              )}
            </p>
          )}
          {editabil && foaie.employee_id !== null ? (
            optiuniLegatura.length === 0 ? (
              <p className="text-muted-foreground">
                Șoferul nu are o deplasare în jurul zilei foii. Dacă drumul e în afara localității,
                deplasarea (delegația) se înregistrează la Diurnă.
              </p>
            ) : (
              <LegaturaDeplasare
                foaieId={foaie.id}
                legataId={legata?.id ?? null}
                optiuni={optiuniLegatura}
              />
            )
          ) : null}
        </section>
      )}
    </>
  );
}
