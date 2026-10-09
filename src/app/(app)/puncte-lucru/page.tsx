// src/app/(app)/puncte-lucru/page.tsx
import type { Metadata } from "next";
import { MapPin } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";

import { ActiuniPunctLucru } from "./actiuni-punct-lucru";
import { FormularPunctLucruNou } from "./formular-punct-lucru-nou";
import Link from "next/link";
import { cn } from "@/lib/ui/cn";

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
  /**
   * NU se selectează `cod_pontaj` însuși: e un secret operațional, iar lista se
   * randează pentru oricine are `departments:read`. Ecranul are nevoie doar să
   * știe DACĂ există, ca să aleagă între „Generează" și „Rotește".
   */
  readonly cod_pontaj: string | null;
}

export default async function PaginaPuncteLucru({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant } = await requireTenant();
  // Patru dus-întorsuri seriale spre PostgREST deveneau patru niveluri:
  // requireFeature, getPermissionMap, createServerSupabase și selectul
  // propriu-zis. Ultimele două rămân un lanț (selectul are nevoie de client),
  // dar lanțul pleacă în același val cu primele două — patru niveluri devin
  // două.
  const [, permisiuni, module, rezultatPuncte] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
    createServerSupabase().then((db) =>
      db
        .from("puncte_lucru")
        .select(
          "id, denumire, adresa, judet, oras, cod_postal, sediu_principal, activ, observatii, cod_pontaj",
        )
        .eq("organization_id", tenant.organizationId)
        .is("deleted_at", null)
        .order("sediu_principal", { ascending: false })
        .order("denumire")
        .returns<RandPunctLucru[]>(),
    ),
  ]);

  // CORECTAT: `getPermissionMap` scoate `none` din hartă (`permissions.ts`),
  // iar `scopeFor` întoarce `null` pentru o cheie absentă — comparația doar cu
  // `"none"` nu era NICIODATĂ adevărată, deci poarta nu refuza pe nimeni. Un
  // `manager` (fără niciun rând `departments:*` în seed) trecea și primea un
  // ecran gol. Forma corectă e în `/departamente`.
  const scopePuncteLucru = scopeFor(permisiuni, "departments:read");
  if (scopePuncteLucru === null || scopePuncteLucru === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta punctele de lucru." />;
  }

  const poateCrea = can(permisiuni, "departments:create", "all");
  const poateEdita = can(permisiuni, "departments:update", "all");

  const { data, error } = rezultatPuncte;
  if (error !== null) throw error;

  const puncte = data ?? [];

  // `?punct=<id>` = rândul la care a trimis alt ecran, evidențiat pe server
  // (`:target` nu se aprinde după o navigare din client); `#punct-<id>` derulează.
  const parametri = await searchParams;
  const punctBrut = parametri["punct"];
  const punctEvidentiat = typeof punctBrut === "string" ? punctBrut : null;

  // Ce atârnă de fiecare punct în alte module, numărat pe server cu `count`
  // exact (fără rânduri) — DOAR acolo unde linkul se va și afișa, adică unde
  // pagina-țintă se deschide pentru rolul ăsta.
  const poateVedeaEchipamente =
    module.has("maintenance") && can(permisiuni, "maintenance:read", "team");
  const poateVedeaContractele = scopeFor(permisiuni, "employees:read") === "all";
  const poateVedeaCoduriQr = module.has("attendance") && poateEdita;
  const db = await createServerSupabase();
  const numaratori = new Map(
    await Promise.all(
      puncte.map(async (punct) => {
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
        return [punct.id, { echipamente, contracte }] as const;
      }),
    ),
  );

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Puncte de lucru"
        descriere="Locațiile fizice ale companiei — sedii, fabrici, birouri. Fiecare punct leagă contractele, echipamentele și codul QR de pontare de la el."
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
              id={`punct-${punct.id}`}
              className={cn(
                "border-border bg-surface rounded-panou shadow-ridicat scroll-mt-24 border",
                punctEvidentiat === punct.id && "ring-primary ring-2",
              )}
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
                  {/* `observatii` se citea din bază de la început și nu se
                      randa nicăieri, iar formularul de creare trimitea `null`
                      fix — coloana era moartă în ambele sensuri. */}
                  {punct.observatii === null ? null : (
                    <p className="text-foreground text-nota mt-1">{punct.observatii}</p>
                  )}
                  {/* Ce ține de punct în celelalte module — fiecare link doar
                      unde pagina-țintă se deschide, cu cifra numărată pe același
                      predicat ca lista-țintă. */}
                  <p className="text-nota mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {poateVedeaEchipamente ? (
                      <Link
                        href={`/mentenanta/echipamente?punct_lucru=${punct.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        Echipamente aici ({numaratori.get(punct.id)?.echipamente ?? 0})
                      </Link>
                    ) : null}
                    {poateVedeaContractele ? (
                      <Link
                        href={`/angajati?punct_lucru=${punct.id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        Angajați cu contract aici ({numaratori.get(punct.id)?.contracte ?? 0})
                      </Link>
                    ) : null}
                    {poateVedeaCoduriQr ? (
                      <Link
                        href="/pontaj/setari/coduri-qr"
                        className="underline-offset-2 hover:underline"
                      >
                        Cod QR în pontaj
                      </Link>
                    ) : null}
                  </p>
                </div>
              </div>
              {poateEdita ? (
                <div className="border-border bg-background border-t px-4 py-2">
                  {/* Codul nu traversează granița server/client: componenta
                      primește doar faptul că EXISTĂ. Trimis întreg, ar ajunge în
                      sursa paginii, unde îl vede oricine deschide DevTools. */}
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
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
