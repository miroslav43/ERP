// src/app/(app)/pontaj/aprobare/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarClock, CheckCircle2 } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { SkeletonTable } from "@/components/data/skeleton-table";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatMonthYear, todayInBucharest } from "@/lib/format/date";
import { anDinUrl, filtreDinUrl } from "@/lib/rute/parametri";
import {
  angajatiPontajDupaId,
  citestePerioada,
  departamente,
  liniiDeAprobat,
  saptamaniDeAprobat,
} from "@/lib/queries/attendance";
import { filtreAprobareSchema } from "@/schemas/attendance";

import { NavPontaj } from "../nav-pontaj";
import { ActiuniPerioada } from "../perioade/actiuni-perioada";
import { AprobareBloc } from "./aprobare-bloc";
import { ListaSaptamaniDeAprobat } from "./lista-saptamani-de-aprobat";

export const metadata: Metadata = { title: "Aprobare pontaj" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function ContinutAprobare({
  organizationId,
  an,
  luna,
  periodId,
  status,
  departmentId,
  poateBloca,
  poateSincroniza,
}: {
  readonly organizationId: string;
  readonly an: number;
  readonly luna: number;
  readonly periodId: string;
  readonly status: "deschisa" | "in_aprobare" | "blocata";
  readonly departmentId: string | null;
  readonly poateBloca: boolean;
  readonly poateSincroniza: boolean;
}) {
  const linii = await liniiDeAprobat(organizationId, periodId);
  const idAngajati = [...new Set(linii.map((l) => l.employee_id))];
  const angajati = await angajatiPontajDupaId(organizationId, idAngajati);

  const liniiFiltrate =
    departmentId === null
      ? linii
      : linii.filter((l) => angajati.get(l.employee_id)?.department_id === departmentId);

  const perAngajat = new Map<string, { readonly nume: string; zile: number; ore: number }>();
  for (const linie of liniiFiltrate) {
    const angajat = angajati.get(linie.employee_id);
    const nume = angajat === undefined ? "Angajat necunoscut" : `${angajat.full_name} (${angajat.marca})`;
    const existent = perAngajat.get(linie.employee_id);
    if (existent === undefined) {
      perAngajat.set(linie.employee_id, { nume, zile: 1, ore: linie.ore_lucrate });
    } else {
      perAngajat.set(linie.employee_id, {
        nume: existent.nume,
        zile: existent.zile + 1,
        ore: existent.ore + linie.ore_lucrate,
      });
    }
  }

  return (
    <div className="space-y-4">
      <AprobareBloc
        periodId={periodId}
        departmentId={departmentId}
        numarLiniiNeaprobate={liniiFiltrate.length}
        an={an}
        luna={luna}
        poateSincroniza={poateSincroniza}
      />

      {poateBloca ? (
        <div className="rounded-lg border border-border p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            Blocarea perioadei este aprobarea finală: oprește orice scriere ulterioară asupra
            lunii, inclusiv corecțiile manuale.
          </p>
          <ActiuniPerioada
            an={an}
            luna={luna}
            periodId={periodId}
            status={status}
            poateDeschide={false}
            poateBloca={poateBloca}
          />
        </div>
      ) : null}

      {perAngajat.size === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nimic de aprobat"
          description="Toate liniile de pontaj ale acestei luni au fost deja aprobate."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Angajații cu linii de pontaj neaprobate.</caption>
            <thead className="bg-surface text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Angajat
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Zile neaprobate
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Ore lucrate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...perAngajat.entries()].map(([id, rand]) => (
                <tr key={id}>
                  <td className="px-4 py-3">{rand.nume}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rand.zile}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rand.ore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function PaginaAprobarePontaj({ searchParams }: ProprietatiPagina) {
  const { user, tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "attendance:approve", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a aproba pontaj. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateBloca = can(permisiuni, "attendance:approve", "all");
  const enabledFeatures = await getEnabledFeatures(tenant.organizationId);
  const poateSincroniza = can(permisiuni, "attendance:create", "all") && enabledFeatures.has("leave");

  const parametri = await searchParams;
  const an = anDinUrl(parametri["an"], Number(todayInBucharest().slice(0, 4)));
  const filtre = filtreDinUrl(filtreAprobareSchema, parametri);

  const perioada = await citestePerioada(tenant.organizationId, an, filtre.luna);
  const listaDepartamente = await departamente(tenant.organizationId);
  const sarciniSaptamana = await saptamaniDeAprobat(tenant.organizationId, user.id);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Aprobare pontaj</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Aprobarea în bloc pentru {formatMonthYear(an, filtre.luna)}.
        </p>
      </header>

      <NavPontaj poateAproba={true} />

      <ListaSaptamaniDeAprobat sarcini={sarciniSaptamana} />

      {listaDepartamente.length === 0 ? null : (
        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
          {/* Formular GET simplu, fără JavaScript: fără câmp explicit, `an` s-ar
              pierde din query string la reîncărcare. */}
          <input type="hidden" name="an" value={an} />
          <div className="flex flex-col gap-1">
            <label htmlFor="luna" className="text-sm font-medium">
              Luna
            </label>
            <input
              id="luna"
              name="luna"
              type="number"
              min={1}
              max={12}
              defaultValue={filtre.luna}
              className="w-20 rounded-md border border-foreground/60 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="departament" className="text-sm font-medium">
              Departament
            </label>
            <select
              id="departament"
              name="departament"
              defaultValue={filtre.departament ?? ""}
              className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
            >
              <option value="">Toate</option>
              {listaDepartamente.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.denumire}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Filtrează
          </button>
        </form>
      )}

      {perioada === null ? (
        <EmptyState
          icon={CalendarClock}
          title="Luna nu a fost deschisă"
          description="Nu există nimic de aprobat cât timp luna nu a fost deschisă din „Perioade”."
        />
      ) : (
        <Suspense
          key={`${String(an)}-${String(filtre.luna)}-${filtre.departament ?? ""}`}
          fallback={<SkeletonTable cols={3} />}
        >
          <ContinutAprobare
            organizationId={tenant.organizationId}
            an={an}
            luna={filtre.luna}
            periodId={perioada.id}
            status={perioada.status}
            departmentId={filtre.departament}
            poateBloca={poateBloca}
            poateSincroniza={poateSincroniza}
          />
        </Suspense>
      )}
    </main>
  );
}
