// src/app/(app)/salarizare/[id]/[entryId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { numeLuna } from "../../etichete";
import { Fluturas } from "@/components/payroll/fluturas";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  citesteInregistrare,
  citestePerioada,
  listeazaBonusuriSiRetineri,
} from "@/lib/queries/payroll";

import { AVERTISMENT_SALARIZARE } from "../../etichete";
import { poateDeschide, type ContextPorti } from "@/config/porti-ruta";
import { hrefAvertisment } from "../../legaturi-avertismente";
import { listeazaInregistrari } from "@/lib/queries/payroll";

export const metadata: Metadata = { title: "Fluturaș" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string; readonly entryId: string }>;
}

export default async function PaginaFluturas({ params }: ProprietatiPagina) {
  const { id, entryId } = await params;
  idDinRuta(id);
  const idInregistrare = idDinRuta(entryId);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni, module] = await Promise.all([
    requireFeature(tenant.organizationId, "payroll"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
  ]);

  if (!can(permisiuni, "payroll:read", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta salarizarea." />
      </div>
    );
  }

  const inregistrare = await citesteInregistrare(tenant.organizationId, idInregistrare);
  if (inregistrare === null) notFound();
  // Toate trei depind de `inregistrare`, dar nu una de alta — deci un val, nu trei.
  const [perioada, { bonusuri, retineri }, registru] = await Promise.all([
    // Aici perioada CHIAR se poate citi: ecranul cere `payroll:read = "all"`,
    // adică exact ce cere `payroll_periods_select`. În portal nu se poate — vezi
    // nota de pe `perioada` din `Fluturas`.
    citestePerioada(tenant.organizationId, inregistrare.period_id),
    listeazaBonusuriSiRetineri(
      tenant.organizationId,
      inregistrare.period_id,
      inregistrare.employee_id,
    ),
    // Vecinii din registru, în ordinea tabelului perioadei (după nume): ca să
    // verifici toți fluturașii unei luni înainte de „Aprobă" nu mai faci de
    // fiecare dată drumul fluturaș → listă → fluturaș.
    listeazaInregistrari(inregistrare.period_id),
  ]);
  const pozitia = registru.randuri.findIndex((r) => r.id === inregistrare.id);
  const anterior = pozitia > 0 ? (registru.randuri[pozitia - 1] ?? null) : null;
  const urmator = pozitia >= 0 ? (registru.randuri[pozitia + 1] ?? null) : null;

  // Țintele de pe fluturaș, fiecare prin poarta paginii-ȚINTĂ: pontajul și
  // concediile sunt module opționale, iar `requireFeature` dă 404 fără ele.
  const contextPorti: ContextPorti = { features: module, permissions: permisiuni };
  const contextFluturas =
    perioada === null
      ? null
      : {
          periodId: perioada.id,
          employeeId: inregistrare.employee_id,
          an: perioada.an,
          luna: perioada.luna,
        };
  const parametriLuna =
    perioada === null ? null : `an=${String(perioada.an)}&luna=${String(perioada.luna)}`;
  const lunaIso = perioada === null ? null : String(perioada.luna).padStart(2, "0");
  const ultimaZi =
    perioada === null
      ? null
      : String(new Date(Date.UTC(perioada.an, perioada.luna, 0)).getUTCDate()).padStart(2, "0");
  const hrefPontaj =
    parametriLuna !== null &&
    poateDeschide("/pontaj", contextPorti) &&
    can(permisiuni, "attendance:read", "all")
      ? `/pontaj?${parametriLuna}&angajat=${inregistrare.employee_id}`
      : null;
  const hrefConcedii =
    perioada !== null &&
    poateDeschide("/concedii/echipa", contextPorti) &&
    can(permisiuni, "leave:read", "all")
      ? `/concedii/echipa?employee_id=${inregistrare.employee_id}&de_la=${String(perioada.an)}-${lunaIso ?? ""}-01&pana_la=${String(perioada.an)}-${lunaIso ?? ""}-${ultimaZi ?? ""}`
      : null;
  const hrefAvertismente =
    contextFluturas === null
      ? []
      : inregistrare.calc_warnings.map((w) =>
          hrefAvertisment(w.cod, contextFluturas, contextPorti),
        );

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/salarizare" className="underline-offset-2 hover:underline">
            Salarizare
          </Link>
          {" › "}
          <Link href={`/salarizare/${id}`} className="underline-offset-2 hover:underline">
            {perioada === null
              ? "Perioada de salarizare"
              : `${numeLuna(perioada.luna)} ${perioada.an}`}
          </Link>
        </p>
        <AntetPagina
          titlu={inregistrare.angajat?.full_name ?? inregistrare.angajat?.marca ?? "Angajat"}
          {...(can(permisiuni, "employees:read", "all") && inregistrare.angajat !== null
            ? {
                actiuni: (
                  <Link
                    href={`/angajati/${inregistrare.employee_id}`}
                    className={buton({ varianta: "secundar" })}
                  >
                    Fișa angajatului
                  </Link>
                ),
              }
            : {})}
        />
        {anterior === null && urmator === null ? null : (
          <nav aria-label="Fluturașii vecini" className="text-corp flex flex-wrap gap-x-4">
            {anterior === null ? null : (
              <Link
                href={`/salarizare/${id}/${anterior.id}`}
                className="underline-offset-2 hover:underline"
              >
                ← {anterior.angajat?.full_name || anterior.angajat?.marca || "Fluturașul anterior"}
              </Link>
            )}
            {urmator === null ? null : (
              <Link
                href={`/salarizare/${id}/${urmator.id}`}
                className="underline-offset-2 hover:underline"
              >
                {urmator.angajat?.full_name || urmator.angajat?.marca || "Fluturașul următor"} →
              </Link>
            )}
          </nav>
        )}
      </div>

      <div
        role="note"
        className="border-warning/40 bg-warning/8 rounded-panou text-nota border p-4"
      >
        {AVERTISMENT_SALARIZARE}
      </div>

      <Fluturas
        inregistrare={inregistrare}
        bonusuri={bonusuri}
        retineri={retineri}
        perioada={perioada === null ? null : { an: perioada.an, luna: perioada.luna }}
        hrefDiurna={
          poateDeschide("/diurna", contextPorti)
            ? `/diurna?angajat=${inregistrare.employee_id}`
            : null
        }
        hrefPontaj={hrefPontaj}
        hrefConcedii={hrefConcedii}
        hrefAvertismente={hrefAvertismente}
        hrefPopriri={
          poateDeschide("/salarizare/popriri", contextPorti) ? "/salarizare/popriri" : null
        }
      />

      <a
        href={`/api/export/salarizare/fluturas?inregistrare=${inregistrare.id}`}
        className={buton({ varianta: "secundar" })}
      >
        Descarcă fluturașul (PDF)
      </a>
    </div>
  );
}
