// src/app/(app)/cursuri/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { buton } from "@/components/ui/buton";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  citesteCurs,
  lectiileCursului,
  materialeDisponibile,
  sabloaneCuCursul,
} from "@/lib/queries/cursuri";

import { ConstructorCurs } from "./constructor-curs";
import { poateDeschide } from "@/config/porti-ruta";

export const metadata: Metadata = { title: "Curs" };

export default async function PaginaCurs({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const cursId = idDinRuta(id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "courses"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cursurile firmei." />;
  }

  const curs = await citesteCurs(tenant.organizationId, cursId);
  if (curs === null) notFound();

  const poateEdita = can(permisiuni, "courses:update", "team");
  const poateAtribui = can(permisiuni, "courses:create", "team");

  const db = await createServerSupabase();
  const [lectii, biblioteca, numarInrolati] = await Promise.all([
    lectiileCursului(tenant.organizationId, cursId),
    materialeDisponibile(tenant.organizationId),
    db
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", tenant.organizationId)
      .eq("course_id", cursId)
      .is("deleted_at", null)
      .neq("status", "anulat")
      .then((r) => r.count ?? 0),
  ]);

  // Pașii de integrare legați de curs (0076): retragerea din publicare sau
  // dezactivarea ar rupe tăcut un parcurs; aici se vede pe care.
  const [sabloane, module] = await Promise.all([
    sabloaneCuCursul(tenant.organizationId, cursId),
    getEnabledFeatures(tenant.organizationId),
  ]);
  const poateDeschideSabloane = poateDeschide("/onboarding/sabloane/[id]", {
    features: module,
    permissions: permisiuni,
  });

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu={curs.denumire}
        descriere={curs.descriere ?? "Fără descriere."}
        firimituri={[{ eticheta: "Cursuri", href: "/cursuri" }, { eticheta: curs.denumire }]}
        actiuni={
          <div className="flex flex-wrap gap-2">
            {curs.publicat ? (
              <Badge ton="succes">Publicat</Badge>
            ) : (
              <Badge ton="ciorna">Ciornă</Badge>
            )}
            {/*
              Insigna „Dezactivat" era de neatins: `dezactiveazaCurs` n-avea
              apelant, deci `activ` era mereu `true`. Acum starea se comută din
              `/editare` și trebuie să se VADĂ de aici — altfel administratorul
              află că un curs nu se poate atribui abia din refuzul bazei.
            */}
            {curs.activ ? null : <Badge ton="neutru">Dezactivat</Badge>}
            <Link href={`/cursuri/${cursId}/stadiu`} className={buton({ varianta: "secundar" })}>
              Stadiu
            </Link>
            {poateEdita ? (
              <Link href={`/cursuri/${cursId}/editare`} className={buton({ varianta: "secundar" })}>
                Modifică
              </Link>
            ) : null}
            {poateAtribui ? (
              <Link href={`/cursuri/${cursId}/reguli`} className={buton({ varianta: "secundar" })}>
                Reguli
              </Link>
            ) : null}
            {poateAtribui && curs.publicat ? (
              <Link href={`/cursuri/${cursId}/atribuire`} className={buton({ varianta: "primar" })}>
                Atribuie
              </Link>
            ) : null}
          </div>
        }
      />

      <ListaDefinitii
        coloane={4}
        textNecompletat="—"
        definitii={[
          { eticheta: "Cod", valoare: curs.cod, identificator: true },
          { eticheta: "Obligatoriu", valoare: curs.obligatoriu ? "Da" : "Nu" },
          {
            eticheta: "Termen",
            // `termen_zile` e nullable de la migrarea 0085 („gol = fără
            // termen"). Fără ramura asta, ecranul scria literal „null zile de
            // la atribuire" pe primul curs creat fără termen.
            valoare:
              curs.termen_zile === null
                ? "Fără termen"
                : `${String(curs.termen_zile)} zile de la atribuire`,
          },
          {
            eticheta: "Valabilitate",
            valoare:
              curs.valabilitate_luni === null
                ? "Nu expiră"
                : `${String(curs.valabilitate_luni)} luni, apoi reapare singur`,
          },
        ]}
      />

      <ConstructorCurs
        cursId={cursId}
        denumire={curs.denumire}
        publicat={curs.publicat}
        lectii={lectii}
        biblioteca={biblioteca}
        numarInrolati={numarInrolati}
        poateEdita={poateEdita}
      />

      {sabloane.length === 0 ? null : (
        <section aria-labelledby="titlu-sabloane-integrare" className="space-y-2">
          <h2 id="titlu-sabloane-integrare" className="text-sectiune font-medium">
            Folosit în șabloanele de integrare
          </h2>
          <ul className="text-corp space-y-1">
            {sabloane.map((s) => (
              <li key={`${s.id}-${s.pas}`}>
                {poateDeschideSabloane ? (
                  <Link
                    href={`/onboarding/sabloane/${s.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {s.denumire}
                  </Link>
                ) : (
                  s.denumire
                )}
                <span className="text-muted-foreground text-nota"> · pasul „{s.pas}”</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
