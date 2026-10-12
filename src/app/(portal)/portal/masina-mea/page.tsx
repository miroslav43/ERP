// src/app/(portal)/portal/masina-mea/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Car, ClipboardList } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Paginare } from "@/components/ui/paginare";
import { Scadenta } from "@/components/ui/scadenta";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime, todayInBucharest } from "@/lib/format/date";
import { filtreDinUrl } from "@/lib/rute/parametri";
import {
  foileMele,
  scadenteCurente,
  tipuriDocument,
  vehiculeDupaId,
  vehicululMeu,
  type RandVehicul,
} from "@/lib/queries/fleet";
import { fisaMea } from "@/lib/queries/portal";
import { semaforVehicul } from "@/domain/fleet/scadente";
import { filtreFoiSchema } from "@/schemas/fleet";
import {
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_FOAIE,
  TONURI_STATUS_FOAIE,
} from "@/app/(app)/flota/etichete";
import { DialogFoaieNoua } from "@/app/(app)/flota/foi/dialog-foaie-noua";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Mașina mea" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * „Mașina mea”: vehiculul alocat (sau mașinile comune), semaforul lui și foile
 * șoferului. Corespondentul din portal al lui `/flota/foi*` (harta din
 * `src/config/routes.ts`), pe precedentul `portal/diurna-mea/`.
 *
 * Toate citirile filtrează EXPLICIT pe fișa proprie (antetul din
 * `src/lib/queries/portal.ts`): un administrator care e și șofer are
 * `vehicles:read = all`, iar fără filtru „mașina mea” ar fi tot parcul.
 */
