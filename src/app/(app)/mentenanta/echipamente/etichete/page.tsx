// src/app/(app)/mentenanta/echipamente/etichete/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { Callout } from "@/components/ui/callout";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreDinUrl } from "@/lib/rute/parametri";
import {
  echipamenteDupaId,
  listeazaEchipamente,
  planuriEchipament,
  type RandEchipament,
} from "@/lib/queries/maintenance";
import { filtreEchipamenteSchema } from "@/schemas/maintenance";

import { ButonTiparEtichete } from "../buton-tipar-etichete";
import { EtichetaQr } from "../eticheta-qr";

export const metadata: Metadata = { title: "Etichete QR" };

/** Cel mult atâtea etichete pe o tipărire: o foaie A4 ia șase, o sută e deja un teanc. */
const MAXIM_ETICHETE = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Etichetele QR pentru LISTA filtrată (aceleași chei de URL ca lista) sau pentru
 * o selecție explicită (`?ids=a,b,c`). Se tipăresc din browser, șase pe foaie.
 */
export default async function PaginaEticheteEchipamente({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  if (!can(permisiuni, "maintenance:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a tipări etichete de echipament." />;
  }

  const parametri = await searchParams;
  const idsBrut = typeof parametri["ids"] === "string" ? parametri["ids"] : "";
  const ids = idsBrut
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID.test(s))
    .slice(0, MAXIM_ETICHETE);

  let echipamente: readonly RandEchipament[] = [];
  let trunchiat = false;
  if (ids.length > 0) {
    const harta = await echipamenteDupaId(tenant.organizationId, ids);
    echipamente = ids.map((i) => harta.get(i)).filter((e): e is RandEchipament => e !== undefined);
  } else {
    const filtre = filtreDinUrl(filtreEchipamenteSchema, parametri);
    let cursor: string | null = null;
    const adunate: RandEchipament[] = [];
    // Paginare keyset până la plafon: lista filtrată poate avea mai mult de o pagină.
    for (let pagina = 0; pagina < 5 && adunate.length < MAXIM_ETICHETE; pagina += 1) {
      const rezultat = await listeazaEchipamente(tenant.organizationId, {
        ...filtre,
        cursor,
        limita: 100,
      });
      adunate.push(...rezultat.randuri);
      cursor = rezultat.urmatorulCursor;
      if (cursor === null) break;
    }
    trunchiat = adunate.length > MAXIM_ETICHETE || cursor !== null;
    echipamente = adunate.filter((e) => e.status !== "casat").slice(0, MAXIM_ETICHETE);
  }

  // Dovada HG 1146 pe eticheta utilajelor folosite în afara sediului: ultima
  // verificare legală și scadența ei, din planurile `verificare_legala`.
  const legale = new Map<string, Readonly<{ ultima: string | null; urmatoarea: string | null }>>();
  await Promise.all(
    echipamente
      .filter((e) => e.folosit_in_afara_sediului)
      .map(async (e) => {
        const planuri = await planuriEchipament(tenant.organizationId, e.id);
        const legal = planuri.find((p) => p.tip === "verificare_legala" && p.activ) ?? null;
        legale.set(e.id, {
          ultima: legal?.ultima_executie ?? null,
          urmatoarea: legal?.urmatoarea_scadenta ?? null,
        });
      }),
  );

  return (
    <div className="space-y-6 p-4">
      <div className="print:hidden">
        <p className="text-muted-foreground text-corp">
          <Link href="/mentenanta/echipamente" className="underline-offset-2 hover:underline">
            Echipamente
          </Link>
          {" / Etichete QR"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ButonTiparEtichete cate={echipamente.length} />
          <p className="text-muted-foreground text-corp">
            Șase etichete pe o foaie A4. Lipiți-le pe utilaje, într-un loc vizibil și ferit de ulei.
          </p>
        </div>
        {trunchiat ? (
          <Callout
            fel="atentie"
            titlu={`Doar primele ${String(MAXIM_ETICHETE)} echipamente`}
            className="mt-3"
          >
            Lista filtrată e mai lungă. Restrângeți filtrele (categorie, punct de lucru) și tipăriți
            în mai multe rânduri.
          </Callout>
        ) : null}
      </div>

      {echipamente.length === 0 ? (
        <p className="text-muted-foreground text-corp">Niciun echipament de etichetat.</p>
      ) : (
        <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
          {echipamente.map((e) => (
            <EtichetaQr
              key={e.id}
              date={{
                id: e.id,
                cod: e.cod,
                denumire: e.denumire,
                locatie: e.locatie,
                ultimaVerificare: legale.get(e.id)?.ultima ?? null,
                urmatoareaScadenta: legale.get(e.id)?.urmatoarea ?? null,
                folositInAfaraSediului: e.folosit_in_afara_sediului,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
