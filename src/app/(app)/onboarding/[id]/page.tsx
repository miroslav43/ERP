// src/app/(app)/onboarding/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { PackageX } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiDupaId,
  bunuriNereturnate,
  citesteInstanta,
  pasiiInstantei,
} from "@/lib/queries/checklist";

import { CLASE_STATUS_INSTANTA, ETICHETE_STATUS_INSTANTA, ETICHETE_TIP } from "../etichete";
import { ActiuniInstanta } from "./actiuni-instanta";
import { PasChecklist } from "./pas-checklist";

export const metadata: Metadata = { title: "Detaliile checklistului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaInstanta({ params }: ProprietatiPagina) {
  // Un segment care nu e UUID nu poate desemna niciun rând: 404, nu 22P02.
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "onboarding");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "checklists:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta checklisturile de integrare. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const instanta = await citesteInstanta(tenant.organizationId, id);
  if (instanta === null) notFound();

  const pasi = await pasiiInstantei(tenant.organizationId, instanta.id);

  const poateVedeaAngajati = can(permisiuni, "employees:read", "team");
  const angajat = poateVedeaAngajati
    ? (await angajatiDupaId(tenant.organizationId, [instanta.employee_id])).get(
        instanta.employee_id,
      )
    : undefined;

  // Bifare = poate gestiona orice pas al echipei (scope „team"/„all") SAU e
  // chiar subiectul checklistului și pasul îi e alocat lui însuși.
  //
  // Dacă scope-ul e strict „own" (nu „team"/„all"), politica
  // `checklist_instances_select` a lăsat pagina să se încarce DOAR pentru
  // propria instanță — e singura ramură „own" din acea politică. Nu mai e
  // nevoie de o interogare separată pe `employees` (care oricum ar eșua
  // pentru rolul `employee`, cu `employees:read = none`) ca să aflăm fișa
  // proprie: e chiar `instanta.employee_id`.
  const poateBifaOricare = can(permisiuni, "checklists:update", "team");
  const poateBifaOwn = can(permisiuni, "checklists:update", "own") && !poateBifaOricare;
  const idPasuriBifabile = pasi
    .filter(
      (p) =>
        p.verificare_automata === null &&
        (poateBifaOricare || (poateBifaOwn && p.responsabil_employee_id === instanta.employee_id)),
    )
    .map((p) => p.id);

  const poateGestiona = can(permisiuni, "checklists:update", "team") && instanta.status === "in_curs";

  // Vizibil MEREU pentru cine are dreptul (politica din 0014 cere
  // `checklists:update ≥ team`) — nu doar lângă butonul „Finalizează".
  // Pentru un scope mai mic, RLS întoarce pur și simplu listă goală.
  const bunuri =
    instanta.tip === "offboarding"
      ? await bunuriNereturnate(tenant.organizationId, instanta.employee_id)
      : [];

  return (
    <main className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/onboarding" className="underline-offset-2 hover:underline">
              Onboarding
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">
            {angajat === undefined ? "Checklist" : `${angajat.full_name ?? angajat.marca} (${angajat.marca})`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ETICHETE_TIP[instanta.tip]} · Referință {formatDate(instanta.data_referinta)} · Ciclul{" "}
            {instanta.ciclu}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${CLASE_STATUS_INSTANTA[instanta.status]}`}
        >
          {ETICHETE_STATUS_INSTANTA[instanta.status]}
        </span>
      </header>

      {instanta.status === "anulata" && instanta.motiv_anulare !== null ? (
        <p className="rounded-lg border border-border p-3 text-sm text-foreground">
          Motivul anulării: {instanta.motiv_anulare}
        </p>
      ) : null}

      {instanta.observatii === null || instanta.observatii.length === 0 ? null : (
        <p className="rounded-lg border border-border p-3 text-sm text-foreground">
          Observații: {instanta.observatii}
        </p>
      )}

      {instanta.tip === "offboarding" && bunuri.length > 0 ? (
        <section
          aria-labelledby="titlu-bunuri"
          className="rounded-lg border border-warning/40 bg-warning/12 p-4"
        >
          <h2
            id="titlu-bunuri"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <PackageX aria-hidden="true" className="size-4" />
            Bunuri nereturnate
          </h2>
          <p className="mt-1 text-sm text-foreground">
            Checklistul poate fi finalizat doar după ce toate sunt returnate în modulul{" "}
            <Link href="/inventar" className="underline underline-offset-2">
              Inventar
            </Link>
            .
          </p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {bunuri.map((b) => (
              <li key={b.id}>
                {b.item.denumire} ({b.item.numar_inventar}) — în primire din{" "}
                {formatDateTime(b.predat_la)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="titlu-pasi" className="space-y-3">
        <h2 id="titlu-pasi" className="text-lg font-semibold">
          Pași
        </h2>
        <PasChecklist pasi={pasi} idPasuriBifabile={idPasuriBifabile} />
      </section>

      {poateGestiona ? <ActiuniInstanta instantaId={instanta.id} /> : null}

      <p className="text-sm text-muted-foreground">
        <Link href={`/onboarding/${instanta.id}/dovada`} className="underline-offset-2 hover:underline">
          Vezi dovada de parcurgere
        </Link>
      </p>
    </main>
  );
}
