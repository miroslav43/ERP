// src/app/(app)/mentenanta/sesizari/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import { angajatiDupaId, citesteInterventie, citesteSesizare } from "@/lib/queries/maintenance";

import {
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_STATUS_SESIZARE,
  ETICHETE_TIP_MENTENANTA,
  ETICHETE_URGENTA_SESIZARE,
  TONURI_STATUS_SESIZARE,
  TONURI_URGENTA_SESIZARE,
} from "../../etichete";
import { cautaEchipament } from "../../actions";
import { ActiuniSesizare } from "./actiuni-sesizare";

export const metadata: Metadata = { title: "Sesizare de defecțiune" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaSesizare({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta sesizările de defecțiune. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const sesizare = await citesteSesizare(tenant.organizationId, id);
  if (sesizare === null) notFound();

  /*
   * `equipment` nu se poate citi cu clientul utilizatorului pentru un
   * `employee` (col=null ⇒ cere „team”) — reutilizăm acțiunea de căutare,
   * apelată direct dintr-un Server Component, cu id-ul exact (capcane.md #27/#34).
   *
   * `intervention_id` era SCRIS de `rezolvaSesizare` și CITIT de
   * `citesteSesizare`, dar nimic nu-l folosea: legătura dintre defecțiune și
   * lucrarea care a rezolvat-o exista în bază și nu se vedea nicăieri în
   * interfață — ecranul arăta doar `rezolvat_la`, adică momentul, nu fapta.
   * Pentru un `employee`, RLS pe `maintenance_interventions` întoarce zero
   * rânduri și cardul lipsește; corect, costurile nu-i sunt destinate.
   */
  const [echipamentRezultat, interventie] = await Promise.all([
    cautaEchipament({ q: sesizare.equipment_id }),
    sesizare.intervention_id === null
      ? Promise.resolve(null)
      : citesteInterventie(tenant.organizationId, sesizare.intervention_id),
  ]);
  const echipament =
    echipamentRezultat.ok && echipamentRezultat.data.length > 0 ? echipamentRezultat.data[0] : null;

  // Un singur drum pentru toate numele de pe ecran — raportorul și, dacă
  // sesizarea a fost rezolvată intern, executantul intervenției.
  const numeAngajati = await angajatiDupaId(
    tenant.organizationId,
    [sesizare.raportat_de_employee_id, interventie?.executant_employee_id ?? null].filter(
      (id): id is string => id !== null,
    ),
  );
  const numeleAngajatului = (idAngajat: string | null): string | null =>
    idAngajat === null ? null : (numeAngajati.get(idAngajat)?.full_name ?? null);

  const poateGestiona = can(permisiuni, "maintenance:update", "team");
  const esteTerminala = sesizare.status === "rezolvat" || sesizare.status === "respins";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="text-muted-foreground text-corp">
          <Link href="/mentenanta/sesizari" className="underline-offset-2 hover:underline">
            Sesizări
          </Link>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Titlul e utilajul, deci trebuie să și ducă la el: triajul e o
              decizie care are nevoie de istoric. Doar pentru cine poate deschide
              fișa — `employee` are `maintenance:read = own` și ar primi un
              „acces restricționat” în loc de context. */}
          <h1 className="text-titlu font-semibold">
            {echipament === undefined || echipament === null ? (
              "Echipament necunoscut"
            ) : poateGestiona ? (
              <Link
                href={`/mentenanta/echipamente/${sesizare.equipment_id}`}
                className="underline-offset-4 hover:underline"
              >
                {echipament.cod} — {echipament.denumire}
              </Link>
            ) : (
              `${echipament.cod} — ${echipament.denumire}`
            )}
          </h1>
          <div className="flex flex-col items-end gap-1">
            <Badge ton={TONURI_URGENTA_SESIZARE[sesizare.urgenta]}>
              {ETICHETE_URGENTA_SESIZARE[sesizare.urgenta]}
            </Badge>
            <Badge ton={TONURI_STATUS_SESIZARE[sesizare.status]}>
              {ETICHETE_STATUS_SESIZARE[sesizare.status]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Iese din `<dl>`: un `<div>` copil de `<dl>` e valid doar dacă înfășoară
          perechi `dt`/`dd`, iar aici nu avea niciuna. În plus, „utilajul nu
          merge” e o condiție a întregii sesizări, nu un câmp al ei. */}
      {sesizare.opreste_functionarea ? (
        <Callout fel="atentie" titlu="Utilajul nu funcționează">
          Defecțiunea oprește funcționarea echipamentului. Raportată la{" "}
          {formatDateTime(sesizare.raportat_la)}.
        </Callout>
      ) : null}

      <section className="border-border rounded-panou space-y-3 border p-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">
              Raportată de
            </dt>
            <dd className="text-corp mt-0.5">
              {numeleAngajatului(sesizare.raportat_de_employee_id) ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">
              Raportată la
            </dt>
            <dd className="text-corp mt-0.5">{formatDateTime(sesizare.raportat_la)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-nota tracking-wide uppercase">Descriere</dt>
            <dd className="text-corp mt-0.5">{sesizare.descriere}</dd>
          </div>
          {sesizare.motiv_respingere !== null ? (
            <div className="sm:col-span-2">
              <dt className="text-danger text-nota tracking-wide uppercase">Motivul respingerii</dt>
              <dd className="text-corp mt-0.5">{sesizare.motiv_respingere}</dd>
            </div>
          ) : null}
          {sesizare.rezolvat_la !== null ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-nota tracking-wide uppercase">
                Rezolvată la
              </dt>
              <dd className="text-corp mt-0.5">{formatDateTime(sesizare.rezolvat_la)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {interventie === null ? null : (
        <section aria-labelledby="interventia-care-a-rezolvat" className="space-y-3">
          <h2 id="interventia-care-a-rezolvat" className="text-sectiune font-semibold">
            Rezolvată prin
          </h2>
          <div className="border-border rounded-panou space-y-1 border p-4">
            <p className="text-corp font-medium">{interventie.descriere}</p>
            <p className="text-muted-foreground text-nota">
              {ETICHETE_TIP_MENTENANTA[interventie.tip]} · {formatDate(interventie.data)} ·{" "}
              {interventie.executant_extern ??
                numeleAngajatului(interventie.executant_employee_id) ??
                "Executant necunoscut"}
            </p>
            <p className="text-corp">
              Cost:{" "}
              {formatLei(
                interventie.cost_total ?? interventie.cost_piese + interventie.cost_manopera,
              )}{" "}
              · Rezultat: {ETICHETE_REZULTAT_INTERVENTIE[interventie.rezultat]}
            </p>
            {interventie.piese === null ? null : (
              <p className="text-muted-foreground text-nota">Piese: {interventie.piese}</p>
            )}
            <p className="text-nota">
              <Link
                href={`/mentenanta/interventii?echipament=${sesizare.equipment_id}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                Toate intervențiile pe acest utilaj
              </Link>
            </p>
          </div>
        </section>
      )}

      {poateGestiona && !esteTerminala ? (
        <section aria-labelledby="actiuni-sesizare" className="space-y-3">
          <h2 id="actiuni-sesizare" className="text-sectiune font-semibold">
            Triaj și rezolvare
          </h2>
          <ActiuniSesizare sesizareId={sesizare.id} />
        </section>
      ) : null}

      {/* Pentru o sesizare închisă, ecranul nu mai avea nici acțiune, nici
          explicație: secțiunea de triaj pur și simplu lipsea, iar cine ajungea
          pe pagină nu afla de ce. */}
      {esteTerminala ? (
        <Callout
          fel={sesizare.status === "respins" ? "eroare" : "neutru"}
          titlu={sesizare.status === "respins" ? "Sesizare respinsă" : "Sesizare rezolvată"}
        >
          {sesizare.status === "respins"
            ? "Sesizarea a fost închisă fără intervenție. O defecțiune care persistă se raportează din nou, cu detaliile cerute în motivul respingerii."
            : "Sesizarea e închisă; nu mai sunt acțiuni de făcut pe ea. Dacă defecțiunea reapare, se raportează una nouă."}
        </Callout>
      ) : null}
    </div>
  );
}
