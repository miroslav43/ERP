// src/app/(app)/evaluari/ale-mele/kpi-ul-meu.tsx
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Nivel } from "@/components/ui/nivel";
import { kpiAngajat } from "@/lib/queries/kpi";

import {
  ETICHETE_STATUS_KPI,
  TONURI_STATUS_KPI,
  formatValoare,
  numeLuna,
  tonKpi,
} from "../kpi/etichete";

/**
 * Luna KPI proprie, pentru cei care NU intră în portal.
 *
 * „Ale mele" acoperea doar evaluarea anuală: un manager evaluat lunar nu-și
 * vedea KPI-ul nicăieri, fiindcă portalul e al rolului `employee`, iar
 * `can_access_kpi` pe scope `team` citea doar subarborele, fără propria fișă
 * (analiza 2026-10-08, evaluari-L17). Migrarea 0190 deschide citirea propriei
 * luni; aici e ecranul ei, cu aceeași citire ca portalul (`kpiAngajat`).
 * Fără set sau fără lună deschisă, secțiunea nu apare: n-ar avea ce spune.
 */
export async function KpiUlMeu({
  organizationId,
  employeeId,
  an,
  luna,
  hrefToate,
}: Readonly<{
  organizationId: string;
  employeeId: string;
  an: number;
  luna: number;
  /** `/evaluari/kpi?angajat=`, când pagina se deschide pentru rol; `null` = fără link. */
  hrefToate: string | null;
}>) {
  const { luna: lunaKpi, serie } = await kpiAngajat(organizationId, employeeId, an, luna);
  if (lunaKpi === null && serie.length === 0) return null;

  return (
    <section
      aria-labelledby="titlu-kpi-ul-meu"
      className="border-border bg-surface rounded-panou space-y-3 border p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titlu-kpi-ul-meu" className="text-sectiune font-medium">
          KPI-ul meu · {numeLuna(an, luna)}
        </h2>
        {lunaKpi === null ? (
          <Badge ton="neutru">Neîncepută</Badge>
        ) : (
          <Badge ton={TONURI_STATUS_KPI[lunaKpi.status]}>
            {ETICHETE_STATUS_KPI[lunaKpi.status]}
          </Badge>
        )}
      </header>

      {lunaKpi === null ? (
        <p className="text-muted-foreground text-corp">Managerul n-a deschis încă luna aceasta.</p>
      ) : (
        <>
          {lunaKpi.scor.procent === null ? (
            <p className="text-muted-foreground text-corp">Nicio linie completată încă.</p>
          ) : (
            <Nivel
              valoare={lunaKpi.scor.procent}
              din={100}
              eticheta="Scorul lunii"
              text={`${String(lunaKpi.scor.procent)} % din țintă`}
              ton={tonKpi(lunaKpi.scor.procent)}
            />
          )}
          <ul className="divide-border text-corp divide-y">
            {lunaKpi.valori.map((v) => (
              <li key={v.cod} className="flex flex-wrap items-baseline gap-x-2 py-2">
                <span className="font-medium">{v.denumire}</span>
                <span className="text-muted-foreground text-nota">
                  {v.tip === "masurat"
                    ? `${formatValoare(v.realizat, v.unitate)} din ${formatValoare(v.tinta, v.unitate)}`
                    : v.nota === null
                      ? "nenotat încă"
                      : `nota ${String(v.nota)} din ${String(v.scala_max ?? 5)}`}
                </span>
                <span className="ms-auto font-semibold tabular-nums">
                  {v.procent === null ? "—" : `${String(v.procent)} %`}
                </span>
              </li>
            ))}
          </ul>
          {lunaKpi.concluzie === null ? null : (
            <p className="text-muted-foreground text-corp">{lunaKpi.concluzie}</p>
          )}
        </>
      )}

      {serie.length === 0 ? null : (
        <p className="text-nota text-muted-foreground">
          Lunile anterioare:{" "}
          {serie
            .filter((p) => !(p.an === an && p.luna === luna))
            .slice(0, 6)
            .map((p, indice) => (
              <span key={p.id}>
                {indice > 0 ? " · " : ""}
                {numeLuna(p.an, p.luna)}{" "}
                {p.scor_procent === null ? "—" : `${String(p.scor_procent)} %`}
              </span>
            ))}
          .
          {hrefToate === null ? null : (
            <>
              {" "}
              <Link href={hrefToate} className="underline underline-offset-2">
                Toate lunile
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}