export default async function PaginaMasinaMea({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "trip_sheets:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta foile de parcurs." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;
  const fisaId = stare.fisa.id;

  const parametri = await searchParams;
  const pagina = filtreDinUrl(filtreFoiSchema, parametri);
  // `/portal/masina-mea?foaie=noua` deschide caseta, ca `/flota/foi?foaie=noua`.
  const deschideCaseta = parametri["foaie"] === "noua";
  const poateCrea = can(permisiuni, "trip_sheets:create", "own");
  const poateVedeaMasina = can(permisiuni, "vehicles:read", "own");

  const [masini, foi, tipuri] = await Promise.all([
    poateVedeaMasina
      ? vehicululMeu(tenant.organizationId, fisaId)
      : Promise.resolve({ alocate: [], pool: [] }),
    foileMele(tenant.organizationId, fisaId, { cursor: pagina.cursor, limita: pagina.limita }),
    poateVedeaMasina ? tipuriDocument() : Promise.resolve([]),
  ]);

  const toateMasinile: readonly RandVehicul[] = [...masini.alocate, ...masini.pool];
  // Numărul vehiculului pe foaie se citește separat: foaia de luna trecută poate
  // fi pe o mașină care nu mai e a lui, iar `vehiculeDupaId` trece prin RLS.
  const [scadente, vehiculeFoi] = await Promise.all([
    scadenteCurente(masini.alocate.map((v) => v.id)),
    vehiculeDupaId(
      tenant.organizationId,
      foi.randuri.map((f) => f.vehicle_id),
    ),
  ]);
  const numarVehicul = new Map<string, string>([
    ...[...vehiculeFoi.values()].map((v) => [v.id, v.nr_inmatriculare] as const),
    ...toateMasinile.map((v) => [v.id, v.nr_inmatriculare] as const),
  ]);
  const azi = todayInBucharest();
  const denumireTip = new Map(tipuri.map((t) => [t.id, t.denumire]));
  const obligatorii = tipuri.filter((t) => t.obligatoriu).map((t) => t.id);

  function adresa(cursor: string | null, limita: number): string {
    const p = new URLSearchParams();
    p.set("limita", String(limita));
    if (cursor !== null) p.set("cursor", cursor);
    return `/portal/masina-mea?${p.toString()}`;
  }

  return (
    <div className={`${LATIMI.lista} space-y-6 p-4`}>
      <AntetPagina
        titlu="Mașina mea"
        descriere="Vehiculul primit în folosință, termenele lui și foile dumneavoastră de parcurs."
        {...(poateCrea
          ? {
              actiuni: (
                <DialogFoaieNoua
                  key={deschideCaseta ? "foaie-noua" : "lista"}
                  date={{
                    vehicule: toateMasinile.map((v) => ({
                      id: v.id,
                      nr_inmatriculare: v.nr_inmatriculare,
                      km_curent: v.km_curent,
                    })),
                    angajati: null,
                  }}
                  deschisInitial={deschideCaseta}
                  bazaFoaie="/portal/masina-mea/foi"
                />
              ),
            }
          : {})}
      />

      <section aria-labelledby="titlu-masina" className="space-y-3">
        <h2 id="titlu-masina" className="text-sectiune font-semibold">
          Vehiculul meu
        </h2>
        {masini.alocate.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={Car}
            titlu="Niciun vehicul alocat"
            descriere={
              masini.pool.length === 0
                ? "Când responsabilul de flotă vă predă o mașină, ea apare aici, cu termenele ei."
                : "Nu aveți o mașină a dumneavoastră; foile se pot întocmi pe una dintre mașinile comune de mai jos."
            }
          />
        ) : (
          <ul className="space-y-2">
            {masini.alocate.map((v) => {
              const semafor = semaforVehicul(
                scadente.filter((s) => s.vehicle_id === v.id),
                obligatorii,
                azi,
              );
              return (
                <li key={v.id} className="bg-surface border-border rounded-panou border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-foreground text-corp font-medium">{v.nr_inmatriculare}</p>
                      <p className="text-muted-foreground text-corp mt-0.5">
                        {v.marca} {v.model} · {v.km_curent.toLocaleString("ro-RO")} km
                      </p>
                      <p className="text-muted-foreground text-nota mt-0.5">
                        {semafor.tipId === null
                          ? "Niciun document înregistrat"
                          : `${denumireTip.get(semafor.tipId) ?? "Document"}${
                              semafor.expiraLa === null
                                ? ""
                                : `, expiră la ${formatDate(semafor.expiraLa)}`
                            }`}
                      </p>
                    </div>
                    <Scadenta treapta={semafor.treapta}>
                      {ETICHETE_SCADENTA[semafor.treapta]}
                    </Scadenta>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {masini.pool.length === 0 ? null : (
          <div className="space-y-2">
            <h3 className="text-corp font-medium">Mașini comune</h3>
            <ul className="text-corp text-muted-foreground space-y-1">
              {masini.pool.map((v) => (
                <li key={v.id}>
                  <span className="text-foreground font-medium">{v.nr_inmatriculare}</span> ·{" "}
                  {v.marca} {v.model} · {v.km_curent.toLocaleString("ro-RO")} km
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="titlu-foi" className="space-y-3">
        <h2 id="titlu-foi" className="text-sectiune font-semibold">
          Foile mele
        </h2>
        {foi.randuri.length === 0 ? (
          <StareGoala
            fel="initiala"
            pictograma={ClipboardList}
            titlu="Nicio foaie de parcurs"
            descriere="Foile pe care le întocmiți apar aici, cu kilometrii și starea aprobării."
            {...(poateCrea && toateMasinile.length > 0
              ? { actiune: { eticheta: "Foaie nouă", href: "/portal/masina-mea?foaie=noua" } }
              : {})}
          />
        ) : (
          <>
            <ul className="space-y-2">
              {foi.randuri.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/portal/masina-mea/foi/${f.id}`}
                    className="bg-surface border-border hover:border-ring rounded-panou block border p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground text-corp font-medium">
                          {formatDateTime(new Date(f.plecare_la))}
                        </p>
                        <p className="text-muted-foreground text-corp mt-0.5">
                          {numarVehicul.get(f.vehicle_id) ?? "Vehicul indisponibil"}
                          {f.km_parcursi === null
                            ? " · în curs"
                            : ` · ${f.km_parcursi.toLocaleString("ro-RO")} km`}
                        </p>
                        {f.traseu === null ? null : (
                          <p className="text-muted-foreground text-nota mt-0.5 truncate">
                            {f.traseu}
                          </p>
                        )}
                      </div>
                      <Badge className="shrink-0" ton={TONURI_STATUS_FOAIE[f.status]}>
                        {ETICHETE_STATUS_FOAIE[f.status]}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Paginare
              afisate={foi.randuri.length}
              total={foi.total}
              cursorUrmator={foi.urmatorulCursor}
              limita={pagina.limita}
              construiesteHref={({ cursor, limita }) => adresa(cursor, limita)}
            />
          </>
        )}
      </section>
    </div>
  );
}
