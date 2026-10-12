// src/app/(app)/puncte-lucru/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MapPin, Printer } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { idDinRuta } from "@/lib/rute/parametri";
import { IstoricModificari } from "@/components/audit/istoric-modificari";

import { ActiuniPunctLucru } from "../actiuni-punct-lucru";

export const metadata: Metadata = { title: "Punct de lucru" };

interface PunctLucru {
  readonly id: string;
  readonly denumire: string;
  readonly adresa: string | null;
  readonly judet: string | null;
  readonly oras: string | null;
  readonly cod_postal: string | null;
  readonly sediu_principal: boolean;
  readonly activ: boolean;
  readonly observatii: string | null;
  readonly cod_pontaj: string | null;
}

/**
 * Fișa punctului de lucru.
 *
 * Punctul de lucru n-avea adresă proprie: lista avea ancora `#punct-<id>` și
 * `?punct=`, dar nimic nu putea deschide UN punct ca pe o entitate (analiza
 * 2026-10-08, puncte-lucru-P9). Aceeași poartă ca lista (`departments:read`
 * nenul); rândul vine prin `puncte_lucru_select`, deci pentru cine nu-l vede
 * nu există (404). Legăturile spre celelalte module trec fiecare prin poarta
 * paginii-țintă, cu cifra numărată pe același predicat ca lista-țintă.
 */
export default async function PaginaPunctLucru({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const id = idDinRuta((await params).id);
  const { tenant } = await requireTenant();
  const [, permisiuni, module] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
  ]);

  const scopePuncteLucru = scopeFor(permisiuni, "departments:read");
  if (scopePuncteLucru === null || scopePuncteLucru === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta punctele de lucru." />;
  }

  const db = await createServerSupabase();
  const { data: punct, error } = await db
    .from("puncte_lucru")
    .select(
      "id, denumire, adresa, judet, oras, cod_postal, sediu_principal, activ, observatii, cod_pontaj",
    )
    .eq("organization_id", tenant.organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<PunctLucru>();
  if (error !== null) throw error;
  if (punct === null) notFound();

  const poateEdita = can(permisiuni, "departments:update", "all");
  const poateVedeaEchipamente =
    module.has("maintenance") && can(permisiuni, "maintenance:read", "team");
  const poateVedeaContractele = scopeFor(permisiuni, "employees:read") === "all";
  const poateVedeaCoduriQr = module.has("attendance") && poateEdita;

  const [echipamente, contracte] = await Promise.all([
    poateVedeaEchipamente
      ? db
          .from("equipment")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", tenant.organizationId)
          .eq("punct_lucru_id", punct.id)
          .is("deleted_at", null)
          .then(({ count }) => count ?? 0)
      : Promise.resolve(null),
    poateVedeaContractele
      ? db
          .from("employment_contracts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", tenant.organizationId)
          .eq("punct_lucru_id", punct.id)
          .eq("status", "activ")
          .is("deleted_at", null)
          .then(({ count }) => count ?? 0)
      : Promise.resolve(null),
  ]);

  const adresa =
    [punct.adresa, punct.oras, punct.judet, punct.cod_postal].filter(Boolean).join(", ") ||
    "Fără adresă completată.";

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <AntetPagina
        firimituri={[
          {
            eticheta: "Puncte de lucru",
            href: `/puncte-lucru?punct=${punct.id}#punct-${punct.id}`,
          },
          { eticheta: punct.denumire },
        ]}
        titlu={punct.denumire}
        descriere={adresa}
        actiuni={
          <>
            {punct.sediu_principal ? <Badge ton="neutru">Sediu principal</Badge> : null}
            {punct.activ ? null : <Badge ton="atentie">Inactiv</Badge>}
            {/* Afișul poartă codul în clar: aceeași poartă ca pagina lui. */}
            {poateEdita && punct.cod_pontaj !== null ? (
              <Link
                href={`/puncte-lucru/${punct.id}/afis`}
                className={buton({ varianta: "secundar" })}
              >
                <Printer aria-hidden="true" className="size-4" />
                Afișul de pontare
              </Link>
            ) : null}
          </>
        }
      />

      <section className="border-border bg-surface rounded-panou border p-4">
        <ListaDefinitii
          coloane={2}
          textNecompletat="—"
          definitii={[
            { eticheta: "Adresă", valoare: punct.adresa },
            { eticheta: "Localitate", valoare: punct.oras },
            { eticheta: "Județ", valoare: punct.judet },
            { eticheta: "Cod poștal", valoare: punct.cod_postal, identificator: true },
            {
              eticheta: "Cod de pontare",
              valoare: poateEdita
                ? punct.cod_pontaj === null
                  ? "fără cod — nu se poate ponta prin acest punct"
                  : "generat"
                : null,
            },
            { eticheta: "Observații", valoare: punct.observatii, lat: true },
          ]}
        />
      </section>

      <nav aria-label="Legături" className="text-corp flex flex-wrap gap-x-4 gap-y-1">
        {poateVedeaEchipamente ? (
          <Link
            href={`/mentenanta/echipamente?punct_lucru=${punct.id}`}
            className="underline-offset-2 hover:underline"
          >
            <MapPin aria-hidden="true" className="mr-1 inline size-3.5" />
            Echipamente aici ({echipamente ?? 0})
          </Link>
        ) : null}
        {poateVedeaContractele ? (
          <Link
            href={`/angajati?punct_lucru=${punct.id}`}
            className="underline-offset-2 hover:underline"
          >
            Angajați cu contract aici ({contracte ?? 0})
          </Link>
        ) : null}
        {poateVedeaCoduriQr ? (
          <Link href="/pontaj/setari/coduri-qr" className="underline-offset-2 hover:underline">
            Codurile QR de pontare
          </Link>
        ) : null}
      </nav>

      {poateEdita ? (
        <section className="border-border bg-surface rounded-panou border p-4">
          {/* Codul nu traversează granița server/client: componenta primește
              doar faptul că EXISTĂ (vezi nota din lista punctelor). */}
          <ActiuniPunctLucru
            punct={{
              id: punct.id,
              denumire: punct.denumire,
              adresa: punct.adresa,
              judet: punct.judet,
              oras: punct.oras,
              cod_postal: punct.cod_postal,
              sediu_principal: punct.sediu_principal,
              activ: punct.activ,
              observatii: punct.observatii,
              areCodPontaj: punct.cod_pontaj !== null,
            }}
            poateEdita={poateEdita}
          />
        </section>
      ) : null}

      <IstoricModificari tenant={tenant} entityId={punct.id} />
    </div>
  );
}
