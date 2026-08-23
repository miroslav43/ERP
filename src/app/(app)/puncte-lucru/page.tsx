// src/app/(app)/puncte-lucru/page.tsx
import type { Metadata } from "next";
import { MapPin } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

import { ActiuniPunctLucru } from "./actiuni-punct-lucru";
import { FormularPunctLucruNou } from "./formular-punct-lucru-nou";

export const metadata: Metadata = { title: "Puncte de lucru" };

interface RandPunctLucru {
  readonly id: string;
  readonly denumire: string;
  readonly adresa: string | null;
  readonly judet: string | null;
  readonly oras: string | null;
  readonly cod_postal: string | null;
  readonly sediu_principal: boolean;
  readonly activ: boolean;
  readonly observatii: string | null;
}

export default async function PaginaPuncteLucru() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (scopeFor(permisiuni, "departments:read") === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta punctele de lucru." />;
  }

  const poateCrea = can(permisiuni, "departments:create", "all");
  const poateEdita = can(permisiuni, "departments:update", "all");

  const db = await createServerSupabase();
  const { data, error } = await db
    .from("puncte_lucru")
    .select("id, denumire, adresa, judet, oras, cod_postal, sediu_principal, activ, observatii")
    .eq("organization_id", tenant.organizationId)
    .is("deleted_at", null)
    .order("sediu_principal", { ascending: false })
    .order("denumire")
    .returns<RandPunctLucru[]>();
  if (error !== null) throw error;

  const puncte = data ?? [];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Puncte de lucru"
        descriere="Locațiile fizice ale companiei — sedii, fabrici, birouri. Relevante pentru pontaj (geofencing/terminale per locație) și parc auto."
        {...(poateCrea ? { actiuni: <FormularPunctLucruNou /> } : {})}
      />

      {puncte.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={MapPin}
          titlu="Niciun punct de lucru înregistrat"
          descriere="Adăugați primul punct de lucru — de obicei sediul principal."
        />
      ) : (
        <ul className="space-y-3">
          {puncte.map((punct) => (
            <li
              key={punct.id}
              className="border-border bg-surface rounded-panou shadow-ridicat border"
            >
              <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                <span className="bg-background rounded-control flex size-9 shrink-0 items-center justify-center">
                  <MapPin aria-hidden="true" className="text-primary size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{punct.denumire}</span>
                    {punct.sediu_principal ? (
                      <span className="bg-primary/10 text-primary text-nota rounded-full px-2 py-0.5 font-medium">
                        Sediu principal
                      </span>
                    ) : null}
                    {!punct.activ ? (
                      <span className="bg-background text-muted-foreground text-nota rounded-full px-2 py-0.5 font-medium">
                        Inactiv
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-corp mt-1">
                    {[punct.adresa, punct.oras, punct.judet, punct.cod_postal]
                      .filter(Boolean)
                      .join(", ") || "Fără adresă completată."}
                  </p>
                </div>
              </div>
              {poateEdita ? (
                <div className="border-border bg-background border-t px-4 py-2">
                  <ActiuniPunctLucru punct={punct} poateEdita={poateEdita} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
