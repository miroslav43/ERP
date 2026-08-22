// src/app/(app)/onboarding/sabloane/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteSablon, pasiiSablonului } from "@/lib/queries/checklist";

import { ETICHETE_TIP } from "../../etichete";
import { FormularSablon } from "../nou/formular-sablon";
import { ListaPasi } from "./lista-pasi";

export const metadata: Metadata = { title: "Șablon de checklist" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

interface OptiuneDenumita {
  readonly id: string;
  readonly denumire: string;
}

export default async function PaginaSablon({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta șabloanele de checklist. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const sablon = await citesteSablon(tenant.organizationId, id);
  if (sablon === null) notFound();

  const pasi = await pasiiSablonului(tenant.organizationId, sablon.id);

  const poateEditareSablon = can(permisiuni, "checklists:update", "all");
  const poateEditarePasi = can(permisiuni, "checklists:update", "all");
  const poateAdaugaPas = can(permisiuni, "checklists:create", "all");

  let departamente: readonly OptiuneDenumita[] = [];
  let posturi: readonly OptiuneDenumita[] = [];
  if (poateEditareSablon) {
    const db = await createServerSupabase();
    const [departamenteRes, posturiRes] = await Promise.all([
      db
        .from("departments")
        .select("id, denumire")
        .eq("organization_id", tenant.organizationId)
        .eq("activ", true)
        .order("denumire")
        .limit(200)
        .returns<OptiuneDenumita[]>(),
      db
        .from("job_positions")
        .select("id, denumire")
        .eq("organization_id", tenant.organizationId)
        .eq("activ", true)
        .order("denumire")
        .limit(200)
        .returns<OptiuneDenumita[]>(),
    ]);
    departamente = departamenteRes.data ?? [];
    posturi = posturiRes.data ?? [];
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-muted-foreground text-sm">
          <Link href="/onboarding/sabloane" className="underline-offset-2 hover:underline">
            Șabloane
          </Link>
        </p>
        <h1 className="text-2xl font-semibold">{sablon.denumire}</h1>
        <p className="text-muted-foreground text-sm">
          {ETICHETE_TIP[sablon.tip]} · Valabil de la {formatDate(sablon.valabil_de_la)}
          {sablon.valabil_pana_la === null
            ? ""
            : ` până la ${formatDate(sablon.valabil_pana_la)}`}{" "}
          · {sablon.activ ? "Activ" : "Dezactivat"}
        </p>
      </header>

      {poateEditareSablon ? (
        <section aria-labelledby="titlu-editare" className="space-y-3">
          <h2 id="titlu-editare" className="text-lg font-semibold">
            Datele șablonului
          </h2>
          <FormularSablon
            departamente={departamente}
            posturi={posturi}
            astazi={sablon.valabil_de_la}
            initial={sablon}
          />
        </section>
      ) : null}

      <section aria-labelledby="titlu-pasi" className="space-y-3">
        <h2 id="titlu-pasi" className="text-lg font-semibold">
          Pași
        </h2>
        <ListaPasi
          templateId={sablon.id}
          pasi={pasi}
          poateEditare={poateEditarePasi}
          poateAdauga={poateAdaugaPas}
        />
      </section>
    </main>
  );
}
