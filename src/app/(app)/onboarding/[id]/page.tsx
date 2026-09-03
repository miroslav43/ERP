// src/app/(app)/onboarding/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { PackageX } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
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
import { fisaMea } from "@/lib/queries/portal";

import { TONURI_STATUS_INSTANTA, ETICHETE_STATUS_INSTANTA, ETICHETE_TIP } from "../etichete";
import { ActiuniInstanta } from "./actiuni-instanta";
import { PasChecklist } from "./pas-checklist";

export const metadata: Metadata = { title: "Detaliile checklistului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaInstanta({ params }: ProprietatiPagina) {
  // Un segment care nu e UUID nu poate desemna niciun rând: 404, nu 22P02.
  const id = idDinRuta((await params).id);

  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "onboarding"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

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
  // responsabilul desemnat al pasului.
  //
  // Comparația se face cu fișa PRIVITORULUI, nu cu `instanta.employee_id`.
  // Raționamentul de dinainte — „scope «own» ⇒ pagina s-a încărcat doar pentru
  // propria instanță, deci subiectul SUNT eu" — se sprijinea pe faptul că
  // singura ramură „own" din `checklist_instances_select` era pe `employee_id`.
  // Migrarea 0088 adaugă a doua ramură, pe RESPONSABIL: un manager cu
  // `checklists:update = own` deschide acum parcursul unui subaltern, unde
  // `instanta.employee_id` e subalternul, nu el. Cu vechea comparație i s-ar fi
  // oferit bife pe pașii SUBIECTULUI (refuzate apoi de RLS) și i s-ar fi ascuns
  // exact pașii lui.
  //
  // Un parcurs închis nu primește bife deloc: `checklist_pregateste_pasul`
  // (0014:576) refuză orice modificare cu P0001, iar un buton care nu poate
  // reuși e un defect de ecran, nu o comoditate.
  const poateBifaOricare = can(permisiuni, "checklists:update", "team");
  const poateBifaOwn = can(permisiuni, "checklists:update", "own") && !poateBifaOricare;
  const fisaPrivitorului = poateBifaOwn ? await fisaMea(tenant.organizationId, user.id) : null;
  const idPropriu =
    fisaPrivitorului !== null && fisaPrivitorului.stare === "ok" ? fisaPrivitorului.fisa.id : null;
  const idPasuriBifabile =
    instanta.status !== "in_curs"
      ? []
      : pasi
          .filter(
            (p) =>
              p.verificare_automata === null &&
              (poateBifaOricare ||
                (poateBifaOwn && idPropriu !== null && p.responsabil_employee_id === idPropriu)),
          )
          .map((p) => p.id);

  // `approve`, nu `update`: 0088 a mutat închiderea parcursului pe cheia care
  // stătea seedată și moartă din 0002. Ecranul trebuie să ceară exact ce cer
  // acum `finalizeazaInstanta` și `anuleazaInstanta`, altfel butonul apare și
  // acțiunea îl refuză.
  const poateGestiona =
    can(permisiuni, "checklists:approve", "team") && instanta.status === "in_curs";

  // Vizibil MEREU pentru cine are dreptul (politica din 0014 cere
  // `checklists:update ≥ team`) — nu doar lângă butonul „Finalizează".
  // Pentru un scope mai mic, RLS întoarce pur și simplu listă goală.
  const bunuri =
    instanta.tip === "offboarding"
      ? await bunuriNereturnate(tenant.organizationId, instanta.employee_id)
      : [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/onboarding" className="underline-offset-2 hover:underline">
            Onboarding
          </Link>
        </p>
        <AntetPagina
          titlu={
            angajat === undefined
              ? "Checklist"
              : `${angajat.full_name ?? angajat.marca} (${angajat.marca})`
          }
          descriere={`${ETICHETE_TIP[instanta.tip]} · Referință ${formatDate(
            instanta.data_referinta,
          )} · Ciclul ${instanta.ciclu}`}
          actiuni={
            <Badge ton={TONURI_STATUS_INSTANTA[instanta.status]}>
              {ETICHETE_STATUS_INSTANTA[instanta.status]}
            </Badge>
          }
        />
      </div>

      {instanta.status === "anulata" && instanta.motiv_anulare !== null ? (
        <p className="border-border text-foreground text-corp rounded-panou border p-3">
          Motivul anulării: {instanta.motiv_anulare}
        </p>
      ) : null}

      {instanta.observatii === null || instanta.observatii.length === 0 ? null : (
        <p className="border-border text-foreground text-corp rounded-panou border p-3">
          Observații: {instanta.observatii}
        </p>
      )}

      {instanta.tip === "offboarding" && bunuri.length > 0 ? (
        <section
          aria-labelledby="titlu-bunuri"
          className="border-warning/40 bg-warning/12 rounded-panou border p-4"
        >
          <h2
            id="titlu-bunuri"
            className="text-foreground text-corp flex items-center gap-2 font-semibold"
          >
            <PackageX aria-hidden="true" className="size-4" />
            Bunuri nereturnate
          </h2>
          <p className="text-foreground text-corp mt-1">
            Checklistul poate fi finalizat doar după ce toate sunt returnate în modulul{" "}
            <Link href="/inventar" className="underline underline-offset-2">
              Inventar
            </Link>
            .
          </p>
          <ul className="text-foreground text-corp mt-2 space-y-1">
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
        <h2 id="titlu-pasi" className="text-sectiune font-semibold">
          Pași
        </h2>
        <PasChecklist pasi={pasi} idPasuriBifabile={idPasuriBifabile} />
      </section>

      {poateGestiona ? <ActiuniInstanta instantaId={instanta.id} /> : null}

      <p className="text-muted-foreground text-corp">
        <Link
          href={`/onboarding/${instanta.id}/dovada`}
          className="underline-offset-2 hover:underline"
        >
          Vezi dovada de parcurgere
        </Link>
      </p>
    </div>
  );
}
